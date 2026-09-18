import type { Niveau } from "./schemas";

// Embedded in every prompt so the model knows the exact JSON shape expected.
// Being explicit about field names and types reduces hallucinations significantly.
const SCHEMA_DESCRIPTION = `
{
  "sujet": "<le sujet demandé>",
  "niveau": "<facile|moyen|difficile>",
  "questions": [
    {
      "question": "<texte de la question>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "bonne_reponse": <0|1|2|3>,
      "explication": "<explication courte de la bonne réponse>"
    }
  ]
}`;

export function buildInitialPrompt(
  sujet: string,
  niveau: Niveau,
  nombre_questions: number
): string {
  return `Tu es un expert en création de quiz éducatifs.

Génère exactement ${nombre_questions} question(s) à choix multiples sur le sujet : "${sujet}".
Niveau de difficulté : ${niveau}.

Règles ABSOLUES :
- Réponds UNIQUEMENT avec du JSON brut, sans balises markdown, sans texte avant ou après.
- Chaque question doit avoir EXACTEMENT 4 options (tableau "options" de longueur 4).
- "bonne_reponse" est l'index (0, 1, 2 ou 3) de la bonne option dans le tableau "options".
- "explication" doit expliquer pourquoi cette réponse est correcte.
- Le JSON doit respecter EXACTEMENT cette structure :
${SCHEMA_DESCRIPTION}

Génère maintenant le JSON pour ${nombre_questions} question(s) sur "${sujet}" (niveau ${niveau}) :`;
}

// On retry we include the previous error and malformed output so the model
// can see exactly what went wrong and self-correct.
export function buildRetryPrompt(
  sujet: string,
  niveau: Niveau,
  nombre_questions: number,
  previousError: string,
  previousOutput: string
): string {
  return `Tu es un expert en création de quiz éducatifs.

Ta tentative précédente a produit une erreur : ${previousError}

Sortie incorrecte précédente :
${previousOutput.slice(0, 500)}

Corrige cette erreur et génère exactement ${nombre_questions} question(s) à choix multiples sur : "${sujet}".
Niveau de difficulté : ${niveau}.

Règles ABSOLUES :
- Réponds UNIQUEMENT avec du JSON brut, sans balises markdown, sans texte avant ou après.
- Chaque question doit avoir EXACTEMENT 4 options (tableau "options" de longueur 4).
- "bonne_reponse" est l'index (0, 1, 2 ou 3) de la bonne option.
- "explication" doit expliquer pourquoi cette réponse est correcte.
- Le JSON doit respecter EXACTEMENT cette structure :
${SCHEMA_DESCRIPTION}

Génère maintenant le JSON corrigé :`;
}
