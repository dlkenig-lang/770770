// =============================================
// Reports Module - PDF & Excel Generation
// =============================================

function buildPDFSections(pod, stages, stageItems, logoDataUrl, barcodeDataUrl, groupLabel = '') {
  // Panels use their own stage/item definitions and carry no direction,
  // pipe type or production group.
  const productType = podProductType(pod);
  const isPanel = productType === 'medical_panel';
  const stageStatusColor = s =>
    s === 'completed' ? '#7baa8a' : s === 'failed' ? '#b87878' : '#8899aa';
  const itemStatusColor = s =>
    s === 'passed' ? '#4a8c60' : s === 'failed' ? '#a05050' : '#8899aa';
  const itemIcon = s =>
    s === 'passed' ? '✓' : s === 'failed' ? '✗' : '○';
  const _dir = (typeof langDir === 'function') ? langDir(getLang()) : 'rtl';
  const _ta = _dir === 'ltr' ? 'left' : 'right';
  const _taOpp = _dir === 'ltr' ? 'right' : 'left';
  const wrap = c =>
    `<div style="font-family:Arial,sans-serif;direction:${_dir};color:#1e293b;width:794px;background:#fff;">${c}</div>`;

  const sections = [];

  // Header + pod info
  sections.push(wrap(`
    <div style="background:#7ab8b6;color:#1a1a1a;padding:14px 24px;">
      <div style="font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-align:${_ta};">MODUSYSTEMS LTD.</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="text-align:${_taOpp};">
          <div style="font-size:22px;font-weight:bold;">${isPanel ? t('rep.pdfTitlePanel') : t('rep.pdfTitle')}</div>
          <div style="font-size:14px;margin-top:4px;">${isPanel ? t('rep.panelLabel') : t('rep.podLabel')} ${escHtml(pod.pod_code)}</div>
          <div style="font-size:12px;margin-top:2px;opacity:0.7;">${t('rep.created')} ${formatDate(new Date().toISOString().split('T')[0])}</div>
        </div>
        <div style="text-align:${_ta};">
          ${barcodeDataUrl ? `
            <img src="${barcodeDataUrl}" style="height:50px;width:auto;display:block;margin-${_dir==='ltr'?'right':'left'}:auto;image-rendering:pixelated;" />
            <div style="font-size:9px;margin-top:2px;text-align:center;font-weight:600;">${escHtml(pod.pod_code)}</div>
          ` : ''}
        </div>
      </div>
    </div>
    <div style="background:#f1f5f9;padding:12px 24px;text-align:${_ta};border-bottom:2px solid #e2e8f0;">
      <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">${isPanel ? t('rep.panelDetails') : t('rep.podDetails')}</div>
      <div style="font-size:12px;">${t('rep.projectColon')} ${escHtml(pod.projects?.name || '')} | ${t('rep.codeColon')} ${escHtml(pod.pod_code)}${(!isPanel && groupLabel) ? ` | ${t('rep.groupMark')} <strong style="font-size:14px">${escHtml(groupLabel)}</strong>` : ''}</div>
      <div style="font-size:12px;margin-top:3px;">${isPanel
        ? `${t('rep.modelColon')} T${escHtml(String(pod.project_types?.type_number || ''))} | ${t('rep.dimsColon')} ${escHtml(pod.project_types?.dimensions || '—')}`
        : `${t('rep.typeColon')} T${escHtml(String(pod.project_types?.type_number || ''))} | ${t('rep.dirColon')} ${escHtml(pod.type_directions?.direction || '')} | ${t('rep.pipeColon')} ${escHtml(pod.projects?.pipe_type || '')}${pod.production_groups?.name ? ` | ${t('rep.groupColon')} ${escHtml(pod.production_groups.name)}` : ''}`}</div>
    </div>
  `));

  // Each stage as its own section
  for (const stage of stages) {
    const items = stageItems[stage.id] || [];
    const stageDef = getStage(stage.stage_number, productType);
    const passed = items.filter(i => i.status === 'passed').length;
    // Denominator = defined items for the stage, NOT saved DB rows — with
    // items.length a stage missing 3 marks printed "6/6 passed" and looked
    // complete (the 29/03 incident went unnoticed because of this).
    const totalDefined = stageDef?.items.length || items.length;
    const bgColor = stageStatusColor(stage.status);

    let itemsHTML = '';
    for (const itemDef of (stageDef?.items || [])) {
      const item = items.find(i => i.item_key === itemDef.key);
      const status = item?.status || 'pending';
      const color = itemStatusColor(status);
      itemsHTML += `
        <div style="display:flex;align-items:flex-start;padding:5px 10px;border-bottom:1px solid #f1f5f9;">
          <span style="color:${color};font-weight:bold;font-size:14px;min-width:20px;">${itemIcon(status)}</span>
          <div style="flex:1;">
            <div style="font-size:12px;color:#1e293b;">${escHtml(qcItemLabel(itemDef))}</div>
            ${item?.notes ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${t('rep.noteColon')} ${escHtml(item.notes)}</div>` : ''}
            ${item?.time_entry_1 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${t('rep.time1')} ${escHtml(item.time_entry_1)}  ${t('rep.time2')} ${escHtml(item.time_entry_2 || '—')}</div>` : ''}
            ${item?.fixed_at && item?.status === 'passed' ? `<div style="font-size:11px;color:#2d5540;margin-top:2px;">🔧 ${t('qc.fixedAt', { date: formatDate(item.fixed_at.split('T')[0]) })}</div>` : ''}
          </div>
        </div>`;
    }

    sections.push(wrap(`
      <div style="margin:8px 24px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
        <div style="background:${bgColor};color:#1a1a1a;padding:7px 12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;">${passed}/${totalDefined} ${t('rep.passedWord')}</span>
          <span style="font-size:13px;font-weight:bold;">${stage.stage_number}. ${escHtml(qcStageName(stage.stage_number, productType))}</span>
        </div>
        ${stage.inspector_name ? `
        <div style="background:#c8dfd2;padding:6px 12px;font-size:11px;color:#2d5540;display:flex;align-items:center;justify-content:space-between;">
          <div style="text-align:${_ta};">${t('rep.inspectorColon')} <strong>${escHtml(stage.inspector_name)}</strong> | ${t('rep.dateColon')} ${escHtml(formatDate(stage.inspection_date))}</div>
          <div>
            ${stage.inspector_signature ? `<img src="${stage.inspector_signature}" style="height:38px;background:#fff;border-radius:3px;padding:2px;border:1px solid #a0c4b0;" alt="${t('qc.signature')}" />` : ''}
          </div>
        </div>` : ''}
        ${itemsHTML}
      </div>
    `));
  }

  // Additional reviewer sign-off
  sections.push(wrap(`
    <div style="padding:8px 24px 28px;">
      <div style="border-top:2px solid #e2e8f0;padding-top:16px;">
        <div style="display:flex;gap:24px;margin-bottom:16px;">
          <div style="flex:1;text-align:${_ta};">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${t('proj.name')}</div>
            <div style="border-bottom:1px solid #94a3b8;height:24px;"></div>
          </div>
          <div style="flex:1;text-align:${_ta};">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${t('rep.role')}</div>
            <div style="border-bottom:1px solid #94a3b8;height:24px;"></div>
          </div>
          <div style="flex:1;text-align:${_ta};">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${t('common.date')}</div>
            <div style="border-bottom:1px solid #94a3b8;height:24px;"></div>
          </div>
        </div>
        <div style="text-align:${_ta};">
          <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${t('qc.signature')}</div>
          <div style="border:1px solid #94a3b8;height:18px;width:33%;border-radius:4px;"></div>
        </div>
      </div>
    </div>
  `));

  return sections;
}

