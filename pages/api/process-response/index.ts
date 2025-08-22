import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

interface ProcessedResponse {
  calendarEvents: any[]
  assignments: any[]
  summary: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

  try {
    const { aiResponse } = req.body
    
    // Try to parse the AI response as JSON
    let parsedResponse
    try {
      parsedResponse = JSON.parse(aiResponse)
    } catch {
      // If not JSON, treat as regular text response
      return res.status(200).json({ 
        type: 'text',
        content: aiResponse,
        calendarEvents: [],
        assignments: []
      })
    }

    // Check if it's a calendar action response
    if (parsedResponse.action && parsedResponse.events) {
      const processed = await processCalendarResponse(parsedResponse, user.id)
      return res.status(200).json(processed)
    }

    // Check if it's a command action response
    if (parsedResponse.command) {
      const processed = await processCommandResponse(parsedResponse, user.id)
      return res.status(200).json(processed)
    }

    // For other JSON responses, return as is
    return res.status(200).json({
      type: 'json',
      content: parsedResponse,
      calendarEvents: [],
      assignments: []
    })

  } catch (error) {
    console.error('Error processing AI response:', error)
    return res.status(500).json({ error: 'Failed to process response' })
  }
}

async function processCalendarResponse(response: any, userId: string): Promise<any> {
  const calendarEvents = []
  const assignments = []
  
  // Separate events into calendar events and assignments
  if (response.events && Array.isArray(response.events)) {
    for (const event of response.events) {
      if (isAssignmentEvent(event)) {
        // Convert to assignment format
        const assignment = {
          title: event.title.replace(/(Due|Deadline|Assignment)/gi, '').trim(),
          description: event.description || '',
          due_date: event.start_date.split('T')[0], // Extract date
          course: extractCourseFromTitle(event.title),
          type: determineAssignmentType(event.title),
          priority: determineAssignmentType(event.title) === 'exam' ? 'high' : 'medium'
        }
        assignments.push(assignment)
      } else {
        // Keep as calendar event
        calendarEvents.push(event)
      }
    }
  }

  // Create calendar events
  if (calendarEvents.length > 0) {
    const eventsWithUserId = calendarEvents.map(event => ({
      user_id: userId,
      title: event.title,
      start_date: event.start_date,
      end_date: event.end_date,
      all_day: event.all_day || false,
      color: event.color || '#3788d8',
      description: event.description || ''
    }))

    try {
      console.log(`Attempting to create ${eventsWithUserId.length} calendar events`)
      const { data, error } = await supabase
        .from('events')
        .insert(eventsWithUserId)
        .select()

      if (error) {
        console.error('Error creating calendar events:', error)
        console.error('Sample event data:', eventsWithUserId[0])
      } else {
        console.log(`Successfully created ${data?.length || 0} calendar events`)
      }
    } catch (err) {
      console.error('Database error creating calendar events:', err)
    }
  }

  // Create assignments
  if (assignments.length > 0) {
    const assignmentsWithUserId = assignments.map(assignment => ({
      ...assignment,
      user_id: userId,
      completed: false
    }))

    try {
      console.log(`Attempting to create ${assignmentsWithUserId.length} assignments`)
      const { data, error } = await supabase
        .from('assignments')
        .insert(assignmentsWithUserId)
        .select()

      if (error) {
        console.error('Error creating assignments:', error)
        console.error('Sample assignment data:', assignmentsWithUserId[0])
      } else {
        console.log(`Successfully created ${data?.length || 0} assignments`)
      }
    } catch (err) {
      console.error('Database error creating assignments:', err)
    }
  }

  return {
    type: 'calendar_action',
    action: response.action,
    calendarEvents: calendarEvents.length,
    assignments: assignments.length,
    summary: `Created ${calendarEvents.length} calendar events and ${assignments.length} assignments. ${response.summary || ''}`
  }
}

