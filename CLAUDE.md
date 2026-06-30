# CLAUDE.md — הנחיות לעבודה על הפרויקט

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

## שינויים שבוצעו

### שלב F — התקנת אביזרי קצה (`js/qc-data.js`)

נוספו הסעיפים הבאים לרשימת הבדיקות:
- **מראה** (`key: 'mirror'`) — סעיף 18 ברשימה
- **סיפון כיור** (`key: 'sink_siphon'`) — סעיף 19 ברשימה

### ברקוד פוד — פריסה ותצוגה (`js/pods.js`, `js/projects.js`)

- **גודל גופן**: קוד הפוד בברקוד הוגדל מ-11pt ל-18pt (`.bc` / `.bc-label`)
- **פריסת מדבקה**: ברקוד למעלה (רוחב מלא), מתחתיו שם הקבוצה + קוד הפוד באותה שורה
- **שם הקבוצה**: מוצג מ-`pod.production_groups?.name` (למשל G1, G7) — לא אות חישובית
- **תצוגה לכל המשתמשים**: `production_groups` נטען ב-`openPod` לכל המשתמשים (הוסר guard של `isAdminOrPM`)
- פודים ללא `group_serial` עדיין מציגים את שם הקבוצה

### הוספת פוד דרך מודל (`js/projects.js` — `showAddPodModal`)

- נוסף חישוב `group_serial` בעת הוספת פוד עם קבוצה — עקבי עם לוגיקת השיוך בכרטיס הפוד
- כולל בדיקת קיבולת מקסימלית של הקבוצה

### טיפ עבודה עם Bolt

כאשר Bolt לא מציג שינויים מ-main — יש לעבור לענף אחר וחזרה ל-main כדי לאלץ רענון.
