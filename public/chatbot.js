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

// Also load semesters (for schedule generation)
window.semestersList = [];
fetch('semesters.json')
  .then(res => res.ok ? res.json() : [])
  .then(data => { window.semestersList = Array.isArray(data) ? data : []; })
  .catch(() => { window.semestersList = []; });

// Chatbot logic
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Add helpers and send handler
async function pingJSON(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch { return false; }
}

function randomAck(extra) {
  const arr = ['Done', 'All set', 'Great', 'Okay', 'Got it', 'Success'];
  const pick = arr[Math.floor(Math.random() * arr.length)];
  return extra ? `${pick}, ${extra}` : pick;
}

async function clearAllEvents(calendar) {
  try { await window.authSystem?.deleteAllEvents?.(); } catch {}
  try {
    if (calendar && typeof calendar.getEvents === 'function') {
      calendar.getEvents().forEach(ev => ev.remove());
    }
  } catch {}
  appendMessage('bot', 'All events deleted.');
}

async function handleSend() {
  const text = (chatInput?.value || '').trim();
  if (!text) return;
  appendMessage('user', text);
  chatInput.value = '';
  const calendar = window.calendar;

  // Route active wizard answers
  if (typeof scheduleWizard !== 'undefined' && scheduleWizard?.active) {
    const handled = await handleScheduleWizardAnswer(text, calendar);
    if (handled) return;
  }

  const lower = text.toLowerCase();

  // Immediate delete-all/reset commands
  if (/(^|\b)(delete all|reset calendar|clear all)(\b|$)/i.test(lower)) {
    await clearAllEvents(calendar);
    return;
  }

  // Direct date-range daily events
  try {
    const handledRange = await tryHandleRangeEvents(text, calendar);
    if (handledRange) return;
  } catch (e) {
    console.warn('Range handler failed:', e);
  }

  showLoading();
  await askChatGPT(text, calendar);
}

// Wire up button and Enter key
if (sendBtn) sendBtn.addEventListener('click', () => handleSend());
if (chatInput) chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSend();
  }
});

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

// Session memory cache (merged with server memory)
let sessionMemory = { activities: [] }
// Pending draft for multi-turn general events
let pendingDraft = { title: null }

async function loadUserMemory() {
  if (!window.authSystem) return sessionMemory
  try {
    const mem = await window.authSystem.getMemory()
    sessionMemory = (mem && mem.summary_json) ? mem.summary_json : { activities: [] }
  } catch { /* noop */ }
  return sessionMemory
}

function rememberActivity(type, name, startDate, endDate) {
  const schedule = {
    weekday: startDate.toLocaleDateString(undefined, { weekday: 'long' }),
    start: startDate.toTimeString().slice(0,5),
    end: endDate.toTimeString().slice(0,5)
  }
  // upsert into sessionMemory
  const idx = sessionMemory.activities.findIndex(a => a.type === type && a.name === name)
  if (idx >= 0) sessionMemory.activities[idx] = { type, name, schedule }
  else sessionMemory.activities.push({ type, name, schedule })
}

// Extract a likely activity title from a short user message
function extractTitleFromMessage(msg) {
  if (!msg) return null
  let s = msg.trim()
  // remove trailing punctuation
  s = s.replace(/[.!?]$/,'').trim()
  // common leading verbs
  const patterns = [
    /^i\s*(have|do|am\s*doing|want\s*to\s*add|want\s*to\s*schedule|wanna|schedule|add)\s+(.*)$/i,
    /^(please\s*)?(add|schedule)\s+(.*)$/i,
    /^it'?s\s+(.*)$/i
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) return (m[3] || m[2]).trim()
  }
  // if message has weekday or time only, return null
  if (/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(s)) return null
  if (/(\d{1,2})(?::\d{2})?\s*(am|pm)|\d{1,2}:\d{2}/i.test(s)) return null
  // single or two-word activity
  return s.length <= 64 ? s : null
}

// Detect weekday name in text
function detectWeekday(msg) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const found = days.find(d => new RegExp(d, 'i').test(msg))
  return found || null
}

