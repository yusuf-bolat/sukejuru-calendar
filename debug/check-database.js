// Script to create the courses table if it doesn't exist
const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY // We'll need the service key for admin operations

// For now, let's use the anon key and see what we can do
const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function checkDatabase() {
  try {
    console.log('🔍 Checking database structure...')
    
    // Try to query the courses table to see what columns exist
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ Error querying courses table:', error.message)
      
      if (error.code === 'PGRST116') {
        console.log('📋 The courses table does not exist. You need to create it first.')
        console.log('💡 Please run the SQL schema in your Supabase dashboard.')
      }
      return
    }
    
    console.log('✅ Courses table exists!')
    if (data && data.length > 0) {
      console.log('📊 Sample data:', data[0])
    } else {
      console.log('📝 Table is empty, ready for import')
    }
    
    // Check what columns exist
    const { data: tableInfo, error: infoError } = await supabase
      .rpc('get_table_info', { table_name: 'courses' })
      .catch(() => null) // Ignore if this function doesn't exist
    
    if (tableInfo) {
      console.log('🗂️  Available columns:', tableInfo)
    }
    
  } catch (err) {
    console.error('❌ Failed to check database:', err.message)
  }
}

checkDatabase()
