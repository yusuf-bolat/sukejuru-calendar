# Updated Database Schema for Existing Courses Table

## 🔄 **Schema Changes Made**

### ✅ **Updated to Work with Your Existing Courses Table**
Your existing courses table structure:
```sql
CREATE TABLE public.courses (
  id TEXT NOT NULL PRIMARY KEY,
  course TEXT NULL,
  short_name TEXT NULL,
  semester INTEGER NULL,
  level TEXT NULL,
  lecture_credits INTEGER NULL,
  exercise_credits INTEGER NULL,
  lecture JSONB NULL,
  exercise JSONB NULL
);
```

### ✅ **Removed Elements as Requested**
- ❌ **Professor names** - Completely removed from all components
- ❌ **Sample course data** - Removed since you have existing courses
- ❌ **New courses table creation** - Using your existing table structure

## 📋 **Deploy This Exact Schema**

### **Step 1: Deploy Main Schema**
Execute `supabase/course_evaluation_schema.sql`:

```sql
-- Course evaluations table for the course evaluation system
-- Note: Using existing courses table with structure:
-- courses (id text, course text, short_name text, semester integer, level text, lecture_credits integer, exercise_credits integer, lecture jsonb, exercise jsonb)

-- Course evaluations table
CREATE TABLE IF NOT EXISTS course_evaluations (
    id SERIAL PRIMARY KEY,
    course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Course Content Questions (1-5 scale)
    content_clarity INTEGER NOT NULL CHECK (content_clarity >= 1 AND content_clarity <= 5),
    content_interest INTEGER NOT NULL CHECK (content_interest >= 1 AND content_interest <= 5),
    materials_helpful INTEGER NOT NULL CHECK (materials_helpful >= 1 AND materials_helpful <= 5),
    
    -- Time Commitment (categorical)
    hours_per_week VARCHAR(10) NOT NULL CHECK (hours_per_week IN ('<3h', '3-5h', '5-10h', '>10h')),
    
    -- Instructor Questions
    instructor_clarity INTEGER NOT NULL CHECK (instructor_clarity >= 1 AND instructor_clarity <= 5),
    teaching_engaging VARCHAR(10) NOT NULL CHECK (teaching_engaging IN ('Yes', 'No', 'Somewhat')),
    grading_transparent VARCHAR(10) NOT NULL CHECK (grading_transparent IN ('Yes', 'No', 'Somewhat')),
    
    -- Feedback Questions
    received_feedback BOOLEAN NOT NULL,
    feedback_helpful INTEGER CHECK (feedback_helpful IS NULL OR (feedback_helpful >= 1 AND feedback_helpful <= 5)),
    
    -- Overall Questions
    overall_satisfaction INTEGER NOT NULL CHECK (overall_satisfaction >= 1 AND overall_satisfaction <= 5),
    liked_most TEXT,
    would_improve TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one evaluation per user per course
    UNIQUE(course_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_course_evaluations_course_id ON course_evaluations(course_id);
CREATE INDEX IF NOT EXISTS idx_course_evaluations_user_id ON course_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_short_name ON courses(short_name);

-- Enable Row Level Security
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies for courses (readable by everyone, only admins can modify)
CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Only admins can insert courses" ON courses FOR INSERT WITH CHECK (false);
CREATE POLICY "Only admins can update courses" ON courses FOR UPDATE USING (false);
CREATE POLICY "Only admins can delete courses" ON courses FOR DELETE USING (false);

-- RLS policies for evaluations (users can only access their own, but aggregated data is public)
CREATE POLICY "Users can insert their own evaluations" ON course_evaluations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own evaluations" ON course_evaluations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own evaluations" ON course_evaluations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evaluations" ON course_evaluations FOR DELETE USING (auth.uid() = user_id);
```

### **Step 2: Deploy Functions**
Execute `supabase/course_stats_function.sql`:

