// =============================================
// Projects Module
// =============================================

// In-memory cache so openProject never needs a second round-trip to the DB.
// Populated whenever loadDashboard / loadProjects runs.
const ProjectCache = new Map();

// Product type of a project row ('pod' default for legacy rows without the
// column). Panel projects hide pod-only features: groups, mold checks,
// direction (R/L), pipe type and the casting gate.
function projIsPanel(project) {
  return (project?.product_type || 'pod') === 'medical_panel';
}

// Stage filter — a pod is "in" the selected stage only when its qc_stages row
// for that stage is being worked on or already signed. A stage still `pending`
// (or with no row at all, for a pod nobody opened yet) means the pod has not
// reached it. `failed` is deliberately excluded: the request is "in progress or
// completed".
const STAGE_FILTER_STATUSES = ['in_progress', 'completed'];

// Status of a single stage on a pod row that embeds qc_stages(stage_number, status).
function podStageStatus(pod, stageNumber) {
  const num = parseInt(stageNumber);
  if (!num) return null;
  return (pod.qc_stages || []).find(s => s.stage_number === num)?.status || null;
}

// Stage letter (A, B, C...) by stage number. STAGE_LETTERS comes from qc.js,
// which loads after this file but is always evaluated before any of these
// functions runs.
function stageLetter(stageNumber) {
  const letters = (typeof STAGE_LETTERS !== 'undefined') ? STAGE_LETTERS : ['A', 'B', 'C', 'D', 'E', 'F'];
  return letters[stageNumber - 1] || stageNumber;
}

// ---- LOAD DASHBOARD ----
async function loadDashboard() {
  const statsEl = document.getElementById('dashboard-stats');
  const projList = document.getElementById('dashboard-projects-list');

  // Show loading state immediately
  statsEl.innerHTML = `<div class="loading-inline">${t('proj.loadingData')}</div>`;
  projList.innerHTML = `<div class="loading-inline">${t('proj.loadingProjects')}</div>`;

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
    const msg = dashErr.message === 'timeout' ? t('proj.loadTimeout') : t('proj.loadError');
    statsEl.innerHTML = '';
    projList.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-text">${msg}</div>
      <button class="btn btn-primary btn-sm" onclick="loadDashboard()" style="margin-top:12px">${t('proj.retry')}</button>
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
      <div class="stat-label">${t('proj.activeProjects')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalPods}</div>
      <div class="stat-label">${t('proj.totalPods')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${completedPods}</div>
      <div class="stat-label">${t('proj.completedPods')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${failedPods}</div>
      <div class="stat-label">${t('proj.failedPods')}</div>
    </div>
  `;

  if (!projects || projects.length === 0) {
    projList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">${t('proj.noProjects')}</div></div>`;
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
  list.innerHTML   = `<div class="loading-inline">${t('proj.loadingProjects')}</div>`;

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
    if (archRes.error) throw archRes.error;
    active   = activeRes.data  || [];
    archived = archRes.data    || [];
  } catch (e) { error = e; }

  if (error) {
    const msg = error.message === 'timeout' ? t('proj.loadTimeout') : t('proj.loadError');
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${msg}</div><button class="btn btn-primary btn-sm" onclick="loadProjects()" style="margin-top:12px">${t('proj.retry')}</button></div>`;
    return;
  }

  // Active projects
  if (active.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">${t('proj.noProjectsHint')}</div></div>`;
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
      archList.innerHTML = `<div class="empty-state" style="padding:16px"><div class="empty-state-text">${t('proj.noArchived')}</div></div>`;
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
        <span class="archive-badge">${t('proj.archiveBadge')}</span>
      </div>
      <div class="project-card-name">${escHtml(p.name)}</div>
      <div class="project-card-meta">
        ${p.location ? `📍 ${escHtml(p.location)}` : ''}
      </div>
      <div class="archived-card-actions">
        <button class="btn btn-secondary btn-sm btn-restore-project" data-project-id="${p.id}">${t('proj.restoreToActive')}</button>
        <button class="btn btn-danger btn-sm btn-delete-archived" data-project-id="${p.id}" data-project-name="${escHtml(p.name)}">${t('proj.deletePermanent')}</button>
      </div>
    </div>`;
}

async function deleteArchivedProject(projectId, projectName) {
  openModal(t('proj.deletePermanentTitle'), `
    <p style="color:#dc2626;font-weight:600;margin-bottom:8px">${t('proj.irreversibleWarning')}</p>
    <p style="margin-bottom:16px;font-size:14px">${t('proj.typeNameToConfirm')}</p>
    <p style="font-weight:700;margin-bottom:10px;padding:8px;background:var(--bg);border-radius:6px;text-align:center">${escHtml(projectName)}</p>
    <input id="delete-arch-input" class="form-control" placeholder="${t('proj.typeNamePlaceholder')}" autocomplete="off" />
  `, []);
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn btn-ghost" id="btn-arch-delete-cancel">${t('common.cancel')}</button>
    <button class="btn btn-danger" id="btn-arch-delete-confirm" disabled>${t('proj.deletePermanentBtn')}</button>
  `;
  const input = document.getElementById('delete-arch-input');
  const confirmBtn = document.getElementById('btn-arch-delete-confirm');
  document.getElementById('btn-arch-delete-cancel').addEventListener('click', closeModal);
  input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== projectName; });
  confirmBtn.addEventListener('click', async () => {
    if (input.value.trim() !== projectName) return;
    confirmBtn.disabled = true; confirmBtn.textContent = t('proj.deleting');
    const { error } = await supabaseClient.from('projects').delete().eq('id', projectId);
    if (error) { showToast(t('proj.deleteError') + error.message, 'error'); confirmBtn.disabled = false; confirmBtn.textContent = t('proj.deletePermanentBtn'); return; }
    ProjectCache.delete(projectId);
    closeModal();
    showToast(t('proj.projectDeletedPermanent'), 'success');
    await loadProjects();
  });
}

