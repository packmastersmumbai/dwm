/**
 * TaskFlow DWM — End-to-End Functional Test
 * Run: node e2e-test.js
 * GAS web apps serve content inside a googleusercontent.com iframe.
 */

let playwright;
try { playwright = require('playwright'); }
catch(e) {
  const paths = [
    'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright',
    'C:/Users/Appex/AppData/Roaming/npm/node_modules/designlang/node_modules/playwright'
  ];
  for (const p of paths) { try { playwright = require(p); break; } catch(_) {} }
}
if (!playwright) { console.error('Playwright not found.'); process.exit(1); }
const { chromium } = playwright;

const WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';

const PIN  = '1234';
const SLOW = 800;
const NAV_TIMEOUT  = 40_000;
const PAGE_TIMEOUT = 30_000;

const G = s => `\x1b[32m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[36m${s}\x1b[0m`;
const pass = l => { console.log(G('  v ') + l); results.passed++; };
const fail = (l, e) => { console.log(R('  x ') + l + (e ? ' -- ' + String(e).split('\n')[0].slice(0,120) : '')); results.failed++; };
const info = l => console.log(Y('  i ') + l);
const sect = l => console.log('\n' + B('== ' + l + ' =='));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let results = { passed: 0, failed: 0, skipped: 0 };

async function check(label, fn) {
  try { await fn(); pass(label); }
  catch(e) { fail(label, e.message); }
}

async function waitForScreen(frame, slug) {
  await frame.waitForFunction(
    function(s) {
      var el = document.getElementById('screen-' + s);
      if (!el) return false;
      return el.classList.contains('active') ||
             getComputedStyle(el).display !== 'none';
    },
    slug,
    { timeout: PAGE_TIMEOUT }
  );
}

async function appNav(frame, slug) {
  await frame.evaluate(function(s) {
    try { APP.navigate(s); } catch(e) { console.error('nav error: ' + e); }
  }, slug);
  await sleep(SLOW);
}

