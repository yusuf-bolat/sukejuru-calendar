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

// Enhance system prompt with memory
function buildSystemPrompt() {
  const today = new Date();
  const memLines = (sessionMemory.activities || []).map(a => `- ${a.type}: ${a.name} on ${a.schedule?.weekday || '?'} ${a.schedule?.start || ''}-${a.schedule?.end || ''}`);
  return [
    'You are a friendly, helpful university student consultant.',
    'Keep answers concise, warm, and human — small emojis and short acknowledgements are welcome.',
    'Use the following user memory to resolve pronouns and references precisely:',
    ...memLines,
    'Today is ' + today.toISOString().split('T')[0] + '. Always use this as the reference date for scheduling events.',
    'You have access to the following list of courses:',
    ...((window.coursesList && window.coursesList.length) ? window.coursesList.map(c => `- ${c.course}${c.short_name ? ' (' + c.short_name + ')' : ''}`) : []),
    'IMPORTANT: When the user describes an activity, determine whether it matches a known course name/short name from the list above. Otherwise it is a general event.',
    'If it matches a course, respond in JSON with the course schedule (lecture/exercise).',
    'If it does NOT match any course, respond in JSON with event details (title, start, end, description).',
    'If the user omits key info, ask one short, friendly question to clarify.'
  ].join('\n');
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
  const systemPrompt = buildSystemPrompt()

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  try {
    // Call our secure serverless function instead of OpenAI directly
    const data = await safeFetchJSON('/api/openai-edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

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
    }
    // Handle both auto-detection and forced general events
    if (options && (options.isCourse === false || options.isCourse === 'auto')) {
      // If bot is asking for missing info, set pendingGeneralEvent
      if (!responded && botText && /specify|provide|what is|when do you/i.test(botText)) {
        pendingGeneralEvent = true;
        // capture a draft title from the user message for next turn
        const t = extractTitleFromMessage(message)
        if (t) pendingDraft.title = t
      } else {
        pendingGeneralEvent = false;
        pendingDraft.title = null;
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
                appendMessage('bot', `${randomAck()} — added ${matchedCourse.short_name} schedule.`);
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
              const savedEvent = await window.authSystem.createEvent(eventData);
              rememberActivity('general', savedEvent.title, new Date(savedEvent.start_date), new Date(savedEvent.end_date))
              // persist updated memory summary
              try { await window.authSystem.upsertMemory(sessionMemory) } catch {}
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
        appendMessage('bot', `${randomAck()} — added ${events.length} event(s) to your calendar.`);
        responded = true;
        pendingGeneralEvent = false;
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
      appendMessage('bot', `${randomAck()} — added ${events.length} event(s) to your calendar.`);
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

    const msg = String(err && err.message || err);
    if (/non-JSON|Unexpected token/i.test(msg) || /404|Not Found/i.test(msg)) {
      const base = await resolveApiBase();
      if (!base) {
        appendMessage('bot', '❌ The AI API endpoint is not reachable. If you are running locally, run "vercel dev" or deploy with the included vercel.json so /api is available. You can also set it via "set api https://your-app.vercel.app".');
      } else {
        appendMessage('bot', `❌ The AI API at ${base} is not returning JSON. Check that /api/health works and OPENAI_API_KEY is set on the server.`);
      }
      return;
    }
    if (msg.includes('401')) {
      appendMessage('bot', '❌ API key error. Please check your OpenAI API key configuration.');
    } else if (msg.includes('quota')) {
      appendMessage('bot', '❌ OpenAI API quota exceeded. Please check your usage limits.');
    } else {
      appendMessage('bot', `❌ Error connecting to AI: ${msg}`);
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
      rememberActivity('course', title, startDate, endDate)
      try { await window.authSystem.upsertMemory(sessionMemory) } catch {}
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
// pendingDraft is already declared at top-level; ensure it exists
if (!pendingDraft) { pendingDraft = { title: null }; }
// Pending confirmation for full schedule deletion
let pendingConfirmDeleteAll = false;

// Handle simple general event adds like: "add soccer" or "add soccer Mon 6pm-8pm"
async function tryHandleAddGeneral(msg, calendar) {
  const m = msg.match(/^(add|create|schedule)\s+(.+)$/i);
  if (!m) return false;
  const rest = m[2].trim();
  // If looks like a course keyword, skip (course handler will take it)
  if (/\b(course|class)\b/i.test(rest)) return false;

  // Extract weekday + time if present
  const weekday = detectWeekday(rest);
  const tr = parseTimeRangeFlexible(rest) || parseTimeRange(rest);
  if (weekday && tr) {
    const startTime = toHHMM(tr.startHour, tr.startMinute);
    const endTime = toHHMM(tr.endHour, tr.endMinute);
    const title = extractTitleFromMessage(rest) || rest.replace(/\b(on|at|from|to|\d.*)$/i,'').trim() || 'Activity';
    const startDate = nextWeekdayDate(weekday, startTime);
    const endDate = nextWeekdayDate(weekday, endTime);
    try {
      const saved = await window.authSystem.createEvent({
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: false,
        backgroundColor: '#6f42c1',
        description: ''
      });
      rememberActivity('general', saved.title, new Date(saved.start_date), new Date(saved.end_date));
      try { await window.authSystem.upsertMemory(sessionMemory) } catch {}
      calendar.addEvent({ id: saved.id, title: saved.title, start: saved.start_date, end: saved.end_date, allDay: saved.all_day, backgroundColor: saved.color, extendedProps: { description: saved.description } });
      appendMessage('bot', `${randomAck()} — added ${saved.title} on ${weekday} ${startTime}-${endTime}.`);
      return true;
    } catch (e) {
      console.warn('Failed to persist general event, falling back to local add:', e);
      calendar.addEvent({ title, start: startDate, end: endDate, backgroundColor: '#6f42c1' });
      appendMessage('bot', `${randomAck()} — added ${title} on ${weekday} ${startTime}-${endTime}.`);
      return true;
    }
  }
  // No time yet: set pending and ask follow-up
  pendingGeneralEvent = true;
  pendingDraft.title = extractTitleFromMessage(rest) || rest;
  appendMessage('bot', `What date and time for "${pendingDraft.title}"? For example: "Mon 6pm-8pm".`);
  return true;
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
document.addEventListener('DOMContentLoaded', async () => {
  bindSendControls();
  // refresh memory from server once logged in
  try { await loadUserMemory(); await window.authSystem.updateMemoryFromEvents() } catch {}
});

function parseClubsInputToBlocks(input, knownClubs = []) {
  // Parse patterns like "Soccer Tue 18:00-20:00", "Volleyball Saturday 10:00-12:00",
  // and also flexible forms like "Mon from 6pm to 8pm" (without a club name).
 
  const dayRegex = '(Sun(?:day)?|Mon(?:day)?|Tue(?:sday)?|Tues|Wed(?:nesday)?|Thu(?:rsday)?|Thur|Thurs|Fri(?:day)?|Sat(?:urday)?)';
  const timeRegex = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)\\s*(?:-|to)\\s*(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)';
  const pattern = `(?:(.+?)\\s+)?${dayRegex}\\s*(?:from\\s*)?${timeRegex}`;
  const re = new RegExp(pattern, 'ig');

  const results = [];
  let m;
  while ((m = re.exec(input)) !== null) {
    let name = (m[1] || '').trim();
    const dayRaw = m[2];
    const startRaw = m[3];
    const endRaw = m[4];

    // Normalize day
    const dayMap = {
      sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', tues: 'Tuesday', wed: 'Wednesday',
      thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', fri: 'Friday', sat: 'Saturday'
    };
    const dayKey = dayRaw.toLowerCase().slice(0, 4).replace(/\s+/g, '');
    // handle 3 or 4 letter keys
    const key3 = dayKey.slice(0,3);
    const day = dayMap[dayKey] || dayMap[key3] || 'Wednesday';

    const to24 = (t) => {
      if (!t) return '18:00';
      let s = String(t).trim().toLowerCase();
      const ampm = s.match(/am|pm/);
      if (ampm) {
        s = s.replace(/\s+/g, '');
        const parts = s.split(':');
        let hh = parseInt(parts[0], 10);
        let mm = parts[1] ? parseInt(parts[1], 10) : 0;
        const p = ampm[0];
        if (p === 'pm' && hh !== 12) hh += 12;
        if (p === 'am' && hh === 12) hh = 0;
        return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
      }
      // already 24h like 18:00
      if (/^\d{1,2}:\d{2}$/.test(s)) return s;
      // fallback: integer hour only
      const hh = parseInt(s, 10);
      if (!isNaN(hh)) return `${String(hh).padStart(2,'0')}:00`;
      return '18:00';
    };

    results.push({ name, day, start: to24(startRaw), end: to24(endRaw) });
  }

  // If names missing, assign from knownClubs order
  let idx = 0;
  for (const r of results) {
    if (!r.name && knownClubs[idx]) r.name = knownClubs[idx];
    if (!r.name) r.name = 'Club Activity';
    idx++;
  }
  return results;
}

// ---------- Scheduling utilities for the wizard ----------
function eventsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function isSlotFree(calendar, start, end) {
  try {
    const events = calendar.getEvents();
    for (const ev of events) {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end || ev.start);
      if (eventsOverlap(start, end, evStart, evEnd)) return false;
    }
    return true;
  } catch (e) {
    // If calendar is unavailable, assume free to avoid hard failures
    return true;
  }
}

// Try to place a block on a given weekday starting at startHH (e.g., '17:00')
// for `hours` duration. Iterate by stepMinutes until `latestEndHH`.
function tryPlaceBlock(calendar, baseStart, weekdayName, startHH, hours, weekOffset = 0, stepMinutes = 15, latestEndHH = '21:30') {
  const start = dateForWeekdayFrom(baseStart, weekdayName, startHH, weekOffset);
  const latestEnd = dateForWeekdayFrom(baseStart, weekdayName, latestEndHH, weekOffset);
  const durMs = Math.max(0.25, hours) * 60 * 60 * 1000;
  let cur = new Date(start);
  while (cur.getTime() + durMs <= latestEnd.getTime()) {
    const end = new Date(cur.getTime() + durMs);
    if (isSlotFree(calendar, cur, end)) {
      return { start: new Date(cur), end };
    }
    cur = new Date(cur.getTime() + stepMinutes * 60 * 1000);
  }
  return null;
}

// Provide a small set of study windows based on productivity preference
function allocateStudyBlocks(pref = 'morning') {
  const blocks = {
    morning: [
      ['Monday', '09:00', '11:00'],
      ['Tuesday', '09:00', '11:00'],
      ['Thursday', '09:00', '11:00'],
      ['Saturday', '10:00', '12:00']
    ],
    afternoon: [
      ['Monday', '14:00', '16:00'],
      ['Wednesday', '15:00', '17:00'],
      ['Friday', '14:00', '16:00'],
      ['Sunday', '13:00', '15:00']
    ],
    evening: [
      ['Monday', '19:00', '21:00'],
      ['Tuesday', '19:00', '21:00'],
      ['Thursday', '19:00', '21:00'],
      ['Sunday', '18:00', '20:00']
    ]
  };
  return blocks[pref] || blocks.morning;
}

// Improve delete command parsing to keep the 'all' qualifier
async function handleUserInput(msg, calendar) {
  const lower = msg.toLowerCase().trim();

  // Handle confirmation for delete-all
  if (pendingConfirmDeleteAll) {
    if (/^(y|yes|yeah|sure|ok|confirm|do it)$/i.test(lower)) {
      pendingConfirmDeleteAll = false;
      await clearAllEvents(calendar);
      return;
    }
    if (/^(n|no|cancel|stop|nevermind|never mind)$/i.test(lower)) {
      pendingConfirmDeleteAll = false;
      appendMessage('bot', 'Deletion canceled.');
      return;
    }
    appendMessage('bot', 'Please reply "yes" to confirm or "no" to cancel.');
    return;
  }

  // Intercept direct course add first
  try {
    const handledAdd = await tryHandleAddCourse(msg, calendar);
    if (handledAdd) return;
  } catch (e) { /* fall through to other handlers */ }

  // Intercept simple general event add
  const handledGeneral = await tryHandleAddGeneral(msg, calendar);
  if (handledGeneral) return;

  // Intercept natural date-span daily events (e.g., onboarding from Sep 1 to Sep 10, 10am-5pm)
  const handledRange = await tryHandleRangeEvents(msg, calendar);
  if (handledRange) return;

  // Trigger schedule generation
  const genSchedule = /(generate|build|create|make)\s+.*(schedule|timetable|plan)/i.test(lower) || /^schedule\s*please$/i.test(lower);
  if (genSchedule) {
    await startScheduleWizard(calendar);
    return;
  }
  if (scheduleWizard.active) {
    const handled = await handleScheduleWizardAnswer(msg, calendar);
    if (handled) return;
  }

  // Delete-all requests (confirmation step)
  const wantsDeleteAll = /^(?:delete|remove)\s+(?:all(?:\s+events)?|everything)\b|^(?:clear|reset)\s+(?:calendar|schedule)\b|^(?:everything)$/i.test(lower);
  if (wantsDeleteAll) {
    pendingConfirmDeleteAll = true;
    appendMessage('bot', 'Are you sure you want to delete your entire schedule? Reply "yes" or "no".');
    return;
  }

  // Quick commands to clear everything (legacy patterns)
  if (/(^|\b)(clear|reset)\s+(calendar|schedule)\b/i.test(msg) || /^(delete|remove)\s+all(\s+events)?(\s+from\s+(my\s+)?(calendar|schedule))?\b/i.test(msg) || /^delete\s+everything/i.test(msg)) {
    pendingConfirmDeleteAll = true;
    appendMessage('bot', 'Are you sure you want to delete your entire schedule? Reply "yes" or "no".');
    return;
  }

  // New: delete category in a time window, e.g., "delete all club activities from last week of September"
  let m = msg.match(/^(delete|remove)\s+(all\s+)?(.+?)\s+((?:last|first)\s+week\s+of\s+.+|week\s+of\s+.+|in\s+.+|from\s+.+\s+to\s+.+)$/i);
  if (m) {
    const categoryPhrase = ((m[2] || '') + m[3]).trim();
    const timePhrase = m[4].trim();
    await deleteActivitiesInRange(categoryPhrase, timePhrase, calendar);
    return;
  }

  // Fallback: send to ChatGPT for natural language processing
  showLoading();
  askChatGPT(msg, calendar).catch(err => {
    hideLoading();
    appendMessage('bot', 'Error processing your request. Please try again or rephrase your question.');
    console.error('ChatGPT request error:', err);
  });
}

// Implement clearAllEvents(calendar) to delete all events for the user via authSystem.deleteAllEvents and clear the calendar, then acknowledge.
async function clearAllEvents(calendar) {
  try {
    // Delete from DB first
    if (window.authSystem?.deleteAllEvents) {
      await window.authSystem.deleteAllEvents();
    }
  } catch (e) {
    console.warn('Failed to delete all events in DB:', e);
  }
  try {
    // Remove from UI calendar
    const events = calendar?.getEvents?.() || [];
    for (const ev of events) {
      try { ev.remove(); } catch {}
    }
  } catch (e) {
    console.warn('Failed clearing calendar UI:', e);
  }
  appendMessage('bot', 'All your events, activities, and courses have been deleted.');
}