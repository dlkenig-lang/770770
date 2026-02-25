/*
  # Fix Security and Performance Issues

  This migration addresses multiple security and performance issues identified in the database:

  ## 1. Performance Improvements - Missing Indexes
  Adds indexes on all foreign key columns to optimize query performance:
  - comments table: author_id, pod_id, resolved_by indexes
  - pods table: direction_id, group_id, project_id, type_id indexes
  - production_groups table: project_id index
  - projects table: created_by index

  ## 2. RLS Policy Optimization
  Fixes RLS policies to use SELECT subqueries for auth functions, preventing
  re-evaluation for each row and significantly improving performance at scale:
  - All policies using auth.uid() now use (SELECT auth.uid())
  - Affects policies on: profiles, projects, production_groups, project_types,
    type_directions, pods, qc_stages, qc_items, comments

  ## 3. Remove Duplicate Permissive Policies
  Consolidates redundant SELECT policies to avoid multiple policy evaluation:
  - Keeps viewer policies, removes redundant admin/manager policies for SELECT
  - Affects: projects, production_groups, project_types, type_directions, pods,
    qc_stages, qc_items

  ## 4. Fix Overly Permissive INSERT Policy
  Restricts profile insertion to admin users only instead of allowing all authenticated

  ## 5. Function Security
  Adds explicit search_path to functions to prevent search path manipulation attacks

  ## Security Notes
  - All changes maintain existing access control logic
  - Performance improvements do not compromise security
  - Indexed foreign keys speed up JOIN operations significantly
*/

-- =============================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =============================================

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_pod_id ON comments(pod_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved_by ON comments(resolved_by);

-- Pods table indexes
CREATE INDEX IF NOT EXISTS idx_pods_direction_id ON pods(direction_id);
CREATE INDEX IF NOT EXISTS idx_pods_group_id ON pods(group_id);
CREATE INDEX IF NOT EXISTS idx_pods_project_id ON pods(project_id);
CREATE INDEX IF NOT EXISTS idx_pods_type_id ON pods(type_id);

-- Production groups index
CREATE INDEX IF NOT EXISTS idx_production_groups_project_id ON production_groups(project_id);

-- Projects index
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- =============================================
-- 2. DROP AND RECREATE RLS POLICIES WITH OPTIMIZED AUTH CHECKS
-- =============================================

-- PROFILES policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON profiles;

CREATE POLICY "Users can update own profile" ON profiles 
  FOR UPDATE TO authenticated 
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admin can insert profiles" ON profiles 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- PROJECTS policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "Projects viewable by authenticated" ON projects;
DROP POLICY IF EXISTS "Admins and PMs can manage projects" ON projects;

CREATE POLICY "Projects viewable by authenticated" ON projects 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins and PMs can insert projects" ON projects 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can update projects" ON projects 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can delete projects" ON projects 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

-- PRODUCTION GROUPS policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "Production groups viewable" ON production_groups;
DROP POLICY IF EXISTS "Admins and PMs can manage groups" ON production_groups;

CREATE POLICY "Production groups viewable" ON production_groups 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins and PMs can insert groups" ON production_groups 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can update groups" ON production_groups 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can delete groups" ON production_groups 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

-- PROJECT TYPES policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "Types viewable" ON project_types;
DROP POLICY IF EXISTS "Admins and PMs can manage types" ON project_types;

CREATE POLICY "Types viewable" ON project_types 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins and PMs can insert types" ON project_types 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can update types" ON project_types 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can delete types" ON project_types 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

-- TYPE DIRECTIONS policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "Directions viewable" ON type_directions;
DROP POLICY IF EXISTS "Admins and PMs can manage directions" ON type_directions;

CREATE POLICY "Directions viewable" ON type_directions 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins and PMs can insert directions" ON type_directions 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can update directions" ON type_directions 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can delete directions" ON type_directions 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

-- PODS policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "Pods viewable" ON pods;
DROP POLICY IF EXISTS "Admins and PMs can manage pods" ON pods;

CREATE POLICY "Pods viewable" ON pods 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Admins and PMs can insert pods" ON pods 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can update pods" ON pods 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "Admins and PMs can delete pods" ON pods 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager')
    )
  );

-- QC STAGES policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "QC stages viewable" ON qc_stages;
DROP POLICY IF EXISTS "Inspectors can manage QC stages" ON qc_stages;

CREATE POLICY "QC stages viewable" ON qc_stages 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Inspectors can insert QC stages" ON qc_stages 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

CREATE POLICY "Inspectors can update QC stages" ON qc_stages 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

CREATE POLICY "Inspectors can delete QC stages" ON qc_stages 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

-- QC ITEMS policies - remove duplicate SELECT policy
DROP POLICY IF EXISTS "QC items viewable" ON qc_items;
DROP POLICY IF EXISTS "Inspectors can manage QC items" ON qc_items;

CREATE POLICY "QC items viewable" ON qc_items 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Inspectors can insert QC items" ON qc_items 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

CREATE POLICY "Inspectors can update QC items" ON qc_items 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

CREATE POLICY "Inspectors can delete QC items" ON qc_items 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

-- COMMENTS policies
DROP POLICY IF EXISTS "All authenticated can comment" ON comments;
DROP POLICY IF EXISTS "Admins and inspectors can resolve" ON comments;

CREATE POLICY "All authenticated can comment" ON comments 
  FOR INSERT TO authenticated 
  WITH CHECK (author_id = (SELECT auth.uid()));

CREATE POLICY "Admins and inspectors can resolve" ON comments 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = (SELECT auth.uid()) 
      AND role IN ('admin', 'project_manager', 'inspector')
    )
  );

-- =============================================
-- 3. FIX FUNCTION SEARCH PATHS
-- =============================================

-- Drop and recreate handle_new_user with secure search_path
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Drop and recreate update_updated_at with secure search_path
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_pods_updated_at ON pods;
DROP TRIGGER IF EXISTS update_qc_stages_updated_at ON qc_stages;
DROP TRIGGER IF EXISTS update_qc_items_updated_at ON qc_items;
DROP FUNCTION IF EXISTS update_updated_at();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at 
  BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pods_updated_at 
  BEFORE UPDATE ON pods 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_qc_stages_updated_at 
  BEFORE UPDATE ON qc_stages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_qc_items_updated_at 
  BEFORE UPDATE ON qc_items 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
