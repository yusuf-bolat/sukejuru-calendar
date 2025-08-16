// chatbot.js
// Handles the AI chatbot logic for the calendar webapp

// Get OpenAI API key - now handled securely on server
async function getOpenAIApiKey() {
  // API key is now handled server-side for security
  // This function is kept for compatibility but always returns true
  return 'server-side-handled';
}

// Load courses.json at startup for AI prompt
window.coursesList = [];
fetch('courses.json')
  .then(res => res.json())
  .then(data => { window.coursesList = data; });

// Chatbot logic
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

function appendMessage(sender, text) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'chat-user' : 'chat-bot';
  
  // Create separate elements for label and message
  const label = document.createElement('span');
  label.className = sender === 'user' ? 'chat-user-label' : 'chat-bot-label';
  label.textContent = sender === 'user' ? 'You: ' : 'Consultant: ';
  label.style.fontWeight = 'bold';
  label.style.color = sender === 'user' ? '#0066cc' : '#2d5a27';
  label.style.marginRight = '8px';
  
  const message = document.createElement('span');
  message.className = 'chat-message-text';
  message.textContent = text;
  
  div.appendChild(label);
  div.appendChild(message);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoading() {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-loading';
  loadingDiv.id = 'chat-loading';
  loadingDiv.innerHTML = 'Consultant is thinking <span></span><span></span><span></span>';
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideLoading() {
  const loadingDiv = document.getElementById('chat-loading');
  if (loadingDiv) loadingDiv.remove();
}

// Show greeting on load
appendMessage('bot', 'Hello! I am your student calendar consultant. I can help you schedule activities, manage events, and export them to Google Calendar. Try saying "Add volleyball practice Thursday 7pm" or "export to google calendar"!');

async function askChatGPT(message, calendar, options = {}) {
  // API key is now handled securely server-side
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    appendMessage('bot', '❌ Server configuration error. Please check the deployment.');
    return;
  }
  
  const today = new Date();
  const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];
  const systemPrompt = [
    'You are a helpful university student consultant.',
    'Help students build a monthly calendar.',
    'Today is ' + today.toISOString().split('T')[0] + '. Always use this as the reference date for scheduling events.',
    'You have access to the following list of courses:',
    // List all course names and short_names from courses.json
    ...((window.coursesList && window.coursesList.length) ? window.coursesList.map(c => `- ${c.course}${c.short_name ? ' (' + c.short_name + ')' : ''}`) : []),
    'IMPORTANT: When the user describes an activity, you must determine if they are referring to an actual course from the list above.',
    'Only treat it as a course if the user EXPLICITLY mentions a course name or short name from the list above.',
    'Activities like "volleyball practice", "gym session", "study group", "meeting" are NOT courses unless they exactly match a course name.',
    'If it matches a course, respond in JSON with the course schedule (lecture/exercise) as defined in the course list.',
    'If it does NOT match any course, treat it as a general event and respond in JSON with the event details (title, start date, end date, description) based on the user input.',
    'If the user omits the activity title but provides a description (e.g., "Lecture on Thursday from 4pm to 5pm"), use the main activity word (e.g., "Lecture") as the title.',
    'If the user omits both the date and the activity title (e.g., just types "from 4pm to 5pm"), ask for the missing info in a short, direct question.',
    'If the user mentions a weekday (e.g., Thursday), always use the specified current date as the reference and add the event to the next closest such weekday from today (never use a date before today), and repeat it only once (add one event).',
    'Do NOT provide any suggestions or advice.'
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  try {
    // Call our secure serverless function instead of OpenAI directly
    const res = await fetch('/api/openai-edge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`API Error: ${errorData.error || 'Unknown error'}`);
    }

    const data = await res.json();
    hideLoading();
    let botText = data.choices?.[0]?.message?.content || '';
    let responded = false;
    
    // Remove code block markers if present
    let cleanText = botText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    }
    
    // Try to parse JSON response
    let events = [];
    let isValidJson = false;
    try {
      const parsed = JSON.parse(cleanText);
      isValidJson = true;
      
      // Handle different JSON structures from AI
      if (Array.isArray(parsed)) {
        events = parsed;
      } else if (parsed.events) {
        events = parsed.events;
      } else if (parsed.event) {
        events = [parsed.event]; // Convert single event to array
      } else if (parsed.title && parsed.start) {
        events = [parsed]; // Direct event object
      } else {
        events = [];
        isValidJson = false; // Not a valid event JSON
      }
    } catch (e) {
      isValidJson = false;
      // fallback: try to extract events from text
    }
    // Handle both auto-detection and forced general events
    if (options && (options.isCourse === false || options.isCourse === 'auto')) {
      // If bot is asking for missing info, set pendingGeneralEvent
      if (!responded && botText && /specify|provide|what is|when do you/i.test(botText)) {
        pendingGeneralEvent = true;
      } else {
        pendingGeneralEvent = false;
      }
      
      // Check if AI returned course information (not a general event)
      if (options.isCourse === 'auto') {
        try {
          const courseCheck = JSON.parse(cleanText);
          if (courseCheck.course || courseCheck.schedule) {
            // This is course-related JSON - handle as course
            const courses = await loadCourses();
            const courseName = courseCheck.course || '';
            
            // Find matching course by name or short name
            const matchedCourse = courses.find(c => 
              courseName.toLowerCase().includes(c.course.toLowerCase()) ||
              courseName.toLowerCase().includes(c.short_name.toLowerCase()) ||
              c.course.toLowerCase().includes(courseName.toLowerCase()) ||
              c.short_name.toLowerCase().includes(courseName.toLowerCase())
            );
            
            if (matchedCourse) {
              // Check if course needs group selection
              let needsGroup = false;
              let groupNames = [];
              if (matchedCourse.lecture && typeof matchedCourse.lecture === 'object' && !Array.isArray(matchedCourse.lecture)) {
                needsGroup = true;
                groupNames = Object.keys(matchedCourse.lecture);
              }
              if (matchedCourse.exercise && typeof matchedCourse.exercise === 'object' && !Array.isArray(matchedCourse.exercise)) {
                needsGroup = true;
                Object.keys(matchedCourse.exercise).forEach(g => {
                  if (!groupNames.includes(g)) groupNames.push(g);
                });
              }
              
              if (needsGroup && groupNames.length > 0) {
                pendingCourse = matchedCourse;
                appendMessage('bot', `Which group are you in for ${matchedCourse.short_name}? ${groupNames.join(' or ')}?`);
                return;
              } else {
                // Add course directly
                await addCourseToCalendar(matchedCourse, null, calendar);
                appendMessage('bot', `Added ${matchedCourse.short_name} schedule.`);
                return;
              }
            } else {
              // Course not found in our database
              appendMessage('bot', `I couldn't find the course "${courseName}" in our database. Could you try with the full course name or short name?`);
              return;
            }
          }
        } catch (e) {
          // Not course JSON, continue with general event processing
        }
      }
      
      // For general events, just add them directly - trust AI's course detection from system prompt
      // The AI system prompt is responsible for determining if user input is course-related or not
      
      if (events && events.length) {
        // Process each event asynchronously
        for (const ev of events) {
          const startRaw = ev.start || ev["start date"] || ev.start_date;
          const endRaw = ev.end || ev["end date"] || ev.end_date;
          if (ev.title && startRaw) {
            try {
              // Normalize dates and default end to +1 hour if missing/invalid, interpreting naive strings as local time
              const startDate = parseLocalDateTime(startRaw);
              if (!startDate) throw new Error('Invalid start date');
              let endDate = null;
              if (endRaw) {
                const tmp = parseLocalDateTime(endRaw);
                endDate = tmp || null;
              }
              if (!endDate) {
                endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
              }
              const startISO = startDate.toISOString();
              const endISO = endDate.toISOString();

              const eventData = {
                title: ev.title,
                start: startISO,
                end: endISO,
                allDay: false,
                backgroundColor: '#6f42c1',
                description: ev.description || ''
              };
              
              // Save to Supabase
              const savedEvent = await window.authSystem.createEvent(eventData);
              
              // Add to calendar
              calendar.addEvent({
                id: savedEvent.id,
                title: savedEvent.title,
                start: savedEvent.start_date,
                end: savedEvent.end_date,
                allDay: savedEvent.all_day,
                backgroundColor: savedEvent.color,
                extendedProps: {
                  description: savedEvent.description
                }
              });
            } catch (error) {
              console.error('Error saving event:', error);
              // Fallback to local calendar only
              try {
                const startDate = parseLocalDateTime(startRaw) || new Date();
                let endDate = endRaw ? (parseLocalDateTime(endRaw) || new Date(startDate.getTime() + 60 * 60 * 1000)) : new Date(startDate.getTime() + 60 * 60 * 1000);
                calendar.addEvent({
                  title: ev.title,
                  start: startDate,
                  end: endDate,
                  description: ev.description,
                  backgroundColor: '#6f42c1',
                  borderColor: '#5a2d91',
                  textColor: '#ffffff'
                });
              } catch (_) {
                // As a last resort, add with raw values
                calendar.addEvent({
                  title: ev.title,
                  start: startRaw,
                  end: endRaw,
                  description: ev.description,
                  backgroundColor: '#6f42c1',
                  borderColor: '#5a2d91',
                  textColor: '#ffffff'
                });
              }
            }
          }
        }
        appendMessage('bot', `Added ${events.length} event(s) to your calendar.`);
        responded = true;
        pendingGeneralEvent = false; // Clear flag when event is added
      }
      if (!responded) {
        // Debug information
        console.log('API Response Debug:', {
          botText: botText,
          cleanText: cleanText,
          apiKey: apiKey ? 'Present' : 'Missing',
          data: data
        });
        
        // Check if response contains JSON that should be processed
        if (botText.trim().includes('{') && botText.trim().includes('}')) {
          try {
            // Try to extract and parse JSON from the response
            const jsonMatch = botText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              const parsed = JSON.parse(jsonStr);
              if (parsed.course || parsed.title || parsed.schedule) {
                // Don't show raw JSON, show a user-friendly message
                appendMessage('bot', 'I found some schedule information. Let me check if I can add it to your calendar.');
                return;
              }
            }
          } catch (e) {
            // If JSON parsing fails, treat as regular text
          }
        }
        
        if (botText.trim()) {
          // Filter out raw JSON responses
          const cleanResponse = botText.trim();
          if (!cleanResponse.startsWith('{') && !cleanResponse.includes('"course"') && !cleanResponse.includes('"schedule"')) {
            appendMessage('bot', cleanResponse);
          } else {
            appendMessage('bot', 'I understand you want to add something to your calendar. Could you provide more details about the event, like the name, date, and time?');
          }
        } else {
          appendMessage('bot', 'I need more information to add your activity. Could you specify the name, date, or time?');
        }
      }
      return;
    }
    // Otherwise, fallback to old logic (for course-related AI fallback)
    if (events && events.length) {
      events.forEach(ev => {
        const start = ev.start || ev["start date"] || ev.start_date;
        const end = ev.end || ev["end date"] || ev.end_date;
        if (ev.title && start) {
          calendar.addEvent({
            title: ev.title,
            start: start,
            end: end,
            description: ev.description,
            backgroundColor: '#6f42c1', // Purple for general activities
            borderColor: '#5a2d91',
            textColor: '#ffffff'
          });
        }
      });
      appendMessage('bot', `Added ${events.length} event(s) to your calendar.`);
      responded = true;
    }
    if (!responded) {
      // Check if response contains JSON that should be processed
      if (botText.trim().includes('{') && botText.trim().includes('}')) {
        try {
          // Try to extract and parse JSON from the response
          const jsonMatch = botText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            if (parsed.course || parsed.title || parsed.schedule) {
              // Don't show raw JSON, show a user-friendly message
              appendMessage('bot', 'I found some schedule information. Let me process that for you.');
              return;
            }
          }
        } catch (e) {
          // If JSON parsing fails, treat as regular text
        }
      }
      
      if (botText.trim()) {
        // Filter out raw JSON responses
        const cleanResponse = botText.trim();
        if (!cleanResponse.startsWith('{') && !cleanResponse.includes('"course"') && !cleanResponse.includes('"schedule"')) {
          appendMessage('bot', cleanResponse);
        } else {
          appendMessage('bot', 'I understand you want to add something to your calendar. Could you provide more details about the event?');
        }
      } else {
        appendMessage('bot', 'I need more information to add your activity. Could you specify the name, date, or time?');
      }
    }
  } catch (err) {
    hideLoading();
    console.error('ChatGPT API Error:', err);
    
    // Check if it's an API key issue
    if (err.message && err.message.includes('401')) {
      appendMessage('bot', '❌ API key error. Please check your OpenAI API key configuration.');
    } else if (err.message && err.message.includes('quota')) {
      appendMessage('bot', '❌ OpenAI API quota exceeded. Please check your usage limits.');
    } else {
      appendMessage('bot', `❌ Error connecting to AI: ${err.message || 'Unknown error'}. Please try again.`);
    }
  }
}

