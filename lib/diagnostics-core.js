(function initShiftPadDiagnosticsCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ShiftPadDiagnosticsCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createShiftPadDiagnosticsCore() {
  const SENSITIVE_KEY = /(text|html|title|name|content|line|clipboard|paste|editor)/i;
  const ALLOWED_STRING_KEYS = new Set([
    "action", "source", "handledBy", "inputType", "browser", "path", "workspace",
    "workspaceKey", "activeView", "summaryTab", "timelineScope", "wardId", "noteId",
    "tokenId", "tagType", "lineId", "authEvent", "reason", "status", "appBuild"
  ]);

  function compactDiagnosticPayload(input, options = {}) {
    const maxDepth = Math.max(1, Number(options.maxDepth) || 4);
    const maxArray = Math.max(1, Number(options.maxArray) || 12);
    const maxBytes = Math.max(1024, Number(options.maxBytes) || 16_000);

    function visit(value, key, depth) {
      if (value == null || typeof value === "boolean" || typeof value === "number") return value;
      if (typeof value === "string") {
        if (SENSITIVE_KEY.test(key) && !ALLOWED_STRING_KEYS.has(key)) {
          return value ? `[redacted:${value.length}]` : "";
        }
        return value.slice(0, 240);
      }
      if (depth >= maxDepth) return Array.isArray(value) ? `[array:${value.length}]` : "[object]";
      if (Array.isArray(value)) return value.slice(0, maxArray).map((item) => visit(item, key, depth + 1));
      if (typeof value === "object") {
        const output = {};
        Object.entries(value).forEach(([childKey, childValue]) => {
          if (/^(editorHtml|editorText|editorTextRaw|allLines|noteTitle|wardName|documentHtml)$/i.test(childKey)) {
            const length = typeof childValue === "string" ? childValue.length : Array.isArray(childValue) ? childValue.length : 0;
            output[`${childKey}Length`] = length;
            return;
          }
          output[childKey] = visit(childValue, childKey, depth + 1);
        });
        return output;
      }
      return String(value).slice(0, 120);
    }

    let compact = visit(input || {}, "root", 0);
    let encoded = JSON.stringify(compact);
    if (encoded.length <= maxBytes) return compact;

    compact = {
      action: String(input?.action || "").slice(0, 120),
      source: String(input?.source || "").slice(0, 120),
      handledBy: String(input?.handledBy || "").slice(0, 120),
      success: typeof input?.success === "boolean" ? input.success : null,
      workspace: String(input?.workspace || input?.workspaceKey || "").slice(0, 32),
      wardId: String(input?.wardId || "").slice(0, 200),
      noteId: String(input?.noteId || "").slice(0, 200),
      appBuild: String(input?.appBuild || "").slice(0, 120),
      truncated: true,
      originalBytes: encoded.length
    };
    return compact;
  }

  return { compactDiagnosticPayload };
});