// Parse flexible time expressions like "from 3pm to 5pm", "3pm-5pm", "15:00 to 17:00"
function parseTimeRangeFlexible(text) {
  let m = text.match(/from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
  if (!m) m = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
  if (!m) return null
  const start = m[1].trim()
  const end = m[2].trim()
  // leverage existing parseTimeRange by building canonical string "start-end"
  const r = parseTimeRange(`${start}-${end}`)
  return r
}

// Parse basic "HH[:MM]-HH[:MM]" with optional am/pm on either side
function parseTimeRange(text) {
  if (!text) return null;
  const s = String(text).trim().toLowerCase();
  // Accept forms like "10 am-5 pm", "10:00-17:00", "10am-17pm"
  const m = s.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (!m) return null;
  const toHM = (part, fallbackPeriod) => {
    let p = String(part).trim().toLowerCase();
    const hasAM = /am/.test(p);
    const hasPM = /pm/.test(p);
    p = p.replace(/\s*(am|pm)/g, '').trim();
    let [hStr, minStr] = p.split(':');
    let h = parseInt(hStr, 10);
    let mm = minStr ? parseInt(minStr, 10) : 0;
    // Normalize silly inputs like 17pm => keep 17 if > 12
    if (hasPM || (!hasAM && !hasPM && fallbackPeriod === 'pm')) {
      if (h === 12) h = 12; else if (h <= 11) h += 12; // 1..11 => 13..23; 12pm stays 12
      if (h > 24) h = 24; // guard
    } else if (hasAM || (!hasAM && !hasPM && fallbackPeriod === 'am')) {
      if (h === 12) h = 0; // 12am => 00
    }
    if (h > 24) h = 24;
    if (mm > 59) mm = 59;
    return { h, mm };
  };
  // If only one side has am/pm, use it as fallback for the other if 1..12
  const leftHas = /(am|pm)/.test(m[1].toLowerCase()) ? (m[1].toLowerCase().includes('pm') ? 'pm' : 'am') : null;
  const rightHas = /(am|pm)/.test(m[2].toLowerCase()) ? (m[2].toLowerCase().includes('pm') ? 'pm' : 'am') : null;
  const left = toHM(m[1], leftHas || rightHas);
  const right = toHM(m[2], rightHas || leftHas);
  return { startHour: left.h, startMinute: left.mm, endHour: right.h, endMinute: right.mm };
}

// Parse a variety of local datetime strings into a Date
function parseLocalDateTime(input) {
  if (!input) return null;
  const s = String(input).trim();
  // ISO
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return new Date(s);
  // "YYYY-MM-DD HH:MM"
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (m1) return new Date(`${m1[1]}-${m1[2]}-${m1[3]}T${m1[4]}:${m1[5]}:00`);
  // Month name day [year] [time]
  if (/[a-zA-Z]{3,}\s+\d{1,2}/.test(s)) {
    const tryDate = new Date(s);
    if (!isNaN(tryDate)) return tryDate;
  }
  // Fallback to Date.parse
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseMonthDay(text, baseYear = new Date().getFullYear()) {
  if (!text) return null;
  const months = {
    jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11
  };
  const t = String(text).trim();
  const m = t.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/);
  if (!m) return null;
  const mon = months[m[1].toLowerCase()];
  if (mon == null) return null;
  const day = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : baseYear;
  const d = new Date(year, mon, day, 0, 0, 0, 0);
  return isNaN(d) ? null : d;
}

function parseDateRangeFromText(text) {
  if (!text) return null;
  const m = text.match(/from\s+([^\n]+?)\s+to\s+([^\n]+?)(?:\b|\.|,|$)/i);
  if (!m) return null;
  const now = new Date();
  const y = now.getFullYear();
  const start = parseMonthDay(m[1], y) || parseLocalDateTime(m[1]);
  const end = parseMonthDay(m[2], y) || parseLocalDateTime(m[2]);
  if (!start || !end) return null;
  // Ensure start <= end; if end < start and no explicit years, assume same month typo => swap
  if (end < start) return null;
  return { start, end };
}

function extractTitleForRange(text) {
  const s = String(text||'').trim();
  // Look for "have X from" or "schedule X from"
  let m = s.match(/\b(?:have|schedule|add|set up)\s+(.+?)\s+from\b/i);
  if (m && m[1]) return m[1].replace(/^my\s+/i,'').trim();
  // Or leading noun phrase before ":" or ".":
  m = s.match(/^(.+?)\s+from\b/i);
  if (m && m[1]) return m[1].replace(/^(i\s+have|i\s+need|please\s+add)\s+/i,'').trim();
  return 'Event';
}

async function tryHandleRangeEvents(msg, calendar) {
  const dr = parseDateRangeFromText(msg);
  if (!dr) return false;
  // Extract time range
  let tr = parseTimeRangeFlexible(msg);
  if (!tr) {
    // Try pattern "from <date> to <date> from <time> to <time>"
    const mt = msg.match(/from\s+[^\n]+?\s+to\s+[^\n]+?\s+(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (mt) tr = parseTimeRange(`${mt[1]}-${mt[2]}`);
  }
  if (!tr) return false;

  const titleRaw = extractTitleForRange(msg) || 'Event';
  const title = titleRaw.replace(/\b(sessions)\b/i, 'Session'); // singular per day

  // Iterate from start to end inclusive
  const startDate = new Date(dr.start);
  const endDate = new Date(dr.end);
  let count = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), tr.startHour || 0, tr.startMinute || 0, 0, 0);
    const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), tr.endHour || (tr.startHour+1) || 1, tr.endMinute || 0, 0, 0);
    // Guard invalid reversed times per-day
    if (e <= s) continue;
    try {
      const saved = await window.authSystem.createEvent({
        title: titleRaw, // keep original phrase, can be plural
        start: s.toISOString(),
        end: e.toISOString(),
        allDay: false,
        backgroundColor: '#6f42c1',
        description: ''
      });
      calendar.addEvent({ id: saved.id, title: saved.title, start: saved.start_date, end: saved.end_date, allDay: saved.all_day, backgroundColor: saved.color, extendedProps: { description: saved.description } });
      count++;
    } catch (e1) {
      // Fallback: local add
      calendar.addEvent({ title: titleRaw, start: s, end: e, backgroundColor: '#6f42c1' });
      count++;
    }
  }
  if (count > 0) appendMessage('bot', `${randomAck()} — added ${count} day(s) of ${titleRaw}.`);
  else appendMessage('bot', 'Couldn\'t place those events — please check the dates/times.');
  return true;
}

// ---------- Schedule Generation Wizard ----------
let scheduleWizard = { active: false, step: 'idle', data: {} };

function getNearestSemester(now = new Date()) {
  if (!Array.isArray(window.semestersList) || !window.semestersList.length) return null;
  const withDates = window.semestersList.map(s => ({
    ...s,
    start: new Date(s.start_date + 'T00:00:00'),
    end: new Date(s.end_date + 'T23:59:59')
  }));
  const upcoming = withDates
    .filter(s => s.start >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a,b) => a.start - b.start);
  return upcoming[0] || withDates.sort((a,b)=> b.start - a.start)[0] || null;
}

async function getGraduationYear() {
  try {
    const prof = await (window.authSystem?.getUserProfile?.() || Promise.resolve(null));
    if (prof?.graduation_year) return Number(prof.graduation_year);
  } catch {}
  try {
    const user = await (window.authSystem?.getCurrentUser?.() || Promise.resolve(null));
    const gy = user?.user_metadata?.graduation_year || user?.graduation_year;
    if (gy) return Number(gy);
  } catch {}
  return null;
}

function estimateSemesterFromGrad(gradYear, baseTermYear, baseTermName) {
  if (!gradYear || !baseTermYear) return null;
  // Assume 4-year undergrad, 8 semesters; graduation in Spring of gradYear
  const startYear = gradYear - 4;
  // Fall = first semester of the academic year, Spring = second
  const semInYear = (baseTermName && /spring/i.test(baseTermName)) ? 2 : 1;
  const semNumber = (baseTermYear - startYear) * 2 + semInYear;
  // Clamp to [1,8]
  return Math.max(1, Math.min(8, semNumber));
}