async function renderSection(html, scale) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:-9999px;width:794px;background:#fff;';
  el.innerHTML = html;
  document.body.appendChild(el);
  await new Promise(r => setTimeout(r, 30));
  const canvas = await html2canvas(el, { scale, useCORS: true, logging: false, width: 794 });
  document.body.removeChild(el);
  return canvas;
}

async function buildAndDownloadPDF(pod, stages, stageItems) {
  const SCALE = 3;
  const PAGE_H_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_W_MM = 210 - MARGIN_MM * 2;
  const pxToMm = CONTENT_W_MM / 794;

  // Fetch logo as data URL
  let logoDataUrl = null;
  try {
    const res = await fetch('images/logo.svg');
    const svgText = await res.text();
    logoDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
  } catch (e) { /* skip logo */ }

  // Generate barcode as canvas data URL
  let barcodeDataUrl = null;
  try {
    const bc = document.createElement('canvas');
    JsBarcode(bc, pod.pod_code, { format: 'CODE128', width: 3, height: 150, displayValue: false, margin: 10 });
    barcodeDataUrl = bc.toDataURL('image/png');
  } catch (e) { /* skip barcode */ }

  const sections = buildPDFSections(pod, stages, stageItems, logoDataUrl, barcodeDataUrl, AppState.currentPodGroupLabel || '');
  const canvases = [];
  for (const html of sections) {
    canvases.push(await renderSection(html, SCALE));
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let yMm = MARGIN_MM;
  let firstPage = true;

  for (const c of canvases) {
    const hMm = (c.height / SCALE) * pxToMm;
    if (!firstPage && yMm + hMm > PAGE_H_MM - MARGIN_MM) {
      doc.addPage();
      yMm = MARGIN_MM;
    }
    firstPage = false;
    doc.addImage(c.toDataURL('image/png'), 'PNG', MARGIN_MM, yMm, CONTENT_W_MM, hMm);
    yMm += hMm;
  }

  const filename = `QC_${pod.pod_code}_${new Date().toISOString().split('T')[0]}.pdf`;
  const pdfBlob = doc.output('blob');

  if (window.showSaveFilePicker) {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function generatePodPDF(pod) {
  const btn = document.getElementById('btn-pod-pdf');
  setLoading(btn, true);
  try {
    const { data: stages } = await supabaseClient
      .from('qc_stages').select('*').eq('pod_id', pod.id).order('stage_number');

    const stageItems = {};
    for (const stage of (stages || [])) {
      const { data: items } = await supabaseClient
        .from('qc_items').select('*').eq('stage_id', stage.id);
      stageItems[stage.id] = items || [];
    }

    await buildAndDownloadPDF(pod, stages || [], stageItems);
    showToast(t('rep.pdfSaved'), 'success');
  } catch (err) {
    showToast(t('rep.pdfError') + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// The selection can mix sanitary pods and medical panels (the "all projects"
// report). Each product type has its own stage set, so per-stage sheets are
// emitted per product type present in the selection — writing panel rows under
// pod stage headers would put marks in the wrong columns.
function buildExcelFromPods(pods, label) {
  const wb = XLSX.utils.book_new();

  const maxStages = Math.max(...pods.map(p => qcStageSet(podProductType(p)).length), 1);
  const summaryHeader = [t('rep.hPodCode'), t('rep.hProject'), t('rep.hType'), t('rep.hDirection'),
    t('rep.hGroup'), t('rep.hStatus')];
  for (let n = 1; n <= maxStages; n++) summaryHeader.push(t('rep.hStage', { n }));
  summaryHeader.push(t('rep.hProgress'));
  const summaryData = [summaryHeader];

  for (const pod of pods) {
    const stages = pod.qc_stages || [];
    const stageDefs = qcStageSet(podProductType(pod));
    const stageStatuses = [];
    for (let n = 1; n <= maxStages; n++) {
      if (!stageDefs.some(sd => sd.number === n)) { stageStatuses.push(''); continue; }
      const s = stages.find(st => st.stage_number === n);
      stageStatuses.push(STATUS_LABELS[s?.status] || t('status.pending'));
    }
    const completedStages = stages.filter(s => s.status === 'completed').length;
    summaryData.push([
      pod.pod_code,
      pod.projects?.name || '',
      `T${pod.project_types?.type_number || ''}`,
      pod.type_directions?.direction || '',
      pod.production_groups?.name || '',
      STATUS_LABELS[pod.status] || pod.status,
      ...stageStatuses,
      Math.round(completedStages / stageDefs.length * 100) + '%',
    ]);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), t('rep.sheetSummary'));

  const typesPresent = [...new Set(pods.map(p => podProductType(p)))];
  for (const productType of typesPresent) {
    const typePods = pods.filter(p => podProductType(p) === productType);
    const isPanel = productType === 'medical_panel';
    const suffix = typesPresent.length > 1 ? ` ${isPanel ? t('rep.sheetPanels') : t('rep.sheetPods')}` : '';

    for (const stageDef of qcStageSet(productType)) {
      const headers = [t('rep.hPodCode'), t('rep.hProject'), isPanel ? t('rep.hModel') : t('rep.hType')];
      if (!isPanel) headers.push(t('rep.hDirection'));
      headers.push(t('rep.hInspector'), t('rep.hDate'));
      stageDef.items.forEach(item => headers.push(qcItemLabel(item)));
      const rows = [headers];

      for (const pod of typePods) {
        const stage = (pod.qc_stages || []).find(s => s.stage_number === stageDef.number);
        const items = stage?.qc_items || [];
        const row = [
          pod.pod_code,
          pod.projects?.name || '',
          `T${pod.project_types?.type_number || ''}`,
        ];
        if (!isPanel) row.push(pod.type_directions?.direction || '');
        row.push(
          stage?.inspector_name || '',
          stage?.inspection_date ? formatDate(stage.inspection_date) : '',
        );
        stageDef.items.forEach(itemDef => {
          const item = items.find(i => i.item_key === itemDef.key);
          row.push(STATUS_LABELS[item?.status] || t('status.pending'));
        });
        rows.push(row);
      }

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows),
        `${t('rep.hStage', { n: stageDef.number })}${suffix}`.slice(0, 31));
    }
  }

  const filename = `QC_${label.replace(/[^a-zA-Z0-9א-ת]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Fetch qc_items for the given pods (post-filter) and attach them to each
// stage as stage.qc_items. Chunked to keep request URLs within limits.
async function fetchItemsForPods(pods) {
  const stages = pods.flatMap(p => p.qc_stages || []);
  const missing = stages.filter(s => !Array.isArray(s.qc_items));
  if (!missing.length) return;

  const stageIds = missing.map(s => s.id);
  const CHUNK = 100;
  const itemsByStage = {};
  for (let i = 0; i < stageIds.length; i += CHUNK) {
    const { data: items, error } = await supabaseClient
      .from('qc_items').select('*')
      .in('stage_id', stageIds.slice(i, i + CHUNK));
    if (error) throw error;
    (items || []).forEach(item => {
      if (!itemsByStage[item.stage_id]) itemsByStage[item.stage_id] = [];
      itemsByStage[item.stage_id].push(item);
    });
  }
  missing.forEach(s => { s.qc_items = itemsByStage[s.id] || []; });
}

// =============================================
// Reports view — three tabs sharing one pods fetch:
//   qc       — the export/filter table (original view)
//   progress — work done inside a time window
//   history  — qc_audit_log inside a time window
// Tab and range selection live at module scope so switching tabs (and the
// re-render triggered by a language change) keeps the user's context.
// =============================================
let _repTab = 'qc';
let _repRange = { preset: '24h', from: null, to: null };
let _repProject = '';
let _repProjects = [];
let _repPods = [];

const REP_PRESET_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

const repSerial = code => parseInt((code || '').slice(-3)) || 0;

// Resolve the selected window to absolute bounds. Custom dates are read as
// local midnight → end-of-day so a single-day pick covers that whole day.
function repRange() {
  const hours = REP_PRESET_HOURS[_repRange.preset];
  if (hours) {
    const to = new Date();
    return {
      from: new Date(to.getTime() - hours * 3600000),
      to,
      label: t('rep.preset.' + _repRange.preset),
    };
  }
  return {
    from: new Date(_repRange.from + 'T00:00:00'),
    to: new Date(_repRange.to + 'T23:59:59.999'),
    label: `${formatDate(_repRange.from)} – ${formatDate(_repRange.to)}`,
  };
}

function repInRange(ts, from, to) {
  if (!ts) return false;
  const d = new Date(ts);
  return d >= from && d <= to;
}

function formatDateTimeShort(ts) {
  if (!ts) return '';
  return (typeof formatDateTime === 'function') ? formatDateTime(ts) : new Date(ts).toLocaleString();
}

function repRangeBarHtml() {
  const presetBtns = ['24h', '7d', '30d'].map(p =>
    `<button class="btn btn-sm rep-preset-btn ${_repRange.preset === p ? 'btn-primary' : 'btn-ghost'}"
       data-preset="${p}">${t('rep.preset.' + p)}</button>`).join('');

  return `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3>${t('rep.rangeTitle')}</h3></div>
      <div class="card-body">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${presetBtns}</div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('rep.fromDate')}</label>
            <input type="date" id="rep-from" class="form-control form-control-sm" value="${_repRange.from || ''}" />
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('rep.toDate')}</label>
            <input type="date" id="rep-to" class="form-control form-control-sm" value="${_repRange.to || ''}" />
          </div>
          <button class="btn btn-sm ${_repRange.preset === 'custom' ? 'btn-primary' : 'btn-secondary'}" id="rep-apply-range">${t('rep.applyRange')}</button>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('pod.projectLabel')}</label>
            <select id="rep-project" class="form-control form-control-sm">
              <option value="">${t('rep.all')}</option>
              ${_repProjects.map(p => `<option value="${p.id}"${_repProject === p.id ? ' selected' : ''}>${escHtml(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-top:10px;font-size:12px;color:#64748b;" id="rep-range-label"></div>
      </div>
    </div>`;
}

function wireRepRangeBar(rerender) {
  document.querySelectorAll('.rep-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _repRange = { preset: btn.dataset.preset, from: _repRange.from, to: _repRange.to };
      rerender();
    });
  });
  document.getElementById('rep-apply-range')?.addEventListener('click', () => {
    const from = document.getElementById('rep-from').value;
    const to = document.getElementById('rep-to').value;
    if (!from || !to) { showToast(t('rep.pickBothDates'), 'error'); return; }
    if (from > to) { showToast(t('rep.rangeInvalid'), 'error'); return; }
    _repRange = { preset: 'custom', from, to };
    rerender();
  });
  document.getElementById('rep-project')?.addEventListener('change', (e) => {
    _repProject = e.target.value;
    rerender();
  });
}

