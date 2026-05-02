const STORAGE_KEY = "shiftpad-ios-state-v1";
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const STORAGE_NAMESPACE = "shiftpad-ios-state-v2";
const WARD_COLORS = ["#f28b67", "#6ea8fe", "#6fc48d", "#b490ff", "#f0b95c", "#ff7aa2"];
const CORE_REMINDER_TAGS = ["time", "lab", "io"];
const CLOUD_STATE_TABLE = "shiftpad_user_state";
const CLOUD_SAVE_DEBOUNCE_MS = 700;
const PUSH_SUBSCRIPTION_ENDPOINT = "/api/push-subscriptions";
const KIND_META = {
  general: { label: "General", icon: "Memo", className: "" },
  lab: { label: "Lab", icon: "Lab", className: "kind-lab" },
  io: { label: "I/O", icon: "I/O", className: "kind-io" }
};

const refs = {
  menuBtn: document.getElementById("menu-btn"),
  wardOptionsBtn: document.getElementById("ward-options-btn"),
  newNoteBtn: document.getElementById("new-note-btn"),
  authGate: document.getElementById("auth-gate"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authName: document.getElementById("auth-name"),
  authMessage: document.getElementById("auth-message"),
  authSetupMessage: document.getElementById("auth-setup-message"),
  authSigninBtn: document.getElementById("auth-signin-btn"),
  authSignupBtn: document.getElementById("auth-signup-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  accountLabel: document.getElementById("account-label"),
  syncStatus: document.getElementById("sync-status"),
  notesTabBtn: document.getElementById("notes-tab-btn"),
  timelineTabBtn: document.getElementById("timeline-tab-btn"),
  notesView: document.getElementById("notes-view"),
  timelineView: document.getElementById("timeline-view"),
  editorRoot: document.getElementById("editor-root"),
  drawerRoot: document.getElementById("drawer-root"),
  mobileTagRoot: document.getElementById("mobile-tag-root"),
  timelineRoot: document.getElementById("timeline-root"),
  workspace: document.querySelector(".workspace")
};

let state = loadState();
const authState = {
  client: null,
  user: null,
  session: null,
  ready: false,
  configured: false,
  saveTimer: null,
  isSaving: false,
  isHydrating: false,
  suppressCloudSave: false
};
const uiState = {
  editorFocused: false,
  mobileTagsOpen: false,
  savedSelection: null,
  bedIndexVisible: false,
  bedIndexTimer: null,
  bedFinalizeTimer: null,
  editorTapScroll: null,
  suppressNextDeleteInput: false,
  drawerOpen: false,
  wardOptionsOpen: false,
  drawerSections: new Set(),
  animateWardAdd: false,
  pendingTagInsertions: new Map(),
  notificationStatus: ""
};
applyUrlOverrides();

init();

async function init() {
  bindEvents();
  initMobileViewportDock();
  registerShiftPadServiceWorker();
  await initAuth();
  render();
}

function initMobileViewportDock() {
  let rafId = 0;

  const updateViewportOffset = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      document.documentElement.style.setProperty("--keyboard-offset", "0px");
      document.documentElement.style.setProperty("--viewport-offset-top", "0px");
      document.documentElement.style.setProperty("--viewport-offset-left", "0px");
      return;
    }

    const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    document.documentElement.style.setProperty("--viewport-offset-top", `${Math.max(0, viewport.offsetTop)}px`);
    document.documentElement.style.setProperty("--viewport-offset-left", `${Math.max(0, viewport.offsetLeft)}px`);
  };

  const requestViewportOffsetUpdate = () => {
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(updateViewportOffset);
  };

  requestViewportOffsetUpdate();
  window.visualViewport?.addEventListener("resize", requestViewportOffsetUpdate);
  window.visualViewport?.addEventListener("scroll", requestViewportOffsetUpdate);
  window.addEventListener("scroll", requestViewportOffsetUpdate, { passive: true });
  window.addEventListener("focusin", requestViewportOffsetUpdate);
  window.addEventListener("focusout", () => {
    window.setTimeout(requestViewportOffsetUpdate, 80);
  });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(requestViewportOffsetUpdate, 120);
  });
}

function bindEvents() {
  refs.authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signInWithPassword();
  });

  refs.authSignupBtn?.addEventListener("click", async () => {
    await signUpWithPassword();
  });

  refs.logoutBtn?.addEventListener("click", async () => {
    await signOutCurrentUser();
  });

  refs.menuBtn?.addEventListener("click", () => {
    uiState.drawerOpen = true;
    uiState.wardOptionsOpen = false;
    renderDrawer({ animateSide: "left" });
  });

  refs.wardOptionsBtn?.addEventListener("click", () => {
    uiState.wardOptionsOpen = true;
    uiState.drawerOpen = false;
    renderDrawer({ animateSide: "right" });
  });

  refs.drawerRoot?.addEventListener("click", async (event) => {
    const close = event.target.closest("[data-drawer-close]");
    if (close) {
      uiState.drawerOpen = false;
      uiState.wardOptionsOpen = false;
      renderDrawer();
      return;
    }

    const toggle = event.target.closest("[data-drawer-toggle]");
    if (toggle) {
      toggleDrawerSection(toggle.dataset.drawerToggle);
      return;
    }

    const action = event.target.closest("[data-drawer-action]");
    if (action) {
      await handleDrawerAction(action.dataset.drawerAction);
      return;
    }

    const wardScope = event.target.closest("[data-ward-scope]");
    if (wardScope) {
      selectWardScope(wardScope.dataset.wardScope);
      return;
    }

    const wardButton = event.target.closest("[data-ward-id]");
    if (wardButton) {
      selectWardFromDrawer(wardButton.dataset.wardId);
      return;
    }

    const removeCustomTag = event.target.closest("[data-remove-custom-tag]");
    if (removeCustomTag) {
      removeCustomTagDefinition(removeCustomTag.dataset.removeCustomTag);
      return;
    }
  });

  refs.drawerRoot?.addEventListener("change", (event) => {
    const multipleWardSetting = event.target.closest("[data-multiple-wards-setting]");
    if (multipleWardSetting) {
      uiState.animateWardAdd = multipleWardSetting.checked;
      updateMultipleWardsMode(multipleWardSetting.checked);
      return;
    }

    const delayInput = event.target.closest("[data-tag-delay]");
    if (delayInput) {
      updateTagDelay(delayInput.dataset.tagDelay, delayInput.value);
      return;
    }

    const checkbox = event.target.closest("[data-custom-reminder-toggle]");
    if (checkbox) {
      const row = checkbox.closest("[data-custom-tag-row]");
      updateCustomTagDefinition(row?.dataset.customTagRow, { hasReminder: checkbox.checked });
    }
  });

  refs.drawerRoot?.addEventListener("input", (event) => {
    const customDelay = event.target.closest("[data-custom-delay]");
    if (customDelay) {
      const row = customDelay.closest("[data-custom-tag-row]");
      updateCustomTagDefinition(row?.dataset.customTagRow, { delayMinutes: customDelay.value });
    }
  });

  refs.drawerRoot?.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-custom-tag-form]");
    if (!form) return;
    event.preventDefault();
    addCustomTagFromForm(form);
  });

  refs.editorRoot.addEventListener("mousedown", (event) => {
    const quickButton = event.target.closest("[data-quick-tag]");
    if (quickButton) {
      rememberEditorSelection(refs.editorRoot.querySelector("#notepad-editor"));
      event.preventDefault();
    }
  });

  refs.editorRoot.addEventListener("pointerdown", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    rememberEditorTapScroll();
  }, { passive: true });

  refs.editorRoot.addEventListener("touchstart", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    rememberEditorTapScroll();
  }, { passive: true });

  [refs.newNoteBtn].filter(Boolean).forEach((button) => {
    button.addEventListener("click", () => {
      const ward = getCurrentWard();
      if (!ward) return;

      const note = createNote(`${ward.name} handover ${ward.notes.length + 1}`, "");
      ward.notes.unshift(note);
      state.selectedNoteId = note.id;
      state.activeView = "notes";
      saveState();
      render();
    });
  });

  refs.notesTabBtn.addEventListener("click", () => {
    state.activeView = "notes";
    uiState.editorFocused = false;
    uiState.mobileTagsOpen = false;
    render();
  });

  refs.timelineTabBtn.addEventListener("click", () => {
    state.activeView = "timeline";
    uiState.editorFocused = false;
    uiState.mobileTagsOpen = false;
    render();
  });

  refs.editorRoot.addEventListener("click", (event) => {
    const bedJump = event.target.closest?.("[data-bed-jump]");
    if (bedJump) {
      jumpToBedInEditor(bedJump.dataset.bedJump);
      return;
    }

    const quickButton = event.target.closest("[data-quick-tag]");
    if (quickButton) {
      handleQuickTag(quickButton.dataset.quickTag);
      return;
    }

    if (event.target.closest("#notepad-editor")) {
      const editor = refs.editorRoot.querySelector("#notepad-editor");
      uiState.editorFocused = true;
      syncMobileTagDock();
      rememberEditorSelection(editor);
      stabilizeEditorTapScroll(editor);
      return;
    }

    if (isCompactMobileLayout()) {
      uiState.editorFocused = false;
      uiState.mobileTagsOpen = false;
      syncMobileTagDock();
    }
  });

  refs.editorRoot.addEventListener("focusin", (event) => {
    if (!event.target.closest?.("#notepad-editor")) return;
    const editor = event.target.closest("#notepad-editor");
    uiState.editorFocused = true;
    hideBedIndex();
    syncMobileTagDock();
    rememberEditorSelection(editor);
    stabilizeEditorTapScroll(editor);
  });

  refs.editorRoot.addEventListener("focusout", (event) => {
    if (!event.target.closest?.("#notepad-editor")) return;
    window.setTimeout(() => {
      uiState.editorFocused = Boolean(document.activeElement?.closest?.("#notepad-editor"));
      if (!uiState.editorFocused) {
        uiState.mobileTagsOpen = false;
      }
      syncMobileTagDock();
    }, 50);
  });

  refs.editorRoot.addEventListener("input", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;

    maybeFinalizeEditingTimeToken(editor);
    note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
    note.updatedAt = Date.now();
    rememberEditorSelection(editor);
    saveState();
    hideBedIndex();
    requestAnimationFrame(() => keepEditorCaretVisible(editor));
    return;
  });

  refs.editorRoot.addEventListener("blur", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;

    note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
    note.updatedAt = Date.now();
    rememberEditorSelection(editor);
    saveState();
  }, true);

  refs.editorRoot.addEventListener("keyup", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;

    note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
    note.updatedAt = Date.now();
    rememberEditorSelection(editor);
    saveState();
  });

  refs.editorRoot.addEventListener("click", (event) => {
    const editor = event.target.closest("#notepad-editor");
    if (editor) {
      const note = getCurrentNote();
      if (!note) return;

      note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
      rememberEditorSelection(editor);
      saveState();
    }
  });

  refs.editorRoot.addEventListener("mouseup", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    rememberEditorSelection(editor);
    stabilizeEditorTapScroll(editor);
  });

  refs.editorRoot.addEventListener("change", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;

    if (field === "ward-name") {
      const ward = getCurrentWard();
      if (!ward) return;
      ward.name = event.target.value.trim() || ward.name;
      saveState();
      render();
      return;
    }

    const note = getCurrentNote();
    if (!note) return;

    note[field] = event.target.value.trim();
    note.updatedAt = Date.now();
    saveState();
    render();
  });

  refs.editorRoot.addEventListener("keydown", (event) => {
    if (event.target.closest?.("#notepad-editor")) {
      hideBedIndex();
      handleNotepadKeydown(event);
    }
  });

  refs.editorRoot.addEventListener("beforeinput", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    if (handleNotepadBeforeInput(event)) {
      event.preventDefault();
    }
  });

  refs.mobileTagRoot?.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("[data-mobile-tag-dock]")) return;
    event.preventDefault();
  });

  refs.mobileTagRoot?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-mobile-tag-toggle]");
    if (toggle) {
      uiState.mobileTagsOpen = !uiState.mobileTagsOpen;
      restoreEditorFocusAndSelection();
      syncMobileTagDock();
      return;
    }

    const close = event.target.closest("[data-mobile-tag-close]");
    if (close) {
      uiState.mobileTagsOpen = false;
      restoreEditorFocusAndSelection();
      syncMobileTagDock();
      return;
    }

    const tagButton = event.target.closest("[data-mobile-tag]");
    if (tagButton) {
      restoreEditorFocusAndSelection();
      handleQuickTag(tagButton.dataset.mobileTag);
      uiState.mobileTagsOpen = false;
      syncMobileTagDock();
    }
  });

  refs.timelineRoot.addEventListener("change", (event) => {
    const bedEditor = event.target.closest("[data-bed-editor]");
    if (bedEditor) {
      updateBedGroupText(bedEditor.dataset.bedKey, bedEditor.value);
      return;
    }

    const summaryEditor = event.target.closest("[data-summary-editor]");
    if (summaryEditor) {
      updateSummaryLineText(summaryEditor.dataset.noteId, Number(summaryEditor.dataset.lineIndex), summaryEditor.value);
      return;
    }

    const checkbox = event.target.closest("[data-token-id]");
    if (!checkbox) return;

    toggleTaggedLineDone(checkbox.dataset.noteId, checkbox.dataset.tokenId, checkbox.checked);
  });

  refs.timelineRoot.addEventListener("input", (event) => {
    const bedEditor = event.target.closest("[data-bed-editor]");
    if (bedEditor) {
      autoSizeTextarea(bedEditor);
      updateBedGroupText(bedEditor.dataset.bedKey, bedEditor.value);
      return;
    }

    const summaryEditor = event.target.closest("[data-summary-editor]");
    if (!summaryEditor) return;

    autoSizeTextarea(summaryEditor);
    updateSummaryLineText(summaryEditor.dataset.noteId, Number(summaryEditor.dataset.lineIndex), summaryEditor.value);
  });

  refs.timelineRoot.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-summary-tab]");
    if (tab) {
      state.summaryTab = tab.dataset.summaryTab === "reminders" ? "reminders" : "beds";
      saveState();
      renderTimeline();
      return;
    }

    const emptyAction = event.target.closest("[data-empty-action]");
    if (!emptyAction) return;

    if (emptyAction.dataset.emptyAction === "notes") {
      state.activeView = "notes";
      uiState.editorFocused = false;
      uiState.mobileTagsOpen = false;
      saveState();
      render();
    }
  });

  document.addEventListener("selectionchange", () => {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (!editor) return;
    rememberEditorSelection(editor);
    stabilizeEditorTapScroll(editor);
  });

  window.addEventListener("resize", syncMobileTagDock, { passive: true });
  window.addEventListener("scroll", showBedIndexDuringScroll, { passive: true });
}

