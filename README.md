# GoFrench Quiz

API de génération de QCM avec interface web, déployé sur Cloudflare Workers + Pages.

**API (Worker):** https://gofrench-quiz.fantasy-tunisian-pro-league.workers.dev  
**UI (Pages):** https://gofrench-quiz-ui.pages.dev

---

## Stack

| | |
|---|---|
| Runtime | Cloudflare Workers (TypeScript) |
| LLM | `@cf/meta/llama-3.1-8b-instruct-fp8` — gratuit, sans clé API |
| Validation | Zod |
| Tests API | Vitest |
| Tests UI | Playwright |
| Deploy | Wrangler CLI |

---

## Choix techniques

**Cloudflare AI au lieu d'OpenAI/Anthropic**  
Le binding `env.AI` est natif au Worker — aucun secret à configurer, aucun coût. Llama 3.1 8B FP8 génère des JSON structurés avec une fiabilité suffisante pour ce cas d'usage.

**Deux prompts distincts**  
Le prompt initial est propre et direct. Le prompt de retry inclut l'erreur précédente et les 500 premiers caractères de la mauvaise sortie pour que le modèle se corrige lui-même.

**Validation à deux niveaux**  
1. Input : le corps de la requête HTTP est validé avec Zod avant tout appel LLM
2. Output : la réponse du LLM est validée contre `ReponseSchema` à chaque tentative

**Interface single-file**  
L'UI est un seul `index.html` sans build step — plus facile à relire et à déployer.

---

## Démarrage

```bash
npm install
npm run dev        # worker local sur http://localhost:8787
```

---

## Tests

```bash
npm run test          # tests API (Vitest)
npm run test:ui       # tests UI (Playwright)
npm run test:all      # les deux
```

### Structure des tests

```
tests/
├── api/
│   ├── schemas.test.ts       # Validation Zod (unit)
│   ├── prompts.test.ts       # Builders de prompts (unit)
│   ├── llm.nominal.test.ts   # LLM cas nominal (unit)
│   ├── llm.retry.test.ts     # Logique retry (unit)
│   └── handler.test.ts       # Handler HTTP (integration)
└── ui/
    ├── unit.spec.ts          # Structure, pills, stepper (Playwright)
    ├── integration.spec.ts   # Rendu résultats, erreurs, reset (Playwright)
    └── e2e.spec.ts           # Flux complet, XSS, cas limites (Playwright)
```

---

## API

### `GET /`

```json
{ "service": "gofrench-quiz", "status": "ok", "model": "@cf/meta/llama-3.1-8b-instruct-fp8" }
```

### `POST /generate`

**Corps :**
```json
{
  "sujet": "géographie mondiale",
  "niveau": "moyen",
  "nombre_questions": 3
}
```

| Champ | Type | Contraintes |
|---|---|---|
| `sujet` | string | Non vide |
| `niveau` | enum | `"facile"` \| `"moyen"` \| `"difficile"` |
| `nombre_questions` | number | Entier 1–10 |

**Réponse 200 :**
```json
{
  "sujet": "géographie mondiale",
  "niveau": "moyen",
  "questions": [
    {
      "question": "Quel est le plus grand pays du monde ?",
      "options": ["Canada", "Chine", "États-Unis", "Russie"],
      "bonne_reponse": 3,
      "explication": "La Russie couvre ~17 millions de km²."
    }
  ]
}
```

**Erreurs :**
- `400` — input invalide (détails dans `details[]`)
- `500` — LLM a échoué après 3 tentatives

---

## Déploiement

```bash
npm run deploy                                              # API Worker
npx wrangler pages deploy ui/ --project-name gofrench-quiz-ui   # UI Pages
```

---

## Partie 2

Voir [PARTIE2.md](./PARTIE2.md) — analyse des 3 problèmes de conception du code fourni.
