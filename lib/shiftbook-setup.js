(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ShiftPadShiftbook = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const encoder = new TextEncoder();
  const defaultWards = { "R2ก": ["CCU", "GenM", "PrivM", "ETD"] };

  function bangkokDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return [fields.year, fields.month, fields.day].join("-");
  }

  function normalizeRole(role) {
    const cleaned = role.trim().normalize("NFC").replace(/\s+/g, "").toUpperCase();
    return /^[23][กขค]$/.test(cleaned) ? `R${cleaned}` : cleaned;
  }

  function parseWardNames(value) {
    const names = new Map();
    for (const line of String(value).split(/[\n,]+/)) {
      const name = line.trim().normalize("NFC");
      if (!name) continue;
      if (name.length > 40) throw new Error("Keep each ward name to 40 characters or fewer.");
      const key = name.toLocaleLowerCase();
      if (!names.has(key)) names.set(key, name);
    }
    if (!names.size || names.size > 20) throw new Error("Enter between 1 and 20 ward names.");
    return [...names.values()];
  }

  function suggestedWards(roles, presets) {
    return [...new Set(roles.flatMap(role => {
      const key = normalizeRole(role);
      return (Object.hasOwn(presets, key) && presets[key]) || defaultWards[key] || [];
    }))];
  }

  function readAssignments(data) {
    const dates = new Map();
    const people = new Set();
    for (const roster of Object.values(data?.rosters || {})) {
      if (!Array.isArray(roster?.days)) continue;
      for (const day of roster.days) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day?.date || "")) continue;
        const assignments = dates.get(day.date) || new Map();
        for (const [role, name] of Object.entries(day.assignments || {})) {
          if (typeof name !== "string" || !name.trim()) continue;
          const person = name.trim();
          people.add(person);
          const roles = assignments.get(person) || new Set();
          roles.add(normalizeRole(role));
          assignments.set(person, roles);
        }
        dates.set(day.date, assignments);
      }
    }
    if (!people.size) throw new Error("The synced roster has no assignments.");
    return { dates, people: [...people].sort((a, b) => a.localeCompare(b, "th")) };
  }

  function rolesOn(roster, date, person) {
    return [...(roster?.dates.get(date)?.get(person) || [])];
  }

  function nextShift(roster, date, person) {
    return [...roster.dates.keys()].filter(day => day >= date && rolesOn(roster, day, person).length).sort()[0];
  }

  function digest(value) {
    return crypto.subtle.digest("SHA-256", encoder.encode(value));
  }

  async function fetchRoster(rawCode, sessionToken, signal) {
    const code = rawCode.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(code)) throw new Error("Paste the full private link code from Shiftbook.");
    const bytes = new Uint8Array(await digest("shiftbook-roster-access-v1:" + code));
    const accessToken = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch("/api/shiftbook-roster", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken || ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
      cache: "no-store",
      signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Shiftbook could not be reached. Try again when online.");
    try {
      const packet = Uint8Array.from(atob(result.encrypted.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
      const key = await crypto.subtle.importKey("raw", await digest("shiftbook-roster-encryption-v1:" + code), "AES-GCM", false, ["decrypt"]);
      const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packet.slice(0, 12) }, key, packet.slice(12));
      return readAssignments(JSON.parse(new TextDecoder().decode(clear)));
    } catch {
      throw new Error("The synced roster could not be read. Check that the link belongs to your active roster.");
    }
  }

  return { bangkokDate, parseWardNames, suggestedWards, readAssignments, rolesOn, nextShift, fetchRoster };
});
