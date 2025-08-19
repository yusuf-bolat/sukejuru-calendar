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

function toHHMM(hour, minute){
  const hh = String(hour).padStart(2,'0')
  const mm = String(minute).padStart(2,'0')
  return `${hh}:${mm}`
}

// Friendly acknowledgements for a more human vibe
function randomAck(prefix = '') {
  const acks = [
    'All set',
    'Done',
    'Got it',
    'No problem',
    'Understood',
    'Sweet',
    'You got it',
    'Thanks!',
    'Gotcha',
    "Sounds good",
    'Nice!',
    'Appreciate it'
  ];
  const pick = acks[Math.floor(Math.random() * acks.length)];
  return prefix ? `${pick} — ${prefix}` : pick;
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
      try { appendMessage('bot', `Understood — priorities: ${wiz.data.priorities.join(' > ')}.`); } catch {}
      wiz.step = 'generate';
      appendMessage('bot', 'Great — give me a moment to put this together.');
      // Show loading animation while generating
      showLoading();
      generateTwoWeekSchedule(wiz, calendar);
      return true;
    }
    case 'review': {
      // User can confirm or request tweaks
      const yn = parseYesNo(msg);
      if (/looks good|good|fine|ok|okay|great|perfect|awesome|satisfied|no changes/i.test(msgNorm) || yn === true) {
        wiz.active = false; wiz.step = 'idle';
        appendMessage('bot', 'Thanks! If you need more tweaks later, just tell me.');
        return true;
      }
      // Parse study hours request
      const studyMatch = msgNorm.match(/(\d{1,2})\s*hour[s]?\s*(?:of\s*)?(study|study\s*sessions)/i) || msgNorm.match(/make\s*.*study.*?(\d{1,2})\s*hour/i);
      const weekdaysJob = /weekday|week\s*days|no\s*weekend|don'?t\s*want\s*to\s*work\s*(on\s*)?weekend/i.test(msgNorm);
      if (!studyMatch && !weekdaysJob) {
        appendMessage('bot', "Gotcha — tell me things like 'make study 10 hours' or 'move job to weekdays only'. Do you want me to adjust something like that?");
        return true;
      }
      showLoading();
      setTimeout(async () => {
        try {
          if (studyMatch) {
            const target = Number(studyMatch[1]);
            await applyStudyHoursAdjustment(calendar, scheduleWizard.data.baseSemester.start, target, scheduleWizard.data.productive || 'morning');
            appendMessage('bot', `${randomAck('updated study time')} — aiming for ${target} hours per week.`);
          }
          if (weekdaysJob) {
            await applyWeekdayJobAdjustment(calendar, scheduleWizard.data.baseSemester.start, scheduleWizard.data.jobHours || 10);
            appendMessage('bot', `${randomAck('shifted job to weekdays')} — weekends are now free from work.`);
          }
          hideLoading();
          const followUps = [
            'How does this look now?',
            'Better?',
            'Does this match what you had in mind?',
            'Happy with these changes?'
          ];
          appendMessage('bot', followUps[Math.floor(Math.random()*followUps.length)] + ' You can say “looks good” or ask for more tweaks.');
        } catch(e) {
          hideLoading();
          appendMessage('bot', 'Sorry — I ran into an issue applying the changes. Could you try rephrasing?');
        }
      }, 50);
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

  // Track job hours actually scheduled per week
  const jobSummary = { week0: 0, week1: 0 };

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
    const totalHours = Math.max(5, wiz.data.jobHours || 10); // per week
    const shiftHours = 5;
    const requiredShifts = Math.ceil(totalHours / shiftHours);
    const commuteMin = 50; // minutes

    for (let w = 0; w < 2; w++) {
      let remainingShifts = requiredShifts;

      const tryJobAt = async (day, startHH) => {
        if (remainingShifts <= 0) return false;
        const slot = tryPlaceBlock(calendar, base, day, startHH, shiftHours, w, 30, '22:00');
        if (!slot) return false;
        const commuteStart = new Date(slot.start.getTime() - commuteMin * 60000);
        const commuteEnd = new Date(slot.start);
        if (!isSlotFree(calendar, commuteStart, commuteEnd)) return false;
        const ok1 = await safeAdd('Commute to Work', commuteStart, commuteEnd, '#475569');
        const ok2 = ok1 && await safeAdd('Part-time Job', slot.start, slot.end, '#d97706');
        // Commute back home
        const backStart = new Date(slot.end);
        const backEnd = new Date(slot.end.getTime() + commuteMin * 60000);
        const ok3 = ok2 && isSlotFree(calendar, backStart, backEnd) && await safeAdd('Commute Home', backStart, backEnd, '#475569');
        if (ok1 && ok2) {
          remainingShifts -= 1;
          jobSummary['week' + w] += shiftHours;
          return true;
        }
        return false;
      };

      // Preferred windows first
      const preferred = [
        ['Monday','17:00'], ['Wednesday','17:00'], ['Friday','17:00'],
        ['Saturday','12:00'], ['Sunday','12:00']
      ];
      for (const [day, startHH] of preferred) {
        if (remainingShifts <= 0) break;
        await tryJobAt(day, startHH);
      }

      // Alternate windows to better hit requested hours
      const alternates = [
        ['Tuesday','17:00'], ['Thursday','17:00'],
        ['Saturday','17:30'], ['Sunday','17:30'],
        ['Tuesday','18:00'], ['Thursday','18:00']
      ];
      for (const [day, startHH] of alternates) {
        if (remainingShifts <= 0) break;
        await tryJobAt(day, startHH);
      }

      // As a last resort, scan across the week with 30-min steps for any available 5h block
      if (remainingShifts > 0) {
        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        for (const day of days) {
          if (remainingShifts <= 0) break;
          for (let h = 9; h <= 18 && remainingShifts > 0; h += 0.5) {
            const hh = Math.floor(h).toString().padStart(2,'0');
            const mm = (h % 1 ? '30' : '00');
            const startHH = `${hh}:${mm}`;
            // eslint-disable-next-line no-await-in-loop
            const placed = await tryJobAt(day, startHH);
            if (placed && remainingShifts <= 0) break;
          }
        }
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
  let jobSummaryText = '';
  if (wiz.data.hasJob) {
    const req = Math.max(5, wiz.data.jobHours || 10);
    const w0 = jobSummary.week0; const w1 = jobSummary.week1;
    jobSummaryText = ` Job hours scheduled: week 1 ${w0}h, week 2 ${w1}h (requested ${req}h/week).`;
  }
  appendMessage('bot', `${randomAck('your schedule is ready!')} I planned the first two weeks starting ${base.toLocaleDateString()}.
Courses (${total} credits): ${courseList || 'none found for that semester'}.
I avoided clashes, used 5-hour job shifts with commute buffer, and placed clubs/study/project according to your priorities.${jobSummaryText}`);
  // Ask for review, keep wizard active
  const reviewQs = [
    'How does this look? Want any tweaks (e.g., more study hours, move job to weekdays)?',
    "Thanks — does this work for you, or should I adjust anything?",
    "Gotcha. Shall I change study time or move work around?",
    "That's nice to see filled in. Any changes you'd like?"
  ];
  appendMessage('bot', reviewQs[Math.floor(Math.random()*reviewQs.length)]);
  hideLoading();
  wiz.step = 'review';
  wiz.active = true;
}

// Helpers for review adjustments
function getWeekRange(baseDate, weekOffset = 0) {
  const d = new Date(baseDate);
  const baseDow = d.getDay();
  const diffToMonday = (baseDow === 0 ? -6 : 1 - baseDow);
  d.setDate(d.getDate() + diffToMonday + weekOffset * 7);
  const start = new Date(d); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}

function hoursBetween(start, end) { return (new Date(end) - new Date(start)) / 3600000; }

async function applyStudyHoursAdjustment(calendar, baseStart, targetPerWeek, pref = 'morning') {
  const placeBlock = async (title, day, startHH, durHours, week) => {
    const s = dateForWeekdayFrom(baseStart, day, startHH, week);
    const e = new Date(s.getTime() + durHours * 3600000);
    if (isSlotFree(calendar, s, e)) {
      try {
        const saved = await window.authSystem.createEvent({ title, start: s.toISOString(), end: e.toISOString(), allDay: false, backgroundColor: '#6f42c1', description: '' });
        calendar.addEvent({ id: saved.id, title: saved.title, start: saved.start_date, end: saved.end_date, allDay: saved.all_day, backgroundColor: saved.color, extendedProps: { description: saved.description } });
        return true;
      } catch { calendar.addEvent({ title, start: s, end: e, backgroundColor: '#6f42c1', borderColor: '#6f42c1', textColor: '#fff' }); return true; }
    }
    return false;
  };

  const studyBlocks = allocateStudyBlocks(pref);
  for (let w=0; w<2; w++) {
    const range = getWeekRange(baseStart, w);
    const events = calendar.getEvents().filter(ev => ev.title === 'Study Session' && ev.start >= range.start && ev.start <= range.end);
    let current = events.reduce((sum, ev) => sum + hoursBetween(ev.start, ev.end), 0);
    // Remove excess
    if (current > targetPerWeek) {
      let toRemove = current - targetPerWeek + 1e-6;
      const sorted = events.sort((a,b)=>b.start-a.start); // remove latest first
      for (const ev of sorted) {
        if (toRemove <= 0) break;
        const dur = hoursBetween(ev.start, ev.end);
        try { if (ev.id && window.authSystem?.deleteEvent) await window.authSystem.deleteEvent(ev.id) } catch {}
        ev.remove(); toRemove -= dur;
      }
      continue;
    }
    // Add missing
    let need = targetPerWeek - current;
    const windows = [...studyBlocks, ['Friday','18:00','20:00'], ['Monday','18:00','20:00']];
    for (const [day, sHH, eHH] of windows) {
      if (need <= 0) break;
      const dur = Math.min(2, need);
      // eslint-disable-next-line no-await-in-loop
      const ok = await placeBlock('Study Session', day, sHH, dur, w);
      if (ok) need -= dur;
    }
  }
}

async function applyWeekdayJobAdjustment(calendar, baseStart, requestedHoursPerWeek) {
  const isWeekend = d => { const day = new Date(d).getDay(); return day === 0 || day === 6; };
  // Remove weekend job + commute events
  const titles = ['Part-time Job','Commute to Work','Commute Home'];
  for (const ev of calendar.getEvents()) {
    if (titles.includes(ev.title) && isWeekend(ev.start)) {
      try { if (ev.id && window.authSystem?.deleteEvent) await window.authSystem.deleteEvent(ev.id); } catch {}
      ev.remove();
    }
  }
  // Count remaining job hours per week
  const countWeek = (w)=>{
    const range = getWeekRange(baseStart, w);
    const evs = calendar.getEvents().filter(ev => ev.title === 'Part-time Job' && ev.start >= range.start && ev.start <= range.end);
    return evs.reduce((sum, ev)=> sum + hoursBetween(ev.start, ev.end), 0);
  };
  const shiftHours = 5; const commuteMin = 50;
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  // Move a flexible event (study/project) to weekend to free space
  const moveEventToWeekend = async (ev) => {
    const durH = hoursBetween(ev.start, ev.end);
    const candidates = [ ['Saturday','10:00'], ['Saturday','13:00'], ['Sunday','10:00'], ['Sunday','13:00'], ['Sunday','16:00'] ];
    for (const [d, hh] of candidates) {
      const s = dateForWeekdayFrom(baseStart, d, hh, 0); // same week as ev
      const e = new Date(s.getTime() + durH * 3600000);
      if (isSlotFree(calendar, s, e)) {
        // Update UI
        ev.setStart(s); ev.setEnd(e);
        try { if (ev.id && window.authSystem?.updateEvent) await window.authSystem.updateEvent(ev.id, { title: ev.title, start: s.toISOString(), end: e.toISOString(), allDay: !!ev.allDay, backgroundColor: ev.backgroundColor, description: ev.extendedProps?.description || '' }); } catch {}
        return true;
      }
    }
    return false;
  };

  const bumpAndPlace = async (w, day, startHH) => {
    // Build the candidate time window and try to move flexible events away
    const s = dateForWeekdayFrom(baseStart, day, startHH, w);
    const e = new Date(s.getTime() + shiftHours * 3600000);
    // Find overlapping events
    const overlaps = calendar.getEvents().filter(ev => eventsOverlap(s, e, new Date(ev.start), new Date(ev.end || ev.start)));
    // Only proceed if overlapping events are flexible
    const flex = overlaps.filter(ev => /Study Session|Project Work/i.test(ev.title));
    if (!flex.length) return false;
    // Try to move each flexible event to a weekend slot
    for (const ev of flex) {
      // eslint-disable-next-line no-await-in-loop
      const moved = await moveEventToWeekend(ev);
      if (!moved) return false; // cannot clear this time window
    }
    // After clearing, try to place the job now
    return await placeJob(w, day, startHH);
  };

  const placeJob = async (w, day, startHH) => {
    const slot = tryPlaceBlock(calendar, baseStart, day, startHH, shiftHours, w, 30, '22:00');
    if (!slot) return false;
    const cs = new Date(slot.start.getTime() - commuteMin * 60000), ce = new Date(slot.start);
    if (!isSlotFree(calendar, cs, ce)) return false;
    try { const s1 = await window.authSystem.createEvent({ title: 'Commute to Work', start: cs.toISOString(), end: ce.toISOString(), allDay: false, backgroundColor: '#475569', description: '' }); calendar.addEvent({ id: s1.id, title: s1.title, start: s1.start_date, end: s1.end_date, allDay: s1.all_day, backgroundColor: s1.color }); } catch { calendar.addEvent({ title: 'Commute to Work', start: cs, end: ce, backgroundColor: '#475569' }); }
    try { const s2 = await window.authSystem.createEvent({ title: 'Part-time Job', start: slot.start.toISOString(), end: slot.end.toISOString(), allDay: false, backgroundColor: '#d97706', description: '' }); calendar.addEvent({ id: s2.id, title: s2.title, start: s2.start_date, end: s2.end_date, allDay: s2.all_day, backgroundColor: s2.color }); } catch { calendar.addEvent({ title: 'Part-time Job', start: slot.start, end: slot.end, backgroundColor: '#d97706' }); }
    const bhS = new Date(slot.end), bhE = new Date(slot.end.getTime() + commuteMin * 60000);
    if (isSlotFree(calendar, bhS, bhE)) { try { const s3 = await window.authSystem.createEvent({ title: 'Commute Home', start: bhS.toISOString(), end: bhE.toISOString(), allDay: false, backgroundColor: '#475569', description: '' }); calendar.addEvent({ id: s3.id, title: s3.title, start: s3.start_date, end: s3.end_date, allDay: s3.all_day, backgroundColor: s3.color }); } catch { calendar.addEvent({ title: 'Commute Home', start: bhS, end: bhE, backgroundColor: '#475569' }); } }
    return true;
  };

  for (let w=0; w<2; w++) {
    let have = countWeek(w);
    while (have + 1e-6 < requestedHoursPerWeek) {
      let placed = false;
      for (const day of days) {
        if (placed) break;
        for (const hh of ['16:00','17:00','18:00','13:00']) {
          // eslint-disable-next-line no-await-in-loop
          if (await placeJob(w, day, hh)) { placed = true; break; }
          // If direct place fails, try to bump flexible events and then place
          // eslint-disable-next-line no-await-in-loop
          if (!placed && await bumpAndPlace(w, day, hh)) { placed = true; break; }
        }
      }
      if (!placed) break; // cannot place more
      have = countWeek(w);
    }
  }
}

// === Missing helpers and UI wiring ===

// Basic time range parser: accepts "HH:MM-HH:MM", "H-H", and am/pm variants
function parseTimeRange(text) {
  if (!text) return null;
  const s = String(text).trim().toLowerCase();
  // Normalize spaces
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let [ , sh, sm, samp, eh, em, eamp ] = m;
  sm = sm || '00'; em = em || '00';
  const to24 = (h, min, ap) => {
    let hh = parseInt(h, 10);
    let mm = parseInt(min, 10) || 0;
    if (ap) {
      const apu = ap.toLowerCase();
      if (apu === 'pm' && hh < 12) hh += 12;
      if (apu === 'am' && hh === 12) hh = 0;
    }
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };
  // If only one am/pm provided, apply smart default to the other
  if (samp && !eamp) eamp = samp; // assume same period if end lacks
  const start = to24(sh, sm, samp);
  const end = to24(eh, em, eamp);
  return { start, end };
}

function eventsOverlap(aStart, aEnd, bStart, bEnd) {
  const s1 = new Date(aStart).getTime();
  const e1 = new Date(aEnd).getTime();
  const s2 = new Date(bStart).getTime();
  const e2 = new Date(bEnd).getTime();
  return s1 < e2 && s2 < e1;
}

function isSlotFree(calendar, start, end) {
  try {
    const evs = calendar.getEvents();
    for (const ev of evs) {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end || ev.start);
      if (eventsOverlap(start, end, evStart, evEnd)) return false;
    }
    return true;
  } catch (_) { return true; }
}

// Try to place a block starting near startHH for a given weekday; slide by stepMinutes until latestEndHH
function tryPlaceBlock(calendar, baseStart, weekdayName, startHH, hours, weekOffset = 0, stepMinutes = 15, latestEndHH = '22:00') {
  const latestEnd = latestEndHH || '22:00';
  let cur = dateForWeekdayFrom(baseStart, weekdayName, startHH, weekOffset);
  const latest = dateForWeekdayFrom(baseStart, weekdayName, latestEnd, weekOffset);
  const durMs = (hours || 1) * 3600000;
  while (cur.getTime() + durMs <= latest.getTime()) {
    const end = new Date(cur.getTime() + durMs);
    if (isSlotFree(calendar, cur, end)) return { start: new Date(cur), end };
    cur = new Date(cur.getTime() + stepMinutes * 60000);
  }
  return null;
}

function allocateStudyBlocks(pref = 'morning') {
  // Return [day, startHH, endHH] templates
  const sets = {
    morning: [ ['Monday','09:00','11:00'], ['Tuesday','09:00','11:00'], ['Thursday','09:00','11:00'], ['Saturday','10:00','12:00'] ],
    afternoon: [ ['Monday','14:00','16:00'], ['Wednesday','14:00','16:00'], ['Friday','14:00','16:00'], ['Sunday','13:00','15:00'] ],
    evening: [ ['Monday','19:00','21:00'], ['Wednesday','19:00','21:00'], ['Thursday','19:00','21:00'], ['Sunday','18:00','20:00'] ]
  };
  return sets[pref] || sets.morning;
}

// Parse clubs text like: "Soccer Tue 18:00-20:00, Volleyball Sat 10am-12pm" or "monday from 6pm to 8pm - Basketball"
function parseClubsInputToBlocks(text, knownClubs = []) {
  const out = [];
  if (!text) return out;
  const parts = String(text).split(/\s*[,;\n]+\s*/);
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for (let raw of parts) {
    if (!raw) continue;
    const day = detectWeekday(raw);
    const tr = parseTimeRangeFlexible(raw) || parseTimeRange(raw);
    if (!day || !tr) continue;
    let name = '';
    // Try to find a known club name in the fragment
    const lower = raw.toLowerCase();
    for (const k of knownClubs) {
      if (lower.includes(String(k).toLowerCase())) { name = k; break; }
    }
    // If not found, extract first capitalized word(s) before day
    if (!name) {
      const beforeDay = raw.split(new RegExp(day, 'i'))[0] || raw;
      const m = beforeDay.match(/([A-Z][A-Za-z0-9&\- ]{2,})/);
      name = (m && m[1].trim()) || 'Club Activity';
    }
    out.push({ name, day, start: tr.start, end: tr.end });
  }
  return out;
}

async function clearAllEvents(calendar) {
  try {
    const evs = calendar.getEvents();
    for (const ev of evs) {
      try { if (ev.id && window.authSystem?.deleteEvent) await window.authSystem.deleteEvent(ev.id); } catch {}
      ev.remove();
    }
    appendMessage('bot', randomAck('cleared all events'));
  } catch (e) {
    appendMessage('bot', 'Sorry — failed to clear events.');
  }
}

// Natural date range parsing helpers (restore previous capability)
const monthNameToIndex = {
  january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,
  jan:0,feb:1,mar:2,apr:3,may_s:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11
};

function firstWeekOfMonth(year, monthIdx) {
  const d = new Date(year, monthIdx, 1);
  const dow = d.getDay();
  const diffToMonday = (dow === 0 ? -6 : 1 - dow);
  d.setDate(d.getDate() + diffToMonday);
  const start = new Date(d); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}

function lastWeekOfMonth(year, monthIdx) {
  const lastDay = new Date(year, monthIdx + 1, 0); // last day of month
  const dow = lastDay.getDay();
  const lastMonday = new Date(lastDay);
  const diffToMonday = (dow === 0 ? -6 : 1 - dow);
  lastMonday.setDate(lastMonday.getDate() + diffToMonday);
  const start = new Date(lastMonday); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}

function wholeMonthRange(year, monthIdx) {
  const start = new Date(year, monthIdx, 1, 0,0,0,0);
  const end = new Date(year, monthIdx + 1, 0, 23,59,59,999);
  return { start, end };
}

function parseDateFromMonthDay(text, baseYear) {
  const m = String(text).toLowerCase().match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
  if (!m) return null;
  const monthName = m[1].toLowerCase();
  const monthIdx = monthNameToIndex[monthName.replace(/\s+/g,'_')];
  const day = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : baseYear;
  if (monthIdx == null || !day || !year) return null;
  return new Date(year, monthIdx, day, 0,0,0,0);
}

function parseDateRangeNatural(text, baseAnchor = new Date()) {
  const t = String(text || '').toLowerCase();
  const year = baseAnchor.getFullYear();

  // explicit from X to Y
  const between = t.match(/from\s+([a-z]{3,}\s+\d{1,2}(?:,\s*\d{4})?)\s+(?:to|\-)\s+([a-z]{3,}\s+\d{1,2}(?:,\s*\d{4})?)/i);
  if (between) {
    const s = parseDateFromMonthDay(between[1], year);
    const e = parseDateFromMonthDay(between[2], year);
    if (s && e) { const end = new Date(e); end.setHours(23,59,59,999); return { start: s, end }; }
  }

  // week of <month day>
  const weekOf = t.match(/week\s+of\s+([a-z]{3,}\s+\d{1,2}(?:,\s*\d{4})?)/i);
  if (weekOf) {
    const on = parseDateFromMonthDay(weekOf[1], year);
    if (on) {
      const dow = on.getDay();
      const monday = new Date(on);
      const diffToMonday = (dow === 0 ? -6 : 1 - dow);
      monday.setDate(monday.getDate() + diffToMonday);
      const start = new Date(monday); start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      return { start, end };
    }
  }

  // first/last week of <month>
  const fl = t.match(/(first|last)\s+week\s+of\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i);
  if (fl) {
    const which = fl[1].toLowerCase();
    const mname = fl[2].toLowerCase();
    const midx = monthNameToIndex[mname.replace(/\s+/g,'_')];
    if (midx != null) {
      return which === 'first' ? firstWeekOfMonth(year, midx) : lastWeekOfMonth(year, midx);
    }
  }

  // whole month like "September"
  const monthOnly = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  if (monthOnly) {
    const midx = monthNameToIndex[monthOnly[1].toLowerCase()];
    if (midx != null) return wholeMonthRange(year, midx);
  }

  // Fallback: current week
  const dow = baseAnchor.getDay();
  const monday = new Date(baseAnchor);
  const diffToMonday = (dow === 0 ? -6 : 1 - dow);
  monday.setDate(monday.getDate() + diffToMonday);
  const start = new Date(monday); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}

function determineCategoriesFromPhrase(text) {
  const s = String(text||'').toLowerCase();
  const cats = new Set();
  if (/club|society|practice|team/.test(s)) cats.add('club');
  if (/study|revision|reading/.test(s)) cats.add('study');
  if (/job|work|shift|baito/.test(s)) cats.add('job');
  if (/project|research|thesis|capstone/.test(s)) cats.add('project');
  if (/course|class|lecture|exercise|lab|tutorial|seminar/.test(s)) cats.add('course');
  if (/commute/.test(s)) cats.add('commute');
  if (/all\s+events|everything/.test(s)) cats.add('all');
  if (!cats.size) cats.add('all');
  return Array.from(cats);
}

function eventMatchesCategories(ev, categories) {
  const title = (ev.title || '').toLowerCase();
  const checks = {
    club: /(club|soccer|basketball|volley|tennis|band|music|activity)/,
    study: /(study\s*session|study|revision|reading)/,
    job: /(part-?time\s*job|job|work|shift|baito)/,
    project: /(project\s*work|project|research|thesis|capstone)/,
    course: /(lecture|exercise|seminar|tutorial|lab|[A-Z]{2,}\d{2,})/,
    commute: /(commute\s*(to|home)?)/,
    all: /.*/
  };
  return categories.some(cat => (checks[cat] || /.*/).test(title));
}

async function deleteActivitiesInRange(categoryPhrase, timePhrase, calendar) {
  const base = (scheduleWizard?.data?.baseSemester?.start) || new Date();
  const { start, end } = parseDateRangeNatural(timePhrase || '', base);
  const cats = determineCategoriesFromPhrase(categoryPhrase || '');
  const evs = calendar.getEvents().filter(ev => {
    const s = new Date(ev.start);
    return s >= start && s <= end && eventMatchesCategories(ev, cats);
  });
  let count = 0;
  for (const ev of evs) {
    try { if (ev.id && window.authSystem?.deleteEvent) await window.authSystem.deleteEvent(ev.id); } catch {}
    ev.remove(); count++;
  }
  appendMessage('bot', `${randomAck('deleted')}: ${count} event(s) ${cats.includes('all') ? '' : `in ${cats.join(', ')}`} for ${start.toLocaleDateString()}–${end.toLocaleDateString()}`.trim());
}

// Handle user input at the top level
async function handleUserInput(msg, calendar) {
  const text = String(msg || '').trim();
  if (!text) return;

  // If wizard is active, route to it
  if (scheduleWizard.active) {
    const handled = await handleScheduleWizardAnswer(text, calendar);
    if (!handled) appendMessage('bot', "Sorry, I didn't catch that. Could you rephrase?");
    return;
  }

  // Commands
  if (/^(clear|delete)\s+all\s+events$/i.test(text)) { await clearAllEvents(calendar); return; }
  if (/^(start|generate|make).*(plan|schedule)/i.test(text) || /schedule\s+wizard/i.test(text)) {
    appendMessage('bot', 'Awesome — I\'ll help you plan. I\'ll ask a few quick questions.');
    await startScheduleWizard(calendar);
    return;
  }

  // Natural delete within a time range/category
  if (/^(delete|remove)\b/i.test(text)) {
    await deleteActivitiesInRange(text, text, calendar);
    return;
  }

  // Lightweight local add command to avoid AI dependency
  if (/^add\b/i.test(text) || /^please\s+add\b/i.test(text)) {
    const ok = await addGeneralEventFromText(text, calendar);
    if (ok) return;
  }

  // Fallback to AI small talk/help
  showLoading();
  const reply = await askChatGPT([
    { role: 'system', content: 'You are a friendly student scheduling assistant. Keep answers short and helpful.' },
    { role: 'user', content: text }
  ]);
  hideLoading();
  if (reply) appendMessage('bot', reply);
  else appendMessage('bot', 'Hmm, I could not reach the AI right now. Try again or say "generate schedule".');
}

// Attach UI listeners
(function setupChatUI() {
  if (!chatInput || !sendBtn || !chatMessages) return;
  // Greet
  appendMessage('bot', 'Hi! I can build your two-week schedule. Type "generate schedule" to start, or say "add <title> Tue 3-4pm" to add an event.');

  const getCal = () => window.calendar;
  sendBtn.addEventListener('click', async () => {
    const val = chatInput.value.trim();
    if (!val) return;
    appendMessage('user', val);
    chatInput.value = '';
    await handleUserInput(val, getCal());
  });
  chatInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = chatInput.value.trim();
      if (!val) return;
      appendMessage('user', val);
      chatInput.value = '';
      await handleUserInput(val, getCal());
    }
  });

  // Preload memory (non-blocking)
  try { loadUserMemory(); } catch {}
})();
