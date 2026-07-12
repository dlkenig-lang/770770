/*
  # Critical Security Fixes

  ⚠️ יש להריץ את הקובץ הזה ידנית ב-Supabase SQL Editor (או `supabase db push`) —
  פריסת האתר ב-GitHub Pages/Netlify אינה מחילה מיגרציות על ה-DB.

  ## מה מתוקן כאן

  1. **הרשמה כ-admin דרך metadata** — `handle_new_user` לקח את התפקיד מ-
     `raw_user_meta_data` שנשלט ע"י הלקוח. מעכשיו תפקיד חדש הוא תמיד 'viewer'.

  2. **שדרוג תפקיד עצמי** — הפוליסי "Users can update own profile" איפשר
     `UPDATE profiles SET role='admin'` על השורה של עצמך. נוסף trigger שחוסם
     שינוי role / is_active / email / username לכל מי שאינו אדמין פעיל.

  3. **הגבלת PM מ-QC לא נאכפה** — המיגרציה 20260308110000 מחקה פוליסות בשמות
     ישנים והשאירה את הפוליסות המפוצלות (insert/update/delete) שכוללות
     project_manager. כאן כל פוליסות ה-QC נמחקות בשמותיהן המדויקים ונבנות
     מחדש עבור admin+inspector בלבד.

  4. **אכיפת is_active** — כל הפוליסות עוברות לפונקציית עזר
     `current_user_role()` שמחזירה NULL למשתמש לא פעיל, כך שנטרול משתמש
     חוסם אותו בפועל (קריאה וכתיבה) ולא רק ב-UI.

  5. **הרשמה פתוחה** — משתמש חדש נוצר עם is_active=false וממתין לאישור אדמין
     במסך ניהול המשתמשים (כפתור "הפעל" הקיים). עד לאישור אינו רואה שום נתון.

  בנוסף (תיקונים כרוכים):
  - נוספה פוליסת UPDATE לאדמין על פרופילים של אחרים — בלעדיה מסך ניהול
    המשתמשים לא יכול לשנות תפקיד/סטטוס (ב-repo לא היה פוליסי כזה).
  - תוקן שם התפקיד השגוי 'pm' → 'project_manager' בפוליסות של תוכניות
    (type_plans + storage 'plans') — עד עכשיו מנהל פרויקט לא יכול היה להעלות תוכניות.
  - העלאת/מחיקת תמונות QC (storage 'qc-images') הוגבלה ל-admin+inspector
    (היה פתוח לכל משתמש מאומת, כולל מחיקת תמונות של אחרים).
  - עדכון pods הורחב גם ל-inspector: הקוד מעדכן status/casting_approved של
    הפוד מתוך זרימת ה-QC, והפוליסי הקודם (admin+PM בלבד) גרם לעדכונים
    האלה להיכשל בשקט אצל בודקים.

  ## הערת bootstrap
  משתמשים קיימים אינם מושפעים (is_active=true נשאר). אם מקימים DB חדש
  מאפס — יש להפוך את המשתמש הראשון לאדמין ידנית:
    UPDATE profiles SET role='admin', is_active=true WHERE email='...';
*/

-- =============================================
-- 0. HELPER: role of the calling user, NULL if inactive/missing
-- =============================================
-- SECURITY DEFINER so it bypasses RLS on profiles (prevents policy recursion).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM profiles
  WHERE id = auth.uid() AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- =============================================
-- 1. SIGNUP TRIGGER: never trust client metadata for role;
--    new users start inactive (pending admin approval)
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
      split_part(NEW.email, '@', 1)
    ),
    'viewer',   -- role from client metadata is ignored on purpose
    false       -- pending admin approval
  );
  RETURN NEW;
END;
$$;

