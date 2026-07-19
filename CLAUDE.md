# CLAUDE.md — הנחיות לעבודה על הפרויקט

## רב-לשוניות (i18n) — עברית / אנגלית

המערכת תומכת בעברית (RTL) ובאנגלית (LTR). כל התשתית ב-`js/i18n.js` (נטען **ראשון** ב-`<head>`).

- **שפה נשמרת ב-localStorage** במפתח `app_lang` (`'he'` ברירת מחדל). מתג עב/EN ב-**3 מקומות**: navbar (דסקטופ), מסכי ההתחברות, ו**מגירת המובייל** (`.sidebar-lang-switcher`) — כי ה-navbar מוסתר מתחת ל-769px. כל מתגי `.lang-btn` נקלטים אוטומטית ב-`initLangSwitcher` ומסונכרנים.
- **כיוון נגזר מהשפה**: עברית=`rtl`, אנגלית=`ltr`. `body { direction: rtl }` נעקף ע"י `[dir="ltr"] body { direction: ltr }`, ויש בלוק עקיפות `[dir="ltr"]` ב-`css/styles.css` (sidebar, margins, יישור טקסט, כפתור עין).
- **⚠️ עקיפות layout של LTR (sidebar side + `main-content` margin) עטופות ב-`@media (min-width: 769px)`** — במובייל ה-sidebar הוא מגירה והתוכן מלא-רוחב, אז אסור ל-`margin-left` של LTR לחול (אחרת התוכן גולש). כלל mobile ו-LTR באותה specificity — סדר המקור קובע.
- **החלפת שפה** מפעילה `applyLang` → מרעננת תרגומים סטטיים, בונה מחדש `ROLE_LABELS`/`STATUS_LABELS` (`refreshI18nLabels` ב-`config.js`), משדרת `languagechange:app`, ומרנדרת מחדש את התצוגה הפעילה דרך `window.rerenderCurrentView` (ב-`app.js`) — בלי reload, תוך שמירת ההקשר (פרויקט/פוד).

### כללים בעת הוספת/שינוי טקסט
1. **אין לקודד טקסט קשיח.** כל מחרוזת מוצגת עוברת דרך `t('namespace.key')`. מוסיפים מפתח **גם ל-`he` וגם ל-`en`** ב-`js/i18n.js`.
2. **HTML סטטי ב-`index.html`**: משתמשים ב-`data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`.
3. **פרמטרים**: `t('key', { name })` מחליף `{name}` במחרוזת.
4. **⚠️ התנגשות שם `t`**: בקוד יש לולאות רבות עם משתנה `t` (טיפוס) שמסתיר את פונקציית התרגום `t()`. בתוך `.map(t => ...)`/`forEach(t => ...)` **יש לשנות את משתנה הלולאה ל-`ty`** אם קוראים ל-`t()` בפנים.
5. **תוכן QC**: מתורגם דרך `qcStageName` / `qcItemLabel` / `qcItemInstruction` / `qcItemUnit` ב-`qc-data.js` (שדות `labelEn`/`instructionEn`/`nameEn`/`unitEn` לצד העברית).

### מה נשאר בעברית בכוונה (קנוני — לא לתרגם)
- **כתיבות ל-DB** (`stage_name`, `item_label`) — עברית קנונית; התצוגה נגזרת מחדש לפי `item_key`/`stage_number`.
- **`GROUP_NAME_OPTIONS`** ב-`projects.js` — משמש להתאמה/מיון של שמות קבוצות קיימים.
- הערות קוד.

**בעת החלפת גרסת קובץ**: יש לעדכן את מספר ה-`?v=` ב-`index.html`.

## מודל אבטחה (RLS) — מאז 20260712_critical_security_fixes

המיגרציה `supabase/migrations/20260712000000_critical_security_fixes.sql` מגדירה את מודל ההרשאות. **מיגרציות חייבות להיות מוחלות ידנית ב-Supabase SQL Editor** — פריסת האתר לא מחילה אותן.

