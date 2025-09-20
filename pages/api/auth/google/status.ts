import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { uid } = req.query
  if (!uid || typeof uid !== 'string') return res.status(400).json({ error: 'Missing uid' })

  try {
    const { data, error } = await supabaseServer.from('google_tokens').select('access_token,refresh_token,expires_at').eq('user_id', uid).single()
    if (error) {
      // no row found => not connected
      return res.status(200).json({ connected: false })
    }

    const expiresAt = data?.expires_at ? new Date(data.expires_at).toISOString() : null
    return res.status(200).json({ connected: true, expires_at: expiresAt })
  } catch (err) {
    console.error('Status check error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
