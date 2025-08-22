import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

// Applies CRUD changes safely using supabase-js (no raw SQL execution).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
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
  
  const { action, events, criteria } = req.body as { action: string, events?: any[], criteria?: any }

  try {
    if (action === 'create' || action === 'bulk-create') {
      const payload = events?.map(e => ({
        title: e.title,
        description: e.description ?? null,
        start_date: e.start_date,
        end_date: e.end_date,
        all_day: e.all_day ?? false,
        color: e.color ?? '#3788d8',
        user_id: user.id
      })) || []
      const { data, error } = await supabase.from('events').insert(payload).select('*')
      if (error) throw error
      return res.status(200).json({ ok: true, inserted: data?.length || 0 })
    }

    if (action === 'update') {
      const e = events?.[0]
      const id = e?.criteria?.id || e?.id
      if (!id) return res.status(400).json({ error: 'missing id for update' })
      const { data, error } = await supabase.from('events').update({
        title: e.title,
        description: e.description,
        start_date: e.start_date,
        end_date: e.end_date,
        all_day: e.all_day,
        color: e.color
      }).eq('id', id).eq('user_id', user.id).select('*').single()
      if (error) throw error
      return res.status(200).json({ ok: true, event: data })
    }

    if (action === 'delete') {
      const eventId = events?.[0]?.id || events?.[0]?.criteria?.id
      if (!eventId) return res.status(400).json({ error: 'missing event id' })
      const { error } = await supabase.from('events').delete().eq('id', eventId).eq('user_id', user.id)
      if (error) throw error
      return res.status(200).json({ ok: true, deleted: 1 })
    }

    if (action === 'bulk-delete') {
      let query = supabase.from('events').delete().eq('user_id', user.id)
      
      // Apply filters based on criteria
      if (criteria?.title_contains) {
        query = query.ilike('title', `%${criteria.title_contains}%`)
      }
      
      if (criteria?.exact_title) {
        query = query.eq('title', criteria.exact_title)
      }
      
      if (criteria?.date_range) {
        if (criteria.date_range.start) {
          query = query.gte('start_date', criteria.date_range.start)
        }
        if (criteria.date_range.end) {
          // Add time to end date to include the entire day
          const endDate = new Date(criteria.date_range.end)
          endDate.setHours(23, 59, 59, 999)
          query = query.lte('start_date', endDate.toISOString())
        }
      }
      
      // For days filtering, we need to get events first then filter by day of week
      if (criteria?.days && criteria.days.length > 0) {
        const dayMap: Record<string, number> = {
          'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
          'thursday': 4, 'friday': 5, 'saturday': 6
        }
        
        // First get all events that match other criteria
        let selectQuery = supabase.from('events').select('id, start_date').eq('user_id', user.id)
        
        if (criteria.title_contains) {
          selectQuery = selectQuery.ilike('title', `%${criteria.title_contains}%`)
        }
        if (criteria.exact_title) {
          selectQuery = selectQuery.eq('title', criteria.exact_title)
        }
        if (criteria.date_range?.start) {
          selectQuery = selectQuery.gte('start_date', criteria.date_range.start)
        }
        if (criteria.date_range?.end) {
          const endDate = new Date(criteria.date_range.end)
          endDate.setHours(23, 59, 59, 999)
          selectQuery = selectQuery.lte('start_date', endDate.toISOString())
        }
        
        const { data: eventsToCheck, error: selectError } = await selectQuery
        if (selectError) throw selectError
        
        // Filter by days of week
        const targetDays = criteria.days.map((day: string) => dayMap[day.toLowerCase()]).filter((d: number) => d !== undefined)
        const eventIdsToDelete = eventsToCheck?.filter(event => {
          const eventDay = new Date(event.start_date).getDay()
          return targetDays.includes(eventDay)
        }).map(event => event.id) || []
        
        if (eventIdsToDelete.length === 0) {
          return res.status(200).json({ ok: true, deleted: 0 })
        }
        
        const { error } = await supabase.from('events').delete().in('id', eventIdsToDelete)
        if (error) throw error
        return res.status(200).json({ ok: true, deleted: eventIdsToDelete.length })
      }
      
      // Execute the delete query
      const { error, count } = await query
      if (error) throw error
      return res.status(200).json({ ok: true, deleted: count || 0 })
    }

    return res.status(400).json({ error: 'unknown action' })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