async function processCommandResponse(response: any, userId: string): Promise<any> {
  const { command, parameters } = response
  let summary = ''

  try {
    switch (command) {
      case 'cancel_last_change':
        summary = await handleCancelLastChange(userId)
        break
        
      case 'reschedule_meeting':
        summary = await handleRescheduleMeeting(parameters, userId)
        break
        
      case 'delete_course':
        summary = await handleDeleteCourse(parameters, userId)
        break
        
      case 'delete_meeting':
        summary = await handleDeleteMeeting(parameters, userId)
        break
        
      default:
        summary = `Unknown command: ${command}`
    }

    return {
      type: 'command_action',
      command,
      summary
    }
  } catch (error) {
    console.error(`Error executing command ${command}:`, error)
    return {
      type: 'command_action',
      command,
      summary: `Error executing command: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

async function handleCancelLastChange(userId: string): Promise<string> {
  // Get the most recent events and assignments (last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  
  const { data: recentEvents, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })

  const { data: recentAssignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })

  let deletedEvents = 0
  let deletedAssignments = 0

  // Delete recent events
  if (recentEvents && recentEvents.length > 0) {
    const eventIds = recentEvents.map(e => e.id)
    const { error } = await supabase
      .from('events')
      .delete()
      .in('id', eventIds)
      .eq('user_id', userId)
    
    if (!error) deletedEvents = eventIds.length
  }

  // Delete recent assignments
  if (recentAssignments && recentAssignments.length > 0) {
    const assignmentIds = recentAssignments.map(a => a.id)
    const { error } = await supabase
      .from('assignments')
      .delete()
      .in('id', assignmentIds)
      .eq('user_id', userId)
    
    if (!error) deletedAssignments = assignmentIds.length
  }

  return `Cancelled last change: deleted ${deletedEvents} events and ${deletedAssignments} assignments`
}

async function handleRescheduleMeeting(parameters: any, userId: string): Promise<string> {
  const { fromDate, toDate, title } = parameters
  
  // Find events that match the criteria
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .ilike('title', `%${title}%`)
    .gte('start_date', fromDate)
    .lt('start_date', new Date(new Date(fromDate).getTime() + 24 * 60 * 60 * 1000).toISOString())

  if (error || !events || events.length === 0) {
    return `No meetings found matching "${title}" on ${fromDate}`
  }

  let rescheduledCount = 0
  for (const event of events) {
    // Calculate the time difference and apply to new date
    const originalStart = new Date(event.start_date)
    const originalEnd = new Date(event.end_date)
    const duration = originalEnd.getTime() - originalStart.getTime()
    
    const newStart = new Date(toDate)
    newStart.setHours(originalStart.getHours(), originalStart.getMinutes())
    const newEnd = new Date(newStart.getTime() + duration)

    const { error: updateError } = await supabase
      .from('events')
      .update({
        start_date: newStart.toISOString(),
        end_date: newEnd.toISOString()
      })
      .eq('id', event.id)
      .eq('user_id', userId)

    if (!updateError) rescheduledCount++
  }

  return `Rescheduled ${rescheduledCount} meetings from ${fromDate} to ${toDate}`
}

async function handleDeleteCourse(parameters: any, userId: string): Promise<string> {
  const { courseName } = parameters
  
  // Map common abbreviations to full names and variations
  const courseVariations = getCourseVariations(courseName)
  
  let totalEventsDeleted = 0
  let totalAssignmentsDeleted = 0
  
  // Search and delete events
  for (const variation of courseVariations) {
    console.log(`Searching for events with variation: "${variation}"`)
    
    const { data: deletedEvents, error: eventsError } = await supabase
      .from('events')
      .delete()
      .eq('user_id', userId)
      .or(`title.ilike.%${variation}%,description.ilike.%${variation}%`)
      .select('id, title')
    
    if (!eventsError && deletedEvents && deletedEvents.length > 0) {
      totalEventsDeleted += deletedEvents.length
      console.log(`Deleted ${deletedEvents.length} events with "${variation}":`, deletedEvents.map(e => e.title))
    }
  }
  
  // Search and delete assignments
  for (const variation of courseVariations) {
    console.log(`Searching for assignments with variation: "${variation}"`)
    
    const { data: deletedAssignments, error: assignmentsError } = await supabase
      .from('assignments')
      .delete()
      .eq('user_id', userId)
      .or(`course.ilike.%${variation}%,title.ilike.%${variation}%,description.ilike.%${variation}%`)
      .select('id, title, course')
    
    if (!assignmentsError && deletedAssignments && deletedAssignments.length > 0) {
      totalAssignmentsDeleted += deletedAssignments.length
      console.log(`Deleted ${deletedAssignments.length} assignments with "${variation}":`, deletedAssignments.map(a => `${a.title} (${a.course})`))
    }
  }
  
  return `Deleted course "${courseName}": removed ${totalEventsDeleted} events and ${totalAssignmentsDeleted} assignments`
}

function getCourseVariations(courseName: string): string[] {
  const variations = new Set<string>()
  
  // Add original name
  variations.add(courseName)
  variations.add(courseName.toLowerCase())
  variations.add(courseName.toUpperCase())
  
  // Course mapping
  const courseMap: {[key: string]: string[]} = {
    'MoM': ['Mechanics of Materials', 'Mechanics of Material', 'MoM', 'mom'],
    'DSP': ['Digital Signal Processing', 'DSP', 'dsp'],
    'EMT': ['Electromagnetic Theory', 'EMT', 'emt'],
    'ODE': ['Ordinary Differential Equations', 'ODE', 'ode'],
    'SLS': ['Second Language Studies', 'SLS', 'sls'],
    'Machine Shop': ['Exercise for Machine Shop Practice', 'Machine Shop', 'machine shop'],
    'C Programming': ['Introduction to C Programming', 'C Programming', 'c programming']
  }
  
  // Check if input matches any abbreviation or full name
  for (const [abbrev, fullNames] of Object.entries(courseMap)) {
    if (courseName.toLowerCase() === abbrev.toLowerCase() || 
        fullNames.some(name => name.toLowerCase() === courseName.toLowerCase())) {
      fullNames.forEach(name => {
        variations.add(name)
        variations.add(name.toLowerCase())
        variations.add(name.toUpperCase())
      })
      variations.add(abbrev)
      variations.add(abbrev.toLowerCase())
      variations.add(abbrev.toUpperCase())
    }
  }
  
  return Array.from(variations)
}

async function handleDeleteMeeting(parameters: any, userId: string): Promise<string> {
  const { date, title } = parameters
  
  // Find and delete meetings on the specified date
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  let query = supabase
    .from('events')
    .delete()
    .eq('user_id', userId)
    .gte('start_date', startOfDay.toISOString())
    .lte('start_date', endOfDay.toISOString())

  // If title is specified, filter by title
  if (title) {
    query = query.ilike('title', `%${title}%`)
  }

  const { data: deletedEvents, error } = await query.select('id')

  const eventCount = deletedEvents?.length || 0
  
  if (title) {
    return `Deleted ${eventCount} meetings containing "${title}" on ${date}`
  } else {
    return `Deleted ${eventCount} meetings on ${date}`
  }
}

function isAssignmentEvent(event: any): boolean {
  const title = event.title.toLowerCase()
  const assignmentKeywords = [
    'due', 'deadline', 'assignment', 'homework', 'report', 
    'essay', 'project', 'quiz', 'exam', 'test', 'presentation',
    'submission', 'deliverable', 'problem set', 'exercise due',
    'lecture due', 'vocab', 'vocabulary'
  ]
  
  // Check if the event time is 23:59 (typical assignment deadline time)
  const isDeadlineTime = event.start_date && event.start_date.includes('23:59')
  
  return assignmentKeywords.some(keyword => title.includes(keyword)) || isDeadlineTime
}

function extractCourseFromTitle(title: string): string {
  // Extract course name from titles like "MoM Homework Due" or "Machine Shop Report"
  const cleanTitle = title.replace(/(Due|Deadline|Assignment|Homework|Report|Essay|Project|Quiz|Exam|Test|Presentation)/gi, '').trim()
  
  // Common course abbreviations
  const courseMap: {[key: string]: string} = {
    'MoM': 'Mechanics of Materials',
    'DSP': 'Digital Signal Processing', 
    'EMT': 'Electromagnetic Theory',
    'ODE': 'Ordinary Differential Equations',
    'SLS': 'Second Language Studies',
    'Machine Shop': 'Exercise for Machine Shop Practice',
    'C Programming': 'Introduction to C Programming'
  }
  
  for (const [abbrev, fullName] of Object.entries(courseMap)) {
    if (cleanTitle.includes(abbrev)) {
      return fullName
    }
  }
  
  return cleanTitle || 'General'
}

function determineAssignmentType(title: string): string {
  const lowerTitle = title.toLowerCase()
  
  if (lowerTitle.includes('homework')) return 'homework'
  if (lowerTitle.includes('report')) return 'report'
  if (lowerTitle.includes('essay')) return 'essay'
  if (lowerTitle.includes('project')) return 'project'
  if (lowerTitle.includes('quiz')) return 'quiz'
  if (lowerTitle.includes('exam') || lowerTitle.includes('test')) return 'exam'
  if (lowerTitle.includes('presentation')) return 'presentation'
  if (lowerTitle.includes('vocabulary')) return 'vocabulary'
  if (lowerTitle.includes('programming')) return 'programming'
  
  return 'assignment'
}
