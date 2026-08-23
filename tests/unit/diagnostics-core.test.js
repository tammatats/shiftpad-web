const test = require("node:test");
const assert = require("node:assert/strict");
const { compactDiagnosticPayload } = require("../../lib/diagnostics-core");

test("diagnostics retain interaction structure without note content", () => {
  const payload = compactDiagnosticPayload({
    action: "backspace",
    noteTitle: "Patient name",
    editorHtml: "<div>private note</div>",
    before: { editorText: "private note", selection: { anchorOffset: 4 } }
  });
  const encoded = JSON.stringify(payload);
  assert.match(encoded, /backspace/);
  assert.match(encoded, /anchorOffset/);
  assert.doesNotMatch(encoded, /Patient name|private note/);
});

test("oversized diagnostics collapse to a bounded summary", () => {
  const payload = compactDiagnosticPayload({ action: "input", arbitrary: "x".repeat(50_000) }, { maxBytes: 1024 });
  assert.ok(JSON.stringify(payload).length <= 1024);
});
