import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/router'

export default function DatabaseSetup() {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const setupDatabase = async () => {
    setLoading(true)
    setStatus('Setting up database...')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setStatus('❌ Please log in first')
        setLoading(false)
        return
      }

      // Try to create assignments table directly
      setStatus('Creating assignments table...')
      
      const { data, error } = await supabase
        .from('assignments')
        .select('id')
        .limit(1)

      if (error && error.message.includes('does not exist')) {
        setStatus('❌ Assignments table does not exist. Please create it manually in Supabase.')
        setLoading(false)
        return
      } else if (error) {
        setStatus(`❌ Database error: ${error.message}`)
        setLoading(false)
        return
      }

      setStatus('✅ Assignments table exists!')
      
      // Test assignments insertion
      setStatus('Testing assignments insertion...')
      const { error: insertError } = await supabase
        .from('assignments')
        .insert({
          title: 'Test Assignment',
          due_date: '2025-08-23',
          course: 'Test Course',
          type: 'test',
          completed: false,
          priority: 'low'
        })
        .select()

      if (insertError) {
        setStatus(`❌ Cannot insert assignments: ${insertError.message}`)
        setLoading(false)
        return
      }

      // Clean up test record
      await supabase
        .from('assignments')
        .delete()
        .eq('title', 'Test Assignment')

      setStatus('✅ Assignments table working!')

      // Test events table
      setStatus('Testing events table...')
      const { error: eventsError } = await supabase
        .from('events')
        .select('id')
        .limit(1)

      if (eventsError) {
        setStatus(`❌ Events table issue: ${eventsError.message}`)
        setLoading(false)
        return
      }

      setStatus('✅ Database setup complete! You can now use the calendar.')
      
    } catch (error) {
      setStatus(`❌ Error: ${error}`)
    }
    
    setLoading(false)
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #1a1a2e, #16213e, #1a1a2e)', 
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#4fc3f7', marginBottom: '24px' }}>Database Setup</h1>
        
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: '#f2f2f2', fontSize: '18px' }}>Manual Setup Required</h2>
          <p style={{ color: '#ccc', lineHeight: '1.6' }}>
            To fix the database issues, please copy and run this SQL in your Supabase Dashboard → SQL Editor:
          </p>
        </div>

        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'left',
          fontSize: '14px',
          fontFamily: 'monospace',
          color: '#e0e0e0',
          overflow: 'auto'
        }}>
{`-- Create assignments table
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

-- Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
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

-- Create indexes (IF NOT EXISTS for safety)
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_completed ON assignments(user_id, completed);`}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={setupDatabase}
            disabled={loading}
            style={{
              background: loading ? '#555' : '#4fc3f7',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Testing...' : 'Test Database Setup'}
          </button>
        </div>

        {status && (
          <div style={{
            background: status.includes('❌') ? 'rgba(255,107,107,0.2)' : 'rgba(102,187,106,0.2)',
            border: `1px solid ${status.includes('❌') ? '#ff6b6b' : '#66bb6a'}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            color: status.includes('❌') ? '#ff6b6b' : '#66bb6a'
          }}>
            {status}
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            color: '#4fc3f7',
            border: '1px solid #4fc3f7',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Back to Calendar
        </button>
      </div>
    </div>
  )
}
