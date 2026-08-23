(function initShiftPadSyncCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ShiftPadSyncCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createShiftPadSyncCore() {
  const FALLBACK_DELAYS_MS = [60_000, 120_000, 300_000, 900_000];

  function normalizeManifestRow(input) {
    if (!input || typeof input !== "object") return null;
    const workspaceKey = String(input.workspace_key || "");
    const noteId = String(input.note_id || "");
    if (!workspaceKey || !noteId) return null;
    return {
      workspace_key: workspaceKey,
      ward_id: String(input.ward_id || ""),
      note_id: noteId,
      revision: Math.max(0, Number(input.revision) || 0),
      updated_at: String(input.updated_at || "")
    };
  }

  function getManifestKey(row) {
    return `${row.workspace_key}:${row.note_id}`;
  }

  function diffNoteManifest(rows, localDocuments) {
    const changed = [];
    const remoteKeys = new Set();
    (Array.isArray(rows) ? rows : []).forEach((input) => {
      const row = normalizeManifestRow(input);
      if (!row) return;
      const key = getManifestKey(row);
      remoteKeys.add(key);
      const local = localDocuments instanceof Map ? localDocuments.get(key) : localDocuments?.[key];
      if (
        !local ||
        Number(local.revision || 0) !== row.revision ||
        String(local.ward_id || "") !== row.ward_id
      ) {
        changed.push(row);
      }
    });

    const deletedKeys = [];
    const localEntries = localDocuments instanceof Map
      ? localDocuments.entries()
      : Object.entries(localDocuments || {});
    for (const [key] of localEntries) {
      if (!remoteKeys.has(key)) deletedKeys.push(key);
    }
    return { changed, deletedKeys };
  }

  function getFallbackDelay(attempt, delays = FALLBACK_DELAYS_MS) {
    const safeDelays = Array.isArray(delays) && delays.length ? delays : FALLBACK_DELAYS_MS;
    const index = Math.max(0, Math.min(safeDelays.length - 1, Number(attempt) || 0));
    return safeDelays[index];
  }

  function getPendingNoteCount(appState) {
    let count = 0;
    Object.values(appState?.workspaces || {}).forEach((workspace) => {
      (workspace?.wards || []).forEach((ward) => {
        (ward?.notes || []).forEach((note) => {
          if (note?.cloudPending) count += 1;
        });
      });
    });
    return count;
  }

  function buildSyncStatus(input = {}) {
    const pendingNotes = Math.max(0, Number(input.pendingNotes) || 0);
    const pendingState = Boolean(input.pendingState);
    const unsavedCount = pendingNotes + (pendingState ? 1 : 0);
    if (!input.configured) return { tone: "local", label: "Local", detail: "Cloud setup needed", unsavedCount };
    if (!input.signedIn) return { tone: "local", label: "Signed out", detail: "Local changes only", unsavedCount };
    if (input.online === false) {
      return {
        tone: "offline",
        label: unsavedCount ? `${unsavedCount} unsaved` : "Offline",
        detail: unsavedCount ? "Saved on this device" : "Waiting for connection",
        unsavedCount
      };
    }
    if (input.hydrating) return { tone: "saving", label: "Loading", detail: "Loading cloud notes", unsavedCount };
    if (input.saving || unsavedCount) {
      return {
        tone: "saving",
        label: unsavedCount ? `${unsavedCount} unsaved` : "Saving",
        detail: "Saving to cloud",
        unsavedCount
      };
    }
    if (input.error) return { tone: "error", label: "Sync issue", detail: String(input.error), unsavedCount };
    if (input.realtimeStatus === "subscribed") return { tone: "saved", label: "Saved", detail: "Live sync on", unsavedCount };
    return { tone: "waiting", label: "Saved", detail: "Cloud reconnecting", unsavedCount };
  }

  return {
    FALLBACK_DELAYS_MS,
    normalizeManifestRow,
    getManifestKey,
    diffNoteManifest,
    getFallbackDelay,
    getPendingNoteCount,
    buildSyncStatus
  };
});
