const { test, expect } = require('@playwright/test');
const { createPair, edit, refresh, checkpoint } = require('./helpers/two-device-sync');
let pair;
test.beforeEach(async ({ browser }, info) => {
  test.skip(info.project.name === 'iphone-webkit', 'The test creates both device contexts itself.');
  pair = await createPair(browser);
});
test.afterEach(async () => { if (pair) await pair.close(); pair = null; });

const saved = device => expect(device.page.locator('#sync-indicator-label')).toHaveText('Saved');

test('device switching uses server revisions even with a newer clock on the stale device', async () => {
  await edit(pair.iphone, 'a', 'New iPhone text');
  await saved(pair.iphone);
  await pair.ipad.page.evaluate(() => { getCurrentNote().updatedAt = Date.now() + 86400000; });
  await refresh(pair.ipad);
  await expect(pair.ipad.page.locator('#notepad-editor')).toContainText('New iPhone text');
  await pair.ipad.page.evaluate(() => handleRemoteNoteDocumentRecord({
    user_id: authState.user.id, workspace_key: 'shift', ward_id: 'shift-ward', note_id: 'shift-note',
    document_html: '<div>Delayed obsolete text</div>', revision: 1, note_updated_at: Date.now() + 172800000
  }));
  await expect(pair.ipad.page.locator('#notepad-editor')).toContainText('New iPhone text');
});

test('offline edits on different lines merge after reconnecting', async () => {
  await pair.ipad.context.setOffline(true);
  await edit(pair.ipad, 'b', 'Offline iPad addition');
  await checkpoint(pair.ipad);
  await edit(pair.iphone, 'a', 'Online iPhone addition');
  await saved(pair.iphone);
  await pair.ipad.context.setOffline(false);
  await expect.poll(() => pair.server.rows.get('shift-note').document_html).toContain('Offline iPad addition');
  expect(pair.server.rows.get('shift-note').document_html).toContain('Online iPhone addition');
  await refresh(pair.iphone);
  await expect(pair.iphone.page.locator('#notepad-editor')).toContainText('Offline iPad addition');
});

test('reopening after offline editing retains both devices changes', async () => {
  await pair.ipad.context.setOffline(true);
  await edit(pair.ipad, 'b', 'Offline work survives reopening');
  await checkpoint(pair.ipad);
  await edit(pair.iphone, 'a', 'Newer saved iPhone work');
  await saved(pair.iphone);
  // Reopen the saved local session against the newer cloud snapshot.
  await pair.ipad.page.close();
  await pair.ipad.context.setOffline(false);
  pair.ipad.page = await pair.ipad.context.newPage();
  await pair.ipad.page.goto('http://127.0.0.1:4173/?e2e=1&workspace=shift');
  await pair.reload(pair.ipad);
  await expect.poll(() => pair.server.rows.get('shift-note').document_html).toContain('Offline work survives reopening');
  expect(pair.server.rows.get('shift-note').document_html).toContain('Newer saved iPhone work');
});