// Utility to load courses.json
async function loadCourses() {
  const res = await fetch('courses.json');
  return await res.json();
}

// Utility to add course schedule to calendar
async function addCourseToCalendar(course, group, calendar) {
  // helper to persist then add
  async function saveAndAdd({ title, startDate, endDate, description, color }) {
    try {
      const saved = await window.authSystem.createEvent({
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: false,
        backgroundColor: color,
        description: description || ''
      });
      calendar.addEvent({
        id: saved.id,
        title: saved.title,
        start: saved.start_date,
        end: saved.end_date,
        allDay: saved.all_day,
        backgroundColor: saved.color,
        extendedProps: { description: saved.description }
      });
    } catch (e) {
      console.error('Failed to persist course event, adding locally:', e);
      calendar.addEvent({
        title,
        start: startDate,
        end: endDate,
        description,
        backgroundColor: color,
        borderColor: color,
        textColor: '#ffffff'
      });
    }
  }

  // Handle lectures
  if (course.lecture) {
    if (typeof course.lecture === 'object' && !Array.isArray(course.lecture)) {
      // Grouped lectures
      if (course.lecture[group]) {
        for (const [lecturer, day, start, end] of course.lecture[group]) {
          const startDate = nextWeekdayDate(day, start);
          const endDate = nextWeekdayDate(day, end);
          await saveAndAdd({
            title: `${course.short_name} Lecture`,
            startDate,
            endDate,
            description: `Lecturer: ${lecturer}`,
            color: '#3788d8'
          });
        }
      }
    } else {
      // Single array
      for (const [lecturer, day, start, end] of course.lecture) {
        const startDate = nextWeekdayDate(day, start);
        const endDate = nextWeekdayDate(day, end);
        await saveAndAdd({
          title: `${course.short_name} Lecture`,
          startDate,
          endDate,
          description: `Lecturer: ${lecturer}`,
          color: '#3788d8'
        });
      }
    }
  }
  // Handle exercises
  if (course.exercise) {
    if (typeof course.exercise === 'object' && !Array.isArray(course.exercise)) {
      // Grouped exercises
      if (course.exercise[group]) {
        for (const [lecturer, day, start, end] of course.exercise[group]) {
          const startDate = nextWeekdayDate(day, start);
          const endDate = nextWeekdayDate(day, end);
          await saveAndAdd({
            title: `${course.short_name} Exercise`,
            startDate,
            endDate,
            description: `Lecturer: ${lecturer}`,
            color: '#28a745'
          });
        }
      }
    } else {
      // Single array
      for (const [lecturer, day, start, end] of course.exercise) {
        const startDate = nextWeekdayDate(day, start);
        const endDate = nextWeekdayDate(day, end);
        await saveAndAdd({
          title: `${course.short_name} Exercise`,
          startDate,
          endDate,
          description: `Lecturer: ${lecturer}`,
          color: '#28a745'
        });
      }
    }
  }
}

