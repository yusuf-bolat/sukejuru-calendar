import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { CourseWithStats, EvaluationFormData } from '@/types/courses'
import CourseEvaluationModal from '../components/CourseEvaluationModal'
import CourseDetailModal from '../components/CourseDetailModal'
import { Star, BookOpen, Users, Clock, TrendingUp } from 'lucide-react'

export default function CoursesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedCourse, setSelectedCourse] = useState<CourseWithStats | null>(null)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  
  useEffect(() => {
    checkAuth()
    fetchCourses()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)
  }

  const fetchCourses = async () => {
    try {
      // Try to fetch from the view first, if that fails, fall back to simple courses
      let coursesData;
      let coursesError;
      
      // Try using the courses_with_stats view
      const { data: statsData, error: statsError } = await supabase
        .from('courses_with_stats')
        .select(`
          *,
          description,
          study_topics,
          learning_outcomes,
          related_fields,
          career_paths,
          top_companies
        `)
        .order('level', { ascending: true })
        .order('short_name', { ascending: true })

      if (statsError) {
        console.log('Stats view error, falling back to courses table:', statsError)
        // Fall back to courses table
        const { data, error } = await supabase
          .from('courses')
          .select(`
            *,
            description,
            study_topics,
            learning_outcomes,
            related_fields,
            career_paths,
            top_companies
          `)
          .order('level', { ascending: true })
          .order('short_name', { ascending: true })
        
        coursesData = data
        coursesError = error
      } else {
        coursesData = statsData
        coursesError = null
      }

      if (coursesError) {
        console.error('Error fetching courses:', coursesError)
        throw coursesError
      }

      console.log('Fetched courses:', coursesData)

      if (!coursesData) {
        console.error('No course data received')
        return
      }

      // Map courses to the expected format
      const coursesWithStats: CourseWithStats[] = coursesData.map(course => ({
        ...course,
        // Use stats if available from view, otherwise use defaults
        avg_content_clarity: course.avg_content_clarity || 0,
        avg_content_interest: course.avg_content_interest || 0,
        avg_materials_helpful: course.avg_materials_helpful || 0,
        avg_instructor_clarity: course.avg_instructor_clarity || 0,
        avg_overall_satisfaction: course.avg_overall_satisfaction || 0,
        total_evaluations: course.total_evaluations || 0,
        teaching_engaging_yes_percent: course.teaching_engaging_yes_percent || 0,
        grading_transparent_yes_percent: course.grading_transparent_yes_percent || 0,
        received_feedback_percent: course.received_feedback_percent || 0,
        avg_feedback_helpful: course.avg_feedback_helpful || 0,
        hours_distribution: {
          '<3h': course.hours_lt3_percent || 0,
          '3-5h': course.hours_3to5_percent || 0,
          '5-10h': course.hours_5to10_percent || 0,
          '>10h': course.hours_gt10_percent || 0
        },
        user_has_evaluated: false // Will be updated when we check user evaluations
      }))

      // Check if user has evaluated each course
      if (user) {
        for (const course of coursesWithStats) {
          const { data: userEvaluation } = await supabase
            .from('course_evaluations')
            .select('id')
            .eq('course_id', course.id)
            .eq('user_id', user.id)
            .single()
          
          course.user_has_evaluated = !!userEvaluation
        }
      }

      console.log('Courses with stats:', coursesWithStats)
      setCourses(coursesWithStats)
    } catch (error) {
      console.error('Error fetching courses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEvaluationSubmit = async (courseId: string, formData: EvaluationFormData) => {
    try {
      const { error } = await supabase
        .from('course_evaluations')
        .insert({
          course_id: courseId,
          user_id: user.id,
          ...formData
        })

      if (error) throw error

      // Refresh courses to update statistics
      await fetchCourses()
      setShowEvaluationModal(false)
      setSelectedCourse(null)
    } catch (error) {
      console.error('Error submitting evaluation:', error)
      alert('Error submitting evaluation. Please try again.')
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.course.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLevel = filterDepartment === '' || course.level === filterDepartment
    
    return matchesSearch && matchesLevel
  })

  const departments = [...new Set(courses.map(course => course.level).filter(Boolean))]

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
          />
        ))}
        <span className="text-sm text-gray-300 ml-1">
          {rating > 0 ? rating.toFixed(1) : 'N/A'}
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="app-header">
          <h1 className="app-title">
            <BookOpen className="w-6 h-6" />
            Course Evaluations
          </h1>
        </div>
        <div className="main-content">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading courses...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">
          <BookOpen className="w-6 h-6" />
          Course Evaluations
        </h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/ai-advisor')} 
            className="nav-btn bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            🤖 AI Advisor
          </button>
          <button onClick={() => router.push('/')} className="nav-btn">
            Back to Calendar
          </button>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        {/* Search and Filter Section */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search courses, professors, or course codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              />
            </div>
            <div className="flex-shrink-0">
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{course.short_name}</h3>
                  <h4 className="text-gray-300 mb-2">{course.course}</h4>
                  <p className="text-sm text-gray-400 mb-2">Level: {course.level}</p>
                  <p className="text-sm text-gray-400">Credits: {course.lecture_credits + course.exercise_credits}</p>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{course.total_evaluations || 0}</span>
                </div>
              </div>

              {(course.total_evaluations || 0) > 0 ? (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Content Clarity</span>
                    {renderStarRating(course.avg_content_clarity || 0)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Content Interest</span>
                    {renderStarRating(course.avg_content_interest || 0)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Materials Helpful</span>
                    {renderStarRating(course.avg_materials_helpful || 0)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Overall Satisfaction</span>
                    {renderStarRating(course.avg_overall_satisfaction || 0)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Teaching Engaging</span>
                    <span className="text-sm text-green-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {(course.teaching_engaging_yes_percent || 0).toFixed(0)}% Yes
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 mb-4 py-8">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No evaluations yet</p>
                  <p className="text-xs">Be the first to evaluate!</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedCourse(course)
                    setShowDetailModal(true)
                  }}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-md hover:from-blue-500 hover:to-blue-400 transition-colors duration-200 text-sm"
                >
                  More Info
                </button>
                <button
                  onClick={() => {
                    setSelectedCourse(course)
                    setShowEvaluationModal(true)
                  }}
                  disabled={course.user_has_evaluated}
                  className={`flex-1 px-4 py-2 rounded-md text-sm transition-colors duration-200 ${
                    course.user_has_evaluated
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400'
                  }`}
                >
                  {course.user_has_evaluated ? 'Evaluated' : 'Evaluate'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No courses found</h3>
            <p className="text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Course Evaluation Modal */}
      {showEvaluationModal && selectedCourse && (
        <CourseEvaluationModal
          course={selectedCourse}
          onSubmit={(formData: EvaluationFormData) => handleEvaluationSubmit(selectedCourse.id, formData)}
          onClose={() => {
            setShowEvaluationModal(false)
            setSelectedCourse(null)
          }}
        />
      )}

      {/* Course Detail Modal */}
      {showDetailModal && selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedCourse(null)
          }}
        />
      )}
    </div>
  )
}
