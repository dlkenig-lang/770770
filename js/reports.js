// =============================================
// Reports Module - PDF & Excel Generation
// =============================================

async function generatePodPDF(pod) {
  const btn = document.getElementById('btn-pod-pdf');
  setLoading(btn, true);

  try {
    // Load full data
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

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ---- HEADER ----
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Quality Control Report', pageW - margin, 15, { align: 'right' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pod: ${pod.pod_code}`, pageW - margin, 26, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDate(new Date().toISOString().split('T')[0])}`, pageW - margin, 35, { align: 'right' });
    y = 50;

    // ---- POD INFO ----
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 28, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Pod Information', pageW - margin, y + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text([
      `Project: ${pod.projects?.name || ''}  |  Code: ${pod.pod_code}`,
      `Type: T${pod.project_types?.type_number || ''}  |  Direction: ${pod.type_directions?.direction || ''}  |  Pipe: ${pod.projects?.pipe_type || ''}`,
    ], pageW - margin, y + 15, { align: 'right' });
    y += 34;

    // ---- STAGES ----
    for (const stage of (stages || [])) {
      if (y > pageH - 50) { doc.addPage(); y = margin; }

      const items = stageItems[stage.id] || [];
      const stageDef = getStage(stage.stage_number);
      const passed = items.filter(i => i.status === 'passed').length;
      const failed = items.filter(i => i.status === 'failed').length;

      // Stage header
      const stageColor = stage.status === 'completed' ? [22, 163, 74] :
                         stage.status === 'failed' ? [220, 38, 38] : [100, 116, 139];
      doc.setFillColor(...stageColor);
      doc.rect(margin, y, contentW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${stage.stage_number}. ${stage.stage_name}`, pageW - margin - 2, y + 7, { align: 'right' });
      doc.text(`${passed}/${items.length} passed`, margin + 2, y + 7);
      y += 12;

      // Inspector info
      if (stage.inspector_name) {
        doc.setTextColor(30, 41, 59);
        doc.setFillColor(220, 252, 231);
        doc.rect(margin, y, contentW, 8, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(`Inspector: ${stage.inspector_name}  |  Date: ${formatDate(stage.inspection_date)}`, pageW - margin - 2, y + 5.5, { align: 'right' });
        y += 10;
      }

      // Items
      doc.setFont('helvetica', 'normal');
      for (const itemDef of (stageDef?.items || [])) {
        if (y > pageH - 20) { doc.addPage(); y = margin; }
        const item = items.find(i => i.item_key === itemDef.key);
        const status = item?.status || 'pending';
        const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '○';
        const color = status === 'passed' ? [22, 163, 74] : status === 'failed' ? [220, 38, 38] : [100, 116, 139];

        doc.setTextColor(...color);
        doc.setFontSize(9);
        doc.text(icon, margin + 3, y + 4.5);
        doc.setTextColor(30, 41, 59);
        doc.text(itemDef.label, margin + 8, y + 4.5);

        if (item?.notes) {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(8);
          doc.text(`Note: ${item.notes}`, margin + 8, y + 8.5);
          y += 12;
        } else {
          y += 7;
        }
        if (item?.time_entry_1) {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(8);
          doc.text(`Time 1: ${item.time_entry_1}  Time 2: ${item.time_entry_2 || '—'}`, margin + 8, y);
          y += 5;
        }
      }
      y += 4;
    }

    // ---- SIGNATURE SECTION ----
    if (y > pageH - 40) { doc.addPage(); y = margin; }
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Final Signatures:', pageW - margin, y, { align: 'right' });
    y += 12;

    // Sign lines
    for (const label of ['Inspector', 'QC Manager', 'Project Manager']) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${label}: _______________________`, margin, y);
      doc.text('Date: ___________', margin + 100, y);
      y += 12;
    }

    // Save
    const filename = `QC_${pod.pod_code}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    const project = pod.projects;
    if (project?.onedrive_folder_url) {
      showOneDriveModal(filename, project.onedrive_folder_url, project.id);
    } else {
      showToast('PDF נוצר ונשמר', 'success');
    }
  } catch (err) {
    showToast('שגיאה ביצירת PDF: ' + err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

function showOneDriveModal(filename, folderUrl, projectId) {
  const storageKey = `onedrive_subfolders_${projectId}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');

  const recentHtml = saved.length
    ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px">
        ${saved.map(s => `<button type="button" class="btn btn-ghost btn-sm onedrive-sub-chip" style="font-size:11px;padding:2px 8px">${escHtml(s)}</button>`).join('')}
       </div>`
    : '';

  openModal('PDF נוצר — שמירה ב-OneDrive', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 14px;font-size:13px;word-break:break-all">
        📄 <strong>${escHtml(filename)}</strong>
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:13px">תיקיית משנה (אופציונלי)</label>
        <input type="text" id="onedrive-subfolder" class="form-control" placeholder="לדוגמה: T1-ימין" style="margin-top:4px" />
        ${recentHtml}
      </div>
      <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">
        לחץ <strong>"פתח OneDrive"</strong> — הקובץ כבר הורד למחשבך, גרור אותו לתיקייה המתאימה.
      </div>
    </div>
  `, [
    { label: 'ביטול', cls: 'btn-ghost', id: 'btn-od-cancel' },
    { label: '📂 פתח OneDrive', cls: 'btn-primary', id: 'btn-od-open' },
  ]);

  document.querySelectorAll('.onedrive-sub-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('onedrive-subfolder').value = chip.textContent;
    });
  });

  document.getElementById('btn-od-cancel')?.addEventListener('click', closeModal);

  document.getElementById('btn-od-open')?.addEventListener('click', () => {
    const sub = document.getElementById('onedrive-subfolder')?.value.trim();
    if (sub) {
      const updated = [sub, ...saved.filter(s => s !== sub)].slice(0, 6);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
    window.open(folderUrl, '_blank');
    closeModal();
  });
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
