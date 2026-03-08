-- Add image columns to qc_items
ALTER TABLE qc_items
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_storage_path TEXT;

-- Storage bucket for QC item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('qc-images', 'qc-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "QC images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'qc-images');

CREATE POLICY "Authenticated users can upload QC images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'qc-images');

CREATE POLICY "Authenticated users can delete QC images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'qc-images');
