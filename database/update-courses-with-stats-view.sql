-- First, let's check if the courses_with_stats view exists and what columns it has
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'courses_with_stats' 
ORDER BY ordinal_position;

-- If it exists, we need to drop and recreate it with the new columns
DROP VIEW IF EXISTS courses_with_stats;

-- Create updated view with all the course overview columns
-- Now with proper aggregation from course_evaluations matching frontend expectations
CREATE VIEW courses_with_stats AS
SELECT 
    c.*,
    COALESCE(e.total_evaluations, 0) as total_evaluations,
    COALESCE(e.avg_content_clarity, 0) as avg_content_clarity,
    COALESCE(e.avg_content_interest, 0) as avg_content_interest,
    COALESCE(e.avg_materials_helpful, 0) as avg_materials_helpful,
    COALESCE(e.avg_instructor_clarity, 0) as avg_instructor_clarity,
    COALESCE(e.avg_overall_satisfaction, 0) as avg_overall_satisfaction,
    COALESCE(e.teaching_engaging_yes_percent, 0) as teaching_engaging_yes_percent,
    COALESCE(e.grading_transparent_yes_percent, 0) as grading_transparent_yes_percent,
    COALESCE(e.received_feedback_percent, 0) as received_feedback_percent,
    COALESCE(e.avg_feedback_helpful, 0) as avg_feedback_helpful,
    COALESCE(e.hours_lt3_percent, 0) as hours_lt3_percent,
    COALESCE(e.hours_3to5_percent, 0) as hours_3to5_percent,
    COALESCE(e.hours_5to10_percent, 0) as hours_5to10_percent,
    COALESCE(e.hours_gt10_percent, 0) as hours_gt10_percent
FROM courses c
LEFT JOIN (
    SELECT 
        course_id,
        COUNT(*) as total_evaluations,
        AVG(content_clarity::DECIMAL) as avg_content_clarity,
        AVG(content_interest::DECIMAL) as avg_content_interest,
        AVG(materials_helpful::DECIMAL) as avg_materials_helpful,
        AVG(instructor_clarity::DECIMAL) as avg_instructor_clarity,
        AVG(overall_satisfaction::DECIMAL) as avg_overall_satisfaction,
        -- Calculate percentages for categorical data
        (COUNT(CASE WHEN teaching_engaging = 'Yes' THEN 1 END) * 100.0 / COUNT(*)) as teaching_engaging_yes_percent,
        (COUNT(CASE WHEN grading_transparent = 'Yes' THEN 1 END) * 100.0 / COUNT(*)) as grading_transparent_yes_percent,
        (COUNT(CASE WHEN received_feedback = true THEN 1 END) * 100.0 / COUNT(*)) as received_feedback_percent,
        AVG(CASE WHEN feedback_helpful IS NOT NULL THEN feedback_helpful::DECIMAL ELSE NULL END) as avg_feedback_helpful,
        -- Calculate time distribution percentages
        (COUNT(CASE WHEN hours_per_week = '<3h' THEN 1 END) * 100.0 / COUNT(*)) as hours_lt3_percent,
        (COUNT(CASE WHEN hours_per_week = '3-5h' THEN 1 END) * 100.0 / COUNT(*)) as hours_3to5_percent,
        (COUNT(CASE WHEN hours_per_week = '5-10h' THEN 1 END) * 100.0 / COUNT(*)) as hours_5to10_percent,
        (COUNT(CASE WHEN hours_per_week = '>10h' THEN 1 END) * 100.0 / COUNT(*)) as hours_gt10_percent
    FROM course_evaluations
    GROUP BY course_id
) e ON c.id = e.course_id;
