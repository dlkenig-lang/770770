// =============================================
// Projects Module
// =============================================

// ---- LOAD DASHBOARD ----
async function loadDashboard() {
  const { data: projects } = await supabaseClient
    .from('projects')
    .select('*, pods(id, status)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  const statsEl = document.getElementById('dashboard-stats');
  const projList = document.getElementById('dashboard-projects-list');

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

  if (!projects || projects.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">אין פרויקטים עדיין. לחץ "+ פרויקט חדש" להוספה</div></div>';
    return;
  }

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
        <div class="project-stat" style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <div class="progress-bar-outer" style="width:100%;flex:1">
              <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
            </div>
            <span style="font-size:12px;font-weight:600;color:var(--text-muted)">${pct}%</span>
          </div>
          <div class="project-stat-label">התקדמות</div>
        </div>
      </div>
    </div>
  `;
}

// ---- OPEN PROJECT ----
async function openProject(projectId) {
  AppState.currentProject = null;

  const { data: project, error } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error || !project) { showToast('שגיאה בטעינת פרויקט', 'error'); return; }

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

  // Run all tab loads in parallel instead of sequentially
  await Promise.all([
    loadPodsTab(projectId),
    loadGroupsTab(projectId),
    loadProjectDetailsTab(project),
    loadPlansTab(projectId),
    setupPodFilters(projectId),
  ]);
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
      qc_stages(stage_number, status)
    `)
    .eq('project_id', projectId)
    .order('pod_code', { ascending: true });

  if (filters.group_id) query = query.eq('group_id', filters.group_id);
  if (filters.status) query = query.eq('status', filters.status);

  const { data: pods } = await query;

  let filtered = pods || [];
  if (filters.type_number) filtered = filtered.filter(p => p.project_types?.type_number == filters.type_number);
  if (filters.direction) filtered = filtered.filter(p => p.type_directions?.direction === filters.direction);

  const container = document.getElementById('pods-table-container');

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">אין פודים. לחץ "+ הוסף פוד" להוספה</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>קוד פוד</th>
            <th>טיפוס</th>
            <th>כיוון</th>
            <th>קבוצה</th>
            <th>סטטוס</th>
            <th>התקדמות</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(pod => renderPodRow(pod)).join('')}
        </tbody>
      </table>
    </div>
  `;

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

function renderPodRow(pod) {
  const stages = pod.qc_stages || [];
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const failedStages = stages.filter(s => s.status === 'failed').length;
  const pct = Math.round(completedStages / 6 * 100);
  const statusCls = `status-${pod.status}`;

  return `
    <tr>
      <td><strong style="font-family:monospace">${escHtml(pod.pod_code)}</strong></td>
      <td>T${pod.project_types?.type_number || ''}</td>
      <td>${pod.type_directions?.direction || ''}</td>
      <td>${pod.production_groups?.name ? escHtml(pod.production_groups.name) : '<span class="text-muted">—</span>'}</td>
      <td><span class="status-badge ${statusCls}">${STATUS_LABELS[pod.status] || pod.status}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-bar-outer">
            <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
          </div>
          <span class="text-sm text-muted">${completedStages}/6</span>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-primary btn-sm btn-open-pod" data-pod-id="${pod.id}">פתח</button>
          <button class="btn btn-secondary btn-sm btn-pod-barcode-tbl" data-pod-code="${escHtml(pod.pod_code)}">🔲</button>
          ${isAdminOrPM() ? `<button class="btn btn-danger btn-sm btn-delete-pod" data-pod-id="${pod.id}">🗑</button>` : ''}
        </div>
      </td>
    </tr>
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
          <button class="btn btn-primary" id="btn-save-project-details">שמור שינויים</button>
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
  `;

  if (isAdminOrPM()) {
    document.getElementById('btn-save-project-details')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-save-project-details');
      setLoading(btn, true);
      const { error } = await supabaseClient.from('projects').update({
        name: document.getElementById('det-name').value.trim(),
        code: document.getElementById('det-code').value.trim().toUpperCase(),
        location: document.getElementById('det-location').value.trim(),
        pipe_type: document.getElementById('det-pipe').value || null,
        onedrive_folder_url: document.getElementById('det-onedrive').value.trim() || null,
      }).eq('id', project.id);
      setLoading(btn, false);
      if (error) { showToast('שגיאה בשמירה', 'error'); return; }
      showToast('הפרטים עודכנו', 'success');
      // Refresh
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
  const { data: types } = await supabaseClient
    .from('project_types')
    .select('*')
    .eq('project_id', projectId)
    .order('type_number', { ascending: true });

  const container = document.getElementById('plans-list');

  if (!types || types.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📐</div><div class="empty-state-text">אין טיפוסים בפרויקט זה</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="types-list">
      ${types.map(t => `
        <div class="type-item">
          <div class="type-item-header">
            <div class="type-badge">T${t.type_number}</div>
            <span class="text-muted">מידות: ${escHtml(t.dimensions || '—')}</span>
          </div>
          ${t.architectural_plan_url ? `
            <div>
              <a href="${escHtml(t.architectural_plan_url)}" target="_blank" class="btn btn-secondary btn-sm">
                📐 פתח תוכנית אדריכלית
              </a>
              <span class="text-sm text-muted" style="margin-right:8px">${escHtml(t.architectural_plan_name || '')}</span>
            </div>
          ` : '<div class="text-muted text-sm">אין תוכנית אדריכלית מועלית</div>'}
        </div>
      `).join('')}
    </div>
  `;
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
            <label>מידות</label>
            <input type="text" id="np-type${i}-dims" class="form-control" placeholder="אורך x רוחב x גובה" />
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
    showToast('שגיאה: פרופיל משתמש לא נטען. נסה להתנתק ולהתחבר מחדש.', 'error'); return;
  }

  const setBtnStep = (text) => { if (btn) { btn.innerHTML = `⏳ ${text}`; btn.disabled = true; } };
  const resetBtn = () => { if (btn) { btn.innerHTML = 'צור פרויקט'; btn.disabled = false; } };

  setBtnStep('יוצר פרויקט...');
  try {
    // Step 1: Insert project
    console.log('[createProject] Step 1: inserting project');
    console.log('[createProject] currentProfile:', AppState.currentProfile);
    console.log('[createProject] payload:', { name, code, date_received: dateReceived, pipe_type: pipeType || null, location: location || null, created_by: AppState.currentProfile?.id });
    // Step 1a: Insert using direct REST API call (more reliable in WebContainer environments)
    console.log('[createProject] Step 1a: insert via REST');
    const payload = { name, code, date_received: dateReceived, pipe_type: pipeType || null, location: location || null, created_by: AppState.currentProfile.id };

    const session = (await supabaseClient.auth.getSession()).data.session;
    const restResp = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    console.log('[createProject] Step 1a status:', restResp.status);
    if (!restResp.ok) {
      const errBody = await restResp.text();
      throw new Error(`שלב 1 – insert: ${restResp.status} ${errBody}`);
    }

    // Step 1b: Fetch the newly created project
    console.log('[createProject] Step 1b: fetching project by code');
    const { data: project, error: projErr } = await supabaseClient
      .from('projects')
      .select()
      .eq('code', code)
      .eq('created_by', AppState.currentProfile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    console.log('[createProject] Step 1b result:', { project, projErr });

    if (projErr) throw new Error('שלב 1 – פרויקט: ' + projErr.message);
    console.log('[createProject] Step 1 OK, project id:', project.id);

    // Step 2: Insert types and directions, create pods
    for (let i = 1; i <= typeCount; i++) {
      setBtnStep(`שומר טיפוס ${i}/${typeCount}...`);
      const dims = document.getElementById(`np-type${i}-dims`)?.value.trim();
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
