const { test } = require("node:test");
const assert = require("node:assert/strict");
const calendar = require("../../lib/shiftbook-setup");

test("coverage follows actual roster assignment, not weekday or similar names", () => {
  const roster = calendar.readAssignments({ rosters: { "2026-11": { days: [
    { date: "2026-11-23", assignments: { "2ก": "My Name", "R2ข": "Other Name" } },
    { date: "2026-11-28", assignments: { "R2ข": "My Name" } }
  ] } } });
  assert.deepEqual(calendar.rolesOn(roster, "2026-11-23", "My Name"), ["R2ก"]);
  assert.deepEqual(calendar.suggestedWards(calendar.rolesOn(roster, "2026-11-23", "My Name"), {}), ["CCU", "GenM", "PrivM", "ETD"]);
  assert.deepEqual(calendar.suggestedWards(calendar.rolesOn(roster, "2026-11-28", "My Name"), {}), []);
  assert.equal(calendar.nextShift(roster, "2026-11-24", "My Name"), "2026-11-28");
});

test("Bangkok date rolls over at local midnight and presets can be edited", () => {
  assert.equal(calendar.bangkokDate(new Date("2026-11-22T17:01:00Z")), "2026-11-23");
  assert.deepEqual(calendar.parseWardNames("CCU,  GenM\nccu"), ["CCU", "GenM"]);
  assert.deepEqual(calendar.suggestedWards(["R2ก", "R2ข"], { "R2ก": ["Custom"], "R2ข": ["Custom", "Second"] }), ["Custom", "Second"]);
});
