-- Run this in Supabase SQL Editor to apply master admin changes

-- Master admin check function
CREATE OR REPLACE FUNCTION is_master_admin(email TEXT)
RETURNS BOOLEAN AS $$
  SELECT email = ANY(ARRAY[
    'chaudy@gmail.com',
    'jordi.vanvelzen@gmail.com'
  ]);
$$ LANGUAGE sql IMMUTABLE;

-- Update the signup trigger to auto-assign admin role
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

-- If these users already registered, promote them now
UPDATE profiles SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('chaudy@gmail.com', 'jordi.vanvelzen@gmail.com')
);

-- Prevent demoting master admins (protect on update)
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

DROP TRIGGER IF EXISTS protect_master_admin_trigger ON profiles;
CREATE TRIGGER protect_master_admin_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_master_admin();
