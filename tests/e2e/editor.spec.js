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
  await page.setViewportSize({ width: 592, height: 820 });
  await page.locator("#notepad-editor").click();
  await expect(page.locator("#sticky-ward-root")).toBeVisible();
  const desktopTagsVisible = await page.locator(".quick-tags").isVisible();
  if (desktopTagsVisible) await expect(page.locator('[data-quick-tag="bed"]')).toBeVisible();
  else await expect(page.locator("[data-mobile-tag-toggle]")).toBeVisible();
  await expect(page.locator("#sync-indicator")).toBeVisible();
});
