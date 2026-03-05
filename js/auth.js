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
        if (rpcErr || !emailData) throw new Error('שם משתמש לא נמצא');
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
      errEl.textContent = 'הסיסמאות אינן תואמות';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      // Check if username is already taken before hitting signUp
      const { data: existingEmail } = await supabaseClient
        .rpc('get_email_by_username', { p_username: username });
      if (existingEmail) {
        errEl.textContent = 'שם המשתמש כבר תפוס, אנא בחר שם אחר';
        errEl.classList.remove('hidden');
        return;
      }

      const pwnedCount = await checkPasswordPwned(password);
      if (pwnedCount > 0) {
        errEl.textContent = `הסיסמה נמצאה ${pwnedCount.toLocaleString()} פעמים בדליפות מידע ידועות. אנא בחר סיסמה אחרת.`;
        errEl.classList.remove('hidden');
        return;
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: fullName, username: username, role: 'viewer' } }
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
    'Database error saving new user': 'שגיאה ביצירת המשתמש — ייתכן ששם המשתמש או האימייל כבר קיימים במערכת',
  };
  for (const [key, val] of Object.entries(map)) {
    if (msg.includes(key)) return val;
  }
  return msg || 'אירעה שגיאה';
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
