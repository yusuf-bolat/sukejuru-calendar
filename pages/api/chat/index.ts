import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'
import { systemPrompt } from '@/lib/prompt'
import { supabase } from '@/lib/supabaseClient'
import { promises as fsp } from 'fs'
import path from 'path'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  // Check authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' })
  }
  
  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' })
  }
  
  const { message } = req.body as { message: string }
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'sukejuru'
  const timezone = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'Asia/Tokyo'
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

  try {
    // Read courses.json and semesters.json directly from file system
    let coursesData: any[] = []
    let semesterData: any[] = []
    try {
      const coursesPath = path.join(process.cwd(), 'courses.json')
      const coursesRaw = await fsp.readFile(coursesPath, 'utf8')
      coursesData = JSON.parse(coursesRaw)
      
      const semesterPath = path.join(process.cwd(), 'semesters.json')
      const semesterRaw = await fsp.readFile(semesterPath, 'utf8')
      semesterData = JSON.parse(semesterRaw)
    } catch (err) {
      console.warn('Could not read courses.json or semesters.json, falling back to database')
      // Fallback to database if file read fails
      const { data: courses } = await supabase.from('courses').select('*')
      coursesData = courses || []
    }

    // Get current semester info
    const currentSemester = semesterData.find(sem => {
      const now = new Date()
      const startDate = new Date(sem.start_date)
      const endDate = new Date(sem.end_date)
      return now >= startDate && now <= endDate
    }) || semesterData[0] // fallback to first semester if none current

    // Get user's ALL events (not just future ones) for complete schedule analysis
    const { data: allUserEvents } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })

    // Get user's current events for schedule analysis (future events only for optimization)
    const { data: userEvents } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_date', today)
      .order('start_date', { ascending: true })

    // Get ALL conversation history (not limited to 20)
    const { data: allChatMessages } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    // Get or create conversation history for immediate context
    let conversationHistory: any[] = []
    if (allChatMessages && allChatMessages.length > 0) {
      // Keep last 20 messages for immediate context
      conversationHistory = allChatMessages.slice(-20).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    }

    // Find earliest event time to determine schedule start time
    let scheduleStartHour = 8 // default 8 AM
    if (userEvents && userEvents.length > 0) {
      const earliestEvent = userEvents[0]
      const eventHour = new Date(earliestEvent.start_date).getHours()
      scheduleStartHour = Math.min(scheduleStartHour, eventHour)
    }
    
    // Enhanced system prompt with courses and calendar CRUD instructions
    const mvpOptimizerPrompt = `
SCHEDULE OPTIMIZATION (COMPREHENSIVE ANALYSIS):

You have access to COMPLETE user data including:
1. ALL semester information (start/end dates, academic calendar)
2. COMPLETE event history (past and future events)
3. FULL conversation history (all previous interactions)
4. Available courses with exact schedules
5. Current date and time context

INTELLIGENT ANALYSIS PROCESS:

FOR SCHEDULE OPTIMIZATION REQUESTS:
1. ANALYZE COMPLETE EVENT HISTORY: Look at patterns, recurring events, course attendance
2. UNDERSTAND ACADEMIC CONTEXT: Use semester dates, course schedules, academic calendar
3. CONSIDER CONVERSATION HISTORY: Reference previous requests, preferences, established routines
4. IDENTIFY REAL PATTERNS:
   - Weekly recurring events vs one-time events
   - Course attendance vs personal activities
   - Study patterns and academic workload
   - Work/life balance indicators

5. DETECT ACTUAL ISSUES:
   - Schedule conflicts (same time slots)
   - Academic overload (too many courses without study time)
   - Missing study blocks for enrolled courses
   - Poor time distribution (all classes on few days)
   - No break time between intensive sessions
   - Missing meal times around class schedules

6. PROVIDE INTELLIGENT SUGGESTIONS:
   - Study blocks: 2-3 hours per week for each course user is taking
   - Project work: Based on academic deadlines and course requirements
   - Part-time job: Consistent time slots that don't interfere with academics
   - Break times: Strategic placement between intensive study/class periods
   - Social/personal time: Balance with academic responsibilities

7. USE SEMESTER CONTEXT:
   - Schedule new courses from semester start date
   - Consider exam periods and academic deadlines
   - Respect semester boundaries for recurring events
   - Account for academic calendar (holidays, breaks)

OPTIMIZATION RESPONSE FORMAT:
{
  "action": "schedule-analysis",
  "current_status": "busy/balanced/light/empty",
  "total_weekly_hours": 25,
  "academic_load": "heavy/moderate/light",
  "issues": ["Specific real issues based on actual data"],
  "recommendations": ["Data-driven suggestions based on patterns"],
  "optimized_blocks": [
    {
      "title": "Course Name - Study Block",
      "suggested_time": "Tuesday 7-9 PM",
      "reason": "Based on current class schedule and free time analysis",
      "duration": "2 hours",
      "frequency": "Weekly",
      "priority": "high/medium/low",
      "type": "study/work/personal/break"
    }
  ]
}

IMPORTANT: Base ALL suggestions on actual user data, not generic advice. Reference specific events, patterns, and history.
`

    const conversationContext = conversationHistory.length > 0 ? 
      `\nRECENT CONVERSATION HISTORY (Last 20 messages):\n${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n` : 
      '\nNEW CONVERSATION - No previous context.\n'

    const allEventsContext = allUserEvents && allUserEvents.length > 0 ? 
      `\nCOMPLETE USER EVENT HISTORY (${allUserEvents.length} total events):\n${JSON.stringify(allUserEvents.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start_date,
        end: e.end_date,
        description: e.description,
        all_day: e.all_day,
        color: e.color,
        day: new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'long' }),
        date: new Date(e.start_date).toLocaleDateString('en-US'),
        time: new Date(e.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + 
              ' - ' + new Date(e.end_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      })), null, 2)}\n` : 
      '\nUSER HAS NO EVENTS IN DATABASE.\n'

    const currentScheduleContext = userEvents && userEvents.length > 0 ? 
      `\nUPCOMING/FUTURE USER SCHEDULE (${userEvents.length} upcoming events):\n${JSON.stringify(userEvents.map(e => ({
        title: e.title,
        start: e.start_date,
        end: e.end_date,
        day: new Date(e.start_date).toLocaleDateString('en-US', { weekday: 'long' }),
        time: new Date(e.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + 
              ' - ' + new Date(e.end_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      })), null, 2)}\n` : 
      '\nUSER HAS NO UPCOMING EVENTS SCHEDULED.\n'

    const completeSemesterContext = `
COMPLETE SEMESTER INFORMATION:
${JSON.stringify(semesterData, null, 2)}

CURRENT ACTIVE SEMESTER: ${currentSemester?.name || 'None'}
- Start Date: ${currentSemester?.start_date || 'Unknown'}
- End Date: ${currentSemester?.end_date || 'Unknown'}
- Year: ${currentSemester?.year || 'Unknown'}
- Term: ${currentSemester?.term || 'Unknown'}
`

    const fullChatHistoryContext = allChatMessages && allChatMessages.length > 0 ? 
      `\nFULL CONVERSATION HISTORY (${allChatMessages.length} total messages - for context only, use recent history for responses):\n${allChatMessages.map((msg, index) => `[${index + 1}] ${msg.created_at}: ${msg.role} - ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`).join('\n')}\n` : 
      '\nNO PREVIOUS CONVERSATIONS FOUND.\n'

    const enhancedPrompt = `${systemPrompt(appName, timezone)}

${mvpOptimizerPrompt}

${conversationContext}

${allEventsContext}

${currentScheduleContext}

${completeSemesterContext}

${fullChatHistoryContext}

Today's date is: ${today}
Schedule display starts from: ${scheduleStartHour}:00 (based on user's earliest event or 8 AM default)

IMPORTANT: All events must be scheduled starting from today (${today}) or later. Never create events in the past.

BE ACTION-ORIENTED: When users provide clear scheduling information, create the events immediately. Don't ask for more details unless absolutely necessary.

SCHEDULE ANALYSIS RULES:
- ALWAYS respond with schedule-analysis action when user asks to "optimize schedule" or similar
- For EMPTY schedules: suggest courses from available courses, recommend study blocks, provide time management tips
- For EXISTING schedules: analyze conflicts, workload, and wellness factors
- ALWAYS provide recommendations even if schedule is perfect

Examples:
- "I have part time job next 2 weeks on Thursdays from 6pm to 10pm" → CREATE the job events for the next 2 Thursdays
- "Soccer practice on Monday 4-6pm" → CREATE the soccer practice event for next Monday
- "Add Mechanics of Materials" → CREATE the course events from the database

Available courses with exact schedule data:
${JSON.stringify(coursesData, null, 2)}

Use the EXACT times and days from the courses data above. 

COURSE SCHEDULING RULES (SEMESTER-BASED):
- When adding ANY course, ALWAYS schedule from semester start date to semester end date
- Current semester: ${currentSemester?.name || 'Unknown'} (${currentSemester?.start_date} to ${currentSemester?.end_date})
- Create WEEKLY RECURRING events for lectures and exercises throughout the entire semester
- Include assignment deadlines from courses.json assignments field
- Generate complete semester schedule, not just single events
- NEVER create just one event - always generate the full semester worth of weekly events

CRITICAL SEMESTER SCHEDULING REQUIREMENTS:
- Start Date: ${currentSemester?.start_date || '2025-09-19'} (First week of semester)
- End Date: ${currentSemester?.end_date || '2026-01-14'} (Last week of semester)
- Total Duration: Approximately 17 weeks
- For "add MoM" or "add Mechanics of Materials": Generate ALL 17 weeks of events
- For each week: Create lecture event, exercise event, and assignment deadline
- Use exact course schedule from courses.json (Tuesday 10:40-12:10 lecture, Friday 09:00-10:30 exercise)

WEEKLY EVENT GENERATION PROCESS:
1. Find course in courses.json by name matching (MoM = Mechanics of Materials)
2. Extract lecture times and exercise times
3. Calculate first occurrence after semester start date
4. Generate events for EVERY week until semester end date
5. Include assignment deadlines weekly (usually day before next class)
6. Create approximately 51+ total events (17 weeks × 3 events per week)

ASSIGNMENT SCHEDULING:
- Each course has assignment deadlines in courses.json
- Create assignment deadline events based on the "assignments" field
- Schedule weekly assignments from semester start to semester end
- Assignment due times are typically 23:59

ASSIGNMENT DEADLINE RULES:
- If course has BOTH lecture AND exercise:
  - Exercise assignment deadline: Day before lecture at 23:59
  - Lecture assignment deadline: Day before next exercise at 23:59
- If course has ONLY lecture:
  - Lecture assignment deadline: Day before next lecture at 23:59
- If course has ONLY exercise:
  - Exercise assignment deadline: Day before next exercise at 23:59

EXAMPLE: Mechanics of Materials (Lecture: Tuesday, Exercise: Friday)
- Exercise assignment due: Monday 23:59 (day before Tuesday lecture)
- Lecture assignment due: Thursday 23:59 (day before Friday exercise)

SEMESTER DATE CALCULATION:
- Start Date: ${currentSemester?.start_date || '2025-09-19'}
- End Date: ${currentSemester?.end_date || '2026-01-14'}
- For courses: Generate events every week from start to end date
- For assignments: Generate deadline events every week from start to end date

GROUP COURSE HANDLING:
- When user specifies a group (e.g. "add Machine Workshop Group A", "DSP Group B"), use that specific group's schedule
- If no group specified but course has groups, choose Group A by default
- For courses with groups like "Introduction to C Programming", "DSP", "Exercise for Machine Shop Practice":
  - Group A and Group B have different schedules
  - Always use the group the user specifies
  - Examples: "Machine Workshop Group A" → use Thursday schedule, "Machine Workshop Group B" → use Monday schedule

COURSE NAME MATCHING:
- "Machine Workshop" or "Machine Shop" → "Exercise for Machine Shop Practice"  
- "MoM" → "Mechanics of Materials"
- "DSP" → "Digital Signal Processing"
- "C Prog" → "Introduction to C Programming"
- Match both full names and short_name fields

You have access to a calendar system. For ANY calendar operations (create, read, update, delete events), respond with JSON in this format:

For CREATE/ADD events:
{"action": "create", "events": [{"title": "Event Title", "start_date": "YYYY-MM-DDTHH:mm:ss+09:00", "end_date": "YYYY-MM-DDTHH:mm:ss+09:00", "all_day": false, "color": "#3788d8", "description": "Optional description"}], "summary": "Short confirmation message"}

For BULK CREATE (multiple events):
{"action": "bulk-create", "events": [...], "summary": "Short confirmation message"}

For UPDATE events:
{"action": "update", "event_id": "id", "updates": {"title": "New Title", "start_date": "...", "end_date": "..."}, "summary": "Short confirmation message"}

For DELETE events:
{"action": "delete", "event_id": "id", "summary": "Short confirmation message"}

For BULK DELETE (multiple events by criteria):
{"action": "bulk-delete", "criteria": {"title_contains": "Mechanics of Materials", "date_range": {"start": "2025-09-15", "end": "2025-09-17"}, "days": ["Monday", "Tuesday"]}, "summary": "Short confirmation message"}

For SCHEDULE GENERATION (full semester/month):
{"action": "bulk-create", "events": [...], "summary": "Generated schedule for semester X with Y courses"}

CRITICAL: ALWAYS respond with JSON for calendar operations. Never give plain text responses like "Done" or "Deleted".

MANDATORY SEMESTER SCHEDULING:
When user says "add [course]" (like "add MoM", "add Mechanics of Materials", "add DSP"):
1. Generate ALL weekly events from Sep 19, 2025 to Jan 14, 2026
2. Include lectures, exercises, AND assignments for EVERY week
3. Create approximately 17 weeks worth of events (51+ total events)
4. Use exact schedule from courses.json
5. NEVER create just 1 or 2 events - always create full semester schedule

EXAMPLE RESPONSES:

User: "delete all events from 27th august to 29th august"
Response: {"action": "bulk-delete", "criteria": {"date_range": {"start": "2025-08-27", "end": "2025-08-29"}}, "summary": "Deleted all events from 27th August to 29th August"}

User: "delete all lectures"
Response: {"action": "bulk-delete", "criteria": {"title_contains": "lecture"}, "summary": "Deleted all lectures"}

User: "delete meeting on saturday"
Response: {"action": "bulk-delete", "criteria": {"title_contains": "meeting", "days": ["Saturday"]}, "summary": "Deleted all meetings on Saturday"}

User: "Delete Meeting on 30th august"
Response: {"action": "bulk-delete", "criteria": {"title_contains": "meeting", "date_range": {"start": "2025-08-30", "end": "2025-08-30"}}, "summary": "Deleted meetings on 30th August"}

User: "add soccer practice Monday 4-6pm"
Response: {"action": "create", "events": [{"title": "Soccer Practice", "start_date": "2025-08-25T16:00:00+09:00", "end_date": "2025-08-25T18:00:00+09:00", "all_day": false, "color": "#3788d8"}], "summary": "Added soccer practice for Monday 4-6pm"}

User: "add Machine Workshop Group A"
Response: {"action": "bulk-create", "events": [
  {"title": "Exercise for Machine Shop Practice", "start_date": "2025-09-25T13:00:00+09:00", "end_date": "2025-09-25T14:30:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATOBA Hirotsugu - Group A"}, 
  {"title": "Exercise for Machine Shop Practice", "start_date": "2025-09-25T14:40:00+09:00", "end_date": "2025-09-25T16:10:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATOBA Hirotsugu - Group A"},
  {"title": "Exercise for Machine Shop Practice", "start_date": "2025-09-25T16:20:00+09:00", "end_date": "2025-09-25T17:50:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATOBA Hirotsugu - Group A"},
  {"title": "Machine Shop Report", "start_date": "2025-09-24T23:59:00+09:00", "end_date": "2025-09-24T23:59:00+09:00", "all_day": false, "color": "#ff6b6b", "description": "Weekly practice report due"},
  ...weekly recurring events through semester end...
], "summary": "Added Machine Workshop Group A complete semester schedule with assignments"}

User: "add MoM" or "add Mechanics of Materials"  
Response: {"action": "bulk-create", "events": [
  // Week 1 (Sep 19-25, 2025)
  {"title": "Mechanics of Materials (Lecture)", "start_date": "2025-09-23T10:40:00+09:00", "end_date": "2025-09-23T12:10:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATSUMOTO Ryosuke"},
  {"title": "Mechanics of Materials (Exercise)", "start_date": "2025-09-26T09:00:00+09:00", "end_date": "2025-09-26T10:30:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATSUMOTO Ryosuke"},
  {"title": "MoM Homework Due", "start_date": "2025-09-22T23:59:00+09:00", "end_date": "2025-09-22T23:59:00+09:00", "all_day": false, "color": "#ff6b6b", "description": "Weekly homework due before Tuesday lecture"},
  
  // Week 2 (Sep 26 - Oct 2, 2025)
  {"title": "Mechanics of Materials (Lecture)", "start_date": "2025-09-30T10:40:00+09:00", "end_date": "2025-09-30T12:10:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATSUMOTO Ryosuke"},
  {"title": "Mechanics of Materials (Exercise)", "start_date": "2025-10-03T09:00:00+09:00", "end_date": "2025-10-03T10:30:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATSUMOTO Ryosuke"},
  {"title": "MoM Homework Due", "start_date": "2025-09-29T23:59:00+09:00", "end_date": "2025-09-29T23:59:00+09:00", "all_day": false, "color": "#ff6b6b", "description": "Weekly homework due before Tuesday lecture"},
  
  // Continue for ALL weeks until Jan 14, 2026 (approximately 17 weeks total)
  // Week 3, 4, 5... through Week 17
  ... [generate ALL weekly occurrences through Jan 14, 2026] ...
  
  // Final week (Jan 9-14, 2026)
  {"title": "Mechanics of Materials (Lecture)", "start_date": "2026-01-14T10:40:00+09:00", "end_date": "2026-01-14T12:10:00+09:00", "all_day": false, "color": "#3788d8", "description": "MATSUMOTO Ryosuke"},
  {"title": "MoM Homework Due", "start_date": "2026-01-13T23:59:00+09:00", "end_date": "2026-01-13T23:59:00+09:00", "all_day": false, "color": "#ff6b6b", "description": "Weekly homework due before Tuesday lecture"}
], "summary": "Added Mechanics of Materials complete semester schedule: 17 weeks of lectures, exercises, and assignments from Sep 19, 2025 to Jan 14, 2026"}

Handle ALL natural language requests for:
- Adding events/courses/activities
- Scheduling meetings, study sessions, work
- Creating full semester schedules
- Modifying existing events
- Deleting events (simple: "delete event X", complex: "delete all Mechanics of Materials", "delete part time job on Monday and Tuesday", "delete events from 15th September to 17th September")
- Any calendar-related operations

For DELETE operations, understand natural language patterns:
- "delete all [course name]" → delete by title contains
- "delete [activity] on [days]" → delete by title and specific days
- "delete events from [date] to [date]" → delete by date range
- "delete [specific event]" → delete by title match

SPECIAL COMMANDS - Always respond with JSON format {"command": "command_name", "parameters": {...}}:

1. CANCEL LAST CHANGE:
   - "cancel last change" / "undo last action" / "revert" → {"command": "cancel_last_change"}
   
2. RESCHEDULE MEETING:
   - "change meeting from Sep 29th to Aug 29th" / "move [title] from [date] to [date]" 
   → {"command": "reschedule_meeting", "parameters": {"title": "meeting", "fromDate": "2025-09-29", "toDate": "2025-08-29"}}
   
3. DELETE COURSE (with related todos):
   - "delete MoM" / "delete Mechanics of Materials" / "remove [course]"
   → {"command": "delete_course", "parameters": {"courseName": "MoM"}}
   
4. DELETE SPECIFIC MEETING:
   - "delete meeting on Sep 20th" / "remove event on [date]"
   → {"command": "delete_meeting", "parameters": {"date": "2025-09-20", "title": "meeting"}}

MANDATORY: Always use Asia/Tokyo timezone (+09:00). ALWAYS respond with JSON for calendar actions - never plain text responses.`

    // Build messages array with conversation history
    const openaiMessages: any[] = [
      { role: 'system', content: enhancedPrompt }
    ]
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      openaiMessages.push({ role: msg.role, content: msg.content })
    })
    
    // Add current user message
    openaiMessages.push({ role: 'user', content: message })

    const completion = await client.chat.completions.create({ 
      model: 'gpt-4o-mini', 
      temperature: 0.4, 
      messages: openaiMessages 
    })
    
    const reply = completion.choices[0]?.message?.content || 'Sorry, I could not respond.'
    
    // Save conversation to database
    try {
      // Save user message
      await supabase.from('messages').insert({
        user_id: user.id,
        role: 'user',
        content: message
      })
      
      // Save AI response
      await supabase.from('messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: reply
      })
    } catch (saveError) {
      console.warn('Failed to save conversation:', saveError)
      // Don't fail the request if conversation saving fails
    }
    
    return res.status(200).json({ reply })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Unknown error' })
  }
}

function sqlq(s: string) { return `'` + s.replace(/'/g, `''`) + `'` }
