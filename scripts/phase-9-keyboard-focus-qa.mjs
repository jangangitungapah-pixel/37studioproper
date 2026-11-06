/* global document, window */

import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = 'http://127.0.0.1:4174';
const reportDir = resolve('output/phase-9');
const screenshotDir = resolve(reportDir, 'screenshots');
const harnessHtml = resolve('.phase-9-qa-harness.html');
const harnessJsx = resolve('.phase-9-qa-harness.jsx');
const results = [];
const runtimeErrors = [];
let server;
let browser;
let lastConnectionError;

function record(name, status, details = '') {
  results.push({ name, status, details: String(details || '') });
  console.log(`[${status}] ${name}${details ? ': ' + details : ''}`);
}

async function test(name, callback) {
  try {
    record(name, 'PASS', await callback());
  } catch (error) {
    record(name, 'FAIL', error?.message || error);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;',
  })[c]);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) {
      throw new Error('Vite berhenti sebelum siap.');
    }
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(800),
      });
      if (response.ok) return;
    } catch (error) {
      lastConnectionError = error;
    }
    await delay(500);
  }
  throw new Error(
    'Timeout menunggu Vite di ' + baseUrl +
    (lastConnectionError ? ': ' + lastConnectionError.message : ''),
  );
}

async function writeHarness() {
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Phase 9 QA Harness</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/.phase-9-qa-harness.jsx"></script>
</body>
</html>`;

  const jsx = `import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import StudioSelect from './src/components/ui/StudioSelect.jsx';
import ConfirmDialog from './src/components/ui/ConfirmDialog.jsx';

const options = [
  { key: 'alpha', label: 'Alpha' },
  { key: 'disabled', label: 'Blocked option', disabled: true },
  { key: 'beta', label: 'Beta' },
  { key: 'gamma', label: 'Gamma' },
];

function Harness() {
  const [single, setSingle] = useState('alpha');
  const [multiple, setMultiple] = useState([]);
  const [dialogConfig, setDialogConfig] = useState(null);

  const openDialog = () => setDialogConfig({
    title: 'QA confirmation dialog',
    message: 'Dialog ini hanya untuk pengujian lokal.',
    detail: 'Tidak ada data produksi yang akan diubah.',
    cancelLabel: 'Batal',
    confirmLabel: 'Konfirmasi lokal',
    onConfirm: () => new Promise(resolve => {
      window.__qaConfirmResolve = resolve;
    }),
  });

  return <main style={{
    padding: 24, display: 'grid', gap: 24, maxWidth: 560
  }}>
    <h1>Phase 9 QA Harness</h1>
    <section>
      <StudioSelect
        label="Single select QA"
        options={options}
        selectedKey={single}
        onChange={setSingle}
      />
      <output id="qa-single-value">{single}</output>
    </section>
    <section>
      <StudioSelect
        label="Multiple select QA"
        multiple
        options={options}
        selectedKeys={multiple}
        onChange={setMultiple}
      />
      <output id="qa-multiple-value">{multiple.join(',')}</output>
    </section>
    <button id="qa-open-dialog" type="button" onClick={openDialog}>
      Buka dialog QA
    </button>
    <button id="qa-after-dialog" type="button">
      Target setelah dialog
    </button>
    <ConfirmDialog
      config={dialogConfig}
      onClose={() => setDialogConfig(null)}
    />
  </main>;
}

createRoot(document.getElementById('root')).render(<Harness />);`;

  await writeFile(harnessHtml, html, 'utf8');
  await writeFile(harnessJsx, jsx, 'utf8');
}

async function runLandingMenuTests() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  page.on('pageerror', e => runtimeErrors.push('Landing: ' + e.message));

  await page.goto(baseUrl + '/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const menu = page.locator('.client-landing-menu-button');
  await menu.waitFor({ state: 'visible', timeout: 20000 });

  await test('Landing menu ARIA disclosure', async () => {
    const controls = await menu.getAttribute('aria-controls');
    if (!controls) throw new Error('aria-controls tidak tersedia');
    if (await page.locator('#' + controls).count() !== 1) {
      throw new Error('Target aria-controls tidak ditemukan');
    }
    if (await menu.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Menu tidak tertutup pada awal test');
    }
    return 'ARIA controls dan expanded valid';
  });

  await test('Landing menu Enter dan Escape', async () => {
    await menu.focus();
    await page.keyboard.press('Enter');

    await page.waitForFunction(() =>
      document.querySelector('.client-landing-menu-button')
        ?.getAttribute('aria-expanded') === 'true'
    );

    const firstLink = page.locator('.client-landing-nav-link').first();
    await firstLink.focus();

    if (!await firstLink.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus tidak masuk ke link navigasi');
    }

    await page.keyboard.press('Escape');

    await page.waitForFunction(() =>
      document.querySelector('.client-landing-menu-button')
        ?.getAttribute('aria-expanded') === 'false'
    );

    if (!await menu.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus tidak tertahan pada trigger setelah Escape');
    }
    return 'Escape dari link navigasi menutup menu dan memulihkan fokus ke trigger';
  });

  await test('Landing navigation keyboard focus', async () => {
    await menu.focus();
    await page.keyboard.press('Enter');

    const firstLink = page.locator('.client-landing-nav-link').first();
    await firstLink.waitFor({ state: 'visible', timeout: 5000 });
    await firstLink.focus();

    if (!await firstLink.evaluate(e => e === document.activeElement)) {
      throw new Error('Link navigasi tidak dapat menerima fokus');
    }

    await page.screenshot({
      path: resolve(screenshotDir, 'landing-menu-open.png'),
    });

    return 'Link navigasi dapat difokuskan';
  });

  await test('Landing navigation destination focus', async () => {
    const studioLink = page.locator('.client-landing-nav-link').filter({ hasText: 'Studio' });
    await studioLink.focus();
    await page.keyboard.press('Enter');

    await page.waitForFunction(() => window.location.hash === '#services');
    await page.waitForFunction(() =>
      document.querySelector('.client-landing-menu-button')
        ?.getAttribute('aria-expanded') === 'false'
    );

    const destination = page.locator('#services');
    if (!await destination.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus tidak berpindah ke section tujuan setelah anchor navigation');
    }

    return 'Anchor navigation memindahkan fokus ke section tujuan';
  });

  await page.close();
}

async function runStudioSelectTests() {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });

  page.on('pageerror', e => runtimeErrors.push('StudioSelect: ' + e.message));

  await page.goto(baseUrl + '/.phase-9-qa-harness.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const single = page.getByRole('combobox', {
    name: 'Single select QA',
  });

  await single.waitFor({ state: 'visible', timeout: 15000 });

  await test('StudioSelect ArrowDown opens listbox', async () => {
    await single.focus();
    await page.keyboard.press('ArrowDown');

    await page.getByRole('listbox').waitFor({ state: 'visible' });

    if (await single.getAttribute('aria-expanded') !== 'true') {
      throw new Error('aria-expanded bukan true');
    }

    if (!await single.getAttribute('aria-activedescendant')) {
      throw new Error('aria-activedescendant tidak tersedia');
    }

    return 'Listbox terbuka dan active descendant tersedia';
  });

  await test('StudioSelect skips disabled option', async () => {
    await page.keyboard.press('ArrowDown');

    const id = await single.getAttribute('aria-activedescendant');
    const active = page.locator('[id="' + id + '"]');

    if (await active.getAttribute('aria-disabled') === 'true') {
      throw new Error('ArrowDown memilih opsi disabled');
    }

    if ((await active.innerText()).trim() !== 'Beta') {
      throw new Error('ArrowDown seharusnya menuju Beta');
    }

    return 'Opsi disabled dilewati';
  });

  await test('StudioSelect Home dan End', async () => {
    await page.keyboard.press('Home');

    let id = await single.getAttribute('aria-activedescendant');
    let label = (await page.locator('[id="' + id + '"]').innerText()).trim();

    if (label !== 'Alpha') throw new Error('Home tidak menuju Alpha');

    await page.keyboard.press('End');

    id = await single.getAttribute('aria-activedescendant');
    label = (await page.locator('[id="' + id + '"]').innerText()).trim();

    if (label !== 'Gamma') throw new Error('End tidak menuju Gamma');

    return 'Home=Alpha dan End=Gamma';
  });

  await test('StudioSelect typeahead', async () => {
    await page.keyboard.press('b');

    const id = await single.getAttribute('aria-activedescendant');
    const label = (await page.locator('[id="' + id + '"]').innerText()).trim();

    if (label !== 'Beta') {
      throw new Error('Typeahead b tidak memilih Beta');
    }

    return 'Typeahead b memilih Beta';
  });

  await test('StudioSelect Enter memilih opsi', async () => {
    await page.keyboard.press('Enter');

    await page.waitForFunction(() =>
      document.querySelector('.studio-select-trigger')
        ?.getAttribute('aria-expanded') === 'false'
    );

    if ((await page.locator('#qa-single-value').innerText()).trim() !== 'beta') {
      throw new Error('Nilai pilihan tidak berubah menjadi beta');
    }

    if (!await single.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus tidak kembali ke trigger');
    }

    return 'Beta dipilih dan listbox tertutup';
  });

  await test('StudioSelect Escape', async () => {
    await single.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');

    if (await single.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Escape tidak menutup listbox');
    }

    if (!await single.evaluate(e => e === document.activeElement)) {
      throw new Error('Escape tidak memulihkan fokus');
    }

    return 'Escape menutup dan memulihkan fokus';
  });

  await test('StudioSelect Tab', async () => {
    await single.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');

    if (await single.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Tab tidak menutup listbox');
    }

    if (await single.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus terjebak pada trigger');
    }

    return 'Tab menutup listbox dan memindahkan fokus';
  });

  const multi = page.getByRole('combobox', {
    name: 'Multiple select QA',
  });

  await test('StudioSelect multi-select', async () => {
    await multi.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    if ((await page.locator('#qa-multiple-value').innerText()).trim() !== 'alpha') {
      throw new Error('Alpha tidak masuk ke selectedKeys');
    }

    if (await multi.getAttribute('aria-expanded') !== 'true') {
      throw new Error('Multi-select seharusnya tetap terbuka');
    }

    await page.keyboard.press('Escape');
    return 'Multi-select memilih Alpha tanpa menutup listbox';
  });

  await page.screenshot({
    path: resolve(screenshotDir, 'studio-select-harness.png'),
    fullPage: true,
  });

  await page.close();
}

async function runConfirmDialogTests() {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });

  page.on('pageerror', e => runtimeErrors.push('ConfirmDialog: ' + e.message));

  await page.goto(baseUrl + '/.phase-9-qa-harness.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const trigger = page.locator('#qa-open-dialog');
  const dialog = page.getByRole('alertdialog');

  await test('ConfirmDialog ARIA dan initial focus', async () => {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await dialog.waitFor({ state: 'visible' });

    if (await dialog.getAttribute('aria-modal') !== 'true') {
      throw new Error('aria-modal bukan true');
    }

    const labelledBy = await dialog.getAttribute('aria-labelledby');
    const describedBy = await dialog.getAttribute('aria-describedby');

    if (!labelledBy || await page.locator('[id="' + labelledBy + '"]').count() !== 1) {
      throw new Error('aria-labelledby tidak valid');
    }

    if (!describedBy || await page.locator('[id="' + describedBy.split(' ')[0] + '"]').count() === 0) {
      throw new Error('aria-describedby tidak valid');
    }

    const cancel = dialog.getByRole('button', { name: 'Batal' });
    await page.waitForFunction(() =>
      document.activeElement?.textContent?.includes('Batal')
    );

    if (!await cancel.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus awal bukan Cancel');
    }

    if (await page.locator('body').evaluate(e => e.style.overflow) !== 'hidden') {
      throw new Error('Body scroll tidak terkunci');
    }

    await page.screenshot({
      path: resolve(screenshotDir, 'confirm-dialog-open.png'),
    });

    return 'ARIA valid, fokus awal Cancel, scroll terkunci';
  });

  await test('ConfirmDialog focus trap dua arah', async () => {
    const buttons = dialog.locator('button:not([disabled])');
    const first = buttons.first();
    const last = buttons.last();

    await first.focus();
    await page.keyboard.press('Shift+Tab');

    if (!await last.evaluate(e => e === document.activeElement)) {
      throw new Error('Shift+Tab tidak menuju elemen terakhir');
    }

    await page.keyboard.press('Tab');

    if (!await first.evaluate(e => e === document.activeElement)) {
      throw new Error('Tab tidak kembali ke elemen pertama');
    }

    return 'Shift+Tab dan Tab membungkus fokus';
  });

  await test('ConfirmDialog Escape dan focus restoration', async () => {
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });

    if (!await trigger.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus tidak kembali ke tombol pembuka');
    }

    if (await page.locator('body').evaluate(e => e.style.overflow) === 'hidden') {
      throw new Error('Body scroll tetap terkunci');
    }

    return 'Escape menutup dialog dan memulihkan fokus';
  });

  await test('ConfirmDialog pending blocks Escape', async () => {
    await trigger.click();
    await dialog.waitFor({ state: 'visible' });

    await dialog.getByRole('button', {
      name: 'Konfirmasi lokal',
    }).click();

    await page.waitForFunction(() =>
      document.querySelector('[role="alertdialog"]')
        ?.getAttribute('aria-busy') === 'true'
    );

    await page.keyboard.press('Escape');

    if (!await dialog.isVisible()) {
      throw new Error('Escape menutup dialog saat pending');
    }

    await page.evaluate(() => window.__qaConfirmResolve?.());
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });

    if (!await trigger.evaluate(e => e === document.activeElement)) {
      throw new Error('Fokus tidak kembali setelah pending');
    }

    return 'Pending menahan Escape hingga callback lokal selesai';
  });

  await page.close();
}

async function writeReports() {
  await mkdir(screenshotDir, { recursive: true });

  const summary = {
    generatedAt: new Date().toISOString(),
    note: 'Pengujian memakai local Vite dan callback dialog lokal. Tidak ada production writes.',
    totals: {
      passed: results.filter(x => x.status === 'PASS').length,
      failed: results.filter(x => x.status === 'FAIL').length,
      skipped: results.filter(x => x.status === 'SKIP').length,
    },
    runtimeErrors,
    results,
  };

  await writeFile(
    resolve(reportDir, 'keyboard-focus-report.json'),
    JSON.stringify(summary, null, 2),
    'utf8',
  );

  const rows = results.map(x =>
    `<tr><td>${escapeHtml(x.name)}</td><td class="${x.status.toLowerCase()}">${x.status}</td><td>${escapeHtml(x.details)}</td></tr>`
  ).join('\n');

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Phase 9 Keyboard & Focus QA</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 18px;color:#20242b}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd;vertical-align:top}
.pass{color:#087443;font-weight:700}
.fail{color:#c62828;font-weight:700}
.summary{display:flex;gap:20px;flex-wrap:wrap;padding:16px;background:#f4f5f7;border-radius:12px}
</style>
</head>
<body>
<h1>Phase 9.2 · Keyboard & Focus QA</h1>
<p>Generated: ${escapeHtml(summary.generatedAt)}</p>
<div class="summary">
<strong>PASS: ${summary.totals.passed}</strong>
<strong>FAIL: ${summary.totals.failed}</strong>
<strong>SKIP: ${summary.totals.skipped}</strong>
</div>
<h2>Test results</h2>
<table>
<thead><tr><th>Test</th><th>Status</th><th>Detail</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>Runtime errors</h2>
<pre>${escapeHtml(runtimeErrors.join('\n') || 'None')}</pre>
<p>Screenshots: output/phase-9/screenshots/</p>
</body></html>`;

  await writeFile(
    resolve(reportDir, 'keyboard-focus-report.html'),
    html,
    'utf8',
  );

  return summary;
}

