# Editor workflow boundaries

The app remains a static browser app. The new modules load before `app.js`; they do not create another state store or change the database schema.

- `lib/mobile-editor-ui.js`: toolbar and tag-choice markup. `app.js` owns selection snapshots and commits. The quick row exposes Bed/HN/To-do; More exposes the complete tag list.
- `lib/editor-history.js`: bounded, per-note document history and atomic multi-note transactions. It stores document HTML and selection bookmarks, never authentication or cloud revision metadata. App adapters record through `setNoteDocumentHtml` and `saveState`; replay creates a new local edit against the latest known revision. History is session-local. Persisted recovery remains in History.
- `lib/navigation-ui.js`: current-bed observation and explicit bed jumps. Passive scrolling reads document geometry; it must never move the caret or focus.
- `lib/sync-details-ui.js`: accessible status and conflict comparison dialog. The supplied model comes from actual sync state. Reviewing marks a recovery entry reviewed without restoring it. Completion state is included in plain-text comparisons.
- `styles/editor-controls.css`, `styles/navigation.css`, `styles/sync-details.css`: corresponding UI styles. Keep touch targets at least 44px in the editor toolbar and check 320px width before changing labels or spacing.
- `lib/vendor/`: pinned browser Supabase SDK and its license/provenance. The service worker needs the exact file in the shell cache for normal authenticated offline reopening. Only the public configuration endpoint is an API cache exception; authenticated APIs remain excluded.

## Insertion rules

Bed/HN use separate lines and keep existing tags/text on the original line. An untagged text line accepts an inline tag at the selected position; To-do applies to that line and preserves the text position. A tagged line asks for explicit Replace tag, New line, or Cancel. Replacement keeps line text. Note changes while a choice is open invalidate that choice instead of applying it to a different revision.

Opening More preserves the insertion bookmark through native focus and viewport changes. Deliberate editor taps, typing, or arrow navigation dismiss it and adopt the new position. Undo/Redo buttons must not enter the tag-selection gesture path, including when disabled. Cancelled or moved history-button touches must not activate Undo.

## Verification

Run `npm test`, JavaScript syntax checks, and rendered visual inspection. Include normal authenticated offline bootstrap (not only `?e2e=1`), stale remote revision rejection, same-line conflict preservation, and multi-ward Undo. Native keyboard, dictation, selection handles, physical scrolling performance, and Safari/PWA cold-start checks remain in [the iOS device matrix](IOS-RELEASE-CHECKS.md).

## iOS caret and app return safeguards

Tag history begins before Replace/New line mutates the DOM. Bookmarks count visible text without regenerated zero-width caret sentinels and validate DOM paths against that text position; a connected path alone does not prove it still addresses the same text.

A touch toolbar action guards its resulting selection for 200 ms against delayed native focus/keyboard resets. A fresh editor touch, keyboard input/navigation, composition, note/version change, or app blur ends the guard. Undo/Redo uses the same guard. This is bounded settling, not a persistent lock on user selection.

On foreground/pageshow, only a missing editor surface is rebuilt from the current model. An existing empty editor is never interpreted as a missing surface, and recovery does not save the DOM over the note model. Startup has a visible opening/reload state and catches initialization failures.

Runtime service-worker caching is best effort: quota/security failures cannot discard a successful network response. Temporary HTTP errors use a working cached response when available. Critical shell installation still requires all assets, and authenticated API responses remain excluded.

Regression coverage: `ios-toolbar-regressions.spec.js`, `pad-resume.spec.js`, `offline-shell.spec.js`, and `service-worker.test.js`. Synthetic selection resets/cache failures demonstrate the fixed code paths; they do not establish the cause of every physical-iOS white screen.
