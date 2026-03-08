// =============================================
// Projects Module
// =============================================

// In-memory cache so openProject never needs a second round-trip to the DB.
// Populated whenever loadDashboard / loadProjects runs.
const ProjectCache = new Map();

// ---- LOAD DASHBOARD ----
async function loadDashboard() {
  const { data: projects, error: dashErr } = await supabaseClient
    .from('projects')
    .select('*, pods(id, status)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const statsEl = document.getElementById('dashboard-stats');
  const projList = document.getElementById('dashboard-projects-list');

  if (dashErr) {
    projList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">שגיאה בטעינת פרויקטים. רענן את הדף (F5).</div></div>';
    return;
  }

  const totalProjects = (projects || []).length;
  const totalPods = (projects || []).reduce((a, p) => a + (p.pods?.length || 0), 0);
  const completedPods = (projects || []).reduce((a, p) => a + (p.pods?.filter(pod => pod.status === 'completed').length || 0), 0);
  const failedPods = (projects || []).reduce((a, p) => a + (p.pods?.filter(pod => pod.status === 'failed').length || 0), 0);

  statsEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${totalProjects}</div>
      <div class="stat-label">פרויקטים פעילים</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalPods}</div>
      <div class="stat-label">סה"כ פודים</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${completedPods}</div>
      <div class="stat-label">פודים שהושלמו</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${failedPods}</div>
      <div class="stat-label">פודים שנכשלו</div>
    </div>
  `;

  if (!projects || projects.length === 0) {
    projList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">אין פרויקטים עדיין</div></div>';
    return;
  }

  projects.forEach(p => ProjectCache.set(p.id, p));
  projList.innerHTML = projects.slice(0, 6).map(p => renderProjectCard(p)).join('');
  projList.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => openProject(card.dataset.projectId));
  });
}

// ---- LOAD PROJECTS LIST ----
async function loadProjects() {
  const { data: projects, error } = await supabaseClient
    .from('projects')
    .select('*, pods(id, status)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const list = document.getElementById('projects-list');

  if (error) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">שגיאה בטעינת פרויקטים. רענן את הדף (F5).</div></div>';
    return;
  }

  if (!projects || projects.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">אין פרויקטים עדיין. לחץ "+ פרויקט חדש" להוספה</div></div>';
    return;
  }

  projects.forEach(p => ProjectCache.set(p.id, p));
  list.innerHTML = projects.map(p => renderProjectCard(p)).join('');
  list.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => openProject(card.dataset.projectId));
  });
}

function renderProjectCard(p) {
  const pods = p.pods || [];
  const completed = pods.filter(pod => pod.status === 'completed').length;
  const pct = pods.length > 0 ? Math.round(completed / pods.length * 100) : 0;
  return `
    <div class="project-card" data-project-id="${p.id}">
      <div class="project-card-code">${escHtml(p.code)}</div>
      <div class="project-card-name">${escHtml(p.name)}</div>
      <div class="project-card-meta">
        📅 ${formatDate(p.date_received)}
        ${p.location ? ` &nbsp;📍 ${escHtml(p.location)}` : ''}
        ${p.pipe_type ? ` &nbsp;🔩 ${escHtml(p.pipe_type)}` : ''}
      </div>
      <div class="project-card-stats">
        <div class="project-stat">
          <div class="project-stat-value">${pods.length}</div>
          <div class="project-stat-label">פודים</div>
        </div>
        <div class="project-stat">
          <div class="project-stat-value">${completed}</div>
          <div class="project-stat-label">הושלמו</div>
        </div>
      </div>
      <div class="card-progress-section">
        <div class="card-progress-header">
          <span class="card-progress-label">התקדמות</span>
          <span class="card-progress-pct ${pct===100?'pct-done':''}">${pct}%</span>
        </div>
        <div class="progress-bar-outer progress-bar-lg">
          <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ---- OPEN PROJECT ----
async function openProject(projectId) {
  AppState.currentProject = null;

  // Use cached project data when available to avoid a network round-trip.
  // This is the common case: user clicked a card we already loaded.
  let project = ProjectCache.get(projectId) || null;

  if (!project) {
    // Not in cache — fetch from DB with a timeout so we never hang silently.
    try {
      const result = await Promise.race([
        supabaseClient.from('projects').select('*').eq('id', projectId).single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      if (result.error) { showToast('שגיאה בטעינת פרויקט: ' + result.error.message, 'error'); return; }
      project = result.data;
    } catch (e) {
      showToast('שגיאה בטעינת פרויקט — רענן את הדף (F5)', 'error'); return;
    }
  }

  if (!project) { showToast('הפרויקט לא נמצא', 'error'); return; }

  AppState.currentProject = project;

  document.getElementById('project-detail-title').textContent = project.name;
  document.getElementById('project-info-bar').innerHTML = `
    <div class="info-item"><div class="info-label">קוד</div><div class="info-value">${escHtml(project.code)}</div></div>
    <div class="info-item"><div class="info-label">תאריך קבלה</div><div class="info-value">${formatDate(project.date_received)}</div></div>
    ${project.location ? `<div class="info-item"><div class="info-label">מיקום</div><div class="info-value">${escHtml(project.location)}</div></div>` : ''}
    ${project.pipe_type ? `<div class="info-item"><div class="info-label">סוג צנרת</div><div class="info-value">${escHtml(project.pipe_type)}</div></div>` : ''}
  `;

  showView('project-detail');
  activateTab('pods');

  // Run all tab loads in parallel; catch errors per-tab so one failure
  // doesn't prevent other tabs from rendering.
  try {
    await Promise.all([
      loadPodsTab(projectId).catch(e => console.error('[openProject] pods tab error:', e)),
      loadGroupsTab(projectId).catch(e => console.error('[openProject] groups tab error:', e)),
      loadProjectDetailsTab(project).catch(e => console.error('[openProject] details tab error:', e)),
      loadPlansTab(projectId).catch(e => console.error('[openProject] plans tab error:', e)),
      setupPodFilters(projectId).catch(e => console.error('[openProject] filters error:', e)),
    ]);
  } catch (e) {
    console.error('[openProject] unexpected error:', e);
  }
}

// ---- PODS TAB ----
async function loadPodsTab(projectId, filters = {}) {
  let query = supabaseClient
    .from('pods')
    .select(`
      *,
      project_types(type_number, dimensions),
      type_directions(direction),
      production_groups(name),
      qc_stages(stage_number, status),
      comments(id, is_resolved)
    `)
    .eq('project_id', projectId)
    .order('pod_code', { ascending: true });

  if (filters.group_id) query = query.eq('group_id', filters.group_id);
  if (filters.status) query = query.eq('status', filters.status);

  const { data: pods } = await query;

  const allPods = pods || [];
  let filtered = allPods;
  if (filters.type_number) filtered = filtered.filter(p => p.project_types?.type_number == filters.type_number);
  if (filters.direction) filtered = filtered.filter(p => p.type_directions?.direction === filters.direction);

  // Update stats strip (always based on full list, not filtered)
  const statsEl = document.getElementById('project-pods-stats');
  if (statsEl) {
    const total    = allPods.length;
    const pending  = allPods.filter(p => p.status === 'pending').length;
    const inProg   = allPods.filter(p => p.status === 'in_progress').length;
    const done     = allPods.filter(p => p.status === 'completed').length;
    const failed   = allPods.filter(p => p.status === 'failed').length;
    statsEl.innerHTML = `
      <div class="pods-stat-card pods-stat-total">
        <div class="pods-stat-value">${total}</div>
        <div class="pods-stat-label">סה"כ פודים</div>
      </div>
      <div class="pods-stat-card pods-stat-pending">
        <div class="pods-stat-value">${pending}</div>
        <div class="pods-stat-label">ממתינים</div>
      </div>
      <div class="pods-stat-card pods-stat-inprogress">
        <div class="pods-stat-value">${inProg}</div>
        <div class="pods-stat-label">בתהליך</div>
      </div>
      <div class="pods-stat-card pods-stat-completed">
        <div class="pods-stat-value">${done}</div>
        <div class="pods-stat-label">הושלמו</div>
      </div>
      <div class="pods-stat-card pods-stat-failed">
        <div class="pods-stat-value">${failed}</div>
        <div class="pods-stat-label">נכשלו</div>
      </div>
      <div class="page-progress-bar" style="flex-basis:100%">
        <div class="page-progress-header">
          <span class="page-progress-label">התקדמות פרויקט</span>
          <span class="page-progress-pct ${total>0&&done===total?'pct-done':''}">${total>0?Math.round(done/total*100):0}%</span>
        </div>
        <div class="progress-bar-outer progress-bar-lg">
          <div class="progress-bar-inner ${total>0&&done===total?'full':''}" style="width:${total>0?Math.round(done/total*100):0}%"></div>
        </div>
      </div>
    `;
  }

  const container = document.getElementById('pods-table-container');

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">אין פודים. לחץ "+ הוסף פוד" להוספה</div></div>';
    return;
  }

  container.innerHTML = `<div class="pods-grid">${filtered.map(pod => renderPodCard(pod)).join('')}</div>`;

  container.querySelectorAll('.btn-open-pod').forEach(btn => {
    btn.addEventListener('click', () => openPod(btn.dataset.podId));
  });
  container.querySelectorAll('.btn-pod-barcode-tbl').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showBarcodeModal(btn.dataset.podCode); });
  });
  if (isAdminOrPM()) {
    container.querySelectorAll('.btn-delete-pod').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); deletePod(btn.dataset.podId); });
    });
  }
}

