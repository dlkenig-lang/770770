// =============================================
// Projects Module
// =============================================

// In-memory cache so openProject never needs a second round-trip to the DB.
// Populated whenever loadDashboard / loadProjects runs.
const ProjectCache = new Map();

// ---- LOAD DASHBOARD ----
async function loadDashboard() {
  const statsEl = document.getElementById('dashboard-stats');
  const projList = document.getElementById('dashboard-projects-list');

  // Show loading state immediately
  statsEl.innerHTML = '<div class="loading-inline">טוען נתונים...</div>';
  projList.innerHTML = '<div class="loading-inline">טוען פרויקטים...</div>';

  const TIMEOUT = 8000;
  let projects, dashErr;
  try {
    const result = await Promise.race([
      supabaseClient.from('projects').select('*, pods(id, status)').eq('is_active', true).order('created_at', { ascending: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT)),
    ]);
    projects = result.data;
    dashErr  = result.error;
  } catch (e) {
    dashErr = e;
  }

  if (dashErr) {
    const msg = dashErr.message === 'timeout' ? 'הטעינה לקחה יותר מדי זמן.' : 'שגיאה בטעינת פרויקטים.';
    statsEl.innerHTML = '';
    projList.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-text">${msg}</div>
      <button class="btn btn-primary btn-sm" onclick="loadDashboard()" style="margin-top:12px">נסה שוב</button>
    </div>`;
    return;
  }

  const totalProjects  = (projects || []).length;
  const totalPods      = (projects || []).reduce((a, p) => a + (p.pods?.length || 0), 0);
  const completedPods  = (projects || []).reduce((a, p) => a + (p.pods?.filter(pod => pod.status === 'completed').length || 0), 0);
  const failedPods     = (projects || []).reduce((a, p) => a + (p.pods?.filter(pod => pod.status === 'failed').length || 0), 0);

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
  const list       = document.getElementById('projects-list');
  const archList   = document.getElementById('archived-projects-list');
  list.innerHTML   = '<div class="loading-inline">טוען פרויקטים...</div>';

  // Fetch active + archived in parallel
  let active = [], archived = [], error;
  try {
    const [activeRes, archRes] = await Promise.race([
      Promise.all([
        supabaseClient.from('projects').select('*, pods(id, status)').eq('is_active', true).order('created_at', { ascending: false }),
        supabaseClient.from('projects').select('*, pods(id, status)').eq('is_active', false).order('created_at', { ascending: false }),
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    if (activeRes.error) throw activeRes.error;
    active   = activeRes.data  || [];
    archived = archRes.data    || [];
  } catch (e) { error = e; }

  if (error) {
    const msg = error.message === 'timeout' ? 'הטעינה לקחה יותר מדי זמן.' : 'שגיאה בטעינת פרויקטים.';
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${msg}</div><button class="btn btn-primary btn-sm" onclick="loadProjects()" style="margin-top:12px">נסה שוב</button></div>`;
    return;
  }

  // Active projects
  if (active.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">אין פרויקטים עדיין. לחץ "+ פרויקט חדש" להוספה</div></div>';
  } else {
    active.forEach(p => ProjectCache.set(p.id, p));
    list.innerHTML = active.map(p => renderProjectCard(p)).join('');
    list.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => openProject(card.dataset.projectId));
    });
  }

  // Archived projects
  if (archList) {
    if (archived.length === 0) {
      archList.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-state-text">אין פרויקטים בארכיון</div></div>';
    } else {
      archived.forEach(p => ProjectCache.set(p.id, p));
      archList.innerHTML = archived.map(p => renderArchivedCard(p)).join('');
      archList.querySelectorAll('.btn-restore-project').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); restoreProject(btn.dataset.projectId); });
      });
      archList.querySelectorAll('.btn-delete-archived').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteArchivedProject(btn.dataset.projectId, btn.dataset.projectName); });
      });
    }
    // Toggle button
    const toggleBtn = document.getElementById('btn-toggle-archive');
    if (toggleBtn) {
      toggleBtn.querySelector('span:last-child').textContent = archived.length ? `▸ (${archived.length})` : '▸';
      toggleBtn.onclick = () => {
        const open = archList.classList.toggle('hidden');
        toggleBtn.querySelector('span:last-child').textContent = open ? `▸ (${archived.length})` : `▾ (${archived.length})`;
      };
    }
  }
}

