import { useEffect, useRef, useState } from 'react';
import './App.css';
import type { Category, Question } from './types';
import rawData from '../data.json';
import monogram from './assets/monogram.svg';
import ornament from './assets/ornament.svg';
import {
  IconArrowBack,
  IconCancel,
  IconCheck,
  IconCheckCircle,
  IconRefresh,
  IconRestart,
  IconTrophy,
} from './icons';

interface StoredState {
  categories: Category[];
  scores: { player1: number; player2: number };
  activePlayer: 1 | 2;
  playerNames: { player1: string; player2: string };
}

const LS_KEY = 'quizState_risa_tynka_v2';
const DEFAULT_NAMES = { player1: 'Hráč 1', player2: 'Hráč 2' };
const POINTS_PER_QUESTION = 1;

/** Datum a místo v patičce desky – převzato z grafického návrhu. */
const WEDDING_FOOTER = '22. srpna 2026 · Penzion Na Kmíně';

const ANSWER_KEYS = ['A', 'B', 'C', 'D'];

/* Referenční rozměry grafického návrhu (1280 × 640 plus rezerva). Na větších
   obrazovkách deska neroste do šířky – dlaždice by se roztáhly – ale škáluje se
   proporcionálně, takže velký monitor vypadá stejně jako 14" notebook, jen větší. */
const BOARD_REF_W = 1300;
const BOARD_REF_H = 660;
const MAX_SCALE = 1.9;

/**
 * Zaměří prvek, jakmile se okno otevře, aby ho šlo potvrdit Enterem
 * bez sahání po myši. U oken s ničivou akcí míří na bezpečnou volbu.
 */
function useFocusWhen<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    // Efekt běží až po vykreslení do DOM, takže je ref už navázaný.
    // Záměrně bez requestAnimationFrame – ten prohlížeč v neaktivní
    // záložce nebo okně škrtí a fokus by se pak nenastavil vůbec.
    if (active) ref.current?.focus();
  }, [active]);
  return ref;
}

