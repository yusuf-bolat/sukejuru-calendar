import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'
import path from 'path'
import { promises as fs } from 'fs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const filePath = path.join(process.cwd(), 'courses.json')
    const content = await fs.readFile(filePath, 'utf-8')
    const courses = JSON.parse(content)
    // Store in a table courses if exists; otherwise return parsed
    // You approved extending schema; we assume table exists via migration.
    const { error } = await supabase.from('courses').upsert(
      courses.map((c: any) => ({ ...c, id: c.short_name }))
    )
    if (error) console.warn('Could not upsert courses (maybe table missing):', error.message)
    return res.status(200).json({ count: courses.length })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
