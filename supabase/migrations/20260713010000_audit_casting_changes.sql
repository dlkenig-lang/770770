/*
  # תיעוד כניסה/יציאה מאישור יציקה ב-audit trail

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260713000000 —
  משתמש בטבלת qc_audit_log).

  אישור יציקה הוא האירוע הקריטי תפעולית בזרימת הפוד — עד עכשיו הוא לא
  נרשם בהיסטוריה. ה-trigger מתעד כל שינוי של pods.casting_approved
  (casting_approved / casting_removed) עם המשתמש המבצע.
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