try {
  await mkdir(screenshotDir, { recursive: true });
  await writeHarness();

  server = spawn(process.execPath, [
    resolve('node_modules/vite/bin/vite.js'),
    '--host', '127.0.0.1',
    '--port', '4174',
    '--strictPort',
  ], { stdio: 'ignore' });

  await waitForServer();
  browser = await chromium.launch({ headless: true });

  await runLandingMenuTests();
  await runStudioSelectTests();
  await runConfirmDialogTests();

} catch (error) {
  record('Runner startup/runtime', 'FAIL', error?.stack || error?.message);
} finally {
  if (browser) await browser.close().catch(() => {});

  if (server && server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await Promise.race([
      new Promise(resolveClose => server.once('close', resolveClose)),
      delay(2500),
    ]);
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGKILL');
    }
  }

  await rm(harnessHtml, { force: true }).catch(() => {});
  await rm(harnessJsx, { force: true }).catch(() => {});

  const summary = await writeReports();

  console.log('\nPhase 9.2 report: output/phase-9/keyboard-focus-report.html');
  console.log('JSON report: output/phase-9/keyboard-focus-report.json');
  console.log(
    `Totals: PASS=${summary.totals.passed}, FAIL=${summary.totals.failed}, SKIP=${summary.totals.skipped}`
  );

  if (summary.totals.failed > 0 || runtimeErrors.length > 0) {
    process.exitCode = 1;
  }
}