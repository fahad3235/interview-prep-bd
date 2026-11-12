// interview-prep-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9362;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/ipb-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const click = async (id) => ev(`document.getElementById('${id}').click()`);
  const BN_TITLE = '\u0987\u09a8\u09cd\u099f\u09be\u09b0\u09ad\u09bf\u0989 \u09aa\u09cd\u09b0\u09c7\u09aa \u09ac\u09bf\u09a1\u09bf';

  // ---- Load: defaults ----
  await nav(BASE);
  check('page title mentions Interview Prep', (await ev('document.title'))?.includes('Interview Prep'));
  check('4 tabs', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 4);
  check('count line says 40 questions', (await ev(`document.getElementById('countLine').textContent`)).includes('40'));
  check('bank renders 40 cards', (await ev(`document.querySelectorAll('#bankList .qcard').length`)) === 40);
  check('first card asks "Tell me about yourself"',
    (await ev(`document.querySelector('#bankList .qcard .qtext').textContent`)).includes('Tell me about yourself'));

  // ---- Search + filters ----
  await ev(`var el=document.getElementById('searchInput'); el.value='salary'; el.dispatchEvent(new Event('input',{bubbles:true}))`);
  check('search salary -> 1 card', (await ev(`document.querySelectorAll('#bankList .qcard').length`)) === 1);
  await ev(`var el=document.getElementById('searchInput'); el.value=''; el.dispatchEvent(new Event('input',{bubbles:true}))`);
  await ev(`var el=document.getElementById('catFilter'); el.value='tech'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('tech filter -> 8 cards', (await ev(`document.querySelectorAll('#bankList .qcard').length`)) === 8);
  await ev(`var el=document.getElementById('diffFilter'); el.value='hard'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('tech + hard -> 1 card', (await ev(`document.querySelectorAll('#bankList .qcard').length`)) === 1);
  await ev(`var el=document.getElementById('catFilter'); el.value='all'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  await ev(`var el=document.getElementById('diffFilter'); el.value='all'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('filters reset -> 40 cards', (await ev(`document.querySelectorAll('#bankList .qcard').length`)) === 40);

  // ---- Show answer / bookmark / reviewed ----
  await ev(`document.querySelector('#bankList .qcard [data-act="toggle-answer"]').click()`);
  check('answer reveals on toggle', (await ev(`document.querySelector('#bankList .qcard .answer').hidden`)) === false);
  check('answer mentions STAR or outline content',
    (await ev(`document.querySelector('#bankList .qcard .answer').textContent`)).includes('Model answer'));
  await ev(`document.querySelector('#bankList .qcard [data-act="bookmark"]').click()`);
  await ev(`var el=document.getElementById('bmOnly'); el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('bookmarked-only -> 1 card', (await ev(`document.querySelectorAll('#bankList .qcard').length`)) === 1);
  await ev(`var el=document.getElementById('bmOnly'); el.checked=false; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  await ev(`document.querySelector('#bankList .qcard [data-act="reviewed"]').click()`);
  check('reviewed chip appears', (await ev(`document.querySelector('#bankList .qcard .reviewed-chip')`)) !== null);

  // ---- Flashcards ----
  await ev(`document.querySelector('[data-tab="cards"]').click()`);
  check('card counter says Card 1 of 40', (await ev(`document.getElementById('cardCounter').textContent`)).includes('1 of 40'));
  await ev(`document.getElementById('flashInner').click()`);
  check('card flip shows answer', (await ev(`document.querySelector('#cardBox .flash-a')`)) !== null);
  await click('nextCardBtn');
  check('next card is Card 2 of 40', (await ev(`document.getElementById('cardCounter').textContent`)).includes('2 of 40'));
  await ev(`var el=document.getElementById('cardCat'); el.value='tech'; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('cards tech filter -> Card 1 of 8', (await ev(`document.getElementById('cardCounter').textContent`)).includes('1 of 8'));

  // ---- Mock interview: 5 questions, rate all 5, finish ----
  await ev(`document.querySelector('[data-tab="mock"]').click()`);
  await click('startMockBtn');
  check('mock run visible', (await ev(`document.getElementById('mockRun').hidden`)) === false);
  check('mock label Question 1 of 5', (await ev(`document.getElementById('mockQLabel').textContent`)).includes('Question 1 of 5'));
  check('mock timer looks like mm:ss', /^\d\d:\d\d$/.test(await ev(`document.getElementById('mockTimer').textContent`)));
  for (let i = 0; i < 5; i++) {
    await ev(`document.querySelector('#mockRate button[data-rate="5"]').click()`);
    await click('mockNextBtn');
    await wait(150);
  }
  check('mock result visible', (await ev(`document.getElementById('mockResult').hidden`)) === false);
  check('mock score is 5 / 5', (await ev(`document.getElementById('mockScore').textContent`)).includes('5 / 5'));
  check('mock score label mentions Excellent', (await ev(`document.getElementById('mockScoreLabel').textContent`)).includes('Excellent'));
  check('mock summary mentions 5 questions', (await ev(`document.getElementById('mockSummaryLine').textContent`)).includes('5'));

  // ---- Progress: reviewed 1, bookmarked 1, 1 session ----
  await ev(`document.querySelector('[data-tab="progress"]').click()`);
  check('progress reviewed = 1', (await ev(`document.getElementById('progReviewed').textContent`)) === '1');
  check('progress bookmarked = 1', (await ev(`document.getElementById('progBookmarked').textContent`)) === '1');
  check('progress total = 40', (await ev(`document.getElementById('progTotal').textContent`)) === '40');
  check('progress bars render 5 rows', (await ev(`document.querySelectorAll('#progBars .prog-row').length`)) === 5);
  check('session list has 1 session', (await ev(`document.querySelectorAll('#sessionList li').length`)) === 1);
  check('session mentions 5/5', (await ev(`document.getElementById('sessionList').textContent`)).includes('5/5'));

  // ---- Export / erase / import round-trip via test hooks ----
  const payload = await ev(`window.__ipb.exportPayload()`);
  check('export payload is interview-prep-bd v1', payload.includes('"app":"interview-prep-bd"') && payload.includes('"version":1'));
  check('export carries reviewed q01', payload.includes('"q01"'));
  await ev(`window.__ipb.eraseAll()`);
  check('eraseAll clears reviewed', (await ev(`window.__ipb.exportPayload()`)).includes('"reviewed":[]'));
  check('eraseAll clears sessions', (await ev(`window.__ipb.exportPayload()`)).includes('"sessions":[]'));
  const imp = await ev(`JSON.stringify(window.__ipb.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores reviewed q01', (await ev(`window.__ipb.exportPayload()`)).includes('"q01"'));
  const badImp = await ev(`JSON.stringify(window.__ipb.importPayload('{"app":"tip-calculator-bd","version":1,"lang":"en","reviewed":[],"bookmarked":[],"sessions":[]}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__ipb.exportPayload()`)).includes('"q01"'));

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await click('langBtn');
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === BN_TITLE);
  check('BN toggle: count line uses Bengali digits', (await ev(`document.getElementById('countLine').textContent`)).includes('\u09ea\u09e6'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__ipb.state.lang`)) === 'bn');
  await click('langBtn');
  check('back to EN', (await ev(`window.__ipb.state.lang`)) === 'en');

  // ---- Footer disclaimer ----
  check('footer mentions offline', (await ev(`document.getElementById('footerText').textContent`)).includes('Offline'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['bank', 'cards', 'mock', 'progress']) {
    await ev(`document.querySelector('[data-tab="${tab}"]').click()`);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
