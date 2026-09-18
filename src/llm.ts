import { ZodError } from "zod";
import { ReponseSchema, type Niveau, type Reponse } from "./schemas";
import { buildInitialPrompt, buildRetryPrompt } from "./prompts";

export interface Env {
  AI: Ai;
}

const MAX_ATTEMPTS = 3;

function stripMarkdownFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function generateQuiz(
  env: Env,
  sujet: string,
  niveau: Niveau,
  nombre_questions: number
): Promise<Reponse> {
  let lastError = "";
  let lastRawOutput = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 1
        ? buildInitialPrompt(sujet, niveau, nombre_questions)
        : buildRetryPrompt(sujet, niveau, nombre_questions, lastError, lastRawOutput);

    let rawOutput = "";

    try {
      const aiResponse = await env.AI.run(
        "@cf/meta/llama-3.1-8b-instruct-fp8" as Parameters<Ai["run"]>[0],
        {
          messages: [
            {
              role: "system",
              content:
                "Tu es un assistant spécialisé dans la génération de quiz. Tu réponds TOUJOURS en JSON brut valide, sans aucune balise markdown ni texte supplémentaire.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 2048,
        }
      );

      rawOutput =
        typeof aiResponse === "object" &&
        aiResponse !== null &&
        "response" in aiResponse
          ? String((aiResponse as { response: unknown }).response ?? "")
          : String(aiResponse);

      lastRawOutput = rawOutput;

      const cleaned = stripMarkdownFences(rawOutput);
      const parsed: unknown = JSON.parse(cleaned);
      const validated = ReponseSchema.parse(parsed);

      return validated;
    } catch (err) {
      if (err instanceof SyntaxError) {
        lastError = `JSON invalide: ${err.message}`;
      } else if (err instanceof ZodError) {
        lastError = `Schéma invalide: ${err.errors
          .map((e) => `${e.path.join(".")} — ${e.message}`)
          .join("; ")}`;
      } else {
        lastError = `Erreur inattendue: ${String(err)}`;
      }

      console.error(
        `[gofrench-quiz] Tentative ${attempt}/${MAX_ATTEMPTS} échouée: ${lastError}`
      );

      if (attempt === MAX_ATTEMPTS) break;
    }
  }

  throw new Error(
    `Échec après ${MAX_ATTEMPTS} tentatives. Dernière erreur: ${lastError}`
  );
}