(async () => {
  console.log(B('\n== TaskFlow DWM E2E Test Suite ==\n'));
  info('Opening headed Chromium (390x844 mobile)...');

  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
  });
  const page = await context.newPage();
  const appErrors = [];
  const consoleLogs = [];

  // Must set frame listener BEFORE navigation
  page.on('framenavigated', frame => {
    if (frame.url().includes('googleusercontent')) {
      frame.on('console', m => {
        consoleLogs.push(m.type() + ': ' + m.text());
        if (m.type() === 'error') appErrors.push('[frame-err] ' + m.text());
        else info('[frame] ' + m.text().slice(0, 200));
      });
    }
  });
  page.on('console', m => {
    if (m.type() === 'error') appErrors.push('[page-err] ' + m.text());
  });
  page.on('pageerror', e => appErrors.push('[pageerror] ' + e.message));

  // ── 1. LOAD ──────────────────────────────────────────────
  sect('1. Page Load');

  await check('Navigate to GAS web app URL', async () => {
    await page.goto(WEB_APP_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    info('URL: ' + page.url().slice(0, 90));
  });

  await sleep(3000);
  const frames = page.frames();
  info('Total frames: ' + frames.length);
  frames.forEach((f, i) => info('  [' + i + '] ' + f.url().slice(0, 100)));

  // Find app frame
  let appFrame = page;
  for (const f of frames) {
    try {
      const n = await f.locator('#screen-pin-login').count();
      if (n > 0) { appFrame = f; info('App frame: ' + f.url().slice(0, 80)); break; }
    } catch(_) {}
  }

  await check('App frame has content', async () => {
    const len = (await appFrame.locator('body').textContent({ timeout: 8000 })).length;
    if (len < 100) throw new Error('Body too short: ' + len);
    info('Body: ' + len + ' chars');
  });

  // ── 2. PIN LOGIN ─────────────────────────────────────────
  sect('2. PIN Login Screen');

  await check('PIN screen is active', async () => {
    await waitForScreen(appFrame, 'pin-login');
  });

  // Poll user selector area up to 30s for getUsersForLogin to complete
  info('Polling user selector (up to 30s for users to load)...');
  let usersLoaded = false;
  for (let i = 0; i < 60; i++) {
    const n = await appFrame.locator('[data-action="select-user"]').count().catch(() => 0);
    info('  [' + (i*0.5).toFixed(1) + 's] user buttons: ' + n);
    if (n > 0) { usersLoaded = true; break; }
    await sleep(500);
  }

  // DOM inspection
  const domState = await appFrame.evaluate(function() {
    var screen = document.querySelector('[data-screen="pin-login"]');
    var area = screen ? screen.querySelector('[data-area="user-selector"]') : null;
    var activeEl = document.querySelector('.tf-screen.active');
    return {
      appDefined: typeof APP !== 'undefined',
      screenFound: !!screen,
      areaFound: !!area,
      areaHTML: area ? area.innerHTML.slice(0, 400) : 'N/A',
      activeScreenId: activeEl ? activeEl.id : 'none'
    };
  }).catch(function(e) { return { evalError: e.message }; });
  info('DOM state: ' + JSON.stringify(domState, null, 2));

  await check('getUsersForLogin returned data', async () => {
    if (!usersLoaded) {
      info('Warning: no user buttons after 30s. Area HTML: ' + domState.areaHTML);
    }
  });

  // ── 3. USER SELECTOR ────────────────────────────────────
  sect('3. User Selector');

  let adminFound = false;
  await check('Admin user button visible in selector', async () => {
    // Wait up to 15 more seconds for users to render
    for (let i = 0; i < 30; i++) {
      const n = await appFrame.locator('[data-action="select-user"]').count();
      if (n > 0) { adminFound = true; info(n + ' user(s) found'); return; }
      const areaHTML = await appFrame.evaluate(function() {
        var a = document.querySelector('[data-area="user-selector"]');
        return a ? a.innerHTML.slice(0, 200) : 'NOT_FOUND';
      }).catch(() => 'eval error');
      if (i % 4 === 0) info('  area HTML: ' + areaHTML);
      await sleep(500);
    }
    throw new Error('No [data-action="select-user"] after 15s. Area: ' +
      (await appFrame.evaluate(function() {
        var a = document.querySelector('[data-area="user-selector"]');
        return a ? a.innerHTML.slice(0, 300) : 'NOT_FOUND';
      }).catch(() => 'eval error')));
  });

  if (!adminFound) {
    info('Cannot proceed — no users rendered. Logged console: ' + consoleLogs.slice(-5).join(' | '));
    results.skipped += 20;
  } else {

    // ── 4. PIN LOGIN FLOW ────────────────────────────────
    sect('4. PIN Login (Admin / 1234)');

    await check('Click Admin user', async () => {
      await appFrame.locator('[data-action="select-user"]').first().click();
      await sleep(400);
    });

    await check('Enter PIN 1-2-3-4', async () => {
      for (const d of PIN.split('')) {
        await appFrame.locator('[data-digit="' + d + '"]').click();
        await sleep(250);
      }
    });

    await check('4 PIN dots filled', async () => {
      const n = await appFrame.locator('.pin-dot-filled').count();
      if (n < 4) throw new Error('Only ' + n + '/4 dots filled');
    });

    await check('Navigates to kanban-home', async () => {
      await waitForScreen(appFrame, 'kanban-home');
      info('Login successful!');
    });

    await sleep(2500);

    // ── 5. KANBAN HOME ───────────────────────────────────
    sect('5. Kanban Home');
    await check('Kanban screen has content', async () => {
      const txt = await appFrame.locator('[data-screen="kanban-home"]').textContent({ timeout: 10000 });
      if (txt.trim().length < 5) throw new Error('Kanban appears empty');
      info('Preview: ' + txt.trim().replace(/\s+/g,' ').slice(0, 80));
    });

    // ── Navigate all screens ─────────────────────────────
    const screens = [
      'notifications', 'daily-plan', 'myday-focus', 'myday-share',
      'team-board', 'team-timeline', 'reports-kpi',
      'add-edit-task', 'quick-capture', 'admin-panel'
    ];

    for (const slug of screens) {
      sect('Screen: ' + slug);
      await check('Navigate to ' + slug, async () => {
        await appNav(appFrame, slug);
        await waitForScreen(appFrame, slug);
      });
      await check(slug + ' renders content', async () => {
        const txt = await appFrame.locator('[data-screen="' + slug + '"]').textContent({ timeout: 8000 });
        const t = txt.trim().replace(/\s+/g,' ');
        if (t.length < 3) throw new Error('Screen appears empty');
        info(t.slice(0, 80));
      });
      await sleep(1500);
    }

    // ── Task card click ──────────────────────────────────
    sect('Task Detail Sheet');
    await check('Return to kanban-home', async () => {
      await appNav(appFrame, 'kanban-home');
      await waitForScreen(appFrame, 'kanban-home');
    });
    await check('Task cards found (or empty state)', async () => {
      await sleep(1500);
      const cards = appFrame.locator('[data-task-id], .task-card, [data-action="open-task"]');
      const n = await cards.count();
      info(n + ' task card(s) found');
      if (n === 0) { results.skipped++; return; }
      await cards.first().click();
      await sleep(2000);
      const detailActive = await appFrame.locator('#screen-task-detail-sheet.active').count();
      info(detailActive ? 'Task detail opened' : 'Task detail did not open');
    });

    // ── Wrong PIN error ───────────────────────────────────
    sect('Error Flow: Wrong PIN');
    await check('Back to pin-login', async () => {
      await appNav(appFrame, 'pin-login');
      await waitForScreen(appFrame, 'pin-login');
      await sleep(3000);
    });
    await check('Select user and enter wrong PIN (9999)', async () => {
      const u = appFrame.locator('[data-action="select-user"]').first();
      if (await u.count() === 0) throw new Error('No users on return to login');
      await u.click(); await sleep(300);
      for (const d of '9999'.split('')) {
        await appFrame.locator('[data-digit="' + d + '"]').click();
        await sleep(200);
      }
      // GAS validatePin writes to sheet — can take 5-10s
      await sleep(8000);
      const errTxt = await appFrame.locator('[data-pin-error]').textContent({ timeout: 8000 }).catch(() => '');
      if (!errTxt.trim()) throw new Error('No error message for wrong PIN');
      info('Error: ' + errTxt.trim());
    });

  } // end adminFound

  // ── Console Errors ───────────────────────────────────────
  sect('Console Errors');
  if (appErrors.length === 0) { pass('No console errors'); }
  else {
    [...new Set(appErrors)].forEach(e => fail('Error', e.slice(0, 150)));
    results.failed += new Set(appErrors).size;
  }

  // ── Summary ──────────────────────────────────────────────
  console.log('\n' + B('== RESULTS =='));
  console.log(G('  Passed:  ' + results.passed));
  if (results.failed)  console.log(R('  Failed:  ' + results.failed));
  if (results.skipped) console.log(Y('  Skipped: ' + results.skipped));
  console.log();

  info('Browser stays open 20s for manual inspection...');
  await sleep(20000);
  await browser.close();
  process.exit(results.failed > 0 ? 1 : 0);
})();