function weekdayIndexByName(name) {
  const map = { 'Sunday':0,'Monday':1,'Tuesday':2,'Wednesday':3,'Thursday':4,'Friday':5,'Saturday':6 };
  return map[name] ?? 0;
}

function dateForWeekdayFrom(baseDate, weekdayName, hhmm, weekOffset = 0) {
  const d = new Date(baseDate);
  // Go to Monday of base week then move to target weekday
  const baseDow = d.getDay();
  const targetDow = weekdayIndexByName(weekdayName);
  const diffToMonday = (baseDow === 0 ? -6 : 1 - baseDow); // shift base to Monday
  d.setDate(d.getDate() + diffToMonday); // now Monday of that week
  const daysToTarget = (targetDow + 7 - 1) % 7; // Monday=1 => 0 offset
  d.setDate(d.getDate() + daysToTarget + weekOffset * 7);
  const [h, m] = (hhmm || '09:00').split(':').map(n => parseInt(n,10));
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function courseTotalCredits(c) {
  const lc = Number(c.lecture_credits || 0);
  const ec = Number(c.exercise_credits || 0);
  return lc + ec;
}

function pickCoursesForSemester(all, semester, targetCredits, maxCredits, prefs = { include: [], exclude: [] }) {
  const norm = s => String(s||'').trim().toLowerCase();
  const includesTerms = (prefs.include || []).map(norm).filter(Boolean);
  const excludesTerms = (prefs.exclude || []).map(norm).filter(Boolean);
  let bySem = all.filter(c => Number(c.semester) === Number(semester));
  // Apply excludes by substring match against name or short_name
  bySem = bySem.filter(c => {
    const name = norm(c.course);
    const short = norm(c.short_name);
    const excluded = excludesTerms.some(ex => ex && (name.includes(ex) || short.includes(ex)));
    return !excluded;
  });

  if (!bySem.length) return { chosen: [], total: 0 };

  // Helper to add a course if it fits within limits
  const chosen = [];
  let total = 0;
  const tryAdd = (c, ignoreCap = false) => {
    const cred = courseTotalCredits(c);
    if (cred <= 0) return;
    if (ignoreCap || total + cred <= maxCredits) {
      if (!chosen.includes(c)) { chosen.push(c); total += cred; }
    }
  };

  // Sem 1 or 2: add all (but still respect excludes); still allow includes to be first
  if (semester === 1 || semester === 2) {
    const incFirst = bySem.filter(c => {
      const name = norm(c.course); const short = norm(c.short_name);
      return includesTerms.some(inc => inc && (name.includes(inc) || short.includes(inc)));
    });
    const rest = bySem.filter(c => !incFirst.includes(c));
    for (const c of incFirst) tryAdd(c, true);
    for (const c of rest) tryAdd(c, true);
    return { chosen, total };
  }

  // Add explicitly included courses for this semester first (respect caps)
  const incList = bySem.filter(c => {
    const name = norm(c.course); const short = norm(c.short_name);
    return includesTerms.some(inc => inc && (name.includes(inc) || short.includes(inc)));
  });
  for (const c of incList) tryAdd(c, false);

  // Then core courses
  const core = bySem.filter(c => (c.level||'').toLowerCase() === 'core' && !incList.includes(c));
  for (const c of core) tryAdd(c, false);

  // Then advanced/electives until target reached
  const adv = bySem.filter(c => (c.level||'').toLowerCase() !== 'core' && !incList.includes(c));
  for (const c of adv) {
    if (total >= targetCredits) break;
    tryAdd(c, false);
  }

  return { chosen, total };
}

async function addCourseWeeks(course, group, baseStart, weeks, calendar) {
  async function save(title, startDate, endDate, description, color) {
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
      // fallback local
      calendar.addEvent({ title, start: startDate, end: endDate, description, backgroundColor: color, borderColor: color, textColor: '#fff' });
    }
  }
  const addBlocks = async (blocks, label, color) => {
    for (let w=0; w<weeks; w++) {
      for (const [lecturer, day, start, end] of blocks) {
        const s = dateForWeekdayFrom(baseStart, day, start, w);
        const e = dateForWeekdayFrom(baseStart, day, end, w);
        await save(`${course.short_name} ${label}`, s, e, `Lecturer: ${lecturer}`, color);
      }
    }
  };
  if (course.lecture) {
    if (typeof course.lecture === 'object' && !Array.isArray(course.lecture)) {
      const grp = group && course.lecture[group] ? group : Object.keys(course.lecture)[0];
      await addBlocks(course.lecture[grp], 'Lecture', '#3788d8');
    } else if (Array.isArray(course.lecture)) {
      await addBlocks(course.lecture, 'Lecture', '#3788d8');
    }
  }
  if (course.exercise) {
    if (typeof course.exercise === 'object' && !Array.isArray(course.exercise)) {
      const grp = group && course.exercise[group] ? group : Object.keys(course.exercise)[0];
      await addBlocks(course.exercise[grp], 'Exercise', '#28a745');
    } else if (Array.isArray(course.exercise)) {
      await addBlocks(course.exercise, 'Exercise', '#28a745');
    }
  }
}

function parseYesNo(s) {
  const t = (s||'').trim().toLowerCase();
  if (/^(y|yes|yeah|yep|sure|ok|okay|please|do it)/i.test(t)) return true;
  if (/^(n|no|nope|nah)/i.test(t)) return false;
  return null;
}

function parseNumber(s) {
  const m = String(s||'').match(/\b(\d{1,2})\b/);
  return m ? Number(m[1]) : null;
}

// Flexible number parser: handles digits and simple word numbers like "five", "fifteen", "twenty one"
function parseNumberFlexible(s) {
  const direct = parseNumber(s);
  if (direct !== null) return direct;
  const t = String(s||'').toLowerCase().replace(/-/g,' ');
  const ones = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9 };
  const teens = { ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
  const tens = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
  let total = 0; let matched = false;
  const words = t.split(/\s+/);
  for (let i=0; i<words.length; i++) {
    const w = words[i];
    if (w in teens) { total += teens[w]; matched = true; continue; }
    if (w in tens) {
      matched = true; total += tens[w];
      // optional unit after tens
      const nxt = words[i+1];
      if (nxt && nxt in ones) { total += ones[nxt]; i++; }
      continue;
    }
    if (w in ones) { total += ones[w]; matched = true; continue; }
  }
  return matched ? total : null;
}

