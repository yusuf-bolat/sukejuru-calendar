import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Assignment {
  id: string
  title: string
  description: string
  due_date: string
  due_time?: string
  course: string
  type: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

interface TodoPanelProps {
  view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  currentDate: Date
  selectedDate?: Date
  forSidebar?: boolean // New prop for sidebar rendering mode
}

export function TodoPanel({ view, currentDate, selectedDate, forSidebar = false }: TodoPanelProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAssignments()
    
    // Listen for todo refresh events
    const handleTodoRefresh = () => {
      fetchAssignments()
    }
    
    window.addEventListener('todo:refresh', handleTodoRefresh)
    
    return () => {
      window.removeEventListener('todo:refresh', handleTodoRefresh)
    }
  }, [currentDate, selectedDate, view])

  const fetchAssignments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', session.user.id)
        .order('due_date', { ascending: true })

      if (error) {
        console.error('Error fetching assignments:', error)
      } else {
        setAssignments(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleAssignment = async (id: string, completed: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase
        .from('assignments')
        .update({ completed })
        .eq('id', id)
        .eq('user_id', session.user.id)

      if (error) {
        console.error('Error updating assignment:', error)
      } else {
        setAssignments(prev => prev.map(assignment => 
          assignment.id === id ? { ...assignment, completed } : assignment
        ))
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const deleteAssignment = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id)

      if (error) {
        console.error('Error deleting assignment:', error)
      } else {
        setAssignments(prev => prev.filter(assignment => assignment.id !== id))
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const getFilteredAssignments = () => {
    const today = new Date()
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1) // Monday
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    return assignments.filter(assignment => {
      const dueDate = new Date(assignment.due_date)
      
      switch (view) {
        case 'timeGridDay':
          return selectedDate && dueDate.toDateString() === selectedDate.toDateString()
        case 'timeGridWeek':
          return dueDate >= startOfWeek && dueDate <= endOfWeek
        case 'dayGridMonth':
          return dueDate >= startOfMonth && dueDate <= endOfMonth
        default:
          return true
      }
    })
  }

  const getAssignmentsByDay = () => {
    if (view !== 'timeGridWeek') return {}
    
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1) // Monday
    
    const dayAssignments: { [key: string]: Assignment[] } = {}
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      const dayKey = day.toDateString()
      dayAssignments[dayKey] = []
    }
    
    getFilteredAssignments().forEach(assignment => {
      const dueDate = new Date(assignment.due_date)
      const dayKey = dueDate.toDateString()
      if (dayAssignments[dayKey]) {
        dayAssignments[dayKey].push(assignment)
      }
    })
    
    return dayAssignments
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ff4444'
      case 'medium': return '#ffaa44'
      case 'low': return '#44aa44'
      default: return '#666666'
    }
  }

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return ''
    try {
      const [hours, minutes] = timeString.split(':')
      const time = new Date()
      time.setHours(parseInt(hours), parseInt(minutes))
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return timeString
    }
  }

  if (loading) {
    return (
      <div className="todo-panel">
        <div className="todo-loading">Loading todos...</div>
      </div>
    )
  }

  // Weekly view - show todos under each day (skip when rendering sidebar)
  if (!forSidebar && view === 'timeGridWeek') {
    const dayAssignments = getAssignmentsByDay()
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1) // Monday

    return (
      <div className="todo-panel weekly-todos">
        <div className="weekly-todo-grid">
          {Array.from({ length: 7 }).map((_, index) => {
            const day = new Date(startOfWeek)
            day.setDate(startOfWeek.getDate() + index)
            const dayKey = day.toDateString()
            const dayTodos = dayAssignments[dayKey] || []
            const dayName = day.toLocaleDateString('en-US', { weekday: 'short' })

            return (
              <div key={dayKey} className="day-todo-column">
                <div className="day-todos">
                  {dayTodos.map(assignment => (
                    <div key={assignment.id} className="todo-item compact">
                      <div className="todo-checkbox-container">
                        <input
                          type="checkbox"
                          checked={assignment.completed}
                          onChange={(e) => toggleAssignment(assignment.id, e.target.checked)}
                          className="todo-checkbox"
                        />
                        <div 
                          className="priority-indicator"
                          style={{ backgroundColor: getPriorityColor(assignment.priority) }}
                        ></div>
                      </div>
                      <div className={`todo-content ${assignment.completed ? 'completed' : ''}`}>
                        <div className="todo-title">{assignment.title}</div>
                        <div className="todo-course">{assignment.course}</div>
                        {assignment.due_time && (
                          <div className="todo-time">{formatTime(assignment.due_time)}</div>
                        )}
                      </div>
                      <button 
                        onClick={() => deleteAssignment(assignment.id)}
                        className="todo-delete"
                        title="Delete todo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {dayTodos.length === 0 && (
                    <div className="no-todos">No todos</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Daily view - show todos for that day (skip when rendering sidebar)
  if (!forSidebar && view === 'timeGridDay') {
    const filteredAssignments = getFilteredAssignments()

    return (
      <div className="todo-panel daily-todos">
        <div className="todo-header">
          <h3>📅 Daily Todos</h3>
          <p className="todo-date">{selectedDate?.toLocaleDateString() || currentDate.toLocaleDateString()}</p>
        </div>
        <div className="todo-list">
          {filteredAssignments.map(assignment => (
            <div key={assignment.id} className="todo-item">
              <div className="todo-checkbox-container">
                <input
                  type="checkbox"
                  checked={assignment.completed}
                  onChange={(e) => toggleAssignment(assignment.id, e.target.checked)}
                  className="todo-checkbox"
                />
                <div 
                  className="priority-indicator"
                  style={{ backgroundColor: getPriorityColor(assignment.priority) }}
                ></div>
              </div>
              <div className={`todo-content ${assignment.completed ? 'completed' : ''}`}>
                <div className="todo-title">{assignment.title}</div>
                <div className="todo-course">{assignment.course}</div>
                {assignment.due_time && (
                  <div className="todo-time">{formatTime(assignment.due_time)}</div>
                )}
                {assignment.description && (
                  <div className="todo-description">{assignment.description}</div>
                )}
              </div>
              <button 
                onClick={() => deleteAssignment(assignment.id)}
                className="todo-delete"
                title="Delete todo"
              >
                ×
              </button>
            </div>
          ))}
          {filteredAssignments.length === 0 && (
            <div className="no-todos">No todos for this day</div>
          )}
        </div>
      </div>
    )
  }

  // Monthly view - show all todos for the month sorted by time (skip when rendering sidebar)
  if (!forSidebar && view === 'dayGridMonth') {
    const filteredAssignments = getFilteredAssignments()
      .sort((a, b) => {
        const dateA = new Date(a.due_date + (a.due_time ? `T${a.due_time}` : ''))
        const dateB = new Date(b.due_date + (b.due_time ? `T${b.due_time}` : ''))
        return dateA.getTime() - dateB.getTime()
      })

    return (
      <div className="todo-panel monthly-todos">
        <div className="todo-header">
          <h3>📅 Monthly Todos</h3>
          <p className="todo-month">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="todo-list">
          {filteredAssignments.map(assignment => (
            <div key={assignment.id} className="todo-item">
              <div className="todo-checkbox-container">
                <input
                  type="checkbox"
                  checked={assignment.completed}
                  onChange={(e) => toggleAssignment(assignment.id, e.target.checked)}
                  className="todo-checkbox"
                />
                <div 
                  className="priority-indicator"
                  style={{ backgroundColor: getPriorityColor(assignment.priority) }}
                ></div>
              </div>
              <div className={`todo-content ${assignment.completed ? 'completed' : ''}`}>
                <div className="todo-title">{assignment.title}</div>
                <div className="todo-meta">
                  <span className="todo-course">{assignment.course}</span>
                  <span className="todo-date">
                    {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {assignment.due_time && ` ${formatTime(assignment.due_time)}`}
                  </span>
                </div>
                {assignment.description && (
                  <div className="todo-description">{assignment.description}</div>
                )}
              </div>
              <button 
                onClick={() => deleteAssignment(assignment.id)}
                className="todo-delete"
                title="Delete todo"
              >
                ×
              </button>
            </div>
          ))}
          {filteredAssignments.length === 0 && (
            <div className="no-todos">No todos for this month</div>
          )}
        </div>
      </div>
    )
  }

  // Sidebar mode - render todos vertically for dragging to calendar
  if (forSidebar) {
    const incompleteTodos = assignments.filter(assignment => !assignment.completed)
      .sort((a, b) => {
        const dateA = new Date(a.due_date + (a.due_time ? `T${a.due_time}` : ''))
        const dateB = new Date(b.due_date + (b.due_time ? `T${b.due_time}` : ''))
        return dateA.getTime() - dateB.getTime()
      })

    return (
      <div className="todo-panel sidebar-todos">
        <div className="todo-header">
          <h3>📝 Drag Tasks to Calendar</h3>
          <p className="todo-subtitle">Drag any task below to schedule it on your calendar</p>
        </div>
        <div className="todo-list vertical-todos" id="todo-list">
          {incompleteTodos.map(assignment => (
            <div 
              key={assignment.id} 
              className="todo-item draggable-todo"
              draggable={true}
              data-event={JSON.stringify({
                title: assignment.title,
                duration: '00:30:00', // Default 30 minutes
                // Bold/darker green palette for todo-derived events
                backgroundColor: '#66bb6a', // medium green
                borderColor: '#1b5e20', // dark green border
                textColor: '#ffffff',
                extendedProps: {
                  type: 'todo',
                  priority: assignment.priority,
                  course: assignment.course,
                  description: assignment.description,
                  originalTodoId: assignment.id
                }
              })}
              style={{
                cursor: 'grab',
                transition: 'transform 0.2s ease',
                marginBottom: '8px'
              }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy'
              }}
            >
              <div className="todo-checkbox-container">
                <div 
                  className="priority-indicator"
                  style={{ backgroundColor: getPriorityColor(assignment.priority) }}
                ></div>
              </div>
              <div className="todo-content">
                <div className="todo-title">{assignment.title}</div>
                <div className="todo-meta">
                  <span className="todo-course">{assignment.course}</span>
                  {assignment.due_date && (
                    <span className="todo-date">
                      {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {assignment.due_time && ` ${formatTime(assignment.due_time)}`}
                    </span>
                  )}
                </div>
                {assignment.description && (
                  <div className="todo-description" style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                    {assignment.description.length > 50 ? assignment.description.substring(0, 50) + '...' : assignment.description}
                  </div>
                )}
              </div>
              <div className="todo-actions">
                <button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleAssignment(assignment.id, true)
                  }}
                  className="todo-complete"
                  title="Mark as complete"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4fc3f7',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px'
                  }}
                >
                  ✓
                </button>
              </div>
            </div>
          ))}
          {incompleteTodos.length === 0 && (
            <div className="no-todos" style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              <p>All caught up!</p>
              <p style={{ fontSize: '12px' }}>No pending tasks to schedule</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
