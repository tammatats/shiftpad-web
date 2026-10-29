const { test, expect, devices } = require('@playwright/test');
for (const [name, profile] of [
  ['Desktop', devices['Desktop Chrome']],
  ['iPhone', devices['iPhone 15']],
  ['iPad half', { ...devices['iPad Pro 11'], viewport: { width: 683, height: 960 } }],
  ['iPad quarter', { ...devices['iPad Pro 11'], viewport: { width: 320, height: 960 } }]
]) {
  test.describe(name, () => {
    const { defaultBrowserType, ...options } = profile;
    test.use({ ...options, serviceWorkers: 'block' });
    test.beforeEach(async ({ page }, info) => {
      test.skip(info.project.name === 'iphone-webkit', 'Explicit profiles cover mobile WebKit.');
      await page.route('**/api/public-config.js', route => route.fulfill({contentType:'application/javascript',body:''}));
      await page.addInitScript(() => localStorage.clear());
      await page.goto('/?e2e=1&workspace=shift');
      await expect(page.locator('#notepad-editor')).toBeVisible();
    });
    async function seed(page) {
      await page.locator('#notepad-editor').evaluate(el => {
        el.innerHTML = [1, 2, 3].map(bed => `<div data-line-id="bed-${bed}"><span class="tag-token tag-bed" data-tag="bed" data-token-id="test-bed-${bed}" data-editing="false" contenteditable="false">Bed ${bed}</span></div>` +
          Array.from({length:20}, (_,i)=>`<div data-line-id="sample-${bed}-${i}">Navigation sample ${bed} line ${i}</div>`).join('')).join('');
        el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
      });
      await expect(page.locator('[data-current-bed] option')).toHaveCount(4);
    }
    test('bed navigation follows scrolling without changing editor selection', async ({page}, info) => {
      await seed(page);
      const before = await page.locator('#notepad-editor').evaluate(el => {
        el.focus({preventScroll:true});
        const range=document.createRange(); range.setStart(el.querySelector('[data-line-id="sample-1-0"]').firstChild,5); range.collapse(true);
        const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
        return {node:sel.anchorNode.textContent, offset:sel.anchorOffset};
      });
      await page.locator('[data-line-id="bed-2"]').evaluate(el => {
        const top=document.querySelector('.top-control-stack').getBoundingClientRect().bottom;
        scrollTo({top:scrollY+el.getBoundingClientRect().top-top-5,behavior:'instant'});
      });
      await expect(page.locator('[data-current-bed]')).toHaveValue('2');
      const after = await page.locator('#notepad-editor').evaluate(el => ({node:getSelection().anchorNode.textContent,offset:getSelection().anchorOffset,focused:document.activeElement===el}));
      expect(after).toEqual({...before,focused:true});
      await page.screenshot({path:info.outputPath('navigation-scrolled.png'),scale:'css'});
      await page.locator('[data-current-bed]').selectOption('3');
      await expect.poll(() => page.locator('[data-line-id="bed-3"]').evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeLessThan(650);
    });
    test('Find in ward defaults to the current ward and can expand to all wards', async ({page}) => {
      await page.evaluate(() => {
        const note=getCurrentNote(); setNoteDocumentHtml(note,'<div data-line-id="local">needle local result</div>');
        const other=JSON.parse(JSON.stringify(getCurrentWard())); other.id='other-ward';other.name='Other ward';
        other.notes=[createNote('Other note','')]; setNoteDocumentHtml(other.notes[0],'<div data-line-id="other">needle remote result</div>');
        state.wards.push(other); render();
      });
      await page.locator('[data-find-in-ward]').click();
      await expect(page.locator('[data-search-scope="ward"]')).toHaveAttribute('aria-pressed','true');
      await page.locator('[data-search-input]').fill('needle');
      await expect(page.locator('[data-search-result]')).toHaveCount(1);
      await expect(page.locator('[data-search-result]')).toContainText('local result');
      await page.locator('[data-search-scope="all"]').click();
      await expect(page.locator('[data-search-result]')).toHaveCount(2);
      await page.locator('[data-search-result]').filter({hasText:'remote result'}).click();
      await expect(page.locator('#notepad-editor')).toContainText('needle remote result');
    });
    test('typing in a scrolled note keeps the caret below the actual compact header', async ({page}) => {
      test.skip(name === 'Desktop', 'The desktop header is covered by the existing caret test.');
      await page.locator('#notepad-editor').evaluate(el => {
        el.innerHTML = Array.from({length:80}, (_,i) => `<div data-line-id="review-${i}">Review sample line ${i}</div>`).join('');
        el.dispatchEvent(new InputEvent('input', {bubbles:true,inputType:'insertText'}));
        el.focus({preventScroll:true});
        const text=el.querySelector('[data-line-id="review-60"]').firstChild;
        const range=document.createRange(); range.setStart(text,7); range.collapse(true);
        const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range);
        rememberEditorSelection(el,{force:true});
        // A user can scroll the insertion point beneath any of the fixed
        // header rows without moving the caret. The next input must reveal it.
        uiState.editorTapScroll=null;
        scrollTo({top:scrollY+text.parentElement.getBoundingClientRect().top-100,behavior:'instant'});
      });
      await page.keyboard.insertText('X');
      await expect(page.locator('[data-line-id="review-60"]')).toHaveText('Review Xsample line 60');
      await expect.poll(() => page.evaluate(() => getCaretRect().top - document.querySelector('.top-control-stack').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
    });
    test('compact controls remain reachable and the workspace switch is explicit', async ({page}, info) => {
      await seed(page);
      await expect(page.locator('[data-sort-beds]')).toBeVisible();
      await expect(page.locator('[data-find-in-ward]')).toBeVisible();
      const geometry = await page.evaluate(() => {
        const stack=document.querySelector('.top-control-stack').getBoundingClientRect();
        return { bottom:stack.bottom,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,label:getComputedStyle(document.querySelector('#workspace-switcher'),'::after').content};
      });
      expect(geometry.scrollWidth).toBe(geometry.width);
      expect((await page.locator('[data-current-bed]').boundingBox()).height).toBeGreaterThanOrEqual(36);
      if(name!=='Desktop') expect(geometry.bottom).toBeLessThan(205);
      expect(geometry.label).toContain('To DayPad');
      await page.screenshot({path:info.outputPath('navigation-controls.png'),scale:'css'});
      await page.locator('[data-choose-ward]').click();
      await expect(page.locator('.drawer-layer-right.is-open')).toBeVisible();
      await page.locator('.drawer-layer-right [data-drawer-close]').last().click();
      await page.locator('#workspace-switcher').click();
      await expect(page.locator('#workspace-title')).toHaveText('DayPad');
      await expect(page.locator('#workspace-switcher')).toHaveAttribute('data-switch-label', 'To ShiftPad');
      await expect(page.locator('[data-find-in-ward]')).toBeVisible();
    });
  });
}
