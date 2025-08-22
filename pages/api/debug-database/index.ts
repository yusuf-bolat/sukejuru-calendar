import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const results: {
    userId: string
    tests: Array<{
      test: string
      status: string
      error?: string
      data?: string
      payload?: any
    }>
  } = {
    userId: user.id,
    tests: []
  }

  try {
    // Test 1: Can we access assignments table?
    results.tests.push({ test: 'assignments_table_access', status: 'running' })
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id')
        .limit(1)
      
      if (error) {
        results.tests[results.tests.length - 1] = {
          test: 'assignments_table_access',
          status: 'failed',
          error: error.message
        }
      } else {
        results.tests[results.tests.length - 1] = {
          test: 'assignments_table_access',
          status: 'passed',
          data: `Found ${data?.length || 0} existing assignments`
        }
      }
    } catch (err) {
      results.tests[results.tests.length - 1] = {
        test: 'assignments_table_access',
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }

    // Test 2: Can we insert assignment?
    results.tests.push({ test: 'assignment_insert', status: 'running' })
    try {
      const testAssignment = {
        user_id: user.id,
        title: 'Debug Test Assignment',
        description: 'Test assignment for debugging',
        due_date: '2025-08-25',
        course: 'Debug Course',
        type: 'test',
        completed: false,
        priority: 'low'
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert(testAssignment)
        .select()
        .single()

      if (error) {
        results.tests[results.tests.length - 1] = {
          test: 'assignment_insert',
          status: 'failed',
          error: error.message,
          payload: testAssignment
        }
      } else {
        results.tests[results.tests.length - 1] = {
          test: 'assignment_insert',
          status: 'passed',
          data: `Created assignment with ID: ${data.id}`
        }

        // Clean up
        await supabase
          .from('assignments')
          .delete()
          .eq('id', data.id)
      }
    } catch (err) {
      results.tests[results.tests.length - 1] = {
        test: 'assignment_insert',
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }

    // Test 3: Can we access events table?
    results.tests.push({ test: 'events_table_access', status: 'running' })
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id')
        .limit(1)
      
      if (error) {
        results.tests[results.tests.length - 1] = {
          test: 'events_table_access',
          status: 'failed',
          error: error.message
        }
      } else {
        results.tests[results.tests.length - 1] = {
          test: 'events_table_access',
          status: 'passed',
          data: `Found ${data?.length || 0} existing events`
        }
      }
    } catch (err) {
      results.tests[results.tests.length - 1] = {
        test: 'events_table_access',
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }

    // Test 4: Can we insert event?
    results.tests.push({ test: 'event_insert', status: 'running' })
    try {
      const testEvent = {
        user_id: user.id,
        title: 'Debug Test Event',
        description: 'Test event for debugging',
        start_date: '2025-08-25T10:00:00+09:00',
        end_date: '2025-08-25T11:00:00+09:00',
        all_day: false,
        color: '#3788d8'
      }

      const { data, error } = await supabase
        .from('events')
        .insert(testEvent)
        .select()
        .single()

      if (error) {
        results.tests[results.tests.length - 1] = {
          test: 'event_insert',
          status: 'failed',
          error: error.message,
          payload: testEvent
        }
      } else {
        results.tests[results.tests.length - 1] = {
          test: 'event_insert',
          status: 'passed',
          data: `Created event with ID: ${data.id}`
        }

        // Clean up
        await supabase
          .from('events')
          .delete()
          .eq('id', data.id)
      }
    } catch (err) {
      results.tests[results.tests.length - 1] = {
        test: 'event_insert',
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      }
    }

    return res.status(200).json(results)

  } catch (error) {
    return res.status(500).json({
      error: 'Debug test failed',
      details: error.toString(),
      results
    })
  }
}
