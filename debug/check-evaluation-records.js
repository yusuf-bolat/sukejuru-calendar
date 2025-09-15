require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvaluationRecords() {
  console.log('🔍 Checking evaluation records and statistics...\n');
  
  try {
    // Check what's actually in the course_evaluations table
    console.log('1️⃣ Checking course_evaluations table data...');
    const { data: evaluations, error: evalError } = await supabase
      .from('course_evaluations')
      .select('*')
      .limit(5);
    
    if (evalError) {
      console.log('❌ Error accessing evaluations:', evalError.message);
    } else {
      console.log(`✅ Found ${evaluations.length} evaluation records:`);
      evaluations.forEach((eval, index) => {
        console.log(`\n📝 Evaluation ${index + 1}:`);
        console.log(`   Course ID: ${eval.course_id}`);
        console.log(`   User ID: ${eval.user_id}`);
        console.log(`   Overall Satisfaction: ${eval.overall_satisfaction}/5`);
        console.log(`   Would Recommend: ${eval.would_recommend}`);
        console.log(`   Created: ${eval.created_at}`);
      });
    }
    
    // Check courses_with_stats view
    console.log('\n2️⃣ Checking courses_with_stats view...');
    const { data: coursesWithStats, error: statsError } = await supabase
      .from('courses_with_stats')
      .select('id, course, short_name, total_evaluations, avg_rating')
      .limit(5);
    
    if (statsError) {
      console.log('❌ Error accessing courses_with_stats:', statsError.message);
    } else {
      console.log('✅ courses_with_stats view results:');
      coursesWithStats.forEach(course => {
        console.log(`   ${course.short_name} (${course.course}):`);
        console.log(`     Total evaluations: ${course.total_evaluations}`);
        console.log(`     Average rating: ${course.avg_rating || 'N/A'}`);
      });
    }
    
    // Check if there are any evaluation counts manually
    console.log('\n3️⃣ Manual evaluation count check...');
    const { data: manualCount, error: countError } = await supabase
      .from('course_evaluations')
      .select('course_id', { count: 'exact' });
    
    if (!countError) {
      console.log(`📊 Total evaluations in database: ${manualCount.length}`);
      
      // Count by course
      const countByCourse = {};
      manualCount.forEach(eval => {
        countByCourse[eval.course_id] = (countByCourse[eval.course_id] || 0) + 1;
      });
      
      console.log('Evaluations by course:');
      Object.entries(countByCourse).forEach(([courseId, count]) => {
        console.log(`   ${courseId}: ${count} evaluations`);
      });
    }
    
    // Check if the view exists and what it returns
    console.log('\n4️⃣ Testing direct SQL aggregation...');
    try {
      // This would be the equivalent of what the view should do
      const { data: directStats, error: directError } = await supabase
        .from('courses')
        .select(`
          id,
          course,
          short_name
        `);
      
      if (!directError && directStats) {
        console.log('\n📈 Manual statistics calculation:');
        for (const course of directStats.slice(0, 3)) {
          const { data: courseEvals, error: courseEvalError } = await supabase
            .from('course_evaluations')
            .select('overall_satisfaction, would_recommend')
            .eq('course_id', course.id);
          
          if (!courseEvalError) {
            const totalEvals = courseEvals.length;
            const avgRating = totalEvals > 0 
              ? (courseEvals.reduce((sum, eval) => sum + eval.overall_satisfaction, 0) / totalEvals).toFixed(2)
              : 0;
            
            console.log(`   ${course.short_name}: ${totalEvals} evaluations, avg rating: ${avgRating}`);
          }
        }
      }
    } catch (err) {
      console.log('Error in direct aggregation:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkEvaluationRecords();
