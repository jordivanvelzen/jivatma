-- Jivatma — Complete database setup
-- Run this ONCE in Supabase SQL Editor: https://supabase.com/dashboard/project/rrqvnrolqollitlhpvjw/sql/new

-- ============================================================
-- CLEAN SLATE (drop if exists)
-- ============================================================
DROP TRIGGER IF EXISTS protect_master_admin_trigger ON profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS protect_master_admin() CASCADE;
DROP FUNCTION IF EXISTS is_master_admin(TEXT) CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS class_templates CASCADE;
DROP TABLE IF EXISTS user_passes CASCADE;
DROP TABLE IF EXISTS pass_types CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  role       TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Master admin check
CREATE OR REPLACE FUNCTION is_master_admin(email TEXT)
RETURNS BOOLEAN AS $$
  SELECT email = ANY(ARRAY[
    'chaudy@gmail.com',
    'jordi.vanvelzen@gmail.com'
  ]);
$$ LANGUAGE sql IMMUTABLE;

-- Auto-create profile on signup
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

-- Prevent demoting master admins
CREATE OR REPLACE FUNCTION protect_master_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.id AND is_master_admin(email))
     AND NEW.role <> 'admin' THEN
    RAISE EXCEPTION 'Cannot demote a master admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_master_admin_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_master_admin();

-- ============================================================
-- PASS TYPES
-- ============================================================
CREATE TABLE pass_types (
  id             SERIAL PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('single', 'multi', 'unlimited')),
  class_count    INT,
  validity_days  INT NOT NULL,
  price          NUMERIC(8,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'MXN',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USER PASSES
-- ============================================================
CREATE TABLE user_passes (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pass_type_id      INT NOT NULL REFERENCES pass_types(id),
  classes_remaining INT,
  starts_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at        DATE NOT NULL,
  payment_method    TEXT CHECK (payment_method IN ('cash', 'transfer', 'other')),
  is_paid           BOOLEAN NOT NULL DEFAULT FALSE,
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASS TEMPLATES
-- ============================================================
CREATE TABLE class_templates (
  id            SERIAL PRIMARY KEY,
  day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,
  duration_min  INT NOT NULL DEFAULT 60,
  class_type    TEXT NOT NULL CHECK (class_type IN ('online', 'in_person', 'hybrid')),
  capacity      INT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASS SESSIONS
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
-- BOOKINGS
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
-- ATTENDANCE
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
-- SETTINGS
-- ============================================================
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (is_admin());

ALTER TABLE pass_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active pass types" ON pass_types FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);
CREATE POLICY "Admins full access pass types" ON pass_types FOR ALL USING (is_admin());

ALTER TABLE user_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own passes" ON user_passes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins full access passes" ON user_passes FOR ALL USING (is_admin());

ALTER TABLE class_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active templates" ON class_templates FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);
CREATE POLICY "Admins full access templates" ON class_templates FOR ALL USING (is_admin());

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sessions" ON class_sessions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins full access sessions" ON class_sessions FOR ALL USING (is_admin());

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create own bookings" ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins full access bookings" ON bookings FOR ALL USING (is_admin());

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins full access attendance" ON attendance FOR ALL USING (is_admin());

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins full access settings" ON settings FOR ALL USING (is_admin());

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO pass_types (kind, class_count, validity_days, price) VALUES
  ('single',    1,    1,   150.00),
  ('multi',     10,   60,  1200.00),
  ('unlimited', NULL, 30,  1200.00);

INSERT INTO settings (key, value) VALUES
  ('location_address',    ''),
  ('online_meeting_link', ''),
  ('signup_window_weeks', '2'),
  ('default_capacity',    '15');

-- Promote existing master admins if they already signed up
UPDATE profiles SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('chaudy@gmail.com', 'jordi.vanvelzen@gmail.com')
);
