/*
  # Enable RLS on All Tables and Drop Unused Indexes

  ## Security Fix: Enable Row Level Security
  Critical security issue: RLS policies exist but are not enforced.
  This enables RLS on all application tables.

  ## Performance: Drop Unused Indexes
  Unused foreign key indexes are removed to reduce storage overhead.
*/

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE type_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_groups ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS idx_comments_author_id;
DROP INDEX IF EXISTS idx_comments_pod_id;
DROP INDEX IF EXISTS idx_comments_resolved_by;
DROP INDEX IF EXISTS idx_pods_direction_id;
DROP INDEX IF EXISTS idx_pods_group_id;
DROP INDEX IF EXISTS idx_pods_type_id;
DROP INDEX IF EXISTS idx_projects_created_by;
