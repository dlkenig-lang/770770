/*
  # הגנה על סעיפי QC של שלב חתום + תיעוד שינויי סעיפים

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260713000000 —
  משתמש בטבלת qc_audit_log).

  רקע (תקלת 29/03/2026): טפסי שלב A של כמה פודים נוקו ("ניקוי טופס"),
  מולאו מחדש חלקית ונחתמו עם סעיפים חסרים — בלי שנשאר תיעוד מי ומתי.
  שני מנגנוני הגנה:

  1. protect_signed_stage_items — חוסם ברמת ה-DB כל INSERT/UPDATE/DELETE
     על qc_items כשהשלב ההורה חתום (completed/failed). סוגר גם טאבים
     ישנים שנשארו פתוחים על טופס לא נעול. עריכה לגיטימית עוברת דרך
     "עריכת טופס" (שמחזיר את השלב ל-in_progress) או "ניקוי טופס"
     (שמאפס את השלב ל-pending לפני איפוס הסעיפים — ראו clearStage ב-qc.js).

  2. log_qc_item_change — מתעד ב-qc_audit_log כל ביטול/שינוי של סימון
     קיים (passed/failed → סטטוס אחר) עם המשתמש המבצע. סימון ראשוני
     (pending → passed/failed) לא מתועד בכוונה — רעש.
*/

-- =============================================
-- 1. חסימת שינוי סעיפים של שלב חתום
-- =============================================
CREATE OR REPLACE FUNCTION public.protect_signed_stage_items()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_stage_status TEXT;
  v_stage_id UUID;
BEGIN
  v_stage_id := COALESCE(NEW.stage_id, OLD.stage_id);
  SELECT status INTO v_stage_status FROM public.qc_stages WHERE id = v_stage_id;

  IF v_stage_status IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Stage is signed (%). Reopen it via "Edit form" before changing its items.', v_stage_status
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_signed_stage_items ON qc_items;
CREATE TRIGGER protect_signed_stage_items
  BEFORE INSERT OR UPDATE OR DELETE ON qc_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_stage_items();

-- =============================================
-- 2. תיעוד ביטול/שינוי סימון קיים ב-qc_audit_log
-- =============================================
CREATE OR REPLACE FUNCTION public.log_qc_item_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_pod_id UUID;
  v_stage_number INT;
BEGIN
  -- רק ביטול/היפוך של סימון קיים; מילוי ראשוני לא מתועד (רעש)
  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status IN ('passed', 'failed') THEN
    SELECT pod_id, stage_number INTO v_pod_id, v_stage_number
      FROM public.qc_stages WHERE id = NEW.stage_id;
    INSERT INTO public.qc_audit_log
      (table_name, record_id, pod_id, action, changed_by, changed_by_name, old_values, new_values)
    VALUES (
      'qc_items', NEW.id, v_pod_id, 'item_status_changed', auth.uid(),
      (SELECT full_name FROM profiles WHERE id = auth.uid()),
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'item_key', NEW.item_key,
                         'item_label', NEW.item_label, 'stage_number', v_stage_number)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_qc_item_change ON qc_items;
CREATE TRIGGER log_qc_item_change
  AFTER UPDATE ON qc_items
  FOR EACH ROW EXECUTE FUNCTION public.log_qc_item_change();
