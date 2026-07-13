/*
  # איפוס מלא של פוליסות RLS — חיסול פוליסות דריפט

  ⚠️ יש להריץ ידנית ב-Supabase SQL Editor (אחרי 20260712000000).

  ## הבעיה שזה פותר
  ב-DB החי קיימות פוליסות שנוצרו מחוץ ל-repo (Bolt / עריכות ידניות) בשמות
  שהמיגרציות לא הכירו, ולכן לא נמחקו. אחת מהן — פוליסת UPDATE על profiles
  עם `EXISTS (SELECT ... FROM profiles)` בתוכה — גורמת מאז המיגרציה
  הקריטית ל-"infinite recursion detected in policy for relation profiles"
  בכל ניסיון של אדמין לעדכן משתמש (אישור משתמש חדש, שינוי תפקיד).

  ## מה המיגרציה עושה
  1. מוחקת דינמית את *כל* הפוליסות על טבלאות האפליקציה בסכמת public —
     יהא שמן אשר יהא.
  2. בונה מחדש את הסט המלא והנכון (זהה ל-20260712000000), שכולו מבוסס
     על public.current_user_role() — בלי תתי-שאילתות על profiles בתוך
     פוליסות של profiles, ולכן בלי רקורסיה.

  הרצה בטוחה: הכול בטרנזקציה אחת; אין שינוי בנתונים עצמם.
  (פוליסות storage.objects לא נכללות כאן — הן טופלו ב-20260712010000.)
*/

-- =============================================
-- 1. DROP ALL POLICIES ON APP TABLES (any name, including drift)
-- =============================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'projects', 'production_groups', 'project_types',
        'type_directions', 'pods', 'qc_stages', 'qc_items', 'comments',
        'type_plans'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- =============================================
-- 2. PROFILES
-- =============================================
CREATE POLICY "Profiles viewable by active users" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.current_user_role()) IS NOT NULL
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) = 'admin')
  WITH CHECK ((SELECT public.current_user_role()) = 'admin');

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_role()) = 'admin');

CREATE POLICY "Users can insert own pending profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = 'viewer'
    AND is_active = false
  );

-- =============================================
-- 3. DATA TABLES — SELECT for active users
-- =============================================
CREATE POLICY "Projects viewable by active users" ON projects
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Production groups viewable" ON production_groups
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Types viewable" ON project_types
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Directions viewable" ON type_directions
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Pods viewable" ON pods
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "QC stages viewable" ON qc_stages
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "QC items viewable" ON qc_items
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Comments viewable" ON comments
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

CREATE POLICY "Plans viewable by active users" ON type_plans
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

-- =============================================
-- 4. WRITE POLICIES
-- =============================================
CREATE POLICY "Admins and PMs can manage projects" ON projects
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

CREATE POLICY "Admins and PMs can manage groups" ON production_groups
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

CREATE POLICY "Admins and PMs can manage types" ON project_types
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

CREATE POLICY "Admins and PMs can manage directions" ON type_directions
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

CREATE POLICY "Admins and PMs can insert pods" ON pods
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));
CREATE POLICY "Staff can update pods" ON pods
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'));
CREATE POLICY "Admins and PMs can delete pods" ON pods
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

CREATE POLICY "Inspectors can manage QC stages" ON qc_stages
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'inspector'));

CREATE POLICY "Inspectors can manage QC items" ON qc_items
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'inspector'));

CREATE POLICY "Active users can comment" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (SELECT public.current_user_role()) IS NOT NULL
  );
CREATE POLICY "Admins and inspectors can resolve" ON comments
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'));
CREATE POLICY "Admin can delete comments" ON comments
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_role()) = 'admin');

CREATE POLICY "Admins and PMs can insert plans" ON type_plans
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));
CREATE POLICY "Admins and PMs can delete plans" ON type_plans
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

-- =============================================
-- 5. אימות: הצגת הפוליסות שנוצרו (לבדיקה ויזואלית אחרי ההרצה)
-- =============================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
