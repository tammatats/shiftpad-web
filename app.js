const STORAGE_KEY = "shiftpad-ios-state-v1";
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const STORAGE_NAMESPACE = "shiftpad-ios-state-v2";
const WARD_COLORS = ["#f28b67", "#6ea8fe", "#6fc48d", "#b490ff", "#f0b95c", "#ff7aa2"];
const REMINDER_TAGS = ["time", "lab", "io"];
const CLOUD_STATE_TABLE = "shiftpad_user_state";
const CLOUD_SAVE_DEBOUNCE_MS = 700;
const KIND_META = {
  general: { label: "General", icon: "Memo", className: "" },
  lab: { label: "Lab", icon: "Lab", className: "kind-lab" },
  io: { label: "I/O", icon: "I/O", className: "kind-io" }
};

const refs = {
  singleWardToggle: document.getElementById("single-ward-toggle"),
  addWardBtn: document.getElementById("add-ward-btn"),
  newNoteBtn: document.getElementById("new-note-btn"),
  summaryDate: document.getElementById("summary-date"),
  summaryOpenCount: document.getElementById("summary-open-count"),
  summaryBedCount: document.getElementById("summary-bed-count"),
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
  wardRail: document.getElementById("ward-rail"),
  wardCollapseBtn: document.getElementById("ward-collapse-btn"),
  wardList: document.getElementById("ward-list"),
  notesTabBtn: document.getElementById("notes-tab-btn"),
  timelineTabBtn: document.getElementById("timeline-tab-btn"),
  notesView: document.getElementById("notes-view"),
  timelineView: document.getElementById("timeline-view"),
  editorRoot: document.getElementById("editor-root"),
  mobileKeyboardRoot: document.getElementById("mobile-keyboard-root"),
  timelineRoot: document.getElementById("timeline-root"),
  timelineScope: document.getElementById("timeline-scope"),
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
  mobileKeyboardMode: "alpha",
  shiftOn: false,
  savedSelection: null,
  bedFinalizeTimer: null
};
applyUrlOverrides();

init();

