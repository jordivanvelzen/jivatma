-- Adds a per-profile flag controlling whether the user appears in the
-- admin attendance page's student list. Defaults TRUE so everyone keeps
-- showing up; Claudia (the teacher admin) can be toggled off so she
-- doesn't appear as a checkable student.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_in_attendance BOOLEAN NOT NULL DEFAULT TRUE;
