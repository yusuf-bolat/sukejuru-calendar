const { fetchCoursesForAI } = require('./lib/courseAIData.js');

async function testCourseData() {
  try {
    console.log('🧪 Testing course data fetching...');
    const data = await fetchCoursesForAI();
    
    if (data) {
      console.log('✅ Course data loaded successfully:');
      console.log(`📚 Courses: ${data.courses.length}`);
      console.log(`📊 Last updated: ${data.lastUpdated}`);
      console.log(`📋 Summary length: ${data.coursesSummary.length} characters`);
      
      const evaluatedCourses = data.courses.filter(c => c.total_evaluations > 0);
      console.log(`⭐ Courses with evaluations: ${evaluatedCourses.length}`);
      
      if (evaluatedCourses.length > 0) {
        console.log(`📈 Sample evaluated course: ${evaluatedCourses[0].course} (${evaluatedCourses[0].total_evaluations} evaluations)`);
      }
    } else {
      console.log('❌ No course data loaded');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCourseData();
