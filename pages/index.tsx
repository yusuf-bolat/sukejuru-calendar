import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import Link from 'next/link'
import { ChatPanel } from '@/components/ChatPanel'
import { useRouter } from 'next/router'

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [profileName, setProfileName] = useState<string>('')
  const [events, setEvents] = useState<EventInput[]>([])
  const [loading, setLoading] = useState(true)
  const [slotMinTime, setSlotMinTime] = useState<string>('08:00:00')
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
        <h1 className="app-title">📅 Student Calendar</h1>
        <div className="user-info">
          <span className="user-welcome">
            Welcome, <span className="user-name">{profileName}</span>!
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/todo" className="nav-btn">
              📝 Todo
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

      <div className="main-content">
        <div id="main-layout">
          <div id="calendar">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              firstDay={1}
              timeZone="local"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              selectable={true}
              selectMirror={true}
              select={handleDateSelect}
              events={events}
              height="80vh"
              editable={!!session}
              eventDrop={handleEventDrop}
              eventClick={handleEventClick}
              eventResizableFromStart={true}
              slotMinTime={slotMinTime}
              slotMaxTime="23:00:00"
            />
          </div>
          <ChatPanel />
        </div>
      </div>

      <div className="site-footer">
        <span>© 2025 Student Calendar • </span>
        <a href="#" target="_blank" rel="noopener">Privacy Policy</a>
      </div>
    </div>
  )
}
