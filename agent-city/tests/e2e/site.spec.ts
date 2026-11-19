import { expect, test } from "@playwright/test";

test("city: map renders, feed fills, search finds who does what", async ({ page, isMobile }) => {
  await page.goto("/city");
  await expect(page.getByTestId("city-canvas").locator("canvas")).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => (window as unknown as { __cityReady?: boolean }).__cityReady === true);
  await page.getByTestId("search").fill("Voiceover");
  await page.getByRole("button", { name: /Voiceover \(Content\)/ }).click();
  await expect(page.getByTestId("resident-card")).toBeVisible();
  await expect(page.getByTestId("resident-card")).toContainText("Voiceover");
  await expect(page.getByTestId("current-task")).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Fil" }).click();
  await expect(page.getByTestId("feed").locator("li").first()).toBeVisible();
});

test("brain: 3D graph and counters", async ({ page }) => {
  await page.goto("/brain");
  await page.waitForFunction(() => (window as unknown as { __brainReady?: boolean }).__brainReady === true, null, { timeout: 30000 });
  await expect(page.getByTestId("brain-stats")).toContainText("Notes");
  await page.getByPlaceholder(/Chercher une note/).fill("Playbook");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("note-panel")).toContainText("Playbook");
});

test("system: kill switch toggles", async ({ page }) => {
  await page.goto("/system");
  const btn = page.getByTestId("kill-switch");
  await expect(btn).toBeVisible();
  const before = await btn.textContent();
  await btn.click();
  await expect(btn).not.toHaveText(before!);
  await btn.click();
  await expect(btn).toHaveText(before!);
});

test("gallery lists content and real post stats", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery").locator("article").first()).toBeVisible();
});

test("messages: ready-made replies include the ELM link", async ({ page }) => {
  await page.goto("/messages");
  const first = page.getByTestId("replies").locator("article").first();
  await expect(first).toBeVisible();
  await expect(page.getByTestId("replies")).toContainText("shop.beacons.ai/manu.digital");
  await expect(page.getByTestId("replies")).not.toContainText("Netflix");
});
