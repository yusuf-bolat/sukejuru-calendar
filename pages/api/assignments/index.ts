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

  if (req.method === 'POST') {
    // Create assignments
    const { assignments } = req.body
    
    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'Assignments must be an array' })
    }

    try {
      const assignmentsWithUserId = assignments.map(assignment => ({
        ...assignment,
        user_id: user.id,
        completed: false,
        created_at: new Date().toISOString()
      }))

      const { data, error } = await supabase
        .from('assignments')
        .insert(assignmentsWithUserId)
        .select()

      if (error) throw error

      return res.status(201).json({ assignments: data })
    } catch (error) {
      console.error('Error creating assignments:', error)
      return res.status(500).json({ error: 'Failed to create assignments' })
    }
  }

  if (req.method === 'GET') {
    // Get assignments
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true })

      if (error) throw error

      return res.status(200).json({ assignments: data })
    } catch (error) {
      console.error('Error fetching assignments:', error)
      return res.status(500).json({ error: 'Failed to fetch assignments' })
    }
  }

  if (req.method === 'PUT') {
    // Update assignment
    const { id, ...updates } = req.body
    
    try {
      const { data, error } = await supabase
        .from('assignments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({ assignment: data })
    } catch (error) {
      console.error('Error updating assignment:', error)
      return res.status(500).json({ error: 'Failed to update assignment' })
    }
  }

  if (req.method === 'DELETE') {
    // Delete assignment
    const { id } = req.body
    
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      return res.status(200).json({ success: true })
    } catch (error) {
      console.error('Error deleting assignment:', error)
      return res.status(500).json({ error: 'Failed to delete assignment' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
