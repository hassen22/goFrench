import { z } from "zod";

export const NiveauSchema = z.enum(["facile", "moyen", "difficile"]);
export type Niveau = z.infer<typeof NiveauSchema>;

export const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  bonne_reponse: z.number().int().min(0).max(3),
  explication: z.string(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const ReponseSchema = z.object({
  sujet: z.string(),
  niveau: NiveauSchema,
  questions: z.array(QuestionSchema),
});
export type Reponse = z.infer<typeof ReponseSchema>;

export const RequestBodySchema = z.object({
  sujet: z.string().min(1, "Le sujet ne peut pas être vide"),
  niveau: NiveauSchema,
  nombre_questions: z
    .number()
    .int()
    .min(1, "nombre_questions doit être au moins 1")
    .max(10, "nombre_questions ne peut pas dépasser 10"),
});
export type RequestBody = z.infer<typeof RequestBodySchema>;
