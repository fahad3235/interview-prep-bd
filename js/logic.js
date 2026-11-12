// interview-prep-bd -- pure logic (no DOM). Node-testable.
// Usage in browser: window.__ipb_logic = {...} via app.js glue.
'use strict';

var CATEGORIES = ['about', 'hr', 'tech', 'situational', 'closing'];
var DIFFS = ['easy', 'medium', 'hard'];
var MOCK_COUNTS = [3, 5, 8];
var MOCK_SECONDS = [60, 120, 180];
var APP_ID = 'interview-prep-bd';
var DATA_VERSION = 1;

function isQuestion(q) {
  return q && typeof q.id === 'string' && CATEGORIES.indexOf(q.cat) !== -1 &&
    DIFFS.indexOf(q.diff) !== -1 && typeof q.q_en === 'string' && q.q_en.length > 0 &&
    typeof q.q_bn === 'string' && Array.isArray(q.a_en) && q.a_en.length > 0 &&
    Array.isArray(q.a_bn) && q.a_bn.length === q.a_en.length &&
    typeof q.tip_en === 'string' && typeof q.tip_bn === 'string';
}

function validateBank(questions) {
  if (!Array.isArray(questions)) return { ok: false, error: 'notArray' };
  var ids = {};
  for (var i = 0; i < questions.length; i++) {
    if (!isQuestion(questions[i])) return { ok: false, error: 'badQuestion', index: i };
    if (ids[questions[i].id]) return { ok: false, error: 'dupId', index: i };
    ids[questions[i].id] = true;
  }
  return { ok: true, count: questions.length };
}

// Filter by category ('all' = any), difficulty ('all' = any) and free text.
// Query matches English or Bengali question text, case-insensitive.
function filterQuestions(questions, opts) {
  opts = opts || {};
  var cat = opts.cat || 'all';
  var diff = opts.diff || 'all';
  var query = (opts.query || '').trim().toLowerCase();
  return questions.filter(function (q) {
    if (cat !== 'all' && q.cat !== cat) return false;
    if (diff !== 'all' && q.diff !== diff) return false;
    if (query) {
      var hay = (q.q_en + ' ' + q.q_bn + ' ' + q.a_en.join(' ') + ' ' + q.tip_en).toLowerCase();
      if (hay.indexOf(query) === -1) return false;
    }
    return true;
  });
}

// Deterministic PRNG (mulberry32) so a mock set can be replayed from a seed.
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick `count` distinct questions, shuffled with the given seed.
// Optional category filter first ('all' = whole bank).
function pickMockSet(questions, count, seed, cat) {
  var pool = filterQuestions(questions, { cat: cat || 'all' });
  if (count < 1) return { ok: false, error: 'badCount' };
  if (pool.length < count) return { ok: false, error: 'notEnough', available: pool.length };
  var rand = mulberry32(typeof seed === 'number' ? seed : (Date.now() % 2147483647));
  var arr = pool.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return { ok: true, questions: arr.slice(0, count) };
}

// Ratings: array of 1..5 (one per answered question). Returns summary.
function scoreMock(ratings) {
  var valid = (ratings || []).filter(function (r) { return r >= 1 && r <= 5; });
  if (valid.length === 0) return { ok: false, error: 'noRatings' };
  var total = valid.reduce(function (a, b) { return a + b; }, 0);
  var avg = total / valid.length;
  var label = avg >= 4.5 ? 'excellent' : avg >= 3.5 ? 'good' : avg >= 2.5 ? 'fair' : 'practice';
  return { ok: true, count: valid.length, total: total, avg: Math.round(avg * 100) / 100, label: label };
}

function fmtTime(totalSeconds) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  var m = Math.floor(totalSeconds / 60);
  var s = totalSeconds % 60;
  return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
}

// Progress: reviewed/bookmarked sets are arrays of question ids.
function computeProgress(questions, reviewedIds, bookmarkedIds) {
  var reviewed = {}, bookmarked = {};
  (reviewedIds || []).forEach(function (id) { reviewed[id] = true; });
  (bookmarkedIds || []).forEach(function (id) { bookmarked[id] = true; });
  var perCat = {};
  CATEGORIES.forEach(function (c) { perCat[c] = { total: 0, reviewed: 0, bookmarked: 0 }; });
  var totals = { total: questions.length, reviewed: 0, bookmarked: 0 };
  questions.forEach(function (q) {
    perCat[q.cat].total++;
    if (reviewed[q.id]) { perCat[q.cat].reviewed++; totals.reviewed++; }
    if (bookmarked[q.id]) { perCat[q.cat].bookmarked++; totals.bookmarked++; }
  });
  totals.pctReviewed = questions.length ? Math.round((totals.reviewed / questions.length) * 100) : 0;
  return { perCat: perCat, totals: totals };
}

// ---- Persistence payload (export / import) ----
function buildExport(state) {
  return JSON.stringify({
    app: APP_ID, version: DATA_VERSION,
    lang: state.lang || 'en',
    reviewed: state.reviewed || [],
    bookmarked: state.bookmarked || [],
    sessions: state.sessions || []
  });
}

function validateImport(text) {
  var data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'badJson' }; }
  if (!data || data.app !== APP_ID) return { ok: false, error: 'wrongApp' };
  if (data.version !== DATA_VERSION) return { ok: false, error: 'wrongVersion' };
  if (data.lang !== 'en' && data.lang !== 'bn') return { ok: false, error: 'badLang' };
  if (!Array.isArray(data.reviewed) || !Array.isArray(data.bookmarked) || !Array.isArray(data.sessions)) {
    return { ok: false, error: 'badShape' };
  }
  // Duplicates are invalid within one list; the same id may legitimately
  // appear in both reviewed and bookmarked.
  var badId = [data.reviewed, data.bookmarked].some(function (list) {
    var seen = {};
    return list.some(function (id) {
      if (typeof id !== 'string' || seen[id]) return true;
      seen[id] = true; return false;
    });
  });
  if (badId) return { ok: false, error: 'badIds' };
  var badSession = data.sessions.some(function (s) {
    return !s || typeof s.date !== 'string' || typeof s.count !== 'number' ||
      typeof s.avg !== 'number' || s.avg < 1 || s.avg > 5;
  });
  if (badSession) return { ok: false, error: 'badSessions' };
  return { ok: true, data: data };
}

// Bengali digits for display (0-9 -> \u09e6-\u09ef).
var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
}

var EXPORTS = {
  CATEGORIES: CATEGORIES, DIFFS: DIFFS, MOCK_COUNTS: MOCK_COUNTS,
  MOCK_SECONDS: MOCK_SECONDS, APP_ID: APP_ID, DATA_VERSION: DATA_VERSION,
  isQuestion: isQuestion, validateBank: validateBank,
  filterQuestions: filterQuestions, mulberry32: mulberry32,
  pickMockSet: pickMockSet, scoreMock: scoreMock, fmtTime: fmtTime,
  computeProgress: computeProgress, buildExport: buildExport,
  validateImport: validateImport, toBnDigits: toBnDigits
};
if (typeof module !== 'undefined') module.exports = EXPORTS;
if (typeof window !== 'undefined') window.__ipb_logic = EXPORTS;
