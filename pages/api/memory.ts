import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { role, content, session_id } = req.body
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'unauthenticated' })
  const { error } = await supabase.from('messages').insert({ user_id: user.id, role, content, session_id })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
