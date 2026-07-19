#!/usr/bin/env node
/**
 * Review tooling (NOT shipped app code, not part of the smoke path).
 * Boots `vite preview` on the built dist/ and screenshots each screen at
 * phone viewport (390x844), so a visual refresh can be compared before/after.
 *
 * Usage: node scripts/shots.mjs <label>   e.g. node scripts/shots.mjs before
 * Output: <OUT_DIR>/<label>-<screen>.png
 *
 * Adapted from scripts/smoke.mjs (same playwright-core + vite preview setup).
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}/crispy-palm-tree/`;
const OUT_DIR =
  process.env.SHOTS_DIR ||
  '/tmp/claude-0/-home-user-crispy-palm-tree/0e97fb24-ee31-53d7-a946-07773469c944/scratchpad/shots';

const label = process.argv[2] || 'shot';
const SCREENS = ['Session', 'Progress', 'Overview'];

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite');
    const proc = spawn(viteBin, ['preview', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let output = '';
    const onData = (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes(`localhost:${PORT}`)) {
        proc.stdout.off('data', onData);
        resolve(proc);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (data) => (output += data.toString()));
    proc.on('error', reject);
    setTimeout(() => reject(new Error(`vite preview did not start: ${output}`)), 20000);
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await startPreviewServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.session-screen', { timeout: 5000 });

    for (const screen of SCREENS) {
      await page.getByRole('button', { name: screen, exact: true }).click();
      await page.waitForTimeout(250);
      const file = path.join(OUT_DIR, `${label}-${screen.toLowerCase()}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`saved ${file}`);
    }
  } finally {
    await browser.close();
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
