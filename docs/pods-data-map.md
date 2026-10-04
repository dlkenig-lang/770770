# מפת נתוני הפודים — מערכת ה-QC (ריפו `770770`)

> מסמך עובדות בלבד. לא שונו קוד, סכימה או נתונים. מועד המיפוי: 2026-10-04.
> קומיט בסיס: `22ede09` (`origin/main`).

---

## 0. הגבלה מהותית: לא הייתה גישה ל-DB הייצור של המערכת הזו

| | ערך |
|---|---|
| ה-DB שהאפליקציה מתחברת אליו (`js/config.js:5`, `supabase/config.toml`) | `https://qiibgzypiljjwjqebyxo.supabase.co` — project ref **`qiibgzypiljjwjqebyxo`** |
| ה-DB שאליו מחוברים כלי ה-Supabase (MCP) של הסשן | `https://hsvnedrilxgvgwyjzfvt.supabase.co` — project ref **`hsvnedrilxgvgwyjzfvt`** |
| גישה ישירה מהסשן ל-`qiibgzypiljjwjqebyxo.supabase.co` (REST) | **נחסמה** ע"י מדיניות הרשת: `curl: (56) CONNECT tunnel failed, response 403` |

**שני ה-connectors (`Supabase_RO` ו-`Supabase_RW`) מחזירים את אותו project ref, `hsvnedrilxgvgwyjzfvt`.**
זה **אינו** ה-DB של מערכת ה-QC. לפי שמות הטבלאות והמיגרציות, זה ה-DB של מערכת הרכש/הצעות
המחיר/ניהול הפועלים (טבלאות `wf_*`, `suppliers`, `quotes`, `pod_models`, ...). אין בו טבלת `pods`.

שאילתה שהורצה על `hsvnedrilxgvgwyjzfvt` לאימות:
```sql
select table_schema, table_name from information_schema.tables
where table_schema in ('public') order by 2;
```
תוצאה (48 שורות): `audit_log, bom_item_prices, bom_price_history, custom_bom_items, departments,
fixture_spec_prices, inventory_items, po_line_items, pod_models, pod_takeoff_fixtures, pod_takeoffs,
price_history, price_list_items, price_lists, projects, purchase_orders, quote_line_items, quotes,
spec_level_names, supplier_categories, supplier_comparison_items, supplier_comparisons, supplier_delays,
supplier_issues, supplier_rfq_quotes, supplier_rfqs, suppliers, tenders, user_departments,
user_module_permissions, user_profiles, v_wf_coverage_gaps, v_wf_project_summary, v_wf_task_progress,
v_wf_task_type_benchmark, v_wf_work_log_detail, v_wf_worker_day, v_wf_worker_period,
v_wf_yesterday_report, wf_absences, wf_notification_log, wf_settings, wf_task_assignments,
wf_task_types, wf_tasks, wf_trades, wf_work_logs, wf_workers`.
**אין `pods`, `qc_stages`, `project_types`, `type_directions`.**

**המשמעות לגבי המסמך:** כל ממצא שמסומן **[ריפו]** נגזר מקוד ומיגרציות בריפו ומשקף את מה
ש*אמור* להיות ב-DB — לא את מה שקיים בפועל. ממצא שמסומן **[לא אומת]** דורש שאילתה על
`qiibgzypiljjwjqebyxo`, שלא הייתה אפשרית. השאילתות שלא הורצו מרוכזות בסעיף 13.
הריפו עצמו מתעד שה-DB החי סוטה מהמיגרציות (ראו סעיף 11), ולכן ממצאי [ריפו] על הסכימה
אינם תחליף לבדיקה בייצור.

---

## 1. הטבלאות שמחזיקות את הפודים

### `pods` — טבלת היחידות (שורה = פוד או פאנל אחד) [ריפו]

הגדרת הבסיס ב-`supabase/schema.sql:80-91`, ועמודות שנוספו במיגרציות:

