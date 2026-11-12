// interview-prep-bd -- node unit tests for js/logic.js + js/data.js (no DOM).
// Usage: node tests/logic.test.js   (exit 0 = all green)
const L = require('../js/logic.js');
const { QUESTIONS } = require('../js/data.js');
let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}

// ---- Bank integrity ----
check('bank has 40 questions', QUESTIONS.length === 40, 'got ' + QUESTIONS.length);
check('bank validates clean', L.validateBank(QUESTIONS).ok === true,
  JSON.stringify(L.validateBank(QUESTIONS)));
var perCat = {};
QUESTIONS.forEach(function (q) { perCat[q.cat] = (perCat[q.cat] || 0) + 1; });
check('8 questions per category', L.CATEGORIES.every(function (c) { return perCat[c] === 8; }),
  JSON.stringify(perCat));
var perDiff = {};
QUESTIONS.forEach(function (q) { perDiff[q.diff] = (perDiff[q.diff] || 0) + 1; });
check('difficulty mix: easy 15, medium 19, hard 6',
  perDiff.easy === 15 && perDiff.medium === 19 && perDiff.hard === 6, JSON.stringify(perDiff));
check('every question has >=2 EN answer bullets and matching BN count',
  QUESTIONS.every(function (q) { return q.a_en.length >= 2 && q.a_bn.length === q.a_en.length; }));
check('every question has a non-empty tip in both languages',
  QUESTIONS.every(function (q) { return q.tip_en.length > 5 && q.tip_bn.length > 5; }));
check('no duplicate ids', new Set(QUESTIONS.map(function (q) { return q.id; })).size === 40);
check('validateBank rejects dup id',
  L.validateBank(QUESTIONS.concat([QUESTIONS[0]])).error === 'dupId');
check('validateBank rejects bad category',
  L.validateBank([{ id: 'x', cat: 'nope', diff: 'easy', q_en: 'a', q_bn: 'b', a_en: ['c'], a_bn: ['d'], tip_en: 'e', tip_bn: 'f' }]).ok === false);

// ---- Filtering ----
check('filter all returns 40', L.filterQuestions(QUESTIONS, {}).length === 40);
check('filter cat tech returns 8', L.filterQuestions(QUESTIONS, { cat: 'tech' }).length === 8);
check('filter diff hard returns 6', L.filterQuestions(QUESTIONS, { diff: 'hard' }).length === 6);
check('filter cat hr + diff easy returns 4',
  L.filterQuestions(QUESTIONS, { cat: 'hr', diff: 'easy' }).length === 4,
  'got ' + L.filterQuestions(QUESTIONS, { cat: 'hr', diff: 'easy' }).length);
check('search "salary" finds q12', L.filterQuestions(QUESTIONS, { query: 'salary' }).some(function (q) { return q.id === 'q12'; }));
check('search "OOP" finds q17', L.filterQuestions(QUESTIONS, { query: 'OOP' }).some(function (q) { return q.id === 'q17'; }));
check('search "\u09ac\u09c7\u09a4\u09a8" finds q12', L.filterQuestions(QUESTIONS, { query: '\u09ac\u09c7\u09a4\u09a8' }).some(function (q) { return q.id === 'q12'; }));
check('search no-match returns 0', L.filterQuestions(QUESTIONS, { query: 'zzzzqqq' }).length === 0);
check('unknown cat returns 0', L.filterQuestions(QUESTIONS, { cat: 'nope' }).length === 0);

// ---- Mock set picking ----
var m1 = L.pickMockSet(QUESTIONS, 5, 42, 'all');
var m2 = L.pickMockSet(QUESTIONS, 5, 42, 'all');
check('same seed gives same set',
  JSON.stringify(m1.questions.map(function (q) { return q.id; })) ===
  JSON.stringify(m2.questions.map(function (q) { return q.id; })));
check('different seed gives different order',
  JSON.stringify(L.pickMockSet(QUESTIONS, 5, 7, 'all').questions.map(function (q) { return q.id; })) !==
  JSON.stringify(m1.questions.map(function (q) { return q.id; })));
check('mock set has 5 distinct ids',
  new Set(m1.questions.map(function (q) { return q.id; })).size === 5);
check('mock set from one category stays in it',
  L.pickMockSet(QUESTIONS, 5, 3, 'tech').questions.every(function (q) { return q.cat === 'tech'; }));
