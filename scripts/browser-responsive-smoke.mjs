/* global document, requestAnimationFrame, window */

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.BROWSER_SMOKE_BASE_URL || 'http://127.0.0.1:4173';
const screenshotDir = resolve('output/browser-smoke');
const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];
const routes = [
  { path: '/', name: 'landing' },
  { path: '/book', name: 'public-booking' },
  { path: '/login', name: 'admin-login' },
  {
    path: '/login?portal=guard&redirectTo=%2Fguard%2Fattendance',
    name: 'guard-login',
  },
  { path: '/client/login', name: 'client-login' },
  {
    path: '/admin/finance/invoices',
    name: 'admin-unauthenticated',
    expectedRedirectPath: '/admin/finance/invoices',
  },
];

await mkdir(screenshotDir, { recursive: true });

const preview = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewOutput = '';
preview.stdout.on('data', (chunk) => { previewOutput += chunk.toString(); });
preview.stderr.on('data', (chunk) => { previewOutput += chunk.toString(); });

async function revealLandingSections(page) {
  const selectors = [
    '.client-landing-intro',
    '.client-landing-services',
    '.client-landing-planner',
    '.client-landing-process',
    '.client-landing-client-space',
    '.client-landing-location',
    '.client-landing-final-cta',
  ];

  for (const selector of selectors) {
    const section = page.locator(selector);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    const opacity = await section.evaluate((element) => Number(window.getComputedStyle(element).opacity));
    assert.ok(opacity >= 0.98, selector + ' did not finish its Motion reveal after entering the viewport.');
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(120);
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (preview.exitCode !== null) {
      throw new Error('Vite preview exited before becoming ready.\n' + previewOutput);
    }

    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) return;
    } catch {
      // The server may need another moment to start.
    }

    await delay(500);
  }

  throw new Error('Timed out waiting for Vite preview.\n' + previewOutput);
}

let browser;
const failures = [];

