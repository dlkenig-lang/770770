// =============================================
// i18n — Multi-language support (Hebrew / English)
// Language is persisted in localStorage ('app_lang').
// Hebrew = RTL, English = LTR (full layout flip).
// =============================================

const I18N_LANG_KEY = 'app_lang';
const I18N_DEFAULT = 'he';
const I18N_SUPPORTED = ['he', 'en'];

// ---- Translation dictionary ----
// Keys are namespaced (e.g. 'nav.logout'). Missing English keys fall
// back to Hebrew, then to the raw key, so partial translation is safe.
const I18N = {
  he: {
    // App / document
    'app.title': 'בקרת איכות - ייצור פודים',

    // Common
    'common.back': '← חזרה',
    'common.edit': 'עריכה',
    'common.save': 'שמור',
    'common.cancel': 'ביטול',
    'common.clear': 'נקה',
    'common.print': '🖨️ הדפס',
    'common.date': 'תאריך',
    'common.you': 'אתה',

    // Navbar
    'nav.editProfileTitle': 'ערוך שם תצוגה',
    'nav.logout': 'התנתק',
    'nav.menu': 'תפריט',
    'nav.dashboard': 'לוח בקרה',
    'nav.projects': 'פרויקטים',
    'nav.users': 'ניהול משתמשים',
    'nav.reports': 'דוחות',

    // Sidebar
    'sidebar.scan': '📷 סרוק',
    'sidebar.scanTitle': 'סרוק ברקוד פוד',
    'sidebar.logout': '🚪 התנתק',

    // Language switcher
    'lang.he': 'עב',
    'lang.en': 'EN',
    'lang.title': 'בחר שפה',

    // Dashboard
    'dashboard.title': 'לוח בקרה',
    'dashboard.activeProjects': 'פרויקטים פעילים',

    // Projects
    'projects.title': 'פרויקטים',
    'projects.new': '+ פרויקט חדש',
    'projects.archive': '📦 ארכיון פרויקטים',
    'projectDetail.title': 'פרויקט',
    'projectDetail.actionsTitle': 'ארכיון / מחיקה',

    // Tabs
    'tabs.pods': 'פודים',
    'tabs.groups': 'קבוצות ביצוע',
    'tabs.details': 'פרטים נוספים',
    'tabs.plans': 'תוכניות',

    // Filters
    'filter.allGroups': 'כל הקבוצות',
    'filter.allTypes': 'כל הטיפוסים',
    'filter.allDirections': 'כל הכיוונים',
    'filter.allStatuses': 'כל הסטטוסים',
    'filter.allPods': 'כל הפודים',
    'filter.castingApproved': 'מאושרים ליציקה',
    'filter.castingNotApproved': 'לא מאושרים ליציקה',

    // Status labels
    'status.pending': 'ממתין',
    'status.in_progress': 'בביצוע',
    'status.completed': 'הושלם',
    'status.failed': 'נכשל',
    'status.passed': 'עבר',

    // Role labels
    'role.admin': 'מנהל מערכת',
    'role.project_manager': 'מנהל פרויקט',
    'role.inspector': 'בודק',
    'role.viewer': 'צופה',

    // Directions
    'direction.R': 'ימין (R)',
    'direction.L': 'שמאל (L)',

    // Pods / barcodes
    'pods.printBarcodes': '🖨️ הדפס ברקודים',
    'pods.printBarcodesTitle': 'הדפס ברקודים לפי סינון',
    'groups.add': '+ הוסף קבוצה',

    // Pod detail
    'pod.backToProject': '← חזרה לפרויקט',
    'pod.castingApproved': '🏗️ מאושר ליציקה',
    'pod.castingApprovedTitle': 'מאושר ליציקה',
    'pod.comments': '💬 הערות',
    'pod.barcode': '🔲 ברקוד',
    'pod.exportPdf': '📄 ייצוא PDF',

    // Users
    'users.title': 'ניהול משתמשים',

    // Reports
    'reports.title': 'דוחות',

    // Auth
    'auth.loginSubtitle': 'כניסה למערכת',
    'auth.registerSubtitle': 'הרשמה למערכת',
    'auth.forgotSubtitle': 'שחזור סיסמה',
    'auth.resetSubtitle': 'הגדרת סיסמה חדשה',
    'auth.emailOrUsername': 'אימייל או שם משתמש',
    'auth.email': 'אימייל',
    'auth.password': 'סיסמה',
    'auth.login': 'כניסה',
    'auth.forgot': 'שכחתי סיסמה',
    'auth.register': 'הרשמה',
    'auth.fullName': 'שם מלא',
    'auth.fullNamePlaceholder': 'ישראל ישראלי',
    'auth.username': 'שם משתמש',
    'auth.usernameHint': 'ישמש לזיהוי בהערות ובדיקות QC · אנגלית בלבד, ללא רווחים',
    'auth.passwordMinPlaceholder': 'לפחות 6 תווים',
    'auth.confirmPassword': 'אימות סיסמה',
    'auth.repeatPassword': 'חזור על הסיסמה',
    'auth.backToLogin': 'חזרה לכניסה',
    'auth.sendReset': 'שלח קישור לאיפוס',
    'auth.newPassword': 'סיסמה חדשה',
    'auth.saveNewPassword': 'שמור סיסמה חדשה',

    // Modals
    'modal.barcodeTitle': 'ברקוד פוד',
    'modal.signatureTitle': 'חתימת בודק',
    'modal.commentsTitle': 'הערות לפוד',
    'modal.shareTitle': 'שיתוף שלב',
    'modal.profileTitle': 'עריכת שם תצוגה',
    'modal.scannerTitle': 'סריקת ברקוד פוד',

    // Signature modal
    'sig.inspectorName': 'שם הבודק *',
    'sig.fullNamePlaceholder': 'שם מלא',
    'sig.signature': 'חתימה *',
    'sig.confirm': 'אשר ושמור',

    // Comments modal
    'comments.addPlaceholder': 'הוסף הערה...',
    'comments.redFlag': 'סמן כדגל אדום (חייב להתייחס)',
    'comments.submit': 'שלח הערה',

    // Share modal
    'share.sendTo': 'שלח אל',
    'share.noteOptional': 'הערה (אופציונלי)',
    'share.sendEmail': '✉️ שלח מייל',

    // Profile modal
    'profile.displayName': 'שם תצוגה',
    'profile.displayNamePlaceholder': 'הכנס שם מלא',

    // Scanner modal
    'scanner.hint': 'הצב את ברקוד הפוד מול המצלמה',
  },

  en: {
    // App / document
    'app.title': 'Quality Control - Pod Production',

    // Common
    'common.back': '← Back',
    'common.edit': 'Edit',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.clear': 'Clear',
    'common.print': '🖨️ Print',
    'common.date': 'Date',
    'common.you': 'You',

    // Navbar
    'nav.editProfileTitle': 'Edit display name',
    'nav.logout': 'Log out',
    'nav.menu': 'Menu',
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.users': 'User Management',
    'nav.reports': 'Reports',

    // Sidebar
    'sidebar.scan': '📷 Scan',
    'sidebar.scanTitle': 'Scan pod barcode',
    'sidebar.logout': '🚪 Log out',

    // Language switcher
    'lang.he': 'עב',
    'lang.en': 'EN',
    'lang.title': 'Select language',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.activeProjects': 'Active Projects',

    // Projects
    'projects.title': 'Projects',
    'projects.new': '+ New Project',
    'projects.archive': '📦 Projects Archive',
    'projectDetail.title': 'Project',
    'projectDetail.actionsTitle': 'Archive / delete',

    // Tabs
    'tabs.pods': 'Pods',
    'tabs.groups': 'Production Groups',
    'tabs.details': 'More Details',
    'tabs.plans': 'Plans',

    // Filters
    'filter.allGroups': 'All groups',
    'filter.allTypes': 'All types',
    'filter.allDirections': 'All directions',
    'filter.allStatuses': 'All statuses',
    'filter.allPods': 'All pods',
    'filter.castingApproved': 'Casting approved',
    'filter.castingNotApproved': 'Casting not approved',

    // Status labels
    'status.pending': 'Pending',
    'status.in_progress': 'In progress',
    'status.completed': 'Completed',
    'status.failed': 'Failed',
    'status.passed': 'Passed',

    // Role labels
    'role.admin': 'System Admin',
    'role.project_manager': 'Project Manager',
    'role.inspector': 'Inspector',
    'role.viewer': 'Viewer',

    // Directions
    'direction.R': 'Right (R)',
    'direction.L': 'Left (L)',

    // Pods / barcodes
    'pods.printBarcodes': '🖨️ Print Barcodes',
    'pods.printBarcodesTitle': 'Print barcodes by filter',
    'groups.add': '+ Add Group',

    // Pod detail
    'pod.backToProject': '← Back to project',
    'pod.castingApproved': '🏗️ Casting approved',
    'pod.castingApprovedTitle': 'Casting approved',
    'pod.comments': '💬 Comments',
    'pod.barcode': '🔲 Barcode',
    'pod.exportPdf': '📄 Export PDF',

    // Users
    'users.title': 'User Management',

    // Reports
    'reports.title': 'Reports',

    // Auth
    'auth.loginSubtitle': 'Sign in',
    'auth.registerSubtitle': 'Register',
    'auth.forgotSubtitle': 'Password recovery',
    'auth.resetSubtitle': 'Set a new password',
    'auth.emailOrUsername': 'Email or username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.login': 'Sign in',
    'auth.forgot': 'Forgot password',
    'auth.register': 'Register',
    'auth.fullName': 'Full name',
    'auth.fullNamePlaceholder': 'John Doe',
    'auth.username': 'Username',
    'auth.usernameHint': 'Used to identify you in comments and QC checks · English only, no spaces',
    'auth.passwordMinPlaceholder': 'At least 6 characters',
    'auth.confirmPassword': 'Confirm password',
    'auth.repeatPassword': 'Repeat password',
    'auth.backToLogin': 'Back to sign in',
    'auth.sendReset': 'Send reset link',
    'auth.newPassword': 'New password',
    'auth.saveNewPassword': 'Save new password',

    // Modals
    'modal.barcodeTitle': 'Pod Barcode',
    'modal.signatureTitle': 'Inspector Signature',
    'modal.commentsTitle': 'Pod Comments',
    'modal.shareTitle': 'Share Stage',
    'modal.profileTitle': 'Edit Display Name',
    'modal.scannerTitle': 'Scan Pod Barcode',

    // Signature modal
    'sig.inspectorName': 'Inspector name *',
    'sig.fullNamePlaceholder': 'Full name',
    'sig.signature': 'Signature *',
    'sig.confirm': 'Confirm & save',

    // Comments modal
    'comments.addPlaceholder': 'Add a comment...',
    'comments.redFlag': 'Mark as red flag (must be addressed)',
    'comments.submit': 'Send comment',

    // Share modal
    'share.sendTo': 'Send to',
    'share.noteOptional': 'Note (optional)',
    'share.sendEmail': '✉️ Send email',

    // Profile modal
    'profile.displayName': 'Display name',
    'profile.displayNamePlaceholder': 'Enter full name',

    // Scanner modal
    'scanner.hint': 'Position the pod barcode in front of the camera',
  },
};

