export type Niveau = "facile" | "moyen" | "difficile";

export interface Question {
  question: string;
  options: string[];
  bonne_reponse: number;
  explication: string;
}

export interface QuizResponse {
  sujet: string;
  niveau: Niveau;
  questions: Question[];
}

export type UserAnswers = Record<number, number>;
