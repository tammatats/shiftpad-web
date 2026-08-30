const test = require("node:test");
const assert = require("node:assert/strict");
const reminderHandler = require("../../api/send-reminders");

test("indexed reminder becomes due in the device time zone", () => {
  const now = new Date("2026-08-23T04:00:30.000Z");
  const due = reminderHandler._test.buildDueRemindersFromIndex([{
    key: "shift:n1:t1:time",
    workspaceKey: "shift",
    workspaceLabel: "ShiftPad",
    wardName: "Ward A",
    noteId: "n1",
    lineId: "l1",
    bedLabel: "4",
    reminderType: "time",
    reminderTypeLabel: "Time",
    reminderTime: "11.00",
    done: false,
    text: "ABG",
    anchorAt: Date.parse("2026-08-23T03:41:00.000Z")
  }], { now, timeZone: "Asia/Bangkok", windowMinutes: 10 });
  assert.equal(due.length, 1);
  assert.equal(due[0].title, "11:00 Time");
  assert.match(due[0].body, /Bed 4: ABG/);
});

test("completed indexed reminders never send", () => {
  const due = reminderHandler._test.buildDueRemindersFromIndex([{
    key: "done",
    reminderTime: "11.00",
    done: true,
    anchorAt: Date.parse("2026-08-23T03:41:00.000Z")
  }], { now: new Date("2026-08-23T04:00:30.000Z"), timeZone: "Asia/Bangkok", windowMinutes: 10 });
  assert.equal(due.length, 0);
});

test("default recovery window sends a reminder after a temporary scheduler outage", () => {
  const windowMinutes = reminderHandler._test.getReminderWindowMinutes();
  const due = reminderHandler._test.buildDueRemindersFromIndex([{
    key: "shift:n1:t1:time",
    workspaceKey: "shift",
    workspaceLabel: "ShiftPad",
    wardName: "Ward A",
    noteId: "n1",
    lineId: "l1",
    bedLabel: "4",
    reminderType: "time",
    reminderTypeLabel: "Time",
    reminderTime: "11.00",
    done: false,
    text: "ABG",
    anchorAt: Date.parse("2026-08-23T03:41:00.000Z")
  }], {
    now: new Date("2026-08-23T04:45:00.000Z"),
    timeZone: "Asia/Bangkok",
    windowMinutes
  });

  assert.equal(windowMinutes, 60);
  assert.equal(due.length, 1);
});

test("recovery window does not send stale reminders", () => {
  const due = reminderHandler._test.buildDueRemindersFromIndex([{
    key: "stale",
    reminderTime: "11.00",
    done: false,
    anchorAt: Date.parse("2026-08-23T03:41:00.000Z")
  }], {
    now: new Date("2026-08-23T05:01:00.000Z"),
    timeZone: "Asia/Bangkok",
    windowMinutes: reminderHandler._test.getReminderWindowMinutes()
  });

  assert.equal(due.length, 0);
});

test("configured recovery window is validated and bounded", () => {
  const getWindow = reminderHandler._test.getReminderWindowMinutes;
  assert.equal(getWindow("invalid"), 60);
  assert.equal(getWindow("2"), 5);
  assert.equal(getWindow("45"), 45);
  assert.equal(getWindow("1000"), 180);
});
