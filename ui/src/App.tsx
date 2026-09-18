import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { QuizForm } from "./components/QuizForm";
import { QuestionCard } from "./components/QuestionCard";
import { ScoreCard } from "./components/ScoreCard";
import { SkeletonLoader } from "./components/SkeletonLoader";
import type { Niveau, QuizResponse, UserAnswers } from "./types";

const API_URL =
  "https://gofrench-quiz.fantasy-tunisian-pro-league.workers.dev/generate";

declare global {
  interface Window {
    stepCount?: (d: number) => void;
  }
}

export const App: React.FC = () => {
  const [sujet, setSujet] = useState("");
  const [niveau, setNiveau] = useState<Niveau>("facile");
  const [nombreQuestions, setNombreQuestions] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quizData, setQuizData] = useState<QuizResponse | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Expose stepCount on window for test compatibility
  useEffect(() => {
    window.stepCount = (delta: number) => {
      setNombreQuestions((prev) => Math.min(10, Math.max(1, prev + delta)));
    };
    return () => {
      delete window.stepCount;
    };
  }, []);

  const handleGenerate = async () => {
    const trimmedSujet = sujet.trim();
    setError(null);

    if (!trimmedSujet) {
      setError("Veuillez entrer un sujet avant de générer.");
      document.getElementById("sujet")?.focus();
      return;
    }

    setLoading(true);
    setQuizData(null);
    setUserAnswers({});
    setIsSubmitted(false);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sujet: trimmedSujet,
          niveau,
          nombre_questions: nombreQuestions,
        }),
      });

      const data = (await res.json()) as QuizResponse & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      setQuizData(data);
      setUserAnswers({});
      setIsSubmitted(false);
    } catch (err) {
      setQuizData(null);
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue. Réessayez."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleConfirm = () => {
    if (!quizData) return;
    setIsSubmitted(true);
    window.scrollTo({
      top: (document.getElementById("results")?.offsetTop ?? 0) - 20,
      behavior: "smooth",
    });
  };

  const handleReset = () => {
    setQuizData(null);
    setUserAnswers({});
    setIsSubmitted(false);
    setSujet("");
    setError(null);
    document.getElementById("sujet")?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const answeredCount = Object.keys(userAnswers).length;
  const totalQuestions = quizData?.questions.length ?? 0;
  const isAllAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  const totalScore =
    quizData?.questions.reduce((acc, q, idx) => {
      return userAnswers[idx] === q.bonne_reponse ? acc + 1 : acc;
    }, 0) ?? 0;

  return (
    <div className="app-container">
      <Header />

      <QuizForm
        sujet={sujet}
        setSujet={setSujet}
        niveau={niveau}
        setNiveau={setNiveau}
        nombreQuestions={nombreQuestions}
        setNombreQuestions={setNombreQuestions}
        loading={loading}
        error={error}
        onGenerate={handleGenerate}
      />

      <div id="results">
        {loading && <SkeletonLoader count={nombreQuestions} />}

        {quizData && (
          <>
            {isSubmitted && (
              <ScoreCard
                score={totalScore}
                total={totalQuestions}
              />
            )}

            {!isSubmitted && (
              <div className="progress-card fade-up">
                <span>
                  📝 Questions : <strong style={{ color: "var(--text-main)" }}>{totalQuestions}</strong>
                </span>
                <span>
                  Complétées :{" "}
                  <span className={`progress-highlight ${isAllAnswered ? "done" : ""}`}>
                    {answeredCount} / {totalQuestions}
                  </span>
                </span>
              </div>
            )}

            {quizData.questions.map((question, idx) => (
              <QuestionCard
                key={idx}
                question={question}
                index={idx}
                total={totalQuestions}
                selectedIndex={userAnswers[idx]}
                isRevealed={isSubmitted}
                onSelectOption={(optIdx) => handleSelectOption(idx, optIdx)}
              />
            ))}

            <div className="fade-up" style={{ marginTop: "1rem", marginBottom: "2rem" }}>
              {!isSubmitted ? (
                <button
                  type="button"
                  className="btn-confirm"
                  id="btn-confirm"
                  onClick={handleConfirm}
                >
                  ✓ Confirmer mes réponses
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-reset"
                  onClick={handleReset}
                >
                  ↩ Nouveau sujet
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
