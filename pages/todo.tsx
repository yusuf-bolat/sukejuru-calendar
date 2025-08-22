import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/router'

interface Assignment {
  id: string
  title: string
  description: string
  due_date: string
  course: string
  type: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

interface TaskFormData {
  title: string
  description: string
  category: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
}

export default function TodoList() {
  const [session, setSession] = useState<any>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showMoreDays, setShowMoreDays] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [filter, setFilter] = useState<{
    priority: string
    category: string
    dateRange: string
  }>({
    priority: 'all',
    category: 'all',
    dateRange: 'all'
  })
  const [newTask, setNewTask] = useState<TaskFormData>({
    title: '',
    description: '',
    category: '',
    dueDate: '',
    priority: 'medium'
  })
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
      
      if (!session) {
        router.push('/auth/login')
        return
      }
    }
    
    checkAuth()
    
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        router.push('/auth/login')
      }
    })
    
    return () => { sub?.subscription.unsubscribe() }
  }, [router])

  useEffect(() => {
    const loadAssignments = async () => {
      if (!session?.user) return
      
      const { data } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', session.user.id)
        .order('due_date', { ascending: true })
      
      setAssignments(data || [])
    }
    
    loadAssignments()
  }, [session])

  const toggleComplete = async (id: string, completed: boolean) => {
    await supabase
      .from('assignments')
      .update({ completed: !completed })
      .eq('id', id)
      .eq('user_id', session?.user.id)
    
    setAssignments(prev => prev.map(a => 
      a.id === id ? { ...a, completed: !completed } : a
    ))
  }

  const deleteAssignment = async (id: string) => {
    if (confirm('Delete this assignment?')) {
      await supabase
        .from('assignments')
        .delete()
        .eq('id', id)
        .eq('user_id', session?.user.id)
      
      setAssignments(prev => prev.filter(a => a.id !== id))
    }
  }

  const addAssignment = async () => {
    if (!newTask.title || !newTask.dueDate) {
      alert('Please fill in title and due date')
      return
    }
    
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        user_id: session?.user.id,
        title: newTask.title,
        description: newTask.description,
        due_date: newTask.dueDate,
        course: newTask.category || 'General',
        type: 'manual',
        completed: false,
        priority: newTask.priority
      })
      .select()
      .single()
    
    if (!error && data) {
      setAssignments(prev => [...prev, data])
      setShowAddModal(false)
      setNewTask({
        title: '',
        description: '',
        category: '',
        dueDate: '',
        priority: 'medium'
      })
    }
  }

  const openAddModal = () => {
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setNewTask({
      title: '',
      description: '',
      category: '',
      dueDate: '',
      priority: 'medium'
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ff6b6b'
      case 'medium': return '#ffa726'
      case 'low': return '#66bb6a'
      default: return '#64b5f6'
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  const getDayLabel = (daysFromToday: number) => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromToday)
    
    if (daysFromToday === 0) return 'Today'
    if (daysFromToday === 1) return 'Tomorrow'
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getDateString = (daysFromToday: number) => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromToday)
    return date.toISOString().split('T')[0]
  }

  const getAssignmentsForDay = (daysFromToday: number) => {
    const targetDate = getDateString(daysFromToday)
    let filteredAssignments = assignments.filter(a => 
      !a.completed && a.due_date.split('T')[0] === targetDate
    )
    
    return applyFilters(filteredAssignments)
  }

  const getOverdueAssignments = () => {
    const today = new Date().toISOString().split('T')[0]
    let filteredAssignments = assignments.filter(a => 
      !a.completed && a.due_date.split('T')[0] < today
    )
    
    return applyFilters(filteredAssignments)
  }

  const applyFilters = (taskList: Assignment[]) => {
    let filtered = taskList

    // Priority filter
    if (filter.priority !== 'all') {
      filtered = filtered.filter(a => a.priority === filter.priority)
    }

    // Category filter
    if (filter.category !== 'all') {
      if (filter.category === 'uncategorized') {
        filtered = filtered.filter(a => !a.course || a.course === 'General')
      } else {
        filtered = filtered.filter(a => a.course?.toLowerCase().includes(filter.category.toLowerCase()))
      }
    }

    return filtered
  }

  const getUniqueCategories = () => {
    const categories = assignments
      .map(a => a.course)
      .filter(course => course && course !== 'General')
      .filter((course, index, self) => self.indexOf(course) === index)
    
    return ['all', 'uncategorized', ...categories]
  }

  const renderAssignmentCard = (assignment: Assignment) => (
    <div 
      key={assignment.id} 
      style={{ 
        background: '#1a1a1a', 
        border: `2px solid ${getPriorityColor(assignment.priority)}`, 
        borderRadius: '12px', 
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <input 
            type="checkbox" 
            checked={assignment.completed}
            onChange={() => toggleComplete(assignment.id, assignment.completed)}
            style={{ transform: 'scale(1.2)' }}
          />
          <h4 style={{ color: '#f2f2f2', margin: 0, fontSize: '16px' }}>{assignment.title}</h4>
          <span style={{ 
            background: getPriorityColor(assignment.priority), 
            color: 'white', 
            padding: '2px 8px', 
            borderRadius: '12px', 
            fontSize: '12px',
            textTransform: 'uppercase'
          }}>
            {assignment.priority}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', color: '#aaa', fontSize: '14px' }}>
          <span>📚 {assignment.course}</span>
          <span>🏷️ {assignment.type}</span>
        </div>
        
        {assignment.description && (
          <p style={{ color: '#ccc', margin: '8px 0 0 0', fontSize: '14px' }}>{assignment.description}</p>
        )}
      </div>
      
      <button
        onClick={() => deleteAssignment(assignment.id)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: '#ff6b6b', 
          cursor: 'pointer',
          fontSize: '18px',
          padding: '8px'
        }}
        title="Delete assignment"
      >
        🗑️
      </button>
    </div>
  )

  const renderDaySection = (daysFromToday: number) => {
    const dayAssignments = getAssignmentsForDay(daysFromToday)
    const dayLabel = getDayLabel(daysFromToday)
    
    const getDayEmoji = (days: number) => {
      if (days === 0) return '📅'
      if (days === 1) return '⏰'
      return '📆'
    }
    
    const getDayColor = (days: number) => {
      if (days === 0) return '#ff6b6b' // Today - Red
      if (days === 1) return '#ffa726' // Tomorrow - Orange  
      return '#4fc3f7' // Future - Blue
    }

    return (
      <div key={daysFromToday} className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ 
          color: getDayColor(daysFromToday), 
          fontSize: '18px', 
          marginBottom: '16px', 
          borderBottom: '1px solid #333', 
          paddingBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {getDayEmoji(daysFromToday)} {dayLabel} ({dayAssignments.length})
        </h3>
        
        {dayAssignments.length === 0 ? (
          <p style={{ color: '#aaa', fontStyle: 'italic' }}>
            {daysFromToday === 0 ? 'No assignments due today! 🎉' : `No assignments due ${dayLabel.toLowerCase()}`}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dayAssignments.map(renderAssignmentCard)}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Redirecting to login...</div>
      </div>
    )
  }

  const completedAssignments = assignments.filter(a => a.completed)
  const overdueAssignments = getOverdueAssignments()
  const daysToShow = showMoreDays ? 14 : 7

  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">📝 Assignment & Todo List</h1>
        <div className="user-info">
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/" className="nav-btn">
              Calendar
            </Link>
            <Link href="/profile" className="nav-btn">
              Profile
            </Link>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="logout-btn"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '32px',
          gap: '32px'
        }}>
          <h2 style={{ color: '#f2f2f2', fontSize: '28px', margin: 0, fontWeight: '600' }}>Your Tasks & Todo List</h2>
          <button 
            onClick={openAddModal}
            className="button-primary"
            style={{ 
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%)',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(79, 195, 247, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            ✨ Add New Task
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '24px', 
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
            {/* Priority Filter */}
            <div>
              <label style={{ color: '#aaa', fontSize: '14px', marginBottom: '4px', display: 'block' }}>
                Priority
              </label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '2px solid #333',
                  background: '#1a1a1a',
                  color: '#f2f2f2',
                  fontSize: '14px'
                }}
              >
                <option value="all">All Priorities</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label style={{ color: '#aaa', fontSize: '14px', marginBottom: '4px', display: 'block' }}>
                Category
              </label>
              <select
                value={filter.category}
                onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '2px solid #333',
                  background: '#1a1a1a',
                  color: '#f2f2f2',
                  fontSize: '14px'
                }}
              >
                {getUniqueCategories().map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : 
                     category === 'uncategorized' ? 'Uncategorized' : 
                     category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* View Toggle Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowCompletedTasks(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '2px solid #4fc3f7',
                background: !showCompletedTasks ? '#4fc3f7' : 'transparent',
                color: !showCompletedTasks ? 'white' : '#4fc3f7',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
            >
              📋 Active Tasks
            </button>
            <button
              onClick={() => setShowCompletedTasks(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '2px solid #66bb6a',
                background: showCompletedTasks ? '#66bb6a' : 'transparent',
                color: showCompletedTasks ? 'white' : '#66bb6a',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
            >
              ✅ Completed ({completedAssignments.length})
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        {!showCompletedTasks ? (
          <>
            {/* Overdue Assignments */}
            {overdueAssignments.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', padding: '24px', border: '2px solid #ff6b6b' }}>
                <h3 style={{ 
                  color: '#ff6b6b', 
                  fontSize: '18px', 
                  marginBottom: '16px', 
                  borderBottom: '1px solid #333', 
                  paddingBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ⚠️ Overdue ({overdueAssignments.length})
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {overdueAssignments.map(renderAssignmentCard)}
                </div>
              </div>
            )}

            {/* Daily Assignment Sections */}
            {Array.from({ length: daysToShow }, (_, i) => renderDaySection(i))}

            {/* More/Less Button */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <button
                onClick={() => setShowMoreDays(!showMoreDays)}
                className="button-primary"
                style={{ 
                  padding: '12px 24px',
                  background: '#4fc3f7',
                  opacity: 0.8
                }}
              >
                {showMoreDays ? '← Show Less' : 'Show More Days →'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Completed Tasks Window */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ 
                color: '#66bb6a', 
                fontSize: '20px', 
                marginBottom: '20px', 
                borderBottom: '2px solid #66bb6a', 
                paddingBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                ✅ Completed Tasks ({completedAssignments.length})
              </h3>
              
              {completedAssignments.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px', 
                  color: '#aaa',
                  fontSize: '18px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                  <p>No completed tasks yet!</p>
                  <p style={{ fontSize: '14px', opacity: 0.7 }}>Complete some tasks to see them here.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                  {applyFilters(completedAssignments).map((assignment) => (
                    <div 
                      key={assignment.id} 
                      style={{ 
                        background: '#0a2e1a', 
                        border: '2px solid #66bb6a', 
                        borderRadius: '12px', 
                        padding: '16px',
                        position: 'relative',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLElement
                        target.style.transform = 'translateY(-2px)'
                        target.style.boxShadow = '0 8px 25px rgba(102, 187, 106, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLElement
                        target.style.transform = 'translateY(0)'
                        target.style.boxShadow = 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <input 
                              type="checkbox" 
                              checked={assignment.completed}
                              onChange={() => toggleComplete(assignment.id, assignment.completed)}
                              style={{ transform: 'scale(1.2)' }}
                            />
                            <h4 style={{ 
                              color: '#66bb6a', 
                              margin: 0, 
                              fontSize: '16px', 
                              textDecoration: 'line-through',
                              opacity: 0.8
                            }}>
                              {assignment.title}
                            </h4>
                            <span style={{ 
                              background: getPriorityColor(assignment.priority), 
                              color: 'white', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              opacity: 0.7
                            }}>
                              {assignment.priority}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '16px', color: '#888', fontSize: '14px', marginBottom: '8px' }}>
                            {assignment.course && assignment.course !== 'General' && (
                              <span>📚 {assignment.course}</span>
                            )}
                            <span>📅 Completed: {formatDate(assignment.due_date)}</span>
                            <span>🏷️ {assignment.type}</span>
                          </div>
                          
                          {assignment.description && (
                            <p style={{ color: '#aaa', margin: '0', fontSize: '14px', opacity: 0.8 }}>
                              {assignment.description}
                            </p>
                          )}
                        </div>
                        
                        <button
                          onClick={() => deleteAssignment(assignment.id)}
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: '#ff6b6b', 
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '8px',
                            opacity: 0.7
                          }}
                          title="Delete task"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Assignment Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            borderRadius: '16px',
            padding: '32px',
            width: '90%',
            maxWidth: '500px',
            border: '2px solid #4fc3f7',
            boxShadow: '0 20px 60px rgba(79, 195, 247, 0.3)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '24px' 
            }}>
              <h3 style={{ color: '#4fc3f7', fontSize: '24px', margin: 0, fontWeight: '600' }}>
                ✨ Add New Task
              </h3>
              <button
                onClick={closeAddModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ff6b6b',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = '#ff6b6b20'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Task Title */}
              <div>
                <label style={{ 
                  color: '#e1e5e9', 
                  fontSize: '15px', 
                  fontWeight: '500',
                  marginBottom: '8px', 
                  display: 'block' 
                }}>
                  Task Title *
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="What needs to be done?"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid #333',
                    background: '#0f1419',
                    color: '#e1e5e9',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4fc3f7'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ 
                  color: '#e1e5e9', 
                  fontSize: '15px', 
                  fontWeight: '500',
                  marginBottom: '8px', 
                  display: 'block' 
                }}>
                  Category <span style={{ color: '#888', fontWeight: '400' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={newTask.category}
                  onChange={(e) => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Course, Club Activity, Meeting, Personal..."
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid #333',
                    background: '#0f1419',
                    color: '#e1e5e9',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4fc3f7'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
              </div>

              {/* Due Date & Priority Row */}
              <div style={{ display: 'flex', gap: '16px' }}>
                {/* Due Date */}
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    color: '#e1e5e9', 
                    fontSize: '15px', 
                    fontWeight: '500',
                    marginBottom: '8px', 
                    display: 'block' 
                  }}>
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #333',
                      background: '#0f1419',
                      color: '#e1e5e9',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4fc3f7'}
                    onBlur={(e) => e.target.style.borderColor = '#333'}
                  />
                </div>

                {/* Priority */}
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    color: '#e1e5e9', 
                    fontSize: '15px', 
                    fontWeight: '500',
                    marginBottom: '8px', 
                    display: 'block' 
                  }}>
                    Priority
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '2px solid #333',
                      background: '#0f1419',
                      color: '#e1e5e9',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.3s ease',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#4fc3f7'}
                    onBlur={(e) => e.target.style.borderColor = '#333'}
                  >
                    <option value="low">🟢 Low Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="high">🔴 High Priority</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ 
                  color: '#e1e5e9', 
                  fontSize: '15px', 
                  fontWeight: '500',
                  marginBottom: '8px', 
                  display: 'block' 
                }}>
                  Notes <span style={{ color: '#888', fontWeight: '400' }}>(optional)</span>
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add any additional details or notes..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid #333',
                    background: '#0f1419',
                    color: '#e1e5e9',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.3s ease',
                    resize: 'vertical',
                    minHeight: '80px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4fc3f7'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={closeAddModal}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: '2px solid #555',
                    background: 'transparent',
                    color: '#e1e5e9',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '500',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLButtonElement
                    target.style.borderColor = '#777'
                    target.style.background = '#ffffff08'
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLButtonElement
                    target.style.borderColor = '#555'
                    target.style.background = 'transparent'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={addAssignment}
                  style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(79, 195, 247, 0.3)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLButtonElement
                    target.style.transform = 'translateY(-2px)'
                    target.style.boxShadow = '0 6px 20px rgba(79, 195, 247, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLButtonElement
                    target.style.transform = 'translateY(0)'
                    target.style.boxShadow = '0 4px 15px rgba(79, 195, 247, 0.3)'
                  }}
                >
                  ✨ Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="site-footer">
        <span>© 2025 Student Calendar • </span>
        <a href="#" target="_blank" rel="noopener">Privacy Policy</a>
      </div>
    </div>
  )
}
