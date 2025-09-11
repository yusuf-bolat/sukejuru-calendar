import { NextApiRequest, NextApiResponse } from 'next'
import { 
  fetchCoursesForAI, 
  getCoursesForField, 
  getCoursesByWorkload, 
  validateCourseRecommendations,
  getAvailableCoursesList 
} from '@/lib/courseAIData'
import { systemPrompt } from '@/lib/prompt'

interface RecommendationRequest {
  query: string
  field?: string
  workloadPreference?: 'low' | 'medium' | 'high'
  careerPath?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, field, workloadPreference, careerPath }: RecommendationRequest = req.body

    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    // Fetch fresh course data from database
    console.log('🤖 Fetching course data for recommendation...')
    const courseData = await fetchCoursesForAI()

    if (!courseData) {
      return res.status(500).json({ error: 'Failed to fetch course data' })
    }

    console.log(`✅ Course database loaded: ${courseData.courses.length} courses available`)

    // Filter courses based on specific criteria if provided
    let filteredCourses = courseData.courses
    
    if (field) {
      filteredCourses = getCoursesForField(filteredCourses, field)
    }
    
    if (workloadPreference) {
      filteredCourses = getCoursesByWorkload(filteredCourses, workloadPreference)
    }

    // Create AI context with course data
    const aiContext = {
      ...courseData,
      filteredCourses: filteredCourses,
      userQuery: query,
      criteriaApplied: {
        field: field || null,
        workloadPreference: workloadPreference || null,
        careerPath: careerPath || null
      }
    }

    // Generate AI prompt with course context
    const prompt = systemPrompt('Sukejuru AI Advisor', 'Asia/Tokyo', courseData)
    
    // Generate recommendations based ONLY on database courses
    const recommendations = generateRecommendations(query, filteredCourses, courseData)

    res.status(200).json({
      success: true,
      query,
      recommendations,
      totalCourses: filteredCourses.length,
      availableCourses: courseData.courses.length,
      databaseConstraint: "All recommendations are strictly limited to courses in the database",
      aiContext: {
        hasData: true,
        coursesAvailable: courseData.courses.length,
        lastUpdated: courseData.lastUpdated,
        constrainedToDatabase: true
      }
    })

  } catch (error) {
    console.error('❌ Error in course recommendations:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// Generate recommendations based on query and course data
function generateRecommendations(query: string, courses: any[], courseData: any) {
  const queryLower = query.toLowerCase()
  
  // Robotics-related courses
  if (queryLower.includes('robot')) {
    return {
      type: 'field_recommendation',
      field: 'Robotics',
      recommendedCourses: courses.filter(course =>
        course.course.toLowerCase().includes('mechanic') ||
        course.course.toLowerCase().includes('electric') ||
        course.course.toLowerCase().includes('control') ||
        course.course.toLowerCase().includes('programming') ||
        course.related_fields?.some((f: string) => 
          f.toLowerCase().includes('engineering') || f.toLowerCase().includes('programming')
        )
      ).slice(0, 5),
      explanation: 'For robotics, I recommend courses that combine mechanical engineering, electrical systems, and programming skills.',
      careerPaths: ['Robotics Engineer', 'Automation Specialist', 'Mechatronics Engineer']
    }
  }

  // Chemistry workload query
  if (queryLower.includes('chemistry') && queryLower.includes('workload')) {
    const chemistryCourses = courses.filter(course =>
      course.course.toLowerCase().includes('chem') ||
      course.related_fields?.some((f: string) => f.toLowerCase().includes('chemistry'))
    ).sort((a, b) => (a.avg_instructor_clarity || 0) - (b.avg_instructor_clarity || 0))

    return {
      type: 'workload_analysis',
      field: 'Chemistry',
      recommendedCourses: chemistryCourses.slice(0, 3),
      explanation: 'Based on student evaluations, these chemistry-related courses have more manageable workloads with higher instructor clarity ratings.',
      workloadTips: [
        'Look for courses with high instructor clarity ratings (4+ stars)',
        'Check the hours per week distribution in student feedback',
        'Consider taking prerequisites to build a strong foundation'
      ]
    }
  }

  // General course query
  return {
    type: 'general_recommendation',
    recommendedCourses: courses
      .filter(course => course.total_evaluations > 0)
      .sort((a, b) => (b.avg_overall_satisfaction || 0) - (a.avg_overall_satisfaction || 0))
      .slice(0, 5),
    explanation: 'Here are the top-rated courses based on student evaluations and your query.',
    generalTips: [
      'Consider your career goals and interests',
      'Check prerequisite requirements',
      'Balance challenging and manageable courses each semester',
      'Look at student feedback for insights on workload and teaching quality'
    ]
  }
}