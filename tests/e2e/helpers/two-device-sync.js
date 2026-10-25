const { devices, expect } = require('@playwright/test');
const clone = value => JSON.parse(JSON.stringify(value));
const baseHtml = '<div data-line-id="line-a">Sample first line</div><div data-line-id="line-b">Sample second line</div>';

async function createPair(browser) {
  const seed = { version: 4, activeWorkspace: 'shift', workspaces: {} };
  const rows = new Map();
  for (const workspace of ['shift', 'day']) {
    const note = { id: `${workspace}-note`, createdAt: 1, updatedAt: 1, cloudRevision: 1, cloudPending: false,
      documentHtml: workspace === 'shift' ? baseHtml : '<div data-line-id="day-line"><br></div>' };
    seed.workspaces[workspace] = { selectedWardId: `${workspace}-ward`, selectedNoteId: note.id,
      wards: [{ id: `${workspace}-ward`, name: 'Sample ward', notes: [note] }] };
    rows.set(note.id, { user_id: 'local-e2e-user', workspace_key: workspace, ward_id: `${workspace}-ward`,
      note_id: note.id, document_html: note.documentHtml, note_updated_at: 1, revision: 1,
      client_id: 'seed', updated_at: '2026-10-25T00:00:00.000Z' });
  }
  const server = { rows, state: { state_json: seed, updated_at: '2026-10-25T00:00:00.000Z' }, commits: [], conflicts: 0,
    holdAck: false, acknowledgements: [] };
  async function request({ table, operation, payload, filters = {} }) {
    if (operation === 'rpc') {
      const current = rows.get(payload.p_note_id);
      if (current && current.revision !== payload.p_expected_revision) {
        server.conflicts++;
        return { data: { ...clone(current), status: 'conflict' }, error: null };
      }
      const row = { user_id: 'local-e2e-user', workspace_key: payload.p_workspace_key, ward_id: payload.p_ward_id,
        note_id: payload.p_note_id, document_html: payload.p_document_html, note_updated_at: payload.p_note_updated_at,
        revision: (current?.revision || 0) + 1, client_id: payload.p_client_id, updated_at: new Date().toISOString() };
      rows.set(row.note_id, row);
      server.commits.push(clone(row));
      if (server.holdAck) await new Promise(resolve => server.acknowledgements.push(resolve));
      return { data: { ...clone(row), status: 'saved' }, error: null };
    }
    if (table === 'shiftpad_user_state') {
      if (operation === 'update' || operation === 'insert') {
        if (filters.updated_at && filters.updated_at !== server.state.updated_at) return { data: null, error: null };
        server.state = clone(payload);
      }
      return { data: clone(server.state), error: null };
    }
    if (table === 'shiftpad_note_documents') return { data: clone([...rows.values()]), error: null };
    return { data: [], error: null };
  }
  const contexts = [];
  async function createDevice(ipad) {
    const context = await browser.newContext({ ...(ipad ? devices['iPad Pro 11'] : devices['iPhone 15']),
      viewport: ipad ? { width: 683, height: 960 } : { width: 393, height: 852 }, serviceWorkers: 'block' });
    contexts.push(context);
    await context.exposeBinding('__syncRequest', (_, input) => request(input));
    await context.route('**/api/public-config.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await context.addInitScript(() => localStorage.setItem('shiftpad-editor-debug-v1:enabled', 'false'));
    const page = await context.newPage();
    const device = { page, context };
    await page.goto('http://127.0.0.1:4173/?e2e=1&workspace=shift');
    await page.evaluate(seed => {
      appState = normalizeAppState(seed); state = getActiveWorkspaceState(appState); saveLocalState(); render();
    }, seed);
    await connect(device);
    return device;
  }
  async function connect({ page }) {
    await expect(page.locator('#notepad-editor')).toBeVisible();
    await page.evaluate(async () => {
      const channel = { on() { return this; }, subscribe(cb) { cb('SUBSCRIBED'); return this; } };
      authState.configured = true;
      authState.client = {
        realtime: { setAuth() {} }, channel: () => channel, removeChannel() {},
        rpc: (_, payload) => window.__syncRequest({ operation: 'rpc', payload }),
        from(table) {
          const query = {
            filters: {}, operation: 'read',
            select() { return this; }, eq(key, value) { this.filters[key] = value; return this; },
            in() { return this; }, order() { return this; }, limit() { return this; },
            update(payload) { this.operation = 'update'; this.payload = payload; return this; },
            insert(payload) { this.operation = 'insert'; this.payload = payload; return this; },
            upsert(payload) { this.operation = 'upsert'; this.payload = payload; return this; },
            async execute() {
              if (!navigator.onLine) return { data: null, error: { message: 'Test device offline' } };
              return window.__syncRequest({ table, operation: this.operation, payload: this.payload, filters: this.filters });
            },
            maybeSingle() { return this.execute(); },
            then(resolve, reject) { return this.execute().then(resolve, reject); }
          };
          return query;
        }
      };
      await hydrateStateFromCloud();
      startCloudLiveSync();
    });
  }
  const iphone = await createDevice(false);
  const ipad = await createDevice(true);
  return { server, iphone, ipad,
    async reload(device) { await device.page.reload(); await connect(device); },
    async close() { server.acknowledgements.splice(0).forEach(resolve => resolve()); await Promise.all(contexts.map(c => c.close())); }
  };
}

async function edit(device, line, text) {
  await device.page.locator(`#notepad-editor [data-line-id="line-${line}"]`).evaluate((el, text) => {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  }, text);
}
async function refresh(device) {
  await device.page.evaluate(() => fetchLatestCloudState({ reason: 'device-switch-test', force: true }));
}
async function checkpoint(device) {
  await device.page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
}
module.exports = { createPair, edit, refresh, checkpoint, baseHtml };
