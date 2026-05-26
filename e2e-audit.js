// e2e-audit.js — Forward-Plan v3 Session 1 rig.
// 10 probes + 3 perf timings. Writes STATE.md + audit-screenshots/*.png.
const PW = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(PW);
const FS = require('fs');
const PATH = require('path');

const APP_URL = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';
const OUT = PATH.join(__dirname, 'audit-screenshots');
if (!FS.existsSync(OUT)) FS.mkdirSync(OUT, { recursive: true });

// Post-resetTestPins() PINs per Code.js:458. (Initial seed differs; reset() in Admin → "Reset test PINs".)
const USERS = [
  { name: 'Admin', pin: '1234', role: 'admin'  },
  { name: 'Priya', pin: '1111', role: 'member' },
  { name: 'Ravi',  pin: '2222', role: 'member' },
  { name: 'Meena', pin: '3333', role: 'member' }
];

const results = []; // { probe, status: '✓'|'✗'|'⚠', detail }
const perf = {};    // { homeColdMs, teamScopeColdMs, timelineRenderMs }

function rec(probe, status, detail) {
  results.push({ probe, status, detail: detail || '' });
  console.log(status + ' ' + probe + (detail ? ' — ' + detail : ''));
}

async function findFrame(page, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 30000);
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      try {
        if (await f.$('#screen-pin-login')) return f;
        if (await f.$('[data-screen="pin-login"]')) return f;
        if (await f.$('.pin-btn')) return f;
      } catch (e) {}
    }
    await page.waitForTimeout(300);
  }
  return null;
}

async function loginAs(browser, user) {
  // Always use a fresh context — GAS session cookies leak across goto otherwise.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });
  const frame = await findFrame(page);
  if (!frame) return { frame: null, ms: -1, taps: 0 };
  await page.waitForTimeout(1500);

  let taps = 0;
  // Tap 1: pick the user tile whose visible name matches.
  const picked = await frame.evaluate((name) => {
    const tiles = Array.from(document.querySelectorAll('[data-action="select-user"]'));
    const want = name.split(' ')[0];
    const t = tiles.find(el => (el.innerText || '').trim().toLowerCase().includes(want.toLowerCase()));
    if (!t) return { ok: false, count: tiles.length, names: tiles.map(x => (x.innerText || '').trim()) };
    t.click();
    return { ok: true };
  }, user.name);
  if (!picked || !picked.ok) {
    return { frame, ms: -1, taps, debug: picked };
  }
  taps++;
  await page.waitForTimeout(500);

  // Tap 2: enter PIN digits (one conceptual tap).
  for (const d of user.pin.split('')) {
    const b = await frame.$('[data-digit="' + d + '"]');
    if (b) { await b.click(); await page.waitForTimeout(120); }
  }
  taps++;

  // Wait for home active.
  let homeMs = -1;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(400);
    if (await frame.$('#screen-kanban-home.active')) { homeMs = Date.now() - t0; break; }
  }
  return { frame, page, ctx, ms: homeMs, taps };
}

async function closeCtx(ctx) {
  if (ctx) { try { await ctx.close(); } catch (e) {} }
}

async function evalIn(frame, fn) {
  try { return await frame.evaluate(fn); } catch (e) { return { __err: e.message }; }
}

async function probe1_loginEachUser(browser) {
  for (const u of USERS) {
    const { frame, page, ctx, ms, taps } = await loginAs(browser, u);
    if (!frame || ms < 0) {
      rec('1.login-' + u.name, '✗', 'home never activated');
      await closeCtx(ctx); continue;
    }
    rec('1.login-' + u.name, taps <= 3 ? '✓' : '⚠', 'taps=' + taps + ' home=' + ms + 'ms');
    if (u.name === 'Admin') perf.homeColdMs = ms;
    await page.screenshot({ path: PATH.join(OUT, 'login-' + u.name + '.png') });
    await closeCtx(ctx);
  }
}

async function probe2_scopeFilter(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[1]);
  if (!frame) { rec('2.scope-mine', '✗', 'login failed'); await closeCtx(ctx); return; }
  await evalIn(frame, () => APP.navigate && APP.navigate('kanban-home'));
  await page.waitForTimeout(2000);
  const mine = await evalIn(frame, () => {
    const cards = document.querySelectorAll('#screen-kanban-home .task-card, #screen-kanban-home [data-task-id]');
    return Array.from(cards).map(c => c.getAttribute('data-assignee-name') || c.getAttribute('data-assignee') || '');
  });
  const offMine = Array.isArray(mine) ? mine.filter(n => n && n !== 'Priya' && n !== '').length : -1;
  rec('2.scope-mine', offMine === 0 && Array.isArray(mine) && mine.length > 0 ? '✓' : (offMine === -1 ? '⚠' : (mine.length === 0 ? '⚠' : '✗')),
      'cards=' + (Array.isArray(mine) ? mine.length : '?') + ' non-Priya=' + offMine);
  await page.screenshot({ path: PATH.join(OUT, 'scope-priya-mine.png') });
  await closeCtx(ctx);
}