function render() {
  ensureSelection();
  renderAuthUi();
  refs.workspace.classList.toggle("single-ward", Boolean(state.preferences.singleWardMode));
  refs.timelineView.classList.toggle("single-ward-summary", state.timelineScope === "active");

  refs.notesTabBtn.classList.toggle("is-active", state.activeView === "notes");
  refs.timelineTabBtn.classList.toggle("is-active", state.activeView === "timeline");
  refs.notesView.classList.toggle("hidden", state.activeView !== "notes");
  refs.timelineView.classList.toggle("hidden", state.activeView !== "timeline");

  renderEditor();
  renderTimeline();
  renderDrawer();
  refreshMobileTagDock();
}

function renderDrawer({ animateSide = "" } = {}) {
  if (!refs.drawerRoot) return;
  const open = Boolean(uiState.drawerOpen);
  const wardOptionsOpen = Boolean(uiState.wardOptionsOpen);
  refs.menuBtn?.setAttribute("aria-expanded", String(open));
  refs.wardOptionsBtn?.setAttribute("aria-expanded", String(wardOptionsOpen));
  refs.drawerRoot.innerHTML = `
    <div class="drawer-layer ${open && animateSide !== "left" ? "is-open" : ""}" data-drawer-side="left" aria-hidden="${open ? "false" : "true"}">
      <button class="drawer-scrim" type="button" data-drawer-close="true" aria-label="Close menu"></button>
      <aside class="side-drawer" aria-label="App menu">
        <div class="drawer-head">
          <button class="drawer-close menu-btn" type="button" data-drawer-close="true" aria-label="Close menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div>
            <p class="section-kicker">Menu</p>
            <h2>ShiftPad</h2>
          </div>
        </div>
        ${renderAccountMenu()}
        ${renderSettingsMenu()}
      </aside>
    </div>
    <div class="drawer-layer drawer-layer-right ${wardOptionsOpen && animateSide !== "right" ? "is-open" : ""}" data-drawer-side="right" aria-hidden="${wardOptionsOpen ? "false" : "true"}">
      <button class="drawer-scrim" type="button" data-drawer-close="true" aria-label="Close ward options"></button>
      <aside class="side-drawer side-drawer-right" aria-label="Ward options">
        <div class="drawer-head drawer-head-right">
          <div>
            <p class="section-kicker">Wards</p>
            <h2>Ward options</h2>
          </div>
          <button class="drawer-close menu-btn" type="button" data-drawer-close="true" aria-label="Close ward options">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
        ${renderWardOptionsMenu()}
      </aside>
    </div>
  `;
  if (animateSide) {
    window.requestAnimationFrame(() => {
      refs.drawerRoot?.querySelector(`[data-drawer-side="${animateSide}"]`)?.classList.add("is-open");
    });
  }
  if (uiState.animateWardAdd) {
    window.setTimeout(() => {
      uiState.animateWardAdd = false;
      refs.drawerRoot?.querySelector(".ward-add-reveal")?.classList.remove("should-animate");
    }, 260);
  }
}

function renderAccountMenu() {
  const open = isDrawerSectionOpen("account");
  return `
    <section class="drawer-section ${open ? "is-open" : ""}">
      ${renderDrawerSectionToggle("account", "Account", open)}
      <div class="drawer-panel">
        <div class="drawer-account-card">
          <strong>${escapeHtml(getAccountDisplayName())}</strong>
          <small>${escapeHtml(getSyncStatusText())}</small>
        </div>
        <div class="drawer-actions">
          <button class="ghost-btn" type="button" data-drawer-action="logout">Log out</button>
          <button class="ghost-btn" type="button" data-drawer-action="change-account">Change account</button>
          <button class="ghost-btn" type="button" data-drawer-action="change-password">Change password</button>
        </div>
      </div>
    </section>
  `;
}

function renderDrawerSectionToggle(key, label, open) {
  return `
    <button class="drawer-section-toggle" type="button" data-drawer-toggle="${escapeHtml(key)}" aria-expanded="${open}">
      <span>${escapeHtml(label)}</span>
      <strong>${open ? "Close" : "Open"}</strong>
    </button>
  `;
}

function renderSettingsMenu() {
  const preferences = getPreferences();
  const customTags = getCustomTagDefinitions();
  const settingsOpen = isDrawerSectionOpen("settings");
  const customOpen = isDrawerSectionOpen("custom-tags");
  const resetOpen = isDrawerSectionOpen("reset");
  return `
    <section class="drawer-section ${settingsOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("settings", "Settings", settingsOpen)}
      <div class="drawer-panel">
        <div class="settings-grid">
          ${renderDelayField("time", "Time tag delay", preferences.tagDelays.time)}
          ${renderDelayField("lab", "Lab delay", preferences.tagDelays.lab)}
          ${renderDelayField("io", "I/O delay", preferences.tagDelays.io)}
        </div>
        <p class="drawer-help">I/O uses the note creation time: before 14:30 gives 14:00 and 22:00; after 14:30 gives 22:00 only.</p>
        ${renderNotificationSettings()}
      </div>
    </section>
    <section class="drawer-section ${customOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("custom-tags", "Custom tags", customOpen)}
      <div class="drawer-panel">
        <form class="custom-tag-form" data-custom-tag-form="true">
          <input name="label" type="text" maxlength="18" placeholder="Tag name" aria-label="Tag name" />
          <label class="mini-check">
            <input name="hasReminder" type="checkbox" />
            <span>Reminder</span>
          </label>
          <input name="delayMinutes" type="number" min="0" step="5" value="0" aria-label="Delay minutes" />
          <button class="accent-btn" type="submit">Add</button>
        </form>
        <div class="custom-tag-list">
          ${customTags.length ? customTags.map(renderCustomTagSettingRow).join("") : `<p class="drawer-help">No custom tags yet.</p>`}
        </div>
      </div>
    </section>
    <section class="drawer-section danger-zone ${resetOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("reset", "Reset", resetOpen)}
      <div class="drawer-panel">
        <button class="ghost-btn danger-btn" type="button" data-drawer-action="reset-notes">Reset all notes</button>
      </div>
    </section>
  `;
}

function renderWardOptionsMenu() {
  const preferences = getPreferences();
  const multipleWardsEnabled = !preferences.singleWardMode;
  const allSelected = state.timelineScope !== "active";
  const revealClass = [
    "ward-add-reveal",
    multipleWardsEnabled ? "is-open" : "",
    uiState.animateWardAdd ? "should-animate" : ""
  ].filter(Boolean).join(" ");
  const wardListMarkup = multipleWardsEnabled ? `
    <section class="drawer-section drawer-ward-list-section">
      <div class="drawer-section-title">
        <span>Active lists</span>
      </div>
      <div class="ward-list drawer-ward-list">
        <button
          class="ward-tab all-wards-tab ${allSelected ? "is-active" : ""}"
          type="button"
          data-ward-scope="all"
        >
          <div class="ward-tab-head">
            <span class="ward-dot all-ward-dot"></span>
            <strong>All wards</strong>
          </div>
        </button>
        ${state.wards.map(renderDrawerWardButton).join("")}
      </div>
    </section>
  ` : "";
  return `
    <section class="drawer-section multiple-wards-section">
      <label class="drawer-section-toggle drawer-direct-toggle" for="multiple-wards-toggle">
        <span>Multiple wards</span>
        <strong>${multipleWardsEnabled ? "On" : "Off"}</strong>
        <span class="switch">
          <input
            id="multiple-wards-toggle"
            type="checkbox"
            data-multiple-wards-setting="true"
            ${multipleWardsEnabled ? "checked" : ""}
          />
          <span class="switch-track"></span>
        </span>
      </label>
      <div class="${revealClass}">
        <button class="accent-btn ward-add-btn" type="button" data-drawer-action="add-ward" ${multipleWardsEnabled ? "" : "disabled"}>Add ward</button>
      </div>
    </section>
    ${wardListMarkup}
  `;
}

function renderDrawerWardButton(ward) {
  const active = state.timelineScope === "active" && ward.id === state.selectedWardId;
  return `
    <button
      class="ward-tab ${active ? "is-active" : ""}"
      type="button"
      data-ward-id="${escapeHtml(ward.id)}"
      style="--ward-color:${escapeHtml(ward.color)}"
    >
      <div class="ward-tab-head">
        <span class="ward-dot"></span>
        <strong>${escapeHtml(ward.name)}</strong>
      </div>
    </button>
  `;
}

function renderNotificationSettings() {
  const support = getNotificationSupport();
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const configured = Boolean(window.SHIFTPAD_PUBLIC_CONFIG?.vapidPublicKey);
  const enabled = permission === "granted";
  const status =
    uiState.notificationStatus ||
    (support.supported
      ? enabled
        ? "Notifications are allowed on this device."
        : "Add ShiftPad to the Home Screen, open it there, then enable notifications."
      : support.message);

  return `
    <div class="notification-card">
      <div>
        <strong>Notifications</strong>
        <p>${escapeHtml(status)}</p>
      </div>
      <div class="notification-actions">
        <button
          class="accent-btn"
          type="button"
          data-drawer-action="enable-notifications"
          ${!support.supported || !configured || !authState.user ? "disabled" : ""}
        >${enabled ? "Refresh" : "Enable"}</button>
        <button
          class="ghost-btn"
          type="button"
          data-drawer-action="disable-notifications"
          ${!support.supported || !authState.user ? "disabled" : ""}
        >Disable</button>
      </div>
      ${configured ? "" : `<p class="drawer-help">Vercel needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY before notifications can be enabled.</p>`}
      ${authState.user ? "" : `<p class="drawer-help">Sign in before enabling notifications.</p>`}
    </div>
  `;
}

function getAccountDisplayName() {
  if (!authState.configured) return "Setup needed";
  if (!authState.user) return "Signed out";
  return authState.user.user_metadata?.display_name || authState.user.email || "Signed in";
}

function getSyncStatusText() {
  if (!authState.configured) return "Add Supabase env vars";
  if (!authState.user) return authState.ready ? "Sign in to load cloud notes" : "Checking session...";
  if (authState.isHydrating) return "Loading cloud notes...";
  if (authState.isSaving) return "Saving to cloud...";
  return "Cloud sync on";
}

function isDrawerSectionOpen(key) {
  return uiState.drawerSections.has(key);
}

function toggleDrawerSection(key) {
  if (!key) return;
  if (uiState.drawerSections.has(key)) {
    uiState.drawerSections.delete(key);
  } else {
    uiState.drawerSections.add(key);
  }
  renderDrawer();
}

function renderDelayField(key, label, value) {
  return `
    <label class="setting-field">
      <span>${escapeHtml(label)}</span>
      <input type="number" min="-720" max="720" step="5" value="${escapeHtml(String(value || 0))}" data-tag-delay="${escapeHtml(key)}" />
      <small>minutes</small>
    </label>
  `;
}

function renderCustomTagSettingRow(tag) {
  return `
    <div class="custom-tag-row" data-custom-tag-row="${escapeHtml(tag.id)}">
      <strong>${escapeHtml(tag.label)}</strong>
      <label class="mini-check">
        <input type="checkbox" data-custom-reminder-toggle="true" ${tag.hasReminder ? "checked" : ""} />
        <span>Reminder</span>
      </label>
      <input type="number" min="0" step="5" value="${escapeHtml(String(tag.delayMinutes || 0))}" data-custom-delay="true" aria-label="Custom tag delay" />
      <button class="ghost-btn tiny-btn" type="button" data-remove-custom-tag="${escapeHtml(tag.id)}">Remove</button>
    </div>
  `;
}

function renderEditor() {
  const ward = getCurrentWard();
  const note = getCurrentNote();
  const bedIndex = getBedIndexForNote(note);

  if (!ward || !note) {
    refs.editorRoot.innerHTML = `
      <div class="empty-card">
        <h3>Nothing selected</h3>
        <p class="helper-copy">Choose a ward and note to start documenting the shift.</p>
      </div>
    `;
    return;
  }
  const documentHtml = getNoteDocumentHtml(note);

  refs.editorRoot.innerHTML = `
    <div class="editor-shell">
      <section class="note-pad-card">
        <div class="stack-head">
          <div>
            <p class="section-kicker">Main notepad</p>
            <h2>${escapeHtml(ward.name || "Current ward")}</h2>
          </div>
          <small>Updated ${escapeHtml(formatClock(note.updatedAt || note.createdAt))}</small>
        </div>

        <div class="quick-tags">
          ${getAvailableQuickTags().map((tag) => renderQuickChip(tag.key, tag.label)).join("")}
        </div>

        <div class="smart-pad-surface document-pad">
          <div
            id="notepad-editor"
            class="notepad-editor"
            contenteditable="true"
            spellcheck="true"
            aria-label="Main notepad"
            autocapitalize="sentences"
          >${documentHtml}</div>
          ${renderBedIndexRail(bedIndex)}
        </div>

      </section>
    </div>
  `;

  requestAnimationFrame(() => {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (!isCompactMobileLayout()) {
      editor?.focus();
    }
    syncMobileTagDock();
  });
}