| עמודה | סוג | Null | ברירת מחדל | אילוץ / FK | מקור |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid_generate_v4()` | **PK** | schema.sql |
| `project_id` | UUID | NOT NULL | | FK → `projects(id)` **ON DELETE CASCADE** | schema.sql |
| `type_id` | UUID | NOT NULL | | FK → `project_types(id)` (ללא ON DELETE) | schema.sql |
| `direction_id` | UUID | NOT NULL | | FK → `type_directions(id)` (ללא ON DELETE) | schema.sql |
| `serial_number` | INTEGER | NOT NULL | | | schema.sql |
| `pod_code` | TEXT | NOT NULL | | **UNIQUE** (גלובלי) | schema.sql |
| `group_id` | UUID | NULL | | FK → `production_groups(id)` **ON DELETE SET NULL** | schema.sql + `20260712020000` |
| `status` | TEXT | NULL | `'pending'` | CHECK IN (`pending`,`in_progress`,`completed`,`failed`) | schema.sql |
| `created_at` | TIMESTAMPTZ | NULL | `NOW()` | | schema.sql |
| `updated_at` | TIMESTAMPTZ | NULL | `NOW()` | trigger `update_pods_updated_at` | schema.sql |
| `casting_approved` | BOOLEAN | NOT NULL | `false` | | `20260309100000` |
| `casting_approved_at` | TIMESTAMPTZ | NULL | | | `20260309100000` |
| `group_serial` | INTEGER | NULL | | | `20260311000000` |
| `inspection_started_at` | TIMESTAMPTZ | NULL | | נכתב ע"י trigger `track_pod_inspection_start` | `20260719020000` |
| `destination_id` | UUID | NULL | | FK → `pod_destinations(id)` **ON DELETE SET NULL**; אינדקס ייחודי חלקי `uniq_pods_destination` | `20260824000000` |
| `is_scrapped` | BOOLEAN | NOT NULL | `false` | | `20260824010000` |
| `scrapped_reason` | TEXT | NULL | | | `20260824010000` |
| `scrapped_at` | TIMESTAMPTZ | NULL | | | `20260824010000` |

אינדקסים: `idx_pods_direction_id`, `idx_pods_group_id`, `idx_pods_project_id`, `idx_pods_type_id`
(`20260225135900`, `20260305083716`), `uniq_pods_destination` (`20260824000000`), והאינדקס
הייחודי שנוצר מ-`pod_code UNIQUE`.

### טבלאות הקשורות לפוד [ריפו]

| טבלה | PK | קשר לפוד | עמודות עיקריות |
|---|---|---|---|
| `projects` | `id` UUID | `pods.project_id` | `name` TEXT, `code` CHAR(3) **UNIQUE**, `date_received` DATE, `location`, `pipe_type`, `onedrive_folder_url`, `is_active` BOOLEAN, `product_type` TEXT (`pod`/`medical_panel`), `project_number` INTEGER, `created_by`, `created_at`, `updated_at` |
| `project_types` | `id` UUID | `pods.type_id` | `project_id` FK CASCADE, `type_number` INTEGER, `dimensions` TEXT, `model_name` TEXT, `architectural_plan_url/name`; UNIQUE(`project_id`,`type_number`) |
| `type_directions` | `id` UUID | `pods.direction_id` | `type_id` FK CASCADE, `direction` CHAR(1) CHECK IN (`R`,`L`), `pod_count`, `target_quantity`; UNIQUE(`type_id`,`direction`) |
| `production_groups` | `id` UUID | `pods.group_id` | `project_id` FK CASCADE, `name`, `target_date`, `sort_order`, `max_pods`, + `pod_composition`, `casting_target_date` (ראו סעיף 11) |
| `pod_destinations` | `id` UUID | `pods.destination_id` | `project_id` FK CASCADE, `building` TEXT, `floor` INTEGER, `room_code` TEXT, `type_number`, `direction`, `notes`; UNIQUE(`project_id`,`building`,`floor`,`room_code`) |
| `qc_stages` | `id` UUID | `pod_id` FK CASCADE | `stage_number` (CHECK 1–6), `stage_name`, `status`, `inspector_name`, `inspection_date`, `completed_at`; UNIQUE(`pod_id`,`stage_number`) |
| `qc_items` | `id` UUID | דרך `stage_id` FK CASCADE | `item_key`, `item_label`, `status` (`pending`/`passed`/`failed`), `notes`, `value_entry`, `fixed_at`, ... |
| `comments` | `id` UUID | `pod_id` FK CASCADE | `stage_number`, `author_id`, `content`, `is_flagged`, `is_resolved` |
| `qc_audit_log` | | `pod_id` | יומן אירועים; נכתב רק ע"י triggers |

---

## 2. מספר הפוד / הברקוד

### השדה
**`pods.pod_code`** (TEXT). זה הערך שמקודד בברקוד המודפס (CODE128) בכל ארבעת מקומות ההדפסה:
`js/pods.js:141`, `js/pods.js:167`, `js/projects.js:2089`, `js/reports.js:150` (`JsBarcode(svg, podCode, { format: 'CODE128', ... })`).
סורק הברקוד מחפש לפי השדה הזה בדיוק (`js/scanner.js:78-82`: `.from('pods').select('id').eq('pod_code', podCode).maybeSingle()`).

### הפורמט [ריפו]
נבנה ב-`generatePodCode` (`js/config.js:141-153`):
```
{CODE}-{MID}-T{type_number}[-{R|L}]-{serial:3}
```
- `CODE` = `projects.code` באותיות גדולות (CHAR(3)).
- `MID` = `DDMMYY` מ-`date_received` כש-`project_number` ריק; `PPMMYY` (PP = `project_number` בריפוד של 2 ספרות) כשהוא מוגדר.
- `-R`/`-L` — רק בפודים. בפאנלים רפואיים המקטע הושמט.
- `serial` — 3 ספרות עם ריפוד אפסים (`padStart(3,'0')`). מספר גדול מ-999 ייכתב ב-4 ספרות. עם זאת, כל הקוד שקורא את הסיריאל לוקח בדיוק 3 תווים אחרונים (`slice(-3)`).

**דוגמאות** — מתיעוד הריפו (`CLAUDE.md`, `20260803010000_project_number.sql`), **לא מה-DB**:
`EKR-220226-T1-R-001` (פורמט ישן), `BLN-020726-T1-001` (פאנל, פורמט חדש), `ABC-DDMMYY-T1-R-001`.
**דוגמאות אמיתיות מה-DB: [לא אומת]** (שאילתה 13.2).

### ייחודיות
- **[ריפו]** `schema.sql:86` מגדיר `pod_code TEXT NOT NULL UNIQUE` — כלומר ייחודי **גלובלית** (לא בתוך פרויקט). `projects.code` מוגדר גם הוא `UNIQUE`.
- **[לא אומת]** לא נבדק בפועל אם האילוץ קיים ב-DB החי, ואם יש כפילויות (שאילתות 13.3–13.4).
- **`pod_code` אינו בלתי-משתנה.** ה-RPC `rename_project_code_in_pods` (`20260310000000`), שנקרא מ-`js/projects.js:1029` כשמשנים את קוד הפרויקט, כותב מחדש את הקידומת בכל קודי הפודים של הפרויקט:
  ```sql
  UPDATE pods SET pod_code = p_new_code || SUBSTRING(pod_code FROM LENGTH(p_old_code) + 1)
  WHERE project_id = p_project_id AND pod_code LIKE p_old_code || '-%';
  ```
  ברקודים שכבר הודפסו לפני שינוי כזה נושאים את הקוד הישן.
- **`pod_code` אינו נגזר מחדש מהעמודות האחרות.** הוא נכתב פעם אחת ביצירה, ושינוי `project_number`, `type_number` או `date_received` לא משנה אותו.

### `serial_number` — סמנטיקה לא אחידה [ריפו]
הערך שנכתב ל-`pods.serial_number` שונה בין שלושת מסלולי היצירה:

| מסלול | `serial_number` | הסיריאל ב-`pod_code` |
|---|---|---|
| `createProject` (`projects.js:1563`, `1597`) | `s` — מונה **בתוך טיפוס+כיוון** (1..N) | `globalSerial` (רץ על כל הפרויקט) |
| `showGroupModal` (`projects.js:1794`) | `globalSerial` | `globalSerial` |
| "הוסף פוד" ידני (`projects.js:1942`, `1961`) | הערך שהמשתמש הקליד | אותו ערך שהמשתמש הקליד |

כתוצאה מכך, לפי הקוד, `serial_number` ו-3 הספרות האחרונות של `pod_code` אינם בהכרח שווים.
האפליקציה עצמה ממיינת ומחשבת את הסיריאל הבא רק מ-`pod_code.slice(-3)` (`projects.js:1770`), ולא מ-`serial_number`.

---

## 3. זיהוי פרויקט

**[ריפו]** טבלת `projects`, עם שלושה מזהים:
- `id` (UUID) — המפתח שכל ה-FK מצביעים אליו.
- `code` (CHAR(3), UNIQUE) — הקידומת בקוד הפוד (`EKR`, `BLN`). **ניתן לשינוי** דרך טאב "פרטים נוספים", ושינוי כזה כותב מחדש את כל קודי הפודים (סעיף 2).
- `name` (TEXT) — שם חופשי, ללא אילוץ ייחודיות.
- בנוסף `project_number` (INTEGER, nullable) — מאז `20260803010000`. לפי התיעוד, EKR הוא פרויקט 1 ונשאר NULL.

ארכוב: `projects.is_active = false` (`projects.js:2017`). מסך הדוחות מסנן `p.projects?.is_active !== false`.

**רשימת הפרויקטים וכמות הפודים בכל אחד: [לא אומת]** (שאילתה 13.1).
פרויקטים שמוזכרים בתיעוד הריפו בלבד: EKR (פרויקט 1, פודים), בילינסון / BLN (פאנלים רפואיים,
3 דגמים), ופרויקט מעונות (5 בניינים A–E, 6 קומות). אין בריפו נתוני כמויות.

---

## 4. שדות מיקום וסיווג [ריפו]

| מושג | מיקום | הערות |
|---|---|---|
| בניין | `pod_destinations.building` (TEXT) | דרך `pods.destination_id`. לא על הפוד עצמו |
| קומה | `pod_destinations.floor` (INTEGER, 0 = קרקע) | כנ"ל |
| דירה / חדר | `pod_destinations.room_code` (TEXT) | קוד שמסופק ע"י המזמין. אין עמודת "דירה" נפרדת |
| טיפוס | `project_types.type_number` (INTEGER) דרך `pods.type_id` | מוצג כ-`T1`, `T2`... |
| שם דגם | `project_types.model_name` (TEXT, חופשי, אופציונלי) | `typeLabel()` → `T1 — בסיסי` |
| מידות | `project_types.dimensions` (TEXT) | `LxWxH` לפודים, `WxH` לפאנלים |
| כיוון | `type_directions.direction` (`R`/`L`) דרך `pods.direction_id` | בפאנלים: שורת placeholder `R` שלא מוצגת |
| סוג מוצר | `projects.product_type` (`pod`/`medical_panel`) | ברמת הפרויקט, לא הפוד |
| קבוצת ביצוע | `production_groups.name` דרך `pods.group_id` | למשל G1, G7; nullable |
| מיקום הפרויקט | `projects.location` (TEXT) | ברמת הפרויקט |

היעד (בניין/קומה/חדר) קיים רק לפודים ששויכו בטאב "יעדי משלוח" (מיגרציה `20260824000000`,
שמחייבת הרצה ידנית). האם המיגרציה הורצה וכמה פודים משויכים: **[לא אומת]** (שאילתה 13.6).

---

## 5. סטטוסים

### `pods.status` [ריפו]
ערכים לפי ה-CHECK: `pending`, `in_progress`, `completed`, `failed`.
הערך **נגזר בצד הלקוח** מסטטוסי שלבי ה-QC, בפונקציה `updatePodStatus` (`js/qc.js:958-970`):

| ערך | מתי נקבע |
|---|---|
| `completed` | **כל** שורות `qc_stages` של הפוד הן `completed` |
| `failed` | לפחות שלב אחד `failed` (ולא הכל `completed`) |
| `in_progress` | לפחות שלב אחד `in_progress` או `completed` |
| `pending` | אחרת (כולל פוד בלי שורות `qc_stages`) |

- הסטטוס משקף **בקרת איכות בלבד**. **אין סטטוס ייצור, משלוח או התקנה** — לא ב-`status` ולא בעמודה אחרת. חיפוש `shipped`/`delivered_at`/`dispatch` בקוד לא העלה עמודה כזו. תעודת המשלוח (`generateDeliveryNote`) מפיקה PDF בלבד ואינה כותבת ל-DB.
- `completed` נבדק מול שורות `qc_stages` שקיימות בפועל, לא מול מספר השלבים המוגדר (6 לפודים, 5 לפאנלים). שורת שלב נוצרת רק כשנכנסים אליו. לכן, לפי הקוד, פוד שרק חלק משורות השלבים שלו נוצרו וכולן `completed` יקבל `completed`.
- הכתיבה נעשית מהדפדפן, בלי trigger ב-DB.

### דגלים נוספים על הפוד [ריפו]
| עמודה | משמעות |
|---|---|
| `casting_approved` | "מאושר וממתין ליציקה" (סעיפים 1–7 של שלב A עברו); מתאפס אחרי יציקה/חתימת שלב A |
| `is_scrapped` (+`scrapped_reason`, `scrapped_at`) | "נגרע" — הפוד נפסל בייצור. לא נמחק; הסיריאל שלו לא ממוחזר |
| `inspection_started_at` | מועד הסימון הראשון של סעיף QC כלשהו |

### שלבי ה-QC (`qc_stages.stage_number`) [ריפו, `js/qc-data.js`]
פוד סניטרי: 6 שלבים A–F. פאנל רפואי: 5 שלבים A–E. סטטוס שלב: `pending`/`in_progress`/`completed`/`failed`.

**התפלגות הסטטוסים בפועל: [לא אומת]** (שאילתה 13.5).

---

## 6. `updated_at`, מחיקה רכה ומחיקה פיזית [ריפו]

- **`updated_at` קיים** על `pods`, עם trigger `update_pods_updated_at` (BEFORE UPDATE → `NOW()`), מוגדר ב-`schema.sql` ונבנה מחדש ב-`20260225135900`. אותו מנגנון קיים ב-`projects`, `qc_stages`, `qc_items`. **אין `updated_at`** ב-`project_types`, `type_directions`, `pod_destinations`, `comments`.
  עדכון של `qc_stages`/`qc_items` **אינו** מעדכן את `pods.updated_at`. רק עדכון של שורת הפוד עצמה (סטטוס, יציקה, יעד, גריעה) מעדכן אותו.
- **אין soft delete גנרי** (אין `deleted_at`/`is_deleted` על `pods`).
  - `is_scrapped` הוא סימון עסקי של "נגרע", לא מחיקה.
  - `projects.is_active=false` הוא ארכוב פרויקט. הפודים נשארים בטבלה.
- **פודים נמחקים פיזית:**
  1. `deletePod` (`js/projects.js:1979-1985`) — `DELETE FROM pods WHERE id=...` (admin + PM לפי RLS).
  2. מחיקת פרויקט לצמיתות (`js/projects.js:208`, `2052`) — `DELETE FROM projects`, ובשרשור **ON DELETE CASCADE** נמחקים כל הפודים, השלבים, הסעיפים וההערות.
  3. מחיקת `pod_destinations` או `production_groups` **אינה** מוחקת פודים (SET NULL).
- מחיקת פוד אינה מתועדת ב-`qc_audit_log`. בריפו אין trigger על DELETE של `pods`.

---

## 7. איך נוצרים פודים [ריפו]

**רק הזנה ידנית מהדפדפן — אין יבוא ואין trigger ב-DB.** שלושה מסלולים, כולם `INSERT` ישיר ל-`pods` דרך PostgREST:

| # | מסלול | מיקום | `group_id` |
|---|---|---|---|
| 1 | יצירת פרויקט חדש — פודים לכל טיפוס/כיוון לפי הכמויות בטופס | `createProject`, `js/projects.js:1545-1609` | NULL |
| 2 | יצירת קבוצת ביצוע עם הרכב — יצירה אוטומטית לפי `pod_composition` | `showGroupModal`, `js/projects.js:1761-1804` | הקבוצה החדשה |
| 3 | "הוסף פוד" בודד — הסיריאל מוקלד ידנית | `js/projects.js:1930-1975` | אופציונלי |

- כל המסלולים קוראים ל-`generatePodCode` בדפדפן.
- הסיריאל הגלובלי במסלול 2 נקבע כ-`max(slice(-3))` על פודי הפרויקט שנקראו לדפדפן, ואז +1.
- ייבוא קובץ קיים רק ל**יעדי משלוח** (`parseDestImport` ב-`js/destinations.js`), לא לפודים.
- הוספת טיפוס לפרויקט קיים (`showAddTypeModal`) **אינה** יוצרת פודים.

---

## 8. RLS ו-Edge Functions

### RLS על `pods` [ריפו — לא אומת מול הייצור]
לפי `20260712000000_critical_security_fixes.sql:186-270`, שנבנה מחדש ב-`20260712030000_reset_rls_policies.sql`:

| פוליסה | פעולה | תנאי |
|---|---|---|
| `Pods viewable` | SELECT | `current_user_role() IS NOT NULL` (משתמש פעיל בכל תפקיד) |
| `Admins and PMs can insert pods` | INSERT | role IN (`admin`,`project_manager`) |
| `Staff can update pods` | UPDATE | role IN (`admin`,`project_manager`,`inspector`) |
| `Admins and PMs can delete pods` | DELETE | role IN (`admin`,`project_manager`) |

- כל הפוליסות הן `TO authenticated`. ל-`anon` אין גישה.
- `current_user_role()` הוא SECURITY DEFINER ומחזיר NULL כש-`profiles.is_active=false`.
- תפקידים (`profiles.role` CHECK): `admin`, `project_manager`, `inspector`, `viewer`.
- מצב ה-RLS בפועל (`relrowsecurity`, `pg_policies`): **[לא אומת]** (שאילתה 13.7).

### Edge Functions
- **בריפו `770770` אין Edge Functions** — אין תיקיית `supabase/functions`.
- **ב-`qiibgzypiljjwjqebyxo`: [לא אומת].**
- לשם השלמה, ב-project שאליו ה-MCP מחובר (`hsvnedrilxgvgwyjzfvt`, **לא** מערכת ה-QC) רשומות 4 פונקציות פעילות (`list_edge_functions`): `create-user`, `extract-quote`, `workforce-reminders`, `workforce-daily-report` (כולן `verify_jwt: true`, version 1).

---

## 9. Bolt ומי דוחף ל-`main`

הריפו היה clone רדוד. בוצע `git fetch --unshallow origin main` לצורך הניתוח.

```
$ git log origin/main --format='%an|%cn' | sort | uniq -c | sort -rn
    262 Claude|Claude
     62 dlkenig-lang|GitHub
      1 dlkenig-lang|dlkenig-lang
