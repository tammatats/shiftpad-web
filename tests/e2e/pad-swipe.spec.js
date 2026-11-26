const { test, expect, devices } = require("@playwright/test");

async function swipe(page, selector, dx, dy = 0, { browserName, cancel = false, releaseCancelable = true } = {}) {
  const locator = page.locator(selector);
  const box = await locator.boundingBox();
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (const fraction of [0.25, 0.5, 0.75, 1]) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove", touchPoints: [{ x: Math.round(x + dx * fraction), y: Math.round(y + dy * fraction) }]
        });
      }
      await session.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
    } finally {
      await session.detach();
    }
  } else {
    // Playwright WebKit exposes taps; dispatch its touch sequence to exercise
    // selection and cancellation paths with the same coordinates.
    await locator.evaluate((target, { x, y, dx, dy, cancel, releaseCancelable }) => {
      for (const [type, fraction] of [["touchstart", 0], ["touchmove", 0.25], ["touchmove", 1], [cancel ? "touchcancel" : "touchend", 1]]) {
        const touch = { identifier: 4, clientX: x + dx * fraction, clientY: y + dy * fraction };
        const event = new Event(type, { bubbles: true, cancelable: type !== "touchend" || releaseCancelable });
        Object.defineProperties(event, {
          touches: { value: ["touchend", "touchcancel"].includes(type) ? [] : [touch] },
          changedTouches: { value: [touch] }
        });
        target.dispatchEvent(event);
      }
    }, { x, y, dx, dy, cancel, releaseCancelable });
  }
}

const profiles = [
  ["iPhone", devices["iPhone 15"]],
  ["iPad 50%", { ...devices["iPad Pro 11"], viewport: { width: 683, height: 960 } }],
  ["iPad 25%", { ...devices["iPad Pro 11"], viewport: { width: 320, height: 960 } }]
];
for (const [name, profile] of profiles) {
  test.describe(name, () => {
    const { defaultBrowserType, ...options } = profile;
    test.use({ ...options, serviceWorkers: "block" });
    test("horizontal swipes switch pads and wards without touching either note", async ({ page, browserName }, info) => {
      test.skip(info.project.name === "iphone-webkit", "Explicit profiles already cover WebKit.");
      await page.route("**/api/public-config.js", route => route.fulfill({ body: "" }));
      await page.goto("/?e2e=1&workspace=shift");
      const editor = page.locator("#notepad-editor");
      await expect(editor).toBeVisible();
      await page.evaluate(() => {
        const ward = createWard("Second ward", WARD_COLORS[1]);
        ward.notes.push(createNote("Sample", ""));
        setNoteDocumentHtml(ward.notes[0], "<div>Second ward sample</div>");
        setNoteDocumentHtml(getCurrentNote(), "<div>First ward sample</div>");
        state.wards.push(ward);
        render();
      });
      const opts = { browserName };
      await swipe(page, "#workspace-switcher", -72, 3, opts);
      await expect(page.locator("#workspace-title")).toHaveText("DayPad");
      await swipe(page, "#workspace-switcher", 72, 3, opts);
      await expect(page.locator("#workspace-title")).toHaveText("ShiftPad");
      await expect(editor).toContainText("First ward sample");
      await swipe(page, "[data-choose-ward]", -72, 3, opts);
      await expect(editor).toContainText("Second ward sample");
      await swipe(page, "[data-choose-ward]", 72, 3, opts);
      await expect(editor).toContainText("First ward sample");
      // A swipe already claimed on touchmove can end without a cancelable release.
      await swipe(page, ".notepad-ward-title", -72, 3, { releaseCancelable: false });
      await expect(editor).toContainText("Second ward sample");
      // The ward bar is an explicit navigation target, even if iOS keeps an
      // editor selection while the user moves their finger onto the bar.
      await editor.evaluate(element => window.getSelection().selectAllChildren(element));
      await swipe(page, "[data-choose-ward]", 72, 3, opts);
      await expect(editor).toContainText("First ward sample");
      await swipe(page, "#workspace-switcher", -72, 3, { ...opts, cancel: true });
      await expect(page.locator("#workspace-title")).toHaveText("ShiftPad");
      await swipe(page, "#workspace-switcher", -10, 65, opts);
      await expect(page.locator("#workspace-title")).toHaveText("ShiftPad");
      await editor.focus();
      await swipe(page, "#notepad-editor", -80, 3, opts);
      await expect(editor).toContainText("First ward sample");
      await expect(page.locator("#workspace-title")).toHaveText("ShiftPad");
      await page.screenshot({ path: info.outputPath("ward-navigation.png"), scale: "css" });
    });
  });
}