// Utility to get next date for a weekday from today
function nextWeekdayDate(weekday, time) {
  const days = {
    'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0
  };
  const today = new Date();
  let dayNum = days[weekday];
  let result = new Date(today);
  result.setHours(...time.split(':').map(Number), 0, 0);
  let diff = (dayNum - today.getDay() + 7) % 7;
  if (diff === 0 && result < today) diff = 7;
  result.setDate(today.getDate() + diff);
  return result;
}

// Intercept user input for course selection
let pendingCourse = null;
let pendingGroup = null;
let pendingClashEvents = null;
let pendingClashMsg = '';
let pendingGeneralEvent = false; // Track if waiting for general event info

// Utility to check for event clashes
function checkClashes(events, calendar) {
  let clashes = [];
  events.forEach(ev => {
    let evStart = new Date(ev.start);
    let evEnd = new Date(ev.end);
    let overlapping = calendar.getEvents().some(existing => {
      let exStart = new Date(existing.start);
      let exEnd = new Date(existing.end);
      // Overlap if start < existing end and end > existing start
      return evStart < exEnd && evEnd > exStart;
    });
    if (overlapping) {
      clashes.push(ev.title + ' (' + evStart.toLocaleString() + ' - ' + evEnd.toLocaleString() + ')');
    }
  });
  return clashes;
}

