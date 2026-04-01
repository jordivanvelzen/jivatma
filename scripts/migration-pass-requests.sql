-- Migration: Add pass_requests table and change currency to MXN
-- Run in Supabase SQL Editor

-- 1. Currency: EUR → MXN
ALTER TABLE pass_types ALTER COLUMN currency SET DEFAULT 'MXN';
UPDATE pass_types SET currency = 'MXN' WHERE currency = 'EUR';

-- 2. Pass Requests table
CREATE TABLE pass_requests (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pass_type_id  INT NOT NULL REFERENCES pass_types(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('transfer', 'cash', 'other')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes   TEXT,
  reviewed_by   UUID REFERENCES profiles(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS for pass_requests
ALTER TABLE pass_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON pass_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own requests"
  ON pass_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins full access requests"
  ON pass_requests FOR ALL
  USING (is_admin());
