import { describe, it, expect, vi } from "vitest";
import { generateQuiz, type Env } from "../../src/llm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockEnv(mockFn: ReturnType<typeof vi.fn>): Env {
  return {
    AI: {
      run: mockFn,
    } as unknown as Ai,
  };
}

function makeValidPayload(sujet = "mathématiques", niveau = "facile") {
  return JSON.stringify({
    sujet,
    niveau,
    questions: [
      {
        question: "Combien font 2 + 2 ?",
        options: ["3", "4", "5", "6"],
        bonne_reponse: 1,
        explication: "2 + 2 = 4, c'est une addition basique.",
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Retry logic tests
// ---------------------------------------------------------------------------
describe("generateQuiz — logique de retry", () => {
  it("réessaie après un JSON malformé et réussit à la 2e tentative", async () => {
    const mockRun = vi
      .fn()
      // Attempt 1: invalid JSON
      .mockResolvedValueOnce({ response: "Ce n'est pas du JSON valide {{" })
      // Attempt 2: valid
      .mockResolvedValueOnce({ response: makeValidPayload() });

    const env = makeMockEnv(mockRun);
    const result = await generateQuiz(env, "mathématiques", "facile", 1);

    expect(result.sujet).toBe("mathématiques");
    expect(result.questions).toHaveLength(1);
    // Should have called AI exactly twice
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it("réessaie après un schéma invalide (champ manquant) et réussit à la 3e tentative", async () => {
    const invalidSchema = JSON.stringify({
      sujet: "mathématiques",
      niveau: "facile",
      questions: [
        {
          question: "Combien font 2 + 2 ?",
          // Missing "options", "bonne_reponse", "explication"
        },
      ],
    });

    const mockRun = vi
      .fn()
      // Attempt 1: missing fields
      .mockResolvedValueOnce({ response: invalidSchema })
      // Attempt 2: still missing fields (different error)
      .mockResolvedValueOnce({
        response: JSON.stringify({
          sujet: "mathématiques",
          niveau: "facile",
          questions: [
            {
              question: "Q?",
              options: ["A", "B"], // only 2 options — schema requires 4
              bonne_reponse: 0,
              explication: "Explication.",
            },
          ],
        }),
      })
      // Attempt 3: valid
      .mockResolvedValueOnce({ response: makeValidPayload() });

    const env = makeMockEnv(mockRun);
    const result = await generateQuiz(env, "mathématiques", "facile", 1);

    expect(result.questions[0].options).toHaveLength(4);
    expect(mockRun).toHaveBeenCalledTimes(3);
  });

  it("retourne une erreur explicite après 3 tentatives échouées (JSON invalide)", async () => {
    const mockRun = vi
      .fn()
      .mockResolvedValue({ response: "### Pas du JSON du tout ###" });

    const env = makeMockEnv(mockRun);

    await expect(
      generateQuiz(env, "histoire", "difficile", 2)
    ).rejects.toThrow(/Échec après 3 tentatives/);

    // Must have attempted exactly 3 times
    expect(mockRun).toHaveBeenCalledTimes(3);
  });

  it("retourne une erreur explicite après 3 tentatives échouées (schéma invalide)", async () => {
    const badSchema = JSON.stringify({
      sujet: "histoire",
      niveau: "difficile",
      questions: [
        {
          question: "Q?",
          options: ["A", "B", "C"], // only 3 — should be 4
          bonne_reponse: 5, // out of range (0-3)
          explication: "Expl.",
        },
      ],
    });

    const mockRun = vi.fn().mockResolvedValue({ response: badSchema });

    const env = makeMockEnv(mockRun);

    await expect(
      generateQuiz(env, "histoire", "difficile", 1)
    ).rejects.toThrow(/Échec après 3 tentatives/);

    expect(mockRun).toHaveBeenCalledTimes(3);
  });

  it("réussit à la 1ère tentative sans retry si la réponse est valide", async () => {
    const mockRun = vi
      .fn()
      .mockResolvedValueOnce({ response: makeValidPayload() });

    const env = makeMockEnv(mockRun);
    await generateQuiz(env, "mathématiques", "facile", 1);

    // No retry should occur
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("utilise un prompt de retry (différent du prompt initial) pour les tentatives 2 et 3", async () => {
    const mockRun = vi
      .fn()
      .mockResolvedValueOnce({ response: "invalid json {{{" })
      .mockResolvedValueOnce({ response: makeValidPayload() });

    const env = makeMockEnv(mockRun);
    await generateQuiz(env, "mathématiques", "facile", 1);

    const firstCallArgs = mockRun.mock.calls[0][1];
    const secondCallArgs = mockRun.mock.calls[1][1];

    const firstPrompt = firstCallArgs.messages.find(
      (m: { role: string }) => m.role === "user"
    )?.content as string;
    const secondPrompt = secondCallArgs.messages.find(
      (m: { role: string }) => m.role === "user"
    )?.content as string;

    // The retry prompt should mention the previous error
    expect(secondPrompt).toContain("Ta tentative précédente a produit une erreur");
    // The retry prompt should differ from the initial one
    expect(firstPrompt).not.toEqual(secondPrompt);
  });
});
