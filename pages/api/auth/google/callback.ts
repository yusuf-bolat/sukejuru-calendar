import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).send('Missing code or state')

  const stateStr = Array.isArray(state) ? state[0] : String(state)
  const codeStr = Array.isArray(code) ? code[0] : String(code)

  // look up state mapping to user
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set; callback may not be able to read state rows')
  }

  const { data: stateRow, error: sErr } = await supabaseServer.from('google_oauth_states').select('*').eq('state', stateStr).single()
  if (sErr || !stateRow) {
    console.error('Invalid oauth state; state lookup failed', sErr)
    // helpful diagnostic page to guide developer
    res.status(400).send(
      '<html><body style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:32px;color:#111">' +
      '<h2>Invalid state</h2>' +
      '<p>The <code>state</code> parameter returned by Google could not be found on the server. Possible causes:</p>' +
      '<ul>' +
      '<li>The server did not persist the state (missing <code>SUPABASE_SERVICE_ROLE_KEY</code> or DB error).</li>' +
      '<li>The auth request originated from a different server/process (state not shared).</li>' +
      '<li>The <code>state</code> parameter was modified.</li>' +
      '</ul>' +
      `<p>State value: <code>${stateStr}</code></p>` +
      '<p>Check your server logs (start endpoint) to confirm the state was inserted, and ensure the same Supabase project is used by both endpoints.</p>' +
      '</body></html>'
    )
    return
  }

  const doFetch = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default

  const tokenRes = await doFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codeStr,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
      grant_type: 'authorization_code'
    })
  })

  const tokenJson = await tokenRes.json()
  if (tokenJson.error) {
    console.error('Google token exchange error', tokenJson)
    return res.status(500).json(tokenJson)
  }

  // store tokens in DB associated with the user_id
  try {
    await supabaseServer.from('google_tokens').upsert({
      user_id: stateRow.user_id,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      scope: tokenJson.scope,
      token_type: tokenJson.token_type,
      expires_at: new Date(Date.now() + (tokenJson.expires_in || 0) * 1000).toISOString()
    }, { onConflict: 'user_id' })
  } catch (err) {
    console.error('Failed to persist tokens', err)
  }

  // cleanup state row
  try { await supabaseServer.from('google_oauth_states').delete().eq('state', state) } catch {}
  // return a small HTML page that notifies opener and closes the popup
  const userId = stateRow.user_id
  res.setHeader('Content-Type', 'text/html')
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Connected</title>
      </head>
      <body style="font-family:system-ui,Segoe UI,Roboto,Arial;margin:24px;">
        <p>Successfully connected. You can close this window.</p>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'google_connected', user_id: ${JSON.stringify(userId)} }, '*')
            }
          } catch (e) { }
          setTimeout(()=>{
            try { window.close() } catch(e) {}
          }, 600)
        </script>
      </body>
    </html>
  `)
}