function renderPodCard(pod) {
  const stages = pod.qc_stages || [];
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const pct = Math.round(completedStages / 6 * 100);
  const statusCls = `status-${pod.status}`;
  const dirLabel = pod.type_directions?.direction === 'R' ? 'ימין' : pod.type_directions?.direction === 'L' ? 'שמאל' : (pod.type_directions?.direction || '');
  const unresolvedCount = (pod.comments || []).filter(c => !c.is_resolved).length;

  return `
    <div class="pod-card pod-card-clickable btn-open-pod" data-pod-id="${pod.id}">
      <div class="pod-card-header">
        <div class="pod-card-code">${escHtml(pod.pod_code)}</div>
        ${unresolvedCount > 0 ? `<span class="unresolved-badge" title="${unresolvedCount} הערות לא טופלו">⚠️ ${unresolvedCount}</span>` : ''}
        <span class="status-badge ${statusCls}">${STATUS_LABELS[pod.status] || pod.status}</span>
      </div>
      <div class="pod-card-meta">
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">טיפוס</span>
          <span class="pod-card-meta-value">T${pod.project_types?.type_number || '—'}</span>
        </div>
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">כיוון</span>
          <span class="pod-card-meta-value">${dirLabel || '—'}</span>
        </div>
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">קבוצה</span>
          <span class="pod-card-meta-value">${pod.production_groups?.name ? escHtml(pod.production_groups.name) : '—'}</span>
        </div>
      </div>
      <div class="card-progress-section">
        <div class="card-progress-header">
          <span class="card-progress-label">${completedStages}/6 שלבים</span>
          <span class="card-progress-pct ${pct===100?'pct-done':''}">${pct}%</span>
        </div>
        <div class="progress-bar-outer progress-bar-lg">
          <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="pod-card-actions">
        <button class="btn btn-secondary btn-sm btn-pod-barcode-tbl" data-pod-code="${escHtml(pod.pod_code)}">🔲 ברקוד</button>
        ${isAdminOrPM() ? `<button class="btn btn-danger btn-sm btn-delete-pod" data-pod-id="${pod.id}">🗑</button>` : ''}
      </div>
    </div>
  `;
}

