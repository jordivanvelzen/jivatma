-- Run this in Supabase SQL Editor to diagnose the trigger issue

-- 1. Check if the trigger exists on auth.users
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- 2. Check what the trigger function looks like
SELECT prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 3. Check if there's another trigger on auth.users that conflicts
SELECT tgname, proname
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass;

-- 4. Test the function logic directly (simulates what happens during signup)
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- Test is_master_admin
  SELECT is_master_admin('chaudy@gmail.com') INTO test_result;
  RAISE NOTICE 'is_master_admin test: %', test_result;

  -- Test COALESCE with NULL metadata
  RAISE NOTICE 'COALESCE test: %', COALESCE(NULL::jsonb->>'full_name', '');
END $$;
