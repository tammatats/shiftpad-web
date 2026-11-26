const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });
test('the refactored editor controls and cached app reopen and accept edits offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright WebKit offline service-worker navigation reports an internal error; physical Safari/PWA verification remains required.');
  await context.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('offline-shell-started')) {
      localStorage.clear(); sessionStorage.setItem('offline-shell-started', '1');
    }
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?e2e=1&workspace=shift');
  await expect(page.locator('#notepad-editor')).toBeVisible();
  test.skip(!await page.evaluate(() => 'serviceWorker' in navigator), 'Browser engine does not expose service workers.');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.locator('#notepad-editor').fill('Offline shell sample');
  await page.evaluate(() => flushLocalStateSave());
  await context.setOffline(true);
  await page.reload();
  const editor = page.locator('#notepad-editor');
  await expect(editor).toContainText('Offline shell sample');
  await expect(page.locator('[data-editor-undo]:visible')).toHaveCount(1);
  const cached = await page.evaluate(async () => {
    const script = await fetch('/lib/editor-history.js?uncached-shell-check=1').then(r => r.text());
    const style = await fetch('/styles/editor-controls.css?uncached-shell-check=1').then(r => r.text());
    return { script: script.includes('ShiftPadEditorHistory'), style: style.includes('mobile-editor-toolbar') };
  });
  expect(cached).toEqual({ script: true, style: true });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' still editable');
  await expect(editor).toContainText('still editable');
  expect(errors).toEqual([]);
});

test('temporary server errors reopen the cached working app instead of a blank response', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service-worker lifecycle coverage uses Chromium; native Safari/PWA remains a device check.');
  let unavailable = false;
  await context.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await context.route('http://127.0.0.1:4173/**', route => {
    if (unavailable && !route.request().url().includes('/api/')) return route.fulfill({ status: 503, body: 'Temporarily unavailable' });
    return route.fallback();
  });
  await page.goto('/?e2e=1&workspace=shift');
  const editor = page.locator('#notepad-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Preserved sample note');
  await page.evaluate(() => flushLocalStateSave());
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  unavailable = true;
  await page.reload();
  await expect(editor).toContainText('Preserved sample note');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' still works');
  await expect(editor).toContainText('Preserved sample note still works');
});

test('a stalled navigation opens the cached app after the shell timeout', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Service-worker lifecycle coverage uses Chromium; native Safari/PWA remains a device check.');
  let stall = false, release;
  await context.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await context.route('http://127.0.0.1:4173/**', async route => {
    const url = new URL(route.request().url());
    if (stall && url.pathname === '/' && url.searchParams.get('e2e') === '1') {
      await new Promise(resolve => { release = resolve; });
      return route.abort().catch(() => {});
    }
    return route.fallback();
  });
  await page.goto('/?e2e=1&workspace=shift');
  const editor = page.locator('#notepad-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Sample note through stalled connection');
  await page.evaluate(() => flushLocalStateSave());
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  stall = true;
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 });
    await expect(editor).toContainText('Sample note through stalled connection');
  } finally {
    release?.();
  }
});

test('an empty navigation uses the last working page or offers a retry without losing notes', async ({ page, context, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Service-worker navigation fault injection uses Chromium.');
  let sendEmptyPage = false;
  let emptyResponses = 0;
  await context.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await context.route('http://127.0.0.1:4173/**', route => {
    const url = new URL(route.request().url());
    if (sendEmptyPage && url.pathname === '/' && url.searchParams.get('e2e') === '1') {
      emptyResponses += 1;
      return route.fulfill({ status: 200, contentType: 'text/html', body: '' });
    }
    return route.fallback();
  });
  await page.goto('/?e2e=1&workspace=shift');
  const editor = page.locator('#notepad-editor');
  await editor.fill('Sample note before reopening');
  await page.evaluate(() => flushLocalStateSave());
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  sendEmptyPage = true;
  await page.reload();
  expect(emptyResponses).toBe(1);
  await expect(editor).toContainText('Sample note before reopening');

  // Simulate an OS eviction of the app-page cache. Indexed and local note data
  // are separate from Cache Storage and remain available for the retry.
  await page.evaluate(async () => {
    for (const key of await caches.keys()) await caches.delete(key);
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ShiftPad couldn’t reopen' })).toBeVisible();
  const retry = page.getByRole('link', { name: 'Retry' });
  await expect(retry).toBeVisible();
  await page.screenshot({ path: info.outputPath('reopen-recovery-desktop.png'), scale: 'css' });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.screenshot({ path: info.outputPath('reopen-recovery-iphone-width.png'), scale: 'css' });

  sendEmptyPage = false;
  await retry.click();
  await expect(editor).toContainText('Sample note before reopening');
});