function parseProductive(s) {
  const t = (s||'').toLowerCase();
  if (/morning|morn/i.test(t)) return 'morning';
  if (/afternoon|after/i.test(t)) return 'afternoon';
  if (/evening|night/i.test(t)) return 'evening';
  return null;
}

// Extract includes/excludes from natural text like
// "i want to pick mechlab energy. avoid any course related to chemistry"
function parseCoursePrefsNatural(text) {
  const t = String(text||'');
  const include = [];
  const exclude = [];

  // Excludes: look for "avoid ...", "except ...", "no ...", "not ..."
  const exclMatch = t.match(/\b(avoid|except|no(?:t)?\s+take|not\s+include|without)\b([^\.;\n]*)/i);
  if (exclMatch) {
    let exclRaw = exclMatch[2] || '';
    // handle phrases like "related to chemistry"
    exclRaw = exclRaw.replace(/.*related to\s+/i, '');
    exclRaw.split(/,| and | or |\/|;|\s+&\s+/i).map(s=>s.trim()).filter(Boolean).forEach(x => exclude.push(x));
  }

  // Includes: verbs pointing to choices
  const inclMatches = t.match(/\b(pick|take|choose|enroll(?:\s+in)?|register(?:\s+for)?|want\s+to\s+take|want\s+to\s+pick|want\s+to\s+choose)\b([^\.;\n]*)/ig) || [];
  for (const m of inclMatches) {
    const m2 = m.replace(/^(?:pick|take|choose|enroll(?:\s+in)?|register(?:\s+for)?|want\s+to\s+take|want\s+to\s+pick|want\s+to\s+choose)\b/i,'')
    m2.split(/,| and | or |\/|;|\s+&\s+/i).map(s=>s.trim()).filter(Boolean).forEach(x => include.push(x));
  }

  // Fallback: if sentence starts with "i want" then grab next noun-ish chunk
  if (!include.length) {
    const m = t.match(/i\s+want\s+(?:to\s+)?(?:pick|take|choose)?\s*([^\.;\n]+)/i);
    if (m && m[1]) include.push(m[1].trim());
  }

  // Clean noise words
  const clean = (arr) => arr.map(s => s.replace(/^(?:any|the|a|an)\s+/i,'').trim()).filter(Boolean);
  return { include: clean(include), exclude: clean(exclude) };
}

// Parse user-provided priority order with tolerant natural language, e.g.,
// "first priority is club, then study and then part time job" or "clubs > study > job"
function parsePriorities(input, availableKeys = []) {
  const text = String(input||'').toLowerCase();
  const keys = ['clubs','study','job','project'];
  const synonyms = {
    clubs: [/\bclub(s)?\b/, /\bactivity|activities\b/, /\bsoccer|basketball|volley|tennis|music|band|art\b/],
    study: [/\bstudy|studying|revision|reading\b/],
    job: [/\bjob|work|shift|part\s*-?\s*time|baito\b/],
    project: [/\bproject|research|thesis|capstone|lab work\b/]
  };

  // 1) Try explicit separators first
  const sepSplit = text.split(/>|,|->|→|→| then | after /i).map(s=>s.trim()).filter(Boolean);
  const resolved1 = [];
  if (sepSplit.length) {
    for (let part of sepSplit) {
      for (const k of keys) {
        if (synonyms[k].some(rx => rx.test(part))) {
          if (!resolved1.includes(k)) resolved1.push(k);
          break;
        }
      }
    }
  }

  // 2) Fallback: order by first occurrence in text
  const resolved2 = Object.entries(synonyms)
    .map(([k, arr]) => ({ k, idx: arr.reduce((min, rx) => {
      const m = text.match(rx);
      const i = m ? text.indexOf(m[0]) : -1;
      return (i >= 0 && (min === -1 || i < min)) ? i : min;
    }, -1) }))
    .filter(o => o.idx >= 0)
    .sort((a,b) => a.idx - b.idx)
    .map(o => o.k);

  let order = resolved1.length ? resolved1 : resolved2;
  // De-dup and enforce availability
  const seen = new Set();
  order = order.filter(k => availableKeys.includes(k) && !seen.has(k) && (seen.add(k) || true));

  // Append any missing available keys using a sensible default order
  const defaultOrder = ['clubs','study','job','project'];
  for (const k of defaultOrder) {
    if (availableKeys.includes(k) && !order.includes(k)) order.push(k);
  }
  return order;
}

async function startScheduleWizard(calendar) {
  scheduleWizard = { active: true, step: 'init', data: { calendar } };
  const sem = getNearestSemester();
  if (!sem) {
    scheduleWizard.step = 'needSemesterData';
    appendMessage('bot', "I couldn't find semester dates. Could you tell me when your next semester starts?");
    return;
  }
  scheduleWizard.data.baseSemester = sem;
  const grad = await getGraduationYear();
  const est = grad ? estimateSemesterFromGrad(grad, sem.year || sem.start.getFullYear(), sem.term || sem.name) : null;
  if (est) {
    scheduleWizard.data.semester = est;
    scheduleWizard.step = 'confirmSemester';
    appendMessage('bot', `Looking at ${sem.name}, it seems you're in semester ${est}. Is that right? (yes/no)`);
  } else {
    scheduleWizard.step = 'askSemester';
    appendMessage('bot', `Let me craft your first two weeks from ${sem.start.toLocaleDateString()}. Which semester are you in right now (1-8)?`);
  }
}