function renderBedIndexRail(beds) {
  if (!beds.length) return "";
  return `
    <div class="bed-index-rail ${uiState.bedIndexVisible ? "is-visible" : ""}" aria-label="Bed index">
      ${beds
        .map(
          (bed) => `
            <button type="button" data-bed-jump="${escapeHtml(bed)}">${escapeHtml(bed)}</button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTimeline() {
  const scope = state.timelineScope || "all";
  const summaryTab = state.summaryTab === "reminders" ? "reminders" : "beds";
  const summary = buildSummaryGroups(scope);
  const openReminderCount = summary.timed.filter((item) => !item.entry.done).length;
  const scopeLabel = scope === "active" ? getCurrentWard()?.name || "Selected ward" : "All wards";

  refs.timelineRoot.innerHTML = `
    <div class="summary-controls-row">
      <div class="summary-switcher" role="tablist" aria-label="Summary sections">
        <button class="summary-tab ${summaryTab === "beds" ? "is-active" : ""}" type="button" data-summary-tab="beds">Bed Info</button>
        <button class="summary-tab ${summaryTab === "reminders" ? "is-active" : ""}" type="button" data-summary-tab="reminders">Reminders</button>
      </div>
      <strong class="summary-count">${escapeHtml(scopeLabel)} · ${openReminderCount} open reminder${openReminderCount === 1 ? "" : "s"}</strong>
    </div>
    ${summaryTab === "beds" ? renderSummaryBedSection(summary.byBed) : renderSummaryTimedSection(summary.timed)}
  `;

  refs.timelineRoot.querySelectorAll("[data-summary-editor], [data-bed-editor]").forEach(autoSizeTextarea);
}

function renderAuthUi() {
  const hasUser = Boolean(authState.user);
  document.body.classList.toggle("auth-locked", !hasUser);
  refs.authGate?.classList.toggle("hidden", hasUser);
  refs.logoutBtn?.classList.add("hidden");
  [refs.authEmail, refs.authPassword, refs.authName, refs.authSigninBtn, refs.authSignupBtn].forEach((node) => {
    if (!node) return;
    node.disabled = !authState.configured;
  });

  if (!authState.configured) {
    refs.accountLabel.textContent = "Setup needed";
    refs.syncStatus.textContent = "Add Supabase env vars";
    refs.authSetupMessage.textContent =
      "Set Vercel env vars SUPABASE_URL and SUPABASE_ANON_KEY, then run the Supabase SQL schema before signing in.";
    refs.authSetupMessage.classList.remove("hidden");
    return;
  }

  refs.authSetupMessage.classList.add("hidden");

  if (!hasUser) {
    refs.accountLabel.textContent = "Signed out";
    refs.syncStatus.textContent = authState.ready ? "Sign in to load your cloud notes" : "Checking session...";
    return;
  }

  const displayName =
    authState.user.user_metadata?.display_name || authState.user.email || "Signed in";
  refs.accountLabel.textContent = displayName;
  if (authState.isHydrating) {
    refs.syncStatus.textContent = "Loading cloud notes...";
  } else if (authState.isSaving) {
    refs.syncStatus.textContent = "Saving to cloud...";
  } else {
    refs.syncStatus.textContent = "Cloud sync on";
  }
}

async function initAuth() {
  const config = window.SHIFTPAD_PUBLIC_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) {
    authState.ready = true;
    renderAuthUi();
    return;
  }

  authState.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
  authState.configured = true;

  try {
    const {
      data: { session }
    } = await authState.client.auth.getSession();
    await applySession(session);
  } catch (error) {
    authState.ready = true;
    setAuthMessage(formatSupabaseError(error, "Session load failed."));
    renderAuthUi();
  }

  authState.client.auth.onAuthStateChange((_event, sessionUpdate) => {
    applySession(sessionUpdate).catch((error) => {
      setAuthMessage(formatSupabaseError(error, "Auth update failed."));
    });
  });
}

async function applySession(session) {
  authState.session = session || null;
  authState.user = session?.user || null;
  authState.ready = true;

  if (!authState.user) {
    state = loadState();
    render();
    return;
  }

  await hydrateStateFromCloud();
}

async function signInWithPassword() {
  if (!authState.client) return;
  setAuthMessage("Signing in...");
  const email = String(refs.authEmail?.value || "").trim();
  const password = String(refs.authPassword?.value || "");
  try {
    const { error } = await authState.client.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthMessage(formatSupabaseError(error, "Sign in failed."));
      return;
    }
  } catch (error) {
    setAuthMessage(formatSupabaseError(error, "Sign in failed."));
    return;
  }
  setAuthMessage("");
}

async function signUpWithPassword() {
  if (!authState.client) return;
  setAuthMessage("Creating account...");
  const email = String(refs.authEmail?.value || "").trim();
  const password = String(refs.authPassword?.value || "");
  const displayName = String(refs.authName?.value || "").trim();
  try {
    const { error } = await authState.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });
    if (error) {
      setAuthMessage(formatSupabaseError(error, "Account creation failed."));
      return;
    }
  } catch (error) {
    setAuthMessage(formatSupabaseError(error, "Account creation failed."));
    return;
  }
  setAuthMessage("Account created. Check your inbox if email confirmation is enabled, then sign in.");
}

async function signOutCurrentUser() {
  if (!authState.client) return;
  try {
    await authState.client.auth.signOut();
  } catch (error) {
    setAuthMessage(formatSupabaseError(error, "Sign out failed."));
    return;
  }
  setAuthMessage("");
}

async function hydrateStateFromCloud() {
  if (!authState.client || !authState.user) return;

  authState.isHydrating = true;
  renderAuthUi();

  const fallback = loadStateForUser(authState.user.id) || loadLegacyLocalState() || createSeedState();
  authState.suppressCloudSave = true;

  let data = null;
  let error = null;
  try {
    const response = await authState.client
      .from(CLOUD_STATE_TABLE)
      .select("state_json")
      .eq("user_id", authState.user.id)
      .maybeSingle();
    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    console.error("Cloud state load failed:", error);
    state = normalizeState(fallback);
    authState.isHydrating = false;
    authState.suppressCloudSave = false;
    saveState({ skipCloud: true });
    setAuthMessage(formatSupabaseError(error, "Cloud note load failed."));
    render();
    return;
  }

  if (data?.state_json) {
    state = normalizeState(data.state_json);
  } else {
    state = normalizeState(fallback);
    authState.suppressCloudSave = false;
    await saveCloudStateNow();
    authState.suppressCloudSave = true;
  }

  authState.isHydrating = false;
  authState.suppressCloudSave = false;
  saveLocalState();
  render();
}

function setAuthMessage(message) {
  if (refs.authMessage) {
    refs.authMessage.textContent = message || "";
  }
}

function formatSupabaseError(error, fallback) {
  const rawMessage = String(error?.message || error?.error_description || error || fallback || "Supabase request failed.");
  if (/load failed|failed to fetch|networkerror|fetch failed|network request failed/i.test(rawMessage)) {
    const configuredUrl = String(window.SHIFTPAD_PUBLIC_CONFIG?.supabaseUrl || "").trim();
    const suffix = configuredUrl ? ` Current SUPABASE_URL is ${configuredUrl}.` : "";
    return `Cannot reach Supabase. Check that Vercel SUPABASE_URL is the exact Project URL from Supabase.${suffix}`;
  }
  return rawMessage;
}

function renderTimelineItem(item) {
  const { ward, note, entry } = item;
  const reminderText = getReminderEditorText(entry);
  const typeLabel = getReminderTypeLabel(entry.reminderType);
  const metadata = [
    ward.name,
    entry.bedTag ? `Bed ${entry.bedTag.toUpperCase()}` : "",
    typeLabel
  ].filter(Boolean);

  return `
    <article class="timeline-item reminder-row ${entry.done ? "is-done" : ""}">
      <label class="reminder-check" aria-label="${entry.done ? "Mark reminder open" : "Mark reminder done"}">
        <input
          type="checkbox"
          data-note-id="${escapeHtml(note.id)}"
          data-token-id="${escapeHtml(item.tokenId || "")}"
          ${entry.done ? "checked" : ""}
        />
        <span class="reminder-checkmark"></span>
      </label>
      <div class="reminder-main">
        <textarea
          class="summary-editor reminder-editor"
          data-summary-editor="true"
          data-note-id="${escapeHtml(note.id)}"
          data-line-index="${item.lineIndex}"
          aria-label="Reminder text"
        >${escapeHtml(reminderText)}</textarea>
        <div class="reminder-meta">
          ${metadata.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
        </div>
      </div>
      <span class="reminder-time-pill">${escapeHtml(formatReminderTimeLabel(entry.reminderTime || "No time"))}</span>
    </article>
  `;
}

function renderSummaryBedSection(groups) {
  if (!groups.length) {
    return `
      <section class="timeline-group">
        ${renderTimelineEmptyState("No bed info in this scope", "Open Notes")}
      </section>
    `;
  }

  return `
    <section class="timeline-group">
      <h3>Bed Summary</h3>
      <div class="timeline-list summary-bed-list">
        ${groups
          .map((group) => {
            return `
              <article class="timeline-item summary-bed-card">
                <strong>${escapeHtml(group.label)}</strong>
                <textarea
                  class="summary-editor bed-summary-editor"
                  data-bed-editor="true"
                  data-bed-key="${escapeHtml(group.key)}"
                  aria-label="Bed information"
                >${escapeHtml(group.combinedText)}</textarea>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSummaryTimedSection(items) {
  if (!items.length) {
    return `
      <section class="timeline-group">
        ${renderTimelineEmptyState("No reminders in this scope", "Open Notes")}
      </section>
    `;
  }

  const openItems = items.filter((item) => !item.entry.done);
  const doneItems = items.filter((item) => item.entry.done);

  return `
    <section class="timeline-group reminders-board">
      ${renderReminderListGroup("Open", openItems, `${openItems.length} active`)}
      ${doneItems.length ? renderReminderListGroup("Completed", doneItems, `${doneItems.length} done`) : ""}
    </section>
  `;
}

function renderTimelineEmptyState(title, actionLabel) {
  return `
    <div class="timeline-empty">
      <h3>${escapeHtml(title)}</h3>
      <button class="ghost-btn empty-action-btn" type="button" data-empty-action="notes">${escapeHtml(actionLabel)}</button>
    </div>
  `;
}

function renderReminderListGroup(title, items, countLabel) {
  if (!items.length) {
    return `
      <div class="reminder-section">
        <div class="reminder-section-head">
          <h3>${escapeHtml(title)}</h3>
          <span>${escapeHtml(countLabel)}</span>
        </div>
        <div class="reminder-list empty">
          <p class="helper-copy">No open reminders.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="reminder-section">
      <div class="reminder-section-head">
        <h3>${escapeHtml(title)}</h3>
        <span>${escapeHtml(countLabel)}</span>
      </div>
      <div class="reminder-list">
        ${items.map((item) => renderTimelineItem(item)).join("")}
      </div>
    </div>
  `;
}

function getReminderTypeLabel(type) {
  if (type === "time") return "Time";
  if (type === "lab") return "Lab";
  if (type === "io") return "I/O";
  return getKindMeta(type)?.label || "";
}

function formatReminderTimeLabel(value) {
  return String(value || "").replace(".", ":");
}

function renderQuickChip(key, label, extraClass = "") {
  return `
    <button class="quick-chip ${escapeHtml(extraClass)}" type="button" data-quick-tag="${escapeHtml(key)}">
      ${escapeHtml(label)}
    </button>
  `;
}

function renderMobileTagDock() {
  const expanded = uiState.mobileTagsOpen ? "true" : "false";
  return `
    <div class="mobile-tag-dock" data-mobile-tag-dock="true" aria-hidden="true">
      <div class="mobile-tag-tray" role="menu" aria-label="Insert tag">
        ${getAvailableQuickTags()
          .map((tag) => `<button class="mobile-tag-option ${escapeHtml(tag.className || "")}" type="button" data-mobile-tag="${escapeHtml(tag.key)}">${escapeHtml(tag.label)}</button>`)
          .join("")}
        <button class="mobile-tag-option muted" type="button" data-mobile-tag-close="true">Cancel</button>
      </div>
      <button class="mobile-tag-fab" type="button" data-mobile-tag-toggle="true" aria-expanded="${expanded}">
        Tags
      </button>
    </div>
  `;
}

function renderEntryChip(label, extraClass = "") {
  return `<span class="entry-chip ${escapeHtml(extraClass)}">${escapeHtml(label)}</span>`;
}

function getAvailableQuickTags() {
  return [
    { key: "bed", label: "Bed", className: "bed" },
    { key: "time", label: "Time", className: "timed" },
    { key: "lab", label: "Lab", className: "timed" },
    { key: "io", label: "I/O", className: "io" },
    ...getCustomTagDefinitions().map((tag) => ({
      key: tag.id,
      label: tag.label,
      className: tag.hasReminder ? "timed" : ""
    }))
  ];
}

function getPreferences() {
  state.preferences = normalizePreferences(state.preferences);
  return state.preferences;
}

function defaultPreferences() {
  return {
    singleWardMode: false,
    wardListCollapsed: false,
    tagDelays: {
      time: 0,
      lab: 60,
      io: 0
    },
    customTags: []
  };
}

function normalizePreferences(input = {}) {
  const defaults = defaultPreferences();
  return {
    singleWardMode: Boolean(input.singleWardMode),
    wardListCollapsed: Boolean(input.wardListCollapsed),
    tagDelays: {
      time: clampDelay(input.tagDelays?.time, defaults.tagDelays.time),
      lab: clampDelay(input.tagDelays?.lab, defaults.tagDelays.lab),
      io: clampDelay(input.tagDelays?.io, defaults.tagDelays.io)
    },
    customTags: Array.isArray(input.customTags)
      ? input.customTags
          .map((tag) => normalizeCustomTag(tag))
          .filter(Boolean)
      : []
  };
}

function normalizeCustomTag(tag) {
  const label = String(tag?.label || "").trim().slice(0, 18);
  if (!label) return null;
  return {
    id: String(tag.id || createCustomTagId(label)),
    label,
    hasReminder: Boolean(tag.hasReminder),
    delayMinutes: Math.max(0, clampDelay(tag.delayMinutes, 0))
  };
}

function getCustomTagDefinitions() {
  return getPreferences().customTags;
}

function getCustomTagDefinition(id) {
  return getCustomTagDefinitions().find((tag) => tag.id === id) || null;
}

function getKindMeta(type) {
  if (KIND_META[type]) return KIND_META[type];
  try {
    return getCustomTagDefinition(type) || null;
  } catch {
    return null;
  }
}

function isReminderTagType(type) {
  if (CORE_REMINDER_TAGS.includes(type)) return true;
  try {
    return Boolean(getCustomTagDefinition(type)?.hasReminder);
  } catch {
    return false;
  }
}

function clampDelay(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(-720, Math.min(720, Math.round(number)));
}

function handleQuickTag(tag) {
  const note = getCurrentNote();
  if (!note) return;
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return;

  editor.focus({ preventScroll: true });
  restoreSavedEditorSelection(editor);
  insertTagIntoEditor(editor, tag);

  note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
  note.updatedAt = Date.now();
  saveState();
  rememberEditorSelection(editor);
}

function isCompactMobileLayout() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function syncMobileTagDock() {
  const dock = refs.mobileTagRoot?.querySelector("[data-mobile-tag-dock]");
  if (!dock) return;

  const shouldShow = isCompactMobileLayout() && state.activeView === "notes" && uiState.editorFocused;
  const isOpen = shouldShow && uiState.mobileTagsOpen;
  dock.classList.toggle("is-visible", shouldShow);
  dock.classList.toggle("is-open", isOpen);
  dock.setAttribute("aria-hidden", String(!shouldShow));
  dock.querySelector("[data-mobile-tag-toggle]")?.setAttribute("aria-expanded", String(isOpen));
}

function refreshMobileTagDock() {
  if (!refs.mobileTagRoot) return;
  refs.mobileTagRoot.innerHTML = renderMobileTagDock();
  syncMobileTagDock();
}

function restoreEditorFocusAndSelection() {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return null;
  editor.focus({ preventScroll: true });
  restoreSavedEditorSelection(editor);
  uiState.editorFocused = true;
  rememberEditorSelection(editor);
  return editor;
}

function rememberEditorSelection(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return;
  uiState.savedSelection = selection.getRangeAt(0).cloneRange();
}

function rememberEditorTapScroll() {
  if (!isCompactMobileLayout()) return;
  const viewport = window.visualViewport;
  uiState.editorTapScroll = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportHeight: viewport?.height || window.innerHeight,
    viewportTop: viewport?.offsetTop || 0,
    timestamp: performance.now()
  };
}

function stabilizeEditorTapScroll(editor, attempt = 0) {
  const snapshot = uiState.editorTapScroll;
  if (!editor || !snapshot || !isCompactMobileLayout()) return;

  window.requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const now = performance.now();
    const viewportHeight = viewport?.height || window.innerHeight;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportChanged =
      Math.abs(viewportHeight - snapshot.viewportHeight) > 36 ||
      Math.abs(viewportTop - snapshot.viewportTop) > 36;
    const scrollDelta = Math.abs(window.scrollY - snapshot.scrollY);

    if (now - snapshot.timestamp > 900 || viewportChanged) {
      uiState.editorTapScroll = null;
      return;
    }

    if (scrollDelta < 48) {
      if (attempt < 1) {
        window.setTimeout(() => stabilizeEditorTapScroll(editor, attempt + 1), 60);
        return;
      }
      uiState.editorTapScroll = null;
      return;
    }

    const caretRect = getCaretRect() || getCurrentEditorLine()?.getBoundingClientRect();
    if (caretRect && wouldCaretBeVisibleAfterScroll(caretRect, snapshot.scrollY, viewportHeight, viewportTop)) {
      window.scrollTo({
        top: snapshot.scrollY,
        left: snapshot.scrollX
      });
      uiState.editorTapScroll = null;
      return;
    }

    if (attempt < 4) {
      window.setTimeout(() => stabilizeEditorTapScroll(editor, attempt + 1), 60);
    } else {
      uiState.editorTapScroll = null;
    }
  });
}

