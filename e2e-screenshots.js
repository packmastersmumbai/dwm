/**
 * Screenshot capture script — logs in and captures each screen.
 * Run: node e2e-screenshots.js
 */
const playwrightPath = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(playwrightPath);
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';
const OUT_DIR = path.join(__dirname, 'screenshots');

const POST_LOGIN_SCREENS = [
  { slug: 'kanban-home',   nav: 'kanban-home',   wait: 4000 },
  { slug: 'daily-plan',    nav: 'daily-plan',    wait: 4000 },
  { slug: 'myday-focus',   nav: 'myday-focus',   wait: 4000 },
  { slug: 'myday-share',   nav: 'myday-share',   wait: 4000 },
  { slug: 'notifications', nav: 'notifications', wait: 3000 },
  { slug: 'team-board',    nav: 'team-board',    wait: 4000 },
  { slug: 'team-timeline', nav: 'team-timeline', wait: 3000 },
  { slug: 'reports-kpi',   nav: 'reports-kpi',   wait: 5000 },
  { slug: 'add-edit-task', nav: 'add-edit-task', wait: 4000 },
  { slug: 'quick-capture', nav: 'quick-capture', wait: 3000 },
  { slug: 'admin-panel',   nav: 'admin-panel',   wait: 5000 },
];

async function findAppFrame(page) {
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    for (const frame of page.frames()) {
      try {
        const found = await frame.$('#screen-pin-login');
        if (found) return frame;
      } catch {}
    }
  }
  return null;
}

async function navigate(frame, slug) {
  await frame.evaluate(function(s) {
    var el = document.getElementById('screen-' + s);
    if (!el) return false;
    document.querySelectorAll('.tf-screen').forEach(function(x) { x.classList.remove('active'); });
    el.classList.add('active');
    if (window.APP && APP._screens && APP._screens[s] && APP._screens[s].mount) {
      try { APP._screens[s].mount({}); } catch(e) {}
    }
    return true;
  }, slug);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  console.log('Loading app...');
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });

  const frame = await findAppFrame(page);
  if (!frame) { console.error('App frame not found'); await browser.close(); return; }
  console.log('Frame found.');

  // Screenshot pin-login
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, '00-pin-login.png') });
  console.log('✓ 00-pin-login');

  // Login: click Admin user
  const adminBtn = await frame.$('[data-action="select-user"]');
  if (adminBtn) await adminBtn.click();
  await page.waitForTimeout(400);

  // Enter PIN 1-2-3-4
  const pinBtns = await frame.$$('.pin-btn');
  const pinMap = {};
  for (const btn of pinBtns) {
    const t = (await btn.innerText()).trim();
    if (t) pinMap[t] = btn;
  }
  for (const digit of ['1','2','3','4']) {
    if (pinMap[digit]) { await pinMap[digit].click(); await page.waitForTimeout(200); }
  }

  // Wait for kanban-home
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const active = await frame.$('#screen-kanban-home.active');
    if (active) { console.log('Logged in ✓'); break; }
  }
  await page.waitForTimeout(4000); // let kanban tasks load

  // Screenshot each post-login screen
  for (let i = 0; i < POST_LOGIN_SCREENS.length; i++) {
    const s = POST_LOGIN_SCREENS[i];
    const idx = String(i + 1).padStart(2, '0');
    try {
      await frame.evaluate(function(slug) {
        if (typeof APP !== 'undefined' && APP.navigate) APP.navigate(slug);
      }, s.nav);
    } catch (e) {
      // fallback: direct DOM activation
      await navigate(frame, s.nav);
    }
    await page.waitForTimeout(s.wait);
    await page.screenshot({ path: path.join(OUT_DIR, `${idx}-${s.slug}.png`) });
    console.log(`✓ ${idx}-${s.slug}`);
  }

  console.log(`\nAll screenshots saved to: ${OUT_DIR}`);
  console.log('Browser stays open 10s...');
  await page.waitForTimeout(10000);
  await browser.close();
})();
