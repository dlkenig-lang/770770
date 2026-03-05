/*
  # Fix Comments SELECT Policy
  Ensures the SELECT policy on comments exists and is correct.
  The previous migration recreated INSERT/UPDATE but left SELECT untouched.
*/

DROP POLICY IF EXISTS "Comments viewable" ON comments;

CREATE POLICY "Comments viewable" ON comments
  FOR SELECT TO authenticated
  USING (true);
