// =============================================
// Delivery Destinations Module
// A destination is one room on site: building (A-E), floor (0 = ground) and the
// client-supplied room code. Each pod points at one destination, and that
// address is what the delivery note carries.
//
// The client hands over the room list as a spreadsheet, so the flow is:
//   import the list once  ->  auto-assign pods by type/direction  ->  fix the
//   exceptions by hand  ->  print a delivery note per pod.
// =============================================

let _destProjectId = null;
let _destRows = [];        // pod_destinations rows for the project
let _destPods = [];        // pods of the project (with type/direction)
let _destBuildingFilter = '';
let _destIsPanel = false;

// ---- LABELS ----
// Floor 0 is the ground floor; the rest are plain numbers.
function destFloorLabel(floor) {
  const n = parseInt(floor);
  return n === 0 ? t('dest.groundFloor') : t('dest.floorN', { n });
}

// One-line address for screens, exports and the delivery note.
function destAddressLabel(dest) {
  if (!dest) return '';
  return t('dest.addressLine', {
    building: dest.building,
    floor: destFloorLabel(dest.floor),
    room: dest.room_code,
  });
}

// Sort key: building, then floor, then room code (numeric-aware so 10 follows 9).
function destSortValue(d) {
  return [String(d.building || ''), parseInt(d.floor) || 0, String(d.room_code || '')];
}
function destCompare(a, b) {
  const [ab, af, ar] = destSortValue(a);
  const [bb, bf, br] = destSortValue(b);
  if (ab !== bb) return ab.localeCompare(bb);
  if (af !== bf) return af - bf;
  return ar.localeCompare(br, undefined, { numeric: true });
}

// Pods keep their canonical order: the 3-digit serial at the end of the code.
function destPodSerial(code) { return parseInt((code || '').slice(-3)) || 0; }

