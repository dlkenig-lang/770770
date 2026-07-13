/*
  # יישור פוליסות mold_checks (בדיקות תבניות) למודל האבטחה החדש

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260712000000).

  הטבלה mold_checks קיימת ב-DB החי (נוצרה דרך Bolt) אך אינה מתועדת ב-repo
  והפוליסות שלה נותרו במודל הישן — ללא אכיפת is_active וללא
  current_user_role(). הפיצ'ר מיועד לחזור לשימוש, ולכן הפוליסות מיושרות
  כאן לאותו דפוס של בדיקות ה-QC: קריאה לכל משתמש פעיל, כתיבה ל-admin +
  inspector בלבד.

  הערה: הגדרת הטבלה עצמה עדיין חסרה ב-repo (סחיפת סכמה) — תתווסף
  בנפרד לאחר ייצוא המבנה מה-DB החי.
*/

ALTER TABLE mold_checks ENABLE ROW LEVEL SECURITY;

-- מחיקת כל הפוליסות הקיימות על הטבלה, יהא שמן אשר יהא
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mold_checks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.mold_checks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Mold checks viewable" ON mold_checks
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Inspectors can manage mold checks" ON mold_checks
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'inspector'));

-- אימות
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'mold_checks';
