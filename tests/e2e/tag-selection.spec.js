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
      test.skip(info.project.name === 'iphone-webkit', 'Explicit device profiles run on Chromium and WebKit.');
      await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
      await page.addInitScript(() => localStorage.clear());
      await page.goto('/?e2e=1');
      const editor = page.locator('#notepad-editor');
      await expect(editor).toBeVisible();
      await editor.evaluate(el => {
        el.innerHTML = '<div data-line-id="sample-a">First sample line</div><div data-line-id="sample-b">Review sample item</div><div data-line-id="sample-c">Last sample line</div>';
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        el.focus({ preventScroll: true });
        const range = document.createRange();
        range.setStart(el.querySelector('[data-line-id="sample-b"]').firstChild, 7);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges(); selection.addRange(range);
        rememberEditorSelection(el, { force: true });
      });
    });

    async function caret(page) {
      return page.locator('#notepad-editor').evaluate(el => {
        const selection = window.getSelection();
        const node = selection.anchorNode;
        const line = (node?.nodeType === Node.TEXT_NODE ? node.parentElement : node)?.closest('[data-line-id]');
        const range = document.createRange();
        if (line) { range.selectNodeContents(line); range.setEnd(node, selection.anchorOffset); }
        return { line: line?.dataset.lineId, offset: line ? range.toString().length : -1, focused: document.activeElement === el };
      });
    }

    test('opening and closing Tags preserves a caret in the middle of a note', async ({ page }) => {
      const before = await page.locator('#notepad-editor').innerHTML();
      await page.locator('[data-mobile-tag-toggle]').tap();
      expect(await caret(page)).toEqual({ line: 'sample-b', offset: 7, focused: true });
      await page.locator('[data-mobile-tag-toggle]').tap();
      expect(await caret(page)).toEqual({ line: 'sample-b', offset: 7, focused: true });
      expect(await page.locator('#notepad-editor').innerHTML()).toBe(before);
    });

    test('I/O inserts at the remembered caret and typing continues immediately after it', async ({ page }, info) => {
      await page.locator('[data-mobile-tag-toggle]').tap();
      await page.locator('[data-mobile-tag="io"]').tap();
      await page.keyboard.type('X');
      await expect(page.locator('[data-line-id="sample-b"]')).toContainText('Review I/O Xsample item');
      await expect(page.locator('[data-line-id="sample-b"] [data-tag="io"]')).toHaveCount(1);
      await expect(page.locator('[data-line-id="sample-a"]')).toHaveText('First sample line');
      await expect(page.locator('[data-line-id="sample-c"]')).toHaveText('Last sample line');
      await page.screenshot({ path: info.outputPath('tag-insert-keeps-line.png'), scale: 'css' });
    });

    test('selected text is replaced at its original location when choosing a tag', async ({ page }) => {
      await page.locator('#notepad-editor').evaluate(el => {
        const text = el.querySelector('[data-line-id="sample-b"]').firstChild;
        const range = document.createRange(); range.setStart(text, 7); range.setEnd(text, 13);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      });
      await page.locator('[data-mobile-tag-toggle]').tap();
      await page.locator('[data-mobile-tag="io"]').tap();
      await page.keyboard.type('X');
      await expect(page.locator('[data-line-id="sample-b"]')).toContainText('Review I/O X item');
      await expect(page.locator('[data-line-id="sample-c"]')).toHaveText('Last sample line');
    });

    test('a cancelled tag press does not prevent moving the caret for the next tag', async ({ page }) => {
      await page.locator('[data-mobile-tag-toggle]').tap();
      await page.locator('[data-mobile-tag="io"]').evaluate(button => {
        button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', bubbles: true, cancelable: true }));
        button.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, pointerType: 'touch', bubbles: true }));
        const event = new Event('touchcancel', { bubbles: true });
        button.dispatchEvent(event);
        const editor = document.querySelector('#notepad-editor');
        const range = document.createRange(); range.setStart(editor.querySelector('[data-line-id="sample-c"]').firstChild, 5); range.collapse(true);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      });
      await expect(page.locator('#notepad-editor [data-tag="io"]')).toHaveCount(0);
      await page.locator('[data-mobile-tag="io"]').tap();
      await expect(page.locator('[data-line-id="sample-c"] [data-tag="io"]')).toHaveCount(1);
      await expect(page.locator('[data-line-id="sample-b"]')).toHaveText('Review sample item');
    });

    test('refocusing after keyboard dismissal cannot overwrite the saved caret', async ({ page }) => {
      await page.locator('#notepad-editor').evaluate(el => {
        el.blur();
        // Reproduce WebKit temporarily choosing its default range during focus,
        // before the application's focusin listener has restored the bookmark.
        el.addEventListener('focus', () => {
          const range = document.createRange(); range.selectNodeContents(el); range.collapse(true);
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        });
      });
      await page.locator('[data-mobile-tag-toggle]').tap();
      expect(await caret(page)).toEqual({ line: 'sample-b', offset: 7, focused: true });
      await page.locator('[data-mobile-tag="io"]').tap();
      await expect(page.locator('[data-line-id="sample-b"] [data-tag="io"]')).toHaveCount(1);
    });

    test('transient iOS selection changes during a tag press cannot change the insertion point', async ({ page }) => {
      await page.locator('[data-mobile-tag-toggle]').tap();
      await page.locator('[data-mobile-tag="io"]').evaluate(button => {
        button.addEventListener('touchstart', () => {
          const editor = document.querySelector('#notepad-editor');
          const range = document.createRange(); range.selectNodeContents(editor); range.collapse(true);
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
          document.dispatchEvent(new Event('selectionchange'));
        });
      });
      await page.locator('[data-mobile-tag="io"]').tap();
      await expect(page.locator('[data-line-id="sample-b"] [data-tag="io"]')).toHaveCount(1);
    });
  });
}