function wouldCaretBeVisibleAfterScroll(rect, targetScrollY, viewportHeight, viewportTop) {
  const projectedTop = rect.top + (window.scrollY - targetScrollY);
  const projectedBottom = rect.bottom + (window.scrollY - targetScrollY);
  const topLimit = viewportTop + 64;
  const bottomLimit = viewportTop + viewportHeight - 132;
  return projectedTop >= topLimit && projectedBottom <= bottomLimit;
}

function clearBedFinalizeTimer() {
  if (uiState.bedFinalizeTimer) {
    window.clearTimeout(uiState.bedFinalizeTimer);
    uiState.bedFinalizeTimer = null;
  }
}

function restoreEditorSelection(editor) {
  const selection = window.getSelection();
  if (!editor || !selection) return false;

  if (selection.rangeCount && isNodeInsideEditor(editor, selection.anchorNode)) {
    uiState.savedSelection = selection.getRangeAt(0).cloneRange();
    return true;
  }

  if (uiState.savedSelection) {
    selection.removeAllRanges();
    selection.addRange(uiState.savedSelection.cloneRange());
    return true;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  uiState.savedSelection = range.cloneRange();
  return true;
}

function restoreSavedEditorSelection(editor) {
  const selection = window.getSelection();
  if (!editor || !selection) return false;

  if (uiState.savedSelection) {
    selection.removeAllRanges();
    selection.addRange(uiState.savedSelection.cloneRange());
    return true;
  }

  return restoreEditorSelection(editor);
}

function keepEditorCaretVisible(editor) {
  if (!editor || !isCompactMobileLayout() || !uiState.editorFocused) return;

  const viewport = window.visualViewport;
  const rect = getCaretRect() || getCurrentEditorLine()?.getBoundingClientRect() || editor.getBoundingClientRect();
  const viewportTop = viewport?.offsetTop || 0;
  const viewportHeight = viewport?.height || window.innerHeight;
  const visibleTop = viewportTop + 72;
  const visibleBottom = viewportTop + viewportHeight - 132;

  if (rect.bottom > visibleBottom) {
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.bottom - visibleBottom),
      left: window.scrollX
    });
    return;
  }

  if (rect.top < visibleTop) {
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - visibleTop),
      left: window.scrollX
    });
  }
}

function getCaretRect() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);

  const rect = Array.from(range.getClientRects()).find((item) => item.width || item.height);
  if (rect) return rect;

  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  const savedRange = selection.getRangeAt(0).cloneRange();
  range.insertNode(marker);
  const markerRect = marker.getBoundingClientRect();
  marker.remove();
  selection.removeAllRanges();
  selection.addRange(savedRange);
  return markerRect;
}

function toggleTaggedLineDone(noteId, tokenId, done) {
  const note = findNoteById(noteId);
  if (!note || !tokenId) return;

  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const target = root.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
  if (!target) return;

  target.dataset.done = done ? "true" : "false";
  note.documentHtml = sanitizeEditorHtml(root.innerHTML);
  note.updatedAt = Date.now();
  saveState();
  render();
}

function ensureSelection() {
  if (!state.wards.length) {
    const fallbackWard = createWard("Ward A", WARD_COLORS[0]);
    fallbackWard.notes.push(createNote("Ward A handover", ""));
    state.wards.push(fallbackWard);
  }

  const wardExists = state.wards.some((ward) => ward.id === state.selectedWardId);
  if (!wardExists) {
    state.selectedWardId = state.wards[0].id;
  }

  const ward = getCurrentWard();
  if (!ward.notes.length) {
    ward.notes.push(createNote(`${ward.name} handover`, ""));
  }

  const noteExists = ward.notes.some((note) => note.id === state.selectedNoteId);
  if (!noteExists) {
    state.selectedNoteId = ward.notes[0].id;
  }
}

function getCurrentWard() {
  return state.wards.find((ward) => ward.id === state.selectedWardId) || null;
}

function getCurrentNote() {
  const ward = getCurrentWard();
  return ward?.notes.find((note) => note.id === state.selectedNoteId) || null;
}

function findNoteById(noteId) {
  for (const ward of state.wards) {
    const note = ward.notes.find((item) => item.id === noteId);
    if (note) return note;
  }
  return null;
}

function updateSummaryLineText(noteId, lineIndex, nextText) {
  const note = findNoteById(noteId);
  if (!note || !Number.isInteger(lineIndex) || lineIndex < 0) return;

  const { root, targets } = getEditableLineTargets(note);
  const target = targets[lineIndex];
  if (!target) return;

  writeLineText(target.element, nextText);
  note.documentHtml = sanitizeEditorHtml(root.innerHTML);
  note.updatedAt = Date.now();
  saveState();
}

function updateBedGroupText(bedKey, nextText) {
  if (!bedKey || !bedKey.includes(":")) return;

  const [wardId, bedLabelRaw] = bedKey.split(":");
  const bedLabel = String(bedLabelRaw || "").toUpperCase();
  const ward = state.wards.find((item) => item.id === wardId);
  if (!ward || !bedLabel) return;

  const segments = String(nextText || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  ward.notes.forEach((note) => {
    const { root, targets } = getBedLineTargets(note, bedLabel);
    if (!targets.length) return;

    targets.forEach((target, index) => {
      const remaining = segments.slice(index);
      const replacement =
        index === targets.length - 1 ? remaining.join("\n") : segments[index] || "";
      writeLineText(target.element, replacement);
    });

    note.documentHtml = sanitizeEditorHtml(root.innerHTML);
    note.updatedAt = Date.now();
  });

  saveState();
}

function getEditableLineTargets(note) {
  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const targets = [];

  Array.from(root.childNodes).forEach((node) => {
    if (!(node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName))) {
      return;
    }

    const parsed = parseLineNode(node);
    const bedTag = parsed.tags.find((tag) => tag.type === "bed");
    if (bedTag) return;

    const timeTag = parsed.tags.find((tag) => tag.type === "time");
    const primaryTag = parsed.tags.find((tag) => tag.type !== "time");
    const cleanedText = stripTagPrefixes(parsed.text, parsed.tags);
    const visibleText = parsed.visibleText.trim();
    if (!cleanedText && !timeTag && !primaryTag && !visibleText) return;

    targets.push({ element: node, parsed });
  });

  return { root, targets };
}

function getBedLineTargets(note, bedLabel) {
  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const targets = [];
  let currentBed = "";

  Array.from(root.childNodes).forEach((node) => {
    if (!(node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName))) {
      return;
    }

    const parsed = parseLineNode(node);
    const bedTag = parsed.tags.find((tag) => tag.type === "bed");
    if (bedTag) {
      currentBed = bedTag.text.replace(/^Bed\s*/i, "").trim().toUpperCase();
      return;
    }

    const timeTag = parsed.tags.find((tag) => tag.type === "time");
    const primaryTag = parsed.tags.find((tag) => tag.type !== "time");
    const cleanedText = stripTagPrefixes(parsed.text, parsed.tags);
    const visibleText = parsed.visibleText.trim();
    if (!cleanedText && !timeTag && !primaryTag && !visibleText) return;
    if (currentBed !== bedLabel) return;

    targets.push({ element: node, parsed });
  });

  return { root, targets };
}

function writeLineText(element, value) {
  const safeText = String(value || "").replace(/\r\n/g, "\n");
  const tagNodes = Array.from(element.childNodes).filter(
    (node) => node.nodeType === Node.ELEMENT_NODE && node.classList.contains("tag-token")
  );
  const reminderNode = tagNodes.find((node) => isReminderTagType(node.dataset.tag));
  const leadingTags = tagNodes.filter((node) => node !== reminderNode);
  let textBody = stripLeadingTagMentions(safeText, leadingTags.map((node) => node.textContent || ""));

  if (reminderNode) {
    const reminderText = (reminderNode.textContent || "").trim();
    const reminderIndex = textBody.indexOf(reminderText);

    if (reminderIndex >= 0) {
      const before = textBody.slice(0, reminderIndex);
      const after = textBody.slice(reminderIndex + reminderText.length);
      const pieces = [
        ...leadingTags.map((node) => node.outerHTML),
        textToHtml(before),
        reminderNode.outerHTML,
        textToHtml(after)
      ].filter(Boolean);
      element.innerHTML = pieces.join("");
      return;
    }

    textBody = stripLeadingTagMentions(textBody, [reminderText]);
    const pieces = [...leadingTags.map((node) => node.outerHTML), reminderNode.outerHTML, textToHtml(textBody)].filter(Boolean);
    element.innerHTML = pieces.join(" ");
    return;
  }

  const pieces = [...leadingTags.map((node) => node.outerHTML), textToHtml(textBody)].filter(Boolean);
  element.innerHTML = pieces.join(" ") || "<br>";
}

function textToHtml(value) {
  if (!value) return "";
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function stripLeadingTagMentions(text, tagTexts) {
  let next = String(text || "");
  tagTexts.forEach((tagText) => {
    const normalized = String(tagText || "").trim();
    if (!normalized) return;

    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`^\\s*${escaped}\\s*`, "i"), "");
  });
  return next;
}

function autoSizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, 44)}px`;
}

async function handleDrawerAction(action) {
  if (action === "logout" || action === "change-account") {
    await signOutCurrentUser();
    uiState.drawerOpen = false;
    render();
    return;
  }

  if (action === "change-password") {
    await changeCurrentPassword();
    return;
  }

  if (action === "enable-notifications") {
    await enablePushNotifications();
    return;
  }

  if (action === "disable-notifications") {
    await disablePushNotifications();
    return;
  }

  if (action === "add-ward") {
    addWard();
    return;
  }

  if (action === "reset-notes") {
    resetAllNotes();
  }
}

function getNotificationSupport() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return {
      supported: false,
      message: "This browser cannot receive web push notifications."
    };
  }

  const isLikelyIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  if (isLikelyIos && !isStandalone) {
    return {
      supported: false,
      message: "On iPhone, add ShiftPad to the Home Screen and open it from the icon before enabling notifications."
    };
  }

  return { supported: true, message: "" };
}

async function registerShiftPadServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    uiState.notificationStatus = "Notification setup failed while registering the app worker.";
    return null;
  }
}

async function enablePushNotifications() {
  const support = getNotificationSupport();
  if (!support.supported) {
    uiState.notificationStatus = support.message;
    renderDrawer();
    return;
  }

  if (!authState.session?.access_token) {
    uiState.notificationStatus = "Sign in before enabling notifications.";
    renderDrawer();
    return;
  }

  const publicKey = window.SHIFTPAD_PUBLIC_CONFIG?.vapidPublicKey;
  if (!publicKey) {
    uiState.notificationStatus = "Notification keys are not configured in Vercel yet.";
    renderDrawer();
    return;
  }

  try {
    uiState.notificationStatus = "Asking iPhone for notification permission...";
    renderDrawer();

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      uiState.notificationStatus = "Notifications were not allowed on this device.";
      renderDrawer();
      return;
    }

    const registration = (await navigator.serviceWorker.ready) || (await registerShiftPadServiceWorker());
    if (!registration?.pushManager) {
      uiState.notificationStatus = "Push notifications are not available in this browser.";
      renderDrawer();
      return;
    }

    const existingSubscription = await registration.pushManager.getSubscription();
    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      }));

    await savePushSubscription(subscription);
    uiState.notificationStatus = "Notifications are enabled for this device.";
  } catch (error) {
    console.error("Notification setup failed:", error);
    uiState.notificationStatus = formatPushError(error);
  }

  renderDrawer();
}

async function disablePushNotifications() {
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
    const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;
    if (subscription) {
      await removePushSubscription(subscription);
      await subscription.unsubscribe();
    }
    uiState.notificationStatus = "Notifications are disabled on this device.";
  } catch (error) {
    console.error("Notification disable failed:", error);
    uiState.notificationStatus = "Could not disable notifications. Try again from the Home Screen app.";
  }
  renderDrawer();
}

async function savePushSubscription(subscription) {
  const response = await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authState.session.access_token}`
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not save this device for notifications.");
  }
}

