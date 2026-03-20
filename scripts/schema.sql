-- Jivatma database schema
-- Run once in the Neon SQL editor to initialize tables

-- Example table (replace with your actual schema)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
