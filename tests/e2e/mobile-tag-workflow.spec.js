const { test, expect, devices } = require('@playwright/test');

const ipad = {
  hasTouch: true, isMobile: false, screen: { width: 1366, height: 1024 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
};
for (const [name, profile, keyboardHeight] of [
  ['iPhone narrow', { ...devices['iPhone 15'], viewport: { width: 375, height: 812 } }, 382],
  ['iPhone wide', { ...devices['iPhone 15 Pro Max'] }, 508],
  ['iPad half', { ...ipad, viewport: { width: 683, height: 960 } }, 520],
  ['iPad quarter', { ...ipad, viewport: { width: 320, height: 960 } }, 520]
]) {
  test.describe(name, () => {
    const { defaultBrowserType, ...options } = profile;
    test.use({ ...options, serviceWorkers: 'block' });
    test('all six tags work with touch, keyboard transitions, typing, and reopening the note', async ({ page }, info) => {
      test.skip(info.project.name === 'iphone-webkit', 'Explicit device profiles run on both browser engines.');
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
      await page.addInitScript(({ ipad }) => {
        if (!sessionStorage.getItem('tag-workflow-started')) {
          localStorage.clear();
          sessionStorage.setItem('tag-workflow-started', '1');
        }
        if (ipad) {
          Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        }
        window.testKeyboardHeight = innerHeight;
        Object.defineProperty(visualViewport, 'height', { get: () => window.testKeyboardHeight });
      }, { ipad: name.startsWith('iPad') });
      await page.goto('/?e2e=1&workspace=shift');
      const editor = page.locator('#notepad-editor');
      const toggle = page.locator('[data-mobile-tag-toggle]');
      await expect(editor).toBeVisible();
      await editor.evaluate((el, height) => {
        el.addEventListener('focus', () => {
          setTimeout(() => {
            window.testKeyboardHeight = height;
            visualViewport.dispatchEvent(new Event('resize'));
            const keyboard = document.createElement('div');
            keyboard.id = 'test-keyboard';
            keyboard.textContent = 'Simulated on-screen keyboard';
            Object.assign(keyboard.style, { position: 'fixed', top: `${height}px`, bottom: '0', left: '0', right: '0', zIndex: '9999', background: '#d1d3d9', textAlign: 'center', paddingTop: '40px', color: '#242529', font: '14px system-ui' });
            document.body.append(keyboard);
          }, 180);
        }, { once: true });
      }, keyboardHeight);

      async function choose(tag) {
        await toggle.tap();
        // Allow the keyboard and all delayed viewport-settle timers to finish.
        await page.waitForTimeout(800);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const button = page.locator(`[data-mobile-tag="${tag}"]`);
        const rect = await button.boundingBox();
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.y + rect.height).toBeLessThanOrEqual(keyboardHeight);
        await button.tap();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(editor).toBeFocused();
      }
      async function softReturn() {
        // Native mobile keyboards can send beforeinput without a keydown.
        await editor.evaluate(el => {
          const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertParagraph' });
          if (el.dispatchEvent(event)) document.execCommand('insertParagraph');
        });
      }
      await choose('bed');
      await page.keyboard.insertText('12');
      await softReturn();
      await expect(editor.locator('[data-tag="bed"]')).toHaveText('Bed 12');
      await choose('hn');
      await page.keyboard.insertText('1234567');
      await softReturn();
      await expect(editor.locator('[data-tag="hn"]')).toHaveText('HN 1234567');
      for (const tag of ['time', 'lab']) {
        await choose(tag);
        await page.keyboard.insertText('09.30');
        await softReturn();
        await expect(editor.locator(`[data-tag="${tag}"]`)).toHaveCount(1);
        await expect(editor.locator(`[data-tag="${tag}"]`)).toHaveAttribute('data-editing', 'false');
        await page.keyboard.insertText(`${tag} sample`);
        await softReturn();
      }
      await choose('io');
      await page.keyboard.insertText('io sample');
      await softReturn();
      await choose('todo');
      await page.keyboard.insertText('todo sample');
      for (const tag of ['bed', 'hn', 'time', 'lab', 'io', 'todo']) {
        await expect(editor.locator(`[data-tag="${tag}"]`)).toHaveCount(1);
      }
      await expect(editor).toContainText('io sample');
      await expect(editor).toContainText('todo sample');
      await expect.poll(() => editor.evaluate(() => getCurrentEditorLine().getBoundingClientRect().bottom)).toBeLessThan(keyboardHeight - 12);
      await expect(page.locator('.mobile-tag-tray')).toHaveCSS('opacity', '0');
      await page.screenshot({ path: info.outputPath('all-tags-menu-closed.png'), scale: 'css' });
      await toggle.tap();
      await expect(page.locator('.mobile-tag-tray')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: info.outputPath('all-tags-with-keyboard.png'), scale: 'css' });
      await toggle.tap();
      await editor.evaluate(el => {
        el.blur();
        window.testKeyboardHeight = innerHeight;
        document.querySelector('#test-keyboard').remove();
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(800);
      await page.locator('#timeline-tab-btn').tap();
      await page.locator('#notes-tab-btn').tap();
      await expect(editor).toContainText('todo sample');
      await toggle.tap();
      await page.waitForTimeout(800);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await toggle.tap();
      await page.reload();
      for (const tag of ['bed', 'hn', 'time', 'lab', 'io', 'todo']) {
        await expect(editor.locator(`[data-tag="${tag}"]`)).toHaveCount(1);
      }
      expect(errors).toEqual([]);
    });
  });
}
