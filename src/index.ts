import { RequestBodySchema } from "./schemas";
import { generateQuiz, type Env } from "./llm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env, _ctx?: unknown): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return jsonResponse({
        service: "gofrench-quiz",
        status: "ok",
        model: "@cf/meta/llama-3.1-8b-instruct-fp8",
      });
    }

    if (url.pathname === "/generate" && request.method === "POST") {
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return jsonResponse({ error: "Corps de requête JSON invalide." }, 400);
      }

      const inputResult = RequestBodySchema.safeParse(rawBody);
      if (!inputResult.success) {
        return jsonResponse(
          {
            error: "Paramètres invalides.",
            details: inputResult.error.errors.map((e) => ({
              champ: e.path.join("."),
              message: e.message,
            })),
          },
          400
        );
      }

      const { sujet, niveau, nombre_questions } = inputResult.data;

      try {
        const reponse = await generateQuiz(env, sujet, niveau, nombre_questions);
        return jsonResponse(reponse, 200);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur interne inconnue.";
        return jsonResponse({ error: message }, 500);
      }
    }

    return jsonResponse(
      { error: "Route non trouvée.", routes: ["GET /", "POST /generate"] },
      404
    );
  },
} satisfies ExportedHandler<Env>;
