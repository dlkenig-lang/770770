/*
  # תיעוד אישור יציקה ב-audit log — הגדרה קיימת ב-DB החי

  ⚠️ **מיגרציית תיעוד — no-op על ה-DB החי.** ה-trigger
  `log_pod_casting_change` כבר קיים ב-DB (נוסף ידנית ב-SQL Editor או דרך
  Bolt, מחוץ ל-repo). הקובץ הזה שומר את ההגדרה המדויקת שלו כדי שלא
  ייעלם בשחזור DB מהמיגרציות — באותה קונבנציה כמו
  20260712050000_mold_checks_table.sql.

  ההגדרה נשלפה מה-DB החי ב-26/07/2026 עם
  `pg_get_functiondef('public.log_pod_casting_change'::regproc)` והועתקה
  כפי שהיא. **אין לשנות את הלוגיקה בקובץ הזה** — שינוי התנהגות דורש
  מיגרציה חדשה.

  מה זה מתעד: כל שינוי ב-`pods.casting_approved` (אישור פוד ליציקה או
  ביטול האישור) עם המשתמש המבצע. הפעולות הן `casting_approved` /
  `casting_removed`, ומוצגות בהיסטוריית הפוד (📜) — `showPodHistory`
  מסננת לפי `pod_id` בלבד ללא `table_name`, וה-trigger כותב
  `pod_id = NEW.id`, בשונה מ-`mold_checks` שנכתבות עם `pod_id = NULL`.
  התוויות: `audit.casting_approved` / `audit.casting_removed` ב-i18n.js.
*/

CREATE OR REPLACE FUNCTION public.log_pod_casting_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.casting_approved IS DISTINCT FROM OLD.casting_approved THEN
    INSERT INTO public.qc_audit_log
      (table_name, record_id, pod_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (
      'pods', NEW.id, NEW.id,
      CASE WHEN NEW.casting_approved THEN 'casting_approved' ELSE 'casting_removed' END,
      auth.uid(),
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      jsonb_build_object('casting_approved', OLD.casting_approved, 'casting_approved_at', OLD.casting_approved_at),
      jsonb_build_object('casting_approved', NEW.casting_approved, 'casting_approved_at', NEW.casting_approved_at, 'pod_code', NEW.pod_code)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_pod_casting_change ON pods;
CREATE TRIGGER log_pod_casting_change
  AFTER UPDATE ON pods
  FOR EACH ROW EXECUTE FUNCTION public.log_pod_casting_change();
