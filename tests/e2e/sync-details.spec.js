const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });
async function prepare(page) {
  await page.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/?e2e=1&workspace=shift');
  await expect(page.locator('#notepad-editor')).toBeVisible();
  await page.evaluate(() => {
    for (const [workspaceKey, workspace] of Object.entries(appState.workspaces)) {
      for (const ward of workspace.wards) for (const note of ward.notes) {
        note.cloudPending = false;
        note.cloudRevision = 1;
        authState.noteDocuments.set(getNoteDocumentKey(workspaceKey, note.id), {
          workspace_key: workspaceKey, ward_id: ward.id, note_id: note.id,
          revision: 1, document_html: getNoteDocumentHtml(note)
        });
      }
    }
    renderAuthUi();
  });
}
async function seedConflict(page) {
  await page.evaluate(() => {
    const note = getCurrentNote();
    const ward = getCurrentWard();
    setNoteDocumentHtml(note, '<div data-line-id="sample-line">Current sample from another device</div>');
    patchCurrentNoteEditorFromModel({ workspaceKey: getActiveWorkspaceKey(), ward, note }, { source: 'test' });
    note.cloudRevision = 7;
    note.cloudPending = false;
    state.recoveryHistory.unshift({ id: 'sample-conflict', noteId: note.id, wardId: ward.id, wardName: 'Sample ward', createdAt: Date.now(), reason: 'Concurrent edit', documentHtml: '<div>Preserved sample from this device</div><div>&lt;img src=x onerror=alert(1)&gt;</div>' });
    render();
  });
}

test('sync details opens by keyboard and distinguishes local state from confirmed cloud saves', async ({ page }) => {
  await prepare(page);
  const trigger = page.locator('#sync-indicator');
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Sync details' })).toBeVisible();
  await expect(page.locator('[data-sync-confirmed]')).toHaveText('Not confirmed in this session');
  await expect(page.locator('[data-sync-pending-notes]')).toHaveText('0');
  await expect(page.locator('[data-sync-retry]')).toBeDisabled();
  await page.getByRole('button', { name: 'Close sync details' }).click();
  await expect(trigger).toBeFocused();
});

test('pending note, reminder and settings counts remain separate and update while open', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    authState.configured = true;
    authState.client = {};
    authState.lastCloudSavedAt = Date.now() - 60_000;
    authState.lastRemoteAppliedAt = Date.now() - 90_000;
    authState.reminderIndexPending = true;
    authState.stateCloudPending = true;
    getCurrentNote().cloudPending = true;
    getCurrentNote().cloudRevision = 4;
    authState.noteDocuments.set(getNoteDocumentKey(getActiveWorkspaceKey(), getCurrentNote().id), { client_id: 'another-device' });
    renderAuthUi();
  });
  await page.locator('#sync-indicator').click();
  await expect(page.locator('[data-sync-pending-notes]')).toHaveText('1');
  await expect(page.locator('[data-sync-pending-reminders]')).toHaveText('Waiting to sync');
  await expect(page.locator('[data-sync-pending-settings]')).toHaveText('Waiting to sync');
  await expect(page.locator('[data-sync-revision]')).toHaveText('4');
  await expect(page.locator('[data-sync-confirmed]')).not.toHaveText('Not confirmed in this session');
  await expect(page.locator('[data-sync-other-device]')).toBeVisible();
  await page.evaluate(() => {
    authState.reminderIndexPending = false;
    authState.stateCloudPending = false;
    renderAuthUi();
  });
  await expect(page.locator('[data-sync-pending-notes]')).toHaveText('1');
  await expect(page.locator('[data-sync-pending-reminders]')).toHaveText('No pending changes');
  await page.context().setOffline(true);
  await expect(page.locator('[data-sync-connection]')).toHaveText('Offline');
  await expect(page.locator('[data-sync-retry]')).toBeDisabled();
});