function loadInitialCategories(): Category[] {
  return (rawData as Category[]).map(cat => ({
    name: cat.name,
    longName: cat.longName,
    questions: cat.questions.map(q => ({ ...q, answered: false })),
  }));
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

function App() {
  // localStorage se čte právě jednou, při mountu
  const [restored] = useState<StoredState | null>(restoreState);

  const [categories, setCategories] = useState<Category[]>(
    restored?.categories ?? loadInitialCategories
  );
  const [scores, setScores] = useState<{ player1: number; player2: number }>(
    restored?.scores ?? { player1: 0, player2: 0 }
  );
  const [activePlayer, setActivePlayer] = useState<1 | 2>(restored?.activePlayer ?? 1);
  const [playerNames, setPlayerNames] = useState(restored?.playerNames ?? DEFAULT_NAMES);
  const [tempNames, setTempNames] = useState(restored?.playerNames ?? DEFAULT_NAMES);

  const [showNameModal, setShowNameModal] = useState(!restored);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [modal, setModal] = useState<{ categoryIndex: number; questionIndex: number } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerEvaluated, setAnswerEvaluated] = useState(false);

  useEffect(() => {
    persist({ categories, scores, activePlayer, playerNames });
  }, [categories, scores, activePlayer, playerNames]);

  useEffect(() => {
    const fit = () => {
      const raw = Math.min(window.innerWidth / BOARD_REF_W, window.innerHeight / BOARD_REF_H);
      const scale = Math.min(Math.max(raw, 1), MAX_SCALE);
      document.documentElement.style.setProperty('--board-scale', String(scale));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Co Enter potvrdí v otevřeném okně. U restartu a nové hry záměrně
  // míří na bezpečnou volbu – smazat rozehranou hru musí jít jen kliknutím.
  const questionPrimaryRef = useFocusWhen<HTMLButtonElement>(!!modal && answerEvaluated);
  const nameInputRef = useFocusWhen<HTMLInputElement>(showNameModal);
  const restartCancelRef = useFocusWhen<HTMLButtonElement>(showRestartModal);
  const winCloseRef = useFocusWhen<HTMLButtonElement>(showWinModal);

  // Průběžné číslování 1–24 přes všechny okruhy, v pořadí sloupců na desce.
  const startNumbers: number[] = [];
  let running = 0;
  for (const cat of categories) {
    startNumbers.push(running);
    running += cat.questions.length;
  }
  const totalQuestions = running;

  const answeredCount = categories.reduce(
    (sum, c) => sum + c.questions.filter(q => q.answered).length,
    0
  );
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const progressPct = totalQuestions === 0 ? 0 : (answeredCount / totalQuestions) * 100;

  const winnerNumber =
    scores.player1 === scores.player2 ? null : scores.player1 > scores.player2 ? 1 : 2;
  const winnerName =
    winnerNumber === 1 ? playerNames.player1 : winnerNumber === 2 ? playerNames.player2 : null;

  const currentQuestion: Question | null = modal
    ? categories[modal.categoryIndex].questions[modal.questionIndex]
    : null;
  const currentCategory: Category | null = modal ? categories[modal.categoryIndex] : null;
  const currentNumber = modal ? startNumbers[modal.categoryIndex] + modal.questionIndex + 1 : 0;

  const activeName = activePlayer === 1 ? playerNames.player1 : playerNames.player2;

  const openQuestion = (cIdx: number, qIdx: number) => {
    if (categories[cIdx].questions[qIdx].answered) return;
    setModal({ categoryIndex: cIdx, questionIndex: qIdx });
    setSelectedAnswer(null);
    setAnswerEvaluated(false);
  };

  const handleAnswer = (answerIdx: number) => {
    if (!modal || !currentQuestion || answerEvaluated) return;
    setSelectedAnswer(answerIdx);

    const { categoryIndex, questionIndex } = modal;
    setCategories(prev =>
      prev.map((cat, ci) =>
        ci !== categoryIndex
          ? cat
          : {
              ...cat,
              questions: cat.questions.map((q, qi) =>
                qi === questionIndex ? { ...q, answered: true } : q
              ),
            }
      )
    );

    if (answerIdx === currentQuestion.correctAnswer) {
      setScores(s =>
        activePlayer === 1
          ? { ...s, player1: s.player1 + POINTS_PER_QUESTION }
          : { ...s, player2: s.player2 + POINTS_PER_QUESTION }
      );
    }
    setAnswerEvaluated(true);
  };

  const closeModal = () => {
    if (!answerEvaluated) return; // bez odpovědi nelze zavřít
    setActivePlayer(p => (p === 1 ? 2 : 1));
    setModal(null);
  };

  const showWinner = () => {
    setModal(null);
    setShowWinModal(true);
  };

  const resetGame = () => {
    localStorage.removeItem(LS_KEY);
    setCategories(loadInitialCategories());
    setScores({ player1: 0, player2: 0 });
    setActivePlayer(1);
    setPlayerNames(DEFAULT_NAMES);
    setTempNames(DEFAULT_NAMES);
    setModal(null);
    setShowRestartModal(false);
    setShowWinModal(false);
    setShowNameModal(true);
  };

  const confirmNames = () => {
    setPlayerNames({
      player1: tempNames.player1.trim() || DEFAULT_NAMES.player1,
      player2: tempNames.player2.trim() || DEFAULT_NAMES.player2,
    });
    setShowNameModal(false);
  };

  const boardsHidden = showNameModal;

  const renderScoreCard = (player: 1 | 2, large = false) => {
    const name = player === 1 ? playerNames.player1 : playerNames.player2;
    const value = player === 1 ? scores.player1 : scores.player2;
    const isActive = !allAnswered && activePlayer === player;
    const isWinner = allAnswered && winnerNumber === player;
    const isDraw = allAnswered && winnerNumber === null;
    return (
      <div
        className={[
          'score-card',
          large ? 'score-card--lg' : '',
          isActive || isWinner ? 'is-highlighted' : '',
          isDraw ? 'is-draw' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {isActive && <span className="score-card__turn">Na tahu</span>}
        {isWinner && large && <span className="score-card__turn">Vítěz</span>}
        <span className="score-card__name">{name}</span>
        <span className="score-card__value">{value}</span>
      </div>
    );
  };

  return (
    <>
      <div className="stage">
        <div className="board">
          <header className="head">
            <div className="brand">
              <span className="brand__mono">
                <img src={monogram} alt="" width={34} height={34} />
              </span>
              <span className="brand__text">
                <span className="kicker">Ríša &amp; Týnka</span>
                <h1 className="brand__title">Svatební kvíz</h1>
              </span>
            </div>

            <span className="head__spacer" />

            <div className="scores">
              <div className="scores__cards">
                {renderScoreCard(1)}
                <span className="scores__amp">&amp;</span>
                {renderScoreCard(2)}
              </div>
              {allAnswered && (
                <p className="scores__note">
                  Hotovo! Všech {totalQuestions} otázek je zodpovězeno.
                </p>
              )}
            </div>

            <span className="head__spacer" />

            <div className="meta">
              <div className="progress">
                <span className="progress__label">
                  Odpovězeno {answeredCount} / {totalQuestions}
                </span>
                <span className="progress__track">
                  <span className="progress__fill" style={{ width: `${progressPct}%` }} />
                </span>
              </div>
              <div className="meta__actions">
                {allAnswered && (
                  <button type="button" className="btn-winner" onClick={showWinner}>
                    <IconTrophy size={14} />
                    Zobraz vítěze
                  </button>
                )}
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => setShowRestartModal(true)}
                >
                  <IconRefresh size={13} />
                  Restart
                </button>
              </div>
            </div>
          </header>

          <div className="rule">
            <span className="rule__line" />
            <img className="rule__ornament" src={ornament} alt="" width={132} height={28} />
            <span className="rule__line" />
          </div>

          <div className="columns" aria-hidden={boardsHidden}>
            {categories.map((cat, cIdx) => (
              <section
                className={`col ${cat.questions.length > 6 ? 'col--wide' : 'col--side'}`}
                key={cat.name}
              >
                <div className="col__head">
                  <h2 className="col__title">{cat.name}</h2>
                  <span className="col__underline" />
                </div>
                <div className="tiles">
                  {cat.questions.map((q, qIdx) => {
                    const number = startNumbers[cIdx] + qIdx + 1;
                    return (
                      <button
                        type="button"
                        key={qIdx}
                        className={`tile ${q.answered ? 'is-answered' : ''}`}
                        disabled={q.answered || boardsHidden}
                        onClick={() => openQuestion(cIdx, qIdx)}
                        aria-label={
                          q.answered
                            ? `Otázka ${number} – ${cat.name} – už zodpovězená`
                            : `Otázka ${number} – ${cat.name}`
                        }
                      >
                        {!q.answered && <span className="tile__rule" />}
                        <span className="tile__num">{number}</span>
                        {q.answered && (
                          <span className="tile__mark">
                            <IconCheck size={30} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <span className="board__spacer" />

          <footer className="foot">
            <span className="foot__line" />
            <span className="foot__text">{WEDDING_FOOTER}</span>
            <span className="foot__line" />
          </footer>
        </div>
      </div>

      {modal && currentQuestion && currentCategory && (
        <div className="scrim">
          <div
            className={`window window--q${currentQuestion.answers.length}`}
            role="dialog"
            aria-modal="true"
          >
            <div className="window__head">
              <p className="kicker">
                {currentCategory.longName} · Otázka {currentNumber}
              </p>
              <h2 className="window__title">{currentQuestion.question}</h2>
              <img className="window__ornament" src={ornament} alt="" width={96} height={24} />
            </div>

            <div className={`answers answers--${currentQuestion.answers.length}`}>
              {currentQuestion.answers.map((ans, i) => {
                const isSelected = selectedAnswer === i;
                const isCorrect = currentQuestion.correctAnswer === i;
                const showCorrect = answerEvaluated && isCorrect;
                const showWrong = answerEvaluated && isSelected && !isCorrect;
                return (
                  <button
                    type="button"
                    key={i}
                    className={[
                      'answer',
                      showCorrect ? 'is-correct' : '',
                      showWrong ? 'is-wrong' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={answerEvaluated}
                    onClick={() => handleAnswer(i)}
                  >
                    <span className="answer__key">{ANSWER_KEYS[i]}</span>
                    <span className="answer__label">{ans}</span>
                    {showCorrect && (
                      <span className="answer__icon">
                        <IconCheckCircle size={19} />
                      </span>
                    )}
                    {showWrong && (
                      <span className="answer__icon">
                        <IconCancel size={19} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {answerEvaluated &&
              (selectedAnswer === currentQuestion.correctAnswer ? (
                <p className="feedback is-ok">
                  <IconCheckCircle size={19} />
                  Správně! {activeName} bere bod.
                </p>
              ) : (
                <p className="feedback is-fail">
                  <IconCancel size={19} />
                  Špatně. Správná odpověď je „
                  {currentQuestion.answers[currentQuestion.correctAnswer]}“ – bod nikdo nebere.
                </p>
              ))}

            {answerEvaluated ? (
              <div className="window__foot window__foot--center">
                {allAnswered ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={showWinner}
                    ref={questionPrimaryRef}
                  >
                    <IconTrophy size={14} />
                    Zobraz vítěze
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={closeModal}
                    ref={questionPrimaryRef}
                  >
                    <IconArrowBack size={16} />
                    Zpět na přehled
                  </button>
                )}
              </div>
            ) : (
              <div className="window__foot">
                <span className="foot__line foot__line--sm" />
                <span className="kicker">Na tahu · {activeName}</span>
                <span className="foot__line foot__line--sm" />
              </div>
            )}
          </div>
        </div>
      )}

      {showNameModal && (
        <div className="scrim">
          <form
            className="window window--names"
            role="dialog"
            aria-modal="true"
            onSubmit={e => {
              e.preventDefault();
              confirmNames();
            }}
          >
            <div className="window__head">
              <p className="kicker">Než začneme</p>
              <h2 className="window__title">Kdo dnes soutěží?</h2>
              <img className="window__ornament" src={ornament} alt="" width={96} height={24} />
            </div>

            <div className="fields">
              <div className="field">
                <label className="field__label" htmlFor="p1">
                  Jméno hráče 1
                </label>
                <input
                  id="p1"
                  ref={nameInputRef}
                  className="field__input"
                  value={tempNames.player1}
                  onChange={e => setTempNames(n => ({ ...n, player1: e.target.value }))}
                  placeholder={DEFAULT_NAMES.player1}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p2">
                  Jméno hráče 2
                </label>
                <input
                  id="p2"
                  className="field__input"
                  value={tempNames.player2}
                  onChange={e => setTempNames(n => ({ ...n, player2: e.target.value }))}
                  placeholder={DEFAULT_NAMES.player2}
                />
              </div>
            </div>

            <p className="hint">
              Jména se objeví u skóre na herní desce – kdykoli je můžeš nechat i tak, jak jsou.
            </p>

            <div className="window__foot window__foot--center">
              <button type="submit" className="btn-primary">
                Začít hrát
              </button>
            </div>
          </form>
        </div>
      )}

      {showRestartModal && (
        <div className="scrim">
          <div className="window window--restart" role="dialog" aria-modal="true">
            <div className="window__head">
              <p className="kicker">Restart hry</p>
              <h2 className="window__title">Opravdu začít znovu?</h2>
              <img className="window__ornament" src={ornament} alt="" width={96} height={24} />
            </div>

            <span className="restart-badge">
              <IconRestart size={22} />
            </span>

            <p className="hint">
              Smaže se celý průběh hry – všech {totalQuestions} otázek se otevře znovu a skóre{' '}
              {scores.player1} : {scores.player2} se vynuluje. Tuto akci nelze vzít zpět.
            </p>

            <div className="window__foot window__foot--center">
              <button type="button" className="btn-primary" onClick={resetGame}>
                <IconRestart size={16} />
                Ano, začít znovu
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowRestartModal(false)}
                ref={restartCancelRef}
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {showWinModal && (
        <div className="scrim">
          <div className="window window--win" role="dialog" aria-modal="true">
            <div className="window__head">
              <p className="kicker">Konec hry</p>
              <h2 className="window__title">
                {winnerName ? `Vyhrál ${winnerName}!` : 'Je to remíza, dejte si panáka'}
              </h2>
              <img className="window__ornament" src={ornament} alt="" width={96} height={24} />
            </div>

            <div className="win-scores">
              {renderScoreCard(1, true)}
              <span className="win-scores__x">×</span>
              {renderScoreCard(2, true)}
            </div>

            <p className="kicker">Všech {totalQuestions} otázek zodpovězeno</p>

            <div className="window__foot window__foot--center">
              <button type="button" className="btn-primary" onClick={resetGame}>
                <IconRestart size={16} />
                Nová hra
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowWinModal(false)}
                ref={winCloseRef}
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
