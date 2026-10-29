(function (root) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  root.ShiftPadMobileEditorUI = {
    renderDock(tags, historyHtml = '') {
      const button = (tag, direct = false) => `<button class="mobile-tag-option ${escape(tag.className || '')}" type="button" ${direct ? `data-mobile-direct-tag="${escape(tag.key)}"` : `role="menuitem" data-mobile-tag="${escape(tag.key)}"`} ${tag.style || ''}>${escape(tag.label)}</button>`;
      return `<div class="mobile-tag-dock" data-mobile-tag-dock="true" aria-hidden="true">
        <div class="mobile-tag-tray" role="menu" aria-label="Insert tag">${tags.map(tag => button(tag)).join('')}</div>
        <div class="mobile-editor-toolbar" role="toolbar" aria-label="Note editing">
          ${tags.filter(tag => ['bed', 'hn', 'todo'].includes(tag.key)).map(tag => button(tag, true)).join('')}
          <button class="mobile-tag-fab" type="button" data-mobile-tag-toggle="true" aria-expanded="false" aria-label="More tags">More</button>
          <span class="mobile-history-controls">${historyHtml}</span>
        </div>
      </div>`;
    },
    renderChoice(tagLabel) {
      return `<section class="tag-choice-card" role="dialog" aria-labelledby="tag-choice-title">
        <strong id="tag-choice-title">This line already has a tag</strong>
        <p>Replace it with ${escape(tagLabel)}, or add ${escape(tagLabel)} on a new line. The line’s text will be kept.</p>
        <div><button type="button" data-tag-choice="replace">Replace tag</button><button type="button" data-tag-choice="new-line">New line</button><button type="button" data-tag-choice="cancel">Cancel</button></div>
      </section>`;
    }
  };
})(window);
