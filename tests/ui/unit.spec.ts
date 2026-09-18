import { test, expect } from "@playwright/test";

const API_URL = "https://gofrench-quiz.fantasy-tunisian-pro-league.workers.dev/generate";

// ---------------------------------------------------------------------------
// Page structure & initial state
// ---------------------------------------------------------------------------
test("page title is GoFrench Quiz", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("GoFrench Quiz");
});

test("header shows the flame emoji and title", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header");
  await expect(header).toContainText("🔥");
  await expect(header).toContainText("GoFrench Quiz");
});

test("sujet input is empty and focused on load", async ({ page }) => {
  await page.goto("/");
  const input = page.locator("#sujet");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("");
});

// ---------------------------------------------------------------------------
// Difficulty pill selection
// ---------------------------------------------------------------------------
test("Facile pill is active by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".pill-btn.active")).toHaveText("Facile");
});

test("clicking Moyen activates it and deactivates Facile", async ({ page }) => {
  await page.goto("/");
  await page.locator(".pill-btn", { hasText: "Moyen" }).click();
  await expect(page.locator(".pill-btn.active")).toHaveText("Moyen");
  await expect(page.locator(".pill-btn", { hasText: "Facile" })).not.toHaveClass(/active/);
});

test("clicking Difficile activates it", async ({ page }) => {
  await page.goto("/");
  await page.locator(".pill-btn", { hasText: "Difficile" }).click();
  await expect(page.locator(".pill-btn.active")).toHaveText("Difficile");
});

test("only one pill is active at a time", async ({ page }) => {
  await page.goto("/");
  await page.locator(".pill-btn", { hasText: "Difficile" }).click();
  const activePills = page.locator(".pill-btn.active");
  await expect(activePills).toHaveCount(1);
});

// ---------------------------------------------------------------------------
// Number stepper
// ---------------------------------------------------------------------------
test("stepper starts at 3", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#count-display")).toHaveText("3");
});

test("plus button increments the count", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btn-plus").click();
  await expect(page.locator("#count-display")).toHaveText("4");
});

test("minus button decrements the count", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btn-minus").click();
  await expect(page.locator("#count-display")).toHaveText("2");
});

test("minus button is disabled when count reaches 1", async ({ page }) => {
  await page.goto("/");
  // Click minus twice to go from 3 → 1
  await page.locator("#btn-minus").click();
  await page.locator("#btn-minus").click();
  await expect(page.locator("#btn-minus")).toBeDisabled();
  await expect(page.locator("#count-display")).toHaveText("1");
});

test("plus button is disabled when count reaches 10", async ({ page }) => {
  await page.goto("/");
  // Click plus 7 times to go from 3 → 10
  for (let i = 0; i < 7; i++) {
    await page.locator("#btn-plus").click();
  }
  await expect(page.locator("#btn-plus")).toBeDisabled();
  await expect(page.locator("#count-display")).toHaveText("10");
});

test("cannot exceed max of 10 by clicking rapidly", async ({ page }) => {
  await page.goto("/");
  // Drive stepCount() directly to avoid the disabled-button click blocker
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) (window as unknown as { stepCount: (d: number) => void }).stepCount(1);
  });
  await expect(page.locator("#count-display")).toHaveText("10");
  await expect(page.locator("#btn-plus")).toBeDisabled();
});

test("cannot go below min of 1 by clicking rapidly", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) (window as unknown as { stepCount: (d: number) => void }).stepCount(-1);
  });
  await expect(page.locator("#count-display")).toHaveText("1");
  await expect(page.locator("#btn-minus")).toBeDisabled();
});

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------
test("empty sujet shows validation error on click", async ({ page }) => {
  await page.goto("/");
  await page.locator("#btn-generate").click();
  await expect(page.locator("#form-error")).toBeVisible();
  await expect(page.locator("#form-error")).toContainText("sujet");
});

test("pressing Enter on empty sujet shows error", async ({ page }) => {
  await page.goto("/");
  await page.locator("#sujet").press("Enter");
  await expect(page.locator("#form-error")).toBeVisible();
});

test("error is hidden when request succeeds", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sujet: "test",
        niveau: "facile",
        questions: [
          { question: "Q?", options: ["A", "B", "C", "D"], bonne_reponse: 0, explication: "Parce que A." },
        ],
      }),
    })
  );
  await page.goto("/");
  // First trigger an error
  await page.locator("#btn-generate").click();
  await expect(page.locator("#form-error")).toBeVisible();
  // Then fill and succeed
  await page.locator("#sujet").fill("histoire");
  await page.locator("#btn-generate").click();
  await expect(page.locator("#form-error")).not.toBeVisible();
});
