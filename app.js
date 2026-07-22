const STORAGE_KEY = "shiftpad-ios-state-v1";
const LEGACY_STORAGE_KEY = STORAGE_KEY;
const STORAGE_NAMESPACE = "shiftpad-ios-state-v2";
const WARD_COLORS = ["#f28b67", "#6ea8fe", "#6fc48d", "#b490ff", "#f0b95c", "#ff7aa2"];
const CUSTOM_TAG_COLORS = ["#9b8cff", "#2bb3c0", "#f27b8a", "#63b56b", "#f0a64f", "#5f9cff", "#c86dd7", "#b6a54a"];
const CORE_REMINDER_TAGS = ["time", "lab", "io"];
const CLOUD_STATE_TABLE = "shiftpad_user_state";
const EDITOR_DEBUG_CLOUD_TABLE = "shiftpad_editor_debug_logs";
const CLOUD_SAVE_DEBOUNCE_MS = 300;
const CLOUD_SYNC_POLL_MS = 1500;
const CLOUD_REMOTE_APPLY_IDLE_MS = 1200;
const CLOUD_REMOTE_APPLY_FOCUSED_RETRY_MS = 2500;
const CLOUD_LOCAL_EDIT_PROTECTION_MS = 8000;
const LOCAL_SAVE_DEBOUNCE_MS = 180;
const SCREEN_SWITCH_SELECTION_FREEZE_MS = 1800;
const EDITOR_DEBUG_CLOUD_UPLOAD_DEBOUNCE_MS = 700;
const EDITOR_DEBUG_CLOUD_BATCH_LIMIT = 20;
const EDITOR_DEBUG_CLOUD_LIFECYCLE_BATCH_LIMIT = 3;
const PUSH_SUBSCRIPTION_ENDPOINT = "/api/push-subscriptions";
const PUSH_ENABLED_STORAGE_KEY = "shiftpad-push-enabled-v1";
const PUSH_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const BED_SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const EDITOR_DEBUG_NAMESPACE = "shiftpad-editor-debug-v1";
const EDITOR_DEBUG_ENABLED_KEY = `${EDITOR_DEBUG_NAMESPACE}:enabled`;
const EDITOR_DEBUG_LIMIT = 200;
const MAX_BED_INDEX_LABELS = 9;
const RECOVERY_HISTORY_LIMIT = 12;
const SHIFT_ARCHIVE_LIMIT = 6;
const RECOVERY_SNAPSHOT_INTERVAL_MS = 60 * 1000;
const RECOVERY_SNAPSHOT_MAX_HTML = 160000;
const NOTE_PARSE_CACHE_LIMIT = 180;
const NOTE_DOCUMENT_MODEL_VERSION = 1;
const NOTE_DOCUMENT_MODEL_SYNC_DELAY_MS = 120;
const SHORT_NOTE_SCROLL_NATIVE_WATCH_MAX_MS = 520;
const SHORT_NOTE_SCROLL_STALL_FRAMES = 3;
const SHORT_NOTE_SCROLL_SETTLE_DURATION_MS = 260;
const APP_BUILD = "2026-07-22-auth-sync-v14";
window.SHIFTPAD_APP_BUILD = APP_BUILD;
const WORKSPACE_KEYS = ["shift", "day"];
const SUMMARY_TABS = ["reminders", "todo"];
const WORKSPACE_META = {
  shift: {
    title: "ShiftPad",
    eyebrow: "Shift Note Workspace",
    tagline: "Fast handover notes with bed tags and reminders."
  },
  day: {
    title: "DayPad",
    eyebrow: "Regular Hours Workspace",
    tagline: "Daytime ward notes, tasks, and reminders."
  }
};
const KIND_META = {
  general: { label: "General", icon: "Memo", className: "" },
  hn: { label: "HN", icon: "HN", className: "kind-hn" },
  lab: { label: "Lab", icon: "Lab", className: "kind-lab" },
  io: { label: "I/O", icon: "I/O", className: "kind-io" },
  todo: { label: "To-do", icon: "To-do", className: "kind-todo" }
};

const refs = {
  menuBtn: document.getElementById("menu-btn"),
  wardOptionsBtn: document.getElementById("ward-options-btn"),
  workspaceSwitcher: document.getElementById("workspace-switcher"),
  workspaceHeading: document.getElementById("workspace-heading"),
  workspaceTitle: document.getElementById("workspace-title"),
  workspaceEyebrow: document.getElementById("workspace-eyebrow"),
  workspaceTagline: document.getElementById("workspace-tagline"),
  appHeader: document.querySelector(".app-header"),
  topControlStack: document.querySelector(".top-control-stack"),
  stickyWardRoot: document.getElementById("sticky-ward-root"),
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
  searchBtn: document.getElementById("search-btn"),
  notesView: document.getElementById("notes-view"),
  timelineView: document.getElementById("timeline-view"),
  editorRoot: document.getElementById("editor-root"),
  drawerRoot: document.getElementById("drawer-root"),
  bedActionRoot: document.getElementById("bed-action-root"),
  searchRoot: document.getElementById("search-root"),
  mobileTagRoot: document.getElementById("mobile-tag-root"),
  timelineRoot: document.getElementById("timeline-root"),
  workspace: document.querySelector(".workspace")
};

let appState = loadAppState();
let state = getActiveWorkspaceState(appState);
const authState = {
  client: null,
  user: null,
  session: null,
  ready: false,
  configured: false,
  saveTimer: null,
  localSaveTimer: null,
  livePollTimer: null,
  debugLogUploadTimer: null,
  realtimeChannel: null,
  pendingRemoteRecord: null,
  remoteApplyTimer: null,
  lastCloudUpdatedAt: 0,
  lastCloudUpdatedAtValue: "",
  lastLocalMutationAt: 0,
  lastRemoteAppliedAt: 0,
  realtimeStatus: "off",
  isSaving: false,
  isHydrating: false,
  hydratingUserId: "",
  hydratedUserId: "",
  suppressCloudSave: false,
  pendingDoneToggles: new Map()
};
const uiState = {
  editorFocused: false,
  mobileTagsOpen: false,
  savedSelection: null,
  savedSelectionBookmark: null,
  bedIndexVisible: false,
  bedIndexTimer: null,
  bedIndexScrollRaf: 0,
  bedIndexScrub: null,
  suppressNextBedIndexClick: false,
  bedIndexClickSuppressTimer: null,
  bedFinalizeTimer: null,
  editorTapScroll: null,
  shortNoteScrollGesture: null,
  shortNoteScrollSuppressUntil: 0,
  shortNoteScrollSettleRaf: 0,
  lastShortNoteScrollClampDebugAt: 0,
  suppressNextDeleteInput: false,
  suppressNextParagraphInput: false,
  drawerOpen: false,
  wardOptionsOpen: false,
  drawerCloseTimer: null,
  drawerScrollTop: {
    left: 0,
    right: 0
  },
  drawerSections: new Set(),
  animateWardAdd: false,
  editingWardId: "",
  wardNameCompositionActive: false,
  drawerRenderPending: false,
  pendingTagInsertions: new Map(),
  lastInsertedTagTokenId: "",
  notificationStatus: "",
  notificationEnabled: null,
  notificationBusy: false,
  notificationLastSyncAt: 0,
  serviceWorkerUpdateListenerBound: false,
  serviceWorkerReloadPending: false,
  serviceWorkerReloadTimer: null,
  bedAction: null,
  bedLongPress: null,
  suppressNextBedClick: false,
  pointerTracking: null,
  wardDrag: null,
  suppressWardHandleClick: false,
  lastViewportDebugAt: 0,
  caretScrollRaf: 0,
  lastCaretAutoScrollAt: 0,
  lastCaretAutoScrollTop: 0,
  pendingEditorInputDebug: null,
  pendingEditorTapDebug: null,
  debugLogStatus: "",
  selectionMemoryFrozenUntil: 0,
  restoreSelectionAfterScreenSwitch: false,
  restoreEditorFocusAfterScreenSwitch: false,
  searchOpen: false,
  searchQuery: "",
  searchReturnFocus: null,
  recoveryBaselines: new Map(),
  recoveryLastSavedAt: new Map()
};
const noteDocumentModelTimers = new Map();
const noteParseCache = new Map();
applyUrlOverrides();

init();

async function init() {
  document.documentElement.classList.toggle("is-ipad-device", isLikelyIpadDevice());
  bindEvents();
  initMobileViewportDock();
  registerShiftPadServiceWorker();
  await initAuth();
  render();
  refreshPushSubscriptionIfEnabled().catch((error) => {
    console.warn("Notification subscription refresh failed:", error);
  });
}

function initMobileViewportDock() {
  let rafId = 0;
  let lastViewportHeight = window.visualViewport?.height || window.innerHeight || 0;
  let lastKeyboardOffset = 0;
  let stableIpadViewportHeight = lastViewportHeight;
  let lastLayoutWidth = window.innerWidth || 0;
  let settleTimers = [];

  const refreshStableIpadViewportHeight = () => {
    const viewport = window.visualViewport;
    if (!viewport || !isLikelyIpadDevice()) return;
    const viewportHeight = viewport.height || window.innerHeight || 0;
    const layoutHeight = window.innerHeight || viewportHeight;
    const isUnpanned = Math.abs(viewport.offsetTop || 0) < 24;
    const fillsLayoutViewport = viewportHeight >= layoutHeight - 24;
    if (isUnpanned && fillsLayoutViewport) {
      stableIpadViewportHeight = viewportHeight;
    } else if (viewportHeight > stableIpadViewportHeight) {
      stableIpadViewportHeight = viewportHeight;
    }
  };

  const isIpadKeyboardLikelyVisible = () => {
    const viewport = window.visualViewport;
    if (!viewport || !isLikelyIpadDevice()) return false;
    const viewportHeight = viewport.height || window.innerHeight || 0;
    const baselineHeight = Math.max(stableIpadViewportHeight, viewportHeight);
    return Boolean(
      uiState.editorFocused &&
        baselineHeight - viewportHeight > 72 &&
        Math.max(0, viewport.offsetTop || 0) > 36
    );
  };

  const updateViewportOffset = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      document.documentElement.style.setProperty("--keyboard-offset", "0px");
      document.documentElement.style.setProperty("--viewport-offset-top", "0px");
      document.documentElement.style.setProperty("--viewport-offset-left", "0px");
      updateDesktopTagBarOffset();
      clampCompactShortNoteScrollPosition();
      return;
    }

    refreshStableIpadViewportHeight();

    const rawKeyboardOffset = getVisualKeyboardOffset();
    const keyboardOffset = rawKeyboardOffset < 24 ? 0 : rawKeyboardOffset;
    const viewportTop = keyboardOffset ? Math.max(0, viewport.offsetTop) : 0;
    const viewportLeft = keyboardOffset ? Math.max(0, viewport.offsetLeft) : 0;
    document.documentElement.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    document.documentElement.style.setProperty("--viewport-offset-top", `${viewportTop}px`);
    document.documentElement.style.setProperty("--viewport-offset-left", `${viewportLeft}px`);
    updateDesktopTagBarOffset();
    if (keyboardOffset === 0) {
      clampCompactShortNoteScrollPosition();
    }

    const nextViewportHeight = viewport.height || window.innerHeight || 0;
    if ((lastKeyboardOffset > 48 && keyboardOffset === 0) || nextViewportHeight > lastViewportHeight + 36) {
      scheduleKeyboardHiddenViewportSettle();
    }
    lastViewportHeight = nextViewportHeight;
    lastKeyboardOffset = keyboardOffset;
  };

  const requestViewportOffsetUpdate = () => {
    traceBedIndexScrubViewportEvent();
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(() => {
      updateViewportOffset();
      positionMobileTagDock();
    });
  };

  const clearSettleTimers = () => {
    settleTimers.forEach((timer) => window.clearTimeout(timer));
    settleTimers = [];
  };

  const settleHiddenKeyboardViewport = (shouldLog = false) => {
    if (getVisualKeyboardOffset() >= 24 || isIpadKeyboardLikelyVisible()) {
      requestViewportOffsetUpdate();
      return;
    }

    const viewport = window.visualViewport;
    const staleIpadPan = Boolean(
      viewport &&
        isLikelyIpadDevice() &&
        !shouldDeferCompactShortNoteScrollClamp() &&
        viewport.height >= stableIpadViewportHeight - 24 &&
        (viewport.offsetTop || 0) > 2
    );

    if (staleIpadPan) {
      const targetScrollY = getIpadViewportSettleScrollY(viewport, window.scrollY);
      if (Math.abs(window.scrollY - targetScrollY) > 1) {
        window.scrollTo({ left: window.scrollX, top: targetScrollY, behavior: "auto" });
      }
    }

    document.documentElement.style.setProperty("--keyboard-offset", "0px");
    document.documentElement.style.setProperty("--viewport-offset-top", "0px");
    document.documentElement.style.setProperty("--viewport-offset-left", "0px");
    if (!document.activeElement?.closest?.("#notepad-editor")) {
      uiState.editorFocused = false;
      uiState.mobileTagsOpen = false;
      uiState.editorTapScroll = null;
      syncMobileTagDock();
    }
    positionMobileTagDock();
    updateDesktopTagBarOffset();
    clampCompactShortNoteScrollPosition();
    if (staleIpadPan) {
      window.requestAnimationFrame(() => {
        requestViewportOffsetUpdate();
        updateDesktopTagBarOffset();
      });
    }
    if (shouldLog) {
      appendViewportDebugLog(
        staleIpadPan ? "ipad-viewport-pan-normalized" : "keyboard-hidden-settle",
        "settleHiddenKeyboardViewport"
      );
    }
  };

  const scheduleKeyboardHiddenViewportSettle = () => {
    clearSettleTimers();
    settleTimers = [80, 180, 360, 720].map((delay, index, delays) =>
      window.setTimeout(() => {
        settleHiddenKeyboardViewport(index === delays.length - 1);
      }, delay)
    );
  };

  requestViewportOffsetUpdate();
  window.visualViewport?.addEventListener("resize", requestViewportOffsetUpdate);
  window.visualViewport?.addEventListener("scroll", requestViewportOffsetUpdate);
  window.addEventListener("scroll", requestViewportOffsetUpdate, { passive: true });
  bindShortNoteScrollGestures();
  window.addEventListener(
    "resize",
    () => {
      const nextLayoutWidth = window.innerWidth || 0;
      const layoutWidthChanged = Math.abs(nextLayoutWidth - lastLayoutWidth) > 1;
      lastLayoutWidth = nextLayoutWidth;
      requestViewportOffsetUpdate();
      if (layoutWidthChanged) {
        scheduleKeyboardHiddenViewportSettle();
      }
    },
    { passive: true }
  );
  window.addEventListener("focusin", requestViewportOffsetUpdate);
  window.addEventListener("focusout", () => {
    scheduleKeyboardHiddenViewportSettle();
  });
  window.addEventListener("focus", scheduleKeyboardHiddenViewportSettle);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      scheduleKeyboardHiddenViewportSettle();
    }
  });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(requestViewportOffsetUpdate, 120);
    window.setTimeout(scheduleKeyboardHiddenViewportSettle, 520);
  });
}

function getIpadViewportSettleScrollY(viewport, fallbackScrollY = 0) {
  const pageTop = Number.isFinite(viewport?.pageTop) ? viewport.pageTop : fallbackScrollY;
  const offsetTop = Math.max(0, Number(viewport?.offsetTop || 0));
  return Math.max(0, Math.round(pageTop - offsetTop));
}

function getVisualKeyboardOffset() {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  const heightLoss = Math.max(0, window.innerHeight - viewport.height);
  if (isIpadSplitViewLayout() && heightLoss >= 48) {
    return heightLoss;
  }
  return Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
}

function updateDesktopTagBarOffset() {
  const controlsRect = refs.topControlStack?.getBoundingClientRect?.();
  const controlsBottom = Math.max(0, Math.round(controlsRect?.bottom || 0));
  if (controlsRect?.height) {
    document.documentElement.style.setProperty("--top-controls-height", `${Math.round(controlsRect.height)}px`);
  }
  document.documentElement.style.setProperty("--desktop-tags-top", `${controlsBottom + 8}px`);
  syncDrawerControlPositions();
}

function syncDrawerControlPositions() {
  const root = document.documentElement;
  const viewportWidth = window.innerWidth || root.clientWidth || 0;
  const leftRect = refs.menuBtn?.getBoundingClientRect?.();
  const rightRect = refs.wardOptionsBtn?.getBoundingClientRect?.();
  let drawerContentTop = 0;

  if (leftRect?.width && leftRect?.height) {
    root.style.setProperty("--drawer-left-control-top", `${Math.max(0, Math.round(leftRect.top))}px`);
    root.style.setProperty("--drawer-left-control-left", `${Math.max(0, Math.round(leftRect.left))}px`);
    root.style.setProperty("--drawer-control-size", `${Math.round(leftRect.width)}px`);
    drawerContentTop = Math.max(drawerContentTop, leftRect.bottom);
  }

  if (rightRect?.width && rightRect?.height) {
    root.style.setProperty("--drawer-right-control-top", `${Math.max(0, Math.round(rightRect.top))}px`);
    root.style.setProperty("--drawer-right-control-right", `${Math.max(0, Math.round(viewportWidth - rightRect.right))}px`);
    drawerContentTop = Math.max(drawerContentTop, rightRect.bottom);
  }

  if (drawerContentTop) {
    root.style.setProperty("--drawer-content-top", `${Math.round(drawerContentTop + 14)}px`);
  }
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

  refs.workspaceSwitcher?.addEventListener("click", () => {
    switchWorkspace();
  });

  refs.searchBtn?.addEventListener("click", () => {
    openWorkspaceSearch();
  });

  refs.searchRoot?.addEventListener("click", (event) => {
    if (event.target.closest("[data-search-close]")) {
      closeWorkspaceSearch();
      return;
    }
    const result = event.target.closest("[data-search-result]");
    if (result) {
      openWorkspaceSearchResult(result);
    }
  });

  refs.searchRoot?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-search-input]");
    if (!input) return;
    uiState.searchQuery = input.value;
    renderWorkspaceSearchResults();
  });

  refs.searchRoot?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeWorkspaceSearch();
      return;
    }
    if (event.key === "Tab") {
      trapSearchFocus(event);
    }
  });

  refs.menuBtn?.addEventListener("click", () => {
    clearDrawerCloseTimer();
    syncDrawerControlPositions();
    if (uiState.drawerOpen) {
      closeDrawersWithAnimation();
      return;
    }
    uiState.drawerOpen = true;
    uiState.wardOptionsOpen = false;
    renderDrawer({ animateSide: "left" });
  });

  refs.wardOptionsBtn?.addEventListener("click", () => {
    clearDrawerCloseTimer();
    syncDrawerControlPositions();
    if (uiState.wardOptionsOpen) {
      closeDrawersWithAnimation();
      return;
    }
    uiState.wardOptionsOpen = true;
    uiState.drawerOpen = false;
    renderDrawer({ animateSide: "right" });
  });

  refs.drawerRoot?.addEventListener("click", async (event) => {
    const close = event.target.closest("[data-drawer-close]");
    if (close) {
      closeDrawersWithAnimation();
      return;
    }

    const toggle = event.target.closest("[data-drawer-toggle]");
    if (toggle) {
      toggleDrawerSection(toggle.dataset.drawerToggle);
      return;
    }

    const action = event.target.closest("[data-drawer-action]");
    if (action) {
      await handleDrawerAction(action.dataset.drawerAction, action.dataset);
      return;
    }

    const wardScope = event.target.closest("[data-ward-scope]");
    if (wardScope) {
      selectWardScope(wardScope.dataset.wardScope);
      closeDrawersWithAnimation();
      return;
    }

    const wardDragHandle = event.target.closest("[data-ward-drag-handle]");
    if (wardDragHandle) {
      if (uiState.suppressWardHandleClick) {
        uiState.suppressWardHandleClick = false;
        return;
      }
      selectWardFromDrawer(wardDragHandle.dataset.wardDragHandle);
      return;
    }

    const editWard = event.target.closest("[data-edit-ward]");
    if (editWard) {
      editWardNameFromDrawer(editWard.dataset.editWard);
      return;
    }

    const deleteWard = event.target.closest("[data-delete-ward]");
    if (deleteWard) {
      deleteWardFromDrawer(deleteWard.dataset.deleteWard);
      return;
    }

    const wardButton = event.target.closest("[data-ward-id]");
    if (wardButton) {
      selectWardFromDrawer(wardButton.dataset.wardId);
      closeDrawersWithAnimation();
      return;
    }

    const removeCustomTag = event.target.closest("[data-remove-custom-tag]");
    if (removeCustomTag) {
      removeCustomTagDefinition(removeCustomTag.dataset.removeCustomTag);
      return;
    }
  });

  refs.drawerRoot?.addEventListener("pointerdown", handleWardDragPointerDown);
  refs.drawerRoot?.addEventListener("pointermove", handleWardDragPointerMove);
  refs.drawerRoot?.addEventListener("pointerup", handleWardDragPointerUp);
  refs.drawerRoot?.addEventListener("pointercancel", handleWardDragPointerCancel);
  refs.drawerRoot?.addEventListener("contextmenu", (event) => {
    if (event.target.closest?.("[data-ward-drag-handle]")) {
      event.preventDefault();
    }
  });

  refs.drawerRoot?.addEventListener("change", async (event) => {
    const notificationToggle = event.target.closest("[data-notification-toggle]");
    if (notificationToggle) {
      if (notificationToggle.checked) {
        await enablePushNotifications();
      } else {
        await disablePushNotifications();
      }
      return;
    }

    const wardNameInput = event.target.closest("[data-ward-name-input]");
    if (wardNameInput) {
      renameWardFromDrawer(wardNameInput.dataset.wardNameInput, wardNameInput.value);
      return;
    }

    const multipleWardSetting = event.target.closest("[data-multiple-wards-setting]");
    if (multipleWardSetting) {
      uiState.animateWardAdd = multipleWardSetting.checked;
      updateMultipleWardsMode(multipleWardSetting.checked);
      return;
    }

    const debugLogsSetting = event.target.closest("[data-debug-logs-enabled]");
    if (debugLogsSetting) {
      setEditorDebugLoggingEnabled(debugLogsSetting.checked);
      uiState.debugLogStatus = debugLogsSetting.checked ? "Editor debug logging is on for this device." : "Editor debug logging is off.";
      renderDrawer();
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

  refs.drawerRoot?.addEventListener("keydown", (event) => {
    const wardNameInput = event.target.closest("[data-ward-name-input]");
    if (!wardNameInput) return;

    if (event.key === "Enter") {
      if (event.isComposing || uiState.wardNameCompositionActive) return;
      event.preventDefault();
      renameWardFromDrawer(wardNameInput.dataset.wardNameInput, wardNameInput.value);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      uiState.editingWardId = "";
      uiState.wardNameCompositionActive = false;
      renderDrawer();
    }
  });

  refs.drawerRoot?.addEventListener("compositionstart", (event) => {
    if (!event.target.closest("[data-ward-name-input]")) return;
    uiState.wardNameCompositionActive = true;
  });

  refs.drawerRoot?.addEventListener("compositionend", (event) => {
    if (!event.target.closest("[data-ward-name-input]")) return;
    uiState.wardNameCompositionActive = false;
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
    const bedIndexRail = event.target.closest?.(".bed-index-rail");
    if (bedIndexRail) {
      startBedIndexScrub(bedIndexRail, event);
      return;
    }
    const bedToken = event.target.closest?.('.tag-token[data-tag="bed"]');
    if (bedToken) {
      startBedLongPress(bedToken, event);
    }
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    clearScreenSwitchSelectionRestore();
    beginEditorTapDebug(editor, event);
    rememberEditorTapScroll(event);
  });

  refs.editorRoot.addEventListener("pointermove", (event) => {
    if (uiState.bedIndexScrub) {
      event.preventDefault();
      if (uiState.bedIndexScrub.useTouchCoordinate) {
        observeBedIndexCapturedPointer(event);
        return;
      }
      updateBedIndexScrub(event);
      return;
    }
    updateBedLongPress(event);
    markEditorPointerMoved(event);
  }, { passive: false });

  refs.editorRoot.addEventListener("pointerup", (event) => {
    if (uiState.bedIndexScrub?.useTouchCoordinate) return;
    if (finishBedIndexScrub(event)) return;
    cancelBedLongPress(event);
  }, { passive: true });
  refs.editorRoot.addEventListener("pointercancel", (event) => {
    if (uiState.bedIndexScrub?.useTouchCoordinate) return;
    if (finishBedIndexScrub(event)) return;
    cancelBedLongPress(event);
  }, { passive: true });

  refs.editorRoot.addEventListener("contextmenu", (event) => {
    const bedToken = event.target.closest?.('.tag-token[data-tag="bed"]');
    if (!bedToken || bedToken.dataset.editing === "true") return;
    event.preventDefault();
    cancelBedLongPress();
    openBedActionSheet(bedToken);
  });

  refs.editorRoot.addEventListener("touchstart", (event) => {
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    clearScreenSwitchSelectionRestore();
    beginEditorTapDebug(editor, event);
    rememberEditorTapScroll(event);
  }, { passive: true });

  refs.editorRoot.addEventListener("touchmove", (event) => {
    if (uiState.bedIndexScrub?.useTouchCoordinate) {
      event.preventDefault();
      updateBedIndexScrubFromTouch(event);
      return;
    }
    markEditorPointerMoved(event);
  }, { passive: false });

  refs.editorRoot.addEventListener("touchend", (event) => {
    if (uiState.bedIndexScrub?.useTouchCoordinate) finishBedIndexScrub(event);
  }, { passive: true });
  refs.editorRoot.addEventListener("touchcancel", (event) => {
    if (uiState.bedIndexScrub?.useTouchCoordinate) finishBedIndexScrub(event);
  }, { passive: true });

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

  refs.stickyWardRoot?.addEventListener("click", (event) => {
    const wardSwitch = event.target.closest?.("[data-ward-switch]");
    if (wardSwitch) {
      switchWardFromEditor(wardSwitch.dataset.wardSwitch);
      return;
    }

    const resetNote = event.target.closest?.("[data-reset-note]");
    if (resetNote) {
      resetCurrentWardNote();
      return;
    }

    const sortBeds = event.target.closest?.("[data-sort-beds]");
    if (sortBeds) {
      sortCurrentWardBedSections();
    }
  });

  refs.editorRoot.addEventListener("click", (event) => {
    const clickedBedToken = event.target.closest?.('.tag-token[data-tag="bed"]');
    if (clickedBedToken && uiState.suppressNextBedClick) {
      uiState.suppressNextBedClick = false;
      event.preventDefault();
      return;
    }

    const wardSwitch = event.target.closest?.("[data-ward-switch]");
    if (wardSwitch) {
      switchWardFromEditor(wardSwitch.dataset.wardSwitch);
      return;
    }

    const resetNote = event.target.closest?.("[data-reset-note]");
    if (resetNote) {
      resetCurrentWardNote();
      return;
    }

    const sortBeds = event.target.closest?.("[data-sort-beds]");
    if (sortBeds) {
      sortCurrentWardBedSections();
      return;
    }

    const bedJump = event.target.closest?.("[data-bed-jump]");
    if (bedJump) {
      if (uiState.suppressNextBedIndexClick) {
        uiState.suppressNextBedIndexClick = false;
        window.clearTimeout(uiState.bedIndexClickSuppressTimer);
        uiState.bedIndexClickSuppressTimer = null;
        return;
      }
      jumpToBedInEditor(bedJump.dataset.bedJump);
      return;
    }

    const quickButton = event.target.closest("[data-quick-tag]");
    if (quickButton) {
      handleQuickTag(quickButton.dataset.quickTag);
      return;
    }

    const hnToken = event.target.closest('.tag-token[data-tag="hn"]');
    if (hnToken && hnToken.dataset.editing !== "true") {
      event.preventDefault();
      uiState.pendingEditorTapDebug = null;
      copyHnNumber(hnToken);
      return;
    }

    const todoToken = event.target.closest('.tag-token[data-tag="todo"]');
    if (todoToken) {
      toggleTodoTokenInEditor(todoToken);
      return;
    }

    if (getEditorFromEventTarget(event.target)) {
      const editor = refs.editorRoot.querySelector("#notepad-editor");
      uiState.editorFocused = true;
      syncMobileTagDock();
      rememberEditorSelection(editor);
      finishEditorTapDebug(editor);
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
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    uiState.editorFocused = true;
    hideBedIndex();
    syncMobileTagDock();
    rememberEditorSelection(editor);
    stabilizeEditorTapScroll(editor);
  });

  refs.editorRoot.addEventListener("focusout", (event) => {
    if (!getEditorFromEventTarget(event.target)) return;
    window.setTimeout(() => {
      uiState.editorFocused = Boolean(document.activeElement?.closest?.("#notepad-editor"));
      if (!uiState.editorFocused) {
        uiState.mobileTagsOpen = false;
        applyPendingRemoteStateIfReady();
      }
      syncMobileTagDock();
    }, 50);
  });

  refs.editorRoot.addEventListener("paste", (event) => {
    handleNotepadPaste(event);
  });

  refs.editorRoot.addEventListener("input", (event) => {
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;
    clearEditorTapScrollForInput();
    syncEditorEmptyState(editor);

    if ((event.inputType || "").startsWith("deleteContent")) {
      repairCaretAtEditorLineBoundary(editor);
      if (!finishDeferredEditorInputDebug(editor, event, { handledBy: "browser-input-delete" })) {
        appendEditorDebugLog({
          action: event.inputType === "deleteContentForward" ? "delete-forward" : "backspace",
          source: "input",
          inputType: event.inputType || "",
          success: true,
          handledBy: "browser-input",
          before: null,
          after: captureEditorDebugSnapshot(editor)
        });
      }
      syncEditorDocument();
      hideBedIndex();
      queueEditorCaretVisibilityCheck(editor, "delete");
      return;
    }
    discardFreshFinalizedTagInsertions();
    maybeFinalizeEditingTimeToken(editor);
    if ((event.inputType || "") === "insertText") {
      removeBrowserTrailingEmptyLineAfterInput(editor);
    }
    ensureEditorLineIdentities(editor, note.id);
    updateSortBedsButtonFromEditor(editor);
    const nextHtml = sanitizeEditorHtml(editor.innerHTML);
    if (nextHtml === note.documentHtml) {
      rememberEditorSelection(editor);
      hideBedIndex();
      queueEditorCaretVisibilityCheck(editor, "unchanged-input");
      finishDeferredEditorInputDebug(editor, event, { handledBy: "browser-input-unchanged", changed: false });
      return;
    }
    setNoteDocumentHtml(note, nextHtml, { deferModel: true });
    rememberEditorSelection(editor);
    saveState();
    refreshWardDrawerMetricsIfOpen();
    hideBedIndex();
    queueEditorCaretVisibilityCheck(editor, event.inputType || "input");
    finishDeferredEditorInputDebug(editor, event, { handledBy: "browser-input", changed: true });
    return;
  });

  refs.editorRoot.addEventListener("blur", (event) => {
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;

    ensureEditorLineIdentities(editor, note.id);
    const nextHtml = sanitizeEditorHtml(editor.innerHTML);
    if (nextHtml === note.documentHtml) {
      rememberEditorSelection(editor);
      return;
    }
    setNoteDocumentHtml(note, nextHtml);
    rememberEditorSelection(editor);
    saveState();
  }, true);

  refs.editorRoot.addEventListener("keyup", (event) => {
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    const note = getCurrentNote();
    if (!note) return;

    if (event.key === "Backspace" || event.key === "Delete") {
      repairCaretAtEditorLineBoundary(editor);
    }
    ensureEditorLineIdentities(editor, note.id);
    const nextHtml = sanitizeEditorHtml(editor.innerHTML);
    if (nextHtml === note.documentHtml) {
      rememberEditorSelection(editor);
      return;
    }
    setNoteDocumentHtml(note, nextHtml);
    rememberEditorSelection(editor);
    saveState();
  });

  refs.editorRoot.addEventListener("click", (event) => {
    const editor = getEditorFromEventTarget(event.target);
    if (editor) {
      const note = getCurrentNote();
      if (!note) return;

      ensureEditorLineIdentities(editor, note.id);
      const nextHtml = sanitizeEditorHtml(editor.innerHTML);
      if (nextHtml === note.documentHtml) {
        rememberEditorSelection(editor);
        return;
      }
      setNoteDocumentHtml(note, nextHtml);
      rememberEditorSelection(editor);
      saveState();
    }
  });

  refs.editorRoot.addEventListener("mouseup", (event) => {
    const editor = getEditorFromEventTarget(event.target);
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
    const hnToken = event.target.closest?.('.tag-token[data-tag="hn"][data-editing="false"]');
    if (hnToken && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      copyHnNumber(hnToken);
      return;
    }
    if (getEditorFromEventTarget(event.target)) {
      restoreEditorSelectionAfterScreenSwitch("keydown");
      hideBedIndex();
      handleNotepadKeydown(event);
    }
  });

  refs.editorRoot.addEventListener("beforeinput", (event) => {
    const editor = getEditorFromEventTarget(event.target);
    if (!editor) return;
    restoreEditorSelectionAfterScreenSwitch("beforeinput");
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
      const editor = refs.editorRoot.querySelector("#notepad-editor");
      const debugEntry = beginEditorDebugAction(editor, {
        action: "mobile-tag-menu-toggle",
        source: "mobile-tag-dock",
        open: !uiState.mobileTagsOpen
      });
      uiState.mobileTagsOpen = !uiState.mobileTagsOpen;
      restoreEditorFocusAndSelection();
      syncMobileTagDock();
      finishEditorDebugAction(debugEntry, {
        success: true,
        handledBy: "toggleMobileTagMenu",
        editor,
        extra: { open: uiState.mobileTagsOpen }
      });
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

  refs.bedActionRoot?.addEventListener("click", (event) => {
    const close = event.target.closest?.("[data-bed-action-close]");
    if (close || event.target.matches?.("[data-bed-action-backdrop]")) {
      closeBedActionSheet();
      return;
    }

    const action = event.target.closest?.("[data-bed-action]");
    if (action) {
      setBedActionMode(action.dataset.bedAction);
      return;
    }

    const deleteBed = event.target.closest?.("[data-bed-delete-confirm]");
    if (deleteBed) {
      deleteSelectedBedSection();
      return;
    }

    const ward = event.target.closest?.("[data-bed-target-ward]");
    if (ward) {
      moveBedSectionToWard(ward.dataset.bedTargetWard);
    }
  });

  refs.bedActionRoot?.addEventListener("submit", (event) => {
    const form = event.target.closest?.("[data-bed-rename-form]");
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector("[data-bed-name-input]");
    renameSelectedBed(input?.value || "");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && uiState.bedAction) {
      event.preventDefault();
      closeBedActionSheet();
    }
  });

  refs.timelineRoot.addEventListener("change", (event) => {
    const bedEditor = event.target.closest("[data-bed-editor]");
    if (bedEditor) {
      updateBedGroupText(bedEditor.dataset.bedKey, getEditorPlainText(bedEditor));
      return;
    }

    const summaryEditor = event.target.closest("[data-summary-editor]");
    if (summaryEditor) {
      const debugResult = updateSummaryLineText(
        summaryEditor.dataset.noteId,
        Number(summaryEditor.dataset.lineIndex),
        summaryEditor.value,
        parseOptionalIndex(summaryEditor.dataset.sourceIndex),
        summaryEditor.dataset.lineId || ""
      );
      appendSummaryEditorDebugLog(summaryEditor, "change", debugResult);
      return;
    }

    const checkbox = event.target.closest("[data-token-id]");
    if (!checkbox) return;

    const beforeNote = captureNoteDebugSnapshot(findNoteById(checkbox.dataset.noteId));
    toggleTaggedLineDone(checkbox.dataset.noteId, checkbox.dataset.tokenId, checkbox.checked, checkbox.dataset.reminderKey);
    appendEditorDebugLog({
      action: "summary-toggle-done",
      source: "timeline-change",
      success: true,
      handledBy: "toggleTaggedLineDone",
      noteId: checkbox.dataset.noteId || "",
      tokenId: checkbox.dataset.tokenId || "",
      reminderKey: checkbox.dataset.reminderKey || "",
      checked: Boolean(checkbox.checked),
      before: beforeNote,
      after: captureNoteDebugSnapshot(findNoteById(checkbox.dataset.noteId))
    });
  });

  refs.timelineRoot.addEventListener("input", (event) => {
    const bedEditor = event.target.closest("[data-bed-editor]");
    if (bedEditor) {
      autoSizeTextarea(bedEditor);
      updateBedGroupText(bedEditor.dataset.bedKey, getEditorPlainText(bedEditor));
      return;
    }

    const summaryEditor = event.target.closest("[data-summary-editor]");
    if (!summaryEditor) return;

    autoSizeTextarea(summaryEditor);
    const debugResult = updateSummaryLineText(
      summaryEditor.dataset.noteId,
      Number(summaryEditor.dataset.lineIndex),
      summaryEditor.value,
      parseOptionalIndex(summaryEditor.dataset.sourceIndex),
      summaryEditor.dataset.lineId || ""
    );
    appendSummaryEditorDebugLog(summaryEditor, "input", debugResult);
  });

  refs.timelineRoot.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-summary-tab]");
    if (tab) {
      state.summaryTab = SUMMARY_TABS.includes(tab.dataset.summaryTab) ? tab.dataset.summaryTab : "reminders";
      saveState();
      renderTimeline();
      return;
    }

    const scopeToggle = event.target.closest("[data-summary-scope-toggle]");
    if (scopeToggle) {
      toggleSummaryScopeFromTimeline();
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
    if (isEditorSelectionMemoryFrozen()) return;
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    rememberEditorSelection(editor);
    stabilizeEditorTapScroll(editor);
  });

  window.addEventListener("blur", () => {
    freezeEditorSelectionForScreenSwitch("window-blur");
  });
  window.addEventListener("focus", () => {
    scheduleScreenSwitchSelectionRestore("window-focus");
  });
  window.addEventListener("pagehide", () => {
    freezeEditorSelectionForScreenSwitch("pagehide");
    flushLocalStateSave();
    flushPendingEditorDebugLogsForLifecycle("pagehide");
  });
  window.addEventListener("beforeunload", () => {
    flushLocalStateSave();
    flushPendingEditorDebugLogsForLifecycle("beforeunload");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      freezeEditorSelectionForScreenSwitch("hidden");
      flushLocalStateSave();
      flushPendingEditorDebugLogsForLifecycle("hidden");
    } else {
      scheduleScreenSwitchSelectionRestore("visible");
      fetchLatestCloudState({ reason: "visible" }).catch((error) => {
        console.error("Cloud sync refresh failed:", error);
      });
      applyPendingRemoteStateIfReady();
      queueEditorDebugCloudUpload();
      refreshPushSubscriptionIfEnabled().catch((error) => {
        console.warn("Notification foreground refresh failed:", error);
      });
    }
  });
  window.addEventListener("focus", () => {
    fetchLatestCloudState({ reason: "focus" }).catch((error) => {
      console.error("Cloud sync focus refresh failed:", error);
    });
    applyPendingRemoteStateIfReady();
    queueEditorDebugCloudUpload();
    refreshPushSubscriptionIfEnabled().catch((error) => {
      console.warn("Notification focus refresh failed:", error);
    });
  });
  window.addEventListener("online", () => {
    fetchLatestCloudState({ reason: "online" }).catch((error) => {
      console.error("Cloud sync online refresh failed:", error);
    });
    queueEditorDebugCloudUpload();
    refreshPushSubscriptionIfEnabled({ force: true }).catch((error) => {
      console.warn("Notification reconnect refresh failed:", error);
    });
  });
  window.addEventListener("resize", syncMobileTagDock, { passive: true });
  window.addEventListener("resize", updateDesktopTagBarOffset, { passive: true });
  window.addEventListener("scroll", showBedIndexDuringScroll, { passive: true });
}

function render() {
  ensureSelection();
  renderWorkspaceIdentity();
  renderAuthUi();
  refs.workspace.classList.toggle("single-ward", Boolean(state.preferences.singleWardMode));
  refs.timelineView.classList.toggle("single-ward-summary", state.timelineScope === "active");

  refs.notesTabBtn.classList.toggle("is-active", state.activeView === "notes");
  refs.timelineTabBtn.classList.toggle("is-active", state.activeView === "timeline");
  refs.notesTabBtn.setAttribute("aria-selected", String(state.activeView === "notes"));
  refs.timelineTabBtn.setAttribute("aria-selected", String(state.activeView === "timeline"));
  refs.notesView.classList.toggle("hidden", state.activeView !== "notes");
  refs.timelineView.classList.toggle("hidden", state.activeView !== "timeline");

  renderStickyWardBar();
  renderEditor();
  renderTimeline();
  renderDrawer();
  renderBedActionSheet();
  renderWorkspaceSearch();
  refreshMobileTagDock();
  requestAnimationFrame(updateDesktopTagBarOffset);
}

function openWorkspaceSearch() {
  syncEditorDocument();
  uiState.searchOpen = true;
  uiState.searchReturnFocus = document.activeElement;
  renderWorkspaceSearch();
  window.requestAnimationFrame(() => {
    refs.searchRoot?.querySelector("[data-search-input]")?.focus({ preventScroll: true });
  });
}

function closeWorkspaceSearch({ restoreFocus = true } = {}) {
  uiState.searchOpen = false;
  renderWorkspaceSearch();
  if (restoreFocus) {
    const returnTarget = uiState.searchReturnFocus?.isConnected ? uiState.searchReturnFocus : refs.searchBtn;
    window.requestAnimationFrame(() => returnTarget?.focus?.({ preventScroll: true }));
  }
  uiState.searchReturnFocus = null;
}

function trapSearchFocus(event) {
  const focusable = [...(refs.searchRoot?.querySelectorAll("button:not([disabled]), input:not([disabled])") || [])]
    .filter((element) => element.offsetParent !== null);
  if (focusable.length < 2) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderWorkspaceSearch() {
  if (!refs.searchRoot) return;
  if (!uiState.searchOpen) {
    refs.searchRoot.innerHTML = "";
    refs.searchBtn?.setAttribute("aria-expanded", "false");
    return;
  }

  refs.searchBtn?.setAttribute("aria-expanded", "true");
  refs.searchRoot.innerHTML = `
    <div class="search-layer" role="dialog" aria-modal="true" aria-labelledby="search-title">
      <button class="search-scrim" type="button" data-search-close="true" aria-label="Close search"></button>
      <section class="search-sheet">
        <header class="search-head">
          <div>
            <p class="section-kicker">${escapeHtml(getActiveWorkspaceMeta().title)}</p>
            <h2 id="search-title">Search notes</h2>
          </div>
          <button class="search-close" type="button" data-search-close="true" aria-label="Close search" title="Close search">×</button>
        </header>
        <label class="search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
          <span class="sr-only">Search ward and note text</span>
          <input type="search" data-search-input="true" value="${escapeAttribute(uiState.searchQuery)}" placeholder="Search beds, tasks, or text" autocomplete="off" />
        </label>
        <div class="search-results" data-search-results="true" aria-live="polite"></div>
      </section>
    </div>
  `;
  renderWorkspaceSearchResults();
}

function renderWorkspaceSearchResults() {
  const root = refs.searchRoot?.querySelector("[data-search-results]");
  if (!root) return;
  const query = uiState.searchQuery.trim();
  if (query.length < 2) {
    root.innerHTML = `<p class="search-empty">Type at least two characters to search every ward in ${escapeHtml(getActiveWorkspaceMeta().title)}.</p>`;
    return;
  }

  const results = buildWorkspaceSearchResults(query);
  if (!results.length) {
    root.innerHTML = `<p class="search-empty">No matching notes.</p>`;
    return;
  }

  root.innerHTML = `
    <p class="search-result-count">${results.length} result${results.length === 1 ? "" : "s"}</p>
    <div class="search-result-list">
      ${results.map((result) => `
        <button
          class="search-result-row"
          type="button"
          data-search-result="true"
          data-search-ward="${escapeAttribute(result.wardId)}"
          data-search-note="${escapeAttribute(result.noteId)}"
          data-search-source-line="${result.sourceLineIndex}"
          data-search-line-id="${escapeAttribute(result.lineId || "")}"
        >
          <span class="search-result-meta">${escapeHtml(result.wardName)}${result.bedLabel ? ` · Bed ${escapeHtml(result.bedLabel)}` : ""}</span>
          <strong>${escapeHtml(result.text)}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function buildWorkspaceSearchResults(query) {
  const needle = query.toLocaleLowerCase();
  const results = [];
  state.wards.some((ward) => {
    return ward.notes.some((note) => {
      const parsed = getCachedTaggedLines(note);
      parsed.lines.forEach((line) => {
        if (results.length >= 60) return;
        const text = String(line.text || line.visibleText || "").trim();
        const searchable = `${ward.name} ${note.title || ""} ${line.bedLabel || ""} ${text}`.toLocaleLowerCase();
        if (!text || !searchable.includes(needle)) return;
        results.push({
          wardId: ward.id,
          wardName: ward.name,
          noteId: note.id,
          bedLabel: line.bedLabel || "",
          lineId: line.lineId || "",
          sourceLineIndex: Number.isInteger(line.sourceLineIndex) ? line.sourceLineIndex : line.lineIndex,
          text: text.length > 140 ? `${text.slice(0, 137)}...` : text
        });
      });
      return results.length >= 60;
    });
  });
  return results;
}

function openWorkspaceSearchResult(button) {
  const ward = state.wards.find((item) => item.id === button.dataset.searchWard);
  const note = ward?.notes.find((item) => item.id === button.dataset.searchNote);
  if (!ward || !note) return;
  state.selectedWardId = ward.id;
  state.selectedNoteId = note.id;
  state.activeView = "notes";
  uiState.searchOpen = false;
  uiState.searchReturnFocus = null;
  saveState();
  render();
  const lineId = String(button.dataset.searchLineId || "");
  const sourceLineIndex = Number(button.dataset.searchSourceLine);
  window.requestAnimationFrame(() => {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    const line = lineId
      ? editor?.querySelector?.(`[data-line-id="${cssEscape(lineId)}"]`)
      : Number.isInteger(sourceLineIndex) ? editor?.children?.[sourceLineIndex] : null;
    line?.scrollIntoView?.({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    line?.classList?.add("search-result-flash");
    window.setTimeout(() => line?.classList?.remove("search-result-flash"), 1100);
  });
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function renderDrawer({ animateSide = "", force = false } = {}) {
  if (!refs.drawerRoot) return;
  if (!force && getActiveWardNameInput()) {
    if (!uiState.drawerRenderPending) {
      appendEditorDebugLog({
        action: "ward-name-render-deferred",
        source: "drawer-render",
        success: true,
        handledBy: "renderDrawer",
        targetWardId: uiState.editingWardId
      });
    }
    uiState.drawerRenderPending = true;
    return;
  }
  uiState.drawerRenderPending = false;
  clearDrawerCloseTimer();
  syncDrawerControlPositions();
  captureDrawerScrollPositions();
  if (animateSide === "left") uiState.drawerScrollTop.left = 0;
  if (animateSide === "right") uiState.drawerScrollTop.right = 0;
  const open = Boolean(uiState.drawerOpen);
  const wardOptionsOpen = Boolean(uiState.wardOptionsOpen);
  refs.menuBtn?.setAttribute("aria-expanded", String(open));
  refs.menuBtn?.setAttribute("aria-label", open ? "Close settings" : "Open settings");
  refs.menuBtn?.classList.toggle("is-drawer-active", open);
  refs.wardOptionsBtn?.setAttribute("aria-expanded", String(wardOptionsOpen));
  refs.wardOptionsBtn?.setAttribute("aria-label", wardOptionsOpen ? "Close ward list" : "Open ward list");
  refs.wardOptionsBtn?.classList.toggle("is-drawer-active", wardOptionsOpen);
  refs.drawerRoot.innerHTML = `
    <div class="drawer-layer ${open && animateSide !== "left" ? "is-open" : ""}" data-drawer-side="left" aria-hidden="${open ? "false" : "true"}">
      <button class="drawer-scrim" type="button" data-drawer-close="true" aria-label="Close menu"></button>
      <button class="drawer-corner-close drawer-corner-close-left menu-btn" type="button" data-drawer-close="true" aria-label="Close settings">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <aside class="side-drawer" aria-label="App menu">
        <div class="drawer-head">
          <div>
            <p class="section-kicker">Menu</p>
            <h2>${escapeHtml(getActiveWorkspaceMeta().title)}</h2>
          </div>
        </div>
        ${renderAccountMenu()}
        ${renderSettingsMenu()}
      </aside>
    </div>
    <div class="drawer-layer drawer-layer-right ${wardOptionsOpen && animateSide !== "right" ? "is-open" : ""}" data-drawer-side="right" aria-hidden="${wardOptionsOpen ? "false" : "true"}">
      <button class="drawer-scrim" type="button" data-drawer-close="true" aria-label="Close ward options"></button>
      <button class="drawer-corner-close drawer-corner-close-right menu-btn" type="button" data-drawer-close="true" aria-label="Close ward list">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <aside class="side-drawer side-drawer-right" aria-label="Ward options">
        <div class="drawer-head drawer-head-right">
          <div>
            <p class="section-kicker">Wards</p>
            <h2>Ward options</h2>
          </div>
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
      refs.drawerRoot?.querySelector(".ward-add-bottom-section")?.classList.remove("should-animate");
    }, 260);
  }
  restoreDrawerScrollPositions();
  focusEditingWardInput();
}

function captureDrawerScrollPositions() {
  const leftDrawer = refs.drawerRoot?.querySelector('[data-drawer-side="left"] .side-drawer');
  const rightDrawer = refs.drawerRoot?.querySelector('[data-drawer-side="right"] .side-drawer');
  if (leftDrawer) uiState.drawerScrollTop.left = leftDrawer.scrollTop;
  if (rightDrawer) uiState.drawerScrollTop.right = rightDrawer.scrollTop;
}

function restoreDrawerScrollPositions() {
  const leftDrawer = refs.drawerRoot?.querySelector('[data-drawer-side="left"] .side-drawer');
  const rightDrawer = refs.drawerRoot?.querySelector('[data-drawer-side="right"] .side-drawer');
  if (leftDrawer) leftDrawer.scrollTop = uiState.drawerScrollTop.left || 0;
  if (rightDrawer) rightDrawer.scrollTop = uiState.drawerScrollTop.right || 0;
}

function getActiveWardNameInput() {
  if (!uiState.editingWardId) return null;
  return refs.drawerRoot?.querySelector(
    `[data-ward-name-input="${cssEscape(uiState.editingWardId)}"]`
  ) || null;
}

function clearDrawerCloseTimer() {
  if (!uiState.drawerCloseTimer) return;
  window.clearTimeout(uiState.drawerCloseTimer);
  uiState.drawerCloseTimer = null;
}

function closeDrawersWithAnimation() {
  if (!refs.drawerRoot) return;
  const openLayers = [...refs.drawerRoot.querySelectorAll(".drawer-layer.is-open")];
  uiState.drawerOpen = false;
  uiState.wardOptionsOpen = false;
  refs.menuBtn?.setAttribute("aria-expanded", "false");
  refs.menuBtn?.setAttribute("aria-label", "Open settings");
  refs.menuBtn?.classList.remove("is-drawer-active");
  refs.wardOptionsBtn?.setAttribute("aria-expanded", "false");
  refs.wardOptionsBtn?.setAttribute("aria-label", "Open ward list");
  refs.wardOptionsBtn?.classList.remove("is-drawer-active");

  if (!openLayers.length) {
    renderDrawer();
    return;
  }

  openLayers.forEach((layer) => {
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
  });

  clearDrawerCloseTimer();
  uiState.drawerCloseTimer = window.setTimeout(() => {
    uiState.drawerCloseTimer = null;
    renderDrawer();
  }, 240);
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
  const tagDelaysOpen = isDrawerSectionOpen("tag-delays");
  const notificationsOpen = isDrawerSectionOpen("notifications");
  const customOpen = isDrawerSectionOpen("custom-tags");
  const diagnosticsOpen = isDrawerSectionOpen("diagnostics");
  const historyOpen = isDrawerSectionOpen("history");
  const resetOpen = isDrawerSectionOpen("reset");
  return `
    <section class="drawer-section ${tagDelaysOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("tag-delays", "Tag delays", tagDelaysOpen)}
      <div class="drawer-panel">
        <div class="settings-grid">
          ${renderDelayField("time", "Time tag delay", preferences.tagDelays.time)}
          ${renderDelayField("lab", "Lab delay", preferences.tagDelays.lab)}
          ${renderDelayField("io", "I/O delay", preferences.tagDelays.io)}
        </div>
        <p class="drawer-help">I/O uses the note creation time: before 14:30 gives 14:00 and 22:00; after 14:30 gives 22:00 only.</p>
      </div>
    </section>
    <section class="drawer-section ${notificationsOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("notifications", "Notifications", notificationsOpen)}
      <div class="drawer-panel">
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
    <section class="drawer-section ${diagnosticsOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("diagnostics", "Diagnostics", diagnosticsOpen)}
      <div class="drawer-panel">
        ${renderDiagnosticsSettings()}
      </div>
    </section>
    <section class="drawer-section ${historyOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("history", "History", historyOpen)}
      <div class="drawer-panel">
        ${renderWorkspaceHistory()}
      </div>
    </section>
    <section class="drawer-section danger-zone ${resetOpen ? "is-open" : ""}">
      ${renderDrawerSectionToggle("reset", "Reset", resetOpen)}
      <div class="drawer-panel">
        <p class="drawer-help">The current shift is archived before the workspace is cleared.</p>
        <button class="ghost-btn danger-btn" type="button" data-drawer-action="reset-notes">Archive and reset</button>
      </div>
    </section>
  `;
}

function renderWorkspaceHistory() {
  const recoveries = Array.isArray(state.recoveryHistory) ? state.recoveryHistory.slice(0, 6) : [];
  const archives = Array.isArray(state.shiftArchives) ? state.shiftArchives : [];
  return `
    <div class="history-block">
      <div class="history-block-head"><strong>Recent note versions</strong><small>${state.recoveryHistory.length}/${RECOVERY_HISTORY_LIMIT}</small></div>
      ${recoveries.length ? recoveries.map((entry) => {
        const preview = getRecoveryHistoryPreview(entry.documentHtml);
        return `
        <div class="history-row history-recovery-row">
          <div class="history-copy"><strong>${escapeHtml(entry.wardName || "Recovered ward")}</strong><small>${escapeHtml(formatHistoryTimestamp(entry.createdAt))} · ${escapeHtml(entry.reason || "Auto recovery")}</small><span class="history-preview">${escapeHtml(preview)}</span></div>
          <button class="tiny-btn" type="button" data-drawer-action="restore-recovery" data-history-id="${escapeAttribute(entry.id)}" aria-label="Restore version from ${escapeAttribute(formatHistoryTimestamp(entry.createdAt))}">Restore</button>
        </div>
      `;
      }).join("") : `<p class="drawer-help">Earlier note versions appear here automatically while you edit.</p>`}
    </div>
    <div class="history-block">
      <div class="history-block-head"><strong>Shift archive</strong><small>${archives.length}/${SHIFT_ARCHIVE_LIMIT}</small></div>
      ${archives.length ? archives.map((entry) => `
        <div class="history-row">
          <div><strong>${escapeHtml(entry.label || "Archived shift")}</strong><small>${escapeHtml(formatHistoryTimestamp(entry.createdAt))}</small></div>
          <div class="history-actions">
            <button class="tiny-btn" type="button" data-drawer-action="restore-archive" data-history-id="${escapeAttribute(entry.id)}">Restore</button>
            <button class="history-delete-btn" type="button" data-drawer-action="delete-archive" data-history-id="${escapeAttribute(entry.id)}" aria-label="Delete archive" title="Delete archive">×</button>
          </div>
        </div>
      `).join("") : `<p class="drawer-help">Archive and reset stores the completed shift here.</p>`}
    </div>
  `;
}

function formatHistoryTimestamp(value) {
  const date = new Date(Number(value) || Date.now());
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function getRecoveryHistoryPreview(html) {
  const root = parseHtmlRoot(String(html || ""));
  normalizeEditorBlocks(root);
  const parts = Array.from(root.children)
    .filter((line) => !isEditorLineEmpty(line))
    .slice(0, 3)
    .map((line) => {
      const parsed = parseLineNode(line);
      return parsed.visibleText || parsed.text;
    })
    .map((text) => String(text || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const preview = parts.join(" · ");
  if (!preview) return "Blank version";
  return preview.length > 118 ? `${preview.slice(0, 115)}...` : preview;
}

function renderWardOptionsMenu() {
  const preferences = getPreferences();
  const multipleWardsEnabled = !preferences.singleWardMode;
  const allSelected = state.timelineScope !== "active";
  const wardAddClass = [
    "drawer-section",
    "ward-add-bottom-section",
    uiState.animateWardAdd ? "should-animate" : ""
  ].filter(Boolean).join(" ");
  const wardAddMarkup = multipleWardsEnabled ? `
    <section class="${wardAddClass}">
      <button class="accent-btn ward-add-btn" type="button" data-drawer-action="add-ward">Add ward</button>
    </section>
  ` : "";
  const wardListMarkup = multipleWardsEnabled ? `
    <section class="drawer-section drawer-ward-list-section">
      <div class="drawer-section-title">
        <span>Active lists</span>
      </div>
      <div class="ward-list drawer-ward-list" data-ward-sort-list="true">
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
    </section>
    ${wardListMarkup}
    ${wardAddMarkup}
  `;
}

function renderDrawerWardButton(ward) {
  const active = state.timelineScope === "active" && ward.id === state.selectedWardId;
  const editing = uiState.editingWardId === ward.id;
  const caseCount = countBedsForWard(ward);
  const openReminderCount = countOpenRemindersForWard(ward);
  const caseLabel = `${caseCount} ${caseCount === 1 ? "case" : "cases"}`;
  const reminderLabel = `${openReminderCount} open reminder${openReminderCount === 1 ? "" : "s"}`;
  const dragLabel = openReminderCount
    ? `${reminderLabel}. Move ${ward.name}`
    : `Move ${ward.name}`;
  return `
    <div
      class="ward-tab ${active ? "is-active" : ""}"
      style="--ward-color:${escapeHtml(ward.color)}"
      data-ward-row="${escapeHtml(ward.id)}"
    >
      <button
        class="ward-drag-handle"
        type="button"
        data-ward-drag-handle="${escapeHtml(ward.id)}"
        aria-label="${escapeAttribute(dragLabel)}"
        title="${escapeAttribute(openReminderCount ? reminderLabel : `Move ${ward.name}`)}"
        ${state.wards.length <= 1 ? "disabled" : ""}
      >
        ${
          openReminderCount
            ? `<span class="ward-reminder-marker" aria-hidden="true">${escapeHtml(String(openReminderCount))}</span>`
            : `<span class="ward-dot"></span>`
        }
      </button>
      ${
        editing
          ? `<input
              class="ward-name-input"
              type="text"
              value="${escapeAttribute(ward.name)}"
              data-ward-name-input="${escapeHtml(ward.id)}"
              aria-label="Ward name"
            />`
          : `<button class="ward-name-label ward-name-select-btn" type="button" data-ward-id="${escapeHtml(ward.id)}" title="${escapeAttribute(ward.name)}" aria-label="Show ${escapeAttribute(ward.name)}">
              ${escapeHtml(ward.name)}
            </button>`
      }
      <span class="ward-counts">
        <span class="ward-case-count" aria-label="${escapeAttribute(caseLabel)}" title="${escapeAttribute(caseLabel)}">${escapeHtml(String(caseCount))}</span>
      </span>
      <button class="ward-edit-btn ${editing ? "is-editing" : ""}" type="button" data-edit-ward="${escapeHtml(ward.id)}" aria-label="${editing ? "Done editing" : `Edit ${escapeAttribute(ward.name)}`}">
        <svg class="ward-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
          ${
            editing
              ? `<path d="M5 12.5l4.2 4.2L19 7"></path>`
              : `<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"></path>
                <path d="M13.5 6.5l4 4"></path>`
          }
        </svg>
      </button>
      <button class="ward-delete-btn" type="button" data-delete-ward="${escapeHtml(ward.id)}" aria-label="Delete ${escapeAttribute(ward.name)}">
        <svg class="ward-delete-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18"></path>
          <path d="M8 6V4h8v2"></path>
          <path d="M9 10v8"></path>
          <path d="M15 10v8"></path>
          <path d="M6 6l1 15h10l1-15"></path>
        </svg>
      </button>
    </div>
  `;
}

function focusEditingWardInput() {
  if (!uiState.editingWardId) return;
  window.requestAnimationFrame(() => {
    const input = refs.drawerRoot?.querySelector(`[data-ward-name-input="${cssEscape(uiState.editingWardId)}"]`);
    input?.focus();
    input?.select();
  });
}

function renderNotificationSettings() {
  const support = getNotificationSupport();
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const configured = Boolean(window.SHIFTPAD_PUBLIC_CONFIG?.vapidPublicKey);
  const enabled = uiState.notificationEnabled === true;
  const busy = uiState.notificationBusy;
  const setupIssue = getNotificationSetupIssue({ support, configured });
  const status =
    uiState.notificationStatus ||
    setupIssue ||
    (busy
      ? "Updating notification settings..."
      : enabled
        ? "Reminders are on for this device. ShiftPad renews the connection automatically."
        : support.supported
          ? permission === "granted"
            ? "Reminders are off for this device."
            : "Turn on notifications to receive reminder alerts on this device."
          : support.message);

  const toggleDisabled = busy || !support.supported || !authState.user || !configured || permission === "denied";

  return `
    <div class="notification-card">
      <label class="notification-toggle-row" for="notifications-enabled-toggle">
        <span>
          <strong>Notifications</strong>
          <small>${enabled ? "On" : "Off"}</small>
        </span>
        <span class="switch">
          <input
            id="notifications-enabled-toggle"
            type="checkbox"
            data-notification-toggle="true"
            ${enabled ? "checked" : ""}
            ${toggleDisabled ? "disabled" : ""}
          />
          <span class="switch-track" aria-hidden="true"></span>
        </span>
      </label>
      <p class="notification-status" aria-live="polite">${escapeHtml(status)}</p>
      <div class="notification-actions">
        <button
          class="ghost-btn notification-test-btn"
          type="button"
          data-drawer-action="test-notification"
          ${!enabled || busy ? "disabled" : ""}
        >Test notification</button>
      </div>
      ${configured ? "" : `<p class="drawer-help">Vercel needs VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY before notifications can be enabled.</p>`}
      ${authState.user ? "" : `<p class="drawer-help">Sign in before enabling notifications.</p>`}
    </div>
  `;
}

function renderDiagnosticsSettings() {
  const enabled = isEditorDebugLoggingEnabled();
  const logs = getEditorDebugLogs();
  const cloudPendingCount = logs.filter((log) => log.clientLogId && !log.cloudSavedAt).length;
  const status =
    uiState.debugLogStatus ||
    (enabled
      ? cloudPendingCount
        ? `${cloudPendingCount} diagnostic event${cloudPendingCount === 1 ? " is" : "s are"} waiting to sync.`
        : authState.user
          ? "Diagnostic events save to the cloud automatically."
          : "Diagnostic events will upload after sign-in."
      : "No new diagnostic events are being recorded.");

  return `
    <div class="debug-card">
      <label class="drawer-section-toggle drawer-direct-toggle debug-toggle" for="debug-logs-toggle">
        <span>Diagnostics</span>
        <strong>${enabled ? "On" : "Off"}</strong>
        <span class="switch">
          <input
            id="debug-logs-toggle"
            type="checkbox"
            data-debug-logs-enabled="true"
            ${enabled ? "checked" : ""}
          />
          <span class="switch-track"></span>
        </span>
      </label>
      <p class="drawer-help">Records editor behavior and note content for troubleshooting. Uploads automatically while signed in, and cloud data is deleted after 14 days.</p>
      <div class="debug-actions">
        <button class="ghost-btn" type="button" data-drawer-action="clear-debug-logs" ${logs.length || authState.user ? "" : "disabled"}>Clear diagnostic data</button>
      </div>
      <p class="debug-status">${escapeHtml(status)}</p>
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
  if (authState.saveTimer) return "Saving soon...";
  if (authState.isSaving) return "Saving to cloud...";
  if (authState.pendingRemoteRecord) return isEditorActivelyFocused() ? "Cloud update waiting" : "Loading newer cloud edits...";
  if (authState.lastRemoteAppliedAt) return formatLiveSyncStatus();
  if (authState.realtimeStatus === "subscribed") return "Live sync on";
  if (authState.realtimeStatus === "polling") return "Live sync polling";
  if (authState.realtimeStatus === "error") return "Cloud sync reconnecting";
  return "Cloud sync on";
}

function formatLiveSyncStatus() {
  const ageSeconds = Math.max(0, Math.floor((Date.now() - authState.lastRemoteAppliedAt) / 1000));
  if (ageSeconds < 10) return "Updated just now";
  if (ageSeconds < 60) return `Updated ${ageSeconds}s ago`;
  if (authState.realtimeStatus === "subscribed") return "Live sync on";
  return "Live sync polling";
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
  const tagStyle = renderCustomTagStyle(tag);
  return `
    <div class="custom-tag-row" data-custom-tag-row="${escapeHtml(tag.id)}" ${tagStyle}>
      <strong><span class="custom-tag-swatch" aria-hidden="true"></span>${escapeHtml(tag.label)}</strong>
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
  const noteIsEmpty = !hasMeaningfulNoteHtml(documentHtml);
  rememberRecoveryBaseline(note);

  refs.editorRoot.innerHTML = `
    <div class="editor-shell">
      <section class="note-pad-card">
        <div class="quick-tags">
          ${getAvailableQuickTags().map((tag) => renderQuickChip(tag.key, tag.label, tag.className, tag.color)).join("")}
        </div>

        <div class="smart-pad-surface document-pad">
          <div
            id="notepad-editor"
            class="notepad-editor ${noteIsEmpty ? "is-empty-document" : ""}"
            contenteditable="true"
            spellcheck="true"
            aria-label="Main notepad"
            autocapitalize="sentences"
            data-placeholder="Tap to start this ward note"
          >${documentHtml}</div>
          ${renderBedIndexRail(bedIndex)}
        </div>

      </section>
    </div>
  `;
  applyCustomTagColors(refs.editorRoot);
  applyEditorCompletionClasses(refs.editorRoot.querySelector("#notepad-editor"));

  requestAnimationFrame(() => {
    const editor = refs.editorRoot.querySelector("#notepad-editor");
    if (!isCompactMobileLayout()) {
      editor?.focus({ preventScroll: true });
    }
    syncMobileTagDock();
  });
}

function renderStickyWardBar() {
  if (!refs.stickyWardRoot) return;
  const ward = getCurrentWard();
  const note = getCurrentNote();

  if (!ward || !note) {
    refs.stickyWardRoot.innerHTML = "";
    refs.stickyWardRoot.classList.add("is-empty");
    return;
  }

  refs.stickyWardRoot.classList.remove("is-empty");
  const canSortBeds = getBedIndexForNote(note).length > 0;
  refs.stickyWardRoot.innerHTML = `
    <div class="sticky-ward-bar">
      <p class="section-kicker">Main notepad</p>
      ${renderNotepadWardTitle(ward)}
      <div class="sticky-ward-actions">
        <small>Updated ${escapeHtml(formatClock(note.updatedAt || note.createdAt))}</small>
        <button
          class="ghost-btn tiny-btn sort-beds-btn"
          type="button"
          data-sort-beds="true"
          aria-label="Sort bed sections"
          title="Arrange bed sections by bed name"
          ${canSortBeds ? "" : "disabled"}
        >
          <svg class="sort-beds-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 7h10"></path>
            <path d="M8 12h7"></path>
            <path d="M8 17h4"></path>
            <path d="M4 5v14"></path>
            <path d="m2 17 2 2 2-2"></path>
          </svg>
          <span>Sort beds</span>
        </button>
        <button class="ghost-btn tiny-btn" type="button" data-reset-note="true">Reset note</button>
      </div>
    </div>
  `;
}

function shouldShowWardSwitcher() {
  return !getPreferences().singleWardMode && state.wards.length > 1;
}

function renderNotepadWardTitle(ward, showSwitcher = shouldShowWardSwitcher()) {
  const title = escapeHtml(ward?.name || "Current ward");
  if (!showSwitcher) {
    return `<h2>${title}</h2>`;
  }

  return `
    <div class="notepad-ward-title" aria-label="Ward switcher">
      <button class="ward-switch-btn" type="button" data-ward-switch="previous" aria-label="Previous ward">
        <svg class="ward-switch-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6"></path>
        </svg>
      </button>
      <h2>${title}</h2>
      <button class="ward-switch-btn" type="button" data-ward-switch="next" aria-label="Next ward">
        <svg class="ward-switch-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6"></path>
        </svg>
      </button>
    </div>
  `;
}

function renderBedIndexRail(beds) {
  if (!beds.length) return "";
  const indexItems = getCompressedBedIndexItems(beds);
  const condensed = indexItems.length < beds.length;
  const scrubHeight = Math.min(480, Math.max(indexItems.length * 24, beds.length * 10));
  return `
    <div
      class="bed-index-rail ${condensed ? "is-condensed" : ""} ${uiState.bedIndexVisible ? "is-visible" : ""}"
      aria-label="Bed index"
      data-bed-index-labels="${escapeAttribute(JSON.stringify(beds))}"
      style="--bed-index-slots:${indexItems.length};--bed-index-height:${scrubHeight}px"
    >
      <div class="bed-index-bubble" aria-live="polite"></div>
      <div class="bed-index-track">
        ${indexItems
        .map(
          ({ bed, index }) => `
            <button
              type="button"
              data-bed-jump="${escapeHtml(bed)}"
              data-bed-index="${index}"
              aria-label="Go to Bed ${escapeAttribute(bed)}"
            >${escapeHtml(bed)}</button>
          `
        )
        .join("")}
      </div>
    </div>
  `;
}

function getCompressedBedIndexItems(beds, maxLabels = MAX_BED_INDEX_LABELS) {
  const labels = Array.isArray(beds) ? beds.filter(Boolean) : [];
  const limit = Math.max(2, Number(maxLabels) || MAX_BED_INDEX_LABELS);
  if (labels.length <= limit) {
    return labels.map((bed, index) => ({ bed, index }));
  }

  const indices = new Set();
  for (let slot = 0; slot < limit; slot += 1) {
    indices.add(Math.round((slot * (labels.length - 1)) / (limit - 1)));
  }
  return [...indices].sort((left, right) => left - right).map((index) => ({ bed: labels[index], index }));
}

function startBedLongPress(token, event) {
  if (!token || token.dataset.editing === "true" || uiState.bedAction) return;
  if (event.button !== undefined && event.button !== 0) return;
  cancelBedLongPress();

  const press = {
    token,
    pointerId: event.pointerId,
    startX: Number(event.clientX) || 0,
    startY: Number(event.clientY) || 0,
    timer: 0
  };
  press.timer = window.setTimeout(() => {
    if (uiState.bedLongPress !== press || !document.contains(token)) return;
    uiState.bedLongPress = null;
    uiState.suppressNextBedClick = true;
    window.setTimeout(() => {
      uiState.suppressNextBedClick = false;
    }, 800);
    openBedActionSheet(token);
  }, 520);
  uiState.bedLongPress = press;
}

function updateBedLongPress(event) {
  const press = uiState.bedLongPress;
  if (!press || (event.pointerId !== undefined && event.pointerId !== press.pointerId)) return;
  const distance = Math.hypot((Number(event.clientX) || 0) - press.startX, (Number(event.clientY) || 0) - press.startY);
  if (distance > 10) cancelBedLongPress();
}

function cancelBedLongPress(event) {
  const press = uiState.bedLongPress;
  if (!press) return;
  if (event?.pointerId !== undefined && event.pointerId !== press.pointerId) return;
  window.clearTimeout(press.timer);
  uiState.bedLongPress = null;
}

function openBedActionSheet(token) {
  const ward = getCurrentWard();
  const note = getCurrentNote();
  if (!token || !ward || !note || token.dataset.editing === "true") return;

  let tokenId = String(token.dataset.tokenId || "");
  if (!tokenId) {
    tokenId = createId("tag");
    token.dataset.tokenId = tokenId;
    syncEditorDocument();
  }

  const label = String(token.textContent || "").replace(/^Bed\s*/i, "").trim();
  if (!label) return;

  uiState.bedAction = {
    mode: "menu",
    wardId: ward.id,
    noteId: note.id,
    tokenId,
    label
  };
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  document.activeElement?.blur?.();
  syncMobileTagDock();
  renderBedActionSheet();
}

function closeBedActionSheet() {
  uiState.bedAction = null;
  cancelBedLongPress();
  renderBedActionSheet();
}

function setBedActionMode(mode) {
  if (!uiState.bedAction || !["menu", "rename", "move", "delete"].includes(mode)) return;
  uiState.bedAction.mode = mode;
  renderBedActionSheet({ focusRenameImmediately: mode === "rename" });
}

function renderBedActionSheet({ focusRenameImmediately = false } = {}) {
  if (!refs.bedActionRoot) return;
  const action = uiState.bedAction;
  document.body.classList.toggle("bed-action-open", Boolean(action));
  if (!action) {
    refs.bedActionRoot.innerHTML = "";
    return;
  }

  const sourceWard = state.wards.find((ward) => ward.id === action.wardId);
  const targetWards = state.wards.filter((ward) => ward.id !== action.wardId);
  if (!sourceWard) {
    closeBedActionSheet();
    return;
  }

  refs.bedActionRoot.innerHTML = `
    <div class="bed-action-layer" data-bed-action-backdrop="true">
      <section class="bed-action-sheet" role="dialog" aria-modal="true" aria-labelledby="bed-action-title">
        <header class="bed-action-head">
          <div>
            <p class="section-kicker">${escapeHtml(sourceWard.name)} · Bed ${escapeHtml(action.label)}</p>
            <h2 id="bed-action-title">${action.mode === "rename" ? "Rename bed" : action.mode === "move" ? "Move to ward" : action.mode === "delete" ? "Delete bed" : "Bed actions"}</h2>
          </div>
          <button class="bed-action-close" type="button" data-bed-action-close="true" aria-label="Close bed actions">&times;</button>
        </header>
        ${action.mode === "rename" ? renderBedRenameForm(action) : ""}
        ${action.mode === "move" ? renderBedMoveOptions(targetWards) : ""}
        ${action.mode === "delete" ? renderBedDeleteConfirmation(action) : ""}
        ${action.mode === "menu" ? renderBedActionOptions(targetWards.length > 0) : ""}
      </section>
    </div>
  `;

  if (action.mode === "rename") {
    const focusRenameInput = () => {
      const input = refs.bedActionRoot.querySelector("[data-bed-name-input]");
      input?.focus();
      input?.select();
    };
    if (focusRenameImmediately) {
      focusRenameInput();
    } else {
      window.requestAnimationFrame(focusRenameInput);
    }
  }
}

function renderBedActionOptions(canMove) {
  return `
    <div class="bed-action-options">
      <button class="bed-action-option" type="button" data-bed-action="rename">
        <span>Rename bed</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"></path><path d="M13.5 6.5l4 4"></path></svg>
      </button>
      <button class="bed-action-option" type="button" data-bed-action="move" ${canMove ? "" : "disabled"}>
        <span>Move to ward</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m14 7 5 5-5 5"></path></svg>
      </button>
      <button class="bed-action-option is-danger" type="button" data-bed-action="delete">
        <span>Delete bed</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path><path d="M10 10v6M14 10v6"></path></svg>
      </button>
    </div>
  `;
}

function renderBedRenameForm(action) {
  return `
    <form class="bed-action-form" data-bed-rename-form="true">
      <label>
        Bed name
        <input type="text" value="${escapeAttribute(action.label)}" data-bed-name-input="true" autocomplete="off" enterkeyhint="done" required />
      </label>
      <div class="bed-action-form-actions">
        <button class="ghost-btn" type="button" data-bed-action="menu">Back</button>
        <button class="accent-btn" type="submit">Save</button>
      </div>
    </form>
  `;
}

function renderBedMoveOptions(targetWards) {
  if (!targetWards.length) {
    return `<p class="bed-action-empty">Add another ward before moving this bed.</p>`;
  }
  return `
    <div class="bed-ward-options">
      ${targetWards
        .map(
          (ward) => `
            <button class="bed-ward-option" type="button" data-bed-target-ward="${escapeAttribute(ward.id)}">
              <span>${escapeHtml(ward.name)}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
            </button>
          `
        )
        .join("")}
      <button class="ghost-btn" type="button" data-bed-action="menu">Back</button>
    </div>
  `;
}

function renderBedDeleteConfirmation(action) {
  return `
    <div class="bed-action-confirm">
      <p>Delete <strong>Bed ${escapeHtml(action.label)}</strong> and all of its notes, tasks, and reminders?</p>
      <p class="bed-action-confirm-note">A recovery copy will be saved in History.</p>
      <div class="bed-action-form-actions">
        <button class="ghost-btn" type="button" data-bed-action="menu">Back</button>
        <button class="bed-delete-confirm-btn" type="button" data-bed-delete-confirm="true">Delete bed</button>
      </div>
    </div>
  `;
}

function getSelectedBedDocumentContext() {
  const action = uiState.bedAction;
  if (!action) return null;
  const ward = state.wards.find((item) => item.id === action.wardId);
  const note = ward?.notes.find((item) => item.id === action.noteId);
  if (!ward || !note) return null;

  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  normalizeEditorBlocks(root);
  const token = root.querySelector(`[data-token-id="${cssEscape(action.tokenId)}"]`);
  const line = token?.closest?.("div, p");
  if (!token || !line || line.parentElement !== root || token.dataset.tag !== "bed") return null;
  return { action, ward, note, root, token, line };
}

function renameSelectedBed(value) {
  const context = getSelectedBedDocumentContext();
  const label = String(value || "").replace(/^Bed\s*/i, "").trim();
  if (!context || !label) return;

  context.token.textContent = `Bed ${label}`;
  setNoteDocumentHtml(context.note, context.root.innerHTML);
  clearSavedEditorSelection();
  uiState.bedAction = null;
  saveState();
  render();
}

function getSelectedBedSectionLines(context) {
  if (!context?.root || !context.line) return [];
  const sourceLines = Array.from(context.root.children);
  const startIndex = sourceLines.indexOf(context.line);
  if (startIndex < 0) return [];
  const nextBedOffset = sourceLines
    .slice(startIndex + 1)
    .findIndex((line) => line.querySelector?.('.tag-token[data-tag="bed"]'));
  const endIndex = nextBedOffset < 0 ? sourceLines.length : startIndex + 1 + nextBedOffset;
  return sourceLines.slice(startIndex, endIndex);
}

function deleteSelectedBedSection() {
  const context = getSelectedBedDocumentContext();
  if (!context) return;
  const sectionLines = getSelectedBedSectionLines(context);
  if (!sectionLines.length) return;

  addRecoverySnapshot({
    note: context.note,
    ward: context.ward,
    documentHtml: context.note.documentHtml,
    reason: `Before deleting Bed ${context.action.label}`
  });
  sectionLines.forEach((line) => line.remove());
  normalizeBedSectionSeparators(context.root);

  setNoteDocumentHtml(context.note, context.root.innerHTML);
  clearSavedEditorSelection();
  uiState.bedAction = null;
  saveState({ skipRecovery: true });
  render();
}

function moveBedSectionToWard(targetWardId) {
  const context = getSelectedBedDocumentContext();
  const targetWard = state.wards.find((ward) => ward.id === targetWardId && ward.id !== context?.ward.id);
  if (!context || !targetWard) return;

  if (!targetWard.notes.length) {
    targetWard.notes.push(createNote(`${targetWard.name} handover`, ""));
  }
  const targetNote = targetWard.notes[0];
  const sectionLines = getSelectedBedSectionLines(context);
  if (!sectionLines.length) return;
  while (sectionLines.length > 1 && isEditorLineEmpty(sectionLines[sectionLines.length - 1])) {
    sectionLines.pop()?.remove();
  }
  const sectionHtml = sectionLines.map((line) => line.outerHTML).join("");
  sectionLines.forEach((line) => line.remove());
  normalizeBedSectionSeparators(context.root);

  const targetRoot = parseHtmlRoot(getNoteDocumentHtml(targetNote));
  normalizeEditorBlocks(targetRoot);
  while (targetRoot.lastElementChild && isEditorLineEmpty(targetRoot.lastElementChild)) {
    targetRoot.lastElementChild.remove();
  }
  const targetHasContent = Array.from(targetRoot.children).some((line) => !isEditorLineEmpty(line));
  if (targetHasContent) {
    const spacer = targetRoot.ownerDocument.createElement("div");
    spacer.innerHTML = "<br>";
    targetRoot.appendChild(spacer);
  }
  targetRoot.insertAdjacentHTML("beforeend", sectionHtml);
  normalizeBedSectionSeparators(targetRoot);

  const now = Date.now();
  setNoteDocumentHtml(context.note, context.root.innerHTML, { updatedAt: now });
  setNoteDocumentHtml(targetNote, targetRoot.innerHTML, { updatedAt: now });
  clearSavedEditorSelection();
  uiState.bedAction = null;
  saveState();
  render();
}

function normalizeBedSectionSeparators(root) {
  if (!root) return;
  let seenBed = false;
  Array.from(root.children).forEach((line) => {
    if (!line.querySelector?.('.tag-token[data-tag="bed"]')) return;
    if (seenBed) {
      let previous = line.previousElementSibling;
      while (previous && isEditorLineEmpty(previous)) {
        const before = previous.previousElementSibling;
        previous.remove();
        previous = before;
      }
      const spacer = root.ownerDocument.createElement("div");
      spacer.innerHTML = "<br>";
      root.insertBefore(spacer, line);
    }
    seenBed = true;
  });
}

function sortCurrentWardBedSections() {
  const note = getCurrentNote();
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!note || !editor) return;

  normalizeEditorBlocks(editor);
  const lines = Array.from(editor.children).filter((line) => ["DIV", "P"].includes(line.tagName));
  const prefixLines = [];
  const sections = [];
  let currentSection = null;

  lines.forEach((line) => {
    const bedToken = line.querySelector('.tag-token[data-tag="bed"]');
    if (bedToken) {
      currentSection = {
        label: String(bedToken.textContent || "").replace(/^Bed\s*/i, "").trim(),
        originalIndex: sections.length,
        lines: [line]
      };
      sections.push(currentSection);
      return;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      prefixLines.push(line);
    }
  });

  if (!sections.length) return;

  const previousHtml = sanitizeEditorHtml(editor.innerHTML);
  const sortedSections = [...sections].sort((left, right) => {
    const labelOrder = BED_SORT_COLLATOR.compare(left.label, right.label);
    return labelOrder || left.originalIndex - right.originalIndex;
  });

  const fragment = document.createDocumentFragment();
  const meaningfulPrefixLines = prefixLines.filter((line) => !isEditorLineEmpty(line));
  meaningfulPrefixLines.forEach((line) => fragment.appendChild(line));
  if (meaningfulPrefixLines.length) {
    const spacer = editor.ownerDocument.createElement("div");
    spacer.innerHTML = "<br>";
    fragment.appendChild(spacer);
  }
  sortedSections.forEach((section, sectionIndex) => {
    const compactedLines = [...section.lines];
    while (compactedLines.length > 1 && isEditorLineEmpty(compactedLines[compactedLines.length - 1])) {
      compactedLines.pop();
    }
    compactedLines.forEach((line) => fragment.appendChild(line));
    const isLastSection = sectionIndex === sortedSections.length - 1;
    if (!isLastSection) {
      const spacer = editor.ownerDocument.createElement("div");
      spacer.innerHTML = "<br>";
      fragment.appendChild(spacer);
    }
  });
  editor.replaceChildren(fragment);

  const nextHtml = sanitizeEditorHtml(editor.innerHTML);
  if (nextHtml === previousHtml) return;

  setNoteDocumentHtml(note, nextHtml);
  saveState();
  applyEditorCompletionClasses(editor);
  refreshEditorBedIndex(note);
  renderStickyWardBar();
  refreshWardDrawerMetricsIfOpen();
}

function refreshEditorBedIndex(note) {
  const surface = refs.editorRoot.querySelector(".document-pad");
  if (!surface) return;
  surface.querySelector(".bed-index-rail")?.remove();
  const railHtml = renderBedIndexRail(getBedIndexForNote(note));
  if (railHtml) surface.insertAdjacentHTML("beforeend", railHtml);
}

function updateSortBedsButtonFromEditor(editor = refs.editorRoot.querySelector("#notepad-editor")) {
  const button = refs.stickyWardRoot?.querySelector("[data-sort-beds]");
  if (!button || !editor) return;
  const bedLabels = new Set(
    Array.from(editor.querySelectorAll('.tag-token[data-tag="bed"]'))
      .map((token) => String(token.textContent || "").replace(/^Bed\s*/i, "").trim().toUpperCase())
      .filter(Boolean)
  );
  button.disabled = bedLabels.size < 1;
}

function renderTimeline() {
  const scope = state.timelineScope || "all";
  const summaryTab = SUMMARY_TABS.includes(state.summaryTab) ? state.summaryTab : "reminders";
  const summary = buildSummaryGroups(scope);
  const openReminderCount = summary.timed.filter((item) => !item.entry.done).length;
  const openTodoCount = summary.todo.filter((item) => !item.entry.done).length;
  const scopeLabel = scope === "active" ? getCurrentWard()?.name || "Selected ward" : "All wards";
  const nextScopeLabel = scope === "active" ? "Show all wards" : `Show ${getCurrentWard()?.name || "active ward"}`;

  refs.timelineRoot.innerHTML = `
    <div class="summary-controls-row">
      <div class="summary-switcher" role="tablist" aria-label="Summary sections">
        <button class="summary-tab ${summaryTab === "reminders" ? "is-active" : ""}" type="button" role="tab" aria-selected="${summaryTab === "reminders"}" data-summary-tab="reminders">Reminders</button>
        <button class="summary-tab ${summaryTab === "todo" ? "is-active" : ""}" type="button" role="tab" aria-selected="${summaryTab === "todo"}" data-summary-tab="todo">To-do list</button>
      </div>
      <div class="summary-scope-actions">
        <button class="summary-scope-btn" type="button" data-summary-scope-toggle="true">${escapeHtml(nextScopeLabel)}</button>
        <strong class="summary-count">${escapeHtml(scopeLabel)} · ${openReminderCount} reminder${openReminderCount === 1 ? "" : "s"} · ${openTodoCount} to-do</strong>
      </div>
    </div>
    ${summaryTab === "reminders" ? renderSummaryTimedSection(summary.timed) : ""}
    ${summaryTab === "todo" ? renderSummaryTodoSection(summary.todo) : ""}
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
    refs.syncStatus.textContent = getSyncStatusText();
  }
}

async function initAuth() {
  const config = window.SHIFTPAD_PUBLIC_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    authState.ready = true;
    renderAuthUi();
    return;
  }

  if (!window.supabase?.createClient) {
    try {
      await loadSupabaseClient();
    } catch (error) {
      authState.ready = true;
      setAuthMessage(formatSupabaseError(error, "Supabase client load failed."));
      renderAuthUi();
      return;
    }
  }

  if (!window.supabase?.createClient) {
    authState.ready = true;
    setAuthMessage("Supabase client load failed.");
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
    await applySession(session, { event: "GET_SESSION" });
  } catch (error) {
    authState.ready = true;
    setAuthMessage(formatSupabaseError(error, "Session load failed."));
    renderAuthUi();
  }

  authState.client.auth.onAuthStateChange((event, sessionUpdate) => {
    window.setTimeout(() => {
      applySession(sessionUpdate, { event }).catch((error) => {
        setAuthMessage(formatSupabaseError(error, "Auth update failed."));
      });
    }, 0);
  });
}

function loadSupabaseClient() {
  if (window.supabase?.createClient) return Promise.resolve();
  if (window.__shiftpadSupabaseLoading) return window.__shiftpadSupabaseLoading;

  window.__shiftpadSupabaseLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SUPABASE_JS_URL}"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Supabase client.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SUPABASE_JS_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Supabase client."));
    document.head.appendChild(script);
  });

  return window.__shiftpadSupabaseLoading;
}

async function applySession(session, { event = "UNKNOWN" } = {}) {
  const previousUserId = authState.user?.id || "";
  const nextUserId = session?.user?.id || "";
  authState.session = session || null;
  authState.user = session?.user || null;
  authState.ready = true;

  if (!authState.user) {
    stopCloudLiveSync();
    authState.hydratingUserId = "";
    authState.hydratedUserId = "";
    uiState.bedAction = null;
    appState = loadAppState();
    state = getActiveWorkspaceState(appState);
    applyUrlOverrides();
    render();
    return;
  }

  if (authState.hydratedUserId === nextUserId) {
    authState.client?.realtime?.setAuth?.(authState.session?.access_token);
    if (!authState.realtimeChannel) {
      startCloudLiveSync();
    }
    appendEditorDebugLog({
      action: "auth-session-refresh-without-hydration",
      source: "auth",
      success: true,
      handledBy: "applySession",
      authEvent: event,
      sameUser: previousUserId === nextUserId
    });
    renderAuthUi();
    return;
  }

  if (authState.hydratingUserId === nextUserId) {
    renderAuthUi();
    return;
  }

  stopCloudLiveSync();
  authState.lastCloudUpdatedAt = 0;
  authState.lastCloudUpdatedAtValue = "";
  authState.hydratingUserId = nextUserId;
  migrateAnonymousEditorDebugLogsToUser();
  try {
    await hydrateStateFromCloud({ authEvent: event });
    if (authState.user?.id === nextUserId) {
      authState.hydratedUserId = nextUserId;
      startCloudLiveSync();
      queueEditorDebugCloudUpload();
    }
  } finally {
    if (authState.hydratingUserId === nextUserId) {
      authState.hydratingUserId = "";
    }
  }
}

async function signInWithPassword() {
  if (!authState.client) return;
  if (!validateAuthForm()) return;
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
  if (!validateAuthForm()) return;
  setAuthMessage("Creating account...");
  const email = String(refs.authEmail?.value || "").trim();
  const password = String(refs.authPassword?.value || "");
  const displayName = String(refs.authName?.value || "").trim();
  try {
    const { data, error } = await authState.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          display_name: displayName
        }
      }
    });
    if (error) {
      setAuthMessage(formatSupabaseError(error, "Account creation failed."));
      return;
    }
    if (data?.session) {
      setAuthMessage("Account created. Loading your notes...");
      await applySession(data.session, { event: "SIGN_UP_SESSION" });
      return;
    }
    if (data?.user?.identities && data.user.identities.length === 0) {
      setAuthMessage("This email already has an account. Use Sign in instead.");
      return;
    }
  } catch (error) {
    setAuthMessage(formatSupabaseError(error, "Account creation failed."));
    return;
  }
  setAuthMessage("Account created. Check your email to confirm it, then sign in.");
}

function validateAuthForm() {
  if (refs.authForm?.reportValidity && !refs.authForm.reportValidity()) return false;
  const email = String(refs.authEmail?.value || "").trim();
  const password = String(refs.authPassword?.value || "");
  if (!email || !password) {
    setAuthMessage("Enter an email and password first.");
    return false;
  }
  if (password.length < 6) {
    setAuthMessage("Use a password with at least 6 characters.");
    return false;
  }
  return true;
}

function getAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname || "/"}`;
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

async function hydrateStateFromCloud({ authEvent = "UNKNOWN" } = {}) {
  if (!authState.client || !authState.user) return;

  authState.isHydrating = true;
  renderAuthUi();

  const fallback = loadStateForUser(authState.user.id) || createBlankAppState();
  let needsCloudWorkspaceMigration = false;
  authState.suppressCloudSave = true;

  let data = null;
  let error = null;
  let preservedEntities = [];
  try {
    const response = await fetchCloudStateRecord();
    data = response.data;
    error = response.error;
  } catch (requestError) {
    error = requestError;
  }

  if (error) {
    console.error("Cloud state load failed:", error);
    appState = normalizeAppState(fallback);
    state = getActiveWorkspaceState(appState);
    authState.isHydrating = false;
    authState.suppressCloudSave = false;
    saveState({ skipCloud: true });
    setAuthMessage(formatSupabaseError(error, "Cloud note load failed."));
    render();
    return;
  }

  if (data?.state_json) {
    needsCloudWorkspaceMigration = !data.state_json.workspaces;
    const hydrated = mergeHydratedCloudState(data.state_json, fallback);
    appState = hydrated.state;
    preservedEntities = hydrated.preservedEntities;
    state = getActiveWorkspaceState(appState);
    rememberCloudVersion(data.updated_at);
  } else {
    appState = normalizeAppState(fallback);
    state = getActiveWorkspaceState(appState);
    authState.suppressCloudSave = false;
    await saveCloudStateNow();
    authState.suppressCloudSave = true;
  }

  authState.isHydrating = false;
  authState.suppressCloudSave = false;
  applyUrlOverrides();
  saveLocalState();
  appendEditorDebugLog({
    action: preservedEntities.length ? "cloud-hydration-stale-entity-blocked" : "cloud-hydration-applied",
    source: "auth",
    success: true,
    handledBy: "hydrateStateFromCloud",
    authEvent,
    remoteRecordUpdatedAt: String(data?.updated_at || ""),
    preservedEntities
  });
  if (needsCloudWorkspaceMigration || preservedEntities.length) {
    scheduleCloudSave();
  }
  render();
}

function startCloudLiveSync() {
  if (!authState.client || !authState.user) return;
  stopCloudLiveSync({ keepStatus: true });
  authState.realtimeStatus = "polling";

  try {
    authState.client.realtime?.setAuth?.(authState.session?.access_token);
    authState.realtimeChannel = authState.client
      .channel(`shiftpad-user-state-${authState.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: CLOUD_STATE_TABLE,
          filter: `user_id=eq.${authState.user.id}`
        },
        (payload) => {
          handleRemoteCloudRecord(payload.new || payload.old, { source: "realtime" });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          authState.realtimeStatus = "subscribed";
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          authState.realtimeStatus = "error";
        }
        renderAuthUi();
      });
  } catch (error) {
    console.error("Realtime sync setup failed:", error);
    authState.realtimeStatus = "error";
  }

  fetchLatestCloudState({ reason: "start" }).catch((error) => {
    console.error("Cloud sync refresh failed:", error);
  });
  authState.livePollTimer = window.setInterval(() => {
    fetchLatestCloudState({ reason: "poll" }).catch((error) => {
      console.error("Cloud sync poll failed:", error);
      if (authState.realtimeStatus !== "subscribed") {
        authState.realtimeStatus = "error";
        renderAuthUi();
      }
    });
  }, CLOUD_SYNC_POLL_MS);
  renderAuthUi();
}

function stopCloudLiveSync({ keepStatus = false } = {}) {
  if (authState.livePollTimer) {
    window.clearInterval(authState.livePollTimer);
    authState.livePollTimer = null;
  }
  if (authState.remoteApplyTimer) {
    window.clearTimeout(authState.remoteApplyTimer);
    authState.remoteApplyTimer = null;
  }
  if (authState.debugLogUploadTimer) {
    window.clearTimeout(authState.debugLogUploadTimer);
    authState.debugLogUploadTimer = null;
  }
  if (authState.realtimeChannel && authState.client?.removeChannel) {
    authState.client.removeChannel(authState.realtimeChannel);
  }
  authState.realtimeChannel = null;
  authState.pendingRemoteRecord = null;
  authState.pendingDoneToggles.clear();
  if (!keepStatus) {
    authState.realtimeStatus = "off";
    authState.lastCloudUpdatedAt = 0;
    authState.lastCloudUpdatedAtValue = "";
    authState.lastRemoteAppliedAt = 0;
  }
}

async function fetchLatestCloudState() {
  if (!authState.client || !authState.user || authState.isHydrating || document.visibilityState === "hidden") return;
  const { data, error } = await fetchCloudStateRecord();

  if (error) throw error;
  if (authState.realtimeStatus === "error") {
    authState.realtimeStatus = "polling";
    renderAuthUi();
  }
  if (data) {
    handleRemoteCloudRecord(data, { source: "poll" });
  }
}

function handleRemoteCloudRecord(record) {
  if (!record?.state_json) return;
  const remoteUpdatedAt = parseCloudUpdatedAt(record.updated_at) || Date.now();
  if (remoteUpdatedAt <= authState.lastCloudUpdatedAt) return;

  if (shouldDeferRemoteStateApply()) {
    authState.pendingRemoteRecord = record;
    schedulePendingRemoteStateApply();
    renderAuthUi();
    return;
  }

  applyRemoteCloudState(record);
}

function shouldDeferRemoteStateApply() {
  if (authState.saveTimer || authState.isSaving) return true;
  if (isEditorActivelyFocused() || getActiveWardNameInput()) return true;
  return hasRecentLocalMutation(CLOUD_REMOTE_APPLY_IDLE_MS);
}

function schedulePendingRemoteStateApply() {
  if (authState.remoteApplyTimer) {
    window.clearTimeout(authState.remoteApplyTimer);
  }
  const delay = (isEditorActivelyFocused() || getActiveWardNameInput())
    ? CLOUD_REMOTE_APPLY_FOCUSED_RETRY_MS
    : CLOUD_REMOTE_APPLY_IDLE_MS;
  authState.remoteApplyTimer = window.setTimeout(() => {
    authState.remoteApplyTimer = null;
    applyPendingRemoteStateIfReady();
  }, delay);
}

function applyPendingRemoteStateIfReady() {
  if (!authState.pendingRemoteRecord) return;
  if (shouldDeferRemoteStateApply()) {
    schedulePendingRemoteStateApply();
    return;
  }
  const record = authState.pendingRemoteRecord;
  authState.pendingRemoteRecord = null;
  applyRemoteCloudState(record);
}

function isEditorActivelyFocused() {
  const editor = refs.editorRoot?.querySelector?.("#notepad-editor");
  return Boolean(uiState.editorFocused || editor?.contains(document.activeElement));
}

function hasRecentLocalMutation(windowMs = CLOUD_LOCAL_EDIT_PROTECTION_MS) {
  return Boolean(authState.lastLocalMutationAt && Date.now() - authState.lastLocalMutationAt < windowMs);
}

function shouldProtectLocalStateFromCloudConflict() {
  return authState.saveTimer || isEditorActivelyFocused() || getActiveWardNameInput() || hasRecentLocalMutation(CLOUD_LOCAL_EDIT_PROTECTION_MS);
}

function applyRemoteCloudState(record, { force = false } = {}) {
  const remoteUpdatedAt = parseCloudUpdatedAt(record.updated_at) || Date.now();
  if (!record?.state_json || (!force && remoteUpdatedAt <= authState.lastCloudUpdatedAt)) return;

  const { state: remoteState, preservedEntities } = mergeRemoteStatePreservingNewerLocalEntities(record.state_json);
  if (authState.pendingDoneToggles.size) {
    authState.pendingDoneToggles.forEach((toggle) => {
      applyDoneToggleToState(remoteState, toggle);
    });
  }

  appState = remoteState;
  state = getActiveWorkspaceState(appState);
  rememberCloudVersion(record.updated_at || new Date(remoteUpdatedAt).toISOString());
  authState.lastRemoteAppliedAt = Date.now();
  authState.suppressCloudSave = true;
  saveState({ skipCloud: true, markDirty: false });
  authState.suppressCloudSave = false;
  render();

  if (preservedEntities.length) {
    appendEditorDebugLog({
      action: "cloud-stale-entity-blocked",
      source: "cloud-sync",
      success: true,
      handledBy: "mergeRemoteStatePreservingNewerLocalEntities",
      remoteRecordUpdatedAt: String(record.updated_at || ""),
      preservedEntities
    });
    setAuthMessage("ShiftPad blocked an older cloud copy and is repairing live sync.");
    scheduleCloudSave();
  }
}

function rememberCloudVersion(updatedAtValue) {
  authState.lastCloudUpdatedAtValue = String(updatedAtValue || "");
  authState.lastCloudUpdatedAt = parseCloudUpdatedAt(updatedAtValue) || Date.now();
}

function mergeHydratedCloudState(remoteInput, fallbackInput) {
  const remote = normalizeAppState(remoteInput);
  const fallback = normalizeAppState(fallbackInput);
  if (!remoteInput?.workspaces && fallbackInput?.workspaces) {
    remote.workspaces.day = fallback.workspaces.day;
  }
  return mergeRemoteStatePreservingNewerLocalEntities(remote, fallback);
}

function mergeRemoteStatePreservingLocalView(remoteInput, localViewInput = appState) {
  const nextAppState = normalizeAppState(remoteInput);
  const localViewState = normalizeAppState(localViewInput);
  if (!remoteInput?.workspaces && localViewInput?.workspaces?.day) {
    nextAppState.workspaces.day = localViewState.workspaces.day;
  }
  nextAppState.activeWorkspace = getActiveWorkspaceKey(localViewState);

  WORKSPACE_KEYS.forEach((workspaceKey) => {
    preserveWorkspaceView(nextAppState.workspaces[workspaceKey], localViewState.workspaces?.[workspaceKey]);
  });
  return nextAppState;
}

function mergeRemoteStatePreservingNewerLocalEntities(remoteInput, localInput = appState) {
  const localAppState = normalizeAppState(localInput);
  const nextAppState = mergeRemoteStatePreservingLocalView(remoteInput, localAppState);
  const preservedEntities = [];

  WORKSPACE_KEYS.forEach((workspaceKey) => {
    const nextWorkspace = nextAppState.workspaces[workspaceKey];
    const localWorkspace = localAppState.workspaces[workspaceKey];
    if (!nextWorkspace || !localWorkspace) return;

    const localWards = new Map(localWorkspace.wards.map((ward) => [ward.id, ward]));
    nextWorkspace.wards.forEach((nextWard) => {
      const localWard = localWards.get(nextWard.id);
      if (!localWard) return;

      const localWardUpdatedAt = Number(localWard.updatedAt) || 0;
      const remoteWardUpdatedAt = Number(nextWard.updatedAt) || 0;
      if (localWardUpdatedAt > remoteWardUpdatedAt) {
        preservedEntities.push({
          type: "ward",
          workspace: workspaceKey,
          wardId: nextWard.id,
          localUpdatedAt: localWardUpdatedAt,
          remoteUpdatedAt: remoteWardUpdatedAt
        });
        nextWard.name = localWard.name;
        nextWard.color = localWard.color;
        nextWard.updatedAt = localWardUpdatedAt;
      }

      const localNotes = new Map(localWard.notes.map((note) => [note.id, note]));
      nextWard.notes = nextWard.notes.map((remoteNote) => {
        const localNote = localNotes.get(remoteNote.id);
        if (!localNote) return remoteNote;

        const localUpdatedAt = getNoteUpdatedAt(localNote);
        const remoteNoteUpdatedAt = getNoteUpdatedAt(remoteNote);
        if (localUpdatedAt <= remoteNoteUpdatedAt) return remoteNote;

        preservedEntities.push({
          type: "note",
          workspace: workspaceKey,
          wardId: nextWard.id,
          noteId: remoteNote.id,
          localUpdatedAt,
          remoteUpdatedAt: remoteNoteUpdatedAt
        });
        return localNote;
      });
    });
  });

  return { state: nextAppState, preservedEntities };
}

function preserveWorkspaceView(nextState, currentState) {
  if (!nextState || !currentState) return;
  nextState.activeView = currentState.activeView === "timeline" ? "timeline" : "notes";
  nextState.timelineScope = currentState.timelineScope === "active" ? "active" : "all";
  nextState.summaryTab = SUMMARY_TABS.includes(currentState.summaryTab) ? currentState.summaryTab : "reminders";

  const currentWard = nextState.wards.find((ward) => ward.id === currentState.selectedWardId);
  if (currentWard) {
    nextState.selectedWardId = currentWard.id;
    nextState.selectedNoteId = currentWard.notes.some((note) => note.id === currentState.selectedNoteId)
      ? currentState.selectedNoteId
      : currentWard.notes[0]?.id || "";
  }
  ensureSelectionForState(nextState);
}

function mergeCloudStateForSave(localInput, remoteInput) {
  const local = normalizeAppState(localInput);
  const remote = normalizeAppState(remoteInput);
  if (!remoteInput?.workspaces) {
    remote.workspaces.day = local.workspaces.day;
  }

  const mergedAppState = {
    version: 3,
    activeWorkspace: getActiveWorkspaceKey(local),
    workspaces: {}
  };
  WORKSPACE_KEYS.forEach((workspaceKey) => {
    mergedAppState.workspaces[workspaceKey] = mergeWorkspaceStateForSave(
      local.workspaces[workspaceKey],
      remote.workspaces[workspaceKey]
    );
  });
  return normalizeAppState(mergedAppState);
}

function mergeWorkspaceStateForSave(localInput, remoteInput) {
  const local = normalizeWorkspaceState(localInput, { blankFallback: true });
  const remote = normalizeWorkspaceState(remoteInput, { blankFallback: true });
  const localWardMap = new Map(local.wards.map((ward) => [ward.id, ward]));
  const remoteWardMap = new Map(remote.wards.map((ward) => [ward.id, ward]));
  const wardIds = [
    ...local.wards.map((ward) => ward.id),
    ...remote.wards.map((ward) => ward.id).filter((wardId) => !localWardMap.has(wardId))
  ];

  const wards = wardIds
    .map((wardId) => {
      const localWard = localWardMap.get(wardId);
      const remoteWard = remoteWardMap.get(wardId);
      if (!localWard) return remoteWard;
      if (!remoteWard) return localWard;

      const localNoteMap = new Map(localWard.notes.map((note) => [note.id, note]));
      const remoteNoteMap = new Map(remoteWard.notes.map((note) => [note.id, note]));
      const noteIds = [
        ...localWard.notes.map((note) => note.id),
        ...remoteWard.notes.map((note) => note.id).filter((noteId) => !localNoteMap.has(noteId))
      ];
      let localWardHasNewestNote = false;

      const notes = noteIds
        .map((noteId) => {
          const localNote = localNoteMap.get(noteId);
          const remoteNote = remoteNoteMap.get(noteId);
          if (!localNote) return remoteNote;
          if (!remoteNote) {
            localWardHasNewestNote = true;
            return localNote;
          }

          const localUpdatedAt = getNoteUpdatedAt(localNote);
          const remoteUpdatedAt = getNoteUpdatedAt(remoteNote);
          if (localUpdatedAt >= remoteUpdatedAt) {
            localWardHasNewestNote = localWardHasNewestNote || localUpdatedAt > remoteUpdatedAt;
            return localNote;
          }
          return remoteNote;
        })
        .filter(Boolean);

      const localWardUpdatedAt = Number(localWard.updatedAt) || 0;
      const remoteWardUpdatedAt = Number(remoteWard.updatedAt) || 0;
      const keepLocalWardMetadata =
        localWardUpdatedAt > remoteWardUpdatedAt ||
        (localWardUpdatedAt === remoteWardUpdatedAt && localWardHasNewestNote);

      return {
        ...remoteWard,
        name: keepLocalWardMetadata ? localWard.name : remoteWard.name,
        color: keepLocalWardMetadata ? localWard.color : remoteWard.color,
        updatedAt: Math.max(localWardUpdatedAt, remoteWardUpdatedAt),
        notes
      };
    })
    .filter(Boolean);

  const mergedState = normalizeWorkspaceState({
    ...remote,
    activeView: local.activeView,
    selectedWardId: local.selectedWardId,
    selectedNoteId: local.selectedNoteId,
    timelineScope: local.timelineScope,
    summaryTab: local.summaryTab,
    preferences: local.preferences,
    recoveryHistory: mergeHistoryCollections(local.recoveryHistory, remote.recoveryHistory, RECOVERY_HISTORY_LIMIT),
    // Archive deletion is intentional, so the locally visible archive is authoritative.
    shiftArchives: local.shiftArchives,
    wards
  }, { blankFallback: true });
  ensureSelectionForState(mergedState);
  return mergedState;
}

function mergeHistoryCollections(localItems, remoteItems, limit) {
  const merged = new Map();
  [...(remoteItems || []), ...(localItems || [])].forEach((entry) => {
    if (entry?.id) merged.set(entry.id, entry);
  });
  return [...merged.values()]
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, limit);
}

function getNoteUpdatedAt(note) {
  return Number(note?.updatedAt) || Number(note?.createdAt) || 0;
}

function getStateNoteById(targetState, wardId, noteId) {
  const targetWard = targetState?.wards?.find?.((ward) => ward.id === wardId);
  return targetWard?.notes?.find?.((note) => note.id === noteId) || null;
}

function ensureSelectionForState(targetState) {
  if (!targetState?.wards?.length) return;
  let ward = targetState.wards.find((item) => item.id === targetState.selectedWardId);
  if (!ward) {
    ward = targetState.wards[0];
    targetState.selectedWardId = ward.id;
  }
  if (!ward.notes.some((note) => note.id === targetState.selectedNoteId)) {
    targetState.selectedNoteId = ward.notes[0]?.id || "";
  }
}

function parseCloudUpdatedAt(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function setAuthMessage(message) {
  if (refs.authMessage) {
    refs.authMessage.textContent = message || "";
  }
}

function formatSupabaseError(error, fallback) {
  const rawMessage = String(error?.message || error?.error_description || error || fallback || "Supabase request failed.");
  if (/signup.*disabled|signups.*disabled|signups not allowed|new users.*disabled|not accepting new users/i.test(rawMessage)) {
    return "Account creation is disabled in Supabase Auth. Enable Email signups in Supabase Authentication -> Providers.";
  }
  if (/already registered|already exists|user already/i.test(rawMessage)) {
    return "This email already has an account. Use Sign in instead.";
  }
  if (/password.*(short|weak|characters)|weak password/i.test(rawMessage)) {
    return "Use a password with at least 6 characters.";
  }
  if (/invalid.*email|email.*invalid/i.test(rawMessage)) {
    return "Enter a valid email address.";
  }
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
  const reminderTimeLabel = entry.reminderTime ? formatReminderTimeLabel(entry.reminderTime) : "";
  const metadata = [
    ward.name,
    entry.bedTag ? `Bed ${entry.bedTag.toUpperCase()}` : "",
    typeLabel
  ].filter(Boolean);
  const metadataMarkup = [
    ...metadata.map((label) => `<span>${escapeHtml(label)}</span>`),
    reminderTimeLabel ? `<span class="reminder-meta-time" aria-label="Reminder time ${escapeAttribute(reminderTimeLabel)}">${escapeHtml(reminderTimeLabel)}</span>` : ""
  ].filter(Boolean).join("");

  return `
    <article class="timeline-item reminder-row ${entry.done ? "is-done" : ""}">
      <label class="reminder-check" aria-label="${entry.done ? "Mark reminder open" : "Mark reminder done"}">
        <input
          type="checkbox"
          data-note-id="${escapeHtml(note.id)}"
          data-token-id="${escapeHtml(item.tokenId || "")}"
          data-reminder-key="${escapeHtml(item.reminderKey || "")}"
          ${entry.done ? "checked" : ""}
        />
        <span class="reminder-checkmark"></span>
      </label>
      <div class="reminder-main">
        <div class="reminder-topline">
          <textarea
            class="summary-editor reminder-editor"
            data-summary-editor="true"
            data-note-id="${escapeHtml(note.id)}"
            data-line-index="${item.lineIndex}"
            data-source-index="${Number.isInteger(item.sourceLineIndex) ? item.sourceLineIndex : ""}"
            data-line-id="${escapeAttribute(item.lineId || "")}"
            rows="1"
            aria-label="Reminder text"
          >${escapeHtml(reminderText)}</textarea>
        </div>
        <div class="reminder-meta">
          ${metadataMarkup}
        </div>
      </div>
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
                <div
                  class="summary-editor bed-summary-editor"
                  data-bed-editor="true"
                  data-bed-key="${escapeHtml(group.key)}"
                  contenteditable="true"
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Bed information"
                >${renderBedSummaryEditorHtml(group)}</div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderBedSummaryEditorHtml(group) {
  return (group.items || [])
    .map((item) => renderBedSummaryLineHtml(item.entry))
    .join("");
}

function renderBedSummaryLineHtml(entry) {
  const badges = getBedSummaryBadges(entry).map(renderBedSummaryBadge).join("");
  const text = getBedSummaryDisplayText(entry);
  return `<div class="bed-summary-line">${badges}${escapeHtml(text)}</div>`;
}

function getBedSummaryBadges(entry) {
  const badges = [];
  if (entry.todoTokenId) {
    badges.push({ type: "todo", label: entry.todoDone ? "Done" : "To-do", done: entry.todoDone });
  }

  if (entry.reminderType) {
    const tagLabel = getReminderTypeLabel(entry.reminderType);
    if (tagLabel) {
      const label = entry.reminderType === "time" || entry.reminderType === "lab"
        ? [tagLabel, entry.timeTag].filter(Boolean).join(" ")
        : tagLabel;
      badges.push({ type: entry.reminderType, label, done: entry.reminderDone });
    }
  }

  if (entry.kind && entry.kind !== "general" && entry.kind !== entry.reminderType && entry.kind !== "todo") {
    const kindLabel = entry.kind === "hn"
      ? String(entry.primaryTagText || "").trim() || "HN"
      : getKindMeta(entry.kind)?.label || entry.kind;
    if (kindLabel) badges.push({ type: entry.kind, label: kindLabel });
  }

  return badges;
}

function renderBedSummaryBadge(badge) {
  const classes = ["bed-summary-tag", `tag-${badge.type || "general"}`, badge.done ? "is-done" : ""]
    .filter(Boolean)
    .join(" ");
  return `<span class="${escapeAttribute(classes)}" data-label="${escapeAttribute(badge.label)}" contenteditable="false" aria-label="${escapeAttribute(badge.label)}"></span>`;
}

function getBedSummaryDisplayText(entry) {
  const directText = String(entry.text || "").trim();
  if (directText) return directText;

  let fallback = String(entry.visibleText || entry.bedSummaryText || "").trim();
  const badgeLabels = getBedSummaryBadges(entry).map((badge) => badge.label);
  fallback = stripLeadingTagMentions(fallback, badgeLabels);
  fallback = fallback.replace(/^[○✓]\s*/, "");
  return fallback.trim();
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
  const overdueItems = openItems.filter(isReminderOverdue);
  const upcomingItems = openItems.filter((item) => !isReminderOverdue(item));
  const doneItems = items.filter((item) => item.entry.done);

  return `
    <section class="timeline-group reminders-board">
      ${overdueItems.length ? renderReminderListGroup("Overdue", overdueItems, `${overdueItems.length} overdue`, "overdue") : ""}
      ${renderReminderListGroup("Upcoming", upcomingItems, `${upcomingItems.length} open`, "upcoming")}
      ${doneItems.length ? renderReminderListGroup("Completed", doneItems, `${doneItems.length} done`) : ""}
    </section>
  `;
}

function renderSummaryTodoSection(items) {
  if (!items.length) {
    return `
      <section class="timeline-group">
        ${renderTimelineEmptyState("No to-do items in this scope", "Open Notes")}
      </section>
    `;
  }

  const openItems = items.filter((item) => !item.entry.done);
  const doneItems = items.filter((item) => item.entry.done);

  return `
    <section class="timeline-group reminders-board todo-board">
      ${renderReminderListGroup("To do", openItems, `${openItems.length} open`)}
      ${doneItems.length ? renderReminderListGroup("Done", doneItems, `${doneItems.length} done`) : ""}
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

function renderReminderListGroup(title, items, countLabel, status = "") {
  if (!items.length) {
    return `
      <div class="reminder-section ${status ? `is-${escapeAttribute(status)}` : ""}">
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
    <div class="reminder-section ${status ? `is-${escapeAttribute(status)}` : ""}">
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

function isReminderOverdue(item) {
  const dueAt = getReminderDueAt(item);
  return Number.isFinite(dueAt) && Date.now() > dueAt;
}

function getReminderDueAt(item) {
  const time = String(item?.entry?.reminderTime || "");
  const minutes = parseTime(time);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes === Number.MAX_SAFE_INTEGER || !item?.note) return NaN;
  const createdAt = Number(item.note.createdAt || Date.now());
  const due = new Date(createdAt);
  due.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (due.getTime() < createdAt - 30 * 60 * 1000) {
    due.setDate(due.getDate() + 1);
  }
  return due.getTime();
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

function renderQuickChip(key, label, extraClass = "", color = "") {
  const style = renderCustomTagStyle({ color });
  return `
    <button class="quick-chip ${escapeHtml(extraClass)}" type="button" data-quick-tag="${escapeHtml(key)}" ${style}>
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
          .map((tag) => {
            const style = renderCustomTagStyle(tag);
            return `<button class="mobile-tag-option ${escapeHtml(tag.className || "")}" type="button" role="menuitem" data-mobile-tag="${escapeHtml(tag.key)}" ${style}>${escapeHtml(tag.label)}</button>`;
          })
          .join("")}
      </div>
      <button class="mobile-tag-fab ${uiState.mobileTagsOpen ? "is-cancel" : ""}" type="button" data-mobile-tag-toggle="true" aria-expanded="${expanded}" aria-label="${uiState.mobileTagsOpen ? "Close tag menu" : "Open tag menu"}">
        ${uiState.mobileTagsOpen ? "X" : "Tags"}
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
    { key: "hn", label: "HN", className: "hn" },
    { key: "todo", label: "To-do", className: "todo" },
    { key: "time", label: "Time", className: "time" },
    { key: "lab", label: "Lab", className: "lab" },
    { key: "io", label: "I/O", className: "io" },
    ...getCustomTagDefinitions().map((tag) => ({
      key: tag.id,
      label: tag.label,
      className: ["custom", tag.hasReminder ? "timed" : ""].filter(Boolean).join(" "),
      color: tag.color
    }))
  ];
}

function getPreferences() {
  state.preferences = normalizePreferences(state.preferences);
  return state.preferences;
}

function resetCurrentWardNote() {
  const ward = getCurrentWard();
  const currentNote = getCurrentNote();
  if (!ward) return;
  if (!window.confirm("Reset this ward note? This clears the notepad and reminders for this ward.")) return;

  if (currentNote) {
    syncEditorDocument();
    addRecoverySnapshot({ note: currentNote, ward, documentHtml: currentNote.documentHtml, reason: "Before note reset" });
  }

  const note = createNote(`${ward.name} handover`, "");
  ward.notes = [note];
  state.selectedNoteId = note.id;
  state.activeView = "notes";
  state.timelineScope = "active";
  clearSavedEditorSelection();
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  saveState({ skipRecovery: true });
  render();
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
  const id = String(tag.id || createCustomTagId(label));
  return {
    id,
    label,
    hasReminder: Boolean(tag.hasReminder),
    delayMinutes: Math.max(0, clampDelay(tag.delayMinutes, 0)),
    color: normalizeCustomTagColor(tag.color, getGeneratedCustomTagColor(`${id}:${label}`))
  };
}

function getGeneratedCustomTagColor(seed) {
  const text = String(seed || "custom-tag");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return CUSTOM_TAG_COLORS[hash % CUSTOM_TAG_COLORS.length];
}

function getNextCustomTagColor(existingTags, seed) {
  const fallback = getGeneratedCustomTagColor(seed);
  const usedColors = new Set(
    (Array.isArray(existingTags) ? existingTags : [])
      .map((tag) => normalizeCustomTagColor(tag.color, ""))
      .filter(Boolean)
  );
  const startIndex = Math.max(0, CUSTOM_TAG_COLORS.indexOf(fallback));
  for (let offset = 0; offset < CUSTOM_TAG_COLORS.length; offset += 1) {
    const color = CUSTOM_TAG_COLORS[(startIndex + offset) % CUSTOM_TAG_COLORS.length];
    if (!usedColors.has(color)) return color;
  }
  return fallback;
}

function normalizeCustomTagColor(value, fallback = CUSTOM_TAG_COLORS[0]) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function renderCustomTagStyle(tag) {
  const color = normalizeCustomTagColor(tag?.color || "", "");
  return color ? `style="--custom-tag-color:${escapeAttribute(color)}"` : "";
}

function applyCustomTagColors(root) {
  root?.querySelectorAll?.(".tag-token").forEach((token) => {
    const customTag = getCustomTagDefinition(token.dataset.tag || "");
    if (customTag?.color) {
      token.style.setProperty("--custom-tag-color", customTag.color);
    }
  });
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
  const debugEntry = beginEditorDebugAction(editor, {
    action: "tag-insert",
    source: "quick-tag",
    tag
  });

  editor.focus({ preventScroll: true });
  restoreSavedEditorSelection(editor);
  clearScreenSwitchSelectionRestore();
  insertTagIntoEditor(editor, tag);

  ensureEditorLineIdentities(editor, note.id);
  setNoteDocumentHtml(note, editor.innerHTML);
  saveState();
  updateSortBedsButtonFromEditor(editor);
  rememberEditorSelection(editor);
  finishEditorDebugAction(debugEntry, {
    success: true,
    handledBy: "insertTagIntoEditor",
    editor,
    extra: { tag }
  });
}

function isCompactMobileLayout() {
  const narrow = window.matchMedia("(max-width: 860px)").matches;
  const touchLike = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
  return narrow && (touchLike || isLikelyIpadDevice());
}

function syncMobileTagDock() {
  const editorChromeActive = state.activeView === "notes" && uiState.editorFocused;
  document.documentElement.classList.toggle("editor-is-active", editorChromeActive);
  const dock = refs.mobileTagRoot?.querySelector("[data-mobile-tag-dock]");
  if (!dock) return;

  const shouldShow = isCompactMobileLayout() && state.activeView === "notes" && uiState.editorFocused;
  const isOpen = shouldShow && uiState.mobileTagsOpen;
  dock.classList.toggle("is-visible", shouldShow);
  dock.classList.toggle("is-open", isOpen);
  dock.setAttribute("aria-hidden", String(!shouldShow));
  const toggle = dock.querySelector("[data-mobile-tag-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Close tag menu" : "Open tag menu");
    toggle.classList.toggle("is-cancel", isOpen);
    toggle.textContent = isOpen ? "X" : "Tags";
  }
  window.requestAnimationFrame(positionMobileTagDock);
}

function positionMobileTagDock() {
  const dock = refs.mobileTagRoot?.querySelector("[data-mobile-tag-dock]");
  if (!dock) return;

  if (!isCompactMobileLayout() || !dock.classList.contains("is-visible")) {
    dock.style.removeProperty("--mobile-tag-x");
    dock.style.removeProperty("--mobile-tag-y");
    dock.style.removeProperty("--mobile-tag-width");
    dock.style.removeProperty("--mobile-tag-tray-max-height");
    delete dock.dataset.mobileTagMode;
    return;
  }

  const viewport = window.visualViewport;
  const compact = window.matchMedia("(max-width: 560px)").matches;
  const marginX = compact ? 10 : 12;
  const marginBottom = compact ? 6 : 8;
  const visualLeft = Math.round(viewport?.offsetLeft || 0);
  const visualTop = Math.max(0, Math.round(viewport?.offsetTop || 0));
  const visualWidth = Math.round(viewport?.width || window.innerWidth);
  const visualHeight = Math.round(viewport?.height || window.innerHeight);
  const layoutHeight = Math.round(window.innerHeight || visualHeight);
  const dockHeight = Math.round(dock.offsetHeight || 44);
  const x = Math.max(0, visualLeft + marginX);
  const width = Math.max(0, visualWidth - marginX * 2);
  const trayMaxHeight = Math.max(144, visualHeight - dockHeight - marginBottom - 18);
  const heightLoss = Math.max(0, layoutHeight - visualHeight);
  const ipadSplitView = isIpadSplitViewLayout();
  const useOffsetAwareMode = isLikelyIpadDevice() && !ipadSplitView;
  const keyboardOverlap = useOffsetAwareMode ? Math.max(0, heightLoss - visualTop) : heightLoss;

  dock.dataset.mobileTagMode = ipadSplitView ? "ipad-split" : useOffsetAwareMode ? "ipad-offset" : "height-loss";
  setDockStyleValue(dock, "--mobile-tag-x", `${x}px`);
  setDockStyleValue(dock, "--mobile-tag-width", `${width}px`);
  setDockStyleValue(dock, "--mobile-tag-tray-max-height", `${trayMaxHeight}px`);

  if (ipadSplitView && heightLoss > 0) {
    setDockStyleValue(dock, "--mobile-tag-y", "0px");
    const baseTop = dock.getBoundingClientRect().top;
    const targetTop = visualTop + visualHeight - marginBottom - dockHeight;
    const measuredOffset = Math.min(0, Math.max(-heightLoss, Math.round(targetTop - baseTop)));
    setDockStyleValue(dock, "--mobile-tag-y", `${measuredOffset}px`);
    dock.dataset.mobileTagMode = "ipad-split-measured";
  } else {
    setDockStyleValue(dock, "--mobile-tag-y", keyboardOverlap ? `-${keyboardOverlap}px` : "0px");
  }
}

function setDockStyleValue(dock, property, value) {
  if (dock.style.getPropertyValue(property) === value) return;
  dock.style.setProperty(property, value);
}

function refreshMobileTagDock() {
  if (!refs.mobileTagRoot) return;
  refs.mobileTagRoot.innerHTML = renderMobileTagDock();
  syncMobileTagDock();
}

function isLikelyIpadDevice() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return /iPad/i.test(userAgent) || (platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
}

function isLikelyIphoneDevice() {
  return /iPhone|iPod/i.test(navigator.userAgent || "");
}

function isIpadSplitViewLayout() {
  if (!isLikelyIpadDevice()) return false;
  const screenWidth = Math.min(Number(window.screen?.width || 0), Number(window.screen?.height || 0));
  const layoutWidth = Number(window.innerWidth || document.documentElement.clientWidth || 0);
  return screenWidth > 0 && layoutWidth > 0 && layoutWidth < screenWidth * 0.72;
}

function clampCompactShortNoteScrollPosition() {
  if (
    !isCompactMobileLayout() ||
    state.activeView !== "notes" ||
    window.scrollY <= 0 ||
    getVisualKeyboardOffset() >= 24 ||
    uiState.drawerOpen ||
    uiState.wardOptionsOpen ||
    uiState.searchOpen
  ) {
    return false;
  }

  if (shouldDeferCompactShortNoteScrollClamp()) {
    const gesture = uiState.shortNoteScrollGesture;
    if (gesture) {
      gesture.suppressedClampCount += 1;
      sampleShortNoteScrollGesture(gesture, null, "clamp-suppressed");
    }
    return false;
  }

  const metrics = getCompactShortNoteScrollMetrics();
  if (!metrics?.isShort) return false;

  const scrollY = Number(window.scrollY) || 0;
  const now = Date.now();
  if (now - uiState.lastShortNoteScrollClampDebugAt >= 1200) {
    uiState.lastShortNoteScrollClampDebugAt = now;
    appendEditorDebugLog({
      action: "short-note-scroll-forced-clamp",
      source: "viewport",
      success: true,
      handledBy: "clampCompactShortNoteScrollPosition",
      before: null,
      after: null,
      shortNoteScroll: {
        scrollY: Math.round(scrollY),
        contentBottomAtPageTop: Math.round(metrics.contentBottomAtPageTop),
        viewportBottom: Math.round(metrics.viewportBottom),
        documentMaxScrollY: Math.round(metrics.maxScrollY),
        gestureActive: Boolean(uiState.shortNoteScrollGesture?.active),
        suppressRemainingMs: Math.max(0, uiState.shortNoteScrollSuppressUntil - now)
      }
    });
  }
  window.scrollTo({ top: 0, left: window.scrollX, behavior: "auto" });
  return true;
}

function bindShortNoteScrollGestures() {
  window.addEventListener("touchstart", beginShortNoteScrollGesture, { passive: true, capture: true });
  window.addEventListener("touchmove", updateShortNoteScrollGesture, { passive: true, capture: true });
  window.addEventListener("touchend", finishShortNoteScrollGesture, { passive: true, capture: true });
  window.addEventListener("touchcancel", finishShortNoteScrollGesture, { passive: true, capture: true });
}

function beginShortNoteScrollGesture(event) {
  const editor = getEditorFromEventTarget(event.target);
  if (!editor || getVisualKeyboardOffset() >= 24) return;
  const metrics = getCompactShortNoteScrollMetrics();
  if (!metrics?.isShort) return;

  cancelShortNoteScrollSettle();
  const now = Date.now();
  const gesture = {
    active: true,
    startedAt: now,
    releasedAt: 0,
    startScrollY: window.scrollY,
    releaseScrollY: window.scrollY,
    minScrollY: window.scrollY,
    maxScrollY: window.scrollY,
    suppressedClampCount: 0,
    lastSampleAt: 0,
    samples: []
  };
  uiState.shortNoteScrollGesture = gesture;
  uiState.shortNoteScrollSuppressUntil = now + SHORT_NOTE_SCROLL_NATIVE_WATCH_MAX_MS;
  sampleShortNoteScrollGesture(gesture, event, "touchstart", true);
}

function updateShortNoteScrollGesture(event) {
  const gesture = uiState.shortNoteScrollGesture;
  if (!gesture?.active) return;
  sampleShortNoteScrollGesture(gesture, event, "touchmove");
}

function finishShortNoteScrollGesture(event) {
  const gesture = uiState.shortNoteScrollGesture;
  if (!gesture?.active) return;
  if (event?.touches?.length) return;
  const now = Date.now();
  gesture.active = false;
  gesture.releasedAt = now;
  gesture.releaseScrollY = window.scrollY;
  gesture.releaseWatchStartedAt = performance.now();
  gesture.lastObservedScrollY = Number(window.scrollY) || 0;
  gesture.stableReleaseFrames = 0;
  uiState.shortNoteScrollSuppressUntil =
    now + SHORT_NOTE_SCROLL_NATIVE_WATCH_MAX_MS + SHORT_NOTE_SCROLL_SETTLE_DURATION_MS;
  sampleShortNoteScrollGesture(gesture, event, event.type || "touchend", true);
  window.cancelAnimationFrame(uiState.shortNoteScrollSettleRaf);
  uiState.shortNoteScrollSettleRaf = window.requestAnimationFrame((timestamp) =>
    settleCompactShortNoteScroll(gesture, timestamp)
  );
}

function sampleShortNoteScrollGesture(gesture, event, kind, force = false) {
  if (!gesture) return;
  const now = Date.now();
  const scrollY = Number(window.scrollY) || 0;
  gesture.minScrollY = Math.min(gesture.minScrollY, scrollY);
  gesture.maxScrollY = Math.max(gesture.maxScrollY, scrollY);
  if (!force && now - gesture.lastSampleAt < 70) return;
  gesture.lastSampleAt = now;
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  const viewport = window.visualViewport;
  gesture.samples.push({
    t: now - gesture.startedAt,
    kind,
    scrollY: Math.round(scrollY),
    pageTop: Math.round(Number(viewport?.pageTop) || 0),
    offsetTop: Math.round(Number(viewport?.offsetTop) || 0),
    touchY: Number.isFinite(touch?.clientY) ? Math.round(touch.clientY) : null
  });
  if (gesture.samples.length > 24) gesture.samples.shift();
}

function shouldDeferCompactShortNoteScrollClamp() {
  return Boolean(
    uiState.shortNoteScrollGesture?.active ||
      uiState.shortNoteScrollSettleRaf ||
      Date.now() < uiState.shortNoteScrollSuppressUntil
  );
}

function getCompactShortNoteScrollMetrics() {
  if (
    !isCompactMobileLayout() ||
    state.activeView !== "notes" ||
    getVisualKeyboardOffset() >= 24 ||
    uiState.drawerOpen ||
    uiState.wardOptionsOpen ||
    uiState.searchOpen
  ) {
    return null;
  }

  const editor = refs.editorRoot?.querySelector?.("#notepad-editor");
  if (!editor) return null;
  const editorRect = editor.getBoundingClientRect();
  const lineBottom = Array.from(editor.children).reduce((bottom, line) => {
    const rect = line.getBoundingClientRect();
    return Math.max(bottom, rect.bottom);
  }, editorRect.top + (Number.parseFloat(getComputedStyle(editor).lineHeight) || 28));
  const contentBottomAtPageTop = lineBottom + window.scrollY;
  const viewportBottom = window.innerHeight - 18;
  const documentScrollHeight = document.documentElement.scrollHeight;
  return {
    editor,
    contentBottomAtPageTop,
    viewportBottom,
    documentScrollHeight,
    maxScrollY: Math.max(0, documentScrollHeight - window.innerHeight),
    isShort: contentBottomAtPageTop <= viewportBottom
  };
}

function settleCompactShortNoteScroll(gesture, timestamp) {
  if (!gesture || uiState.shortNoteScrollGesture !== gesture || gesture.active) return;
  const metrics = getCompactShortNoteScrollMetrics();
  const rawScrollY = Number(window.scrollY) || 0;
  const currentScrollY = Math.max(0, rawScrollY);
  const viewportOffsetTop = Math.abs(Number(window.visualViewport?.offsetTop) || 0);
  const watchElapsedMs = Math.max(0, timestamp - gesture.releaseWatchStartedAt);
  gesture.nativeWatchElapsedMs = watchElapsedMs;
  sampleShortNoteScrollGesture(gesture, null, "native-release-watch");
  if (!metrics?.isShort) {
    uiState.shortNoteScrollSettleRaf = 0;
    logShortNoteScrollGesture(gesture, "content-not-short", currentScrollY, metrics);
    uiState.shortNoteScrollGesture = null;
    return;
  }

  if (currentScrollY <= 1) {
    if ((rawScrollY < -1 || viewportOffsetTop > 1.5) && watchElapsedMs < SHORT_NOTE_SCROLL_NATIVE_WATCH_MAX_MS) {
      uiState.shortNoteScrollSettleRaf = window.requestAnimationFrame((nextTimestamp) =>
        settleCompactShortNoteScroll(gesture, nextTimestamp)
      );
      return;
    }
    uiState.shortNoteScrollSettleRaf = 0;
    logShortNoteScrollGesture(gesture, "native-settled", currentScrollY, metrics);
    uiState.shortNoteScrollGesture = null;
    return;
  }

  const movement = Math.abs(currentScrollY - gesture.lastObservedScrollY);
  gesture.lastObservedScrollY = currentScrollY;
  gesture.stableReleaseFrames = viewportOffsetTop <= 1.5 && movement < 0.75
    ? gesture.stableReleaseFrames + 1
    : 0;
  if (
    gesture.stableReleaseFrames < SHORT_NOTE_SCROLL_STALL_FRAMES &&
    watchElapsedMs < SHORT_NOTE_SCROLL_NATIVE_WATCH_MAX_MS
  ) {
    uiState.shortNoteScrollSettleRaf = window.requestAnimationFrame((nextTimestamp) =>
      settleCompactShortNoteScroll(gesture, nextTimestamp)
    );
    return;
  }

  uiState.shortNoteScrollSettleRaf = 0;
  animateCompactShortNoteScroll(gesture, currentScrollY, metrics);
}

function animateCompactShortNoteScroll(gesture, settleStartY, metrics) {
  const startedAt = performance.now();
  const duration = prefersReducedMotion() ? 0 : SHORT_NOTE_SCROLL_SETTLE_DURATION_MS;
  const animate = (timestamp) => {
    if (uiState.shortNoteScrollGesture !== gesture || gesture.active) {
      uiState.shortNoteScrollSettleRaf = 0;
      return;
    }
    const progress = duration ? Math.min(1, (timestamp - startedAt) / duration) : 1;
    const eased = 1 - Math.pow(1 - progress, 3);
    window.scrollTo({ left: window.scrollX, top: settleStartY * (1 - eased), behavior: "auto" });
    sampleShortNoteScrollGesture(gesture, null, "smooth-settle");
    if (progress < 1) {
      uiState.shortNoteScrollSettleRaf = window.requestAnimationFrame(animate);
      return;
    }
    uiState.shortNoteScrollSettleRaf = 0;
    logShortNoteScrollGesture(gesture, "smooth-settled", settleStartY, metrics);
    uiState.shortNoteScrollGesture = null;
  };
  uiState.shortNoteScrollSettleRaf = window.requestAnimationFrame(animate);
}

function cancelShortNoteScrollSettle() {
  window.cancelAnimationFrame(uiState.shortNoteScrollSettleRaf);
  uiState.shortNoteScrollSettleRaf = 0;
}

function logShortNoteScrollGesture(gesture, result, settleStartY, metrics = null) {
  sampleShortNoteScrollGesture(gesture, null, result, true);
  appendEditorDebugLog({
    action: "short-note-scroll-settle",
    source: "touch",
    success: true,
    handledBy: "settleCompactShortNoteScroll",
    before: null,
    after: null,
    shortNoteScroll: {
      result,
      durationMs: Math.max(0, Date.now() - gesture.startedAt),
      startScrollY: Math.round(gesture.startScrollY),
      releaseScrollY: Math.round(gesture.releaseScrollY),
      settleStartY: Math.round(settleStartY),
      settleEndY: Math.round(window.scrollY),
      minScrollY: Math.round(gesture.minScrollY),
      maxScrollY: Math.round(gesture.maxScrollY),
      nativeWatchMs: Math.round(gesture.nativeWatchElapsedMs || 0),
      stableReleaseFrames: gesture.stableReleaseFrames || 0,
      documentMaxScrollY: Math.round(metrics?.maxScrollY || 0),
      suppressedClampCount: gesture.suppressedClampCount,
      samples: gesture.samples
    }
  });
}

function restoreEditorFocusAndSelection() {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return null;
  editor.focus({ preventScroll: true });
  restoreSavedEditorSelection(editor);
  clearScreenSwitchSelectionRestore();
  uiState.editorFocused = true;
  rememberEditorSelection(editor);
  return editor;
}

function rememberEditorSelection(editor, options = {}) {
  const force = Boolean(options.force);
  if (!force && isEditorSelectionMemoryFrozen()) return false;
  if (!force && document.visibilityState !== "visible") return false;
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return false;
  if (!isNodeInsideEditor(editor, selection.anchorNode) || !isNodeInsideEditor(editor, selection.focusNode)) return false;
  const range = selection.getRangeAt(0);
  uiState.savedSelection = range.cloneRange();
  uiState.savedSelectionBookmark = createEditorSelectionBookmark(editor, range);
  return true;
}

function isEditorSelectionMemoryFrozen() {
  return Boolean(
    uiState.restoreSelectionAfterScreenSwitch ||
      (uiState.selectionMemoryFrozenUntil && Date.now() < uiState.selectionMemoryFrozenUntil)
  );
}

function freezeEditorSelectionForScreenSwitch(reason = "screen-switch") {
  const editor = refs.editorRoot?.querySelector?.("#notepad-editor");
  if (!editor) return;
  const selection = window.getSelection();
  const hasEditorSelection =
    selection &&
    selection.rangeCount &&
    isNodeInsideEditor(editor, selection.anchorNode) &&
    isNodeInsideEditor(editor, selection.focusNode);
  const editorWasActive = Boolean(
    uiState.editorFocused ||
      editor.contains(document.activeElement) ||
      hasEditorSelection
  );

  if (hasEditorSelection && document.visibilityState === "visible" && document.hasFocus()) {
    rememberEditorSelection(editor, { force: true });
  }

  if (isIpadSplitViewLayout()) {
    clearScreenSwitchSelectionRestore();
    return;
  }

  uiState.selectionMemoryFrozenUntil = Date.now() + SCREEN_SWITCH_SELECTION_FREEZE_MS;
  uiState.restoreSelectionAfterScreenSwitch = Boolean(
    editorWasActive && (uiState.savedSelection || uiState.savedSelectionBookmark)
  );
  uiState.restoreEditorFocusAfterScreenSwitch = Boolean(
    editorWasActive && (uiState.editorFocused || editor.contains(document.activeElement))
  );
}

function scheduleScreenSwitchSelectionRestore(reason = "screen-return") {
  if (isIpadSplitViewLayout()) {
    clearScreenSwitchSelectionRestore();
    return;
  }
  if (!uiState.restoreSelectionAfterScreenSwitch) return;
  uiState.selectionMemoryFrozenUntil = Date.now() + SCREEN_SWITCH_SELECTION_FREEZE_MS;
  window.requestAnimationFrame(() => {
    restoreEditorSelectionAfterScreenSwitch(reason);
  });
}

function restoreEditorSelectionAfterScreenSwitch(reason = "screen-return") {
  if (!uiState.restoreSelectionAfterScreenSwitch) return false;
  const editor = refs.editorRoot?.querySelector?.("#notepad-editor");
  if (!editor || (!uiState.savedSelection && !uiState.savedSelectionBookmark)) {
    clearScreenSwitchSelectionRestore();
    return false;
  }

  const before = captureEditorDebugSnapshot(editor);
  const selection = window.getSelection();
  const hasLiveEditorSelection = Boolean(
    selection &&
      selection.rangeCount &&
      isNodeInsideEditor(editor, selection.anchorNode) &&
      isNodeInsideEditor(editor, selection.focusNode)
  );
  const isInputEvent = reason === "keydown" || reason === "beforeinput";

  if (isInputEvent && hasLiveEditorSelection) {
    clearScreenSwitchSelectionRestore();
    rememberEditorSelection(editor, { force: true });
    appendEditorDebugLog({
      action: "selection-restore-screen-switch",
      source: reason,
      success: true,
      handledBy: "preserveLiveEditorSelection",
      before,
      after: captureEditorDebugSnapshot(editor)
    });
    return false;
  }

  if (uiState.restoreEditorFocusAfterScreenSwitch && document.visibilityState === "visible") {
    editor.focus({ preventScroll: true });
  }
  const restored = restoreSavedEditorSelection(editor, { forceSavedRange: true });
  if (restored) {
    uiState.editorFocused = Boolean(editor.contains(document.activeElement) || uiState.editorFocused);
    rememberEditorSelection(editor, { force: true });
  }
  clearScreenSwitchSelectionRestore();
  uiState.selectionMemoryFrozenUntil = Date.now() + 250;

  appendEditorDebugLog({
    action: "selection-restore-screen-switch",
    source: reason,
    success: restored,
    handledBy: "restoreEditorSelectionAfterScreenSwitch",
    before,
    after: captureEditorDebugSnapshot(editor)
  });
  return restored;
}

function clearScreenSwitchSelectionRestore() {
  uiState.restoreSelectionAfterScreenSwitch = false;
  uiState.restoreEditorFocusAfterScreenSwitch = false;
  uiState.selectionMemoryFrozenUntil = 0;
}

function beginEditorTapDebug(editor, event) {
  if (!isEditorDebugLoggingEnabled() || !editor) return;
  const point = getEditorPointerPoint(event);
  const targetLine = findEditorLine(event.target);
  uiState.pendingEditorTapDebug = {
    startedAt: Date.now(),
    point,
    targetLineIndex: targetLine ? getEditorDebugLines(editor).indexOf(targetLine) : -1,
    targetLineText: targetLine ? getEditorDebugReadableText(targetLine) : "",
    before: captureEditorCaretDebugSnapshot(editor)
  };
}

function finishEditorTapDebug(editor) {
  const pending = uiState.pendingEditorTapDebug;
  uiState.pendingEditorTapDebug = null;
  if (!pending || !editor) return;
  appendEditorDebugLog({
    action: "editor-tap-selection",
    source: "editor-click",
    success: true,
    handledBy: "native-editor-selection",
    targetLineIndex: pending.targetLineIndex,
    targetLineText: pending.targetLineText,
    tapPoint: pending.point,
    elapsedMs: Date.now() - pending.startedAt,
    before: pending.before,
    after: captureEditorCaretDebugSnapshot(editor)
  });
}

function captureEditorCaretDebugSnapshot(editor) {
  const snapshot = captureEditorDebugSnapshot(editor);
  if (!snapshot) return null;
  return {
    currentLineIndex: snapshot.currentLineIndex,
    currentLine: snapshot.currentLine,
    selection: snapshot.selection,
    layout: snapshot.layout
  };
}

function rememberEditorTapScroll(event) {
  if (!isCompactMobileLayout()) return;
  const viewport = window.visualViewport;
  const point = getEditorPointerPoint(event);
  uiState.editorTapScroll = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportHeight: viewport?.height || window.innerHeight,
    viewportTop: viewport?.offsetTop || 0,
    timestamp: performance.now(),
    startX: point?.x ?? 0,
    startY: point?.y ?? 0,
    moved: false
  };
  uiState.pointerTracking = point ? { x: point.x, y: point.y } : null;
}

function getEditorPointerPoint(event) {
  const touch = event?.touches?.[0] || event?.changedTouches?.[0];
  const x = touch?.clientX ?? event?.clientX;
  const y = touch?.clientY ?? event?.clientY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function markEditorPointerMoved(event) {
  const start = uiState.pointerTracking;
  const snapshot = uiState.editorTapScroll;
  if (!start || !snapshot) return;
  const point = getEditorPointerPoint(event);
  if (!point) return;
  if (Math.hypot(point.x - start.x, point.y - start.y) > 10) {
    snapshot.moved = true;
  }
}

function clearEditorTapScrollForInput() {
  uiState.editorTapScroll = null;
  uiState.pointerTracking = null;
}

function stabilizeEditorTapScroll(editor, attempt = 0) {
  const snapshot = uiState.editorTapScroll;
  if (!editor || !snapshot || !isCompactMobileLayout()) return;
  const selection = window.getSelection();
  if (snapshot.moved || (selection && selection.rangeCount && !selection.isCollapsed)) {
    uiState.editorTapScroll = null;
    return;
  }

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
    const range = selection.getRangeAt(0);
    uiState.savedSelection = range.cloneRange();
    uiState.savedSelectionBookmark = createEditorSelectionBookmark(editor, range);
    return true;
  }

  if (uiState.savedSelection) {
    if (isSavedSelectionUsable(editor, uiState.savedSelection)) {
      selection.removeAllRanges();
      selection.addRange(uiState.savedSelection.cloneRange());
      return true;
    }
    uiState.savedSelection = null;
  }

  if (restoreEditorSelectionBookmark(editor)) {
    return true;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  uiState.savedSelection = range.cloneRange();
  uiState.savedSelectionBookmark = createEditorSelectionBookmark(editor, range);
  return true;
}

function restoreSavedEditorSelection(editor, options = {}) {
  const selection = window.getSelection();
  if (!editor || !selection) return false;

  if (uiState.savedSelection) {
    if (!isSavedSelectionUsable(editor, uiState.savedSelection)) {
      uiState.savedSelection = null;
      if (restoreEditorSelectionBookmark(editor)) return true;
      if (options.forceSavedRange) return false;
      return restoreEditorSelection(editor);
    }
    try {
      selection.removeAllRanges();
      selection.addRange(uiState.savedSelection.cloneRange());
      return true;
    } catch {
      uiState.savedSelection = null;
      if (restoreEditorSelectionBookmark(editor)) return true;
      if (options.forceSavedRange) return false;
      return restoreEditorSelection(editor);
    }
  }

  if (restoreEditorSelectionBookmark(editor)) return true;

  return restoreEditorSelection(editor);
}

function createEditorSelectionBookmark(editor, range) {
  if (!editor || !range) return null;
  const noteId = getCurrentNote()?.id || "";
  const start = createEditorSelectionBoundary(editor, range.startContainer, range.startOffset);
  const end = createEditorSelectionBoundary(editor, range.endContainer, range.endOffset);
  if (!start || !end) return null;
  return { noteId, collapsed: range.collapsed, start, end };
}

function createEditorSelectionBoundary(editor, container, offset) {
  if (container === editor) {
    const safeOffset = Math.max(0, Math.min(Number(offset) || 0, editor.childNodes.length));
    const nextLine = editor.childNodes[safeOffset];
    const previousLine = editor.childNodes[safeOffset - 1];
    const line = nextLine?.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(nextLine.tagName)
      ? nextLine
      : previousLine?.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(previousLine.tagName)
        ? previousLine
        : null;
    if (!line?.dataset?.lineId) return null;
    const atLineStart = line === nextLine;
    return {
      lineId: line.dataset.lineId,
      path: [],
      offset: atLineStart ? 0 : line.childNodes.length,
      textOffset: atLineStart ? 0 : String(line.textContent || "").length
    };
  }
  const line = findEditorLine(container);
  if (!line?.dataset?.lineId) return null;
  return {
    lineId: line.dataset.lineId,
    path: getNodePathWithinLine(line, container),
    offset: Math.max(0, Number(offset) || 0),
    textOffset: getTextOffsetForSelectionBoundary(line, container, offset)
  };
}

function getNodePathWithinLine(line, node) {
  if (!line || !node || node === line) return [];
  const path = [];
  let current = node;
  while (current && current !== line) {
    const parent = current.parentNode;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.childNodes, current);
    if (index < 0) return null;
    path.unshift(index);
    current = parent;
  }
  return current === line ? path : null;
}

function getTextOffsetForSelectionBoundary(line, container, offset) {
  try {
    const range = document.createRange();
    range.selectNodeContents(line);
    range.setEnd(container, Math.max(0, Number(offset) || 0));
    return range.toString().length;
  } catch {
    return 0;
  }
}

function restoreEditorSelectionBookmark(editor) {
  const bookmark = uiState.savedSelectionBookmark;
  const noteId = getCurrentNote()?.id || "";
  if (!editor || !bookmark || (bookmark.noteId && bookmark.noteId !== noteId)) return false;
  const start = resolveEditorSelectionBoundary(editor, bookmark.start);
  const end = bookmark.collapsed ? start : resolveEditorSelectionBoundary(editor, bookmark.end);
  if (!start || !end) return false;

  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    uiState.savedSelection = range.cloneRange();
    return true;
  } catch {
    return false;
  }
}

function resolveEditorSelectionBoundary(editor, boundary) {
  if (!boundary?.lineId) return null;
  const line = editor.querySelector(`[data-line-id="${cssEscape(boundary.lineId)}"]`);
  if (!line) return null;
  let node = line;
  if (Array.isArray(boundary.path)) {
    for (const index of boundary.path) {
      if (!node?.childNodes?.[index]) {
        node = null;
        break;
      }
      node = node.childNodes[index];
    }
  }
  if (node) {
    const maxOffset = node.nodeType === Node.TEXT_NODE ? node.textContent.length : node.childNodes.length;
    return { node, offset: Math.max(0, Math.min(boundary.offset, maxOffset)) };
  }
  return getTextBoundaryWithinLine(line, boundary.textOffset);
}

function getTextBoundaryWithinLine(line, targetOffset) {
  let remaining = Math.max(0, Number(targetOffset) || 0);
  const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (remaining <= node.textContent.length) return { node, offset: remaining };
    remaining -= node.textContent.length;
    node = walker.nextNode();
  }
  return { node: line, offset: line.childNodes.length };
}

function clearSavedEditorSelection() {
  uiState.savedSelection = null;
  uiState.savedSelectionBookmark = null;
}

function isSavedSelectionUsable(editor, range) {
  return Boolean(
    editor &&
      range &&
      isNodeInsideEditor(editor, range.startContainer) &&
      isNodeInsideEditor(editor, range.endContainer)
  );
}

function queueEditorCaretVisibilityCheck(editor, reason = "input") {
  if (!editor || !isCompactMobileLayout() || !uiState.editorFocused) return;
  window.cancelAnimationFrame(uiState.caretScrollRaf);
  uiState.caretScrollRaf = window.requestAnimationFrame(() => {
    uiState.caretScrollRaf = 0;
    keepEditorCaretVisible(editor, { reason });
  });
}

function keepEditorCaretVisible(editor, { reason = "input", force = false } = {}) {
  if (!editor || !isCompactMobileLayout() || !uiState.editorFocused) return;

  const viewport = window.visualViewport;
  const keyboardVisible = getVisualKeyboardOffset() >= 24;
  const rect = getCaretRect() || getCurrentEditorLine()?.getBoundingClientRect() || editor.getBoundingClientRect();
  const viewportTop = keyboardVisible ? viewport?.offsetTop || 0 : 0;
  const viewportHeight = keyboardVisible ? viewport?.height || window.innerHeight : window.innerHeight;
  const visibleTop = viewportTop + 72;
  const visibleBottom = viewportTop + viewportHeight - 132;
  const deadZone = force ? 8 : 32;
  const padding = force ? 8 : 18;
  const topOverflow = visibleTop - rect.top;
  const bottomOverflow = rect.bottom - visibleBottom;
  let nextScrollTop = null;

  if (bottomOverflow > deadZone) {
    nextScrollTop = Math.max(0, window.scrollY + bottomOverflow + padding);
  } else if (topOverflow > deadZone) {
    nextScrollTop = Math.max(0, window.scrollY - topOverflow - padding);
  }

  if (nextScrollTop === null) return;
  nextScrollTop = Math.round(nextScrollTop);
  const currentScrollTop = Math.round(window.scrollY);
  if (Math.abs(nextScrollTop - currentScrollTop) < 16) return;

  const now = performance.now();
  if (now - uiState.lastCaretAutoScrollAt < 220 && Math.abs(nextScrollTop - uiState.lastCaretAutoScrollTop) < 48) {
    return;
  }

  uiState.lastCaretAutoScrollAt = now;
  uiState.lastCaretAutoScrollTop = nextScrollTop;
  window.scrollTo({
    top: nextScrollTop,
    left: window.scrollX,
    behavior: "auto"
  });
  appendViewportDebugLog(`caret-auto-scroll:${reason}`, "keepEditorCaretVisible");
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

function toggleTaggedLineDone(noteId, tokenId, done, reminderKey = "") {
  if (!applyDoneToggleToState(state, { noteId, tokenId, done, reminderKey })) return;

  rememberPendingDoneToggle(noteId, tokenId, done, reminderKey);
  saveState();
  render();
}

function toggleTodoTokenInEditor(token) {
  if (!token) return;
  const note = getCurrentNote();
  const tokenId = token.dataset.tokenId || "";
  const done = token.dataset.done !== "true";
  token.dataset.done = done ? "true" : "false";
  token.setAttribute("aria-checked", done ? "true" : "false");
  const line = findEditorLine(token);
  refreshLineTagClasses(line);
  rememberPendingDoneToggle(note?.id || "", tokenId, done, "");
  syncEditorDocument();
}

function rememberPendingDoneToggle(noteId, tokenId, done, reminderKey = "") {
  if (!authState.user || !noteId || !tokenId) return;
  authState.pendingDoneToggles.set(getDoneToggleKey(noteId, tokenId, reminderKey), {
    noteId,
    tokenId,
    done: Boolean(done),
    reminderKey: reminderKey || ""
  });
}

function getDoneToggleKey(noteId, tokenId, reminderKey = "") {
  return [noteId, tokenId, reminderKey || ""].map((item) => encodeURIComponent(item)).join(":");
}

function applyDoneToggleToState(targetState, toggle) {
  const note = findNoteByIdInState(targetState, toggle?.noteId);
  if (!note || !toggle?.tokenId) return false;

  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const target = root.querySelector(`[data-token-id="${cssEscape(toggle.tokenId)}"]`);
  if (!target) return false;

  if (target.dataset.tag === "io" && toggle.reminderKey) {
    target.removeAttribute("data-done");
    target.setAttribute(getIoDoneAttributeName(toggle.reminderKey), toggle.done ? "true" : "false");
  } else {
    target.dataset.done = toggle.done ? "true" : "false";
    if (target.dataset.tag === "todo") {
      target.setAttribute("aria-checked", toggle.done ? "true" : "false");
    }
  }
  setNoteDocumentHtml(note, root.innerHTML);
  return true;
}

function findNoteByIdInState(targetState, noteId) {
  if (!targetState || !noteId) return null;
  const workspaceStates = targetState.workspaces
    ? WORKSPACE_KEYS.map((key) => targetState.workspaces[key]).filter(Boolean)
    : [targetState];
  for (const workspaceState of workspaceStates) {
    for (const ward of workspaceState.wards || []) {
      const note = (ward.notes || []).find((item) => item.id === noteId);
      if (note) return note;
    }
  }
  return null;
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

function updateSummaryLineText(noteId, lineIndex, nextText, sourceLineIndex = NaN, lineId = "") {
  const note = findNoteById(noteId);
  if (!note || !Number.isInteger(lineIndex) || lineIndex < 0) {
    return {
      success: false,
      reason: "invalid-summary-target",
      noteId,
      lineIndex,
      sourceLineIndex,
      lineId,
      nextText: String(nextText || "")
    };
  }

  const { root, targets } = getEditableLineTargets(note);
  const target = lineId
    ? targets.find((item) => item.lineId === lineId)
    : Number.isInteger(sourceLineIndex)
      ? targets.find((item) => item.sourceLineIndex === sourceLineIndex)
      : targets[lineIndex];
  if (!target) {
    return {
      success: false,
      reason: "summary-target-not-found",
      noteId,
      lineIndex,
      sourceLineIndex,
      lineId,
      nextText: String(nextText || ""),
      before: captureNoteDebugSnapshot(note)
    };
  }

  const beforeLine = captureSummaryTargetDebug(target);
  const before = captureNoteDebugSnapshot(note);
  writeLineText(target.element, nextText);
  setNoteDocumentHtml(note, root.innerHTML);
  saveState();
  return {
    success: true,
    noteId,
    lineIndex,
    sourceLineIndex,
    lineId: target.lineId || lineId,
    targetSourceLineIndex: target.sourceLineIndex,
    nextText: String(nextText || ""),
    before,
    beforeLine,
    afterLine: captureSummaryTargetDebug({
      ...target,
      parsed: parseLineNode(target.element)
    }),
    after: captureNoteDebugSnapshot(note)
  };
}

function parseOptionalIndex(value) {
  if (value === undefined || value === null || value === "") return NaN;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : NaN;
}

function captureSummaryTargetDebug(target) {
  if (!target?.element) return null;
  const parsed = target.parsed || parseLineNode(target.element);
  return {
    sourceLineIndex: Number.isInteger(target.sourceLineIndex) ? target.sourceLineIndex : NaN,
    lineId: target.lineId || "",
    text: parsed.text || "",
    visibleText: parsed.visibleText || "",
    html: target.element.innerHTML || "",
    tags: (parsed.tags || []).map((tag) => ({
      type: tag.type || "",
      text: tag.text || "",
      id: tag.id || "",
      done: Boolean(tag.done),
      createdAt: Number(tag.createdAt || 0)
    }))
  };
}

function appendSummaryEditorDebugLog(summaryEditor, phase, result) {
  if (!isEditorDebugLoggingEnabled()) return;
  appendEditorDebugLog({
    action: `summary-editor-${phase}`,
    source: "timeline-summary-editor",
    success: Boolean(result?.success),
    handledBy: "updateSummaryLineText",
    noteId: summaryEditor?.dataset?.noteId || result?.noteId || "",
    lineIndex: parseOptionalIndex(summaryEditor?.dataset?.lineIndex),
    sourceLineIndex: parseOptionalIndex(summaryEditor?.dataset?.sourceIndex),
    lineId: summaryEditor?.dataset?.lineId || "",
    valueLength: String(summaryEditor?.value || "").length,
    result
  });
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

    setNoteDocumentHtml(note, root.innerHTML);
  });

  saveState();
}

function getEditableLineTargets(note) {
  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  const targets = [];

  Array.from(root.childNodes).forEach((node, sourceLineIndex) => {
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

    targets.push({ element: node, parsed, sourceLineIndex, lineId: parsed.lineId || node.dataset.lineId || "" });
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
    textBody = stripLeadingTagMentions(textBody, [getReminderTypeLabel(reminderNode.dataset.tag)]);
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
  if (textarea.tagName !== "TEXTAREA") return;
  const minHeight = textarea.classList.contains("reminder-editor") ? 24 : 44;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
}

function getEditorPlainText(editor) {
  if (!editor) return "";
  if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") return editor.value || "";
  return editor.innerText || editor.textContent || "";
}

async function handleDrawerAction(action, dataset = {}) {
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

  if (action === "test-notification") {
    await testPushNotification();
    return;
  }

  if (action === "clear-debug-logs") {
    await clearEditorDebugLogs();
    return;
  }

  if (action === "add-ward") {
    addWard();
    return;
  }

  if (action === "restore-recovery") {
    restoreRecoverySnapshot(dataset.historyId);
    return;
  }

  if (action === "restore-archive") {
    restoreShiftArchive(dataset.historyId);
    return;
  }

  if (action === "delete-archive") {
    deleteShiftArchive(dataset.historyId);
    return;
  }

  if (action === "reset-notes") {
    resetAllNotes();
  }
}

function getNotificationSupport() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return {
      apiSupported: false,
      supported: false,
      message: "This browser cannot receive web push notifications."
    };
  }

  const isLikelyIos = isLikelyIpadDevice() || isLikelyIphoneDevice();
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  if (isLikelyIos && !isStandalone) {
    return {
      apiSupported: true,
      supported: false,
      message: "On iPhone, add ShiftPad to the Home Screen and open it from the icon before enabling notifications."
    };
  }

  return { apiSupported: true, supported: true, message: "" };
}

function getNotificationSetupIssue({ support, configured }) {
  if (!support.supported) return support.message;
  if (!authState.user) return "Sign in first, then turn on notifications from the Home Screen app.";
  if (!configured) return "Vercel is missing VAPID_PUBLIC_KEY, so iPhone cannot ask for notification permission yet.";
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return "Notifications are blocked in this device's system settings. Allow notifications for ShiftPad there, then return to the app.";
  }
  return "";
}

async function registerShiftPadServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    bindServiceWorkerUpdateReload();
    const registration = await navigator.serviceWorker.register("/sw.js");
    registration?.update?.().catch(() => undefined);
    return registration || null;
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    uiState.notificationStatus = "Notification setup failed while registering the app worker.";
    return null;
  }
}

function bindServiceWorkerUpdateReload() {
  if (uiState.serviceWorkerUpdateListenerBound) return;
  uiState.serviceWorkerUpdateListenerBound = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    uiState.serviceWorkerReloadPending = true;
    scheduleSafeServiceWorkerReload();
  });
}

function scheduleSafeServiceWorkerReload() {
  if (!uiState.serviceWorkerReloadPending) return;
  if (uiState.serviceWorkerReloadTimer) {
    window.clearTimeout(uiState.serviceWorkerReloadTimer);
  }
  uiState.serviceWorkerReloadTimer = window.setTimeout(() => {
    uiState.serviceWorkerReloadTimer = null;
    const editingIsActive =
      document.visibilityState !== "visible" ||
      isEditorActivelyFocused() ||
      Boolean(getActiveWardNameInput()) ||
      authState.isSaving ||
      Boolean(authState.saveTimer) ||
      hasRecentLocalMutation(CLOUD_LOCAL_EDIT_PROTECTION_MS);
    if (editingIsActive) {
      scheduleSafeServiceWorkerReload();
      return;
    }
    uiState.serviceWorkerReloadPending = false;
    window.location.reload();
  }, 1200);
}

async function getReadyServiceWorkerRegistration() {
  const registration = await registerShiftPadServiceWorker();
  if (!("serviceWorker" in navigator)) return registration;
  return (
    (await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => window.setTimeout(() => resolve(null), 2500))
    ])) ||
    registration ||
    null
  );
}

async function enablePushNotifications() {
  const support = getNotificationSupport();
  if (!support.supported) {
    uiState.notificationStatus = support.message;
    renderDrawer();
    return;
  }

  if (!authState.session?.access_token) {
    uiState.notificationStatus = "Sign in first, then turn on notifications from the Home Screen app.";
    renderDrawer();
    return;
  }

  const publicKey = window.SHIFTPAD_PUBLIC_CONFIG?.vapidPublicKey;
  if (!publicKey) {
    uiState.notificationStatus = "Vercel is missing VAPID_PUBLIC_KEY, so iPhone cannot ask for notification permission yet.";
    renderDrawer();
    return;
  }

  try {
    uiState.notificationBusy = true;
    uiState.notificationStatus = "Turning on notifications...";
    renderDrawer();

    // Keep this directly in the tap handler; iOS may ignore permission prompts after extra async UI work.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      uiState.notificationStatus = "Notifications were not allowed on this device.";
      uiState.notificationEnabled = false;
      setPushEnabledPreference(false);
      uiState.notificationBusy = false;
      renderDrawer();
      return;
    }

    uiState.notificationStatus = "Saving this iPhone for ShiftPad reminders...";
    renderDrawer();

    const registration = await getReadyServiceWorkerRegistration();
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
    setPushEnabledPreference(true);
    uiState.notificationEnabled = true;
    uiState.notificationLastSyncAt = Date.now();
    uiState.notificationStatus = "Notifications are on for this device.";
  } catch (error) {
    console.error("Notification setup failed:", error);
    uiState.notificationEnabled = false;
    uiState.notificationStatus = formatPushError(error);
  } finally {
    uiState.notificationBusy = false;
  }

  renderDrawer();
}

async function disablePushNotifications() {
  uiState.notificationBusy = true;
  uiState.notificationStatus = "Turning off notifications...";
  renderDrawer();
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;
    if (subscription) {
      await removePushSubscription(subscription);
      await subscription.unsubscribe();
    }
    setPushEnabledPreference(false);
    uiState.notificationEnabled = false;
    uiState.notificationStatus = "Notifications are off for this device.";
  } catch (error) {
    console.error("Notification disable failed:", error);
    uiState.notificationStatus = "Could not disable notifications. Try again from the Home Screen app.";
  } finally {
    uiState.notificationBusy = false;
  }
  renderDrawer();
}

async function testPushNotification() {
  if (uiState.notificationBusy) return;
  uiState.notificationBusy = true;
  uiState.notificationStatus = "Sending a test notification...";
  renderDrawer();

  try {
    const registration = await getReadyServiceWorkerRegistration();
    const subscription = registration?.pushManager ? await registration.pushManager.getSubscription() : null;
    if (!subscription) {
      setPushEnabledPreference(false);
      uiState.notificationEnabled = false;
      throw new Error("This device is no longer connected. Turn notifications on again.");
    }
    await savePushSubscription(subscription, { sendTest: true });
    uiState.notificationLastSyncAt = Date.now();
    uiState.notificationStatus = "Test sent. It should appear in a few seconds.";
  } catch (error) {
    console.error("Test notification failed:", error);
    uiState.notificationStatus = formatPushError(error);
  } finally {
    uiState.notificationBusy = false;
  }
  renderDrawer();
}

let pushRefreshPromise = null;

async function refreshPushSubscriptionIfEnabled({ force = false } = {}) {
  if (pushRefreshPromise) return pushRefreshPromise;
  if (!authState.session?.access_token) return false;

  const support = getNotificationSupport();
  const publicKey = window.SHIFTPAD_PUBLIC_CONFIG?.vapidPublicKey;
  if (!support.supported || !publicKey || Notification.permission !== "granted") {
    uiState.notificationEnabled = false;
    return false;
  }

  if (!force && Date.now() - uiState.notificationLastSyncAt < PUSH_REFRESH_INTERVAL_MS) {
    return uiState.notificationEnabled === true;
  }

  pushRefreshPromise = (async () => {
    const registration = await getReadyServiceWorkerRegistration();
    if (!registration?.pushManager) return false;

    let subscription = await registration.pushManager.getSubscription();
    const preference = getPushEnabledPreference();

    // Existing installs predate the explicit switch. Preserve their active subscription.
    if (subscription && preference === null) {
      setPushEnabledPreference(true);
    }

    if (!subscription && preference === true) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    if (!subscription || getPushEnabledPreference() === false) {
      uiState.notificationEnabled = false;
      return false;
    }

    await savePushSubscription(subscription);
    uiState.notificationEnabled = true;
    uiState.notificationLastSyncAt = Date.now();
    return true;
  })()
    .catch((error) => {
      uiState.notificationEnabled = false;
      throw error;
    })
    .finally(() => {
      pushRefreshPromise = null;
      if (uiState.drawerOpen) renderDrawer();
    });

  return pushRefreshPromise;
}

function getPushEnabledPreference() {
  try {
    const value = window.localStorage.getItem(PUSH_ENABLED_STORAGE_KEY);
    return value === null ? null : value === "true";
  } catch {
    return null;
  }
}

function setPushEnabledPreference(enabled) {
  try {
    window.localStorage.setItem(PUSH_ENABLED_STORAGE_KEY, String(Boolean(enabled)));
  } catch {
    // Browser storage can be unavailable in private browsing; the subscription remains authoritative.
  }
}

async function savePushSubscription(subscription, { sendTest = false } = {}) {
  const response = await fetch(PUSH_SUBSCRIPTION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authState.session.access_token}`
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      sendTest
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
  const workspaceName = getActiveWorkspaceMeta().title;
  if (!window.confirm(`Archive the current ${workspaceName} shift and start with a blank workspace?`)) return;
  syncEditorDocument();
  const archives = createShiftArchive(`Completed ${workspaceName} shift`);
  const recoveryHistory = state.recoveryHistory;
  const nextState = createBlankState();
  nextState.shiftArchives = archives;
  nextState.recoveryHistory = recoveryHistory;
  setActiveWorkspaceState(nextState);
  uiState.recoveryBaselines.clear();
  uiState.recoveryLastSavedAt.clear();
  clearSavedEditorSelection();
  uiState.mobileTagsOpen = false;
  uiState.drawerOpen = false;
  uiState.wardOptionsOpen = false;
  uiState.bedAction = null;
  saveState();
  render();
}

function rememberRecoveryBaseline(note) {
  if (!note?.id || uiState.recoveryBaselines.has(note.id)) return;
  uiState.recoveryBaselines.set(note.id, {
    html: String(note.documentHtml || ""),
    updatedAt: Number(note.updatedAt || 0)
  });
}

function captureAutomaticRecoverySnapshot() {
  if (authState.suppressCloudSave) return;
  const note = getCurrentNote();
  const ward = getCurrentWard();
  if (!note || !ward) return;
  const currentHtml = String(note.documentHtml || "");
  const baseline = uiState.recoveryBaselines.get(note.id);
  if (!baseline) {
    rememberRecoveryBaseline(note);
    return;
  }
  if (baseline.html === currentHtml) return;

  const now = Date.now();
  const lastSavedAt = Number(uiState.recoveryLastSavedAt.get(note.id) || 0);
  if (now - lastSavedAt >= RECOVERY_SNAPSHOT_INTERVAL_MS && hasMeaningfulNoteHtml(baseline.html)) {
    addRecoverySnapshot({ note, ward, documentHtml: baseline.html, reason: "Auto recovery", createdAt: now });
    uiState.recoveryLastSavedAt.set(note.id, now);
  }
  uiState.recoveryBaselines.set(note.id, { html: currentHtml, updatedAt: Number(note.updatedAt || now) });
}

function hasMeaningfulNoteHtml(html) {
  return String(html || "").replace(/<br\s*\/?\s*>/gi, "").replace(/<[^>]+>/g, "").trim().length > 0;
}

function syncEditorEmptyState(editor) {
  if (!editor) return;
  editor.classList.toggle("is-empty-document", !hasMeaningfulNoteHtml(editor.innerHTML));
}

function hasMeaningfulWorkspaceData(workspace) {
  if (!workspace || !Array.isArray(workspace.wards)) return false;
  if (workspace.wards.length > 1) return true;
  return workspace.wards.some((ward) =>
    Array.isArray(ward.notes) && ward.notes.some((note) =>
      hasMeaningfulNoteHtml(note.documentHtml) || (Array.isArray(note.entries) && note.entries.length > 0)
    )
  );
}

function isSuspiciouslyBlankAppState(targetAppState) {
  const workspaces = targetAppState?.workspaces;
  return Boolean(
    workspaces &&
    !hasMeaningfulWorkspaceData(workspaces.shift) &&
    !hasMeaningfulWorkspaceData(workspaces.day)
  );
}

function hasRecoverableCloudData(remoteInput) {
  if (remoteInput?.workspaces) {
    return hasMeaningfulWorkspaceData(remoteInput.workspaces.shift) || hasMeaningfulWorkspaceData(remoteInput.workspaces.day);
  }
  return hasMeaningfulWorkspaceData(remoteInput);
}

function addRecoverySnapshot({ note, ward, documentHtml, reason, createdAt = Date.now() }) {
  if (!note || !ward || !hasMeaningfulNoteHtml(documentHtml)) return;
  const html = String(documentHtml).slice(0, RECOVERY_SNAPSHOT_MAX_HTML);
  if (state.recoveryHistory.some((entry) => entry.noteId === note.id && entry.documentHtml === html)) return;
  state.recoveryHistory.unshift({
    id: createId("recovery"),
    createdAt,
    reason: reason || "Recovery version",
    wardId: ward.id,
    wardName: ward.name,
    wardColor: ward.color,
    noteId: note.id,
    noteTitle: note.title,
    noteCreatedAt: note.createdAt,
    documentHtml: html
  });
  state.recoveryHistory = state.recoveryHistory.slice(0, RECOVERY_HISTORY_LIMIT);
}

function createShiftArchive(label) {
  const archive = {
    id: createId("archive"),
    createdAt: Date.now(),
    label,
    activeView: state.activeView,
    selectedWardId: state.selectedWardId,
    selectedNoteId: state.selectedNoteId,
    timelineScope: state.timelineScope,
    summaryTab: state.summaryTab,
    preferences: cloneJson(state.preferences),
    wards: cloneJson(state.wards)
  };
  return [archive, ...(state.shiftArchives || [])].slice(0, SHIFT_ARCHIVE_LIMIT);
}

function restoreRecoverySnapshot(historyId) {
  const snapshot = state.recoveryHistory.find((entry) => entry.id === historyId);
  if (!snapshot || !window.confirm(`Restore the ${formatHistoryTimestamp(snapshot.createdAt)} version?`)) return;
  let ward = state.wards.find((entry) => entry.id === snapshot.wardId);
  if (!ward) {
    ward = createWard(snapshot.wardName || "Recovered ward", snapshot.wardColor || WARD_COLORS[state.wards.length % WARD_COLORS.length]);
    ward.id = snapshot.wardId || ward.id;
    state.wards.push(ward);
  }
  let note = ward.notes.find((entry) => entry.id === snapshot.noteId);
  if (!note) {
    note = createNote(snapshot.noteTitle || `${ward.name} recovered`, "");
    note.id = snapshot.noteId || note.id;
    note.createdAt = snapshot.noteCreatedAt || note.createdAt;
    ward.notes.push(note);
  } else {
    addRecoverySnapshot({ note, ward, documentHtml: note.documentHtml, reason: "Before restore" });
  }
  setNoteDocumentHtml(note, snapshot.documentHtml);
  state.selectedWardId = ward.id;
  state.selectedNoteId = note.id;
  state.activeView = "notes";
  uiState.recoveryBaselines.set(note.id, { html: note.documentHtml, updatedAt: note.updatedAt });
  saveState({ skipRecovery: true });
  closeDrawersWithAnimation();
  render();
}

function restoreShiftArchive(historyId) {
  const archive = state.shiftArchives.find((entry) => entry.id === historyId);
  if (!archive || !window.confirm(`Restore “${archive.label}”? The current shift will also be archived.`)) return;
  const preservedArchives = createShiftArchive(`Before restoring ${archive.label}`);
  const preservedRecovery = state.recoveryHistory;
  const restored = normalizeWorkspaceState({ ...cloneJson(archive), recoveryHistory: preservedRecovery, shiftArchives: preservedArchives }, { blankFallback: true });
  setActiveWorkspaceState(restored);
  uiState.recoveryBaselines.clear();
  uiState.recoveryLastSavedAt.clear();
  saveState({ skipRecovery: true });
  closeDrawersWithAnimation();
  render();
}

function deleteShiftArchive(historyId) {
  const archive = state.shiftArchives.find((entry) => entry.id === historyId);
  if (!archive || !window.confirm(`Delete “${archive.label}” from the archive?`)) return;
  state.shiftArchives = state.shiftArchives.filter((entry) => entry.id !== historyId);
  saveState({ skipRecovery: true });
  renderDrawer();
}

function addWard() {
  const ward = createWard(getNextWardName(), WARD_COLORS[state.wards.length % WARD_COLORS.length]);
  ward.notes.push(createNote(`${ward.name} handover`, "New patient list"));

  state.wards.push(ward);
  state.selectedWardId = ward.id;
  state.selectedNoteId = ward.notes[0].id;
  state.preferences.singleWardMode = false;
  uiState.editingWardId = ward.id;
  saveState();
  render();
}

function selectWardScope(scope) {
  if (scope !== "all") return;
  state.timelineScope = "all";
  state.activeView = "timeline";
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  uiState.editingWardId = "";
  saveState();
  render();
}

function selectWardFromDrawer(wardId) {
  const ward = state.wards.find((item) => item.id === wardId);
  if (!ward) return;
  state.selectedWardId = ward.id;
  state.selectedNoteId = ward.notes[0]?.id || "";
  state.timelineScope = "active";
  uiState.editingWardId = "";
  saveState();
  render();
}

function toggleSummaryScopeFromTimeline() {
  state.timelineScope = state.timelineScope === "active" ? "all" : "active";
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  saveState();
  renderTimeline();
  renderDrawer();
}

function switchWardFromEditor(direction) {
  if (!shouldShowWardSwitcher()) return;
  const currentIndex = state.wards.findIndex((ward) => ward.id === state.selectedWardId);
  if (currentIndex < 0) return;

  const offset = direction === "previous" ? -1 : 1;
  const nextIndex = (currentIndex + offset + state.wards.length) % state.wards.length;
  const ward = state.wards[nextIndex];
  if (!ward) return;

  if (!ward.notes.length) {
    ward.notes.push(createNote(`${ward.name} handover`, ""));
  }

  state.selectedWardId = ward.id;
  state.selectedNoteId = ward.notes[0]?.id || "";
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  uiState.editingWardId = "";
  saveState();
  render();
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: window.scrollX, behavior: "auto" });
  });
}

function editWardNameFromDrawer(wardId) {
  const ward = state.wards.find((item) => item.id === wardId);
  if (!ward) return;
  if (uiState.editingWardId === wardId) {
    const input = refs.drawerRoot?.querySelector(`[data-ward-name-input="${cssEscape(wardId)}"]`);
    renameWardFromDrawer(wardId, input?.value ?? ward.name);
    return;
  }
  uiState.wardNameCompositionActive = false;
  uiState.editingWardId = wardId;
  appendEditorDebugLog({
    action: "ward-name-edit-start",
    source: "ward-edit-button",
    success: true,
    handledBy: "editWardNameFromDrawer",
    targetWardId: ward.id,
    targetWardName: ward.name
  });
  renderDrawer();
}

function renameWardFromDrawer(wardId, value) {
  const ward = state.wards.find((item) => item.id === wardId);
  const nextName = String(value || "").trim();
  if (!ward) return;
  const previousName = ward.name;
  uiState.editingWardId = "";
  uiState.wardNameCompositionActive = false;
  appendEditorDebugLog({
    action: "ward-name-edit-commit",
    source: "ward-name-input",
    success: Boolean(nextName),
    handledBy: "renameWardFromDrawer",
    targetWardId: ward.id,
    previousWardName: previousName,
    nextWardName: nextName,
    changed: Boolean(nextName && previousName !== nextName)
  });
  if (!nextName) {
    render();
    return;
  }
  if (ward.name === nextName) {
    renderDrawer();
    return;
  }

  ward.name = nextName;
  ward.updatedAt = Date.now();
  ward.notes.forEach((note) => {
    if (!note.title || /^Ward\s+\w+\s+handover/i.test(note.title)) {
      note.title = `${nextName} handover`;
    }
  });
  saveState();
  render();
}

function deleteWardFromDrawer(wardId) {
  const wardIndex = state.wards.findIndex((ward) => ward.id === wardId);
  if (wardIndex < 0) return;
  if (state.wards.length <= 1) {
    window.alert("Keep at least one ward in ShiftPad.");
    return;
  }

  const ward = state.wards[wardIndex];
  if (!window.confirm(`Delete ${ward.name}? Notes in this ward will be removed from this account.`)) return;

  ward.notes.forEach((note) => {
    addRecoverySnapshot({ note, ward, documentHtml: note.documentHtml, reason: "Before ward deletion" });
  });

  const deletedSelectedWard = state.selectedWardId === ward.id;
  state.wards.splice(wardIndex, 1);

  if (deletedSelectedWard) {
    const nextWard = state.wards[Math.min(wardIndex, state.wards.length - 1)] || state.wards[0];
    state.selectedWardId = nextWard.id;
    state.selectedNoteId = nextWard.notes[0]?.id || "";
    if (state.timelineScope === "active") {
      state.activeView = "notes";
    }
  }

  ensureSelection();
  saveState({ skipRecovery: true });
  render();
}

function handleWardDragPointerDown(event) {
  const handle = event.target.closest?.("[data-ward-drag-handle]");
  if (!handle || handle.disabled || state.wards.length <= 1) return;
  if (event.button !== undefined && event.button !== 0) return;

  const row = handle.closest("[data-ward-row]");
  const list = row?.closest("[data-ward-sort-list]");
  const wardId = handle.dataset.wardDragHandle;
  if (!row || !list || !wardId) return;

  event.preventDefault();
  clearWardDragState();
  safelySetPointerCapture(handle, event.pointerId);

  const delay = event.pointerType === "mouse" ? 120 : 260;
  uiState.wardDrag = {
    wardId,
    pointerId: event.pointerId,
    startY: event.clientY,
    currentY: event.clientY,
    targetIndex: state.wards.findIndex((ward) => ward.id === wardId),
    row,
    list,
    handle,
    dragging: false,
    timer: window.setTimeout(() => beginWardDrag(), delay)
  };
}

function handleWardDragPointerMove(event) {
  const drag = uiState.wardDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;

  drag.currentY = event.clientY;
  const moved = Math.abs(drag.currentY - drag.startY);
  if (!drag.dragging && event.pointerType === "mouse" && moved > 6) {
    beginWardDrag();
  }

  if (!drag.dragging) return;
  event.preventDefault();
  updateWardDragPosition(event.clientY);
}

function handleWardDragPointerUp(event) {
  const drag = uiState.wardDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  if (drag.dragging) {
    event.preventDefault();
  }
  finishWardDrag(true);
}

function handleWardDragPointerCancel(event) {
  const drag = uiState.wardDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  finishWardDrag(false);
}

function beginWardDrag() {
  const drag = uiState.wardDrag;
  if (!drag || drag.dragging || !document.contains(drag.row)) return;
  window.clearTimeout(drag.timer);
  drag.dragging = true;
  drag.row.classList.add("is-dragging");
  drag.list.classList.add("is-sorting");
  drag.handle.classList.add("is-grabbing");
  updateWardDragPosition(drag.currentY);
}

function updateWardDragPosition(clientY) {
  const drag = uiState.wardDrag;
  if (!drag || !drag.dragging) return;

  drag.row.style.transform = `translateY(${Math.round(clientY - drag.startY)}px)`;
  drag.targetIndex = getWardDropIndex(drag.list, drag.row, clientY);
  updateWardDropIndicator(drag.list, drag.row, drag.targetIndex);
}

function getWardDropIndex(list, draggedRow, clientY) {
  const rows = getSortableWardRows(list).filter((row) => row !== draggedRow);
  let targetIndex = rows.length;

  rows.some((row, index) => {
    const rect = row.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      targetIndex = index;
      return true;
    }
    return false;
  });

  return targetIndex;
}

function updateWardDropIndicator(list, draggedRow, targetIndex) {
  const rows = getSortableWardRows(list).filter((row) => row !== draggedRow);
  rows.forEach((row) => row.classList.remove("is-drop-before", "is-drop-after"));

  if (!rows.length) return;
  if (targetIndex >= rows.length) {
    rows[rows.length - 1].classList.add("is-drop-after");
    return;
  }

  rows[targetIndex].classList.add("is-drop-before");
}

function getSortableWardRows(list) {
  return Array.from(list?.querySelectorAll?.("[data-ward-row]") || []);
}

function finishWardDrag(commit) {
  const drag = uiState.wardDrag;
  if (!drag) return;

  const wasDragging = drag.dragging;
  const targetIndex = drag.targetIndex;
  window.clearTimeout(drag.timer);
  safelyReleasePointerCapture(drag.handle, drag.pointerId);
  drag.row.classList.remove("is-dragging");
  drag.handle.classList.remove("is-grabbing");
  drag.row.style.transform = "";
  drag.list.classList.remove("is-sorting");
  getSortableWardRows(drag.list).forEach((row) => row.classList.remove("is-drop-before", "is-drop-after"));
  uiState.wardDrag = null;

  if (!wasDragging) return;
  uiState.suppressWardHandleClick = true;
  window.setTimeout(() => {
    uiState.suppressWardHandleClick = false;
  }, 0);

  if (commit) {
    reorderWardFromDrawer(drag.wardId, targetIndex);
  }
}

function clearWardDragState() {
  const drag = uiState.wardDrag;
  if (!drag) return;
  finishWardDrag(false);
}

function safelySetPointerCapture(element, pointerId) {
  try {
    element?.setPointerCapture?.(pointerId);
  } catch {
    // Pointer capture can fail if the browser already ended the gesture.
  }
}

function safelyReleasePointerCapture(element, pointerId) {
  try {
    element?.releasePointerCapture?.(pointerId);
  } catch {
    // Some browsers release capture automatically before pointerup.
  }
}

function reorderWardFromDrawer(wardId, targetIndex) {
  const sourceIndex = state.wards.findIndex((ward) => ward.id === wardId);
  if (sourceIndex < 0) return;

  const [ward] = state.wards.splice(sourceIndex, 1);
  const boundedIndex = Math.max(0, Math.min(Number(targetIndex) || 0, state.wards.length));
  state.wards.splice(boundedIndex, 0, ward);
  uiState.editingWardId = "";
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
  const id = createCustomTagId(label);
  const color = getNextCustomTagColor(preferences.customTags, `${id}:${label}`);
  preferences.customTags.push({
    id,
    label,
    hasReminder: formData.get("hasReminder") === "on",
    delayMinutes: Math.max(0, clampDelay(formData.get("delayMinutes"), 0)),
    color
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
  if (entry.reminderType === "todo") return entry.text || "";
  return entry.text || entry.visibleText || "";
}

function getScopedWards(scope) {
  return scope === "active" ? state.wards.filter((ward) => ward.id === state.selectedWardId) : state.wards;
}

function buildSummaryGroups(scope) {
  const wards = getScopedWards(scope);
  const timed = [];
  const todo = [];
  const bedMap = new Map();

  wards.forEach((ward) => {
    ward.notes.forEach((note) => {
      const parsed = getCachedTaggedLines(note);
      parsed.lines.forEach((line) => {
        const reminderItemsForLine = getReminderItemsForLine(line);
        const reminderDone = reminderItemsForLine.length
          ? reminderItemsForLine.every((reminder) => reminder.done)
          : Boolean(line.done);
        const item = {
          ward,
          note,
          lineIndex: line.lineIndex,
          sourceLineIndex: line.sourceLineIndex,
          lineId: line.lineId || "",
          tokenId: line.reminderTokenId || line.primaryTokenId || "",
          entry: {
            done: line.done,
            timeTag: line.timeTag,
            text: line.text,
            visibleText: line.visibleText,
            bedSummaryText: formatBedSummaryLine(line),
            todoTokenId: line.todoTokenId,
            todoDone: line.todoDone,
            reminderDone,
            timeAtStart: line.timeAtStart,
            summaryText: formatTimedSummaryLine(line),
            bedTag: line.bedLabel,
            kind: line.primaryKind,
            primaryTagText: line.primaryTagText,
            reminderType: line.reminderType
          }
        };

        if (line.todoTokenId) {
          todo.push({
            ...item,
            tokenId: line.todoTokenId,
            entry: {
              ...item.entry,
              done: line.todoDone,
              reminderType: "todo",
              reminderTime: ""
            }
          });
        }

        reminderItemsForLine.forEach((reminder) => {
          timed.push({
            ...item,
            reminderKey: reminder.key,
            tokenId: item.tokenId,
            entry: {
              ...item.entry,
              done: reminder.done,
              reminderTime: reminder.time
            }
          });
        });

        if (line.bedLabel) {
          const group = ensureBedSummaryGroup(bedMap, ward, line.bedLabel);
          if (!line.bedHeaderOnly) {
            group.count += 1;
            if (reminderItemsForLine.length) {
              group.latestTime = reminderItemsForLine[reminderItemsForLine.length - 1].time;
            }
            group.items.push(item);
            group.combinedText = group.items
              .map((entryItem) => entryItem.entry.bedSummaryText || entryItem.entry.visibleText || entryItem.entry.text)
              .filter(Boolean)
              .join("\n");
          }
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
  todo.sort((left, right) => {
    if (left.entry.done !== right.entry.done) {
      return Number(left.entry.done) - Number(right.entry.done);
    }
    return Number(left.note.createdAt || 0) - Number(right.note.createdAt || 0) || left.lineIndex - right.lineIndex;
  });

  return {
    timed,
    todo,
    byBed: Array.from(bedMap.values())
  };
}

function ensureBedSummaryGroup(bedMap, ward, bedLabel) {
  const normalizedBed = String(bedLabel || "").toUpperCase();
  const bedKey = `${ward.id}:${normalizedBed}`;
  if (!bedMap.has(bedKey)) {
    bedMap.set(bedKey, {
      key: bedKey,
      label: `${ward.name} · Bed ${normalizedBed}`,
      count: 0,
      latestTime: "",
      items: [],
      combinedText: ""
    });
  }
  return bedMap.get(bedKey);
}

function formatBedSummaryLine(line) {
  const labels = [];
  if (line.todoTokenId) {
    labels.push(line.todoDone ? "✓" : "○");
  }
  if (line.reminderType) {
    const tagLabel = getReminderTypeLabel(line.reminderType);
    if (line.reminderType === "time" || line.reminderType === "lab") {
      labels.push([tagLabel, line.timeTag].filter(Boolean).join(" "));
    } else {
      labels.push(tagLabel);
    }
  }
  if (line.primaryKind && line.primaryKind !== "general") {
    labels.push(
      line.primaryKind === "hn"
        ? String(line.primaryTagText || "").trim() || "HN"
        : getKindMeta(line.primaryKind)?.label || line.primaryKind
    );
  }

  const prefix = labels.filter(Boolean).join(" · ");
  return [prefix, line.text].filter(Boolean).join(" ");
}

function countBedsForWard(ward) {
  const beds = new Set();
  ward.notes.forEach((note) => {
    const parsed = getCachedTaggedLines(note);
    parsed.lines.forEach((line) => {
      if (line.bedLabel) {
        beds.add(line.bedLabel.toUpperCase());
      }
    });
  });
  return beds.size;
}

function countOpenRemindersForWard(ward) {
  let count = 0;
  ward.notes.forEach((note) => {
    const parsed = getCachedTaggedLines(note);
    parsed.lines.forEach((line) => {
      count += getReminderItemsForLine(line).filter((reminder) => !reminder.done).length;
    });
  });
  return count;
}

function getCachedTaggedLines(note) {
  if (!note?.id) return extractTaggedLines(note);
  const html = getNoteDocumentHtml(note);
  const signature = `${Number(note.updatedAt || 0)}:${html.length}`;
  const cached = noteParseCache.get(note.id);
  if (cached?.signature === signature && cached.html === html) {
    return cached.value;
  }
  const value = extractTaggedLines(note);
  noteParseCache.delete(note.id);
  noteParseCache.set(note.id, { signature, html, value });
  while (noteParseCache.size > NOTE_PARSE_CACHE_LIMIT) {
    noteParseCache.delete(noteParseCache.keys().next().value);
  }
  return value;
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
    updatedAt: Date.now(),
    notes: []
  };
}

function createNote(title, patientFocus) {
  const now = Date.now();
  const id = createId("note");
  const lineId = createId("line");
  return {
    id,
    title,
    patientFocus,
    shiftLabel: getShiftLabel(now),
    summary: "",
    createdAt: now,
    updatedAt: now,
    entries: [],
    documentHtml: `<div data-line-id="${escapeAttribute(lineId)}"><br></div>`,
    documentModel: {
      version: NOTE_DOCUMENT_MODEL_VERSION,
      updatedAt: now,
      lines: [{ id: lineId, block: "div", html: "<br>", text: "", tags: [] }]
    }
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
    recoveryHistory: [],
    shiftArchives: [],
    wards: [ward]
  };
}

function createBlankAppState() {
  return {
    version: 3,
    activeWorkspace: "shift",
    workspaces: {
      shift: createBlankState(),
      day: createBlankState()
    }
  };
}

function loadAppState() {
  return normalizeAppState(loadAnonymousLocalState() || loadLegacyLocalState() || createBlankAppState());
}

function applyUrlOverrides() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  const requestedWorkspace = params.get("workspace");

  if (WORKSPACE_KEYS.includes(requestedWorkspace)) {
    appState.activeWorkspace = requestedWorkspace;
    state = getActiveWorkspaceState(appState);
  }

  if (requestedView === "notes" || requestedView === "timeline") {
    state.activeView = requestedView;
  }
}

function normalizeAppState(input) {
  if (input?.workspaces && typeof input.workspaces === "object") {
    return {
      version: 3,
      activeWorkspace: WORKSPACE_KEYS.includes(input.activeWorkspace) ? input.activeWorkspace : "shift",
      workspaces: {
        shift: normalizeWorkspaceState(input.workspaces.shift, { blankFallback: true }),
        day: normalizeWorkspaceState(input.workspaces.day, { blankFallback: true })
      }
    };
  }

  if (input && typeof input === "object" && Array.isArray(input.wards) && input.wards.length) {
    return {
      version: 3,
      activeWorkspace: "shift",
      workspaces: {
        shift: normalizeWorkspaceState(input),
        day: createBlankState()
      }
    };
  }

  return createBlankAppState();
}

function normalizeWorkspaceState(input, { blankFallback = false } = {}) {
  if (!input || typeof input !== "object" || !Array.isArray(input.wards) || !input.wards.length) {
    return createBlankState();
  }

  const wards = input.wards.map((ward, index) => {
    const notes = Array.isArray(ward.notes)
      ? ward.notes.map((note) => {
          const entries = Array.isArray(note.entries)
            ? note.entries.map((entry) => ({
                id: entry.id || createId("entry"),
                bedTag: typeof entry.bedTag === "string" ? entry.bedTag : "",
                timeTag: typeof entry.timeTag === "string" ? entry.timeTag : "",
                kind: getKindMeta(entry.kind) ? entry.kind : "general",
                text: typeof entry.text === "string" ? entry.text : "",
                done: Boolean(entry.done),
                createdAt: Number(entry.createdAt) || Date.now()
              }))
            : [];
          return {
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
                : convertEntriesToDocumentHtml(entries),
            documentModel: normalizeStoredDocumentModel(note.documentModel),
            entries
          };
        })
      : [];

    return {
      id: ward.id || createId("ward"),
      name: typeof ward.name === "string" && ward.name.trim() ? ward.name : `Ward ${index + 1}`,
      color: typeof ward.color === "string" && ward.color ? ward.color : WARD_COLORS[index % WARD_COLORS.length],
      updatedAt: Number(ward.updatedAt) || 0,
      notes
    };
  }).filter((ward) => !isBuiltInDemoWard(ward));

  if (!wards.length) {
    const blank = createBlankState();
    return {
      ...blank,
      preferences: normalizePreferences(input.preferences),
      recoveryHistory: normalizeRecoveryHistory(input.recoveryHistory),
      shiftArchives: normalizeShiftArchives(input.shiftArchives)
    };
  }

  const selectedWard = wards.find((ward) => ward.id === input.selectedWardId) || wards[0];
  const selectedNote = selectedWard.notes.find((note) => note.id === input.selectedNoteId) || selectedWard.notes[0];

  return {
    activeView: input.activeView === "timeline" ? "timeline" : "notes",
    selectedWardId: selectedWard.id,
    selectedNoteId: selectedNote?.id || "",
    timelineScope: input.timelineScope === "active" ? "active" : "all",
    summaryTab: SUMMARY_TABS.includes(input.summaryTab) ? input.summaryTab : "reminders",
    preferences: normalizePreferences(input.preferences),
    recoveryHistory: normalizeRecoveryHistory(input.recoveryHistory),
    shiftArchives: normalizeShiftArchives(input.shiftArchives),
    wards
  };
}

function isBuiltInDemoWard(ward) {
  return ward.notes.some((note) => {
    const searchable = `${note.title}\n${note.summary}\n${note.documentHtml}\n${note.entries.map((entry) => entry.text).join("\n")}`;
    return (
      (note.title === "Respiratory handover" && searchable.includes("CBC and magnesium sent. Chase result before consultant round.")) ||
      (note.title === "Overflow bay" && searchable.includes("Restart anticoagulation only after GI team clears."))
    );
  });
}

function normalizeRecoveryHistory(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((entry) => entry && typeof entry.documentHtml === "string")
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : createId("recovery"),
      createdAt: Number(entry.createdAt) || Date.now(),
      reason: typeof entry.reason === "string" ? entry.reason.slice(0, 60) : "Auto recovery",
      wardId: typeof entry.wardId === "string" ? entry.wardId : "",
      wardName: typeof entry.wardName === "string" ? entry.wardName.slice(0, 80) : "",
      wardColor: typeof entry.wardColor === "string" ? entry.wardColor : "",
      noteId: typeof entry.noteId === "string" ? entry.noteId : "",
      noteTitle: typeof entry.noteTitle === "string" ? entry.noteTitle.slice(0, 120) : "",
      noteCreatedAt: Number(entry.noteCreatedAt) || Date.now(),
      documentHtml: entry.documentHtml.slice(0, RECOVERY_SNAPSHOT_MAX_HTML)
    }))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, RECOVERY_HISTORY_LIMIT);
}

function normalizeShiftArchives(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((entry) => entry && Array.isArray(entry.wards) && entry.wards.length)
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : createId("archive"),
      createdAt: Number(entry.createdAt) || Date.now(),
      label: typeof entry.label === "string" ? entry.label.slice(0, 100) : "Archived shift",
      activeView: entry.activeView === "timeline" ? "timeline" : "notes",
      selectedWardId: typeof entry.selectedWardId === "string" ? entry.selectedWardId : "",
      selectedNoteId: typeof entry.selectedNoteId === "string" ? entry.selectedNoteId : "",
      timelineScope: entry.timelineScope === "active" ? "active" : "all",
      summaryTab: SUMMARY_TABS.includes(entry.summaryTab) ? entry.summaryTab : "reminders",
      preferences: normalizePreferences(entry.preferences),
      wards: entry.wards
    }))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, SHIFT_ARCHIVE_LIMIT);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getActiveWorkspaceKey(targetAppState = appState) {
  return WORKSPACE_KEYS.includes(targetAppState?.activeWorkspace) ? targetAppState.activeWorkspace : "shift";
}

function getActiveWorkspaceState(targetAppState = appState) {
  const key = getActiveWorkspaceKey(targetAppState);
  if (!targetAppState.workspaces?.[key]) {
    targetAppState.workspaces ||= {};
    targetAppState.workspaces[key] = createBlankState();
  }
  return targetAppState.workspaces[key];
}

function setActiveWorkspaceState(nextState) {
  const key = getActiveWorkspaceKey();
  appState.workspaces[key] = normalizeWorkspaceState(nextState, { blankFallback: true });
  state = appState.workspaces[key];
}

function getActiveWorkspaceMeta() {
  return WORKSPACE_META[getActiveWorkspaceKey()] || WORKSPACE_META.shift;
}

function renderWorkspaceIdentity() {
  const currentKey = getActiveWorkspaceKey();
  const current = WORKSPACE_META[currentKey];
  const nextKey = currentKey === "shift" ? "day" : "shift";
  const next = WORKSPACE_META[nextKey];
  document.body.dataset.workspace = currentKey;
  document.title = `${current.title} - Ward Notes`;
  if (refs.workspaceTitle) refs.workspaceTitle.textContent = current.title;
  refs.workspaceHeading?.setAttribute("aria-label", current.title);
  if (refs.workspaceEyebrow) refs.workspaceEyebrow.textContent = current.eyebrow;
  if (refs.workspaceTagline) refs.workspaceTagline.textContent = current.tagline;
  refs.workspaceSwitcher?.setAttribute("aria-label", `Switch to ${next.title}`);
  refs.workspaceSwitcher?.setAttribute("title", `Switch to ${next.title}`);
}

function switchWorkspace(targetKey = "") {
  const currentKey = getActiveWorkspaceKey();
  const nextKey = WORKSPACE_KEYS.includes(targetKey) ? targetKey : currentKey === "shift" ? "day" : "shift";
  if (nextKey === currentKey) return;

  syncEditorDocument();
  appState.activeWorkspace = nextKey;
  state = getActiveWorkspaceState(appState);
  updateWorkspaceUrl(nextKey);
  ensureSelection();
  resetEditorUiForWorkspaceSwitch();
  saveState();
  render();
  refs.workspaceSwitcher?.classList.add("is-switching");
  window.setTimeout(() => refs.workspaceSwitcher?.classList.remove("is-switching"), 220);
}

function resetEditorUiForWorkspaceSwitch() {
  window.clearTimeout(uiState.bedFinalizeTimer);
  window.clearTimeout(uiState.bedIndexTimer);
  window.clearTimeout(uiState.bedIndexClickSuppressTimer);
  window.cancelAnimationFrame(uiState.bedIndexScrub?.scrollFrame || 0);
  clearSavedEditorSelection();
  uiState.editorFocused = false;
  uiState.mobileTagsOpen = false;
  uiState.bedIndexVisible = false;
  uiState.bedIndexTimer = null;
  window.cancelAnimationFrame(uiState.bedIndexScrollRaf);
  uiState.bedIndexScrollRaf = 0;
  uiState.bedIndexScrub = null;
  uiState.suppressNextBedIndexClick = false;
  uiState.bedIndexClickSuppressTimer = null;
  uiState.bedFinalizeTimer = null;
  uiState.editingWardId = "";
  uiState.bedAction = null;
  uiState.editorTapScroll = null;
  cancelShortNoteScrollSettle();
  uiState.shortNoteScrollGesture = null;
  uiState.shortNoteScrollSuppressUntil = 0;
  uiState.suppressNextDeleteInput = false;
  uiState.suppressNextParagraphInput = false;
  uiState.pendingTagInsertions.clear();
  uiState.lastInsertedTagTokenId = "";
  uiState.pendingEditorInputDebug = null;
  uiState.pendingEditorTapDebug = null;
  uiState.restoreSelectionAfterScreenSwitch = false;
  uiState.restoreEditorFocusAfterScreenSwitch = false;
}

function updateWorkspaceUrl(workspaceKey) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", workspaceKey);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // The workspace switch still works when history APIs are unavailable.
  }
}

function saveState({ skipCloud = false, markDirty = true, skipRecovery = false } = {}) {
  if (!skipRecovery) {
    captureAutomaticRecoverySnapshot();
  }
  if (markDirty && !authState.suppressCloudSave) {
    authState.lastLocalMutationAt = Date.now();
  }
  scheduleLocalStateSave();
  if (!skipCloud) {
    scheduleCloudSave();
  }
}

function scheduleLocalStateSave() {
  window.clearTimeout(authState.localSaveTimer);
  authState.localSaveTimer = window.setTimeout(() => {
    authState.localSaveTimer = null;
    saveLocalState();
  }, LOCAL_SAVE_DEBOUNCE_MS);
}

function flushLocalStateSave() {
  if (authState.localSaveTimer) {
    window.clearTimeout(authState.localSaveTimer);
    authState.localSaveTimer = null;
  }
  saveLocalState();
}

function saveLocalState() {
  try {
    const userId = authState.user?.id || "";
    const key = getScopedStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(appState));
    if (userId) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(appState));
    }
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

function loadAnonymousLocalState() {
  try {
    const raw = localStorage.getItem(getScopedStorageKey(""));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getScopedStorageKey(userId) {
  return `${STORAGE_NAMESPACE}:${userId || "anon"}`;
}

function getEditorDebugLogKey() {
  return `${EDITOR_DEBUG_NAMESPACE}:logs:${authState.user?.id || "anon"}`;
}

function getEditorDebugLogKeyForUser(userId) {
  return `${EDITOR_DEBUG_NAMESPACE}:logs:${userId || "anon"}`;
}

function isEditorDebugLoggingEnabled() {
  try {
    return localStorage.getItem(EDITOR_DEBUG_ENABLED_KEY) !== "false";
  } catch {
    return false;
  }
}

function setEditorDebugLoggingEnabled(enabled) {
  try {
    localStorage.setItem(EDITOR_DEBUG_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    return;
  }

  if (enabled) {
    appendEditorDebugLog({
      action: "debug-logging",
      source: "settings",
      success: true,
      handledBy: "setEditorDebugLoggingEnabled",
      before: null,
      after: captureEditorDebugSnapshot(refs.editorRoot?.querySelector("#notepad-editor"))
    });
    queueEditorDebugCloudUpload();
  }
}

function getEditorDebugLogs() {
  try {
    const raw = localStorage.getItem(getEditorDebugLogKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getEditorDebugLogsFromKey(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setEditorDebugLogs(logs) {
  let nextLogs = logs.slice(-EDITOR_DEBUG_LIMIT);
  try {
    localStorage.setItem(getEditorDebugLogKey(), JSON.stringify(nextLogs));
    return;
  } catch {
    // Verbose note snapshots can get large. Keep the newest logs if storage fills up.
  }

  while (nextLogs.length > 1) {
    nextLogs = nextLogs.slice(Math.floor(nextLogs.length / 2));
    try {
      localStorage.setItem(getEditorDebugLogKey(), JSON.stringify(nextLogs));
      return;
    } catch {
      // Try a smaller set below.
    }
  }
}

function migrateAnonymousEditorDebugLogsToUser() {
  if (!authState.user) return;
  const anonKey = getEditorDebugLogKeyForUser("");
  const userKey = getEditorDebugLogKey();
  if (anonKey === userKey) return;

  const anonLogs = getEditorDebugLogsFromKey(anonKey);
  if (!anonLogs.length) return;

  const userLogs = getEditorDebugLogs();
  const seen = new Set(userLogs.map((log) => log.clientLogId || `${log.timestamp || ""}:${log.action || ""}:${log.handledBy || ""}`));
  const mergedLogs = [
    ...userLogs,
    ...anonLogs.filter((log) => {
      const key = log.clientLogId || `${log.timestamp || ""}:${log.action || ""}:${log.handledBy || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  ];

  setEditorDebugLogs(mergedLogs);
  try {
    localStorage.removeItem(anonKey);
  } catch {
    // Ignore localStorage failures.
  }
}

function appendEditorDebugLog(entry) {
  if (!isEditorDebugLoggingEnabled()) return;
  const ward = getCurrentWard();
  const note = getCurrentNote();
  const logs = getEditorDebugLogs();
  const logEntry = {
    clientLogId: entry.clientLogId || createId("debug-log"),
    timestamp: new Date().toISOString(),
    appBuild: APP_BUILD,
    browser: getEditorDebugBrowserLabel(),
    path: window.location.pathname,
    workspace: getActiveWorkspaceKey(),
    workspaceName: getActiveWorkspaceMeta().title,
    activeView: state.activeView,
    summaryTab: state.summaryTab,
    timelineScope: state.timelineScope,
    wardId: ward?.id || "",
    wardName: ward?.name || "",
    noteId: note?.id || "",
    noteTitle: note?.title || "",
    noteShiftLabel: note?.shiftLabel || "",
    noteCreatedAt: note?.createdAt || 0,
    noteUpdatedAt: note?.updatedAt || 0,
    preferences: getPreferences(),
    device: captureDeviceDebugSnapshot(),
    layout: captureLayoutDebugSnapshot(),
    ...entry
  };
  logs.push(logEntry);
  setEditorDebugLogs(logs);
  queueEditorDebugCloudUpload();
}

function appendViewportDebugLog(action, handledBy) {
  if (!isEditorDebugLoggingEnabled()) return;
  const now = Date.now();
  if (now - uiState.lastViewportDebugAt < 1200) return;
  uiState.lastViewportDebugAt = now;
  const editor = refs.editorRoot?.querySelector?.("#notepad-editor");
  appendEditorDebugLog({
    action,
    source: "viewport",
    success: true,
    handledBy,
    before: null,
    after: captureEditorDebugSnapshot(editor)
  });
}

async function clearEditorDebugLogs() {
  try {
    localStorage.removeItem(getEditorDebugLogKey());
  } catch {
    // Ignore localStorage failures.
  }

  if (authState.client && authState.user) {
    const { error } = await authState.client
      .from(EDITOR_DEBUG_CLOUD_TABLE)
      .delete()
      .eq("user_id", authState.user.id);
    uiState.debugLogStatus = error
      ? `Local diagnostics cleared. Cloud clear failed: ${error.message || "Unknown error"}.`
      : "Diagnostic data cleared locally and from the cloud.";
  } else {
    uiState.debugLogStatus = "Diagnostic data cleared locally.";
  }
  renderDrawer();
}

function queueEditorDebugCloudUpload() {
  if (!isEditorDebugLoggingEnabled()) return;
  if (!authState.client || !authState.user) return;
  window.clearTimeout(authState.debugLogUploadTimer);
  authState.debugLogUploadTimer = window.setTimeout(() => {
    authState.debugLogUploadTimer = null;
    uploadPendingEditorDebugLogs().catch((error) => {
      console.error("Debug log web save failed:", error);
      uiState.debugLogStatus = `Debug web save failed: ${error?.message || "Unknown error"}.`;
      renderDrawer();
    });
  }, EDITOR_DEBUG_CLOUD_UPLOAD_DEBOUNCE_MS);
}

function flushPendingEditorDebugLogsForLifecycle(reason) {
  if (!isEditorDebugLoggingEnabled()) return;
  if (!authState.client || !authState.user) return;
  if (!getEditorDebugLogs().some((log) => log.clientLogId && !log.cloudSavedAt)) return;

  window.clearTimeout(authState.debugLogUploadTimer);
  authState.debugLogUploadTimer = null;
  uploadPendingEditorDebugLogs({
    batchLimit: EDITOR_DEBUG_CLOUD_LIFECYCLE_BATCH_LIMIT,
    keepalive: true,
    renderStatus: false
  }).catch((error) => {
    console.error(`Debug log ${reason} web save failed:`, error);
  });
}


async function uploadPendingEditorDebugLogs({ batchLimit = EDITOR_DEBUG_CLOUD_BATCH_LIMIT, keepalive = false, renderStatus = true } = {}) {
  if (!isEditorDebugLoggingEnabled() || !authState.client || !authState.user) return;

  let logs = getEditorDebugLogs();
  let addedClientIds = false;
  logs = logs.map((log) => {
    if (log.clientLogId) return log;
    addedClientIds = true;
    return {
      ...log,
      clientLogId: createId("debug-log")
    };
  });
  if (addedClientIds) {
    setEditorDebugLogs(logs);
  }

  const pendingLogs = logs.filter((log) => log.clientLogId && !log.cloudSavedAt).slice(0, batchLimit);
  if (!pendingLogs.length) return;

  const rows = pendingLogs.map((log) => buildEditorDebugCloudRow(log));
  const error = await upsertEditorDebugCloudRows(rows, { keepalive });

  if (error) {
    const failedAt = new Date().toISOString();
    const failedIds = new Set(pendingLogs.map((log) => log.clientLogId));
    setEditorDebugLogs(
      getEditorDebugLogs().map((log) =>
        failedIds.has(log.clientLogId)
          ? {
              ...log,
              cloudStatus: "error",
              cloudError: error.message || "Upload failed",
              cloudErrorAt: failedAt
            }
          : log
      )
    );
    throw error;
  }

  const savedAt = new Date().toISOString();
  const savedIds = new Set(pendingLogs.map((log) => log.clientLogId));
  setEditorDebugLogs(
    getEditorDebugLogs().map((log) =>
      savedIds.has(log.clientLogId)
        ? {
            ...log,
            cloudStatus: "saved",
            cloudSavedAt: savedAt,
            cloudError: ""
          }
        : log
    )
  );

  uiState.debugLogStatus = `Saved ${pendingLogs.length} debug log${pendingLogs.length === 1 ? "" : "s"} to web.`;
  if (renderStatus) {
    renderDrawer();
  }

  if (getEditorDebugLogs().some((log) => log.clientLogId && !log.cloudSavedAt)) {
    queueEditorDebugCloudUpload();
  }
}

async function upsertEditorDebugCloudRows(rows, { keepalive = false } = {}) {
  if (!keepalive) {
    const { error } = await authState.client
      .from(EDITOR_DEBUG_CLOUD_TABLE)
      .upsert(rows, { onConflict: "user_id,client_log_id" });
    return error || null;
  }

  const config = window.SHIFTPAD_PUBLIC_CONFIG || {};
  const supabaseUrl = String(config.supabaseUrl || "").replace(/\/+$/, "");
  const accessToken = authState.session?.access_token || "";
  if (!supabaseUrl || !config.supabaseAnonKey || !accessToken) {
    const { error } = await authState.client
      .from(EDITOR_DEBUG_CLOUD_TABLE)
      .upsert(rows, { onConflict: "user_id,client_log_id" });
    return error || null;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${EDITOR_DEBUG_CLOUD_TABLE}?on_conflict=user_id,client_log_id`, {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: config.supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (response.ok) return null;

  const message = await response.text().catch(() => "");
  return new Error(message || `Debug log upload failed with HTTP ${response.status}.`);
}

function buildEditorDebugCloudRow(log) {
  return {
    user_id: authState.user.id,
    client_log_id: log.clientLogId,
    logged_at: normalizeDebugLogTimestamp(log.timestamp),
    browser: log.browser || "",
    path: log.path || "",
    ward_id: log.wardId || "",
    ward_name: log.wardName || "",
    note_id: log.noteId || "",
    note_title: log.noteTitle || "",
    action: log.action || "",
    handled_by: log.handledBy || "",
    success: typeof log.success === "boolean" ? log.success : null,
    payload: log
  };
}

function normalizeDebugLogTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function getEditorDebugBrowserLabel() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const browser = /EdgiOS|Edg\//i.test(ua)
    ? "Edge"
    : /CriOS|Chrome/i.test(ua)
      ? "Chrome"
    : /FxiOS/i.test(ua)
      ? "Firefox"
      : /Safari/i.test(ua)
        ? "Safari"
        : "Browser";
  return `${isIos ? "iOS " : ""}${browser}`.trim();
}

function beginEditorDebugAction(editor, details = {}) {
  if (!isEditorDebugLoggingEnabled() || !editor) return null;
  return {
    ...details,
    before: captureEditorDebugSnapshot(editor)
  };
}

function getEditorDebugActionFromBeforeInput(event) {
  const inputType = event.inputType || "";
  if (inputType === "deleteContentBackward") return "backspace";
  if (inputType === "deleteContentForward") return "delete-forward";
  if (inputType === "insertParagraph") return "enter";
  if (inputType === "insertText") {
    const activeToken = getActiveTagToken();
    if (activeToken) return "tag-edit-text";
    const editor = getEditorFromEventTarget(event.target);
    return shouldManuallyInsertTextIntoEmptyLine(editor) ? "insert-empty-line-text" : "insert-text";
  }
  if (inputType.startsWith("insert")) return inputType;
  return "";
}

function getEditorDebugActionFromKey(key) {
  if (key === "Backspace") return "backspace";
  if (key === "Delete") return "delete-forward";
  if (key === "Enter") return "enter";
  if (key === "Escape") return "escape";
  if (key === "Tab") return "tab";
  if (key === " ") {
    const token = getActiveTagToken();
    return token ? "space-on-tag" : "";
  }
  return "";
}

function finishEditorDebugAction(debugEntry, { success, handledBy, editor, extra = {} } = {}) {
  if (!debugEntry) return;
  const after = captureEditorDebugSnapshot(editor);
  appendEditorDebugLog({
    ...debugEntry,
    success: Boolean(success),
    handledBy: handledBy || "",
    after,
    lineCountDelta:
      debugEntry.before && after
        ? Number(after.lineCount || 0) - Number(debugEntry.before.lineCount || 0)
        : 0,
    ...extra
  });
}

function finishEditorDebugHandled(debugEntry, handledBy, editor, extra = {}) {
  finishEditorDebugAction(debugEntry, { success: true, handledBy, editor, extra });
  return true;
}

function finishEditorDebugUnhandled(debugEntry, handledBy, editor, extra = {}) {
  finishEditorDebugAction(debugEntry, { success: false, handledBy, editor, extra });
  return false;
}

function deferEditorInputDebug(debugEntry, handledBy, extra = {}) {
  if (debugEntry) {
    uiState.pendingEditorInputDebug = {
      ...debugEntry,
      deferredHandledBy: handledBy,
      deferredAt: Date.now(),
      deferredExtra: extra
    };
  }
  return false;
}

function finishDeferredEditorInputDebug(editor, event, extra = {}) {
  const pending = uiState.pendingEditorInputDebug;
  if (!pending) return false;
  uiState.pendingEditorInputDebug = null;

  const { deferredHandledBy, deferredAt, deferredExtra, ...debugEntry } = pending;
  finishEditorDebugAction(debugEntry, {
    success: true,
    handledBy: extra.handledBy || deferredHandledBy || "browser-input",
    editor,
    extra: {
      inputType: event?.inputType || "",
      dataLength: event?.data ? String(event.data).length : debugEntry.dataLength || 0,
      deferredMs: Number.isFinite(deferredAt) ? Date.now() - deferredAt : 0,
      ...(deferredExtra || {}),
      ...extra
    }
  });
  return true;
}

function captureEditorDebugSnapshot(editor) {
  if (!editor) return null;
  const lines = getEditorDebugLines(editor);
  const selection = window.getSelection();
  const currentLine = getCurrentEditorLine();
  const currentLineIndex = currentLine ? lines.indexOf(currentLine) : -1;
  const previousLine = currentLine ? getPreviousEditorLine(currentLine) : null;
  const nextLine = currentLine ? getNextEditorLine(currentLine) : null;
  const lineDetails = lines.map((line, index) => captureEditorDebugLine(line, index, currentLine));

  return {
    lineCount: lines.length,
    emptyLineCount: lines.filter((line) => isEditorLineEmpty(line)).length,
    editorText: getEditorDebugReadableText(editor),
    editorTextRaw: editor.textContent || "",
    editorHtml: editor.innerHTML,
    currentLineIndex,
    currentLineEmpty: currentLine ? isEditorLineEmpty(currentLine) : null,
    previousLineEmpty: previousLine ? isEditorLineEmpty(previousLine) : null,
    nextLineEmpty: nextLine ? isEditorLineEmpty(nextLine) : null,
    currentLineHasTag: currentLine ? lineHasTag(currentLine) : null,
    previousLineHasTag: previousLine ? lineHasTag(previousLine) : null,
    nextLineHasTag: nextLine ? lineHasTag(nextLine) : null,
    layout: captureLayoutDebugSnapshot(),
    currentLine: currentLine ? captureEditorDebugLine(currentLine, currentLineIndex, currentLine) : null,
    previousLine: previousLine ? captureEditorDebugLine(previousLine, lines.indexOf(previousLine), currentLine) : null,
    nextLine: nextLine ? captureEditorDebugLine(nextLine, lines.indexOf(nextLine), currentLine) : null,
    lines: lineDetails,
    selection: getEditorDebugSelection(editor, selection)
  };
}

function captureNoteDebugSnapshot(note) {
  if (!note) return null;
  const root = parseHtmlRoot(getNoteDocumentHtml(note));
  normalizeEditorBlocks(root);
  const lines = [];
  Array.from(root.childNodes).forEach((node, sourceLineIndex) => {
    if (!(node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName))) return;
    const parsed = parseLineNode(node);
    lines.push({
      sourceLineIndex,
      lineId: parsed.lineId || node.dataset.lineId || "",
      text: parsed.text || "",
      visibleText: parsed.visibleText || "",
      html: node.innerHTML || "",
      tags: (parsed.tags || []).map((tag) => ({
        type: tag.type || "",
        text: tag.text || "",
        id: tag.id || "",
        done: Boolean(tag.done),
        createdAt: Number(tag.createdAt || 0),
        done14: Boolean(tag.done14),
        done22: Boolean(tag.done22)
      }))
    });
  });

  return {
    noteId: note.id || "",
    noteTitle: note.title || "",
    noteCreatedAt: note.createdAt || 0,
    noteUpdatedAt: note.updatedAt || 0,
    documentText: root.textContent || "",
    documentHtml: root.innerHTML || "",
    lineCount: lines.length,
    lines
  };
}

function captureLayoutDebugSnapshot() {
  const viewport = window.visualViewport;
  const rootStyle = getComputedStyle(document.documentElement);
  const dock = refs.mobileTagRoot?.querySelector?.("[data-mobile-tag-dock]") || null;
  const dockStyle = dock ? getComputedStyle(dock) : null;
  const activeElement = document.activeElement;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    documentScrollHeight: document.documentElement.scrollHeight,
    documentMaxScrollY: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    keyboardOffset: getVisualKeyboardOffset(),
    visualViewport: viewport
      ? {
          width: viewport.width,
          height: viewport.height,
          offsetTop: viewport.offsetTop,
          offsetLeft: viewport.offsetLeft,
          pageTop: viewport.pageTop,
          pageLeft: viewport.pageLeft,
          scale: viewport.scale
        }
      : null,
    cssVars: {
      keyboardOffset: rootStyle.getPropertyValue("--keyboard-offset").trim(),
      viewportOffsetTop: rootStyle.getPropertyValue("--viewport-offset-top").trim(),
      viewportOffsetLeft: rootStyle.getPropertyValue("--viewport-offset-left").trim(),
      mobileTagX: dock?.style.getPropertyValue("--mobile-tag-x") || "",
      mobileTagY: dock?.style.getPropertyValue("--mobile-tag-y") || "",
      mobileTagMode: dock?.dataset?.mobileTagMode || "",
      mobileTagWidth: dock?.style.getPropertyValue("--mobile-tag-width") || "",
      mobileTagTrayMaxHeight: dock?.style.getPropertyValue("--mobile-tag-tray-max-height") || ""
    },
    editorFocused: uiState.editorFocused,
    mobileTagsOpen: uiState.mobileTagsOpen,
    compactMobileLayout: isCompactMobileLayout(),
    activeElement: getLayoutDebugElementLabel(activeElement),
    dock: dock
      ? {
          className: dock.className || "",
          ariaHidden: dock.getAttribute("aria-hidden") || "",
          transform: dockStyle?.transform || "",
          visibility: dockStyle?.visibility || "",
          opacity: dockStyle?.opacity || "",
          rect: getLayoutDebugRect(dock)
        }
      : null
  };
}

function captureDeviceDebugSnapshot() {
  return {
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
    maxTouchPoints: Number(navigator.maxTouchPoints || 0),
    isLikelyIpad: isLikelyIpadDevice(),
    isIpadSplitView: isIpadSplitViewLayout(),
    isLikelyIphone: isLikelyIphoneDevice(),
    standalone: Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true),
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

function getLayoutDebugElementLabel(element) {
  if (!element) return "none";
  if (element.id) return `#${element.id}`;
  if (element.dataset?.mobileTagDock) return "[data-mobile-tag-dock]";
  if (element.classList?.contains("tag-token")) return `.tag-token[data-tag="${element.dataset.tag || ""}"]`;
  if (element.closest?.("#notepad-editor")) return "#notepad-editor descendant";
  return String(element.tagName || "element").toLowerCase();
}

function getLayoutDebugRect(element) {
  if (!element?.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
}

function getEditorDebugLines(editor) {
  return Array.from(editor?.childNodes || []).filter(
    (node) => node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)
  );
}

function captureEditorDebugLine(line, index, currentLine) {
  if (!line) return null;
  return {
    index,
    active: line === currentLine,
    tagName: line.tagName || "",
    className: line.className || "",
    empty: isEditorLineEmpty(line),
    hasTag: lineHasTag(line),
    text: getEditorDebugReadableText(line),
    textRaw: line.textContent || "",
    html: line.innerHTML,
    tags: Array.from(line.querySelectorAll?.(".tag-token") || []).map(captureEditorDebugTag),
    childNodes: Array.from(line.childNodes || []).map(captureEditorDebugChildNode)
  };
}

function captureEditorDebugTag(token) {
  return {
    tag: token.dataset?.tag || "",
    text: getEditorDebugReadableText(token),
    textRaw: token.textContent || "",
    html: token.outerHTML || "",
    className: token.className || "",
    dataset: getEditorDebugDataset(token),
    attributes: getEditorDebugAttributes(token)
  };
}

function captureEditorDebugChildNode(node) {
  if (!node) return { type: "none" };
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: "text",
      text: node.textContent || "",
      length: (node.textContent || "").length
    };
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node;
    return {
      type: element.classList?.contains("tag-token") ? "tag-token" : String(element.tagName || "").toLowerCase(),
      tag: element.dataset?.tag || "",
      text: getEditorDebugReadableText(element),
      textRaw: element.textContent || "",
      html: element.outerHTML || "",
      className: element.className || "",
      dataset: getEditorDebugDataset(element),
      attributes: getEditorDebugAttributes(element)
    };
  }
  return {
    type: `node:${node.nodeType}`,
    text: node.textContent || ""
  };
}

function getEditorDebugReadableText(node) {
  const text = typeof node?.innerText === "string" ? node.innerText : node?.textContent || "";
  return String(text).replace(/\u200b/g, "");
}

function getEditorDebugDataset(element) {
  return Object.fromEntries(Object.entries(element?.dataset || {}));
}

function getEditorDebugAttributes(element) {
  return Object.fromEntries(Array.from(element?.attributes || []).map((attribute) => [attribute.name, attribute.value]));
}

function getEditorDebugSelection(editor, selection) {
  if (!editor || !selection || !selection.rangeCount) {
    return { available: false };
  }

  const range = selection.getRangeAt(0);
  return {
    available: true,
    collapsed: selection.isCollapsed,
    anchorNode: getEditorDebugNodeKind(editor, selection.anchorNode),
    focusNode: getEditorDebugNodeKind(editor, selection.focusNode),
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    startContainer: getEditorDebugNodeKind(editor, range.startContainer),
    startOffset: range.startOffset,
    endContainer: getEditorDebugNodeKind(editor, range.endContainer),
    endOffset: range.endOffset,
    anchorLineIndex: getEditorDebugLineIndex(editor, selection.anchorNode),
    focusLineIndex: getEditorDebugLineIndex(editor, selection.focusNode),
    editorBoundaryOffset: range.startContainer === editor ? range.startOffset : null
  };
}

function getEditorDebugNodeKind(editor, node) {
  if (!node) return "none";
  if (node === editor) return "editor";
  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement?.closest?.(".tag-token") ? "tag-text" : "text";
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.classList?.contains("tag-token")) return `tag:${node.dataset.tag || "unknown"}`;
    if (["DIV", "P"].includes(node.tagName)) return "line";
    return String(node.tagName || "element").toLowerCase();
  }
  return `node:${node.nodeType}`;
}

function getEditorDebugLineIndex(editor, node) {
  if (!editor || !node) return -1;
  const lines = getEditorDebugLines(editor);
  let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (current && current !== editor) {
    if (current.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(current.tagName)) {
      return lines.indexOf(current);
    }
    current = current.parentNode;
  }
  return -1;
}

function scheduleCloudSave() {
  if (!authState.client || !authState.user || authState.suppressCloudSave) return;
  window.clearTimeout(authState.saveTimer);
  authState.saveTimer = window.setTimeout(() => {
    authState.saveTimer = null;
    saveCloudStateNow().catch((error) => {
      console.error("Cloud save failed:", error);
      authState.isSaving = false;
      renderAuthUi();
    });
  }, CLOUD_SAVE_DEBOUNCE_MS);
  renderAuthUi();
}

function fetchCloudStateRecord() {
  return authState.client
    .from(CLOUD_STATE_TABLE)
    .select("state_json,updated_at")
    .eq("user_id", authState.user.id)
    .maybeSingle();
}

async function saveCloudStateNow({ conflictRetry = false } = {}) {
  if (!authState.client || !authState.user || authState.suppressCloudSave) return;

  authState.isSaving = true;
  renderAuthUi();

  if (isSuspiciouslyBlankAppState(appState) && authState.lastCloudUpdatedAtValue) {
    const { data: cloudRecord, error: cloudReadError } = await fetchCloudStateRecord();
    if (cloudReadError) {
      authState.isSaving = false;
      throw cloudReadError;
    }
    if (cloudRecord?.state_json && hasRecoverableCloudData(cloudRecord.state_json)) {
      appState = mergeRemoteStatePreservingLocalView(cloudRecord.state_json);
      state = getActiveWorkspaceState(appState);
      rememberCloudVersion(cloudRecord.updated_at);
      authState.isSaving = false;
      authState.suppressCloudSave = true;
      saveState({ skipCloud: true, markDirty: false });
      authState.suppressCloudSave = false;
      setAuthMessage("Cloud notes were restored instead of being replaced by an empty local copy.");
      render();
      return;
    }
  }

  const updatedAt = new Date().toISOString();
  const payload = {
    user_id: authState.user.id,
    state_json: appState,
    updated_at: updatedAt
  };

  const query = authState.lastCloudUpdatedAtValue
    ? authState.client
        .from(CLOUD_STATE_TABLE)
        .update({
          state_json: payload.state_json,
          updated_at: payload.updated_at
        })
        .eq("user_id", authState.user.id)
        .eq("updated_at", authState.lastCloudUpdatedAtValue)
    : authState.client.from(CLOUD_STATE_TABLE).insert(payload);

  let data = null;
  let error = null;
  try {
    const response = await query.select("updated_at").maybeSingle();
    data = response.data;
    error = response.error;
  } catch (saveError) {
    authState.isSaving = false;
    throw saveError;
  }
  authState.isSaving = false;

  if (error) {
    if (isCloudVersionConflictError(error)) {
      await handleCloudSaveConflict({ conflictRetry });
      return;
    }
    console.error("Cloud save failed:", error);
    setAuthMessage(`Cloud save failed: ${error.message}`);
    renderAuthUi();
    return;
  }

  if (!data) {
    await handleCloudSaveConflict({ conflictRetry });
    return;
  }

  rememberCloudVersion(data.updated_at || updatedAt);
  authState.pendingDoneToggles.clear();
  applyPendingRemoteStateIfReady();
  setAuthMessage("");
  renderAuthUi();
}

function isCloudVersionConflictError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "23505" || /duplicate key|violates unique constraint/i.test(message);
}

async function handleCloudSaveConflict({ conflictRetry = false } = {}) {
  try {
    const { data, error } = await fetchCloudStateRecord();
    if (error) throw error;
    if (data?.state_json) {
      const currentView = {
        workspaceKey: getActiveWorkspaceKey(),
        selectedWardId: state.selectedWardId,
        selectedNoteId: state.selectedNoteId
      };
      const localActiveNote = getCurrentNote();
      let mergedState = mergeCloudStateForSave(appState, data.state_json);
      let replayedDoneToggle = false;
      if (authState.pendingDoneToggles.size) {
        let didReplayDoneToggle = false;
        authState.pendingDoneToggles.forEach((toggle) => {
          didReplayDoneToggle = applyDoneToggleToState(mergedState, toggle) || didReplayDoneToggle;
        });

        if (didReplayDoneToggle) {
          replayedDoneToggle = true;
          setAuthMessage(`Cloud changed, so ${getActiveWorkspaceMeta().title} kept your checkbox change and saved it on top of the newer copy.`);
        }
        authState.pendingDoneToggles.clear();
      }

      authState.pendingRemoteRecord = null;
      appState = mergeRemoteStatePreservingLocalView(mergedState);
      state = getActiveWorkspaceState(appState);
      rememberCloudVersion(data.updated_at);
      authState.suppressCloudSave = true;
      saveState({ skipCloud: true, markDirty: false });
      authState.suppressCloudSave = false;

      const mergedActiveNote = getStateNoteById(
        appState.workspaces[currentView.workspaceKey],
        currentView.selectedWardId,
        currentView.selectedNoteId
      );
      const activeNoteChangedToRemote =
        localActiveNote &&
        mergedActiveNote &&
        mergedActiveNote.documentHtml !== localActiveNote.documentHtml &&
        getNoteUpdatedAt(mergedActiveNote) > getNoteUpdatedAt(localActiveNote);
      if (!isEditorActivelyFocused() || activeNoteChangedToRemote) {
        render();
      } else {
        renderAuthUi();
      }

      if (!replayedDoneToggle) {
        setAuthMessage(
          shouldProtectLocalStateFromCloudConflict()
            ? "Cloud changed on another device. ShiftPad merged the newer note changes and is saving this edit on top."
            : "Cloud changed on another device. ShiftPad merged the newer notes instead of overwriting them."
        );
      }

      if (conflictRetry) {
        scheduleCloudSave();
      } else {
        await saveCloudStateNow({ conflictRetry: true });
      }
      return;
    }
  } catch (error) {
    console.error("Cloud conflict refresh failed:", error);
    setAuthMessage(`Cloud sync conflict. Refresh failed: ${error.message}`);
    renderAuthUi();
    return;
  }
  setAuthMessage("Cloud changed on another device. Refresh ShiftPad before saving again.");
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
  traceBedIndexScrubScrollEvent();
  if (uiState.bedIndexScrollRaf) return;
  uiState.bedIndexScrollRaf = window.requestAnimationFrame(() => {
    uiState.bedIndexScrollRaf = 0;
    updateBedIndexDuringScroll();
  });
}

function updateBedIndexDuringScroll() {
  if (state.activeView !== "notes" || uiState.editorFocused) return;
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  const rail = refs.editorRoot.querySelector(".bed-index-rail");
  if (!editor || !rail) return;
  const rect = editor.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (rect.bottom < 120 || rect.top > viewportHeight - 80) return;

  setBedIndexVisible(true);
  if (uiState.bedIndexScrub) return;
  updateBedIndexFromViewport(rail, editor);
  window.clearTimeout(uiState.bedIndexTimer);
  uiState.bedIndexTimer = window.setTimeout(() => setBedIndexVisible(false), 1100);
}

function setBedIndexVisible(visible) {
  if (!visible && uiState.bedIndexScrub) return;
  uiState.bedIndexVisible = Boolean(visible);
  refs.editorRoot.querySelector(".bed-index-rail")?.classList.toggle("is-visible", Boolean(visible));
}

function hideBedIndex() {
  window.clearTimeout(uiState.bedIndexTimer);
  setBedIndexVisible(false);
}

function startBedIndexScrub(rail, event) {
  if (!rail || (event.button !== undefined && event.button !== 0)) return;
  if (uiState.bedIndexScrub) {
    event.preventDefault();
    flagBedIndexScrubAnomaly(uiState.bedIndexScrub, "duplicate-pointer-start", {
      activePointerId: uiState.bedIndexScrub.pointerId,
      incomingPointerId: event.pointerId,
      incomingPointerType: event.pointerType || "unknown",
      clientY: Number(event.clientY),
      screenY: Number(event.screenY)
    });
    return;
  }
  const labels = getBedIndexLabels(rail);
  if (!labels.length) return;
  const track = rail.querySelector(".bed-index-track");
  const trackRect = track?.getBoundingClientRect();
  if (!trackRect?.height) return;

  event.preventDefault();
  cancelBedLongPress();
  window.clearTimeout(uiState.bedIndexTimer);
  const anchors = getBedIndexScrubAnchors(labels);
  const rawStartClientY = Number(event.clientY);
  const startScreenY = Number(event.screenY);
  const useTouchCoordinate = (isLikelyIphoneDevice() || isLikelyIpadDevice())
    && (event.pointerType || "") === "touch";
  const useScreenCoordinate = false;
  const screenToClientOffset = 0;
  const startClientY = rawStartClientY;
  const startRatio = Math.max(0, Math.min(1, (startClientY - trackRect.top) / trackRect.height));
  const startIndex = getBedIndexScrubStartIndex(anchors);
  uiState.bedIndexScrub = {
    rail,
    labels,
    anchors,
    pointerId: event.pointerId,
    pointerType: event.pointerType || "unknown",
    touchIdentifier: null,
    useTouchCoordinate,
    useScreenCoordinate,
    screenToClientOffset,
    startRatio,
    startIndex,
    startAnchorDocumentTop: anchors.find((anchor) => anchor.index === startIndex)?.documentTop ?? null,
    lastIndex: startIndex,
    lastPosition: startIndex,
    pendingPosition: null,
    scrollFrame: 0,
    startScrollY: window.scrollY,
    lastTargetScrollY: window.scrollY,
    lastObservedScrollY: window.scrollY,
    lastCommandedAt: 0,
    lastPointerAt: performance.now(),
    lastPointerClientY: startClientY,
    lastPointerRawClientY: rawStartClientY,
    lastPointerScreenY: startScreenY,
    lastViewportTop: Number(window.visualViewport?.offsetTop) || 0,
    lastViewportHeight: Number(window.visualViewport?.height || window.innerHeight) || 0,
    lastCommandIndex: startIndex,
    lastRecordedCommandTarget: window.scrollY,
    trace: [],
    anomalyKeys: new Set(),
    anomalies: [],
    startedAt: Date.now()
  };
  rail.classList.add("is-visible", "is-scrubbing");
  uiState.bedIndexVisible = true;
  if (!useTouchCoordinate) {
    try {
      rail.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional on older browsers.
    }
  }
  const railRect = rail.getBoundingClientRect();
  const bubbleY = Math.max(18, Math.min(Math.max(18, railRect.height - 18), startClientY - railRect.top));
  setBedIndexActiveState(rail, startIndex, { bubbleY, labels });
  recordBedIndexScrubTrace(uiState.bedIndexScrub, "start", {
    clientY: startClientY,
    rawClientY: rawStartClientY,
    screenY: startScreenY,
    coordinateSource: useTouchCoordinate ? "touch-client" : "client",
    ratio: startRatio,
    position: startIndex,
    index: startIndex
  }, { force: true });
  appendEditorDebugLog({
    action: "bed-index-scrub-start",
    source: "pointer",
    success: true,
    handledBy: "startBedIndexScrub",
    before: null,
    after: null,
    scrub: {
      labelCount: labels.length,
      anchorCount: uiState.bedIndexScrub.anchors.length,
      pointerId: uiState.bedIndexScrub.pointerId,
      pointerType: uiState.bedIndexScrub.pointerType,
      clientY: Math.round(startClientY || 0),
      rawClientY: Math.round(rawStartClientY || 0),
      screenY: Math.round(startScreenY || 0),
      coordinateSource: useTouchCoordinate ? "touch-client" : "client",
      trackTop: Math.round(trackRect.top),
      trackBottom: Math.round(trackRect.bottom),
      startRatio: Number(startRatio.toFixed(4)),
      startIndex,
      startBed: labels[startIndex] || "",
      startScrollY: Math.round(window.scrollY)
    }
  });
}

function updateBedIndexScrub(event, coordinateOverride = null) {
  const scrub = uiState.bedIndexScrub;
  if (!scrub || (event.pointerId !== undefined && scrub.pointerId !== undefined && event.pointerId !== scrub.pointerId)) return;
  const track = scrub.rail.querySelector(".bed-index-track");
  const trackRect = track?.getBoundingClientRect();
  if (!trackRect?.height) return;

  const pointerCoordinate = coordinateOverride || getBedIndexPointerCoordinate(scrub, event);
  const clientY = pointerCoordinate.clientY;
  const ratio = Math.max(0, Math.min(1, (clientY - trackRect.top) / trackRect.height));
  const position = getBedIndexScrubPosition(scrub, ratio);
  const index = Math.min(scrub.labels.length - 1, Math.round(position));
  const now = performance.now();
  const elapsedMs = Math.max(0, now - scrub.lastPointerAt);
  const clientYDelta = clientY - scrub.lastPointerClientY;
  const rawClientYDelta = pointerCoordinate.rawClientY - scrub.lastPointerRawClientY;
  const screenYDelta = pointerCoordinate.screenY - scrub.lastPointerScreenY;
  const indexDelta = index - scrub.lastIndex;
  const coordinateOutsideTrack = clientY < trackRect.top - 32 || clientY > trackRect.bottom + 32;
  const rapidFirstBedJump = scrub.lastIndex >= 4 && index <= 1 && elapsedMs <= 250;
  const rawCoordinateReset = clientY <= 1 && trackRect.top > 8;
  const railRect = scrub.rail.getBoundingClientRect();
  const bubbleY = Math.max(18, Math.min(Math.max(18, railRect.height - 18), clientY - railRect.top));
  setBedIndexActiveState(scrub.rail, index, { bubbleY, labels: scrub.labels });
  recordBedIndexScrubTrace(scrub, "pointer", {
    clientY,
    rawClientY: pointerCoordinate.rawClientY,
    screenY: pointerCoordinate.screenY,
    coordinateSource: pointerCoordinate.source,
    ratio,
    position,
    index,
    elapsedMs,
    clientYDelta,
    rawClientYDelta,
    screenYDelta,
    indexDelta,
    pointerId: pointerCoordinate.pointerId ?? event.pointerId
  }, {
    force: index !== scrub.lastIndex || now - scrub.lastTraceAt >= 80
  });
  if (rawCoordinateReset) {
    flagBedIndexScrubAnomaly(scrub, "pointer-coordinate-reset", {
      clientY,
      trackTop: trackRect.top,
      trackBottom: trackRect.bottom,
      ratio,
      index,
      previousIndex: scrub.lastIndex,
      elapsedMs
    });
  } else if (coordinateOutsideTrack) {
    flagBedIndexScrubAnomaly(scrub, "pointer-outside-track", {
      clientY,
      trackTop: trackRect.top,
      trackBottom: trackRect.bottom,
      ratio,
      index,
      previousIndex: scrub.lastIndex,
      elapsedMs
    });
  }
  if (rapidFirstBedJump) {
    flagBedIndexScrubAnomaly(scrub, "rapid-return-to-first-bed", {
      clientY,
      clientYDelta,
      ratio,
      index,
      previousIndex: scrub.lastIndex,
      elapsedMs
    });
  }
  scrub.lastIndex = index;
  scrub.lastPosition = position;
  scrub.lastPointerAt = now;
  scrub.lastPointerClientY = clientY;
  scrub.lastPointerRawClientY = pointerCoordinate.rawClientY;
  scrub.lastPointerScreenY = pointerCoordinate.screenY;
  scheduleBedIndexScrubScroll(scrub, position);
}

function updateBedIndexScrubFromTouch(event) {
  const scrub = uiState.bedIndexScrub;
  if (!scrub) return;
  const touches = Array.from(event.touches || []);
  const touch = scrub.touchIdentifier === null
    ? touches[0]
    : touches.find((candidate) => candidate.identifier === scrub.touchIdentifier);
  if (!touch) return;
  if (scrub.touchIdentifier === null) scrub.touchIdentifier = touch.identifier;
  const clientY = Number(touch.clientY);
  updateBedIndexScrub(event, {
    rawClientY: clientY,
    screenY: Number(touch.screenY),
    clientY,
    pointerId: `touch-${touch.identifier}`,
    source: "touch-client"
  });
}

function observeBedIndexCapturedPointer(event) {
  const scrub = uiState.bedIndexScrub;
  if (!scrub) return;
  recordBedIndexScrubTrace(scrub, "captured-pointer-observation", {
    rawClientY: Number(event.clientY),
    screenY: Number(event.screenY),
    pointerId: event.pointerId
  });
}

function getBedIndexPointerCoordinate(scrub, event) {
  const rawClientY = Number(event.clientY);
  const screenY = Number(event.screenY);
  const canUseScreenCoordinate = Boolean(
    scrub?.useScreenCoordinate
      && Number.isFinite(screenY)
      && screenY > 0
  );
  return {
    rawClientY,
    screenY,
    clientY: canUseScreenCoordinate
      ? screenY + scrub.screenToClientOffset
      : rawClientY,
    source: canUseScreenCoordinate ? "screen-calibrated" : "client"
  };
}

function finishBedIndexScrub(event) {
  const scrub = uiState.bedIndexScrub;
  if (!scrub) return false;
  if (event.pointerId !== undefined && scrub.pointerId !== undefined && event.pointerId !== scrub.pointerId) {
    flagBedIndexScrubAnomaly(scrub, "pointer-finish-mismatch", {
      activePointerId: scrub.pointerId,
      incomingPointerId: event.pointerId,
      eventType: event.type || ""
    });
    return false;
  }
  flushBedIndexScrubScroll(scrub);
  const pointerCoordinate = scrub.useTouchCoordinate
    ? {
        clientY: scrub.lastPointerClientY,
        rawClientY: scrub.lastPointerRawClientY,
        screenY: scrub.lastPointerScreenY,
        source: "touch-client"
      }
    : getBedIndexPointerCoordinate(scrub, event);
  recordBedIndexScrubTrace(scrub, "end", {
    clientY: pointerCoordinate.clientY,
    rawClientY: pointerCoordinate.rawClientY,
    screenY: pointerCoordinate.screenY,
    coordinateSource: pointerCoordinate.source,
    position: scrub.lastPosition,
    index: scrub.lastIndex,
    eventType: event?.type || ""
  }, { force: true });
  uiState.bedIndexScrub = null;
  scrub.rail.classList.remove("is-scrubbing");
  safelyReleasePointerCapture(scrub.rail, scrub.pointerId);
  uiState.suppressNextBedIndexClick = true;
  window.clearTimeout(uiState.bedIndexClickSuppressTimer);
  uiState.bedIndexClickSuppressTimer = window.setTimeout(() => {
    uiState.suppressNextBedIndexClick = false;
    uiState.bedIndexClickSuppressTimer = null;
  }, 700);
  window.clearTimeout(uiState.bedIndexTimer);
  uiState.bedIndexTimer = window.setTimeout(() => setBedIndexVisible(false), 800);
  appendEditorDebugLog({
    action: "bed-index-scrub-end",
    source: "pointer",
    success: true,
    handledBy: "finishBedIndexScrub",
    before: null,
    after: null,
    scrub: {
      labelCount: scrub.labels.length,
      anchorCount: scrub.anchors.length,
      pointerId: scrub.pointerId,
      pointerType: scrub.pointerType,
      selectedIndex: scrub.lastIndex,
      selectedBed: scrub.labels[scrub.lastIndex] || "",
      startIndex: scrub.startIndex,
      startBed: scrub.labels[scrub.startIndex] || "",
      startScrollY: Math.round(scrub.startScrollY),
      targetScrollY: Math.round(scrub.lastTargetScrollY),
      endScrollY: Math.round(window.scrollY),
      durationMs: Math.max(0, Date.now() - scrub.startedAt),
      anomalyCount: scrub.anomalies.length,
      anomalyReasons: scrub.anomalies.map((item) => item.reason),
      coordinateSource: scrub.useTouchCoordinate
        ? "touch-client"
        : scrub.useScreenCoordinate
          ? "screen-calibrated"
          : "client",
      trace: scrub.trace
    }
  });
  return true;
}

function getBedIndexScrubAnchors(labels) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return [];
  const tokensByLabel = new Map();
  editor.querySelectorAll('.tag-token[data-tag="bed"]').forEach((token) => {
    const label = String(token.textContent || "").replace(/^Bed\s*/i, "").trim().toUpperCase();
    if (label && !tokensByLabel.has(label)) tokensByLabel.set(label, token);
  });

  return labels.map((label, index) => {
    const token = tokensByLabel.get(String(label).toUpperCase());
    const line = token?.closest("div, p") || token;
    if (!line) return null;
    return {
      index,
      label,
      documentTop: window.scrollY + line.getBoundingClientRect().top
    };
  }).filter(Boolean);
}

function getBedIndexScrubStartIndex(anchors) {
  if (!anchors.length) return 0;
  const viewport = window.visualViewport;
  const viewportDocumentY = window.scrollY
    + (viewport?.offsetTop || 0)
    + (viewport?.height || window.innerHeight) * 0.42;
  return anchors.reduce((closest, anchor) => (
    Math.abs(anchor.documentTop - viewportDocumentY) < Math.abs(closest.documentTop - viewportDocumentY)
      ? anchor
      : closest
  ), anchors[0]).index;
}

function getBedIndexScrubPosition(scrub, ratio) {
  const lastIndex = Math.max(0, scrub.labels.length - 1);
  if (!lastIndex) return 0;
  const startRatio = Math.max(0, Math.min(1, scrub.startRatio));
  if (ratio <= startRatio) {
    if (startRatio <= 0.001) return scrub.startIndex;
    const progress = Math.max(0, Math.min(1, (startRatio - ratio) / startRatio));
    return Math.max(0, scrub.startIndex * (1 - Math.pow(progress, 1.45)));
  }
  if (startRatio >= 0.999) return scrub.startIndex;
  const progress = (ratio - startRatio) / (1 - startRatio);
  return Math.min(lastIndex, scrub.startIndex + (lastIndex - scrub.startIndex) * Math.pow(progress, 1.45));
}

function scheduleBedIndexScrubScroll(scrub, position) {
  if (!scrub || !Number.isFinite(position)) return;
  scrub.pendingPosition = position;
  if (scrub.scrollFrame) return;
  scrub.scrollFrame = window.requestAnimationFrame(() => {
    scrub.scrollFrame = 0;
    flushBedIndexScrubScroll(scrub);
  });
}

function flushBedIndexScrubScroll(scrub) {
  if (!scrub) return;
  if (scrub.scrollFrame) {
    window.cancelAnimationFrame(scrub.scrollFrame);
    scrub.scrollFrame = 0;
  }
  const position = scrub.pendingPosition;
  scrub.pendingPosition = null;
  if (!Number.isFinite(position) || !scrub.anchors.length) return;

  const scaled = Math.max(0, Math.min(scrub.anchors.length - 1, position));
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(scrub.anchors.length - 1, Math.ceil(scaled));
  const lower = scrub.anchors[lowerIndex];
  const upper = scrub.anchors[upperIndex] || lower;
  if (!lower || !upper) return;
  const progress = scaled - lowerIndex;
  const documentTop = lower.documentTop + (upper.documentTop - lower.documentTop) * progress;
  const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const startAnchorDocumentTop = Number.isFinite(scrub.startAnchorDocumentTop)
    ? scrub.startAnchorDocumentTop
    : lower.documentTop;
  const targetScrollY = Math.max(0, Math.min(
    maxScrollY,
    scrub.startScrollY + documentTop - startAnchorDocumentTop
  ));
  scrub.lastTargetScrollY = targetScrollY;
  scrub.lastCommandedAt = performance.now();
  const commandIndex = Math.round(position);
  const forceCommandTrace = commandIndex !== scrub.lastCommandIndex
    || Math.abs(targetScrollY - scrub.lastRecordedCommandTarget) >= 96;
  recordBedIndexScrubTrace(scrub, "scroll-command", {
    position,
    index: commandIndex,
    targetScrollY
  }, { force: forceCommandTrace });
  scrub.lastCommandIndex = commandIndex;
  scrub.lastRecordedCommandTarget = targetScrollY;
  window.scrollTo({ left: window.scrollX, top: targetScrollY, behavior: "auto" });
}

function traceBedIndexScrubViewportEvent() {
  const scrub = uiState.bedIndexScrub;
  if (!scrub) return;
  const viewport = window.visualViewport;
  const viewportTop = Number(viewport?.offsetTop) || 0;
  const viewportHeight = Number(viewport?.height || window.innerHeight) || 0;
  const topDelta = viewportTop - scrub.lastViewportTop;
  const heightDelta = viewportHeight - scrub.lastViewportHeight;
  const shifted = Math.abs(topDelta) >= 32 || Math.abs(heightDelta) >= 80;
  recordBedIndexScrubTrace(scrub, "viewport-event", {
    viewportTop,
    viewportHeight,
    topDelta,
    heightDelta
  }, { force: shifted });
  if (shifted) {
    flagBedIndexScrubAnomaly(scrub, "visual-viewport-shift", {
      viewportTop,
      viewportHeight,
      topDelta,
      heightDelta,
      currentScrollY: window.scrollY,
      targetScrollY: scrub.lastTargetScrollY
    });
  }
  scrub.lastViewportTop = viewportTop;
  scrub.lastViewportHeight = viewportHeight;
}

function traceBedIndexScrubScrollEvent() {
  const scrub = uiState.bedIndexScrub;
  if (!scrub) return;
  const now = performance.now();
  const scrollY = window.scrollY;
  const scrollDelta = scrollY - scrub.lastObservedScrollY;
  const targetDelta = scrollY - scrub.lastTargetScrollY;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const unexpectedScroll = Math.abs(targetDelta) > Math.max(96, viewportHeight * 0.12)
    && now - scrub.lastCommandedAt > 32;
  const visibleIndex = getBedIndexScrubStartIndex(scrub.anchors);
  const unexpectedFirstBed = visibleIndex <= 1
    && scrub.lastPosition >= 4
    && Math.abs(targetDelta) > 96;

  recordBedIndexScrubTrace(scrub, "scroll-event", {
    scrollY,
    scrollDelta,
    targetDelta,
    visibleIndex
  }, {
    force: unexpectedScroll || unexpectedFirstBed || now - scrub.lastTraceAt >= 80
  });

  if (unexpectedFirstBed) {
    flagBedIndexScrubAnomaly(scrub, "visible-first-bed-without-command", {
      scrollY,
      targetScrollY: scrub.lastTargetScrollY,
      targetDelta,
      visibleIndex,
      requestedIndex: Math.round(scrub.lastPosition)
    });
  } else if (unexpectedScroll) {
    flagBedIndexScrubAnomaly(scrub, "scroll-diverged-from-command", {
      scrollY,
      targetScrollY: scrub.lastTargetScrollY,
      targetDelta,
      visibleIndex,
      requestedIndex: Math.round(scrub.lastPosition),
      sinceCommandMs: Math.round(now - scrub.lastCommandedAt)
    });
  }
  scrub.lastObservedScrollY = scrollY;
}

function recordBedIndexScrubTrace(scrub, kind, details = {}, { force = false } = {}) {
  if (!scrub?.trace) return;
  const now = performance.now();
  if (!force && now - (scrub.lastTraceAt || 0) < 80) return;
  scrub.lastTraceAt = now;
  const viewport = window.visualViewport;
  const entry = {
    t: Math.max(0, Math.round(Date.now() - scrub.startedAt)),
    kind,
    scrollY: Math.round(Number(details.scrollY ?? window.scrollY) || 0),
    targetScrollY: Math.round(Number(details.targetScrollY ?? scrub.lastTargetScrollY) || 0),
    viewportTop: Math.round(Number(viewport?.offsetTop) || 0),
    viewportHeight: Math.round(Number(viewport?.height || window.innerHeight) || 0)
  };
  Object.entries(details).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return;
      entry[key] = Number(value.toFixed(3));
      return;
    }
    entry[key] = value;
  });
  scrub.trace.push(entry);
  if (scrub.trace.length > 96) scrub.trace.shift();
}

function flagBedIndexScrubAnomaly(scrub, reason, details = {}) {
  if (!scrub || !reason || scrub.anomalyKeys?.has(reason) || scrub.anomalies.length >= 6) return;
  scrub.anomalyKeys.add(reason);
  const anomaly = {
    reason,
    t: Math.max(0, Math.round(Date.now() - scrub.startedAt)),
    ...details
  };
  scrub.anomalies.push(anomaly);
  appendEditorDebugLog({
    action: "bed-index-scrub-anomaly",
    source: "pointer",
    success: false,
    handledBy: "flagBedIndexScrubAnomaly",
    before: null,
    after: null,
    scrub: {
      startIndex: scrub.startIndex,
      startBed: scrub.labels[scrub.startIndex] || "",
      currentIndex: scrub.lastIndex,
      currentBed: scrub.labels[scrub.lastIndex] || "",
      startScrollY: Math.round(scrub.startScrollY),
      currentScrollY: Math.round(window.scrollY),
      targetScrollY: Math.round(scrub.lastTargetScrollY),
      anomaly,
      traceTail: scrub.trace.slice(-16)
    }
  });
}

function getBedIndexLabels(rail) {
  try {
    const labels = JSON.parse(rail?.dataset?.bedIndexLabels || "[]");
    return Array.isArray(labels) ? labels.map((label) => String(label || "")).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setBedIndexActiveState(rail, index, { bubbleY = null, labels = null } = {}) {
  if (!rail || !Number.isInteger(index) || index < 0) return;
  const bedLabels = labels || getBedIndexLabels(rail);
  const label = bedLabels[index];
  if (!label) return;
  rail.dataset.activeIndex = String(index);
  const closestSampledIndex = getClosestSampledBedIndex(rail, index);
  rail.querySelectorAll("[data-bed-index]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.bedIndex) === closestSampledIndex);
  });
  const bubble = rail.querySelector(".bed-index-bubble");
  if (bubble) bubble.textContent = `Bed ${label}`;
  if (Number.isFinite(bubbleY)) {
    rail.style.setProperty("--bed-index-bubble-y", `${Math.round(bubbleY)}px`);
  }
}

function getClosestSampledBedIndex(rail, targetIndex) {
  const indices = Array.from(rail?.querySelectorAll?.("[data-bed-index]") || [])
    .map((button) => Number(button.dataset.bedIndex))
    .filter(Number.isFinite);
  return indices.reduce(
    (closest, index) => Math.abs(index - targetIndex) < Math.abs(closest - targetIndex) ? index : closest,
    indices[0] ?? targetIndex
  );
}

function updateBedIndexFromViewport(rail, editor) {
  const labels = getBedIndexLabels(rail);
  if (!labels.length || !editor) return;
  const labelIndices = new Map(labels.map((bed, index) => [bed.toUpperCase(), index]));
  const viewport = window.visualViewport;
  const viewportCenter = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) * 0.45;
  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;
  editor.querySelectorAll('.tag-token[data-tag="bed"]').forEach((token) => {
    const label = String(token.textContent || "").replace(/^Bed\s*/i, "").trim().toUpperCase();
    const index = labelIndices.get(label) ?? -1;
    if (index < 0) return;
    const distance = Math.abs(token.getBoundingClientRect().top - viewportCenter);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  if (closestIndex >= 0) setBedIndexActiveState(rail, closestIndex);
}

function jumpToBedInEditor(bedLabel, { behavior = "smooth", keepVisible = false, updateIndex = true } = {}) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor || !bedLabel) return;
  const target = Array.from(editor.querySelectorAll('.tag-token[data-tag="bed"]')).find((token) => {
    const label = String(token.textContent || "").replace(/^Bed\s*/i, "").trim().toUpperCase();
    return label === String(bedLabel).toUpperCase();
  });
  const line = target?.closest("div, p") || target;
  if (!line) return;
  line.scrollIntoView({ behavior, block: "center" });
  setBedIndexVisible(true);
  if (updateIndex) {
    const rail = refs.editorRoot.querySelector(".bed-index-rail");
    const labels = getBedIndexLabels(rail);
    const index = labels.findIndex((bed) => bed.toUpperCase() === String(bedLabel).toUpperCase());
    if (index >= 0) setBedIndexActiveState(rail, index);
  }
  if (keepVisible) return;
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
  if (!note) return "<div><br></div>";
  const noteUpdatedAt = Number(note.updatedAt) || Number(note.createdAt) || Date.now();
  const storedModel = normalizeStoredDocumentModel(note.documentModel);

  if (storedModel && Number(storedModel.updatedAt) >= noteUpdatedAt) {
    if (typeof note.documentHtml === "string" && note.documentHtml.trim()) {
      note.documentModel = storedModel;
      return note.documentHtml;
    }
    const fromModel = renderNoteDocumentModel(storedModel);
    const documentState = buildNoteDocumentState(note, fromModel, Number(storedModel.updatedAt) || noteUpdatedAt);
    note.documentHtml = documentState.html;
    note.documentModel = documentState.model;
    return note.documentHtml;
  }

  const sourceHtml = typeof note.documentHtml === "string" && note.documentHtml.trim()
    ? note.documentHtml
    : convertEntriesToDocumentHtml(Array.isArray(note.entries) ? note.entries : []);
  const documentState = buildNoteDocumentState(note, sourceHtml, noteUpdatedAt);
  note.documentHtml = documentState.html;
  note.documentModel = documentState.model;
  return note.documentHtml;
}

function setNoteDocumentHtml(note, html, { updatedAt = Date.now(), deferModel = false } = {}) {
  if (!note) return "<div><br></div>";
  const nextUpdatedAt = Number(updatedAt) || Date.now();
  if (deferModel) {
    note.documentHtml = String(html || "").trim() || "<div><br></div>";
    note.updatedAt = nextUpdatedAt;
    noteParseCache.delete(note.id);
    scheduleNoteDocumentModelSync(note);
    return note.documentHtml;
  }
  cancelNoteDocumentModelSync(note.id);
  const documentState = buildNoteDocumentState(note, html, updatedAt);
  note.documentHtml = documentState.html;
  note.documentModel = documentState.model;
  note.updatedAt = nextUpdatedAt;
  noteParseCache.delete(note.id);
  return note.documentHtml;
}

function scheduleNoteDocumentModelSync(note) {
  if (!note?.id) return;
  cancelNoteDocumentModelSync(note.id);
  const timer = window.setTimeout(() => {
    noteDocumentModelTimers.delete(note.id);
    const documentState = buildNoteDocumentState(note, note.documentHtml, note.updatedAt);
    note.documentHtml = documentState.html;
    note.documentModel = documentState.model;
    noteParseCache.delete(note.id);
  }, NOTE_DOCUMENT_MODEL_SYNC_DELAY_MS);
  noteDocumentModelTimers.set(note.id, timer);
}

function cancelNoteDocumentModelSync(noteId) {
  const timer = noteDocumentModelTimers.get(noteId);
  if (timer) window.clearTimeout(timer);
  noteDocumentModelTimers.delete(noteId);
}

function buildNoteDocumentState(note, html, updatedAt) {
  const root = parseHtmlRoot(typeof html === "string" ? html : "");
  normalizeEditorBlocks(root);
  ensureEditorLineIdentities(root, note?.id || "note");
  const lines = Array.from(root.children)
    .filter((line) => ["DIV", "P"].includes(line.tagName))
    .map((line) => {
      const parsed = parseLineNode(line);
      return {
        id: line.dataset.lineId,
        block: line.tagName.toLowerCase(),
        html: line.innerHTML,
        text: parsed.text || "",
        tags: parsed.tags.map((tag) => ({
          id: tag.id || "",
          type: tag.type || "general",
          text: tag.text || "",
          done: Boolean(tag.done),
          createdAt: Number(tag.createdAt) || 0,
          done14: Boolean(tag.done14),
          done22: Boolean(tag.done22)
        }))
      };
    });
  const normalizedLines = lines.length ? lines : [{
    id: createId("line"),
    block: "div",
    html: "<br>",
    text: "",
    tags: []
  }];
  const model = {
    version: NOTE_DOCUMENT_MODEL_VERSION,
    updatedAt: Number(updatedAt) || Date.now(),
    lines: normalizedLines
  };
  return {
    html: renderNoteDocumentModel(model),
    model
  };
}

function normalizeStoredDocumentModel(input) {
  if (!input || Number(input.version) !== NOTE_DOCUMENT_MODEL_VERSION || !Array.isArray(input.lines)) return null;
  const lines = input.lines
    .filter((line) => line && typeof line.html === "string")
    .slice(0, 5000)
    .map((line) => ({
      id: typeof line.id === "string" && line.id ? line.id.slice(0, 120) : createId("line"),
      block: String(line.block || "div").toLowerCase() === "p" ? "p" : "div",
      html: line.html.slice(0, RECOVERY_SNAPSHOT_MAX_HTML),
      text: typeof line.text === "string" ? line.text.slice(0, RECOVERY_SNAPSHOT_MAX_HTML) : "",
      tags: Array.isArray(line.tags) ? line.tags.slice(0, 12).map((tag) => ({
        id: typeof tag?.id === "string" ? tag.id.slice(0, 120) : "",
        type: typeof tag?.type === "string" ? tag.type.slice(0, 80) : "general",
        text: typeof tag?.text === "string" ? tag.text.slice(0, 120) : "",
        done: Boolean(tag?.done),
        createdAt: Number(tag?.createdAt) || 0,
        done14: Boolean(tag?.done14),
        done22: Boolean(tag?.done22)
      })) : []
    }));
  if (!lines.length) return null;
  return {
    version: NOTE_DOCUMENT_MODEL_VERSION,
    updatedAt: Number(input.updatedAt) || 0,
    lines
  };
}

function renderNoteDocumentModel(model) {
  const root = parseHtmlRoot("");
  const usedIds = new Set();
  (model?.lines || []).forEach((line, index) => {
    const element = root.ownerDocument.createElement(line.block === "p" ? "p" : "div");
    let lineId = String(line.id || "");
    if (!lineId || usedIds.has(lineId)) lineId = createId(`line-${index + 1}`);
    usedIds.add(lineId);
    element.dataset.lineId = lineId;
    element.innerHTML = typeof line.html === "string" && line.html ? line.html : "<br>";
    root.appendChild(element);
  });
  normalizeEditorBlocks(root);
  ensureEditorLineIdentities(root, "note");
  return root.innerHTML.trim() || '<div data-line-id="line-empty"><br></div>';
}

function ensureEditorLineIdentities(root, noteId = "note") {
  if (!root) return;
  const usedIds = new Set();
  Array.from(root.children || []).forEach((line, index) => {
    if (!line || !["DIV", "P"].includes(line.tagName)) return;
    let lineId = String(line.dataset.lineId || "").trim();
    if (!lineId || usedIds.has(lineId)) {
      const prefix = String(noteId || "note").replace(/[^a-zA-Z0-9_-]/g, "").slice(-36) || "note";
      lineId = `${prefix}-line-${index + 1}-${createId("id").slice(-8)}`;
    }
    usedIds.add(lineId);
    line.dataset.lineId = lineId;
  });
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
        const tagStyle = renderCustomTagStyle(getKindMeta(entry.kind));
        lineBits.push(
          `<span class="tag-token tag-${escapeAttribute(entry.kind)}" contenteditable="false" data-tag="${escapeAttribute(
            entry.kind
          )}" data-token-id="${escapeAttribute(createId("tag"))}" data-created-at="${Number(entry.createdAt) || Date.now()}" ${tagStyle}>${escapeHtml(
            getKindMeta(entry.kind)?.label || entry.kind
          )}</span>`
        );
      }
      if (entry.timeTag) {
        lineBits.push(
          `<span class="tag-token tag-time" data-tag="time" data-token-id="${escapeAttribute(createId("tag"))}" data-created-at="${
            Number(entry.createdAt) || Date.now()
          }" data-done="${entry.done ? "true" : "false"}">${escapeHtml(entry.timeTag)}</span>`
        );
      }
      lineBits.push(escapeHtml(entry.text).replace(/\n/g, "<br>"));
      parts.push(`<div>${lineBits.join(" ")}</div>`);
    });

  return parts.join("");
}

function handleNotepadKeydown(event) {
  if (handleEditorSpecialKey(event.key, { shiftKey: event.shiftKey, keyboardEvent: event })) {
    suppressFollowupBeforeInput(event.key);
    event.preventDefault();
    return;
  }
  clearSuppressedBeforeInputForKey(event.key);
}

function handleNotepadBeforeInput(event) {
  const inputType = event.inputType || "";
  const isDeleteInput = inputType === "deleteContentBackward" || inputType === "deleteContentForward";
  const editor = getEditorFromEventTarget(event.target);
  const debugAction = getEditorDebugActionFromBeforeInput(event);
  const debugEntry = debugAction
    ? beginEditorDebugAction(editor, {
        action: debugAction,
        source: "beforeinput",
        inputType,
        dataLength: event.data ? String(event.data).length : 0
      })
    : null;

  if (inputType === "insertParagraph" || inputType.startsWith("insert") || isDeleteInput) {
    clearEditorTapScrollForInput();
  }

  if (inputType === "insertParagraph") {
    if (consumeSuppressedParagraphInput()) {
      return finishEditorDebugHandled(debugEntry, "suppressed-paragraph-beforeinput", editor);
    }

    discardFreshFinalizedTagInsertions();
    const activeToken = getActiveTagToken();
    if (activeToken && activeToken.dataset.tag === "hn" && activeToken.dataset.editing === "true") {
      if (finalizeHnToken(activeToken, { moveToNewLine: true })) {
        return finishEditorDebugHandled(debugEntry, "finalize-hn-tag-enter", editor);
      }
      removeTagToken(activeToken);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "remove-empty-hn-tag-enter", editor);
    }
    if (activeToken && isTimeLikeTag(activeToken.dataset.tag) && activeToken.dataset.editing === "true") {
      finalizeTagToken(activeToken, { moveToNewLine: true });
      return finishEditorDebugHandled(debugEntry, "finalize-time-tag-enter", editor);
    }

    const hnLine = getCurrentEditingHnLine();
    if (hnLine) {
      finalizeEditingHnLine(hnLine);
      return finishEditorDebugHandled(debugEntry, "finalize-hn-line-enter", editor);
    }

    const bedLine = getCurrentEditingBedLine();
    if (bedLine) {
      finalizeEditingBedLine(bedLine);
      return finishEditorDebugHandled(debugEntry, "finalize-bed-line-enter", editor);
    }

    if (handleTaggedLineEnter(editor)) {
      return finishEditorDebugHandled(debugEntry, "handleTaggedLineEnter", editor);
    }
  }

  if (isDeleteInput) {
    if (consumeSuppressedDeleteInput(inputType)) {
      return finishEditorDebugHandled(debugEntry, "suppressed-delete-beforeinput", editor);
    }

    const activeToken = getActiveTagToken();
    if (activeToken && activeToken.dataset.tag === "hn" && activeToken.dataset.editing === "true") {
      handleEditingHnDelete(activeToken, inputType);
      return finishEditorDebugHandled(debugEntry, "handleEditingHnDelete", editor);
    }
    if (activeToken && shouldDeleteEditingTag(activeToken)) {
      removeTagToken(activeToken);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "delete-editing-tag", editor);
    }

    const hnLine = getCurrentEditingHnLine();
    if (hnLine && isEditingHnLineEmpty(hnLine)) {
      removeEditingHnLine(hnLine);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "removeEmptyEditingHnLine", editor);
    }

    if (removeEmptyAutoTodoContinuation(editor)) {
      return finishEditorDebugHandled(debugEntry, "removeEmptyAutoTodoContinuation", editor);
    }

    const freshToken = getFreshFinalizedTagForDelete(editor, inputType);
    if (freshToken && deleteFreshFinalizedTag(freshToken)) {
      return finishEditorDebugHandled(debugEntry, "deleteFreshFinalizedTag", editor);
    }

    const leadingTodoToken = getLeadingTodoTagForDelete(editor);
    if (leadingTodoToken && deleteAdjacentFinalizedTag(leadingTodoToken)) {
      return finishEditorDebugHandled(debugEntry, "deleteLeadingTodoTag", editor);
    }

    const adjacentToken = getAdjacentFinalizedTagForDelete(editor, inputType);
    if (adjacentToken && deleteAdjacentFinalizedTag(adjacentToken)) {
      return finishEditorDebugHandled(debugEntry, "deleteAdjacentFinalizedTag", editor);
    }

    if (removeEmptyEditorLineOnDelete(editor, inputType)) {
      return finishEditorDebugHandled(debugEntry, "removeEmptyEditorLineOnDelete", editor);
    }

    if (inputType === "deleteContentBackward" && blockTaggedLineMergeOnBackspace(editor)) {
      return finishEditorDebugHandled(debugEntry, "blockTaggedLineMergeOnBackspace", editor);
    }

    if (inputType === "deleteContentForward" && blockTaggedLineMergeOnDeleteForward(editor)) {
      return finishEditorDebugHandled(debugEntry, "blockTaggedLineMergeOnDeleteForward", editor);
    }

    const bedLine = getCurrentEditingBedLine();
    if (bedLine && isEditingBedLineEmpty(bedLine)) {
      removeEditingBedLine(bedLine);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "removeEmptyEditingBedLine", editor);
    }
  } else if (inputType.startsWith("insert") || inputType === "formatSetBlockTextDirection") {
    const activeToken = getActiveTagToken();
    if (inputType === "insertText" && activeToken && activeToken.dataset.tag === "hn" && activeToken.dataset.editing === "true") {
      handleEditingHnTextInput(activeToken, event.data || "");
      return finishEditorDebugHandled(debugEntry, "handleEditingHnTextInput", editor);
    }
    if (inputType === "insertText" && activeToken && isTimeLikeTag(activeToken.dataset.tag) && activeToken.dataset.editing === "true") {
      handleEditingTimeTextInput(activeToken, event.data || "");
      return finishEditorDebugHandled(debugEntry, "handleEditingTimeTextInput", editor);
    }

    if (inputType === "insertText" && event.data && shouldManuallyInsertTextIntoEmptyLine(editor)) {
      insertTextAtSelection(event.data);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "insertTextAtSelection-empty-line", editor);
    }

    discardFreshFinalizedTagInsertions();
  }

  return deferEditorInputDebug(debugEntry, "browser-default-beforeinput");
}

function shouldManuallyInsertTextIntoEmptyLine(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const line = getCurrentEditorLine();
  return Boolean(line && isNodeInsideEditor(editor, line) && isEditorLineEmpty(line));
}

function suppressFollowupBeforeInput(key) {
  if (key === "Enter") {
    uiState.suppressNextParagraphInput = true;
    window.setTimeout(() => {
      uiState.suppressNextParagraphInput = false;
    }, 120);
    return;
  }

  if (key === "Backspace" || key === "Delete") {
    const inputType = key === "Delete" ? "deleteContentForward" : "deleteContentBackward";
    uiState.suppressNextDeleteInput = inputType;
    window.setTimeout(() => {
      if (uiState.suppressNextDeleteInput === inputType) {
        uiState.suppressNextDeleteInput = false;
      }
    }, 120);
  }
}

function clearSuppressedBeforeInputForKey(key) {
  if (key === "Enter") {
    uiState.suppressNextParagraphInput = false;
    return;
  }

  if (key === "Backspace" || key === "Delete") {
    uiState.suppressNextDeleteInput = false;
  }
}

function consumeSuppressedParagraphInput() {
  if (!uiState.suppressNextParagraphInput) return false;
  uiState.suppressNextParagraphInput = false;
  return true;
}

function consumeSuppressedDeleteInput(inputType) {
  const suppressed = uiState.suppressNextDeleteInput;
  if (!suppressed) return false;
  if (suppressed === true || suppressed === inputType) {
    uiState.suppressNextDeleteInput = false;
    return true;
  }
  return false;
}

function handleEditingTimeTextInput(token, text) {
  if (!token || !text) return;

  if (isWhitespaceInput(text) && finalizeDefaultTimeTokenWithCurrentTime(token)) {
    return;
  }

  if (!isTimeEditingCharacter(text)) {
    if (isDefaultEditingTimeToken(token)) {
      removeTagToken(token, { restoreRepair: false });
      insertTextAtSelection(text);
      syncEditorDocument();
      return;
    }
    finalizeTagToken(token, { moveToNewLine: false });
    insertTextAtSelection(text);
    syncEditorDocument();
    return;
  }

  const currentText = String(token.textContent || "");
  const selectionRange = getTokenTextSelectionRange(token);
  const start = selectionRange ? selectionRange.start : currentText.length;
  const end = selectionRange ? selectionRange.end : currentText.length;
  const nextText = `${currentText.slice(0, start)}${text}${currentText.slice(end)}`;
  const nextOffset = start + text.length;
  const completed = extractCompletedTimeTokenText(nextText);
  delete token.dataset.defaultTime;

  if (completed) {
    token.textContent = normalizeTimeTagValue(completed.timePart) || completed.timePart;
    finalizeTagToken(token, { moveToNewLine: false });
    const trailingText = completed.trailingText.replace(/^\s+/, "");
    if (trailingText) {
      insertTextAtSelection(trailingText);
    }
    syncEditorDocument();
    return;
  }

  token.textContent = nextText;
  placeCaretInsideTextNode(token, nextOffset);
  syncEditorDocument();
}

function handleEditingHnTextInput(token, text) {
  if (!token || token.dataset.editing !== "true") return false;
  const digitsToInsert = String(text || "").replace(/\D/g, "");
  if (!digitsToInsert) return true;

  const currentDigits = getHnNumber(token);
  const selectionRange = getTokenTextSelectionRange(token);
  const prefixLength = getHnPrefixLength(token);
  const start = selectionRange ? Math.max(0, selectionRange.start - prefixLength) : currentDigits.length;
  const end = selectionRange ? Math.max(start, selectionRange.end - prefixLength) : currentDigits.length;
  const nextDigits = `${currentDigits.slice(0, start)}${digitsToInsert}${currentDigits.slice(end)}`.slice(0, 20);
  const nextOffset = Math.min(nextDigits.length, start + digitsToInsert.length);
  setEditingHnValue(token, nextDigits, nextOffset);
  syncEditorDocument();
  return true;
}

function handleEditingHnDelete(token, inputType) {
  if (!token || token.dataset.editing !== "true") return false;
  const currentDigits = getHnNumber(token);
  if (!currentDigits) {
    removeTagToken(token);
    syncEditorDocument();
    return true;
  }

  const selectionRange = getTokenTextSelectionRange(token);
  const prefixLength = getHnPrefixLength(token);
  let start = selectionRange ? Math.max(0, selectionRange.start - prefixLength) : currentDigits.length;
  let end = selectionRange ? Math.max(start, selectionRange.end - prefixLength) : currentDigits.length;
  start = Math.min(start, currentDigits.length);
  end = Math.min(end, currentDigits.length);

  if (start === end) {
    if (inputType === "deleteContentForward") {
      end = Math.min(currentDigits.length, end + 1);
    } else {
      start = Math.max(0, start - 1);
    }
  }

  const nextDigits = `${currentDigits.slice(0, start)}${currentDigits.slice(end)}`;
  setEditingHnValue(token, nextDigits, start);
  syncEditorDocument();
  return true;
}

function setEditingHnValue(token, digits, caretDigitOffset = String(digits || "").length) {
  const normalizedDigits = String(digits || "").replace(/\D/g, "").slice(0, 20);
  token.textContent = normalizedDigits ? `HN ${normalizedDigits}` : "HN ";
  token.dataset.hnValue = normalizedDigits;
  placeCaretInsideTextNode(token, getHnPrefixLength(token) + Math.min(normalizedDigits.length, caretDigitOffset));
}

function getHnPrefixLength(token) {
  return String(token?.textContent || "").match(/^HN\s*/i)?.[0]?.length || 3;
}

function getHnNumber(token) {
  const stored = String(token?.dataset?.hnValue || "").replace(/\D/g, "");
  if (stored) return stored.slice(0, 20);
  return String(token?.textContent || "").replace(/^HN\s*/i, "").replace(/\D/g, "").slice(0, 20);
}

function finalizeHnToken(token, { moveToNewLine = false } = {}) {
  const digits = getHnNumber(token);
  if (!token || !digits) return false;
  token.textContent = `HN ${digits}`;
  token.dataset.hnValue = digits;
  token.dataset.editing = "false";
  token.setAttribute("contenteditable", "false");
  token.setAttribute("role", "button");
  token.setAttribute("tabindex", "0");
  token.setAttribute("aria-label", `HN ${digits}. Copy number`);
  token.setAttribute("title", "Copy HN number");
  token.classList.remove("tag-editing");
  discardPendingTagInsertion(token);
  const line = findEditorLine(token);
  refreshLineTagClasses(line);
  if (moveToNewLine) {
    placeCaretOnNewLine(line || token);
  } else {
    placeCaretAfterNode(token, true);
  }
  syncEditorDocument();
  return true;
}

async function copyHnNumber(token) {
  const digits = getHnNumber(token);
  if (!digits) return false;
  let copied = false;
  try {
    await navigator.clipboard.writeText(digits);
    copied = true;
  } catch {
    copied = copyTextWithFallback(digits);
  }

  if (copied) {
    token.classList.add("is-copied");
    token.setAttribute("aria-label", `HN ${digits}. Number copied`);
    window.setTimeout(() => {
      token.classList.remove("is-copied");
      token.setAttribute("aria-label", `HN ${digits}. Copy number`);
    }, 850);
  }
  appendEditorDebugLog({
    action: "copy-hn-number",
    source: "hn-tag",
    success: copied,
    handledBy: copied ? "clipboard" : "clipboard-failed",
    before: null,
    after: captureEditorCaretDebugSnapshot(refs.editorRoot.querySelector("#notepad-editor"))
  });
  return copied;
}

function copyTextWithFallback(text) {
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  input.remove();
  return copied;
}

function getTokenTextSelectionRange(token) {
  const selection = window.getSelection();
  const textNode = token?.firstChild;
  if (!selection || !textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

  const selectedText = String(selection.toString() || "");
  const tokenText = String(token.textContent || "");
  if (selectedText === tokenText) {
    return { start: 0, end: tokenText.length };
  }

  if (!token.contains(selection.anchorNode) || !token.contains(selection.focusNode)) {
    return null;
  }

  const anchorOffset = selection.anchorNode === textNode ? selection.anchorOffset : tokenText.length;
  const focusOffset = selection.focusNode === textNode ? selection.focusOffset : anchorOffset;
  return {
    start: Math.max(0, Math.min(anchorOffset, focusOffset)),
    end: Math.min(tokenText.length, Math.max(anchorOffset, focusOffset))
  };
}

function placeCaretInsideTextNode(node, offset) {
  if (!node) return;
  const selection = window.getSelection();
  if (!selection) return;

  let textNode = node.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    textNode = document.createTextNode("");
    node.appendChild(textNode);
  }

  const range = document.createRange();
  range.setStart(textNode, Math.min(Math.max(0, offset), textNode.textContent.length));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function handleEditorSpecialKey(key, { shiftKey = false, keyboardEvent = null } = {}) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  const debugAction = getEditorDebugActionFromKey(key);
  const debugEntry = debugAction
    ? beginEditorDebugAction(editor, {
        action: debugAction,
        source: "keydown",
        key
      })
    : null;
  const editingHnLine = getCurrentEditingHnLine();
  if (editingHnLine) {
    if (key === "Escape") {
      removeEditingHnLine(editingHnLine);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "removeEditingHnLine-escape", editor);
    }

    if (key === "Enter" || key === "Tab") {
      finalizeEditingHnLine(editingHnLine);
      return finishEditorDebugHandled(debugEntry, "finalizeEditingHnLine", editor);
    }

    if ((key === "Backspace" || key === "Delete") && isEditingHnLineEmpty(editingHnLine)) {
      removeEditingHnLine(editingHnLine);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "removeEmptyEditingHnLine", editor);
    }
  }

  const editingBedLine = getCurrentEditingBedLine();
  if (editingBedLine) {
    if (key === "Escape") {
      removeEditingBedLine(editingBedLine);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "removeEditingBedLine-escape", editor);
    }

    if (key === "Enter" || key === "Tab") {
      finalizeEditingBedLine(editingBedLine);
      return finishEditorDebugHandled(debugEntry, "finalizeEditingBedLine", editor);
    }
  }

  const token = getActiveTagToken();
  if (token) {
    if (key === "Escape") {
      removeTagToken(token);
      syncEditorDocument();
      return finishEditorDebugHandled(debugEntry, "removeActiveTag-escape", editor);
    }

    const tagType = token.dataset.tag;
    if (tagType === "hn" && token.dataset.editing === "true") {
      if (key === "Enter" || key === "Tab") {
        const finalized = finalizeHnToken(token, { moveToNewLine: key === "Enter" });
        if (!finalized) {
          removeTagToken(token);
          syncEditorDocument();
        }
        return finishEditorDebugHandled(debugEntry, finalized ? "finalize-hn-tag" : "remove-empty-hn-tag", editor);
      }

      if (key === "Backspace" || key === "Delete") {
        handleEditingHnDelete(token, key === "Delete" ? "deleteContentForward" : "deleteContentBackward");
        return finishEditorDebugHandled(debugEntry, "handleEditingHnDelete", editor);
      }

      if (keyboardEvent && isPrintableKey(keyboardEvent)) {
        handleEditingHnTextInput(token, key);
        return finishEditorDebugHandled(debugEntry, "handleEditingHnTextInput", editor);
      }
    }
    if (tagType === "bed" && (key === " " || key === "Tab")) {
      finalizeTagToken(token, { moveToNewLine: true });
      return finishEditorDebugHandled(debugEntry, "finalize-bed-tag-space-tab", editor);
    }

    if (isTimeLikeTag(tagType) && token.dataset.editing === "true") {
      if (key === " " || key === "Tab") {
        if (key === " " && finalizeDefaultTimeTokenWithCurrentTime(token)) {
          return finishEditorDebugHandled(debugEntry, "finalizeDefaultTimeTokenWithCurrentTime", editor);
        }
        finalizeTagToken(token, { moveToNewLine: false });
        return finishEditorDebugHandled(debugEntry, "finalize-time-tag-space-tab", editor);
      }

      const isPrintable = keyboardEvent ? isPrintableKey(keyboardEvent) : key.length === 1;
      if (isPrintable && isTimeEditingCharacter(key)) {
        handleEditingTimeTextInput(token, key);
        return finishEditorDebugHandled(debugEntry, "handleEditingTimeTextInput", editor);
      }

      if (isPrintable && !isTimeEditingCharacter(key)) {
        if (isDefaultEditingTimeToken(token)) {
          removeTagToken(token, { restoreRepair: false });
          insertTextAtSelection(key);
          syncEditorDocument();
          return finishEditorDebugHandled(debugEntry, "replace-default-time-tag-with-text", editor);
        }
        finalizeTagToken(token, { moveToNewLine: false });
        insertTextAtSelection(key);
        syncEditorDocument();
        return finishEditorDebugHandled(debugEntry, "finalize-time-tag-before-text", editor);
      }
    }

    if (tagType === "bed" && key === "Enter") {
      finalizeTagToken(token, { moveToNewLine: true });
      return finishEditorDebugHandled(debugEntry, "finalize-bed-tag-enter", editor);
    }

    if (isTimeLikeTag(tagType) && key === "Enter") {
      finalizeTagToken(token, { moveToNewLine: true });
      return finishEditorDebugHandled(debugEntry, "finalize-time-tag-enter", editor);
    }
  }

  if (key === "Backspace" || key === "Delete") {
    if (removeEmptyAutoTodoContinuation(editor)) {
      return finishEditorDebugHandled(debugEntry, "removeEmptyAutoTodoContinuation", editor);
    }

    const inputType = key === "Delete" ? "deleteContentForward" : "deleteContentBackward";
    const freshToken = getFreshFinalizedTagForDelete(editor, inputType);
    if (freshToken && deleteFreshFinalizedTag(freshToken)) {
      return finishEditorDebugHandled(debugEntry, "deleteFreshFinalizedTag", editor);
    }

    const leadingTodoToken = getLeadingTodoTagForDelete(editor);
    if (leadingTodoToken && deleteAdjacentFinalizedTag(leadingTodoToken)) {
      return finishEditorDebugHandled(debugEntry, "deleteLeadingTodoTag", editor);
    }

    const adjacentToken = getAdjacentFinalizedTagForDelete(editor, inputType);
    if (adjacentToken && deleteAdjacentFinalizedTag(adjacentToken)) {
      return finishEditorDebugHandled(debugEntry, "deleteAdjacentFinalizedTag", editor);
    }

    if (removeEmptyEditorLineOnDelete(editor, inputType)) {
      return finishEditorDebugHandled(debugEntry, "removeEmptyEditorLineOnDelete", editor);
    }

    if (inputType === "deleteContentBackward" && blockTaggedLineMergeOnBackspace(editor)) {
      return finishEditorDebugHandled(debugEntry, "blockTaggedLineMergeOnBackspace", editor);
    }

    if (inputType === "deleteContentForward" && blockTaggedLineMergeOnDeleteForward(editor)) {
      return finishEditorDebugHandled(debugEntry, "blockTaggedLineMergeOnDeleteForward", editor);
    }
  }

  if (key === "Enter" && !shiftKey) {
    if (handleTaggedLineEnter(editor)) {
      return finishEditorDebugHandled(debugEntry, "handleTaggedLineEnter", editor);
    }
    if (insertPlainEditorLineBreak(editor)) {
      return finishEditorDebugHandled(debugEntry, "insertPlainEditorLineBreak", editor);
    }
  }

  return finishEditorDebugUnhandled(debugEntry, "browser-default-keydown", editor);
}

function handleTaggedLineEnter(editor) {
  if (!editor) return false;
  const currentLine = getCurrentEditorLine();
  if (!currentLine || !isNodeInsideEditor(editor, currentLine)) return false;

  if (removeEmptyAutoTodoContinuation(editor)) {
    return true;
  }

  if (currentLine.querySelector('.tag-token[data-tag="todo"]')) {
    insertAutoTodoContinuationLineAfter(editor, currentLine);
    return true;
  }

  if (currentLine.classList.contains("timed-line") || currentLine.classList.contains("io-line")) {
    placeCaretOnNewLine(currentLine);
    syncEditorDocument();
    rememberEditorSelection(editor);
    return true;
  }

  return false;
}

function insertPlainEditorLineBreak(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return false;
  const currentLine = getCurrentEditorLine();
  if (!currentLine || !isNodeInsideEditor(editor, currentLine)) return false;

  const range = selection.getRangeAt(0);
  if (!selection.isCollapsed) {
    range.deleteContents();
  }

  const newLine = document.createElement("div");
  const afterRange = document.createRange();
  afterRange.selectNodeContents(currentLine);
  try {
    afterRange.setStart(range.startContainer, range.startOffset);
  } catch {
    newLine.innerHTML = "<br>";
  }

  if (!newLine.innerHTML) {
    const fragment = afterRange.extractContents();
    newLine.appendChild(fragment);
  }

  if (isEditorLineEmpty(currentLine)) {
    currentLine.innerHTML = "<br>";
  }
  if (isEditorLineEmpty(newLine)) {
    newLine.innerHTML = "<br>";
  }

  currentLine.parentNode.insertBefore(newLine, currentLine.nextSibling);
  placeCaretInsideLine(newLine);
  syncEditorDocument();
  rememberEditorSelection(editor);
  return true;
}

function insertAutoTodoContinuationLineAfter(editor, referenceLine) {
  const tokenId = createId("tag");
  const line = document.createElement("div");
  line.innerHTML = `${renderTodoTokenHtml(tokenId, false, { autoContinuation: true })}&nbsp;`;

  if (referenceLine.nextSibling) {
    referenceLine.parentNode.insertBefore(line, referenceLine.nextSibling);
  } else {
    referenceLine.parentNode.appendChild(line);
  }

  refreshLineTagClasses(line);
  placeCaretAtEndOfLine(line);
  syncEditorDocument();
  rememberEditorSelection(editor);
}

function removeEmptyAutoTodoContinuation(editor) {
  const line = getCurrentEditorLine();
  if (!editor || !line || !isNodeInsideEditor(editor, line)) return false;
  if (!isEmptyAutoTodoContinuationLine(line)) return false;

  const token = line.querySelector('.tag-token[data-tag="todo"][data-auto-continuation="true"]');
  consumePendingTagInsertion(token);
  removeInsertedTagSpacer(token);
  removeTagCaretBoundaries(token);
  token?.remove();
  line.innerHTML = "<br>";
  refreshLineTagClasses(line);
  placeCaretInsideLine(line);
  syncEditorDocument();
  rememberEditorSelection(editor);
  return true;
}

function isEmptyAutoTodoContinuationLine(line) {
  const token = line?.querySelector?.('.tag-token[data-tag="todo"][data-auto-continuation="true"]');
  if (!token) return false;
  const extraTags = Array.from(line.querySelectorAll(".tag-token")).some((candidate) => candidate !== token);
  if (extraTags) return false;
  return getEditableTextFromLine(line).trim() === "";
}

function deleteFreshFinalizedTag(token) {
  const pendingInsertion = getPendingTagInsertion(token);
  if (uiState.lastInsertedTagTokenId === token?.dataset?.tokenId) {
    uiState.lastInsertedTagTokenId = "";
  }
  removeTagToken(token, { restoreRepair: false });
  syncEditorDocument();
  restorePendingInsertionTextOffset(pendingInsertion);
  return true;
}

function deleteAdjacentFinalizedTag(token) {
  if (!token || token.dataset.editing === "true") return false;
  const line = findEditorLine(token);
  const parent = token.parentNode;
  if (!line || !parent) return false;

  const marker = document.createTextNode("\u200b");
  parent.insertBefore(marker, token);
  consumePendingTagInsertion(token);
  removeInsertedTagSpacer(token);
  removeTagCaretBoundaries(token);
  token.remove();

  if (String(line.textContent || "").replace(/\u200b/g, "").trim() === "") {
    line.innerHTML = "<br>";
    placeCaretInsideLine(line);
  } else {
    const selection = window.getSelection();
    if (selection && marker.isConnected) {
      const range = document.createRange();
      range.setStartAfter(marker);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  refreshLineTagClasses(line);
  syncEditorDocument();
  rememberEditorSelection(refs.editorRoot.querySelector("#notepad-editor"));
  return true;
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

  prepareLineForSingleTagInsertion(editor);
  const insertionPoint = getEditorSelectionPoint(editor);

  if (tag === "bed") {
    const tokenId = createId("tag");
    const insertion = insertBedEditorLine(
      editor,
      `<span class="tag-token tag-bed tag-editing" contenteditable="false" data-tag="bed" data-token-id="${escapeAttribute(
        tokenId
      )}" data-editing="true">Bed</span>&nbsp;`
    );
    rememberPendingTagInsertion(tokenId, editor, insertionPoint, {
      placedBeforeExistingLine: insertion.placedBeforeExistingLine
    });
    placeCaretAtEndOfLine(insertion.line);
    rememberEditorSelection(editor);
    return;
  }

  if (tag === "hn") {
    const tokenId = createId("tag");
    const insertion = insertBedEditorLine(
      editor,
      `<span class="tag-token tag-hn tag-editing" contenteditable="false" data-tag="hn" data-token-id="${escapeAttribute(
        tokenId
      )}" data-hn-value="" data-editing="true">HN</span>&nbsp;`
    );
    rememberPendingTagInsertion(tokenId, editor, insertionPoint, {
      placedBeforeExistingLine: insertion.placedBeforeExistingLine
    });
    placeCaretAtEndOfLine(insertion.line);
    rememberEditorSelection(editor);
    return;
  }

  if (tag === "time" || tag === "lab") {
    const tokenId = createId("tag");
    const createdAt = Date.now();
    insertHtmlAtSelection(
      `<span class="tag-token tag-${escapeAttribute(tag)} tag-editing" data-tag="${escapeAttribute(tag)}" data-token-id="${escapeAttribute(
        tokenId
      )}" data-created-at="${createdAt}" data-done="false" data-editing="true" data-default-time="true">00.00</span>`
    );
    const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
    rememberPendingTagInsertion(tokenId, editor, insertionPoint);
    placeCaretInsideTag(inserted, true);
    return;
  }

  if (tag === "io") {
    const tokenId = createId("tag");
    const createdAt = Date.now();
    insertHtmlAtSelection(
      `<span class="tag-token tag-io" contenteditable="false" data-tag="io" data-token-id="${escapeAttribute(
        tokenId
      )}" data-created-at="${createdAt}" data-done-14="false" data-done-22="false">I/O</span>`
    );
    const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
    rememberPendingTagInsertion(tokenId, editor, insertionPoint, { finalized: true });
    placeCaretAfterNode(inserted, true);
    syncEditorDocument();
    return;
  }

  if (tag === "todo") {
    insertTodoTagIntoLine(editor, insertionPoint);
    return;
  }

  const tokenId = createId("tag");
  const tagMeta = getKindMeta(tag);
  const label = tagMeta?.label || tag;
  const tagStyle = renderCustomTagStyle(tagMeta);
  const createdAt = Date.now();
  insertHtmlAtSelection(
    `<span class="tag-token tag-${escapeAttribute(tag)}" contenteditable="false" data-tag="${escapeAttribute(tag)}" data-token-id="${escapeAttribute(
      tokenId
    )}" data-created-at="${createdAt}" ${tagStyle}>${escapeHtml(label)}</span>`
  );
  const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
  rememberPendingTagInsertion(tokenId, editor, insertionPoint, { finalized: true });
  placeCaretAfterNode(inserted, true);
}

function prepareLineForSingleTagInsertion(editor) {
  const selection = window.getSelection();
  const line = getCurrentEditorLine();
  if (!editor || !selection || !line || !isNodeInsideEditor(editor, line)) return;

  const tokens = Array.from(line.querySelectorAll(".tag-token"));
  if (!tokens.length) return;

  const activeToken = getActiveTagToken();
  const referenceToken = activeToken && line.contains(activeToken) ? activeToken : tokens[0];
  const marker = document.createTextNode("");
  line.insertBefore(marker, referenceToken);

  tokens.forEach((token) => {
    consumePendingTagInsertion(token);
    removeInsertedTagSpacer(token);
    removeTagCaretBoundaries(token);
    token.remove();
  });

  if (line.firstChild?.nodeType === Node.TEXT_NODE) {
    line.firstChild.textContent = line.firstChild.textContent.replace(/^\u00a0+/, "");
  }

  refreshLineTagClasses(line);
  const range = document.createRange();
  range.setStartBefore(marker);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  marker.remove();

  if (isEditorLineEmpty(line)) {
    line.innerHTML = "";
    const emptyRange = document.createRange();
    emptyRange.selectNodeContents(line);
    emptyRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(emptyRange);
  }
}

function insertTodoTagIntoLine(editor, insertionPoint) {
  const selection = window.getSelection();
  const tokenId = createId("tag");
  const tokenHtml = renderTodoTokenHtml(tokenId);
  let line = getCurrentEditorLine();

  if (!line || !isNodeInsideEditor(editor, line)) {
    line = insertEditorLine(editor, `${tokenHtml}&nbsp;`);
  } else {
    line.querySelectorAll(".tag-token").forEach((token) => {
      consumePendingTagInsertion(token);
      removeInsertedTagSpacer(token);
      removeTagCaretBoundaries(token);
      token.remove();
    });

    if (line.firstChild?.nodeType === Node.TEXT_NODE) {
      line.firstChild.textContent = line.firstChild.textContent.replace(/^\u00a0+/, "");
    }

    line.insertAdjacentHTML("afterbegin", `${tokenHtml}&nbsp;`);
  }

  refreshLineTagClasses(line);
  const inserted = editor.querySelector(`[data-token-id="${cssEscape(tokenId)}"]`);
  rememberPendingTagInsertion(tokenId, editor, insertionPoint, { finalized: true });

  if (selection && line) {
    placeCaretAtEndOfLine(line);
    rememberEditorSelection(editor);
  } else {
    placeCaretAfterNode(inserted, true);
  }

  syncEditorDocument();
}

function renderTodoTokenHtml(tokenId, done = false, options = {}) {
  const autoContinuationAttr = options.autoContinuation ? ' data-auto-continuation="true"' : "";
  return `<span class="tag-token tag-todo" contenteditable="false" data-tag="todo" data-token-id="${escapeAttribute(
    tokenId
  )}" data-done="${done ? "true" : "false"}"${autoContinuationAttr} role="checkbox" aria-checked="${done ? "true" : "false"}" aria-label="To-do item"></span>`;
}

function ensureSelectionLineForInsertion(range) {
  let line = getCurrentEditorLine();
  if (line) return line;

  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!editor) return null;

  line = document.createElement("div");
  line.innerHTML = "<br>";

  if (range.startContainer === editor && range.startOffset < editor.childNodes.length) {
    editor.insertBefore(line, editor.childNodes[range.startOffset]);
  } else {
    editor.appendChild(line);
  }

  range.selectNodeContents(line);
  range.collapse(true);
  return line;
}

function getEditorFromEventTarget(target) {
  if (!target) return null;
  const element =
    target.nodeType === Node.ELEMENT_NODE
      ? target
      : target.parentElement || target.parentNode;
  return element?.closest?.("#notepad-editor") || null;
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
  const currentLine = ensureSelectionLineForInsertion(range);
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

function handleNotepadPaste(event) {
  const editor = getEditorFromEventTarget(event.target);
  if (!editor) return;

  const clipboard = event.clipboardData;
  const pastedHtml = clipboard?.getData("text/html") || "";
  const pastedText = clipboard?.getData("text/plain") || "";
  const useClipboardHtml = shouldUseClipboardHtmlForPaste(pastedHtml, pastedText);
  const debugEntry = beginEditorDebugAction(editor, {
    action: "paste",
    source: "clipboard",
    htmlLength: pastedHtml.length,
    textLength: pastedText.length,
    pasteMode: useClipboardHtml ? "html-tags" : "plain-text"
  });
  const sanitizedHtml = sanitizeClipboardHtml(pastedHtml, pastedText);
  if (!sanitizedHtml) {
    finishEditorDebugUnhandled(debugEntry, "empty-clipboard-paste", editor, {
      htmlLength: pastedHtml.length,
      textLength: pastedText.length,
      pasteMode: useClipboardHtml ? "html-tags" : "plain-text"
    });
    return;
  }

  event.preventDefault();
  editor.focus({ preventScroll: true });
  insertHtmlAtSelection(sanitizedHtml);
  syncEditorDocument();
  rememberEditorSelection(editor);
  hideBedIndex();
  queueEditorCaretVisibilityCheck(editor, "paste");
  finishEditorDebugHandled(debugEntry, "handleNotepadPaste", editor, {
    htmlLength: pastedHtml.length,
    textLength: pastedText.length,
    pasteMode: useClipboardHtml ? "html-tags" : "plain-text",
    insertedLineCount: countClipboardEditorLines(sanitizedHtml)
  });
}

function sanitizeClipboardHtml(html, plainText = "") {
  if (plainText && !shouldUseClipboardHtmlForPaste(html, plainText)) {
    return plainTextToEditorHtml(plainText);
  }

  if (html) {
    const root = parseHtmlRoot(html);
    sanitizePastedDom(root);
    normalizeEditorBlocks(root);
    const sanitized = root.innerHTML.trim();
    if (sanitized && sanitized !== "<br>") {
      return sanitized;
    }
  }

  return plainTextToEditorHtml(plainText);
}

function shouldUseClipboardHtmlForPaste(html, plainText = "") {
  if (!html) return false;
  if (!plainText) return true;
  return clipboardHtmlContainsPreservableTags(html);
}

function clipboardHtmlContainsPreservableTags(html) {
  if (!html) return false;
  const root = parseHtmlRoot(html);
  return Array.from(root.querySelectorAll?.(".tag-token") || []).some((token) =>
    isPreservablePastedTag(String(token.dataset.tag || "").trim())
  );
}

function countClipboardEditorLines(html) {
  const root = parseHtmlRoot(html);
  const lineCount = Array.from(root.childNodes || []).filter(
    (node) => node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)
  ).length;
  return lineCount || (String(root.textContent || "").trim() ? 1 : 0);
}

function sanitizePastedDom(root) {
  Array.from(root.querySelectorAll("*")).forEach((element) => {
    if (!root.contains(element)) return;

    if (element.classList?.contains("tag-token")) {
      element.replaceWith(createCleanPastedTagToken(element));
      return;
    }

    if (element.tagName === "BR") {
      stripElementAttributes(element);
      return;
    }

    if (["DIV", "P", "SPAN"].includes(element.tagName)) {
      stripElementAttributes(element);
      return;
    }

    if (isPastedBlockElement(element)) {
      const replacement = element.ownerDocument.createElement("div");
      while (element.firstChild) {
        replacement.appendChild(element.firstChild);
      }
      element.replaceWith(replacement);
      return;
    }

    unwrapPastedElement(element);
  });
}

function createCleanPastedTagToken(token) {
  const doc = token.ownerDocument;
  const tag = String(token.dataset.tag || "").trim();
  if (!isPreservablePastedTag(tag)) {
    return doc.createTextNode(token.textContent || "");
  }

  const clean = doc.createElement("span");
  clean.classList.add("tag-token");
  if (/^[\w-]+$/.test(tag)) {
    clean.classList.add(`tag-${tag}`);
  }
  clean.dataset.tag = tag;
  clean.dataset.tokenId = createId("tag");
  clean.dataset.createdAt = String(Number(token.dataset.createdAt || 0) || Date.now());
  clean.setAttribute("contenteditable", "false");

  if (tag === "todo") {
    const done = token.dataset.done === "true";
    clean.classList.add("tag-todo");
    clean.dataset.done = done ? "true" : "false";
    clean.setAttribute("role", "checkbox");
    clean.setAttribute("aria-checked", done ? "true" : "false");
    clean.setAttribute("aria-label", "To-do item");
    return clean;
  }

  if (tag === "hn") {
    const digits = getHnNumber(token);
    if (!digits) return doc.createTextNode(token.textContent || "");
    clean.classList.add("tag-hn");
    clean.dataset.hnValue = digits;
    clean.dataset.editing = "false";
    clean.setAttribute("role", "button");
    clean.setAttribute("tabindex", "0");
    clean.setAttribute("aria-label", `HN ${digits}. Copy number`);
    clean.setAttribute("title", "Copy HN number");
    clean.textContent = `HN ${digits}`;
    return clean;
  }

  if (tag === "io") {
    clean.classList.add("tag-io");
    clean.setAttribute("data-done-14", token.getAttribute("data-done-14") === "true" ? "true" : "false");
    clean.setAttribute("data-done-22", token.getAttribute("data-done-22") === "true" ? "true" : "false");
    clean.textContent = "I/O";
    return clean;
  }

  if (tag === "bed") {
    clean.classList.add("tag-bed");
    const rawBed = String(token.textContent || "").replace(/\u00a0/g, " ").trim();
    clean.textContent = /^Bed\b/i.test(rawBed) ? rawBed : `Bed ${rawBed}`.trim();
    return clean;
  }

  if (tag === "time" || tag === "lab") {
    clean.classList.add(`tag-${tag}`);
    clean.dataset.done = token.dataset.done === "true" ? "true" : "false";
    clean.textContent = normalizeTimeTagValue(token.textContent) || formatTimeFromTimestamp(Date.now());
    return clean;
  }

  const customTag = getCustomTagDefinition(tag);
  clean.textContent = String(token.textContent || customTag?.label || tag).replace(/\u00a0/g, " ").trim();
  if (customTag?.color) {
    clean.style.setProperty("--custom-tag-color", customTag.color);
  }
  return clean;
}

function isPreservablePastedTag(tag) {
  return ["bed", "hn", "time", "lab", "io", "todo"].includes(tag) || Boolean(getCustomTagDefinition(tag));
}

function stripElementAttributes(element) {
  Array.from(element.attributes || []).forEach((attribute) => {
    element.removeAttribute(attribute.name);
  });
}

function isPastedBlockElement(element) {
  return [
    "ADDRESS",
    "ARTICLE",
    "ASIDE",
    "BLOCKQUOTE",
    "DD",
    "DL",
    "DT",
    "FIGCAPTION",
    "FIGURE",
    "FOOTER",
    "FORM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HEADER",
    "HR",
    "LI",
    "MAIN",
    "NAV",
    "OL",
    "PRE",
    "SECTION",
    "TABLE",
    "TBODY",
    "TD",
    "TFOOT",
    "TH",
    "THEAD",
    "TR",
    "UL"
  ].includes(element.tagName);
}

function unwrapPastedElement(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  element.remove();
}

function plainTextToEditorHtml(text) {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  if (!normalized) return "";
  const lines = normalized.split("\n");
  if (lines.length === 1) {
    return escapeHtml(lines[0]);
  }
  return lines.map((line) => `<div>${line ? escapeHtml(line) : "<br>"}</div>`).join("");
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

function insertBedEditorLine(editor, html) {
  const line = document.createElement("div");
  line.innerHTML = html || "<br>";

  const currentLine = getCurrentEditorLine();
  if (currentLine && currentLine.parentNode === editor) {
    if (isEditorLineEmpty(currentLine)) {
      currentLine.replaceWith(line);
      return { line, placedBeforeExistingLine: false };
    }

    editor.insertBefore(line, currentLine);
    return { line, placedBeforeExistingLine: true };
  }

  editor.appendChild(line);
  return { line, placedBeforeExistingLine: false };
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
  if (options.finalized) {
    uiState.lastInsertedTagTokenId = tokenId;
  }
  uiState.pendingTagInsertions.set(tokenId, {
    editor,
    node: point.node,
    offset: point.offset,
    line: point.line,
    lineHtml: point.lineHtml,
    textOffset: point.textOffset,
    finalized: Boolean(options.finalized),
    placedBeforeExistingLine: Boolean(options.placedBeforeExistingLine)
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
  const currentLine = ensureSelectionLineForInsertion(range);
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

  if (removeEmptyEditorLineOnDelete(editor, "deleteContentBackward")) {
    return;
  }

  if (blockTaggedLineMergeOnBackspace(editor)) {
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

function blockTaggedLineMergeOnBackspace(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const currentLine = getCurrentEditorLine();
  const previousLine = getPreviousEditorLine(currentLine);
  if (!currentLine || !previousLine) return false;
  if (!isSelectionAtStartOfLine(currentLine, selection)) return false;
  if (!lineHasTag(currentLine) && !lineHasTag(previousLine)) return false;

  if (isEditorLineEmpty(currentLine)) {
    currentLine.remove();
    placeCaretAtEndOfLine(previousLine);
    syncEditorDocument();
    rememberEditorSelection(editor);
    return true;
  }

  if (mergePlainLineIntoBedHeaderLine(editor, previousLine, currentLine)) {
    return true;
  }

  placeCaretAtEndOfLine(previousLine);
  rememberEditorSelection(editor);
  return true;
}

function blockTaggedLineMergeOnDeleteForward(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const currentLine = getCurrentEditorLine();
  const nextLine = getNextEditorLine(currentLine);
  if (!currentLine || !nextLine) return false;
  if (!isSelectionAtEndOfLine(currentLine, selection)) return false;
  if (!lineHasTag(currentLine) && !lineHasTag(nextLine)) return false;

  if (isEditorLineEmpty(nextLine)) {
    nextLine.remove();
    placeCaretAtEndOfLine(currentLine);
    syncEditorDocument();
    rememberEditorSelection(editor);
    return true;
  }

  if (mergePlainLineIntoBedHeaderLine(editor, currentLine, nextLine)) {
    return true;
  }

  placeCaretAtEndOfLine(currentLine);
  rememberEditorSelection(editor);
  return true;
}

function mergePlainLineIntoBedHeaderLine(editor, bedLine, textLine) {
  if (!editor || !isBedHeaderOnlyEditorLine(bedLine) || !textLine) return false;
  if (lineHasTag(textLine) || isEditorLineEmpty(textLine)) return false;

  const movableNodes = Array.from(textLine.childNodes || []).filter((node) => !isLineBreakNode(node));
  if (!movableNodes.length) return false;

  bedLine.appendChild(document.createTextNode(" "));
  movableNodes.forEach((node) => bedLine.appendChild(node));
  textLine.remove();
  refreshLineTagClasses(bedLine);
  ensureTagCaretBoundaries(bedLine);
  placeCaretAtEndOfLine(bedLine);
  syncEditorDocument();
  rememberEditorSelection(editor);
  return true;
}

function isBedHeaderOnlyEditorLine(line) {
  if (!line) return false;
  const tags = Array.from(line.querySelectorAll?.(".tag-token") || []);
  return tags.length === 1 && tags[0].dataset.tag === "bed" && getEditableTextFromLine(line).trim() === "";
}

function removeEmptyEditorLineOnDelete(editor, inputType) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const currentLine = getCurrentEditorLine();
  if (!currentLine || !isNodeInsideEditor(editor, currentLine)) return false;
  if (!isEditorLineEmpty(currentLine)) {
    if (inputType === "deleteContentBackward" && isSelectionAtStartOfLine(currentLine, selection)) {
      const previousLine = getPreviousEditorLine(currentLine);
      if (!previousLine || !isEditorLineEmpty(previousLine)) return false;
      previousLine.remove();
      placeCaretAtStartOfLine(currentLine);
      syncEditorDocument();
      rememberEditorSelection(editor);
      return true;
    }

    if (inputType === "deleteContentForward" && isSelectionAtEndOfLine(currentLine, selection)) {
      const nextLine = getNextEditorLine(currentLine);
      if (!nextLine || !isEditorLineEmpty(nextLine)) return false;
      nextLine.remove();
      placeCaretAtEndOfLine(currentLine);
      syncEditorDocument();
      rememberEditorSelection(editor);
      return true;
    }

    return false;
  }

  const previousLine = getPreviousEditorLine(currentLine);
  const nextLine = getNextEditorLine(currentLine);
  if (!previousLine && !nextLine) return false;

  if (inputType === "deleteContentBackward") {
    if (!previousLine || !isSelectionAtStartOfLine(currentLine, selection)) return false;
    currentLine.remove();
    if (isEditorLineEmpty(previousLine)) {
      previousLine.innerHTML = "<br>";
      placeCaretInsideLine(previousLine);
    } else {
      placeCaretAtEndOfLine(previousLine);
    }
    syncEditorDocument();
    rememberEditorSelection(editor);
    return true;
  }

  if (inputType === "deleteContentForward") {
    if (!nextLine || !isSelectionAtEndOfLine(currentLine, selection)) return false;
    currentLine.remove();
    placeCaretInsideLine(nextLine);
    syncEditorDocument();
    rememberEditorSelection(editor);
    return true;
  }

  return false;
}

function removeBrowserTrailingEmptyLineAfterInput(editor) {
  const currentLine = getCurrentEditorLine();
  const lastLine = editor?.lastElementChild || null;
  if (!editor || !currentLine || !lastLine) return false;

  if (currentLine === lastLine && isEditorLineEmpty(currentLine)) {
    const previousLine = getPreviousEditorLine(currentLine);
    if (!previousLine || isEditorLineEmpty(previousLine)) return false;
    currentLine.remove();
    placeCaretAtEndOfLine(previousLine);
    rememberEditorSelection(editor);
    return true;
  }

  if (currentLine !== lastLine && lastLine.previousElementSibling === currentLine && isEditorLineEmpty(lastLine)) {
    lastLine.remove();
    repairCaretAtEditorLineBoundary(editor);
    return true;
  }

  return false;
}

function getPreviousEditorLine(line) {
  let node = line?.previousSibling || null;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)) return node;
    node = node.previousSibling;
  }
  return null;
}

function getNextEditorLine(line) {
  let node = line?.nextSibling || null;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)) return node;
    node = node.nextSibling;
  }
  return null;
}

function isSelectionAtStartOfLine(line, selection) {
  if (!line || !selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const boundaryOffset = getSelectionBoundaryOffsetInLineParent(line, range.startContainer, range.startOffset);
  if (boundaryOffset !== null) {
    const lineIndex = getNodeIndex(line.parentNode, line);
    return lineIndex >= 0 && boundaryOffset <= lineIndex;
  }

  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(line);
  try {
    beforeRange.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  return !String(beforeRange.toString() || "").replace(/[\u00a0\u200b]/g, " ").trim();
}

function isSelectionAtEndOfLine(line, selection) {
  if (!line || !selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const boundaryOffset = getSelectionBoundaryOffsetInLineParent(line, range.startContainer, range.startOffset);
  if (boundaryOffset !== null) {
    const lineIndex = getNodeIndex(line.parentNode, line);
    return lineIndex >= 0 && boundaryOffset >= lineIndex + 1;
  }

  const afterRange = document.createRange();
  afterRange.selectNodeContents(line);
  try {
    afterRange.setStart(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  return !String(afterRange.toString() || "").replace(/[\u00a0\u200b]/g, " ").trim();
}

function getSelectionBoundaryOffsetInLineParent(line, container, offset) {
  const parent = line?.parentNode;
  if (!parent) return null;

  if (container === parent) {
    return Math.max(0, Math.min(Number(offset) || 0, parent.childNodes.length));
  }

  if (container === line && offset === 0) {
    return getNodeIndex(parent, line);
  }

  if (container === line && offset === line.childNodes.length) {
    const lineIndex = getNodeIndex(parent, line);
    return lineIndex >= 0 ? lineIndex + 1 : null;
  }

  return null;
}

function getNodeIndex(parent, node) {
  if (!parent || !node) return -1;
  return Array.prototype.indexOf.call(parent.childNodes, node);
}

function lineHasTag(line) {
  return Boolean(line?.querySelector?.(".tag-token"));
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
  removeTagCaretBoundaries(token);
  token.remove();
  if (parent?.firstChild?.nodeType === Node.TEXT_NODE) {
    parent.firstChild.textContent = parent.firstChild.textContent.replace(/^\u00a0+/, "");
  }
  if (parent && String(parent.textContent || "").replace(/\u200b/g, "").trim() === "") {
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
      if (uiState.lastInsertedTagTokenId === tokenId) {
        uiState.lastInsertedTagTokenId = "";
      }
    }
  });
}

function getFreshFinalizedTagForDelete(editor, inputType) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return null;

  const searchBackward = inputType !== "deleteContentForward";
  return getFreshFinalizedTagNearSelection(editor, searchBackward);
}

function getAdjacentFinalizedTagForDelete(editor, inputType) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return null;
  const searchBackward = inputType !== "deleteContentForward";
  return getAdjacentFinalizedTagNearSelection(editor, searchBackward);
}

function getLeadingTodoTagForDelete(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;
  if (!isNodeInsideEditor(editor, selection.anchorNode)) return null;

  const line = getCurrentEditorLine();
  if (!line || !isNodeInsideEditor(editor, line)) return null;
  if (!isSelectionBeforeEditableLineText(line, selection)) return null;

  const firstNode = getFirstMeaningfulLineNode(line);
  if (!firstNode?.classList?.contains("tag-token")) return null;
  if (firstNode.dataset.tag !== "todo") return null;
  if (firstNode.dataset.editing === "true") return null;
  return firstNode;
}

function isSelectionBeforeEditableLineText(line, selection) {
  if (!line || !selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  const beforeRange = document.createRange();
  beforeRange.selectNodeContents(line);
  try {
    beforeRange.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }

  const fragment = beforeRange.cloneContents();
  fragment.querySelectorAll?.(".tag-token").forEach((token) => token.remove());
  return !String(fragment.textContent || "").replace(/[\s\u00a0\u200b]/g, "");
}

function getFirstMeaningfulLineNode(line) {
  if (!line) return null;
  for (const node of Array.from(line.childNodes || [])) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (String(node.textContent || "").replace(/[\s\u00a0\u200b]/g, "")) {
        return node;
      }
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (node.tagName === "BR") continue;
    if (node.classList?.contains("tag-token")) return node;
    if (String(node.textContent || "").replace(/[\s\u00a0\u200b]/g, "")) {
      return node;
    }
  }
  return null;
}

function getFreshFinalizedTagNearSelection(editor, searchBackward) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;

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
  if (findEditorLine(candidate) !== getCurrentEditorLine()) return null;
  const tokenId = candidate.dataset.tokenId;
  const pending = tokenId ? uiState.pendingTagInsertions.get(tokenId) : null;
  return pending?.finalized ? candidate : null;
}

function getAdjacentFinalizedTagNearSelection(editor, searchBackward) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return null;

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
  if (findEditorLine(candidate) !== getCurrentEditorLine()) return null;
  if (candidate.dataset.editing === "true") return null;
  return candidate;
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
      const safeOffset = Math.min(childOffset, current.childNodes.length);
      return getDeepestRightNode(current.childNodes[safeOffset - 1]);
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
      const safeOffset = Math.max(0, Math.min(childOffset, current.childNodes.length - 1));
      return getDeepestLeftNode(current.childNodes[safeOffset]);
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
  next.textContent = String(next.textContent || "").replace(/^[\u00a0 \u200b]+/, "");
  if (!next.textContent) {
    next.remove();
  }
}

function removeTagCaretBoundaries(token) {
  const previous = token?.previousSibling;
  const next = token?.nextSibling;
  if (previous?.nodeType === Node.TEXT_NODE && previous.textContent.endsWith("\u200b")) {
    previous.textContent = previous.textContent.slice(0, -1);
    if (!previous.textContent) {
      previous.remove();
    }
  }
  if (next?.nodeType === Node.TEXT_NODE && next.textContent.startsWith("\u200b")) {
    next.textContent = next.textContent.slice(1);
    if (!next.textContent) {
      next.remove();
    }
  }
}

function shouldDeleteEditingTag(token) {
  if (!token || token.dataset.editing !== "true") return false;
  const selection = window.getSelection();
  const text = String(token.textContent || "").replace(/\u00a0/g, " ").trim();

  if (token.dataset.tag === "bed") {
    return text.replace(/^Bed\s*/i, "").trim() === "";
  }

  if (token.dataset.tag === "hn") {
    return getHnNumber(token) === "";
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

function isUntouchedDefaultTimeToken(token) {
  if (!token || !isTimeLikeTag(token.dataset.tag) || token.dataset.editing !== "true") return false;
  const text = String(token.textContent || "").replace(/\u00a0/g, " ").trim();
  return token.dataset.defaultTime === "true" && text === "00.00";
}

function finalizeDefaultTimeTokenWithCurrentTime(token, options = {}) {
  if (!isUntouchedDefaultTimeToken(token)) return false;
  token.textContent = formatTimeFromTimestamp(Date.now());
  finalizeTagToken(token, options);
  return true;
}

function isWhitespaceInput(text) {
  return /^[\s\u00a0]+$/.test(String(text || ""));
}

function refreshLineTagClasses(line) {
  if (!line) return;
  line.classList.toggle("timed-line", Boolean(line.querySelector('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]')));
  line.classList.toggle("io-line", Boolean(line.querySelector('.tag-token[data-tag="io"]')));
  line.classList.toggle("todo-line", Boolean(line.querySelector('.tag-token[data-tag="todo"]')));
  const tagTokens = Array.from(line.querySelectorAll(".tag-token"));
  tagTokens.forEach((token) => {
    token.classList.toggle("tag-done", isEditorTagDone(token));
  });
  line.classList.toggle("is-done", tagTokens.some(isEditorTagDone));
}

function applyEditorCompletionClasses(editor) {
  if (!editor) return;
  Array.from(editor.children).forEach((line) => {
    if (!["DIV", "P"].includes(line.tagName)) return;
    refreshLineTagClasses(line);
  });
}

function isEditorTagDone(token) {
  if (!token?.classList?.contains("tag-token")) return false;
  const tagType = token.dataset.tag || "";
  if (tagType === "io") {
    const createdAt = Number(token.dataset.createdAt || Date.now());
    const doneState = getIoDoneState({
      done: token.dataset.done === "true",
      done14: token.getAttribute("data-done-14") === "true",
      done22: token.getAttribute("data-done-22") === "true"
    });
    const baseTimes = getIoBaseTimesForTimestamp(createdAt);
    return Boolean(baseTimes.length) && baseTimes.every((baseTime) => doneState[getIoReminderKey(baseTime)]);
  }
  return token.dataset.done === "true";
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

function placeCaretAtStartOfLine(line) {
  const selection = window.getSelection();
  if (!line || !selection) return;
  const range = document.createRange();
  const textNode = getFirstEditableTextNode(line);
  if (textNode) {
    range.setStart(textNode, 0);
  } else {
    range.selectNodeContents(line);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEndOfLine(line) {
  const selection = window.getSelection();
  if (!line || !selection) return;
  const range = document.createRange();
  const textNode = getLastEditableTextNode(line);
  if (textNode) {
    range.setStart(textNode, textNode.textContent.length);
  } else {
    range.selectNodeContents(line);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function repairCaretAtEditorLineBoundary(editor) {
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount || !selection.isCollapsed) return false;
  const line = getCurrentEditorLine();
  if (!line || !isNodeInsideEditor(editor, line) || selection.anchorNode !== line) return false;

  const offset = selection.anchorOffset;
  if (offset === line.childNodes.length) {
    const textNode = getLastEditableTextNode(line);
    if (!textNode) return false;
    const range = document.createRange();
    range.setStart(textNode, textNode.textContent.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    rememberEditorSelection(editor);
    return true;
  }

  if (offset === 0) {
    const textNode = getFirstEditableTextNode(line);
    if (!textNode) return false;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    rememberEditorSelection(editor);
    return true;
  }

  return false;
}

function getFirstEditableTextNode(root) {
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!node.parentElement?.closest?.(".tag-token") && String(node.textContent || "").length) {
      return node;
    }
    node = walker.nextNode();
  }
  return null;
}

function getLastEditableTextNode(root) {
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last = null;
  let node = walker.nextNode();
  while (node) {
    if (!node.parentElement?.closest?.(".tag-token") && String(node.textContent || "").length) {
      last = node;
    }
    node = walker.nextNode();
  }
  return last;
}

function getCurrentEditingBedLine() {
  const line = getCurrentEditorLine();
  if (!line) return null;
  return line.querySelector('.tag-token[data-tag="bed"][data-editing="true"]') ? line : null;
}

function getEditingBedToken(line) {
  return line?.querySelector?.('.tag-token[data-tag="bed"][data-editing="true"]') || null;
}

function getCurrentEditingHnLine() {
  const line = getCurrentEditorLine();
  if (!line) return null;
  return line.querySelector('.tag-token[data-tag="hn"][data-editing="true"]') ? line : null;
}

function getEditingHnToken(line) {
  return line?.querySelector?.('.tag-token[data-tag="hn"][data-editing="true"]') || null;
}

function isEditingHnLineEmpty(line) {
  return getEditableTextFromLine(line).trim() === "";
}

function isEditingBedLineEmpty(line) {
  return getEditableTextFromLine(line).trim() === "";
}

function getEditableTextFromLine(line) {
  if (!line) return "";
  const clone = line.cloneNode(true);
  clone.querySelectorAll(".tag-token").forEach((token) => token.remove());
  return String(clone.textContent || "").replace(/\u00a0/g, " ").replace(/\u200b/g, "");
}

function isEditorLineEmpty(line) {
  if (!line) return true;
  const clone = line.cloneNode(true);
  clone.querySelectorAll("[data-pending-tag-marker], [data-caret-marker]").forEach((marker) => marker.remove());
  if (clone.querySelector(".tag-token")) return false;
  const text = String(clone.textContent || "").replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim();
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
  const pendingInsertion = consumePendingTagInsertion(token);
  token.textContent = `Bed ${bedValue}`;
  token.setAttribute("contenteditable", "false");
  token.dataset.editing = "false";
  token.classList.remove("tag-editing");
  line.replaceChildren(token);
  refreshLineTagClasses(line);
  const shouldResumeOriginalLine =
    pendingInsertion?.placedBeforeExistingLine &&
    pendingInsertion.line &&
    document.contains(pendingInsertion.line) &&
    getNextEditorLine(line) === pendingInsertion.line;
  if (shouldResumeOriginalLine) {
    placeCaretAtTextOffset(pendingInsertion.line, pendingInsertion.textOffset);
  } else {
    placeCaretOnNewLine(line);
  }
  syncEditorDocument();
}

function finalizeEditingHnLine(line) {
  const token = getEditingHnToken(line);
  if (!token) return;

  const digits = getEditableTextFromLine(line).replace(/\D/g, "").slice(0, 20);
  if (!digits) {
    removeEditingHnLine(line);
    syncEditorDocument();
    return;
  }

  const pendingInsertion = consumePendingTagInsertion(token);
  token.textContent = `HN ${digits}`;
  token.dataset.hnValue = digits;
  token.dataset.editing = "false";
  token.setAttribute("contenteditable", "false");
  token.setAttribute("role", "button");
  token.setAttribute("tabindex", "0");
  token.setAttribute("aria-label", `HN ${digits}. Copy number`);
  token.setAttribute("title", "Copy HN number");
  token.classList.remove("tag-editing");
  line.replaceChildren(token);
  refreshLineTagClasses(line);
  const shouldResumeOriginalLine =
    pendingInsertion?.placedBeforeExistingLine &&
    pendingInsertion.line &&
    document.contains(pendingInsertion.line) &&
    getNextEditorLine(line) === pendingInsertion.line;
  if (shouldResumeOriginalLine) {
    placeCaretAtTextOffset(pendingInsertion.line, pendingInsertion.textOffset);
  } else {
    placeCaretOnNewLine(line);
  }
  syncEditorDocument();
}

function removeEditingHnLine(line) {
  removeEditingTagEntryLine(line, getEditingHnToken(line));
}

function removeEditingBedLine(line) {
  removeEditingTagEntryLine(line, getEditingBedToken(line));
}

function removeEditingTagEntryLine(line, token) {
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  if (!line || !editor) return;
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

  const editor = refs.editorRoot.querySelector("#notepad-editor");
  let node = selection.anchorNode.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentNode : selection.anchorNode;
  if (node === editor) {
    const offset = Math.max(0, Math.min(selection.anchorOffset, editor.childNodes.length));
    const nextNode = editor.childNodes[offset];
    const previousNode = offset > 0 ? editor.childNodes[offset - 1] : null;
    const line = [nextNode, previousNode].find((candidate) =>
      candidate?.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(candidate.tagName)
    );
    return line || null;
  }

  while (node && node !== refs.editorRoot && node !== editor) {
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
  normalizeEditorBlocks(root);
  const rawLines = [];

  Array.from(root.childNodes).forEach((node, sourceLineIndex) => {
    if (node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName)) {
      rawLines.push({
        ...parseLineNode(node),
        sourceLineIndex
      });
      return;
    }

    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      const wrapper = root.ownerDocument.createElement("div");
      wrapper.textContent = node.textContent;
      rawLines.push({
        ...parseLineNode(wrapper),
        sourceLineIndex
      });
    }
  });

  const lines = [];
  let currentBed = "";

  rawLines.forEach((line) => {
    const bedTag = line.tags.find((tag) => tag.type === "bed");
    if (bedTag) {
      currentBed = bedTag.text.replace(/^Bed\s*/i, "").trim();
    }

    const reminderTag = line.tags.find((tag) => isReminderTagType(tag.type));
    const todoTag = line.tags.find((tag) => tag.type === "todo");
    const timeTag = reminderTag && reminderTag.type !== "io" ? reminderTag : null;
    const primaryTag = line.tags.find((tag) => tag.type !== "bed" && tag.type !== "todo" && !isReminderTagType(tag.type));
    const cleanedText = stripTagPrefixes(line.text, line.tags);
    const visibleText = line.visibleText.trim();
    const hasNonBedContent = Boolean(cleanedText || reminderTag || todoTag || primaryTag);
    if (!hasNonBedContent && bedTag && currentBed) {
      lines.push(createParsedLine({
        lineIndex: lines.length,
        sourceLineIndex: line.sourceLineIndex,
        lineId: line.lineId,
        text: "",
        visibleText: "",
        bedLabel: currentBed,
        note,
        bedHeaderOnly: true
      }));
      return;
    }

    if (!cleanedText && !reminderTag && !todoTag && !primaryTag && !visibleText) {
      return;
    }
    if (isTextReminderOnlyLine(reminderTag, cleanedText, primaryTag)) {
      if (bedTag && currentBed) {
        lines.push(createParsedLine({
          lineIndex: lines.length,
          sourceLineIndex: line.sourceLineIndex,
          lineId: line.lineId,
          text: "",
          visibleText: "",
          bedLabel: currentBed,
          note,
          bedHeaderOnly: true
        }));
      }
      return;
    }

    lines.push(createParsedLine({
      lineIndex: lines.length,
      sourceLineIndex: line.sourceLineIndex,
      lineId: line.lineId,
      text: cleanedText,
      visibleText,
      bedLabel: currentBed,
      reminderType: reminderTag?.type || "",
      reminderTokenId: reminderTag?.id || "",
      reminderCreatedAt: reminderTag?.createdAt || 0,
      timeTag: timeTag?.text || "",
      timeTokenId: timeTag?.id || reminderTag?.id || "",
      done: Boolean(reminderTag?.done),
      todoTokenId: todoTag?.id || "",
      todoDone: Boolean(todoTag?.done),
      note,
      ioCreatedAt: reminderTag?.type === "io" ? Number(reminderTag.createdAt || note.createdAt || Date.now()) : 0,
      ioDoneByTime: reminderTag?.type === "io" ? getIoDoneState(reminderTag) : {},
      timeAtStart: Boolean(line.timeAtStart && reminderTag && reminderTag.type !== "io"),
      primaryKind: primaryTag?.type || "general",
      primaryTagText: primaryTag?.text || "",
      primaryTokenId: primaryTag?.id || ""
    }));
  });

  return { lines };
}

function createParsedLine({
  lineIndex,
  sourceLineIndex = NaN,
  lineId = "",
  text,
  visibleText,
  bedLabel,
  note,
  timeTag = "",
  reminderType = "",
  reminderTokenId = "",
  reminderCreatedAt = 0,
  timeTokenId = "",
  done = false,
  todoTokenId = "",
  todoDone = false,
  ioCreatedAt = 0,
  ioDoneByTime = {},
  timeAtStart = false,
  primaryKind = "general",
  primaryTagText = "",
  primaryTokenId = "",
  bedHeaderOnly = false
}) {
  return {
    lineIndex,
    sourceLineIndex,
    lineId,
    text,
    visibleText,
    bedLabel,
    timeTag,
    noteCreatedAt: Number(note.createdAt) || Date.now(),
    reminderType,
    reminderTokenId,
    reminderCreatedAt,
    timeTokenId,
    done,
    todoTokenId,
    todoDone,
    ioCreatedAt,
    ioDoneByTime,
    timeAtStart,
    primaryKind,
    primaryTagText,
    primaryTokenId,
    bedHeaderOnly
  };
}

function isTextReminderOnlyLine(reminderTag, cleanedText, primaryTag) {
  if (!reminderTag || primaryTag || cleanedText) return false;
  return reminderTag.type === "time" || reminderTag.type === "lab" || !CORE_REMINDER_TAGS.includes(reminderTag.type);
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
        done: current.dataset.done === "true",
        createdAt: Number(current.dataset.createdAt || 0),
        done14: current.getAttribute("data-done-14") === "true",
        done22: current.getAttribute("data-done-22") === "true"
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
    .replace(/\u200b/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();

  const visibleText = parts
    .filter((part) => part.type !== "break")
    .map((part) => part.text)
    .join(" ")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const meaningfulParts = parts.filter((part) => part.text && part.text.trim());
  const firstMeaningful = meaningfulParts[0];

  return {
    lineId: String(node?.dataset?.lineId || ""),
    text: plainText,
    visibleText,
    timeAtStart: Boolean(firstMeaningful && firstMeaningful.type === "tag" && ["time", "lab"].includes(firstMeaningful.tagType)),
    tags
  };
}

function stripTagPrefixes(text, tags) {
  let cleaned = String(text || "").replace(/\u200b/g, "").trim();
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
  return getReminderItemsForLine(line).map((item) => item.time);
}

function getReminderItemsForLine(line) {
  if (!line?.reminderType) return [];
  const preferences = getPreferences();
  if (line.reminderType === "time" && line.timeTag) {
    return [{ time: addMinutesToTime(line.timeTag, preferences.tagDelays.time), key: "time", done: Boolean(line.done) }];
  }
  if (line.reminderType === "lab" && line.timeTag) {
    return [{ time: addMinutesToTime(line.timeTag, preferences.tagDelays.lab), key: "lab", done: Boolean(line.done) }];
  }
  if (line.reminderType === "io") {
    const baseTimes = getIoBaseTimesForTimestamp(line.ioCreatedAt || line.noteCreatedAt);
    return baseTimes.map((baseTime) => {
      const key = getIoReminderKey(baseTime);
      return {
        time: addMinutesToTime(baseTime, preferences.tagDelays.io),
        key,
        done: Boolean(line.ioDoneByTime?.[key])
      };
    });
  }
  const customTag = getCustomTagDefinition(line.reminderType);
  if (customTag?.hasReminder) {
    const startTime = formatTimeFromTimestamp(line.reminderCreatedAt || line.noteCreatedAt);
    return [{ time: addMinutesToTime(startTime, customTag.delayMinutes), key: line.reminderType, done: Boolean(line.done) }];
  }
  return [];
}

function getIoBaseTimesForTimestamp(timestamp) {
  return getShiftDurationHours(timestamp) === 24 ? ["14.00", "22.00"] : ["22.00"];
}

function getIoReminderKey(baseTime) {
  return parseTime(baseTime) < 18 * 60 ? "14" : "22";
}

function getIoDoneAttributeName(reminderKey) {
  return reminderKey === "14" ? "data-done-14" : "data-done-22";
}

function getIoDoneState(tag) {
  const hasSeparateState = Boolean(tag.done14 || tag.done22);
  const legacyDone = !hasSeparateState && Boolean(tag.done);
  return {
    "14": Boolean(tag.done14 || legacyDone),
    "22": Boolean(tag.done22 || legacyDone)
  };
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
  delete token.dataset.defaultTime;
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
  const editor = refs.editorRoot.querySelector("#notepad-editor");
  let current = node;
  while (current && current !== refs.editorRoot && current !== editor) {
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
  ensureEditorLineIdentities(editor, note.id);
  syncEditorEmptyState(editor);
  restoreSelectionMarker(marker, editor);
  const nextHtml = sanitizeEditorHtml(editor.innerHTML);
  if (nextHtml !== note.documentHtml) {
    setNoteDocumentHtml(note, nextHtml);
    saveState();
    refreshWardDrawerMetricsIfOpen();
  }
  updateSortBedsButtonFromEditor(editor);
}

function refreshWardDrawerMetricsIfOpen() {
  if (!uiState.wardOptionsOpen) return;
  renderDrawer();
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
  if (!marker.parentNode || !marker.isConnected) {
    const liveMarker = editor?.querySelector?.("[data-caret-marker]");
    if (liveMarker) {
      restoreCaretFromMarker(liveMarker, editor);
      return;
    }

    const currentLine = getCurrentEditorLine();
    placeCaretAtEndOfLine(currentLine && document.contains(currentLine) ? currentLine : editor.lastElementChild || editor);
    return;
  }

  restoreCaretFromMarker(marker, editor);
}

function restoreCaretFromMarker(marker, editor) {
  const selection = window.getSelection();
  if (!marker || !selection) {
    marker?.remove();
    return;
  }

  const markerLine = findEditorLine(marker);
  if (markerLine && isEditorLineEmpty(markerLine)) {
    marker.remove();
    markerLine.innerHTML = "<br>";
    placeCaretInsideLine(markerLine);
    rememberEditorSelection(editor);
    return;
  }

  const range = document.createRange();
  range.setStartAfter(marker);
  range.collapse(true);
  marker.remove();
  selection.removeAllRanges();
  selection.addRange(range);
  rememberEditorSelection(editor);
}

function normalizeEditorBlocks(root) {
  if (!root) return;

  root.querySelectorAll?.("[data-pending-tag-marker]").forEach((marker) => marker.remove());
  wrapLooseEditorInlineNodes(root);
  scrubEditorTagTokens(root);

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
  while (splitEditorLineBreaks(root)) {
    // Pasted text often stores visual lines as <br> inside one block.
  }
  scrubEditorTagTokens(root);
  splitMultiTagEditorLines(root);

  Array.from(root.children).forEach((line) => {
    if (!["DIV", "P"].includes(line.tagName)) return;
    Array.from(line.querySelectorAll('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]')).forEach((token) => {
      if (token.dataset.editing === "true") return;
      token.textContent = normalizeTimeTagValue(token.textContent) || "00.00";
    });
    Array.from(line.querySelectorAll('.tag-token[data-tag="hn"]')).forEach((token) => {
      if (token.dataset.editing === "true") return;
      const digits = getHnNumber(token);
      if (!digits) return;
      token.textContent = `HN ${digits}`;
      token.dataset.hnValue = digits;
      token.dataset.editing = "false";
      token.setAttribute("contenteditable", "false");
      token.setAttribute("role", "button");
      token.setAttribute("tabindex", "0");
      token.setAttribute("aria-label", `HN ${digits}. Copy number`);
      token.setAttribute("title", "Copy HN number");
    });
    const hasTime = Boolean(line.querySelector('.tag-token[data-tag="time"], .tag-token[data-tag="lab"]'));
    const hasIo = Boolean(line.querySelector('.tag-token[data-tag="io"]'));
    const hasTodo = Boolean(line.querySelector('.tag-token[data-tag="todo"]'));
    const hasCaretMarker = Boolean(line.querySelector("[data-caret-marker]"));
    if (!hasTime && !hasIo && !hasTodo && !hasCaretMarker && isEditorLineEmpty(line)) {
      line.innerHTML = "<br>";
    }
    refreshLineTagClasses(line);
    ensureTagCaretBoundaries(line);
  });
  applyCustomTagColors(root);
}

function splitMultiTagEditorLines(root) {
  Array.from(root.children || []).forEach((line) => {
    if (!(line.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(line.tagName))) return;
    if (line.querySelectorAll(".tag-token").length <= 1) return;

    const doc = root.ownerDocument;
    const replacements = [];
    let nextLine = doc.createElement("div");
    let nextLineHasTag = false;

    const pushLine = () => {
      if (!nextLine.childNodes.length) return;
      replacements.push(nextLine);
      nextLine = doc.createElement("div");
      nextLineHasTag = false;
    };

    Array.from(line.childNodes).forEach((node) => {
      const nodeIsTag = node.nodeType === Node.ELEMENT_NODE && node.classList.contains("tag-token");
      if (nodeIsTag && nextLineHasTag) {
        pushLine();
      }
      nextLine.appendChild(node);
      nextLineHasTag = nextLineHasTag || nodeIsTag;
    });

    pushLine();
    if (replacements.length <= 1) return;

    const fragment = doc.createDocumentFragment();
    replacements.forEach((replacement) => fragment.appendChild(replacement));
    root.insertBefore(fragment, line);
    line.remove();
  });
}

function splitEditorLineBreaks(root) {
  let changed = false;

  Array.from(root.children || []).forEach((line) => {
    if (!(line.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(line.tagName))) return;

    const children = Array.from(line.childNodes);
    if (!children.some((child) => isLineBreakNode(child) || isTextNodeWithLineBreak(child))) return;

    const doc = root.ownerDocument;
    const replacements = [];
    let nextLine = doc.createElement("div");

    const pushLine = (force = false) => {
      if (!nextLine.childNodes.length) {
        if (!force) return;
        nextLine.innerHTML = "<br>";
      }
      replacements.push(nextLine);
      nextLine = doc.createElement("div");
    };

    children.forEach((child, index) => {
      if (isLineBreakNode(child)) {
        const previousWasBreak = index > 0 && isLineBreakNode(children[index - 1]);
        pushLine(hasMeaningfulLineContentAfter(children, index + 1) || previousWasBreak);
        return;
      }

      if (isTextNodeWithLineBreak(child)) {
        const chunks = String(child.textContent || "").replace(/\r\n?/g, "\n").split("\n");
        chunks.forEach((chunk, chunkIndex) => {
          if (chunk) {
            nextLine.appendChild(doc.createTextNode(chunk));
          }

          if (chunkIndex < chunks.length - 1) {
            const hasMoreTextInNode = chunks
              .slice(chunkIndex + 1)
              .some((part) => part.replace(/[\s\u00a0\u200b]/g, ""));
            pushLine(hasMoreTextInNode || hasMeaningfulLineContentAfter(children, index + 1) || chunkIndex > 0);
          }
        });
        return;
      }

      nextLine.appendChild(child);
    });

    pushLine();

    if (!replacements.length) {
      line.innerHTML = "<br>";
      return;
    }

    const fragment = doc.createDocumentFragment();
    replacements.forEach((replacement) => fragment.appendChild(replacement));
    root.insertBefore(fragment, line);
    line.remove();
    changed = true;
  });

  return changed;
}

function isLineBreakNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE && node.tagName === "BR";
}

function isTextNodeWithLineBreak(node) {
  return node?.nodeType === Node.TEXT_NODE && /\n/.test(node.textContent || "");
}

function hasMeaningfulLineContentAfter(nodes, startIndex) {
  return nodes.slice(startIndex).some(isMeaningfulLineNode);
}

function isMeaningfulLineNode(node) {
  if (!node) return false;
  if (isLineBreakNode(node)) return false;
  if (node.nodeType === Node.TEXT_NODE) {
    return Boolean(String(node.textContent || "").replace(/[\s\u00a0\u200b]/g, ""));
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.dataset?.caretMarker) return true;
  if (node.classList?.contains("tag-token")) return true;
  return Boolean(String(node.textContent || "").replace(/[\s\u00a0\u200b]/g, ""));
}

function scrubEditorTagTokens(root) {
  root.querySelectorAll?.(".tag-token .tag-token").forEach((nestedToken) => {
    const outerToken = nestedToken.parentElement?.closest(".tag-token");
    if (!outerToken || outerToken === nestedToken || !outerToken.parentNode) return;
    while (outerToken.firstChild) {
      outerToken.parentNode.insertBefore(outerToken.firstChild, outerToken);
    }
    outerToken.remove();
  });

  root.querySelectorAll?.(".tag-token").forEach((token) => {
    const tagType = token.dataset.tag || "";
    if (tagType === "todo" || tagType === "io") return;
    const text = String(token.textContent || "").replace(/[\u00a0\u200b]/g, " ").trim();
    if (text) return;
    const caretMarker = token.querySelector?.("[data-caret-marker]");
    if (caretMarker && token.parentNode) {
      token.parentNode.insertBefore(caretMarker, token);
    }
    removeTagCaretBoundaries(token);
    token.remove();
  });
}

function wrapLooseEditorInlineNodes(root) {
  const doc = root.ownerDocument;
  const replacements = [];
  let inlineLine = null;
  let changed = false;

  const pushInlineLine = () => {
    if (!inlineLine) return;
    if (!inlineLine.childNodes.length) {
      inlineLine = null;
      return;
    }
    replacements.push(inlineLine);
    inlineLine = null;
  };

  Array.from(root.childNodes).forEach((node) => {
    const isBlock = node.nodeType === Node.ELEMENT_NODE && ["DIV", "P"].includes(node.tagName);
    if (isBlock) {
      pushInlineLine();
      replacements.push(node);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE && !node.textContent.replace(/[\s\u00a0\u200b]/g, "")) {
      changed = true;
      return;
    }

    changed = true;
    if (!inlineLine) {
      inlineLine = doc.createElement("div");
    }
    inlineLine.appendChild(node);
  });

  pushInlineLine();

  if (!changed) return;
  if (!replacements.length) {
    const emptyLine = doc.createElement("div");
    emptyLine.innerHTML = "<br>";
    replacements.push(emptyLine);
  }
  root.replaceChildren(...replacements);
}

function ensureTagCaretBoundaries(line) {
  if (!line) return;
  Array.from(line.querySelectorAll(".tag-token")).forEach((token) => {
    ensureCaretBoundaryBefore(token);
    ensureCaretBoundaryAfter(token);
  });
}

function ensureCaretBoundaryBefore(token) {
  const previous = token.previousSibling;
  if (previous?.nodeType === Node.TEXT_NODE) {
    if (!previous.textContent.endsWith("\u200b")) {
      previous.textContent += "\u200b";
    }
    return;
  }
  token.parentNode?.insertBefore(document.createTextNode("\u200b"), token);
}

function ensureCaretBoundaryAfter(token) {
  const next = token.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE) {
    if (!next.textContent.startsWith("\u200b") && !next.textContent.startsWith(" ") && !next.textContent.startsWith("\u00a0")) {
      next.textContent = `\u200b${next.textContent}`;
    }
    return;
  }
  token.parentNode?.insertBefore(document.createTextNode("\u200b"), token.nextSibling);
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
        replacements.push(child);
        return;
      }

      currentLine.appendChild(child);
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
      queueEditorCaretVisibilityCheck(liveEditor, "bed-finalize");
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
