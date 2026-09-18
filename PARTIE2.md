# Partie 2 — Debug & Esprit Critique

Analyse du code fourni et identification des 3 problèmes de conception.

---

## Code analysé

```typescript
async function genererQuestion(sujet: string): Promise<any> {
  const prompt = `Génère une question de quiz sur ${sujet}. Réponds en JSON.`;
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });
  const data = JSON.parse(response.choices[0].message.content);
  return data;
}

async function genererDixQuestions(sujet: string) {
  const questions = [];
  for (let i = 0; i < 10; i++) {
    questions.push(await genererQuestion(sujet));
  }
  return questions;
}
```

---

## Problème 1 — Fiabilité de la sortie : absence de validation et de gestion d'erreurs

### Description

```typescript
const data = JSON.parse(response.choices[0].message.content);
return data;
```

Ce code présente **deux failles critiques de fiabilité** :

1. **`JSON.parse` sans try/catch** : si le LLM retourne du texte avec des balises markdown (` ```json ... ``` `), du texte introductif ("Voici la question :"), ou un JSON malformé, `JSON.parse` lève une `SyntaxError` non interceptée qui fait crasher la fonction.

2. **Aucune validation de la structure retournée** : même si le JSON est valide syntaxiquement, rien ne garantit que le champ `question`, `options`, `bonne_reponse`, etc. sont présents et du bon type. Le `return data` renvoie `any`, et le code appelant travaillera sur une structure inconnue.

De plus, `response.choices[0].message.content` peut être `null` si le modèle est coupé par un `finish_reason: "length"` — `JSON.parse(null)` ne lève pas d'erreur en JavaScript mais retourne `null`.

### Correction

```typescript
import { z } from "zod";

const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  bonne_reponse: z.number().int().min(0).max(3),
  explication: z.string(),
});

async function genererQuestion(sujet: string): Promise<z.infer<typeof QuestionSchema>> {
  const response = await openai.chat.completions.create({ /* ... */ });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) throw new Error("Réponse vide du LLM");

  // Retirer les balises markdown si présentes
  const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`JSON invalide reçu du LLM: ${String(e)}`);
  }

  // Valider la structure avec Zod
  const result = QuestionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Schéma invalide: ${result.error.message}`);
  }

  return result.data;
}
```

---

## Problème 2 — Performance & Coût : appels séquentiels au lieu de parallèles

### Description

```typescript
for (let i = 0; i < 10; i++) {
  questions.push(await genererQuestion(sujet)); // ← await bloquant
}
```

La boucle `for` avec `await` à l'intérieur exécute les 10 appels **en série** : chaque appel attend que le précédent soit terminé avant de commencer. Sur un LLM comme GPT-4 avec une latence de ~2–5 secondes par appel, cela représente **20 à 50 secondes d'attente** pour 10 questions.

**Double problème** :

- **Performance** : temps total = somme des latences individuelles (~30s) au lieu du maximum (~5s avec `Promise.all`)
- **Coût** : 10 appels séparés = 10 fois les tokens de prompt répétés (system prompt, instructions, etc.), alors qu'un seul appel avec `"nombre_questions": 10"` dans le prompt génère les 10 questions pour le prix d'un seul prompt.

### Correction

**Option A — Parallélisation** (si l'API limite à 1 question par appel) :

```typescript
async function genererDixQuestions(sujet: string) {
  // Lance les 10 appels simultanément
  const promises = Array.from({ length: 10 }, () => genererQuestion(sujet));
  return Promise.all(promises);
}
```

**Option B — Batching** (recommandée — un seul appel pour toutes les questions) :

```typescript
async function genererDixQuestions(sujet: string) {
  // Un seul appel LLM génère les 10 questions d'un coup
  // Réduction des coûts et de la latence
  return generateQuiz(sujet, "moyen", 10); // le prompt demande 10 questions d'un coup
}
```

L'**Option B** est préférable car :
- Latence similaire à 1 appel (pas 10)
- Cohérence thématique entre les questions (le modèle a le contexte global)
- Coût réduit (tokens de prompt facturés une seule fois)

---

## Problème 3 — Robustesse : prompt vague sans schéma ni logique de retry

### Description

```typescript
const prompt = `Génère une question de quiz sur ${sujet}. Réponds en JSON.`;
```

Ce prompt souffre de **trois lacunes** :

1. **Aucune structure définie** : "Réponds en JSON" ne dit pas *quel* JSON. Le LLM peut retourner `{"q": "...", "a": "..."}`, `{"question": "...", "reponses": [...]}`, ou toute autre structure selon son humeur — aucune garantie de consistance entre les appels.

2. **Aucune contrainte sur le format** : pas de mention des champs `options` (tableau de 4), `bonne_reponse` (index 0–3), `explication`. Chaque appel peut retourner une structure différente.

3. **Aucun retry** : si la sortie est malformée ou ne respecte pas la structure attendue, le code plante sans aucune tentative de récupération. En production, un seul appel raté fait échouer toute la requête utilisateur.

### Correction

```typescript
const SCHEMA_JSON = `{
  "question": "<texte de la question>",
  "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
  "bonne_reponse": <0|1|2|3>,
  "explication": "<pourquoi cette réponse est correcte>"
}`;

function buildPrompt(sujet: string): string {
  return `Tu es un expert en quiz éducatifs.
Génère UNE question à choix multiples sur "${sujet}".
Réponds UNIQUEMENT en JSON brut (sans balises markdown).
La structure EXACTE attendue est :
${SCHEMA_JSON}`;
}

async function genererQuestion(sujet: string, attempt = 1): Promise<QuestionType> {
  const MAX_ATTEMPTS = 3;
  let lastError = "";

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const prompt = i === 1
      ? buildPrompt(sujet)
      : `${buildPrompt(sujet)}\n\nTentative précédente échouée: ${lastError}. Corrige et réessaie.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.choices[0]?.message?.content ?? "";
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      return QuestionSchema.parse(parsed); // Zod throw si invalide
    } catch (err) {
      lastError = String(err);
      if (i === MAX_ATTEMPTS) throw new Error(`Échec après ${MAX_ATTEMPTS} tentatives: ${lastError}`);
    }
  }

  throw new Error("Unreachable");
}
```

---

## Résumé des 3 problèmes

| # | Catégorie | Problème | Impact |
|---|---|---|---|
| 1 | **Fiabilité de la sortie** | `JSON.parse` sans try/catch + aucune validation Zod | Crash non géré sur toute sortie LLM inattendue |
| 2 | **Performance / Coût** | 10 `await` séquentiels au lieu de `Promise.all` ou batching | 10× plus lent, tokens de prompt répétés 10 fois |
| 3 | **Robustesse du prompt** | Prompt vague sans schéma défini + aucun retry | Structures JSON incohérentes, échecs silencieux en production |