function repStatTilesHtml(tiles) {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
    ${tiles.map(ti => `
      <div class="card" style="padding:14px 16px;">
        <div style="font-size:24px;font-weight:700;color:var(--primary);">${ti.value}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${ti.label}</div>
      </div>`).join('')}
  </div>`;
}

function repNoteHtml(text) {
  return `<div style="font-size:12px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;
    border-radius:6px;padding:10px 12px;margin-bottom:16px;line-height:1.5;">ℹ️ ${text}</div>`;
}

// ---- EXCEL EXPORT FOR THE TIME-WINDOW TABS ----
// Header block for the sheet. A time-window report that travels by email is
// meaningless without its window written inside it, so the range, the project
// filter and the generation time are always the first rows — plus any
// truncation warning, which must survive into the file too.
function repExportMeta(rangeLabel, summaryLines = [], truncationNote = null) {
  const projName = _repProject
    ? (_repProjects.find(p => p.id === _repProject)?.name || '')
    : t('rep.all');
  const lines = [
    t('rep.xlsRange', { label: rangeLabel }),
    t('rep.xlsProject', { name: projName }),
    t('rep.xlsGenerated', { date: formatDateTimeShort(new Date().toISOString()) }),
    ...summaryLines,
  ];
  if (truncationNote) lines.push(`⚠️ ${truncationNote}`);
  return lines;
}

