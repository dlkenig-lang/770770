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
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
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
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const errEl = document.getElementById('register-error');
    const sucEl = document.getElementById('register-success');
    const btn = e.submitter;

    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');

    if (password !== password2) {
      errEl.textContent = 'הסיסמאות אינן תואמות';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, role: 'viewer' } }
      });
      if (error) throw error;
      sucEl.textContent = 'נרשמת בהצלחה! בדוק את האימייל שלך לאישור.';
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
        redirectTo: window.location.origin + '/#reset-password'
      });
      if (error) throw error;
      sucEl.textContent = 'קישור לאיפוס סיסמה נשלח לאימייל שלך';
      sucEl.classList.remove('hidden');
    } catch (err) {
      errEl.textContent = translateAuthError(err.message);
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });
}

function showAuthPanel(panel) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`auth-${panel}`)?.classList.add('active');
}

function translateAuthError(msg) {
  const map = {
    'Invalid login credentials': 'אימייל או סיסמה שגויים',
    'Email not confirmed': 'יש לאמת את האימייל תחילה',
    'User already registered': 'משתמש עם אימייל זה כבר קיים',
    'Password should be at least 6 characters': 'הסיסמה חייבת להיות לפחות 6 תווים',
    'Unable to validate email address: invalid format': 'כתובת האימייל אינה תקינה',
    'For security purposes, you can only request this after': 'לצרכי אבטחה, יש להמתין מספר שניות לפני בקשה חדשה',
  };
  for (const [key, val] of Object.entries(map)) {
    if (msg.includes(key)) return val;
  }
  return msg || 'אירעה שגיאה';
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
