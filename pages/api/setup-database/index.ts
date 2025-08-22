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

  try {
    // First, let's check if assignments table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'assignments')

    if (tableError) {
      console.log('Cannot check table existence, will proceed with creation')
    }

    // Create assignments table
    const createTableSQL = `
      -- Create assignments table if it doesn't exist
      CREATE TABLE IF NOT EXISTS public.assignments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          due_date DATE NOT NULL,
          course VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'homework',
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          priority VARCHAR(20) NOT NULL DEFAULT 'medium',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    const { error: createError } = await supabase.rpc('exec', { sql: createTableSQL })
    
    if (createError) {
      console.error('Error creating table:', createError)
      // Continue anyway in case table already exists
    }

    // Enable RLS and create policies
    const rlsSQL = `
      -- Enable RLS
      ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Users can view own assignments" ON public.assignments;
      DROP POLICY IF EXISTS "Users can insert own assignments" ON public.assignments;
      DROP POLICY IF EXISTS "Users can update own assignments" ON public.assignments;
      DROP POLICY IF EXISTS "Users can delete own assignments" ON public.assignments;

      -- Create policies
      CREATE POLICY "Users can view own assignments" ON public.assignments
          FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY "Users can insert own assignments" ON public.assignments
          FOR INSERT WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Users can update own assignments" ON public.assignments
          FOR UPDATE USING (auth.uid() = user_id);

      CREATE POLICY "Users can delete own assignments" ON public.assignments
          FOR DELETE USING (auth.uid() = user_id);

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON public.assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(user_id, due_date);
      CREATE INDEX IF NOT EXISTS idx_assignments_completed ON public.assignments(user_id, completed);
    `

    const { error: rlsError } = await supabase.rpc('exec', { sql: rlsSQL })
    
    if (rlsError) {
      console.error('Error setting up RLS:', rlsError)
    }

    // Test assignments table by trying to create a test record
    const { error: testError } = await supabase
      .from('assignments')
      .insert({
        user_id: user.id,
        title: 'Test Assignment',
        due_date: '2025-08-23',
        course: 'Test Course',
        type: 'test',
        completed: false,
        priority: 'low'
      })
      .select()

    if (testError) {
      console.error('Test assignment creation failed:', testError)
      return res.status(500).json({ 
        error: 'Assignments table setup failed',
        details: testError
      })
    } else {
      // Clean up test record
      await supabase
        .from('assignments')
        .delete()
        .eq('user_id', user.id)
        .eq('title', 'Test Assignment')
    }

    // Check events table RLS policies
    const { data: eventTest, error: eventError } = await supabase
      .from('events')
      .select('id')
      .limit(1)

    if (eventError) {
      console.error('Events table access error:', eventError)
      return res.status(500).json({
        success: true,
        assignments_ready: true,
        events_issue: eventError.message,
        message: 'Assignments table ready, but events table has RLS issues'
      })
    }

    return res.status(200).json({
      success: true,
      assignments_ready: true,
      events_ready: true,
      message: 'Database setup completed successfully'
    })

  } catch (error) {
    console.error('Database setup error:', error)
    return res.status(500).json({
      error: 'Database setup failed',
      details: error
    })
  }
}
