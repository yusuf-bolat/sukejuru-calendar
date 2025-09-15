-- Fix RLS policies for both events and assignments tables

-- First, fix events table policies
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events; 
DROP POLICY IF EXISTS "Users can delete own events" ON events;

-- Make sure RLS is enabled on events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create proper policies for events
CREATE POLICY "Users can view own events" ON events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events" ON events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events" ON events
    FOR DELETE USING (auth.uid() = user_id);

-- Fix assignments table policies (refresh them)
DROP POLICY IF EXISTS "Users can view own assignments" ON assignments;
DROP POLICY IF EXISTS "Users can insert own assignments" ON assignments;
DROP POLICY IF EXISTS "Users can update own assignments" ON assignments;
DROP POLICY IF EXISTS "Users can delete own assignments" ON assignments;

-- Create fresh policies for assignments
CREATE POLICY "Users can view own assignments" ON assignments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assignments" ON assignments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assignments" ON assignments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assignments" ON assignments
    FOR DELETE USING (auth.uid() = user_id);
