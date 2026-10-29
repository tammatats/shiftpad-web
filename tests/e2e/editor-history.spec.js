const { test, expect } = require('@playwright/test');
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?e2e=1&workspace=shift');
  await expect(page.locator('#notepad-editor')).toBeVisible();
});
const undo = page => page.locator('[data-editor-undo]:visible').first();
const redo = page => page.locator('[data-editor-redo]:visible').first();
async function activate(page, button) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await button.tap();
  else await button.click();
}
async function seed(page, html) {
  await page.locator('#notepad-editor').evaluate((el, html) => {
    el.innerHTML = html;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    invalidateEditorHistoryForNote(getActiveWorkspaceKey(), getCurrentNote().id);
    el.focus();
    const range = document.createRange(); range.selectNodeContents(el.lastElementChild); range.collapse(false);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    rememberEditorSelection(el, { force: true });
  }, html);
}
async function chooseTag(page, tag) {
  const direct = page.locator(`[data-quick-tag="${tag}"]:visible, [data-mobile-tag="${tag}"]:visible`).first();
  if (!await direct.count()) await page.locator('[data-mobile-tag-toggle]').click();
  await page.locator(`[data-quick-tag="${tag}"]:visible, [data-mobile-tag="${tag}"]:visible`).first().click();
}

test('typing undo/redo restores the caret and a new edit clears redo', async ({ page }, info) => {
  const editor = page.locator('#notepad-editor');
  await editor.click();
  await page.keyboard.insertText('hello');
  await page.keyboard.insertText(' world');
  await expect(undo(page)).toBeEnabled();
  await activate(page, undo(page));
  await expect(editor).toHaveText('');
  await activate(page, redo(page));
  await expect(editor).toContainText('hello world');
  await expect(editor).toBeFocused();
  await page.keyboard.insertText('!');
  await expect(editor).toContainText('hello world!');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor).toContainText('hello world');
  await page.keyboard.insertText('?');
  await expect(redo(page)).toBeDisabled();
  await expect(editor).toContainText('hello world?');
  await page.screenshot({ path: info.outputPath('undo-controls.png'), scale: 'css' });
});

test('tag insertion is one undo action and redo restores editable content', async ({ page }) => {
  await seed(page, '<div data-line-id="line-a">Review sample</div>');
  await chooseTag(page, 'io');
  const editor = page.locator('#notepad-editor');
  await expect(editor.locator('[data-tag="io"]')).toHaveCount(1);
  await activate(page, undo(page));
  await expect(editor.locator('[data-tag="io"]')).toHaveCount(0);
  await expect(editor).toHaveText('Review sample');
  await activate(page, redo(page));
  await expect(editor.locator('[data-tag="io"]')).toHaveCount(1);
  await page.keyboard.insertText('X');
  await expect(editor).toContainText('I/O X');
});

test('sorting whole bed sections can be undone and redone', async ({ page }) => {
  await seed(page, [19, 2].map(n => `<div><span class="tag-token tag-bed" data-tag="bed" data-token-id="bed-${n}" data-editing="false" contenteditable="false">Bed ${n}</span></div><div>Sample ${n}</div>`).join(''));
  await page.locator('[data-sort-beds]').click();
  const beds = page.locator('#notepad-editor [data-tag="bed"]');
  await expect(beds).toHaveText(['Bed 2', 'Bed 19']);
  await activate(page, undo(page));
  await expect(beds).toHaveText(['Bed 19', 'Bed 2']);
  await activate(page, redo(page));
  await expect(beds).toHaveText(['Bed 2', 'Bed 19']);
});

test('moving a bed undoes both wards atomically and keeps current cloud revisions', async ({ page }) => {
  await seed(page, '<div><span class="tag-token tag-bed" data-tag="bed" data-token-id="bed-2" data-editing="false" contenteditable="false">Bed 2</span></div><div>Sample notes</div>');
  await page.evaluate(() => {
    const target = createWard('Destination', '#eee');
    const note = createNote('Destination note', ''); note.cloudRevision = 12;
    target.notes.push(note); state.wards.push(target);
    getCurrentNote().cloudRevision = 8;
    openBedActionSheet(document.querySelector('[data-token-id="bed-2"]'));
    moveBedSectionToWard(target.id);
  });
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveCount(0);
  await activate(page, undo(page));
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveText('Bed 2');
  expect(await page.evaluate(() => ({ destination: state.wards.find(w => w.name === 'Destination').notes[0].documentHtml.includes('Bed 2'), sourceRevision: getCurrentNote().cloudRevision, targetRevision: state.wards.find(w => w.name === 'Destination').notes[0].cloudRevision }))).toEqual({ destination: false, sourceRevision: 8, targetRevision: 12 });
  await activate(page, redo(page));
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveCount(0);
  expect(await page.evaluate(() => state.wards.find(w => w.name === 'Destination').notes[0].documentHtml.includes('Bed 2'))).toBe(true);
});

