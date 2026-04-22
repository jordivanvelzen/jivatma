-- Jivatma v2 feature batch migration
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/rrqvnrolqollitlhpvjw/sql/new

-- 1) Allow 'gift' as a payment method for user_passes
ALTER TABLE user_passes DROP CONSTRAINT IF EXISTS user_passes_payment_method_check;
ALTER TABLE user_passes
  ADD CONSTRAINT user_passes_payment_method_check
  CHECK (payment_method IN ('cash', 'transfer', 'other', 'gift'));

-- 2) Single-class passes should be valid for 30 days (stackable)
UPDATE pass_types
SET validity_days = 30
WHERE kind = 'single';

-- 3) Bank / payment instructions in settings (seed empty rows if missing)
INSERT INTO settings (key, value) VALUES
  ('bank_name',           ''),
  ('bank_account_holder', ''),
  ('bank_account_number', ''),
  ('bank_clabe',          ''),
  ('bank_card_number',    ''),
  ('payment_instructions', '')
ON CONFLICT (key) DO NOTHING;