async function handleScheduleWizardAnswer(msg, calendar) {
  const wiz = scheduleWizard;
  if (!wiz.active) return false;
  const step = wiz.step;
  const msgNorm = String(msg||'').trim();
  switch (step) {
    case 'confirmSemester': {
      const yn = parseYesNo(msg);
      if (yn === true) { wiz.step = 'askPrefsCourses'; appendMessage('bot', 'Any must-take or avoid courses? If none, say "none".'); return true; }
      if (yn === false) { wiz.step = 'askSemester'; appendMessage('bot', 'No worries — what semester are you in (1-8)?'); return true; }
      appendMessage('bot', 'Please reply yes or no.'); return true;
    }
    case 'askSemester': {
      const n = parseNumberFlexible(msgNorm);
      if (n && n >= 1 && n <= 8) { wiz.data.semester = n; wiz.step = 'askPrefsCourses'; appendMessage('bot', 'Any must-take or avoid courses? If none, say "none".'); }
      else { appendMessage('bot', 'Please enter a number from 1 to 8 for your semester.'); }
      return true;
    }
    case 'askPrefsCourses': {
      const t = msgNorm;
      if (/^none?$/i.test(t)) {
        wiz.data.coursePrefs = { include: [], exclude: [] };
      } else {
        const { include, exclude } = parseCoursePrefsNatural(t);
        wiz.data.coursePrefs = { include, exclude };
      }
      wiz.step = 'askJob';
      appendMessage('bot', 'Do you have a part-time job you want on the schedule? (yes/no)');
      return true;
    }
    case 'askJob': {
      const yn = parseYesNo(msg);
      if (yn === null) { appendMessage('bot', 'Just a quick yes or no — do you have a part-time job?'); return true; }
      wiz.data.hasJob = yn;
      if (yn) { wiz.step = 'askJobHours'; appendMessage('bot', 'About how many hours per week for your job? If unsure, I’ll default to 10.'); }
      else { wiz.step = 'askClubs'; appendMessage('bot', 'Cool. Any clubs or activities to include? e.g., Robotics Club, Soccer. If none, say "none".'); }
      return true;
    }
    case 'askJobHours': {
      const n = parseNumberFlexible(msgNorm);
      wiz.data.jobHours = n && n > 0 ? n : 10;
      wiz.step = 'askClubs';
      appendMessage('bot', 'Got it. Any clubs or activities to include? e.g., Robotics Club, Soccer. If none, say "none".');
      return true;
    }
    case 'askClubs': {
      const t = (msg||'').trim();
      wiz.data.clubs = /none/i.test(t) ? [] : t.split(/,|;| and /i).map(s=>s.trim()).filter(Boolean);
      if ((wiz.data.clubs||[]).length) {
        wiz.step = 'askClubsFixed';
        appendMessage('bot', 'Are your club practice times fixed by the club? (yes/no)');
      } else {
        // go ask about project work next
        wiz.step = 'askProject';
        appendMessage('bot', 'Do you have personal project work to include (e.g., research/thesis/app)? (yes/no)');
      }
      return true;
    }
    case 'askClubsFixed': {
      const yn = parseYesNo(msg);
      if (yn === null) { appendMessage('bot', 'Quick yes or no — are the club practice times fixed?'); return true; }
      wiz.data.clubsFixed = yn;
      if (yn) {
        wiz.step = 'askClubsTimesFixed';
        appendMessage('bot', 'Please share the fixed times. For example: "Soccer Tue 18:00-20:00, Volleyball Sat 10:00-12:00"');
      } else {
        wiz.step = 'askClubsTimesPref';
        appendMessage('bot', 'What days/times do you prefer for your clubs? Same format: "Soccer Tue 18:00-20:00"');
      }
      return true;
    }
    case 'askClubsTimesFixed':
    case 'askClubsTimesPref': {
      wiz.data.clubTimes = parseClubsInputToBlocks(msg, wiz.data.clubs || []);
      // after clubs, ask about project work
      wiz.step = 'askProject';
      appendMessage('bot', 'Do you have personal project work to include (e.g., research/thesis/app)? (yes/no)');
      return true;
    }
    case 'askProject': {
      const yn = parseYesNo(msg);
      if (yn === null) { appendMessage('bot', 'Do you want to include project work? A quick yes or no.'); return true; }
      wiz.data.hasProject = yn;
      if (yn) {
        wiz.step = 'askProjectHours';
        appendMessage('bot', 'Roughly how many hours per week for project work? If unsure, I’ll default to 6.');
      } else {
        wiz.step = 'askProductive';
        appendMessage('bot', 'When are you most productive for studying — mornings, afternoons, or evenings?');
      }
      return true;
    }
    case 'askProjectHours': {
      const n = parseNumberFlexible(msgNorm);
      wiz.data.projectHours = n && n > 0 ? n : 6;
      wiz.step = 'askProductive';
      appendMessage('bot', 'When are you most productive for studying — mornings, afternoons, or evenings?');
      return true;
    }
    case 'askProductive': {
      wiz.data.productive = parseProductive(msg) || 'morning';
      wiz.step = 'askIntensity';
      appendMessage('bot', 'Want me to ramp up study time near midterms/finals? (yes/no)');
      return true;
    }
    case 'askIntensity': {
      wiz.data.intensify = parseYesNo(msg);
      wiz.step = 'askCredits';
      appendMessage('bot', 'How many credits do you want to take? If you’re not sure, I’ll aim for around 18.');
      return true;
    }
    case 'askCredits': {
      const n = parseNumberFlexible(msgNorm) || 18;
      wiz.data.targetCredits = n;
      wiz.step = 'askPriorities';
      const available = [];
      if ((wiz.data.clubs?.length || wiz.data.clubTimes?.length)) available.push('clubs');
      available.push('study');
      if (wiz.data.hasJob) available.push('job');
      if (wiz.data.hasProject) available.push('project');
      const example = available.length ? ` For example: "${available.join(' > ')}"` : '';
      appendMessage('bot', `Finally, what priority order should I use for activities after courses (${available.join(', ')})?${example} If you skip, I’ll use a sensible default.`);
      return true;
    }
    case 'askPriorities': {
      const available = [];
      if ((wiz.data.clubs?.length || wiz.data.clubTimes?.length)) available.push('clubs');
      available.push('study');
      if (wiz.data.hasJob) available.push('job');
      if (wiz.data.hasProject) available.push('project');
      wiz.data.priorities = parsePriorities(msgNorm, available);
      // Brief confirmation in canonical form
      try { appendMessage('bot', `Understood — priorities: ${wiz.data.priorities.join(' > ')}.`); } catch {}
      wiz.step = 'generate';
      appendMessage('bot', 'Great — give me a moment to put this together.');
      generateTwoWeekSchedule(wiz, calendar);
      return true;
    }
  }
  return false;
}

