// =============================================
// Authentication Module
// =============================================

function initAuth() {
  // Switch between auth panels
  document.getElementById('link-forgot').addEventListener('click', (e) => {
    e.preventDefault(); showAuthPanel('forgot');
  });
  document.getElementById('link-register').addEventListener('click', (e) => {
    e.preventDefault(); showAuthPanel('register');
  });
  document.getElementById('link-login-back').addEventListener('click', (e) => {
    e.preventDefault(); showAuthPanel('login');
  });
  document.getElementById('link-login-from-forgot').addEventListener('click', (e) => {
    e.preventDefault(); showAuthPanel('login');
  });

  // Password toggle buttons
  document.querySelectorAll('.btn-show-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.type = target.type === 'password' ? 'text' : 'password';
        btn.textContent = target.type === 'password' ? '👁' : '🙈';
      }
    });
  });

  // Login form
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = e.submitter;

    errEl.classList.add('hidden');
    setLoading(btn, true);

    try {
      let loginEmail = email;
      if (!email.includes('@')) {
        const { data: emailData, error: rpcErr } = await supabaseClient
          .rpc('get_email_by_username', { p_username: email });
        if (rpcErr || !emailData) throw new Error(t('auth.usernameNotFound'));
        loginEmail = emailData;
      }
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // Register form
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const errEl = document.getElementById('register-error');
    const sucEl = document.getElementById('register-success');
    const btn = e.submitter;

    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');

    if (password !== password2) {
      errEl.textContent = t('auth.passwordsMismatch');
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      // Check if username is already taken before hitting signUp.
      // Uses username_exists (boolean) — never expose emails to anon callers.
      const { data: usernameTaken } = await supabaseClient
        .rpc('username_exists', { p_username: username });
      if (usernameTaken) {
        errEl.textContent = t('auth.usernameTaken');
        errEl.classList.remove('hidden');
        return;
      }

      const pwnedCount = await checkPasswordPwned(password);
      if (pwnedCount > 5) {
        errEl.textContent = t('auth.pwnedPassword', { count: pwnedCount.toLocaleString() });
        errEl.classList.remove('hidden');
        return;
      }

      // NOTE: role is assigned server-side (handle_new_user trigger) and is
      // never taken from client metadata. New accounts start inactive and
      // wait for admin approval in the users screen.
      const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, username: username } }
      });
      if (error) throw error;
      sucEl.textContent = t('auth.registerSuccess');
      sucEl.classList.remove('hidden');
      e.target.reset();
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // Forgot password form
  document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    const errEl = document.getElementById('forgot-error');
    const sucEl = document.getElementById('forgot-success');
    const btn = e.submitter;

    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');
    setLoading(btn, true);

    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '?type=recovery'
      });
      if (error) throw error;
      // Mark this browser as expecting a password reset so we can detect it
      // even if the return URL doesn't contain type=recovery (PKCE flow)
      sessionStorage.setItem('pendingPasswordReset', '1');
      sucEl.textContent = t('auth.resetLinkSent');
      sucEl.classList.remove('hidden');
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // Reset password form (arrived from email link)
  document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('reset-password').value;
    const password2 = document.getElementById('reset-password2').value;
    const errEl = document.getElementById('reset-error');
    const sucEl = document.getElementById('reset-success');
    const btn = e.submitter;

    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');

    if (password !== password2) {
      errEl.textContent = t('auth.passwordsMismatch');
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      sucEl.textContent = t('auth.passwordUpdated');
      sucEl.classList.remove('hidden');
      e.target.reset();
      // Clear recovery mode and reload cleanly — removes token from URL hash
      window._passwordRecoveryMode = false;
      setTimeout(() => window.location.replace(window.location.pathname), 1500);
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // Logout (desktop + mobile)
  async function doLogout() {
    try {
      await Promise.race([
        supabaseClient.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch (e) {
      console.warn('signOut error:', e);
    } finally {
      window.location.reload();
    }
  }
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-logout-mobile')?.addEventListener('click', doLogout);

  // ---- MOBILE DRAWER ----
  const sidebar    = document.getElementById('sidebar');
  const backdrop   = document.getElementById('mobile-backdrop');
  const hamburger  = document.getElementById('btn-hamburger');

  // Use window.innerWidth (physical pixels, RTL-immune) to position the drawer.
  const DRAWER_W = 260;
  const MOBILE_BP = 768;
  const isMobileView = () => window.innerWidth <= MOBILE_BP;
  const isLtr = () => document.documentElement.getAttribute('dir') === 'ltr';

  // Off-screen / open X positions depend on reading direction.
  // RTL: drawer lives on the right → off-screen at innerWidth, open at innerWidth-W.
  // LTR: drawer lives on the left  → off-screen at -W,          open at 0.
  const closedLeft = () => (isLtr() ? -DRAWER_W : window.innerWidth);
  const openLeft   = () => (isLtr() ? 0 : window.innerWidth - DRAWER_W);

  function openDrawer() {
    if (!sidebar || !isMobileView()) return;
    sidebar.style.left = openLeft() + 'px';
    backdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!sidebar) return;
    backdrop?.classList.remove('open');
    document.body.style.overflow = '';
    // On desktop the sidebar is a fixed rail positioned by CSS — never leave an
    // inline left behind (it would win over the LTR stylesheet and hide the rail).
    if (isMobileView()) sidebar.style.left = closedLeft() + 'px';
    else sidebar.style.left = '';
  }

  // Keep the drawer/rail correctly positioned across viewport or language changes.
  function syncDrawer() {
    if (!sidebar) return;
    if (!isMobileView()) {
      // Desktop: hand positioning back to CSS.
      sidebar.style.left = '';
      backdrop?.classList.remove('open');
      document.body.style.overflow = '';
      return;
    }
    sidebar.style.left = (backdrop?.classList.contains('open') ? openLeft() : closedLeft()) + 'px';
  }
  window.addEventListener('resize', syncDrawer);
  // Re-sync after a language switch (direction may have flipped).
  window.addEventListener('languagechange:app', syncDrawer);
  syncDrawer();

  hamburger?.addEventListener('click', openDrawer);
  backdrop?.addEventListener('click', closeDrawer);

  // Close drawer when a nav item is tapped
  sidebar?.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', closeDrawer);
  });
}

function showAuthPanel(panel) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`auth-${panel}`)?.classList.add('active');
}

function translateAuthError(msg) {
  const map = {
    'Invalid login credentials': 'auth.errInvalidCredentials',
    'Email not confirmed': 'auth.errEmailNotConfirmed',
    'User already registered': 'auth.errUserRegistered',
    'Password should be at least 6 characters': 'auth.errPasswordShort',
    'Unable to validate email address: invalid format': 'auth.errInvalidEmail',
    'For security purposes, you can only request this after': 'auth.errRateLimit',
    'Database error saving new user': 'auth.errDbUser',
  };
  for (const [key, keyName] of Object.entries(map)) {
    if (msg.includes(key)) return t(keyName);
  }
  return msg || t('auth.errGeneric');
}

async function checkPasswordPwned(password) {
  try {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(password));
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }
    });
    if (!res.ok) return 0; // אם ה-API לא זמין - לא לחסום

    const text = await res.text();
    const match = text.split('\n').find(line => line.startsWith(suffix));
    return match ? parseInt(match.split(':')[1], 10) : 0;
  } catch {
    return 0; // שגיאת רשת - לא לחסום
  }
}

async function loadCurrentProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('Profile load error:', error);
    return null;
  }
  return data;
}