// ---- GROUPS TAB ----
async function loadGroupsTab(projectId) {
  const { data: groups } = await supabaseClient
    .from('production_groups')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  const container = document.getElementById('groups-list');

  if (!groups || groups.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🗓</div><div class="empty-state-text">אין קבוצות ביצוע עדיין</div></div>';
    return;
  }

  container.innerHTML = groups.map((g, i) => `
    <div class="group-card">
      <div class="group-color-dot" style="background:${GROUP_COLORS[i % GROUP_COLORS.length]}"></div>
      <div>
        <div class="group-name">${escHtml(g.name)}</div>
        ${g.target_date ? `<div class="group-date">יעד: ${formatDate(g.target_date)}</div>` : ''}
      </div>
      <div class="group-actions" style="margin-right:auto">
        ${isAdminOrPM() ? `
          <button class="btn btn-secondary btn-sm btn-edit-group" data-group-id="${g.id}" data-name="${escHtml(g.name)}" data-date="${g.target_date || ''}">עריכה</button>
          <button class="btn btn-danger btn-sm btn-delete-group" data-group-id="${g.id}">🗑</button>
        ` : ''}
      </div>
    </div>
  `).join('');

  if (isAdminOrPM()) {
    container.querySelectorAll('.btn-edit-group').forEach(btn => {
      btn.addEventListener('click', () => showGroupModal(projectId, btn.dataset.groupId, btn.dataset.name, btn.dataset.date));
    });
    container.querySelectorAll('.btn-delete-group').forEach(btn => {
      btn.addEventListener('click', () => deleteGroup(btn.dataset.groupId, projectId));
    });
  }
}

// ---- PROJECT DETAILS TAB ----
async function loadProjectDetailsTab(project) {
  const container = document.getElementById('project-details-form');

  const { data: types } = await supabaseClient
    .from('project_types')
    .select('id, type_number, dimensions')
    .eq('project_id', project.id)
    .order('type_number');

  function parseDims(str) {
    const parts = (str || '').split(/[xX×]/);
    return { l: (parts[0] || '').trim(), w: (parts[1] || '').trim(), h: (parts[2] || '').trim() };
  }

  const typesSection = isAdminOrPM() && types?.length ? `
    <div class="card" style="margin-top:16px">
      <div class="card-body">
        <div style="font-weight:600;margin-bottom:12px;font-size:15px">מידות לפי טיפוס</div>
        ${types.map(t => {
          const d = parseDims(t.dimensions);
          return `
          <div class="det-type-row" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
            <div class="type-badge" style="flex-shrink:0">T${t.type_number}</div>
            <div class="form-group" style="margin:0;flex:1;min-width:80px">
              <label style="font-size:11px">אורך</label>
              <input type="text" class="form-control det-dim-l" data-type-id="${t.id}" value="${escHtml(d.l)}" placeholder="אורך" />
            </div>
            <div class="form-group" style="margin:0;flex:1;min-width:80px">
              <label style="font-size:11px">רוחב</label>
              <input type="text" class="form-control det-dim-w" data-type-id="${t.id}" value="${escHtml(d.w)}" placeholder="רוחב" />
            </div>
            <div class="form-group" style="margin:0;flex:1;min-width:80px">
              <label style="font-size:11px">גובה</label>
              <input type="text" class="form-control det-dim-h" data-type-id="${t.id}" value="${escHtml(d.h)}" placeholder="גובה" />
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  ` : (!isAdminOrPM() && types?.length ? `
    <div class="card" style="margin-top:16px">
      <div class="card-body">
        <div style="font-weight:600;margin-bottom:12px;font-size:15px">מידות לפי טיפוס</div>
        ${types.map(t => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
            <div class="type-badge" style="flex-shrink:0">T${t.type_number}</div>
            <span class="text-muted" style="font-size:13px">${escHtml(t.dimensions || '—')}</span>
          </div>`).join('')}
      </div>
    </div>
  ` : '');

  container.innerHTML = `
    <div class="card">
      <div class="card-body">
        ${isAdminOrPM() ? `
          <div class="form-row">
            <div class="form-group">
              <label>שם פרויקט מלא</label>
              <input type="text" id="det-name" class="form-control" value="${escHtml(project.name)}" />
            </div>
            <div class="form-group">
              <label>קוד פרויקט (3 אותיות)</label>
              <input type="text" id="det-code" class="form-control" value="${escHtml(project.code)}" maxlength="3" style="text-transform:uppercase" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>מיקום</label>
              <input type="text" id="det-location" class="form-control" value="${escHtml(project.location || '')}" />
            </div>
            <div class="form-group">
              <label>סוג צנרת</label>
              <select id="det-pipe" class="form-control">
                <option value="">בחר...</option>
                <option value="HDPE" ${project.pipe_type === 'HDPE' ? 'selected' : ''}>HDPE</option>
                <option value="PVC" ${project.pipe_type === 'PVC' ? 'selected' : ''}>PVC</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>קישור OneDrive לתיקיית הפרויקט</label>
            <input type="url" id="det-onedrive" class="form-control" value="${escHtml(project.onedrive_folder_url || '')}" placeholder="https://onedrive.live.com/..." />
            <div class="form-hint">הדבק כאן את הקישור לתיקיית OneDrive של הפרויקט לשמירת PDF</div>
          </div>
        ` : `
          <div class="form-row">
            <div class="info-item"><div class="info-label">שם</div><div class="info-value">${escHtml(project.name)}</div></div>
            <div class="info-item"><div class="info-label">קוד</div><div class="info-value">${escHtml(project.code)}</div></div>
          </div>
          <div class="form-row mt-4">
            <div class="info-item"><div class="info-label">מיקום</div><div class="info-value">${escHtml(project.location || '—')}</div></div>
            <div class="info-item"><div class="info-label">סוג צנרת</div><div class="info-value">${escHtml(project.pipe_type || '—')}</div></div>
          </div>
        `}
      </div>
    </div>
    ${typesSection}
    ${isAdminOrPM() ? `<button class="btn btn-primary" id="btn-save-project-details" style="margin-top:8px">שמור שינויים</button>` : ''}
  `;

  if (isAdminOrPM()) {
    document.getElementById('btn-save-project-details')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save-project-details');
      setLoading(btn, true);

      const projectUpdate = supabaseClient.from('projects').update({
        name: document.getElementById('det-name').value.trim(),
        code: document.getElementById('det-code').value.trim().toUpperCase(),
        location: document.getElementById('det-location').value.trim(),
        pipe_type: document.getElementById('det-pipe').value || null,
        onedrive_folder_url: document.getElementById('det-onedrive').value.trim() || null,
      }).eq('id', project.id);

      const typeUpdates = (types || []).map(t => {
        const l = container.querySelector(`.det-dim-l[data-type-id="${t.id}"]`)?.value.trim() || '';
        const w = container.querySelector(`.det-dim-w[data-type-id="${t.id}"]`)?.value.trim() || '';
        const h = container.querySelector(`.det-dim-h[data-type-id="${t.id}"]`)?.value.trim() || '';
        const dims = [l, w, h].filter(Boolean).join('x') || null;
        return supabaseClient.from('project_types').update({ dimensions: dims }).eq('id', t.id);
      });

      const results = await Promise.all([projectUpdate, ...typeUpdates]);
      setLoading(btn, false);

      const firstError = results.find(r => r.error);
      if (firstError) { showToast('שגיאה בשמירה', 'error'); return; }

      showToast('הפרטים עודכנו', 'success');
      AppState.currentProject = { ...AppState.currentProject,
        name: document.getElementById('det-name').value.trim(),
        code: document.getElementById('det-code').value.trim().toUpperCase(),
      };
      document.getElementById('project-detail-title').textContent = AppState.currentProject.name;
    });
  }
}

