const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'allow' });
test('a normal signed-in app reopens offline with the bundled SDK and safely syncs edits on reconnect', async ({ page, context, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Playwright WebKit offline service-worker navigation reports an internal error; physical Safari/PWA verification remains required.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const userId = '00000000-0000-4000-8000-000000000017';
  const apiOrigin = 'https://offline-bootstrap.supabase.test';
  let online = true;
  const seed = { version: 4, activeWorkspace: 'shift', workspaces: {} };
  const rows = new Map();
  for (const workspace of ['shift', 'day']) {
    const html = workspace === 'shift' ? '<div data-line-id="offline-a">Saved sample note</div><div data-line-id="offline-b">Untouched sample line</div>' : '<div data-line-id="offline-day"><br></div>';
    const note = { id: `${workspace}-note`, createdAt: 1, updatedAt: 1, cloudRevision: 1, cloudPending: false, documentHtml: html };
    seed.workspaces[workspace] = { selectedWardId: `${workspace}-ward`, selectedNoteId: note.id, wards: [{ id: `${workspace}-ward`, name: 'Sample ward', notes: [note] }] };
    rows.set(note.id, { user_id: userId, workspace_key: workspace, ward_id: `${workspace}-ward`, note_id: note.id, document_html: html, note_updated_at: 1, revision: 1, client_id: 'sample-server', updated_at: '2026-10-28T00:00:00.000Z' });
  }
  let cloudState = { state_json: seed, updated_at: '2026-10-28T00:00:00.000Z' };
  const commits = [];
  // BrowserContext routing also catches the worker's first-install public
  // config fetch; page-only routing would miss that request.
  await context.route('**/api/public-config.js', route => online ? route.fulfill({
    contentType: 'application/javascript', body: `window.SHIFTPAD_PUBLIC_CONFIG = ${JSON.stringify({ supabaseUrl: apiOrigin, supabaseAnonKey: 'sample-public-anon-key' })};`
  }) : route.abort('internetdisconnected'));
  await context.route(`${apiOrigin}/**`, async route => {
    if (!online) return route.abort('internetdisconnected');
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    const json = data => route.fulfill({ status: 200, headers, body: JSON.stringify(data) });
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/auth/v1/user') return json({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'offline-sample@local.test', app_metadata: {}, user_metadata: {} });
    if (url.pathname.endsWith('/rpc/shiftpad_commit_note_document')) {
      const payload = request.postDataJSON();
      const previous = rows.get(payload.p_note_id);
      if (previous && previous.revision !== payload.p_expected_revision) return json([{ ...previous, status: 'conflict' }]);
      const row = { user_id: userId, workspace_key: payload.p_workspace_key, ward_id: payload.p_ward_id, note_id: payload.p_note_id, document_html: payload.p_document_html, note_updated_at: payload.p_note_updated_at, revision: (previous?.revision || 0) + 1, client_id: payload.p_client_id, updated_at: new Date().toISOString() };
      rows.set(row.note_id, row); commits.push(row);
      return json([{ ...row, status: 'saved' }]);
    }
    if (url.pathname.endsWith('/shiftpad_user_state')) {
      if (request.method() !== 'GET') cloudState = request.postDataJSON();
      return json(cloudState);
    }
    if (url.pathname.endsWith('/shiftpad_note_documents')) return json([...rows.values()]);
    return json([]);
  });
  await context.addInitScript(({ userId, seed }) => {
    // Chromium may reset navigator.onLine to true after an offline navigation
    // served by a service worker. Keep airplane-mode reporting consistent with
    // the real failed network configured below; authentication remains the SDK's.
    Object.defineProperty(navigator, 'onLine', { get: () => sessionStorage.getItem('offline-auth-network') !== 'offline' });
    if (sessionStorage.getItem('offline-auth-seeded')) return;
    sessionStorage.setItem('offline-auth-seeded', '1');
    localStorage.clear();
    localStorage.setItem('shiftpad-editor-debug-v1:enabled', 'false');
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    localStorage.setItem('sb-offline-bootstrap-auth-token', JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp, aud: 'authenticated', role: 'authenticated' })}.sample-signature`,
      refresh_token: 'sample-refresh-token', expires_in: 86400, expires_at: exp, token_type: 'bearer',
      user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'offline-sample@local.test', app_metadata: {}, user_metadata: {}, created_at: '2026-10-28T00:00:00Z' }
    }));
    localStorage.setItem(`shiftpad-ios-state-v2:${userId}`, JSON.stringify(seed));
  }, { userId, seed });
  await page.goto('/?workspace=shift');
  const editor = page.locator('#notepad-editor');
  await expect(editor).toContainText('Saved sample note');
  expect(await page.evaluate(() => ({ e2e: IS_LOCAL_E2E, realSdk: Boolean(window.supabase?.createClient), user: authState.user?.id }))).toEqual({ e2e: false, realSdk: true, user: userId });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(() => page.evaluate(async () => Boolean(await caches.match('/api/public-config.js')))).toBe(true);
  await page.evaluate(() => flushLocalStateSave());
  online = false;
  await page.evaluate(() => sessionStorage.setItem('offline-auth-network', 'offline'));
  await context.setOffline(true);
  await page.reload();
  await expect(editor).toContainText('Saved sample note');
  await expect(page.locator('#auth-gate')).toBeHidden();
  expect(await page.evaluate(() => authState.user?.id)).toBe(userId);
  const sdkAsset = await page.evaluate(async () => fetch('/lib/vendor/supabase-js-2.118.0.js?offline-proof=1').then(response => response.text()));
  expect(sdkAsset).toContain('createClient');
  await editor.locator('[data-line-id="offline-a"]').evaluate(line => {
    line.textContent = 'Offline sample edit after reopening';
    line.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  });
  await page.evaluate(() => flushLocalStateSave());
  await expect(page.locator('#sync-indicator-label')).toHaveText(/\d+ unsaved/);
  expect(await page.evaluate(() => getCurrentNote().cloudPending)).toBe(true);
  expect(await page.evaluate(() => window.ShiftPadSyncCore.getPendingNoteCount(appState))).toBe(1);
  expect(commits).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('authenticated-offline-edit.png'), scale: 'css' });
  await page.reload();
  await expect(editor).toContainText('Offline sample edit after reopening');
  await expect(editor).toContainText('Untouched sample line');
  expect(await page.evaluate(() => getCurrentNote().cloudPending)).toBe(true);
  expect(await page.evaluate(() => window.ShiftPadSyncCore.getPendingNoteCount(appState))).toBe(1);
  // A second device independently changes another line while this one is offline.
  const remote = rows.get('shift-note');
  rows.set('shift-note', { ...remote, revision: remote.revision + 1, document_html: remote.document_html.replace('Untouched sample line', 'Newer sample from the other device'), updated_at: new Date().toISOString() });
  online = true;
  await page.evaluate(() => sessionStorage.removeItem('offline-auth-network'));
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => rows.get('shift-note').document_html).toContain('Offline sample edit after reopening');
  expect(rows.get('shift-note').document_html).toContain('Newer sample from the other device');
  await expect(editor).toContainText('Newer sample from the other device');
  await expect.poll(() => page.evaluate(() => Boolean(getCurrentNote().cloudPending))).toBe(false);
  expect(await page.evaluate(() => getCurrentNote().cloudRevision)).toBeGreaterThan(1);
  // A local copy alone must never synthesize an authenticated user after signout.
  await page.evaluate(() => authState.client.auth.signOut({ scope: 'local' }));
  await expect(page.locator('#auth-gate')).toBeVisible();
  online = false;
  await page.evaluate(() => sessionStorage.setItem('offline-auth-network', 'offline'));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#auth-gate')).toBeVisible();
  expect(await page.evaluate(() => authState.user)).toBeNull();
  expect(errors).toEqual([]);
});
