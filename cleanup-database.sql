-- Clean slate: Delete all tables and functions
-- Run this in Supabase SQL Editor to start fresh

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS public.events;
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.user_memory;

-- Optional: Clear all existing users (be careful!)
-- Uncomment the next line if you want to delete all registered users
-- DELETE FROM auth.users;
