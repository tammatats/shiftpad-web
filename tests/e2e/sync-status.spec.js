const { test, expect } = require("@playwright/test");

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/public-config.js", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("shiftpad-editor-debug-v1:enabled", "false");
  });
  await page.goto("/?e2e=1&workspace=shift");
  await expect(page.locator("#notepad-editor")).toBeVisible();
  await page.evaluate(() => {
    window.syncServer = { reminders: [], notes: [], failReminders: false, failNotes: false };
    authState.configured = true;
    authState.lastCloudUpdatedAtValue = "2026-10-25T00:00:00Z";
    for (const [workspaceKey, workspace] of Object.entries(appState.workspaces)) {
      for (const ward of workspace.wards) {
        for (const note of ward.notes) {
          note.cloudPending = false;
          note.cloudRevision = 1;
          authState.noteDocuments.set(getNoteDocumentKey(workspaceKey, note.id), {
            workspace_key: workspaceKey, ward_id: ward.id, note_id: note.id,
            revision: 1, document_html: getNoteDocumentHtml(note)
          });
        }
      }
    }
    const channel = {
      on() { return this; },
      subscribe(callback) { callback("SUBSCRIBED"); return this; }
    };
    authState.client = {
      realtime: { setAuth() {} }, channel: () => channel, removeChannel() {},
      from(table) {
        const query = {
          select() { return this; }, eq() { return this; },
          update(payload) { this.payload = payload; return this; },
          insert(payload) { this.payload = payload; return this; },
          async maybeSingle() { return { data: { updated_at: this.payload?.updated_at || authState.lastCloudUpdatedAtValue }, error: null }; },
          then(resolve, reject) {
            const data = table === CLOUD_NOTE_DOCUMENT_TABLE ? [...authState.noteDocuments.values()] : [];
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
          async upsert(payload) {
            if (table !== CLOUD_REMINDER_STATE_TABLE) throw new Error(`Unexpected write: ${table}`);
            if (window.syncServer.failReminders) return { error: { message: "Test reminder outage" } };
            window.syncServer.reminders.push(JSON.parse(JSON.stringify(payload)));
            return { error: null };
          }
        };
        return query;
      },
      async rpc(name, payload) {
        if (name !== CLOUD_NOTE_COMMIT_RPC) throw new Error(`Unexpected RPC: ${name}`);
        if (window.syncServer.failNotes) return { error: { message: "Test note outage" } };
        const row = {
          status: "saved", user_id: authState.user.id, workspace_key: payload.p_workspace_key,
          ward_id: payload.p_ward_id, note_id: payload.p_note_id, document_html: payload.p_document_html,
          note_updated_at: payload.p_note_updated_at, revision: payload.p_expected_revision + 1,
          client_id: payload.p_client_id, updated_at: new Date().toISOString()
        };
        window.syncServer.notes.push(row);
        return { data: [row], error: null };
      }
    };
    renderAuthUi();
  });
});

test("starting and reconnecting live sync preserves a queued reminder save", async ({ page }, testInfo) => {
  for (const count of [1, 2]) {
    await page.evaluate(() => {
      // Same order as applySession: hydration queues the write before live sync starts.
      scheduleReminderIndexSave({ delay: 150 });
      startCloudLiveSync();
    });
    await expect.poll(() => page.evaluate(() => window.syncServer.reminders.length)).toBe(count);
    await expect(page.locator("#sync-indicator-label")).toHaveText("Saved");
  }
  expect(await page.evaluate(() => window.ShiftPadSyncCore.getPendingNoteCount(appState))).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("sync-saved.png"), scale: "css" });
});

test("failed reminder save stays pending and retries without calling notes unsaved", async ({ page }) => {
  await page.evaluate(() => {
    window.syncServer.failReminders = true;
    scheduleReminderIndexSave({ delay: 0 });
    startCloudLiveSync();
  });
  await expect(page.locator("#sync-indicator")).toHaveAttribute("data-tone", "error");
  await expect(page.locator("#sync-indicator-label")).toHaveText("Sync issue");
  expect(await page.evaluate(() => authState.reminderIndexPending)).toBe(true);
  await page.evaluate(() => { window.syncServer.failReminders = false; });
  await expect.poll(() => page.evaluate(() => window.syncServer.reminders.length), { timeout: 7000 }).toBe(1);
  await expect(page.locator("#sync-indicator-label")).toHaveText("Saved");
});

test("ending the session still cancels queued reminder writes", async ({ page }) => {
  await page.evaluate(() => {
    scheduleReminderIndexSave({ delay: 100 });
    stopCloudLiveSync();
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.syncServer.reminders.length)).toBe(0);
});

test("note edits remain locally pending on failure and clear only after server acknowledgement", async ({ page }) => {
  await page.evaluate(() => {
    window.syncServer.failNotes = true;
    authState.realtimeStatus = "subscribed";
  });
  await page.locator("#notepad-editor").click();
  await page.keyboard.type("Sample note must reach the server");
  await expect(page.locator("#sync-indicator-label")).toHaveText("1 unsaved");
  await expect.poll(() => page.evaluate(() => window.syncServer.reminders.length > 0)).toBe(true);
  // Successful unrelated writes must not hide the outstanding note failure.
  await expect(page.locator("#sync-indicator")).toHaveAttribute("data-tone", "error");
  const localPending = await page.evaluate(() => {
    flushLocalStateSave();
    const stored = JSON.parse(localStorage.getItem(getScopedStorageKey(authState.user.id)));
    return { count: window.ShiftPadSyncCore.getPendingNoteCount(stored), text: getCurrentNote().documentHtml };
  });
  expect(localPending.count).toBe(1);
  expect(localPending.text).toContain("Sample note must reach the server");
  await page.evaluate(() => { window.syncServer.failNotes = false; });
  await expect.poll(() => page.evaluate(() => window.syncServer.notes.length), { timeout: 7000 }).toBe(1);
  expect(await page.evaluate(() => window.syncServer.notes[0].document_html)).toContain("Sample note must reach the server");
  await expect(page.locator("#sync-indicator-label")).toHaveText("Saved");
});
