import { test, expect } from "@playwright/test";

const API_URL = "https://gofrench-quiz.fantasy-tunisian-pro-league.workers.dev/generate";

function makeQuiz(
  sujet = "histoire",
  niveau = "moyen",
  count = 2
) {
  return {
    sujet,
    niveau,
    questions: Array.from({ length: count }, (_, i) => ({
      question: `Question ${i + 1} sur ${sujet} ?`,
      options: ["Option A", "Option B", "Option C", "Option D"],
      bonne_reponse: 1, // Option B is correct
      explication: `Explication ${i + 1}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
test("shows skeleton cards while API is pending", async ({ page }) => {
  let resolveRequest!: (value: unknown) => void;
  await page.route(API_URL, (route) => {
    new Promise((res) => { resolveRequest = res; }).then(() =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeQuiz()),
      })
    );
  });

  await page.goto("/");
  await page.locator("#sujet").fill("histoire");
  await page.locator("#btn-generate").click();

  await expect(page.locator(".skeleton").first()).toBeVisible();

  resolveRequest(null);
  await expect(page.locator(".skeleton").first()).not.toBeVisible({ timeout: 5000 });
});

test("generate button shows spinner text while loading", async ({ page }) => {
  let resolveRequest!: (value: unknown) => void;
  await page.route(API_URL, (route) => {
    new Promise((res) => { resolveRequest = res; }).then(() =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeQuiz()),
      })
    );
  });

  await page.goto("/");
  await page.locator("#sujet").fill("histoire");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#btn-generate")).toContainText("Génération");
  await expect(page.locator("#btn-generate")).toBeDisabled();

  resolveRequest(null);
});

// ---------------------------------------------------------------------------
// Interactive quiz flow before confirmation
// ---------------------------------------------------------------------------
test("renders question cards with confirm button, without showing answers or explanations initially", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz("test", "facile", 2)),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("test");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#results .card")).toHaveCount(2);
  await expect(page.locator("#btn-confirm")).toBeVisible();
  await expect(page.locator("#btn-confirm")).toContainText("Confirmer");

  // Answers and explanations should NOT be revealed yet
  await expect(page.locator(".option.correct")).toHaveCount(0);
  await expect(page.locator("#results")).not.toContainText("💡");
  await expect(page.locator(".score-card")).toHaveCount(0);
});

test("user can click an option to select it", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz("sciences", "facile", 1)),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("sciences");
  await page.locator("#btn-generate").click();

  const firstOption = page.locator(".option").first();
  await firstOption.click();
  await expect(firstOption).toHaveClass(/selected/);
});

// ---------------------------------------------------------------------------
// Post-confirmation feedback
// ---------------------------------------------------------------------------
test("confirming answers reveals score, correct answers in green, incorrect picks in red, and explanations", async ({ page }) => {
  const quiz = makeQuiz("geo", "moyen", 1);
  quiz.questions[0].bonne_reponse = 1; // Option B is correct

  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(quiz),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("geo");
  await page.locator("#btn-generate").click();

  // Pick Option A (index 0 - wrong answer)
  await page.locator(".option").nth(0).click();

  // Confirm
  await page.locator("#btn-confirm").click();

  // Score card shown
  await expect(page.locator(".score-card")).toBeVisible();
  await expect(page.locator(".score-card")).toContainText("0 / 1");

  // Option A should be marked incorrect
  await expect(page.locator(".option").nth(0)).toHaveClass(/incorrect/);

  // Option B should be marked correct
  await expect(page.locator(".option").nth(1)).toHaveClass(/correct/);

  // Explanation shown
  await expect(page.locator("#results")).toContainText("💡");
  await expect(page.locator("#results")).toContainText("Explication 1");
});

test("selecting the correct answer yields a 100% score", async ({ page }) => {
  const quiz = makeQuiz("maths", "facile", 1);
  quiz.questions[0].bonne_reponse = 2; // Option C

  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(quiz),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("maths");
  await page.locator("#btn-generate").click();

  // Pick Option C (index 2 - correct)
  await page.locator(".option").nth(2).click();
  await page.locator("#btn-confirm").click();

  await expect(page.locator(".score-card")).toContainText("1 / 1 (100%)");
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
test("shows error banner on 500 response", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Échec après 3 tentatives." }),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("test");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#form-error")).toBeVisible();
  await expect(page.locator("#form-error")).toContainText("Échec après 3 tentatives");
});

test("shows error banner on network failure", async ({ page }) => {
  await page.route(API_URL, (route) => route.abort("failed"));

  await page.goto("/");
  await page.locator("#sujet").fill("test");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#form-error")).toBeVisible();
});

test("no question cards rendered on error", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Server error" }),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("test");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#form-error")).toBeVisible();
  const cards = page.locator("#results .card");
  await expect(cards).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Reset flow
// ---------------------------------------------------------------------------
test("reset button appears after confirmation and resets the form", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz()),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("histoire");
  await page.locator("#btn-generate").click();

  // Confirm to reach result state
  await page.locator("#btn-confirm").click();

  await expect(page.locator(".btn-reset")).toBeVisible();
  await page.locator(".btn-reset").click();

  await expect(page.locator("#results")).toBeEmpty();
  await expect(page.locator("#sujet")).toHaveValue("");
});
