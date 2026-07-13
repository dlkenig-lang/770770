// =============================================
// Main App Module - Initialization & Routing
// =============================================

// Detect password-recovery BEFORE any auth events fire.
// Works for both implicit flow (type=recovery in hash/search)
// and PKCE flow (no type in URL — we rely on sessionStorage set by the forgot-password form,
// or on the custom redirectTo we append ?type=recovery to).
window._passwordRecoveryMode = (function () {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const fromUrl = hash.includes('type=recovery') || search.includes('type=recovery');
  const fromStorage = sessionStorage.getItem('pendingPasswordReset') === '1';
  if (fromUrl || fromStorage) {
    sessionStorage.removeItem('pendingPasswordReset');
    return true;
  }
  return false;
})();

// Flag: page arrived via a Supabase PKCE redirect (has ?code= in URL).
// Used to delay SIGNED_IN handling so PASSWORD_RECOVERY can fire first.
window._pkceCodeInUrl = window.location.search.includes('code=') || window.location.hash.includes('code=');

// ---- USER DISPLAY HELPER ----
// Updates both desktop navbar AND mobile sidebar drawer
function updateUserDisplay(profile) {
  const name  = profile?.full_name || '';
  const role  = profile?.role;
  const label = ROLE_LABELS[role] || '';
  const bg    = (ROLE_COLORS[role] || '#94a3b8') + '20';
  const color = ROLE_COLORS[role]  || '#94a3b8';

  // Desktop navbar
  const navName = document.getElementById('nav-user-name');
  const navRole = document.getElementById('nav-user-role');
  if (navName) navName.textContent = name;
  if (navRole) { navRole.textContent = label; navRole.style.background = bg; navRole.style.color = color; }

  // Mobile sidebar header
  const sbName = document.getElementById('sidebar-user-name');
  const sbRole = document.getElementById('sidebar-user-role');
  if (sbName) sbName.textContent = name;
  if (sbRole) { sbRole.textContent = label; sbRole.style.background = bg; sbRole.style.color = color; }
}

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
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">${t('users.none')}</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>${t('users.hName')}</th><th>${t('users.hUsername')}</th><th>${t('users.hEmail')}</th><th>${t('users.hRole')}</th><th>${t('users.hActive')}</th><th>${t('users.hCreated')}</th><th>${t('users.hActions')}</th>
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
                      ${u.is_active ? t('users.deactivate') : t('users.activate')}
                    </button>
                  ` : `<span class="text-muted text-sm">${t('common.you')}</span>`}
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
    // Track the last confirmed value so a failed update can be reverted
    sel.dataset.prevValue = sel.value;
    sel.addEventListener('change', async () => {
      const prevValue = sel.dataset.prevValue || sel.querySelector('option[selected]')?.value;
      const newRole = sel.value;

      const { data, error } = await supabaseClient.from('profiles')
        .update({ role: newRole }).eq('id', sel.dataset.userId).select('id');
      if (error || !data?.length) {
        console.error('[role-change] error:', error);
        const detail = error?.message || t('users.noRowUpdated');
        showToast(t('users.roleUpdateError') + ': ' + detail, 'error');
        sel.value = prevValue || sel.value;
        return;
      }
      sel.dataset.prevValue = newRole;
      showToast(t('users.roleUpdated'), 'success');
      updateSingleRoleOptions();
      // Refresh navbar if current user's role was changed
      if (sel.dataset.userId === AppState.currentProfile?.id) {
        AppState.currentProfile.role = sel.value;
        updateUserDisplay(AppState.currentProfile);
        applyRoleVisibility();
      }
    });
  });

  // Toggle active
  container.querySelectorAll('.btn-toggle-active').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newActive = btn.dataset.active !== 'true';
      // .select() so an RLS-silent no-op (0 rows) is detected, not just errors
      const { data, error } = await supabaseClient.from('profiles')
        .update({ is_active: newActive }).eq('id', btn.dataset.userId).select('id');
      if (error || !data?.length) {
        console.error('[toggle-active] error:', error);
        const detail = error?.message || t('users.noRowUpdated');
        showToast(t('common.error') + ': ' + detail, 'error');
        return;
      }
      showToast(t('users.updated'), 'success');
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
document.getElementById('btn-print-all-barcodes')?.addEventListener('click', () => {
  printAllBarcodes();
});
document.getElementById('btn-add-group')?.addEventListener('click', () => {
  if (AppState.currentProject) showGroupModal(AppState.currentProject.id);
});
document.getElementById('btn-edit-project')?.addEventListener('click', () => {
  activateTab('details');
});
document.getElementById('btn-project-actions')?.addEventListener('click', () => {
  promptArchiveOrDelete();
});

// ---- PENDING-APPROVAL / DEACTIVATED HANDLING ----
// New users register as is_active=false and RLS hides all data from them.
// Show a clear message on the login screen instead of an empty app.
async function showPendingApprovalScreen(userId) {
  try { localStorage.removeItem('modu_profile_' + (userId || '')); } catch (e) {}
  AppState.currentUser = null;
  AppState.currentProfile = null;
  try {
    await Promise.race([
      supabaseClient.auth.signOut(),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
  } catch (e) { /* ignore */ }
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').style.display = 'flex';
  showAuthPanel('login');
  const errEl = document.getElementById('login-error');
  if (errEl) {
    errEl.textContent = t('auth.pendingApproval');
    errEl.classList.remove('hidden');
  }
}

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

    // Load profile: cache-first so the dashboard never waits for a slow network.
    // 1. Use localStorage immediately if available.
    const cacheKey = 'modu_profile_' + session.user.id;
    let profile = null;
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try { profile = JSON.parse(cachedStr); } catch (e) {}
    }

    if (profile) {
      if (profile.is_active === false) {
        await showPendingApprovalScreen(session.user.id);
        return;
      }
      // Set profile from cache so dashboard loads instantly.
      AppState.currentProfile = profile;
      // Refresh from network in background — no await, no blocking.
      loadCurrentProfile(session.user.id).then(fresh => {
        if (fresh) {
          if (fresh.is_active === false) {
            showPendingApprovalScreen(session.user.id);
            return;
          }
          try { localStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch (e) {}
          AppState.currentProfile = fresh;
          updateUserDisplay(fresh);
          applyRoleVisibility();
        }
      }).catch(() => {});
    } else {
      // No cache — first login or cleared storage. Fetch with short timeout.
      console.time('[LOAD] profile');
      profile = await Promise.race([
        loadCurrentProfile(session.user.id),
        new Promise(resolve => setTimeout(() => resolve(null), 3000)),
      ]);
      console.timeEnd('[LOAD] profile');

      if (!profile) {
        // New user: upsert profile row then re-fetch once (background, non-blocking).
        // RLS only allows self-insert as an inactive viewer (pending admin approval).
        profile = {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.email,
          username: session.user.user_metadata?.username || session.user.email.split('@')[0],
          role: 'viewer',
          is_active: true,
        };
        console.warn('[LOAD] no profile found, using default role=viewer');
        supabaseClient.from('profiles').upsert({
          id: profile.id, email: profile.email,
          full_name: profile.full_name, username: profile.username,
          role: 'viewer', is_active: false,
        }, { onConflict: 'id', ignoreDuplicates: true })
          .then(() => loadCurrentProfile(session.user.id))
          .then(fresh => {
            if (fresh) {
              if (fresh.is_active === false) {
                showPendingApprovalScreen(session.user.id);
                return;
              }
              try { localStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch (e) {}
              AppState.currentProfile = fresh;
              updateUserDisplay(fresh);
              applyRoleVisibility();
            }
          }).catch(() => {});
      } else {
        if (profile.is_active === false) {
          await showPendingApprovalScreen(session.user.id);
          return;
        }
        try { localStorage.setItem(cacheKey, JSON.stringify(profile)); } catch (e) {}
      }
      AppState.currentProfile = profile;
    }

    // Update navbar + sidebar drawer
    updateUserDisplay(AppState.currentProfile);
    applyRoleVisibility();

    // Load dashboard
    console.time('[LOAD] dashboard');
    await loadDashboard();
    console.timeEnd('[LOAD] dashboard');
    console.timeEnd('[LOAD] total');


    // Handle ?pod= deep link (e.g. from shared email)
    const urlParams = new URLSearchParams(window.location.search);
    const deepPodId = urlParams.get('pod');
    if (deepPodId) {
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
      await openPod(deepPodId);
    }
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

  function openProfileModal() {
    nameInput.value = AppState.currentProfile?.full_name || '';
    errEl.classList.add('hidden');
    modal.classList.remove('hidden');
    nameInput.focus();
  }
  document.getElementById('btn-edit-profile').addEventListener('click', openProfileModal);
  document.getElementById('btn-edit-profile-mobile')?.addEventListener('click', openProfileModal);

  const closeModal = () => modal.classList.add('hidden');
  document.getElementById('profile-modal-close').addEventListener('click', closeModal);
  document.getElementById('profile-modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.getElementById('profile-modal-save').addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    errEl.classList.add('hidden');
    if (!newName) {
      errEl.textContent = t('profile.enterName');
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
      errEl.textContent = t('proj.saveErrorColon') + (error.message || error);
      errEl.classList.remove('hidden');
      return;
    }

    AppState.currentProfile.full_name = newName;
    updateUserDisplay(AppState.currentProfile);
    closeModal();
    showToast(t('profile.updated'), 'success');
  });
}

// ---- LANGUAGE RE-RENDER ----
// Called by i18n.applyLang after a language switch. Re-runs the loader for
// whichever view is active so dynamically-generated (JS) content is rebuilt
// in the new language, preserving the current project/pod context.
window.rerenderCurrentView = function rerenderCurrentView() {
  // Nothing to re-render until the user is authenticated and the app is shown.
  if (!AppState.currentUser) return;

  // Refresh role/name chips (role label is language-dependent).
  if (AppState.currentProfile) updateUserDisplay(AppState.currentProfile);

  const active = document.querySelector('.view.active');
  if (!active) return;
  const view = active.id.replace('view-', '');

  switch (view) {
    case 'dashboard':       loadDashboard(); break;
    case 'projects':        loadProjects(); break;
    case 'users':           loadUsersView(); break;
    case 'reports':         loadReportsView(); break;
    case 'project-detail':  if (AppState.currentProject) openProject(AppState.currentProject.id); break;
    case 'pod-detail':      if (AppState.currentPod) openPod(AppState.currentPod.id); break;
  }
};

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
  let _pendingSessionTimer = null;

  function showRecoveryPanel() {
    if (_pendingSessionTimer) { clearTimeout(_pendingSessionTimer); _pendingSessionTimer = null; }
    window._passwordRecoveryMode = true;
    _initializedUserId = null;
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-screen').style.display = 'flex';
    showAuthPanel('reset');
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showRecoveryPanel();
      return;
    }
    // Block any event while in password-recovery flow.
    if (window._passwordRecoveryMode) {
      showRecoveryPanel();
      return;
    }
    if (event === 'INITIAL_SESSION') {
      if (!session) {
        // If code is in URL, Supabase is mid-PKCE exchange — keep spinner and wait
        // for SIGNED_IN / PASSWORD_RECOVERY instead of showing login prematurely.
        if (window._pkceCodeInUrl) return;
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screen').style.display = 'flex';
      } else {
        _initializedUserId = session.user.id;
        await onAuthStateChange(session);
      }
    } else if (event === 'SIGNED_IN') {
      // Skip if we already initialized for this exact user (avoids double-init)
      if (session?.user?.id && session.user.id === _initializedUserId) return;
      if (window._pkceCodeInUrl) {
        // Delay app opening briefly so PASSWORD_RECOVERY can fire first if this is recovery
        _pendingSessionTimer = setTimeout(async () => {
          _pendingSessionTimer = null;
          if (!window._passwordRecoveryMode) {
            _initializedUserId = session?.user?.id ?? null;
            await onAuthStateChange(session);
          }
        }, 300);
        return;
      }
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