- **תפקיד משתמש חדש נקבע רק בשרת** (`handle_new_user` → תמיד `viewer`). אין לשלוח `role` ב-metadata של `signUp`.
- **משתמש חדש נוצר `is_active=false`** וממתין לאישור אדמין במסך ניהול המשתמשים. עד אז הוא לא רואה נתונים (RLS) ומקבל את מסך `auth.pendingApproval` (`showPendingApprovalScreen` ב-`app.js`).
- **כל הפוליסות משתמשות ב-`public.current_user_role()`** — פונקציית SECURITY DEFINER שמחזירה את התפקיד רק אם `is_active=true` (אחרת NULL). נטרול משתמש חוסם אותו בפועל. פוליסות חדשות חייבות להשתמש בפונקציה הזו, לא ב-`EXISTS (SELECT ... FROM profiles)` (גורם לרקורסיה בפוליסות של profiles עצמה).
- **שינוי `role`/`is_active`/`email`/`username` בפרופיל** — רק אדמין פעיל (trigger `protect_profile_privileges`).
- **כתיבה ל-QC (`qc_stages`/`qc_items` + תמונות `qc-images`)**: admin + project_manager + inspector (מנהל פרויקט נוסף במיגרציה 20260719010000; בצד לקוח — `canEdit()`). **בדיקות תבניות (`mold_checks`) נשארו admin + inspector בלבד** — בצד לקוח `canEditMolds()`. **עדכון `pods`** (status/casting) כולל גם inspector. **שם התפקיד בפוליסות הוא `'project_manager'`** — לא `'pm'` (באג היסטורי בפוליסות התוכניות).
- **Buckets פרטיים (מאז 20260712010000)**: `plans` ו-`qc-images` אינם ציבוריים. תצוגה נעשית עם **Signed URLs** (שעה): `signQcImageUrls` ב-`qc.js` (מחליף `image_url` בזיכרון) ו-`signedByPath` ב-`loadPlansTab` ב-`projects.js`. `file_url`/`image_url` ב-DB הם fallback לרשומות ישנות — אין להסתמך עליהם לתצוגה.
- **בדיקת שם משתמש תפוס בהרשמה**: דרך `username_exists` (boolean). `get_email_by_username` נשארת רק להתחברות עם שם משתמש.
- **מחיקת קבוצת ביצוע** מנתקת פודים (`pods.group_id` = `ON DELETE SET NULL`, מיגרציה 20260712020000) — לא מוחקת אותם.
- **SRI ב-`index.html`**: כל ספריות ה-CDN מוצמדות לגרסה מדויקת עם `integrity`. בעת שדרוג ספרייה יש לחשב sha384 חדש מקובץ ה-dist שב-tarball של npm (`openssl dgst -sha384 -binary | openssl base64 -A`).

## חשוב: לוגיקת מיספור פודים — אין לשנות

מיספור הפודים (`globalSerial`) רץ ברצף אחד רציף על פני **כל** הטיפוסים והכיוונים בפרויקט, לפי סדר הוספתם.

