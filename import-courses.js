// Simple script to import courses from courses.json to Supabase
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function importCourses() {
  try {
    console.log('📚 Starting course import...')
    
    // Read courses.json
    const coursesPath = path.join(__dirname, 'courses.json')
    const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'))
    
    console.log(`📖 Found ${coursesData.length} courses to import`)
    
    // Transform courses data to match database schema
    const coursesToInsert = coursesData.map(course => ({
      id: course.short_name, // Using short_name as the TEXT id
      course: course.course,
      short_name: course.short_name,
      semester: course.semester,
      level: course.level,
      lecture_credits: course.lecture_credits,
      exercise_credits: course.exercise_credits,
      lecture: course.lecture, // Keep as JSON object for JSONB column
      exercise: course.exercise // Keep as JSON object for JSONB column
    }))
    
    // Insert courses (upsert to avoid duplicates)
    const { data, error } = await supabase
      .from('courses')
      .upsert(coursesToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
    
    if (error) {
      console.error('❌ Error importing courses:', error)
      return
    }
    
    console.log('✅ Successfully imported courses!')
    console.log(`📊 Processed ${coursesToInsert.length} courses`)
    
    // Verify import
    const { data: verifyData, error: verifyError } = await supabase
      .from('courses')
      .select('id, course, short_name')
      .limit(5)
    
    if (verifyError) {
      console.error('❌ Error verifying import:', verifyError)
      return
    }
    
    console.log('🔍 Sample imported courses:')
    verifyData.forEach(course => {
      console.log(`  - ${course.short_name}: ${course.course}`)
    })
    
  } catch (err) {
    console.error('❌ Failed to import courses:', err.message)
  }
}

importCourses()