function renderArchivedCard(p) {
  return `
    <div class="project-card archived-card" data-project-id="${p.id}">
      <div class="project-card-header">
        <span class="project-code-badge">${escHtml(p.code || '')}</span>
        <span class="archive-badge">📦 ארכיון</span>
      </div>
      <div class="project-card-name">${escHtml(p.name)}</div>
      <div class="project-card-meta">
        ${p.location ? `📍 ${escHtml(p.location)}` : ''}
      </div>
      <div class="archived-card-actions">
        <button class="btn btn-secondary btn-sm btn-restore-project" data-project-id="${p.id}">♻️ שחזר לפעיל</button>
        <button class="btn btn-danger btn-sm btn-delete-archived" data-project-id="${p.id}" data-project-name="${escHtml(p.name)}">🗑️ מחק לצמיתות</button>
      </div>
    </div>`;
}

async function deleteArchivedProject(projectId, projectName) {
  openModal('מחיקה לצמיתות', `
    <p style="color:#dc2626;font-weight:600;margin-bottom:8px">⚠️ פעולה זו אינה הפיכה!</p>
    <p style="margin-bottom:16px;font-size:14px">כדי לאשר מחיקה לצמיתות, הקלד את שם הפרויקט:</p>
    <p style="font-weight:700;margin-bottom:10px;padding:8px;background:var(--bg);border-radius:6px;text-align:center">${escHtml(projectName)}</p>
    <input id="delete-arch-input" class="form-control" placeholder="הקלד שם הפרויקט לאימות" autocomplete="off" />
  `, []);
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-ghost" id="btn-arch-delete-cancel">ביטול</button>
    <button class="btn btn-danger" id="btn-arch-delete-confirm" disabled>מחק לצמיתות</button>
  `;
  const input = document.getElementById('delete-arch-input');
  const confirmBtn = document.getElementById('btn-arch-delete-confirm');
  document.getElementById('btn-arch-delete-cancel').addEventListener('click', closeModal);
  input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== projectName; });
  confirmBtn.addEventListener('click', async () => {
    if (input.value.trim() !== projectName) return;
    confirmBtn.disabled = true; confirmBtn.textContent = 'מוחק...';
    const { error } = await supabaseClient.from('projects').delete().eq('id', projectId);
    if (error) { showToast('שגיאה במחיקה: ' + error.message, 'error'); confirmBtn.disabled = false; confirmBtn.textContent = 'מחק לצמיתות'; return; }
    ProjectCache.delete(projectId);
    closeModal();
    showToast('הפרויקט נמחק לצמיתות', 'success');
    await loadProjects();
  });
}

async function restoreProject(projectId) {
  const { error } = await supabaseClient.from('projects').update({ is_active: true }).eq('id', projectId);
  if (error) { showToast('שגיאה בשחזור הפרויקט', 'error'); return; }
  showToast('הפרויקט שוחזר לרשימה הפעילה', 'success');
  await loadProjects();
}

function renderProjectCard(p) {
  const pods = p.pods || [];
  const completed = pods.filter(pod => pod.status === 'completed').length;
  const inProgress = pods.filter(pod => pod.status === 'in_progress').length;
  // Count in_progress pods as 50% contribution so the bar reflects ongoing work
  const effectivePct = pods.length > 0
    ? Math.round((completed + inProgress * 0.5) / pods.length * 100)
    : 0;
  const pct = effectivePct;
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
  if (filters.casting_approved === 'true') query = query.eq('casting_approved', true);
  if (filters.casting_approved === 'false') query = query.eq('casting_approved', false);

  const [{ data: pods }, { data: projectGroups }] = await Promise.all([
    query,
    supabaseClient.from('production_groups').select('id, name').eq('project_id', projectId),
  ]);
  const allGroups = sortGroupsByOption(projectGroups || []);

  const getSerial = code => parseInt((code || '').slice(-3)) || 0;
  const allPods = (pods || []).sort((a, b) => getSerial(a.pod_code) - getSerial(b.pod_code));
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
      ${(() => {
        const totalStages = total * 6;
        const doneStages = allPods.reduce((sum, p) => sum + (p.qc_stages || []).filter(s => s.status === 'completed').length, 0);
        const stagePct = totalStages > 0 ? Math.round(doneStages / totalStages * 100) : 0;
        return `
      <div class="page-progress-bar" style="flex-basis:100%">
        <div class="page-progress-header">
          <span class="page-progress-label">התקדמות פרויקט — ${doneStages}/${totalStages} שלבים</span>
          <span class="page-progress-pct ${stagePct===100?'pct-done':''}">${stagePct}%</span>
        </div>
        <div class="progress-bar-outer progress-bar-lg">
          <div class="progress-bar-inner ${stagePct===100?'full':''}" style="width:${stagePct}%"></div>
        </div>
      </div>`;
      })()}
    `;
  }

  const container = document.getElementById('pods-table-container');

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">אין פודים בפרויקט זה</div></div>';
    return;
  }

  container.innerHTML = `<div class="pods-grid">${filtered.map(pod => renderPodCard(pod, allGroups)).join('')}</div>`;

  container.querySelectorAll('.btn-open-pod').forEach(btn => {
    btn.addEventListener('click', () => openPod(btn.dataset.podId));
  });
  container.querySelectorAll('.btn-pod-barcode-tbl').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showBarcodeModal(btn.dataset.podCode, btn.dataset.groupLabel || ''); });
  });
  if (isAdminOrPM()) {
    container.querySelectorAll('.btn-delete-pod').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); deletePod(btn.dataset.podId); });
    });
    container.querySelectorAll('.pod-card-group-select').forEach(sel => {
      sel.addEventListener('click', (e) => e.stopPropagation());
      sel.addEventListener('change', async (e) => {
        e.stopPropagation();
        const groupId = e.target.value || null;
        const podId = e.target.dataset.podId;
        // Update dot color
        const dot = container.querySelector(`.pod-group-color-dot[data-pod-id="${podId}"]`);
        if (dot) {
          const color = e.target.selectedOptions[0]?.dataset.color || '';
          dot.style.background = color || 'transparent';
          dot.style.border = color ? 'none' : '1px solid var(--border)';
        }
        let groupSerial = null;
        if (groupId) {
          const { data: grpData } = await supabaseClient.from('production_groups').select('max_pods').eq('id', groupId).single();
          const { data: grpPods } = await supabaseClient.from('pods').select('group_serial').eq('group_id', groupId);
          const currentCount = (grpPods || []).length;
          if (grpData?.max_pods && currentCount >= grpData.max_pods) {
            showToast(`הקבוצה מלאה — קיבולת מקסימלית: ${grpData.max_pods} פודים`, 'error');
            e.target.value = e.target.dataset.prevValue || '';
            return;
          }
          const usedSerials = new Set((grpPods || []).map(p => p.group_serial).filter(Boolean));
          let nextSerial = 1;
          while (usedSerials.has(nextSerial)) nextSerial++;
          groupSerial = nextSerial;
        }
        e.target.dataset.prevValue = groupId || '';
        const { error } = await supabaseClient.from('pods').update({ group_id: groupId, group_serial: groupSerial }).eq('id', podId);
        if (error) { showToast('שגיאה בשמירת קבוצה', 'error'); return; }
        // Update group label badge and barcode button on the card
        const card = e.target.closest('.pod-card');
        const idx = allGroups.findIndex(g => g.id === groupId);
        const newLabel = idx >= 0 && groupSerial ? String.fromCharCode(65 + idx) + groupSerial : '';
        const labelEl = card?.querySelector('.pod-card-group-label');
        if (labelEl) {
          labelEl.textContent = newLabel;
          labelEl.style.fontWeight = newLabel ? '700' : '';
        }
        const barcodeBtn = card?.querySelector('.btn-pod-barcode-tbl');
        if (barcodeBtn) barcodeBtn.dataset.groupLabel = newLabel;
        showToast('הקבוצה עודכנה', 'success');
      });
    });
  }
}