// Utility to delete events by name
function deleteEvent(eventName, calendar) {
  const allEvents = calendar.getEvents();
  const matchingEvents = allEvents.filter(event => 
    event.title.toLowerCase().includes(eventName.toLowerCase())
  );
  
  if (matchingEvents.length === 0) {
    appendMessage('bot', `No events found matching "${eventName}". Try checking the exact event name.`);
    return;
  }
  
  if (matchingEvents.length === 1) {
    const event = matchingEvents[0];
    event.remove();
    appendMessage('bot', `Deleted "${event.title}".`);
    return;
  }
  
  // Multiple matches - delete all and inform user
  matchingEvents.forEach(event => event.remove());
  appendMessage('bot', `Deleted ${matchingEvents.length} events matching "${eventName}": ${matchingEvents.map(e => e.title).join(', ')}.`);
}

// Utility to handle update/change commands
async function handleUpdateCommand(msg, calendar) {
  const lowerMsg = msg.toLowerCase();
  
  // Check for course group changes (e.g., "change machine shop from group B to A")
  const courseGroupMatch = lowerMsg.match(/(change|update|modify)?\s*(.+?)\s*from\s*group\s*([AB])\s*to\s*([AB])/i);
  if (courseGroupMatch) {
    const courseName = courseGroupMatch[2].trim();
    const fromGroup = `Group ${courseGroupMatch[3].toUpperCase()}`;
    const toGroup = `Group ${courseGroupMatch[4].toUpperCase()}`;
    
    await updateCourseGroup(courseName, fromGroup, toGroup, calendar);
    return;
  }
  
  // Check for time changes (e.g., "change volleyball practice time from 7pm-9pm to 8pm-10pm")
  const timeChangeMatch = lowerMsg.match(/(change|update|modify)?\s*(.+?)\s*time\s*from\s*(.+?)\s*to\s*(.+)/i);
  if (timeChangeMatch) {
    const eventName = timeChangeMatch[2].trim();
    const fromTime = timeChangeMatch[3].trim();
    const toTime = timeChangeMatch[4].trim();
    
    await updateEventTime(eventName, fromTime, toTime, calendar);
    return;
  }
  
  // Check for general time changes without "time" keyword (e.g., "change volleyball practice from 7pm-9pm to 8pm-10pm")
  const generalTimeMatch = lowerMsg.match(/(change|update|modify)?\s*(.+?)\s*from\s*(\d+(?::\d+)?(?:am|pm)?(?:\s*-\s*\d+(?::\d+)?(?:am|pm)?)?)\s*to\s*(\d+(?::\d+)?(?:am|pm)?(?:\s*-\s*\d+(?::\d+)?(?:am|pm)?)?)/i);
  if (generalTimeMatch) {
    const eventName = generalTimeMatch[2].trim();
    const fromTime = generalTimeMatch[3].trim();
    const toTime = generalTimeMatch[4].trim();
    
    await updateEventTime(eventName, fromTime, toTime, calendar);
    return;
  }
  
  // If no specific pattern matched, provide guidance
  appendMessage('bot', 'I can help you update events! Try these formats:\n• "change [course] from group A to B"\n• "change [event] time from [old time] to [new time]"\n• Examples: "change machine shop from group B to A" or "change volleyball practice from 7pm-9pm to 8pm-10pm"');
}

