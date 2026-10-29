const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHistory } = require('../../lib/editor-history');
const change = (key, before, after) => ({ key, before: { html: before }, after: { html: after } });

test('typing groups into one undo step and redo restores the complete group', () => {
  const history = createHistory();
  history.record([change('a', '', 'h')], { group: 'typing', now: 100 });
  history.record([change('a', 'h', 'hello')], { group: 'typing', now: 200 });
  assert.equal(history.undo('a', () => 'hello').changes[0].snapshot.html, '');
  assert.equal(history.state('a').canUndo, false);
  assert.equal(history.redo('a', () => '').changes[0].snapshot.html, 'hello');
  history.record([change('a', 'hello', 'hello!')], { group: 'typing', now: 300 });
  assert.equal(history.undo('a', () => 'hello!').changes[0].snapshot.html, 'hello');
});
test('multi-note moves undo atomically and cannot overwrite a changed destination', () => {
  const history = createHistory();
  history.record([change('source', 'bed', ''), change('target', '', 'bed')], { label: 'Move bed' });
  assert.equal(history.undo('source', entry => entry.key === 'source' ? '' : 'bed').changes.length, 2);
  history.redo('target', entry => entry.key === 'source' ? 'bed' : '');
  assert.equal(history.undo('source', entry => entry.key === 'source' ? '' : 'newer device edit'), null);
  assert.equal(history.state('target').canUndo, false);
});
test('a new edit clears shared redo and remote invalidation removes both sides of a move', () => {
  const history = createHistory();
  history.record([change('a', 'x', ''), change('b', '', 'x')]);
  history.undo('a', entry => entry.key === 'a' ? '' : 'x');
  history.record([change('b', '', 'y')]);
  assert.equal(history.state('a').canRedo, false);
  history.record([change('a', 'x', ''), change('b', 'y', 'yx')]);
  history.invalidate(['b']);
  assert.equal(history.state('a').canUndo, false);
});
test('history is bounded and snapshots are detached from callers', () => {
  const history = createHistory({ limit: 2 });
  const first = change('a', '0', '1'); history.record([first]);
  first.before.html = 'mutated';
  history.record([change('a', '1', '2')]); history.record([change('a', '2', '3')]);
  assert.equal(history.undo('a', () => '3').changes[0].snapshot.html, '2');
  assert.equal(history.undo('a', () => '2').changes[0].snapshot.html, '1');
  assert.equal(history.state('a').canUndo, false);
});
