import { useEffect, useState } from 'react';
import './App.css';
import type { Category, Question } from './types';
import rawData from '../data.json';

interface StoredState {
  categories: Category[];
  scores: { player1: number; player2: number };
  activePlayer: 1 | 2;
  playerNames: { player1: string; player2: string };
}

const LS_KEY = 'quizState_v2';

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
  const [playerNames, setPlayerNames] = useState<{ player1: string; player2: string }>(
    restored?.playerNames ?? { player1: 'Hráč 1', player2: 'Hráč 2' }
  );
  const [showNameModal, setShowNameModal] = useState<boolean>(!restored);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [modal, setModal] = useState<{ categoryIndex: number; questionIndex: number } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerEvaluated, setAnswerEvaluated] = useState(false);
  const [tempNames, setTempNames] = useState({ player1: playerNames.player1, player2: playerNames.player2 });

  // Persist
  useEffect(() => {
    persist({ categories, scores, activePlayer, playerNames });
  }, [categories, scores, activePlayer, playerNames]);

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
  const winnerNumber = allAnswered && scores.player1 !== scores.player2
    ? (scores.player1 > scores.player2 ? 1 : 2)
    : null;

  const confirmNames = () => {
    const p1 = tempNames.player1.trim() || 'Hráč 1';
    const p2 = tempNames.player2.trim() || 'Hráč 2';
    setPlayerNames({ player1: p1, player2: p2 });
    setShowNameModal(false);
  };

  const openRestart = () => setShowRestartModal(true);
  const cancelRestart = () => setShowRestartModal(false);
  const doRestart = () => {
    localStorage.removeItem(LS_KEY);
    setCategories(loadInitialCategories());
    setScores({ player1: 0, player2: 0 });
    setActivePlayer(1);
    setPlayerNames({ player1: 'Hráč 1', player2: 'Hráč 2' });
    setTempNames({ player1: 'Hráč 1', player2: 'Hráč 2' });
    setShowRestartModal(false);
    setShowNameModal(true);
    setModal(null);
  };

  return (
    <div className="app-wrapper">
      <header className="top-bar">
        <h1>Kvíz</h1>
        {/* Restart odstraněn z top baru */}
      </header>
      <div className="scores">
        <div className={`score ${activePlayer === 1 ? 'active' : ''}`}>{playerNames.player1}: {scores.player1}</div>
        <div className={`score ${activePlayer === 2 ? 'active' : ''}`}>{playerNames.player2}: {scores.player2}</div>
      </div>

      {allAnswered && (
        <div className="game-over">{winnerNumber ? `Vyhrál hráč ${winnerNumber}.` : 'Remíza.'}</div>
      )}

      <div className="grid-container">
        <button className="restart-btn grid-restart" onClick={openRestart}>Restart</button>
        <div className={`grid ${showNameModal ? 'blurred' : ''}`} aria-hidden={showNameModal}>
          {categories.map((cat, idx) => (
            <div key={idx} className="cell header">{cat.name}</div>
          ))}
          {Array.from({ length: 5 }).map((_, row) => (
            categories.map((cat, cIdx) => {
              const q = cat.questions.find(q => q.pointValue === row + 1);
              if (!q) return <div key={`${cIdx}-${row}`} className="cell empty"/>;
              return (
                <button
                  key={`${cIdx}-${row}`}
                  className={`cell question ${q.answered ? 'answered' : ''}`}
                  disabled={q.answered || showNameModal}
                  onClick={() => openQuestion(cIdx, cat.questions.indexOf(q))}
                >
                  {q.pointValue}
                </button>
              );
            })
          ))}
        </div>
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

      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal name-modal">
            <h2>Nastavení hráčů</h2>
            <label className="input-row">Jméno hráče 1
              <input
                value={tempNames.player1}
                onChange={e => setTempNames(n => ({ ...n, player1: e.target.value }))}
                placeholder="Hráč 1"
              />
            </label>
            <label className="input-row">Jméno hráče 2
              <input
                value={tempNames.player2}
                onChange={e => setTempNames(n => ({ ...n, player2: e.target.value }))}
                placeholder="Hráč 2"
              />
            </label>
            <div className="modal-footer between">
              <button className="close-btn" onClick={confirmNames}>Potvrdit</button>
            </div>
          </div>
        </div>
      )}

      {showRestartModal && (
        <div className="modal-overlay">
          <div className="modal restart-modal">
            <h2>Restart hry?</h2>
            <p>Opravdu chceš začít znovu? Aktuální průběh bude smazán.</p>
            <div className="modal-footer between">
              <button className="confirm-btn" onClick={doRestart}>Ano, restart</button>
              <button className="cancel-btn" onClick={cancelRestart}>Zrušit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
