/*
  # Audit trail לבדיקות QC ותבניות

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260712000000 —
  משתמש ב-current_user_role).

  טבלת qc_audit_log מתעדת אירועים מהותיים באחריותיות של מערכת איכות:
  - חתימה על שלב QC / בדיקת תבנית (stage_signed / mold_signed)
  - פתיחה מחדש של שלב חתום (stage_reopened / mold_reopened)
  - ניקוי טופס (stage_cleared / mold_cleared)
  הרישום נעשה ב-trigger ברמת ה-DB — אי אפשר לעקוף אותו מהלקוח, וללקוח
  אין שום הרשאת כתיבה על הטבלה. צפייה: אדמין בלבד (כפתור 📜 במסך פוד).
*/

CREATE TABLE IF NOT EXISTS qc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  pod_id UUID,
  action TEXT NOT NULL,
  changed_by UUID,
  changed_by_name TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_audit_pod ON qc_audit_log(pod_id);
CREATE INDEX IF NOT EXISTS idx_qc_audit_record ON qc_audit_log(record_id);

ALTER TABLE qc_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON qc_audit_log;
CREATE POLICY "Admins can view audit log" ON qc_audit_log
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) = 'admin');
-- אין פוליסות INSERT/UPDATE/DELETE בכוונה: הכתיבה נעשית רק ע"י
-- ה-triggers (SECURITY DEFINER) והרשומות חסינות לשינוי מהלקוח.

-- =============================================
-- TRIGGER: qc_stages — רישום מעברי סטטוס
-- =============================================
CREATE OR REPLACE FUNCTION public.log_qc_stage_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_action TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE
      WHEN OLD.status IN ('completed', 'failed') AND NEW.status = 'in_progress' THEN 'stage_reopened'
      WHEN NEW.status IN ('completed', 'failed') THEN 'stage_signed'
      WHEN NEW.status = 'pending' AND OLD.status <> 'pending' THEN 'stage_cleared'
      ELSE 'stage_updated'
    END;
    -- מעברי שגרה pending→in_progress (מילוי טופס) לא מתועדים — רעש
    IF v_action = 'stage_updated' AND OLD.status = 'pending' AND NEW.status = 'in_progress' THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.qc_audit_log
      (table_name, record_id, pod_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (
      'qc_stages', NEW.id, NEW.pod_id, v_action, auth.uid(),
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      jsonb_build_object('status', OLD.status, 'inspector_name', OLD.inspector_name, 'inspection_date', OLD.inspection_date),
      jsonb_build_object('status', NEW.status, 'inspector_name', NEW.inspector_name, 'inspection_date', NEW.inspection_date, 'stage_number', NEW.stage_number)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_qc_stage_change ON qc_stages;
CREATE TRIGGER log_qc_stage_change
  AFTER UPDATE ON qc_stages
  FOR EACH ROW EXECUTE FUNCTION public.log_qc_stage_change();

-- =============================================
-- TRIGGER: mold_checks — רישום מעברי סטטוס
-- =============================================
CREATE OR REPLACE FUNCTION public.log_mold_check_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_action TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE
      WHEN OLD.status IN ('completed', 'failed') AND NEW.status = 'in_progress' THEN 'mold_reopened'
      WHEN NEW.status IN ('completed', 'failed') THEN 'mold_signed'
      WHEN NEW.status = 'pending' AND OLD.status <> 'pending' THEN 'mold_cleared'
      ELSE 'mold_updated'
    END;
    IF v_action = 'mold_updated' AND OLD.status = 'pending' AND NEW.status = 'in_progress' THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.qc_audit_log
      (table_name, record_id, pod_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (
      'mold_checks', NEW.id, NULL, v_action, auth.uid(),
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      jsonb_build_object('status', OLD.status, 'inspector_name', OLD.inspector_name),
      jsonb_build_object('status', NEW.status, 'inspector_name', NEW.inspector_name, 'mold_number', NEW.mold_number, 'direction', NEW.direction)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_mold_check_change ON mold_checks;
CREATE TRIGGER log_mold_check_change
  AFTER UPDATE ON mold_checks
  FOR EACH ROW EXECUTE FUNCTION public.log_mold_check_change();
