# Course Evaluation System

## Overview

The Course Evaluation System is a comprehensive anonymous feedback platform that allows students to rate and review courses across multiple categories. Students can submit one evaluation per course with detailed ratings and feedback.

## Features

### ⭐ Anonymous Evaluations
- Students can submit anonymous feedback for courses
- One evaluation per student per course (enforced by database constraints)
- No personal information stored with evaluations

### 📊 Multi-Category Evaluation
Students evaluate courses across multiple structured categories:

**Course Content (1-5 star scale)**
- **Content Clarity** - Was the course content clear and well-organized?
- **Content Interest** - How interesting did you find the course content?  
- **Materials Helpful** - Were the course materials (slides, readings, online resources) helpful?

**Time Commitment**
- **Hours per Week** - Categorical selection: <3h, 3–5h, 5–10h, >10h

**Instructor & Teaching (1-5 star scale + Yes/No/Somewhat)**
- **Instructor Clarity** - Was the instructor's explanation clear?
- **Teaching Engaging** - Did the teaching style make the course engaging?
- **Grading Transparent** - Was the grading system transparent?

**Assignment Feedback**
- **Received Feedback** - Were there feedback on your assignments? (Yes/No)
- **Feedback Helpful** - If yes, was feedback on assignments helpful for improvement? (1-5 scale)

**Overall Experience**
- **Overall Satisfaction** - How satisfied were you with this course? (1-5 scale)
- **Liked Most** - What did you like most about the course? (short text)
- **Would Improve** - What would you improve about the course? (short text)

### 📝 Anonymous Feedback
- Optional detailed written feedback in two categories:
  - What students liked most about the course
  - What they would improve about the course
- Completely anonymous comment system
- Constructive feedback guidelines

### 📈 Course Statistics
- Average ratings for each evaluation category
- Total number of evaluations
- Percentage breakdowns for Yes/No/Somewhat questions
- Hours distribution visualization
- Real-time statistics updates

## System Architecture

### Database Schema

#### Tables
1. **courses**
   - `id` (UUID, Primary Key)
   - `code` (VARCHAR, Unique) - Course code (e.g., "CS101")
   - `name` (VARCHAR) - Course title
   - `description` (TEXT) - Course description
   - `professor` (VARCHAR) - Instructor name
   - `credits` (INTEGER) - Credit hours
   - `semester` (VARCHAR) - Term offered
   - `year` (INTEGER) - Academic year

2. **course_evaluations**
   - `id` (UUID, Primary Key)
   - `course_id` (UUID, Foreign Key)
   - `user_id` (UUID, Foreign Key to auth.users)
   - Rating fields (INTEGER, 1-5 scale):
     - `content_clarity`
     - `content_interest`
     - `materials_helpful`
     - `instructor_clarity`
     - `overall_satisfaction`
   - Categorical fields:
     - `hours_per_week` (VARCHAR) - Time commitment categories
     - `teaching_engaging` (VARCHAR) - Yes/No/Somewhat
     - `grading_transparent` (VARCHAR) - Yes/No/Somewhat
   - Boolean fields:
     - `received_feedback` (BOOLEAN)
   - Optional fields:
     - `feedback_helpful` (INTEGER, 1-5 scale, only if received_feedback = true)
     - `liked_most` (TEXT, Optional)
     - `would_improve` (TEXT, Optional)
   - `created_at` (TIMESTAMP)

#### Database Functions
- `get_course_evaluation_stats()` - Aggregates evaluation statistics
- Row Level Security (RLS) policies for data protection

### Frontend Components

#### Main Components
1. **CoursesPage** (`pages/courses.tsx`)
   - Course listing with search and filter
   - Statistics display
   - Modal integration

2. **CourseEvaluationModal** (`components/CourseEvaluationModal.tsx`)
   - Multi-step evaluation form
   - Star rating interface
   - Progress tracking

3. **CourseDetailModal** (`components/CourseDetailModal.tsx`)
   - Detailed course information
   - Statistics visualization
   - Evaluation history

#### TypeScript Types
- `Course` - Course entity structure
- `CourseEvaluation` - Evaluation data structure
- `EvaluationFormData` - Form input structure
- `CourseStats` - Statistics aggregation
- `CourseWithStats` - Combined course and statistics

