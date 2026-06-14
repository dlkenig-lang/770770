// =============================================
// Reports Module - PDF & Excel Generation
// =============================================

function buildPDFSections(pod, stages, stageItems, logoDataUrl, barcodeDataUrl, groupLabel = '') {
  const stageStatusColor = s =>
    s === 'completed' ? '#7baa8a' : s === 'failed' ? '#b87878' : '#8899aa';
  const itemStatusColor = s =>
    s === 'passed' ? '#4a8c60' : s === 'failed' ? '#a05050' : '#8899aa';
  const itemIcon = s =>
    s === 'passed' ? '✓' : s === 'failed' ? '✗' : '○';
  const wrap = c =>
    `<div style="font-family:Arial,sans-serif;direction:rtl;color:#1e293b;width:794px;background:#fff;">${c}</div>`;

  const sections = [];

  // Header + pod info
  sections.push(wrap(`
    <div style="background:#7ab8b6;color:#1a1a1a;padding:14px 24px;">
      <div style="font-size:13px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-align:right;">MODUSYSTEMS LTD.</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="text-align:left;">
          <div style="font-size:22px;font-weight:bold;">דוח בקרת איכות</div>
          <div style="font-size:14px;margin-top:4px;">פוד: ${escHtml(pod.pod_code)}</div>
          <div style="font-size:12px;margin-top:2px;opacity:0.7;">נוצר: ${formatDate(new Date().toISOString().split('T')[0])}</div>
        </div>
        <div style="text-align:right;">
          ${barcodeDataUrl ? `
            <img src="${barcodeDataUrl}" style="height:50px;width:auto;display:block;margin-left:auto;image-rendering:pixelated;" />
            <div style="font-size:9px;margin-top:2px;text-align:center;font-weight:600;">${escHtml(pod.pod_code)}</div>
          ` : ''}
        </div>
      </div>
    </div>
    <div style="background:#f1f5f9;padding:12px 24px;text-align:right;border-bottom:2px solid #e2e8f0;">
      <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">פרטי פוד</div>
      <div style="font-size:12px;">פרויקט: ${escHtml(pod.projects?.name || '')} | קוד: ${escHtml(pod.pod_code)}${groupLabel ? ` | סימון קבוצה: <strong style="font-size:14px">${escHtml(groupLabel)}</strong>` : ''}</div>
      <div style="font-size:12px;margin-top:3px;">טיפוס: T${escHtml(String(pod.project_types?.type_number || ''))} | כיוון: ${escHtml(pod.type_directions?.direction || '')} | צינור: ${escHtml(pod.projects?.pipe_type || '')}${pod.production_groups?.name ? ` | קבוצה: ${escHtml(pod.production_groups.name)}` : ''}</div>
    </div>
  `));

  // Each stage as its own section
  for (const stage of stages) {
    const items = stageItems[stage.id] || [];
    const stageDef = getStage(stage.stage_number);
    const passed = items.filter(i => i.status === 'passed').length;
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
            <div style="font-size:12px;color:#1e293b;">${escHtml(itemDef.label)}</div>
            ${item?.notes ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">הערה: ${escHtml(item.notes)}</div>` : ''}
            ${item?.time_entry_1 ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">זמן 1: ${escHtml(item.time_entry_1)}  זמן 2: ${escHtml(item.time_entry_2 || '—')}</div>` : ''}
          </div>
        </div>`;
    }

    sections.push(wrap(`
      <div style="margin:8px 24px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
        <div style="background:${bgColor};color:#1a1a1a;padding:7px 12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;">${passed}/${items.length} עברו</span>
          <span style="font-size:13px;font-weight:bold;">${stage.stage_number}. ${escHtml(stage.stage_name)}</span>
        </div>
        ${stage.inspector_name ? `
        <div style="background:#c8dfd2;padding:6px 12px;font-size:11px;color:#2d5540;display:flex;align-items:center;justify-content:space-between;">
          <div style="text-align:right;">בודק: <strong>${escHtml(stage.inspector_name)}</strong> | תאריך: ${escHtml(formatDate(stage.inspection_date))}</div>
          <div>
            ${stage.inspector_signature ? `<img src="${stage.inspector_signature}" style="height:38px;background:#fff;border-radius:3px;padding:2px;border:1px solid #a0c4b0;" alt="חתימה" />` : ''}
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
          <div style="flex:1;text-align:right;">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">שם</div>
            <div style="border-bottom:1px solid #94a3b8;height:24px;"></div>
          </div>
          <div style="flex:1;text-align:right;">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">תפקיד</div>
            <div style="border-bottom:1px solid #94a3b8;height:24px;"></div>
          </div>
          <div style="flex:1;text-align:right;">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;">תאריך</div>
            <div style="border-bottom:1px solid #94a3b8;height:24px;"></div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#64748b;margin-bottom:6px;">חתימה</div>
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
    showToast('PDF נוצר ונשמר', 'success');
  } catch (err) {
    showToast('שגיאה ביצירת PDF: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

function buildExcelFromPods(pods, label) {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['קוד פוד', 'פרויקט', 'טיפוס', 'כיוון', 'קבוצה', 'סטטוס',
     'שלב 1', 'שלב 2', 'שלב 3', 'שלב 4', 'שלב 5', 'שלב 6', 'התקדמות %'],
  ];

  for (const pod of pods) {
    const stages = pod.qc_stages || [];
    const stageStatuses = QC_STAGES.map(qs => {
      const s = stages.find(st => st.stage_number === qs.number);
      return STATUS_LABELS[s?.status] || 'ממתין';
    });
    const completedStages = stages.filter(s => s.status === 'completed').length;
    summaryData.push([
      pod.pod_code,
      pod.projects?.name || '',
      `T${pod.project_types?.type_number || ''}`,
      pod.type_directions?.direction || '',
      pod.production_groups?.name || '',
      STATUS_LABELS[pod.status] || pod.status,
      ...stageStatuses,
      Math.round(completedStages / 6 * 100) + '%',
    ]);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'סיכום');

  for (const stageDef of QC_STAGES) {
    const headers = ['קוד פוד', 'פרויקט', 'טיפוס', 'כיוון', 'בודק', 'תאריך'];
    stageDef.items.forEach(item => headers.push(item.label));
    const rows = [headers];

    for (const pod of pods) {
      const stage = (pod.qc_stages || []).find(s => s.stage_number === stageDef.number);
      const items = stage?.qc_items || [];
      const row = [
        pod.pod_code,
        pod.projects?.name || '',
        `T${pod.project_types?.type_number || ''}`,
        pod.type_directions?.direction || '',
        stage?.inspector_name || '',
        stage?.inspection_date ? formatDate(stage.inspection_date) : '',
      ];
      stageDef.items.forEach(itemDef => {
        const item = items.find(i => i.item_key === itemDef.key);
        row.push(STATUS_LABELS[item?.status] || 'ממתין');
      });
      rows.push(row);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `שלב ${stageDef.number}`);
  }

  const filename = `QC_${label.replace(/[^a-zA-Z0-9א-ת]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
}

async function loadReportsView() {
  const container = document.getElementById('reports-content');
  container.innerHTML = '<div style="text-align:center;padding:32px;color:#64748b;">טוען נתונים...</div>';

  const [{ data: projects }, { data: allPods }] = await Promise.all([
    supabaseClient.from('projects').select('id, name, code').eq('is_active', true).order('name'),
    supabaseClient.from('pods').select(`
      *,
      projects(id, name, code, pipe_type, is_active),
      project_types(type_number, dimensions),
      type_directions(direction),
      production_groups(name),
      qc_stages(id, stage_number, stage_name, status, inspector_name, inspection_date, qc_items(*))
    `).order('pod_code'),
  ]);

  // Exclude pods belonging to archived projects
  const getSerial = code => parseInt((code || '').slice(-3)) || 0;
  const pods = (allPods || []).filter(p => p.projects?.is_active !== false);
  const types = [...new Set(pods.map(p => p.project_types?.type_number).filter(Boolean))].sort((a,b) => a-b);
  const groups = [...new Set(pods.map(p => p.production_groups?.name).filter(Boolean))].sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, '')) || 0;
    const nb = parseInt(b.replace(/\D/g, '')) || 0;
    return na !== nb ? na - nb : a.localeCompare(b);
  });
  const directions = [...new Set(pods.map(p => p.type_directions?.direction).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3>סינון פודים לייצוא</h3></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">פרויקט</label>
            <select id="rf-project" class="form-control form-control-sm">
              <option value="">הכל</option>
              ${(projects || []).map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">טיפוס</label>
            <select id="rf-type" class="form-control form-control-sm">
              <option value="">הכל</option>
              ${types.map(t => `<option value="${t}">T${t}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">קבוצה</label>
            <select id="rf-group" class="form-control form-control-sm">
              <option value="">הכל</option>
              ${groups.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">כיוון</label>
            <select id="rf-direction" class="form-control form-control-sm">
              <option value="">הכל</option>
              ${directions.map(d => `<option value="${escHtml(d)}">${escHtml(d)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">סטטוס</label>
            <select id="rf-status" class="form-control form-control-sm">
              <option value="">הכל</option>
              ${Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span id="rf-count" style="font-size:13px;color:#64748b;"></span>
          <button id="rf-btn-pdf" class="btn btn-primary btn-sm">📄 ייצוא PDF לנבחרים</button>
          <button id="rf-btn-excel" class="btn btn-primary btn-sm">📊 ייצוא Excel לנבחרים</button>
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
    document.getElementById('rf-count').textContent = `${filtered.length} פודים נבחרו`;
    const tbl = document.getElementById('rf-table');
    if (!filtered.length) {
      tbl.innerHTML = '<p style="text-align:center;color:#64748b;padding:24px;">אין תוצאות</p>';
      return;
    }
    tbl.innerHTML = `
      <div class="card">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9;text-align:right;">
                <th style="padding:8px 12px;">קוד פוד</th>
                <th style="padding:8px 12px;">פרויקט</th>
                <th style="padding:8px 12px;">טיפוס</th>
                <th style="padding:8px 12px;">כיוון</th>
                <th style="padding:8px 12px;">קבוצה</th>
                <th style="padding:8px 12px;">סטטוס</th>
                <th style="padding:8px 12px;">התקדמות</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(p => {
                const completed = (p.qc_stages || []).filter(s => s.status === 'completed').length;
                const pct = Math.round(completed / 6 * 100);
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
    if (!filtered.length) { showToast('אין פודים נבחרים', 'warning'); return; }
    const btn = document.getElementById('rf-btn-pdf');
    setLoading(btn, true);
    try {
      for (let i = 0; i < filtered.length; i++) {
        const pod = filtered[i];
        const stages = pod.qc_stages || [];
        const stageItems = {};
        for (const stage of stages) stageItems[stage.id] = stage.qc_items || [];
        await buildAndDownloadPDF(pod, stages, stageItems);
        if (i < filtered.length - 1) await new Promise(r => setTimeout(r, 300));
      }
      showToast(`${filtered.length} קבצי PDF יוצאו`, 'success');
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('rf-btn-excel').addEventListener('click', () => {
    const filtered = getFiltered();
    if (!filtered.length) { showToast('אין פודים נבחרים', 'warning'); return; }

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
        ? (projects || []).find(p => p.id === document.getElementById('rf-project').value)?.name || 'סינון'
        : 'כל_הפודים';
      buildExcelFromPods(filtered, label);
      showToast('קובץ Excel נוצר', 'success');
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    }
  });
}
