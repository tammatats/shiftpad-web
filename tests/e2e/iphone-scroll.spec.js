const { test, expect, devices } = require("@playwright/test");

test.use({ ...devices["iPhone 15"], serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/public-config.js", route => route.fulfill({
    contentType: "application/javascript", body: ""
  }));
  await page.addInitScript(() => {
    localStorage.clear();
    window.testViewport = { height: innerHeight, offsetTop: 0 };
    for (const key of ["height", "offsetTop"]) {
      Object.defineProperty(visualViewport, key, { get: () => window.testViewport[key] });
    }
  });
  await page.goto("/?e2e=1&workspace=shift");
  const editor = page.locator("#notepad-editor");
  await expect(editor).toBeVisible();
  await editor.evaluate(element => {
    element.innerHTML = Array.from({ length: 65 }, (_, i) => `<div>Sample note line ${i + 1}</div>`).join("");
    element.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
});

async function scrollAndMeasure(page, y) {
  await page.evaluate(y => window.scrollTo(0, y), y);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(y);
  // Observe multiple frames, not just the eventual settled position.
  return page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 12; i++) {
      await new Promise(requestAnimationFrame);
      const dock = document.querySelector("[data-mobile-tag-dock]");
      samples.push({ top: dock.getBoundingClientRect().top, y: parseFloat(dock.style.getPropertyValue("--mobile-tag-y")) || 0 });
    }
    return samples;
  });
}

test("iPhone Tags stays pinned while scrolling with Safari chrome changing", async ({ page }, testInfo) => {
  const toggle = page.locator("[data-mobile-tag-toggle]");
  await expect(toggle).toBeVisible();
  const initial = await page.locator('[data-mobile-tag-dock]').boundingBox();
  for (const y of [200, 700, 350, 0]) {
    // Browser chrome/overscroll can briefly disagree with the layout viewport;
    // this is not a keyboard and must not move an already fixed button.
    await page.evaluate(y => {
      window.testViewport.height = innerHeight - (y ? 60 : 0);
      window.testViewport.offsetTop = y ? 16 : 0;
      visualViewport.dispatchEvent(new Event("resize"));
    }, y);
    const samples = await scrollAndMeasure(page, y);
    expect(samples.every(sample => sample.y === 0)).toBe(true);
    expect(samples.every(sample => Math.abs(sample.top - initial.y) <= 1)).toBe(true);
  }
  await scrollAndMeasure(page, 700);
  await toggle.tap();
  await expect(page.locator(".mobile-tag-tray")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("iphone-scrolled-tags.png"), scale: "css" });
  await page.locator('[data-mobile-tag="todo"]').tap();
  await page.keyboard.type("scroll check");
  await expect(page.locator("#notepad-editor")).toContainText("scroll check");
});

test("iPhone keyboard offset does not accumulate during scroll or dismissal", async ({ page }, testInfo) => {
  const editor = page.locator("#notepad-editor");
  await editor.tap({ position: { x: 20, y: 20 } });
  await expect(editor).toBeFocused();
  await page.evaluate(() => {
    window.testViewport.height = 470;
    visualViewport.dispatchEvent(new Event("resize"));
    const dock = document.querySelector("[data-mobile-tag-dock]");
    const rect = dock.getBoundingClientRect.bind(dock);
    // Model a stale fixed-layer rect during Safari's asynchronous scrolling.
    // Positioning must depend on viewport metrics, never feed this lag back in.
    dock.getBoundingClientRect = () => {
      const actual = rect();
      return new DOMRect(actual.x, actual.y - Math.min(scrollY, 24), actual.width, actual.height);
    };
  });
  const dock = page.locator("[data-mobile-tag-dock]");
  const expectedOffset = await page.evaluate(() => 470 - innerHeight);
  await expect.poll(() => dock.evaluate(el => parseFloat(el.style.getPropertyValue("--mobile-tag-y")))).toBe(expectedOffset);
  for (const y of [200, 600, 300, 0]) {
    const samples = await scrollAndMeasure(page, y);
    expect(samples.every(sample => sample.y === expectedOffset)).toBe(true);
  }
  await page.evaluate(() => {
    window.testViewport.offsetTop = 80;
    window.testViewport.height = 390;
    visualViewport.dispatchEvent(new Event("scroll"));
  });
  // Keyboard panning changes the origin but keeps this visible bottom at 470.
  await expect.poll(() => dock.evaluate(el => parseFloat(el.style.getPropertyValue("--mobile-tag-y")))).toBe(expectedOffset);
  await page.evaluate(() => {
    window.testViewport.offsetTop = 0;
    window.testViewport.height = 470;
    visualViewport.dispatchEvent(new Event("scroll"));
    const keyboard = document.createElement("div");
    keyboard.textContent = "Simulated iPhone keyboard";
    Object.assign(keyboard.style, {
      position: "fixed", top: "470px", bottom: "0", left: "0", right: "0",
      background: "#d1d3d9", color: "#242529", textAlign: "center", padding: "30px 10px", zIndex: "9999"
    });
    keyboard.id = "test-keyboard";
    document.body.appendChild(keyboard);
  });
  await page.locator("[data-mobile-tag-toggle]").tap();
  await expect(page.locator(".mobile-tag-tray")).toHaveCSS("opacity", "1");
  const tray = await page.locator(".mobile-tag-tray").boundingBox();
  expect(tray.y).toBeGreaterThanOrEqual(0);
  expect(tray.y + tray.height).toBeLessThan(470);
  await page.screenshot({ path: testInfo.outputPath("iphone-keyboard-tags.png"), scale: "css" });
  await page.locator("[data-mobile-tag-toggle]").tap();
  await page.evaluate(() => {
    document.activeElement.blur();
    document.querySelector("#test-keyboard").remove();
    window.testViewport.height = innerHeight;
    visualViewport.dispatchEvent(new Event("resize"));
  });
  await expect.poll(() => dock.evaluate(el => parseFloat(el.style.getPropertyValue("--mobile-tag-y")))).toBe(0);
  expect((await scrollAndMeasure(page, 500)).every(sample => sample.y === 0)).toBe(true);
});

