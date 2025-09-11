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
    would_recommend BOOLEAN NOT NULL, -- New: Would you recommend this course to other students?
    what_learned TEXT, -- New: What did you learn from this course?
    advice_future_students TEXT, -- New: What advice would you give to future students to ace this course?
    liked_most TEXT,
    would_improve TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one evaluation per user per course
    UNIQUE(course_id, user_id)
);

-- Sample courses data - REMOVED since courses table already exists
-- The existing courses table structure will be used instead

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_course_evaluations_course_id ON course_evaluations(course_id);
CREATE INDEX IF NOT EXISTS idx_course_evaluations_user_id ON course_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_short_name ON courses(short_name);

-- Enable Row Level Security
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies for courses (readable by everyone, only admins can modify)
CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Only admins can insert courses" ON courses FOR INSERT WITH CHECK (false); -- Will be updated when admin system is implemented
CREATE POLICY "Only admins can update courses" ON courses FOR UPDATE USING (false);
CREATE POLICY "Only admins can delete courses" ON courses FOR DELETE USING (false);

-- RLS policies for evaluations (users can only access their own, but aggregated data is public)
CREATE POLICY "Users can insert their own evaluations" ON course_evaluations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own evaluations" ON course_evaluations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own evaluations" ON course_evaluations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evaluations" ON course_evaluations FOR DELETE USING (auth.uid() = user_id);