function repExportExcel({ sheetName, filePrefix, meta, headers, dataRows, percentCols = [] }) {
  const aoa = [];
  meta.forEach(line => aoa.push([line]));
  aoa.push([]);
  const headerRow = aoa.length;          // 0-based index of the header row
  aoa.push(headers);
  dataRows.forEach(r => aoa.push(r));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h, i) => ({ wch: i === 0 ? 22 : Math.max(14, String(h).length + 4) }));
  // Freeze the header row so long reports stay readable while scrolling
  ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };
  // Hebrew sheets read right-to-left; harmless for LTR viewers of an he export
  if (getLang() === 'he') ws['!views'] = [{ RTL: true }];

  percentCols.forEach(col => {
    for (let i = 0; i < dataRows.length; i++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow + 1 + i, c: col });
      if (ws[addr] && typeof ws[addr].v === 'number') ws[addr].z = '0%';
    }
  });

  const wb = XLSX.utils.book_new();
  // Excel caps sheet names at 31 chars and forbids : \ / ? * [ ]
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName).replace(/[:\\/?*[\]]/g, '').slice(0, 31));
  const stamp = new Date().toISOString().split('T')[0];
  const safePrefix = String(filePrefix).replace(/[^a-zA-Z0-9א-ת_]/g, '_');
  XLSX.writeFile(wb, `${safePrefix}_${stamp}.xlsx`);
}