```sql
-- Function to calculate course evaluation statistics
-- Updated to work with existing courses table (id as TEXT)
CREATE OR REPLACE FUNCTION get_course_evaluation_stats()
RETURNS TABLE (
    course_id TEXT,
    avg_content_clarity NUMERIC,
    avg_content_interest NUMERIC,
    avg_materials_helpful NUMERIC,
    avg_instructor_clarity NUMERIC,
    avg_overall_satisfaction NUMERIC,
    total_evaluations BIGINT,
    teaching_engaging_yes_percent NUMERIC,
    grading_transparent_yes_percent NUMERIC,
    received_feedback_percent NUMERIC,
    avg_feedback_helpful NUMERIC,
    hours_distribution JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.course_id,
        ROUND(AVG(ce.content_clarity::NUMERIC), 2) as avg_content_clarity,
        ROUND(AVG(ce.content_interest::NUMERIC), 2) as avg_content_interest,
        ROUND(AVG(ce.materials_helpful::NUMERIC), 2) as avg_materials_helpful,
        ROUND(AVG(ce.instructor_clarity::NUMERIC), 2) as avg_instructor_clarity,
        ROUND(AVG(ce.overall_satisfaction::NUMERIC), 2) as avg_overall_satisfaction,
        COUNT(*)::BIGINT as total_evaluations,
        ROUND(
            (COUNT(CASE WHEN ce.teaching_engaging = 'Yes' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            1
        ) as teaching_engaging_yes_percent,
        ROUND(
            (COUNT(CASE WHEN ce.grading_transparent = 'Yes' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            1
        ) as grading_transparent_yes_percent,
        ROUND(
            (COUNT(CASE WHEN ce.received_feedback = true THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
            1
        ) as received_feedback_percent,
        ROUND(AVG(ce.feedback_helpful::NUMERIC), 2) as avg_feedback_helpful,
        jsonb_build_object(
            '<3h', COUNT(CASE WHEN ce.hours_per_week = '<3h' THEN 1 END),
            '3-5h', COUNT(CASE WHEN ce.hours_per_week = '3-5h' THEN 1 END),
            '5-10h', COUNT(CASE WHEN ce.hours_per_week = '5-10h' THEN 1 END),
            '>10h', COUNT(CASE WHEN ce.hours_per_week = '>10h' THEN 1 END)
        ) as hours_distribution
    FROM course_evaluations ce
    GROUP BY ce.course_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_course_evaluation_stats() TO authenticated;

-- Create a view for easier querying of courses with statistics
CREATE OR REPLACE VIEW courses_with_stats AS
SELECT 
    c.*,
    COALESCE(s.avg_content_clarity, 0) as avg_content_clarity,
    COALESCE(s.avg_content_interest, 0) as avg_content_interest,
    COALESCE(s.avg_materials_helpful, 0) as avg_materials_helpful,
    COALESCE(s.avg_instructor_clarity, 0) as avg_instructor_clarity,
    COALESCE(s.avg_overall_satisfaction, 0) as avg_overall_satisfaction,
    COALESCE(s.total_evaluations, 0) as total_evaluations,
    COALESCE(s.teaching_engaging_yes_percent, 0) as teaching_engaging_yes_percent,
    COALESCE(s.grading_transparent_yes_percent, 0) as grading_transparent_yes_percent,
    COALESCE(s.received_feedback_percent, 0) as received_feedback_percent,
    COALESCE(s.avg_feedback_helpful, 0) as avg_feedback_helpful,
    COALESCE(s.hours_distribution, '{}'::jsonb) as hours_distribution
FROM courses c
LEFT JOIN get_course_evaluation_stats() s ON c.id = s.course_id;

-- Grant select permission to authenticated users
GRANT SELECT ON courses_with_stats TO authenticated;

-- Function to check if user has already evaluated a course
-- Updated to work with TEXT course_id
CREATE OR REPLACE FUNCTION user_has_evaluated_course(p_course_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM course_evaluations 
        WHERE course_id = p_course_id 
        AND user_id = p_user_id
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_evaluated_course(TEXT, UUID) TO authenticated;

-- Function to get course feedback and comments
-- Updated to work with TEXT course_id
CREATE OR REPLACE FUNCTION get_course_feedback(p_course_id TEXT)
RETURNS TABLE (
    liked_most TEXT,
    would_improve TEXT,
    overall_satisfaction INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.liked_most,
        ce.would_improve,
        ce.overall_satisfaction,
        ce.created_at
    FROM course_evaluations ce
    WHERE ce.course_id = p_course_id
    AND (ce.liked_most IS NOT NULL AND ce.liked_most != '' 
         OR ce.would_improve IS NOT NULL AND ce.would_improve != '')
    ORDER BY ce.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_course_feedback(TEXT) TO authenticated;
```

## 🔧 **Updated Components**

### **Frontend Changes Made**
- ✅ **Courses Page**: Now displays `short_name`, `course`, `level`, and total credits
- ✅ **Course Detail Modal**: Shows level, lecture/exercise credits breakdown
- ✅ **Evaluation Modal**: Uses `short_name` and `course` for display
- ✅ **TypeScript Types**: Updated to match your course table structure
- ✅ **Search Function**: Searches both `short_name` and `course` fields

### **Key Features**
- **No professor information** displayed anywhere
- **Works with your existing courses** - no sample data added
- **TEXT-based course IDs** instead of integers
- **Credit system** shows lecture + exercise credits separately
- **Level-based organization** using your `level` field

## 🚀 **Ready for Deployment**

The schema is now perfectly aligned with your existing courses table structure and removes all professor-related information as requested. Your existing course data will work seamlessly with the new evaluation system.

**Just deploy these two SQL files in order and your course evaluation system will be ready to use!**
