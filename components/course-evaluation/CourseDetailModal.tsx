'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Course {
  id: string
  course_code: string
  course_name: string
  department: string
  credits: number
  professor: string
  description: string
  semester?: string
  year?: number
}

interface CourseWithStats extends Course {
  avg_difficulty: number
  avg_workload: number
  avg_homework_difficulty: number
  avg_usefulness: number
  avg_professor_rating: number
  avg_exam_difficulty: number
  avg_hours_per_week: number
  evaluation_count: number
  recommendation_percentage: number
}

interface Evaluation {
  id: string
  course_difficulty: number
  course_workload: number
  homework_difficulty: number
  course_usefulness: number
  professor_rating: number
  exam_difficulty: number
  hours_per_week: number
  exam_prep_time: number
  would_recommend: boolean
  feedback?: string
  advice_to_students?: string
  created_at: string
}

interface CourseDetailModalProps {
  course: CourseWithStats
  isOpen: boolean
  onClose: () => void
}

// Simple X icon component  
const X = ({ size = 24, onClick }: { size?: number, onClick?: () => void }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    onClick={onClick}
    className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
  >
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function CourseDetailModal({
  course,
  isOpen,
  onClose
}: CourseDetailModalProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews'>('overview')

  useEffect(() => {
    if (isOpen && course.id) {
      fetchEvaluations()
    }
  }, [isOpen, course.id])

  const fetchEvaluations = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('course_evaluations')
        .select('*')
        .eq('course_id', course.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvaluations(data || [])
    } catch (error) {
      console.error('Error fetching evaluations:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`text-sm ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
            ⭐
          </span>
        ))}
      </div>
    )
  }

  const getExamPrepTimeText = (days: number) => {
    if (days === 1) return '1 day'
    if (days < 7) return `${days} days`
    if (days === 7) return '1 week'
    if (days === 14) return '2 weeks'
    if (days === 21) return '3 weeks'
    if (days === 30) return '1 month'
    if (days === 60) return '2 months'
    return `${days} days`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {course.course_code} - {course.course_name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {course.professor} • {course.department} • {course.credits} credits
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {course.description}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Overview & Stats
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reviews'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Reviews ({course.evaluation_count})
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {course.evaluation_count > 0 ? (
                  <>
                    {/* Average Ratings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Course Difficulty
                        </h4>
                        <div className="flex items-center space-x-2">
                          {renderStars(course.avg_difficulty)}
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {course.avg_difficulty}/5
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Course Usefulness
                        </h4>
                        <div className="flex items-center space-x-2">
                          {renderStars(course.avg_usefulness)}
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {course.avg_usefulness}/5
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Professor Rating
                        </h4>
                        <div className="flex items-center space-x-2">
                          {renderStars(course.avg_professor_rating)}
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {course.avg_professor_rating}/5
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Workload
                        </h4>
                        <div className="flex items-center space-x-2">
                          {renderStars(course.avg_workload)}
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {course.avg_workload}/5
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Exam Difficulty
                        </h4>
                        <div className="flex items-center space-x-2">
                          {renderStars(course.avg_exam_difficulty)}
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {course.avg_exam_difficulty}/5
                          </span>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Weekly Hours
                        </h4>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {course.avg_hours_per_week} hrs/week
                        </div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Student Recommendation
                      </h4>
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {course.recommendation_percentage}%
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          of students recommend this course
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                        Based on {course.evaluation_count} evaluation{course.evaluation_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                      No evaluations yet
                    </p>
                    <p className="text-gray-400 dark:text-gray-500">
                      Be the first to share your experience with this course!
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Loading reviews...</p>
                  </div>
                ) : evaluations.length > 0 ? (
                  evaluations.map((evaluation) => (
                    <div key={evaluation.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Difficulty</span>
                          <div className="flex items-center">
                            {renderStars(evaluation.course_difficulty)}
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                              {evaluation.course_difficulty}/5
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Usefulness</span>
                          <div className="flex items-center">
                            {renderStars(evaluation.course_usefulness)}
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                              {evaluation.course_usefulness}/5
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Professor</span>
                          <div className="flex items-center">
                            {renderStars(evaluation.professor_rating)}
                            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-white">
                              {evaluation.professor_rating}/5
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Recommends</span>
                          <div className={`text-sm font-medium ${evaluation.would_recommend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {evaluation.would_recommend ? 'Yes' : 'No'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Hours/week:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{evaluation.hours_per_week}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Exam prep:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">
                            {getExamPrepTimeText(evaluation.exam_prep_time)}
                          </span>
                        </div>
                      </div>

                      {evaluation.feedback && (
                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Feedback:
                          </h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {evaluation.feedback}
                          </p>
                        </div>
                      )}

                      {evaluation.advice_to_students && (
                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Advice to Future Students:
                          </h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {evaluation.advice_to_students}
                          </p>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                        {new Date(evaluation.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      No reviews yet. Be the first to review this course!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
