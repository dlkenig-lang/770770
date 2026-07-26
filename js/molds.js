// =============================================
// Mold Checks Module (בדיקות תבניות)
// QC inspection of casting molds, per project type + direction + mold number.
// Feature restored from the Bolt-era mold_checks table (see migration
// 20260712050000). Write access: admin + inspector (RLS 20260712040000).
// =============================================

// Item definitions map to column prefixes in mold_checks
// (<key>_status / <key>_notes / <key>_value). Labels via i18n mold.item.*.
const MOLD_CHECK_ITEMS = [
  { key: 'length', hasValue: true },
  { key: 'width', hasValue: true },
  { key: 'concrete_height' },
  { key: 'belt_height' },
  { key: 'door_opening' },
  { key: 'elec_cabinet' },
  { key: 'drainage_channel' },
  { key: 'lifting_bolts' },
  { key: 'shower_parallel' },
];

let _moldProjectId = null;
let _moldTypes = [];
let _moldChecks = [];
let _moldSigPad = null;

function moldDirLabel(dir) {
  if (dir === 'R') return t('proj.dirRight');
  if (dir === 'L') return t('proj.dirLeft');
  return t('mold.noDirection');
}

function moldTitle(check) {
  const ty = _moldTypes.find(x => x.id === check.type_id);
  const tn = ty ? `T${ty.type_number}` : '';
  return `${tn} · ${moldDirLabel(check.direction)} · ${t('mold.moldLabel')} #${check.mold_number}`;
}

