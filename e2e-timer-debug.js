const playwrightPath = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(playwrightPath);

const APP_URL = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';

async function findFrame(page) {
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    for (const f of page.frames()) {
      try { if (await f.$('#screen-pin-login')) return f; } catch(e) {}
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  page.on('pageerror', err => console.log('[PAGEERROR]', err.message));

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await findFrame(page);

  await page.waitForTimeout(2000);
  await (await frame.$('[data-action="select-user"]')).click();
  await page.waitForTimeout(400);
  for (const d of ['1','2','3','4']) {
    const b = await frame.$('[data-digit="' + d + '"]');
    if (b) { await b.click(); await page.waitForTimeout(150); }
  }
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    if (await frame.$('#screen-kanban-home.active')) break;
  }
  await page.waitForTimeout(10000);
  console.log('✓ Logged in');

  // Stop any existing timers via the new getActiveTimers
  const cleanup = await frame.evaluate(() => {
    return new Promise(r => {
      APP.call('getActiveTimers', APP.currentUser.id).then(timers => {
        if (!timers || !timers.length) return r({ stopped: 0 });
        Promise.all(timers.map(t => APP.call('stopTimer', t.logId, APP.currentUser.id)))
          .then(() => r({ stopped: timers.length }))
          .catch(e => r({ partial: e && e.message }));
      });
    });
  });
  console.log('Cleanup:', JSON.stringify(cleanup));
  await page.waitForTimeout(3000);

  // Reload tasks to refresh card states
  await frame.evaluate(() => {
    // Trigger the kanban-home loadTasks
    document.querySelector('[data-screen="kanban-home"]').dispatchEvent(new Event('reloadtasks'));
  });
  await page.waitForTimeout(4000);

  // Banner element should NOT exist anymore
  const noBanner = await frame.evaluate(() => !document.querySelector('[data-area="active-timer-banner"]'));
  console.log('Banner removed?', noBanner);

  // Click 3 play buttons — re-query each time since optimistic re-render detaches old handles
  const taskIds = [];
  for (let i = 0; i < 3; i++) {
    const btns = await frame.$$('[data-action="start-timer"]');
    if (btns.length === 0) { console.log('No more play buttons at step', i); break; }
    // Pick a button whose task isn't already in our started list
    let picked = null;
    for (const b of btns) {
      const tid = await b.getAttribute('data-task-id');
      if (!taskIds.includes(tid)) { picked = b; taskIds.push(tid); break; }
    }
    if (!picked) break;
    console.log('Clicking play #' + (i+1) + ' for', taskIds[taskIds.length - 1]);
    await picked.click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Wait for all server roundtrips
  await page.waitForTimeout(15000);

  // Check final state: should have 3 active timers, 3 stop buttons, 3 inline ● REC pills
  const finalState = await frame.evaluate(() => {
    const liveTimers = document.querySelectorAll('[data-live-timer]');
    return {
      stopBtns: document.querySelectorAll('[data-action="stop-timer"]').length,
      startBtns: document.querySelectorAll('[data-action="start-timer"]').length,
      liveTimerCount: liveTimers.length,
      sampleElapsedTexts: Array.from(liveTimers).slice(0, 5).map(el => el.textContent),
      bannerStillExists: !!document.querySelector('[data-area="active-timer-banner"]')
    };
  });
  console.log('Final state:', JSON.stringify(finalState, null, 2));

  // Server-side check
  const serverActive = await frame.evaluate(() => {
    return new Promise(r => APP.call('getActiveTimers', APP.currentUser.id).then(r));
  });
  console.log('Server active timers:', (serverActive || []).length, JSON.stringify(serverActive));

  await page.screenshot({ path: 'screenshots/multi-timer-test.png', fullPage: false });
  console.log('Screenshot: screenshots/multi-timer-test.png');
  await page.waitForTimeout(5000);
  await browser.close();
})();
