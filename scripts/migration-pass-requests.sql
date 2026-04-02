-- Migration: Add pass_requests table
-- Allows students to request passes, which admins can approve or decline

CREATE TABLE IF NOT EXISTS pass_requests (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pass_type_id    INT NOT NULL REFERENCES pass_types(id),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  payment_method  TEXT CHECK (payment_method IN ('cash', 'transfer', 'other')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE pass_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can create own pass requests"
  ON pass_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view their own requests
CREATE POLICY "Users can view own pass requests"
  ON pass_requests FOR SELECT
  USING (user_id = auth.uid());

-- Admins have full access
CREATE POLICY "Admins full access pass requests"
  ON pass_requests FOR ALL
  USING (is_admin());
