// =============================================
// Main App Module - Initialization & Routing
// =============================================

// ---- MODAL HELPERS ----
function openModal(title, bodyHtml, buttons = []) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = buttons.map(b =>
    `<button class="btn ${b.cls}" id="${b.id}">${b.label}</button>`
  ).join('');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ---- VIEW ROUTING ----
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`)?.classList.add('active');

  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName ||
      (viewName === 'project-detail' && item.dataset.view === 'projects') ||
      (viewName === 'pod-detail' && item.dataset.view === 'projects'));
  });
}

// ---- TAB SWITCHING ----
function activateTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

// ---- SIDEBAR NAVIGATION ----
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', async (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    showView(view);
    if (view === 'dashboard') await loadDashboard();
    else if (view === 'projects') await loadProjects();
    else if (view === 'users') await loadUsersView();
    else if (view === 'reports') await loadReportsView();
  });
});

// ---- USERS VIEW ----
async function loadUsersView() {
  const { data: users, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const container = document.getElementById('users-list');

  if (!users || users.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">אין משתמשים</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>שם</th><th>שם משתמש</th><th>אימייל</th><th>תפקיד</th><th>פעיל</th><th>נוצר ב</th><th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escHtml(u.full_name)}</td>
              <td><code>${escHtml(u.username || '—')}</code></td>
              <td>${escHtml(u.email)}</td>
              <td>
                <select class="role-select" data-user-id="${u.id}" ${u.id === AppState.currentProfile?.id ? 'disabled' : ''}>
                  ${Object.entries(ROLE_LABELS).map(([v, l]) =>
                    `<option value="${v}" ${u.role === v ? 'selected' : ''}>${l}</option>`
                  ).join('')}
                </select>
              </td>
              <td>${u.is_active ? '✅' : '❌'}</td>
              <td>${formatDate(u.created_at?.split('T')[0])}</td>
              <td>
                <div class="table-actions">
                  ${u.id !== AppState.currentProfile?.id ? `
                    <button class="btn btn-secondary btn-sm btn-toggle-active" data-user-id="${u.id}" data-active="${u.is_active}">
                      ${u.is_active ? 'השבת' : 'הפעל'}
                    </button>
                  ` : '<span class="text-muted text-sm">אתה</span>'}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const SINGLE_ROLES = ['project_manager', 'inspector'];

  function updateSingleRoleOptions() {
    const allSelects = [...container.querySelectorAll('.role-select')];
    const takenRoles = new Set(allSelects.map(s => s.value).filter(v => SINGLE_ROLES.includes(v)));
    allSelects.forEach(sel => {
      SINGLE_ROLES.forEach(role => {
        const opt = sel.querySelector(`option[value="${role}"]`);
        if (!opt) return;
        const takenByOther = takenRoles.has(role) && sel.value !== role;
        opt.disabled = takenByOther;
        opt.style.color = takenByOther ? '#aaa' : '';
      });
    });
  }

  updateSingleRoleOptions();

  // Role change
  container.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const prevValue = sel.dataset.prevValue || sel.querySelector('option[selected]')?.value;
      const newRole = sel.value;

      const { data, error } = await supabaseClient.from('profiles')
        .update({ role: newRole }).eq('id', sel.dataset.userId).select('id');
      if (error || !data?.length) {
        showToast('שגיאה בעדכון תפקיד — אין הרשאה', 'error');
        sel.value = prevValue || sel.value;
        return;
      }
      showToast('תפקיד עודכן', 'success');
      updateSingleRoleOptions();
      // Refresh navbar if current user's role was changed
      if (sel.dataset.userId === AppState.currentProfile?.id) {
        AppState.currentProfile.role = sel.value;
        const roleEl = document.getElementById('nav-user-role');
        roleEl.textContent = ROLE_LABELS[sel.value] || sel.value;
        roleEl.style.background = (ROLE_COLORS[sel.value] || '#64748b') + '20';
        roleEl.style.color = ROLE_COLORS[sel.value] || '#64748b';
        applyRoleVisibility();
      }
    });
  });

  // Toggle active
  container.querySelectorAll('.btn-toggle-active').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newActive = btn.dataset.active !== 'true';
      const { error } = await supabaseClient.from('profiles')
        .update({ is_active: newActive }).eq('id', btn.dataset.userId);
      if (error) { showToast('שגיאה', 'error'); return; }
      showToast('עודכן', 'success');
      await loadUsersView();
    });
  });
}

// ---- PROJECT NAVIGATION ----
document.getElementById('btn-back-projects')?.addEventListener('click', async () => {
  showView('projects');
  await loadProjects();
});

document.getElementById('btn-new-project')?.addEventListener('click', showNewProjectModal);
document.getElementById('btn-add-pod')?.addEventListener('click', () => {
  if (AppState.currentProject) showAddPodModal(AppState.currentProject.id);
});
document.getElementById('btn-add-group')?.addEventListener('click', () => {
  if (AppState.currentProject) showGroupModal(AppState.currentProject.id);
});
document.getElementById('btn-edit-project')?.addEventListener('click', () => {
  activateTab('details');
});

// ---- AUTH STATE CHANGE ----
async function onAuthStateChange(session) {
  const loadingEl = document.getElementById('loading-screen');
  const appEl = document.getElementById('app');
  const authEl = document.getElementById('auth-screen');

  if (session) {
    console.time('[LOAD] total');

    // Show app shell immediately — don't wait for DB
    AppState.currentUser = session.user;
    loadingEl.classList.add('hidden');
    authEl.style.display = 'none';
    appEl.classList.remove('hidden');
    showView('dashboard');

    // Load profile — with 5 s timeout so a network hang never blocks the dashboard.
    console.time('[LOAD] profile');
    let profile = await Promise.race([
      loadCurrentProfile(session.user.id),
      new Promise(resolve => setTimeout(() => resolve(null), 5000)),
    ]);
    console.timeEnd('[LOAD] profile');

    if (!profile) {
      // Profile missing or timed-out — try upsert then re-fetch, each with timeout.
      try {
        await Promise.race([
          supabaseClient.from('profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email,
            username: session.user.user_metadata?.username || session.user.email.split('@')[0],
            role: 'viewer',
          }, { onConflict: 'id', ignoreDuplicates: true }),
          new Promise(resolve => setTimeout(() => resolve(null), 4000)),
        ]);
        profile = await Promise.race([
          loadCurrentProfile(session.user.id),
          new Promise(resolve => setTimeout(() => resolve(null), 4000)),
        ]);
      } catch (e) {
        console.warn('[LOAD] profile upsert failed:', e);
      }
    }
    AppState.currentProfile = profile;

    // Update navbar
    document.getElementById('nav-user-name').textContent = AppState.currentProfile?.full_name || '';
    const roleEl = document.getElementById('nav-user-role');
    roleEl.textContent = ROLE_LABELS[AppState.currentProfile?.role] || '';
    roleEl.style.background = ROLE_COLORS[AppState.currentProfile?.role] + '20';
    roleEl.style.color = ROLE_COLORS[AppState.currentProfile?.role];

    applyRoleVisibility();

    // Load dashboard
    console.time('[LOAD] dashboard');
    await loadDashboard();
    console.timeEnd('[LOAD] dashboard');
    console.timeEnd('[LOAD] total');
  } else {
    AppState.currentUser = null;
    AppState.currentProfile = null;

    loadingEl.classList.add('hidden');
    appEl.classList.add('hidden');
    authEl.style.display = 'flex';
    showAuthPanel('login');
  }
}

// ---- PROFILE MODAL ----
function initProfileModal() {
  const modal = document.getElementById('profile-modal');
  const nameInput = document.getElementById('profile-display-name');
  const errEl = document.getElementById('profile-modal-error');

  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    nameInput.value = AppState.currentProfile?.full_name || '';
    errEl.classList.add('hidden');
    modal.classList.remove('hidden');
    nameInput.focus();
  });

  const closeModal = () => modal.classList.add('hidden');
  document.getElementById('profile-modal-close').addEventListener('click', closeModal);
  document.getElementById('profile-modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.getElementById('profile-modal-save').addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    errEl.classList.add('hidden');
    if (!newName) {
      errEl.textContent = 'יש להזין שם תצוגה';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('profile-modal-save');
    setLoading(btn, true);
    let error;
    try {
      ({ error } = await supabaseClient.from('profiles')
        .update({ full_name: newName }).eq('id', AppState.currentProfile.id));
    } catch (e) {
      error = e;
    } finally {
      setLoading(btn, false);
    }

    if (error) {
      errEl.textContent = 'שגיאה בשמירה: ' + (error.message || error);
      errEl.classList.remove('hidden');
      return;
    }

    AppState.currentProfile.full_name = newName;
    document.getElementById('nav-user-name').textContent = newName;
    closeModal();
    showToast('שם תצוגה עודכן', 'success');
  });
}

// ---- INIT ----
async function init() {
  // Auth
  initAuth();
  initSignatureModal();
  initPodDetailButtons();
  initProfileModal();

  // Listen for auth changes.
  // Guard against double-firing: Supabase can emit both INITIAL_SESSION and
  // SIGNED_IN on the same page load. We only initialize once per user session.
  let _initializedUserId = null;
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('auth-screen').style.display = 'flex';
      showAuthPanel('reset');
      return;
    }
    if (event === 'INITIAL_SESSION') {
      if (!session) {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screen').style.display = 'flex';
      } else {
        _initializedUserId = session.user.id;
        await onAuthStateChange(session);
      }
    } else if (event === 'SIGNED_IN') {
      // Skip if we already initialized for this exact user (avoids double-init)
      if (session?.user?.id && session.user.id === _initializedUserId) return;
      _initializedUserId = session?.user?.id ?? null;
      await onAuthStateChange(session);
    } else if (event === 'SIGNED_OUT') {
      _initializedUserId = null;
      await onAuthStateChange(null);
    }
    // TOKEN_REFRESHED and other events: ignore — no UI reinit needed
  });
}

// Start app
init();
