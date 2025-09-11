require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCourseData() {
  console.log('🔍 Debugging course data fetching...\n');
  
  try {
    // First try the courses_with_stats view
    console.log('1️⃣ Trying courses_with_stats view with all columns...');
    const { data: statsData, error: statsError } = await supabase
      .from('courses_with_stats')
      .select('*')
      .limit(2);
    
    if (statsError) {
      console.log('❌ Stats view error:', statsError.message);
    } else {
      console.log('✅ Stats view successful');
      console.log('📊 Sample course with stats:');
      const course = statsData[0];
      console.log('Course name:', course.course);
      console.log('Description:', course.description ? 'Present' : 'Missing');
      console.log('Study topics:', course.study_topics ? course.study_topics.length + ' items' : 'Missing');
      console.log('Companies:', course.top_companies ? 'Present' : 'Missing');
      console.log('Total evaluations:', course.total_evaluations || 0);
      console.log('Average rating:', course.avg_rating || 'N/A');
      
      if (course.top_companies) {
        console.log('Companies (Japanese):', course.top_companies.japanese ? course.top_companies.japanese.length + ' companies' : 'None');
        console.log('Companies (International):', course.top_companies.international ? course.top_companies.international.length + ' companies' : 'None');
      }
      return;
    }
    
    // Fallback to courses table
    console.log('\n2️⃣ Falling back to courses table...');
    const { data: coursesData, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .limit(2);
    
    if (coursesError) {
      console.log('❌ Courses table error:', coursesError.message);
      return;
    }
    
    console.log('✅ Courses table successful');
    console.log('Sample course data:');
    console.log('Course name:', coursesData[0].course);
    console.log('Short name:', coursesData[0].short_name);
    console.log('Description:', coursesData[0].description ? 'Present' : 'Missing');
    console.log('Study topics:', coursesData[0].study_topics ? coursesData[0].study_topics.length + ' items' : 'Missing');
    console.log('Companies:', coursesData[0].top_companies ? 'Present' : 'Missing');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

debugCourseData();
