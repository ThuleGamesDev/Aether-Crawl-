const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = process.cwd();
const port = Number(process.env.FPS_R1_PORT || 5199);
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = path.resolve(process.env.FPS_R1_OUT || 'artifacts/fps-r1-smoke');
const saveKey = 'aether_crawl_fps_r1_save_v1';
const report = { checks: [], errors: [], screenshots: [] };
let server;
let browser;

const record = (check, detail) => {
  report.checks.push({ check, detail });
  console.log(JSON.stringify({ check, detail }));
};

async function startAs(page, className) {
  await page.goto(origin);
  await page.getByRole('button', { name: 'New Run', exact: true }).click();
  await page.getByRole('button', { name: `Enter as ${className}`, exact: true }).click();
  const canvas = page.locator('[data-aether-fps-viewport]');
  await canvas.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-aether-fps-viewport]');
    return element instanceof HTMLCanvasElement && element.width >= 320 && element.height >= 200;
  });
  const graphics = await canvas.evaluate(element => ({
    width: element.width,
    height: element.height,
    webgl2: Boolean(element.getContext('webgl2')),
  }));
  assert.equal(graphics.webgl2, true, 'FPS canvas must use WebGL 2');
  return graphics;
}

async function screenshot(page, name) {
  const file = path.join(outputDirectory, name);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}

(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const { createServer } = await import(path.join(repositoryRoot, 'node_modules/vite/dist/node/index.js'));
  server = await createServer({ root: repositoryRoot, server: { host: '127.0.0.1', port, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  desktop.on('pageerror', error => report.errors.push(error.message));
  const barbarianGraphics = await startAs(desktop, 'Barbarian');
  await screenshot(desktop, 'barbarian-world.png');
  record('Barbarian WebGL 2 viewport', barbarianGraphics);

  await desktop.keyboard.press('Tab');
  await desktop.getByRole('heading', { name: 'Dungeon Map · Floor 1' }).waitFor();
  await screenshot(desktop, 'dungeon-map.png');
  await desktop.getByRole('button', { name: 'Close' }).click();
  await desktop.keyboard.press('i');
  await desktop.getByRole('heading', { name: 'Inventory & Equipment' }).waitFor();
  await screenshot(desktop, 'inventory.png');
  await desktop.getByRole('button', { name: 'Close' }).click();
  await desktop.getByRole('button', { name: 'Save', exact: true }).click();
  const saved = await desktop.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
  assert.equal(saved.version, 1);
  assert.equal(saved.player.classId, 'BARBARIAN');
  assert.equal(Object.hasOwn(saved.player, 'party'), false);
  record('Solo save schema', { version: saved.version, classId: saved.player.classId, enemies: saved.enemies.length });

  await desktop.getByRole('button', { name: /^Menu/ }).click();
  await desktop.getByRole('heading', { name: 'Paused' }).waitFor();
  await desktop.getByRole('button', { name: 'Save & Main Menu' }).click();
  await desktop.getByRole('button', { name: 'Continue Run', exact: true }).click();
  await desktop.locator('[data-aether-fps-viewport]').waitFor({ state: 'visible' });
  await desktop.waitForFunction(() => document.querySelector('.fps-floor-label')?.textContent.includes('FLOOR 1'));
  record('Save and Continue', 'Barbarian returned to Floor 1');

  await desktop.getByRole('button', { name: /^Menu/ }).click();
  await desktop.getByRole('button', { name: 'Save & Main Menu' }).click();
  const sorcererGraphics = await startAs(desktop, 'Sorcerer');
  await desktop.getByText('Arcane Bolt', { exact: true }).waitFor();
  await desktop.getByText('Fireburst', { exact: true }).waitFor();
  const desktopCanvas = desktop.locator('[data-aether-fps-viewport]');
  await desktopCanvas.click({ position: { x: 600, y: 360 } });
  await desktop.mouse.click(640, 400);
  await desktop.locator('.fps-combat-log').getByText('Arcane Bolt.', { exact: true }).waitFor({ timeout: 3000 });
  await desktop.locator('.fps-skill-card').click();
  await desktop.locator('.fps-combat-log').getByText('Fireburst.', { exact: true }).waitFor({ timeout: 3000 });
  await screenshot(desktop, 'sorcerer-world.png');
  record('Sorcerer combat pilot', { ...sorcererGraphics, actions: ['Arcane Bolt', 'Charged Bolt', 'Fireburst'] });

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await touchContext.newPage();
  mobile.on('pageerror', error => report.errors.push(error.message));
  const mobileGraphics = await startAs(mobile, 'Barbarian');
  for (const label of ['Primary Attack', 'Secondary Attack', 'Class Skill', 'Dodge', 'Interact']) {
    await mobile.getByRole('button', { name: label }).waitFor({ state: 'visible' });
  }
  await mobile.keyboard.press('Tab');
  await mobile.getByRole('heading', { name: 'Dungeon Map · Floor 1' }).waitFor();
  const initialCell = await mobile.locator('.fps-map-grid').evaluate(grid => Array.from(grid.children).findIndex(cell => cell.classList.contains('player')));
  await mobile.getByRole('button', { name: 'Close' }).click();
  const canvasBounds = await mobile.locator('[data-aether-fps-viewport]').boundingBox();
  assert(canvasBounds, 'touch viewport bounds missing');
  const touchSession = await touchContext.newCDPSession(mobile);
  const touchX = canvasBounds.x + canvasBounds.width * 0.2;
  const touchY = canvasBounds.y + canvasBounds.height * 0.72;
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY, id: 1 }] });
  for (let step = 1; step <= 5; step += 1) {
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - step * 28, id: 1 }] });
    await mobile.waitForTimeout(110);
  }
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.keyboard.press('Tab');
  await mobile.getByRole('heading', { name: 'Dungeon Map · Floor 1' }).waitFor();
  const movedCell = await mobile.locator('.fps-map-grid').evaluate(grid => Array.from(grid.children).findIndex(cell => cell.classList.contains('player')));
  assert.notEqual(movedCell, initialCell, 'left touch drag must move the hero to another grid cell');
  await mobile.getByRole('button', { name: 'Close' }).click();
  await mobile.getByRole('button', { name: 'Primary Attack' }).tap();
  await mobile.locator('.fps-combat-log').getByText('Cleave.', { exact: true }).waitFor({ timeout: 3000 });
  await screenshot(mobile, 'mobile-touch.png');
  record('Mobile controls', mobileGraphics);
  assert.deepEqual(report.errors, [], 'Browser page exceptions');

  fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ complete: true, checks: report.checks.length, screenshots: report.screenshots.length }));
})().catch(error => {
  report.errors.push(error instanceof Error ? error.message : String(error));
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close().catch(() => undefined);
  await server?.close().catch(() => undefined);
});
