const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const repositoryRoot = process.cwd();
const port = Number(process.env.R6F1_PORT || 5206);
const origin = `http://127.0.0.1:${port}`;
const outputDirectory = path.resolve(process.env.R6F1_OUT || 'artifacts/r6f1-browser-smoke');
const resolutions = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }];
const loadouts = ['xiphos-aspis', 'dory-two-hand-grip', 'kopis', 'labrys', 'bow-draw', 'staff-focus'];
const enemies = [
  'cretan_cave_rat', 'arachne_brood', 'bronze_revenant', 'bull_cult_enforcer',
  'guardian_bronze_gatekeeper', 'chthonic_acolyte',
];
const report = { status: 'running', seed: '0x6f1f1', checks: [], screenshots: [], browser: null, errors: [] };
let server;
let browser;

const record = (check, detail) => {
  report.checks.push({ check, detail });
  console.log(JSON.stringify({ check, detail }));
};

function expectedScreenshotPaths() {
  const paths = [];
  for (const { width, height } of resolutions) {
    const prefix = `${width}x${height}`;
    for (const loadout of loadouts) paths.push(path.join(outputDirectory, `${prefix}-loadout-${loadout}.png`));
    for (const enemy of enemies) paths.push(path.join(outputDirectory, `${prefix}-enemy-${enemy}.png`));
  }
  for (const name of ['lifecycle-idle', 'lifecycle-attack-windup', 'lifecycle-attack-active', 'lifecycle-attack-recovery', 'lifecycle-equipment-change']) {
    paths.push(path.join(outputDirectory, `1280x720-${name}.png`));
  }
  return paths;
}

function writeReport() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(report, null, 2));
}

function chromiumPath() {
  return process.env.CHROMIUM_PATH || chromium.executablePath();
}

function skipForMissingBrowser() {
  const executable = chromiumPath();
  if (fs.existsSync(executable)) return false;
  report.status = 'skipped';
  report.browser = { status: 'unavailable', executable };
  report.skipReason = 'Playwright Chromium is not installed in this environment; WebGL visibility is unverified.';
  report.expectedScreenshotPaths = expectedScreenshotPaths();
  writeReport();
  console.log(`SKIP: ${report.skipReason}`);
  console.log(`Expected screenshot files (${report.expectedScreenshotPaths.length}):`);
  for (const screenshot of report.expectedScreenshotPaths) console.log(screenshot);
  return true;
}

