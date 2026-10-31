const { test, expect } = require('@playwright/test');
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(() => localStorage.clear());
});
test('a missing note surface recovers from the current model on page return without saving blank content', async ({ page }) => {
  await page.goto('/?e2e=1&workspace=shift');
  const editor = page.locator('#notepad-editor');
  await editor.fill('Sample note retained after resume');
  const before = await page.evaluate(() => ({ html: getCurrentNote().documentHtml, updatedAt: getCurrentNote().updatedAt }));
  await page.evaluate(() => {
    document.querySelector('#editor-root').replaceChildren();
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(editor).toContainText('Sample note retained after resume');
  expect(await page.evaluate(() => ({ html: getCurrentNote().documentHtml, updatedAt: getCurrentNote().updatedAt }))).toEqual(before);
});
test('returning to a healthy or intentionally emptied editor does not rebuild it or restore deleted text', async ({ page }) => {
  await page.goto('/?e2e=1&workspace=shift');
  const editor = page.locator('#notepad-editor');
  await editor.fill('Sample note');
  await editor.evaluate(el => { el.dataset.resumeIdentity = 'unchanged'; });
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(editor).toHaveAttribute('data-resume-identity', 'unchanged');
  await editor.fill('');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(editor).toHaveText('');
  await expect(editor).toHaveAttribute('data-resume-identity', 'unchanged');
});
test('startup shows a useful opening state even if app JavaScript cannot load', async ({ page }, info) => {
  await page.route('**/app.js*', route => route.abort('failed'));
  await page.goto('/?e2e=1&workspace=shift');
  await expect(page.locator('[data-startup-status]')).toContainText('Opening your pad…');
  await expect(page.getByRole('link', { name: 'Reload pad' })).toBeVisible();
  const status = await page.locator('[data-startup-status] [role="status"]').boundingBox();
  const reload = await page.getByRole('link', { name: 'Reload pad' }).boundingBox();
  expect(reload.y).toBeGreaterThanOrEqual(status.y + status.height);
  expect(reload.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath('opening-state.png'), scale: 'css' });
});