// Update course group (delete old group events and add new group events)
async function updateCourseGroup(courseName, fromGroup, toGroup, calendar) {
  const courses = await loadCourses();
  const matchedCourse = courses.find(c => 
    courseName.includes(c.course.toLowerCase()) ||
    courseName.includes(c.short_name.toLowerCase()) ||
    c.course.toLowerCase().includes(courseName) ||
    c.short_name.toLowerCase().includes(courseName)
  );
  
  if (!matchedCourse) {
    appendMessage('bot', `I couldn't find a course matching "${courseName}". Please check the course name.`);
    return;
  }
  
  // Find and delete events from the old group
  const allEvents = calendar.getEvents();
  const oldEvents = allEvents.filter(event => 
    event.title.includes(matchedCourse.short_name)
  );
  
  if (oldEvents.length === 0) {
    appendMessage('bot', `No events found for ${matchedCourse.short_name}. Add the course first, then change groups.`);
    return;
  }
  
  // Remove old events (calendar + DB)
  for (const event of oldEvents) {
    try {
      if (event.id) {
        await window.authSystem.deleteEvent(event.id);
      }
    } catch (e) {
      console.warn('Failed to delete event from DB, removing locally:', e);
    }
    event.remove();
  }
  
  // Add new group events (persisting to DB)
  await addCourseToCalendar(matchedCourse, toGroup, calendar);
  
  appendMessage('bot', `Updated ${matchedCourse.short_name} from ${fromGroup} to ${toGroup}.`);
}

