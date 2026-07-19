/*
  # הרשאת כתיבה ל-QC למנהל פרויקט (project_manager)

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260719000000).

  מנהל פרויקט יכול מעתה למלא טפסי QC, לסמן סעיפים, לחתום על שלבים
  ולפתוח שלב חתום ("עריכת טופס") — כמו בודק. שימו לב: שם התפקיד
  בפוליסות הוא 'project_manager', לא 'pm'.

  בנוסף: עדכון protect_signed_stage_items כך שהרצות ישירות מה-SQL Editor
  (ללא JWT — auth.uid() IS NULL) עוקפות את החסימה, לצורך תיקוני נתונים —
  באותה קונבנציה כמו protect_comment_content.

  בדיקות תבניות (mold_checks) נשארות admin+inspector בלבד — לא שונו.
*/

-- =============================================
-- 1. qc_stages / qc_items — הוספת project_manager
-- =============================================
DROP POLICY IF EXISTS "Inspectors can manage QC stages" ON qc_stages;
CREATE POLICY "Inspectors can manage QC stages" ON qc_stages
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'));

DROP POLICY IF EXISTS "Inspectors can manage QC items" ON qc_items;
CREATE POLICY "Inspectors can manage QC items" ON qc_items
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'));

-- =============================================
-- 2. תמונות QC — העלאה/מחיקה גם למנהל פרויקט
-- =============================================
DROP POLICY IF EXISTS "Inspectors can upload QC images" ON storage.objects;
CREATE POLICY "Inspectors can upload QC images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qc-images'
    AND (SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector')
  );

DROP POLICY IF EXISTS "Inspectors can delete QC images" ON storage.objects;
CREATE POLICY "Inspectors can delete QC images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'qc-images'
    AND (SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector')
  );

-- =============================================
-- 3. protect_signed_stage_items — bypass להרצות SQL Editor
--    (auth.uid() IS NULL = service role / SQL editor — trusted)
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
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

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