```
- 35 קומיטים שאינם merge, מחבר `dlkenig-lang <dlkenig@gmail.com>`, committer `GitHub <noreply@github.com>`. שאר הקומיטים של `dlkenig-lang` הם merge של PR-ים.
- **קומיטים בתבנית Bolt** — הודעה גנרית, committer `GitHub`, ונגיעה בקבצים רבים מעבר לשם שבהודעה:

| קומיט | תאריך | הודעה | היקף בפועל |
|---|---|---|---|
| `d014bc0` | 2026-02-25 | Start repository | |
| `eaff6bb`, `9a07a35`, `703b8a1`, `e9d97c9` | 02-25 – 03-05 | Added `<file>` | 3 מהן מיגרציות SQL |
| `65d76f5`, `caa4422` | 02-25, 02-26 | Publish application | |
| `f082088`, `b4902e0` | 2026-06-30 | Updated index.html | 3 קבצים כל אחד |
| `42b0c57` | 2026-07-06 | Updated CLAUDE.md | |
| `195325f` | 2026-07-07 | Updated CLAUDE.md | **13 קבצים, ‎-2021 שורות** (מחק את i18n). בוטל ב-`d696cde` |
| `1a7fe15` | 2026-07-14 | Updated CLAUDE.md | 7 קבצים, ‎-199 שורות, **מחק את `20260713010000_audit_casting_changes.sql`** |
| `9538fd5` | 2026-07-19 | Updated CLAUDE.md | 4 קבצים, ‎-74 שורות. הוסר ב-`1867544` ("discarding stale Bolt snapshot 9538fd5") |

- **קומיט Bolt אחרון ב-`main`: `9538fd5`, 2026-07-19.** מאז אין ב-`main` קומיטים מלבד קומיטים של `Claude` ו-merge של PR-ים ע"י `dlkenig-lang`. הקומיט האחרון ב-`main` הוא `22ede09` (2026-09-16, merge של PR #50).
- **האם הפרויקט עדיין מחובר ל-Bolt: לא ניתן לקבוע מהריפו.** אין בריפו קבצי Bolt (`.bolt/` לא קיים, ולא היה בהיסטוריה). `CLAUDE.md` (סעיף "Bolt sync") מתעד שהחיבור קיים ומזהיר מדריסה. היעדר קומיטים מאז 07-19 אינו מוכיח ניתוק.
- פריסה: `.github/workflows/pages.yml` פורס ל-GitHub Pages בכל push ל-`main`. קיים גם `netlify.toml` (static, ללא build). מאיזו פלטפורמה מוגש האתר בפועל: לא נבדק.

---

## 10. בעלות על מסד הנתונים ומשתני סביבה

- **project ref: `qiibgzypiljjwjqebyxo`**, לפי `js/config.js:5` ו-`supabase/config.toml` (`project_id`).
- הערך נכנס לקוד ב-`e533daa` ("Configure Supabase credentials", Claude, 2026-02-25), אותו יום של `d014bc0` "Start repository" (תבנית Bolt). בקומיט `d2ea789` הערך עוד היה `YOUR_PROJECT_ID`.
- **אין משתני סביבה.** אין `VITE_SUPABASE_URL`, `import.meta.env` או `process.env` בקוד. אין build (`package.json`: `"build": "echo 'Static site - no build needed'"`). ה-URL וה-anon key **מקודדים קשיח** ב-`js/config.js:5-6`, שנטען כקובץ סטטי לדפדפן. `.gitignore` מכיל `.env`, אבל אין שימוש בו.
- **ארגון Supabase של החברה או DB מנוהל של Bolt: לא ניתן לקבוע.** ה-connectors בסשן מחוברים ל-project אחר, וה-host חסום ברשת, ולכן לא נקראו organization, owner או billing של `qiibgzypiljjwjqebyxo`. עובדות עקיפות מהריפו:
  - שלוש מיגרציות נוספו לריפו בקומיטים בתבנית Bolt (`20260225135900`, `20260305083500`, `20260305083716`).
  - `CLAUDE.md` מתעד אובייקטים ב-DB החי ש"נוצרו ב-Bolt": טבלת `mold_checks` ו-trigger `log_pod_casting_change`.
  - כל המיגרציות מאז 2026-07 מסומנות "יש להריץ ידנית ב-Supabase SQL Editor". כלומר, המשתמשת ניגשת ל-SQL Editor של הפרויקט.
  - ה-project ref `hsvnedrilxgvgwyjzfvt` (המערכת השנייה) **אינו מופיע** בשום מקום בריפו `770770`.

---

## 11. סחף מיגרציות

### מול `supabase_migrations.schema_migrations` בייצור — [לא אומת]
לא בוצע, כי אין גישה ל-`qiibgzypiljjwjqebyxo` (שאילתות 13.8–13.10).
`list_migrations` שהורץ בסשן מחזיר את המיגרציות של `hsvnedrilxgvgwyjzfvt` (33 רשומות: `001_initial_schema` … `20260915090000_wf_trades_write_permissions`). אין ביניהן אף אחת מ-32 המיגרציות של הריפו הזה, כצפוי ממערכת אחרת.

### מה שניתן לקבוע מהריפו עצמו
- **32 קבצים** ב-`supabase/migrations/` (מ-`20260225135900` עד `20260824010000`), ובנוסף `supabase/schema.sql`, שאינו מיגרציה.
- **רוב המיגרציות מורצות ידנית ב-SQL Editor** (מתועד בכל קובץ מאז 2026-07). הרצה ידנית ב-SQL Editor **אינה** כותבת ל-`schema_migrations`. לכן, לפי הקוד, צפוי שהטבלה בייצור לא תשקף אותן — [לא אומת].
- **מיגרציות תיעוד (no-op)** — אובייקטים שנוצרו ב-DB מחוץ לריפו ותועדו בדיעבד: `20260712050000_mold_checks_table.sql` (טבלת `mold_checks`, נוצרה ב-Bolt) ו-`20260726010000_pod_casting_audit.sql` (trigger `log_pod_casting_change`, נוצר ידנית).
- **מיגרציה שנמחקה מהריפו:** `20260713010000_audit_casting_changes.sql` נוספה ב-`dd19503` ונמחקה בקומיט Bolt `1a7fe15`. אם הורצה בייצור, אין לה עוד מקור בריפו.
- **עמודות שהקוד משתמש בהן ואין להן DDL בשום קובץ בריפו:**

  | עמודה | שימוש | DDL בריפו |
  |---|---|---|
  | `production_groups.pod_composition` (jsonb) | `js/projects.js` | **אין** |
  | `production_groups.casting_target_date` | `js/projects.js` | **אין** |

- **פוליסות דריפט מתועדות:** `20260712030000_reset_rls_policies.sql` נכתבה כי "ב-DB החי קיימות פוליסות שנוצרו מחוץ ל-repo (Bolt / עריכות ידניות)". היא מוחקת דינמית **כל** פוליסה על 10 טבלאות ובונה מחדש. האם הורצה, וכמה פוליסות/אובייקטים בייצור אין להם מקור בריפו: **[לא אומת]**.

---

## 12. קבצים בינאריים מעל 1MiB

```
$ git ls-tree -r -l origin/main | awk '$4>=1048576'
(ריק)
$ git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '$1=="blob" && $3>=1048576'
(ריק)
$ ... | awk '$1=="blob" && $2==1048576'
(ריק)
```
- **אין אף קובץ ≥ 1MiB**, לא ב-HEAD ולא בהיסטוריה המלאה (אחרי unshallow). **אין קובץ שגודלו בדיוק 1048576 בתים.**
- הקובץ הגדול ביותר אי-פעם: `js/projects.js`, 105,851 בתים.
- קבצים בינאריים ב-HEAD: `images/apple-touch-icon.png` (1,216), `images/icon-192.png` (14,254), `images/icon-512.png` (70,683), ובנוסף שלושה SVG. כל ה-PNG תקינים: מסתיימים ב-chunk `IEND`, ו-`file` מזהה אותם כ-PNG בממדים הצפויים.

---

## 13. שאילתות שנדרשו על `qiibgzypiljjwjqebyxo` ולא הורצו

אלה השאילתות שהיו עונות על החלקים המסומנים [לא אומת]. **אף אחת מהן לא הורצה.**

```sql
-- 13.1 פרויקטים וכמות פודים
SELECT pr.code, pr.name, pr.project_number, pr.product_type, pr.is_active,
       count(p.id) AS pods, count(p.id) FILTER (WHERE p.is_scrapped) AS scrapped