- כל קבוצת ביצוע (`production_group`) יכולה להכיל שלל סוגי פודים (T1-R, T1-L, T2-R וכו').
- המספרים משקפים את סדר הוספת הפודים לפרויקט (לפי סדר הקבוצות), לא את הטיפוס או הכיוון.
- כתוצאה מכך, בתצוגה מסוננת לפי טיפוס/כיוון ייתכנו "פערים" במספרים — זה מכוון ותקין.

**אין לשנות את `globalSerial` או את לוגיקת יצירת קודי הפודים ב-`createProject`.**

## מיון תצוגת פודים

הפודים ממוינים תמיד לפי **3 הספרות האחרונות** של קוד הפוד (המספר הסידורי) בסדר עולה.

- הלוגיקה נמצאת ב-`js/projects.js` בפונקציה `loadPodsTab`.
- אין למיין לפי טיפוס, כיוון, או השוואת מחרוזת מלאה — רק לפי הסיריאל.

```js
const getSerial = code => parseInt((code || '').slice(-3)) || 0;
const allPods = (pods || []).sort((a, b) => getSerial(a.pod_code) - getSerial(b.pod_code));
```

## מיון קבוצות ביצוע

קבוצות ממוינות תמיד לפי `sortGroupsByOption` ב-`js/projects.js`:
- קודם לפי `GROUP_NAME_OPTIONS` (שמות עבריים קבועים)
- fallback נומרי לשמות כגון G1, G2 ... G10 (מיון לפי המספר, לא אלפביתי)

אותו fallback קיים גם ב-`loadReportsView` ב-`js/reports.js`.

## מיון תצוגת הדוחות

- הדוחות מציגים רק פרויקטים ופודים **פעילים** (לא ארכיון). הסינון נעשה ב-`loadReportsView`:
  ```js
  const pods = (allPods || []).filter(p => p.projects?.is_active !== false);
  ```
- הפודים בטבלת הדוחות ממוינים לפי 3 הספרות האחרונות של קוד הפוד.
- שני כפתורי הייצוא (PDF ו-Excel) בסגנון `btn-primary` זהה.

## ציר התקדמות פרויקט

- ב-`loadPodsTab`: מחושב לפי **סך שלבים שהושלמו** מכלל השלבים (פודים × 6), כולל שלבים בתוך פודים שבתהליך.
- ב-`renderProjectCard` (דשבורד): פוד `completed` = 100%, פוד `in_progress` = 50%.

## נעילת שלבים B–F (בדיקות QC)

שלבים B–F נעולים עד לאישור סעיפים 1–7 ביציקת הרצפה (שלב A). הנעילה מתבטלת אם:
1. `pods.casting_approved === true`, **או**
2. שלב A כבר חתום (`status === 'completed'` או `'failed'`)

הלוגיקה ב-`loadQCStages` ב-`js/qc.js`:
```js
const stageA = _qcStages.find(s => s.stage_number === 1);
if (stageA?.status === 'completed' || stageA?.status === 'failed') {
  _castingBaseApproved = true;
}
```

## מפתח CASTING_ITEM_KEYS

רשימת סעיפי שלב A שחייבים לעבור לפני אישור היציקה מוגדרת **פעם אחת** כקבוע גלובלי ב-`js/qc.js`:
```js
const CASTING_ITEM_KEYS = ['length_dims', 'width_dims', 'pipe_slope', 'pipe_fixation',
  'drainage_channel', 'lifting_bolts', 'shower_parallel'];
```
**אין להגדיר אותה שוב בתוך פונקציות** — כל שינוי ייעשה רק בקבוע הזה.

## איפוס סיסמה

זרימת איפוס הסיסמה מוגנת בשתי שכבות ב-`js/app.js`:

1. **URL**: ה-`redirectTo` כולל `?type=recovery`, שמזוהה ב-`window.location.search`.
2. **sessionStorage**: כשמשתמש שולח טופס "שכחתי סיסמה", נשמר `pendingPasswordReset=1`. מנוקה עם טעינת הדף.

הדגל `window._passwordRecoveryMode` מוגדר **לפני** כל event של Supabase, ומונע `INITIAL_SESSION` / `SIGNED_IN` מלפתוח את האפליקציה. לאחר הגדרת סיסמה בהצלחה — הדף נטען מחדש לסשן נקי.

## קבוצות ביצוע — לוגיקה

### שם קבוצה אוטומטי
בעת יצירת קבוצה חדשה: שם מוצע אוטומטי `G${count+1}` (לפי מספר הקבוצות הקיימות). ניתן לערוך לפני שמירה.

### הרכב פודים (`pod_composition`)
- בעת יצירת קבוצה: המשתמש מזין כמות לכל סוג/כיוון (T1-ימין, T1-שמאל, T2-ימין...). הערכים נשמרים כ-`pod_composition jsonb` בטבלת `production_groups`.
- **יצירת פודים אוטומטית**: לאחר שמירת הקבוצה, נוצרים פודים אוטומטית לפי ההרכב. המספרים הסידוריים (`globalSerial`) ממשיכים ברצף מהאחרון הקיים בפרויקט.
- **סדר יצירת הפודים בקבוצה**: לפי `type_number` עולה, ובתוך כל טיפוס — ימין (R) לפני שמאל (L), בהתאמה לסדר ב-`createProject`. **אין למיין לפי מפתחות `comp`** (`typeId_dirId`) — אלה UUID-ים והמיון שלהם אקראי (באג היסטורי: פודי T9 קיבלו מספרים סידוריים לפני T1). הלוגיקה ב-`showGroupModal` ב-`js/projects.js`.
- בעריכת קבוצה: **רק תאריכים ניתנים לעריכה** — שם וה הרכב נעולים. ההרכב מוצג read-only (נגזר מהפודים הממשיים בקבוצה אם `pod_composition` ריק).

### תצוגת כרטיסי קבוצה
- מציג תגיות הרכב (T1 ימין: N) לכל הקבוצות — כולל קבוצות ישנות שאין להן `pod_composition` שמור, על ידי חישוב דינמי מהפודים בפועל.
- מציג תאריך יציקה (`casting_target_date`) ותאריך יעד (`target_date`).

### תצוגת קבוצה בכרטיסי פוד ובפרטי פוד
- מוצגת **נקודה צבעונית + שם הקבוצה בכחול בלבד** — ללא תפריט נגלל.
- אין אפשרות להעביר פוד בין קבוצות לאחר יצירה.

## Audit trail (qc_audit_log)

מיגרציה `20260713000000_qc_audit_log.sql`. Triggers ברמת ה-DB על `qc_stages` ו-`mold_checks` מתעדים מעברי סטטוס מהותיים (חתימה / פתיחה מחדש / ניקוי) עם המשתמש המבצע. **אין ללקוח שום הרשאת כתיבה על הטבלה** (אין פוליסות INSERT/UPDATE/DELETE); צפייה לאדמין בלבד — כפתור 📜 במסך פוד (`showPodHistory` ב-`pods.js`). מעברי שגרה `pending→in_progress` לא מתועדים בכוונה (רעש).

## PWA / Service Worker

- `manifest.json` + `sw.js` + רישום ב-`app.js`. אסטרטגיה: קריאות Supabase/HIBP לעולם לא נשמרות ב-cache; ניווטים network-first עם fallback ל-shell; נכסים סטטיים (מקומיים + jsdelivr) stale-while-revalidate.
- **לאחר deploy ייתכן שרענון ראשון יגיש גרסה קודמת של נכס סטטי** (הרענון מתבצע ברקע) — רענון שני מקבל את החדש. מספרי `?v=` עדיין חובה.
- אייקונים: `images/icon-192.png` / `icon-512.png` (נוצרו מ-apple-touch-icon).

## דחיסת תמונות QC

`compressImage` ב-`qc.js` מקטין תמונות לפני העלאה (מקס' 1600px, JPEG q0.8, מדלג על קבצים מתחת ל-400KB). כשל בדחיסה ⇒ העלאת המקור.

## בדיקות תבניות (mold_checks)

פיצ'ר שהוחזר לשימוש (נוצר במקור ב-Bolt; הקוד המקורי לא היה ב-repo). מודול `js/molds.js`, טאב "בדיקות תבניות" במסך פרויקט.

- **מבנה**: בדיקה לפי `type_id` (טיפוס בפרויקט) + `direction` (R/L/ללא) + `mold_number`. 9 סעיפים בעמודות שטוחות `<key>_status/_notes` (+`_value` לאורך/רוחב) — מוגדרים ב-`MOLD_CHECK_ITEMS` ב-`molds.js`; תוויות ב-i18n תחת `mold.item.*`.
- **שאילתות בלי FK embedding**: הטבלה ב-DB החי נוצרה ב-Bolt וייתכן שאין בה constraint מוצהר — לכן `loadMoldsTab` שולף types ואז `mold_checks` עם `.in('type_id', ...)`, לא join של PostgREST.
- **הרשאות**: כתיבה admin+inspector (מיגרציה 20260712040000), כפתור ההוספה `.inspector-only`. מחיקה ב-UI לאדמין בלבד.
- **שמירה**: הטופס נשמר בלחיצת "שמור" (לא autosave); "חתום וסיים" עובר לשלב חתימה בתוך אותו מודאל (SignaturePad נפרד — `_moldSigPad`), וכישלון בסעיף כלשהו ⇒ `status='failed'`.
- הגדרת הטבלה מתועדת ב-`20260712050000_mold_checks_table.sql` (no-op על ה-DB החי).

## שלמות נתוני QC — הגנות מאז 20260719 (תקלת 29/03)

רקע: ב-29/03/2026 נוקו טופסי שלב A של כמה פודים ("ניקוי טופס"), מולאו מחדש חלקית (בלי סעיפי המדידה 1, 2, 7) ונחתמו "הושלם" — בלי התרעה ובלי תיעוד. ההגנות שנוספו:

- **ולידציית שלמות בחתימה** (`btn-complete-stage` ב-`qc.js`): חתימה על שלב עם סעיפים לא מסומנים פותחת `uiConfirm` עם רשימת הסעיפים החסרים (`qc.signMissingItems`). אפשר לאשר ולחתום בכל זאת — אבל לא בשוגג.
- **מיגרציה `20260719000000_protect_qc_items.sql`** (להריץ ידנית ב-SQL Editor):
  - trigger `protect_signed_stage_items` חוסם INSERT/UPDATE/DELETE על `qc_items` כשהשלב ההורה `completed`/`failed` — סוגר גם טאבים ישנים שנשארו פתוחים. **לכן `clearStage` מאפס את השלב לפני הסעיפים** — אין להחזיר את הסדר הישן (items→stage) שייחסם ע"י ה-trigger.
  - trigger `log_qc_item_change` מתעד ב-`qc_audit_log` כל שינוי סימון קיים (`passed`/`failed` → אחר) כ-`item_status_changed`; מוצג בהיסטוריית הפוד (📜) עם שם הסעיף והמעבר. סימון ראשוני לא מתועד (רעש).
- **בדיקת שגיאות בשמירת סימון** (`handleItemStatusChange`): כישלון כתיבה מחזיר את השורה למצב האחרון שנשמר ומציג `qc.itemSaveError` — לא נשאר ✓ כוזב על המסך.
- **"ניקוי טופס" לאדמין בלבד** ב-UI (היה לכל `canEdit`).
- **מכנה מונה הדוח ב-PDF** (`reports.js`): `passed/totalDefined` לפי הגדרת השלב — לא לפי מספר שורות ה-DB (שגרם לטופס חסר להיראות "6/6 עברו").

## תיעוד תאריכי בדיקה (מיגרציה 20260719020000)

- **`pods.inspection_started_at`** — נקבע ב-trigger ברגע הסימון הראשון (passed/failed) של סעיף כלשהו בפוד, פעם אחת. מוצג ב-info-bar של מסך הפוד ("תחילת בדיקה"). Backfill לפודים קיימים לפי `MIN(created_at)` של סעיפיהם.
- **`qc_items.fixed_at`** — נקבע ב-trigger במעבר `failed`→`passed` (תיקון); מתאפס אם הסעיף חוזר ל-`failed`/`pending`. מוצג בשורת הסעיף (🔧 "תוקן בתאריך") ובדוח ה-PDF.
- שני התאריכים נכתבים רק ב-DB (triggers, SECURITY DEFINER) — אין כתיבה מהלקוח.

## שינויים שבוצעו

### עריכת אימייל במסך ניהול משתמשים (`js/app.js`, `js/i18n.js`)

בכל שורת משתמש ב-`loadUsersView` נוסף כפתור **"ערוך אימייל"** (`.btn-edit-email`) שפותח מודל (`openModal`) לעריכת השדה.

- **מעדכן רק את `public.profiles.email`** — עמודת תצוגה, כפוף לאותו trigger `protect_profile_privileges` (אדמין פעיל בלבד) כמו שינוי role/is_active/username.
- **אינו משנה את אימייל ההתחברות** ב-`auth.users` (Supabase Auth) — אין ל-client גישת Admin API לכך. עדכון כתובת ההתחברות בפועל נעשה **ידנית ב-Supabase Dashboard או SQL Editor**:
  ```sql
  UPDATE auth.users SET email = '...', email_confirmed_at = now() WHERE id = '<uid>';
  UPDATE auth.identities SET identity_data = jsonb_set(identity_data, '{email}', '"..."') WHERE user_id = '<uid>';
  UPDATE public.profiles SET email = '...' WHERE id = '<uid>';
  ```
- מפתחות i18n חדשים תחת `users.editEmail*` / `users.emailUpdated` / `users.emailUpdateError` / `users.invalidEmail` (`he`+`en`).
- ולידציה בסיסית של פורמט אימייל בצד לקוח לפני השליחה.

### שלב F — התקנת אביזרי קצה (`js/qc-data.js`)

נוספו הסעיפים הבאים לרשימת הבדיקות:
- **מראה** (`key: 'mirror'`) — סעיף 18
- **סיפון כיור** (`key: 'sink_siphon'`) — סעיף 19 (אחרון)

### ברקוד (`js/pods.js`, `js/projects.js`)
- גודל שם הפוד בברקוד: 18pt (היה 11pt).
- פריסה: ברקוד בשורה עליונה, שם הקבוצה (G1/G7...) + קוד הפוד בשורה תחתונה זו לצד זו.
- שם הקבוצה נשלף ישירות מ-`pod.production_groups?.name` — ללא חישוב אותיות A/B/C.
- הקבוצות נטענות לכל המשתמשים (לא רק Admin/PM) כדי שהברקוד יכלול שם קבוצה.
- **סדר ברקודים בקבוצה חדשה**: תוקן באג שבו פודים נוצרו לפי מיון מחרוזתי של UUID (T9 קיבל מספרים סידוריים לפני T1). כיום היצירה לפי `type_number` וכיוון — ראו "סדר יצירת הפודים בקבוצה" בסעיף קבוצות ביצוע. חל על קבוצות חדשות בלבד; מספור קיים לא שונה.

### באנר הערות (`js/qc.js`)
- תוקן ניסוח: "הערות פתוחות" (היה "הערהות פתוחהות").

### Bolt sync ⚠️
הפרויקט מחובר לשני כלים שדוחפים ל-GitHub: **קלוד** (commits חתומים `Claude`) ו-**Bolt** (commits חתומים `dlkenig-lang`, כלומר בשם המשתמש).

- **סיכון דריסה**: ל-Bolt עותק משלו של הקוד. אם Bolt מחזיק גרסה ישנה ומסנכרן, ה-commit שלו **דורס את `main`** ומבטל עבודה חדשה — גם בלי commit ידני. כך נמחק פעם אחת כל ה-i18n (commit `195325f`), ושוחזר ב-revert (`d696cde`).
- **לפני עבודה ב-Bolt**: לוודא שהוא מציג את הגרסה העדכנית (סימן פשוט — מתג עב/EN מופיע ב-navbar). אם לא — לרענן/לעבור לענף אחר וחזרה ל-`main`, או `Disconnect project`.
- אם Bolt לא מציג שינויים: עבור לענף אחר וחזור ל-main בממשק Bolt.
- **שחזור לאחר דריסה**: העבודה לא אובדת — היא בהיסטוריה. `git revert <commit-הדורס>` מחזיר את המצב (קדימה, ללא force-push).
