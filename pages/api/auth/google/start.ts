import { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Expect a logged-in client to pass their user id as query param 'uid'
  const { uid } = req.query
  if (!uid || typeof uid !== 'string') {
    return res.status(400).send('Missing uid')
  }

  const state = randomBytes(12).toString('hex')

  // store mapping state -> user_id so callback can associate tokens
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY; cannot persist oauth state server-side')
    return res.status(500).send(`
      <html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:32px;color:#111">
        <h2>Server misconfiguration</h2>
        <p>Missing <code>SUPABASE_SERVICE_ROLE_KEY</code>. The server must be able to persist the OAuth state so the callback can verify it.</p>
        <p>Please add <code>SUPABASE_SERVICE_ROLE_KEY</code> to your <code>.env.local</code> and restart the dev server.</p>
      </body></html>
    `)
  }

  try {
    const { error: insertErr } = await supabaseServer.from('google_oauth_states').insert({ state, user_id: uid })
    if (insertErr) {
      console.error('Failed to insert oauth state', insertErr)
      return res.status(500).send(`Failed to persist oauth state: ${insertErr.message || String(insertErr)}`)
    }
    if (process.env.NODE_ENV !== 'production') console.log('Inserted oauth state:', state)
  } catch (err) {
    console.error('Failed to insert oauth state', err)
    return res.status(500).send(`Failed to persist oauth state: ${String(err)}`)
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
    response_type: 'code',
    scope: process.env.GOOGLE_CALENDAR_SCOPE || 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    // include select_account so Google shows the account chooser and "Use another account"
    prompt: 'select_account consent',
    state
  })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'

  if (!clientId) {
    // helpful error page rather than redirecting to an invalid Google URL
    res.status(500).send(`
      <html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:32px;color:#111">
        <h2>Google OAuth misconfiguration</h2>
        <p>Missing <code>GOOGLE_CLIENT_ID</code> environment variable. Please set <code>GOOGLE_CLIENT_ID</code> in your <code>.env.local</code> or in your deployment and restart the server.</p>
        <p>Example in <code>.env.local</code>:</p>
        <pre>GOOGLE_CLIENT_ID=311051722720-...apps.googleusercontent.com
GOOGLE_REDIRECT_URI=${redirectUri}</pre>
      </body></html>
    `)
    return
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  // Helpful dev log: print the auth URL (no secrets) so developers can verify redirect_uri and params
  if (process.env.NODE_ENV !== 'production') {
    console.log('Generated Google auth URL:', authUrl)
  }

  res.redirect(authUrl)
}
