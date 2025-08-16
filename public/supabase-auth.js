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

  async signUp(email, password, name) {
    await this.waitForReady()
    console.log('Starting signup process...')
    
    try {
      console.log('Calling Supabase signUp...')
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
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
}

// Global auth instance
window.authSystem = new SupabaseAuth()
