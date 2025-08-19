// Supabase configuration
const SUPABASE_URL = 'https://kdexjrinhrybztzpegna.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkZXhqcmluaHJ5Ynp0enBlZ25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNjc2OTAsImV4cCI6MjA3MDg0MzY5MH0.k79YGH-5DZoEdyqNoIdHXYUUH3QhsNMeC9RKo_J7PE4'

class SupabaseAuth {
  constructor() {
    this.supabase = null
    this.currentUser = null
    this.initializeAsync()
  }

  async initializeAsync() {
    // Wait for Supabase CDN to be available
    while (!window.supabase) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Check for existing session
    const { data: { session } } = await this.supabase.auth.getSession()
    if (session?.user) {
      this.currentUser = session.user
    }

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.currentUser = session.user
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null
      }
    })
  }

  async waitForReady() {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds timeout
    
    while (!this.supabase && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++
    }
    
    if (!this.supabase) {
      throw new Error('Supabase failed to initialize within 5 seconds')
    }
  }

  async signUp(email, password, name, extra = {}) {
    await this.waitForReady()
    console.log('Starting signup process...')
    
    try {
      console.log('Calling Supabase signUp...')
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            program: extra.program || null,
            graduation_year: extra.graduation_year || null,
            university_name: extra.university_name || null
          }
        }
      })

      console.log('Supabase signUp response:', { data, error })

      if (error) {
        console.error('Supabase signup error:', error)
        throw error
      }

      console.log('Signup successful!')
      return {
        user: data.user,
        needsConfirmation: !data.session // true if email confirmation required
      }
    } catch (error) {
      console.error('Signup error:', error)
      throw new Error(error.message || 'Failed to create account')
    }
  }

  async signIn(email, password) {
    await this.waitForReady()
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      this.currentUser = data.user
      return data.user
    } catch (error) {
      console.error('Signin error:', error)
      throw new Error(error.message || 'Failed to sign in')
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()
      if (error) throw error
      
      this.currentUser = null
    } catch (error) {
      console.error('Signout error:', error)
      throw new Error('Failed to sign out')
    }
  }

  async getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser
    }

    const { data: { user } } = await this.supabase.auth.getUser()
    this.currentUser = user
    return user
  }

  async getUserProfile() {
    const user = await this.getCurrentUser()
    if (!user) return null

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  }

  isLoggedIn() {
    return this.currentUser !== null
  }

  // Calendar Events Methods
  async getEvents() {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching events:', error)
      throw new Error('Failed to load events')
    }
  }

  async createEvent(eventData) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    try {
      // Normalize to ISO and ensure end exists (default +1h)
      const startISO = new Date(eventData.start).toISOString()
      const endISO = eventData.end ? new Date(eventData.end).toISOString() : new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString()

      const { data, error } = await this.supabase
        .from('events')
        .insert([{
          user_id: user.id,
          title: eventData.title,
          description: eventData.description || '',
          start_date: startISO,
          end_date: endISO,
          all_day: eventData.allDay || false,
          color: eventData.backgroundColor || '#3788d8'
        }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating event:', error)
      throw new Error('Failed to create event')
    }
  }

  async updateEvent(eventId, eventData) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    try {
      // Normalize to ISO and ensure end exists (default +1h)
      const startISO = new Date(eventData.start).toISOString()
      const endISO = eventData.end ? new Date(eventData.end).toISOString() : new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString()

      const { data, error } = await this.supabase
        .from('events')
        .update({
          title: eventData.title,
          description: eventData.description,
          start_date: startISO,
          end_date: endISO,
          all_day: eventData.allDay,
          color: eventData.backgroundColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating event:', error)
      throw new Error('Failed to update event')
    }
  }

  async deleteEvent(eventId) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    try {
      const { error } = await this.supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', user.id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting event:', error)
      throw new Error('Failed to delete event')
    }
  }

  async deleteAllEvents() {
    await this.waitForReady()
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')

    try {
      const { error } = await this.supabase
        .from('events')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting all events:', error)
      throw new Error('Failed to delete all events')
    }
  }

  // Real-time subscription for events
  subscribeToEvents(callback) {
    const user = this.currentUser
    if (!user) return null

    return this.supabase
      .channel('events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        callback
      )
      .subscribe()
  }

  // User Memory Methods
  async getMemory() {
    await this.waitForReady()
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    try {
      const { data, error } = await this.supabase
        .from('user_memory')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = No rows
      return data || { user_id: user.id, summary_json: { activities: [] } }
    } catch (e) {
      console.error('getMemory error:', e)
      return { user_id: user.id, summary_json: { activities: [] } }
    }
  }

  async upsertMemory(summaryJson) {
    await this.waitForReady()
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Not authenticated')
    const payload = {
      user_id: user.id,
      summary_json: summaryJson,
      updated_at: new Date().toISOString()
    }
    const { data, error } = await this.supabase
      .from('user_memory')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    return data
  }

  // Infer simple activities from events and update memory
  async updateMemoryFromEvents() {
    try {
      const events = await this.getEvents()
      const activities = []
      const addAct = (type, name, schedule) => {
        // dedupe by type+name
        if (!activities.some(a => a.type === type && a.name === name)) {
          activities.push({ type, name, schedule })
        }
      }
      for (const ev of events) {
        const title = (ev.title || '').toLowerCase()
        const start = new Date(ev.start_date)
        const end = new Date(ev.end_date)
        const schedule = {
          weekday: start.toLocaleDateString(undefined, { weekday: 'long' }),
          start: start.toTimeString().slice(0,5),
          end: end.toTimeString().slice(0,5)
        }
        if (/job|shift|work|part\s*time/i.test(title)) addAct('job', ev.title, schedule)
        if (/club|society/i.test(title)) addAct('club', ev.title, schedule)
        if (/gym|fitness|workout|practice|training/i.test(title)) addAct('fitness', ev.title, schedule)
        // heuristic for courses: short code pattern like ABC123 or words like Lecture/Exercise
        if (/lecture|exercise|seminar|tutorial|lab/i.test(title) || /[A-Z]{2,}\d{2,}/.test(ev.title)) {
          addAct('course', ev.title, schedule)
        }
      }
      const memory = await this.getMemory()
      memory.summary_json = { activities }
      await this.upsertMemory(memory.summary_json)
      return memory.summary_json
    } catch (e) {
      console.warn('updateMemoryFromEvents failed:', e)
      return null
    }
  }
}

// Global auth instance
window.authSystem = new SupabaseAuth()
