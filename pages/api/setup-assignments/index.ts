import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check if user is authenticated (basic security)
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
    // Create assignments table using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create assignments table if it doesn't exist
        CREATE TABLE IF NOT EXISTS assignments (
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

        -- Enable RLS if not already enabled
        ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist to avoid conflicts
        DROP POLICY IF EXISTS "Users can view own assignments" ON assignments;
        DROP POLICY IF EXISTS "Users can insert own assignments" ON assignments;
        DROP POLICY IF EXISTS "Users can update own assignments" ON assignments;
        DROP POLICY IF EXISTS "Users can delete own assignments" ON assignments;

        -- Create policies
        CREATE POLICY "Users can view own assignments" ON assignments
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own assignments" ON assignments
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own assignments" ON assignments
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own assignments" ON assignments
            FOR DELETE USING (auth.uid() = user_id);

        -- Create indexes if they don't exist
        CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
        CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(user_id, due_date);
        CREATE INDEX IF NOT EXISTS idx_assignments_completed ON assignments(user_id, completed);
      `
    })

    if (error) {
      throw error
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Assignments table created successfully' 
    })
  } catch (error) {
    console.error('Error creating assignments table:', error)
    return res.status(500).json({ 
      error: 'Failed to create assignments table',
      details: error 
    })
  }
}