test('same-line conflicts keep the server note and preserve offline work through another reload', async ({}, info) => {
  await pair.ipad.context.setOffline(true);
  await edit(pair.ipad, 'a', 'Offline conflicting iPad wording');
  await checkpoint(pair.ipad);
  await edit(pair.iphone, 'a', 'Saved iPhone wording');
  await saved(pair.iphone);
  await pair.ipad.context.setOffline(false);
  await expect(pair.ipad.page.locator('#notepad-editor')).toContainText('Saved iPhone wording');
  expect(await pair.ipad.page.evaluate(() => state.recoveryHistory.some(r => r.documentHtml.includes('Offline conflicting iPad wording')))).toBe(true);
  // The notice can appear during an in-place editor patch without a full render.
  await expect.poll(() => pair.ipad.page.evaluate(() =>
    document.querySelector('#notepad-editor').getBoundingClientRect().top >=
    document.querySelector('.top-control-stack').getBoundingClientRect().bottom
  )).toBe(true);
  await checkpoint(pair.ipad);
  await pair.reload(pair.ipad);
  expect(await pair.ipad.page.evaluate(() => state.recoveryHistory.some(r => r.documentHtml.includes('Offline conflicting iPad wording')))).toBe(true);
  expect(pair.server.rows.get('shift-note').document_html).toContain('Saved iPhone wording');
  await expect(pair.ipad.page.locator('#sync-recovery-notice')).toBeVisible();
  await saved(pair.ipad);
  for (const width of [683, 320, 393, 1280]) {
    await pair.ipad.page.setViewportSize({ width, height: 960 });
    await expect(pair.ipad.page.getByRole('button', { name: 'Review saved copy', exact: true })).toBeInViewport();
    await pair.ipad.page.screenshot({ path: info.outputPath(`conflict-preserved-${width}.png`), scale: 'css' });
  }
  await pair.ipad.page.setViewportSize({ width: 683, height: 960 });
  await pair.ipad.page.getByRole('button', { name: 'Review saved copy', exact: true }).click();
  await expect(pair.ipad.page.locator('.history-recovery-row').filter({ hasText: 'Offline conflicting iPad wording' })).toBeVisible();
  await expect(pair.ipad.page.locator('#sync-recovery-notice')).toBeHidden();
  await pair.ipad.page.evaluate(() => {
    const remote = cloneJson(appState);
    remote.workspaces.shift.recoveryHistory.forEach(entry => { entry.reviewed = false; });
    applyRemoteCloudState({ state_json: remote, updated_at: new Date().toISOString() }, { force: true });
  });
  await expect(pair.ipad.page.locator('#sync-recovery-notice')).toBeHidden();
});

test('a queued older event cannot roll back an acknowledged save', async () => {
  const oldRow = structuredClone(pair.server.rows.get('shift-note'));
  await edit(pair.iphone, 'a', 'Newest acknowledged text');
  await saved(pair.iphone);
  await pair.iphone.page.evaluate(row => {
    authState.pendingRemoteNoteDocuments.set('shift:shift-note', row);
    applyPendingNoteDocumentsIfReady();
  }, oldRow);
  await expect(pair.iphone.page.locator('#notepad-editor')).toContainText('Newest acknowledged text');
  expect(pair.server.rows.get('shift-note').document_html).toContain('Newest acknowledged text');
});

test('a delayed acknowledgement follows the note through metadata replacement and further typing', async () => {
  pair.server.holdAck = true;
  await edit(pair.iphone, 'a', 'First save is in flight');
  await expect.poll(() => pair.server.acknowledgements.length).toBe(1);
  await edit(pair.iphone, 'b', 'Typed before acknowledgement');
  await pair.iphone.page.evaluate(() => {
    applyRemoteCloudState({ state_json: cloneJson(appState), updated_at: new Date(Date.now() + 1000).toISOString() }, { force: true });
  });
  pair.server.holdAck = false;
  pair.server.acknowledgements.splice(0).forEach(resolve => resolve());
  await expect.poll(() => pair.server.rows.get('shift-note').document_html).toContain('Typed before acknowledgement');
  await saved(pair.iphone);
  await refresh(pair.ipad);
  await expect(pair.ipad.page.locator('#notepad-editor')).toContainText('Typed before acknowledgement');
  await expect(pair.ipad.page.locator('#notepad-editor')).toContainText('First save is in flight');
});

test('new notes made offline survive reopening against a cloud account without them', async () => {
  await pair.ipad.context.setOffline(true);
  await pair.ipad.page.evaluate(() => addWard());
  await pair.ipad.page.locator('#notepad-editor').fill('A new ward created offline');
  await checkpoint(pair.ipad);
  await pair.ipad.page.close();
  await pair.ipad.context.setOffline(false);
  pair.ipad.page = await pair.ipad.context.newPage();
  await pair.ipad.page.goto('http://127.0.0.1:4173/?e2e=1&workspace=shift');
  await pair.reload(pair.ipad);
  await expect.poll(() => [...pair.server.rows.values()].some(row => row.document_html.includes('A new ward created offline'))).toBe(true);
});

