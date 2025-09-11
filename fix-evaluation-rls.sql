-- Debug and fix course_evaluations RLS policies

-- First, let's check current RLS status and policies
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'course_evaluations';

-- List current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'course_evaluations';

-- Temporarily disable RLS for testing (you can re-enable it later)
-- ALTER TABLE course_evaluations DISABLE ROW LEVEL SECURITY;

-- Or fix the RLS policies to work properly
-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own evaluations" ON course_evaluations;
DROP POLICY IF EXISTS "Users can view their own evaluations" ON course_evaluations;
DROP POLICY IF EXISTS "Users can update their own evaluations" ON course_evaluations;
DROP POLICY IF EXISTS "Users can delete their own evaluations" ON course_evaluations;

-- Create more permissive policies for authenticated users
CREATE POLICY "Authenticated users can insert evaluations" 
  ON course_evaluations FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view evaluations" 
  ON course_evaluations FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can update their own evaluations" 
  ON course_evaluations FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evaluations" 
  ON course_evaluations FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);
