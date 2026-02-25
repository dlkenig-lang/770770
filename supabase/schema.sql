-- =============================================
-- Quality Control App - Supabase Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES (extended user info)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'project_manager', 'inspector', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROJECTS
-- =============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code CHAR(3) NOT NULL UNIQUE,
  date_received DATE NOT NULL,
  location TEXT,
  pipe_type TEXT CHECK (pipe_type IN ('HDPE', 'PVC')),
  onedrive_folder_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCTION GROUPS (target date groups)
-- =============================================
CREATE TABLE production_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PROJECT TYPES
-- =============================================
CREATE TABLE project_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type_number INTEGER NOT NULL,
  dimensions TEXT,
  architectural_plan_url TEXT,
  architectural_plan_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, type_number)
);

-- =============================================
-- TYPE DIRECTIONS
-- =============================================
CREATE TABLE type_directions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_id UUID NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  direction CHAR(1) NOT NULL CHECK (direction IN ('R', 'L')),
  pod_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (type_id, direction)
);

-- =============================================
-- PODS
-- =============================================
CREATE TABLE pods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES project_types(id),
  direction_id UUID NOT NULL REFERENCES type_directions(id),
  serial_number INTEGER NOT NULL,
  pod_code TEXT NOT NULL UNIQUE,
  group_id UUID REFERENCES production_groups(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QC STAGES (one per stage group per pod)
-- =============================================
CREATE TABLE qc_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL CHECK (stage_number BETWEEN 1 AND 6),
  stage_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  inspector_name TEXT,
  inspector_signature TEXT, -- base64 signature
  inspection_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pod_id, stage_number)
);

-- =============================================
-- QC ITEMS (individual checklist items)
-- =============================================
CREATE TABLE qc_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id UUID NOT NULL REFERENCES qc_stages(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed')),
  notes TEXT,
  time_entry_1 TEXT,   -- for items requiring 2-time entries
  time_entry_2 TEXT,
  value_entry TEXT,    -- for numeric values
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stage_id, item_key)
);

-- =============================================
-- COMMENTS (for viewers to flag notes)
-- =============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  stage_number INTEGER,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles viewable by authenticated" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin can insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

-- Projects: authenticated users can view
CREATE POLICY "Projects viewable by authenticated" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and PMs can manage projects" ON projects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager')));

-- Production groups: authenticated can view
CREATE POLICY "Production groups viewable" ON production_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and PMs can manage groups" ON production_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager')));

-- Project types: authenticated can view
CREATE POLICY "Types viewable" ON project_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and PMs can manage types" ON project_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager')));

-- Type directions: authenticated can view
CREATE POLICY "Directions viewable" ON type_directions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and PMs can manage directions" ON type_directions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager')));

-- Pods: authenticated can view
CREATE POLICY "Pods viewable" ON pods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and PMs can manage pods" ON pods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager')));

-- QC stages: authenticated can view, inspectors can update
CREATE POLICY "QC stages viewable" ON qc_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inspectors can manage QC stages" ON qc_stages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'inspector')));

-- QC items: authenticated can view, inspectors can update
CREATE POLICY "QC items viewable" ON qc_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inspectors can manage QC items" ON qc_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'inspector')));

-- Comments: all authenticated can view and insert
CREATE POLICY "Comments viewable" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated can comment" ON comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Admins and inspectors can resolve" ON comments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'inspector')));

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pods_updated_at BEFORE UPDATE ON pods FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_qc_stages_updated_at BEFORE UPDATE ON qc_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_qc_items_updated_at BEFORE UPDATE ON qc_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