// Update event time
async function updateEventTime(eventName, fromTime, toTime, calendar) {
  const allEvents = calendar.getEvents();
  const matchingEvents = allEvents.filter(event => 
    event.title.toLowerCase().includes(eventName.toLowerCase())
  );
  
  if (matchingEvents.length === 0) {
    appendMessage('bot', `No events found matching "${eventName}".`);
    return;
  }
  
  // Parse new time range
  const newTimes = parseTimeRange(toTime);
  if (!newTimes) {
    appendMessage('bot', `I couldn't understand the new time "${toTime}". Please use format like "7pm-9pm" or "19:00-21:00".`);
    return;
  }
  
  let updatedCount = 0;
  matchingEvents.forEach(event => {
    const eventDate = new Date(event.start);
    const newStart = new Date(eventDate);
    const newEnd = new Date(eventDate);
    
    // Set new times
    newStart.setHours(newTimes.startHour, newTimes.startMinute, 0, 0);
    newEnd.setHours(newTimes.endHour, newTimes.endMinute, 0, 0);
    
    // Update the event
    event.setStart(newStart);
    event.setEnd(newEnd);
    updatedCount++;
  });
  
  appendMessage('bot', `Updated ${updatedCount} event(s) matching "${eventName}" to new time ${toTime}.`);
}

