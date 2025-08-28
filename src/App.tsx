import { useEffect, useState } from 'react';
import './App.css';
import type { Category, Question } from './types';
import rawData from '../data.json';

interface StoredState {
  categories: Category[];
  scores: { player1: number; player2: number };
  activePlayer: 1 | 2;
}

const LS_KEY = 'quizState_v1';

// Použijeme všech 5 okruhů; 5. může mít odlišnou strukturu (zatím placeholdery pro budoucí úpravy).
function loadInitialCategories(): Category[] {
  const base: any[] = rawData as any[];
  return base.slice(0, 5).map(cat => {
    const questions = (cat.questions || []).map((q: any) => {
      if (Array.isArray(q.answers)) {
        return q; // standardní otázka
      }
      // Speciální typ otázky (zatím bez implementace) => vytvoříme nekliknutelný placeholder
      return {
        question: q.prompt || 'Speciální otázka (brzy)',
        answers: ['—', '—', '—', '—'],
        correctAnswer: -1, // žádná správná
        pointValue: q.pointValue || 0,
        answered: true // greyed out
      } as Question;
    }).sort((a: any, b: any) => a.pointValue - b.pointValue);

    // Doplnění chybějících standardních pointValue (1..5) pokud by nějaké chyběly
    // (zachová jednoduchost; nevyužito pokud data kompletní)
    return {
      name: cat.name,
      questions
    };
  });
}

function restoreState(): StoredState | null {
  try {
    const str = localStorage.getItem(LS_KEY);
    if (!str) return null;
    return JSON.parse(str) as StoredState;
  } catch {
    return null;
  }
}

function persist(state: StoredState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

interface ModalState {
  categoryIndex: number;
  questionIndex: number;
}

function App() {
  const restored = restoreState();
  const [categories, setCategories] = useState<Category[]>(
    restored?.categories ?? loadInitialCategories()
  );
  const [scores, setScores] = useState<{ player1: number; player2: number }>(
    restored?.scores ?? { player1: 0, player2: 0 }
  );
  const [activePlayer, setActivePlayer] = useState<1 | 2>(restored?.activePlayer ?? 1);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerEvaluated, setAnswerEvaluated] = useState(false);

  // Persist
  useEffect(() => {
    persist({ categories, scores, activePlayer });
  }, [categories, scores, activePlayer]);

  const openQuestion = (cIdx: number, qIdx: number) => {
    const q = categories[cIdx].questions[qIdx];
    if (q.answered) return;
    setModal({ categoryIndex: cIdx, questionIndex: qIdx });
    setSelectedAnswer(null);
    setAnswerEvaluated(false);
  };

  const currentQuestion: Question | null = modal
    ? categories[modal.categoryIndex].questions[modal.questionIndex]
    : null;

  const handleAnswer = (answerIdx: number) => {
    if (!currentQuestion || answerEvaluated) return;
    setSelectedAnswer(answerIdx);
    const isCorrect = answerIdx === currentQuestion.correctAnswer;

    // Aktualizace categories (answered = true) a skóre pokud správně
    setCategories(prev => prev.map((cat, ci) => {
      if (ci !== modal!.categoryIndex) return cat;
      return {
        ...cat,
        questions: cat.questions.map((q, qi) =>
          qi === modal!.questionIndex ? { ...q, answered: true } : q
        )
      };
    }));

    if (isCorrect) {
      setScores(s => activePlayer === 1
        ? { ...s, player1: s.player1 + currentQuestion.pointValue }
        : { ...s, player2: s.player2 + currentQuestion.pointValue }
      );
    }
    setAnswerEvaluated(true);
  };

  const closeModal = () => {
    if (!answerEvaluated) return; // nelze zavřít bez odpovědi
    // Přepnutí hráče
    setActivePlayer(p => (p === 1 ? 2 : 1));
    setModal(null);
  };

  const allAnswered = categories.every(c => c.questions.every(q => q.answered));

  return (
    <div className="app-wrapper">
      <header>
        <h1>Kvíz</h1>
        <div className="scores">
          <div className={`score ${activePlayer === 1 ? 'active' : ''}`}>Hráč 1: {scores.player1}</div>
            <div className={`score ${activePlayer === 2 ? 'active' : ''}`}>Hráč 2: {scores.player2}</div>
        </div>
      </header>

      {allAnswered && (
        <div className="game-over">Hra skončila! Výsledek: {scores.player1} : {scores.player2}</div>
      )}

      <div className="grid">
        {/* Hlavička - názvy kategorií */}
        {categories.map((cat, idx) => (
          <div key={idx} className="cell header">{cat.name}</div>
        ))}
        {/* Řádky s otázkami (pointValue 1..5) */}
        {Array.from({ length: 5 }).map((_, row) => (
          categories.map((cat, cIdx) => {
            const q = cat.questions.find(q => q.pointValue === row + 1);
            if (!q) return <div key={`${cIdx}-${row}`} className="cell empty"/>;
            return (
              <button
                key={`${cIdx}-${row}`}
                className={`cell question ${q.answered ? 'answered' : ''}`}
                disabled={q.answered}
                onClick={() => openQuestion(cIdx, cat.questions.indexOf(q))}
              >
                {q.pointValue}
              </button>
            );
          })
        ))}
      </div>

      {modal && currentQuestion && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{currentQuestion.question}</h2>
            <div className="answers">
              {currentQuestion.answers.map((ans, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = currentQuestion.correctAnswer === i;
                let cls = 'answer-btn';
                if (answerEvaluated) {
                  if (isCorrect) cls += ' correct';
                  if (isSelected && !isCorrect) cls += ' wrong';
                } else if (isSelected) {
                  cls += ' pending';
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    disabled={answerEvaluated}
                    onClick={() => handleAnswer(i)}
                  >
                    {ans || <em>&nbsp;</em>}
                  </button>
                );
              })}
            </div>
            <div className="modal-footer">
              {answerEvaluated ? (
                <button className="close-btn" onClick={closeModal}>Zpět na přehled</button>
              ) : (
                <div className="hint">Vyber odpověď...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