test('retry queues pending note writes and counts clear only after acknowledgement', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    authState.configured = true;
    const note = getCurrentNote();
    note.cloudRevision = 1;
    note.cloudPending = true;
    note.documentHtml = '<div data-line-id="retry-sample">Sample queued edit</div>';
    patchCurrentNoteEditorFromModel({ workspaceKey: getActiveWorkspaceKey(), ward: getCurrentWard(), note }, { source: 'test' });
    window.retryRequested = 0;
    window.retryPayload = null;
    // Keep the normal note commit path; the fake server acknowledgement is
    // controlled separately so a button press cannot falsely clear the badge.
    authState.client = {
      rpc(name, payload) {
        window.retryRequested += 1;
        window.retryPayload = payload;
        return new Promise(resolve => { window.confirmRetrySave = () => resolve({ data: [{ status: 'saved', user_id: authState.user.id, workspace_key: payload.p_workspace_key, ward_id: payload.p_ward_id, note_id: payload.p_note_id, document_html: payload.p_document_html, note_updated_at: payload.p_note_updated_at, revision: 2, client_id: payload.p_client_id, updated_at: new Date().toISOString() }], error: null }); });
      },
      from() { return { upsert: async () => ({ error: null }) }; }
    };
    window.fetchLatestCloudState = async () => {};
    renderAuthUi();
  });
  await page.locator('#sync-indicator').click();
  await page.locator('[data-sync-retry]').click();
  await expect.poll(() => page.evaluate(() => window.retryRequested)).toBe(1);
  await expect(page.locator('[data-sync-pending-notes]')).toHaveText('1');
  await page.evaluate(() => window.confirmRetrySave());
  await expect(page.locator('[data-sync-pending-notes]')).toHaveText('0');
  await expect(page.locator('[data-sync-confirmed]')).not.toHaveText('Not confirmed in this session');
});

for (const [name, width] of [['iPhone', 375], ['iPad half', 683], ['iPad quarter', 320]]) {
  test(`${name}: conflict comparison exposes task and I/O completion differences`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await prepare(page);
    await page.evaluate(() => {
      const note=getCurrentNote(); const ward=getCurrentWard();
      const html=(done,done14,done22) => `<div data-line-id="completion-todo"><span class="tag-token tag-todo" data-tag="todo" data-token-id="completion-todo" data-done="${done}" contenteditable="false"></span> Sample task</div><div data-line-id="completion-io"><span class="tag-token tag-io" data-tag="io" data-token-id="completion-io" data-created-at="${Date.now()}" data-done-14="${done14}" data-done-22="${done22}" contenteditable="false">I/O</span> Sample I/O</div>`;
      setNoteDocumentHtml(note,html(true,true,false)); note.cloudPending=false;
      state.recoveryHistory.unshift({id:'completion-conflict',noteId:note.id,wardId:ward.id,wardName:'Sample ward',createdAt:Date.now(),reason:'Concurrent edit',documentHtml:html(false,false,true)});
      render();
    });
    await page.locator('#sync-recovery-notice button').click();
    const local=page.locator('[data-sync-local-copy]');
    const current=page.locator('[data-sync-current-copy]');
    await expect(local).toContainText('[ ]');
    await expect(current).toContainText('[x]');
    await expect(local).toContainText('14: pending');
    await expect(local).toContainText('22: done');
    await expect(current).toContainText('14: done');
    await expect(current).toContainText('22: pending');
    expect(await local.textContent()).not.toBe(await current.textContent());
  });
  test(`${name}: conflicting versions are readable and review never changes the note`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page);
    await seedConflict(page);
    await page.locator('#sync-recovery-notice button').click();
    const dialog = page.getByRole('dialog', { name: 'Sync details' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-sync-local-copy]')).toContainText('Preserved sample from this device');
    await expect(page.locator('[data-sync-current-copy]')).toContainText('Current sample from another device');
    await expect(page.locator('[data-sync-local-copy] img')).toHaveCount(0);
    expect(await page.locator('[data-sync-local-copy]').textContent()).toContain('<img src=x onerror=alert(1)>');
    const before = await page.evaluate(() => getCurrentNote().documentHtml);
    await page.screenshot({ path: info.outputPath(`sync-comparison-${width}.png`), scale: 'css' });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator('[data-review-conflict]').click();
    expect(await page.evaluate(() => getCurrentNote().documentHtml)).toBe(before);
    expect(await page.evaluate(() => getCurrentNote().cloudPending)).toBe(false);
    await expect(page.locator('#sync-recovery-notice')).toBeHidden();
    await expect(page.locator('[data-sync-local-copy]')).toContainText('Preserved sample from this device');
    await page.getByRole('button', { name: 'Open History', exact: true }).click();
    await expect(page.locator('.history-recovery-row')).toBeVisible();
    expect(await page.evaluate(() => getCurrentNote().documentHtml)).toBe(before);
  });
}