// Utility to parse time range like "7pm-9pm" or "19:00-21:00"
function parseTimeRange(timeStr) {
  // Handle formats like "7pm-9pm", "7:30pm-9:30pm", "19:00-21:00"
  const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?\s*-\s*(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (!timeMatch) return null;
  
  let startHour = parseInt(timeMatch[1]);
  const startMinute = parseInt(timeMatch[2] || '0');
  const startPeriod = timeMatch[3];
  
  let endHour = parseInt(timeMatch[4]);
  const endMinute = parseInt(timeMatch[5] || '0');
  const endPeriod = timeMatch[6];
  
  // Convert to 24-hour format
  if (startPeriod) {
    if (startPeriod.toLowerCase() === 'pm' && startHour !== 12) startHour += 12;
    if (startPeriod.toLowerCase() === 'am' && startHour === 12) startHour = 0;
  }
  
  if (endPeriod) {
    if (endPeriod.toLowerCase() === 'pm' && endHour !== 12) endHour += 12;
    if (endPeriod.toLowerCase() === 'am' && endHour === 12) endHour = 0;
  } else if (startPeriod) {
    // If start has period but end doesn't, assume same period for end
    if (startPeriod.toLowerCase() === 'pm' && endHour !== 12) endHour += 12;
    if (startPeriod.toLowerCase() === 'am' && endHour === 12) endHour = 0;
  }
  
  return { startHour, startMinute, endHour, endMinute };
}

async function handleUserInput(msg, calendar) {
  // Check for Google Calendar export commands
  if (/^(export|sync)\s*(to\s*)?(google\s*calendar|gcal)/i.test(msg) || /export.*google/i.test(msg)) {
    // Debug logs
    const exportBtn = document.getElementById('gcal-export-btn');
    const userInfo = document.getElementById('gcal-user-info');
    const signInBtn = document.getElementById('gcal-signin-btn');
    
    console.log('Export command detected');
    console.log('Export button:', exportBtn, exportBtn?.style.display, exportBtn?.offsetParent);
    console.log('User info:', userInfo, userInfo?.style.display);
    console.log('Sign in button:', signInBtn, signInBtn?.style.display);
    
    // Check if user is signed in using multiple methods
    const isSignedIn = (exportBtn && exportBtn.style.display === 'inline-block') ||
                      (exportBtn && exportBtn.offsetParent !== null) ||
                      (userInfo && userInfo.style.display === 'flex') ||
                      (signInBtn && signInBtn.style.display === 'none');
    
    console.log('Is signed in:', isSignedIn);
    
    if (isSignedIn) {
      // User is signed in, trigger export
      appendMessage('bot', '📤 Starting export process...');
      if (typeof exportCalendarToGoogle === 'function') {
        try {
          exportCalendarToGoogle();
        } catch (error) {
          console.error('Export error:', error);
          appendMessage('bot', '❌ Export failed. Please try clicking the "Export to Google Calendar" button instead.');
        }
      } else {
        appendMessage('bot', '❌ Export function is not available. Please try clicking the "Export to Google Calendar" button instead.');
      }
    } else {
      // User is not signed in
      appendMessage('bot', '🔐 To export to Google Calendar, please first click "Connect Google Calendar" button above, then try the export command again.');
    }
    return;
  }
  
  // Check for Google Calendar connection commands
  if (/^(connect|sign\s*in|login).*google/i.test(msg) || /google.*connect/i.test(msg)) {
    appendMessage('bot', 'Please click the "Connect Google Calendar" button above to sign in with your Google account.');
    return;
  }
  
  // Check for update/change commands
  if (/^(update|change|modify)\s+|want to change|want to update/i.test(msg)) {
    await handleUpdateCommand(msg, calendar);
    return;
  }
  
  // Check for delete command
  if (/^delete\s+/i.test(msg)) {
    const eventName = msg.replace(/^delete\s+/i, '').trim();
    if (eventName) {
      deleteEvent(eventName, calendar);
      return;
    } else {
      appendMessage('bot', 'Please specify what you want to delete. For example: "delete volleyball practice"');
      return;
    }
  }
  
  // Check if waiting for group
  if (pendingCourse && !pendingGroup) {
    let group = null;
    if (/A|Monday/i.test(msg)) group = 'Group A';
    if (/B|Thursday/i.test(msg)) group = 'Group B';
    if (group) {
      hideLoading();
      addCourseToCalendar(pendingCourse, group, calendar);
      appendMessage('bot', `Added ${pendingCourse.short_name} schedule for ${group}.`);
      pendingCourse = null;
      pendingGroup = null;
    } else {
      hideLoading();
      appendMessage('bot', 'Please specify your group: A (Monday) or B (Thursday).');
    }
    return;
  }
  // If waiting for general event info, always pass to AI and skip course logic
  if (pendingGeneralEvent) {
    showLoading();
    askChatGPT(msg, calendar, {isCourse: false});
    return;
  }
  // Let AI handle ALL course detection and event creation
  showLoading();
  askChatGPT(msg, calendar, {isCourse: 'auto'});
}

// Parse a datetime string as LOCAL time when no timezone is provided
function parseLocalDateTime(input) {
  if (!input) return null;
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === 'number') return new Date(input);
  let str = String(input).trim();
  // If explicit numeric offset (+09:00 or -0700), trust it
  if (/[+\-]\d{2}:?\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d) ? null : d;
  }
  // If ends with 'Z' (UTC) but user likely means local, strip it and treat as local
  if (/[zZ]$/.test(str)) {
    str = str.replace(/[zZ]$/, '');
  }
  // Match forms: YYYY-MM-DD, YYYY-MM-DDTHH:mm[:ss], or with space instead of T
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    return isNaN(dt) ? null : dt;
  }
  // Fallback to native parsing
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// Send button logic - robust binding
function bindSendControls() {
  const inputEl = document.getElementById('chat-input');
  const btnEl = document.getElementById('send-btn');
  if (!btnEl || !inputEl) return;
  if (btnEl.dataset.bound === '1') return; // prevent duplicate bindings

  const onSend = () => {
    const msg = inputEl.value.trim();
    if (!msg) return;
    appendMessage('user', msg);
    inputEl.value = '';
    handleUserInput(msg, window.calendar);
  };

  btnEl.addEventListener('click', onSend);
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') onSend();
  });
  btnEl.dataset.bound = '1';
}

// Bind send button controls on DOMContentLoaded
document.addEventListener('DOMContentLoaded', bindSendControls);