check('mock set count 8 from tech ok', L.pickMockSet(QUESTIONS, 8, 3, 'tech').ok === true);
check('mock set count 9 from tech fails notEnough',
  L.pickMockSet(QUESTIONS, 9, 3, 'tech').error === 'notEnough');
check('mock count 0 fails badCount', L.pickMockSet(QUESTIONS, 0, 3).error === 'badCount');

// ---- Scoring ----
check('score [5,4,5] avg 4.67 excellent',
  (function () { var s = L.scoreMock([5, 4, 5]); return s.avg === 4.67 && s.label === 'excellent'; })(),
  JSON.stringify(L.scoreMock([5, 4, 5])));
check('score [4,4,3] avg 3.67 good', L.scoreMock([4, 4, 3]).label === 'good');
check('score [3,3,3] avg 3 fair', L.scoreMock([3, 3, 3]).label === 'fair');
check('score [1,2,1] practice', L.scoreMock([1, 2, 1]).label === 'practice');
check('score [] fails noRatings', L.scoreMock([]).ok === false);
check('score ignores out-of-range ratings', L.scoreMock([5, 9, 0]).count === 1);

// ---- fmtTime ----
check('fmtTime 0 -> 00:00', L.fmtTime(0) === '00:00');
check('fmtTime 90 -> 01:30', L.fmtTime(90) === '01:30');
check('fmtTime 120 -> 02:00', L.fmtTime(120) === '02:00');
check('fmtTime 3661 -> 61:01', L.fmtTime(3661) === '61:01');
check('fmtTime negative -> 00:00', L.fmtTime(-5) === '00:00');

// ---- Progress ----
var p = L.computeProgress(QUESTIONS, ['q01', 'q02', 'q17'], ['q01']);
check('progress totals reviewed 3 bookmarked 1',
  p.totals.reviewed === 3 && p.totals.bookmarked === 1, JSON.stringify(p.totals));
check('progress pct 8% (3/40)', p.totals.pctReviewed === 8, 'got ' + p.totals.pctReviewed);
check('progress per-cat about reviewed 2', p.perCat.about.reviewed === 2);
check('progress per-cat tech bookmarked 0', p.perCat.tech.bookmarked === 0);
check('progress empty state pct 0', L.computeProgress(QUESTIONS, [], []).totals.pctReviewed === 0);

// ---- Export / import ----
var exp = L.buildExport({ lang: 'bn', reviewed: ['q01'], bookmarked: [], sessions: [] });
check('export carries app id + version',
  exp.indexOf('"app":"interview-prep-bd"') !== -1 && exp.indexOf('"version":1') !== -1);
check('export round-trip ok', L.validateImport(exp).ok === true);
check('import wrong app rejected', L.validateImport('{"app":"tip-calculator-bd","version":1}').error === 'wrongApp');
check('import wrong version rejected',
  L.validateImport('{"app":"interview-prep-bd","version":2,"lang":"en","reviewed":[],"bookmarked":[],"sessions":[]}').error === 'wrongVersion');
check('import bad json rejected', L.validateImport('{oops').error === 'badJson');
check('import bad lang rejected',
  L.validateImport('{"app":"interview-prep-bd","version":1,"lang":"fr","reviewed":[],"bookmarked":[],"sessions":[]}').error === 'badLang');
check('import dup ids rejected',
  L.validateImport('{"app":"interview-prep-bd","version":1,"lang":"en","reviewed":["q01","q01"],"bookmarked":[],"sessions":[]}').error === 'badIds');
check('import same id in reviewed AND bookmarked is valid',
  L.validateImport('{"app":"interview-prep-bd","version":1,"lang":"en","reviewed":["q01"],"bookmarked":["q01"],"sessions":[]}').ok === true);
check('import bad session rejected',
  L.validateImport('{"app":"interview-prep-bd","version":1,"lang":"en","reviewed":[],"bookmarked":[],"sessions":[{"date":"2026-11-12","count":5,"avg":9}]}').error === 'badSessions');

// ---- Bengali digits ----
check('toBnDigits 123 -> \u09e7\u09e8\u09e9', L.toBnDigits(123) === '\u09e7\u09e8\u09e9');
check('toBnDigits 2026 -> \u09e8\u09e6\u09e8\u09ec', L.toBnDigits('2026') === '\u09e8\u09e6\u09e8\u09ec');
check('toBnDigits leaves letters', L.toBnDigits('Q5') === 'Q\u09eb');

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