FROM projects pr LEFT JOIN pods p ON p.project_id = pr.id
GROUP BY pr.id ORDER BY pr.created_at;

-- 13.2 דוגמאות אמיתיות לקודים
SELECT pr.code, min(p.pod_code), max(p.pod_code), count(*)
FROM pods p JOIN projects pr ON pr.id = p.project_id GROUP BY pr.code;

-- 13.3 האם אילוץ הייחודיות קיים בפועל
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.pods'::regclass;

-- 13.4 כפילויות: גלובלית ובתוך פרויקט; התאמת serial_number לסיריאל בקוד
SELECT pod_code, count(*) FROM pods GROUP BY 1 HAVING count(*) > 1;
SELECT project_id, right(pod_code,3), count(*) FROM pods GROUP BY 1,2 HAVING count(*) > 1;
SELECT count(*) FILTER (WHERE serial_number = right(pod_code,3)::int) AS eq,
       count(*) AS total FROM pods;

-- 13.5 התפלגות סטטוסים
SELECT status, casting_approved, is_scrapped, count(*) FROM pods GROUP BY 1,2,3;

-- 13.6 שיוך יעדים
SELECT count(*) FILTER (WHERE destination_id IS NOT NULL), count(*) FROM pods;

-- 13.7 RLS בפועל
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies
WHERE schemaname = 'public' ORDER BY 1,2;

