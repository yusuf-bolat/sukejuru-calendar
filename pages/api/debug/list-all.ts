import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' })
  }
  
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' })
  }

  try {
    // Get all events for this user
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, description, start_date, end_date')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })

    // Get all assignments for this user
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('id, title, course, description, due_date, completed')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true })

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
    }

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
    }

    return res.status(200).json({
      events: events || [],
      assignments: assignments || [],
      eventsCount: events?.length || 0,
      assignmentsCount: assignments?.length || 0,
      userId: user.id
    })

  } catch (error) {
    console.error('Database query error:', error)
    return res.status(500).json({ error: 'Database query failed' })
  }
}
