/*
  # Allow admin to delete comments
*/
DROP POLICY IF EXISTS "Admin can delete comments" ON comments;

CREATE POLICY "Admin can delete comments" ON comments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );
