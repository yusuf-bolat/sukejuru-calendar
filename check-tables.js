require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('🔍 Checking available tables...\n');
  
  try {
    // Check what tables exist
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });
    
    if (error) {
      console.log('Trying alternative method...');
      
      // Try to query some common table names
      const tables = ['courses', 'evaluations', 'course_evaluations', 'reviews'];
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select('*').limit(1);
          if (!error) {
            console.log(`✅ Table "${table}" exists`);
            if (data.length > 0) {
              console.log(`   Sample columns:`, Object.keys(data[0]).join(', '));
            }
          }
        } catch (e) {
          console.log(`❌ Table "${table}" does not exist`);
        }
      }
    } else {
      console.log('Available tables:');
      data.forEach(row => console.log(`- ${row.table_name}`));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTables();