// ---- TAB 2: WORK PROGRESS IN A TIME WINDOW ----
// Two DB-written timestamps drive this, both reliable and covering all
// history (unlike qc_audit_log, which only starts when it was enabled):
//   qc_stages.completed_at — set on signing, cleared when the form is cleared
//   qc_items.created_at    — the row is created on the item's first mark
// The second one is what surfaces work on stages that are filled but not
// signed yet — a stage-only report would show those pods as idle.
async function renderProgressTab(host) {
  host.innerHTML = repRangeBarHtml() +
    `<div id="rep-body"><div style="text-align:center;padding:32px;color:#64748b;">${t('proj.loadingData')}</div></div>`;
  wireRepRangeBar(() => renderProgressTab(host));

  const { from, to, label } = repRange();
  document.getElementById('rep-range-label').textContent = t('rep.rangeShowing', { label });
  const body = document.getElementById('rep-body');

  const pods = _repProject ? _repPods.filter(p => p.project_id === _repProject) : _repPods;

  // stage_id → pod, so item marks can be attributed to their pod
  const stageToPod = {};
  pods.forEach(p => (p.qc_stages || []).forEach(s => { stageToPod[s.id] = p; }));

  const ITEM_LIMIT = 5000;
  const { data: itemRows, error } = await supabaseClient
    .from('qc_items').select('id, stage_id, created_at')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .limit(ITEM_LIMIT);

  if (error) {
    body.innerHTML = `<p style="text-align:center;color:#dc2626;padding:24px;">${t('proj.errorPrefix')}${escHtml(error.message)}</p>`;
    return;
  }

  // Aggregate per pod
  const agg = {};
  const bump = (pod) => {
    if (!agg[pod.id]) {
      agg[pod.id] = { pod, stages: [], items: 0, started: false, last: null };
    }
    return agg[pod.id];
  };

  pods.forEach(p => {
    (p.qc_stages || []).forEach(s => {
      if (repInRange(s.completed_at, from, to)) {
        const a = bump(p);
        a.stages.push(s);
        if (!a.last || new Date(s.completed_at) > new Date(a.last)) a.last = s.completed_at;
      }
    });
    if (repInRange(p.inspection_started_at, from, to)) {
      const a = bump(p);
      a.started = true;
      if (!a.last || new Date(p.inspection_started_at) > new Date(a.last)) a.last = p.inspection_started_at;
    }
  });

  (itemRows || []).forEach(it => {
    const pod = stageToPod[it.stage_id];
    if (!pod) return;                       // stage of an archived/filtered-out project
    const a = bump(pod);
    a.items += 1;
    if (!a.last || new Date(it.created_at) > new Date(a.last)) a.last = it.created_at;
  });

  // Most recent activity first — the point of a time-window report is "what
  // happened lately", so pod-serial order would bury today's work.
  const rows = Object.values(agg).sort((a, b) => new Date(b.last) - new Date(a.last));

  const totalStages = rows.reduce((n, r) => n + r.stages.length, 0);
  const totalItems = rows.reduce((n, r) => n + r.items, 0);
  const totalStarted = rows.filter(r => r.started).length;

  const tiles = repStatTilesHtml([
    { value: rows.length, label: t('rep.sumPodsActive') },
    { value: totalStages, label: t('rep.sumStagesSigned') },
    { value: totalItems, label: t('rep.sumItemsMarked') },
    { value: totalStarted, label: t('rep.sumPodsStarted') },
  ]);

  // Say so rather than quietly under-reporting: the item counts are capped.
  const notes = repNoteHtml(t('rep.progressNote')) +
    ((itemRows || []).length === ITEM_LIMIT ? repNoteHtml(t('rep.itemsTruncated', { n: ITEM_LIMIT })) : '');

  if (!rows.length) {
    body.innerHTML = tiles + notes +
      `<p style="text-align:center;color:#64748b;padding:24px;">${t('rep.noActivity')}</p>`;
    return;
  }

  const _ta = (typeof langDir === 'function' && langDir(getLang()) === 'ltr') ? 'left' : 'right';

  // One flat array feeds both the table and the Excel export, so the file can
  // never drift from what the screen shows.
  const flat = rows.map(r => {
    const p = r.pod;
    const stagesSorted = [...r.stages].sort((a, b) => a.stage_number - b.stage_number);
    const completed = (p.qc_stages || []).filter(s => s.status === 'completed').length;
    const stageTotal = qcStageSet(podProductType(p)).length;
    return {
      podCode: p.pod_code || '',
      project: p.projects?.name || '',
      group: p.production_groups?.name || '',
      letters: stagesSorted.map(s => STAGE_LETTERS[s.stage_number - 1] || s.stage_number).join(', '),
      started: r.started,
      items: r.items,
      signers: [...new Set(stagesSorted.map(s => s.inspector_name).filter(Boolean))].join(', '),
      pct: Math.round(completed / stageTotal * 100),
      last: r.last,
    };
  });

  const headers = [t('rep.hPodCode'), t('rep.hProject'), t('rep.hGroup'), t('rep.hStagesSigned'),
    t('rep.startedBadge'), t('rep.hItemsMarked'), t('rep.hSigners'), t('rep.hCurrentProgress'),
    t('rep.hLastActivity')];

  body.innerHTML = tiles + notes + `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      <span style="font-size:13px;color:#64748b;">${t('rep.podsSelected', { n: flat.length })}</span>
      <button id="rep-export-progress" class="btn btn-primary btn-sm">${t('rep.exportExcel')}</button>
    </div>
    <div class="card">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:${_ta};">
              <th style="padding:8px 12px;">${t('rep.hPodCode')}</th>
              <th style="padding:8px 12px;">${t('rep.hProject')}</th>
              <th style="padding:8px 12px;">${t('rep.hGroup')}</th>
              <th style="padding:8px 12px;">${t('rep.hStagesSigned')}</th>
              <th style="padding:8px 12px;">${t('rep.hItemsMarked')}</th>
              <th style="padding:8px 12px;">${t('rep.hSigners')}</th>
              <th style="padding:8px 12px;">${t('rep.hCurrentProgress')}</th>
              <th style="padding:8px 12px;">${t('rep.hLastActivity')}</th>
            </tr>
          </thead>
          <tbody>
            ${flat.map(r => `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px;font-weight:600;">${escHtml(r.podCode)}</td>
                <td style="padding:8px 12px;">${escHtml(r.project)}</td>
                <td style="padding:8px 12px;">${escHtml(r.group)}</td>
                <td style="padding:8px 12px;">${r.letters || '—'}${r.started ? `<span style="display:inline-block;margin-inline-start:6px;font-size:11px;color:#2d5540;background:#c8dfd2;border-radius:10px;padding:1px 7px;">${t('rep.startedBadge')}</span>` : ''}</td>
                <td style="padding:8px 12px;">${r.items || '—'}</td>
                <td style="padding:8px 12px;">${escHtml(r.signers) || '—'}</td>
                <td style="padding:8px 12px;">${r.pct}%</td>
                <td style="padding:8px 12px;color:#64748b;">${formatDateTimeShort(r.last)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('rep-export-progress')?.addEventListener('click', () => {
    try {
      repExportExcel({
        sheetName: t('rep.tabProgress'),
        filePrefix: t('rep.fileProgress'),
        meta: repExportMeta(label, [
          `${t('rep.sumPodsActive')}: ${rows.length}`,
          `${t('rep.sumStagesSigned')}: ${totalStages}`,
          `${t('rep.sumItemsMarked')}: ${totalItems}`,
          `${t('rep.sumPodsStarted')}: ${totalStarted}`,
        ], (itemRows || []).length === ITEM_LIMIT ? t('rep.itemsTruncated', { n: ITEM_LIMIT }) : null),
        headers,
        dataRows: flat.map(r => [
          r.podCode, r.project, r.group, r.letters,
          r.started ? t('common.yes') : '',
          r.items, r.signers, r.pct / 100, formatDateTimeShort(r.last),
        ]),
        percentCols: [7],
      });
      showToast(t('rep.excelCreated'), 'success');
    } catch (err) {
      showToast(t('proj.errorPrefix') + err.message, 'error');
    }
  });
}

// ---- TAB 3: EDIT HISTORY IN A TIME WINDOW ----
// Same source as the 📜 modals (qc_audit_log), across all pods at once.
// Rows with pod_id NULL are mold checks — see the Audit trail notes in
// CLAUDE.md — so the pod column falls back to a "mold check" label.
async function renderHistoryTab(host) {
  host.innerHTML = repRangeBarHtml() +
    `<div id="rep-body"><div style="text-align:center;padding:32px;color:#64748b;">${t('proj.loadingData')}</div></div>`;
  wireRepRangeBar(() => renderHistoryTab(host));

  const { from, to, label } = repRange();
  document.getElementById('rep-range-label').textContent = t('rep.rangeShowing', { label });
  const body = document.getElementById('rep-body');

  const LIMIT = 500;
  const { data: logs, error } = await supabaseClient
    .from('qc_audit_log').select('*')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) {
    body.innerHTML = `<p style="text-align:center;color:#dc2626;padding:24px;">${t('proj.errorPrefix')}${escHtml(error.message)}</p>`;
    return;
  }

  const podById = {};
  _repPods.forEach(p => { podById[p.id] = p; });

  // Project filter applies to pod-scoped rows only. Mold-check rows carry no
  // pod_id and cannot be attributed to a project, so they are dropped when a
  // specific project is selected rather than shown under the wrong one.
  const rows = (logs || []).filter(l => {
    if (!_repProject) return true;
    return l.pod_id && podById[l.pod_id]?.project_id === _repProject;
  });

  const note = repNoteHtml(t('rep.historyNote')) +
    ((logs || []).length === LIMIT ? repNoteHtml(t('rep.historyTruncated', { n: LIMIT })) : '');

  if (!rows.length) {
    body.innerHTML = note + `<p style="text-align:center;color:#64748b;padding:24px;">${t('rep.noActivity')}</p>`;
    return;
  }

  const _ta = (typeof langDir === 'function' && langDir(getLang()) === 'ltr') ? 'left' : 'right';

  // One flat array feeds both the table and the Excel export, so the file can
  // never drift from what the screen shows.
  const flat = rows.map(l => {
    const pod = l.pod_id ? podById[l.pod_id] : null;
    const isMold = l.table_name === 'mold_checks';
    const stageNum = l.new_values?.stage_number;
    const letter = stageNum ? (STAGE_LETTERS[stageNum - 1] || stageNum) : null;

    const details = [];
    if (letter) details.push(`${t('qc.stage')} ${letter}`);
    if (l.table_name === 'qc_items' && l.new_values?.item_key) {
      const itemDef = getStage(stageNum, podProductType(pod))?.items.find(it => it.key === l.new_values.item_key);
      details.push(itemDef ? qcItemLabel(itemDef) : (l.new_values.item_label || l.new_values.item_key));
    }
    if (isMold && l.new_values?.mold_number) {
      details.push(`${t('mold.moldLabel')} #${l.new_values.mold_number}`);
    }
    const oldSt = l.old_values?.status;
    const newSt = l.new_values?.status;
    if (oldSt && newSt) details.push(`${t('status.' + oldSt)} → ${t('status.' + newSt)}`);

    return {
      time: formatDateTimeShort(l.created_at),
      podCode: pod ? pod.pod_code : (isMold ? t('rep.moldCheckRow') : ''),
      isPod: !!pod,
      project: pod?.projects?.name || '',
      action: t('audit.' + l.action),
      details: details.join(' · '),
      user: l.changed_by_name || '',
    };
  });

  const headers = [t('rep.hTime'), t('rep.hPodCode'), t('rep.hProject'),
    t('rep.hActionCol'), t('rep.hDetails'), t('rep.hUser')];

  body.innerHTML = note + `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      <span style="font-size:13px;color:#64748b;">${t('rep.historyEvents', { n: flat.length })}</span>
      <button id="rep-export-history" class="btn btn-primary btn-sm">${t('rep.exportExcel')}</button>
    </div>
    <div class="card">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;text-align:${_ta};">
              ${headers.map(h => `<th style="padding:8px 12px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${flat.map(r => `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 12px;color:#64748b;white-space:nowrap;">${r.time}</td>
                <td style="padding:8px 12px;font-weight:600;">${r.isPod ? escHtml(r.podCode) : `<span style="color:#64748b;">${escHtml(r.podCode) || '—'}</span>`}</td>
                <td style="padding:8px 12px;">${escHtml(r.project)}</td>
                <td style="padding:8px 12px;">${escHtml(r.action)}</td>
                <td style="padding:8px 12px;color:#64748b;">${escHtml(r.details) || '—'}</td>
                <td style="padding:8px 12px;">${escHtml(r.user)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById('rep-export-history')?.addEventListener('click', () => {
    try {
      repExportExcel({
        sheetName: t('rep.tabHistory'),
        filePrefix: t('rep.fileHistory'),
        meta: repExportMeta(label, [t('rep.historyEvents', { n: flat.length })],
          (logs || []).length === LIMIT ? t('rep.historyTruncated', { n: LIMIT }) : null),
        headers,
        dataRows: flat.map(r => [r.time, r.podCode, r.project, r.action, r.details, r.user]),
      });
      showToast(t('rep.excelCreated'), 'success');
    } catch (err) {
      showToast(t('proj.errorPrefix') + err.message, 'error');
    }
  });
}

async function loadReportsView() {
  const container = document.getElementById('reports-content');
  container.innerHTML = `<div style="text-align:center;padding:32px;color:#64748b;">${t('proj.loadingData')}</div>`;

  // Lightweight query: the table/filters only need stage statuses.
  // Individual qc_items are fetched lazily (fetchItemsForPods) only when
  // exporting, for the filtered pods — loading them for every pod in the
  // system made this view slower with every project added.
  // completed_at is needed by the progress tab (precise signing timestamp).
  const [{ data: projects }, { data: allPods }] = await Promise.all([
    supabaseClient.from('projects').select('id, name, code').eq('is_active', true).order('name'),
    supabaseClient.from('pods').select(`
      *,
      projects!inner(*),
      project_types(type_number, dimensions),
      type_directions(direction),
      production_groups(name),
      qc_stages(id, stage_number, stage_name, status, inspector_name, inspection_date, completed_at)
    `).eq('projects.is_active', true).order('pod_code'),
  ]);

  // Belt-and-braces: exclude pods belonging to archived projects
  const getSerial = repSerial;
  const pods = (allPods || []).filter(p => p.projects?.is_active !== false);
  _repProjects = projects || [];
  _repPods = pods;

  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn rep-tab-btn ${_repTab === 'qc' ? 'active' : ''}" data-rtab="qc">${t('rep.tabQc')}</button>
      <button class="tab-btn rep-tab-btn ${_repTab === 'progress' ? 'active' : ''}" data-rtab="progress">${t('rep.tabProgress')}</button>
      <button class="tab-btn rep-tab-btn ${_repTab === 'history' ? 'active' : ''}" data-rtab="history">${t('rep.tabHistory')}</button>
    </div>
    <div id="reports-tab-body"></div>`;

  container.querySelectorAll('.rep-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _repTab = btn.dataset.rtab;
      container.querySelectorAll('.rep-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderReportsTabBody();
    });
  });

  function renderReportsTabBody() {
    const host = document.getElementById('reports-tab-body');
    if (_repTab === 'progress') { renderProgressTab(host); return; }
    if (_repTab === 'history') { renderHistoryTab(host); return; }
    renderQcExportTab(host);
  }

  function renderQcExportTab(host) {
  const types = [...new Set(pods.map(p => p.project_types?.type_number).filter(Boolean))].sort((a,b) => a-b);
  const groups = [...new Set(pods.map(p => p.production_groups?.name).filter(Boolean))].sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, '')) || 0;
    const nb = parseInt(b.replace(/\D/g, '')) || 0;
    return na !== nb ? na - nb : a.localeCompare(b);
  });
  const directions = [...new Set(pods.map(p => p.type_directions?.direction).filter(Boolean))].sort();

  host.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3>${t('rep.filterTitle')}</h3></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('pod.projectLabel')}</label>
            <select id="rf-project" class="form-control form-control-sm">
              <option value="">${t('rep.all')}</option>
              ${(projects || []).map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('proj.type')}</label>
            <select id="rf-type" class="form-control form-control-sm">
              <option value="">${t('rep.all')}</option>
              ${types.map(ty => `<option value="${ty}">T${ty}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('proj.group')}</label>
            <select id="rf-group" class="form-control form-control-sm">
              <option value="">${t('rep.all')}</option>
              ${groups.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('proj.direction')}</label>
            <select id="rf-direction" class="form-control form-control-sm">
              <option value="">${t('rep.all')}</option>
              ${directions.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">${t('rep.statusLabel')}</label>
            <select id="rf-status" class="form-control form-control-sm">
              <option value="">${t('rep.all')}</option>
              ${Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span id="rf-count" style="font-size:13px;color:#64748b;"></span>
          <button id="rf-btn-pdf" class="btn btn-primary btn-sm">${t('rep.exportPdfSelected')}</button>
          <button id="rf-btn-excel" class="btn btn-primary btn-sm">${t('rep.exportExcelSelected')}</button>
        </div>
      </div>
    </div>
    <div id="rf-table"></div>
  `;

  function getFiltered() {
    const proj = document.getElementById('rf-project').value;
    const type = document.getElementById('rf-type').value;
    const group = document.getElementById('rf-group').value;
    const dir = document.getElementById('rf-direction').value;
    const status = document.getElementById('rf-status').value;
    return pods.filter(p =>
      (!proj   || p.project_id === proj) &&
      (!type   || String(p.project_types?.type_number) === type) &&
      (!group  || p.production_groups?.name === group) &&
      (!dir    || p.type_directions?.direction === dir) &&
      (!status || p.status === status)
    ).sort((a, b) => getSerial(a.pod_code) - getSerial(b.pod_code));
  }

  function renderTable() {
    const filtered = getFiltered();
    document.getElementById('rf-count').textContent = t('rep.podsSelected', { n: filtered.length });
    const tbl = document.getElementById('rf-table');
    if (!filtered.length) {
      tbl.innerHTML = `<p style="text-align:center;color:#64748b;padding:24px;">${t('rep.noResults')}</p>`;
      return;
    }
    const _ta = (typeof langDir === 'function' && langDir(getLang()) === 'ltr') ? 'left' : 'right';
    tbl.innerHTML = `
      <div class="card">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;text-align:${_ta};">
                <th style="padding:8px 12px;">${t('rep.hPodCode')}</th>
                <th style="padding:8px 12px;">${t('rep.hProject')}</th>
                <th style="padding:8px 12px;">${t('rep.hType')}</th>
                <th style="padding:8px 12px;">${t('rep.hDirection')}</th>
                <th style="padding:8px 12px;">${t('rep.hGroup')}</th>
                <th style="padding:8px 12px;">${t('rep.hStatus')}</th>
                <th style="padding:8px 12px;">${t('proj.progress')}</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => {
                const completed = (p.qc_stages || []).filter(s => s.status === 'completed').length;
                const pct = Math.round(completed / qcStageSet(podProductType(p)).length * 100);
                const statusColor = p.status === 'completed' ? '#16a34a' : p.status === 'failed' ? '#dc2626' : '#64748b';
                return `<tr class="rf-pod-row" data-pod-id="${p.id}" style="border-bottom:1px solid #f1f5f9;transition:background 0.2s;">
                  <td style="padding:8px 12px;font-weight:600;">${escHtml(p.pod_code)}</td>
                  <td style="padding:8px 12px;">${escHtml(p.projects?.name || '')}</td>
                  <td style="padding:8px 12px;">T${p.project_types?.type_number || ''}</td>
                  <td style="padding:8px 12px;">${p.type_directions?.direction || ''}</td>
                  <td style="padding:8px 12px;">${escHtml(p.production_groups?.name || '')}</td>
                  <td style="padding:8px 12px;color:${statusColor};font-weight:600;">${STATUS_LABELS[p.status] || p.status}</td>
                  <td style="padding:8px 12px;">${pct}%</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  ['rf-project','rf-type','rf-group','rf-direction','rf-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTable);
  });
  renderTable();

  document.getElementById('rf-btn-pdf').addEventListener('click', async () => {
    const filtered = getFiltered();
    if (!filtered.length) { showToast(t('rep.noPodsSelected'), 'warning'); return; }
    const btn = document.getElementById('rf-btn-pdf');
    setLoading(btn, true);
    try {
      await fetchItemsForPods(filtered);
      for (let i = 0; i < filtered.length; i++) {
        const pod = filtered[i];
        const stages = pod.qc_stages || [];
        const stageItems = {};
        for (const stage of stages) stageItems[stage.id] = stage.qc_items || [];
        await buildAndDownloadPDF(pod, stages, stageItems);
        if (i < filtered.length - 1) await new Promise(r => setTimeout(r, 300));
      }
      showToast(t('rep.pdfExported', { n: filtered.length }), 'success');
    } catch (err) {
      showToast(t('proj.errorPrefix') + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('rf-btn-excel').addEventListener('click', async () => {
    const filtered = getFiltered();
    if (!filtered.length) { showToast(t('rep.noPodsSelected'), 'warning'); return; }

    const excelBtn = document.getElementById('rf-btn-excel');
    setLoading(excelBtn, true);
    try {
      await fetchItemsForPods(filtered);
    } catch (err) {
      setLoading(excelBtn, false);
      showToast(t('proj.errorPrefix') + err.message, 'error');
      return;
    }
    setLoading(excelBtn, false);

    // Highlight selected rows in blue
    const selectedIds = new Set(filtered.map(p => p.id));
    document.querySelectorAll('.rf-pod-row').forEach(row => {
      if (selectedIds.has(row.dataset.podId)) {
        row.style.background = '#dbeafe';
      }
    });
    setTimeout(() => {
      document.querySelectorAll('.rf-pod-row').forEach(row => { row.style.background = ''; });
    }, 2000);

    try {
      const label = document.getElementById('rf-project').value
        ? (projects || []).find(p => p.id === document.getElementById('rf-project').value)?.name || t('rep.filterLabel')
        : t('rep.allPodsLabel');
      buildExcelFromPods(filtered, label);
      showToast(t('rep.excelCreated'), 'success');
    } catch (err) {
      showToast(t('proj.errorPrefix') + err.message, 'error');
    }
  });
  }

  renderReportsTabBody();
}