## Usage Guide

### For Students

#### Submitting an Evaluation
1. Navigate to the **Courses** page from the main navigation
2. Find the course you want to evaluate using search or filters
3. Click **"Evaluate Course"** button
4. Complete the 5-step evaluation process:
   - **Step 1**: Course Content (clarity, interest, materials)
   - **Step 2**: Instructor & Teaching (clarity, engagement, transparency, time commitment)
   - **Step 3**: Assignment Feedback (received feedback, helpfulness)
   - **Step 4**: Overall Satisfaction
   - **Step 5**: Optional written feedback (what you liked/would improve)

#### Viewing Course Information
1. Click **"More Info"** on any course card
2. View detailed statistics and anonymous feedback
3. See rating breakdowns and recommendation percentages

### For Administrators

#### Adding New Courses
Add courses directly to the database using the SQL schema:

```sql
INSERT INTO courses (code, name, description, professor, credits, semester, year)
VALUES ('CS101', 'Introduction to Programming', 'Basic programming concepts', 'Dr. Smith', 3, 'Fall', 2024);
```

#### Managing Evaluations
- View evaluation statistics through the frontend
- Export evaluation data through Supabase dashboard
- Monitor evaluation submission rates

## Setup Instructions

### Database Setup
1. Execute the database schema:
   ```sql
   -- Run the contents of supabase/course_evaluation_schema.sql
   ```

2. Deploy the statistics function:
   ```sql
   -- Run the contents of supabase/course_stats_function.sql
   ```

### Frontend Integration
The course evaluation system is integrated into the main application:

1. **Navigation**: Added "📚 Courses" link to the main calendar header
2. **Styling**: Uses existing gradient theme (#667eea to #764ba2)
3. **Icons**: Utilizes Lucide React icon library
4. **Authentication**: Integrated with existing Supabase auth

### Dependencies
- `lucide-react` - Icon library (already installed)
- `@supabase/supabase-js` - Database client
- `react` & `next.js` - Framework components
- `tailwindcss` - Styling framework

## Data Privacy & Security

### Anonymous Evaluations
- User IDs are stored only to enforce one-evaluation-per-course rule
- No personal information is displayed with evaluations
- Comments are completely anonymous

### Row Level Security (RLS)
- Users can only view aggregated statistics
- Individual evaluation details are protected
- INSERT policies ensure proper data validation

### Data Validation
- Rating constraints (1-5 scale) enforced at database level
- Required field validation in frontend
- SQL CHECK constraints prevent invalid data

## API Endpoints

### Course Operations
- `fetchCourses()` - Retrieve courses with statistics
- `checkExistingEvaluation()` - Verify evaluation status
- `submitEvaluation()` - Submit new evaluation

### Statistics
- Real-time aggregation through SQL functions
- Cached statistics for performance
- Automatic updates on new submissions

## Troubleshooting

### Common Issues

#### "Already Evaluated" Message
- Each student can only evaluate a course once
- Check if evaluation was previously submitted
- Contact administrator if evaluation needs updating

#### Statistics Not Updating
- Statistics update in real-time
- Refresh page if data seems stale
- Check network connection and database status

#### Form Validation Errors
- Ensure all required ratings are selected (1-5 stars)
- Weekly time commitment must be a positive number
- Check all steps are completed before submission

## Future Enhancements

### Planned Features
- Course comparison tools
- Evaluation analytics dashboard
- Email notifications for new evaluations
- Bulk course import functionality
- Mobile app integration
- Export evaluation reports

### Technical Improvements
- Caching layer for statistics
- Real-time evaluation updates
- Advanced filtering and sorting
- Evaluation moderation system

## Support

For technical issues or feature requests:
1. Check the troubleshooting section
2. Review database logs in Supabase dashboard
3. Verify component integration and styling
4. Test evaluation workflow end-to-end

---

## System Status

✅ **Database Schema**: Complete with RLS policies
✅ **TypeScript Types**: Comprehensive type definitions
✅ **React Components**: Full UI implementation
✅ **Navigation Integration**: Added to main app
✅ **Styling**: Consistent with existing theme

**Ready for deployment and testing!**
