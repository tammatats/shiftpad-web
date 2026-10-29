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