// ---------- Schedule Generation Wizard ----------
async function generateTwoWeekSchedule(wiz, calendar) {
  const sem = wiz.data.baseSemester;
  const base = sem.start;
  const semesterNum = wiz.data.semester;
  const target = Math.min(wiz.data.targetCredits || 18, semesterNum === 3 ? 19 : 22);
  const cap = (semesterNum === 3) ? 19 : 22;
  const { chosen, total } = pickCoursesForSemester(window.coursesList || [], semesterNum, target, cap, wiz.data.coursePrefs || { include: [], exclude: [] });

  // Persist course meetings for first 2 weeks
  for (const c of chosen) {
    await addCourseWeeks(c, null, base, 2, calendar);
  }

  // Helper for safe add
  async function safeAdd(title, start, end, color, description = '') {
    if (!isSlotFree(calendar, start, end)) return false;
    try {
      const saved = await window.authSystem.createEvent({ title, start: start.toISOString(), end: end.toISOString(), allDay: false, backgroundColor: color, description });
      calendar.addEvent({ id: saved.id, title: saved.title, start: saved.start_date, end: saved.end_date, allDay: saved.all_day, backgroundColor: saved.color, extendedProps: { description: saved.description } });
    } catch {
      calendar.addEvent({ title, start, end, backgroundColor: color, borderColor: color, textColor: '#fff', extendedProps: { description } });
    }
    return true;
  }

  // Define activity schedulers
  const scheduleJob = async () => {
    if (!wiz.data.hasJob) return;
    const totalHours = Math.max(5, wiz.data.jobHours || 10);
    const shiftHours = 5;
    const commuteMin = 50; // minutes
    for (let w=0; w<2; w++) {
      let hoursLeft = totalHours;
      const candidateWindows = [
        ['Monday','17:00'], ['Wednesday','17:00'], ['Friday','17:00'],
        ['Saturday','12:00'], ['Sunday','12:00']
      ];
      for (const [day, startHH] of candidateWindows) {
        if (hoursLeft <= 0) break;
        const slot = tryPlaceBlock(calendar, base, day, startHH, shiftHours, w, 30, '20:30');
        if (!slot) continue;
        const commuteStart = new Date(slot.start.getTime() - commuteMin * 60000);
        const commuteEnd = new Date(slot.start);
        if (!isSlotFree(calendar, commuteStart, commuteEnd)) continue;
        const ok1 = await safeAdd('Commute to Work', commuteStart, commuteEnd, '#475569');
        const ok2 = ok1 && await safeAdd('Part-time Job', slot.start, slot.end, '#d97706');
        if (ok1 && ok2) hoursLeft -= shiftHours;
      }
    }
  };

  const scheduleClubs = async () => {
    if (Array.isArray(wiz.data.clubTimes) && wiz.data.clubTimes.length) {
      for (let w=0; w<2; w++) {
        for (const ct of wiz.data.clubTimes) {
          const s = dateForWeekdayFrom(base, ct.day, ct.start, w);
          const e = dateForWeekdayFrom(base, ct.day, ct.end, w);
          await safeAdd(ct.name || 'Club Activity', s, e, '#0ea5e9', wiz.data.clubsFixed ? 'Club fixed practice' : 'Preferred time');
        }
      }
    } else if ((wiz.data.clubs||[]).length) {
      for (const club of (wiz.data.clubs || [])) {
        for (let w=0; w<2; w++) {
          const slot = tryPlaceBlock(calendar, base, 'Wednesday', '17:00', 2, w, 15, '20:00');
          if (slot) await safeAdd(club, slot.start, slot.end, '#0ea5e9', 'Club/Activity');
        }
      }
    }
  };

  const scheduleStudy = async () => {
    const studyBlocks = allocateStudyBlocks(wiz.data.productive || 'morning');
    for (let w=0; w<2; w++) {
      for (const [day, sHH, eHH] of studyBlocks) {
        const duration = (parseInt(eHH) - parseInt(sHH)) || 2;
        const slot = tryPlaceBlock(calendar, base, day, sHH, duration, w, 15, '21:30');
        if (slot) await safeAdd('Study Session', slot.start, slot.end, '#6f42c1');
      }
    }
  };

  const scheduleProject = async () => {
    if (!wiz.data.hasProject) return;
    const hoursPerWeek = Math.max(2, wiz.data.projectHours || 6);
    const blockHours = 2;
    const pref = wiz.data.productive || 'afternoon';
    const daySlots = {
      morning: [ ['Tuesday','09:00'], ['Thursday','09:00'], ['Saturday','10:00'] ],
      afternoon: [ ['Tuesday','15:00'], ['Thursday','15:00'], ['Saturday','13:00'] ],
      evening: [ ['Tuesday','19:00'], ['Thursday','19:00'], ['Sunday','18:00'] ]
    };
    const windows = daySlots[pref] || daySlots.afternoon;
    for (let w=0; w<2; w++) {
      let left = hoursPerWeek;
      // try preferred windows first, then fill other days if needed
      const tryWindows = [...windows, ['Friday','16:00'], ['Monday','16:00']];
      for (const [day, startHH] of tryWindows) {
        if (left <= 0) break;
        const slot = tryPlaceBlock(calendar, base, day, startHH, blockHours, w, 15, '21:30');
        if (slot) {
          const ok = await safeAdd('Project Work', slot.start, slot.end, '#16a34a');
          if (ok) left -= blockHours;
        }
      }
    }
  };

  // Build activity order
  const available = [];
  if ((wiz.data.clubs?.length || wiz.data.clubTimes?.length)) available.push('clubs');
  available.push('study');
  if (wiz.data.hasJob) available.push('job');
  if (wiz.data.hasProject) available.push('project');
  const order = Array.isArray(wiz.data.priorities) && wiz.data.priorities.length
    ? wiz.data.priorities.filter(k => available.includes(k))
    : ['clubs','study','job','project'].filter(k => available.includes(k));

  // Safety: if still empty, fall back to study then job then clubs
  const finalOrder = order.length ? order : ['study','job','clubs','project'].filter(k => available.includes(k));

  const schedulers = { clubs: scheduleClubs, study: scheduleStudy, job: scheduleJob, project: scheduleProject };
  for (const key of finalOrder) {
    await (schedulers[key]?.());
  }

  const courseList = chosen.map(c => `${c.short_name || c.course} (${courseTotalCredits(c)} cr)`).join(', ');
  appendMessage('bot', `${randomAck('your schedule is ready!')} I planned the first two weeks starting ${base.toLocaleDateString()}.
Courses (${total} credits): ${courseList || 'none found for that semester'}.
I avoided clashes, used 5-hour job shifts with commute buffer, and placed clubs/study/project according to your priorities.`);
  wiz.active = false;
  wiz.step = 'idle';
}
// ---------- End Schedule Wizard ----------