async function startFixture(page, viewport, expectedAtlasState = 'ready') {
  await page.setViewportSize(viewport);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${origin}/tests/browser/r6f1.html`);
  await page.waitForFunction(() => document.querySelector('#fixture-status')?.textContent === 'ready');
  const graphics = await page.evaluate(() => ({
    width: document.querySelector('canvas')?.width,
    height: document.querySelector('canvas')?.height,
    webgl2: Boolean(document.querySelector('canvas')?.getContext('webgl2')),
    seed: window.__r6f1?.seed,
  }));
  assert.equal(graphics.webgl2, true, 'R6F1 fixture must use an actual WebGL 2 canvas.');
  assert.equal(graphics.seed, 0x6f1f1);
  await page.waitForFunction(expectedState => {
    const diagnostics = window.__r6f1?.diagnostics();
    if (!diagnostics || diagnostics.atlas.characterRigAtlas.state !== expectedState) return false;
    return Object.values(diagnostics.atlas.localTextures).every(state => state === 'ready');
  }, expectedAtlasState, { timeout: 20000 });
  assert.deepEqual(pageErrors, [], 'Browser page exceptions');
  return { pageErrors, graphics };
}

async function fixtureCall(page, method, ...args) {
  return page.evaluate(([name, values]) => {
    const fixture = window.__r6f1;
    if (!fixture) throw new Error('R6F1 fixture API was not initialized.');
    return fixture[name](...values);
  }, [method, args]);
}

async function capture(page, filename) {
  const fullPath = path.join(outputDirectory, filename);
  await page.screenshot({ path: fullPath, fullPage: false, animations: 'disabled' });
  const viewport = page.viewportSize();
  const png = fs.readFileSync(fullPath);
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.equal(png.readUInt32BE(16), viewport.width, `${filename}: captured PNG width`);
  assert.equal(png.readUInt32BE(20), viewport.height, `${filename}: captured PNG height`);
  report.screenshots.push(fullPath);
}

async function assertViewmodelsAndEnemy(page, label) {
  const diagnostics = await fixtureCall(page, 'diagnostics');
  assert.equal(diagnostics.cameraAttachedToScene, true, `${label}: camera must be part of rendered scene graph`);
  assert.equal(diagnostics.worldEnemyCount, 1, `${label}: fixture must contain one world enemy`);
  assert.equal(diagnostics.enemyVisualCount, 1, `${label}: enemy must have a render visual`);
  assert.equal(diagnostics.enemyVisualsInCamera, 1, `${label}: enemy visual must be in camera frustum`);
  assert.equal(diagnostics.viewmodels.mainHandAttachedToCamera, true, `${label}: main hand camera child`);
  assert.equal(diagnostics.viewmodels.offHandAttachedToCamera, true, `${label}: off hand camera child`);
  assert.equal(diagnostics.viewmodels.mainHandVisible, true, `${label}: main hand visible`);
  assert.equal(diagnostics.viewmodels.offHandVisible, true, `${label}: off hand visible`);
  assert.ok(diagnostics.render.calls > 0, `${label}: WebGL render must issue draw calls`);
  return diagnostics;
}

async function verifyPixelEvidence(page, resolution) {
  await fixtureCall(page, 'setWallOcclusion', false);
  await fixtureCall(page, 'setEnemy', null);
  const baseline = await fixtureCall(page, 'captureBaseline');
  assert.equal(baseline.width, resolution.width === 1280 ? 870 : 1306, 'Balanced canvas width at requested viewport');
  assert.equal(baseline.height, Math.round(resolution.height * 0.68), 'Balanced canvas height at requested viewport');
  await fixtureCall(page, 'setEnemy', 'cretan_cave_rat', 4.5, 'IDLE');
  const near = await fixtureCall(page, 'compareToBaseline');
  assert.ok(near.changedPixels > 0, 'A visible rat must change actual WebGL framebuffer pixels.');
  await fixtureCall(page, 'setEnemyDistance', 9);
  const far = await fixtureCall(page, 'compareToBaseline');
  assert.ok(far.changedPixels > 0, 'The rat must remain visible at the farther test distance.');
  assert.ok(near.changedPixels > far.changedPixels, `Enemy projection should shrink with distance (near ${near.changedPixels}, far ${far.changedPixels}).`);

  await fixtureCall(page, 'setWallOcclusion', true);
  await fixtureCall(page, 'setEnemy', null);
  await fixtureCall(page, 'captureBaseline');
  await fixtureCall(page, 'setEnemy', 'cretan_cave_rat', 5.5, 'IDLE');
  const occluded = await fixtureCall(page, 'compareToBaseline');
  assert.equal(occluded.changedPixels, 0, `A wall must fully occlude the enemy (changed ${occluded.changedPixels} pixels).`);
  await fixtureCall(page, 'setWallOcclusion', false);
  await fixtureCall(page, 'setEnemy', 'cretan_cave_rat', 5.5, 'IDLE');
  record(`WebGL pixel evidence ${resolution.width}x${resolution.height}`, {
    nearEnemyPixels: near.changedPixels,
    farEnemyPixels: far.changedPixels,
    wallOcclusionPixels: occluded.changedPixels,
    enemyPixelBounds: near.bounds,
  });
}

async function captureResolution(page, resolution) {
  const { width, height } = resolution;
  const prefix = `${width}x${height}`;
  await page.setViewportSize(resolution);
  await fixtureCall(page, 'setQuality', 'balanced');
  await page.waitForFunction(({ expectedWidth, expectedHeight }) => {
    const canvas = document.querySelector('canvas');
    return canvas?.width === expectedWidth && canvas?.height === expectedHeight;
  }, {
    expectedWidth: Math.round(width * 0.68),
    expectedHeight: Math.round(height * 0.68),
  });
  await verifyPixelEvidence(page, resolution);
  await fixtureCall(page, 'setEnemy', 'cretan_cave_rat');
  for (const loadout of loadouts) {
    await fixtureCall(page, 'setLoadout', loadout);
    await page.waitForFunction(() => {
      const diagnostics = window.__r6f1?.diagnostics();
      return Boolean(diagnostics)
        && Object.values(diagnostics.atlas.localTextures).every(state => state === 'ready');
    }, undefined, { timeout: 20000 });
    const diagnostics = await assertViewmodelsAndEnemy(page, `${prefix} ${loadout}`);
    assert.equal(diagnostics.drawingBuffer.width, Math.round(width * 0.68), `${prefix} balanced drawing buffer width`);
    assert.equal(diagnostics.drawingBuffer.height, Math.round(height * 0.68), `${prefix} balanced drawing buffer height`);
    assert.equal(diagnostics.viewmodels.mainHandVisible, true);
    assert.equal(diagnostics.viewmodels.offHandVisible, true);
    if (loadout === 'xiphos-aspis') assert.equal(diagnostics.viewmodels.offHandVisualId, 'shield');
    if (loadout === 'dory-two-hand-grip') assert.equal(diagnostics.viewmodels.offHandVisualId, 'twoHandGrip');
    if (loadout === 'bow-draw') assert.equal(diagnostics.viewmodels.offHandVisualId, 'bowDraw');
    if (loadout === 'staff-focus') assert.equal(diagnostics.viewmodels.offHandVisualId, 'focus');
    await capture(page, `${prefix}-loadout-${loadout}.png`);
  }

  await fixtureCall(page, 'setLoadout', 'xiphos-aspis');
  for (const visualId of enemies) {
    await fixtureCall(page, 'setEnemy', visualId, 5.5, 'IDLE');
    const diagnostics = await assertViewmodelsAndEnemy(page, `${prefix} ${visualId}`);
    assert.equal(diagnostics.atlas.characterRigAtlas.state, 'ready');
    await capture(page, `${prefix}-enemy-${visualId}.png`);
  }

  if (width === 1280) {
    await fixtureCall(page, 'setEnemy', 'bronze_revenant');
    await fixtureCall(page, 'setEnemyState', 'IDLE');
    await fixtureCall(page, 'setAction', null);
    await capture(page, `${prefix}-lifecycle-idle.png`);
    for (const phase of ['WINDUP', 'ACTIVE', 'RECOVERY']) {
      await fixtureCall(page, 'setAction', phase);
      const diagnostics = await assertViewmodelsAndEnemy(page, `${prefix} attack ${phase}`);
      assert.equal(diagnostics.viewmodels.mainHandVisible, true);
      assert.equal(diagnostics.viewmodels.offHandVisible, true);
      await capture(page, `${prefix}-lifecycle-attack-${phase.toLowerCase()}.png`);
    }
    await fixtureCall(page, 'setAction', null);
    await fixtureCall(page, 'setLoadout', 'xiphos-aspis');
    const beforeChange = await fixtureCall(page, 'diagnostics');
    await fixtureCall(page, 'setLoadout', 'labrys');
    const afterChange = await fixtureCall(page, 'diagnostics');
    assert.notEqual(afterChange.viewmodels.mainHandVisualId, beforeChange.viewmodels.mainHandVisualId, 'Equipment changes must update the first-person visual immediately.');
    assert.equal(afterChange.viewmodels.mainHandVisible, true);
    await capture(page, `${prefix}-lifecycle-equipment-change.png`);
  }
}

async function verifyLegacyFallback(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.route('**/assets/maze/characters/character_rigs.png', route => route.abort());
  const { graphics } = await startFixture(page, viewport, 'error');
  await page.waitForFunction(() => window.__r6f1?.diagnostics().atlas.characterRigAtlas.state === 'error');
  await fixtureCall(page, 'setEnemy', 'cretan_cave_rat');
  const fallbackDiagnostics = await fixtureCall(page, 'diagnostics');
  assert.equal(fallbackDiagnostics.enemyVisualCount, 1);
  assert.equal(fallbackDiagnostics.atlas.characterRigAtlas.state, 'error');
  assert.ok(fallbackDiagnostics.atlas.loadErrors.some(error => error.includes('legacy enemy sprite fallbacks remain active')));
  await fixtureCall(page, 'setEnemy', null);
  await fixtureCall(page, 'captureBaseline');
  await fixtureCall(page, 'setEnemy', 'cretan_cave_rat');
  const pixels = await fixtureCall(page, 'compareToBaseline');
  assert.ok(pixels.changedPixels > 0, 'A failed atlas must still render a visible local legacy sprite fallback.');
  record('Legacy enemy sprite fallback on atlas error', { ...graphics, changedPixels: pixels.changedPixels, atlas: fallbackDiagnostics.atlas.characterRigAtlas });
  await page.evaluate(() => window.__r6f1?.dispose());
  await context.close();
}

(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true });
  if (skipForMissingBrowser()) return;
  const { createServer } = await import(path.join(repositoryRoot, 'node_modules/vite/dist/node/index.js'));
  server = await createServer({ root: repositoryRoot, server: { host: '127.0.0.1', port, strictPort: true } });
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  report.browser = { status: 'available', executable: chromiumPath(), webgl: 'Chromium SwiftShader / WebGL 2' };
  const context = await browser.newContext({ viewport: resolutions[0], deviceScaleFactor: 1 });
  const page = await context.newPage();
  const { pageErrors, graphics } = await startFixture(page, resolutions[0]);
  record('Deterministic WebGL fixture', { ...graphics, worldSeed: '0x6f1f1' });
  for (const resolution of resolutions) await captureResolution(page, resolution);
  assert.deepEqual(pageErrors, [], 'Browser page exceptions');
  await verifyLegacyFallback(resolutions[0]);
  await page.evaluate(() => window.__r6f1?.dispose());
  await context.close();
  report.status = 'passed';
  report.expectedScreenshotPaths = expectedScreenshotPaths();
  writeReport();
  console.log(JSON.stringify({ complete: true, checks: report.checks.length, screenshots: report.screenshots.length, outputDirectory }));
})().catch(error => {
  report.status = 'failed';
  report.errors.push(error instanceof Error ? error.stack || error.message : String(error));
  writeReport();
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await browser?.close().catch(() => undefined);
  await server?.close().catch(() => undefined);
});
