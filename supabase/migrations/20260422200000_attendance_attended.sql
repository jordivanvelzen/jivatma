-- v2.1: add `attended` column to attendance for no-show tracking
-- A no-show still deducts from the pass (same as attended) but is tagged for stats.
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS attended BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN attendance.attended IS
  'TRUE = student showed up, FALSE = no-show (still deducts pass). Default true for existing rows.';