// ---- LOAD ----
async function loadDestinationsTab(projectId) {
  _destProjectId = projectId;
  _destIsPanel = projIsPanel(AppState.currentProject);
  const container = document.getElementById('destinations-list');
  if (!container) return;

  const [{ data: dests, error: destErr }, { data: pods }] = await Promise.all([
    supabaseClient.from('pod_destinations').select('*').eq('project_id', projectId),
    supabaseClient.from('pods')
      .select('id, pod_code, destination_id, project_types(type_number, model_name), type_directions(direction)')
      .eq('project_id', projectId),
  ]);

  // The table only exists after migration 20260824000000. Say so instead of
  // rendering an empty tab that looks like "no destinations yet".
  if (destErr) {
    console.error('[destinations] load failed:', destErr);
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📍</div>
      <div class="empty-state-text">${t('dest.errNeedMigration')}</div></div>`;
    document.getElementById('destinations-stats').innerHTML = '';
    return;
  }

  _destRows = (dests || []).sort(destCompare);
  _destPods = (pods || []).sort((a, b) => destPodSerial(a.pod_code) - destPodSerial(b.pod_code));
  renderDestinationsTab();
}

// ---- RENDER ----
function renderDestinationsTab() {
  const container = document.getElementById('destinations-list');
  const statsEl = document.getElementById('destinations-stats');
  const canEditDest = isAdminOrPM();

  const podByDest = {};
  _destPods.forEach(p => { if (p.destination_id) podByDest[p.destination_id] = p; });

  const assigned = _destRows.filter(d => podByDest[d.id]).length;
  const podsWithout = _destPods.filter(p => !p.destination_id).length;

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="pods-stat-card pods-stat-total">
        <div class="pods-stat-value">${_destRows.length}</div>
        <div class="pods-stat-label">${t('dest.statTotal')}</div>
      </div>
      <div class="pods-stat-card pods-stat-completed">
        <div class="pods-stat-value">${assigned}</div>
        <div class="pods-stat-label">${t('dest.statAssigned')}</div>
      </div>
      <div class="pods-stat-card pods-stat-pending">
        <div class="pods-stat-value">${_destRows.length - assigned}</div>
        <div class="pods-stat-label">${t('dest.statUnassigned')}</div>
      </div>
      <div class="pods-stat-card pods-stat-inprogress">
        <div class="pods-stat-value">${podsWithout}</div>
        <div class="pods-stat-label">${_destIsPanel ? t('dest.statPanelsNoDest') : t('dest.statPodsNoDest')}</div>
      </div>`;
  }

  if (_destRows.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📍</div>
      <div class="empty-state-text">${t('dest.empty')}</div></div>`;
    return;
  }

  const buildings = [...new Set(_destRows.map(d => d.building))].sort();
  const rows = _destBuildingFilter
    ? _destRows.filter(d => d.building === _destBuildingFilter)
    : _destRows;

  // Grouped by building -> floor so the table reads like the site itself.
  let html = `
    <div class="filter-bar">
      <select id="dest-filter-building" class="form-control filter-select">
        <option value="">${t('dest.allBuildings')}</option>
        ${buildings.map(b => `<option value="${escHtml(b)}" ${b === _destBuildingFilter ? 'selected' : ''}>${t('dest.buildingN', { b: escHtml(b) })}</option>`).join('')}
      </select>
    </div>`;

  let lastKey = null;
  html += '<div class="dest-groups">';
  rows.forEach(d => {
    const key = `${d.building}|${d.floor}`;
    if (key !== lastKey) {
      if (lastKey !== null) html += '</tbody></table></div>';
      lastKey = key;
      html += `
        <div class="dest-group">
          <div class="dest-group-header">${t('dest.buildingN', { b: escHtml(d.building) })} · ${destFloorLabel(d.floor)}</div>
          <table class="dest-table"><thead><tr>
            <th>${t('dest.room')}</th>
            <th>${t('dest.expected')}</th>
            <th>${_destIsPanel ? t('dest.assignedPanel') : t('dest.assignedPod')}</th>
            <th></th>
          </tr></thead><tbody>`;
    }
    const pod = podByDest[d.id];
    const expected = d.type_number
      ? `T${d.type_number}${(!_destIsPanel && d.direction) ? ` · ${d.direction === 'R' ? t('proj.dirRight') : t('proj.dirLeft')}` : ''}`
      : '—';
    html += `
      <tr>
        <td class="dest-room">${escHtml(d.room_code)}</td>
        <td>${expected}</td>
        <td>${pod
          ? `<span class="dest-pod-code">${escHtml(pod.pod_code)}</span>`
          : `<span class="dest-unassigned">${t('dest.noPod')}</span>`}</td>
        <td class="table-actions">
          ${canEditDest ? `
            <button class="btn btn-secondary btn-sm btn-dest-assign" data-dest-id="${d.id}">${pod ? t('dest.change') : t('dest.assign')}</button>
            ${pod ? `<button class="btn btn-ghost btn-sm btn-dest-unassign" data-pod-id="${pod.id}">${t('dest.unassign')}</button>` : ''}
            <button class="btn btn-danger btn-sm btn-dest-delete" data-dest-id="${d.id}" title="${t('common.delete')}">🗑</button>` : ''}
        </td>
      </tr>`;
  });
  html += '</tbody></table></div></div>';
  container.innerHTML = html;

  document.getElementById('dest-filter-building')?.addEventListener('change', (e) => {
    _destBuildingFilter = e.target.value;
    renderDestinationsTab();
  });
  container.querySelectorAll('.btn-dest-assign').forEach(btn => {
    btn.addEventListener('click', () => showAssignPodModal(btn.dataset.destId));
  });
  container.querySelectorAll('.btn-dest-unassign').forEach(btn => {
    btn.addEventListener('click', () => setPodDestination(btn.dataset.podId, null));
  });
  container.querySelectorAll('.btn-dest-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteDestination(btn.dataset.destId));
  });
}

// ---- ASSIGNMENT ----
// destination_id is written on the pod, so a pod can hold at most one address
// and the partial unique index keeps two pods off the same room.
async function setPodDestination(podId, destId) {
  const { error } = await supabaseClient.from('pods').update({ destination_id: destId }).eq('id', podId);
  if (error) {
    console.error('[destinations] assign failed:', error);
    showToast(error.code === '23505' ? t('dest.errRoomTaken') : t('dest.errAssign'), 'error');
    return false;
  }
  const pod = _destPods.find(p => p.id === podId);
  if (pod) pod.destination_id = destId;
  renderDestinationsTab();
  return true;
}

// Picker for one room: unassigned units only, the ones matching the room's
// expected type/direction first, with a free-text search over the code.
function showAssignPodModal(destId) {
  const dest = _destRows.find(d => d.id === destId);
  if (!dest) return;

  const free = _destPods.filter(p => !p.destination_id);
  const matches = p =>
    (!dest.type_number || p.project_types?.type_number === dest.type_number) &&
    (_destIsPanel || !dest.direction || p.type_directions?.direction === dest.direction);
  const ordered = [...free.filter(matches), ...free.filter(p => !matches(p))];

  const optionRow = p => `
    <button class="dest-pick-row${matches(p) ? ' dest-pick-match' : ''}" data-pod-id="${p.id}" data-code="${escHtml(p.pod_code.toLowerCase())}">
      <span class="dest-pod-code">${escHtml(p.pod_code)}</span>
      <span class="dest-pick-meta">${escHtml(typeLabel(p.project_types))}${(!_destIsPanel && p.type_directions?.direction) ? ` · ${p.type_directions.direction}` : ''}</span>
      ${matches(p) ? `<span class="dest-pick-badge">${t('dest.matches')}</span>` : ''}
    </button>`;

  openModal(t('dest.assignTitle', { address: destAddressLabel(dest) }), `
    ${ordered.length === 0 ? `<div class="empty-state-text">${t('dest.noFreePods')}</div>` : `
      <input type="text" id="dest-pick-search" class="form-control" placeholder="${t('dest.searchPod')}" />
      <div class="dest-pick-list">${ordered.map(optionRow).join('')}</div>`}
  `, [{ label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-dest-pick-cancel' }]);

  document.getElementById('btn-dest-pick-cancel')?.addEventListener('click', closeModal);
  document.getElementById('dest-pick-search')?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.dest-pick-row').forEach(row => {
      row.style.display = (!q || row.dataset.code.includes(q)) ? '' : 'none';
    });
  });
  document.querySelectorAll('.dest-pick-row').forEach(row => {
    row.addEventListener('click', async () => {
      if (await setPodDestination(row.dataset.podId, destId)) {
        closeModal();
        showToast(t('dest.assigned'), 'success');
      }
    });
  });
}

// Bulk assignment: walk the rooms in site order and hand each the first free
// unit of the expected type (and direction, for pods). A room with no expected
// type is left alone — guessing there would ship a unit to the wrong room.
async function autoAssignDestinations() {
  const free = _destPods.filter(p => !p.destination_id);
  const open = _destRows.filter(d => !_destPods.some(p => p.destination_id === d.id));
  if (open.length === 0) { showToast(t('dest.allAssigned'), 'info'); return; }

  const taken = new Set();
  const plan = [];
  let noType = 0;
  for (const dest of open) {
    if (!dest.type_number) { noType++; continue; }
    const pod = free.find(p =>
      !taken.has(p.id) &&
      p.project_types?.type_number === dest.type_number &&
      (_destIsPanel || !dest.direction || p.type_directions?.direction === dest.direction));
    if (!pod) continue;
    taken.add(pod.id);
    plan.push({ podId: pod.id, destId: dest.id });
  }

  if (plan.length === 0) {
    showToast(t('dest.autoNothing'), 'warning');
    return;
  }
  const confirmed = await uiConfirm(t('dest.autoConfirm', {
    n: plan.length, rooms: open.length, noType,
  }), { danger: false });
  if (!confirmed) return;

  const btn = document.getElementById('btn-dest-auto');
  setLoading(btn, true);
  let failed = 0;
  // Supabase has no multi-value bulk update, so the writes go out in small
  // concurrent batches instead of 200 sequential round-trips.
  for (let i = 0; i < plan.length; i += 20) {
    const chunk = plan.slice(i, i + 20);
    const results = await Promise.all(chunk.map(({ podId, destId }) =>
      supabaseClient.from('pods').update({ destination_id: destId }).eq('id', podId)));
    results.forEach((res, idx) => {
      if (res.error) { console.error('[destinations] auto-assign failed:', res.error); failed++; }
      else {
        const pod = _destPods.find(p => p.id === chunk[idx].podId);
        if (pod) pod.destination_id = chunk[idx].destId;
      }
    });
  }
  setLoading(btn, false);
  renderDestinationsTab();
  showToast(failed
    ? t('dest.autoDonePartial', { n: plan.length - failed, failed })
    : t('dest.autoDone', { n: plan.length }), failed ? 'warning' : 'success');
}

async function deleteDestination(destId) {
  const dest = _destRows.find(d => d.id === destId);
  if (!dest) return;
  if (!await uiConfirm(t('dest.confirmDelete', { address: destAddressLabel(dest) }), { danger: true })) return;

  const { error } = await supabaseClient.from('pod_destinations').delete().eq('id', destId);
  if (error) { showToast(t('dest.errDelete'), 'error'); return; }
  // The FK is ON DELETE SET NULL: the pod stays, it just loses its address.
  _destPods.forEach(p => { if (p.destination_id === destId) p.destination_id = null; });
  _destRows = _destRows.filter(d => d.id !== destId);
  renderDestinationsTab();
  showToast(t('dest.deleted'), 'success');
}

// ---- IMPORT ----
// Accepts what the client actually sends: an .xlsx/.csv file or a block pasted
// straight out of Excel. Both end up as an array of cell arrays.
function showDestImportModal() {
  openModal(t('dest.importTitle'), `
    <p class="form-hint">${t('dest.importHelp')}</p>
    <div class="form-group">
      <label>${t('dest.importFile')}</label>
      <input type="file" id="dest-import-file" class="form-control" accept=".xlsx,.xls,.csv" />
    </div>
    <div class="form-group">
      <label>${t('dest.importPaste')}</label>
      <textarea id="dest-import-paste" class="form-control" rows="8" placeholder="A&#9;2&#9;A-214&#9;1&#9;R"></textarea>
    </div>
    <div id="dest-import-preview"></div>
  `, [
    { label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-dest-import-cancel' },
    { label: t('dest.importAction'), cls: 'btn-primary', id: 'btn-dest-import-go' },
  ]);

  document.getElementById('btn-dest-import-cancel')?.addEventListener('click', closeModal);
  document.getElementById('dest-import-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
      document.getElementById('dest-import-paste').value =
        aoa.map(r => r.join('\t')).join('\n');
      previewDestImport();
    } catch (err) {
      console.error('[destinations] file read failed:', err);
      showToast(t('dest.errFileRead'), 'error');
    }
  });
  document.getElementById('dest-import-paste')?.addEventListener('input', previewDestImport);
  document.getElementById('btn-dest-import-go')?.addEventListener('click', runDestImport);
}

// '0' / 'קרקע' / 'ground' / 'G' all mean the ground floor. Anything that is not
// a plain non-negative number is rejected rather than salvaged: a room code that
// landed in the floor column ('D-300') must fail the row, not import as floor -300.
function parseDestFloor(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '') return null;
  if (['0', 'g', 'ק', 'קרקע', 'ground', 'gf'].includes(v)) return 0;
  if (!/^\d{1,2}$/.test(v)) return null;
  return parseInt(v);
}

function parseDestDirection(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['r', 'ימין', 'right', 'י'].includes(v)) return 'R';
  if (['l', 'שמאל', 'left', 'ש'].includes(v)) return 'L';
  return null;
}

// Columns: building | floor | room code | type (optional) | direction (optional).
// A header row is recognised by its floor cell not being a floor.
function parseDestImport(text) {
  // Lines are NOT trimmed before splitting: a row whose first cell is empty
  // would lose its leading separator and shift every column one to the left
  // (the building column would then hold the floor). Cells are trimmed instead.
  const lines = String(text || '').split(/\r?\n/)
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim() !== '');
  const ok = [];
  const bad = [];
  const seen = new Set();

  lines.forEach((line, idx) => {
    const cells = line.split(/\t|,|;/).map(c => c.trim());
    const [building, floorRaw, room, typeRaw, dirRaw] = cells;
    const floor = parseDestFloor(floorRaw);
    if (idx === 0 && (floor === null || !room)) return; // header row
    if (!building || !room || floor === null) {
      bad.push({ line: idx + 1, text: line });
      return;
    }
    const key = `${building}|${floor}|${room}`.toLowerCase();
    if (seen.has(key)) { bad.push({ line: idx + 1, text: line, dup: true }); return; }
    seen.add(key);
    const typeNum = parseInt(String(typeRaw ?? '').replace(/[^0-9]/g, ''));
    ok.push({
      project_id: _destProjectId,
      building: building.toUpperCase(),
      floor,
      room_code: room,
      type_number: Number.isFinite(typeNum) ? typeNum : null,
      direction: _destIsPanel ? null : parseDestDirection(dirRaw),
    });
  });
  return { ok, bad };
}

function previewDestImport() {
  const el = document.getElementById('dest-import-preview');
  if (!el) return;
  const { ok, bad } = parseDestImport(document.getElementById('dest-import-paste')?.value);
  const existing = new Set(_destRows.map(d => `${d.building}|${d.floor}|${d.room_code}`.toLowerCase()));
  const fresh = ok.filter(r => !existing.has(`${r.building}|${r.floor}|${r.room_code}`.toLowerCase()));
  el.innerHTML = `
    <div class="dest-import-preview">
      <div>${t('dest.previewNew', { n: fresh.length })}</div>
      ${ok.length - fresh.length ? `<div class="dest-preview-warn">${t('dest.previewExisting', { n: ok.length - fresh.length })}</div>` : ''}
      ${bad.length ? `<div class="dest-preview-warn">${t('dest.previewBad', { n: bad.length })}: ${bad.slice(0, 5).map(b => b.line).join(', ')}${bad.length > 5 ? '…' : ''}</div>` : ''}
    </div>`;
}

async function runDestImport() {
  const { ok } = parseDestImport(document.getElementById('dest-import-paste')?.value);
  const existing = new Set(_destRows.map(d => `${d.building}|${d.floor}|${d.room_code}`.toLowerCase()));
  const fresh = ok.filter(r => !existing.has(`${r.building}|${r.floor}|${r.room_code}`.toLowerCase()));
  if (fresh.length === 0) { showToast(t('dest.nothingToImport'), 'warning'); return; }

  const btn = document.getElementById('btn-dest-import-go');
  setLoading(btn, true);
  const { data, error } = await supabaseClient.from('pod_destinations').insert(fresh).select();
  setLoading(btn, false);
  if (error) {
    console.error('[destinations] import failed:', error);
    showToast(t('dest.errImport') + (error.message || ''), 'error');
    return;
  }
  _destRows = [..._destRows, ...(data || [])].sort(destCompare);
  closeModal();
  renderDestinationsTab();
  showToast(t('dest.imported', { n: (data || []).length }), 'success');
}

// ---- EXPORT ----
function exportDestinationsExcel() {
  const podByDest = {};
  _destPods.forEach(p => { if (p.destination_id) podByDest[p.destination_id] = p; });
  const header = [t('dest.hBuilding'), t('dest.hFloor'), t('dest.hRoom'), t('dest.hExpected'),
    _destIsPanel ? t('dest.assignedPanel') : t('dest.assignedPod')];
  const rows = _destRows.map(d => [
    d.building,
    destFloorLabel(d.floor),
    d.room_code,
    d.type_number ? `T${d.type_number}${(!_destIsPanel && d.direction) ? ` ${d.direction}` : ''}` : '',
    podByDest[d.id]?.pod_code || '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  if (getLang() === 'he') wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, t('dest.sheetName').slice(0, 31));
  const stamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Destinations_${(AppState.currentProject?.code || 'project')}_${stamp}.xlsx`);
}

