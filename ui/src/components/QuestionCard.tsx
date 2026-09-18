import React from "react";
import type { Question } from "../types";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  selectedIndex?: number;
  isRevealed: boolean;
  onSelectOption: (optIndex: number) => void;
}

const LABELS = ["A", "B", "C", "D"];

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  total,
  selectedIndex,
  isRevealed,
  onSelectOption,
}) => {
  return (
    <div
      className="card fade-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Question Header */}
      <div className="question-header">
        <span className="question-badge">
          Q{index + 1} / {total}
        </span>
        <h2 className="question-title">
          {question.question}
        </h2>
      </div>

      {/* Options List */}
      <div className="options-container">
        {question.options.map((option, optIdx) => {
          let extraClasses = "";
          let badgeContent: React.ReactNode = LABELS[optIdx];
          let statusTag: React.ReactNode = null;

          if (!isRevealed) {
            if (selectedIndex === optIdx) {
              extraClasses = "selected";
            }
          } else {
            extraClasses = "locked ";
            if (optIdx === question.bonne_reponse) {
              extraClasses += "correct";
              badgeContent = "✓";
              statusTag = (
                <span className="status-tag correct">
                  Bonne réponse
                </span>
              );
            } else if (selectedIndex === optIdx) {
              extraClasses += "incorrect";
              badgeContent = "✗";
              statusTag = (
                <span className="status-tag incorrect">
                  Votre choix
                </span>
              );
            }
          }

          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (!isRevealed && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onSelectOption(optIdx);
            }
          };

          return (
            <div
              key={optIdx}
              role={isRevealed ? undefined : "button"}
              tabIndex={isRevealed ? undefined : 0}
              aria-pressed={selectedIndex === optIdx}
              className={`option ${extraClasses}`}
              onClick={() => onSelectOption(optIdx)}
              onKeyDown={handleKeyDown}
              data-q={index}
              data-opt={optIdx}
            >
              <span className="option-badge">{badgeContent}</span>
              <span className="option-label">{option}</span>
              {statusTag}
            </div>
          );
        })}
      </div>

      {/* Explanation Box */}
      {isRevealed && (
        <div className="explanation-card">
          <span className="explanation-icon">💡</span>
          <div>
            <div className="explanation-heading">Explication</div>
            <p className="explanation-body">{question.explication}</p>
          </div>
        </div>
      )}
    </div>
  );
};
