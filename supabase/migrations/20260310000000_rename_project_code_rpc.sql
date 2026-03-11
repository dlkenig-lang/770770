/*
  # Add RPC function to rename project code in all pod_codes

  Instead of 380 individual UPDATE requests from the client, this function
  performs a single atomic bulk UPDATE server-side, bypassing rate limits
  and ensuring consistency.
*/

CREATE OR REPLACE FUNCTION rename_project_code_in_pods(
  p_project_id UUID,
  p_old_code   TEXT,
  p_new_code   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only admins and project_managers may call this
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'project_manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE pods
  SET pod_code = p_new_code || SUBSTRING(pod_code FROM LENGTH(p_old_code) + 1)
  WHERE project_id = p_project_id
    AND pod_code LIKE p_old_code || '-%';
END;
$$;
