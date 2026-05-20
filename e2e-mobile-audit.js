const playwrightPath = 'C:/Users/Appex/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright';
const { chromium } = require(playwrightPath);

const APP_URL = 'https://script.google.com/macros/s/AKfycbxG3yKj-XzyU2ydckTNCe0Poc-en3sjDkHJzr-SQFLsEQXF3l4X8Zg49MF_7ZTU_bRHkw/exec';
const PATH = require('path');
const FS = require('fs');
const OUT = PATH.join(__dirname, 'screenshots', 'mobile');
if (!FS.existsSync(OUT)) FS.mkdirSync(OUT, { recursive: true });

async function findFrame(page) {
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);
    for (const f of page.frames()) {
      try {
        if (await f.$('#screen-pin-login')) return f;
        if (await f.$('[data-screen="pin-login"]')) return f;
        if (await f.$('.pin-btn')) return f;
      } catch(e) {}
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await findFrame(page);
  if (!frame) { console.error('Frame not found'); await browser.close(); return; }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: PATH.join(OUT, '00-pin-login.png') });
  console.log('✓ 00-pin-login');

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
  await page.waitForTimeout(8000);
  await page.screenshot({ path: PATH.join(OUT, '01-kanban-home.png') });
  console.log('✓ 01-kanban-home');

  const navs = [
    { screen: 'daily-plan',     file: '02-daily-plan.png',     via: () => frame.evaluate(() => APP.navigate('daily-plan')) },
    { screen: 'myday-focus',    file: '03-myday-focus.png',    via: () => frame.evaluate(() => APP.navigate('myday-focus')) },
    { screen: 'myday-share',    file: '04-myday-share.png',    via: () => frame.evaluate(() => APP.navigate('myday-share')) },
    { screen: 'notifications',  file: '05-notifications.png',  via: () => frame.evaluate(() => APP.navigate('notifications')) },
    { screen: 'team-board',     file: '06-team-board.png',     via: () => frame.evaluate(() => APP.navigate('team-board')) },
    { screen: 'team-timeline',  file: '07-team-timeline.png',  via: () => frame.evaluate(() => APP.navigate('team-timeline')) },
    { screen: 'reports-kpi',    file: '08-reports-kpi.png',    via: () => frame.evaluate(() => APP.navigate('reports-kpi')) },
    { screen: 'add-edit-task',  file: '09-add-edit-task.png',  via: () => frame.evaluate(() => APP.navigate('add-edit-task')) },
    { screen: 'quick-capture',  file: '10-quick-capture.png',  via: () => frame.evaluate(() => APP.navigate('quick-capture')) },
    { screen: 'admin-panel',    file: '11-admin-panel.png',    via: () => frame.evaluate(() => APP.navigate('admin-panel')) }
  ];
  for (const n of navs) {
    try {
      await n.via();
      await page.waitForTimeout(3500);
      await page.screenshot({ path: PATH.join(OUT, n.file) });
      console.log('✓ ' + n.file);
    } catch(e) {
      console.log('✗ ' + n.file + ': ' + e.message);
    }
  }

  await browser.close();
})();