// ---- Core API ----

function getLang() {
  const stored = localStorage.getItem(I18N_LANG_KEY);
  return I18N_SUPPORTED.includes(stored) ? stored : I18N_DEFAULT;
}

// Translate a key. Optional params object substitutes {name} placeholders.
function t(key, params) {
  const lang = getLang();
  let str = (I18N[lang] && I18N[lang][key]);
  if (str === undefined) str = (I18N[I18N_DEFAULT] && I18N[I18N_DEFAULT][key]);
  if (str === undefined) str = key;
  if (params) {
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
    });
  }
  return str;
}

// Direction is derived from language: Hebrew RTL, everything else LTR.
function langDir(lang) {
  return lang === 'he' ? 'rtl' : 'ltr';
}

function applyDirection(lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', langDir(lang));
}

// Apply translations to all static [data-i18n*] elements under root.
function applyStaticTranslations(root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.getAttribute('data-i18n-html'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
}

// Reflect the active language on the switcher buttons.
function updateLangSwitcher(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// Apply everything for a language: direction, static text, switcher,
// then re-render the active dynamic view (if the app exposes one).
function applyLang(lang) {
  applyDirection(lang);
  // Rebuild language-aware data label maps (roles, statuses, ...) first.
  if (typeof refreshI18nLabels === 'function') refreshI18nLabels();
  applyStaticTranslations(document);
  updateLangSwitcher(lang);
  // Let other modules react to a direction/language change (e.g. mobile drawer).
  window.dispatchEvent(new CustomEvent('languagechange:app', { detail: { lang } }));
  if (typeof window.rerenderCurrentView === 'function') {
    try { window.rerenderCurrentView(); } catch (e) { /* view not ready */ }
  }
}

// Switch language, persist, and re-apply.
function setLang(lang) {
  if (!I18N_SUPPORTED.includes(lang)) return;
  localStorage.setItem(I18N_LANG_KEY, lang);
  applyLang(lang);
}

// Wire up the language switcher buttons.
function initLangSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setLang(btn.dataset.lang);
    });
  });
  updateLangSwitcher(getLang());
}

// ---- Boot ----
// Set direction immediately (before DOM ready) to minimise flash.
applyDirection(getLang());

document.addEventListener('DOMContentLoaded', () => {
  initLangSwitcher();
  applyLang(getLang());
});