function renderPodCard(pod, groups = []) {
  const stages = pod.qc_stages || [];
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const pct = Math.round(completedStages / 6 * 100);
  const statusCls = `status-${pod.status}`;
  const dirLabel = pod.type_directions?.direction === 'R' ? 'ימין' : pod.type_directions?.direction === 'L' ? 'שמאל' : (pod.type_directions?.direction || '');
  const unresolvedCount = (pod.comments || []).filter(c => !c.is_resolved).length;
  const flaggedCount = (pod.comments || []).filter(c => !c.is_resolved && c.is_flagged).length;
  const groupIdx = groups.findIndex(g => g.id === pod.group_id);
  const groupLabel = groupIdx >= 0 && pod.group_serial ? String.fromCharCode(65 + groupIdx) + pod.group_serial : '';

  return `
    <div class="pod-card pod-card-clickable btn-open-pod ${flaggedCount > 0 ? 'pod-card-has-flagged' : unresolvedCount > 0 ? 'pod-card-has-comments' : ''} ${pod.casting_approved ? 'pod-card-casting-approved' : ''}" data-pod-id="${pod.id}">
      <div class="pod-card-header">
        <div class="pod-card-code">${escHtml(pod.pod_code)}</div>
        ${pod.casting_approved ? `<span class="casting-approved-badge" title="מאושר ליציקה">🏗️ מאושר ליציקה</span>` : ''}
        ${flaggedCount > 0
          ? `<span class="unresolved-badge badge-flagged" title="${flaggedCount} הערות מסומנות לטיפול">🚩 ${flaggedCount}</span>`
          : unresolvedCount > 0
          ? `<span class="unresolved-badge" title="${unresolvedCount} הערות לא טופלו">💬 ${unresolvedCount}</span>`
          : ''}
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
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
            ${isAdminOrPM() && groups.length ? (() => {
              const selIdx = groups.findIndex(g => g.id === pod.group_id);
              const dotColor = selIdx >= 0 ? GROUP_COLORS[selIdx % GROUP_COLORS.length] : 'transparent';
              return `<div style="display:flex;align-items:center;gap:4px">
                <span class="pod-group-color-dot" data-pod-id="${pod.id}" style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${dotColor};${selIdx < 0 ? 'border:1px solid var(--border)' : ''}"></span>
                <select class="pod-card-group-select" data-pod-id="${pod.id}" style="font-size:12px;border:1px solid var(--border);border-radius:4px;padding:1px 4px;background:var(--bg);color:var(--text);cursor:pointer;max-width:110px" ${pod.group_id ? 'disabled title="לא ניתן להעביר פוד קיים בין קבוצות"' : ''}>
                  <option value="" data-color="">ללא קבוצה</option>
                  ${groups.map((g, i) => `<option value="${g.id}" data-color="${GROUP_COLORS[i % GROUP_COLORS.length]}" ${pod.group_id === g.id ? 'selected' : ''}>${escHtml(g.name)}</option>`).join('')}
                </select>
              </div>`;
            })() : `<span class="pod-card-meta-value">${pod.production_groups?.name ? escHtml(pod.production_groups.name) : '—'}</span>`}
            ${groupLabel ? `<span class="pod-card-group-label" style="font-weight:700;font-size:13px;color:var(--primary);letter-spacing:0.5px">${escHtml(groupLabel)}</span>` : '<span class="pod-card-group-label"></span>'}
          </div>
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
        <button class="btn btn-secondary btn-sm btn-pod-barcode-tbl" data-pod-code="${escHtml(pod.pod_code)}" data-group-label="${escHtml(groupLabel)}">🔲 ברקוד</button>
        ${isAdminOrPM() ? `<button class="btn btn-danger btn-sm btn-delete-pod" data-pod-id="${pod.id}">🗑</button>` : ''}
      </div>
    </div>
  `;
}

