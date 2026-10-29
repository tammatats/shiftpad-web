/* Navigation observes the document without changing its selection or focus. */
(function (global) {
  let context;
  let frame = 0;
  let observer;
  let bedTokens = [];
  let observedEditor;
  function queue() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; update(); });
  }
  function collect() {
    bedTokens = [...(context?.editorRoot?.querySelectorAll('#notepad-editor .tag-token[data-tag="bed"][data-editing="false"]') || [])];
    const select = context?.root?.querySelector('[data-current-bed]');
    if (select) {
      const labels = [...new Set(bedTokens.map(label).filter(Boolean))];
      const signature = JSON.stringify(labels);
      if (select.dataset.labels !== signature) {
        select.replaceChildren(new Option('Beds', ''), ...labels.map(value => new Option(`Bed ${value}`, value)));
        select.dataset.labels = signature;
      }
      select.disabled = !labels.length;
    }
    queue();
  }
  function label(token) { return String(token?.textContent || '').replace(/^Bed\s*/i, '').trim().toUpperCase(); }
  function update() {
    const select = context?.root?.querySelector('[data-current-bed]');
    if (!select || !bedTokens.length || document.activeElement === select) return;
    const bottom = document.querySelector('.top-control-stack')?.getBoundingClientRect().bottom || 0;
    let current;
    for (const token of bedTokens) {
      if (token.getBoundingClientRect().top > bottom + 24) break;
      current = token;
    }
    select.value = current ? label(current) : '';
  }
  function mount(next) {
    context = next;
    if (!next?.root || !next?.editorRoot) return;
    if (!next.root.dataset.navigationBound) {
      next.root.dataset.navigationBound = 'true';
      next.root.addEventListener('click', event => {
        if (event.target.closest('[data-choose-ward]')) context.onChooseWard?.();
        if (event.target.closest('[data-find-in-ward]')) context.onFind?.();
      });
      next.root.addEventListener('change', event => {
        const select = event.target.closest('[data-current-bed]');
        if (select?.value) {
          context.onBed?.(select.value);
          select.blur();
        }
      });
      window.addEventListener('scroll', queue, { passive: true });
      window.addEventListener('resize', queue, { passive: true });
      window.visualViewport?.addEventListener('resize', queue, { passive: true });
    }
    if (observedEditor !== next.editorRoot) {
      observer?.disconnect();
      observedEditor = next.editorRoot;
      observer = new MutationObserver(collect);
      observer.observe(observedEditor, { childList: true, subtree: true, characterData: true });
    }
    collect();
  }
  global.ShiftPadNavigation = { mount };
})(window);
