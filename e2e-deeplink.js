const PW = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(PW);
const PATH = require('path');

const BASE = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';
const TASK_ID = '98378da1-cdc8-4c0f-8208-7b8e104c6278';
const URL = BASE + '?task=' + TASK_ID;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR:', err.message));
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  let frame = null;
  for (let i = 0; i < 30 && !frame; i++) {
    for (const f of page.frames()) {
      try { if (await f.$('[data-action="select-user"]')) { frame = f; break; } } catch(_) {}
    }
    if (!frame) await page.waitForTimeout(400);
  }
  if (!frame) { console.log('NO FRAME'); await browser.close(); return; }

  // Login as TBM
  await frame.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[data-action="select-user"]'));
    const t = tiles.find(el => /TBM/i.test((el.innerText || '').trim()));
    if (t) t.click();
  });
  await page.waitForTimeout(500);
  for (const d of '0000') {
    const b = await frame.$('[data-digit="' + d + '"]');
    if (b) { await b.click(); await page.waitForTimeout(120); }
  }

  // Wait, see what screen ends up active
  await page.waitForTimeout(5000);

  const finalState = await frame.evaluate(() => {
    const active = document.querySelector('.tf-screen.active') || document.querySelector('[data-screen].active');
    return {
      tfInitial: window.TF_INITIAL,
      activeScreen: active ? (active.getAttribute('data-screen') || active.id) : null,
      url: location.href,
      hasToken: !!(window.APP && window.APP.token),
      user: window.APP && window.APP.currentUser ? window.APP.currentUser.name : null,
      bodyText: document.body.innerText.slice(0, 800)
    };
  });
  console.log('FINAL:', JSON.stringify(finalState, null, 2));
  await page.screenshot({ path: PATH.join(__dirname, 'audit-screenshots', 'deeplink.png'), fullPage: true });
  await browser.close();
})();
