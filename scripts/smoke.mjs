#!/usr/bin/env node
/**
 * Headless smoke test against `vite preview` — PRD §9.3/§9.4.
 *
 * Uses `playwright-core` (not `@playwright/test`) driving the Chromium
 * build already provisioned on this host at PLAYWRIGHT_BROWSERS_PATH —
 * a single end-to-end script doesn't need @playwright/test's test-runner
 * scaffolding (fixtures, parallel workers, reporters); a plain script with
 * assertions is simpler and this is the only smoke test in the repo.
 *
 * Covers:
 *  - App loads at the /crispy-palm-tree/ base path.
 *  - Today's session renders warm-up / main / cool-down sections (R16).
 *  - A set can be checked and weight/reps logged (R11/R12/R13 wired up).
 *  - Reloading the page preserves that logged state (R13).
 *  - The service worker registers (R21/R23).
 *  - The app shell loads with the network offline after a first visit (R23).
 *
 * Run: npm run smoke (builds first, then serves dist/ via `vite preview`).
 *
 * Note: `playwright-core` is pinned to 1.56.1 in package.json because that's
 * the version whose bundled browsers.json expects Chromium revision 1194 —
 * the exact revision pre-provisioned on this host at PLAYWRIGHT_BROWSERS_PATH
 * (no `playwright install` available/needed). Bumping playwright-core without
 * a matching browser revision on the host will make this script fail with
 * "Executable doesn't exist".
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}/crispy-palm-tree/`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Smoke test assertion failed: ${message}`);
  }
}

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    // Spawn the local vite binary directly (not via `npx`) so `proc` is the
    // actual server process, not a wrapper — otherwise killing `proc` later
    // leaves an orphaned vite preview server running after this script exits.
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
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`vite preview exited early (code ${code}): ${output}`));
      }
    });
    setTimeout(() => reject(new Error(`vite preview did not start in time: ${output}`)), 20000);
  });
}

async function main() {
  console.log('Starting vite preview server...');
  const server = await startPreviewServer();

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    // 1. App loads at the /crispy-palm-tree/ base path.
    console.log('1. Loading app at base path...');
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    assert(response && response.ok(), `expected 200 OK from ${BASE_URL}, got ${response?.status()}`);
    await page.waitForSelector('.session-screen', { timeout: 5000 });

    // 2. Today's session renders warm-up / main / cool-down sections.
    console.log('2. Checking warm-up/main/cool-down sections render...');
    assert(await page.locator('#warmup-heading').count(), 'warm-up section missing');
    assert(await page.locator('#main-heading').count(), 'main exercises section missing');
    assert(await page.locator('#cooldown-heading').count(), 'cool-down section missing');
    const exerciseCardCount = await page.locator('.exercise-card').count();
    assert(exerciseCardCount > 0, 'expected at least one exercise card');

    // 3. Check a set, log weight/reps.
    console.log('3. Logging a set (weight/reps + checkbox)...');
    const firstSetRow = page.locator('.set-row').first();
    await firstSetRow.locator('input[aria-label^="Weight"]').fill('30');
    await firstSetRow.locator('input[aria-label^="Reps"]').fill('12');
    const checkbox = firstSetRow.locator('.set-check input[type="checkbox"]');
    await checkbox.check();
    assert(await checkbox.isChecked(), 'set checkbox did not check');

    // Give the incremental IndexedDB write a moment to complete.
    await page.waitForTimeout(300);

    // 4. Reload preserves logged state.
    console.log('4. Reloading and verifying state is preserved...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.session-screen', { timeout: 5000 });
    const reloadedFirstSetRow = page.locator('.set-row').first();
    const reloadedWeight = await reloadedFirstSetRow.locator('input[aria-label^="Weight"]').inputValue();
    const reloadedReps = await reloadedFirstSetRow.locator('input[aria-label^="Reps"]').inputValue();
    const reloadedChecked = await reloadedFirstSetRow
      .locator('.set-check input[type="checkbox"]')
      .isChecked();
    assert(reloadedWeight === '30', `expected weight "30" to survive reload, got "${reloadedWeight}"`);
    assert(reloadedReps === '12', `expected reps "12" to survive reload, got "${reloadedReps}"`);
    assert(reloadedChecked, 'expected set checkbox to still be checked after reload');

    // 5. Service worker registers.
    console.log('5. Checking service worker registration...');
    await page.waitForFunction(
      () => navigator.serviceWorker?.controller !== undefined || navigator.serviceWorker?.getRegistration !== undefined,
      { timeout: 5000 },
    );
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg);
    });
    assert(swRegistered, 'expected a service worker registration');

    // 6. App shell loads offline after the first successful visit.
    console.log('6. Verifying offline load (app shell from cache)...');
    await context.setOffline(true);
    const offlinePage = await context.newPage();
    const offlineResponse = await offlinePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    assert(offlineResponse && offlineResponse.ok(), 'expected app shell to load offline via service worker cache');
    await offlinePage.waitForSelector('.session-screen', { timeout: 5000 });
    await context.setOffline(false);

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors during smoke test:\n${consoleErrors.join('\n')}`);
    }

    console.log('\nAll smoke checks passed.');
  } finally {
    await browser.close();
    // Kill the whole detached process group, not just the immediate
    // process, in case vite spawned children of its own.
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
