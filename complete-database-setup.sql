-- Complete database schema for course evaluation system
-- This creates the courses table and evaluation system

-- First, create the courses table
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    course TEXT NOT NULL,
    short_name TEXT NOT NULL,
    semester INTEGER NOT NULL,
    level TEXT NOT NULL,
    lecture_credits INTEGER NOT NULL,
    exercise_credits INTEGER NOT NULL,
    lecture JSONB NOT NULL DEFAULT '[]',
    exercise JSONB NOT NULL DEFAULT '[]'
);

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

-- RLS policies for courses (readable by everyone, insertable by anyone for now)
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON courses;
DROP POLICY IF EXISTS "Anyone can insert courses" ON courses;
DROP POLICY IF EXISTS "Only admins can update courses" ON courses;
DROP POLICY IF EXISTS "Only admins can delete courses" ON courses;

CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert courses" ON courses FOR INSERT WITH CHECK (true); -- Temporarily allow insertions
CREATE POLICY "Anyone can update courses" ON courses FOR UPDATE USING (true); -- Temporarily allow updates
CREATE POLICY "Anyone can delete courses" ON courses FOR DELETE USING (true); -- Temporarily allow deletes

-- RLS policies for evaluations (users can only access their own, but aggregated data is public)
DROP POLICY IF EXISTS "Users can insert their own evaluations" ON course_evaluations;
DROP POLICY IF EXISTS "Users can view their own evaluations" ON course_evaluations;
DROP POLICY IF EXISTS "Users can update their own evaluations" ON course_evaluations;
DROP POLICY IF EXISTS "Users can delete their own evaluations" ON course_evaluations;

CREATE POLICY "Users can insert their own evaluations" ON course_evaluations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own evaluations" ON course_evaluations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own evaluations" ON course_evaluations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evaluations" ON course_evaluations FOR DELETE USING (auth.uid() = user_id);