// ---- PLANS TAB ----
async function loadPlansTab(projectId) {
  const [{ data: types }, { data: plans }] = await Promise.all([
    supabaseClient.from('project_types').select('id, type_number, dimensions').eq('project_id', projectId).order('type_number'),
    supabaseClient.from('type_plans').select('*, uploader:profiles!uploaded_by(full_name, username)').eq('project_id', projectId).order('uploaded_at'),
  ]);

  const container = document.getElementById('plans-list');

  if (!types || types.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📐</div><div class="empty-state-text">אין טיפוסים בפרויקט זה</div></div>';
    return;
  }

  const canEdit = isAdminOrPM();
  const plansByType = {};
  (plans || []).forEach(p => {
    if (!plansByType[p.type_id]) plansByType[p.type_id] = [];
    plansByType[p.type_id].push(p);
  });

  container.innerHTML = `
    <div class="types-list">
      ${types.map(t => {
        const typePlans = plansByType[t.id] || [];
        return `
        <div class="type-item" data-type-id="${t.id}">
          <div class="type-item-header">
            <div class="type-badge">T${t.type_number}</div>
            <span class="text-muted">מידות: ${escHtml(t.dimensions || '—')}</span>
            ${canEdit ? `<label class="btn btn-primary btn-sm plan-upload-label" style="margin-right:auto">📤 הוסף PDF<input type="file" accept="application/pdf" class="plan-file-input" data-type-id="${t.id}" style="display:none"></label>` : ''}
          </div>
          ${typePlans.length > 0 ? `
            <div class="plans-files-list">
              ${typePlans.map(p => `
                <div class="plan-file-row">
                  <a href="${escHtml(p.file_url)}" target="_blank" class="plan-file-link">📄 ${escHtml(p.file_name)}</a>
                  <span class="plan-file-meta">${escHtml(p.uploader?.full_name || p.uploader?.username || '')} · ${formatDate(p.uploaded_at)}</span>
                  ${canEdit ? `<button class="btn btn-ghost btn-sm btn-delete-plan" data-plan-id="${p.id}" data-storage-path="${escHtml(p.storage_path)}">🗑️</button>` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-muted text-sm" style="margin-top:4px">אין תוכניות מועלות</div>'}
        </div>`;
      }).join('')}
    </div>
  `;

  container.querySelectorAll('.plan-file-input').forEach(input => {
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) uploadPlan(e.target.dataset.typeId, file, projectId);
      e.target.value = '';
    });
  });

  container.querySelectorAll('.btn-delete-plan').forEach(btn => {
    btn.addEventListener('click', () => deletePlan(btn.dataset.planId, btn.dataset.storagePath, projectId));
  });
}