test('a new remote revision invalidates local undo instead of overwriting it', async ({ page }) => {
  await seed(page, '<div data-line-id="line-a">Original</div>');
  await page.keyboard.insertText(' local');
  await expect(undo(page)).toBeEnabled();
  await page.evaluate(() => {
    const location = findNoteLocationByReference(getCurrentNote());
    applyCloudNoteDocumentToLocation({ workspace_key: location.workspaceKey, note_id: location.note.id, document_html: '<div data-line-id="line-a">Newer device version</div>', revision: 99, note_updated_at: Date.now() }, location);
    patchCurrentNoteEditorFromModel(location, { source: 'e2e-remote' });
  });
  await expect(undo(page)).toBeDisabled();
  await page.locator('#notepad-editor').evaluate(el => el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'historyUndo' })));
  await expect(page.locator('#notepad-editor')).toHaveText('Newer device version');
  expect(await page.evaluate(() => getCurrentNote().cloudRevision)).toBe(99);
});

test('bed rename and deletion each have an immediate undo action', async ({ page }) => {
  await seed(page, '<div><span class="tag-token tag-bed" data-tag="bed" data-token-id="bed-2" data-editing="false" contenteditable="false">Bed 2</span></div><div>Keep this sample section</div>');
  await page.evaluate(() => {
    openBedActionSheet(document.querySelector('[data-token-id="bed-2"]'));
    renameSelectedBed('4');
  });
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveText('Bed 4');
  await activate(page, undo(page));
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveText('Bed 2');
  await activate(page, redo(page));
  await page.evaluate(() => {
    openBedActionSheet(document.querySelector('[data-token-id="bed-2"]'));
    deleteSelectedBedSection();
  });
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveCount(0);
  await expect(undo(page)).toHaveAttribute('aria-label', 'Undo: Delete bed');
  await activate(page, undo(page));
  await expect(page.locator('#notepad-editor [data-tag="bed"]')).toHaveText('Bed 4');
  await expect(page.locator('#notepad-editor')).toContainText('Keep this sample section');
});

test('acknowledging this device save and refreshing unchanged data preserve Undo', async ({ page }) => {
  await seed(page, '<div data-line-id="line-a">Original</div>');
  await page.keyboard.insertText(' local');
  await expect(undo(page)).toBeEnabled();
  await page.evaluate(() => {
    const location = findNoteLocationByReference(getCurrentNote());
    const row = { workspace_key: location.workspaceKey, note_id: location.note.id, document_html: location.note.documentHtml, revision: 2, client_id: authState.noteDocumentClientId, note_updated_at: location.note.updatedAt };
    applyCloudNoteDocumentToLocation(row, location);
    applyCloudNoteDocumentToLocation(row, location);
  });
  await expect(undo(page)).toBeEnabled();
  await activate(page, undo(page));
  await expect(page.locator('#notepad-editor')).toHaveText('Original');
  expect(await page.evaluate(() => getCurrentNote().cloudRevision)).toBe(2);
});

test('toolbar swipes, cancelled touches and secondary fingers cannot trigger Undo', async ({ page }) => {
  await seed(page, '<div data-line-id="line-a">Original</div>');
  await page.keyboard.insertText(' edited');
  await expect(undo(page)).toBeEnabled();
  await undo(page).evaluate(button => {
    const touch = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
    function send(type, touches, changedTouches) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } });
      button.dispatchEvent(event);
    }
    const first = touch(1, 20, 20);
    const moved = touch(1, 50, 20);
    send('touchstart', [first], [first]);
    send('touchmove', [moved], [moved]);
    send('touchend', [], [moved]);
    send('touchstart', [first], [first]);
    send('touchcancel', [], [first]);
    send('touchend', [], [first]);
    const second = touch(2, 30, 30);
    send('touchstart', [first], [first]);
    send('touchstart', [first, second], [second]);
    send('touchend', [first], [second]);
    send('touchend', [], [first]);
  });
  await expect(page.locator('#notepad-editor')).toHaveText('Original edited');
  // The guards must not consume the next ordinary tap/click.
  await activate(page, undo(page));
  await expect(page.locator('#notepad-editor')).toHaveText('Original');
});
