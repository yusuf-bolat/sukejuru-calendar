-- Migration to add missing columns to course_evaluations table
-- Run this in your Supabase SQL Editor

ALTER TABLE course_evaluations ADD COLUMN IF NOT EXISTS would_recommend BOOLEAN;
ALTER TABLE course_evaluations ADD COLUMN IF NOT EXISTS what_learned TEXT;
ALTER TABLE course_evaluations ADD COLUMN IF NOT EXISTS advice_future_students TEXT;

-- Update the constraint to make would_recommend required for new entries
-- (Note: existing entries might have NULL, so we'll handle that in the app)
UPDATE course_evaluations SET would_recommend = false WHERE would_recommend IS NULL;
