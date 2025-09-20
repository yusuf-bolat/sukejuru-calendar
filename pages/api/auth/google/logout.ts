import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { uid } = req.query
  if (!uid || typeof uid !== 'string') {
    return res.status(400).json({ error: 'Missing uid' })
  }

  try {
    const { data, error } = await supabase.from('google_tokens').select('*').eq('user_id', uid).single()
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = No rows found; still proceed to return success
      console.error('Supabase select error', error)
      return res.status(500).json({ error: 'Failed to query tokens' })
    }

    const tokenRow: any = data

    // Revoke refresh token if present (recommended) else revoke access_token
    const tokenToRevoke = tokenRow?.refresh_token || tokenRow?.access_token
    if (tokenToRevoke) {
      try {
        // Use global fetch when available (Node 18+ / Vercel). Fallback to dynamic import of node-fetch.
        const doFetch = typeof fetch === 'function'
          ? fetch
          : (await import('node-fetch')).default

        await doFetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: 'POST',
          headers: { 'Content-type': 'application/x-www-form-urlencoded' }
        })
      } catch (err) {
        console.warn('Failed to call Google revoke endpoint', err)
      }
    }

    // Delete tokens row from DB
    const { error: delErr } = await supabase.from('google_tokens').delete().eq('user_id', uid)
    if (delErr) {
      console.error('Failed to delete tokens', delErr)
      return res.status(500).json({ error: 'Failed to delete tokens' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Logout error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