test('legacy offline edits without a stored merge base remain recoverable after reopening', async () => {
  await pair.ipad.context.setOffline(true);
  await edit(pair.ipad, 'a', 'Old-version offline edit');
  await pair.ipad.page.evaluate(() => { delete getCurrentNote().cloudBase; });
  await checkpoint(pair.ipad);
  await edit(pair.iphone, 'a', 'New saved server revision');
  await saved(pair.iphone);
  await pair.ipad.page.close();
  await pair.ipad.context.setOffline(false);
  pair.ipad.page = await pair.ipad.context.newPage();
  await pair.ipad.page.goto('http://127.0.0.1:4173/?e2e=1&workspace=shift');
  await pair.reload(pair.ipad);
  await expect.poll(() => pair.ipad.page.evaluate(() => state.recoveryHistory.some(r => r.documentHtml.includes('Old-version offline edit')))).toBe(true);
  expect(pair.server.rows.get('shift-note').document_html).toContain('New saved server revision');
  await expect(pair.ipad.page.locator('#sync-recovery-notice')).toBeVisible();
});

test('newer account metadata arriving before note realtime cannot be replaced by an old cache', async () => {
  await edit(pair.iphone, 'a', 'New revision received in metadata first');
  await saved(pair.iphone);
  await pair.iphone.page.evaluate(() => saveCloudStateNow());
  await expect.poll(() => pair.server.state.state_json.workspaces.shift.wards[0].notes[0].cloudRevision).toBe(2);
  await pair.ipad.page.evaluate(record => applyRemoteCloudState(record, { force: true }), structuredClone(pair.server.state));
  await expect(pair.ipad.page.locator('#notepad-editor')).toContainText('New revision received in metadata first');
});

test('simultaneous saves reject the stale revision and merge independent edits', async () => {
  pair.server.holdAck = true;
  await edit(pair.iphone, 'a', 'Concurrent iPhone edit');
  await expect.poll(() => pair.server.acknowledgements.length).toBe(1);
  await edit(pair.ipad, 'b', 'Concurrent iPad edit');
  await expect.poll(() => pair.server.conflicts).toBeGreaterThan(0);
  pair.server.holdAck = false;
  pair.server.acknowledgements.splice(0).forEach(resolve => resolve());
  await expect.poll(() => pair.server.rows.get('shift-note').document_html).toContain('Concurrent iPad edit');
  expect(pair.server.rows.get('shift-note').document_html).toContain('Concurrent iPhone edit');
  await refresh(pair.iphone);
  await expect(pair.iphone.page.locator('#notepad-editor')).toContainText('Concurrent iPad edit');
});

test('conflict recovery preserves complete long notes and intentional empty edits', async () => {
  const result = await pair.ipad.page.evaluate(() => {
    const html = '<div>' + 'x'.repeat(RECOVERY_SNAPSHOT_MAX_HTML + 50) + '</div>';
    addRecoverySnapshot({ note: getCurrentNote(), ward: getCurrentWard(), documentHtml: html, reason: 'Concurrent edit' });
    addRecoverySnapshot({ note: getCurrentNote(), ward: getCurrentWard(), documentHtml: '<div><br></div>', reason: 'Concurrent edit' });
    const restored = normalizeAppState(appState);
    return { longCopy: restored.workspaces.shift.recoveryHistory.some(r => r.documentHtml === html),
      emptyCopy: restored.workspaces.shift.recoveryHistory.some(r => r.documentHtml === '<div><br></div>') };
  });
  expect(result).toEqual({ longCopy: true, emptyCopy: true });
});