async function uploadPlan(typeId, file, projectId) {
  if (file.type !== 'application/pdf') { showToast('יש להעלות קובץ PDF בלבד', 'error'); return; }
  if (file.size > 20 * 1024 * 1024) { showToast('גודל הקובץ המקסימלי הוא 20MB', 'error'); return; }

  showToast('מעלה קובץ...', 'info');
  const storagePath = `${projectId}/${typeId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await supabaseClient.storage.from('plans').upload(storagePath, file);
  if (upErr) {
    console.error('Storage upload error:', upErr);
    showToast('שגיאה בהעלאה: ' + upErr.message, 'error');
    return;
  }

  const { data: { publicUrl } } = supabaseClient.storage.from('plans').getPublicUrl(storagePath);

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error: dbErr } = await supabaseClient.from('type_plans').insert({
    type_id: typeId,
    project_id: projectId,
    file_name: file.name,
    file_url: publicUrl,
    storage_path: storagePath,
    uploaded_by: user?.id,
  });

  if (dbErr) {
    console.error('DB insert error:', dbErr);
    showToast('שגיאה בשמירה: ' + dbErr.message, 'error');
    await supabaseClient.storage.from('plans').remove([storagePath]);
    return;
  }

  showToast('התוכנית הועלתה בהצלחה', 'success');
  await loadPlansTab(projectId);
}

async function deletePlan(planId, storagePath, projectId) {
  if (!confirm('האם למחוק תוכנית זו?')) return;

  const { error: dbErr } = await supabaseClient.from('type_plans').delete().eq('id', planId);
  if (dbErr) { showToast('שגיאה במחיקה: ' + dbErr.message, 'error'); return; }

  if (storagePath) await supabaseClient.storage.from('plans').remove([storagePath]);

  showToast('התוכנית נמחקה', 'success');
  await loadPlansTab(projectId);
}

// ---- SETUP FILTERS ----
async function setupPodFilters(projectId) {
  // Run both queries in parallel
  const [{ data: groups }, { data: types }] = await Promise.all([
    supabaseClient.from('production_groups').select('id, name').eq('project_id', projectId),
    supabaseClient.from('project_types').select('id, type_number').eq('project_id', projectId).order('type_number'),
  ]);

  const groupSel = document.getElementById('filter-group');
  const typeSel = document.getElementById('filter-type');
  const dirSel = document.getElementById('filter-direction');
  const statusSel = document.getElementById('filter-status');

  groupSel.innerHTML = '<option value="">כל הקבוצות</option>' + (groups || []).map(g =>
    `<option value="${g.id}">${escHtml(g.name)}</option>`).join('');

  typeSel.innerHTML = '<option value="">כל הטיפוסים</option>' + (types || []).map(t =>
    `<option value="${t.type_number}">T${t.type_number}</option>`).join('');

  dirSel.innerHTML = `
    <option value="">כל הכיוונים</option>
    <option value="R">ימין (R)</option>
    <option value="L">שמאל (L)</option>
  `;

  const applyFilters = () => {
    loadPodsTab(projectId, {
      group_id: groupSel.value,
      type_number: typeSel.value,
      direction: dirSel.value,
      status: statusSel.value,
    });
  };

  groupSel.onchange = applyFilters;
  typeSel.onchange = applyFilters;
  dirSel.onchange = applyFilters;
  statusSel.onchange = applyFilters;
}

// ---- NEW PROJECT MODAL ----
function showNewProjectModal() {
  openModal('פרויקט חדש', buildNewProjectForm(), [
    { label: 'ביטול', cls: 'btn-ghost', id: 'btn-modal-cancel' },
    { label: 'צור פרויקט', cls: 'btn-primary', id: 'btn-modal-create-project' },
  ]);

  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-modal-create-project')?.addEventListener('click', createProject);

  // Dynamic types
  document.getElementById('np-type-count')?.addEventListener('change', renderTypeInputs);
  renderTypeInputs();
}

function buildNewProjectForm() {
  return `
    <form id="form-new-project">
      <div class="form-row">
        <div class="form-group">
          <label>שם פרויקט מלא <span class="required">*</span></label>
          <input type="text" id="np-name" class="form-control" placeholder="שם הפרויקט" required />
        </div>
        <div class="form-group">
          <label>קוד פרויקט (3 אותיות) <span class="required">*</span></label>
          <input type="text" id="np-code" class="form-control" placeholder="SVC" maxlength="3" style="text-transform:uppercase" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>תאריך קבלת פרויקט <span class="required">*</span></label>
          <input type="date" id="np-date" class="form-control" required />
        </div>
        <div class="form-group">
          <label>סוג צנרת</label>
          <select id="np-pipe" class="form-control">
            <option value="">בחר...</option>
            <option value="HDPE">HDPE</option>
            <option value="PVC">PVC</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>מיקום</label>
          <input type="text" id="np-location" class="form-control" placeholder="עיר / כתובת" />
        </div>
        <div class="form-group">
          <label>מספר טיפוסים</label>
          <input type="number" id="np-type-count" class="form-control" value="1" min="1" max="99" />
        </div>
      </div>
      <div id="np-types-container"></div>
    </form>
  `;
}

function renderTypeInputs() {
  const count = parseInt(document.getElementById('np-type-count')?.value || 1);
  const container = document.getElementById('np-types-container');
  if (!container) return;
  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `
      <div style="border:1.5px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;background:#f8fafc">
        <div style="font-weight:600;margin-bottom:10px;color:var(--primary)">טיפוס T${i}</div>
        <div class="form-row">
          <div class="form-group">
            <label>אורך</label>
            <input type="text" id="np-type${i}-dim-l" class="form-control" placeholder="אורך" />
          </div>
          <div class="form-group">
            <label>רוחב</label>
            <input type="text" id="np-type${i}-dim-w" class="form-control" placeholder="רוחב" />
          </div>
          <div class="form-group">
            <label>גובה</label>
            <input type="text" id="np-type${i}-dim-h" class="form-control" placeholder="גובה" />
          </div>
        </div>
        <div class="form-group">
          <label>כיוונים ומספר פודים</label>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="np-type${i}-R" checked />
              <label for="np-type${i}-R">ימין (R)</label>
              <input type="number" id="np-type${i}-R-count" class="form-control" style="width:80px" value="1" min="1" />
              <span class="text-sm text-muted">פודים</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="np-type${i}-L" checked />
              <label for="np-type${i}-L">שמאל (L)</label>
              <input type="number" id="np-type${i}-L-count" class="form-control" style="width:80px" value="1" min="1" />
              <span class="text-sm text-muted">פודים</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

async function createProject() {
  const btn = document.getElementById('btn-modal-create-project');
  const name = document.getElementById('np-name')?.value.trim();
  const code = document.getElementById('np-code')?.value.trim().toUpperCase();
  const dateReceived = document.getElementById('np-date')?.value;
  const pipeType = document.getElementById('np-pipe')?.value;
  const location = document.getElementById('np-location')?.value.trim();
  const typeCount = parseInt(document.getElementById('np-type-count')?.value || 1);

  if (!name || !code || !dateReceived) {
    showToast('יש למלא שם, קוד ותאריך', 'error'); return;
  }
  if (code.length !== 3) {
    showToast('הקוד חייב להיות 3 אותיות בדיוק', 'error'); return;
  }
  if (!AppState.currentProfile) {
    // Try to reload profile once before giving up
    if (AppState.currentUser) {
      const reloaded = await loadCurrentProfile(AppState.currentUser.id);
      if (reloaded) AppState.currentProfile = reloaded;
    }
    if (!AppState.currentProfile) {
      showToast('שגיאה: פרופיל לא נטען. רענן את הדף (F5) ונסה שוב.', 'error'); return;
    }
  }

  const setBtnStep = (text) => { if (btn) { btn.innerHTML = `⏳ ${text}`; btn.disabled = true; } };
  const resetBtn = () => { if (btn) { btn.innerHTML = 'צור פרויקט'; btn.disabled = false; } };

  setBtnStep('יוצר פרויקט...');
  try {
    // Step 1: Insert project
    console.log('[createProject] Step 1: inserting project');
    console.log('[createProject] currentProfile:', AppState.currentProfile);
    console.log('[createProject] payload:', { name, code, date_received: dateReceived, pipe_type: pipeType || null, location: location || null, created_by: AppState.currentProfile?.id });
    // Step 1a: Insert project with timeout resilience.
    // In bolt.new, the service worker can drop the response channel even if the DB succeeded.
    console.log('[createProject] Step 1a: inserting project');
    const insertPayload = { name, code, date_received: dateReceived, pipe_type: pipeType || null, location: location || null, created_by: AppState.currentProfile.id };

    let insertConfirmed = false;
    try {
      const result = await Promise.race([
        supabaseClient.from('projects').insert(insertPayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('__timeout__')), 12000)),
      ]);
      const { error: insertErr } = result || {};
      if (insertErr) throw new Error('שלב 1 – insert: ' + insertErr.message);
      insertConfirmed = true;
      console.log('[createProject] Step 1a: insert confirmed');
    } catch (e) {
      if (e.message !== '__timeout__') throw e;
      console.warn('[createProject] Step 1a: insert timed out — checking DB...');
    }

    // Step 1b: Fetch the newly created project (works even after timeout)
    console.log('[createProject] Step 1b: fetching project by code');
    const { data: project, error: projErr } = await supabaseClient
      .from('projects')
      .select()
      .eq('code', code)
      .eq('created_by', AppState.currentProfile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    console.log('[createProject] Step 1b result:', { project, projErr, insertConfirmed });

    if (projErr && !insertConfirmed) throw new Error('שגיאה ביצירת פרויקט: ' + projErr.message);
    if (!project) throw new Error('הפרויקט לא נמצא לאחר יצירה — נסה שוב');
    console.log('[createProject] Step 1 OK, project id:', project.id);

    // Step 2: Insert types and directions, create pods
    for (let i = 1; i <= typeCount; i++) {
      setBtnStep(`שומר טיפוס ${i}/${typeCount}...`);
      const dimL = document.getElementById(`np-type${i}-dim-l`)?.value.trim() || '';
      const dimW = document.getElementById(`np-type${i}-dim-w`)?.value.trim() || '';
      const dimH = document.getElementById(`np-type${i}-dim-h`)?.value.trim() || '';
      const dims = [dimL, dimW, dimH].filter(Boolean).join('x') || null;
      console.log(`[createProject] Step 2: inserting type ${i}`);
      const { data: typeData, error: typeErr } = await supabaseClient
        .from('project_types')
        .insert({ project_id: project.id, type_number: i, dimensions: dims || null })
        .select().single();
      if (typeErr) throw new Error(`שלב 2 – טיפוס ${i}: ` + typeErr.message);
      console.log(`[createProject] Type ${i} OK`);

      for (const dir of ['R', 'L']) {
        const cb = document.getElementById(`np-type${i}-${dir}`);
        if (!cb?.checked) continue;
        const podCount = parseInt(document.getElementById(`np-type${i}-${dir}-count`)?.value || 1);

        setBtnStep(`שומר כיוון ${dir}...`);
        console.log(`[createProject] Step 3: inserting direction ${dir} for type ${i}`);
        const { data: dirData, error: dirErr } = await supabaseClient
          .from('type_directions')
          .insert({ type_id: typeData.id, direction: dir, pod_count: podCount })
          .select().single();
        if (dirErr) throw new Error(`שלב 3 – כיוון ${dir}: ` + dirErr.message);
        console.log(`[createProject] Direction ${dir} OK`);

        setBtnStep(`יוצר פודים...`);
        const podsToInsert = [];
        for (let s = 1; s <= podCount; s++) {
          podsToInsert.push({
            project_id: project.id,
            type_id: typeData.id,
            direction_id: dirData.id,
            serial_number: s,
            pod_code: generatePodCode(code, dateReceived, i, dir, s),
            status: 'pending',
          });
        }
        if (podsToInsert.length > 0) {
          console.log(`[createProject] Step 4: inserting ${podsToInsert.length} pods`);
          const { error: podsErr } = await supabaseClient.from('pods').insert(podsToInsert);
          if (podsErr) throw new Error('שלב 4 – פודים: ' + podsErr.message);
          console.log('[createProject] Pods OK');
        }
      }
    }

    showToast('הפרויקט נוצר בהצלחה!', 'success');
    closeModal();
    await loadProjects();
    openProject(project.id);
  } catch (err) {
    console.error('[createProject] Error:', err);
    showToast('שגיאה: ' + (err.message || err), 'error');
  } finally {
    resetBtn();
  }
}

