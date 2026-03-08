-- Remove project_manager from QC write permissions
-- PMs can view but cannot perform inspections

DROP POLICY IF EXISTS "Inspectors can manage QC stages" ON qc_stages;
CREATE POLICY "Inspectors can manage QC stages" ON qc_stages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'inspector')));

DROP POLICY IF EXISTS "Inspectors can manage QC items" ON qc_items;
CREATE POLICY "Inspectors can manage QC items" ON qc_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'inspector')));
