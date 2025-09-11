import { useState, useEffect } from 'react'
import { CourseWithStats, EvaluationResponse } from '@/types/courses'
import { supabase } from '@/lib/supabaseClient'
import { X, Star, Users, Clock, TrendingUp, BookOpen, MessageCircle, BarChart3 } from 'lucide-react'

interface CourseDetailModalProps {
  course: CourseWithStats
  onClose: () => void
}

export default function CourseDetailModal({ course, onClose }: CourseDetailModalProps) {
  const [evaluationResponses, setEvaluationResponses] = useState<EvaluationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'course-overview' | 'statistics' | 'feedback'>('course-overview')

  useEffect(() => {
    fetchEvaluationResponses()
  }, [course.id])

  const fetchEvaluationResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('course_evaluations')
        .select('liked_most, would_improve, overall_satisfaction, created_at')
        .eq('course_id', course.id)
        .or('liked_most.neq.,would_improve.neq.')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Filter out empty responses
      const filteredResponses = data.filter(response => 
        (response.liked_most && response.liked_most.trim()) ||
        (response.would_improve && response.would_improve.trim())
      )

      setEvaluationResponses(filteredResponses)
    } catch (error) {
      console.error('Error fetching evaluation responses:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderStarRating = (rating: number, showValue = true) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'
            }`}
          />
        ))}
        {showValue && <span className="text-sm text-gray-300 ml-1">{rating.toFixed(1)}</span>}
      </div>
    )
  }

  const renderStatBar = (value: number, maxValue: number = 5, color: string = 'blue') => {
    const percentage = (value / maxValue) * 100
    const colorClasses = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500'
    }
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color as keyof typeof colorClasses]}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-gray-300 min-w-[3rem] text-right">
          {value.toFixed(1)}
        </span>
      </div>
    )
  }

  const renderHoursDistribution = () => {
    const total = Object.values(course.hours_distribution || {}).reduce((sum, count) => sum + count, 0)
    if (total === 0) return <p className="text-gray-400 text-sm">No time data available</p>

    return (
      <div className="space-y-2">
        {Object.entries(course.hours_distribution || {}).map(([range, count]) => {
          const percentage = (count / total) * 100
          const label = {
            '<3h': 'Less than 3 hours',
            '3-5h': '3-5 hours', 
            '5-10h': '5-10 hours',
            '>10h': 'More than 10 hours'
          }[range] || range

          return (
            <div key={range} className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{label}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 min-w-[3rem] text-right">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderCourseOverviewTab = () => (
    <div className="space-y-6">
      {/* Course Description */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3 flex items-center">
          <BookOpen className="w-4 h-4 mr-2" />
          Course Description
        </h3>
        <p className="text-gray-300 leading-relaxed">
          {course.description || 'Course description not available yet.'}
        </p>
      </div>

      {/* What You'll Study */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3">📚 What You'll Study</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {course.study_topics && course.study_topics.length > 0 ? (
            course.study_topics.map((topic, index) => (
              <div key={index} className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span className="text-gray-300 text-sm">{topic}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">Study topics will be updated soon.</p>
          )}
        </div>
      </div>

      {/* Learning Outcomes */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3">🎯 Learning Outcomes</h3>
        <div className="space-y-2">
          {course.learning_outcomes && course.learning_outcomes.length > 0 ? (
            course.learning_outcomes.map((outcome, index) => (
              <div key={index} className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span className="text-gray-300 text-sm">{outcome}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">Learning outcomes will be updated soon.</p>
          )}
        </div>
      </div>

      {/* Related Fields */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3">🔬 Related to</h3>
        <div className="flex flex-wrap gap-2">
          {course.related_fields && course.related_fields.length > 0 ? (
            course.related_fields.map((field, index) => (
              <span key={index} className="bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-500/30">
                {field}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-sm">Related fields will be updated soon.</span>
          )}
        </div>
      </div>

      {/* Career Paths */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3">💼 Future Career Paths</h3>
        <div className="flex flex-wrap gap-2">
          {course.career_paths && course.career_paths.length > 0 ? (
            course.career_paths.map((career, index) => (
              <span key={index} className="bg-green-600/20 text-green-300 px-3 py-1 rounded-full text-sm border border-green-500/30">
                {career}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-sm">Career paths will be updated soon.</span>
          )}
        </div>
      </div>

      {/* Top Companies */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-3">🏢 Top Companies in This Field</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-200 mb-2">🇯🇵 Japanese Companies</h4>
            <div className="space-y-1">
              {course.top_companies?.japanese && course.top_companies.japanese.length > 0 ? (
                course.top_companies.japanese.map((company, index) => (
                  <div key={index} className="text-gray-300 text-sm">• {company}</div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">Companies will be updated soon.</p>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-200 mb-2">🌍 International Companies</h4>
            <div className="space-y-1">
              {course.top_companies?.international && course.top_companies.international.length > 0 ? (
                course.top_companies.international.map((company, index) => (
                  <div key={index} className="text-gray-300 text-sm">• {company}</div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">Companies will be updated soon.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Course Info */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-2 flex items-center">
          <BookOpen className="w-4 h-4 mr-2" />
          Course Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Level:</span>
            <p className="text-gray-200">{course.level || 'Not specified'}</p>
          </div>
          <div>
            <span className="text-gray-400">Total Credits:</span>
            <p className="text-gray-200">{(course.lecture_credits || 0) + (course.exercise_credits || 0)}</p>
          </div>
          <div>
            <span className="text-gray-400">Lecture Credits:</span>
            <p className="text-gray-200">{course.lecture_credits || 0}</p>
          </div>
          <div>
            <span className="text-gray-400">Exercise Credits:</span>
            <p className="text-gray-200">{course.exercise_credits || 0}</p>
          </div>
          <div>
            <span className="text-gray-400">Semester:</span>
            <p className="text-gray-200">{course.semester || 'Not specified'}</p>
          </div>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-100 mb-4 flex items-center">
          <BarChart3 className="w-4 h-4 mr-2" />
          Evaluation Statistics
          <span className="ml-auto text-sm font-normal text-gray-400">
            {course.total_evaluations} evaluation{course.total_evaluations !== 1 ? 's' : ''}
          </span>
        </h3>
        
        {course.total_evaluations > 0 ? (
          <div className="space-y-4">
            {/* Course Content Ratings */}
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">Course Content</h4>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Content Clarity</span>
                  {renderStatBar(course.avg_content_clarity || 0)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Content Interest</span>
                  {renderStatBar(course.avg_content_interest || 0, 5, 'purple')}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Materials Helpful</span>
                  {renderStatBar(course.avg_materials_helpful || 0, 5, 'green')}
                </div>
              </div>
            </div>

            {/* Instructor Ratings */}
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">Instructor & Teaching</h4>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Instructor Clarity</span>
                  {renderStatBar(course.avg_instructor_clarity || 0, 5, 'yellow')}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Teaching Engaging</span>
                  <span className="text-sm text-gray-400">
                    {(course.teaching_engaging_yes_percent || 0).toFixed(0)}% Yes
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Grading Transparent</span>
                  <span className="text-sm text-gray-400">
                    {(course.grading_transparent_yes_percent || 0).toFixed(0)}% Yes
                  </span>
                </div>
              </div>
            </div>

            {/* Overall Satisfaction */}
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">Overall Experience</h4>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Overall Satisfaction</span>
                  {renderStatBar(course.avg_overall_satisfaction || 0, 5, 'red')}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Received Feedback</span>
                  <span className="text-sm text-gray-400">
                    {(course.received_feedback_percent || 0).toFixed(0)}%
                  </span>
                </div>
                {course.avg_feedback_helpful > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Feedback Helpful</span>
                    {renderStatBar(course.avg_feedback_helpful || 0)}
                  </div>
                )}
              </div>
            </div>

            {/* Time Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Time Commitment Distribution
              </h4>
              <div className="pl-4">
                {renderHoursDistribution()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-300 mb-2">No evaluations yet</h4>
            <p className="text-gray-400 mb-4">Be the first to evaluate this course!</p>
            <div className="text-left bg-gray-600/30 rounded-lg p-4 max-w-md mx-auto">
              <h5 className="font-medium text-gray-200 mb-2">Course Information</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Level:</span>
                  <span className="text-gray-300">{course.level || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Credits:</span>
                  <span className="text-gray-300">{(course.lecture_credits || 0) + (course.exercise_credits || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Semester:</span>
                  <span className="text-gray-300">{course.semester || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderFeedbackTab = () => (
    <div className="space-y-4">
      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading feedback...</p>
      ) : evaluationResponses.length > 0 ? (
        evaluationResponses.map((response, index) => (
          <div key={index} className="bg-gray-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {renderStarRating(response.overall_satisfaction, false)}
                <span className="text-sm text-gray-400 ml-2">
                  Overall: {response.overall_satisfaction}/5
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(response.created_at).toLocaleDateString()}
              </span>
            </div>
            
            {response.liked_most && (
              <div>
                <h4 className="text-sm font-medium text-green-400 mb-1">What they liked:</h4>
                <p className="text-gray-300 text-sm">{response.liked_most}</p>
              </div>
            )}
            
            {response.would_improve && (
              <div>
                <h4 className="text-sm font-medium text-yellow-400 mb-1">What could be improved:</h4>
                <p className="text-gray-300 text-sm">{response.would_improve}</p>
              </div>
            )}
          </div>
        ))
      ) : (
        <p className="text-gray-400 text-center py-8">
          No written feedback available yet.
        </p>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-100">{course.short_name}</h2>
              <p className="text-gray-400">{course.course}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => setActiveTab('course-overview')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'course-overview'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Course Overview
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'statistics'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Evaluation Statistics
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-4 py-3 font-medium transition-colors flex items-center ${
                activeTab === 'feedback'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Student Feedback
              {evaluationResponses.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                  {evaluationResponses.length}
                </span>
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'course-overview' && renderCourseOverviewTab()}
            {activeTab === 'statistics' && renderOverviewTab()}
            {activeTab === 'feedback' && renderFeedbackTab()}
          </div>
        </div>
      </div>
    </div>
  )
}
