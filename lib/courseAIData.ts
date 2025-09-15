import { supabase } from './supabaseClient'
import { CourseWithStats } from '@/types/courses'

// Interface for AI course data
export interface AICourseData {
  courses: CourseWithStats[]
  coursesSummary: string
  lastUpdated: string
}

// Function to fetch course data with statistics for AI counseling
export async function fetchCoursesForAI(): Promise<AICourseData | null> {
  try {
    console.log('🤖 Fetching course data for AI advisor...')

    // Fetch all courses with statistics and overview data
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses_with_stats')
      .select(`
        *,
        description,
        study_topics,
        learning_outcomes,
        related_fields,
        career_paths,
        top_companies,
        total_evaluations,
        avg_content_clarity,
        avg_content_interest,
        avg_materials_helpful,
        avg_instructor_clarity,
        avg_overall_satisfaction,
        teaching_engaging_yes_percent,
        grading_transparent_yes_percent,
        received_feedback_percent,
        avg_feedback_helpful
      `)

    if (coursesError) {
      console.error('❌ Error fetching courses for AI:', coursesError)
      return null
    }

    if (!coursesData || coursesData.length === 0) {
      console.log('⚠️ No course data found for AI advisor')
      return null
    }

    // Generate a summary of the course data for AI context
    const coursesSummary = generateCourseSummary(coursesData)

    return {
      courses: coursesData,
      coursesSummary,
      lastUpdated: new Date().toISOString()
    }

  } catch (error) {
    console.error('❌ Unexpected error fetching courses for AI:', error)
    return null
  }
}

// Generate a comprehensive summary of courses for AI context
function generateCourseSummary(courses: CourseWithStats[]): string {
  const totalCourses = courses.length
  const evaluatedCourses = courses.filter(c => c.total_evaluations > 0).length
  const levelStats = courses.reduce((acc, course) => {
    acc[course.level] = (acc[course.level] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const semesterStats = courses.reduce((acc, course) => {
    acc[course.semester] = (acc[course.semester] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  // Get top-rated courses (with evaluations)
  const topRatedCourses = courses
    .filter(c => c.total_evaluations > 0 && c.avg_overall_satisfaction > 0)
    .sort((a, b) => (b.avg_overall_satisfaction || 0) - (a.avg_overall_satisfaction || 0))
    .slice(0, 5)

  // Get courses by field/category
  const coursesByField = courses.reduce((acc, course) => {
    if (course.related_fields && Array.isArray(course.related_fields)) {
      course.related_fields.forEach((field: string) => {
        if (!acc[field]) acc[field] = []
        acc[field].push(course.short_name)
      })
    }
    return acc
  }, {} as Record<string, string[]>)

  return `
COURSE DATABASE SUMMARY (${totalCourses} total courses):

STATISTICS:
- Total courses: ${totalCourses}
- Courses with student evaluations: ${evaluatedCourses}
- Level distribution: ${Object.entries(levelStats).map(([level, count]) => `${level}: ${count}`).join(', ')}
- Semester distribution: ${Object.entries(semesterStats).map(([sem, count]) => `Semester ${sem}: ${count}`).join(', ')}

TOP-RATED COURSES (based on student evaluations):
${topRatedCourses.map(course => 
  `- ${course.course} (${course.short_name}): ${(course.avg_overall_satisfaction || 0).toFixed(1)}/5.0 stars (${course.total_evaluations} evaluations)`
).join('\n')}

COURSES BY FIELD:
${Object.entries(coursesByField).map(([field, courseCodes]) => 
  `- ${field}: ${courseCodes.join(', ')}`
).join('\n')}

AVAILABLE DATA FOR EACH COURSE:
- Basic info: course name, level, credits, semester
- Course overview: description, study topics, learning outcomes, career paths
- Company connections: Japanese and international companies that value this knowledge
- Student statistics: satisfaction ratings, difficulty, workload, engagement
- Time commitment data: hours per week distribution
- Teaching quality metrics: clarity, engagement, grading transparency
`.trim()
}

// Helper function to get course recommendations based on criteria
export function getCoursesForField(courses: CourseWithStats[], field: string): CourseWithStats[] {
  return courses.filter(course => 
    course.related_fields?.some((f: string) => 
      f.toLowerCase().includes(field.toLowerCase())
    ) ||
    course.course.toLowerCase().includes(field.toLowerCase()) ||
    course.description?.toLowerCase().includes(field.toLowerCase())
  )
}

// Helper function to get courses by workload level
export function getCoursesByWorkload(courses: CourseWithStats[], workloadPreference: 'low' | 'medium' | 'high'): CourseWithStats[] {
  return courses.filter(course => {
    if (course.total_evaluations === 0) return true // Include unrated courses
    
    // Assuming workload is indicated by hours_per_week distribution or instructor_clarity
    // Lower instructor clarity might indicate higher workload
    const avgClarity = course.avg_instructor_clarity || 0
    
    switch (workloadPreference) {
      case 'low':
        return avgClarity >= 4 // High clarity usually means easier course
      case 'medium':
        return avgClarity >= 3 && avgClarity < 4
      case 'high':
        return avgClarity < 3 // Lower clarity might indicate challenging course
      default:
        return true
    }
  })
}

// Validation function to ensure only courses from database are recommended
export function validateCourseRecommendations(recommendedCourses: string[], availableCourses: CourseWithStats[]): {
  validCourses: CourseWithStats[],
  invalidCourses: string[],
  suggestions: CourseWithStats[]
} {
  const validCourses: CourseWithStats[] = []
  const invalidCourses: string[] = []
  const availableCourseNames = availableCourses.map(c => c.course.toLowerCase())
  const availableShortNames = availableCourses.map(c => c.short_name.toLowerCase())
  
  recommendedCourses.forEach(courseName => {
    const normalizedName = courseName.toLowerCase()
    
    // Check if course exists by full name or short name
    const foundCourse = availableCourses.find(c => 
      c.course.toLowerCase() === normalizedName || 
      c.short_name.toLowerCase() === normalizedName ||
      c.course.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(c.short_name.toLowerCase())
    )
    
    if (foundCourse) {
      validCourses.push(foundCourse)
    } else {
      invalidCourses.push(courseName)
    }
  })
  
  // For invalid courses, suggest similar available courses
  const suggestions = invalidCourses.length > 0 
    ? availableCourses.filter(course => 
        invalidCourses.some(invalid => 
          course.course.toLowerCase().includes(invalid.toLowerCase().slice(0, 3)) ||
          course.description?.toLowerCase().includes(invalid.toLowerCase().slice(0, 3))
        )
      ).slice(0, 3) // Limit to 3 suggestions
    : []
    
  return { validCourses, invalidCourses, suggestions }
}

// Get all available course names for AI context
export function getAvailableCoursesList(courses: CourseWithStats[]): string {
  return courses.map(course => `- ${course.course} (${course.short_name})`).join('\n')
}

// Check if a specific course exists in the database
export function courseExists(courseName: string, availableCourses: CourseWithStats[]): CourseWithStats | null {
  const normalizedName = courseName.toLowerCase()
  
  return availableCourses.find(c => 
    c.course.toLowerCase() === normalizedName || 
    c.short_name.toLowerCase() === normalizedName ||
    c.course.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(c.short_name.toLowerCase())
  ) || null
}