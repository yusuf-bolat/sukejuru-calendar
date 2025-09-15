require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvaluationColumns() {
  console.log('🔍 Checking course_evaluations table structure...\n');
  
  try {
    const { data, error } = await supabase
      .from('course_evaluations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else if (data.length > 0) {
      console.log('✅ course_evaluations columns:');
      Object.keys(data[0]).forEach(col => console.log(`- ${col}`));
      console.log('\n📋 Sample data:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📋 Table exists but no data found');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkEvaluationColumns();
