const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const executable = process.env.CHROMIUM_PATH || chromium.executablePath();
if (!fs.existsSync(executable)) {
  const result = spawnSync(process.execPath, ['scripts/r6f1-browser-smoke.cjs'], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log('The R2A browser scenario also remains unverified because Chromium is unavailable.');
  process.exit(0);
}

for (const script of ['scripts/maze-r2a-smoke.cjs', 'scripts/r6f1-browser-smoke.cjs']) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
