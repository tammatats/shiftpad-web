(function () {
  "use strict";
  window.createShiftbookDialog = function ({ dialog, getSession, applyWards }) {
    const calendar = window.ShiftPadShiftbook;
    const field = name => dialog.querySelector(`[data-shiftbook="${name}"]`);
    const codeForm = field("connect");
    const codeInput = field("code");
    const linkActions = field("link-actions");
    const form = field("wards");
    const date = field("date");
    const person = field("person");
    const wards = field("ward-names");
    const status = field("status");
    const apply = field("apply");
    const lookup = field("lookup");
    let request;
    let session;
    let roster;
    let linked;
    let manual;
    let roles = [];
    let preferences;

    function readPreferences(userId) {
      try {
        return JSON.parse(localStorage.getItem(`shiftpad-shiftbook:${userId}`)) || {};
      } catch {
        return {};
      }
    }

    function savePreferences() {
      try {
        const key = `shiftpad-shiftbook:${session.userId}`;
        localStorage.setItem(key, JSON.stringify(preferences));
      } catch {
        // A blocked local store should still allow setup within this dialog.
      }
    }

    function renderMode() {
      codeForm.hidden = linked || manual;
      linkActions.hidden = !linked || manual;
      form.hidden = !roster && !manual;
      lookup.hidden = manual;
      field("manual").hidden = manual;
      field("back").hidden = !manual;
      apply.disabled = !manual && !roles.length;
    }

    function showShift() {
      const name = person.value;
      roles = calendar.rolesOn(roster, date.value, name);
      const presets = preferences.presets || {};
      wards.value = calendar.suggestedWards(roles, presets).join("\n");
      const next = name && date.value && !roles.length ? calendar.nextShift(roster, date.value, name) : "";
      field("next").hidden = !next;
      field("next").dataset.date = next || "";
      if (!name) status.textContent = "Choose your name as it appears in Shiftbook.";
      else if (!date.value) status.textContent = "Choose a shift date.";
      else if (!roles.length) {
        status.textContent = roster.dates.has(date.value)
          ? "No assignment for you on this date."
          : "The synced roster has no assignments for this date.";
      } else {
        const missing = roles.filter(role => !calendar.suggestedWards([role], presets).length);
        const coverage = roles.join(" + ");
        status.textContent = missing.length
          ? `${coverage}. Enter or review wards for this shift.`
          : `${coverage}. Review the wards before creating them.`;
      }
      renderMode();
    }

    async function connect(code) {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const timer = window.setTimeout(() => controller.abort(), 15000);
      roster = null;
      roles = [];
      renderMode();
      status.textContent = "Reading the latest synced roster…";
      field("load").disabled = true;
      field("refresh").disabled = true;
      try {
        const result = await calendar.fetchRoster(code, getSession()?.accessToken, controller.signal);
        if (request !== controller || !dialog.open || getSession()?.userId !== session.userId) return;
        roster = result;
        linked = true;
        preferences.code = code.trim().toLowerCase();
        savePreferences();
        codeInput.value = "";
        person.replaceChildren(new Option("Choose your name", ""), ...roster.people.map(name => new Option(name, name)));
        person.value = roster.people.includes(preferences.person) ? preferences.person : "";
        showShift();
      } catch (error) {
        if (request !== controller || !dialog.open) return;
        status.textContent = controller.signal.aborted
          ? "Shiftbook took too long to respond. Try again or enter wards manually."
          : error instanceof TypeError ? "Shiftbook could not be reached. Check your connection." : error.message;
      } finally {
        window.clearTimeout(timer);
        if (request === controller) {
          field("load").disabled = false;
          field("refresh").disabled = false;
        }
      }
    }

    function stopRequest() {
      request?.abort();
      request = null;
      field("load").disabled = false;
      field("refresh").disabled = false;
    }

    codeForm.addEventListener("submit", event => {
      event.preventDefault();
      connect(codeInput.value);
    });
    field("refresh").addEventListener("click", () => connect(preferences.code));
    field("unlink").addEventListener("click", () => {
      stopRequest();
      delete preferences.code;
      delete preferences.person;
      savePreferences();
      linked = false;
      roster = null;
      roles = [];
      status.textContent = "Shiftbook disconnected from this browser.";
      renderMode();
      codeInput.focus();
    });
    field("manual").addEventListener("click", () => {
      stopRequest();
      manual = true;
      status.textContent = "Enter the ward names for this shift.";
      renderMode();
      wards.focus();
    });
    field("back").addEventListener("click", () => {
      manual = false;
      wards.value = "";
      if (roster) showShift();
      else if (linked) connect(preferences.code);
      else {
        status.textContent = "";
        renderMode();
        codeInput.focus();
      }
    });
    date.addEventListener("change", showShift);
    person.addEventListener("change", () => {
      preferences.person = person.value;
      savePreferences();
      showShift();
    });
    field("next").addEventListener("click", event => {
      date.value = event.currentTarget.dataset.date;
      showShift();
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!manual && !roles.length) return;
      try {
        const names = calendar.parseWardNames(wards.value);
        const finish = applyWards(names, session);
        if (!manual && roles.length === 1) {
          preferences.presets = { ...preferences.presets, [roles[0]]: names };
          savePreferences();
        }
        dialog.close();
        finish();
      } catch (error) {
        status.textContent = error.message;
      }
    });
    field("close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      stopRequest();
      codeInput.value = "";
      preferences = null;
      roster = null;
    });
    return {
      open(pad) {
        if (dialog.open) return;
        stopRequest();
        session = pad;
        preferences = readPreferences(pad.userId);
        roster = null;
        linked = Boolean(preferences.code);
        manual = false;
        roles = [];
        date.value = calendar.bangkokDate();
        wards.value = "";
        status.textContent = "";
        codeInput.value = "";
        renderMode();
        dialog.showModal();
        if (linked) connect(preferences.code);
      },
      close() {
        if (dialog.open) dialog.close();
      }
    };
  };
})();
