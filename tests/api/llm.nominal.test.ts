import { describe, it, expect, vi } from "vitest";
import { generateQuiz, type Env } from "../../src/llm";
import { ReponseSchema } from "../../src/schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a valid AI response for 2 questions on a given subject */
function makeValidPayload(sujet = "géographie mondiale", niveau = "moyen") {
  return JSON.stringify({
    sujet,
    niveau,
    questions: [
      {
        question: "Quelle est la capitale de la France ?",
        options: ["Lyon", "Marseille", "Paris", "Bordeaux"],
        bonne_reponse: 2,
        explication: "Paris est la capitale et la plus grande ville de France.",
      },
      {
        question: "Quel est le plus grand océan du monde ?",
        options: [
          "Océan Atlantique",
          "Océan Pacifique",
          "Océan Indien",
          "Océan Arctique",
        ],
        bonne_reponse: 1,
        explication:
          "L'océan Pacifique est le plus grand et le plus profond des océans.",
      },
    ],
  });
}

/** Creates a mock Env with a pre-configured AI stub */
function makeMockEnv(
  mockFn: ReturnType<typeof vi.fn>
): Env {
  return {
    AI: {
      run: mockFn,
    } as unknown as Ai,
  };
}

// ---------------------------------------------------------------------------
// Nominal case — valid LLM response passes schema
// ---------------------------------------------------------------------------
describe("generateQuiz — cas nominal", () => {
  it("retourne une réponse conforme au ReponseSchema", async () => {
    const mockRun = vi.fn().mockResolvedValue({
      response: makeValidPayload("géographie mondiale", "moyen"),
    });

    const env = makeMockEnv(mockRun);

    const result = await generateQuiz(env, "géographie mondiale", "moyen", 2);

    // Must not throw — Zod schema must accept the result
    const parsed = ReponseSchema.safeParse(result);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.sujet).toBe("géographie mondiale");
      expect(parsed.data.niveau).toBe("moyen");
      expect(parsed.data.questions).toHaveLength(2);

      for (const q of parsed.data.questions) {
        expect(q.options).toHaveLength(4);
        expect(q.bonne_reponse).toBeGreaterThanOrEqual(0);
        expect(q.bonne_reponse).toBeLessThanOrEqual(3);
        expect(typeof q.explication).toBe("string");
      }
    }

    // AI should have been called exactly once (no retry needed)
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("appelle le bon modèle Cloudflare AI", async () => {
    const mockRun = vi.fn().mockResolvedValue({
      response: makeValidPayload(),
    });

    const env = makeMockEnv(mockRun);
    await generateQuiz(env, "histoire", "facile", 2);

    expect(mockRun).toHaveBeenCalledWith(
      "@cf/meta/llama-3.1-8b-instruct-fp8",
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });

  it("accepte les niveaux facile et difficile", async () => {
    for (const niveau of ["facile", "difficile"] as const) {
      const mockRun = vi.fn().mockResolvedValue({
        response: JSON.stringify({
          sujet: "sciences",
          niveau,
          questions: [
            {
              question: "Question de test ?",
              options: ["A", "B", "C", "D"],
              bonne_reponse: 0,
              explication: "Explication.",
            },
          ],
        }),
      });

      const env = makeMockEnv(mockRun);
      const result = await generateQuiz(env, "sciences", niveau, 1);

      expect(ReponseSchema.safeParse(result).success).toBe(true);
    }
  });

  it("gère une réponse enveloppée dans des balises markdown", async () => {
    const validJson = makeValidPayload();
    const mockRun = vi.fn().mockResolvedValue({
      response: `\`\`\`json\n${validJson}\n\`\`\``,
    });

    const env = makeMockEnv(mockRun);
    const result = await generateQuiz(env, "géographie mondiale", "moyen", 2);

    expect(ReponseSchema.safeParse(result).success).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
