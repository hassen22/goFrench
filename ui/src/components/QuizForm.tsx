import React, { useEffect, useRef } from "react";
import type { Niveau } from "../types";

interface QuizFormProps {
  sujet: string;
  setSujet: (val: string) => void;
  niveau: Niveau;
  setNiveau: (val: Niveau) => void;
  nombreQuestions: number;
  setNombreQuestions: (val: number | ((prev: number) => number)) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}

const MIN = 1;
const MAX = 10;

const SUGGESTIONS = [
  { label: "🇫🇷 Histoire de France", value: "Histoire de France" },
  { label: "🌍 Géographie mondiale", value: "Géographie mondiale" },
  { label: "💻 Intelligence Artificielle", value: "Intelligence Artificielle" },
  { label: "🎬 Cinéma culte", value: "Cinéma culte" },
];

const NIVEAUX: { key: Niveau; label: string }[] = [
  { key: "facile", label: "Facile" },
  { key: "moyen", label: "Moyen" },
  { key: "difficile", label: "Difficile" },
];

export const QuizForm: React.FC<QuizFormProps> = ({
  sujet,
  setSujet,
  niveau,
  setNiveau,
  nombreQuestions,
  setNombreQuestions,
  loading,
  error,
  onGenerate,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleStep = (delta: number) => {
    setNombreQuestions((prev) => Math.min(MAX, Math.max(MIN, prev + delta)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onGenerate();
    }
  };

  return (
    <div className="card fade-up" id="form-container">
      {/* Sujet Input */}
      <div className="form-group">
        <label htmlFor="sujet" className="field-label">
          Sujet du Quiz
        </label>
        <input
          ref={inputRef}
          id="sujet"
          className="field-input"
          type="text"
          placeholder="ex : géographie mondiale, histoire de France…"
          autoComplete="off"
          maxLength={200}
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-required="true"
        />

        {/* Suggestion Chips */}
        <div className="chips-container">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug.value}
              type="button"
              className="chip"
              onClick={() => {
                setSujet(sug.value);
                inputRef.current?.focus();
              }}
            >
              {sug.label}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty Pills */}
      <div className="form-group">
        <span className="field-label">Niveau de Difficulté</span>
        <div
          className="pill-group"
          id="niveau-group"
          role="radiogroup"
          aria-label="Niveau de difficulté"
        >
          {NIVEAUX.map((lvl) => (
            <button
              key={lvl.key}
              type="button"
              role="radio"
              aria-checked={niveau === lvl.key}
              className={`pill-btn ${niveau === lvl.key ? "active" : ""}`}
              data-value={lvl.key}
              onClick={() => setNiveau(lvl.key)}
            >
              {lvl.label}
            </button>
          ))}
        </div>
      </div>

      {/* Number Stepper */}
      <div className="form-group">
        <span className="field-label">Nombre de questions</span>
        <div className="stepper">
          <button
            type="button"
            className="stepper-btn"
            id="btn-minus"
            onClick={() => handleStep(-1)}
            disabled={nombreQuestions <= MIN}
            aria-label="Moins"
          >
            −
          </button>
          <span className="stepper-val" id="count-display">
            {nombreQuestions}
          </span>
          <button
            type="button"
            className="stepper-btn"
            id="btn-plus"
            onClick={() => handleStep(1)}
            disabled={nombreQuestions >= MAX}
            aria-label="Plus"
          >
            +
          </button>
          <span className="stepper-caption">questions (1 à 10)</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-banner" id="form-error" role="alert">
          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Generate Button */}
      <button
        type="button"
        className="btn-generate"
        id="btn-generate"
        onClick={onGenerate}
        disabled={loading}
      >
        {loading ? (
          <>
            <div className="spinner" />
            <span>Génération du quiz avec l'IA…</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>Générer le quiz</span>
          </>
        )}
      </button>
    </div>
  );
};