async function init() {
  bindEvents();
  initMobileViewportDock();
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

  refs.editorRoot.addEventListener("mousedown", (event) => {
    const quickButton = event.target.closest("[data-quick-tag]");
    if (quickButton) {
      event.preventDefault();
    }
  });

  refs.editorRoot.addEventListener("pointerdown", (event) => {
    const manualEditor = event.target.closest?.('#notepad-editor[data-manual-keyboard="true"]');
    if (manualEditor) {
      event.preventDefault();
      setCaretFromPoint(manualEditor, event.clientX, event.clientY);
      uiState.editorFocused = true;
      syncMobileKeyboard();
      rememberEditorSelection(manualEditor);
    }
  });

  refs.mobileKeyboardRoot?.addEventListener("mousedown", (event) => {
    const keyboardButton = event.target.closest("[data-keyboard-action], [data-keyboard-tag]");
    if (keyboardButton) {
      event.preventDefault();
    }
  });

  refs.mobileKeyboardRoot?.addEventListener("pointerdown", (event) => {
    const keyboardButton = event.target.closest("[data-keyboard-action], [data-keyboard-tag]");
    if (keyboardButton) {
      event.preventDefault();
    }
  });

  refs.singleWardToggle.addEventListener("change", (event) => {
    state.preferences.singleWardMode = event.target.checked;
    saveState();
    render();
  });

  refs.addWardBtn.addEventListener("click", () => {
    const ward = createWard(getNextWardName(), WARD_COLORS[state.wards.length % WARD_COLORS.length]);
    ward.notes.push(createNote(`${ward.name} handover`, "New patient list"));

    state.wards.push(ward);
    state.selectedWardId = ward.id;
    state.selectedNoteId = ward.notes[0].id;
    state.preferences.singleWardMode = false;
    saveState();
    render();
  });

  refs.wardCollapseBtn.addEventListener("click", () => {
    state.preferences.wardListCollapsed = !state.preferences.wardListCollapsed;
    saveState();
    renderWardRail();
  });

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
    render();
  });

  refs.timelineTabBtn.addEventListener("click", () => {
    state.activeView = "timeline";
    uiState.editorFocused = false;
    render();
  });

  refs.wardList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ward-id]");
    if (!button) return;

    state.selectedWardId = button.dataset.wardId;
    const ward = getCurrentWard();
    state.selectedNoteId = ward?.notes[0]?.id || "";
    state.activeView = "notes";
    saveState();
    render();
  });

  refs.editorRoot.addEventListener("click", (event) => {
    const quickButton = event.target.closest("[data-quick-tag]");
    if (quickButton) {
      handleQuickTag(quickButton.dataset.quickTag);
      return;
    }

    if (event.target.closest("#notepad-editor")) {
      uiState.editorFocused = true;
      syncMobileKeyboard();
      rememberEditorSelection(refs.editorRoot.querySelector("#notepad-editor"));
      requestAnimationFrame(() => {
        keepEditorCaretVisible(refs.editorRoot.querySelector("#notepad-editor"));
      });
      return;
    }

    if (isCompactMobileLayout()) {
      uiState.editorFocused = false;
      syncMobileKeyboard();
    }
  });

  refs.editorRoot.addEventListener("focusin", (event) => {
    if (!event.target.closest?.("#notepad-editor")) return;
    uiState.editorFocused = true;
    syncMobileKeyboard();
    rememberEditorSelection(event.target.closest("#notepad-editor"));
  });

  refs.editorRoot.addEventListener("focusout", (event) => {
    if (!event.target.closest?.("#notepad-editor")) return;
    window.setTimeout(() => {
      uiState.editorFocused = Boolean(document.activeElement?.closest?.("#notepad-editor"));
      syncMobileKeyboard();
    }, 50);
  });

  refs.editorRoot.addEventListener("input", (event) => {
    const editor = event.target.closest?.("#notepad-editor");
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;

    maybeFinalizeEditingTimeToken(editor);
    maybeFinalizeEditingBedToken(editor);
    note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
    note.updatedAt = Date.now();
    rememberEditorSelection(editor);
    saveState();
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
    keepEditorCaretVisible(editor);
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
      handleNotepadKeydown(event);
    }
  });

  refs.mobileKeyboardRoot?.addEventListener("click", (event) => {
    const keyboardAction = event.target.closest("[data-keyboard-action]");
    if (keyboardAction) {
      handleMobileKeyboardAction(keyboardAction.dataset.keyboardAction, keyboardAction.dataset.keyboardValue || "");
      return;
    }

    const keyboardTag = event.target.closest("[data-keyboard-tag]");
    if (keyboardTag) {
      handleMobileKeyboardTag(keyboardTag.dataset.keyboardTag);
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
    if (!tab) return;

    state.summaryTab = tab.dataset.summaryTab === "reminders" ? "reminders" : "beds";
    saveState();
    renderTimeline();
  });

  refs.timelineScope.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scope]");
    if (!button) return;

    state.timelineScope = button.dataset.scope;
    saveState();
    renderTimeline();
  });

  document.addEventListener("selectionchange", () => {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (!editor) return;
    rememberEditorSelection(editor);
  });

  window.addEventListener("resize", syncMobileKeyboard, { passive: true });
}

function render() {
  ensureSelection();
  renderAuthUi();
  refs.singleWardToggle.checked = Boolean(state.preferences.singleWardMode);
  refs.workspace.classList.toggle("single-ward", Boolean(state.preferences.singleWardMode));
  refs.wardRail.classList.toggle("hidden", Boolean(state.preferences.singleWardMode));

  refs.notesTabBtn.classList.toggle("is-active", state.activeView === "notes");
  refs.timelineTabBtn.classList.toggle("is-active", state.activeView === "timeline");
  refs.notesView.classList.toggle("hidden", state.activeView !== "notes");
  refs.timelineView.classList.toggle("hidden", state.activeView !== "timeline");

  renderSummary();
  renderWardRail();
  renderEditor();
  renderTimeline();
  refreshMobileKeyboardView();
}

function renderSummary() {
  const summary = buildSummaryGroups("all");
  const timed = summary.timed;
  const openCount = timed.filter((item) => !item.entry.done).length;

  refs.summaryDate.textContent = formatLongDate(Date.now());
  refs.summaryOpenCount.textContent = `${openCount} active`;
  refs.summaryBedCount.textContent = `${summary.byBed.length} tagged`;
}