async function probeTimer(browser, label, action) {
  const { frame, page, ctx } = await loginAs(browser, USERS[0]);
  if (!frame) { rec(label, '✗', 'login failed'); await closeCtx(ctx); return; }
  await page.waitForTimeout(2000);
  const r = await evalIn(frame, (act) => {
    const card = document.querySelector('#screen-kanban-home [data-task-id]');
    if (!card) return { err: 'no card' };
    const id = card.getAttribute('data-task-id');
    const btn = card.querySelector('[data-action="start-timer"], [data-action="stop-timer"]');
    if (btn) btn.click();
    return { id, hadBtn: !!btn };
  });
  await page.waitForTimeout(1500);
  const pill = await evalIn(frame, () => !!document.querySelector('#rec-pill, [data-rec-pill], .rec-pill'));
  await page.screenshot({ path: PATH.join(OUT, label + '.png') });
  rec(label, r && !r.err ? '✓' : '⚠', JSON.stringify(r) + ' recPill=' + pill);
  await closeCtx(ctx);
}

async function probe7_bottomNav(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[0]);
  if (!frame) { rec('7.bottom-nav', '✗', 'login failed'); await closeCtx(ctx); return; }
  const slots = ['kanban-home','myday-share','team-board','reports-kpi','admin-panel'];
  let okN = 0;
  for (const s of slots) {
    await evalIn(frame, (target) => { try { APP.navigate(target); } catch(e){} }, s);
    await page.waitForTimeout(1200);
    const active = await evalIn(frame, (target) => !!document.querySelector('#screen-' + target + '.active'), s);
    if (active) okN++;
  }
  rec('7.bottom-nav', okN === slots.length ? '✓' : '✗', okN + '/' + slots.length + ' slots activated');
  await closeCtx(ctx);
}

async function probe8_gantt(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[0]);
  if (!frame) { rec('8.gantt-grouping', '✗', 'login failed'); await closeCtx(ctx); return; }
  const t0 = Date.now();
  await evalIn(frame, () => APP.navigate('team-timeline'));
  await page.waitForTimeout(3500);
  perf.timelineRenderMs = Date.now() - t0;
  const lanes = await evalIn(frame, () => document.querySelectorAll('#screen-team-timeline [data-project-lane], #screen-team-timeline .project-lane').length);
  rec('8.gantt-grouping', lanes > 0 ? '✓' : '⚠', 'projectLanes=' + lanes + ' renderMs=' + perf.timelineRenderMs);
  await page.screenshot({ path: PATH.join(OUT, 'gantt.png') });
  await closeCtx(ctx);
}

async function probe9_listSticky(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[0]);
  if (!frame) { rec('9.list-sticky', '✗', 'login failed'); await closeCtx(ctx); return; }
  await evalIn(frame, () => APP.navigate && APP.navigate('list-view'));
  await page.waitForTimeout(2000);
  const sticky = await evalIn(frame, () => {
    const strip = document.querySelector('#screen-list-view .filter-strip, #screen-list-view [data-filter-strip], #screen-list-view .sticky');
    if (!strip) return { found: false };
    const cs = getComputedStyle(strip);
    return { found: true, position: cs.position, top: cs.top };
  });
  rec('9.list-sticky', sticky && sticky.found && sticky.position === 'sticky' ? '✓' : '⚠', JSON.stringify(sticky));
  await page.screenshot({ path: PATH.join(OUT, 'list-sticky.png') });
  await closeCtx(ctx);
}

async function probe10_adminReadOnly(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[1]);
  if (!frame) { rec('10.admin-readonly', '✗', 'login failed'); await closeCtx(ctx); return; }
  await evalIn(frame, () => APP.navigate && APP.navigate('admin-panel'));
  await page.waitForTimeout(2500);
  const active = await evalIn(frame, () => !!document.querySelector('#screen-admin-panel.active'));
  rec('10.admin-readonly', active ? '✓' : '✗', 'admin-panel active for non-admin=' + active);
  await page.screenshot({ path: PATH.join(OUT, 'admin-readonly.png') });
  await closeCtx(ctx);
}

