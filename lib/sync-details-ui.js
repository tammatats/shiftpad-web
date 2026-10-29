/* Sync details view: reads a supplied model and never writes note contents. */
(function (root) {
  'use strict';
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function timeLabel(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not confirmed in this session';
  }
  function create({ trigger, getModel, onRetry, onReview, onHistory, onOpen }) {
    const dialog = document.createElement('dialog');
    dialog.className = 'sync-details-dialog';
    dialog.id = 'sync-details-dialog';
    dialog.setAttribute('aria-labelledby', 'sync-details-title');
    dialog.innerHTML = '<header class="sync-details-head"><h2 id="sync-details-title">Sync details</h2><button type="button" class="ghost-btn" data-sync-close aria-label="Close sync details">Close</button></header><div data-sync-details-body></div>';
    document.body.append(dialog);
    const body = dialog.querySelector('[data-sync-details-body]');
    let returnFocus = null;
    let retryBusy = false;
    let selectedConflictId = '';
    let retryMessage = '';
    let lastSignature = '';
    function refresh() {
      if (!dialog.open) return;
      const model = getModel();
      const signature = JSON.stringify([model, retryBusy, retryMessage]);
      if (signature === lastSignature) return;
      lastSignature = signature;
      const scrollTop = dialog.scrollTop;
      const copyScrollPositions = [...body.querySelectorAll('pre')].map(el => el.scrollTop);
      const openConflicts = new Set([...body.querySelectorAll('details[open]')].map(el => el.dataset.conflictId));
      if (selectedConflictId) openConflicts.add(selectedConflictId);
      selectedConflictId = '';
      const focused = dialog.contains(document.activeElement) ? document.activeElement : null;
      const focusKey = focused?.getAttribute('data-review-conflict');
      const retryFocused = focused?.hasAttribute('data-sync-retry');
      body.innerHTML = `
        <p class="sync-details-status" data-sync-detail-status>${escape(model.label)}</p>
        <p class="sync-details-copy">${escape(model.detail)}</p>
        <dl class="sync-details-facts">
          <div><dt>Connection</dt><dd data-sync-connection>${model.online ? 'Online' : 'Offline'}</dd></div>
          <div><dt>Last cloud save confirmed</dt><dd data-sync-confirmed>${escape(timeLabel(model.lastConfirmedAt))}</dd></div>
          <div><dt>Notes waiting to sync</dt><dd data-sync-pending-notes>${escape(model.pendingNotes)}</dd></div>
          <div><dt>Reminder schedule</dt><dd data-sync-pending-reminders>${model.pendingReminders ? 'Waiting to sync' : 'No pending changes'}</dd></div>
          <div><dt>Pad settings and organization</dt><dd data-sync-pending-settings>${model.pendingState ? 'Waiting to sync' : 'No pending changes'}</dd></div>
          <div><dt>Current note revision</dt><dd data-sync-revision>${model.revision ? escape(model.revision) : 'No cloud revision yet'}</dd></div>
          <div><dt>Last cloud version received</dt><dd>${escape(timeLabel(model.lastReceivedAt))}</dd></div>
        </dl>
        ${model.otherDevice ? '<p class="sync-details-copy" data-sync-other-device>The current note includes a version from another device.</p>' : ''}
        ${model.pendingNotes || model.pendingReminders || model.pendingState ? '<p class="sync-details-copy">Pending changes stay on this device until the cloud confirms them. A successful save time above may refer to another item.</p>' : ''}
        ${!model.cloudAvailable ? '<p class="sync-details-copy">Cloud sync is unavailable in this session. Keep this device’s copy until you sign in and sync.</p>' : ''}
        <div class="sync-details-actions">
          <button class="accent-btn" type="button" data-sync-retry ${!model.canRetry || retryBusy ? 'disabled' : ''}>${retryBusy ? 'Retrying…' : 'Retry sync'}</button>
        </div>
        <p class="sync-details-copy" role="status" data-sync-retry-message>${escape(retryMessage)}</p>
        <section class="sync-conflicts" aria-label="Saved conflicting edits">
          <h3>Saved conflicting edits</h3>
          <p class="sync-details-copy">Compare your preserved copy with the current note. Reviewing keeps the current note unchanged; the saved copy remains in History.</p>
          ${model.conflicts.length ? model.conflicts.map(entry => `
            <details class="sync-conflict" data-conflict-id="${escape(entry.id)}" ${openConflicts.has(entry.id) ? 'open' : ''}>
              <summary>${escape(entry.title)} · ${escape(timeLabel(entry.createdAt))}${entry.reviewed ? ' · Reviewed' : ''}</summary>
              <div class="sync-conflict-columns">
                <section><h4>Your saved copy</h4><pre data-sync-local-copy>${escape(entry.localText || '(Empty note)')}</pre></section>
                <section><h4>Current note${entry.currentRevision ? ` · revision ${escape(entry.currentRevision)}` : ''}</h4><pre data-sync-current-copy>${escape(entry.currentText === null ? 'This note is no longer in the current pad.' : entry.currentText || '(Empty note)')}</pre></section>
              </div>
              <div class="sync-details-actions">
                <button class="ghost-btn" type="button" data-review-conflict="${escape(entry.id)}" ${entry.reviewed ? 'disabled' : ''}>${entry.reviewed ? 'Reviewed' : 'Mark reviewed'}</button>
                <button class="ghost-btn" type="button" data-sync-history>Open History</button>
              </div>
            </details>`).join('') : '<p class="sync-details-copy">No conflicting edits saved in this pad.</p>'}
        </section>`;
      [...body.querySelectorAll('pre')].forEach((el, index) => { el.scrollTop = copyScrollPositions[index] || 0; });
      if (focusKey) {
        const button = [...body.querySelectorAll('[data-review-conflict]')].find(el => el.dataset.reviewConflict === focusKey);
        (button && !button.disabled ? button : dialog.querySelector('[data-sync-close]')).focus({ preventScroll: true });
      } else if (retryFocused) {
        const button = body.querySelector('[data-sync-retry]');
        (button && !button.disabled ? button : dialog.querySelector('[data-sync-close]')).focus({ preventScroll: true });
      }
      dialog.scrollTop = scrollTop;
    }
    function open(conflictId = '') {
      selectedConflictId = typeof conflictId === 'string' ? conflictId : '';
      const targetConflictId = selectedConflictId;
      retryMessage = '';
      lastSignature = '';
      if (!dialog.open) {
        returnFocus = document.activeElement;
        onOpen?.();
        dialog.showModal();
      }
      dialog.scrollTop = 0;
      refresh();
      dialog.querySelector('[data-sync-close]').focus({ preventScroll: true });
      if (targetConflictId) {
        const target = [...body.querySelectorAll('[data-conflict-id]')].find(el => el.dataset.conflictId === targetConflictId);
        if (target) dialog.scrollTop += target.getBoundingClientRect().top - dialog.querySelector('.sync-details-head').getBoundingClientRect().bottom - 12;
      }
    }
    function close() { dialog.close(); }
    dialog.addEventListener('close', () => { returnFocus?.isConnected && returnFocus.focus({ preventScroll: true }); });
    dialog.querySelector('[data-sync-close]').addEventListener('click', close);
    dialog.addEventListener('click', async event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }
      const review = event.target.closest('[data-review-conflict]');
      if (review) { onReview(review.dataset.reviewConflict); refresh(); }
      if (event.target.closest('[data-sync-history]')) { close(); onHistory(); }
      if (event.target.closest('[data-sync-retry]') && !retryBusy) {
        retryBusy = true; retryMessage = ''; refresh();
        try { await onRetry(); retryMessage = 'Retry requested. Pending items clear only after cloud confirmation.'; }
        catch { retryMessage = 'Sync is still unavailable. Pending changes remain on this device.'; }
        finally { retryBusy = false; refresh(); }
      }
    });
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.addEventListener('click', () => open());
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
    return { open, close, refresh, dialog };
  }
  root.ShiftPadSyncDetails = { create };
})(window);
