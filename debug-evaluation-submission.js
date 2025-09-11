require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugEvaluationSubmission() {
  console.log('🔍 Debugging evaluation submission...\n');
  
  try {
    // Check if course_evaluations table has the correct structure
    console.log('1️⃣ Checking course_evaluations table structure...');
    
    // Try to describe the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('course_evaluations')
      .select('*')
      .limit(0);
    
    if (tableError) {
      console.log('❌ Error accessing course_evaluations:', tableError.message);
      return;
    }
    
    console.log('✅ course_evaluations table exists');
    
    // Check auth status
    console.log('\n2️⃣ Checking authentication...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Authentication issue:', userError?.message || 'No user');
      console.log('📝 Note: This is expected when running outside browser context');
    } else {
      console.log('✅ User authenticated:', user.id);
    }
    
    // Test sample data insertion (without actual auth)
    console.log('\n3️⃣ Testing sample evaluation data format...');
    const sampleData = {
      course_id: 'ODE', // Example course ID from our courses
      user_id: '00000000-0000-0000-0000-000000000000', // Fake UUID for testing
      content_clarity: 4,
      content_interest: 4,
      materials_helpful: 3,
      hours_per_week: '3-5h',
      instructor_clarity: 4,
      teaching_engaging: 'Yes',
      grading_transparent: 'Yes',
      received_feedback: true,
      feedback_helpful: 4,
      overall_satisfaction: 4,
      would_recommend: true,
      what_learned: 'Test learning',
      advice_future_students: 'Test advice',
      liked_most: 'Test like',
      would_improve: 'Test improvement'
    };
    
    console.log('Sample data structure:');
    console.log(JSON.stringify(sampleData, null, 2));
    
    // Check if we can get course data
    console.log('\n4️⃣ Checking course data...');
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, course, short_name')
      .limit(3);
    
    if (coursesError) {
      console.log('❌ Error getting courses:', coursesError.message);
    } else {
      console.log('✅ Available courses:');
      courses.forEach(course => {
        console.log(`- ID: ${course.id}, Name: ${course.course}, Short: ${course.short_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

debugEvaluationSubmission();
