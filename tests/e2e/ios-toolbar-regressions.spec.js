const { test, expect, devices } = require('@playwright/test');
const profiles = [
  ['iPhone', { ...devices['iPhone 15'], viewport: { width: 393, height: 852 } }, 420],
  ['iPad 50%', { ...devices['iPad Pro 11'], viewport: { width: 683, height: 960 } }, 520],
  ['iPad 25%', { ...devices['iPad Pro 11'], viewport: { width: 320, height: 960 } }, 520]
];
for (const [name, profile, keyboardTop] of profiles) test.describe(name, () => {
  const { defaultBrowserType, ...options } = profile;
  test.use({ ...options, serviceWorkers: 'block' });
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name === 'iphone-webkit', 'Explicit profiles cover both engines.');
    await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.addInitScript(({ ipad, keyboardTop }) => {
      localStorage.clear();
      if (ipad) {
        Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      }
      window.keyboardTop = keyboardTop;
      Object.defineProperty(visualViewport, 'height', { get: () => window.keyboardTop });
    }, { ipad: name.startsWith('iPad'), keyboardTop });
    await page.goto('/?e2e=1&workspace=shift');
    await expect(page.locator('#notepad-editor')).toBeVisible();
    await page.evaluate(top => {
      const keyboard = document.createElement('div'); keyboard.id = 'keyboard'; keyboard.textContent = 'Simulated keyboard';
      Object.assign(keyboard.style, { position: 'fixed', top: `${top}px`, bottom: '0', left: '0', right: '0', background: '#d1d3d9', zIndex: '9999', textAlign: 'center', paddingTop: '32px' });
      document.body.append(keyboard);
      visualViewport.dispatchEvent(new Event('resize'));
    }, keyboardTop);
  });
  async function seed(page, tagged = false) {
    await page.locator('#notepad-editor').evaluate((el, tagged) => {
      el.innerHTML = '<div data-line-id="first">First sample line</div><div data-line-id="target">' + (tagged ? '<span class="tag-token tag-io" data-tag="io" data-token-id="old-io" contenteditable="false">I/O</span> ' : '') + 'Review sample item</div><div data-line-id="last">Last sample line</div>';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      invalidateEditorHistoryForNote(getActiveWorkspaceKey(), getCurrentNote().id);
      el.focus({ preventScroll: true });
      const line = el.querySelector('[data-line-id="target"]');
      const range = document.createRange(); range.setStart(line.lastChild, tagged ? 8 : 7); range.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(range); rememberEditorSelection(el, { force: true });
    }, tagged);
  }
  async function caret(page) {
    return page.evaluate(() => {
      const s = getSelection(); const line = findEditorLine(s.anchorNode);
      const range = document.createRange(); range.selectNodeContents(line); range.setEnd(s.anchorNode, s.anchorOffset);
      return { line: line.dataset.lineId, prefix: range.toString().replace(/[\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ') };
    });
  }
  test('replacement Undo restores the original caret before redo and typing', async ({ page }, info) => {
    await seed(page, true);
    const original = await caret(page);
    await page.locator('[data-mobile-direct-tag="todo"]').tap();
    await page.locator('[data-tag-choice="replace"]').tap();
    await page.locator('.mobile-editor-toolbar [data-editor-undo]').tap();
    expect(await caret(page)).toEqual(original);
    await page.locator('.mobile-editor-toolbar [data-editor-redo]').tap();
    await page.keyboard.insertText('X');
    await expect(page.locator('[data-line-id="target"]')).toContainText('Review Xsample item');
    await page.screenshot({ path: info.outputPath('keyboard-undo-redo.png'), scale: 'css' });
  });
  test('new-line Undo returns to the original line and position', async ({ page }) => {
    await seed(page, true); const original = await caret(page);
    await page.locator('[data-mobile-direct-tag="todo"]').tap();
    await page.locator('[data-tag-choice="new-line"]').tap();
    await page.locator('.mobile-editor-toolbar [data-editor-undo]').tap();
    expect(await caret(page)).toEqual(original);
    await page.keyboard.insertText('X');
    await expect(page.locator('[data-line-id="target"]')).toContainText('Review Xsample item');
  });
  test('a delayed native selection reset after a direct tag cannot move typing to line one', async ({ page }) => {
    await seed(page);
    await page.locator('[data-mobile-direct-tag="todo"]').tap();
    await page.evaluate(() => {
      const editor = document.querySelector('#notepad-editor');
      const range = document.createRange(); range.selectNodeContents(editor.firstElementChild); range.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.keyboard.insertText('X');
    await expect(page.locator('[data-line-id="target"]')).toContainText('Review Xsample item');
    await expect(page.locator('[data-line-id="first"]')).toHaveText('First sample line');
  });
  test('a normalized note refresh preserves the logical caret before direct tagging', async ({ page }) => {
    await seed(page, true);
    const original = await caret(page);
    await page.evaluate(() => {
      const editor = document.querySelector('#notepad-editor');
      const bookmark = uiState.savedSelectionBookmark;
      editor.innerHTML = getNoteDocumentHtml(getCurrentNote());
      uiState.savedSelection = null; uiState.savedSelectionBookmark = bookmark;
      restoreSavedEditorSelection(editor, { forceSavedRange: true });
    });
    expect(await caret(page)).toEqual(original);
    await page.keyboard.insertText('X');
    await expect(page.locator('[data-line-id="target"]')).toContainText('Review Xsample item');
  });
  test('a fresh editor touch after a tag overrides the short caret guard', async ({ page }) => {
    await seed(page);
    await page.locator('[data-mobile-direct-tag="todo"]').tap();
    const line = page.locator('[data-line-id="last"]');
    await line.tap({ position: { x: 35, y: 10 } });
    const position = await caret(page);
    expect(position.line).toBe('last');
    await page.keyboard.insertText('X');
    await expect(line).toContainText('X');
    await expect(page.locator('[data-line-id="target"]')).not.toContainText('X');
  });
  test('More and Undo/Redo remain reachable while the keyboard pans and closes', async ({ page }, info) => {
    await seed(page);
    await page.locator('[data-mobile-direct-tag="todo"]').tap();
    const undo = page.locator('.mobile-editor-toolbar [data-editor-undo]');
    const redo = page.locator('.mobile-editor-toolbar [data-editor-redo]');
    for (const [height, top] of [[keyboardTop, 0], [keyboardTop - 60, 48], [keyboardTop, 20]]) {
      await page.evaluate(({ height, top }) => {
        window.keyboardTop = height;
        Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, get: () => top });
        document.querySelector('#keyboard').style.top = `${height + top}px`;
        visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll'));
      }, { height, top });
      await expect.poll(() => page.locator('.mobile-editor-toolbar').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= visualViewport.offsetTop && rect.bottom <= visualViewport.offsetTop + visualViewport.height;
      })).toBe(true);
      await undo.tap();
      expect(await caret(page)).toEqual({ line: 'target', prefix: 'Review ' });
      await redo.tap();
      await page.keyboard.insertText('X');
      await expect(page.locator('[data-line-id="target"]')).toContainText('X');
      await undo.tap(); // undo the typing; keep the tag for the next iteration
    }
    await page.locator('[data-mobile-tag-toggle]').tap();
    await expect(page.locator('[data-mobile-tag="io"]')).toBeInViewport();
    await expect(page.locator('.mobile-tag-tray')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: info.outputPath('keyboard-menu.png'), scale: 'css' });
    await page.locator('[data-mobile-tag-toggle]').tap();
    await page.evaluate(() => {
      window.keyboardTop = innerHeight;
      Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, get: () => 0 });
      document.querySelector('#keyboard').remove();
      visualViewport.dispatchEvent(new Event('resize'));
    });
    await expect.poll(() => page.locator('.mobile-editor-toolbar').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    await undo.tap();
    await expect(page.locator('[data-line-id="target"] [data-tag="todo"]')).toHaveCount(0);
    await redo.tap();
    await expect(page.locator('[data-line-id="target"] [data-tag="todo"]')).toHaveCount(1);

  });
  test('toolbar tap after native focus selection settling uses the latest intentional caret', async ({ page }) => {
    await seed(page);
    await page.locator('[data-mobile-tag-toggle]').tap();
    await page.locator('[data-mobile-tag-toggle]').tap();
    // A native selection handle/trackpad can change the caret without a DOM pointerdown.
    await page.evaluate(() => {
      const line = document.querySelector('[data-line-id="last"]');
      const range = document.createRange(); range.setStart(line.firstChild, 5); range.collapse(true);
      getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await page.locator('[data-mobile-direct-tag="todo"]').tap();
    await page.keyboard.insertText('X');
    await expect(page.locator('[data-line-id="last"]')).toContainText('Last Xsample line');
  });
});
