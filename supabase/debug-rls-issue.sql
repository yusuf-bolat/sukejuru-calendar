-- Check RLS status and policies for course_evaluations
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'course_evaluations';

-- List current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'course_evaluations';

-- Temporarily disable RLS to test if that's blocking access
ALTER TABLE course_evaluations DISABLE ROW LEVEL SECURITY;

-- Test query to see actual data
SELECT course_id, user_id, overall_satisfaction, content_clarity, content_interest, materials_helpful, created_at
FROM course_evaluations
LIMIT 5;
