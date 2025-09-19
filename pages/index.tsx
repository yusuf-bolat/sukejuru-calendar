import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import EventEditModal from '@/components/EventEditModal'
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
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const router = useRouter()

  const DEFAULT_EVENT_COLORS = {
  background: '#1976d2',
    border: '#1b5e20',
    text: '#ffffff'
  }

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

  // Initialize Draggable for todo items
  useEffect(() => {
    let draggable: any = null

    const initializeDraggable = () => {
      const todoContainer = document.getElementById('todo-list')
      if (todoContainer && !draggable && !todoContainer.classList.contains('fc-draggable-initialized')) {
        draggable = new Draggable(todoContainer, {
          itemSelector: '.draggable-todo',
          eventData: function(eventEl: HTMLElement) {
            const eventDataAttr = eventEl.getAttribute('data-event')
            if (eventDataAttr) {
              try { return JSON.parse(eventDataAttr) } catch { return null }
            }
            return {
              title: 'Dropped Todo',
              duration: '00:30:00',
              // Match blue palette used by the todo sidebar
              backgroundColor: '#1976d2'
            }
          }
        })
        // mark container so we don't double initialize
        todoContainer.classList.add('fc-draggable-initialized')
      }
    }

    // Try immediate initialization first
    initializeDraggable()

    // Fallback: MutationObserver watches for the #todo-list element when tabs are toggled
    const observer = new MutationObserver(() => {
      initializeDraggable()
      // if initialized, disconnect observer
      const todoContainer = document.getElementById('todo-list')
      if (todoContainer && todoContainer.classList.contains('fc-draggable-initialized')) {
        observer.disconnect()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // Safety timeout to attempt initialize after a short delay in case MutationObserver doesn't fire
    const fallback = setTimeout(() => initializeDraggable(), 1200)

    return () => {
      clearTimeout(fallback)
      try { observer.disconnect() } catch {}
      if (draggable) {
        try { draggable.destroy() } catch {}
      }
    }
  }, [session]) // Re-initialize when session changes

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
      
      const eventsList = (data||[]).map(e => ({
        id: String(e.id),
        title: e.title,
        start: e.start_date,
        end: e.end_date,
        backgroundColor: e.background_color || DEFAULT_EVENT_COLORS.background,
        extendedProps: { dbId: e.id, description: e.description || undefined }
      }))
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
      end_date: end,
      background_color: DEFAULT_EVENT_COLORS.background
    }).select('*').single()

    if (error) {
      console.error('createEvent error:', error)
      return null
    }

    if (data) {
      setEvents(prev => [...prev, {
        id: String(data.id),
        title,
        start,
        end,
        backgroundColor: data.background_color || DEFAULT_EVENT_COLORS.background,
        extendedProps: { dbId: data.id }
      }])
      return data
    }

    return null
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
    const dbId = (dropInfo.event.extendedProps as any)?.dbId ?? dropInfo.event.id
    const start = dropInfo.event.start?.toISOString()!
    const end = dropInfo.event.end?.toISOString()!
    try {
      const { data, error } = await supabase
        .from('events')
        .update({ start_date: start, end_date: end })
        .eq('id', dbId)
        .eq('user_id', session?.user.id)

      if (error) {
        console.error('Failed to update event on drop:', error)
        try { dropInfo.revert() } catch {}
        return
      }

      // Keep local state in sync with calendar
  setEvents(prev => prev.map(e => String(e.id) === String(dropInfo.event.id) ? ({ ...e, start, end }) : e))
    } catch (err) {
      console.error('Error in handleEventDrop:', err)
      try { dropInfo.revert() } catch {}
    }
  }
  
  const handleEventClick = async (clickInfo: EventClickArg) => {
    // open modal with event data
    const ev = clickInfo.event
    setEditingEvent({ id: ev.id, title: ev.title, start: ev.start?.toISOString(), end: ev.end?.toISOString(), extendedProps: ev.extendedProps })
  }

  const handleSaveEvent = async (updated: { id: string | number; dbId?: string | number; title: string; start: string; end: string; description?: string; backgroundColor?: string; borderColor?: string; textColor?: string }) => {
    // Attempt to update DB with color columns. If that fails (likely unknown columns),
    // retry with a minimal payload and still apply colors to the UI so user sees immediate result.
  const updatePayload: any = { title: updated.title, start_date: updated.start, end_date: updated.end }
  if (updated.backgroundColor) updatePayload.background_color = updated.backgroundColor

    try {
      const dbId = (updated as any).dbId ?? updated.id
      const { data, error } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', dbId)
        .eq('user_id', session?.user.id)
        .select('*')
        .single()

      if (error) {
        // If update failed, attempt fallback without color columns
        console.warn('Initial update failed, attempting fallback without color columns:', error)
        const fallbackPayload: any = { title: updated.title, start_date: updated.start, end_date: updated.end }
        const { error: fallbackError } = await supabase
          .from('events')
          .update(fallbackPayload)
          .eq('id', dbId)
          .eq('user_id', session?.user.id)

        if (fallbackError) {
          console.error('Fallback update also failed:', fallbackError)
          throw fallbackError
        }
      }

    // update local state (including backgroundColor if we have it)
  setEvents(prev => prev.map(e => String(e.id) === String(updated.id) ? ({ ...e, title: updated.title, start: updated.start, end: updated.end, backgroundColor: updated.backgroundColor ?? e.backgroundColor, extendedProps: { ...(e.extendedProps||{}), dbId } }) : e))

      // Do not mutate FullCalendar event directly; rely on controlled state above.
    } catch (e) {
      console.error('Failed to save event after fallback attempts:', e)
      // Rethrow so caller (modal) can show an error if both attempts failed
      throw e
    }
  }

  const handleDeleteEvent = async (id: string | number, dbIdParam?: string | number) => {
    try {
      const dbId = dbIdParam ?? id
      const { error } = await supabase.from('events').delete().eq('id', dbId).eq('user_id', session?.user.id)
      if (error) throw error
      setEvents(prev => prev.filter(e => String(e.id) !== String(id)))

      try { const api = calendarRef?.getApi(); api?.getEventById(String(id))?.remove() } catch {}
    } catch (e) {
      console.error('Failed to delete event:', e)
      throw e
    }
  }

  const handleConvertEventToTodo = async (event: { id: string | number; title?: string; start?: string; end?: string }) => {
    await convertEventToTodo({ id: String(event.id), title: event.title ?? '', start: event.start ?? '', end: event.end ?? '' })
  }

  // Handle external drop from todo
  const handleExternalDrop = async (info: any) => {
    const todoData = info.draggedEl?.dataset?.todo
    if (!todoData) return
    const assignment = JSON.parse(todoData)
    const start = info.date;
    const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
    await createEvent({ title: assignment.title, start: start.toISOString(), end: end.toISOString() })
  }

  // FullCalendar Draggable initialization is handled above to avoid duplicates

  // Handle eventReceive for external drops
  const handleEventReceive = async (info: any) => {
    try {
      console.log('handleEventReceive start', info?.draggedEl, info?.event && { title: info.event.title, start: info.event.start })
      const start = info.event.start;
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      // Get todo metadata from the dropped event
      const todoData = info.event.extendedProps?.todoData || {}

      // Create event via helper (use same safe path as manual create)
      const created = await createEvent({ title: info.event.title, start: start.toISOString(), end: end.toISOString() })
      if (!created) {
        console.error('createEvent failed during handleEventReceive')
        try { info.revert() } catch {}
        return
      }

      const newEvent = created

      // Update the received event in-place so FullCalendar keeps it visible
      try {
        if (info && info.event) {
          // set the DB id on the event so future operations can reference it
          info.event.setProp('id', String(newEvent.id))
          // try setting extended props if the column exists (not all schemas have it)
          try {
            if (newEvent.extended_props) {
              Object.keys(newEvent.extended_props).forEach(key => {
                try { info.event.setExtendedProp(key, newEvent.extended_props[key]) } catch {}
              })
            }
            // always set dbId for future operations
            try { info.event.setExtendedProp('dbId', newEvent.id) } catch {}
          } catch (e) {
            // ignore if extended_props column doesn't exist
          }
        }
      } catch (e) {
        console.warn('Could not update received event in-place', e)
      }

      // Add or replace the persisted event in local state
      setEvents(prev => {
        const exists = prev.some(e => String(e.id) === String(newEvent.id))
        const persisted = {
          id: String(newEvent.id),
          title: newEvent.title ?? info.event.title,
          start: newEvent.start_date ?? start.toISOString(),
          end: newEvent.end_date ?? end.toISOString(),
          // persisted color values for UI consistency
          backgroundColor: '#1976d2',
          extendedProps: { ...(newEvent.extended_props || {}), dbId: newEvent.id }
        }
        if (exists) {
          return prev.map(e => String(e.id) === String(newEvent.id) ? persisted : e)
        }
        return [...prev, { ...persisted }]
      })
    } catch (error) {
      console.error('Error handling dropped todo:', error)
      try { info.revert() } catch {}
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
      <Header />
      
      {/* Calendar-specific notification toggle removed per user request */}

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
                droppable={true}
                eventClick={(clickInfo) => {
                  handleEventClick(clickInfo)
                }}
                eventResizableFromStart={true}
                slotMinTime={slotMinTime}
                slotMaxTime="23:00:00"
                eventDidMount={(info) => {
                  try {
                    const el = info.el as HTMLElement
                    const anyEvent: any = info.event as any
                    const bg = anyEvent.backgroundColor || anyEvent.extendedProps?.backgroundColor
                    if (bg) {
                      el.style.setProperty('--fc-event-bg-color', bg)
                      el.style.backgroundColor = bg
                    }
                  } catch {}
                }}
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
                eventReceive={handleEventReceive}
              />
                {editingEvent && (
                  <EventEditModal
                    event={editingEvent}
                    onClose={() => setEditingEvent(null)}
                    onSave={async (updated) => { await handleSaveEvent({ ...updated, dbId: editingEvent?.extendedProps?.dbId ?? updated.id }) }}
                    onDelete={async (id) => { await handleDeleteEvent(id, editingEvent?.extendedProps?.dbId ?? id); }}
                  />
                )}
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
