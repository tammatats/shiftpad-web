const test = require("node:test");
const assert = require("node:assert/strict");
const sync = require("../../lib/sync-core");

test("manifest diff downloads only changed note revisions", () => {
  const local = new Map([
    ["shift:n1", { revision: 3, ward_id: "w1" }],
    ["day:n2", { revision: 2, ward_id: "w2" }],
    ["shift:removed", { revision: 1, ward_id: "w1" }]
  ]);
  const result = sync.diffNoteManifest([
    { workspace_key: "shift", note_id: "n1", ward_id: "w1", revision: 3 },
    { workspace_key: "day", note_id: "n2", ward_id: "w2", revision: 4 },
    { workspace_key: "shift", note_id: "n3", ward_id: "w3", revision: 1 }
  ], local);
  assert.deepEqual(result.changed.map((row) => row.note_id), ["n2", "n3"]);
  assert.deepEqual(result.deletedKeys, ["shift:removed"]);
});

test("fallback polling backs off and caps at fifteen minutes", () => {
  assert.equal(sync.getFallbackDelay(0), 60_000);
  assert.equal(sync.getFallbackDelay(2), 300_000);
  assert.equal(sync.getFallbackDelay(99), 900_000);
});

test("offline status reports durable unsaved work", () => {
  const status = sync.buildSyncStatus({ configured: true, signedIn: true, online: false, pendingNotes: 2, pendingState: true });
  assert.equal(status.label, "3 unsaved");
  assert.equal(status.tone, "offline");
});

test("a clean focused reader can display a remote note immediately", () => {
  assert.equal(sync.shouldQueueRemoteNoteDocument({
    saveInFlight: false,
    localDirty: false,
    editorComposing: false
  }), false);
});

test("remote note updates wait for local saves and active composition", () => {
  assert.equal(sync.shouldQueueRemoteNoteDocument({ localDirty: true }), true);
  assert.equal(sync.shouldQueueRemoteNoteDocument({ saveInFlight: true }), true);
  assert.equal(sync.shouldQueueRemoteNoteDocument({ editorComposing: true }), true);
});

test("queued remote notes merge after the local editor becomes idle", () => {
  assert.equal(sync.shouldWaitToResolveQueuedNoteDocument({
    localDirty: true,
    recentLocalMutation: true
  }), true);
  assert.equal(sync.shouldWaitToResolveQueuedNoteDocument({
    localDirty: true,
    recentLocalMutation: false
  }), false);
});
