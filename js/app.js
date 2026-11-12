// interview-prep-bd -- browser app (vanilla JS, no dependencies).
// Loads js/data.js (QUESTIONS), js/logic.js (L), js/i18n.js (I18N).
'use strict';
(function () {
  var L = window.__ipb_logic || (typeof require === 'function' ? require('./logic.js') : null);
  var QUESTIONS = window.QUESTIONS || [];
  var I18N = window.I18N || {};
  var LS_KEY = 'interview-prep-bd-v1';

  var state = {
    lang: 'en', tab: 'bank',
    cat: 'all', diff: 'all', query: '', onlyBookmarked: false,
    cardCat: 'all', cardIdx: 0, cardOrder: null, cardFlipped: false,
    reviewed: [], bookmarked: [], sessions: [],
    mock: null // {questions, idx, ratings, secondsLeft, perQ, totalElapsed, timerId}
  };

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var v = L.validateImport(raw);
      if (v.ok) {
        state.lang = v.data.lang;
        state.reviewed = v.data.reviewed;
        state.bookmarked = v.data.bookmarked;
        state.sessions = v.data.sessions;
      }
    } catch (e) { /* corrupted storage: start fresh */ }
  }
  function save() {
    try { localStorage.setItem(LS_KEY, L.buildExport(state)); } catch (e) { /* storage full/blocked */ }
  }

  function t(key) {
    var pack = I18N[state.lang] || I18N.en;
    return pack[key] || I18N.en[key] || key;
  }
  function num(n) { return state.lang === 'bn' ? L.toBnDigits(n) : String(n); }
  function qtext(q) { return state.lang === 'bn' ? q.q_bn : q.q_en; }
  function atext(q) { return state.lang === 'bn' ? q.a_bn : q.a_en; }
  function tiptext(q) { return state.lang === 'bn' ? q.tip_bn : q.tip_en; }
  function catName(c) { return t('cat_' + c); }
  function diffName(d) { return t('diff_' + d); }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- Bank tab ----------
  function filteredBank() {
    var list = L.filterQuestions(QUESTIONS, { cat: state.cat, diff: state.diff, query: state.query });
    if (state.onlyBookmarked) {
      var bm = {};
      state.bookmarked.forEach(function (id) { bm[id] = true; });
      list = list.filter(function (q) { return bm[q.id]; });
    }
    return list;
  }

  function renderBank() {
    var list = filteredBank();
    $('countLine').textContent = t('questionsFound').replace('{n}', num(list.length));
    var box = $('bankList');
    if (!list.length) {
      box.innerHTML = '<p class="empty" id="bankEmpty">' + esc(t('emptyBank')) + '</p>';
      return;
    }
    box.innerHTML = list.map(function (q) {
      var isBm = state.bookmarked.indexOf(q.id) !== -1;
      var isRv = state.reviewed.indexOf(q.id) !== -1;
      return '<article class="qcard" data-qid="' + q.id + '">' +
        '<div class="qhead"><span class="chip">' + esc(catName(q.cat)) + '</span>' +
        '<span class="chip diff-' + q.diff + '">' + esc(diffName(q.diff)) + '</span>' +
        (isRv ? '<span class="chip reviewed-chip">' + esc(t('reviewed')) + '</span>' : '') + '</div>' +
        '<h3 class="qtext">' + esc(qtext(q)) + '</h3>' +
        '<div class="answer" hidden>' +
        '<p class="ans-label">' + esc(t('modelAnswer')) + '</p><ul>' +
        atext(q).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
        '<p class="tip"><strong>' + esc(t('tip')) + ':</strong> ' + esc(tiptext(q)) + '</p></div>' +
        '<div class="qactions">' +
        '<button class="btn small" data-act="toggle-answer">' + esc(t('showAnswer')) + '</button>' +
        '<button class="btn small" data-act="bookmark">' + (isBm ? '\u2605 ' : '\u2606 ') + esc(t('bookmark')) + '</button>' +
        '<button class="btn small" data-act="reviewed">' + (isRv ? '\u2713 ' : '') + esc(t('markReviewed')) + '</button>' +
        '</div></article>';
    }).join('');
  }

  // ---------- Flashcards tab ----------
  function cardPool() {
    return L.filterQuestions(QUESTIONS, { cat: state.cardCat });
  }
  function ensureCardOrder() {
    var pool = cardPool();
    if (!state.cardOrder || state.cardOrder.length !== pool.length ||
        state.cardOrder.some(function (id) { return pool.filter(function (q) { return q.id === id; }).length === 0; })) {
      state.cardOrder = pool.map(function (q) { return q.id; });
      state.cardIdx = 0;
    }
    if (state.cardIdx >= state.cardOrder.length) state.cardIdx = 0;
  }
  function renderCards() {
    ensureCardOrder();
    var pool = cardPool();
    var box = $('cardBox');
    if (!pool.length) {
      box.innerHTML = '<p class="empty">' + esc(t('emptyCards')) + '</p>';
      $('cardCounter').textContent = '';
      return;
    }
    var q = null;
    for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === state.cardOrder[state.cardIdx]) q = QUESTIONS[i];
    $('cardCounter').textContent = t('cardOf').replace('{a}', num(state.cardIdx + 1)).replace('{b}', num(pool.length));
    var flipped = state.cardFlipped;
    box.innerHTML = '<article class="flashcard' + (flipped ? ' flipped' : '') + '" id="flashInner">' +
      '<div class="flash-q"><span class="chip">' + esc(catName(q.cat)) + '</span> ' +
      '<span class="chip diff-' + q.diff + '">' + esc(diffName(q.diff)) + '</span>' +
      '<h3>' + esc(qtext(q)) + '</h3>' +
      '<p class="hint">' + esc(flipped ? '' : t('showAnswer')) + '</p></div>' +
      (flipped ? '<div class="flash-a"><p class="ans-label">' + esc(t('modelAnswer')) + '</p><ul>' +
        atext(q).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
        '<p class="tip"><strong>' + esc(t('tip')) + ':</strong> ' + esc(tiptext(q)) + '</p></div>' : '') +
      '</article>';
  }

  // ---------- Mock tab ----------
  function stopTimer() {
    if (state.mock && state.mock.timerId) { clearInterval(state.mock.timerId); state.mock.timerId = null; }
  }
  function startMock() {
    var count = parseInt($('mockCount').value, 10);
    var perQ = parseInt($('mockTime').value, 10);
    var cat = $('mockCat').value;
    var res = L.pickMockSet(QUESTIONS, count, (Date.now() % 2147483647), cat);
    if (!res.ok) { $('mockError').hidden = false; $('mockError').textContent = 'Not enough questions (' + res.available + ').'; return; }
    $('mockError').hidden = true;
    stopTimer();
    state.mock = { questions: res.questions, idx: 0, ratings: [], perQ: perQ, secondsLeft: perQ, totalElapsed: 0, timerId: null, done: false };
    state.mock.timerId = setInterval(tickMock, 1000);
    renderMock();
  }
  function tickMock() {
    var m = state.mock;
    if (!m || m.done) return;
    if (m.secondsLeft > 0) m.secondsLeft--;
    m.totalElapsed++;
    var el = $('mockTimer');
    if (el) el.textContent = L.fmtTime(m.secondsLeft);
  }
  function rateMock(r) {
    var m = state.mock;
    if (!m || m.done) return;
    m.ratings[m.idx] = r;
    document.querySelectorAll('#mockRate button').forEach(function (b) {
      b.classList.toggle('rated', parseInt(b.dataset.rate, 10) === r);
    });
  }
  function advanceMock() {
    var m = state.mock;
    if (!m || m.done) return;
    if (m.idx < m.questions.length - 1) {
      m.idx++;
      m.secondsLeft = m.perQ;
      renderMock();
    } else {
      finishMock();
    }
  }
  function finishMock() {
    var m = state.mock;
    if (!m) return;
    stopTimer();
    m.done = true;
    var res = L.scoreMock(m.ratings);
    if (!res.ok) { $('mockError').hidden = false; $('mockError').textContent = t('noRatings'); return; }
    state.sessions.unshift({
      date: new Date().toISOString().slice(0, 10),
      count: res.count, avg: res.avg, label: res.label,
      seconds: m.totalElapsed
    });
    save();
    renderMockResult(res, m);
  }
  function renderMock() {
    var m = state.mock;
    $('mockSetup').hidden = true;
    $('mockRun').hidden = false;
    $('mockResult').hidden = true;
    var q = m.questions[m.idx];
    $('mockQLabel').textContent = t('questionOf').replace('{a}', num(m.idx + 1)).replace('{b}', num(m.questions.length));
    $('mockTimer').textContent = L.fmtTime(m.secondsLeft);
    $('mockQText').textContent = qtext(q);
    $('mockAnswer').innerHTML = '<p class="ans-label">' + esc(t('modelAnswer')) + '</p><ul>' +
      atext(q).map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
      '<p class="tip"><strong>' + esc(t('tip')) + ':</strong> ' + esc(tiptext(q)) + '</p>';
    document.querySelectorAll('#mockRate button').forEach(function (b) { b.classList.remove('rated'); });
    $('mockNextBtn').textContent = m.idx === m.questions.length - 1 ? t('finishMock') : t('nextQuestion');
  }
  function renderMockResult(res, m) {
    $('mockRun').hidden = true;
    $('mockResult').hidden = false;
    $('mockResultTitle').textContent = t('mockDone');
    $('mockScore').textContent = num(res.avg) + ' / 5';
    $('mockScoreLabel').textContent = t('score_' + res.label);
    $('mockSummaryLine').textContent = t('mockSummary').replace('{n}', num(res.count)).replace('{t}', L.fmtTime(m.totalElapsed));
    var rows = m.questions.map(function (q, i) {
      return '<li>' + esc(qtext(q)) + ' \u2014 ' + (m.ratings[i] ? num(m.ratings[i]) + '\u2605' : '\u2014') + '</li>';
    }).join('');
    $('mockDetailList').innerHTML = rows;
  }

  // ---------- Progress tab ----------
  function renderProgress() {
    var p = L.computeProgress(QUESTIONS, state.reviewed, state.bookmarked);
    $('progReviewed').textContent = num(p.totals.reviewed);
    $('progBookmarked').textContent = num(p.totals.bookmarked);
    $('progTotal').textContent = num(p.totals.total);
    $('progPct').textContent = num(p.totals.pctReviewed) + '%';
    $('progBars').innerHTML = L.CATEGORIES.map(function (c) {
      var pc = p.perCat[c];
      var pct = pc.total ? Math.round((pc.reviewed / pc.total) * 100) : 0;
      return '<div class="prog-row"><span class="prog-cat">' + esc(catName(c)) + '</span>' +
        '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="prog-num">' + num(pc.reviewed) + '/' + num(pc.total) + '</span></div>';
    }).join('');
    var box = $('sessionList');
    if (!state.sessions.length) {
      box.innerHTML = '<p class="empty">' + esc(t('noSessions')) + '</p>';
    } else {
      box.innerHTML = state.sessions.slice(0, 10).map(function (s) {
        return '<li>' + esc(s.date) + ' \u2014 ' + num(s.count) + ' Q \xb7 ' + num(s.avg) + '/5 \xb7 ' +
          esc(L.fmtTime(s.seconds)) + ' \xb7 ' + esc(t('score_' + s.label)) + '</li>';
      }).join('');
    }
  }

  // ---------- Static text / tabs ----------
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    $('searchInput').placeholder = t('searchPh');
    $('langBtn').textContent = t('langBtn');
    // Keep the bank count line in sync even when the bank tab is hidden.
    $('countLine').textContent = t('questionsFound').replace('{n}', num(filteredBank().length));
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.title = t('title') + ' \u2014 Interview Prep BD';
  }
  function renderTab() {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === state.tab);
    });
    ['bank', 'cards', 'mock', 'progress'].forEach(function (tab) {
      $('tab-' + tab).hidden = state.tab !== tab;
    });
    if (state.tab === 'bank') renderBank();
    if (state.tab === 'cards') renderCards();
    if (state.tab === 'mock' && !state.mock) { $('mockSetup').hidden = false; $('mockRun').hidden = true; $('mockResult').hidden = true; }
    if (state.tab === 'progress') renderProgress();
  }
  function renderAll() {
    applyI18n();
    renderTab();
  }

  // ---------- Events ----------
  function bind() {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.dataset.tab; renderTab(); });
    });
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      save(); renderAll();
    });
    $('searchInput').addEventListener('input', function (e) { state.query = e.target.value; renderBank(); });
    $('catFilter').addEventListener('change', function (e) { state.cat = e.target.value; renderBank(); });
    $('diffFilter').addEventListener('change', function (e) { state.diff = e.target.value; renderBank(); });
    $('bmOnly').addEventListener('change', function (e) { state.onlyBookmarked = e.target.checked; renderBank(); });
    $('bankList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var card = e.target.closest('.qcard');
      var id = card.dataset.qid;
      var q = null;
      for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) q = QUESTIONS[i];
      if (!q) return;
      if (btn.dataset.act === 'toggle-answer') {
        var ans = card.querySelector('.answer');
        ans.hidden = !ans.hidden;
        btn.textContent = ans.hidden ? t('showAnswer') : t('hideAnswer');
      } else if (btn.dataset.act === 'bookmark') {
        var bi = state.bookmarked.indexOf(id);
        if (bi === -1) state.bookmarked.push(id); else state.bookmarked.splice(bi, 1);
        save(); renderBank();
      } else if (btn.dataset.act === 'reviewed') {
        if (state.reviewed.indexOf(id) === -1) state.reviewed.push(id);
        save(); renderBank();
      }
    });
    $('cardCat').addEventListener('change', function (e) {
      state.cardCat = e.target.value; state.cardOrder = null; state.cardIdx = 0; state.cardFlipped = false; renderCards();
    });
    $('shuffleBtn').addEventListener('click', function () {
      var pool = cardPool();
      var ids = pool.map(function (q) { return q.id; });
      var rand = L.mulberry32(Date.now() % 2147483647);
      for (var i = ids.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
      }
      state.cardOrder = ids; state.cardIdx = 0; state.cardFlipped = false; renderCards();
    });
    $('prevCardBtn').addEventListener('click', function () {
      ensureCardOrder();
      state.cardIdx = (state.cardIdx - 1 + state.cardOrder.length) % state.cardOrder.length;
      state.cardFlipped = false; renderCards();
    });
    $('nextCardBtn').addEventListener('click', function () {
      ensureCardOrder();
      state.cardIdx = (state.cardIdx + 1) % state.cardOrder.length;
      state.cardFlipped = false; renderCards();
    });
    $('cardBox').addEventListener('click', function (e) {
      if (e.target.closest('#flashInner')) { state.cardFlipped = !state.cardFlipped; renderCards(); }
    });
    $('startMockBtn').addEventListener('click', startMock);
    document.querySelectorAll('#mockRate button').forEach(function (b) {
      b.addEventListener('click', function () { rateMock(parseInt(b.dataset.rate, 10)); });
    });
    $('mockNextBtn').addEventListener('click', advanceMock);
    $('againMockBtn').addEventListener('click', function () {
      stopTimer(); state.mock = null;
      $('mockSetup').hidden = false; $('mockRun').hidden = true; $('mockResult').hidden = true;
    });
    $('exportBtn').addEventListener('click', function () {
      var blob = new Blob([L.buildExport(state)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'interview-prep-bd-export.json';
      a.click();
      $('dataMsg').textContent = t('exportDone');
    });
    $('importFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var v = L.validateImport(r.result);
        if (v.ok) {
          state.lang = v.data.lang; state.reviewed = v.data.reviewed;
          state.bookmarked = v.data.bookmarked; state.sessions = v.data.sessions;
          save(); $('dataMsg').textContent = t('importOk'); renderAll();
        } else {
          $('dataMsg').textContent = t('importFail').replace('{e}', v.error);
        }
      };
      r.readAsText(f);
      e.target.value = '';
    });
    $('eraseBtn').addEventListener('click', function () {
      var ans = window.prompt(t('eraseConfirm'));
      if (ans === 'DELETE') {
        state.reviewed = []; state.bookmarked = []; state.sessions = [];
        save(); $('dataMsg').textContent = t('erased'); renderAll();
      }
    });
  }

  // ---------- Test hooks ----------
  window.__ipb = {
    state: state,
    exportPayload: function () { return L.buildExport(state); },
    importPayload: function (text) {
      var v = L.validateImport(text);
      if (v.ok) {
        state.lang = v.data.lang; state.reviewed = v.data.reviewed;
        state.bookmarked = v.data.bookmarked; state.sessions = v.data.sessions;
        save(); renderAll();
      }
      return v;
    },
    eraseAll: function () {
      state.reviewed = []; state.bookmarked = []; state.sessions = [];
      save(); renderAll();
    },
    startMock: startMock,
    rateMock: rateMock,
    advanceMock: advanceMock,
    bankCount: function () { return filteredBank().length; }
  };

  load();
  bind();
  renderAll();
})();
