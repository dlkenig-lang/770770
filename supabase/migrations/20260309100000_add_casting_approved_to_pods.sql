-- Add casting_approved fields to pods table
ALTER TABLE pods
  ADD COLUMN IF NOT EXISTS casting_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS casting_approved_at timestamptz;
