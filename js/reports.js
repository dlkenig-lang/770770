// =============================================
// Reports Module - PDF & Excel Generation
// =============================================

function buildPDFSections(pod, stages, stageItems) {
  const stageStatusColor = s =>
    s === 'completed' ? '#16a34a' : s === 'failed' ? '#dc2626' : '#64748b';
  const itemStatusColor = s =>
    s === 'passed' ? '#16a34a' : s === 'failed' ? '#dc2626' : '#64748b';
  const itemIcon = s =>
    s === 'passed' ? '✓' : s === 'failed' ? '✗' : '○';
  const wrap = c =>
    `<div style="font-family:Arial,sans-serif;direction:rtl;color:#1e293b;width:794px;background:#fff;">${c}</div>`;

  const sections = [];

  // Header + pod info
  sections.push(wrap(`
    <div style="background:#2563eb;color:#fff;padding:18px 24px;text-align:right;">
      <div style="font-size:22px;font-weight:bold;">דוח בקרת איכות</div>
      <div style="font-size:14px;margin-top:4px;">פוד: ${escHtml(pod.pod_code)}</div>
      <div style="font-size:12px;margin-top:2px;opacity:0.85;">נוצר: ${formatDate(new Date().toISOString().split('T')[0])}</div>
    </div>
    <div style="background:#f1f5f9;padding:12px 24px;text-align:right;border-bottom:2px solid #e2e8f0;">
      <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">פרטי פוד</div>
      <div style="font-size:12px;">פרויקט: ${escHtml(pod.projects?.name || '')} | קוד: ${escHtml(pod.pod_code)}</div>
      <div style="font-size:12px;margin-top:3px;">טיפוס: T${escHtml(String(pod.project_types?.type_number || ''))} | כיוון: ${escHtml(pod.type_directions?.direction || '')} | צינור: ${escHtml(pod.projects?.pipe_type || '')}</div>
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
        <div style="background:${bgColor};color:#fff;padding:7px 12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;">${passed}/${items.length} עברו</span>
          <span style="font-size:13px;font-weight:bold;">${stage.stage_number}. ${escHtml(stage.stage_name)}</span>
        </div>
        ${stage.inspector_name ? `
        <div style="background:#dcfce7;padding:5px 12px;font-size:11px;color:#166534;text-align:right;">
          בודק: ${escHtml(stage.inspector_name)} | תאריך: ${escHtml(formatDate(stage.inspection_date))}
        </div>` : ''}
        ${itemsHTML}
      </div>
    `));
  }

  // Signatures
  sections.push(wrap(`
    <div style="padding:8px 24px 24px;">
      <div style="border-top:1px solid #e2e8f0;padding-top:14px;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:10px;text-align:right;">חתימות סיום</div>
        ${['בודק', 'מנהל בקרת איכות', 'מנהל פרויקט'].map(label => `
          <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:12px;">
            <span>תאריך: ___________</span>
            <span>${escHtml(label)}: _______________________</span>
          </div>`).join('')}
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

async function generatePodPDF(pod) {
  const btn = document.getElementById('btn-pod-pdf');
  setLoading(btn, true);

  try {
    const { data: stages } = await supabaseClient
      .from('qc_stages')
      .select('*')
      .eq('pod_id', pod.id)
      .order('stage_number');

    const stageItems = {};
    for (const stage of (stages || [])) {
      const { data: items } = await supabaseClient
        .from('qc_items').select('*').eq('stage_id', stage.id);
      stageItems[stage.id] = items || [];
    }

    const SCALE = 3;
    const PAGE_H_MM = 297;
    const MARGIN_MM = 10;
    const CONTENT_W_MM = 210 - MARGIN_MM * 2; // 190mm
    const pxToMm = CONTENT_W_MM / 794;

    const sections = buildPDFSections(pod, stages || [], stageItems);

    // Render all sections to canvases
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

      // Start a new page if section doesn't fit (but always keep header on first page)
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
        showToast('PDF נשמר בהצלחה', 'success');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
        // SecurityError or other – fall through to direct download
      }
    }
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast('PDF נוצר ונשמר', 'success');
  } catch (err) {
    showToast('שגיאה ביצירת PDF: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function generateProjectExcel(projectId, projectName) {
  const btn = document.getElementById('btn-pod-excel') || document.querySelector('.btn-export-excel');
  if (btn) setLoading(btn, true);

  try {
    const { data: pods } = await supabaseClient
      .from('pods')
      .select(`
        *,
        project_types(type_number, dimensions),
        type_directions(direction),
        production_groups(name),
        qc_stages(*, qc_items(*))
      `)
      .eq('project_id', projectId)
      .order('pod_code');

    const wb = XLSX.utils.book_new();

    // ---- SUMMARY SHEET ----
    const summaryData = [
      ['קוד פוד', 'טיפוס', 'כיוון', 'קבוצה', 'סטטוס',
       'שלב 1', 'שלב 2', 'שלב 3', 'שלב 4', 'שלב 5', 'שלב 6', 'התקדמות %'],
    ];

    for (const pod of (pods || [])) {
      const stages = pod.qc_stages || [];
      const stageStatuses = QC_STAGES.map(qs => {
        const s = stages.find(st => st.stage_number === qs.number);
        return STATUS_LABELS[s?.status] || 'ממתין';
      });
      const completedStages = stages.filter(s => s.status === 'completed').length;
      const pct = Math.round(completedStages / 6 * 100);

      summaryData.push([
        pod.pod_code,
        `T${pod.project_types?.type_number || ''}`,
        pod.type_directions?.direction || '',
        pod.production_groups?.name || '',
        STATUS_LABELS[pod.status] || pod.status,
        ...stageStatuses,
        pct + '%',
      ]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'סיכום');

    // ---- DETAILED SHEETS PER STAGE ----
    for (const stageDef of QC_STAGES) {
      const headers = ['קוד פוד', 'טיפוס', 'כיוון', 'בודק', 'תאריך'];
      stageDef.items.forEach(item => headers.push(item.label));
      headers.push('הערות כלליות');

      const rows = [headers];

      for (const pod of (pods || [])) {
        const stages = pod.qc_stages || [];
        const stage = stages.find(s => s.stage_number === stageDef.number);
        const items = stage?.qc_items || [];

        const row = [
          pod.pod_code,
          `T${pod.project_types?.type_number || ''}`,
          pod.type_directions?.direction || '',
          stage?.inspector_name || '',
          stage?.inspection_date ? formatDate(stage.inspection_date) : '',
        ];

        stageDef.items.forEach(itemDef => {
          const item = items.find(i => i.item_key === itemDef.key);
          row.push(STATUS_LABELS[item?.status] || 'ממתין');
        });
        row.push('');
        rows.push(row);
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `שלב ${stageDef.number}`);
    }

    const filename = `QC_${projectName.replace(/[^a-zA-Z0-9א-ת]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('קובץ Excel נוצר', 'success');
  } catch (err) {
    showToast('שגיאה ביצירת Excel: ' + err.message, 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

async function loadReportsView() {
  const { data: projects } = await supabaseClient
    .from('projects')
    .select('id, name, code')
    .eq('is_active', true)
    .order('name');

  const container = document.getElementById('reports-content');
  container.innerHTML = `
    <div class="reports-grid">
      ${(projects || []).map(p => `
        <div class="report-card">
          <h3>📋 ${escHtml(p.name)}</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm btn-export-excel" data-project-id="${p.id}" data-project-name="${escHtml(p.name)}">
              📊 Excel
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="card" style="margin-top:24px">
      <div class="card-header"><h3>חיבור OneDrive</h3></div>
      <div class="card-body">
        <div class="onedrive-section">
          <h4>📁 כיצד לחבר לOneDrive</h4>
          <ol style="padding-right:20px;line-height:2">
            <li>פתח <a href="https://onedrive.live.com" target="_blank">OneDrive</a> ואם נדרש התחבר</li>
            <li>צור תיקייה ייעודית לפרויקט</li>
            <li>לחץ ימני על התיקייה → <strong>"שתף"</strong></li>
            <li>בחר <strong>"כל מי שיש לו את הקישור יכול לערוך"</strong></li>
            <li>העתק את הקישור שנוצר</li>
            <li>חזור לאפליקציה → פרויקט → <strong>פרטים נוספים</strong></li>
            <li>הדבק את הקישור בשדה <strong>"קישור OneDrive"</strong> ושמור</li>
            <li>כעת כשתייצא PDF, יפתח OneDrive אוטומטית להעלאה</li>
          </ol>
        </div>
        <div style="margin-top:12px;padding:12px;background:var(--warning-light);border-radius:8px">
          <strong>💡 טיפ:</strong> לשמירה אוטומטית מלאה, שקול שימוש ב-OneDrive Desktop שיסנכרן קבצים מהמחשב ישירות לענן.
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-export-excel').forEach(btn => {
    btn.addEventListener('click', () => generateProjectExcel(btn.dataset.projectId, btn.dataset.projectName));
  });
}