async function removePushSubscription(subscription) {
  if (!authState.session?.access_token) return;
  await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authState.session.access_token}`
    },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  }).catch(() => undefined);
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

function formatPushError(error) {
  const message = String(error?.message || error || "");
  if (/denied|permission/i.test(message)) {
    return "Notifications are blocked for this app in iOS Settings.";
  }
  if (/vapid|applicationServerKey|subscribe/i.test(message)) {
    return "Notification keys are not ready yet. Check Vercel VAPID env vars.";
  }
  return message || "Notification setup failed.";
}

async function changeCurrentPassword() {
  if (!authState.client || !authState.user) {
    setAuthMessage("Sign in before changing password.");
    renderAuthUi();
    return;
  }

  const nextPassword = window.prompt("Enter a new password for this account.");
  if (!nextPassword) return;
  if (nextPassword.length < 6) {
    window.alert("Password must be at least 6 characters.");
    return;
  }

  const { error } = await authState.client.auth.updateUser({ password: nextPassword });
  if (error) {
    setAuthMessage(formatSupabaseError(error, "Password update failed."));
  } else {
    setAuthMessage("Password updated.");
  }
  renderAuthUi();
}

function resetAllNotes() {
  if (!window.confirm("Reset all wards and notes? This cannot be undone.")) return;
  state = createBlankState();
  uiState.savedSelection = null;
  uiState.mobileTagsOpen = false;
  uiState.drawerOpen = false;
  uiState.wardOptionsOpen = false;
  saveState();
  render();
}

function addWard() {
  const ward = createWard(getNextWardName(), WARD_COLORS[state.wards.length % WARD_COLORS.length]);
  ward.notes.push(createNote(`${ward.name} handover`, "New patient list"));

  state.wards.push(ward);
  state.selectedWardId = ward.id;
  state.selectedNoteId = ward.notes[0].id;
  state.preferences.singleWardMode = false;
  saveState();
  render();
}

function selectWardScope(scope) {
  if (scope !== "all") return;
  state.timelineScope = "all";
  state.activeView = "timeline";
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  saveState();
  render();
}

function selectWardFromDrawer(wardId) {
  const ward = state.wards.find((item) => item.id === wardId);
  if (!ward) return;
  state.selectedWardId = ward.id;
  state.selectedNoteId = ward.notes[0]?.id || "";
  state.timelineScope = "active";
  saveState();
  render();
}

function updateMultipleWardsMode(enabled) {
  state.preferences.singleWardMode = !enabled;
  if (!enabled) {
    state.timelineScope = "active";
  }
  saveState();
  render();
}

function updateTagDelay(tag, value) {
  const preferences = getPreferences();
  if (!["time", "lab", "io"].includes(tag)) return;
  preferences.tagDelays[tag] = clampDelay(value, preferences.tagDelays[tag]);
  saveState();
  renderTimeline();
  renderDrawer();
}

function addCustomTagFromForm(form) {
  const formData = new FormData(form);
  const label = String(formData.get("label") || "").trim().slice(0, 18);
  if (!label) return;

  const preferences = getPreferences();
  preferences.customTags.push({
    id: createCustomTagId(label),
    label,
    hasReminder: formData.get("hasReminder") === "on",
    delayMinutes: Math.max(0, clampDelay(formData.get("delayMinutes"), 0))
  });
  saveState();
  render();
  form.reset();
}

function updateCustomTagDefinition(id, updates) {
  const tag = getCustomTagDefinition(id);
  if (!tag) return;
  if (Object.prototype.hasOwnProperty.call(updates, "hasReminder")) {
    tag.hasReminder = Boolean(updates.hasReminder);
  }
  if (Object.prototype.hasOwnProperty.call(updates, "delayMinutes")) {
    tag.delayMinutes = Math.max(0, clampDelay(updates.delayMinutes, tag.delayMinutes));
  }
  saveState();
  render();
}

function removeCustomTagDefinition(id) {
  const preferences = getPreferences();
  preferences.customTags = preferences.customTags.filter((tag) => tag.id !== id);
  saveState();
  render();
}

function createCustomTagId(label) {
  const slug = String(label || "tag")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "tag";
  return `custom-${slug}-${createId("tag").slice(-6)}`;
}

function buildReminderSubhead(item) {
  const parts = [item.ward.name];
  if (item.entry.bedTag) {
    parts.push(`Bed ${item.entry.bedTag.toUpperCase()}`);
  }
  const kindLabel = getKindMeta(item.entry.reminderType)?.label;
  if (kindLabel && item.entry.reminderType !== "time" && item.entry.reminderType !== "general") {
    parts.push(kindLabel);
  }
  return parts.join(" · ");
}

function getReminderEditorText(entry) {
  return entry.text || entry.visibleText || "";
}

function getScopedWards(scope) {
  return scope === "active" ? state.wards.filter((ward) => ward.id === state.selectedWardId) : state.wards;
}

function buildSummaryGroups(scope) {
  const wards = getScopedWards(scope);
  const timed = [];
  const bedMap = new Map();

  wards.forEach((ward) => {
    ward.notes.forEach((note) => {
      const parsed = extractTaggedLines(note);
      parsed.lines.forEach((line) => {
        const item = {
          ward,
          note,
          lineIndex: line.lineIndex,
          tokenId: line.reminderTokenId || line.primaryTokenId || "",
          entry: {
            done: line.done,
            timeTag: line.timeTag,
            text: line.text,
            visibleText: line.visibleText,
            timeAtStart: line.timeAtStart,
            summaryText: formatTimedSummaryLine(line),
            bedTag: line.bedLabel,
            kind: line.primaryKind,
            reminderType: line.reminderType
          }
        };

        getReminderTimesForLine(line).forEach((reminderTime, index) => {
          timed.push({
            ...item,
            tokenId: item.tokenId,
            entry: {
              ...item.entry,
              reminderTime
            }
          });
        });

        if (line.bedLabel) {
          const bedKey = `${ward.id}:${line.bedLabel.toUpperCase()}`;
          if (!bedMap.has(bedKey)) {
            bedMap.set(bedKey, {
              key: bedKey,
              label: `${ward.name} · Bed ${line.bedLabel.toUpperCase()}`,
              count: 0,
              latestTime: "",
              items: [],
              combinedText: ""
            });
          }
          const group = bedMap.get(bedKey);
          group.count += 1;
          const reminderTimes = getReminderTimesForLine(line);
          if (reminderTimes.length) {
            group.latestTime = reminderTimes[reminderTimes.length - 1];
          }
          group.items.push(item);
          group.combinedText = group.items.map((entryItem) => entryItem.entry.visibleText || entryItem.entry.text).filter(Boolean).join("\n");
        }
      });
    });
  });

  timed.sort((left, right) => {
    if (left.entry.done !== right.entry.done) {
      return Number(left.entry.done) - Number(right.entry.done);
    }
    return parseTime(left.entry.reminderTime) - parseTime(right.entry.reminderTime);
  });

  return {
    timed,
    byBed: Array.from(bedMap.values())
  };
}

function countBedsForWard(ward) {
  const beds = new Set();
  ward.notes.forEach((note) => {
    const parsed = extractTaggedLines(note);
    parsed.lines.forEach((line) => {
      if (line.bedLabel) {
        beds.add(line.bedLabel.toUpperCase());
      }
    });
  });
  return beds.size;
}

function getBedIndexForNote(note) {
  if (!note) return [];
  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const beds = [];

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE || !["DIV", "P"].includes(node.tagName)) return;
    const parsed = parseLineNode(node);
    const bedTag = parsed.tags.find((tag) => tag.type === "bed");
    if (!bedTag) return;
    const label = bedTag.text.replace(/^Bed\s*/i, "").trim().toUpperCase();
    if (label && !beds.includes(label)) {
      beds.push(label);
    }
  });

  return beds;
}

function createWard(name, color) {
  return {
    id: createId("ward"),
    name,
    color,
    notes: []
  };
}

function createNote(title, patientFocus) {
  const now = Date.now();
  return {
    id: createId("note"),
    title,
    patientFocus,
    shiftLabel: getShiftLabel(now),
    summary: "",
    createdAt: now,
    updatedAt: now,
    entries: [],
    documentHtml: ""
  };
}

function createEntry({ bedTag, timeTag, kind, text }) {
  return {
    id: createId("entry"),
    bedTag,
    timeTag,
    kind: getKindMeta(kind) ? kind : "general",
    text,
    done: false,
    createdAt: Date.now()
  };
}

function createSeedState() {
  const wardA = createWard("Ward A", WARD_COLORS[0]);
  const wardB = createWard("Ward B", WARD_COLORS[1]);

  const noteA = createNote("Respiratory handover", "Beds 12 to 16");
  noteA.summary = "Unwell patients clustered near the front bay. Watch labs and procedure timing through the morning.";
  noteA.entries = [
    createEntry({ bedTag: "12", timeTag: "07:30", kind: "lab", text: "CBC and magnesium sent. Chase result before consultant round." }),
    createEntry({ bedTag: "14", timeTag: "09:00", kind: "procedure", text: "Pleural tap planned. Keep consent form and post-procedure obs ready." }),
    createEntry({ bedTag: "15", timeTag: "", kind: "review", text: "Discuss repeat chest X-ray if oxygen need remains above baseline." })
  ];
  noteA.documentHtml = convertEntriesToDocumentHtml(noteA.entries);
  noteA.updatedAt = Date.now();

  const noteB = createNote("Overflow bay", "Recovery and procedure boarders");
  noteB.summary = "Mostly stable, but timed reviews matter because procedures are spread through the day.";
  noteB.entries = [
    createEntry({ bedTag: "3", timeTag: "10:15", kind: "followup", text: "Call family after endoscopy slot is confirmed." }),
    createEntry({ bedTag: "5", timeTag: "11:00", kind: "meds", text: "Restart anticoagulation only after GI team clears." })
  ];
  noteB.documentHtml = convertEntriesToDocumentHtml(noteB.entries);
  noteB.updatedAt = Date.now();

  wardA.notes.push(noteA);
  wardB.notes.push(noteB);

  return {
    activeView: "notes",
    selectedWardId: wardA.id,
    selectedNoteId: noteA.id,
    timelineScope: "all",
    summaryTab: "beds",
    preferences: defaultPreferences(),
    wards: [wardA, wardB]
  };
}

function createBlankState() {
  const ward = createWard("Ward A", WARD_COLORS[0]);
  const note = createNote("Ward A handover", "");
  ward.notes.push(note);
  return {
    activeView: "notes",
    selectedWardId: ward.id,
    selectedNoteId: note.id,
    timelineScope: "active",
    summaryTab: "reminders",
    preferences: defaultPreferences(),
    wards: [ward]
  };
}

function loadState() {
  return normalizeState(loadLegacyLocalState() || createSeedState());
}

function applyUrlOverrides() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");

  if (requestedView === "notes" || requestedView === "timeline") {
    state.activeView = requestedView;
  }
}

function normalizeState(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.wards) || !input.wards.length) {
    return createSeedState();
  }

  const wards = input.wards.map((ward, index) => {
    const notes = Array.isArray(ward.notes)
      ? ward.notes.map((note) => ({
          id: note.id || createId("note"),
          title: typeof note.title === "string" ? note.title : "",
          patientFocus: typeof note.patientFocus === "string" ? note.patientFocus : "",
          shiftLabel: typeof note.shiftLabel === "string" ? note.shiftLabel : getShiftLabel(Date.now()),
          summary: typeof note.summary === "string" ? note.summary : "",
          createdAt: Number(note.createdAt) || Date.now(),
          updatedAt: Number(note.updatedAt) || Number(note.createdAt) || Date.now(),
          documentHtml:
            typeof note.documentHtml === "string" && note.documentHtml.trim()
              ? note.documentHtml
              : convertEntriesToDocumentHtml(
                  Array.isArray(note.entries)
                    ? note.entries.map((entry) => ({
                        id: entry.id || createId("entry"),
                        bedTag: typeof entry.bedTag === "string" ? entry.bedTag : "",
                        timeTag: typeof entry.timeTag === "string" ? entry.timeTag : "",
                        kind: getKindMeta(entry.kind) ? entry.kind : "general",
                        text: typeof entry.text === "string" ? entry.text : "",
                        done: Boolean(entry.done),
                        createdAt: Number(entry.createdAt) || Date.now()
                      }))
                    : []
                ),
          entries: Array.isArray(note.entries)
            ? note.entries.map((entry) => ({
                id: entry.id || createId("entry"),
                bedTag: typeof entry.bedTag === "string" ? entry.bedTag : "",
                timeTag: typeof entry.timeTag === "string" ? entry.timeTag : "",
                kind: getKindMeta(entry.kind) ? entry.kind : "general",
                text: typeof entry.text === "string" ? entry.text : "",
                done: Boolean(entry.done),
                createdAt: Number(entry.createdAt) || Date.now()
              }))
            : []
        }))
      : [];

    return {
      id: ward.id || createId("ward"),
      name: typeof ward.name === "string" && ward.name.trim() ? ward.name : `Ward ${index + 1}`,
      color: typeof ward.color === "string" && ward.color ? ward.color : WARD_COLORS[index % WARD_COLORS.length],
      notes
    };
  });

  return {
    activeView: input.activeView === "timeline" ? "timeline" : "notes",
    selectedWardId: typeof input.selectedWardId === "string" ? input.selectedWardId : wards[0].id,
    selectedNoteId: typeof input.selectedNoteId === "string" ? input.selectedNoteId : wards[0].notes[0]?.id || "",
    timelineScope: input.timelineScope === "active" ? "active" : "all",
    summaryTab: input.summaryTab === "reminders" ? "reminders" : "beds",
    preferences: normalizePreferences(input.preferences),
    wards
  };
}

function saveState({ skipCloud = false } = {}) {
  saveLocalState();
  if (!skipCloud) {
    scheduleCloudSave();
  }
}

function saveLocalState() {
  try {
    const key = getScopedStorageKey(authState.user?.id);
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Local save failed:", error);
  }
}

function loadStateForUser(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getScopedStorageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadLegacyLocalState() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getScopedStorageKey(userId) {
  return `${STORAGE_NAMESPACE}:${userId || "anon"}`;
}

function scheduleCloudSave() {
  if (!authState.client || !authState.user || authState.suppressCloudSave) return;
  window.clearTimeout(authState.saveTimer);
  authState.saveTimer = window.setTimeout(() => {
    saveCloudStateNow().catch((error) => {
      console.error("Cloud save failed:", error);
      renderAuthUi();
    });
  }, CLOUD_SAVE_DEBOUNCE_MS);
}

async function saveCloudStateNow() {
  if (!authState.client || !authState.user || authState.suppressCloudSave) return;

  authState.isSaving = true;
  renderAuthUi();
  const payload = {
    user_id: authState.user.id,
    state_json: state,
    updated_at: new Date().toISOString()
  };

  const { error } = await authState.client.from(CLOUD_STATE_TABLE).upsert(payload, { onConflict: "user_id" });
  authState.isSaving = false;

  if (error) {
    console.error("Cloud save failed:", error);
    setAuthMessage(`Cloud save failed: ${error.message}`);
    renderAuthUi();
    return;
  }

  setAuthMessage("");
  renderAuthUi();
}

function getNextWardName() {
  const count = state.wards.length;
  if (count < 26) {
    return `Ward ${String.fromCharCode(65 + count)}`;
  }
  return `Ward ${count + 1}`;
}

function getShiftLabel(timestamp) {
  return getShiftDurationHours(timestamp) === 24 ? "24 hr shift" : "16 hr shift";
}

function getShiftDurationHours(timestamp) {
  const created = new Date(Number(timestamp) || Date.now());
  const minutes = created.getHours() * 60 + created.getMinutes();
  return minutes < 14 * 60 + 30 ? 24 : 16;
}

function parseTime(value) {
  const normalized = normalizeTimeTagValue(value);
  if (!normalized || !/^\d{1,2}\.\d{2}$/.test(normalized)) return Number.MAX_SAFE_INTEGER;
  const [hours, minutes] = normalized.split(".").map(Number);
  return hours * 60 + minutes;
}

function formatTimeFromMinutes(totalMinutes) {
  const safe = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${hours}.${String(minutes).padStart(2, "0")}`;
}

