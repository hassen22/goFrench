import { describe, it, expect } from "vitest";
import {
  NiveauSchema,
  QuestionSchema,
  ReponseSchema,
  RequestBodySchema,
} from "../../src/schemas";

// ---------------------------------------------------------------------------
// RequestBodySchema
// ---------------------------------------------------------------------------
describe("RequestBodySchema", () => {
  it("accepts valid input with all three difficulty levels", () => {
    for (const niveau of ["facile", "moyen", "difficile"] as const) {
      expect(
        RequestBodySchema.safeParse({ sujet: "histoire", niveau, nombre_questions: 5 }).success
      ).toBe(true);
    }
  });

  it("accepts nombre_questions boundary values 1 and 10", () => {
    const base = { sujet: "test", niveau: "moyen" };
    expect(RequestBodySchema.safeParse({ ...base, nombre_questions: 1 }).success).toBe(true);
    expect(RequestBodySchema.safeParse({ ...base, nombre_questions: 10 }).success).toBe(true);
  });

  it("rejects empty sujet", () => {
    const r = RequestBodySchema.safeParse({ sujet: "", niveau: "facile", nombre_questions: 3 });
    expect(r.success).toBe(false);
  });

  it("rejects nombre_questions = 0", () => {
    const r = RequestBodySchema.safeParse({ sujet: "test", niveau: "facile", nombre_questions: 0 });
    expect(r.success).toBe(false);
  });

  it("rejects nombre_questions = 11", () => {
    const r = RequestBodySchema.safeParse({ sujet: "test", niveau: "facile", nombre_questions: 11 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer nombre_questions", () => {
    const r = RequestBodySchema.safeParse({ sujet: "test", niveau: "facile", nombre_questions: 2.5 });
    expect(r.success).toBe(false);
  });

  it("rejects invalid niveau", () => {
    const r = RequestBodySchema.safeParse({ sujet: "test", niveau: "extreme", nombre_questions: 3 });
    expect(r.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(RequestBodySchema.safeParse({ sujet: "test" }).success).toBe(false);
    expect(RequestBodySchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NiveauSchema
// ---------------------------------------------------------------------------
describe("NiveauSchema", () => {
  it("accepts the three valid values", () => {
    expect(NiveauSchema.safeParse("facile").success).toBe(true);
    expect(NiveauSchema.safeParse("moyen").success).toBe(true);
    expect(NiveauSchema.safeParse("difficile").success).toBe(true);
  });

  it("rejects unknown levels", () => {
    expect(NiveauSchema.safeParse("easy").success).toBe(false);
    expect(NiveauSchema.safeParse("").success).toBe(false);
    expect(NiveauSchema.safeParse(null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QuestionSchema
// ---------------------------------------------------------------------------
describe("QuestionSchema", () => {
  const valid = {
    question: "Quelle est la capitale de la France ?",
    options: ["Lyon", "Marseille", "Paris", "Bordeaux"],
    bonne_reponse: 2,
    explication: "Paris est la capitale.",
  };

  it("accepts a fully valid question", () => {
    expect(QuestionSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts bonne_reponse at boundaries 0 and 3", () => {
    expect(QuestionSchema.safeParse({ ...valid, bonne_reponse: 0 }).success).toBe(true);
    expect(QuestionSchema.safeParse({ ...valid, bonne_reponse: 3 }).success).toBe(true);
  });

  it("rejects options array with fewer than 4 items", () => {
    const r = QuestionSchema.safeParse({ ...valid, options: ["A", "B", "C"] });
    expect(r.success).toBe(false);
  });

  it("rejects options array with more than 4 items", () => {
    const r = QuestionSchema.safeParse({ ...valid, options: ["A", "B", "C", "D", "E"] });
    expect(r.success).toBe(false);
  });

  it("rejects bonne_reponse = -1", () => {
    expect(QuestionSchema.safeParse({ ...valid, bonne_reponse: -1 }).success).toBe(false);
  });

  it("rejects bonne_reponse = 4", () => {
    expect(QuestionSchema.safeParse({ ...valid, bonne_reponse: 4 }).success).toBe(false);
  });

  it("rejects non-integer bonne_reponse", () => {
    expect(QuestionSchema.safeParse({ ...valid, bonne_reponse: 1.5 }).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const { explication, ...withoutExplication } = valid;
    expect(QuestionSchema.safeParse(withoutExplication).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ReponseSchema
// ---------------------------------------------------------------------------
describe("ReponseSchema", () => {
  const validReponse = {
    sujet: "géographie",
    niveau: "moyen",
    questions: [
      {
        question: "Q?",
        options: ["A", "B", "C", "D"],
        bonne_reponse: 0,
        explication: "Parce que A.",
      },
    ],
  };

  it("accepts a fully valid response", () => {
    expect(ReponseSchema.safeParse(validReponse).success).toBe(true);
  });

  it("accepts an empty questions array", () => {
    expect(ReponseSchema.safeParse({ ...validReponse, questions: [] }).success).toBe(true);
  });

  it("accepts multiple valid questions", () => {
    const q = validReponse.questions[0];
    expect(
      ReponseSchema.safeParse({ ...validReponse, questions: [q, q, q] }).success
    ).toBe(true);
  });

  it("rejects missing sujet", () => {
    const { sujet, ...without } = validReponse;
    expect(ReponseSchema.safeParse(without).success).toBe(false);
  });

  it("rejects invalid niveau", () => {
    expect(ReponseSchema.safeParse({ ...validReponse, niveau: "unknown" }).success).toBe(false);
  });

  it("rejects a question with wrong options length inside the array", () => {
    const badQuestion = { ...validReponse.questions[0], options: ["A", "B"] };
    expect(ReponseSchema.safeParse({ ...validReponse, questions: [badQuestion] }).success).toBe(false);
  });
});
