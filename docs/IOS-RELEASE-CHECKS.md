# iPhone and iPad release checks

Automated checks use Chromium and WebKit device profiles, touch events, beforeinput-only input, composition events, and simulated visual-viewport keyboard changes. They do not reproduce the native iOS keyboard, dictation, selection handles, or hardware performance. A physical-device pass is still required for those behaviors. No physical device was available for the workflow release. The offline shell-cache test runs on Chromium because [Playwright service-worker support is limited to Chromium](https://playwright.dev/docs/service-workers); offline note merge and handoff logic are also tested in WebKit using the fake cloud fixture. Native Safari/PWA cold-start behavior remains part of this manual matrix.

Use disposable sample notes, never patient information, for this checklist. Record device, iOS version, browser/PWA mode, app build, result, and a screenshot or screen recording for each failure.

## Device matrix

- iPhone: portrait and landscape; Safari and installed home-screen app.
- iPad: full screen, 50% split, and narrowest supported split; both sides of the screen; rotate while editing.
- iPad with a hardware keyboard/trackpad and with the on-screen keyboard.

## Editing and navigation

1. Start in the middle of a multi-line note. Use Bed, HN, To-do, More → Time/Lab/I/O, then type immediately. Check the actual stored line and caret, not just the appearance of a chip.
2. Confirm Bed/HN use separate lines without removing the original line's tag or text. On a tagged line, test Cancel, Replace tag, and New line. Cancel must preserve the document exactly.
3. Type Thai with the native keyboard, use predictive suggestions and dictation, paste multi-line text, select text with handles, and replace the selection. Verify Undo/Redo restores an appropriate action and caret.
4. Open/dismiss the keyboard repeatedly, scroll a long note, and resize the split while Tags/More is open. Controls and the edited line must stay reachable above the keyboard.
5. Undo/Redo typing, insertion, replacement, sorting, rename, delete, and moving a bed between wards. A move must undo both wards together; new typing must clear Redo.
6. Switch ward and pad, use Find in ward/All wards, choose a bed, and scrub the bed index. Passive scrolling must not move the caret; the current-bed label must follow the visible section.

## Sync and device handoff

1. Tap the sync indicator. Verify the last confirmed cloud save, current note revision, and separate pending note/reminder/settings states. A local copy is not a confirmed cloud save.
2. Edit on iPhone, wait for acknowledgement, then open on iPad. Make another edit and switch back. Confirm both changes remain.
3. Take one device offline, edit it, then edit a different line on the online device. Reconnect. Confirm the merge preserves both edits.
4. Edit the same line offline on both devices. Reconnect. Compare the preserved copy with the current note in Sync details. Mark reviewed must not restore or modify the note; both versions remain recoverable through History.
5. Receive a newer remote edit while Undo is available. Undo must not overwrite that newer revision. Verify a new local edit is still possible and syncs.
6. Close/reopen the installed app with pending offline edits. Confirm they survive and sync when connection returns.

Do not report the physical-device matrix as passed based on automated emulation alone.

## Caret/white-screen regression follow-up (2026-10-31)

- With the keyboard open at 50% and 25% iPad widths and iPhone portrait, replace an existing tag from the middle of its text, Undo, Redo, and type. Undo must restore the original text position.
- Choose New line on an existing tagged line, then Undo. The caret must return to the original line and text position.
- Immediately after a tag/Undo/Redo, tap a different line or move with native selection handles/keyboard trackpad. The new intentional position must win over settling.
- Return from another app and from the lock screen with the keyboard open/closed. If white content recurs, record whether header/toolbar remains visible and whether rotating or tapping restores paint. Browser-process/compositor failures cannot be proved resolved by simulated DOM/cache failure tests.
