import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import Link from 'next/link'
import Image from 'next/image'
import { TabPanel } from '@/components/TabPanel'
import { TodoPanel } from '@/components/TodoPanel'
import { useRouter } from 'next/router'

// Notification Service
class EventNotificationService {
  private static instance: EventNotificationService
  private notificationTimeouts: Set<number> = new Set()
  private notifiedEvents: Set<string> = new Set()

  static getInstance(): EventNotificationService {
    if (!EventNotificationService.instance) {
      EventNotificationService.instance = new EventNotificationService()
    }
    return EventNotificationService.instance
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
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // 800Hz frequency
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
    
    // Play a second beep
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator()
      const gainNode2 = audioContext.createGain()
      
      oscillator2.connect(gainNode2)
      gainNode2.connect(audioContext.destination)
      
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime)
      oscillator2.type = 'sine'
      
      gainNode2.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode2.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
      gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3)
      
      oscillator2.start(audioContext.currentTime)
      oscillator2.stop(audioContext.currentTime + 0.3)
    }, 400)
  }

  showNotification(event: EventInput, minutesUntil: number) {
    const eventId = `${event.id}_${event.start}`
    
    if (this.notifiedEvents.has(eventId)) {
      return // Already notified for this event
    }

    this.notifiedEvents.add(eventId)
    
    const title = `📅 Upcoming Event in ${minutesUntil} minutes`
    const body = `${event.title}\n${event.extendedProps?.description || ''}`
    const startTime = new Date(event.start as string).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

    // Play notification sound
    this.playNotificationSound()

    // Show browser notification
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body: `${event.title}\nTime: ${startTime}\n${event.extendedProps?.description || ''}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: true
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000)
    }

    console.log(`🔔 Notification: ${event.title} starts in ${minutesUntil} minutes at ${startTime}`)
  }

  scheduleNotifications(events: EventInput[]) {
    // Clear existing timeouts
    this.notificationTimeouts.forEach(timeout => clearTimeout(timeout))
    this.notificationTimeouts.clear()

    const now = new Date()

    events.forEach(event => {
      if (!event.start) return

      const eventStart = new Date(event.start as string)
      const notificationTime = new Date(eventStart.getTime() - 10 * 60 * 1000) // 10 minutes before
      const minutesUntilEvent = Math.round((eventStart.getTime() - now.getTime()) / (1000 * 60))
      const eventKey = `${event.id}_${event.start}`

      // Only process events that are in the future and within the next 24 hours
      const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      if (eventStart <= now || hoursUntilEvent > 24) {
        return // Skip past events or events more than 24 hours away
      }

      // Check if event is starting in exactly 10 minutes (within 1 minute tolerance)
      if (minutesUntilEvent >= 9 && minutesUntilEvent <= 11) {
        // Only show notification if we haven't already notified for this event
        if (!this.notifiedEvents.has(eventKey)) {
          this.showNotification(event, minutesUntilEvent)
          console.log(`🔔 Immediate notification for "${event.title}" starting in ${minutesUntilEvent} minutes (${eventStart.toLocaleString()})`)
        }
      }
      // Schedule future notifications for events within next 24 hours
      else if (notificationTime > now) {
        const timeoutMs = notificationTime.getTime() - now.getTime()

        // Only schedule if timeout is reasonable (not too far in the future)
        if (timeoutMs <= 24 * 60 * 60 * 1000) { // Max 24 hours
          const timeoutId = setTimeout(() => {
            // Double-check the timing when the timeout fires
            const currentTime = new Date()
            const currentMinutesUntil = Math.round((eventStart.getTime() - currentTime.getTime()) / (1000 * 60))
            if (currentMinutesUntil >= 9 && currentMinutesUntil <= 11) {
              this.showNotification(event, currentMinutesUntil)
            }
          }, timeoutMs)

          this.notificationTimeouts.add(Number(timeoutId))

          console.log(`⏰ Scheduled notification for "${event.title}" in ${Math.round(timeoutMs / 1000)} seconds (event at ${eventStart.toLocaleString()})`)
        }
      }
    })

    // Set up a recurring check every minute to catch any events starting in 10 minutes
    const recurringCheckId = setInterval(() => {
      this.checkUpcomingEvents(events)
    }, 60000) // Check every minute

    this.notificationTimeouts.add(recurringCheckId as any)
  }

  private checkUpcomingEvents(events: EventInput[]) {
    const now = new Date()
    
    events.forEach(event => {
      if (!event.start) return

      const eventStart = new Date(event.start as string)
      const minutesUntilEvent = Math.round((eventStart.getTime() - now.getTime()) / (1000 * 60))
      const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60)

      // Only process events that are in the future and within the next 24 hours
      if (eventStart <= now || hoursUntilEvent > 24) {
        return // Skip past events or events more than 24 hours away
      }

      // Check if event is starting in exactly 10 minutes (within 1 minute tolerance)
      if (minutesUntilEvent >= 9 && minutesUntilEvent <= 11) {
        const eventKey = `${event.id}_${event.start}`
        
        // Only show notification if we haven't already notified for this event
        if (!this.notifiedEvents.has(eventKey)) {
          this.showNotification(event, minutesUntilEvent)
          console.log(`🔔 Recurring check notification for "${event.title}" starting in ${minutesUntilEvent} minutes (${eventStart.toLocaleString()})`)
        }
      }
    })
  }

  cleanup() {
    this.notificationTimeouts.forEach(timeout => clearTimeout(timeout))
    this.notificationTimeouts.clear()
    this.notifiedEvents.clear()
  }
}

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [profileName, setProfileName] = useState<string>('')
  const [events, setEvents] = useState<EventInput[]>([])
  const [loading, setLoading] = useState(true)
  const [slotMinTime, setSlotMinTime] = useState<string>('08:00:00')
  const [notificationService] = useState(() => EventNotificationService.getInstance())
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [currentView, setCurrentView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('timeGridWeek')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [calendarRef, setCalendarRef] = useState<any>(null)
  const router = useRouter()

  // Handle window resize for calendar
  useEffect(() => {
    const handleResize = () => {
      if (calendarRef) {
        // Force FullCalendar to recalculate its size
        setTimeout(() => {
          calendarRef.getApi().updateSize()
        }, 100)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calendarRef])

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

  // Initialize notifications
  useEffect(() => {
    const initializeNotifications = async () => {
      const hasPermission = await notificationService.requestPermission()
      setNotificationsEnabled(hasPermission)
      
      if (hasPermission) {
        console.log('🔔 Notifications enabled')
      } else {
        console.log('🔇 Notifications disabled or not supported')
      }
    }

    initializeNotifications()

    // Cleanup on unmount
    return () => {
      notificationService.cleanup()
    }
  }, [notificationService])

  // Schedule notifications when events change
  useEffect(() => {
    if (events.length > 0 && notificationsEnabled) {
      notificationService.scheduleNotifications(events)
    }
  }, [events, notificationsEnabled, notificationService])

  // Periodic notification refresh (every minute)
  useEffect(() => {
    if (!notificationsEnabled) return

    const refreshInterval = setInterval(() => {
      if (events.length > 0) {
        notificationService.scheduleNotifications(events)
      }
    }, 60000) // Refresh every minute

    return () => clearInterval(refreshInterval)
  }, [events, notificationsEnabled, notificationService])

  useEffect(() => {
    const load = async () => {
      if (!session?.user) return
      // profile name
      const { data: prof } = await supabase.from('profiles').select('name, email').eq('id', session.user.id).single()
      setProfileName(prof?.name || session.user.email)
      // events - filter by user_id for security
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', session.user.id)
        .order('start_date', { ascending: true })
      
      const eventsList = (data||[]).map(e => ({ id: e.id, title: e.title, start: e.start_date, end: e.end_date }))
      setEvents(eventsList)

      // Calculate earliest event time for calendar display
      if (eventsList.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        const futureEvents = eventsList.filter(e => e.start >= today)
        
        if (futureEvents.length > 0) {
          // Find the earliest start time among all events
          const earliestTime = futureEvents.reduce((earliest, event) => {
            const eventTime = new Date(event.start).getHours()
            return Math.min(earliest, eventTime)
          }, 24) // Start with 24 (impossible hour) to find minimum
          
          // Don't start earlier than 6 AM for readability
          const startHour = Math.max(6, Math.min(earliestTime, 8))
          setSlotMinTime(`${startHour.toString().padStart(2, '0')}:00:00`)
        } else {
          // No future events, default to 8 AM
          setSlotMinTime('08:00:00')
        }
      } else {
        // No events at all, default to 8 AM
        setSlotMinTime('08:00:00')
      }
    }
    load()
    const onReload = () => load()
    window.addEventListener('calendar:reload', onReload)
    return () => window.removeEventListener('calendar:reload', onReload)
  }, [session])

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const title = prompt('New event title?')
    if (!title) return
    const start = selectInfo.startStr
    const end = selectInfo.endStr
    createEvent({ title, start, end })
  }

  const createEvent = async ({ title, start, end }: { title: string, start: string, end: string}) => {
    const { data, error } = await supabase.from('events').insert({
      user_id: session?.user.id,
      title,
      start_date: start,
      end_date: end
    }).select('*').single()
    if (!error && data) setEvents(prev => [...prev, { id: data.id, title, start, end }])
  }

  // Convert calendar event to todo item
  const convertEventToTodo = async (event: EventInput) => {
    try {
      if (!session) return

      const eventStart = new Date(event.start as string)
      const dueDate = eventStart.toISOString().split('T')[0]
      const dueTime = eventStart.toTimeString().split(' ')[0].slice(0, 5)

      const todoData = {
        title: event.title as string,
        description: `Converted from calendar event: ${event.title}`,
        due_date: dueDate,
        due_time: dueTime,
        course: 'General',
        type: 'task',
        priority: 'medium' as const,
        user_id: session.user.id,
        completed: false
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert(todoData)
        .select('*')
        .single()

      if (error) {
        console.error('Error converting event to todo:', error)
        alert('Failed to convert event to todo')
      } else {
        console.log('Event converted to todo:', data)
        alert('Event successfully converted to todo!')
        
        // Trigger todo panel refresh by dispatching custom event
        window.dispatchEvent(new CustomEvent('todo:refresh'))
      }
    } catch (error) {
      console.error('Error converting event to todo:', error)
      alert('Failed to convert event to todo')
    }
  }
  
  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { id } = dropInfo.event
    const start = dropInfo.event.start?.toISOString()!
    const end = dropInfo.event.end?.toISOString()!
    await supabase.from('events').update({ start_date: start, end_date: end }).eq('id', id).eq('user_id', session?.user.id)
  }
  
  const handleEventClick = async (clickInfo: EventClickArg) => {
    if (confirm(`Delete event '${clickInfo.event.title}'?`)) {
      await supabase.from('events').delete().eq('id', clickInfo.event.id).eq('user_id', session?.user.id)
      setEvents(prev => prev.filter(e => e.id !== clickInfo.event.id))
    }
  }

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  // Redirect handled by useEffect, show loading state
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Redirecting to login...</div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'white', fontSize: '24px', fontWeight: '700' }}>
            📅 Student Calendar
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
            {/* Notification Toggle */}
            <button
              onClick={async () => {
                if (!notificationsEnabled) {
                  const hasPermission = await notificationService.requestPermission()
                  setNotificationsEnabled(hasPermission)
                  if (hasPermission && events.length > 0) {
                    notificationService.scheduleNotifications(events)
                  }
                } else {
                  notificationService.cleanup()
                  setNotificationsEnabled(false)
                }
              }}
              className={`nav-btn ${notificationsEnabled ? 'notification-enabled' : 'notification-disabled'}`}
              title={notificationsEnabled ? 'Notifications ON - Click to disable' : 'Notifications OFF - Click to enable'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px'
              }}
            >
              {notificationsEnabled ? '🔔' : '🔇'}
              <span style={{ fontSize: '13px' }}>{notificationsEnabled ? 'ON' : 'OFF'}</span>
            </button>
            
            <Link href="/courses" className="nav-btn">
              📚 Courses
            </Link>
            <Link href="/todo" className="nav-btn">
              📝 Todo
            </Link>
            <Link href="/profile" className="nav-btn">
              Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div id="main-layout">
          <div id="calendar-section">
            <div id="calendar">
              <FullCalendar
                ref={setCalendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                firstDay={1}
                timeZone="local"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                selectable={true}
                selectMirror={true}
                select={handleDateSelect}
                events={events}
                height="100%"
                editable={!!session}
                slotDuration="01:00:00"
                slotLabelInterval="01:00:00"
                eventDrop={handleEventDrop}
                eventClick={(clickInfo) => {
                  const action = prompt(
                    `What would you like to do with "${clickInfo.event.title}"?\n\n` +
                    `1. Delete event (type "delete")\n` +
                    `2. Convert to todo (type "todo")\n` +
                    `3. Cancel (press Cancel or leave blank)`
                  )
                  
                  if (action?.toLowerCase() === 'delete') {
                    handleEventClick(clickInfo)
                  } else if (action?.toLowerCase() === 'todo') {
                    convertEventToTodo({
                      id: clickInfo.event.id,
                      title: clickInfo.event.title,
                      start: clickInfo.event.start?.toISOString(),
                      end: clickInfo.event.end?.toISOString()
                    })
                  }
                }}
                eventResizableFromStart={true}
                slotMinTime={slotMinTime}
                slotMaxTime="23:00:00"
                viewDidMount={(viewInfo) => {
                  setCurrentView(viewInfo.view.type as 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay')
                  setCurrentDate(viewInfo.view.currentStart)
                }}
                datesSet={(dateInfo) => {
                  setCurrentDate(dateInfo.start)
                }}
                dateClick={(dateInfo) => {
                  setSelectedDate(dateInfo.date)
                }}
              />
            </div>
          </div>
          
          {/* Tabs panel on the right */}
          <div id="sidebar-tabs">
            <TabPanel 
              view={currentView} 
              currentDate={currentDate} 
              selectedDate={selectedDate} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
