-- Add max_pods capacity limit to production groups
ALTER TABLE production_groups ADD COLUMN IF NOT EXISTS max_pods INTEGER;

-- Add group_serial to pods (serial number within a group, e.g. 1→A1, 2→A2)
ALTER TABLE pods ADD COLUMN IF NOT EXISTS group_serial INTEGER;
