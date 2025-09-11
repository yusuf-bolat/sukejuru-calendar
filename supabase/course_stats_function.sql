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
