import type { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import { supabase } from '@/lib/supabaseClient'

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })
  return res.json()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Expect POST with JSON body: { user_id: '...', eventIds?: ['id1','id2'] }
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')
  const { user_id, eventIds } = req.body || {}
  if (!user_id) return res.status(400).send('Missing user_id')

  // fetch tokens
  const { data: tokenRow, error: tErr } = await supabase.from('google_tokens').select('*').eq('user_id', user_id).single()
  if (tErr || !tokenRow) return res.status(400).json({ error: 'No tokens for user' })

  let accessToken = tokenRow.access_token
  // refresh if expired or missing
  if (!accessToken || new Date(tokenRow.expires_at) <= new Date()) {
    try {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token)
      if (refreshed.access_token) {
        accessToken = refreshed.access_token
        await supabase.from('google_tokens').update({
          access_token: refreshed.access_token,
          expires_at: new Date(Date.now() + (refreshed.expires_in || 0) * 1000).toISOString()
        }).eq('user_id', user_id)
      } else {
        console.error('Refresh failed', refreshed)
        return res.status(500).json({ error: 'Failed to refresh token' })
      }
    } catch (err) {
      console.error('Error refreshing token', err)
      return res.status(500).json({ error: 'Failed to refresh token' })
    }
  }

  // Fetch events from our events table
  const { data: events, error: eErr } = await supabase.from('events').select('*').eq('user_id', user_id)
  if (eErr) return res.status(500).json({ error: 'Failed to fetch events' })

  // Create events on the user's primary Google Calendar
  const created: any[] = []
  for (const ev of events || []) {
    const body: any = {
      summary: ev.title,
      description: ev.description || ev.title,
      start: { dateTime: new Date(ev.start_date).toISOString() },
      end: { dateTime: new Date(ev.end_date).toISOString() }
    }

    const gRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (gRes.ok) {
      const json = await gRes.json()
      created.push(json)
    } else {
      const text = await gRes.text()
      console.error('Failed to create event', text)
      // continue for other events
    }
  }

  res.json({ created })
}
