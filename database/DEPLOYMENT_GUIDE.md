# Course Evaluation System - Database Deployment Guide

## Prerequisites
- Supabase project set up and running
- Database access via Supabase SQL editor or CLI
- Proper authentication configured

## Deployment Steps

### Step 1: Deploy Database Schema
Execute the following SQL file in your Supabase SQL editor:

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase/course_evaluation_schema.sql`
4. Run the script

This will create:
- `courses` table with sample data
- `course_evaluations` table with constraints
- Row Level Security (RLS) policies
- Proper indexes for performance

### Step 2: Deploy Database Functions
Execute the SQL functions file:

1. In the same SQL editor
2. Copy and paste the contents of `supabase/course_stats_function.sql`
3. Run the script

This will create:
- `get_course_evaluation_stats()` function
- `courses_with_stats` view
- `user_has_evaluated_course()` function
- `get_course_feedback()` function
- Proper permissions for authenticated users

### Step 3: Verify Deployment
Check that everything was created successfully:

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('courses', 'course_evaluations');

-- Verify functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_course_evaluation_stats', 'user_has_evaluated_course', 'get_course_feedback');

-- Verify view exists
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'courses_with_stats';

-- Test with sample data
SELECT * FROM courses_with_stats LIMIT 5;
```

### Step 4: Test the System
1. Start your Next.js development server
2. Navigate to the Courses page
3. Try evaluating a course
4. Check that statistics update properly

## Environment Configuration

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Troubleshooting

### Common Issues

#### RLS Policies Not Working
If you get permission errors, ensure RLS is enabled:
```sql
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_evaluations ENABLE ROW LEVEL SECURITY;
```

#### Functions Not Accessible
Grant proper permissions:
```sql
GRANT EXECUTE ON FUNCTION get_course_evaluation_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_evaluated_course(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_course_feedback(UUID) TO authenticated;
```

#### View Not Accessible
Grant select permissions:
```sql
GRANT SELECT ON courses_with_stats TO authenticated;
```

### Testing Queries

Test course data retrieval:
```sql
-- Get all courses with statistics
SELECT * FROM courses_with_stats;

-- Check for existing evaluation
SELECT user_has_evaluated_course(
  'course-uuid-here',
  auth.uid()
);

-- Get course feedback
SELECT * FROM get_course_feedback('course-uuid-here');
```

## Sample Data

The schema includes sample courses:
- CS101: Introduction to Programming
- MATH201: Calculus II
- ENG102: Technical Writing
- PHYS301: Quantum Mechanics
- CHEM101: General Chemistry

You can add more courses using:
```sql
INSERT INTO courses (code, name, description, professor, credits, semester, year)
VALUES ('CS201', 'Data Structures', 'Advanced programming concepts', 'Dr. Johnson', 4, 'Spring', 2024);
```

## Security Notes

- All evaluation data is anonymized in the frontend
- User IDs are only used to enforce one-evaluation-per-course rule
- RLS policies prevent unauthorized access to evaluation details
- Functions use SECURITY DEFINER for controlled access

## Next Steps

After successful deployment:
1. Add more courses to the system
2. Test the evaluation workflow thoroughly
3. Monitor evaluation submission rates
4. Consider adding course import functionality
5. Set up evaluation analytics dashboard

---

**System Status**: Ready for production use once deployed! 🚀
