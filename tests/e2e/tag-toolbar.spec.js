const { test, expect, devices } = require('@playwright/test');
for (const [name, profile] of [
  ['iPhone', devices['iPhone 15']],
  ['iPad half', { ...devices['iPad Pro 11'], viewport: { width: 683, height: 960 } }],
  ['iPad quarter', { ...devices['iPad Pro 11'], viewport: { width: 320, height: 960 } }]
]) {
  test.describe(name, () => {
    const { defaultBrowserType, ...options } = profile;
    test.use({ ...options, serviceWorkers: 'block' });
    test.beforeEach(async ({ page }, info) => {
      test.skip(info.project.name === 'iphone-webkit', 'Explicit device profiles cover both engines.');
      await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
      await page.addInitScript(() => localStorage.clear());
      await page.goto('/?e2e=1');
      await expect(page.locator('#notepad-editor')).toBeVisible();
    });
    test('common tags take one tap and the entire toolbar fits the viewport', async ({ page }, info) => {
      const toolbar = page.locator('.mobile-editor-toolbar');
      for (const tag of ['bed', 'hn', 'todo']) await expect(toolbar.locator(`[data-mobile-direct-tag="${tag}"]`)).toBeVisible();
      const box = await toolbar.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
      const targets = await toolbar.locator('button').evaluateAll(buttons => buttons.map(button => ({
        width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height,
        textFits: button.scrollWidth <= button.clientWidth
      })));
      expect(targets.every(target => target.width >= 44 && target.height >= 44 && target.textFits)).toBe(true);
      await toolbar.locator('[data-mobile-direct-tag="todo"]').tap();
      await page.keyboard.insertText('one tap');
      await expect(page.locator('#notepad-editor [data-tag="todo"]')).toHaveCount(1);
      await expect(page.locator('#notepad-editor')).toContainText('one tap');
      await expect(page.locator('[data-mobile-tag-toggle]')).toHaveAttribute('aria-expanded', 'false');
      await page.screenshot({ path: info.outputPath('one-tap-toolbar.png'), scale: 'css' });
    });
    test('tag replacement is explicit; cancel and a new line preserve existing content', async ({ page }) => {
      const editor = page.locator('#notepad-editor');
      await editor.evaluate(el => {
        el.innerHTML = '<div data-line-id="existing"><span class="tag-token tag-io" contenteditable="false" data-tag="io" data-token-id="sample-io">I/O</span> review sample</div>';
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        el.focus(); const range = document.createRange(); range.selectNodeContents(el.firstChild); range.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(range); rememberEditorSelection(el, { force: true });
      });
      await page.locator('[data-mobile-direct-tag="todo"]').tap();
      await expect(page.locator('[data-tag-choice="replace"]')).toBeVisible();
      await expect(editor.locator('[data-tag="io"]')).toHaveCount(1);
      await page.locator('[data-tag-choice="cancel"]').tap();
      await expect(editor.locator('[data-tag="io"]')).toHaveCount(1);
      await page.locator('[data-mobile-direct-tag="todo"]').tap();
      await page.locator('[data-tag-choice="new-line"]').tap();
      await page.keyboard.insertText('new task');
      await expect(editor.locator('[data-line-id="existing"]')).toContainText('I/O review sample');
      await expect(editor.locator('[data-tag="todo"]')).toHaveCount(1);
      await expect(editor).toContainText('new task');
    });
    test('native-style Thai composition and rich paste remain editable after a tag', async ({ page }) => {
      const editor = page.locator('#notepad-editor');
      await page.locator('[data-mobile-direct-tag="todo"]').tap();
      await editor.dispatchEvent('compositionstart', { data: '' });
      await page.keyboard.insertText('ติดตามผล');
      await editor.dispatchEvent('compositionend', { data: 'ติดตามผล' });
      await page.keyboard.insertText(' tomorrow');
      await expect(editor).toContainText('ติดตามผล tomorrow');
      await editor.evaluate(el => {
        const data = new DataTransfer(); data.setData('text/plain', '\nPasted sample');
        el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
      });
      await expect(editor).toContainText('Pasted sample');
      await expect(editor).toBeFocused();
    });

    test('adding a Bed beside an existing tagged line preserves that line', async ({ page }) => {
      const editor = page.locator('#notepad-editor');
      await editor.evaluate(el => {
        el.innerHTML = '<div data-line-id="existing"><span class="tag-token tag-io" contenteditable="false" data-tag="io" data-token-id="sample-io">I/O</span> review sample</div>';
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        el.focus(); const range = document.createRange(); range.selectNodeContents(el.firstChild); range.collapse(false);
        getSelection().removeAllRanges(); getSelection().addRange(range); rememberEditorSelection(el, { force: true });
      });
      await page.locator('[data-mobile-direct-tag="bed"]').tap();
      await page.keyboard.insertText('12');
      await page.keyboard.press('Enter');
      await expect(editor.locator('[data-tag="bed"]')).toHaveText('Bed 12');
      await expect(editor.locator('[data-line-id="existing"]')).toContainText('I/O review sample');
      await expect(editor.locator('[data-line-id="existing"] [data-tag="io"]')).toHaveCount(1);
    });

    test('an explicit tag replacement can be undone and redone without losing text', async ({ page }) => {
      const editor = page.locator('#notepad-editor');
      await editor.tap();
      await page.locator('[data-mobile-tag-toggle]').tap();
      await page.locator('[data-mobile-tag="io"]').tap();
      await page.keyboard.insertText('sample task');
      await page.locator('[data-mobile-direct-tag="todo"]').tap();
      await page.locator('[data-tag-choice="replace"]').tap();
      await expect(editor.locator('[data-tag="todo"]')).toHaveCount(1);
      await page.locator('.mobile-editor-toolbar [data-editor-undo]').tap();
      await expect(editor.locator('[data-tag="io"]')).toHaveCount(1);
      await expect(editor).toContainText('sample task');
      await page.locator('.mobile-editor-toolbar [data-editor-redo]').tap();
      await expect(editor.locator('[data-tag="todo"]')).toHaveCount(1);
      await expect(editor).toContainText('sample task');
    });

    test('touching disabled Undo cannot freeze subsequent caret movement', async ({ page }) => {
      const editor = page.locator('#notepad-editor');
      await editor.evaluate(el => {
        el.innerHTML = '<div data-line-id="sample-disabled">Review sample item</div>';
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        invalidateEditorHistoryForNote(getActiveWorkspaceKey(), getCurrentNote().id);
        el.focus(); const range = document.createRange(); range.setStart(el.firstChild.firstChild, 7); range.collapse(true);
        getSelection().removeAllRanges(); getSelection().addRange(range); rememberEditorSelection(el, { force: true });
      });
      const undo = page.locator('.mobile-editor-toolbar [data-editor-undo]');
      await expect(undo).toBeDisabled();
      const rect = await undo.boundingBox();
      await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.keyboard.press('ArrowRight');
      await page.locator('[data-mobile-direct-tag="todo"]').tap();
      await page.keyboard.insertText('X');
      await expect(editor).toContainText('Review sXample item');
    });

    test('deliberate arrow navigation dismisses More and updates the insertion point', async ({ page }) => {
      const editor = page.locator('#notepad-editor');
      await editor.evaluate(el => {
        el.innerHTML = '<div data-line-id="sample-navigation">Review sample item</div>';
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        el.focus(); const range = document.createRange(); range.setStart(el.firstChild.firstChild, 7); range.collapse(true);
        getSelection().removeAllRanges(); getSelection().addRange(range); rememberEditorSelection(el, { force: true });
      });
      await page.locator('[data-mobile-tag-toggle]').tap();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('[data-mobile-tag-toggle]')).toHaveAttribute('aria-expanded', 'false');
      await page.locator('[data-mobile-direct-tag="todo"]').tap();
      await page.keyboard.insertText('X');
      await expect(editor).toContainText('Review sXample item');
    });
  });
}
