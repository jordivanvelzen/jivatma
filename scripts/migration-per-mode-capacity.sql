-- Per-mode capacity for hybrid classes.
-- Adds separate capacity columns for in-person and online attendance.
-- For non-hybrid sessions, the existing `capacity` column continues to be used.
-- For hybrid sessions, when these columns are set they override the single
-- `capacity` value and are enforced per attendance_mode.

ALTER TABLE class_templates
  ADD COLUMN IF NOT EXISTS capacity_inperson INT,
  ADD COLUMN IF NOT EXISTS capacity_online INT;

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS capacity_inperson INT,
  ADD COLUMN IF NOT EXISTS capacity_online INT;
