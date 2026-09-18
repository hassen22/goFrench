import { describe, it, expect } from "vitest";
import { buildInitialPrompt, buildRetryPrompt } from "../../src/prompts";

describe("buildInitialPrompt", () => {
  it("includes the sujet in the prompt", () => {
    const p = buildInitialPrompt("histoire de France", "moyen", 3);
    expect(p).toContain("histoire de France");
  });

  it("includes the niveau in the prompt", () => {
    const p = buildInitialPrompt("sciences", "difficile", 5);
    expect(p).toContain("difficile");
  });

  it("includes nombre_questions in the prompt", () => {
    const p = buildInitialPrompt("géographie", "facile", 7);
    expect(p).toContain("7");
  });

  it("embeds the JSON schema structure", () => {
    const p = buildInitialPrompt("maths", "moyen", 2);
    expect(p).toContain("bonne_reponse");
    expect(p).toContain("explication");
    expect(p).toContain("options");
  });

  it("instructs model to return raw JSON without markdown", () => {
    const p = buildInitialPrompt("art", "facile", 1);
    expect(p).toContain("JSON brut");
    expect(p).toContain("sans balises markdown");
  });

  it("works for all three difficulty levels", () => {
    for (const niveau of ["facile", "moyen", "difficile"] as const) {
      const p = buildInitialPrompt("test", niveau, 1);
      expect(p).toContain(niveau);
    }
  });
});

describe("buildRetryPrompt", () => {
  const baseArgs = ["test", "moyen", 2] as const;

  it("includes the previous error message", () => {
    const p = buildRetryPrompt(...baseArgs, "JSON invalide: Unexpected token", "bad output");
    expect(p).toContain("JSON invalide: Unexpected token");
  });

  it("includes the previous output (up to 500 chars)", () => {
    const longOutput = "x".repeat(600);
    const p = buildRetryPrompt(...baseArgs, "err", longOutput);
    expect(p).toContain("x".repeat(500));
    expect(p).not.toContain("x".repeat(501));
  });

  it("references the previous failed attempt explicitly", () => {
    const p = buildRetryPrompt(...baseArgs, "err", "bad");
    expect(p).toContain("Ta tentative précédente");
  });

  it("still embeds the JSON schema structure", () => {
    const p = buildRetryPrompt(...baseArgs, "err", "bad");
    expect(p).toContain("bonne_reponse");
    expect(p).toContain("options");
  });

  it("differs from the initial prompt", () => {
    const initial = buildInitialPrompt(...baseArgs);
    const retry = buildRetryPrompt(...baseArgs, "error", "bad output");
    expect(initial).not.toEqual(retry);
  });

  it("still contains the sujet and niveau", () => {
    const p = buildRetryPrompt("chimie", "difficile", 4, "err", "bad");
    expect(p).toContain("chimie");
    expect(p).toContain("difficile");
  });
});
