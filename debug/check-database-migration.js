require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseMigration() {
  console.log('🔍 Checking database migration status...\n');
  
  try {
    // Check if the new columns exist
    const { data: courses, error } = await supabase
      .from('courses')
      .select('short_name, description, study_topics, learning_outcomes, related_fields, career_paths, top_companies')
      .limit(3);
    
    if (error) {
      console.error('❌ Error querying courses table:', error.message);
      console.log('\n🔧 Solution: Run the migration SQL in your Supabase dashboard');
      return;
    }
    
    console.log('✅ Successfully connected to database');
    console.log(`📊 Found ${courses.length} courses`);
    
    // Check if migration data exists
    const coursesWithData = courses.filter(course => 
      course.description || 
      (course.study_topics && course.study_topics.length > 0) ||
      (course.learning_outcomes && course.learning_outcomes.length > 0)
    );
    
    console.log(`📝 Courses with overview data: ${coursesWithData.length}/${courses.length}`);
    
    if (coursesWithData.length === 0) {
      console.log('\n❌ Migration appears to not be applied yet');
      console.log('🔧 Please run the SQL migration in your Supabase dashboard:');
      console.log('1. Go to Supabase Dashboard > SQL Editor');
      console.log('2. Copy contents of add-course-overview.sql');
      console.log('3. Paste and run the SQL');
    } else {
      console.log('\n✅ Migration appears to be applied');
      console.log('Sample course data:');
      coursesWithData.slice(0, 2).forEach(course => {
        console.log(`- ${course.short_name}: ${course.description ? 'Has description' : 'No description'}`);
        console.log(`  Study topics: ${course.study_topics?.length || 0} items`);
        console.log(`  Companies: ${course.top_companies ? 'Has data' : 'No data'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkDatabaseMigration();