async function restoreProject(projectId) {
  const { error } = await supabaseClient.from('projects').update({ is_active: true }).eq('id', projectId);
  if (error) { showToast(t('proj.restoreError'), 'error'); return; }
  showToast(t('proj.projectRestored'), 'success');
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
        ${projIsPanel(p) ? ` &nbsp;🛏️ ${t('proj.productPanel')}` : ''}
      </div>
      <div class="project-card-stats">
        <div class="project-stat">
          <div class="project-stat-value">${pods.length}</div>
          <div class="project-stat-label">${projIsPanel(p) ? t('tabs.panels') : t('proj.pods')}</div>
        </div>
        <div class="project-stat">
          <div class="project-stat-value">${completed}</div>
          <div class="project-stat-label">${t('proj.completed')}</div>
        </div>
      </div>
      <div class="card-progress-section">
        <div class="card-progress-header">
          <span class="card-progress-label">${t('proj.progress')}</span>
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
      if (result.error) { showToast(t('proj.loadProjectError') + result.error.message, 'error'); return; }
      project = result.data;
    } catch (e) {
      showToast(t('proj.loadProjectRefresh'), 'error'); return;
    }
  }

  if (!project) { showToast(t('proj.projectNotFound'), 'error'); return; }

  AppState.currentProject = project;
  const isPanel = projIsPanel(project);

  document.getElementById('project-detail-title').textContent = project.name;
  document.getElementById('project-info-bar').innerHTML = `
    <div class="info-item"><div class="info-label">${t('proj.code')}</div><div class="info-value">${escHtml(project.code)}</div></div>
    <div class="info-item"><div class="info-label">${t('proj.dateReceived')}</div><div class="info-value">${formatDate(project.date_received)}</div></div>
    ${project.project_number ? `<div class="info-item"><div class="info-label">${t('proj.projectNumber')}</div><div class="info-value">${String(project.project_number).padStart(2, '0')}</div></div>` : ''}
    ${isPanel ? `<div class="info-item"><div class="info-label">${t('proj.productType')}</div><div class="info-value">${t('proj.productPanel')}</div></div>` : ''}
    ${project.location ? `<div class="info-item"><div class="info-label">${t('proj.location')}</div><div class="info-value">${escHtml(project.location)}</div></div>` : ''}
    ${project.pipe_type ? `<div class="info-item"><div class="info-label">${t('proj.pipeType')}</div><div class="info-value">${escHtml(project.pipe_type)}</div></div>` : ''}
  `;

  // Panel projects: no production groups, no mold checks, and the units tab
  // is titled "panels". The tab strip is static HTML shared by all projects,
  // so visibility is toggled per project here.
  const groupsTabBtn = document.querySelector('.tab-btn[data-tab="groups"]');
  const moldsTabBtn = document.querySelector('.tab-btn[data-tab="molds"]');
  if (groupsTabBtn) groupsTabBtn.style.display = isPanel ? 'none' : '';
  if (moldsTabBtn) moldsTabBtn.style.display = isPanel ? 'none' : '';
  const podsTabBtn = document.querySelector('.tab-btn[data-tab="pods"]');
  if (podsTabBtn) podsTabBtn.textContent = isPanel ? t('tabs.panels') : t('tabs.pods');

  showView('project-detail');
  activateTab('pods');

  // Run all tab loads in parallel; catch errors per-tab so one failure
  // doesn't prevent other tabs from rendering.
  try {
    await Promise.all([
      loadPodsTab(projectId).catch(e => console.error('[openProject] pods tab error:', e)),
      isPanel ? Promise.resolve() : loadGroupsTab(projectId).catch(e => console.error('[openProject] groups tab error:', e)),
      loadProjectDetailsTab(project).catch(e => console.error('[openProject] details tab error:', e)),
      loadPlansTab(projectId).catch(e => console.error('[openProject] plans tab error:', e)),
      isPanel ? Promise.resolve() : loadMoldsTab(projectId).catch(e => console.error('[openProject] molds tab error:', e)),
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
      project_types(*),
      type_directions(direction),
      production_groups(name),
      qc_stages(stage_number, status),
      comments(id, is_resolved)
    `)
    .eq('project_id', projectId)
    .order('pod_code', { ascending: true });

  if (filters.group_id) query = query.eq('group_id', filters.group_id);
  if (filters.status) query = query.eq('status', filters.status);

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
  if (filters.stage) filtered = filtered.filter(p => STAGE_FILTER_STATUSES.includes(podStageStatus(p, filters.stage)));
  // Casting is filtered here, not in the query: a pod whose `casting_approved`
  // is still true but that has moved past the casting gate is no longer waiting
  // to be cast, and the list must agree with the badge on its card.
  if (filters.casting_approved === 'true') filtered = filtered.filter(p => podAwaitingCasting(p));
  if (filters.casting_approved === 'false') filtered = filtered.filter(p => !podAwaitingCasting(p));

  const isPanel = projIsPanel(AppState.currentProject);
  const stageCount = qcStageSet(isPanel ? 'medical_panel' : 'pod').length;

  // Stats strip + progress bar describe exactly what the filters left on screen,
  // so every filter counts the same way. Group / status / casting are applied by
  // the query above and type / direction / stage right here — reading `filtered`
  // (never `allPods`) is what keeps the six of them consistent.
  const statsEl = document.getElementById('project-pods-stats');
  if (statsEl) {
    const total    = filtered.length;
    const pending  = filtered.filter(p => p.status === 'pending').length;
    const inProg   = filtered.filter(p => p.status === 'in_progress').length;
    const done     = filtered.filter(p => p.status === 'completed').length;
    const failed   = filtered.filter(p => p.status === 'failed').length;
    statsEl.innerHTML = `
      <div class="pods-stat-card pods-stat-total">
        <div class="pods-stat-value">${total}</div>
        <div class="pods-stat-label">${isPanel ? t('proj.totalPanels') : t('proj.totalPods')}</div>
      </div>
      <div class="pods-stat-card pods-stat-pending">
        <div class="pods-stat-value">${pending}</div>
        <div class="pods-stat-label">${t('proj.pending')}</div>
      </div>
      <div class="pods-stat-card pods-stat-inprogress">
        <div class="pods-stat-value">${inProg}</div>
        <div class="pods-stat-label">${t('proj.inProgress')}</div>
      </div>
      <div class="pods-stat-card pods-stat-completed">
        <div class="pods-stat-value">${done}</div>
        <div class="pods-stat-label">${t('proj.completed')}</div>
      </div>
      <div class="pods-stat-card pods-stat-failed">
        <div class="pods-stat-value">${failed}</div>
        <div class="pods-stat-label">${t('proj.failed')}</div>
      </div>
      ${(() => {
        const totalStages = total * stageCount;
        const doneStages = filtered.reduce((sum, p) => sum + (p.qc_stages || []).filter(s => s.status === 'completed').length, 0);
        const stagePct = totalStages > 0 ? Math.round(doneStages / totalStages * 100) : 0;
        return `
      <div class="page-progress-bar" style="flex-basis:100%">
        <div class="page-progress-header">
          <span class="page-progress-label">${t('proj.projectProgress', { done: doneStages, total: totalStages })}</span>
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
    const emptyMsg = filters.stage
      ? (isPanel ? t('proj.noPanelsInStage') : t('proj.noPodsInStage'))
      : (isPanel ? t('proj.noPanelsInProject') : t('proj.noPodsInProject'));
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">${emptyMsg}</div></div>`;
    return;
  }

  container.innerHTML = `<div class="pods-grid">${filtered.map(pod => renderPodCard(pod, allGroups, isPanel, stageCount, filters.stage)).join('')}</div>`;

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
  }
}

function renderPodCard(pod, groups = [], isPanel = false, stageCount = 6, stageFilter = '') {
  const stages = pod.qc_stages || [];
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const pct = Math.round(completedStages / stageCount * 100);
  const statusCls = `status-${pod.status}`;
  const dirLabel = pod.type_directions?.direction === 'R' ? t('proj.dirRight') : pod.type_directions?.direction === 'L' ? t('proj.dirLeft') : (pod.type_directions?.direction || '');
  const unresolvedCount = (pod.comments || []).filter(c => !c.is_resolved).length;
  const flaggedCount = (pod.comments || []).filter(c => !c.is_resolved && c.is_flagged).length;
  const groupIdx = groups.findIndex(g => g.id === pod.group_id);
  const groupLabel = pod.production_groups?.name || '';
  const awaitingCasting = podAwaitingCasting(pod);

  // When filtering by stage, show why the pod is on screen (in progress / completed).
  const filteredStageStatus = stageFilter ? podStageStatus(pod, stageFilter) : null;
  const stageBadge = filteredStageStatus
    ? `<span class="status-badge status-${filteredStageStatus} stage-filter-badge">${t('proj.stageBadge', {
        letter: stageLetter(parseInt(stageFilter)),
        status: STATUS_LABELS[filteredStageStatus] || filteredStageStatus,
      })}</span>`
    : '';

  return `
    <div class="pod-card pod-card-clickable btn-open-pod ${flaggedCount > 0 ? 'pod-card-has-flagged' : unresolvedCount > 0 ? 'pod-card-has-comments' : ''} ${awaitingCasting ? 'pod-card-casting-approved' : ''}" data-pod-id="${pod.id}">
      <div class="pod-card-header">
        <div class="pod-card-code">${escHtml(pod.pod_code)}</div>
        ${awaitingCasting ? `<span class="casting-approved-badge" title="${t('pod.castingApprovedTitle')}">${t('pod.castingApproved')}</span>` : ''}
        ${flaggedCount > 0
          ? `<span class="unresolved-badge badge-flagged" title="${t('qc.commentsFlaggedMany', { n: flaggedCount })}">🚩 ${flaggedCount}</span>`
          : unresolvedCount > 0
          ? `<span class="unresolved-badge" title="${t('proj.unresolvedTitle', { n: unresolvedCount })}">💬 ${unresolvedCount}</span>`
          : ''}
        <span class="status-badge ${statusCls}">${STATUS_LABELS[pod.status] || pod.status}</span>
        ${stageBadge}
      </div>
      <div class="pod-card-meta">
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">${isPanel ? t('proj.model') : t('proj.type')}</span>
          <span class="pod-card-meta-value">${escHtml(typeLabel(pod.project_types)) || '—'}</span>
        </div>
        ${isPanel ? '' : `
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">${t('proj.direction')}</span>
          <span class="pod-card-meta-value">${dirLabel || '—'}</span>
        </div>
        <div class="pod-card-meta-item">
          <span class="pod-card-meta-label">${t('proj.group')}</span>
          <div style="display:flex;align-items:center;gap:5px">
            ${(() => {
              const selIdx = groups.findIndex(g => g.id === pod.group_id);
              const dotColor = selIdx >= 0 ? GROUP_COLORS[selIdx % GROUP_COLORS.length] : '';
              return `<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:${dotColor || 'transparent'};${dotColor ? '' : 'border:1px solid var(--border)'}"></span>`;
            })()}
            <span style="font-weight:700;font-size:13px;color:var(--primary)">${groupLabel ? escHtml(groupLabel) : (pod.production_groups?.name ? escHtml(pod.production_groups.name) : '—')}</span>
          </div>
        </div>`}
      </div>
      <div class="card-progress-section">
        <div class="card-progress-header">
          <span class="card-progress-label">${t('proj.stagesCount', { done: completedStages })}</span>
          <span class="card-progress-pct ${pct===100?'pct-done':''}">${pct}%</span>
        </div>
        <div class="progress-bar-outer progress-bar-lg">
          <div class="progress-bar-inner ${pct===100?'full':''}" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="pod-card-actions">
        <button class="btn btn-secondary btn-sm btn-pod-barcode-tbl" data-pod-code="${escHtml(pod.pod_code)}" data-group-label="${escHtml(groupLabel)}">${t('pod.barcode')}</button>
        ${isAdminOrPM() ? `<button class="btn btn-danger btn-sm btn-delete-pod" data-pod-id="${pod.id}" title="${t('common.delete')}" aria-label="${t('common.delete')}">🗑</button>` : ''}
      </div>
    </div>
  `;
}

// ---- GROUPS TAB ----
async function loadGroupsTab(projectId) {
  const [{ data: rawGroups }, { data: types }, { data: allGroupPods }] = await Promise.all([
    supabaseClient.from('production_groups').select('*').eq('project_id', projectId),
    supabaseClient.from('project_types').select('id, type_number, type_directions(id, direction)').eq('project_id', projectId).order('type_number'),
    supabaseClient.from('pods').select('group_id, type_id, direction_id').eq('project_id', projectId).not('group_id', 'is', null),
  ]);
  const groups = sortGroupsByOption(rawGroups || []);

  // Build composition map from actual pods for groups missing pod_composition
  const podCompByGroup = {};
  (allGroupPods || []).forEach(p => {
    if (!p.group_id) return;
    if (!podCompByGroup[p.group_id]) podCompByGroup[p.group_id] = {};
    const key = `${p.type_id}_${p.direction_id}`;
    podCompByGroup[p.group_id][key] = (podCompByGroup[p.group_id][key] || 0) + 1;
  });

  const container = document.getElementById('groups-list');

  if (!groups || groups.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🗓</div><div class="empty-state-text">${t('proj.noGroups')}</div></div>`;
    return;
  }

  container.innerHTML = groups.map((g, i) => {
    return `
    <div class="group-card">
      <div class="group-color-dot" style="background:${GROUP_COLORS[i % GROUP_COLORS.length]}"></div>
      <div style="display:flex;align-items:center;gap:8px">
        <div>
          <div class="group-name">${escHtml(g.name)}</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${g.casting_target_date ? `<div class="group-date">${t('proj.castingLabel')} ${formatDate(g.casting_target_date)}</div>` : ''}
            ${g.target_date ? `<div class="group-date">${t('proj.targetLabel')} ${formatDate(g.target_date)}</div>` : ''}
          </div>
          ${(() => {
            const comp = (g.pod_composition && Object.keys(g.pod_composition).length) ? g.pod_composition : (podCompByGroup[g.id] || {});
            if (!Object.keys(comp).length) return '';
            const rows = (types || []).flatMap(ty =>
              (ty.type_directions || []).map(d => {
                const key = `${ty.id}_${d.id}`;
                const val = comp[key];
                if (!val) return '';
                const dirLabel = d.direction === 'R' ? t('proj.dirRight') : d.direction === 'L' ? t('proj.dirLeft') : d.direction;
                return `<span style="font-size:12px;background:var(--primary-light);color:var(--primary);border-radius:4px;padding:2px 7px">T${ty.type_number} ${dirLabel}: ${val}</span>`;
              })
            ).filter(Boolean).join('');
            return rows ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${rows}</div>` : '';
          })()}
        </div>
      </div>
      <div class="group-actions" style="margin-right:auto">
        ${isAdminOrPM() ? `
          <button class="btn btn-secondary btn-sm btn-edit-group" data-group-id="${g.id}" data-name="${escHtml(g.name)}" data-date="${g.target_date || ''}" data-casting-date="${g.casting_target_date || ''}" data-max-pods="${g.max_pods || ''}" data-composition="${escHtml(JSON.stringify(g.pod_composition || {}))}">${t('common.edit')}</button>
          <button class="btn btn-danger btn-sm btn-delete-group" data-group-id="${g.id}" title="${t('common.delete')}" aria-label="${t('common.delete')}">🗑</button>
        ` : ''}
      </div>
    </div>
  `;}).join('');

  if (isAdminOrPM()) {
    container.querySelectorAll('.btn-edit-group').forEach(btn => {
      btn.addEventListener('click', () => {
        let comp = null;
        try { comp = JSON.parse(btn.dataset.composition || '{}'); } catch(e) {}
        showGroupModal(projectId, btn.dataset.groupId, btn.dataset.name, btn.dataset.date, btn.dataset.maxPods ? parseInt(btn.dataset.maxPods) : null, btn.dataset.castingDate || '', comp);
      });
    });
    container.querySelectorAll('.btn-delete-group').forEach(btn => {
      btn.addEventListener('click', () => deleteGroup(btn.dataset.groupId, projectId));
    });
  }
}

// ---- PROJECT DETAILS TAB ----
async function loadProjectDetailsTab(project) {
  const container = document.getElementById('project-details-form');
  const isPanel = projIsPanel(project);

  // select('*') — an explicit column list silently drops model_name, which
  // renders the "model name" input empty on every reload even though the value
  // is stored. Keep this as '*' whenever a column is added to project_types.
  const { data: types } = await supabaseClient
    .from('project_types')
    .select('*')
    .eq('project_id', project.id)
    .order('type_number');

  // Panels have no length — their dimensions are stored as "WxH" (two parts),
  // so they must be read back as width/height, not length/width.
  function parseDims(str) {
    const parts = (str || '').split(/[xX×]/);
    if (isPanel) {
      return { l: '', w: (parts[0] || '').trim(), h: (parts[1] || '').trim() };
    }
    return { l: (parts[0] || '').trim(), w: (parts[1] || '').trim(), h: (parts[2] || '').trim() };
  }

  const typesSection = isAdminOrPM() && types?.length ? `
    <div class="card" style="margin-top:16px">
      <div class="card-body">
        <div style="font-weight:600;margin-bottom:12px;font-size:15px">${t('proj.dimsByType')}</div>
        ${types.map(ty => {
          const d = parseDims(ty.dimensions);
          return `
          <div class="det-type-row" style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
            <div class="type-badge" style="flex-shrink:0">T${ty.type_number}</div>
            <div class="form-group" style="margin:0;flex:1.4;min-width:120px">
              <label style="font-size:11px">${t('proj.modelName')}</label>
              <input type="text" class="form-control det-model-name" data-type-id="${ty.id}" value="${escHtml(ty.model_name || '')}" placeholder="${t('proj.modelNamePlaceholder')}" />
            </div>
            ${isPanel ? '' : `
            <div class="form-group" style="margin:0;flex:1;min-width:80px">
              <label style="font-size:11px">${t('proj.length')}</label>
              <input type="text" class="form-control det-dim-l" data-type-id="${ty.id}" value="${escHtml(d.l)}" placeholder="${t('proj.length')}" />
            </div>`}
            <div class="form-group" style="margin:0;flex:1;min-width:80px">
              <label style="font-size:11px">${t('proj.width')}</label>
              <input type="text" class="form-control det-dim-w" data-type-id="${ty.id}" value="${escHtml(d.w)}" placeholder="${t('proj.width')}" />
            </div>
            <div class="form-group" style="margin:0;flex:1;min-width:80px">
              <label style="font-size:11px">${t('proj.height')}</label>
              <input type="text" class="form-control det-dim-h" data-type-id="${ty.id}" value="${escHtml(d.h)}" placeholder="${t('proj.height')}" />
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  ` : (!isAdminOrPM() && types?.length ? `
    <div class="card" style="margin-top:16px">
      <div class="card-body">
        <div style="font-weight:600;margin-bottom:12px;font-size:15px">${t('proj.dimsByType')}</div>
        ${types.map(ty => `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap">
            <div class="type-badge" style="flex-shrink:0">T${ty.type_number}</div>
            ${ty.model_name ? `<strong style="font-size:13px">${escHtml(ty.model_name)}</strong>` : ''}
            <span class="text-muted" style="font-size:13px">${escHtml(ty.dimensions || '—')}</span>
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
              <label>${t('proj.fullProjectName')}</label>
              <input type="text" id="det-name" class="form-control" value="${escHtml(project.name)}" />
            </div>
            <div class="form-group">
              <label>${t('proj.projectCode3')}</label>
              <input type="text" id="det-code" class="form-control" value="${escHtml(project.code)}" maxlength="3" style="text-transform:uppercase" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>${t('proj.location')}</label>
              <input type="text" id="det-location" class="form-control" value="${escHtml(project.location || '')}" />
            </div>
            <div class="form-group" ${isPanel ? 'style="display:none"' : ''}>
              <label>${t('proj.pipeType')}</label>
              <select id="det-pipe" class="form-control">
                <option value="">${t('proj.selectPlaceholder')}</option>
                <option value="HDPE" ${project.pipe_type === 'HDPE' ? 'selected' : ''}>HDPE</option>
                <option value="PVC" ${project.pipe_type === 'PVC' ? 'selected' : ''}>PVC</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>${t('proj.onedriveLink')}</label>
            <input type="url" id="det-onedrive" class="form-control" value="${escHtml(project.onedrive_folder_url || '')}" placeholder="https://onedrive.live.com/..." />
            <div class="form-hint">${t('proj.onedriveHint')}</div>
          </div>
        ` : `
          <div class="form-row">
            <div class="info-item"><div class="info-label">${t('proj.name')}</div><div class="info-value">${escHtml(project.name)}</div></div>
            <div class="info-item"><div class="info-label">${t('proj.code')}</div><div class="info-value">${escHtml(project.code)}</div></div>
          </div>
          <div class="form-row mt-4">
            <div class="info-item"><div class="info-label">${t('proj.location')}</div><div class="info-value">${escHtml(project.location || '—')}</div></div>
            ${isPanel ? '' : `<div class="info-item"><div class="info-label">${t('proj.pipeType')}</div><div class="info-value">${escHtml(project.pipe_type || '—')}</div></div>`}
          </div>
        `}
      </div>
    </div>
    ${typesSection}
    ${isAdminOrPM() ? `<button class="btn btn-primary" id="btn-save-project-details" style="margin-top:8px">${t('proj.saveChanges')}</button>` : ''}
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
        const modelName = container.querySelector(`.det-model-name[data-type-id="${t.id}"]`)?.value.trim() || null;
        return supabaseClient.from('project_types').update({ dimensions: dims, model_name: modelName }).eq('id', t.id);
      });

      const results = await Promise.all([projectUpdate, ...typeUpdates]);

      const firstError = results.find(r => r.error);
      if (firstError) { setLoading(btn, false); showToast(t('qc.saveError'), 'error'); return; }

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
          showToast(t('proj.podCodeUpdateError') + rpcErr.message, 'error');
          return;
        }
      }

      setLoading(btn, false);
      const newName = document.getElementById('det-name').value.trim();
      showToast(codeChanged ? t('proj.detailsUpdatedCode', { code: newCode }) : t('proj.detailsUpdated'), 'success');
      AppState.currentProject = { ...AppState.currentProject, name: newName, code: newCode };
      project.code = newCode;
      document.getElementById('project-detail-title').textContent = newName;
      // Refresh info bar with new code
      document.getElementById('project-info-bar').querySelector('.info-value').textContent = newCode;
      // Refresh pods tab so updated pod_codes are visible
      if (codeChanged) loadPodsTab(project.id, getCurrentPodFilters()).catch(e => console.error('[save] reload pods error:', e));
    });
  }
}

