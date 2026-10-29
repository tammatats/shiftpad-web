(function initEditorHistory(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ShiftPadEditorHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Store document snapshots only. Cloud revisions and other note metadata are
  // deliberately absent: replay creates a new local edit against the latest revision.
  function createHistory({ limit = 60, mergeWindowMs = 900 } = {}) {
    const undo = new Map();
    const redo = new Map();
    let sequence = 0;
    let mayMerge = true;
    const copy = value => JSON.parse(JSON.stringify(value));
    const stack = (map, key) => map.get(key) || [];
    function remove(entry) {
      for (const map of [undo, redo]) for (const [key, list] of map) {
        map.set(key, list.filter(item => item !== entry));
      }
    }
    function invalidate(keys) {
      const entries = new Set();
      for (const key of keys) for (const map of [undo, redo]) for (const entry of stack(map, key)) entries.add(entry);
      entries.forEach(remove);
    }
    function record(changes, { label = 'Edit note', group = '', now = Date.now() } = {}) {
      const next = copy(changes.filter(change => change.before.html !== change.after.html));
      if (!next.length) return false;
      for (const change of next) for (const entry of [...stack(redo, change.key)]) remove(entry);
      const previous = next.length === 1 ? stack(undo, next[0].key).at(-1) : null;
      const mergeAllowed = mayMerge;
      mayMerge = true;
      if (mergeAllowed && group && previous?.group === group && previous.changes.length === 1 &&
          now - previous.at <= mergeWindowMs && previous.changes[0].after.html === next[0].before.html) {
        previous.changes[0].after = next[0].after;
        previous.at = now;
        return true;
      }
      const entry = { id: ++sequence, label, group, at: now, changes: next };
      for (const change of next) {
        const list = [...stack(undo, change.key), entry];
        undo.set(change.key, list);
        if (list.length > limit) remove(list[0]);
      }
      return true;
    }
    function replay(key, direction, readCurrent) {
      const source = direction === 'undo' ? undo : redo;
      const target = direction === 'undo' ? redo : undo;
      const entry = stack(source, key).at(-1);
      if (!entry) return null;
      const expected = direction === 'undo' ? 'after' : 'before';
      // Atomic edits such as a move require every note to still match. Never
      // restore one side of a move after the destination has changed elsewhere.
      if (entry.changes.some(change => stack(source, change.key).at(-1) !== entry || readCurrent(change) !== change[expected].html)) {
        remove(entry);
        return null;
      }
      for (const change of entry.changes) {
        source.set(change.key, stack(source, change.key).slice(0, -1));
        target.set(change.key, [...stack(target, change.key), entry]);
      }
      mayMerge = false;
      return { label: entry.label, changes: copy(entry.changes.map(change => ({ ...change, snapshot: change[direction === 'undo' ? 'before' : 'after'] }))) };
    }
    function state(key) {
      const previous = stack(undo, key).at(-1);
      const next = stack(redo, key).at(-1);
      return { canUndo: Boolean(previous), canRedo: Boolean(next), undoLabel: previous?.label || '', redoLabel: next?.label || '' };
    }
    function clear() { undo.clear(); redo.clear(); mayMerge = false; }
    return { record, invalidate, state, clear, undo: (key, read) => replay(key, 'undo', read), redo: (key, read) => replay(key, 'redo', read) };
  }
  return { createHistory };
});
