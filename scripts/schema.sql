-- Jivatma — Full Supabase schema
-- Run in the Supabase SQL Editor to initialize

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master admin emails (hardcoded)
-- These users are always set to admin on signup and cannot be demoted
CREATE OR REPLACE FUNCTION is_master_admin(email TEXT)
RETURNS BOOLEAN AS $$
  SELECT email = ANY(ARRAY[
    'chaudy@gmail.com',
    'jordi.vanvelzen@gmail.com'
  ]);
$$ LANGUAGE sql IMMUTABLE;

-- Auto-create profile on signup (master admins get admin role automatically)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN is_master_admin(NEW.email) THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- PASS TYPES (configured by admin)
-- ============================================================
CREATE TABLE pass_types (
  id             SERIAL PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('single', 'multi', 'unlimited')),
  class_count    INT,              -- NULL for unlimited, 1 for single, 10 for multi
  validity_days  INT NOT NULL,     -- 1 for single, 90 for 10-class, 30 for monthly
  price          NUMERIC(8,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'MXN',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER PASSES (purchased / assigned by admin)
-- ============================================================
CREATE TABLE user_passes (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pass_type_id      INT NOT NULL REFERENCES pass_types(id),
  classes_remaining INT,            -- NULL for unlimited
  starts_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at        DATE NOT NULL,
  payment_method    TEXT CHECK (payment_method IN ('cash', 'transfer', 'other')),
  is_paid           BOOLEAN NOT NULL DEFAULT FALSE,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASS TEMPLATES (recurring weekly schedule)
-- ============================================================
CREATE TABLE class_templates (
  id            SERIAL PRIMARY KEY,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time    TIME NOT NULL,
  duration_min  INT NOT NULL DEFAULT 60,
  class_type    TEXT NOT NULL CHECK (class_type IN ('online', 'in_person', 'hybrid')),
  capacity      INT,              -- NULL = use default from settings
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASS SESSIONS (generated from templates)
-- ============================================================
CREATE TABLE class_sessions (
  id            SERIAL PRIMARY KEY,
  template_id   INT REFERENCES class_templates(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL,
  class_type    TEXT NOT NULL CHECK (class_type IN ('online', 'in_person', 'hybrid')),
  capacity      INT,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, date)
);

-- ============================================================
-- BOOKINGS (student signs up for a class)
-- ============================================================
CREATE TABLE bookings (
  id            SERIAL PRIMARY KEY,
  session_id    INT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at  TIMESTAMPTZ,
  UNIQUE(session_id, user_id)
);

-- ============================================================
-- ATTENDANCE (admin confirms who showed up)
-- ============================================================
CREATE TABLE attendance (
  id             SERIAL PRIMARY KEY,
  session_id     INT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pass_id        INT REFERENCES user_passes(id) ON DELETE SET NULL,
  checked_in_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- ============================================================
-- SETTINGS (key-value store)
-- ============================================================
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can update own profile (not role)"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (is_admin());

-- PASS TYPES
ALTER TABLE pass_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active pass types"
  ON pass_types FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "Admins can view all pass types"
  ON pass_types FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can manage pass types"
  ON pass_types FOR ALL
  USING (is_admin());

-- USER PASSES
ALTER TABLE user_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own passes"
  ON user_passes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all passes"
  ON user_passes FOR ALL
  USING (is_admin());

-- CLASS TEMPLATES
ALTER TABLE class_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active templates"
  ON class_templates FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "Admins can manage templates"
  ON class_templates FOR ALL
  USING (is_admin());

-- CLASS SESSIONS
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view sessions"
  ON class_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage sessions"
  ON class_sessions FOR ALL
  USING (is_admin());

-- BOOKINGS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can cancel own bookings"
  ON bookings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all bookings"
  ON bookings FOR ALL
  USING (is_admin());

-- ATTENDANCE
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage attendance"
  ON attendance FOR ALL
  USING (is_admin());

-- SETTINGS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings"
  ON settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  USING (is_admin());
