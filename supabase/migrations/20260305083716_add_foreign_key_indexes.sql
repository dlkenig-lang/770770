/*
  # Add Indexes for Foreign Key Columns

  ## Performance: Index Foreign Keys
  
  Foreign key columns should be indexed to optimize query performance when:
  - Joining tables on foreign key relationships
  - Filtering by foreign key values
  - Deleting parent records (cascade delete operations)

  Adding indexes on the following foreign keys:
  - comments.author_id
  - comments.pod_id
  - comments.resolved_by
  - pods.direction_id
  - pods.group_id
  - pods.type_id
  - projects.created_by
*/

CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_pod_id ON comments(pod_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved_by ON comments(resolved_by);
CREATE INDEX IF NOT EXISTS idx_pods_direction_id ON pods(direction_id);
CREATE INDEX IF NOT EXISTS idx_pods_group_id ON pods(group_id);
CREATE INDEX IF NOT EXISTS idx_pods_type_id ON pods(type_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
