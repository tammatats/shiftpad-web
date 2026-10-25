const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/api/public-config.js', route => route.fulfill({
    contentType: 'application/javascript', body: ''
  }));
  await page.addInitScript(() => localStorage.clear());
});

for (const workspace of ['shift', 'day']) {
  test(`${workspace}: Sort beds stays visible during editing and sorts whole sections`, async ({ page }, info) => {
    await page.goto(`/?e2e=1&workspace=${workspace}`);
    const editor = page.locator('#notepad-editor');
    const sort = page.getByRole('button', { name: 'Sort bed sections', exact: true });
    await expect(editor).toBeVisible();
    if (workspace === 'day') await page.locator('#workspace-switcher').click();
    await expect(page.locator('#workspace-title')).toHaveText(workspace === 'day' ? 'DayPad' : 'ShiftPad');
    await editor.evaluate(element => {
      element.innerHTML = '<div>Ward plan</div>' + [19, 2, 10].map(bed =>
        `<div><span class="tag-token tag-bed" data-tag="bed" data-token-id="sample-bed-${bed}" contenteditable="false">Bed ${bed}</span></div><div>Sample section ${bed}</div><div><br></div>`
      ).join('');
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    });
    await editor.click({ position: { x: 20, y: 10 } });
    await expect(editor).toBeFocused();
    await expect(page.locator('html')).toHaveClass(/editor-is-active/);
    await expect(sort).toBeVisible();
    await expect(sort).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`${workspace}-sort-while-editing.png`), scale: 'css' });
    await sort.click();
    await expect(editor.locator('[data-tag="bed"]')).toHaveText(['Bed 2', 'Bed 10', 'Bed 19']);
    const sections = await editor.evaluate(element => {
      const result = { prefix: [], beds: [] };
      for (const line of element.children) {
        const bed = line.querySelector('[data-tag="bed"]');
        if (bed) result.beds.push({ label: bed.textContent, lines: [] });
        else if (line.textContent.trim()) {
          if (result.beds.length) result.beds.at(-1).lines.push(line.textContent);
          else result.prefix.push(line.textContent);
        }
      }
      return result;
    });
    expect(sections).toEqual({ prefix: ['Ward plan'], beds: [
      { label: 'Bed 2', lines: ['Sample section 2'] },
      { label: 'Bed 10', lines: ['Sample section 10'] },
      { label: 'Bed 19', lines: ['Sample section 19'] }
    ] });
    await page.locator('#timeline-tab-btn').click();
    await page.locator('#notes-tab-btn').click();
    await editor.click({ position: { x: 20, y: 10 } });
    await expect(sort).toBeVisible();
    await expect(editor.locator('[data-tag="bed"]')).toHaveText(['Bed 2', 'Bed 10', 'Bed 19']);
  });
}
