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
            <th>שם</th><th>אימייל</th><th>תפקיד</th><th>פעיל</th><th>נוצר ב</th><th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escHtml(u.full_name)}</td>
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

  // Role change
  container.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const { error } = await supabaseClient.from('profiles')
        .update({ role: sel.value }).eq('id', sel.dataset.userId);
      if (error) { showToast('שגיאה', 'error'); return; }
      showToast('תפקיד עודכן', 'success');
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
    // Load profile
    const profile = await loadCurrentProfile(session.user.id);
    if (!profile) {
      // Create profile if missing — ignoreDuplicates prevents overwriting an existing role
      await supabaseClient.from('profiles').upsert({
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || session.user.email,
        role: 'viewer',
      }, { onConflict: 'id', ignoreDuplicates: true });
      AppState.currentProfile = await loadCurrentProfile(session.user.id);
    } else {
      AppState.currentProfile = profile;
    }

    AppState.currentUser = session.user;

    // Update navbar
    document.getElementById('nav-user-name').textContent = AppState.currentProfile?.full_name || '';
    const roleEl = document.getElementById('nav-user-role');
    roleEl.textContent = ROLE_LABELS[AppState.currentProfile?.role] || '';
    roleEl.style.background = ROLE_COLORS[AppState.currentProfile?.role] + '20';
    roleEl.style.color = ROLE_COLORS[AppState.currentProfile?.role];

    applyRoleVisibility();

    // Show app
    loadingEl.classList.add('hidden');
    authEl.style.display = 'none';
    appEl.classList.remove('hidden');

    // Load dashboard
    showView('dashboard');
    await loadDashboard();
  } else {
    AppState.currentUser = null;
    AppState.currentProfile = null;

    loadingEl.classList.add('hidden');
    appEl.classList.add('hidden');
    authEl.style.display = 'flex';
    showAuthPanel('login');
  }
}

// ---- INIT ----
async function init() {
  // Auth
  initAuth();
  initSignatureModal();
  initPodDetailButtons();

  // Listen for auth changes — Supabase fires INITIAL_SESSION immediately on load,
  // so no need for a separate getSession() call (which would double all queries).
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') {
      if (!session) {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screen').style.display = 'flex';
      } else {
        await onAuthStateChange(session);
      }
    } else {
      await onAuthStateChange(session);
    }
  });
}

// Start app
init();
