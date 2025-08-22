import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'

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

interface TaskFormData {
  title: string
  description: string
  category: string
  dueDate: string
  dueTime?: string
  priority: 'high' | 'medium' | 'low'
}

// Pie Chart Component
interface PieChartProps {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
  label?: string
  showPercentage?: boolean
}

// Todo Notification Service
class TodoNotificationService {
  private static instance: TodoNotificationService
  private notificationTimeouts: Set<NodeJS.Timeout> = new Set()
  private notifiedTasks: Set<string> = new Set()

  static getInstance(): TodoNotificationService {
    if (!TodoNotificationService.instance) {
      TodoNotificationService.instance = new TodoNotificationService()
    }
    return TodoNotificationService.instance
  }

  async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification")
      return false
    }

    if (Notification.permission === "granted") {
      return true
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission()
      return permission === "granted"
    }

    return false
  }

  playNotificationSound() {
    // Create audio context for notification sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create a simple beep sound
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  }

  getNotificationSchedule(priority: 'high' | 'medium' | 'low'): number[] {
    // Return minutes before due time
    switch (priority) {
      case 'high':
        return [1440, 300, 60, 30, 10] // 1 day, 5 hours, 1 hour, 30 min, 10 min
      case 'medium':
        return [300, 60, 10] // 5 hours, 1 hour, 10 min
      case 'low':
        return [120, 10] // 2 hours, 10 min
      default:
        return [10] // Default 10 min
    }
  }

  showNotification(task: Assignment, minutesUntilDue: number) {
    const dueDateObj = new Date(task.due_date)
    if (task.due_time) {
      const [hours, minutes] = task.due_time.split(':')
      dueDateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    }

    const timeStr = task.due_time ? 
      dueDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 
      dueDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    this.playNotificationSound()

    const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'
    const timePhrase = minutesUntilDue >= 1440 ? `${Math.floor(minutesUntilDue / 1440)} day(s)` :
                      minutesUntilDue >= 60 ? `${Math.floor(minutesUntilDue / 60)} hour(s)` :
                      `${minutesUntilDue} minute(s)`

    const title = `📝 Task Due in ${timePhrase}`
    const body = `${priorityEmoji} ${task.title}\nDue: ${timeStr}\nPriority: ${task.priority.toUpperCase()}\n${task.description || ''}`

    console.log(`🔔 Todo Notification: ${task.title} due in ${timePhrase}`)

    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: `${priorityEmoji} ${task.title}\nDue: ${timeStr}\nPriority: ${task.priority.toUpperCase()}`,
        icon: '/favicon.ico',
        tag: `todo-${task.id}-${minutesUntilDue}`,
        requireInteraction: task.priority === 'high',
        silent: false
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto-close after 10 seconds for medium/low priority, 30 seconds for high priority
      setTimeout(() => {
        notification.close()
      }, task.priority === 'high' ? 30000 : 10000)
    }
  }

  scheduleNotifications(tasks: Assignment[]) {
    // Clear existing timeouts
    this.cleanup()

    const now = new Date()

    tasks.forEach(task => {
      if (task.completed) return

      const dueDateObj = new Date(task.due_date)
      if (task.due_time) {
        const [hours, minutes] = task.due_time.split(':')
        dueDateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
      } else {
        // If no time specified, assume end of day (23:59)
        dueDateObj.setHours(23, 59, 0, 0)
      }

      const timeDiff = dueDateObj.getTime() - now.getTime()
      const totalMinutesUntilDue = Math.floor(timeDiff / (1000 * 60))

      if (totalMinutesUntilDue <= 0) return // Task is overdue

      const schedule = this.getNotificationSchedule(task.priority)

      schedule.forEach(minutesBefore => {
        const notificationTime = totalMinutesUntilDue - minutesBefore
        
        // Only schedule if notification time is in the future (positive)
        if (notificationTime > 0) {
          const timeoutMs = notificationTime * 60 * 1000
          const notificationKey = `${task.id}-${minutesBefore}`

          if (!this.notifiedTasks.has(notificationKey)) {
            const timeoutId = setTimeout(() => {
              this.showNotification(task, minutesBefore)
              this.notifiedTasks.add(notificationKey)
            }, timeoutMs)

            this.notificationTimeouts.add(timeoutId)

            const scheduleTime = new Date(now.getTime() + timeoutMs)
            console.log(`⏰ Scheduled todo notification for "${task.title}" (${task.priority} priority) in ${Math.round(timeoutMs / 1000)} seconds (${minutesBefore} min before due time) at ${scheduleTime.toLocaleString()}`)
          }
        }
      })
    })

    console.log(`📅 Scheduled notifications for ${tasks.filter(t => !t.completed).length} active tasks`)
  }

  cleanup() {
    this.notificationTimeouts.forEach(timeout => clearTimeout(timeout))
    this.notificationTimeouts.clear()
    this.notifiedTasks.clear()
  }

  clearAllNotifications() {
    this.cleanup()
  }
}