-- =============================================
-- 2. BLOCK PRIVILEGE CHANGES BY NON-ADMINS
-- =============================================
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  -- No JWT context (service role / SQL editor / dashboard) — trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.role       IS DISTINCT FROM OLD.role
   OR NEW.is_active  IS DISTINCT FROM OLD.is_active
   OR NEW.email      IS DISTINCT FROM OLD.email
   OR NEW.username   IS DISTINCT FROM OLD.username)
   AND public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only an active admin may change role, is_active, email or username';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- =============================================
-- 3. PROFILES POLICIES
-- =============================================
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;

-- Everyone may read their own row (needed to discover pending/inactive state);
-- full directory only for active users.
CREATE POLICY "Profiles viewable by active users" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.current_user_role()) IS NOT NULL
  );

-- Own-row updates (privileged columns are guarded by the trigger above).
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Admins manage everyone (role changes, activation) — required by the users screen.
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) = 'admin')
  WITH CHECK ((SELECT public.current_user_role()) = 'admin');

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_role()) = 'admin');

-- Self-heal fallback in app.js may recreate a missing own profile,
-- but only as an inactive viewer.
CREATE POLICY "Users can insert own pending profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = 'viewer'
    AND is_active = false
  );

-- =============================================
-- 4. DATA TABLES — SELECT requires an ACTIVE user
-- =============================================
DROP POLICY IF EXISTS "Projects viewable by authenticated" ON projects;
CREATE POLICY "Projects viewable by active users" ON projects
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Production groups viewable" ON production_groups;
CREATE POLICY "Production groups viewable" ON production_groups
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Types viewable" ON project_types;
CREATE POLICY "Types viewable" ON project_types
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Directions viewable" ON type_directions;
CREATE POLICY "Directions viewable" ON type_directions
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Pods viewable" ON pods;
CREATE POLICY "Pods viewable" ON pods
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "QC stages viewable" ON qc_stages;
CREATE POLICY "QC stages viewable" ON qc_stages
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "QC items viewable" ON qc_items;
CREATE POLICY "QC items viewable" ON qc_items
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Comments viewable" ON comments;
CREATE POLICY "Comments viewable" ON comments
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Plans viewable by authenticated" ON type_plans;
CREATE POLICY "Plans viewable by active users" ON type_plans
  FOR SELECT TO authenticated
  USING ((SELECT public.current_user_role()) IS NOT NULL);

-- =============================================
-- 5. WRITE POLICIES — rebuilt on the helper (role + is_active)
-- =============================================

-- ---- PROJECTS: admin + PM ----
DROP POLICY IF EXISTS "Admins and PMs can manage projects" ON projects;
DROP POLICY IF EXISTS "Admins and PMs can insert projects" ON projects;
DROP POLICY IF EXISTS "Admins and PMs can update projects" ON projects;
DROP POLICY IF EXISTS "Admins and PMs can delete projects" ON projects;
CREATE POLICY "Admins and PMs can manage projects" ON projects
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

-- ---- PRODUCTION GROUPS: admin + PM ----
DROP POLICY IF EXISTS "Admins and PMs can manage groups" ON production_groups;
DROP POLICY IF EXISTS "Admins and PMs can insert groups" ON production_groups;
DROP POLICY IF EXISTS "Admins and PMs can update groups" ON production_groups;
DROP POLICY IF EXISTS "Admins and PMs can delete groups" ON production_groups;
CREATE POLICY "Admins and PMs can manage groups" ON production_groups
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

-- ---- PROJECT TYPES: admin + PM ----
DROP POLICY IF EXISTS "Admins and PMs can manage types" ON project_types;
DROP POLICY IF EXISTS "Admins and PMs can insert types" ON project_types;
DROP POLICY IF EXISTS "Admins and PMs can update types" ON project_types;
DROP POLICY IF EXISTS "Admins and PMs can delete types" ON project_types;
CREATE POLICY "Admins and PMs can manage types" ON project_types
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

-- ---- TYPE DIRECTIONS: admin + PM ----
DROP POLICY IF EXISTS "Admins and PMs can manage directions" ON type_directions;
DROP POLICY IF EXISTS "Admins and PMs can insert directions" ON type_directions;
DROP POLICY IF EXISTS "Admins and PMs can update directions" ON type_directions;
DROP POLICY IF EXISTS "Admins and PMs can delete directions" ON type_directions;
CREATE POLICY "Admins and PMs can manage directions" ON type_directions
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