try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true });

  for (const viewport of viewports) {
    for (const route of routes) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.name.startsWith('mobile') ? 2 : 1,
        isMobile: viewport.name.startsWith('mobile'),
        hasTouch: viewport.name.startsWith('mobile'),
      });
      const pageErrors = [];

      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      const url = new URL(route.path, baseUrl).toString();
      console.log('[browser-smoke] loading ' + route.name + ' / ' + viewport.name);
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      assert.ok(response, route.name + ' did not return a navigation response.');
      assert.ok(
        response.status() < 500,
        route.name + ' returned HTTP ' + response.status() + ' at ' + viewport.name,
      );

      if (route.expectedRedirectPath) {
        await page.waitForURL((nextUrl) => (
          nextUrl.pathname === '/login' &&
          nextUrl.searchParams.get('redirectTo') === route.expectedRedirectPath
        ), { timeout: 15_000 });

        console.log(
          '[browser-smoke] signed-out Admin route redirect PASS / ' + viewport.name +
          ' — returnTo=' + route.expectedRedirectPath,
        );
      }

      const heading = page.locator('h1').first();
      await heading.waitFor({ state: 'visible', timeout: 20_000 });
      const headingText = (await heading.innerText()).trim();
      assert.ok(headingText, route.name + ' has an empty visible h1.');

      if (route.name === 'landing') {
        if (viewport.name === 'mobile-390') {
          const menuButton = page.locator('.client-landing-menu-button');
          await menuButton.click();
          await page.locator('.client-landing-nav.is-open').waitFor({ state: 'visible', timeout: 5_000 });
          assert.equal(await page.locator('body').evaluate((element) => element.style.overflow), 'hidden');
          await page.locator('.client-landing-menu-backdrop').click({ position: { x: 190, y: 420 } });
          await page.locator('.client-landing-nav.is-open').waitFor({ state: 'hidden', timeout: 5_000 });
          assert.equal(await page.locator('body').evaluate((element) => element.style.overflow), '');
          console.log('[browser-smoke] landing mobile menu and scroll-lock PASS / ' + viewport.name);
        }

        await page.getByRole('button', { name: 'Pilih Rehearsal dan lihat estimasi harga' }).click();
        const selectedService = await page.locator('.client-landing-planner-form .studio-select-trigger').first().innerText();
        assert.ok(selectedService.includes('Rehearsal'), 'Service story action must preselect Rehearsal in the planner.');
        await revealLandingSections(page);
        console.log('[browser-smoke] landing service shortcut and Motion reveals PASS / ' + viewport.name);
      }

      await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => resolveFrame())));
      const dimensions = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));

      const overflowWidth = Math.max(
        dimensions.bodyScrollWidth,
        dimensions.documentScrollWidth,
      );

      if (overflowWidth > dimensions.viewportWidth + 1) {
        failures.push(
          route.name + ' at ' + viewport.name + ' has horizontal overflow: ' +
          JSON.stringify(dimensions),
        );
      }

      const screenshotPath = resolve(
        screenshotDir,
        route.name + '-' + viewport.name + '.png',
      );
      console.log('[browser-smoke] capturing ' + screenshotPath);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: 'disabled',
      });

      if (route.name === 'landing') {
        const dateInput = page.locator('.client-landing-planner-form input[type="date"]');
        const targetDate = await dateInput.evaluate(() => {
          const date = new Date();
          date.setDate(date.getDate() + 7);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return year + '-' + month + '-' + day;
        });
        await dateInput.fill(targetDate);

        const startHourSelect = page.getByRole('combobox', { name: 'Jam mulai' });
        await startHourSelect.click();
        await page.getByRole('option', { name: /14\.00-15\.00/ }).click();
        await page.getByRole('button', { name: /PILIH SLOT TERSEDIA/ }).click();

        await page.waitForURL((nextUrl) => nextUrl.pathname === '/book', { timeout: 10_000 });
        const handoffUrl = new URL(page.url());
        assert.equal(handoffUrl.searchParams.get('date'), targetDate);
        assert.equal(handoffUrl.searchParams.get('startHour'), '14');

        await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 15_000 });
        console.log(
          '[browser-smoke] planner handoff PASS / ' + viewport.name +
          ' — date=' + targetDate + ', startHour=14',
        );
      }

      if (['admin-login', 'guard-login', 'client-login'].includes(route.name)) {
        await page.context().setOffline(true);
        await page.locator('[data-auth-network-state="offline"]').waitFor({
          state: 'visible',
          timeout: 5_000,
        });
        await page.context().setOffline(false);
        await page.locator('[data-auth-network-state="offline"]').waitFor({
          state: 'hidden',
          timeout: 5_000,
        });
        console.log('[browser-smoke] auth offline / online feedback PASS / ' + viewport.name);
      }

      if (route.name === 'public-booking') {
        const offlineNotice = page.locator('.public-booking-offline-notice');
        await page.context().setOffline(true);
        await offlineNotice.waitFor({ state: 'visible', timeout: 5_000 });
        await page.context().setOffline(false);
        await offlineNotice.waitFor({ state: 'hidden', timeout: 5_000 });
        console.log('[browser-smoke] public booking offline / online feedback PASS / ' + viewport.name);
      }

      if (pageErrors.length) {
        failures.push(
          route.name + ' at ' + viewport.name + ' produced uncaught page errors: ' +
          pageErrors.join(' | '),
        );
      }

      console.log(
        '[browser-smoke] ' + route.name + ' / ' + viewport.name +
        ' — HTTP ' + response.status() +
        ', h1="' + headingText + '"' +
        ', documentWidth=' + overflowWidth +
        ', viewportWidth=' + dimensions.viewportWidth +
        ', screenshot=' + screenshotPath,
      );

      await page.close();
    }
  }
} finally {
  if (browser) await browser.close();

  if (preview.exitCode === null && preview.signalCode === null) {
    const previewClosed = new Promise((resolveClose) => {
      preview.once('close', resolveClose);
    });
    preview.kill('SIGTERM');
    await Promise.race([previewClosed, delay(3000)]);

    if (preview.exitCode === null && preview.signalCode === null) {
      preview.kill('SIGKILL');
    }
  }
}

if (failures.length) {
  console.error('\nBrowser responsive smoke failures:\n- ' + failures.join('\n- '));
  process.exitCode = 1;
} else {
  console.log('\nBrowser responsive smoke: PASS');
}
