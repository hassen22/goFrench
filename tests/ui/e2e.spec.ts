import { test, expect } from "@playwright/test";

const API_URL = "https://gofrench-quiz.fantasy-tunisian-pro-league.workers.dev/generate";

function makeQuiz(sujet = "géographie", niveau = "moyen", count = 3) {
  return {
    sujet,
    niveau,
    questions: Array.from({ length: count }, (_, i) => ({
      question: `Question ${i + 1} sur ${sujet} ?`,
      options: [`Option A`, `Option B`, `Option C`, `Option D`],
      bonne_reponse: 0,
      explication: `Option A est correcte pour la question ${i + 1}.`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Full user flow — all difficulty levels
// ---------------------------------------------------------------------------
for (const niveau of ["facile", "moyen", "difficile"] as const) {
  test(`full interactive flow with niveau = ${niveau}`, async ({ page }) => {
    await page.route(API_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(makeQuiz("test", niveau, 2)),
      })
    );

    await page.goto("/");
    await page.locator(".pill-btn", { hasText: niveau === "facile" ? "Facile" : niveau === "moyen" ? "Moyen" : "Difficile" }).click();
    await page.locator("#sujet").fill(`test sujet ${niveau}`);
    await page.locator("#btn-generate").click();

    await expect(page.locator("#results .card")).toHaveCount(2);

    // Answer questions
    await page.locator('[data-q="0"][data-opt="0"]').click();
    await page.locator('[data-q="1"][data-opt="1"]').click();

    // Confirm
    await page.locator("#btn-confirm").click();

    // Verify results
    await expect(page.locator(".score-card")).toBeVisible();
    await expect(page.locator(".option.correct")).toHaveCount(2);
    await expect(page.locator(".option.incorrect")).toHaveCount(1);
    await expect(page.locator(".btn-reset")).toBeVisible();
  });
}

// ---------------------------------------------------------------------------
// Nombre de questions boundary values
// ---------------------------------------------------------------------------
test("full flow with nombre_questions = 1", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz("bio", "facile", 1)),
    })
  );

  await page.goto("/");
  await page.locator("#btn-minus").click();
  await page.locator("#btn-minus").click();
  await expect(page.locator("#count-display")).toHaveText("1");

  await page.locator("#sujet").fill("biologie");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#results .card")).toHaveCount(1);
  await page.locator('[data-q="0"][data-opt="0"]').click();
  await page.locator("#btn-confirm").click();

  await expect(page.locator(".score-card")).toContainText("1 / 1 (100%)");
});

test("full flow with nombre_questions = 5", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz("physique", "moyen", 5)),
    })
  );

  await page.goto("/");
  await page.locator("#btn-plus").click();
  await page.locator("#btn-plus").click();
  await expect(page.locator("#count-display")).toHaveText("5");

  await page.locator("#sujet").fill("physique");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#results .card")).toHaveCount(5);
  await expect(page.locator("#btn-confirm")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Enter key triggers generation
// ---------------------------------------------------------------------------
test("pressing Enter on a filled sujet triggers generation", async ({ page }) => {
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz()),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("chimie");
  await page.locator("#sujet").press("Enter");

  await expect(page.locator("#results .card")).toHaveCount(3);
  await expect(page.locator("#btn-confirm")).toBeVisible();
});

// ---------------------------------------------------------------------------
// Multiple generations in a row
// ---------------------------------------------------------------------------
test("can generate multiple times sequentially with reset", async ({ page }) => {
  let callCount = 0;
  await page.route(API_URL, (route) => {
    callCount++;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeQuiz(`sujet-${callCount}`, "moyen", 1)),
    });
  });

  await page.goto("/");

  // First generation
  await page.locator("#sujet").fill("premier sujet");
  await page.locator("#btn-generate").click();
  await page.locator("#btn-confirm").click();
  await expect(page.locator(".btn-reset")).toBeVisible();

  // Reset and generate again
  await page.locator(".btn-reset").click();
  await page.locator("#sujet").fill("deuxième sujet");
  await page.locator("#btn-generate").click();
  await expect(page.locator("#btn-confirm")).toBeVisible();

  expect(callCount).toBe(2);
});

// ---------------------------------------------------------------------------
// XSS — special characters in sujet are escaped in the DOM
// ---------------------------------------------------------------------------
test("special characters in sujet are HTML-escaped in question text", async ({ page }) => {
  const xssPayload = "<script>alert('xss')</script>";
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sujet: xssPayload,
        niveau: "facile",
        questions: [
          {
            question: `Question sur ${xssPayload} ?`,
            options: ["A", "B", "C", "D"],
            bonne_reponse: 0,
            explication: `Explication avec ${xssPayload}`,
          },
        ],
      }),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill(xssPayload);
  await page.locator("#btn-generate").click();

  await page.waitForSelector(".option");
  const resultsHtml = await page.locator("#results").innerHTML();
  expect(resultsHtml).toContain("&lt;script&gt;");
  await expect(page.locator("#results script")).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// Long content renders without layout break
// ---------------------------------------------------------------------------
test("long question text renders without overflow errors", async ({ page }) => {
  const longText = "Quelle est la réponse à cette très longue question qui pourrait potentiellement casser la mise en page du composant de quiz si le texte dépasse une certaine longueur ?";
  await page.route(API_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sujet: "test",
        niveau: "moyen",
        questions: [
          { question: longText, options: ["A", "B", "C", "D"], bonne_reponse: 0, explication: "Expl." },
        ],
      }),
    })
  );

  await page.goto("/");
  await page.locator("#sujet").fill("test");
  await page.locator("#btn-generate").click();

  await expect(page.locator("#results")).toContainText(longText.slice(0, 50));
});
