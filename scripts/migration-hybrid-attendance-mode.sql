-- ============================================================
-- Migration: hybrid attendance mode
-- ------------------------------------------------------------
-- Adds attendance_mode to bookings so students can choose
-- whether they will attend a hybrid class online or in-person.
-- NULL is allowed for non-hybrid sessions (the mode is implicit
-- from class_sessions.class_type).
--
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS attendance_mode TEXT
  CHECK (attendance_mode IN ('online','in_person'));

-- Backfill: bookings on online or in-person sessions get the obvious value.
-- Hybrid bookings stay NULL (we don't know retroactively what the student wanted).
UPDATE bookings b
SET attendance_mode = cs.class_type
FROM class_sessions cs
WHERE b.session_id = cs.id
  AND b.attendance_mode IS NULL
  AND cs.class_type IN ('online','in_person');