async function probePerfTeam(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[0]);
  if (!frame) { await closeCtx(ctx); return; }
  const t0 = Date.now();
  await evalIn(frame, () => APP.navigate('team-board'));
  await page.waitForTimeout(3500);
  perf.teamScopeColdMs = Date.now() - t0;
  rec('perf.team-scope', '✓', perf.teamScopeColdMs + 'ms');
  await closeCtx(ctx);
}

async function probe6_markDoneSync(browser) {
  const { frame, page, ctx } = await loginAs(browser, USERS[0]);
  if (!frame) { rec('6.mark-done-sync', '✗', 'login failed'); await closeCtx(ctx); return; }
  await page.waitForTimeout(2000);
  const r = await evalIn(frame, () => {
    const card = document.querySelector('#screen-kanban-home [data-task-id]');
    if (!card) return { err: 'no card' };
    const id = card.getAttribute('data-task-id');
    const btn = card.querySelector('[data-action="mark-done"], [data-action="done"]');
    if (btn) btn.click();
    return { id, hadBtn: !!btn };
  });
  await page.waitForTimeout(1500);
  const moved = await evalIn(frame, (id) => {
    const c = document.querySelector('[data-task-id="' + id + '"]');
    if (!c) return { gone: true };
    const col = c.closest('[data-column], [data-status]');
    const status = col ? (col.getAttribute('data-status') || col.getAttribute('data-column')) : null;
    const strike = getComputedStyle(c).textDecorationLine || '';
    return { status, strike };
  }, r && r.id);
  rec('6.mark-done-sync', r && r.hadBtn && (moved.gone || moved.status === 'done' || /line-through/.test(moved.strike)) ? '✓' : '⚠',
      JSON.stringify(r) + ' moved=' + JSON.stringify(moved));
  await page.screenshot({ path: PATH.join(OUT, '6.mark-done.png') });
  await closeCtx(ctx);
}

function writeStateMd() {
  const lines = [];
  lines.push('# STATE.md — TaskFlow Audit ' + new Date().toISOString());
  lines.push('');
  lines.push('Deploy URL: ' + APP_URL);
  lines.push('');
  lines.push('## Probes');
  lines.push('');
  lines.push('| # | Probe | Status | Detail |');
  lines.push('|---|---|---|---|');
  results.forEach((r, i) => {
    lines.push('| ' + (i + 1) + ' | ' + r.probe + ' | ' + r.status + ' | ' + r.detail.replace(/\|/g, '\\|') + ' |');
  });
  lines.push('');
  lines.push('## Perf timings (ms)');
  lines.push('');
  lines.push('- Home cold-load: ' + (perf.homeColdMs ?? 'n/a'));
  lines.push('- Team scope cold: ' + (perf.teamScopeColdMs ?? 'n/a'));
  lines.push('- Timeline render: ' + (perf.timelineRenderMs ?? 'n/a'));
  lines.push('');
  const fails = results.filter(r => r.status === '✗');
  lines.push('## Summary');
  lines.push('');
  lines.push('- Total probes: ' + results.length);
  lines.push('- Passed: ' + results.filter(r => r.status === '✓').length);
  lines.push('- Warned: ' + results.filter(r => r.status === '⚠').length);
  lines.push('- Failed: ' + fails.length);
  lines.push('');
  if (fails.length === 0) {
    lines.push('**Decision:** zero ✗ → skip Session 2, proceed to Session 2.5.');
  } else {
    lines.push('**Decision:** ' + fails.length + ' ✗ → enter Session 2, fix P0s.');
    lines.push('');
    lines.push('Failing probes for Session 2 dispatch:');
    fails.forEach(f => lines.push('- ' + f.probe + ' — ' + f.detail));
  }
  FS.writeFileSync(PATH.join(__dirname, 'STATE.md'), lines.join('\n'));
  FS.writeFileSync(PATH.join(__dirname, '.audit-results.json'), JSON.stringify({ results, perf }, null, 2));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await probe1_loginEachUser(browser);
    await probe2_scopeFilter(browser);
    await probeTimer(browser, '3.timer-start',  'start');
    await probeTimer(browser, '4.timer-stop',   'stop');
    await probeTimer(browser, '5.timer-switch', 'start');
    await probe6_markDoneSync(browser);
    await probe7_bottomNav(browser);
    await probe8_gantt(browser);
    await probe9_listSticky(browser);
    await probe10_adminReadOnly(browser);
    await probePerfTeam(browser);
  } catch (e) {
    rec('rig', '✗', 'rig threw: ' + e.message);
  } finally {
    writeStateMd();
    await browser.close();
  }
})();
