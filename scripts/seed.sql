-- Jivatma — Seed data
-- Run after schema.sql in the Supabase SQL Editor

-- Default pass types
INSERT INTO pass_types (kind, class_count, validity_days, price) VALUES
  ('single',    1,    1,   250.00),
  ('multi',     10,   90,  2000.00),
  ('unlimited', NULL, 30,  1500.00);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('location_address',    ''),
  ('online_meeting_link', ''),
  ('signup_window_weeks', '2'),
  ('default_capacity',    '15');
