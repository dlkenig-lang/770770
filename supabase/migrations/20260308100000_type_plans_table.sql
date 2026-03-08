-- Create type_plans table for multiple PDFs per project type
CREATE TABLE IF NOT EXISTS type_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES profiles(id)
);

ALTER TABLE type_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans viewable by authenticated" ON type_plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and PMs can insert plans" ON type_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'pm')
    )
  );

CREATE POLICY "Admins and PMs can delete plans" ON type_plans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'pm')
    )
  );

-- Migrate existing plans from project_types columns
INSERT INTO type_plans (type_id, project_id, file_name, file_url, storage_path)
SELECT
  pt.id,
  pt.project_id,
  COALESCE(pt.architectural_plan_name, 'תוכנית'),
  pt.architectural_plan_url,
  ''
FROM project_types pt
WHERE pt.architectural_plan_url IS NOT NULL;
