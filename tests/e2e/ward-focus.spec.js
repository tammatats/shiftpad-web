const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(() => localStorage.clear());
  await page.clock.install({ time: new Date('2026-10-29T10:00:00Z') });
  await page.goto('/?e2e=1&workspace=shift');
  await expect(page.locator('#notepad-editor')).toBeVisible();
  await page.clock.pauseAt('2026-10-29T10:01:00Z');
});

for (const openThenClose of [false, true]) {
  test(`a ${openThenClose ? 'just-closed' : 'hidden'} ward drawer cannot steal typing into a new note`, async ({ page }) => {
    await page.evaluate(openThenClose => {
      uiState.wardOptionsOpen = openThenClose;
      addWard();
      if (openThenClose) {
        uiState.wardOptionsOpen = false;
        renderDrawer();
      }
      document.querySelector('#notepad-editor').focus();
    }, openThenClose);
    // Reproduce the delayed RAF landing between focus and keyboard input.
    await page.clock.runFor(32);
    await expect(page.locator('#notepad-editor')).toBeFocused();
    await page.keyboard.insertText('New ward note stays here');
    await expect(page.locator('#notepad-editor')).toContainText('New ward note stays here');
    expect(await page.evaluate(() => getCurrentNote().documentHtml.includes('New ward note stays here'))).toBe(true);
    expect(await page.locator('[data-ward-name-input]').inputValue()).toBe('Ward B');
  });
}

test('an explicitly opened ward rename still receives focus', async ({ page }) => {
  await page.evaluate(() => { uiState.wardOptionsOpen = true; addWard(); });
  await page.clock.runFor(32);
  await expect(page.locator('[data-ward-name-input]')).toBeFocused();
});

test('delayed ward rename respects a newer focus choice', async ({ page }) => {
  await page.evaluate(() => {
    uiState.wardOptionsOpen = true;
    addWard();
    document.querySelector('#search-btn').focus();
  });
  await page.clock.runFor(32);
  await expect(page.locator('#search-btn')).toBeFocused();
});
