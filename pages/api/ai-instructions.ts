import { NextApiRequest, NextApiResponse } from 'next'
import { fetchCoursesForAI } from '@/lib/courseAIData'
import { systemPrompt } from '@/lib/prompt'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Fetch fresh course data from database
    console.log('🤖 Fetching course data for AI instructions...')
    const courseData = await fetchCoursesForAI()

    // Generate system prompt with course context
    const instructions = systemPrompt('Sukejuru AI Advisor', 'Asia/Tokyo', courseData || undefined)

    // Return the AI instructions with course context
    res.status(200).json({
      success: true,
      instructions,
      hasCourseData: !!courseData,
      courseDataSummary: courseData ? {
        totalCourses: courseData.courses.length,
        lastUpdated: courseData.lastUpdated,
        hasEvaluations: courseData.courses.some(c => c.total_evaluations > 0)
      } : null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error generating AI instructions:', error)
    res.status(500).json({ 
      error: 'Failed to generate AI instructions',
      instructions: systemPrompt('Sukejuru AI Advisor', 'Asia/Tokyo'), // Fallback without course data
      hasCourseData: false
    })
  }
}