function renderWardRail() {
  const collapsed = Boolean(state.preferences.wardListCollapsed);
  refs.wardRail.classList.toggle("is-collapsed", collapsed);
  refs.wardCollapseBtn.textContent = collapsed ? "Expand" : "Collapse";
  refs.wardCollapseBtn.setAttribute("aria-expanded", String(!collapsed));

  if (collapsed) {
    refs.wardList.innerHTML = "";
    return;
  }

  refs.wardList.innerHTML = state.wards
    .map((ward) => {
      return `
        <button
          class="ward-tab ${ward.id === state.selectedWardId ? "is-active" : ""}"
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
    })
    .join("");
}

function renderEditor() {
  const ward = getCurrentWard();
  const note = getCurrentNote();

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
  const mobileManualKeyboard = isCompactMobileLayout();

  refs.editorRoot.innerHTML = `
    <div class="editor-shell">
      <section class="editor-top">
        <label class="field-card full">
          <span class="field-label">Ward tab name</span>
          <input type="text" data-field="ward-name" value="${escapeAttribute(ward.name)}" />
        </label>
      </section>

      <section class="note-pad-card">
        <div class="stack-head">
          <div>
            <p class="section-kicker">Main notepad</p>
            <h2>${escapeHtml(ward.name || "Current ward")}</h2>
          </div>
          <small>Updated ${escapeHtml(formatClock(note.updatedAt || note.createdAt))}</small>
        </div>

        <div class="quick-tags">
          ${renderQuickChip("bed", "Bed")}
          ${renderQuickChip("time", "Time")}
          ${renderQuickChip("lab", "Lab")}
          ${renderQuickChip("io", "I/O")}
        </div>

        <div class="smart-pad-surface document-pad">
          <p class="helper-copy">${mobileManualKeyboard ? "Type with the custom iPhone-style keyboard below. The Tags key opens Bed, Time, Lab, and I/O." : "Type straight into the notepad. Tag buttons insert highlighted labels at the cursor inside the note itself."}</p>
          <div
            id="notepad-editor"
            class="notepad-editor"
            contenteditable="true"
            spellcheck="true"
            aria-label="Main notepad"
            ${mobileManualKeyboard ? 'inputmode="none" virtualkeyboardpolicy="manual" autocapitalize="sentences" data-manual-keyboard="true"' : ""}
          >${documentHtml}</div>
        </div>

      </section>
    </div>
  `;

  requestAnimationFrame(() => {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (!mobileManualKeyboard) {
      editor?.focus();
    }
    syncMobileKeyboard();
  });
}

function renderTimeline() {
  const scope = state.timelineScope || "all";
  const summaryTab = state.summaryTab === "reminders" ? "reminders" : "beds";
  refs.timelineScope.innerHTML = `
    <button class="scope-pill ${scope === "active" ? "is-active" : ""}" type="button" data-scope="active">Active ward</button>
    <button class="scope-pill ${scope === "all" ? "is-active" : ""}" type="button" data-scope="all">All wards</button>
  `;

  const summary = buildSummaryGroups(scope);
  const hasSummary = summary.timed.length || summary.byBed.length;
  if (!hasSummary) {
    refs.timelineRoot.innerHTML = `
      <div class="timeline-empty">
        <h3>No summary yet</h3>
        <p class="helper-copy">Add bed tags or time tags in the main notepad and they will show up here.</p>
      </div>
    `;
    return;
  }

  refs.timelineRoot.innerHTML = `
    <div class="timeline-root-top minimal">
      <div>
        <p class="section-kicker">Summary</p>
        <h3>${summaryTab === "beds" ? "Bed Information" : "Reminders"}</h3>
      </div>
      <strong>${summary.timed.filter((item) => !item.entry.done).length} open reminders</strong>
    </div>
    <div class="summary-switcher" role="tablist" aria-label="Summary sections">
      <button class="summary-tab ${summaryTab === "beds" ? "is-active" : ""}" type="button" data-summary-tab="beds">Bed Info</button>
      <button class="summary-tab ${summaryTab === "reminders" ? "is-active" : ""}" type="button" data-summary-tab="reminders">Reminders</button>
    </div>
    ${summaryTab === "beds" ? renderSummaryBedSection(summary.byBed) : renderSummaryTimedSection(summary.timed)}
  `;

  refs.timelineRoot.querySelectorAll("[data-summary-editor], [data-bed-editor]").forEach(autoSizeTextarea);
}

function renderAuthUi() {
  const hasUser = Boolean(authState.user);
  document.body.classList.toggle("auth-locked", !hasUser);
  refs.authGate?.classList.toggle("hidden", hasUser);
  refs.logoutBtn?.classList.toggle("hidden", !hasUser);
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

  const {
    data: { session }
  } = await authState.client.auth.getSession();
  await applySession(session);

  authState.client.auth.onAuthStateChange((_event, sessionUpdate) => {
    applySession(sessionUpdate).catch((error) => {
      setAuthMessage(error.message || "Auth update failed.");
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
  const { error } = await authState.client.auth.signInWithPassword({ email, password });
  if (error) {
    setAuthMessage(error.message);
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
    setAuthMessage(error.message);
    return;
  }
  setAuthMessage("Account created. Check your inbox if email confirmation is enabled, then sign in.");
}

async function signOutCurrentUser() {
  if (!authState.client) return;
  await authState.client.auth.signOut();
  setAuthMessage("");
}

async function hydrateStateFromCloud() {
  if (!authState.client || !authState.user) return;

  authState.isHydrating = true;
  renderAuthUi();

  const fallback = loadStateForUser(authState.user.id) || loadLegacyLocalState() || createSeedState();
  authState.suppressCloudSave = true;

  const { data, error } = await authState.client
    .from(CLOUD_STATE_TABLE)
    .select("state_json")
    .eq("user_id", authState.user.id)
    .maybeSingle();

  if (error) {
    console.error("Cloud state load failed:", error);
    state = normalizeState(fallback);
    authState.isHydrating = false;
    authState.suppressCloudSave = false;
    saveState({ skipCloud: true });
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

function renderTimelineItem(item) {
  const { ward, note, entry } = item;
  return `
    <article class="timeline-item reminder-card ${entry.done ? "is-done" : ""}">
      <div class="timeline-head">
        <div>
          <strong>${escapeHtml(entry.reminderTime || "No time")}</strong>
          <p class="timeline-subhead">${escapeHtml(buildReminderSubhead(item))}</p>
        </div>
        <label class="entry-check">
          <input
            type="checkbox"
            data-note-id="${escapeHtml(note.id)}"
            data-token-id="${escapeHtml(item.tokenId || "")}"
            ${entry.done ? "checked" : ""}
          />
          <span>${entry.done ? "Done" : "Open"}</span>
        </label>
      </div>
      <textarea
        class="summary-editor reminder-editor"
        data-summary-editor="true"
        data-note-id="${escapeHtml(note.id)}"
        data-line-index="${item.lineIndex}"
        aria-label="Reminder text"
      >${escapeHtml(getReminderEditorText(entry))}</textarea>
    </article>
  `;
}

function renderSummaryBedSection(groups) {
  if (!groups.length) {
    return `
      <section class="timeline-group">
        <div class="timeline-empty">
          <h3>No bed information yet</h3>
          <p class="helper-copy">Add a bed tag in the notepad to collect notes here.</p>
        </div>
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
        <div class="timeline-empty">
          <h3>No reminders yet</h3>
          <p class="helper-copy">Add a time tag in the notepad to create reminders here.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="timeline-group">
      <h3>Reminders</h3>
      <div class="timeline-list">
        ${items.map((item) => renderTimelineItem(item)).join("")}
      </div>
    </section>
  `;
}

function renderQuickChip(key, label, extraClass = "") {
  return `
    <button class="quick-chip ${escapeHtml(extraClass)}" type="button" data-quick-tag="${escapeHtml(key)}">
      ${escapeHtml(label)}
    </button>
  `;
}

function renderMobileKeyboard() {
  const alphaRows = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"]
  ];
  const numericRows = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
    [".", ",", "?", "!", "'"]
  ];
  const useUppercase = uiState.shiftOn;
  const mode = uiState.mobileKeyboardMode;

  return `
    <div class="mobile-keyboard" data-mobile-keyboard="true" aria-hidden="true">
      ${
        mode === "tags"
          ? `
            <div class="mobile-keyboard-tags">
              <button class="mobile-key mobile-key-dark wide" type="button" data-keyboard-tag="bed">Bed</button>
              <button class="mobile-key mobile-key-dark wide" type="button" data-keyboard-tag="time">Time</button>
              <button class="mobile-key mobile-key-dark wide" type="button" data-keyboard-tag="lab">Lab</button>
              <button class="mobile-key mobile-key-dark wide" type="button" data-keyboard-tag="io">I/O</button>
            </div>
          `
          : `
            <div class="mobile-keyboard-rows">
              ${renderKeyboardRow((mode === "numeric" ? numericRows[0] : alphaRows[0]).map((key) => ({
                label: mode === "numeric" ? key : useUppercase ? key.toUpperCase() : key,
                value: key
              })))}
              ${renderKeyboardRow((mode === "numeric" ? numericRows[1] : alphaRows[1]).map((key) => ({
                label: mode === "numeric" ? key : useUppercase ? key.toUpperCase() : key,
                value: key
              })), mode === "numeric" ? "" : "offset")}
              ${renderKeyboardRow([
                ...(mode === "numeric"
                  ? [{ label: "#+=", action: "noop", className: "mobile-key-side muted" }]
                  : [{ label: "⇧", action: "shift", className: `mobile-key-side ${uiState.shiftOn ? "is-active" : ""}` }]),
                ...((mode === "numeric" ? numericRows[2] : alphaRows[2]).map((key) => ({
                  label: mode === "numeric" ? key : useUppercase ? key.toUpperCase() : key,
                  value: key
                }))),
                { label: "⌫", action: "backspace", className: "mobile-key-side" }
              ], "wide-edges")}
            </div>
          `
      }
      <div class="mobile-keyboard-bottom">
        <button class="mobile-key mobile-key-side" type="button" data-keyboard-action="${mode === "numeric" ? "mode-alpha" : "mode-numeric"}">
          ${mode === "numeric" ? "ABC" : "123"}
        </button>
        <button class="mobile-key mobile-key-side" type="button" data-keyboard-action="${mode === "tags" ? "mode-alpha" : "mode-tags"}">
          Tags
        </button>
        <button class="mobile-key mobile-key-space" type="button" data-keyboard-action="space" aria-label="Space"></button>
        <button class="mobile-key mobile-key-side mobile-key-dot" type="button" data-keyboard-action="insert" data-keyboard-value=".">.</button>
        <button class="mobile-key mobile-key-enter" type="button" data-keyboard-action="enter" aria-label="Return">→</button>
      </div>
    </div>
  `;
}

function renderKeyboardRow(keys, extraClass = "") {
  return `
    <div class="mobile-keyboard-row ${extraClass}">
      ${keys
        .map((key) => {
          if (key.action) {
            return `<button class="mobile-key ${escapeHtml(key.className || "")}" type="button" data-keyboard-action="${escapeHtml(
              key.action
            )}">${escapeHtml(key.label)}</button>`;
          }

          return `<button class="mobile-key" type="button" data-keyboard-action="insert" data-keyboard-value="${escapeHtml(
            key.value
          )}">${escapeHtml(key.label)}</button>`;
        })
        .join("")}
    </div>
  `;
}

function renderEntryChip(label, extraClass = "") {
  return `<span class="entry-chip ${escapeHtml(extraClass)}">${escapeHtml(label)}</span>`;
}

function handleQuickTag(tag) {
  const note = getCurrentNote();
  if (!note) return;
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return;

  if (shouldUseManualKeyboard(editor)) {
    restoreEditorSelection(editor);
  } else {
    editor.focus();
  }
  insertTagIntoEditor(editor, tag);

  note.documentHtml = sanitizeEditorHtml(editor.innerHTML);
  note.updatedAt = Date.now();
  saveState();
  rememberEditorSelection(editor);
}

function isCompactMobileLayout() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function syncMobileKeyboard() {
  const keyboard = refs.mobileKeyboardRoot?.querySelector("[data-mobile-keyboard]");
  if (!keyboard) return;

  const shouldShow = isCompactMobileLayout() && state.activeView === "notes" && uiState.editorFocused;
  const documentPad = refs.editorRoot.querySelector(".document-pad");
  keyboard.classList.toggle("is-visible", shouldShow);
  keyboard.setAttribute("aria-hidden", String(!shouldShow));
  documentPad?.classList.toggle("is-mobile-keyboard-active", shouldShow && uiState.editorFocused);
}

function refreshMobileKeyboardView() {
  if (!refs.mobileKeyboardRoot) return;
  refs.mobileKeyboardRoot.innerHTML = renderMobileKeyboard();
  syncMobileKeyboard();
}

function handleMobileKeyboardAction(action, value = "") {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return;

  if (action === "mode-tags") {
    uiState.mobileKeyboardMode = "tags";
    refreshMobileKeyboardView();
    return;
  }

  if (action === "mode-alpha") {
    uiState.mobileKeyboardMode = "alpha";
    uiState.shiftOn = false;
    refreshMobileKeyboardView();
    return;
  }

  if (action === "mode-numeric") {
    uiState.mobileKeyboardMode = "numeric";
    uiState.shiftOn = false;
    refreshMobileKeyboardView();
    return;
  }

  restoreEditorSelection(editor);

  if (action === "shift") {
    uiState.shiftOn = !uiState.shiftOn;
    refreshMobileKeyboardView();
    return;
  }

  if (action === "backspace") {
    deleteBackwardAtSelection(editor);
    keepEditorCaretVisible(editor);
    return;
  }

  if (action === "space") {
    if (handleEditorSpecialKey(" ")) {
      keepEditorCaretVisible(editor);
      return;
    }
    insertTextAtSelection(" ");
    syncEditorDocument();
    rememberEditorSelection(editor);
    keepEditorCaretVisible(editor);
    return;
  }

  if (action === "enter") {
    if (handleEditorSpecialKey("Enter")) {
      keepEditorCaretVisible(editor);
      return;
    }
    insertParagraphAtSelection();
    syncEditorDocument();
    rememberEditorSelection(editor);
    keepEditorCaretVisible(editor);
    return;
  }

  if (action === "insert") {
    if (!value) return;
    const nextValue = uiState.mobileKeyboardMode === "alpha" && uiState.shiftOn ? value.toUpperCase() : value;
    if (handleEditorSpecialKey(nextValue)) {
      keepEditorCaretVisible(editor);
      if (uiState.shiftOn && /^[a-z]$/i.test(value)) {
        uiState.shiftOn = false;
        refreshMobileKeyboardView();
      }
      return;
    }
    insertTextAtSelection(nextValue);
    syncEditorDocument();
    maybeFinalizeEditingBedToken(editor);
    rememberEditorSelection(editor);
    keepEditorCaretVisible(editor);
    if (uiState.shiftOn && /^[a-z]$/i.test(value)) {
      uiState.shiftOn = false;
      refreshMobileKeyboardView();
    }
  }
}

function handleMobileKeyboardTag(tag) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return;

  restoreEditorSelection(editor);
  handleQuickTag(tag);
  uiState.mobileKeyboardMode = "alpha";
  uiState.shiftOn = false;
  refreshMobileKeyboardView();
  keepEditorCaretVisible(editor);
}

function rememberEditorSelection(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return;
  uiState.savedSelection = selection.getRangeAt(0).cloneRange();
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

function shouldUseManualKeyboard(editor) {
  return Boolean(editor?.dataset.manualKeyboard === "true");
}

function setCaretFromPoint(editor, clientX, clientY) {
  const selection = window.getSelection();
  if (!editor || !selection) return false;

  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  } else if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }

  if (!range || !isNodeInsideEditor(editor, range.startContainer)) {
    return restoreEditorSelection(editor);
  }

  selection.removeAllRanges();
  selection.addRange(range);
  uiState.savedSelection = range.cloneRange();
  return true;
}

function keepEditorCaretVisible(editor) {
  if (!editor || !isCompactMobileLayout() || !uiState.editorFocused) return;

  const viewport = window.visualViewport;
  const line = getCurrentEditorLine();
  const keyboard = refs.mobileKeyboardRoot?.querySelector("[data-mobile-keyboard].is-visible");
  const keyboardHeight = keyboard ? keyboard.getBoundingClientRect().height : 0;
  const target = line || editor;
  const rect = target.getBoundingClientRect();
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportTop = viewport?.offsetTop || 0;
  const contentHeight = Math.max(120, viewportHeight - keyboardHeight);
  const desiredCenterY = viewportTop + contentHeight * 0.72;
  const currentCenterY = rect.top + rect.height / 2;
  const delta = currentCenterY - desiredCenterY;

  if (Math.abs(delta) > 18) {
    window.scrollTo({
      top: Math.max(0, window.scrollY + delta),
      left: window.scrollX
    });
  }
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
  const reminderNode = tagNodes.find((node) => REMINDER_TAGS.includes(node.dataset.tag));
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

function buildReminderSubhead(item) {
  const parts = [item.ward.name];
  if (item.entry.bedTag) {
    parts.push(`Bed ${item.entry.bedTag.toUpperCase()}`);
  }
  const kindLabel = KIND_META[item.entry.reminderType]?.label;
  if (kindLabel && item.entry.reminderType !== "time" && item.entry.reminderType !== "general") {
    parts.push(kindLabel);
  }
  return parts.join(" · ");
}

function getReminderEditorText(entry) {
  if (entry.reminderType === "time" && entry.timeAtStart) {
    return entry.text || "";
  }
  return entry.visibleText || entry.text || "";
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
            tokenId: index === 0 ? item.tokenId : `${item.tokenId}-${index}`,
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
    kind: KIND_META[kind] ? kind : "general",
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
    preferences: {
      singleWardMode: false
    },
    wards: [wardA, wardB]
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
                        kind: KIND_META[entry.kind] ? entry.kind : "general",
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
                kind: KIND_META[entry.kind] ? entry.kind : "general",
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
    preferences: {
      singleWardMode: Boolean(input.preferences?.singleWardMode),
      wardListCollapsed: Boolean(input.preferences?.wardListCollapsed)
    },
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
  const hour = new Date(timestamp).getHours();
  if (hour < 12) return "AM shift";
  if (hour < 18) return "PM shift";
  return "Night shift";
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
          )}" data-token-id="${escapeAttribute(createId("tag"))}">${escapeHtml(KIND_META[entry.kind]?.label || entry.kind)}</span>`
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

function handleEditorSpecialKey(key, { shiftKey = false, keyboardEvent = null } = {}) {
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

  if (tag === "bed") {
    const tokenId = createId("tag");
    insertHtmlAtSelection(
      `<div><span class="tag-token tag-bed tag-editing" data-tag="bed" data-token-id="${escapeAttribute(
        tokenId
      )}" data-editing="true">Bed </span></div>`
    );
    const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
    placeCaretInsideTag(inserted);
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
    placeCaretAfterNode(inserted, true);
    syncEditorDocument();
    return;
  }

  const tokenId = createId("tag");
  const label = KIND_META[tag]?.label || tag;
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
  range.deleteContents();
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (!lastNode) return;

  range.setStartAfter(lastNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTextAtSelection(text) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();
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

function removeTagToken(token) {
  if (!token) return;
  const parent = token.parentNode;
  token.remove();
  if (parent && parent.textContent.trim() === "") {
    parent.innerHTML = "<br>";
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

    const reminderTag = line.tags.find((tag) => REMINDER_TAGS.includes(tag.type));
    const timeTag = reminderTag && reminderTag.type !== "io" ? reminderTag : null;
    const primaryTag = line.tags.find((tag) => !["bed", ...REMINDER_TAGS].includes(tag.type));
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
  if (line.reminderType === "time" && line.timeTag) {
    return [line.timeTag];
  }
  if (line.reminderType === "lab" && line.timeTag) {
    return [addHoursToTime(line.timeTag, 1)];
  }
  if (line.reminderType === "io") {
    return ["14.00", "22.00"];
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

  const line = findEditorLine(token);
  if (line) {
    line.classList.toggle("timed-line", Boolean(line.querySelector('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]')));
    line.classList.toggle("io-line", Boolean(line.querySelector('.tag-token[data-tag="io"]')));
  }
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
