import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

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
  
  const { optimized_blocks } = req.body as { optimized_blocks: any[] }
  
  if (!optimized_blocks || !Array.isArray(optimized_blocks)) {
    return res.status(400).json({ error: 'Invalid optimized_blocks data' })
  }

  try {
    // Convert optimized blocks to events format
    const events = optimized_blocks.map(block => {
      // Parse the suggested_time to create proper date/time
      const today = new Date()
      const [day, timeRange] = block.suggested_time.split(' ')
      const [startTime, endTime] = timeRange.split('-')
      
      // Simple time parsing (you might want to make this more robust)
      const [startHour, startMinPeriod] = startTime.trim().split(' ')
      let [startHourNum, startMin] = startHour.split(':').map(Number)
      if (!startMin) startMin = 0
      
      if (startMinPeriod === 'PM' && startHourNum !== 12) startHourNum += 12
      if (startMinPeriod === 'AM' && startHourNum === 12) startHourNum = 0
      
      const [endHour, endMinPeriod] = endTime.trim().split(' ')
      let [endHourNum, endMin] = endHour.split(':').map(Number)
      if (!endMin) endMin = 0
      
      if (endMinPeriod === 'PM' && endHourNum !== 12) endHourNum += 12
      if (endMinPeriod === 'AM' && endHourNum === 12) endHourNum = 0
      
      // Find the next occurrence of the specified day
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const targetDay = dayNames.indexOf(day)
      const currentDay = today.getDay()
      
      let daysUntilTarget = targetDay - currentDay
      if (daysUntilTarget <= 0) daysUntilTarget += 7 // Next week if day has passed
      
      const eventDate = new Date(today)
      eventDate.setDate(today.getDate() + daysUntilTarget)
      
      const startDate = new Date(eventDate)
      startDate.setHours(startHourNum, startMin, 0, 0)
      
      const endDate = new Date(eventDate)
      endDate.setHours(endHourNum, endMin, 0, 0)
      
      return {
        title: block.title,
        description: `Auto-scheduled: ${block.reason}`,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        all_day: false,
        color: '#4ade80', // Green color for optimized blocks
        user_id: user.id
      }
    })
    
    // Insert the optimized events
    const { data, error } = await supabase
      .from('events')
      .insert(events)
      .select('*')
    
    if (error) throw error
    
    return res.status(200).json({ 
      ok: true, 
      message: `Successfully created ${data.length} optimized schedule blocks`,
      events: data 
    })
    
  } catch (e: any) {
    console.error('Optimization application error:', e)
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}
