const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?e2e=1&workspace=shift");
  await expect(page.locator("#notepad-editor")).toBeVisible();
});

async function chooseTag(page, tag) {
  const desktopButton = page.locator(`[data-quick-tag="${tag}"]`);
  if (await desktopButton.isVisible()) {
    await desktopButton.click();
    return;
  }
  await page.locator("[data-mobile-tag-toggle]").click();
  await page.locator(`[data-mobile-tag="${tag}"]`).click();
}

test("Bed and HN tags finalize on their own lines", async ({ page }) => {
  const editor = page.locator("#notepad-editor");
  await editor.click();
  await chooseTag(page, "bed");
  await page.keyboard.type("3");
  await page.keyboard.press("Enter");
  await chooseTag(page, "hn");
  await page.keyboard.type("1234567");
  await page.keyboard.press("Enter");

  await expect(editor.locator('.tag-token[data-tag="bed"]')).toHaveText("Bed 3");
  await expect(editor.locator('.tag-token[data-tag="hn"]')).toHaveText("HN 1234567");
  await expect(editor.locator(':scope > div').nth(0)).toContainText("Bed 3");
  await expect(editor.locator(':scope > div').nth(1)).toContainText("HN 1234567");
});

test("To-do continues once and an empty continuation deletes cleanly", async ({ page }) => {
  const editor = page.locator("#notepad-editor");
  await editor.click();
  await chooseTag(page, "todo");
  await page.keyboard.type("review labs");
  await page.keyboard.press("Enter");
  await expect(editor.locator('.tag-token[data-tag="todo"]')).toHaveCount(2);
  await page.keyboard.press("Backspace");
  await expect(editor.locator('.tag-token[data-tag="todo"]')).toHaveCount(1);
  await expect(editor).toContainText("review labs");
});

test("Time, Lab and I/O tags remain separate and keep the caret editable", async ({ page }) => {
  const editor = page.locator("#notepad-editor");
  await editor.click();
  for (const tag of ["time", "lab", "io"]) {
    await chooseTag(page, tag);
    if (tag !== "io") await page.keyboard.press("Enter");
    await page.keyboard.type(`${tag} item`);
    await page.keyboard.press("Enter");
  }
  await expect(editor.locator('.tag-token[data-tag="time"]')).toHaveCount(1);
  await expect(editor.locator('.tag-token[data-tag="lab"]')).toHaveCount(1);
  await expect(editor.locator('.tag-token[data-tag="io"]')).toHaveCount(1);
  await expect(editor).toContainText("io item");
});

test("pasted rich text is normalized to the notepad typography", async ({ page }) => {
  const editor = page.locator("#notepad-editor");
  await editor.click();
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "first line\nsecond line");
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(editor).toContainText("first line");
  await expect(editor).toContainText("second line");
  await expect(editor.locator("font, h1, h2, h3")).toHaveCount(0);
});

test("compact widths keep the ward title and tag controls visible", async ({ page }) => {
  await page.setViewportSize({ width: 381, height: 588 });
  await page.locator("#notepad-editor").click();
  await expect(page.locator("#sticky-ward-root")).toBeVisible();
  const headerGeometry = await page.evaluate(() => {
    const header = document.querySelector(".app-header")?.getBoundingClientRect();
    const settings = document.querySelector("#menu-btn")?.getBoundingClientRect();
    const wards = document.querySelector("#ward-options-btn")?.getBoundingClientRect();
    return {
      headerTop: header?.top || 0,
      headerBottom: header?.bottom || 0,
      settingsTop: settings?.top || 0,
      wardsTop: wards?.top || 0,
      wardsBottom: wards?.bottom || 0,
      wardsRight: wards?.right || 0,
      headerRight: header?.right || 0
    };
  });
  expect(Math.abs(headerGeometry.settingsTop - headerGeometry.wardsTop)).toBeLessThanOrEqual(1);
  expect(headerGeometry.wardsTop).toBeGreaterThanOrEqual(headerGeometry.headerTop);
  expect(headerGeometry.wardsBottom).toBeLessThanOrEqual(headerGeometry.headerBottom + 1);
  expect(headerGeometry.wardsRight).toBeLessThanOrEqual(headerGeometry.headerRight + 1);
  const desktopTagsVisible = await page.locator(".quick-tags").isVisible();
  if (desktopTagsVisible) {
    await expect(page.locator('[data-quick-tag="bed"]')).toBeVisible();
    const geometry = await page.evaluate(() => ({
      tagsBottom: document.querySelector(".quick-tags")?.getBoundingClientRect().bottom || 0,
      tagsHeight: document.querySelector(".quick-tags")?.getBoundingClientRect().height || 0,
      editorTop: document.querySelector("#notepad-editor")?.getBoundingClientRect().top || 0,
      firstLineTop: document.querySelector("#notepad-editor")?.firstElementChild?.getBoundingClientRect().top || 0
    }));
    expect(geometry.tagsHeight).toBeLessThanOrEqual(112);
    expect(geometry.editorTop).toBeGreaterThanOrEqual(geometry.tagsBottom);
    expect(geometry.firstLineTop).toBeGreaterThanOrEqual(geometry.tagsBottom);
  } else {
    await expect(page.locator("[data-mobile-tag-toggle]")).toBeVisible();
  }
  await expect(page.locator("#sync-indicator")).toBeVisible();
});

