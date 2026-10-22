const { test, expect } = require("@playwright/test");
const pageErrors = new WeakMap();

// iPadOS Safari uses a desktop user agent, including when a trackpad is attached.
test.use({
  hasTouch: true,
  isMobile: false,
  serviceWorkers: "block",
  screen: { width: 1366, height: 1024 },
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"
});

test.beforeEach(async ({ page }) => {
  pageErrors.set(page, []);
  page.on("pageerror", error => pageErrors.get(page).push(error.message));
  // The static test server cannot execute this Vercel route; local e2e mode
  // supplies its own account and never needs production configuration.
  await page.route("**/api/public-config.js", route => route.fulfill({
    contentType: "application/javascript", body: ""
  }));
  await page.addInitScript(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

for (const width of [683, 507, 375, 320]) {
  test(`iPad ${width}px: Tags is reachable before typing and after navigation`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/?e2e=1&workspace=shift");
    const editor = page.locator("#notepad-editor");
    const toggle = page.locator("[data-mobile-tag-toggle]");
    await expect(editor).toBeVisible();
    await expect(editor).not.toBeFocused();
    await expect(toggle).toBeVisible();
    await toggle.tap();
    await expect(page.locator(".mobile-tag-tray")).toBeVisible();
    await page.locator('[data-mobile-tag="todo"]').tap();
    await expect(editor).toBeFocused();
    await page.keyboard.type("split screen check");
    await expect(editor).toContainText("split screen check");
    await expect(editor.locator('[data-tag="todo"]')).toHaveCount(1);
    await toggle.tap();
    await expect(page.locator(".mobile-tag-tray")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`ipad-${width}-tags.png`), scale: "css" });
    await toggle.tap();

    await page.locator("#timeline-tab-btn").tap();
    await expect(toggle).toBeHidden();
    await page.locator("#notes-tab-btn").tap();
    await expect(toggle).toBeVisible();
    await editor.tap();
    await expect(editor).toBeFocused();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", width);

    await page.locator("#ward-options-btn").tap();
    await expect(toggle).toBeHidden();
    await page.locator('.drawer-layer-right [data-drawer-close]').last().tap();
    await expect(toggle).toBeVisible();

    await page.locator("#timeline-tab-btn").tap();
    await page.locator("#notes-tab-btn").tap();
    await editor.locator('[data-tag="todo"]').tap();
    await expect(editor).not.toBeFocused();
    await expect(editor.locator('[data-tag="todo"]')).toHaveAttribute("data-done", "true");
  });

  test(`iPad ${width}px: tapping a non-editable tag starts real editor focus`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/?e2e=1&workspace=shift");
    const editor = page.locator("#notepad-editor");
    await editor.evaluate((element) => {
      element.innerHTML = '<div><span class="tag-token tag-io" data-tag="io" data-token-id="test-io" contenteditable="false">I/O</span> sample target</div>';
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    });
    await page.locator("#timeline-tab-btn").tap();
    await page.locator("#notes-tab-btn").tap();
    await editor.locator('[data-tag="io"]').tap();
    await expect(editor).toBeFocused();
    await page.keyboard.type("typed");
    await expect(editor).toContainText("typed");
    expect(await editor.locator('[data-tag="io"]').evaluate(token => token.nextSibling?.textContent)).toContain("typed");
  });

  test(`iPad ${width}px: Tags follows keyboard resizing and viewport panning`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.addInitScript(() => {
      window.testVisualViewport = { height: 960, offsetTop: 0 };
      for (const key of ["height", "offsetTop"]) {
        Object.defineProperty(visualViewport, key, { get: () => window.testVisualViewport[key] });
      }
    });
    await page.goto("/?e2e=1&workspace=shift");
    const toggle = page.locator("[data-mobile-tag-toggle]");
    await expect(toggle).toBeVisible();
    for (const viewport of [
      { height: 520, offsetTop: 0, fixedTop: "auto" },
      // Safari can move the fixed anchor as well as pan its visual viewport.
      { height: 440, offsetTop: 160, fixedTop: "426px" },
      { height: 960, offsetTop: 0, fixedTop: "auto" }
    ]) {
      await page.evaluate((value) => {
        Object.assign(window.testVisualViewport, value);
        document.querySelector("[data-mobile-tag-dock]").style.top = value.fixedTop;
        visualViewport.dispatchEvent(new Event("resize"));
      }, viewport);
      await expect.poll(async () => {
        const rect = await toggle.boundingBox();
        return Math.round(rect.y + rect.height);
      }).toBe(viewport.offsetTop + viewport.height - (width > 560 ? 8 : 6));
      await toggle.tap();
      await expect(page.locator(".mobile-tag-tray")).toBeVisible();
      await expect(page.locator(".mobile-tag-tray")).toHaveCSS("opacity", "1");
      const tray = await page.locator(".mobile-tag-tray").boundingBox();
      expect(tray.y).toBeGreaterThanOrEqual(viewport.offsetTop);
      await toggle.tap();
    }
    await page.setViewportSize({ width: width === 683 ? 320 : 683, height: 960 });
    await expect(toggle).toBeVisible();
    await page.locator("#workspace-switcher").tap();
    await expect(page.locator("#workspace-title")).toHaveText("DayPad");
    await expect(toggle).toBeVisible();
    await toggle.tap();
    await page.locator('[data-mobile-tag="bed"]').tap();
    await expect(page.locator("#notepad-editor")).toBeFocused();
    await page.keyboard.type("8");
    await page.keyboard.press("Enter");
    await expect(page.locator('.tag-token[data-tag="bed"]')).toHaveText("Bed 8");
  });
}
