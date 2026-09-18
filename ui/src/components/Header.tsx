import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="app-header fade-up">
      <div className="app-brand">
        <span className="app-logo">🔥</span>
        <h1 className="app-title">GoFrench Quiz</h1>
      </div>
      <p className="app-subtitle">
        Générez des QCM interactifs propulsés par l'IA et testez vos connaissances
      </p>
    </header>
  );
};