test("focused editor accepts a clean remote revision without losing its caret", async ({ page }) => {
  const editor = page.locator("#notepad-editor");
  await editor.evaluate((element) => {
    element.innerHTML = [
      '<div data-line-id="line-a">first</div>',
      '<div data-line-id="line-b">second</div>'
    ].join("");
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    const text = element.children[1].firstChild;
    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    element.focus({ preventScroll: true });
    window.rememberEditorSelection(element, { force: true });
  });

  await page.evaluate(() => {
    const note = window.getCurrentNote();
    window.setNoteDocumentHtml(note, [
      '<div data-line-id="line-a">first from monitor two</div>',
      '<div data-line-id="line-b">second</div>'
    ].join(""));
    window.patchCurrentNoteEditorFromModel({
      workspaceKey: "shift",
      ward: window.getCurrentWard(),
      note
    }, { source: "e2e" });
  });

  await expect(editor.locator('[data-line-id="line-a"]')).toHaveText("first from monitor two");
  const caret = await page.evaluate(() => {
    const editorElement = document.querySelector("#notepad-editor");
    const selection = window.getSelection();
    const line = selection?.anchorNode?.parentElement?.closest?.("[data-line-id]");
    return {
      focused: document.activeElement === editorElement,
      lineId: line?.dataset?.lineId || "",
      offset: selection?.anchorOffset ?? -1
    };
  });
  expect(caret).toEqual({ focused: true, lineId: "line-b", offset: 3 });
});

test("long desktop notes extend the document and scroll to their final line", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const editor = page.locator("#notepad-editor");
  await editor.evaluate((element) => {
    element.innerHTML = Array.from({ length: 90 }, (_, index) =>
      `<div data-line-id="long-${index}">Long note line ${index + 1}</div>`
    ).join("");
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  });

  const staleClearance = await page.evaluate(() => {
    document.documentElement.style.setProperty("--desktop-tags-height", "105px");
    document.documentElement.style.setProperty("--desktop-tags-clearance", "17070px");
    return {
      applied: getComputedStyle(document.querySelector(".document-pad")).marginTop,
      requested: getComputedStyle(document.documentElement).getPropertyValue("--desktop-tags-clearance").trim()
    };
  });
  expect(staleClearance.requested).toBe("17070px");
  expect(Number.parseFloat(staleClearance.applied)).toBeLessThanOrEqual(115);

  const before = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    maxScrollY: document.documentElement.scrollHeight - window.innerHeight
  }));
  expect(before.documentHeight).toBeGreaterThan(before.viewportHeight);
  expect(before.maxScrollY).toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "auto" }));
  await page.waitForTimeout(80);
  const midScroll = await page.evaluate(() => ({
    appliedClearance: getComputedStyle(document.querySelector(".document-pad")).marginTop,
    documentHeight: document.documentElement.scrollHeight,
    requestedClearance: getComputedStyle(document.documentElement)
      .getPropertyValue("--desktop-tags-clearance")
      .trim()
  }));
  expect(Number.parseFloat(midScroll.requestedClearance)).toBeLessThanOrEqual(180);
  expect(Number.parseFloat(midScroll.appliedClearance)).toBeLessThanOrEqual(180);
  expect(midScroll.documentHeight).toBeLessThanOrEqual(before.documentHeight + 2);

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" }));
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    lastLineBottom: document.querySelector('[data-line-id="long-89"]')?.getBoundingClientRect().bottom || Infinity,
    viewportHeight: window.innerHeight
  }));
  expect(after.scrollY).toBeGreaterThan(0);
  expect(after.lastLineBottom).toBeLessThanOrEqual(after.viewportHeight + 1);
});