function addHoursToTime(value, hoursToAdd) {
  const parsed = parseTime(value);
  if (parsed === Number.MAX_SAFE_INTEGER) return value;
  return formatTimeFromMinutes(parsed + hoursToAdd * 60);
}

function addMinutesToTime(value, minutesToAdd) {
  const parsed = parseTime(value);
  if (parsed === Number.MAX_SAFE_INTEGER) return value;
  return formatTimeFromMinutes(parsed + Number(minutesToAdd || 0));
}

function formatTimeFromTimestamp(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return formatTimeFromMinutes(date.getHours() * 60 + date.getMinutes());
}

function showBedIndexDuringScroll() {
  if (state.activeView !== "notes" || uiState.editorFocused) return;
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  const rail = refs.editorRoot.querySelector(".bed-index-rail");
  if (!editor || !rail) return;
  const rect = editor.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (rect.bottom < 120 || rect.top > viewportHeight - 80) return;

  setBedIndexVisible(true);
  window.clearTimeout(uiState.bedIndexTimer);
  uiState.bedIndexTimer = window.setTimeout(() => setBedIndexVisible(false), 1100);
}

function setBedIndexVisible(visible) {
  uiState.bedIndexVisible = Boolean(visible);
  refs.editorRoot.querySelector(".bed-index-rail")?.classList.toggle("is-visible", Boolean(visible));
}

function hideBedIndex() {
  window.clearTimeout(uiState.bedIndexTimer);
  setBedIndexVisible(false);
}

function jumpToBedInEditor(bedLabel) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor || !bedLabel) return;
  const target = Array.from(editor.querySelectorAll('.tag-token[data-tag="bed"]')).find((token) => {
    const label = String(token.textContent || "").replace(/^Bed\s*/i, "").trim().toUpperCase();
    return label === String(bedLabel).toUpperCase();
  });
  const line = target?.closest("div, p") || target;
  if (!line) return;
  line.scrollIntoView({ behavior: "smooth", block: "center" });
  setBedIndexVisible(true);
  window.clearTimeout(uiState.bedIndexTimer);
  uiState.bedIndexTimer = window.setTimeout(() => setBedIndexVisible(false), 900);
}

function formatClock(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function formatLongDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(timestamp);
}

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function getNoteDocumentHtml(note) {
  if (typeof note.documentHtml === "string" && note.documentHtml.trim()) {
    return note.documentHtml;
  }

  note.documentHtml = convertEntriesToDocumentHtml(Array.isArray(note.entries) ? note.entries : []);
  return note.documentHtml;
}

function convertEntriesToDocumentHtml(entries) {
  if (!entries.length) {
    return '<div><br></div>';
  }

  let previousBed = "";
  const parts = [];

  entries
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt)
    .forEach((entry) => {
      const bed = String(entry.bedTag || "").trim().toUpperCase();
      if (bed && bed !== previousBed) {
        parts.push(
          `<div><span class="tag-token tag-bed" data-tag="bed" data-token-id="${escapeAttribute(createId("tag"))}">Bed ${escapeHtml(
            bed
          )}</span></div>`
        );
        previousBed = bed;
      }

      const lineBits = [];
      if (entry.kind && entry.kind !== "general") {
        lineBits.push(
          `<span class="tag-token tag-${escapeAttribute(entry.kind)}" contenteditable="false" data-tag="${escapeAttribute(
            entry.kind
          )}" data-token-id="${escapeAttribute(createId("tag"))}">${escapeHtml(getKindMeta(entry.kind)?.label || entry.kind)}</span>`
        );
      }
      if (entry.timeTag) {
        lineBits.push(
          `<span class="tag-token tag-time" data-tag="time" data-token-id="${escapeAttribute(createId("tag"))}" data-done="${
            entry.done ? "true" : "false"
          }">${escapeHtml(entry.timeTag)}</span>`
        );
      }
      lineBits.push(escapeHtml(entry.text).replace(/\n/g, "<br>"));
      parts.push(`<div>${lineBits.join(" ")}</div>`);
    });

  return parts.join("");
}

function handleNotepadKeydown(event) {
  if (handleEditorSpecialKey(event.key, { shiftKey: event.shiftKey, keyboardEvent: event })) {
    event.preventDefault();
  }
}

function handleNotepadBeforeInput(event) {
  const inputType = event.inputType || "";
  const isDeleteInput = inputType === "deleteContentBackward" || inputType === "deleteContentForward";

  if (inputType === "insertParagraph") {
    discardFreshFinalizedTagInsertions();
    const activeToken = getActiveTagToken();
    if (activeToken && isTimeLikeTag(activeToken.dataset.tag) && activeToken.dataset.editing === "true") {
      finalizeTagToken(activeToken, { moveToNewLine: true });
      return true;
    }

    const bedLine = getCurrentEditingBedLine();
    if (bedLine) {
      finalizeEditingBedLine(bedLine);
      return true;
    }
  }

  if (isDeleteInput) {
    if (uiState.suppressNextDeleteInput) {
      uiState.suppressNextDeleteInput = false;
      return true;
    }

    const activeToken = getActiveTagToken();
    if (activeToken && shouldDeleteEditingTag(activeToken)) {
      removeTagToken(activeToken);
      syncEditorDocument();
      return true;
    }

    const freshToken = getFreshFinalizedTagForDelete(event.target.closest?.("#notepad-editor"), inputType);
    if (freshToken) {
      const pendingInsertion = getPendingTagInsertion(freshToken);
      removeTagToken(freshToken, { restoreRepair: false });
      syncEditorDocument();
      restorePendingInsertionTextOffset(pendingInsertion);
      return true;
    }

    const bedLine = getCurrentEditingBedLine();
    if (bedLine && isEditingBedLineEmpty(bedLine)) {
      removeEditingBedLine(bedLine);
      syncEditorDocument();
      return true;
    }
  } else if (inputType.startsWith("insert") || inputType === "formatSetBlockTextDirection") {
    discardFreshFinalizedTagInsertions();
  }

  return false;
}

function handleEditorSpecialKey(key, { shiftKey = false, keyboardEvent = null } = {}) {
  const editingBedLine = getCurrentEditingBedLine();
  if (editingBedLine) {
    if (key === "Escape") {
      removeEditingBedLine(editingBedLine);
      syncEditorDocument();
      return true;
    }

    if (key === "Enter" || key === "Tab") {
      finalizeEditingBedLine(editingBedLine);
      return true;
    }
  }

  const token = getActiveTagToken();
  if (token) {
    if (key === "Escape") {
      removeTagToken(token);
      syncEditorDocument();
      return true;
    }

    const tagType = token.dataset.tag;
    if (tagType === "bed" && (key === " " || key === "Tab")) {
      finalizeTagToken(token, { moveToNewLine: true });
      return true;
    }

    if (isTimeLikeTag(tagType) && token.dataset.editing === "true") {
      if (key === " " || key === "Tab") {
        finalizeTagToken(token, { moveToNewLine: false });
        return true;
      }

      const isPrintable = keyboardEvent ? isPrintableKey(keyboardEvent) : key.length === 1;
      if (isPrintable && !isTimeEditingCharacter(key)) {
        if (isDefaultEditingTimeToken(token)) {
          removeTagToken(token, { restoreRepair: false });
          insertTextAtSelection(key);
          syncEditorDocument();
          return true;
        }
        finalizeTagToken(token, { moveToNewLine: false });
        insertTextAtSelection(key);
        syncEditorDocument();
        return true;
      }
    }

    if (tagType === "bed" && key === "Enter") {
      finalizeTagToken(token, { moveToNewLine: true });
      return true;
    }

    if (isTimeLikeTag(tagType) && key === "Enter") {
      finalizeTagToken(token, { moveToNewLine: true });
      return true;
    }
  }

  if (key === "Enter" && !shiftKey) {
    const currentLine = getCurrentEditorLine();
    if (currentLine?.classList.contains("timed-line") || currentLine?.classList.contains("io-line")) {
      placeCaretOnNewLine(currentLine);
      syncEditorDocument();
      return true;
    }
  }

  return false;
}

function insertTagIntoEditor(editor, tag) {
  const selection = window.getSelection();
  const hasEditorSelection =
    selection &&
    selection.rangeCount &&
    isNodeInsideEditor(editor, selection.anchorNode);

  if (!hasEditorSelection) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  const insertionPoint = getEditorSelectionPoint(editor);

  if (tag === "bed") {
    const tokenId = createId("tag");
    const line = insertEditorLine(
      editor,
      `<span class="tag-token tag-bed tag-editing" contenteditable="false" data-tag="bed" data-token-id="${escapeAttribute(
        tokenId
      )}" data-editing="true">Bed</span>&nbsp;`
    );
    rememberPendingTagInsertion(tokenId, editor, insertionPoint);
    placeCaretAtEndOfLine(line);
    rememberEditorSelection(editor);
    return;
  }

  if (tag === "time" || tag === "lab") {
    const tokenId = createId("tag");
    insertHtmlAtSelection(
      `<span class="tag-token tag-${escapeAttribute(tag)} tag-editing" data-tag="${escapeAttribute(tag)}" data-token-id="${escapeAttribute(
        tokenId
      )}" data-done="false" data-editing="true">00.00</span>&nbsp;`
    );
    const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
    rememberPendingTagInsertion(tokenId, editor, insertionPoint);
    placeCaretInsideTag(inserted, true);
    return;
  }

  if (tag === "io") {
    const tokenId = createId("tag");
    insertHtmlAtSelection(
      `<span class="tag-token tag-io" contenteditable="false" data-tag="io" data-token-id="${escapeAttribute(
        tokenId
      )}" data-done="false">I/O</span>&nbsp;`
    );
    const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
    rememberPendingTagInsertion(tokenId, editor, insertionPoint, { finalized: true });
    placeCaretAfterNode(inserted, true);
    syncEditorDocument();
    return;
  }

  const tokenId = createId("tag");
  const label = getKindMeta(tag)?.label || tag;
  insertHtmlAtSelection(
    `<span class="tag-token tag-${escapeAttribute(tag)}" contenteditable="false" data-tag="${escapeAttribute(tag)}" data-token-id="${escapeAttribute(
      tokenId
    )}">${escapeHtml(label)}</span>&nbsp;`
  );
  const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
  placeCaretAfterNode(inserted, true);
}

function isNodeInsideEditor(editor, node) {
  if (!editor || !node) return false;
  let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (current) {
    if (current === editor) return true;
    current = current.parentNode;
  }
  return false;
}

function insertHtmlAtSelection(html) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const currentLine = getCurrentEditorLine();
  if (currentLine && isEditorLineEmpty(currentLine)) {
    currentLine.innerHTML = "";
    range.selectNodeContents(currentLine);
    range.collapse(true);
  } else {
    range.deleteContents();
  }
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const marker = document.createTextNode("");
  fragment.appendChild(marker);
  range.insertNode(fragment);

  if (!marker.parentNode) return;
  range.setStartBefore(marker);
  range.collapse(true);
  marker.remove();
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertEditorLine(editor, html) {
  const line = document.createElement("div");
  line.innerHTML = html || "<br>";

  const currentLine = getCurrentEditorLine();
  if (currentLine && currentLine.parentNode === editor) {
    if (isEditorLineEmpty(currentLine)) {
      currentLine.replaceWith(line);
      return line;
    }

    editor.insertBefore(line, currentLine.nextSibling);
    return line;
  }

  editor.appendChild(line);
  return line;
}

function getEditorSelectionPoint(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return null;

  const line = getCurrentEditorLine();
  return {
    node: selection.anchorNode,
    offset: selection.anchorOffset,
    line,
    lineHtml: line?.innerHTML || "",
    textOffset: line ? getTextOffsetWithinLine(line, selection.anchorNode, selection.anchorOffset) : 0
  };
}

function rememberPendingTagInsertion(tokenId, editor, point, options = {}) {
  if (!tokenId || !editor || !point?.node) return;
  uiState.pendingTagInsertions.set(tokenId, {
    editor,
    node: point.node,
    offset: point.offset,
    line: point.line,
    lineHtml: point.lineHtml,
    textOffset: point.textOffset,
    finalized: Boolean(options.finalized)
  });
}

function getTextOffsetWithinLine(line, anchorNode, anchorOffset) {
  if (!line || !anchorNode) return 0;
  let offset = 0;
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node === anchorNode) {
      return offset + Math.min(anchorOffset, node.textContent.length);
    }
    offset += node.textContent.length;
    node = walker.nextNode();
  }
  return offset;
}