// Enhance system prompt with memory (Replaced with SQL-first assistant rules)
function buildSystemPrompt() {
  const today = new Date();
  const userId = (window.authSystem && window.authSystem.currentUser && window.authSystem.currentUser.id) || 'CURRENT_USER_ID';
  // Summarize known courses (short list to keep prompt size reasonable)
  const courseLines = (Array.isArray(window.coursesList) ? window.coursesList.slice(0, 20) : []).map(c => `{"course":"${c.course}","short_name":"${c.short_name}","semester":${c.semester},"level":"${c.level}","lecture_credits":${Number(c.lecture_credits||0)},"exercise_credits":${Number(c.exercise_credits||0)}}`);

  return [
    'You are an expert AI scheduling assistant and SQL generator.',
    'Your job is to understand natural English user input about university life, schedules, and activities, and always return two outputs in sequence:',
    '1) The SQL query or queries that interact with the scheduling database.',
    '2) A short, natural English confirmation or response for the user.',
    '',
    'DATABASE RULES',
    'profiles(id, email, name, program, graduation_year, university_name, created_at, updated_at)',
    'events(id, user_id, title, description, start_date, end_date, all_day, color, created_at, updated_at)',
    `- Consider the active user id as: ${userId}`,
    '- user_id always refers to the UUID of the active logged-in user.',
    '- Supported event/activity types: "course", "club activity", "part-time job", "study session", "project work".',
    '- A valid event requires: title, user_id, start_date, end_date.',
    '- Default color = "#3788d8" unless user specifies otherwise.',
    '',
    'COURSE JSON RULES',
    'You have access to a JSON file with all course info in the UI. When a user requests adding a course, extract lecture/exercise from it and compose SQL INSERTs for weekly events.',
    'Example format:',
    '{"course":"Ordinary Differential Equations","short_name":"ODE","semester":3,"level":"advanced","lecture_credits":2,"exercise_credits":1,"lecture":[["Martin SERA","Monday","10:40","12:10"]],"exercise":[["Martin SERA","Tuesday","16:20","17:50"]]}',
    ...(courseLines.length ? ['Known courses sample:', ...courseLines] : []),
    '',
    'LOGIC & CONSTRAINT RULES',
    '1. CRUD Support: Insert/Update/Select/Delete events as requested.',
    '2. Overlap Handling: Avoid scheduling clashes; if overlap, suggest nearest available slot instead.',
    '3. Incomplete Input: If only time, assign next valid day; if no duration, assume 1 hour.',
    '4. Productivity Preferences: Respect best study time if specified; else default to afternoons (13:00–17:00).',
    '5. Priorities: Courses/exams highest priority; part-time jobs fixed unless told; clubs/study flexible.',
    '6. Questioning: If ambiguous, ask a clarifying question BEFORE generating SQL.',
    '7. Safe Defaults: 1-hour blocks for study if no duration; assume start of upcoming week if no date.',
    '',
    'OUTPUT RULES',
    'ALWAYS return raw SQL first (no markdown fences), then a single short English sentence.',
    'If user asks to “show schedule,” return a SELECT query for that day/week, then say: "Here’s your schedule for [date/week]."',
    '',
    `Today is ${today.toISOString().split('T')[0]}.`
  ].join('\n');
}

// --- SQL parsing and execution helpers ---
function splitAiSqlAndResponse(text) {
  const t = String(text || '').trim();
  if (!t) return { sql: '', response: '' };
  // Heuristic: SQL first, then a blank line or line without SQL keywords
  // Try to find the last semicolon that likely ends SQL
  const lastSemi = t.lastIndexOf(';');
  if (lastSemi > -1) {
    const before = t.slice(0, lastSemi + 1).trim();
    const after = t.slice(lastSemi + 1).trim();
    // If "after" still contains SQL keywords as leading, keep expanding
    if (/^(select|insert|update|delete)/i.test(after)) {
      return { sql: t, response: '' };
    }
    return { sql: before, response: after };
  }
  // Fallback: treat first paragraph as SQL if it starts like SQL
  const lines = t.split(/\n+/);
  let idx = 0;
  while (idx < lines.length && /^(\s*--|select|insert|update|delete|with)\b/i.test(lines[idx])) idx++;
  const sql = lines.slice(0, idx).join('\n');
  const response = lines.slice(idx).join('\n');
  return { sql, response };
}

