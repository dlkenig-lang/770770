// =============================================
// Supabase Configuration
// Replace with your actual Supabase project URL and anon key
// =============================================
const SUPABASE_URL = 'https://qiibgzypiljjwjqebyxo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaWJnenlwaWxqandqcWVieXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDg0MDQsImV4cCI6MjA4NzU4NDQwNH0.EKWJxVJkMX3vGzfosXWnQEYZ5iWtMlrg8SmG6xVwqYU';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App state
const AppState = {
  currentUser: null,
  currentProfile: null,
  currentProject: null,
  currentPod: null,
  currentStageCallback: null,
};

// Role constants
const ROLES = {
  ADMIN: 'admin',
  PM: 'project_manager',
  INSPECTOR: 'inspector',
  VIEWER: 'viewer',
};

const ROLE_LABELS = {
  admin: 'מנהל מערכת',
  project_manager: 'מנהל פרויקט',
  inspector: 'בודק',
  viewer: 'צופה',
};

const ROLE_COLORS = {
  admin: '#dc2626',
  project_manager: '#2563eb',
  inspector: '#16a34a',
  viewer: '#64748b',
};

const STATUS_LABELS = {
  pending: 'ממתין',
  in_progress: 'בביצוע',
  completed: 'הושלם',
  failed: 'נכשל',
  passed: 'עבר',
};

function canEdit() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.ADMIN || role === ROLES.PM || role === ROLES.INSPECTOR;
}

function isAdmin() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.ADMIN;
}

function isAdminOrPM() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.ADMIN || role === ROLES.PM;
}

function isInspector() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.INSPECTOR;
}

function isViewer() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.VIEWER;
}

// Format date dd/mm/yyyy
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Format date for input field (yyyy-mm-dd)
function dateToInput(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Parse dd/mm/yy or dd/mm/yyyy to yyyy-mm-dd
function parseDateInput(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    return `${year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return dateStr;
}

// Generate pod code: SVC-220226-T1-R-001
function generatePodCode(projectCode, dateReceived, typeNumber, direction, serial) {
  const d = new Date(dateReceived);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const dateFormatted = `${dd}${mm}${yy}`;
  const serialStr = String(serial).padStart(3, '0');
  return `${projectCode.toUpperCase()}-${dateFormatted}-T${typeNumber}-${direction}-${serialStr}`;
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Show/hide spinner on button
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '⏳ ...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

// Apply role-based visibility
function applyRoleVisibility() {
  const role = AppState.currentProfile?.role;
  // Admin-only
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = (role === ROLES.ADMIN) ? '' : 'none';
  });
  // Admin or PM
  document.querySelectorAll('.pm-only').forEach(el => {
    el.style.display = isAdminOrPM() ? '' : 'none';
  });
  // Inspector
  document.querySelectorAll('.inspector-only').forEach(el => {
    el.style.display = (canEdit()) ? '' : 'none';
  });
}