test("standalone iPhone keeps the toolbar above an unreported input accessory", async ({ page }, info) => {
  const editor = page.locator("#notepad-editor");
  const toggle = page.locator("[data-mobile-tag-toggle]");
  const dock = page.locator("[data-mobile-tag-dock]");
  await page.evaluate(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await toggle.tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(editor).not.toBeFocused();
  await toggle.tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  const line = editor.locator(":scope > div").first();
  await line.tap({ position: { x: 56, y: 8 } });
  await expect(editor).toBeFocused();
  await page.evaluate(() => {
    const strip = document.createElement("div");
    strip.id = "test-input-accessory";
    strip.textContent = "Simulated iOS keyboard controls";
    Object.assign(strip.style, {
      position: "fixed", left: "10px", right: "10px", bottom: "8px", height: "48px",
      background: "#dedfe3", borderRadius: "24px", display: "grid", placeItems: "center", zIndex: "9999"
    });
    document.body.appendChild(strip);
  });
  await expect(dock).toHaveAttribute("data-mobile-tag-mode", "input-accessory");
  const toolbar = await page.locator(".mobile-editor-toolbar").boundingBox();
  const strip = await page.locator("#test-input-accessory").boundingBox();
  expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(strip.y - 6);

  const offset = await dock.evaluate(el => parseFloat(el.style.getPropertyValue("--mobile-tag-y")));
  await expect.poll(() => page.evaluate(() => uiState.editorTapScroll)).toBeNull();
  const dockTop = (await dock.boundingBox()).y;
  expect((await scrollAndMeasure(page, 400)).every(sample =>
    sample.y === offset && Math.abs(sample.top - dockTop) <= 1
  )).toBe(true);
  await scrollAndMeasure(page, 0);
  const more = await toggle.boundingBox();
  await editor.evaluate(el => el.blur());
  await expect(editor).not.toBeFocused();
  await toggle.dispatchEvent("click", { clientX: more.x + more.width / 2, clientY: more.y + more.height / 2 });
  await expect(editor).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".mobile-tag-tray")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: info.outputPath("iphone-input-accessory.png"), scale: "css" });
  await page.locator('[data-mobile-tag="io"]').tap();
  await expect(line.locator('[data-tag="io"]')).toHaveCount(1);
  await page.locator(".mobile-editor-toolbar [data-editor-undo]").tap();
  await expect(line).toHaveText("Sample note line 1");
  await page.locator(".mobile-editor-toolbar [data-editor-redo]").tap();
  await expect(line.locator('[data-tag="io"]')).toHaveCount(1);

  await editor.evaluate(el => {
    el.blur();
    document.querySelector("#test-input-accessory").remove();
  });
  await expect(dock).toHaveAttribute("data-mobile-tag-mode", "native-fixed");
  expect((await scrollAndMeasure(page, 500)).every(sample => sample.y === 0)).toBe(true);
});
