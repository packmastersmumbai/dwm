const PW = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(PW);
const FS = require('fs');
const PATH = require('path');

const APP_URL = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';
const OUT = PATH.join(__dirname, 'audit-screenshots', 'tbm-tasks');
if (!FS.existsSync(OUT)) FS.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60000 });
  // find frame
  let frame = null;
  for (let i = 0; i < 30 && !frame; i++) {
    for (const f of page.frames()) {
      try { if (await f.$('[data-action="select-user"]')) { frame = f; break; } } catch(_) {}
    }
    if (!frame) await page.waitForTimeout(400);
  }
  if (!frame) { console.log('NO FRAME'); await browser.close(); return; }

  // login as TBM
  await frame.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('[data-action="select-user"]'));
    const t = tiles.find(el => /TBM/i.test((el.innerText || '').trim()));
    if (t) t.click();
  });
  await page.waitForTimeout(600);
  for (const d of '0000') {
    const b = await frame.$('[data-digit="' + d + '"]');
    if (b) { await b.click(); await page.waitForTimeout(120); }
  }
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(400);
    if (await frame.$('#screen-kanban-home.active')) break;
  }
  await page.waitForTimeout(3000); // let tasks load
  await page.screenshot({ path: PATH.join(OUT, 'home.png'), fullPage: true });

  // Direct API call from inside the frame
  const apiResult = await frame.evaluate(async () => {
    return new Promise((resolve) => {
      try {
        google.script.run
          .withSuccessHandler((r) => resolve(r))
          .withFailureHandler((e) => resolve({ ok: false, err: e && e.message ? e.message : String(e) }))
          .getTasks(null, window.APP.token);
      } catch(e) { resolve({ ok: false, err: 'exception: ' + e.message }); }
    });
  });
  console.log('Public getTasks result count:', Array.isArray(apiResult) ? apiResult.length : JSON.stringify(apiResult));

  const apiResult2 = await frame.evaluate(async () => {
    return new Promise((resolve) => {
      try {
        google.script.run
          .withSuccessHandler((r) => resolve(r))
          .withFailureHandler((e) => resolve({ ok: false, err: e && e.message ? e.message : String(e) }))
          .debugGetTasksRaw(window.APP.token);
      } catch(e) { resolve({ ok: false, err: 'exception: ' + e.message }); }
    });
  });
  console.log('debugSessTasks result:', JSON.stringify(apiResult2));

  const state = await frame.evaluate(() => {
    const user = (window.APP && window.APP.currentUser) ? { id: window.APP.currentUser.id, name: window.APP.currentUser.name } : null;
    // Pull internal state
    const scope = document.querySelector('[data-scope].active') || document.querySelector('.scope-active');
    const activeFilter = document.querySelector('[data-filter].active') || document.querySelector('.filter-active');
    const cards = Array.from(document.querySelectorAll('#screen-kanban-home [data-task-id]'));
    const emptyMessages = Array.from(document.querySelectorAll('#screen-kanban-home')).map(el => el.innerText).join('\n').slice(0, 1000);
    return {
      user,
      cardCount: cards.length,
      cardTaskIds: cards.map(c => c.getAttribute('data-task-id').slice(0,8)),
      scopeEl: scope ? scope.outerHTML.slice(0,200) : null,
      filterEl: activeFilter ? activeFilter.outerHTML.slice(0,200) : null,
      bodyExcerpt: emptyMessages
    };
  });
  console.log(JSON.stringify(state, null, 2));
  await browser.close();
})();
