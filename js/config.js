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

const ROLE_COLORS = {
  admin: '#dc2626',
  project_manager: '#2563eb',
  inspector: '#16a34a',
  viewer: '#64748b',
};

// Language-aware label maps. Rebuilt from the i18n dictionary on load and
// on every language switch (see refreshI18nLabels + applyLang). Kept as
// plain objects so existing bracket-access and Object.entries() call sites
// keep working unchanged.
// NOTE: declared with `var` (not let/const) so they are properties of the
// global object and free of temporal-dead-zone issues when accessed across
// the separately-loaded script files.
var ROLE_LABELS = {};
var STATUS_LABELS = {};

function refreshI18nLabels() {
  var roleKeys = ['admin', 'project_manager', 'inspector', 'viewer'];
  var statusKeys = ['pending', 'in_progress', 'completed', 'failed', 'passed'];
  ROLE_LABELS = {};
  roleKeys.forEach(function (r) { ROLE_LABELS[r] = t('role.' + r); });
  STATUS_LABELS = {};
  statusKeys.forEach(function (s) { STATUS_LABELS[s] = t('status.' + s); });
}

// Populate immediately (i18n.js loads before config.js).
refreshI18nLabels();

// QC editing gate: fill forms, mark items, sign stages, reopen via "Edit form".
// Includes project_manager since 20260719 (RLS migration 20260719010000).
// NOT used for mold checks — those stay admin+inspector (see canEditMolds).
function canEdit() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.ADMIN || role === ROLES.PM || role === ROLES.INSPECTOR;
}

// Mold checks stay admin+inspector only — their RLS policies (20260712040000)
// were not widened to project_manager.
function canEditMolds() {
  const role = AppState.currentProfile?.role;
  return role === ROLES.ADMIN || role === ROLES.INSPECTOR;
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

// Generate a unit code.
//
// The middle segment has two formats, selected by projectNumber:
//   legacy  (projectNumber empty)  DDMMYY — full date received: SVC-220226-T1-R-001
//   current (projectNumber set)    PPMMYY — project number + month/year of the
//                                  date received: BLN-020726-T1-001
//
// Projects created before the 20260803010000 migration have project_number
// NULL and therefore keep producing legacy codes — existing pod codes must
// never change. New projects always carry a number.
//
// Medical panels have no R/L direction — pass '' / null to omit the segment.
// The serial stays the last 3 chars in both formats, so the serial-based
// sorting everywhere keeps working.
function generatePodCode(projectCode, dateReceived, typeNumber, direction, serial, projectNumber) {
  const d = new Date(dateReceived);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const num = parseInt(projectNumber);
  const prefix = num > 0
    ? String(num).padStart(2, '0')
    : String(d.getDate()).padStart(2, '0');
  const middle = `${prefix}${mm}${yy}`;
  const serialStr = String(serial).padStart(3, '0');
  const dirPart = direction ? `-${direction}` : '';
  return `${projectCode.toUpperCase()}-${middle}-T${typeNumber}${dirPart}-${serialStr}`;
}

// Display label for a project type: "T1 — בסיסי", or just "T1" when no model
// name is set (all pre-20260803020000 rows). The inspector cannot tell T1 from
// T3 by dimensions alone — in the Bilinson project both are 120x244 — so the
// name is shown next to the number everywhere the inspector looks.
function typeLabel(ty) {
  if (!ty) return '';
  const num = `T${ty.type_number ?? ''}`;
  const name = (ty.model_name || '').trim();
  return name ? `${num} — ${name}` : num;
}

// Build a Supabase-Storage-safe object name from a user file name.
// Storage keys reject non-ASCII, so a Hebrew file name ("02-בילינסון-B100.pdf")
// fails the upload with "Invalid key". Only the STORAGE path is sanitised —
// the original name is still stored in the DB and shown to the user.
function safeStorageName(name, fallbackExt = 'bin') {
  const raw = String(name || '');
  const dot = raw.lastIndexOf('.');
  const rawExt = dot > 0 ? raw.slice(dot + 1) : '';
  const ext = (rawExt.replace(/[^A-Za-z0-9]/g, '').toLowerCase() || fallbackExt).slice(0, 10);
  const base = (dot > 0 ? raw.slice(0, dot) : raw)
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}.${ext}`;
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

// Styled confirmation dialog replacing the browser's native confirm().
// Returns Promise<boolean>. Uses its own overlay so it can appear on top of
// an already-open modal (e.g. the mold-check form). ESC / backdrop = cancel.
// opts: { danger: false } for positive actions (blue OK), okLabel: custom text.
function uiConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    document.getElementById('ui-confirm-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'ui-confirm-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10000';
    // escHtml is defined in projects.js — loaded before any user interaction
    overlay.innerHTML = `
      <div class="modal-container modal-sm" role="alertdialog" aria-modal="true">
        <div class="modal-body" style="padding-top:22px">
          <p style="font-size:15px;line-height:1.5;white-space:pre-line;margin:0">${escHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" id="ui-confirm-cancel">${t('common.cancel')}</button>
          <button type="button" class="btn ${opts.danger === false ? 'btn-primary' : 'btn-danger'}" id="ui-confirm-ok">${escHtml(opts.okLabel || t('common.confirm'))}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = (val) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      else if (e.key === 'Enter') { e.stopPropagation(); done(true); }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    overlay.querySelector('#ui-confirm-cancel').addEventListener('click', () => done(false));
    const okBtn = overlay.querySelector('#ui-confirm-ok');
    okBtn.addEventListener('click', () => done(true));
    okBtn.focus();
  });
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
  // Inspector (mold checks — PM excluded, matching mold RLS)
  document.querySelectorAll('.inspector-only').forEach(el => {
    el.style.display = (canEditMolds()) ? '' : 'none';
  });
}
