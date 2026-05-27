// e2e-calendar.js — Calendar sync + admin tab E2E.
// Run: node e2e-calendar.js
const PW = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(PW);
const FS = require('fs');
const PATH = require('path');
const { execSync } = require('child_process');

const APP_URL = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';
const OUT = PATH.join(__dirname, 'audit-screenshots', 'calendar');
if (!FS.existsSync(OUT)) FS.mkdirSync(OUT, { recursive: true });

const TBM = { name: 'TBM', pin: '0000', role: 'admin' };
const results = [];
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
        if (await f.$('[data-action="select-user"]')) return f;
      } catch (e) {}
    }
    await page.waitForTimeout(300);
  }
  return null;
}

async function loginAs(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let gotoErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 }); gotoErr = null; break; }
    catch (e) { gotoErr = e; await page.waitForTimeout(1500 * attempt); }
  }
  if (gotoErr) return { ctx, page, frame: null };
  const frame = await findFrame(page);
  if (!frame) return { ctx, page, frame: null };
  await page.waitForTimeout(1500);
  const picked = await frame.evaluate((name) => {
    const tiles = Array.from(document.querySelectorAll('[data-action="select-user"]'));
    const want = name.split(' ')[0].toLowerCase();
    const t = tiles.find(el => (el.innerText || '').trim().toLowerCase().includes(want));
    if (!t) return { ok: false, names: tiles.map(x => (x.innerText || '').trim()) };
    t.click(); return { ok: true };
  }, user.name);
  if (!picked || !picked.ok) return { ctx, page, frame, loginErr: picked };
  await page.waitForTimeout(500);
  for (const d of user.pin.split('')) {
    const b = await frame.$('[data-digit="' + d + '"]');
    if (b) { await b.click(); await page.waitForTimeout(120); }
  }
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(400);
    if (await frame.$('#screen-kanban-home.active')) return { ctx, page, frame, home: true };
  }
  return { ctx, page, frame, home: false };
}

async function probeAdminCalendarTab(browser) {
  const { ctx, page, frame, home } = await loginAs(browser, TBM);
  if (!frame) { rec('1.login-TBM', '✗', 'frame missing'); if (ctx) await ctx.close(); return; }
  if (!home) { rec('1.login-TBM', '✗', 'home never activated'); await ctx.close(); return; }
  rec('1.login-TBM', '✓', 'home reached');
  await page.screenshot({ path: PATH.join(OUT, '01-home.png') });

  // Open admin panel via menu/profile route. Try common selectors.
  const opened = await frame.evaluate(() => {
    const candidates = ['[data-screen-link="admin-panel"]', '[data-action="open-admin"]', '[data-nav="admin"]', 'a[href*="admin"]'];
    for (const sel of candidates) { const el = document.querySelector(sel); if (el) { el.click(); return sel; } }
    return null;
  });
  if (!opened) {
    rec('2.admin-open', '⚠', 'no direct selector; trying profile menu');
    const profile = await frame.$('[data-action="open-profile"], [data-screen-link="profile"]');
    if (profile) await profile.click();
    await page.waitForTimeout(800);
    const adminLink = await frame.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a,button,[role="button"]'))
        .find(el => /admin/i.test(el.innerText || ''));
      if (a) { a.click(); return true; }
      return false;
    });
    if (!adminLink) { rec('2.admin-open', '✗', 'cannot navigate to admin panel'); await ctx.close(); return; }
  }
  await page.waitForTimeout(1500);
  const adminActive = await frame.$('#screen-admin-panel.active');
  rec('2.admin-open', adminActive ? '✓' : '✗', 'screen-admin-panel.active=' + !!adminActive);
  await page.screenshot({ path: PATH.join(OUT, '02-admin.png') });

  // Click the Calendar tab. The tab button should be a [data-tab="calendar"].
  const calTabClicked = await frame.evaluate(() => {
    const sels = ['[data-tab="calendar"]', '[data-admin-tab="calendar"]', 'button[data-target="calendar"]'];
    for (const s of sels) { const el = document.querySelector(s); if (el) { el.click(); return s; } }
    const byText = Array.from(document.querySelectorAll('button,[role="tab"]'))
      .find(el => /calendar/i.test(el.innerText || ''));
    if (byText) { byText.click(); return 'by-text'; }
    return null;
  });
  if (!calTabClicked) { rec('3.cal-tab-click', '✗', 'tab not found'); await ctx.close(); return; }
  rec('3.cal-tab-click', '✓', 'selector=' + calTabClicked);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: PATH.join(OUT, '03-calendar-tab.png') });

  // Inspect what loaded in the Calendar tab.
  const calState = await frame.evaluate(() => {
    const panel = document.querySelector('[data-tab-panel="calendar"], [data-admin-tab-panel="calendar"], #admin-tab-calendar')
                || document.querySelector('#screen-admin-panel');
    if (!panel) return { found: false };
    const text = (panel.innerText || '').trim();
    const hasShareLink = /calendar\.google\.com/i.test(text);
    const hasProvisionBtn = /provision/i.test(text);
    const hasSyncAllBtn = /sync all/i.test(text);
    return { found: true, hasShareLink, hasProvisionBtn, hasSyncAllBtn, sample: text.slice(0, 400) };
  });
  rec('4.cal-tab-state', calState.found ? '✓' : '✗',
      'shareLink=' + calState.hasShareLink + ' provisionBtn=' + calState.hasProvisionBtn + ' syncAllBtn=' + calState.hasSyncAllBtn);

  // Backend verification via clasp run: check that the 3 [TEST] tasks have calendar_event_id populated.
  let verify = null;
  try {
    const raw = execSync('clasp run verifyCalendarEventIds', { encoding: 'utf8', timeout: 30000 });
    const m = raw.match(/"(\{.*\})"/s) || raw.match(/'(\{.*\})'/s);
    const jsonStr = m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : raw;
    verify = JSON.parse(jsonStr);
  } catch (e) { verify = { error: e.message.slice(0, 200) }; }
  if (verify && verify.testTasks !== undefined) {
    const pass = verify.testTasks > 0 && verify.withEventId === verify.testTasks;
    rec('5.event-ids-backfilled', pass ? '✓' : '✗',
        'testTasks=' + verify.testTasks + ' withEventId=' + verify.withEventId);
  } else {
    rec('5.event-ids-backfilled', '⚠', 'verify helper missing or errored: ' + (verify.error || 'unknown'));
  }

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try { await probeAdminCalendarTab(browser); }
  finally { await browser.close(); }
  const pass = results.filter(r => r.status === '✓').length;
  const warn = results.filter(r => r.status === '⚠').length;
  const fail = results.filter(r => r.status === '✗').length;
  console.log('\n=== Calendar E2E Summary ===');
  console.log('Pass: ' + pass + '  Warn: ' + warn + '  Fail: ' + fail);
  FS.writeFileSync(PATH.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(fail > 0 ? 1 : 0);
})();
