-- Create storage bucket for architectural plans
INSERT INTO storage.buckets (id, name, public)
VALUES ('plans', 'plans', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read plans
CREATE POLICY "Plans are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'plans');

-- Allow admins and PMs to upload plans
CREATE POLICY "Admins and PMs can upload plans"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'plans' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'pm')
    )
  );

-- Allow admins and PMs to delete plans
CREATE POLICY "Admins and PMs can delete plans"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'plans' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'pm')
    )
  );