function tokenizeSqlValues(valuesStr) {
  const res = [];
  let i = 0, cur = '', inQuote = false;
  while (i < valuesStr.length) {
    const ch = valuesStr[i];
    if (ch === "'") {
      if (inQuote && valuesStr[i+1] === "'") { cur += "'"; i += 2; continue; }
      inQuote = !inQuote; cur += ch; i++; continue;
    }
    if (!inQuote && ch === ',') { res.push(cur.trim()); cur = ''; i++; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) res.push(cur.trim());
  return res;
}

function stripSqlString(v) {
  const s = String(v || '').trim();
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

async function executeSqlStatements(sqlText, calendar) {
  const sql = String(sqlText || '').trim();
  if (!sql) return { inserted: 0, deleted: 0, selected: 0 };
  const stmts = sql.split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/).map(s => s.trim()).filter(Boolean);
  let inserted = 0, deleted = 0; // selected count is optional
  for (const s of stmts) {
    if (/^insert\s+into\s+events\s*\(/i.test(s)) {
      // Parse columns and values
      const m = s.match(/^insert\s+into\s+events\s*\(([^)]+)\)\s*values\s*\((.+)\)\s*$/i);
      if (!m) continue;
      const columns = m[1].split(',').map(x => x.trim().replace(/"/g, ''));
      const values = tokenizeSqlValues(m[2]);
      if (columns.length !== values.length) continue;
      const obj = {};
      for (let i=0;i<columns.length;i++) {
        obj[columns[i]] = values[i];
      }
      const title = stripSqlString(obj.title || obj.TITLE);
      const description = stripSqlString(obj.description || '');
      const startStr = stripSqlString(obj.start_date || obj.start || '');
      const endStr = stripSqlString(obj.end_date || obj.end || '');
      const allDayRaw = String(obj.all_day || 'false').toLowerCase();
      const color = stripSqlString(obj.color || '#3788d8') || '#3788d8';
      const startDate = parseLocalDateTime(startStr) || new Date(startStr);
      const endDate = parseLocalDateTime(endStr) || new Date(endStr || startStr);
      try {
        const saved = await window.authSystem.createEvent({
          title,
          description,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          allDay: /true|1/i.test(allDayRaw),
          backgroundColor: color
        });
        calendar.addEvent({ id: saved.id, title: saved.title, start: saved.start_date, end: saved.end_date, allDay: saved.all_day, backgroundColor: saved.color, extendedProps: { description: saved.description } });
        inserted++;
      } catch (e) {
        console.error('Failed to insert via SQL mapping:', e);
      }
      continue;
    }
    if (/^delete\s+from\s+events\b/i.test(s)) {
      // Support simple WHERE by date or title
      const where = s.split(/\bwhere\b/i)[1] || '';
      let dateEq = null, titleEq = null;
      const md = where.match(/date\(start_date\)\s*=\s*'([^']+)'/i);
      if (md) dateEq = md[1];
      const mt = where.match(/title\s*=\s*'([^']+)'/i);
      if (mt) titleEq = mt[1];
      try {
        const events = await window.authSystem.getEvents();
        const toDelete = events.filter(ev => {
          const d = new Date(ev.start_date).toISOString().slice(0,10);
          const okDate = dateEq ? (d === dateEq) : true;
          const okTitle = titleEq ? (ev.title === titleEq) : true;
          return okDate && okTitle;
        });
        for (const ev of toDelete) {
          await window.authSystem.deleteEvent(ev.id);
          const ce = calendar.getEventById(ev.id);
          if (ce) ce.remove();
          deleted++;
        }
      } catch (e) { console.error('Delete via SQL mapping failed:', e); }
      continue;
    }
    if (/^update\s+events\b/i.test(s)) {
      // Not implemented robustly; skip for now or future extension
      console.warn('UPDATE not supported in client SQL executor yet.');
      continue;
    }
    if (/^select\b/i.test(s)) {
      // We could optionally run a client-side filter and echo a brief count
      continue;
    }
  }
  return { inserted, deleted };
}

// --- askChatGPT updated flow to use SQL-first prompt ---
async function askChatGPT(message, calendar, options = {}) {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) { appendMessage('bot', '❌ Server configuration error.'); return; }

  const systemPrompt = buildSystemPrompt();
  const messages = [ { role: 'system', content: systemPrompt }, { role: 'user', content: message } ];
  try {
    const data = await safeFetchJSON('/api/openai-edge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages })
    });
    hideLoading();
    let botText = data.choices?.[0]?.message?.content || '';
    let cleanText = botText.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    }
    const { sql, response } = splitAiSqlAndResponse(cleanText);
    if (sql) {
      await executeSqlStatements(sql, calendar);
    }
    // Show the short English response (or fallback)
    if (response) appendMessage('bot', response.trim());
    else appendMessage('bot', 'Done.');
  } catch (err) {
    hideLoading();
    console.error('ChatGPT API Error:', err);
    const base = await resolveApiBase();
    if (!base) appendMessage('bot', '❌ The AI API endpoint is not reachable.');
    else appendMessage('bot', `❌ The AI API at ${base} is not returning JSON.`);
  }
}

// Show greeting on load
appendMessage('bot', 'Hey! I’m your study buddy for planning and scheduling. Try “Add volleyball practice Thu 7pm” or “export to google calendar”. I can also generate a full schedule — just say “make me a schedule”.')

loadUserMemory()

// Safe JSON fetch: throws with readable text when response isn't JSON
async function safeFetchJSON(input, init) {
  const res = await fetch(input, init);
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (ct.includes('application/json')) {
      let err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API Error ${res.status}: ${typeof err === 'string' ? err : (err.error || JSON.stringify(err)).slice(0,200)}`);
    } else {
      const txt = await res.text().catch(() => '');
      throw new Error(`API Error ${res.status}: ${txt.slice(0,200)}`);
    }
  }
  if (!ct.includes('application/json')) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Server returned non-JSON: ${txt.slice(0,200)}`);
  }
  return res.json();
}

// Resolve API base URL for /api calls. Supports:
// 1) Same-origin (when served via a server)
// 2) Global window.API_BASE
// 3) localStorage apiBase
let __apiBasePromise;
async function resolveApiBase() {
  if (__apiBasePromise) return __apiBasePromise;
  __apiBasePromise = (async () => {
    // 1) Same-origin health check (works in vercel dev/deploy)
    try {
      if (location.protocol.startsWith('http')) {
        if (await pingJSON('/api/health')) return '';
      }
    } catch {}
    // 2) window.API_BASE (set in index.html or elsewhere)
    const globalBase = (typeof window !== 'undefined' && window.API_BASE) ? String(window.API_BASE).replace(/\/$/,'') : '';
    if (globalBase) {
      if (await pingJSON(`${globalBase}/api/health`)) return globalBase;
    }
    // 3) localStorage
    try {
      const storedRaw = localStorage.getItem('apiBase') || '';
      const stored = storedRaw.replace(/\/$/,'')
      if (stored && await pingJSON(`${stored}/api/health`)) return stored;
    } catch {}
    // No prompt fallback; just return empty to stay non-blocking
    return '';
  })();
  return __apiBasePromise;
}