function insertTextAtSelection(text) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const currentLine = getCurrentEditorLine();
  if (currentLine && isEditorLineEmpty(currentLine)) {
    currentLine.innerHTML = "";
    range.selectNodeContents(currentLine);
    range.collapse(true);
  } else {
    range.deleteContents();
  }
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (editor) {
    rememberEditorSelection(editor);
  }
}

function placeCaretInsideTag(node, selectAll = false) {
  if (!node) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();

  if (selectAll) {
    range.selectNodeContents(node);
  } else {
    range.selectNodeContents(node);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAfterNode(node, insertSpace = false) {
  if (!node) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  if (insertSpace) {
    insertTextAtSelection(" ");
  }
}

function insertParagraphAtSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  let line = getCurrentEditorLine();
  if (!line) {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (!editor) return;
    line = document.createElement("div");
    line.innerHTML = "<br>";
    editor.appendChild(line);
  }

  const newLine = document.createElement("div");
  newLine.innerHTML = "<br>";

  if (line.nextSibling) {
    line.parentNode.insertBefore(newLine, line.nextSibling);
  } else {
    line.parentNode.appendChild(newLine);
  }

  range.selectNodeContents(newLine);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function deleteBackwardAtSelection(editor) {
  const selection = window.getSelection();
  if (!editor || !selection) return;
  restoreEditorSelection(editor);

  const activeToken = getActiveTagToken();
  if (activeToken && shouldDeleteEditingTag(activeToken)) {
    removeTagToken(activeToken);
    syncEditorDocument();
    rememberEditorSelection(editor);
    return;
  }

  if (activeToken && activeToken.dataset.editing === "true") {
    const textNode = activeToken.firstChild;
    const offset = selection.anchorOffset;
    if (textNode?.nodeType === Node.TEXT_NODE && offset > 0) {
      textNode.textContent = `${textNode.textContent.slice(0, offset - 1)}${textNode.textContent.slice(offset)}`;
      const range = document.createRange();
      range.setStart(textNode, Math.max(0, offset - 1));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      syncEditorDocument();
      rememberEditorSelection(editor);
      return;
    }
  }

  if (!selection.isCollapsed) {
    selection.deleteFromDocument();
    syncEditorDocument();
    rememberEditorSelection(editor);
    return;
  }

  if (typeof selection.modify === "function") {
    selection.modify("extend", "backward", "character");
    if (!selection.isCollapsed) {
      selection.deleteFromDocument();
      syncEditorDocument();
      rememberEditorSelection(editor);
      return;
    }
  }

  const currentLine = getCurrentEditorLine();
  if (currentLine && currentLine.previousSibling) {
    const previousLine = currentLine.previousSibling;
    const mergedText = currentLine.innerHTML === "<br>" ? "" : currentLine.innerHTML;
    if (previousLine.innerHTML === "<br>") {
      previousLine.innerHTML = mergedText || "<br>";
    } else if (mergedText) {
      previousLine.insertAdjacentHTML("beforeend", mergedText);
    }
    currentLine.remove();
    placeCaretAfterNode(previousLine.lastChild || previousLine);
    syncEditorDocument();
    rememberEditorSelection(editor);
  }
}

function removeTagToken(token, { restoreRepair = true } = {}) {
  if (!token) return;
  clearBedFinalizeTimer();
  const parent = token.parentNode;
  const line = findEditorLine(token);
  const pendingInsertion = consumePendingTagInsertion(token);
  if (pendingInsertion) {
    removeInsertedTagSpacer(token);
  }
  token.remove();
  if (parent?.firstChild?.nodeType === Node.TEXT_NODE) {
    parent.firstChild.textContent = parent.firstChild.textContent.replace(/^\u00a0+/, "");
  }
  if (parent && parent.textContent.trim() === "") {
    parent.innerHTML = "<br>";
  }
  if (line) {
    refreshLineTagClasses(line);
    if (pendingInsertion && restorePendingTagInsertionCaret(pendingInsertion, { scheduleRepair: restoreRepair })) {
      return;
    }
    placeCaretInsideLine(line);
  }
}

function consumePendingTagInsertion(token) {
  const tokenId = token?.dataset?.tokenId;
  if (!tokenId || !uiState.pendingTagInsertions.has(tokenId)) return null;
  const pending = uiState.pendingTagInsertions.get(tokenId);
  uiState.pendingTagInsertions.delete(tokenId);
  return pending;
}

function getPendingTagInsertion(token) {
  const tokenId = token?.dataset?.tokenId;
  if (!tokenId || !uiState.pendingTagInsertions.has(tokenId)) return null;
  return uiState.pendingTagInsertions.get(tokenId);
}

function discardPendingTagInsertion(token) {
  const pending = consumePendingTagInsertion(token);
  pending?.marker?.remove();
}

function discardFreshFinalizedTagInsertions() {
  Array.from(uiState.pendingTagInsertions.entries()).forEach(([tokenId, pending]) => {
    if (pending?.finalized) {
      uiState.pendingTagInsertions.delete(tokenId);
    }
  });
}

function getFreshFinalizedTagForDelete(editor, inputType) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return null;

  const searchBackward = inputType !== "deleteContentForward";
  let node = selection.anchorNode;
  let offset = selection.anchorOffset;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    if (searchBackward && text.slice(0, offset).replace(/[\s\u00a0\u200b]/g, "")) return null;
    if (!searchBackward && text.slice(offset).replace(/[\s\u00a0\u200b]/g, "")) return null;
  }

  let candidate = searchBackward
    ? getPreviousMeaningfulNode(node, offset, editor)
    : getNextMeaningfulNode(node, offset, editor);
  if (candidate?.nodeType === Node.TEXT_NODE && !candidate.textContent.replace(/[\s\u00a0\u200b]/g, "")) {
    candidate = searchBackward
      ? getPreviousMeaningfulNode(candidate, 0, editor)
      : getNextMeaningfulNode(candidate, candidate.textContent.length, editor);
  }
  if (candidate?.nodeType === Node.TEXT_NODE && candidate.parentElement?.classList?.contains("tag-token")) {
    candidate = candidate.parentElement;
  }

  if (!candidate?.classList?.contains("tag-token")) return null;
  const tokenId = candidate.dataset.tokenId;
  const pending = tokenId ? uiState.pendingTagInsertions.get(tokenId) : null;
  return pending?.finalized ? candidate : null;
}

function getPreviousMeaningfulNode(node, offset, editor) {
  let current = node;
  let childOffset = offset;

  while (current && current !== editor) {
    if (current.nodeType === Node.TEXT_NODE) {
      if (childOffset > 0) {
        return current;
      }
    } else if (current.childNodes?.length && childOffset > 0) {
      return getDeepestRightNode(current.childNodes[childOffset - 1]);
    }

    if (current.previousSibling) {
      return getDeepestRightNode(current.previousSibling);
    }
    childOffset = Array.prototype.indexOf.call(current.parentNode?.childNodes || [], current);
    current = current.parentNode;
  }

  return null;
}

function getNextMeaningfulNode(node, offset, editor) {
  let current = node;
  let childOffset = offset;

  while (current && current !== editor) {
    if (current.nodeType === Node.TEXT_NODE) {
      if (childOffset < current.textContent.length) {
        return current;
      }
    } else if (current.childNodes?.length && childOffset < current.childNodes.length) {
      return getDeepestLeftNode(current.childNodes[childOffset]);
    }

    if (current.nextSibling) {
      return getDeepestLeftNode(current.nextSibling);
    }
    childOffset = Array.prototype.indexOf.call(current.parentNode?.childNodes || [], current) + 1;
    current = current.parentNode;
  }

  return null;
}

function getDeepestRightNode(node) {
  let current = node;
  while (current?.lastChild) {
    current = current.lastChild;
  }
  return current;
}

function getDeepestLeftNode(node) {
  let current = node;
  while (current?.firstChild) {
    current = current.firstChild;
  }
  return current;
}

function restorePendingInsertionTextOffset(pending) {
  if (!pending?.line || !document.contains(pending.line)) return;
  const currentText = String(pending.line.textContent || "").replace(/\u00a0/g, " ").trimEnd();
  const expectedText = getPlainTextFromHtml(pending.lineHtml).replace(/\u00a0/g, " ").trimEnd();
  if (currentText === expectedText && pending.line.innerHTML !== pending.lineHtml) {
    pending.line.innerHTML = pending.lineHtml || "<br>";
  }
  placeCaretAtTextOffset(pending.line, pending.textOffset);
  if (pending.editor && document.contains(pending.editor)) {
    rememberEditorSelection(pending.editor);
  }
}

function restorePendingTagInsertionCaret(pending, { scheduleRepair = true } = {}) {
  const selection = window.getSelection();
  if (!selection || !pending?.editor || !pending?.node) return false;
  if (!document.contains(pending.editor)) return false;
  if (!document.contains(pending.node)) return false;

  try {
    const range = document.createRange();
    if (pending.node.nodeType === Node.TEXT_NODE) {
      range.setStart(pending.node, Math.min(pending.offset, pending.node.textContent.length));
    } else {
      range.setStart(pending.node, Math.min(pending.offset, pending.node.childNodes.length));
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    rememberEditorSelection(pending.editor);
    if (scheduleRepair) {
      schedulePendingTagDeleteRepair(pending);
    }
    return true;
  } catch {
    return false;
  }
}

function schedulePendingTagDeleteRepair(pending) {
  if (!pending?.line || !document.contains(pending.line) || !pending.lineHtml) return;

  window.setTimeout(() => {
    if (!document.contains(pending.line)) return;
    const currentText = String(pending.line.textContent || "").replace(/\u200b/g, "");
    const expected = getPlainTextFromHtml(pending.lineHtml);
    if (currentText === expected) {
      placeCaretAtTextOffset(pending.line, pending.textOffset);
      const editor = refs.editorRoot.querySelector("#notepad-editor");
      if (editor) {
        rememberEditorSelection(editor);
      }
      return;
    }

    pending.line.innerHTML = pending.lineHtml;
    placeCaretAtTextOffset(pending.line, pending.textOffset);
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (editor) {
      syncEditorDocument();
      rememberEditorSelection(editor);
    }
  }, 0);
}

function getPlainTextFromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  template.content.querySelectorAll?.("[data-pending-tag-marker], [data-caret-marker]").forEach((marker) => marker.remove());
  return String(template.content.textContent || "").replace(/\u200b/g, "");
}

function placeCaretAtTextOffset(line, targetOffset) {
  const selection = window.getSelection();
  if (!line || !selection) return;

  let remaining = Math.max(0, targetOffset);
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent.length;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }

  placeCaretAtEndOfLine(line);
}

function removeInsertedTagSpacer(token) {
  const next = token?.nextSibling;
  if (next?.nodeType !== Node.TEXT_NODE) return;
  next.textContent = String(next.textContent || "").replace(/^[\u00a0 ]+/, "");
  if (!next.textContent) {
    next.remove();
  }
}

function shouldDeleteEditingTag(token) {
  if (!token || token.dataset.editing !== "true") return false;
  const selection = window.getSelection();
  const text = String(token.textContent || "").replace(/\u00a0/g, " ").trim();

  if (token.dataset.tag === "bed") {
    return text.replace(/^Bed\s*/i, "").trim() === "";
  }

  if (isTimeLikeTag(token.dataset.tag)) {
    if (!selection) return text === "" || text === "00.00";
    const selectedText = String(selection.toString() || "").replace(/\u00a0/g, " ").trim();
    return text === "" || text === "00.00" || selectedText === text;
  }

  return text === "";
}

function isDefaultEditingTimeToken(token) {
  if (!token || !isTimeLikeTag(token.dataset.tag) || token.dataset.editing !== "true") return false;
  const text = String(token.textContent || "").replace(/\u00a0/g, " ").trim();
  const selectedText = String(window.getSelection()?.toString() || "").replace(/\u00a0/g, " ").trim();
  return text === "00.00" && selectedText === text;
}

function refreshLineTagClasses(line) {
  if (!line) return;
  line.classList.toggle("timed-line", Boolean(line.querySelector('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]')));
  line.classList.toggle("io-line", Boolean(line.querySelector('.tag-token[data-tag="io"]')));
}

