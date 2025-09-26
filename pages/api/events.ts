import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('events').select('*').order('start_date', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ events: data })
  }

  if (req.method === 'POST') {
    const { title, start_date, end_date, description, all_day, color, extended_props, background_color } = req.body

    // Insert using the authenticated user id
    const payload: any = {
      title,
      start_date: start_date ? new Date(start_date).toISOString() : null,
      end_date: end_date ? new Date(end_date).toISOString() : null,
      description: description || null,
      all_day: !!all_day,
      color: color || null,
      background_color: background_color || null,
      extended_props: extended_props || null,
      user_id: user.id
    }

    const { data, error } = await supabase.from('events').insert(payload).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    // normalize returned dates
    if (data) {
      data.start_date = data.start_date ? new Date(data.start_date).toISOString() : null
      data.end_date = data.end_date ? new Date(data.end_date).toISOString() : null
    }
    return res.status(200).json({ event: data })
  }

  if (req.method === 'PUT') {
    const { id, ...rest } = req.body
    const { data, error } = await supabase.from('events').update(rest).eq('id', id).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ event: data })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