// ---- PLANS TAB ----
async function loadPlansTab(projectId) {
  const [{ data: types }, { data: plans }] = await Promise.all([
    supabaseClient.from('project_types').select('*').eq('project_id', projectId).order('type_number'),
    supabaseClient.from('type_plans').select('*, uploader:profiles!uploaded_by(full_name, username)').eq('project_id', projectId).order('uploaded_at'),
  ]);

  const container = document.getElementById('plans-list');

  if (!types || types.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📐</div><div class="empty-state-text">${t('proj.noTypesInProject')}</div></div>`;
    return;
  }

  const canEdit = isAdminOrPM();

  // The plans bucket is private: build signed URLs (1h) for viewing.
  // Legacy rows without a storage_path fall back to their stored URL.
  const signedByPath = {};
  const planPaths = (plans || []).map(p => p.storage_path).filter(Boolean);
  if (planPaths.length) {
    try {
      const { data: signed } = await supabaseClient.storage
        .from('plans').createSignedUrls(planPaths, 3600);
      (signed || []).forEach(s => { if (s.signedUrl) signedByPath[s.path] = s.signedUrl; });
    } catch (e) {
      console.warn('[loadPlansTab] signed URLs failed, falling back to stored URLs:', e);
    }
  }

  const plansByType = {};
  (plans || []).forEach(p => {
    if (!plansByType[p.type_id]) plansByType[p.type_id] = [];
    plansByType[p.type_id].push(p);
  });

  container.innerHTML = `
    <div class="types-list">
      ${types.map(ty => {
        const typePlans = plansByType[ty.id] || [];
        return `
        <div class="type-item" data-type-id="${ty.id}">
          <div class="type-item-header">
            <div class="type-badge">T${ty.type_number}</div>
            ${ty.model_name ? `<strong style="font-size:13px">${escHtml(ty.model_name)}</strong>` : ''}
            <span class="text-muted">${t('proj.dimsLabel')}${escHtml(ty.dimensions || '—')}</span>
            ${canEdit ? `<label class="btn btn-primary btn-sm plan-upload-label" style="margin-right:auto">${t('proj.addPdf')}<input type="file" accept="application/pdf" class="plan-file-input" data-type-id="${ty.id}" style="display:none"></label>` : ''}
          </div>
          ${typePlans.length > 0 ? `
            <div class="plans-files-list">
              ${typePlans.map(p => `
                <div class="plan-file-row">
                  <a href="${escHtml(signedByPath[p.storage_path] || p.file_url)}" target="_blank" class="plan-file-link">📄 ${escHtml(p.file_name)}</a>
                  <span class="plan-file-meta">${escHtml(p.uploader?.full_name || p.uploader?.username || '')} · ${formatDate(p.uploaded_at)}</span>
                  ${canEdit ? `<button class="btn btn-ghost btn-sm btn-delete-plan" data-plan-id="${p.id}" data-storage-path="${escHtml(p.storage_path)}" title="${t('common.delete')}" aria-label="${t('common.delete')}">🗑️</button>` : ''}
                </div>
              `).join('')}
            </div>
          ` : `<div class="text-muted text-sm" style="margin-top:4px">${t('proj.noPlansUploaded')}</div>`}
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
  if (file.type !== 'application/pdf') { showToast(t('proj.pdfOnly'), 'error'); return; }
  if (file.size > 20 * 1024 * 1024) { showToast(t('proj.maxFileSize20'), 'error'); return; }

  showToast(t('proj.uploadingFile'), 'info');
  // Storage keys must be ASCII — a Hebrew file name fails with "Invalid key".
  // The original name is kept in type_plans.file_name for display.
  const storagePath = `${projectId}/${typeId}/${Date.now()}_${safeStorageName(file.name, 'pdf')}`;
  const { error: upErr } = await supabaseClient.storage.from('plans').upload(storagePath, file);
  if (upErr) {
    console.error('Storage upload error:', upErr);
    showToast(t('qc.uploadError') + upErr.message, 'error');
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
    showToast(t('proj.saveErrorColon') + dbErr.message, 'error');
    await supabaseClient.storage.from('plans').remove([storagePath]);
    return;
  }

  showToast(t('proj.planUploaded'), 'success');
  await loadPlansTab(projectId);
}

async function deletePlan(planId, storagePath, projectId) {
  if (!(await uiConfirm(t('proj.confirmDeletePlan')))) return;

  const { error: dbErr } = await supabaseClient.from('type_plans').delete().eq('id', planId);
  if (dbErr) { showToast(t('proj.deleteError') + dbErr.message, 'error'); return; }

  if (storagePath) await supabaseClient.storage.from('plans').remove([storagePath]);

  showToast(t('proj.planDeleted'), 'success');
  await loadPlansTab(projectId);
}

// Read the pod-filter selects as a filters object for loadPodsTab. Use this
// whenever the pods tab reloads for the SAME project (back from a pod, pod
// added/deleted, project saved) so the list stays in sync with the selects —
// reloading without it shows an unfiltered list under a still-selected filter.
function getCurrentPodFilters() {
  const val = id => document.getElementById(id)?.value || '';
  return {
    group_id: val('filter-group'),
    type_number: val('filter-type'),
    direction: val('filter-direction'),
    stage: val('filter-stage'),
    status: val('filter-status'),
    casting_approved: val('filter-casting'),
  };
}

// ---- SETUP FILTERS ----
async function setupPodFilters(projectId) {
  // Run both queries in parallel
  const [{ data: rawFilterGroups }, { data: types }] = await Promise.all([
    supabaseClient.from('production_groups').select('id, name').eq('project_id', projectId),
    supabaseClient.from('project_types').select('*').eq('project_id', projectId).order('type_number'),
  ]);
  const groups = sortGroupsByOption(rawFilterGroups || []);

  const groupSel = document.getElementById('filter-group');
  const typeSel = document.getElementById('filter-type');
  const dirSel = document.getElementById('filter-direction');
  const stageSel = document.getElementById('filter-stage');
  const statusSel = document.getElementById('filter-status');
  const castingSel = document.getElementById('filter-casting');

  // Panels have no direction, no groups and no casting approval — hide those
  // filters (and reset them so a stale selection can't silently filter out
  // every panel).
  const isPanel = projIsPanel(AppState.currentProject);
  [groupSel, dirSel, castingSel].forEach(sel => {
    if (!sel) return;
    if (isPanel) sel.value = '';
    sel.style.display = isPanel ? 'none' : '';
  });

  groupSel.innerHTML = `<option value="">${t('filter.allGroups')}</option>` + groups.map(g =>
    `<option value="${g.id}">${escHtml(g.name)}</option>`).join('');

  typeSel.innerHTML = `<option value="">${isPanel ? t('filter.allModels') : t('filter.allTypes')}</option>` + (types || []).map(ty =>
    `<option value="${ty.type_number}">${escHtml(typeLabel(ty))}</option>`).join('');

  dirSel.innerHTML = `
    <option value="">${t('filter.allDirections')}</option>
    <option value="R">${t('direction.R')}</option>
    <option value="L">${t('direction.L')}</option>
  `;

  // Stage list follows the product type: 6 stages (A–F) for sanitary pods,
  // 5 (A–E) for medical panels. Rebuilding the options also clears any stale
  // selection, so switching projects can't leave a stage filter armed.
  if (stageSel) {
    const stages = qcStageSet(isPanel ? 'medical_panel' : 'pod');
    stageSel.innerHTML = `<option value="">${t('filter.allStages')}</option>` + stages.map(st =>
      `<option value="${st.number}">${escHtml(t('filter.stageOpt', {
        letter: stageLetter(st.number),
        name: qcStageName(st.number, isPanel ? 'medical_panel' : 'pod'),
      }))}</option>`).join('');
  }

  const applyFilters = () => {
    loadPodsTab(projectId, getCurrentPodFilters());
  };

  groupSel.onchange = applyFilters;
  typeSel.onchange = applyFilters;
  dirSel.onchange = applyFilters;
  if (stageSel) stageSel.onchange = applyFilters;
  statusSel.onchange = applyFilters;
  if (castingSel) castingSel.onchange = applyFilters;
}

// ---- NEW PROJECT MODAL ----
function showNewProjectModal() {
  openModal(t('proj.newProjectTitle'), buildNewProjectForm(), [
    { label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-modal-cancel' },
    { label: t('proj.createProject'), cls: 'btn-primary', id: 'btn-modal-create-project' },
  ]);

  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-modal-create-project')?.addEventListener('click', createProject);

  // Suggest the next sequential project number. Existing projects predate the
  // column and have NULL, so the first numbered project falls back to 2 — the
  // legacy project (EKR) is number 1 and is never renumbered.
  suggestNextProjectNumber();

  // Dynamic types
  document.getElementById('np-type-count')?.addEventListener('change', renderTypeInputs);
  // Product type: panels have no pipe type and no R/L directions — toggle the
  // pipe field and re-render the per-type inputs accordingly.
  document.getElementById('np-product-type')?.addEventListener('change', () => {
    const isPanel = document.getElementById('np-product-type')?.value === 'medical_panel';
    const pipeWrap = document.getElementById('np-pipe-group');
    if (pipeWrap) pipeWrap.style.display = isPanel ? 'none' : '';
    const countLabel = document.getElementById('np-type-count-label');
    if (countLabel) countLabel.textContent = isPanel ? t('proj.modelCount') : t('proj.typeCount');
    renderTypeInputs();
  });
  renderTypeInputs();
}

function buildNewProjectForm() {
  return `
    <form id="form-new-project">
      <div class="form-row">
        <div class="form-group">
          <label>${t('proj.fullProjectName')} <span class="required">*</span></label>
          <input type="text" id="np-name" class="form-control" placeholder="${t('proj.projectNamePlaceholder')}" required />
        </div>
        <div class="form-group">
          <label>${t('proj.projectCode3')} <span class="required">*</span></label>
          <input type="text" id="np-code" class="form-control" placeholder="SVC" maxlength="3" style="text-transform:uppercase" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('proj.dateReceivedLabel')} <span class="required">*</span></label>
          <input type="date" id="np-date" class="form-control" required />
        </div>
        <div class="form-group">
          <label>${t('proj.productType')}</label>
          <select id="np-product-type" class="form-control">
            <option value="pod">${t('proj.productPod')}</option>
            <option value="medical_panel">${t('proj.productPanel')}</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('proj.projectNumber')} <span class="required">*</span></label>
          <input type="number" id="np-project-number" class="form-control" min="1" max="99" />
          <div class="form-hint">${t('proj.projectNumberHint')}</div>
        </div>
        <div class="form-group" id="np-pipe-group">
          <label>${t('proj.pipeType')}</label>
          <select id="np-pipe" class="form-control">
            <option value="">${t('proj.selectPlaceholder')}</option>
            <option value="HDPE">HDPE</option>
            <option value="PVC">PVC</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>${t('proj.location')}</label>
          <input type="text" id="np-location" class="form-control" placeholder="${t('proj.locationPlaceholder')}" />
        </div>
        <div class="form-group">
          <label id="np-type-count-label">${t('proj.typeCount')}</label>
          <input type="number" id="np-type-count" class="form-control" value="1" min="1" max="99" />
        </div>
      </div>
      <div id="np-types-container"></div>
    </form>
  `;
}

// Prefill "project number" with max(existing)+1. Missing column (migration not
// applied yet) leaves the field empty and createProject blocks with a clear
// message rather than silently minting a legacy-format code.
async function suggestNextProjectNumber() {
  const input = document.getElementById('np-project-number');
  if (!input) return;
  const { data, error } = await supabaseClient
    .from('projects').select('project_number')
    .not('project_number', 'is', null)
    .order('project_number', { ascending: false })
    .limit(1);
  if (error) { console.warn('[suggestNextProjectNumber] unavailable:', error.message); return; }
  const highest = data?.[0]?.project_number || 1;
  input.value = highest + 1;
}

function renderTypeInputs() {
  const count = parseInt(document.getElementById('np-type-count')?.value || 1);
  const container = document.getElementById('np-types-container');
  if (!container) return;
  const isPanel = document.getElementById('np-product-type')?.value === 'medical_panel';

  // Preserve anything already typed — changing the type count used to wipe
  // every dimension/direction field the user had filled in.
  const prev = {};
  container.querySelectorAll('input').forEach(inp => {
    prev[inp.id] = inp.type === 'checkbox' ? inp.checked : inp.value;
  });

  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `
      <div style="border:1.5px solid var(--border);border-radius:8px;padding:14px;margin-bottom:12px;background:#f8fafc">
        <div style="font-weight:600;margin-bottom:10px;color:var(--primary)">${isPanel ? t('proj.model') : t('proj.type')} T${i}</div>
        <div class="form-group">
          <label>${t('proj.modelName')}</label>
          <input type="text" id="np-type${i}-model" class="form-control" placeholder="${t('proj.modelNamePlaceholder')}" />
        </div>
        <div class="form-row">
          ${isPanel ? '' : `
          <div class="form-group">
            <label>${t('proj.length')}</label>
            <input type="text" id="np-type${i}-dim-l" class="form-control" placeholder="${t('proj.length')}" />
          </div>`}
          <div class="form-group">
            <label>${t('proj.width')}</label>
            <input type="text" id="np-type${i}-dim-w" class="form-control" placeholder="${t('proj.width')}" />
          </div>
          <div class="form-group">
            <label>${t('proj.height')}</label>
            <input type="text" id="np-type${i}-dim-h" class="form-control" placeholder="${t('proj.height')}" />
          </div>
        </div>
        ${isPanel ? `
        <div class="form-group">
          <label>${t('proj.panelCount')}</label>
          <input type="number" id="np-type${i}-count" class="form-control" style="width:110px" value="1" min="1" />
        </div>
        ` : `
        <div class="form-group">
          <label>${t('proj.dirsAndPodCount')}</label>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="np-type${i}-R" checked />
              <label for="np-type${i}-R">${t('direction.R')}</label>
              <input type="number" id="np-type${i}-R-count" class="form-control" style="width:80px" value="1" min="1" />
              <span class="text-sm text-muted">${t('proj.podsLower')}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="np-type${i}-L" checked />
              <label for="np-type${i}-L">${t('direction.L')}</label>
              <input type="number" id="np-type${i}-L-count" class="form-control" style="width:80px" value="1" min="1" />
              <span class="text-sm text-muted">${t('proj.podsLower')}</span>
            </div>
          </div>
        </div>
        `}
      </div>
    `;
  }
  container.innerHTML = html;

  // Restore previously typed values
  container.querySelectorAll('input').forEach(inp => {
    if (!(inp.id in prev)) return;
    if (inp.type === 'checkbox') inp.checked = prev[inp.id];
    else inp.value = prev[inp.id];
  });
}

async function createProject() {
  const btn = document.getElementById('btn-modal-create-project');
  const name = document.getElementById('np-name')?.value.trim();
  const code = document.getElementById('np-code')?.value.trim().toUpperCase();
  const dateReceived = document.getElementById('np-date')?.value;
  const productType = document.getElementById('np-product-type')?.value || 'pod';
  const isPanel = productType === 'medical_panel';
  const pipeType = isPanel ? '' : document.getElementById('np-pipe')?.value;
  const location = document.getElementById('np-location')?.value.trim();
  const typeCount = parseInt(document.getElementById('np-type-count')?.value || 1);
  const projectNumber = parseInt(document.getElementById('np-project-number')?.value);

  if (!name || !code || !dateReceived) {
    showToast(t('proj.fillNameCodeDate'), 'error'); return;
  }
  if (code.length !== 3) {
    showToast(t('proj.codeMustBe3'), 'error'); return;
  }
  if (!(projectNumber > 0)) {
    showToast(t('proj.projectNumberRequired'), 'error'); return;
  }
  // Guard before creating anything: without the column every unit code would
  // silently fall back to the legacy date format, which is exactly what this
  // change exists to stop.
  const { error: colErr } = await supabaseClient.from('projects').select('project_number').limit(1);
  if (colErr) {
    showToast(t('proj.errNeedNumberMigration'), 'error');
    console.error('[createProject] project_number column missing:', colErr);
    return;
  }
  if (!AppState.currentProfile) {
    // Try to reload profile once before giving up
    if (AppState.currentUser) {
      const reloaded = await loadCurrentProfile(AppState.currentUser.id);
      if (reloaded) AppState.currentProfile = reloaded;
    }
    if (!AppState.currentProfile) {
      showToast(t('proj.profileNotLoaded'), 'error'); return;
    }
  }

  const setBtnStep = (text) => { if (btn) { btn.innerHTML = `⏳ ${text}`; btn.disabled = true; } };
  const resetBtn = () => { if (btn) { btn.innerHTML = t('proj.createProject'); btn.disabled = false; } };

  setBtnStep(t('proj.creatingProject'));
  try {
    // Step 1: Insert project
    console.log('[createProject] Step 1: inserting project');
    console.log('[createProject] currentProfile:', AppState.currentProfile);
    console.log('[createProject] payload:', { name, code, date_received: dateReceived, pipe_type: pipeType || null, location: location || null, created_by: AppState.currentProfile?.id });
    // Step 1a: Insert project with timeout resilience.
    // In bolt.new, the service worker can drop the response channel even if the DB succeeded.
    console.log('[createProject] Step 1a: inserting project');
    const insertPayload = { name, code, date_received: dateReceived, pipe_type: pipeType || null, location: location || null, created_by: AppState.currentProfile.id, project_number: projectNumber };
    // Only sent when non-default so pod projects keep working even before the
    // 20260803 migration is applied. Panel creation fails loudly without it.
    if (productType !== 'pod') insertPayload.product_type = productType;

    let insertConfirmed = false;
    try {
      const result = await Promise.race([
        supabaseClient.from('projects').insert(insertPayload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('__timeout__')), 12000)),
      ]);
      const { error: insertErr } = result || {};
      if (insertErr) throw new Error(t('proj.errInsertStep') + insertErr.message);
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

    if (projErr && !insertConfirmed) throw new Error(t('proj.errCreateProject') + projErr.message);
    if (!project) throw new Error(t('proj.errNotFoundAfterCreate'));
    console.log('[createProject] Step 1 OK, project id:', project.id);

    // Step 2: Insert types and directions, create pods
    let globalSerial = 0;
    for (let i = 1; i <= typeCount; i++) {
      setBtnStep(t('proj.savingType', { i, total: typeCount }));
      // Panels render no length field, so dimL stays empty and the stored
      // value is "WxH" — parseDims in the details tab reads it back the same way.
      const modelName = document.getElementById(`np-type${i}-model`)?.value.trim() || null;
      const dimL = document.getElementById(`np-type${i}-dim-l`)?.value.trim() || '';
      const dimW = document.getElementById(`np-type${i}-dim-w`)?.value.trim() || '';
      const dimH = document.getElementById(`np-type${i}-dim-h`)?.value.trim() || '';
      const dims = [dimL, dimW, dimH].filter(Boolean).join('x') || null;
      console.log(`[createProject] Step 2: inserting type ${i}`);
      const { data: typeData, error: typeErr } = await supabaseClient
        .from('project_types')
        .insert({ project_id: project.id, type_number: i, dimensions: dims || null, model_name: modelName })
        .select().single();
      if (typeErr) throw new Error(t('proj.errTypeStep', { i }) + typeErr.message);
      console.log(`[createProject] Type ${i} OK`);

      if (isPanel) {
        // Panels have no R/L. A single placeholder direction row ('R') keeps
        // the pods.direction_id schema untouched; it is never displayed and
        // the pod code is generated without a direction segment.
        const panelCount = parseInt(document.getElementById(`np-type${i}-count`)?.value || 1);
        setBtnStep(t('proj.creatingPods'));
        const { data: dirData, error: dirErr } = await supabaseClient
          .from('type_directions')
          .insert({ type_id: typeData.id, direction: 'R', pod_count: panelCount })
          .select().single();
        if (dirErr) throw new Error(t('proj.errDirStep', { dir: 'R' }) + dirErr.message);

        const panelsToInsert = [];
        for (let s = 1; s <= panelCount; s++) {
          globalSerial++;
          panelsToInsert.push({
            project_id: project.id,
            type_id: typeData.id,
            direction_id: dirData.id,
            serial_number: s,
            pod_code: generatePodCode(code, dateReceived, i, '', globalSerial, projectNumber),
            status: 'pending',
          });
        }
        if (panelsToInsert.length > 0) {
          const { error: podsErr } = await supabaseClient.from('pods').insert(panelsToInsert);
          if (podsErr) throw new Error(t('proj.errPodsStep') + podsErr.message);
        }
        continue;
      }

      for (const dir of ['R', 'L']) {
        const cb = document.getElementById(`np-type${i}-${dir}`);
        if (!cb?.checked) continue;
        const podCount = parseInt(document.getElementById(`np-type${i}-${dir}-count`)?.value || 1);

        setBtnStep(t('proj.savingDirection', { dir }));
        console.log(`[createProject] Step 3: inserting direction ${dir} for type ${i}`);
        const { data: dirData, error: dirErr } = await supabaseClient
          .from('type_directions')
          .insert({ type_id: typeData.id, direction: dir, pod_count: podCount })
          .select().single();
        if (dirErr) throw new Error(t('proj.errDirStep', { dir }) + dirErr.message);
        console.log(`[createProject] Direction ${dir} OK`);

        setBtnStep(t('proj.creatingPods'));
        const podsToInsert = [];
        for (let s = 1; s <= podCount; s++) {
          globalSerial++;
          podsToInsert.push({
            project_id: project.id,
            type_id: typeData.id,
            direction_id: dirData.id,
            serial_number: s,
            pod_code: generatePodCode(code, dateReceived, i, dir, globalSerial, projectNumber),
            status: 'pending',
          });
        }
        if (podsToInsert.length > 0) {
          console.log(`[createProject] Step 4: inserting ${podsToInsert.length} pods`);
          const { error: podsErr } = await supabaseClient.from('pods').insert(podsToInsert);
          if (podsErr) throw new Error(t('proj.errPodsStep') + podsErr.message);
          console.log('[createProject] Pods OK');
        }
      }
    }

    showToast(t('proj.projectCreated'), 'success');
    closeModal();
    await loadProjects();
    openProject(project.id);
  } catch (err) {
    console.error('[createProject] Error:', err);
    showToast(t('proj.errorPrefix') + (err.message || err), 'error');
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

async function showGroupModal(projectId, groupId = null, name = '', date = '', maxPods = null, castingDate = '', existingComposition = null) {
  // Fetch project types with directions
  const { data: types } = await supabaseClient
    .from('project_types')
    .select('id, type_number, type_directions(id, direction)')
    .eq('project_id', projectId)
    .order('type_number');

  let autoName = name;
  if (!groupId) {
    const { data: existing } = await supabaseClient
      .from('production_groups').select('name').eq('project_id', projectId);
    const count = (existing || []).length;
    autoName = `G${count + 1}`;
  }

  const isEdit = !!groupId;

  // For edit: build composition from actual pods in group (since pod_composition may be null for old groups)
  let composition = existingComposition || {};
  if (isEdit && !Object.keys(composition).length) {
    const { data: groupPods } = await supabaseClient
      .from('pods')
      .select('type_id, direction_id')
      .eq('group_id', groupId);
    (groupPods || []).forEach(p => {
      const key = `${p.type_id}_${p.direction_id}`;
      composition[key] = (composition[key] || 0) + 1;
    });
  }

  const typeRows = (types || []).flatMap(ty =>
    (ty.type_directions || []).map(d => {
      const key = `${ty.id}_${d.id}`;
      const dirLabel = d.direction === 'R' ? t('proj.dirRight') : d.direction === 'L' ? t('proj.dirLeft') : d.direction;
      const val = composition[key] || '';
      if (isEdit) {
        return val ? `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-weight:500">T${ty.type_number} — ${dirLabel}</span>
            <span style="font-weight:700;color:var(--primary)">${val}</span>
          </div>` : '';
      }
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-weight:500">T${ty.type_number} — ${dirLabel}</span>
          <input type="number" id="grp-comp-${key}" class="form-control" min="0" placeholder="0"
            value="${val}" style="width:80px;text-align:center" />
        </div>`;
    })
  ).filter(Boolean).join('');

  openModal(isEdit ? t('proj.editGroup') : t('proj.newGroup'), `
    <div class="form-group">
      <label>${t('proj.groupName')}</label>
      ${isEdit
        ? `<div class="form-control" style="background:var(--surface-2);color:var(--text-secondary)">${escHtml(autoName)}</div>`
        : `<input type="text" id="grp-name" class="form-control" value="${escHtml(autoName)}" />`}
    </div>
    <div class="form-group">
      <label>${t('proj.podComposition')}</label>
      ${typeRows || `<div style="color:var(--text-secondary);font-size:13px">${isEdit ? t('proj.noCompositionDefined') : t('proj.noTypesDefined')}</div>`}
    </div>
    <div class="form-group">
      <label>${t('proj.castingDate')}</label>
      <input type="date" id="grp-casting-date" class="form-control" value="${castingDate}" />
    </div>
    <div class="form-group">
      <label>${t('proj.targetDate')}</label>
      <input type="date" id="grp-date" class="form-control" value="${date}" />
    </div>
  `, [
    { label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-grp-cancel' },
    { label: t('common.save'), cls: 'btn-primary', id: 'btn-grp-save' },
  ]);

  document.getElementById('btn-grp-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-grp-save')?.addEventListener('click', async () => {
    const dt = document.getElementById('grp-date')?.value;
    const cd = document.getElementById('grp-casting-date')?.value;

    const btn = document.getElementById('btn-grp-save');
    setLoading(btn, true);
    try {
      let saveError;
      if (isEdit) {
        // Edit: only dates can change
        ({ error: saveError } = await supabaseClient.from('production_groups')
          .update({ target_date: dt || null, casting_target_date: cd || null })
          .eq('id', groupId));
      } else {
        const nm = document.getElementById('grp-name')?.value.trim();
        if (!nm) { showToast(t('proj.enterName'), 'error'); setLoading(btn, false); return; }
        // Build composition and total for new group
        const comp = {};
        let total = 0;
        (types || []).forEach(t => {
          (t.type_directions || []).forEach(d => {
            const key = `${t.id}_${d.id}`;
            const val = parseInt(document.getElementById(`grp-comp-${key}`)?.value) || 0;
            if (val > 0) comp[key] = val;
            total += val;
          });
        });
        const { data: groups } = await supabaseClient.from('production_groups').select('id').eq('project_id', projectId);
        const { data: newGroup, error: grpErr } = await supabaseClient.from('production_groups').insert({
          project_id: projectId, name: nm,
          target_date: dt || null, casting_target_date: cd || null,
          max_pods: total || null,
          pod_composition: Object.keys(comp).length ? comp : null,
          sort_order: (groups || []).length,
        }).select().single();
        saveError = grpErr;

        // Auto-create pods based on composition
        if (!saveError && newGroup && Object.keys(comp).length > 0) {
          // Fetch project details for pod code generation
          const { data: proj } = await supabaseClient
            .from('projects').select('*').eq('id', projectId).single();
          // Find max existing global serial in this project
          const { data: existingPods } = await supabaseClient
            .from('pods').select('pod_code').eq('project_id', projectId);
          let globalSerial = 0;
          (existingPods || []).forEach(p => {
            const s = parseInt((p.pod_code || '').slice(-3)) || 0;
            if (s > globalSerial) globalSerial = s;
          });

          const podsToInsert = [];
          // Process in canonical order: type_number ascending, direction R before L
          // (matches createProject; comp keys are UUIDs so sorting them is arbitrary)
          const sortedTypes = [...(types || [])].sort((a, b) => a.type_number - b.type_number);
          for (const typeObj of sortedTypes) {
            const sortedDirs = [...(typeObj.type_directions || [])].sort((a, b) =>
              (a.direction === 'R' ? 0 : 1) - (b.direction === 'R' ? 0 : 1));
            for (const dirObj of sortedDirs) {
              const count = comp[`${typeObj.id}_${dirObj.id}`] || 0;
              let groupSerial = 0;
              for (let s = 1; s <= count; s++) {
                globalSerial++;
                groupSerial++;
                podsToInsert.push({
                  project_id: projectId,
                  type_id: typeObj.id,
                  direction_id: dirObj.id,
                  group_id: newGroup.id,
                  group_serial: groupSerial,
                  serial_number: globalSerial,
                  pod_code: generatePodCode(proj.code, proj.date_received, typeObj.type_number, dirObj.direction, globalSerial, proj.project_number),
                  status: 'pending',
                });
              }
            }
          }
          if (podsToInsert.length > 0) {
            const { error: podsErr } = await supabaseClient.from('pods').insert(podsToInsert);
            if (podsErr) { showToast(t('proj.errorCreatingPods') + podsErr.message, 'error'); return; }
          }
        }
      }
      if (saveError) { showToast(t('proj.errorPrefix') + saveError.message, 'error'); return; }
      showToast(t('proj.savedSuccess'), 'success');
      closeModal();
      await loadGroupsTab(projectId);
      await setupPodFilters(projectId);
    } catch (err) {
      showToast(t('proj.errorPrefix') + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function deleteGroup(groupId, projectId) {
  if (!(await uiConfirm(t('proj.confirmDeleteGroup')))) return;
  // FK is ON DELETE SET NULL (migration 20260712020000): pods in the group
  // are detached, not deleted.
  const { error } = await supabaseClient.from('production_groups').delete().eq('id', groupId);
  if (error) {
    showToast(t('proj.deleteError') + error.message, 'error');
    return;
  }
  showToast(t('proj.groupDeleted'), 'success');
  await loadGroupsTab(projectId);
  await setupPodFilters(projectId);
  // Refresh pods so detached group labels disappear from the cards
  await loadPodsTab(projectId);
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
  const isPanel = projIsPanel(project);

  openModal(isPanel ? t('proj.addPanel') : t('proj.addPod'), `
    <div class="form-group">
      <label>${isPanel ? t('proj.model') : t('proj.type')}</label>
      <select id="add-pod-type" class="form-control">
        ${(types || []).map(ty => `<option value="${ty.id}" data-type-num="${ty.type_number}">${escHtml(typeLabel(ty))} (${escHtml(ty.dimensions || '')})</option>`).join('')}
      </select>
    </div>
    ${isPanel ? '' : `
    <div class="form-group">
      <label>${t('proj.direction')}</label>
      <select id="add-pod-dir" class="form-control">
        <option value="">${t('proj.selectDirection')}</option>
      </select>
    </div>`}
    <div class="form-group">
      <label>${t('proj.serialNumber')}</label>
      <input type="number" id="add-pod-serial" class="form-control" min="1" value="1" />
    </div>
    ${isPanel ? '' : `
    <div class="form-group">
      <label>${t('proj.group')}</label>
      <select id="add-pod-group" class="form-control">
        <option value="">${t('proj.noGroup')}</option>
        ${(groups || []).map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join('')}
      </select>
    </div>`}
    <div id="add-pod-preview" class="form-group">
      <label>${t('proj.podCodeToCreate')}</label>
      <div id="pod-code-preview" style="font-family:monospace;font-size:16px;font-weight:700;padding:8px;background:#f8fafc;border-radius:8px;border:1.5px solid var(--border)"></div>
    </div>
  `, [
    { label: t('common.cancel'), cls: 'btn-ghost', id: 'btn-add-pod-cancel' },
    { label: t('proj.createPod'), cls: 'btn-primary', id: 'btn-add-pod-confirm' },
  ]);

  // Panels: no direction select — resolve the type's single (placeholder)
  // direction row internally; the code preview carries no direction segment.
  const panelDirFor = (typeId) => ((types || []).find(t => t.id === typeId)?.type_directions || [])[0];

  // Populate directions on type change
  const updateDirs = () => {
    if (isPanel) { updatePreview(); return; }
    const typeEl = document.getElementById('add-pod-type');
    const selectedTypeId = typeEl?.value;
    const selectedType = (types || []).find(t => t.id === selectedTypeId);
    const dirSel = document.getElementById('add-pod-dir');
    dirSel.innerHTML = `<option value="">${t('proj.selectDirection')}</option>` +
      (selectedType?.type_directions || []).map(d =>
        `<option value="${d.id}" data-dir="${d.direction}">${d.direction === 'R' ? t('direction.R') : t('direction.L')}</option>`
      ).join('');
    updatePreview();
  };

  const updatePreview = () => {
    const typeEl = document.getElementById('add-pod-type');
    const dirEl = document.getElementById('add-pod-dir');
    const serialEl = document.getElementById('add-pod-serial');
    const previewEl = document.getElementById('pod-code-preview');
    const selectedOpt = dirEl?.options[dirEl.selectedIndex];
    const dir = isPanel ? '' : (selectedOpt?.dataset?.dir || '');
    const typeNum = typeEl?.options[typeEl.selectedIndex]?.dataset?.typeNum || '';
    const serial = parseInt(serialEl?.value || 1);
    if (project && typeNum && (isPanel || dir)) {
      previewEl.textContent = generatePodCode(project.code, project.date_received, typeNum, dir, serial, project.project_number);
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
    const typeId = typeEl?.value;
    const dir = isPanel ? '' : selectedDirOpt?.dataset?.dir;
    const dirId = isPanel ? panelDirFor(typeId)?.id : dirEl?.value;
    const typeNum = typeEl?.options[typeEl.selectedIndex]?.dataset?.typeNum;
    const serial = parseInt(serialEl?.value || 1);
    const groupId = groupEl?.value || null;

    if (!typeId || !dirId || (!isPanel && !dir)) { showToast(t('proj.selectTypeDirection'), 'error'); return; }

    const podCode = generatePodCode(project.code, project.date_received, typeNum, dir, serial, project.project_number);
    const btn = document.getElementById('btn-add-pod-confirm');
    setLoading(btn, true);
    try {
      let groupSerial = null;
      if (groupId) {
        const { data: grpData } = await supabaseClient.from('production_groups').select('max_pods').eq('id', groupId).single();
        const { data: grpPods } = await supabaseClient.from('pods').select('group_serial').eq('group_id', groupId);
        const currentCount = (grpPods || []).length;
        if (grpData?.max_pods && currentCount >= grpData.max_pods) {
          showToast(t('proj.groupFull', { max: grpData.max_pods }), 'error');
          setLoading(btn, false);
          return;
        }
        const usedSerials = new Set((grpPods || []).map(p => p.group_serial).filter(Boolean));
        let nextSerial = 1;
        while (usedSerials.has(nextSerial)) nextSerial++;
        groupSerial = nextSerial;
      }
      const { error } = await supabaseClient.from('pods').insert({
        project_id: projectId, type_id: typeId, direction_id: dirId,
        serial_number: serial, pod_code: podCode, group_id: groupId || null,
        group_serial: groupSerial,
        status: 'pending',
      });
      if (error) throw error;
      showToast(t('proj.podCreated'), 'success');
      closeModal();
      await loadPodsTab(projectId, getCurrentPodFilters());
    } catch (err) {
      showToast(t('proj.errorPrefix') + err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function deletePod(podId) {
  if (!(await uiConfirm(t('proj.confirmDeletePod')))) return;
  const { error } = await supabaseClient.from('pods').delete().eq('id', podId);
  if (error) { showToast(t('proj.deleteErrorSimple'), 'error'); return; }
  showToast(t('proj.podDeleted'), 'success');
  if (AppState.currentProject) await loadPodsTab(AppState.currentProject.id, getCurrentPodFilters());
}

// ---- ARCHIVE / DELETE PROJECT ----
function promptArchiveOrDelete() {
  const project = AppState.currentProject;
  if (!project) return;

  openModal(t('proj.projectActions'), `
    <div class="archive-delete-options">
      <div class="archive-option">
        <div class="archive-option-icon">📦</div>
        <div class="archive-option-body">
          <div class="archive-option-title">${t('proj.moveToArchive')}</div>
          <div class="archive-option-desc">${t('proj.moveToArchiveDesc')}</div>
        </div>
        <button class="btn btn-secondary" id="btn-confirm-archive">${t('proj.archiveBtn')}</button>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:12px 0">
      <div class="archive-option">
        <div class="archive-option-icon">🗑️</div>
        <div class="archive-option-body">
          <div class="archive-option-title" style="color:#dc2626">${t('proj.deletePermanentTitle')}</div>
          <div class="archive-option-desc">${t('proj.permanentDeleteDesc')}</div>
        </div>
        <button class="btn btn-danger" id="btn-go-delete">${t('proj.deleteBtn')}</button>
      </div>
    </div>
  `, []);

  document.getElementById('btn-confirm-archive').addEventListener('click', async () => {
    const btn = document.getElementById('btn-confirm-archive');
    btn.disabled = true; btn.textContent = '...';
    const { error } = await supabaseClient.from('projects').update({ is_active: false }).eq('id', project.id);
    if (error) { showToast(t('proj.archiveError') + error.message, 'error'); btn.disabled = false; btn.textContent = t('proj.archiveBtn'); return; }
    ProjectCache.delete(project.id);
    closeModal();
    showToast(t('proj.projectArchived'), 'success');
    showView('projects');
    await loadProjects();
  });

  document.getElementById('btn-go-delete').addEventListener('click', () => {
    // Step 2 — require typing the project name
    document.getElementById('modal-body').innerHTML = `
      <p style="color:#dc2626;font-weight:600;margin-bottom:8px">${t('proj.irreversibleWarning')}</p>
      <p style="margin-bottom:16px;font-size:14px">${t('proj.typeNameToConfirm')}</p>
      <p style="font-weight:700;margin-bottom:10px;padding:8px;background:var(--bg);border-radius:6px;text-align:center">${escHtml(project.name)}</p>
      <input id="delete-confirm-input" class="form-control" placeholder="${t('proj.typeNamePlaceholder')}" autocomplete="off" />
      <p id="delete-confirm-error" class="error-message hidden" style="margin-top:8px">${t('proj.nameMismatch')}</p>
    `;
    document.getElementById('modal-footer').innerHTML = `
      <button class="btn btn-ghost" id="btn-delete-back">${t('proj.back')}</button>
      <button class="btn btn-danger" id="btn-confirm-delete" disabled>${t('proj.deletePermanentBtn')}</button>
    `;

    const input = document.getElementById('delete-confirm-input');
    const confirmBtn = document.getElementById('btn-confirm-delete');

    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim() !== project.name;
    });

    document.getElementById('btn-delete-back').addEventListener('click', () => promptArchiveOrDelete());

    confirmBtn.addEventListener('click', async () => {
      if (input.value.trim() !== project.name) return;
      confirmBtn.disabled = true; confirmBtn.textContent = t('proj.deleting');
      const { error } = await supabaseClient.from('projects').delete().eq('id', project.id);
      if (error) {
        showToast(t('proj.deleteError') + error.message, 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = t('proj.deletePermanentBtn');
        return;
      }
      ProjectCache.delete(project.id);
      closeModal();
      showToast(t('proj.projectDeletedPermanent'), 'success');
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
  if (cards.length === 0) { showToast(t('proj.noPodsToPrint'), 'error'); return; }

  const items = Array.from(cards).map(btn => ({ code: btn.dataset.podCode, groupLabel: btn.dataset.groupLabel || '' })).filter(i => i.code);
  console.log('[printAllBarcodes] items:', items);
  if (items.length === 0) { showToast(t('proj.noBarcodesFound'), 'error'); return; }

  // Render SVGs into live DOM using a hidden scratch div
  const scratch = document.createElement('div');
  scratch.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;';
  document.body.appendChild(scratch);

  const barcodeItems = items.map(({ code, groupLabel }) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    scratch.appendChild(svg);
    try {
      JsBarcode(svg, code, { format: 'CODE128', width: 3, height: 110, displayValue: false, margin: 0 });
      // Let the barcode stretch to fill the print area vertically (equal margins).
      svg.setAttribute('preserveAspectRatio', 'none');
    } catch (e) { console.error('JsBarcode error', code, e); }
    const svgHtml = svg.outerHTML;
    const groupPart = groupLabel ? `<div class="group-marker">${escHtml(groupLabel)}</div>` : '';
    return `<div class="barcode-item"><div class="content"><div class="bw">${svgHtml}</div><div class="bottom-row">${groupPart}<div class="bc-label">${escHtml(code)}</div></div></div></div>`;
  }).join('');

  document.body.removeChild(scratch);

  // Print area 145mm (14.5cm) wide, 57.2mm tall (proportional to the original
  // 142×56 layout), centered on each page with an equal 5mm (0.5cm) margin on
  // all four sides. The barcode fills the remaining height so the top/bottom
  // margins match the sides instead of leaving extra white space.
  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:155mm 67.2mm;margin:0}
    html,body{background:#fff;font-family:monospace}
    .toolbar{display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:2px solid #e2e8f0;background:#f8fafc}
    .toolbar h2{font-size:15px;flex:1;text-align:center;color:#1e293b}
    .btn-print{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:14px;cursor:pointer}
    .btn-print:hover{background:#1d4ed8}
    .barcode-item{width:155mm;height:67.2mm;overflow:hidden;
      display:flex;align-items:center;justify-content:center;
      page-break-after:always;break-after:page}
    .barcode-item:last-child{page-break-after:auto;break-after:auto}
    .content{
      width:145mm;height:57.2mm;
      display:flex;flex-direction:column;align-items:stretch;gap:2mm;
    }
    .bw{flex:1 1 auto;min-height:0;display:flex;align-items:stretch}
    .bw svg{width:100%;height:100%;display:block}
    .bottom-row{flex:0 0 auto;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:5mm}
    .group-marker{font-size:32pt;font-weight:900;line-height:1;white-space:nowrap}
    .bc-label{font-size:18pt;font-weight:bold;letter-spacing:1.5px;white-space:nowrap}
    @media print{.toolbar{display:none}}
  `;
  const dir = (typeof langDir === 'function') ? langDir(getLang()) : 'rtl';
  const html = `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">
    <title>${t('proj.barcodesTitle')}</title><style>${css}</style></head><body>
    <div class="toolbar">
      <h2>${escHtml(t('proj.barcodesHeader', { name: AppState.currentProject?.name || '', count: items.length }))}</h2>
      <button class="btn-print" onclick="window.print()">${t('common.print')}</button>
    </div>
    ${barcodeItems}
    </body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const printWin = window.open(url, '_blank');
  if (!printWin) { showToast(t('proj.popupBlocked'), 'error'); return; }
  printWin.addEventListener('load', () => {
    printWin.print();
    URL.revokeObjectURL(url);
  });
}