function placeCaretInsideLine(line) {
  const selection = window.getSelection();
  if (!line || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(line);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEndOfLine(line) {
  const selection = window.getSelection();
  if (!line || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(line);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getCurrentEditingBedLine() {
  const line = getCurrentEditorLine();
  if (!line) return null;
  return line.querySelector('.tag-token[data-tag="bed"][data-editing="true"]') ? line : null;
}

function getEditingBedToken(line) {
  return line?.querySelector?.('.tag-token[data-tag="bed"][data-editing="true"]') || null;
}

function isEditingBedLineEmpty(line) {
  return getEditableTextFromLine(line).trim() === "";
}

function getEditableTextFromLine(line) {
  if (!line) return "";
  const clone = line.cloneNode(true);
  clone.querySelectorAll(".tag-token").forEach((token) => token.remove());
  return String(clone.textContent || "").replace(/\u00a0/g, " ");
}

function isEditorLineEmpty(line) {
  if (!line) return true;
  const clone = line.cloneNode(true);
  clone.querySelectorAll("[data-pending-tag-marker], [data-caret-marker]").forEach((marker) => marker.remove());
  const text = String(clone.textContent || "").replace(/\u00a0/g, " ").trim();
  return !text || clone.innerHTML.trim() === "<br>";
}

function finalizeEditingBedLine(line) {
  const token = getEditingBedToken(line);
  if (!token) return;

  const bedValue = getEditableTextFromLine(line).trim();
  if (!bedValue) {
    removeEditingBedLine(line);
    syncEditorDocument();
    return;
  }

  clearBedFinalizeTimer();
  token.textContent = `Bed ${bedValue}`;
  token.setAttribute("contenteditable", "false");
  token.dataset.editing = "false";
  token.classList.remove("tag-editing");
  discardPendingTagInsertion(token);
  line.replaceChildren(token);
  refreshLineTagClasses(line);
  placeCaretOnNewLine(line);
  syncEditorDocument();
}

function removeEditingBedLine(line) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!line || !editor) return;
  const token = getEditingBedToken(line);
  const pendingInsertion = consumePendingTagInsertion(token);

  const nextLine = line.nextElementSibling;
  const previousLine = line.previousElementSibling;
  if (editor.children.length <= 1) {
    line.innerHTML = "<br>";
    if (!pendingInsertion || !restorePendingTagInsertionCaret(pendingInsertion)) {
      placeCaretInsideLine(line);
    }
    return;
  }

  line.remove();
  if (!pendingInsertion || !restorePendingTagInsertionCaret(pendingInsertion)) {
    placeCaretInsideLine(nextLine || previousLine || editor);
  }
}

function getActiveTagToken() {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return null;

  let node = selection.anchorNode.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentNode : selection.anchorNode;
  while (node && node !== refs.editorRoot) {
    if (node.classList && node.classList.contains("tag-token")) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

function getCurrentEditorLine() {
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode) return null;

  let node = selection.anchorNode.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentNode : selection.anchorNode;
  while (node && node !== refs.editorRoot) {
    if (node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)) {
      return node;
    }
    node = node.parentNode;
  }

  return null;
}

function sanitizeEditorHtml(html) {
  const root = parseHtmlRoot(typeof html === "string" ? html : "");
  normalizeEditorBlocks(root);
  return root.innerHTML.trim() || "<div><br></div>";
}

function parseHtmlRoot(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html || ""}</div>`, "text/html");
  return doc.getElementById("root");
}

function extractTaggedLines(note) {
  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const rawLines = [];

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)) {
      rawLines.push(parseLineNode(node));
      return;
    }

    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const wrapper = root.ownerDocument.createElement("div");
      wrapper.textContent = node.textContent;
      rawLines.push(parseLineNode(wrapper));
    }
  });

  const lines = [];
  let currentBed = "";

  rawLines.forEach((line) => {
    const bedTag = line.tags.find((tag) => tag.type === "bed");
    if (bedTag) {
      currentBed = bedTag.text.replace(/^Bed\s*/i, "").trim();
      return;
    }

    const reminderTag = line.tags.find((tag) => isReminderTagType(tag.type));
    const timeTag = reminderTag && reminderTag.type !== "io" ? reminderTag : null;
    const primaryTag = line.tags.find((tag) => tag.type !== "bed" && !isReminderTagType(tag.type));
    const cleanedText = stripTagPrefixes(line.text, line.tags);
    const visibleText = line.visibleText.trim();
    if (!cleanedText && !reminderTag && !primaryTag && !visibleText) {
      return;
    }

    lines.push({
      lineIndex: lines.length,
      text: cleanedText,
      visibleText,
      bedLabel: currentBed,
      timeTag: timeTag?.text || "",
      noteCreatedAt: Number(note.createdAt) || Date.now(),
      reminderType: reminderTag?.type || "",
      reminderTokenId: reminderTag?.id || "",
      timeTokenId: timeTag?.id || reminderTag?.id || "",
      done: Boolean(reminderTag?.done),
      timeAtStart: Boolean(line.timeAtStart && reminderTag && reminderTag.type !== "io"),
      primaryKind: primaryTag?.type || "general",
      primaryTokenId: primaryTag?.id || ""
    });
  });

  return { lines };
}

function parseLineNode(node) {
  const tags = [];
  const parts = [];

  const walk = (current) => {
    if (current.nodeType === Node.TEXT_NODE) {
      const value = current.textContent || "";
      parts.push({ type: "text", text: value });
      return;
    }

    if (current.nodeType !== Node.ELEMENT_NODE) return;

    if (current.tagName === "BR") {
      parts.push({ type: "break", text: "\n" });
      return;
    }

    if (current.classList.contains("tag-token")) {
      const tagText = (current.textContent || "").replace(/\u00a0/g, " ").trim();
      tags.push({
        type: current.dataset.tag || "general",
        text: tagText,
        id: current.dataset.tokenId || "",
        done: current.dataset.done === "true"
      });
      parts.push({
        type: "tag",
        tagType: current.dataset.tag || "general",
        text: tagText
      });
      return;
    }

    Array.from(current.childNodes).forEach(walk);
  };

  Array.from(node.childNodes).forEach(walk);

  const plainText = parts
    .filter((part) => part.type === "text" || part.type === "break")
    .map((part) => part.text)
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();

  const visibleText = parts
    .filter((part) => part.type !== "break")
    .map((part) => part.text)
    .join(" ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const meaningfulParts = parts.filter((part) => part.text && part.text.trim());
  const firstMeaningful = meaningfulParts[0];

  return {
    text: plainText,
    visibleText,
    timeAtStart: Boolean(firstMeaningful && firstMeaningful.type === "tag" && ["time", "lab"].includes(firstMeaningful.tagType)),
    tags
  };
}

function stripTagPrefixes(text, tags) {
  let cleaned = text.trim();
  tags.forEach((tag) => {
    if (cleaned.toLowerCase().startsWith(tag.text.toLowerCase())) {
      cleaned = cleaned.slice(tag.text.length).trim();
    }
  });
  return cleaned;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value).replace(/"/g, '\\"');
}

function formatTimedSummaryLine(line) {
  if (!line.reminderType) {
    return line.text;
  }

  const reminderTimes = getReminderTimesForLine(line);
  const reminderTime = reminderTimes[0] || line.timeTag;
  if (line.reminderType === "time" && line.timeAtStart) {
    return `${line.timeTag} - ${line.text}`.trim();
  }

  return `${reminderTime} - ${line.visibleText}`.trim();
}

function getReminderTimesForLine(line) {
  if (!line?.reminderType) return [];
  const preferences = getPreferences();
  if (line.reminderType === "time" && line.timeTag) {
    return [addMinutesToTime(line.timeTag, preferences.tagDelays.time)];
  }
  if (line.reminderType === "lab" && line.timeTag) {
    return [addMinutesToTime(line.timeTag, preferences.tagDelays.lab)];
  }
  if (line.reminderType === "io") {
    const baseTimes = getShiftDurationHours(line.noteCreatedAt) === 24 ? ["14.00", "22.00"] : ["22.00"];
    return baseTimes.map((time) => addMinutesToTime(time, preferences.tagDelays.io));
  }
  const customTag = getCustomTagDefinition(line.reminderType);
  if (customTag?.hasReminder) {
    const startTime = formatTimeFromTimestamp(line.noteCreatedAt);
    return [addMinutesToTime(startTime, customTag.delayMinutes)];
  }
  return [];
}

function finalizeTagToken(token, { moveToNewLine = false } = {}) {
  if (!token) return;
  if (token.dataset.tag === "bed") {
    clearBedFinalizeTimer();
  }

  if (isTimeLikeTag(token.dataset.tag)) {
    token.textContent = normalizeTimeTagValue(token.textContent) || "00.00";
  }

  token.setAttribute("contenteditable", "false");
  token.dataset.editing = "false";
  token.classList.remove("tag-editing");
  discardPendingTagInsertion(token);

  const line = findEditorLine(token);
  refreshLineTagClasses(line);
  if ((token.dataset.tag === "time" || token.dataset.tag === "lab") && line) {
    line.classList.add("timed-line");
  }

  if (moveToNewLine) {
    placeCaretOnNewLine(line || token);
  } else {
    placeCaretAfterNode(token, true);
  }

  syncEditorDocument();
}

function findEditorLine(node) {
  let current = node;
  while (current && current !== refs.editorRoot) {
    if (current.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(current.tagName)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function placeCaretOnNewLine(referenceNode) {
  if (!referenceNode || !referenceNode.parentNode) return;

  const line = document.createElement("div");
  line.innerHTML = "<br>";
  if (referenceNode.nextSibling) {
    referenceNode.parentNode.insertBefore(line, referenceNode.nextSibling);
  } else {
    referenceNode.parentNode.appendChild(line);
  }

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(line);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function syncEditorDocument() {
  const note = getCurrentNote();
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!note || !editor) return;

  const marker = insertSelectionMarker(editor);
  normalizeEditorBlocks(editor);
  restoreSelectionMarker(marker, editor);
  note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
  note.updatedAt = Date.now();
  saveState();
}

function insertSelectionMarker(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return null;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const marker = document.createElement("span");
  marker.dataset.caretMarker = "true";
  marker.setAttribute("aria-hidden", "true");
  marker.style.display = "inline-block";
  marker.style.width = "0";
  marker.style.overflow = "hidden";
  marker.textContent = "\u200b";
  range.insertNode(marker);
  return marker;
}

function restoreSelectionMarker(marker, editor) {
  if (!marker) return;
  const selection = window.getSelection();
  if (!selection) {
    marker.remove();
    return;
  }

  const range = document.createRange();
  range.setStartAfter(marker);
  range.collapse(true);
  marker.remove();
  selection.removeAllRanges();
  selection.addRange(range);
  if (editor) {
    rememberEditorSelection(editor);
  }
}

function normalizeEditorBlocks(root) {
  if (!root) return;

  root.querySelectorAll?.("[data-pending-tag-marker]").forEach((marker) => marker.remove());

  const childNodes = Array.from(root.childNodes);
  if (!childNodes.length) {
    root.innerHTML = "<div><br></div>";
    return;
  }

  childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const wrapper = root.ownerDocument.createElement("div");
      wrapper.textContent = node.textContent;
      root.replaceChild(wrapper, node);
    }
  });

  while (liftNestedBlockLines(root)) {
    // Keep flattening until every visible line is a direct child of the editor root.
  }

  Array.from(root.children).forEach((line) => {
    if (!["DIV", "P"].includes(line.tagName)) return;
    Array.from(line.querySelectorAll('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]')).forEach((token) => {
      token.textContent = normalizeTimeTagValue(token.textContent) || "00.00";
    });
    const hasTime = Boolean(line.querySelector('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]'));
    const hasIo = Boolean(line.querySelector('.tag-token[data-tag="io"]'));
    line.classList.toggle("timed-line", hasTime);
    line.classList.toggle("io-line", hasIo);
  });
}

function normalizeTimeTagValue(value) {
  const raw = String(value || "")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!raw) return "";

  const digitsOnly = raw.replace(/\D/g, "");
  if (digitsOnly.length >= 1 && digitsOnly.length <= 4) {
    let hoursText = "";
    let minutesText = "";

    if (digitsOnly.length <= 2) {
      hoursText = digitsOnly;
      minutesText = "00";
    } else if (digitsOnly.length === 3) {
      hoursText = digitsOnly.slice(0, 1);
      minutesText = digitsOnly.slice(1, 3);
    } else {
      hoursText = digitsOnly.slice(0, 2);
      minutesText = digitsOnly.slice(2, 4);
    }

    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours)}.${String(minutes).padStart(2, "0")}`;
    }
  }

  const dotted = raw.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (dotted) {
    const hours = Number(dotted[1]);
    const minutes = Number(dotted[2]);
    if (hours <= 23 && minutes <= 59) {
      return `${String(hours)}.${String(minutes).padStart(2, "0")}`;
    }
  }

  return raw;
}

function liftNestedBlockLines(root) {
  let changed = false;

  Array.from(root.children).forEach((line) => {
    if (!["DIV", "P"].includes(line.tagName)) return;

    const children = Array.from(line.childNodes);
    const hasNestedBlocks = children.some(
      (child) => child.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(child.tagName)
    );
    if (!hasNestedBlocks) return;

    const doc = root.ownerDocument;
    const replacements = [];
    let currentLine = doc.createElement("div");

    const pushCurrentLine = () => {
      if (!currentLine.childNodes.length) return;
      replacements.push(currentLine);
      currentLine = doc.createElement("div");
    };

    children.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(child.tagName)) {
        pushCurrentLine();
        replacements.push(child.cloneNode(true));
        return;
      }

      currentLine.appendChild(child.cloneNode(true));
    });

    pushCurrentLine();

    if (!replacements.length) {
      const emptyLine = doc.createElement("div");
      emptyLine.innerHTML = "<br>";
      replacements.push(emptyLine);
    }

    const fragment = doc.createDocumentFragment();
    replacements.forEach((node) => fragment.appendChild(node));
    root.insertBefore(fragment, line);
    line.remove();
    changed = true;
  });

  return changed;
}

function maybeFinalizeEditingTimeToken(editor) {
  const token = editor.querySelector('.tag-token[data-editing="true"][data-tag="time"], .tag-token[data-editing="true"][data-tag="lab"]');
  if (!token) return false;

  const parsed = extractCompletedTimeTokenText(token.textContent);
  if (!parsed) return false;

  token.textContent = normalizeTimeTagValue(parsed.timePart) || parsed.timePart;
  finalizeTagToken(token, { moveToNewLine: false });

  const trailingText = parsed.trailingText.replace(/^\s+/, "");
  if (trailingText) {
    insertTextAtSelection(trailingText);
  }

  syncEditorDocument();
  return true;
}

function maybeFinalizeEditingBedToken(editor) {
  const token = editor.querySelector('.tag-token[data-editing="true"][data-tag="bed"]');
  if (!token) {
    clearBedFinalizeTimer();
    return false;
  }

  const bedValue = String(token.textContent || "")
    .replace(/^Bed\s*/i, "")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!bedValue) {
    clearBedFinalizeTimer();
    return false;
  }

  clearBedFinalizeTimer();
  uiState.bedFinalizeTimer = window.setTimeout(() => {
    const liveEditor = refs.editorRoot.querySelector("#notepad-editor");
    const liveToken = liveEditor?.querySelector?.(`[data-token-id="${cssEscape(token.dataset.tokenId || "")}"]`);
    if (!liveToken || liveToken.dataset.editing !== "true") return;
    finalizeTagToken(liveToken, { moveToNewLine: true });
    if (liveEditor) {
      rememberEditorSelection(liveEditor);
      keepEditorCaretVisible(liveEditor);
    }
  }, 280);

  return true;
}

function extractCompletedTimeTokenText(value) {
  const raw = String(value || "")
    .replace(/\u00a0/g, " ")
    .trim();

  if (!raw) return null;

  let match = raw.match(/^(\d{4})(.*)$/);
  if (match) {
    return { timePart: match[1], trailingText: match[2] || "" };
  }

  match = raw.match(/^(\d{1,2}[:.]\d{2})(.*)$/);
  if (match) {
    return { timePart: match[1], trailingText: match[2] || "" };
  }

  match = raw.match(/^(\d{3})(\D.*)$/);
  if (match) {
    return { timePart: match[1], trailingText: match[2] || "" };
  }

  return null;
}

function isTimeLikeTag(tagType) {
  return tagType === "time" || tagType === "lab";
}

function isPrintableKey(event) {
  return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
}

function isTimeEditingCharacter(key) {
  return /[\d:.]/.test(key);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