-- ---- PODS: insert/delete admin + PM; update also inspector ----
-- (inspectors update pods.status and casting_approved from the QC flow)
DROP POLICY IF EXISTS "Admins and PMs can manage pods" ON pods;
DROP POLICY IF EXISTS "Admins and PMs can insert pods" ON pods;
DROP POLICY IF EXISTS "Admins and PMs can update pods" ON pods;
DROP POLICY IF EXISTS "Admins and PMs can delete pods" ON pods;
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

-- ---- QC STAGES: admin + inspector only (PM excluded — fix #3) ----
DROP POLICY IF EXISTS "Inspectors can manage QC stages" ON qc_stages;
DROP POLICY IF EXISTS "Inspectors can insert QC stages" ON qc_stages;
DROP POLICY IF EXISTS "Inspectors can update QC stages" ON qc_stages;
DROP POLICY IF EXISTS "Inspectors can delete QC stages" ON qc_stages;
CREATE POLICY "Inspectors can manage QC stages" ON qc_stages
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'inspector'));

-- ---- QC ITEMS: admin + inspector only (PM excluded — fix #3) ----
DROP POLICY IF EXISTS "Inspectors can manage QC items" ON qc_items;
DROP POLICY IF EXISTS "Inspectors can insert QC items" ON qc_items;
DROP POLICY IF EXISTS "Inspectors can update QC items" ON qc_items;
DROP POLICY IF EXISTS "Inspectors can delete QC items" ON qc_items;
CREATE POLICY "Inspectors can manage QC items" ON qc_items
  FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'inspector'));

-- ---- COMMENTS ----
DROP POLICY IF EXISTS "All authenticated can comment" ON comments;
CREATE POLICY "Active users can comment" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (SELECT public.current_user_role()) IS NOT NULL
  );

DROP POLICY IF EXISTS "Admins and inspectors can resolve" ON comments;
CREATE POLICY "Admins and inspectors can resolve" ON comments
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager', 'inspector'));

DROP POLICY IF EXISTS "Admin can delete comments" ON comments;
CREATE POLICY "Admin can delete comments" ON comments
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_role()) = 'admin');

-- =============================================
-- 6. TYPE PLANS + STORAGE — fix wrong role name 'pm' → 'project_manager'
-- =============================================
DROP POLICY IF EXISTS "Admins and PMs can insert plans" ON type_plans;
CREATE POLICY "Admins and PMs can insert plans" ON type_plans
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "Admins and PMs can delete plans" ON type_plans;
CREATE POLICY "Admins and PMs can delete plans" ON type_plans
  FOR DELETE TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'project_manager'));

DROP POLICY IF EXISTS "Admins and PMs can upload plans" ON storage.objects;
CREATE POLICY "Admins and PMs can upload plans" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plans'
    AND (SELECT public.current_user_role()) IN ('admin', 'project_manager')
  );

DROP POLICY IF EXISTS "Admins and PMs can delete plans" ON storage.objects;
CREATE POLICY "Admins and PMs can delete plans" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'plans'
    AND (SELECT public.current_user_role()) IN ('admin', 'project_manager')
  );

-- QC images: only staff who can actually edit QC items may upload/delete
-- (was: any authenticated user could delete anyone's images)
DROP POLICY IF EXISTS "Authenticated users can upload QC images" ON storage.objects;
CREATE POLICY "Inspectors can upload QC images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qc-images'
    AND (SELECT public.current_user_role()) IN ('admin', 'inspector')
  );

DROP POLICY IF EXISTS "Authenticated users can delete QC images" ON storage.objects;
CREATE POLICY "Inspectors can delete QC images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'qc-images'
    AND (SELECT public.current_user_role()) IN ('admin', 'inspector')
  );