// ---- TAB ----
async function loadMoldsTab(projectId) {
  _moldProjectId = projectId;
  const container = document.getElementById('molds-list');
  if (!container) return;

  // Two-step fetch (no FK embedding): the live mold_checks table was created
  // in Bolt and may lack a declared FK, which would break PostgREST joins.
  const { data: types } = await supabaseClient.from('project_types')
    .select('id, type_number, type_directions(id, direction)')
    .eq('project_id', projectId).order('type_number');
  _moldTypes = types || [];

  let checks = [], error = null;
  if (_moldTypes.length) {
    ({ data: checks, error } = await supabaseClient.from('mold_checks')
      .select('*')
      .in('type_id', _moldTypes.map(ty => ty.id))
      .order('created_at'));
  }
  if (error) {
    console.error('[loadMoldsTab] error:', error);
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${t('proj.loadError')}</div></div>`;
    return;
  }

  const typeNumById = {};
  _moldTypes.forEach(ty => { typeNumById[ty.id] = ty.type_number; });

  // Sort: type number, then direction (R before L), then mold number
  _moldChecks = (checks || []).sort((a, b) => {
    const ta = typeNumById[a.type_id] || 0;
    const tb = typeNumById[b.type_id] || 0;
    if (ta !== tb) return ta - tb;
    const da = a.direction === 'R' ? 0 : a.direction === 'L' ? 1 : 2;
    const db = b.direction === 'R' ? 0 : b.direction === 'L' ? 1 : 2;
    if (da !== db) return da - db;
    return (a.mold_number || 0) - (b.mold_number || 0);
  });

  if (_moldChecks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧰</div><div class="empty-state-text">${t('mold.none')}</div></div>`;
    return;
  }

  container.innerHTML = `<div class="pods-grid">${_moldChecks.map(c => {
    const answered = MOLD_CHECK_ITEMS.filter(it => (c[`${it.key}_status`] || 'pending') !== 'pending').length;
    return `
    <div class="pod-card pod-card-clickable btn-open-mold" data-mold-id="${c.id}">
      <div class="pod-card-header">
        <div class="pod-card-code">${escHtml(moldTitle(c))}</div>
        <span class="status-badge status-${c.status || 'pending'}">${STATUS_LABELS[c.status] || t('status.pending')}</span>
      </div>
      <div class="pod-card-meta">
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">${t('mold.itemsAnswered')}</span>
          <span class="pod-card-meta-value">${answered}/${MOLD_CHECK_ITEMS.length}</span>
        </div>
        ${c.inspector_name ? `
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">${t('rep.hInspector')}</span>
          <span class="pod-card-meta-value">${escHtml(c.inspector_name)}</span>
        </div>` : ''}
        ${c.inspection_date ? `
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">${t('common.date')}</span>
          <span class="pod-card-meta-value">${formatDate(c.inspection_date)}</span>
        </div>` : ''}
      </div>
      <div class="pod-card-actions">
        <button class="btn btn-ghost btn-sm btn-mold-history" data-mold-id="${c.id}" title="${t('audit.title')}" aria-label="${t('audit.title')}">📜</button>
        ${isAdmin() ? `
        <button class="btn btn-danger btn-sm btn-delete-mold" data-mold-id="${c.id}" title="${t('common.delete')}" aria-label="${t('common.delete')}">🗑</button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;

  container.querySelectorAll('.btn-open-mold').forEach(card => {
    card.addEventListener('click', () => openMoldCheckModal(card.dataset.moldId));
  });
  container.querySelectorAll('.btn-delete-mold').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteMoldCheck(btn.dataset.moldId); });
  });
  container.querySelectorAll('.btn-mold-history').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showMoldHistory(btn.dataset.moldId); });
  });
}

// ---- AUDIT HISTORY ----
// The log_mold_check_change trigger (migration 20260713000000) writes mold
// rows with pod_id NULL, so they are keyed by record_id — not by pod_id like
// the qc_stages rows shown in showPodHistory. Visible to every active user
// (migration 20260726000000); writes stay blocked at the DB level.
async function showMoldHistory(moldId) {
  const check = _moldChecks.find(c => c.id === moldId);

  const { data: logs, error } = await supabaseClient
    .from('qc_audit_log')
    .select('*')
    .eq('table_name', 'mold_checks')
    .eq('record_id', moldId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    showToast(t('proj.errorPrefix') + error.message, 'error');
    return;
  }

  const body = (!logs || logs.length === 0)
    ? `<div class="empty-state" style="padding:24px"><div class="empty-state-text">${t('audit.noneMold')}</div></div>`
    : logs.map(l => {
        const oldSt = l.old_values?.status;
        const newSt = l.new_values?.status;
        const transition = oldSt && newSt ? ` (${t('status.' + oldSt)} → ${t('status.' + newSt)})` : '';
        const inspector = l.new_values?.inspector_name || l.old_values?.inspector_name;
        return `
        <div style="padding:10px 4px;border-bottom:1px solid var(--border);font-size:13px">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <strong>${escHtml(t('audit.' + l.action))}${transition}</strong>
            <span class="text-muted">${formatDateTime(l.created_at)}</span>
          </div>
          <div class="text-muted" style="margin-top:2px">
            ${l.changed_by_name ? t('audit.by', { name: escHtml(l.changed_by_name) }) : ''}
            ${inspector && inspector !== l.changed_by_name ? ` · ${t('rep.hInspector')}: ${escHtml(inspector)}` : ''}
          </div>
        </div>`;
      }).join('');

  const title = check ? `${t('audit.title')} — ${moldTitle(check)}` : t('audit.title');
  openModal(title, `<div style="max-height:60vh;overflow-y:auto">${body}</div>`, [
    { label: t('common.close'), cls: 'btn-ghost', id: 'btn-mold-audit-close' },
  ]);
  document.getElementById('btn-mold-audit-close')?.addEventListener('click', closeModal);
}

// ---- ADD MOLD CHECK ----
function showAddMoldModal() {
  if (!_moldTypes.length) { showToast(t('proj.noTypesInProject'), 'error'); return; }

  const typeOpts = _moldTypes.map(ty =>
    `<option value="${ty.id}">T${ty.type_number}</option>`).join('');

  openModal(t('mold.newTitle'), `
    <div class="form-group">
      <label>${t('proj.type')}</label>
      <select id="mold-type" class="form-control">${typeOpts}</select>
    </div>
    <div class="form-group">
      <label>${t('proj.direction')}</label>
      <select id="mold-dir" class="form-control">
        <option value="">${t('mold.noDirection')}</option>
        <option value="R">${t('direction.R')}</option>
        <option value="L">${t('direction.L')}</option>
      </select>
    </div>
    <div class="form-group">
      <label>${t('mold.moldNumber')}</label>
      <input type="number" id="mold-number" class="form-control" min="1" value="1" />
    </div>
  `, [
    { label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-mold-cancel' },
    { label: t('mold.createBtn'), cls: 'btn-primary', id: 'btn-mold-create' },
  ]);

  // Suggest the next free mold number for the selected type+direction
  const suggestNumber = () => {
    const typeId = document.getElementById('mold-type')?.value;
    const dir = document.getElementById('mold-dir')?.value || null;
    const existing = _moldChecks.filter(c => c.type_id === typeId && (c.direction || null) === dir);
    const maxNum = existing.reduce((m, c) => Math.max(m, c.mold_number || 0), 0);
    const numEl = document.getElementById('mold-number');
    if (numEl) numEl.value = maxNum + 1;
  };
  document.getElementById('mold-type')?.addEventListener('change', suggestNumber);
  document.getElementById('mold-dir')?.addEventListener('change', suggestNumber);
  suggestNumber();

  document.getElementById('btn-mold-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-mold-create')?.addEventListener('click', async () => {
    const typeId = document.getElementById('mold-type')?.value;
    const dir = document.getElementById('mold-dir')?.value || null;
    const num = parseInt(document.getElementById('mold-number')?.value);
    if (!typeId || !num || num < 1) { showToast(t('mold.enterNumber'), 'error'); return; }

    const btn = document.getElementById('btn-mold-create');
    setLoading(btn, true);
    const { data, error } = await supabaseClient.from('mold_checks').insert({
      type_id: typeId, direction: dir, mold_number: num, status: 'pending',
    }).select().single();
    setLoading(btn, false);
    if (error) { showToast(t('proj.errorPrefix') + error.message, 'error'); return; }

    closeModal();
    showToast(t('mold.created'), 'success');
    await loadMoldsTab(_moldProjectId);
    if (data) openMoldCheckModal(data.id);
  });
}

async function deleteMoldCheck(moldId) {
  if (!(await uiConfirm(t('mold.confirmDelete')))) return;
  const { error } = await supabaseClient.from('mold_checks').delete().eq('id', moldId);
  if (error) { showToast(t('proj.deleteError') + error.message, 'error'); return; }
  showToast(t('mold.deleted'), 'success');
  await loadMoldsTab(_moldProjectId);
}

// ---- CHECK FORM ----
function openMoldCheckModal(moldId) {
  const check = _moldChecks.find(c => c.id === moldId);
  if (!check) return;

  const signed = check.status === 'completed' || check.status === 'failed';
  const readonly = !canEditMolds() || signed;

  const rows = MOLD_CHECK_ITEMS.map((it, idx) => {
    const status = check[`${it.key}_status`] || 'pending';
    const notes = check[`${it.key}_notes`] || '';
    const val = it.hasValue ? (check[`${it.key}_value`] || '') : null;
    const instr = t(`mold.instr.${it.key}`);
    const hasInstr = instr && instr !== `mold.instr.${it.key}`;
    return `
      <tr class="qc-table-row qc-row-${status}" data-mold-item="${it.key}">
        <td class="qc-row-num">${idx + 1}</td>
        <td class="qc-row-label">
          <div class="qc-row-label-text">${escHtml(t(`mold.item.${it.key}`))}</div>
          ${hasInstr ? `<div class="qc-row-instruction">💡 ${escHtml(instr)}</div>` : ''}
          ${it.hasValue ? (readonly
            ? (val ? `<div class="qc-row-instruction">📊 ${escHtml(val)}</div>` : '')
            : `<div class="qc-time-inline">
                <label>${t('mold.measuredValue')}:</label>
                <input type="text" class="mold-value qc-time-input" style="width:90px" value="${escHtml(val)}" />
              </div>`) : ''}
        </td>
        <td class="qc-row-check">
          ${readonly
            ? (status === 'passed' ? '<span class="qc-check-badge qc-pass-badge">✓</span>' : '')
            : `<button type="button" class="qc-check-btn qc-pass-btn mold-check-btn ${status === 'passed' ? 'active' : ''}" data-action="passed">✓</button>`}
        </td>
        <td class="qc-row-check">
          ${readonly
            ? (status === 'failed' ? '<span class="qc-check-badge qc-fail-badge">✗</span>' : '')
            : `<button type="button" class="qc-check-btn qc-fail-btn mold-check-btn ${status === 'failed' ? 'active' : ''}" data-action="failed">✗</button>`}
        </td>
        <td class="qc-row-notes">
          ${readonly
            ? (notes ? `<span class="text-sm text-muted">${escHtml(notes)}</span>` : '')
            : `<textarea class="qc-notes-inline mold-notes" rows="1" placeholder="${t('qc.notesPlaceholder')}">${escHtml(notes)}</textarea>`}
        </td>
      </tr>`;
  }).join('');

  const signedBar = signed ? `
    <div class="qc-inspector-bar qc-inspector-signed" style="margin-top:12px">
      <div class="qc-inspector-info-row">
        <span>👤 <strong>${escHtml(check.inspector_name || '—')}</strong></span>
        <span>📅 ${formatDate(check.inspection_date)}</span>
        ${check.inspector_signature ? `<img src="${check.inspector_signature}" class="signed-sig-preview" alt="${t('qc.signature')}" />` : ''}
      </div>
    </div>` : '';

  const buttons = [{ label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-mold-close' }];
  if (!readonly) {
    buttons.push({ label: t('common.save'), cls: 'btn-secondary', id: 'btn-mold-save' });
    buttons.push({ label: t('mold.signFinish'), cls: 'btn-primary', id: 'btn-mold-sign' });
  }
  if (signed && canEditMolds()) {
    buttons.push({ label: t('mold.reopen'), cls: 'btn-secondary', id: 'btn-mold-reopen' });
  }

  openModal(moldTitle(check), `
    <div class="qc-items-table-wrapper">
      <table class="qc-items-table">
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>${t('qc.colItem')}</th>
            <th style="width:72px;text-align:center">${t('qc.colPass')}</th>
            <th style="width:72px;text-align:center">${t('qc.colFail')}</th>
            <th>${t('qc.colNotes')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${signedBar}
  `, buttons);

  document.getElementById('btn-mold-close')?.addEventListener('click', closeModal);

  // ✓/✗ toggles (state lives in the DOM until save)
  document.querySelectorAll('#modal-body .mold-check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      const wasActive = btn.classList.contains('active');
      row.querySelectorAll('.mold-check-btn').forEach(b => b.classList.remove('active'));
      let status = 'pending';
      if (!wasActive) { btn.classList.add('active'); status = btn.dataset.action; }
      row.className = `qc-table-row qc-row-${status}`;
    });
  });

  function collectFromDom() {
    const payload = {};
    document.querySelectorAll('#modal-body [data-mold-item]').forEach(row => {
      const key = row.dataset.moldItem;
      const activeBtn = row.querySelector('.mold-check-btn.active');
      payload[`${key}_status`] = activeBtn ? activeBtn.dataset.action : 'pending';
      const notesEl = row.querySelector('.mold-notes');
      if (notesEl) payload[`${key}_notes`] = notesEl.value.trim() || null;
      const valEl = row.querySelector('.mold-value');
      if (valEl) payload[`${key}_value`] = valEl.value.trim() || null;
    });
    return payload;
  }

  document.getElementById('btn-mold-save')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-mold-save');
    setLoading(btn, true);
    const payload = collectFromDom();
    const answered = MOLD_CHECK_ITEMS.some(it => payload[`${it.key}_status`] !== 'pending');
    payload.status = answered ? 'in_progress' : 'pending';
    const { error } = await supabaseClient.from('mold_checks').update(payload).eq('id', moldId);
    setLoading(btn, false);
    if (error) { showToast(t('qc.saveError'), 'error'); return; }
    showToast(t('mold.saved'), 'success');
    closeModal();
    await loadMoldsTab(_moldProjectId);
  });

  document.getElementById('btn-mold-sign')?.addEventListener('click', () => {
    showMoldSignatureStep(moldId, collectFromDom());
  });

  document.getElementById('btn-mold-reopen')?.addEventListener('click', async () => {
    if (!(await uiConfirm(t('qc.confirmEdit'), { danger: false }))) return;
    const { error } = await supabaseClient.from('mold_checks').update({
      status: 'in_progress',
      inspector_name: null, inspector_signature: null,
      inspection_date: null, completed_at: null,
    }).eq('id', moldId);
    if (error) { showToast(t('qc.saveError'), 'error'); return; }
    showToast(t('qc.stageReopened'), 'success');
    closeModal();
    await loadMoldsTab(_moldProjectId);
  });
}

// ---- SIGNATURE STEP (inside the generic modal) ----
function showMoldSignatureStep(moldId, itemsPayload) {
  const inspectorName = AppState.currentProfile?.full_name?.trim()
    || AppState.currentProfile?.username || '';

  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>${t('sig.inspectorName')}</label>
      <input type="text" id="mold-sig-name" class="form-control" readonly value="${escHtml(inspectorName)}" />
    </div>
    <div class="form-group">
      <label>${t('sig.signature')}</label>
      <div class="signature-wrapper">
        <canvas id="mold-sig-canvas" class="signature-canvas"></canvas>
        <button type="button" class="btn btn-ghost btn-sm sig-clear-btn" id="mold-sig-clear">${t('common.clear')}</button>
      </div>
    </div>
    <div class="form-group">
      <label>${t('common.date')}</label>
      <input type="date" id="mold-sig-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
    </div>
    <div id="mold-sig-error" class="error-msg hidden"></div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-ghost" id="mold-sig-back">${t('proj.back')}</button>
    <button class="btn btn-primary" id="mold-sig-confirm">${t('sig.confirm')}</button>
  `;

  const canvas = document.getElementById('mold-sig-canvas');
  _moldSigPad = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d').scale(ratio, ratio);
  _moldSigPad.clear();

  document.getElementById('mold-sig-clear')?.addEventListener('click', () => _moldSigPad?.clear());
  document.getElementById('mold-sig-back')?.addEventListener('click', async () => {
    // Persist current answers as draft, then return to the form
    await supabaseClient.from('mold_checks').update(itemsPayload).eq('id', moldId);
    await loadMoldsTab(_moldProjectId);
    openMoldCheckModal(moldId);
  });

  document.getElementById('mold-sig-confirm')?.addEventListener('click', async () => {
    const errEl = document.getElementById('mold-sig-error');
    errEl.classList.add('hidden');
    if (!_moldSigPad || _moldSigPad.isEmpty()) {
      errEl.textContent = t('qc.needSignature');
      errEl.classList.remove('hidden');
      return;
    }
    const anyFailed = MOLD_CHECK_ITEMS.some(it => itemsPayload[`${it.key}_status`] === 'failed');
    const btn = document.getElementById('mold-sig-confirm');
    setLoading(btn, true);
    const { error } = await supabaseClient.from('mold_checks').update({
      ...itemsPayload,
      status: anyFailed ? 'failed' : 'completed',
      inspector_name: inspectorName,
      inspector_signature: _moldSigPad.toDataURL('image/png'),
      inspection_date: document.getElementById('mold-sig-date')?.value || new Date().toISOString().split('T')[0],
      completed_at: new Date().toISOString(),
    }).eq('id', moldId);
    setLoading(btn, false);
    if (error) { showToast(t('qc.saveError'), 'error'); return; }

    closeModal();
    showToast(anyFailed ? t('mold.finishedFailed') : t('mold.finishedOk'), anyFailed ? 'warning' : 'success');
    await loadMoldsTab(_moldProjectId);
  });
}

// ---- WIRING ----
document.getElementById('btn-add-mold')?.addEventListener('click', showAddMoldModal);