const PieChart: React.FC<PieChartProps> = ({ 
  percentage, 
  size = 60, 
  strokeWidth = 6, 
  color = '#4fc3f7',
  backgroundColor = '#333',
  label,
  showPercentage = true 
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      gap: '8px'
    }}>
      <div style={{ position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>
        {/* Percentage text */}
        {showPercentage && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            fontSize: size > 80 ? '14px' : '10px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {Math.round(percentage)}%
          </div>
        )}
      </div>
      {label && (
        <span style={{ 
          color: '#aaa', 
          fontSize: '12px', 
          textAlign: 'center',
          maxWidth: size + 20
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

export default function TodoList() {
  const [session, setSession] = useState<any>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showMoreDays, setShowMoreDays] = useState(false)
  const [extendedDaysCount, setExtendedDaysCount] = useState(7) // Base days to show
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
    dueTime: '',
    priority: 'medium'
  })
  const [todoNotificationService] = useState(() => TodoNotificationService.getInstance())
  const [todoNotificationsEnabled, setTodoNotificationsEnabled] = useState(false)
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

  // Handle todo notifications
  useEffect(() => {
    if (todoNotificationsEnabled && assignments.length > 0) {
      // Schedule notifications for all incomplete assignments with due dates
      const tasksToSchedule = assignments.filter(task => 
        !task.completed && 
        task.due_date && 
        new Date(task.due_date) > new Date()
      )

      todoNotificationService.scheduleNotifications(tasksToSchedule)
    } else {
      // Clear all scheduled notifications when disabled
      todoNotificationService.clearAllNotifications()
    }
  }, [todoNotificationsEnabled, assignments, todoNotificationService])

  const toggleTodoNotifications = async () => {
    if (!todoNotificationsEnabled) {
      // Request permission when enabling
      const permission = await todoNotificationService.requestPermission()
      if (permission) {
        setTodoNotificationsEnabled(true)
      } else {
        alert('Please allow notifications in your browser settings to receive todo reminders.')
      }
    } else {
      setTodoNotificationsEnabled(false)
    }
  }

  const toggleComplete = async (id: string, completed: boolean) => {
    await supabase
      .from('assignments')
      .update({ completed: !completed })
      .eq('id', id)
      .eq('user_id', session?.user.id)
    
    setAssignments(prev => {
      const updatedAssignments = prev.map(a => 
        a.id === id ? { ...a, completed: !completed } : a
      )
      
      // Reschedule notifications if enabled
      if (todoNotificationsEnabled) {
        const tasksToSchedule = updatedAssignments.filter(task => 
          !task.completed && 
          task.due_date && 
          new Date(task.due_date) > new Date()
        )
        todoNotificationService.scheduleNotifications(tasksToSchedule)
      }
      
      return updatedAssignments
    })
  }

  const deleteAssignment = async (id: string) => {
    if (confirm('Delete this assignment?')) {
      await supabase
        .from('assignments')
        .delete()
        .eq('id', id)
        .eq('user_id', session?.user.id)
      
      setAssignments(prev => {
        const updatedAssignments = prev.filter(a => a.id !== id)
        
        // Reschedule notifications if enabled
        if (todoNotificationsEnabled) {
          const tasksToSchedule = updatedAssignments.filter(task => 
            !task.completed && 
            task.due_date && 
            new Date(task.due_date) > new Date()
          )
          todoNotificationService.scheduleNotifications(tasksToSchedule)
        }
        
        return updatedAssignments
      })
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
        due_time: newTask.dueTime || null,
        course: newTask.category || 'General',
        type: 'manual',
        completed: false,
        priority: newTask.priority
      })
      .select()
      .single()
    
    if (!error && data) {
      setAssignments(prev => {
        const updatedAssignments = [...prev, data]
        
        // If notifications are enabled, schedule notifications for all tasks
        if (todoNotificationsEnabled) {
          const tasksToSchedule = updatedAssignments.filter(task => 
            !task.completed && 
            task.due_date && 
            new Date(task.due_date) > new Date()
          )
          todoNotificationService.scheduleNotifications(tasksToSchedule)
        }
        
        return updatedAssignments
      })
      setShowAddModal(false)
      setNewTask({
        title: '',
        description: '',
        category: '',
        dueDate: '',
        dueTime: '',
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

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return null
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
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

  const getNextClosestTask = () => {
    // Look up to 30 days ahead to find the next task
    for (let i = daysToShow; i <= 30; i++) {
      const dayAssignments = getAssignmentsForDay(i)
      if (dayAssignments.length > 0) {
        return {
          daysAway: i,
          assignments: dayAssignments,
          date: getDateString(i)
        }
      }
    }
    return null
  }

  // Progress calculation functions
  const getDayProgress = (daysFromToday: number) => {
    const targetDate = getDateString(daysFromToday)
    const allDayTasks = assignments.filter(a => 
      a.due_date.split('T')[0] === targetDate
    )
    const completedDayTasks = allDayTasks.filter(a => a.completed)
    
    if (allDayTasks.length === 0) return { percentage: 100, completed: 0, total: 0 }
    
    return {
      percentage: (completedDayTasks.length / allDayTasks.length) * 100,
      completed: completedDayTasks.length,
      total: allDayTasks.length
    }
  }

  const getWeekProgress = () => {
    let totalTasks = 0
    let completedTasks = 0
    
    // Get tasks for the next 7 days
    for (let i = 0; i < 7; i++) {
      const targetDate = getDateString(i)
      const dayTasks = assignments.filter(a => 
        a.due_date.split('T')[0] === targetDate
      )
      const dayCompleted = dayTasks.filter(a => a.completed)
      
      totalTasks += dayTasks.length
      completedTasks += dayCompleted.length
    }
    
    if (totalTasks === 0) return { percentage: 100, completed: 0, total: 0 }
    
    return {
      percentage: (completedTasks / totalTasks) * 100,
      completed: completedTasks,
      total: totalTasks
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return '#4caf50' // Green for complete
    if (percentage >= 80) return '#8bc34a'   // Light green for high progress
    if (percentage >= 60) return '#ffc107'   // Yellow for medium progress
    if (percentage >= 40) return '#ff9800'   // Orange for low progress
    return '#f44336' // Red for very low progress
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
        
        <div style={{ display: 'flex', gap: '16px', color: '#aaa', fontSize: '14px', flexWrap: 'wrap' }}>
          <span>📚 {assignment.course}</span>
          <span>🏷️ {assignment.type}</span>
          {assignment.due_time && (
            <span>🕐 {formatTime(assignment.due_time)}</span>
          )}
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
    const dayProgress = getDayProgress(daysFromToday)
    
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
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid #333', 
          paddingBottom: '12px'
        }}>
          <h3 style={{ 
            color: getDayColor(daysFromToday), 
            fontSize: '18px', 
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {getDayEmoji(daysFromToday)} {dayLabel}
            <span style={{ 
              color: '#aaa', 
              fontSize: '14px', 
              fontWeight: 'normal' 
            }}>
              ({dayAssignments.length} tasks)
            </span>
          </h3>
          
          {/* Day Progress Pie Chart */}
          {dayProgress.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart
                percentage={dayProgress.percentage}
                size={36}
                strokeWidth={4}
                color={getProgressColor(dayProgress.percentage)}
                backgroundColor="#333"
                showPercentage={false}
              />
              <span style={{ 
                color: '#aaa', 
                fontSize: '12px' 
              }}>
                {dayProgress.completed}/{dayProgress.total}
              </span>
            </div>
          )}
        </div>
        
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
  const daysToShow = extendedDaysCount

  // Function to find the next day with tasks
  const findNextDayWithTasks = (startDay: number, maxLookAhead: number = 30) => {
    for (let i = startDay; i <= startDay + maxLookAhead; i++) {
      if (getAssignmentsForDay(i).length > 0) {
        return i
      }
    }
    return null
  }

  // Function to extend the view to show more days with tasks
  const showMoreTaskDays = () => {
    const nextDayWithTasks = findNextDayWithTasks(extendedDaysCount, 30)
    if (nextDayWithTasks) {
      setExtendedDaysCount(nextDayWithTasks + 1) // Show up to and including that day
    }
  }

  // Function to reduce the view
  const showLessDays = () => {
    setExtendedDaysCount(Math.max(7, extendedDaysCount - 7)) // Reduce by 7 days, minimum 7
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'white', fontSize: '24px', fontWeight: '700' }}>
            📝 Assignment & Todo List
          </span>
        </div>
        <div className="app-title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Image 
            src="/sukejuru-logo.svg" 
            alt="sukejuru" 
            width={200} 
            height={60}
            style={{ color: 'white' }}
          />
        </div>
        <div className="user-info">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={toggleTodoNotifications}
              className={`notification-toggle ${todoNotificationsEnabled ? 'enabled' : 'disabled'}`}
              title={todoNotificationsEnabled ? "Disable todo notifications" : "Enable todo notifications"}
              style={{
                background: todoNotificationsEnabled ? '#4fc3f7' : '#424242',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.3s ease'
              }}
            >
              {todoNotificationsEnabled ? '🔔' : '🔕'}
              Todo Alerts
            </button>
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

        {/* Progress Overview Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          border: '1px solid #333'
        }}>
          <h3 style={{ 
            color: '#f2f2f2', 
            fontSize: '20px', 
            margin: '0 0 20px 0', 
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📊 Progress Overview
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '24px' 
          }}>
            {/* Today's Progress */}
            {(() => {
              const todayProgress = getDayProgress(0)
              return (
                <div style={{
                  background: 'rgba(79, 195, 247, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid rgba(79, 195, 247, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px'
                }}>
                  <PieChart
                    percentage={todayProgress.percentage}
                    size={80}
                    strokeWidth={8}
                    color={getProgressColor(todayProgress.percentage)}
                    backgroundColor="#333"
                  />
                  <div>
                    <h4 style={{ 
                      color: '#4fc3f7', 
                      margin: '0 0 8px 0', 
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      📅 Today's Tasks
                    </h4>
                    <p style={{ 
                      color: '#f2f2f2', 
                      margin: '0 0 4px 0', 
                      fontSize: '14px' 
                    }}>
                      {todayProgress.completed} / {todayProgress.total} completed
                    </p>
                    <p style={{ 
                      color: '#aaa', 
                      margin: 0, 
                      fontSize: '12px' 
                    }}>
                      {todayProgress.total === 0 
                        ? "No tasks scheduled for today! 🎉" 
                        : todayProgress.percentage === 100 
                          ? "All done! Great job! ✨"
                          : `${Math.round(todayProgress.percentage)}% complete`
                      }
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Week's Progress */}
            {(() => {
              const weekProgress = getWeekProgress()
              return (
                <div style={{
                  background: 'rgba(76, 175, 80, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px'
                }}>
                  <PieChart
                    percentage={weekProgress.percentage}
                    size={80}
                    strokeWidth={8}
                    color={getProgressColor(weekProgress.percentage)}
                    backgroundColor="#333"
                  />
                  <div>
                    <h4 style={{ 
                      color: '#4caf50', 
                      margin: '0 0 8px 0', 
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      📊 This Week
                    </h4>
                    <p style={{ 
                      color: '#f2f2f2', 
                      margin: '0 0 4px 0', 
                      fontSize: '14px' 
                    }}>
                      {weekProgress.completed} / {weekProgress.total} completed
                    </p>
                    <p style={{ 
                      color: '#aaa', 
                      margin: 0, 
                      fontSize: '12px' 
                    }}>
                      {weekProgress.total === 0 
                        ? "No tasks this week! 🏖️" 
                        : weekProgress.percentage === 100 
                          ? "Week completed! Amazing! 🏆"
                          : `${Math.round(weekProgress.percentage)}% complete`
                      }
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '24px', 
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flex: 1 }}>
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
                  fontSize: '14px',
                  height: '38px'
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
                  fontSize: '14px',
                  height: '38px'
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
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
                transition: 'all 0.3s ease',
                height: '38px'
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
                transition: 'all 0.3s ease',
                height: '38px'
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
            {(() => {
              const daysWithTasks = Array.from({ length: daysToShow }, (_, i) => {
                const dayAssignments = getAssignmentsForDay(i)
                // Only render day section if it has assignments
                return dayAssignments.length > 0 ? renderDaySection(i) : null
              }).filter(Boolean)

              // Show message if no tasks in current view
              if (daysWithTasks.length === 0) {
                const nextTask = getNextClosestTask()
                
                return (
                  <div className="card" style={{ textAlign: 'center', padding: '40px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                    <h3 style={{ color: '#4fc3f7', marginBottom: '8px' }}>No upcoming tasks!</h3>
                    <p style={{ color: '#aaa', marginBottom: nextTask ? '16px' : 0 }}>
                      You're all caught up for the next {daysToShow} days. Great job! 🚀
                    </p>
                    
                    {nextTask && (
                      <div style={{ 
                        background: '#2a2a2a', 
                        border: '1px solid #444', 
                        borderRadius: '8px', 
                        padding: '16px', 
                        marginTop: '16px' 
                      }}>
                        <h4 style={{ color: '#ffa726', margin: '0 0 8px 0', fontSize: '14px' }}>
                          📅 Next task in {nextTask.daysAway} days
                        </h4>
                        <p style={{ color: '#ccc', margin: '0 0 8px 0', fontSize: '12px' }}>
                          {new Date(nextTask.date + 'T00:00:00').toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {nextTask.assignments.slice(0, 3).map((assignment, idx) => (
                            <div key={idx} style={{ 
                              color: '#aaa', 
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{ 
                                background: getPriorityColor(assignment.priority), 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%',
                                flexShrink: 0
                              }}></span>
                              {assignment.title}
                            </div>
                          ))}
                          {nextTask.assignments.length > 3 && (
                            <div style={{ color: '#666', fontSize: '11px' }}>
                              +{nextTask.assignments.length - 3} more tasks
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }

              return daysWithTasks
            })()}

            {/* More/Less Buttons */}
            {(() => {
              const hasVisibleTasks = Array.from({ length: daysToShow }, (_, i) => i)
                .some(i => getAssignmentsForDay(i).length > 0)
              
              // Check if there are more tasks beyond current range
              const hasMoreTasks = findNextDayWithTasks(daysToShow, 30) !== null
              
              // Show buttons only if there are visible tasks or we can show more
              if (!hasVisibleTasks && !hasMoreTasks) return null
              
              return (
                <div style={{ 
                  textAlign: 'center', 
                  marginBottom: '24px',
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  {/* Show More Button */}
                  {hasMoreTasks && (
                    <button
                      onClick={showMoreTaskDays}
                      className="button-primary"
                      style={{ 
                        padding: '12px 24px',
                        background: '#4fc3f7',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      📅 Show More Days
                    </button>
                  )}
                  
                  {/* Show Less Button */}
                  {extendedDaysCount > 7 && (
                    <button
                      onClick={showLessDays}
                      className="button-primary"
                      style={{ 
                        padding: '12px 24px',
                        background: '#666',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      ← Show Less
                    </button>
                  )}
                </div>
              )
            })()}
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
                          
                          <div style={{ display: 'flex', gap: '16px', color: '#888', fontSize: '14px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            {assignment.course && assignment.course !== 'General' && (
                              <span>📚 {assignment.course}</span>
                            )}
                            <span>📅 Completed: {formatDate(assignment.due_date)}</span>
                            {assignment.due_time && (
                              <span>🕐 {formatTime(assignment.due_time)}</span>
                            )}
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

              {/* Due Date, Time & Priority Row */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {/* Due Date */}
                <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
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

                {/* Due Time */}
                <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                  <label style={{ 
                    color: '#e1e5e9', 
                    fontSize: '15px', 
                    fontWeight: '500',
                    marginBottom: '8px', 
                    display: 'block' 
                  }}>
                    Time <span style={{ color: '#888', fontWeight: '400' }}>(optional)</span>
                  </label>
                  <input
                    type="time"
                    value={newTask.dueTime}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueTime: e.target.value }))}
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
                <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
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
