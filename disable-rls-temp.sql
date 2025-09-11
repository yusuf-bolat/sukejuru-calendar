-- Temporary fix: Disable RLS for course_evaluations to test
-- This will help us identify if RLS is causing the submission error

ALTER TABLE course_evaluations DISABLE ROW LEVEL SECURITY;

-- You can re-enable it later with:
-- ALTER TABLE course_evaluations ENABLE ROW LEVEL SECURITY;