// ---- GROUPS TAB ----
async function loadGroupsTab(projectId) {
  const { data: rawGroups } = await supabaseClient
    .from('production_groups')
    .select('*')
    .eq('project_id', projectId);
  const groups = sortGroupsByOption(rawGroups || []);

  const container = document.getElementById('groups-list');

  if (!groups || groups.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🗓</div><div class="empty-state-text">אין קבוצות ביצוע עדיין</div></div>';
    return;
  }

  container.innerHTML = groups.map((g, i) => {
    const letter = String.fromCharCode(65 + i);
    return `
    <div class="group-card">
      <div class="group-color-dot" style="background:${GROUP_COLORS[i % GROUP_COLORS.length]}"></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px;font-weight:900;color:${GROUP_COLORS[i % GROUP_COLORS.length]};min-width:20px">${letter}</span>
        <div>
          <div class="group-name">${escHtml(g.name)}</div>
          <div style="display:flex;gap:12px">
            ${g.max_pods ? `<div class="group-date">קיבולת: ${g.max_pods} פודים</div>` : ''}
            ${g.target_date ? `<div class="group-date">יעד: ${formatDate(g.target_date)}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="group-actions" style="margin-right:auto">
        ${isAdminOrPM() ? `
          <button class="btn btn-secondary btn-sm btn-edit-group" data-group-id="${g.id}" data-name="${escHtml(g.name)}" data-date="${g.target_date || ''}" data-max-pods="${g.max_pods || ''}">עריכה</button>
          <button class="btn btn-danger btn-sm btn-delete-group" data-group-id="${g.id}">🗑</button>
        ` : ''}
      </div>
    </div>
  `;}).join('');

  if (isAdminOrPM()) {
    container.querySelectorAll('.btn-edit-group').forEach(btn => {
      btn.addEventListener('click', () => showGroupModal(projectId, btn.dataset.groupId, btn.dataset.name, btn.dataset.date, btn.dataset.maxPods ? parseInt(btn.dataset.maxPods) : null));
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

      const oldCode = project.code?.toUpperCase() || '';
      const newCode = document.getElementById('det-code').value.trim().toUpperCase();
      const codeChanged = oldCode && newCode && oldCode !== newCode;

      const projectUpdate = supabaseClient.from('projects').update({
        name: document.getElementById('det-name').value.trim(),
        code: newCode,
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

      const firstError = results.find(r => r.error);
      if (firstError) { setLoading(btn, false); showToast('שגיאה בשמירה', 'error'); return; }

      // If project code changed, rename all pod_codes via a single server-side RPC
      if (codeChanged) {
        const { error: rpcErr } = await supabaseClient.rpc('rename_project_code_in_pods', {
          p_project_id: project.id,
          p_old_code: oldCode,
          p_new_code: newCode,
        });
        if (rpcErr) {
          console.error('[save] rename_project_code_in_pods error:', rpcErr);
          setLoading(btn, false);
          showToast('שגיאה בעדכון קודי פודים: ' + rpcErr.message, 'error');
          return;
        }
      }

      setLoading(btn, false);
      const newName = document.getElementById('det-name').value.trim();
      showToast(codeChanged ? `הפרטים עודכנו, קוד הפודים עודכן ל-${newCode}` : 'הפרטים עודכנו', 'success');
      AppState.currentProject = { ...AppState.currentProject, name: newName, code: newCode };
      project.code = newCode;
      document.getElementById('project-detail-title').textContent = newName;
      // Refresh info bar with new code
      document.getElementById('project-info-bar').querySelector('.info-value').textContent = newCode;
      // Refresh pods tab so updated pod_codes are visible
      if (codeChanged) loadPodsTab(project.id).catch(e => console.error('[save] reload pods error:', e));
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
  const [{ data: rawFilterGroups }, { data: types }] = await Promise.all([
    supabaseClient.from('production_groups').select('id, name').eq('project_id', projectId),
    supabaseClient.from('project_types').select('id, type_number').eq('project_id', projectId).order('type_number'),
  ]);
  const groups = sortGroupsByOption(rawFilterGroups || []);

  const groupSel = document.getElementById('filter-group');
  const typeSel = document.getElementById('filter-type');
  const dirSel = document.getElementById('filter-direction');
  const statusSel = document.getElementById('filter-status');
  const castingSel = document.getElementById('filter-casting');

  groupSel.innerHTML = '<option value="">כל הקבוצות</option>' + groups.map(g =>
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
      casting_approved: castingSel?.value || '',
    });
  };

  groupSel.onchange = applyFilters;
  typeSel.onchange = applyFilters;
  dirSel.onchange = applyFilters;
  statusSel.onchange = applyFilters;
  if (castingSel) castingSel.onchange = applyFilters;
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
    let globalSerial = 0;
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
          globalSerial++;
          podsToInsert.push({
            project_id: project.id,
            type_id: typeData.id,
            direction_id: dirData.id,
            serial_number: s,
            pod_code: generatePodCode(code, dateReceived, i, dir, globalSerial),
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
const GROUP_NAME_OPTIONS = [
  'קבוצה ראשונה', 'קבוצה שניה', 'קבוצה שלישית', 'קבוצה רביעית',
  'קבוצה חמישית', 'קבוצה שישית', 'קבוצה שביעית', 'קבוצה שמינית',
  'קבוצה תשיעית', 'קבוצה עשירית',
];

function sortGroupsByOption(groups) {
  return [...groups].sort((a, b) => {
    const ai = GROUP_NAME_OPTIONS.indexOf(a.name);
    const bi = GROUP_NAME_OPTIONS.indexOf(b.name);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    // Numeric fallback: extract leading number from name (e.g. "G1" → 1, "G10" → 10)
    const na = parseInt((a.name || '').replace(/\D/g, '')) || 0;
    const nb = parseInt((b.name || '').replace(/\D/g, '')) || 0;
    return na !== nb ? na - nb : a.name.localeCompare(b.name, 'he');
  });
}

async function showGroupModal(projectId, groupId = null, name = '', date = '', maxPods = null) {
  let usedNames = [];
  if (!groupId) {
    const { data: existing } = await supabaseClient
      .from('production_groups').select('name').eq('project_id', projectId);
    usedNames = (existing || []).map(g => g.name);
  }

  openModal(groupId ? 'עריכת קבוצה' : 'קבוצת ביצוע חדשה', `
    <div class="form-group">
      <label>שם הקבוצה</label>
      <select id="grp-name" class="form-control">
        <option value="">-- בחר קבוצה --</option>
        ${GROUP_NAME_OPTIONS.filter(opt => !usedNames.includes(opt) || opt === name).map(opt =>
          `<option value="${opt}"${opt === name ? ' selected' : ''}>${opt}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>מספר פודים בקבוצה</label>
      <input type="number" id="grp-max-pods" class="form-control" min="1" placeholder="ללא הגבלה" value="${maxPods || ''}" />
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
    const mp = parseInt(document.getElementById('grp-max-pods')?.value) || null;
    if (!nm) { showToast('יש להזין שם', 'error'); return; }
    const btn = document.getElementById('btn-grp-save');
    setLoading(btn, true);
    try {
      let saveError;
      if (groupId) {
        ({ error: saveError } = await supabaseClient.from('production_groups').update({ name: nm, target_date: dt || null, max_pods: mp }).eq('id', groupId));
      } else {
        const { data: groups } = await supabaseClient.from('production_groups').select('id').eq('project_id', projectId);
        ({ error: saveError } = await supabaseClient.from('production_groups').insert({ project_id: projectId, name: nm, target_date: dt || null, max_pods: mp, sort_order: (groups || []).length }));
      }
      if (saveError) { showToast('שגיאה: ' + saveError.message, 'error'); return; }
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

// ---- ARCHIVE / DELETE PROJECT ----
function promptArchiveOrDelete() {
  const project = AppState.currentProject;
  if (!project) return;

  openModal('פעולות על הפרויקט', `
    <div class="archive-delete-options">
      <div class="archive-option">
        <div class="archive-option-icon">📦</div>
        <div class="archive-option-body">
          <div class="archive-option-title">העבר לארכיון</div>
          <div class="archive-option-desc">הפרויקט יוסתר מהרשימה הפעילה אך ישמר במערכת. ניתן לשחזר בעתיד.</div>
        </div>
        <button class="btn btn-secondary" id="btn-confirm-archive">ארכיון</button>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
      <div class="archive-option">
        <div class="archive-option-icon">🗑️</div>
        <div class="archive-option-body">
          <div class="archive-option-title" style="color:#dc2626">מחיקה לצמיתות</div>
          <div class="archive-option-desc">מחיקה בלתי הפיכה של הפרויקט וכל הנתונים הקשורים אליו.</div>
        </div>
        <button class="btn btn-danger" id="btn-go-delete">מחיקה</button>
      </div>
    </div>
  `, []);

  document.getElementById('btn-confirm-archive').addEventListener('click', async () => {
    const btn = document.getElementById('btn-confirm-archive');
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supabaseClient.from('projects').update({ is_active: false }).eq('id', project.id);
    if (error) { showToast('שגיאה בהעברה לארכיון: ' + error.message, 'error'); btn.disabled = false; btn.textContent = 'ארכיון'; return; }
    ProjectCache.delete(project.id);
    closeModal();
    showToast('הפרויקט הועבר לארכיון', 'success');
    showView('projects');
    await loadProjects();
  });

  document.getElementById('btn-go-delete').addEventListener('click', () => {
    // Step 2 — require typing the project name
    document.getElementById('modal-body').innerHTML = `
      <p style="color:#dc2626;font-weight:600;margin-bottom:8px">⚠️ פעולה זו אינה הפיכה!</p>
      <p style="margin-bottom:16px;font-size:14px">כדי לאשר מחיקה לצמיתות, הקלד את שם הפרויקט:</p>
      <p style="font-weight:700;margin-bottom:10px;padding:8px;background:var(--bg);border-radius:6px;text-align:center">${escHtml(project.name)}</p>
      <input id="delete-confirm-input" class="form-control" placeholder="הקלד שם הפרויקט לאימות" autocomplete="off" />
      <p id="delete-confirm-error" class="error-message hidden" style="margin-top:8px">השם אינו תואם</p>
    `;
    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-ghost" id="btn-delete-back">חזרה</button>
      <button class="btn btn-danger" id="btn-confirm-delete" disabled>מחק לצמיתות</button>
    `;

    const input = document.getElementById('delete-confirm-input');
    const confirmBtn = document.getElementById('btn-confirm-delete');

    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim() !== project.name;
    });

    document.getElementById('btn-delete-back').addEventListener('click', () => promptArchiveOrDelete());

    confirmBtn.addEventListener('click', async () => {
      if (input.value.trim() !== project.name) return;
      confirmBtn.disabled = true; confirmBtn.textContent = 'מוחק...';
      const { error } = await supabaseClient.from('projects').delete().eq('id', project.id);
      if (error) {
        showToast('שגיאה במחיקה: ' + error.message, 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = 'מחק לצמיתות';
        return;
      }
      ProjectCache.delete(project.id);
      closeModal();
      showToast('הפרויקט נמחק לצמיתות', 'success');
      showView('projects');
      await loadProjects();
    });
  });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function printAllBarcodes() {
  const cards = document.querySelectorAll('#pods-table-container .btn-pod-barcode-tbl');
  if (cards.length === 0) { showToast('אין פודים להדפסה לפי הסינון הנוכחי', 'error'); return; }

  const items = Array.from(cards).map(btn => ({ code: btn.dataset.podCode, groupLabel: btn.dataset.groupLabel || '' })).filter(i => i.code);
  console.log('[printAllBarcodes] items:', items);
  if (items.length === 0) { showToast('לא נמצאו קודי ברקוד', 'error'); return; }

  // Render SVGs into live DOM using a hidden scratch div
  const scratch = document.createElement('div');
  scratch.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;';
  document.body.appendChild(scratch);

  const barcodeItems = items.map(({ code, groupLabel }) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    scratch.appendChild(svg);
    try {
      JsBarcode(svg, code, { format: 'CODE128', width: 3, height: 110, displayValue: false, margin: 0 });
    } catch (e) { console.error('JsBarcode error', code, e); }
    const svgHtml = svg.outerHTML;
    const groupMarkerHtml = groupLabel
      ? `<div class="group-marker">${escHtml(groupLabel)}</div>`
      : '';
    return `<div class="barcode-item"><div class="content"><div class="barcode-section"><div class="bw">${svgHtml}</div><div class="bc-label">${escHtml(code)}</div></div>${groupMarkerHtml}</div></div>`;
  }).join('');

  document.body.removeChild(scratch);

  // Brother QL-700: 62mm tape, 150mm label — portrait (62×150), barcode rotated 90°
  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:62mm 150mm;margin:0}
    html,body{background:#fff;font-family:monospace}
    .toolbar{display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:2px solid #e2e8f0;background:#f8fafc}
    .toolbar h2{font-size:15px;flex:1;text-align:center;color:#1e293b}
    .btn-print{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:14px;cursor:pointer}
    .btn-print:hover{background:#1d4ed8}
    .barcode-item{width:62mm;height:150mm;overflow:hidden;position:relative;
      page-break-after:always;break-after:page}
    .barcode-item:last-child{page-break-after:auto;break-after:auto}
    .content{
      position:absolute;top:50%;left:50%;
      width:142mm;height:56mm;
      transform:translate(-50%,-50%) rotate(-90deg);
      display:flex;flex-direction:row;align-items:stretch;
    }
    .barcode-section{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3mm}
    .bw{width:100%}
    .bw svg{width:100%;height:auto;max-height:28mm}
    .bc-label{font-size:11pt;font-weight:bold;letter-spacing:1.5px;text-align:center;white-space:nowrap}
    .group-marker{display:flex;align-items:center;justify-content:center;padding:4mm;font-size:80pt;font-weight:900;line-height:1;flex-shrink:0}
    @media print{.toolbar{display:none}}
  `;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>ברקודים</title><style>${css}</style></head><body>
    <div class="toolbar">
      <h2>ברקודים — ${escHtml(AppState.currentProject?.name || '')} &nbsp;|&nbsp; ${items.length} מדבקות &nbsp;|&nbsp; Brother QL-700 · 62×150mm</h2>
      <button class="btn-print" onclick="window.print()">🖨️ הדפס</button>
    </div>
    ${barcodeItems}
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