-- 13.8 מיגרציות רשומות
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY 1;

-- 13.9 עמודות בפועל של pods ו-production_groups
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('pods','production_groups')
ORDER BY table_name, ordinal_position;

-- 13.10 triggers ופונקציות בפועל
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers WHERE trigger_schema = 'public';
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY 1;
```

### נספח: שאילתות שהורצו בפועל (כולן על `hsvnedrilxgvgwyjzfvt`, read-only)
1. `get_project_url` → `https://hsvnedrilxgvgwyjzfvt.supabase.co` (גם ב-`Supabase_RO` וגם ב-`Supabase_RW`).
2. `list_migrations` → 33 מיגרציות של מערכת הפועלים/רכש (סעיף 11).
3. `list_edge_functions` → 4 פונקציות (סעיף 8).
4. רשימת הטבלאות ב-`public` → 48 טבלאות/views, ללא `pods` (סעיף 0).
5. עמודות שמכילות `pod`/`qc`/`external`/`unit_code` →
   `po_line_items.pod_model_id`, `price_history.pod_model_id`, `quote_line_items.pod_model_id`,
   `supplier_comparisons.pod_model_id` (כולן uuid). אין עמודה שמפנה ליחידת פוד או ל-`pod_code`.
6. עמודות `projects`, `pod_models`, `wf_tasks` ב-`hsvnedrilxgvgwyjzfvt`:
   - `projects`: `id, code:text, name_he, name_en, client_name, status, start_date, target_end_date, is_active, notes, created_by, created_at, updated_at`
   - `pod_models`: `id, model_code, name_he, name_en, description_he/en, base_price, unit, is_active, created_at, updated_at, width_cm, length_cm, height_cm, drawing_url, black_item_qtys, white_item_qtys, tender_id, quote_id`
   - `wf_tasks`: `id, task_type_id, project_id, title, description, location:text, target_qty, unit, standard_qty_per_hour, period_type, planned_start_date, planned_end_date, status, priority, created_by, created_at, updated_at`

   ב-`wf_tasks` אין עמודה שמפנה לפוד.
