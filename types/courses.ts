// Types for the course evaluation system

export interface Course {
  id: string; // Changed from number to string to match existing table
  course: string; // Full course name
  short_name: string; // Course code/short name
  semester: number;
  level: string;
  lecture_credits: number;
  exercise_credits: number;
  lecture: any; // JSONB field
  exercise: any; // JSONB field
  
  // New course overview fields
  description?: string;
  study_topics?: string[];
  learning_outcomes?: string[];
  related_fields?: string[];
  career_paths?: string[];
  top_companies?: {
    japanese: string[];
    international: string[];
  };
}

export interface CourseEvaluation {
  id: number;
  course_id: string; // Changed from number to string
  user_id: string;
  
  // Course Content Questions (1-5 scale)
  content_clarity: number;
  content_interest: number;
  materials_helpful: number;
  
  // Time Commitment (categorical)
  hours_per_week: '<3h' | '3-5h' | '5-10h' | '>10h';
  
  // Instructor Questions
  instructor_clarity: number;
  teaching_engaging: 'Yes' | 'No' | 'Somewhat';
  grading_transparent: 'Yes' | 'No' | 'Somewhat';
  
  // Feedback Questions
  received_feedback: boolean;
  feedback_helpful?: number; // Only if received_feedback is true
  
  // Overall Questions
  overall_satisfaction: number;
  would_recommend: boolean;
  what_learned?: string;
  advice_future_students?: string;
  liked_most?: string;
  would_improve?: string;
  
  created_at: string;
}

export interface EvaluationFormData {
  // Course Content Questions
  content_clarity: number;
  content_interest: number;
  materials_helpful: number;
  
  // Time Commitment
  hours_per_week: '<3h' | '3-5h' | '5-10h' | '>10h';
  
  // Instructor Questions
  instructor_clarity: number;
  teaching_engaging: 'Yes' | 'No' | 'Somewhat';
  grading_transparent: 'Yes' | 'No' | 'Somewhat';
  
  // Feedback Questions
  received_feedback: boolean;
  feedback_helpful?: number;
  
  // Overall Questions
  overall_satisfaction: number;
  would_recommend: boolean;
  what_learned?: string;
  advice_future_students?: string;
  liked_most?: string;
  would_improve?: string;
}

export interface CourseStats {
  course_id: string; // Changed from number to string
  avg_content_clarity: number;
  avg_content_interest: number;
  avg_materials_helpful: number;
  avg_instructor_clarity: number;
  avg_overall_satisfaction: number;
  total_evaluations: number;
  teaching_engaging_yes_percent: number;
  grading_transparent_yes_percent: number;
  received_feedback_percent: number;
  avg_feedback_helpful: number;
  hours_distribution: {
    '<3h': number;
    '3-5h': number;
    '5-10h': number;
    '>10h': number;
  };
}

export interface CourseWithStats extends Course {
  avg_content_clarity: number;
  avg_content_interest: number;
  avg_materials_helpful: number;
  avg_instructor_clarity: number;
  avg_overall_satisfaction: number;
  total_evaluations: number;
  teaching_engaging_yes_percent: number;
  grading_transparent_yes_percent: number;
  received_feedback_percent: number;
  avg_feedback_helpful: number;
  hours_distribution: {
    '<3h': number;
    '3-5h': number;
    '5-10h': number;
    '>10h': number;
  };
  user_has_evaluated?: boolean;
}

export interface EvaluationResponse {
  liked_most?: string;
  would_improve?: string;
  overall_satisfaction: number;
  created_at: string;
}