// ---- DELIVERY NOTE ----
// Single A4 page: who it is, where it goes, and room for the two signatures
// that make it a receipt.
function buildDeliveryNoteSections(pod, dest, barcodeDataUrl, groupLabel) {
  const isPanel = podProductType(pod) === 'medical_panel';
  const dir = (typeof langDir === 'function') ? langDir(getLang()) : 'rtl';
  const ta = dir === 'ltr' ? 'left' : 'right';
  const taOpp = dir === 'ltr' ? 'right' : 'left';
  const today = formatDate(new Date().toISOString().split('T')[0]);

  const field = (label, value) => `
    <div style="flex:1;min-width:120px;">
      <div style="font-size:11px;color:#64748b;">${label}</div>
      <div style="font-size:14px;font-weight:700;margin-top:2px;">${escHtml(value || '—')}</div>
    </div>`;

  const signature = (label) => `
    <div style="flex:1;">
      <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${label}</div>
      <div style="border-bottom:1px solid #94a3b8;height:34px;"></div>
    </div>`;

  return [`
    <div style="font-family:Arial,sans-serif;direction:${dir};color:#1e293b;width:794px;background:#fff;">
      <div style="background:#7ab8b6;color:#1a1a1a;padding:14px 24px;">
        <div style="font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-align:${ta};">MODUSYSTEMS LTD.</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="text-align:${taOpp};">
            <div style="font-size:24px;font-weight:bold;">${t('dest.noteTitle')}</div>
            <div style="font-size:14px;margin-top:4px;">${isPanel ? t('rep.panelLabel') : t('rep.podLabel')} ${escHtml(pod.pod_code)}</div>
            <div style="font-size:12px;margin-top:2px;opacity:0.75;">${t('dest.noteDate')} ${today}</div>
          </div>
          ${barcodeDataUrl ? `<div style="text-align:${ta};">
            <img src="${barcodeDataUrl}" style="height:52px;width:auto;display:block;image-rendering:pixelated;" />
            <div style="font-size:9px;margin-top:2px;text-align:center;font-weight:600;">${escHtml(pod.pod_code)}</div>
          </div>` : ''}
        </div>
      </div>

      <div style="border:3px solid #7ab8b6;margin:20px 24px;padding:16px 20px;text-align:${ta};">
        <div style="font-size:12px;color:#64748b;letter-spacing:1px;">${t('dest.noteAddress')}</div>
        ${dest ? `
          <div style="display:flex;gap:28px;margin-top:10px;">
            <div>
              <div style="font-size:11px;color:#64748b;">${t('dest.hBuilding')}</div>
              <div style="font-size:30px;font-weight:bold;line-height:1.2;">${escHtml(dest.building)}</div>
            </div>
            <div>
              <div style="font-size:11px;color:#64748b;">${t('dest.hFloor')}</div>
              <div style="font-size:30px;font-weight:bold;line-height:1.2;">${escHtml(destFloorLabel(dest.floor))}</div>
            </div>
            <div>
              <div style="font-size:11px;color:#64748b;">${t('dest.hRoom')}</div>
              <div style="font-size:30px;font-weight:bold;line-height:1.2;">${escHtml(dest.room_code)}</div>
            </div>
          </div>
          ${dest.notes ? `<div style="font-size:12px;margin-top:10px;">${escHtml(dest.notes)}</div>` : ''}
        ` : `<div style="font-size:20px;font-weight:bold;color:#b45309;margin-top:8px;">${t('dest.noteNoAddress')}</div>`}
      </div>

      <div style="margin:0 24px;padding:14px 20px;background:#f1f5f9;text-align:${ta};">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${field(t('pod.projectLabel'), pod.projects?.name)}
          ${field(isPanel ? t('proj.model') : t('proj.type'), typeLabel(pod.project_types))}
          ${isPanel ? '' : field(t('proj.direction'), pod.type_directions?.direction)}
          ${field(t('pod.dimensions'), pod.project_types?.dimensions)}
          ${isPanel ? '' : field(t('proj.group'), groupLabel)}
        </div>
      </div>

      <div style="margin:22px 24px 0;padding-top:14px;border-top:2px solid #e2e8f0;text-align:${ta};">
        <div style="font-size:12px;color:#475569;margin-bottom:14px;">${t('dest.noteReceived')}</div>
        <div style="display:flex;gap:24px;">
          ${signature(t('dest.noteSenderName'))}
          ${signature(t('dest.noteReceiverName'))}
          ${signature(t('common.date'))}
        </div>
        <div style="display:flex;gap:24px;margin-top:18px;">
          ${signature(t('dest.noteSenderSign'))}
          ${signature(t('dest.noteReceiverSign'))}
          <div style="flex:1;"></div>
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:18px;">${t('dest.noteRemarks')}</div>
        <div style="border:1px solid #cbd5e1;height:60px;border-radius:4px;margin-top:6px;"></div>
      </div>
    </div>`];
}

// Entry point from the pod screen. Fetches the address on demand so the note is
// never printed from a stale copy of the pod row.
async function generateDeliveryNote(pod) {
  const btn = document.getElementById('btn-pod-delivery');
  setLoading(btn, true);
  try {
    let dest = null;
    if (pod.destination_id) {
      const { data } = await supabaseClient.from('pod_destinations').select('*').eq('id', pod.destination_id).maybeSingle();
      dest = data || null;
    }
    if (!dest && !await uiConfirm(t('dest.confirmNoAddress'), { danger: false })) return;

    const sections = buildDeliveryNoteSections(
      pod, dest, pdfBarcodeDataUrl(pod.pod_code), AppState.currentPodGroupLabel || '');
    await renderSectionsToPdf(sections, `DeliveryNote_${pod.pod_code}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast(t('dest.noteSaved'), 'success');
  } catch (err) {
    console.error('[destinations] delivery note failed:', err);
    showToast(t('dest.noteError') + (err.message || ''), 'error');
  } finally {
    setLoading(btn, false);
  }
}
