import React from "react";

interface ScoreCardProps {
  score: number;
  total: number;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ score, total }) => {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  let emoji = "🎉";
  let message = "Excellent travail ! Vous maîtrisez parfaitement le sujet.";
  if (percent < 50) {
    emoji = "💪";
    message = "Continuez à vous entraîner, vous allez progresser !";
  } else if (percent < 80) {
    emoji = "👍";
    message = "Très bon score ! Quelques détails à peaufiner.";
  }

  return (
    <div className="score-card fade-up">
      <div className="score-title-wrap">
        <span>{emoji}</span>
        <span>Résultats du Quiz</span>
      </div>
      <div className="score-number">
        {score} / {total} <span className="score-percent">({percent}%)</span>
      </div>
      <p className="score-feedback">{message}</p>
    </div>
  );
};
