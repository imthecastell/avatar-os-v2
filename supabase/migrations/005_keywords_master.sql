-- Add is_master flag to keywords so one keyword can unlock all assets
ALTER TABLE keywords ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT false;