// ---- GROUP MODAL ----
function showGroupModal(projectId, groupId = null, name = '', date = '') {
  openModal(groupId ? 'עריכת קבוצה' : 'קבוצת ביצוע חדשה', `
    <div class="form-group">
      <label>שם הקבוצה</label>
      <input type="text" id="grp-name" class="form-control" value="${escHtml(name)}" placeholder="קבוצה ראשונה" />
    </div>
    <div class="form-group">
      <label>תאריך יעד</label>
      <input type="date" id="grp-date" class="form-control" value="${date}" />
    </div>
  `, [
    { label: 'ביטול', cls: 'btn-ghost', id: 'btn-grp-cancel' },
    { label: 'שמור', cls: 'btn-primary', id: 'btn-grp-save' },
  ]);

  document.getElementById('btn-grp-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-grp-save')?.addEventListener('click', async () => {
    const nm = document.getElementById('grp-name')?.value.trim();
    const dt = document.getElementById('grp-date')?.value;
    if (!nm) { showToast('יש להזין שם', 'error'); return; }
    const btn = document.getElementById('btn-grp-save');
    setLoading(btn, true);
    try {
      if (groupId) {
        await supabaseClient.from('production_groups').update({ name: nm, target_date: dt || null }).eq('id', groupId);
      } else {
        const { data: groups } = await supabaseClient.from('production_groups').select('id').eq('project_id', projectId);
        await supabaseClient.from('production_groups').insert({ project_id: projectId, name: nm, target_date: dt || null, sort_order: (groups || []).length });
      }
      showToast('נשמר בהצלחה', 'success');
      closeModal();
      await loadGroupsTab(projectId);
      await setupPodFilters(projectId);
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function deleteGroup(groupId, projectId) {
  if (!confirm('האם למחוק קבוצה זו?')) return;
  await supabaseClient.from('production_groups').delete().eq('id', groupId);
  showToast('הקבוצה נמחקה', 'success');
  await loadGroupsTab(projectId);
  await setupPodFilters(projectId);
}

// ---- ADD POD MODAL ----
async function showAddPodModal(projectId) {
  const { data: types } = await supabaseClient
    .from('project_types')
    .select('*, type_directions(*)')
    .eq('project_id', projectId)
    .order('type_number');

  const { data: groups } = await supabaseClient
    .from('production_groups')
    .select('*')
    .eq('project_id', projectId);

  const project = AppState.currentProject;

  openModal('הוסף פוד', `
    <div class="form-group">
      <label>טיפוס</label>
      <select id="add-pod-type" class="form-control">
        ${(types || []).map(t => `<option value="${t.id}" data-type-num="${t.type_number}">${'T' + t.type_number} (${t.dimensions || ''})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>כיוון</label>
      <select id="add-pod-dir" class="form-control">
        <option value="">בחר כיוון</option>
      </select>
    </div>
    <div class="form-group">
      <label>מספר סידורי</label>
      <input type="number" id="add-pod-serial" class="form-control" min="1" value="1" />
    </div>
    <div class="form-group">
      <label>קבוצה</label>
      <select id="add-pod-group" class="form-control">
        <option value="">ללא קבוצה</option>
        ${(groups || []).map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join('')}
      </select>
    </div>
    <div id="add-pod-preview" class="form-group">
      <label>קוד פוד שייווצר</label>
      <div id="pod-code-preview" style="font-family:monospace;font-size:16px;font-weight:700;padding:8px;background:#f8fafc;border-radius:8px;border:1.5px solid var(--border)"></div>
    </div>
  `, [
    { label: 'ביטול', cls: 'btn-ghost', id: 'btn-add-pod-cancel' },
    { label: 'צור פוד', cls: 'btn-primary', id: 'btn-add-pod-confirm' },
  ]);

  // Populate directions on type change
  const updateDirs = () => {
    const typeEl = document.getElementById('add-pod-type');
    const selectedTypeId = typeEl?.value;
    const selectedType = (types || []).find(t => t.id === selectedTypeId);
    const dirSel = document.getElementById('add-pod-dir');
    dirSel.innerHTML = '<option value="">בחר כיוון</option>' +
      (selectedType?.type_directions || []).map(d =>
        `<option value="${d.id}" data-dir="${d.direction}">${d.direction === 'R' ? 'ימין (R)' : 'שמאל (L)'}</option>`
      ).join('');
    updatePreview();
  };

  const updatePreview = () => {
    const typeEl = document.getElementById('add-pod-type');
    const dirEl = document.getElementById('add-pod-dir');
    const serialEl = document.getElementById('add-pod-serial');
    const previewEl = document.getElementById('pod-code-preview');
    const selectedOpt = dirEl?.options[dirEl.selectedIndex];
    const dir = selectedOpt?.dataset?.dir || '';
    const typeNum = typeEl?.options[typeEl.selectedIndex]?.dataset?.typeNum || '';
    const serial = parseInt(serialEl?.value || 1);
    if (project && typeNum && dir) {
      previewEl.textContent = generatePodCode(project.code, project.date_received, typeNum, dir, serial);
    } else {
      previewEl.textContent = '—';
    }
  };

  updateDirs();
  document.getElementById('add-pod-type')?.addEventListener('change', updateDirs);
  document.getElementById('add-pod-dir')?.addEventListener('change', updatePreview);
  document.getElementById('add-pod-serial')?.addEventListener('input', updatePreview);

  document.getElementById('btn-add-pod-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-add-pod-confirm')?.addEventListener('click', async () => {
    const typeEl = document.getElementById('add-pod-type');
    const dirEl = document.getElementById('add-pod-dir');
    const serialEl = document.getElementById('add-pod-serial');
    const groupEl = document.getElementById('add-pod-group');
    const selectedDirOpt = dirEl?.options[dirEl.selectedIndex];
    const dir = selectedDirOpt?.dataset?.dir;
    const dirId = dirEl?.value;
    const typeId = typeEl?.value;
    const typeNum = typeEl?.options[typeEl.selectedIndex]?.dataset?.typeNum;
    const serial = parseInt(serialEl?.value || 1);
    const groupId = groupEl?.value || null;

    if (!typeId || !dirId || !dir) { showToast('יש לבחור טיפוס וכיוון', 'error'); return; }

    const podCode = generatePodCode(project.code, project.date_received, typeNum, dir, serial);
    const btn = document.getElementById('btn-add-pod-confirm');
    setLoading(btn, true);
    try {
      const { error } = await supabaseClient.from('pods').insert({
        project_id: projectId, type_id: typeId, direction_id: dirId,
        serial_number: serial, pod_code: podCode, group_id: groupId || null,
        status: 'pending',
      });
      if (error) throw error;
      showToast('הפוד נוצר בהצלחה', 'success');
      closeModal();
      await loadPodsTab(projectId);
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function deletePod(podId) {
  if (!confirm('האם למחוק פוד זה? הפעולה אינה הפיכה')) return;
  const { error } = await supabaseClient.from('pods').delete().eq('id', podId);
  if (error) { showToast('שגיאה במחיקה', 'error'); return; }
  showToast('הפוד נמחק', 'success');
  if (AppState.currentProject) await loadPodsTab(AppState.currentProject.id);
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function printAllBarcodes() {
  const cards = document.querySelectorAll('#pods-table-container .btn-pod-barcode-tbl');
  if (cards.length === 0) { showToast('אין פודים להדפסה לפי הסינון הנוכחי', 'error'); return; }

  const codes = Array.from(cards).map(btn => btn.dataset.podCode).filter(Boolean);
  console.log('[printAllBarcodes] codes:', codes);
  if (codes.length === 0) { showToast('לא נמצאו קודי ברקוד', 'error'); return; }

  // Render SVGs into live DOM using a hidden scratch div
  const scratch = document.createElement('div');
  scratch.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;';
  document.body.appendChild(scratch);

  const barcodeItems = codes.map(code => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    scratch.appendChild(svg);
    try {
      JsBarcode(svg, code, { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 6 });
    } catch (e) { console.error('JsBarcode error', code, e); }
    const html = svg.outerHTML;
    console.log('[printAllBarcodes] svg outerHTML length for', code, ':', html.length);
    return `<div class="barcode-item">${html}<div class="bc-label">${escHtml(code)}</div></div>`;
  }).join('');

  document.body.removeChild(scratch);

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:monospace;background:#fff;padding:16px}
    .toolbar{display:flex;align-items:center;gap:16px;padding:12px;border-bottom:1px solid #ccc;margin-bottom:16px}
    .toolbar h2{font-size:16px;flex:1;text-align:center}
    .btn-print{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:14px;cursor:pointer;white-space:nowrap}
    .btn-print:hover{background:#1d4ed8}
    .grid{display:flex;flex-wrap:wrap;gap:12px}
    .barcode-item{display:flex;flex-direction:column;align-items:center;border:1px solid #ddd;border-radius:6px;padding:8px 12px;break-inside:avoid}
    .bc-label{font-size:13px;font-weight:bold;margin-top:4px;letter-spacing:1px}
    @media print{.toolbar{display:none}.grid{gap:8px}body{padding:8px}}
  `;
  const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>ברקודים</title><style>${css}</style></head><body>
    <div class="toolbar">
      <h2>ברקודים — ${escHtml(AppState.currentProject?.name || '')} (${codes.length} פודים)</h2>
      <button class="btn-print" onclick="window.print()">🖨️ הדפס</button>
    </div>
    <div class="grid">${barcodeItems}</div>
    </body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWin = window.open(url, '_blank');
  if (!printWin) { showToast('חסום חלונות קופצים — אפשר חלונות קופצים בדפדפן', 'error'); return; }
  printWin.addEventListener('load', () => {
    printWin.print();
    URL.revokeObjectURL(url);
  });
}
