const { test, expect } = require("@playwright/test");
const { createCipheriv, createHash, randomBytes } = require("node:crypto");

const code = "f".repeat(64);
const thai = "ทดสอบ";
const date = "2026-11-23";
const secondDate = "2026-11-29";
function encryptedRoster(firstRole = "R2ก") {
  const data = { rosters: { "2026-11": { month: "2026-11", days: [
    { date, assignments: { [firstRole]: thai, R3A: "Sample colleague" } },
    { date: secondDate, assignments: { R2ข: thai } }
  ] } } };
  const iv = randomBytes(12);
  const key = createHash("sha256").update("shiftbook-roster-encryption-v1:" + code).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(data)), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/public-config.js", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto("/?e2e=1&workspace=shift");
  await expect(page.locator("#notepad-editor")).toBeVisible();
});

async function resetFromSettings(page) {
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  await page.locator('[data-drawer-toggle="reset"]').click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Archive ShiftPad and reset", exact: true }).click();
  await expect(page.locator("[data-shiftbook-entry]")).toBeVisible();
}

test("archive and reset exposes Shiftbook setup, previews the assigned wards, and keeps them after reopening", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const requests = [];
  await page.route("**/api/shiftbook-roster", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { encrypted: encryptedRoster() } });
  });
  await page.locator("#notepad-editor").fill("Previous shift sample");
  await page.evaluate(() => {
    const remoteState = structuredClone(appState);
    authState.client = { from(table) {
      return {
        select() { return this; }, eq() { return this; }, update() { return this; },
        upsert() { return Promise.resolve({ error: null }); },
        maybeSingle() {
          return Promise.resolve({ data: { state_json: remoteState, updated_at: new Date().toISOString() }, error: null });
        },
        then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); }
      };
    } };
  });
  await resetFromSettings(page);
  const archive = await page.evaluate(() => appState.archives[0].snapshot.wards[0].notes[0].documentHtml);
  expect(archive).toContain("Previous shift sample");
  await page.evaluate(() => { authState.client = null; });
  await page.locator("[data-shiftbook-entry]").click();
  const dialog = page.getByRole("dialog", { name: "Set up shift wards" });
  await dialog.getByLabel("Private link code").fill(code);
  await dialog.getByRole("button", { name: "Connect to Shiftbook" }).click();
  await dialog.getByLabel("Shiftbook name").selectOption(thai);
  await dialog.getByLabel("Shift date (Bangkok)").fill(date);
  const wards = dialog.getByLabel("Ward names, one per line");
  await expect(wards).toHaveValue("CCU\nGenM\nPrivM\nETD");
  expect(requests).toEqual([{ accessToken: createHash("sha256").update("shiftbook-roster-access-v1:" + code).digest("hex") }]);
  for (const width of [1280, 683, 393, 320]) {
    await page.setViewportSize({ width, height: width <= 393 ? 852 : 960 });
    await expect(dialog.getByRole("button", { name: "Create ward list" })).toBeInViewport();
    expect((await dialog.getByLabel("Shiftbook name").boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath(`shiftbook-ward-preview-${width}.png`), scale: "css" });
  }
  await wards.fill("CCU\nGenM\nPrivM\nETD\nETD");
  await dialog.getByRole("button", { name: "Create ward list" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#sticky-ward-root")).toContainText("CCU");
  await expect.poll(() => page.evaluate(() => state.wards.map(ward => ward.name))).toEqual(["CCU", "GenM", "PrivM", "ETD"]);
  await page.reload();
  await expect(page.locator("#sticky-ward-root")).toContainText("CCU");
  expect(await page.evaluate(() => state.wards.map(ward => ward.name))).toEqual(["CCU", "GenM", "PrivM", "ETD"]);
  expect(errors).toEqual([]);
});

test("refresh reads a swapped role, leaves unknown coverage blank, and guards against a changed pad", async ({ page }) => {
  let role = "R2ก";
  await page.route("**/api/shiftbook-roster", route => route.fulfill({ json: { encrypted: encryptedRoster(role) } }));
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  await page.locator('[data-drawer-toggle="reset"]').click();
  await page.getByRole("button", { name: "Set up from Shiftbook" }).click();
  const dialog = page.getByRole("dialog", { name: "Set up shift wards" });
  await dialog.getByLabel("Private link code").fill(code);
  await dialog.getByRole("button", { name: "Connect to Shiftbook" }).click();
  await dialog.getByLabel("Shiftbook name").selectOption(thai);
  await dialog.getByLabel("Shift date (Bangkok)").fill("2026-11-22");
  await expect(dialog.getByRole("status")).toContainText(/no assignments/i);
  await dialog.getByRole("button", { name: "Use next scheduled shift" }).click();
  await expect(dialog.getByLabel("Shift date (Bangkok)")).toHaveValue(date);
  await expect(dialog.getByLabel("Ward names, one per line")).toHaveValue("CCU\nGenM\nPrivM\nETD");
  role = "R2ข";
  await dialog.getByRole("button", { name: "Refresh roster" }).click();
  await expect(dialog.getByRole("status")).toContainText("R2ข");
  await expect(dialog.getByLabel("Ward names, one per line")).toHaveValue("");
  await dialog.getByLabel("Ward names, one per line").fill("Sample ward");
  await page.evaluate(() => setNoteDocumentHtml(getCurrentNote(), "<div>New note on this device</div>"));
  await dialog.getByRole("button", { name: "Create ward list" }).click();
  await expect(dialog.getByRole("status")).toContainText("This pad changed");
  expect(await page.evaluate(() => getCurrentNote().documentHtml)).toContain("New note on this device");
});
