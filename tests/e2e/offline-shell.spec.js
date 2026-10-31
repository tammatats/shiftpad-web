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
