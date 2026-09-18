import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/llm")>();
  return { ...actual, generateQuiz: vi.fn() };
});

import { generateQuiz } from "../../src/llm";
import type { Env } from "../../src/llm";
import handler from "../../src/index";

const mockGenerateQuiz = generateQuiz as ReturnType<typeof vi.fn>;

const mockEnv: Env = { AI: {} as Ai };

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

const validBody = { sujet: "histoire", niveau: "moyen", nombre_questions: 3 };

const validQuiz = {
  sujet: "histoire",
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

beforeEach(() => {
  mockGenerateQuiz.mockReset();
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------
describe("GET /", () => {
  it("returns 200 with service info", async () => {
    const res = await handler.fetch(req("GET", "/"), mockEnv);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, any>;
    expect(data.status).toBe("ok");
    expect(data.service).toBe("gofrench-quiz");
    expect(data.model).toBe("@cf/meta/llama-3.1-8b-instruct-fp8");
  });

  it("includes CORS headers", async () => {
    const res = await handler.fetch(req("GET", "/"), mockEnv);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ---------------------------------------------------------------------------
// OPTIONS preflight
// ---------------------------------------------------------------------------
describe("OPTIONS /generate", () => {
  it("returns 204 with CORS headers", async () => {
    const res = await handler.fetch(req("OPTIONS", "/generate"), mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

// ---------------------------------------------------------------------------
// POST /generate — success
// ---------------------------------------------------------------------------
describe("POST /generate — success", () => {
  it("returns 200 and calls generateQuiz with correct params", async () => {
    mockGenerateQuiz.mockResolvedValueOnce(validQuiz);
    const res = await handler.fetch(req("POST", "/generate", validBody), mockEnv);
    expect(res.status).toBe(200);
    expect(mockGenerateQuiz).toHaveBeenCalledWith(
      mockEnv, "histoire", "moyen", 3
    );
  });

  it("returns the quiz payload from generateQuiz", async () => {
    mockGenerateQuiz.mockResolvedValueOnce(validQuiz);
    const res = await handler.fetch(req("POST", "/generate", validBody), mockEnv);
    const data = await res.json() as Record<string, any>;
    expect(data.sujet).toBe("histoire");
    expect(data.questions).toHaveLength(1);
  });

  it("works with nombre_questions = 1", async () => {
    mockGenerateQuiz.mockResolvedValueOnce(validQuiz);
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, nombre_questions: 1 }),
      mockEnv
    );
    expect(res.status).toBe(200);
  });

  it("works with nombre_questions = 10", async () => {
    mockGenerateQuiz.mockResolvedValueOnce(validQuiz);
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, nombre_questions: 10 }),
      mockEnv
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /generate — input validation errors (400)
// ---------------------------------------------------------------------------
describe("POST /generate — input validation (400)", () => {
  it("returns 400 for malformed JSON body", async () => {
    const badReq = new Request("http://localhost/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });
    const res = await handler.fetch(badReq, mockEnv);
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, any>;
    expect(data.error).toContain("JSON invalide");
  });

  it("returns 400 for empty sujet", async () => {
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, sujet: "" }),
      mockEnv
    );
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, any>;
    expect(data.error).toBe("Paramètres invalides.");
    expect(data.details).toBeDefined();
  });

  it("returns 400 for invalid niveau", async () => {
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, niveau: "extreme" }),
      mockEnv
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for nombre_questions = 0", async () => {
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, nombre_questions: 0 }),
      mockEnv
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for nombre_questions = 11", async () => {
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, nombre_questions: 11 }),
      mockEnv
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-integer nombre_questions", async () => {
    const res = await handler.fetch(
      req("POST", "/generate", { ...validBody, nombre_questions: 3.5 }),
      mockEnv
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when sujet field is missing entirely", async () => {
    const { sujet, ...withoutSujet } = validBody;
    const res = await handler.fetch(req("POST", "/generate", withoutSujet), mockEnv);
    expect(res.status).toBe(400);
  });

  it("does not call generateQuiz on invalid input", async () => {
    await handler.fetch(
      req("POST", "/generate", { ...validBody, sujet: "" }),
      mockEnv
    );
    expect(mockGenerateQuiz).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /generate — generateQuiz failure (500)
// ---------------------------------------------------------------------------
describe("POST /generate — LLM failure (500)", () => {
  it("returns 500 when generateQuiz throws after all retries", async () => {
    mockGenerateQuiz.mockRejectedValueOnce(
      new Error("Échec après 3 tentatives. Dernière erreur: JSON invalide")
    );
    const res = await handler.fetch(req("POST", "/generate", validBody), mockEnv);
    expect(res.status).toBe(500);
    const data = await res.json() as Record<string, any>;
    expect(data.error).toContain("Échec après 3 tentatives");
  });

  it("returns generic error message for non-Error exceptions", async () => {
    mockGenerateQuiz.mockRejectedValueOnce("some string error");
    const res = await handler.fetch(req("POST", "/generate", validBody), mockEnv);
    expect(res.status).toBe(500);
    const data = await res.json() as Record<string, any>;
    expect(data.error).toBe("Erreur interne inconnue.");
  });
});

// ---------------------------------------------------------------------------
// 404 — unknown routes
// ---------------------------------------------------------------------------
describe("Unknown routes (404)", () => {
  it("returns 404 for GET /unknown", async () => {
    const res = await handler.fetch(req("GET", "/unknown"), mockEnv);
    expect(res.status).toBe(404);
  });

  it("returns 404 for POST /unknown", async () => {
    const res = await handler.fetch(req("POST", "/unknown", {}), mockEnv);
    expect(res.status).toBe(404);
  });

  it("returns available routes in 404 response", async () => {
    const res = await handler.fetch(req("GET", "/unknown"), mockEnv);
    const data = await res.json() as Record<string, any>;
    expect(data.routes).toContain("POST /generate");
  });
});
