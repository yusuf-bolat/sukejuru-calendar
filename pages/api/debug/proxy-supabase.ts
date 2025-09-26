import type { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET for this quick-debug endpoint
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' })
  }

  const query = req.query.q || "profiles?select=name,email&id=eq.162fa800-b203-4278-81c3-104c6d54ffbf"
  const url = `${supabaseUrl}/rest/v1/${query}`

  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Accept': 'application/json'
      }
    })

    const contentType = r.headers.get('content-type') || ''
    const body = await r.text()

    // Return the upstream status, headers (subset) and body to aid debugging
    return res.status(200).json({
      upstreamStatus: r.status,
      upstreamStatusText: r.statusText,
      upstreamContentType: contentType,
      upstreamBody: body
    })
  } catch (err: any) {
    return res.status(500).json({ error: String(err.message || err) })
  }
}
