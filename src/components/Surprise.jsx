import React, { useState, useEffect, useRef, useCallback } from "react";
import { autoLogin } from "../lib/auth";

const CONFIG = {
  name: "Elena",
  username: "elena",
  password: "elena-6269",
  displayName: "Elena",
  greeting: "Здравей, Елена! 👋",
  intro:
    "Имам една малка изненада за теб. Но първо трябва да минеш през няколко бързи стъпки.",
  // Три лесни въпроса от обща култура — трябва верен отговор за напред
  questions: [
    {
      text: "Коя планета е най-близо до Слънцето?",
      options: ["Меркурий", "Венера", "Марс"],
      correct: 0,
    },
    {
      text: "Колко континента има на Земята?",
      options: ["5", "7", "9"],
      correct: 1,
    },
    {
      text: "Коя е столицата на Италия?",
      options: ["Милано", "Венеция", "Рим"],
      correct: 2,
    },
  ],
  finalTitle: "Браво! 🎉",
  finalText: "Добре дошла в чата, създаден специално за теб :D",
  buttonText: "Влез в чата",
};

export default function Surprise({ onExit, onLoggedIn }) {
  // step: 0 intro, 1 въпроси, 2 лабиринт, 3 финал
  const [step, setStep] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [wrong, setWrong] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const totalSteps = CONFIG.questions.length + 1; // въпроси + лабиринт
  const answer = (i) => {
    const q = CONFIG.questions[qIndex];
    if (i !== q.correct) {
      setWrong(i);
      setTimeout(() => setWrong(null), 600);
      return;
    }
    setWrong(null);
    if (qIndex + 1 < CONFIG.questions.length) {
      setQIndex(qIndex + 1);
    } else {
      setStep(2); // към лабиринта
    }
  };

  const enter = async () => {
    setBusy(true);
    setErr("");
    try {
      await autoLogin(CONFIG.username, CONFIG.password, CONFIG.displayName);
      onLoggedIn();
    } catch (e) {
      setErr("Нещо се обърка при влизането. Опитай пак.");
      setBusy(false);
    }
  };

  return (
    <div className="surprise-wrap">
      {/* Дискретен изход за собственика */}
      <button className="owner-exit" onClick={onExit} title="Към нормалния вход">
        изход
      </button>

      <div className="surprise-card">
        {step === 0 && (
          <div className="s-step fade-in">
            <div className="s-emoji">📦</div>
            <h1>{CONFIG.greeting}</h1>
            <p>{CONFIG.intro}</p>
            <button className="s-primary" onClick={() => setStep(1)}>
              Хайде, започваме
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="s-step fade-in" key={qIndex}>
            <div className="s-progress">
              Стъпка {qIndex + 1} от {totalSteps}
            </div>
            <h2>{CONFIG.questions[qIndex].text}</h2>
            <div className="s-options">
              {CONFIG.questions[qIndex].options.map((o, i) => (
                <button
                  key={i}
                  className={wrong === i ? "shake-wrong" : ""}
                  onClick={() => answer(i)}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="s-step fade-in">
            <div className="s-progress">
              Стъпка {totalSteps} от {totalSteps}
            </div>
            <h2>Пренеси хладилника долу 🧊</h2>
            <p className="s-hint">
              Използвай стрелките или плъзни. Смъкни го от втория етаж до долу.
            </p>
            <Maze onWin={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="s-step fade-in">
            <div className="s-emoji">🎁</div>
            <h1>{CONFIG.finalTitle}</h1>
            <p>{CONFIG.finalText}</p>
            {err && <div className="s-error">{err}</div>}
            <button className="s-primary" onClick={enter} disabled={busy}>
              {busy ? "Момент…" : CONFIG.buttonText}
            </button>
          </div>
        )}
      </div>
      <Confetti active={step === 3} />
    </div>
  );
}

// ── Лабиринт ────────────────────────────────────────────────
// Мрежа: 0 = път, 1 = стена, S = старт, E = изход
const GRID = [
  "S0000100000",
  "0110100110",
  "0100000100",
  "0101111100",
  "0100000000",
  "0111110110",
  "0000010010",
  "0110010010",
  "0100000010",
  "010111100E",
].map((r) => r.split(""));

const ROWS = GRID.length;
const COLS = GRID[0].length;

function findCell(ch) {
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) if (GRID[y][x] === ch) return { x, y };
  return { x: 0, y: 0 };
}

function Maze({ onWin }) {
  const start = findCell("S");
  const goal = findCell("E");
  const [pos, setPos] = useState(start);
  const boardRef = useRef(null);
  const touchStart = useRef(null);

  const move = useCallback(
    (dx, dy) => {
      setPos((p) => {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return p;
        if (GRID[ny][nx] === "1") return p; // стена
        if (GRID[ny][nx] === "E") {
          setTimeout(onWin, 250);
        }
        return { x: nx, y: ny };
      });
    },
    [onWin]
  );

  useEffect(() => {
    const onKey = (e) => {
      const map = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      if (map[e.key]) {
        e.preventDefault();
        move(...map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    boardRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // Плъзгане (мобилно)
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1, 0);
    } else {
      move(0, dy > 0 ? 1 : -1);
    }
    touchStart.current = null;
  };

  return (
    <div className="maze-area">
      <div
        className="maze"
        ref={boardRef}
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          gridTemplateColumns: `repeat(${COLS}, 26px)`,
          gridAutoRows: "26px",
        }}
      >
        {GRID.map((row, y) =>
          row.map((cell, x) => {
            const isWall = cell === "1";
            const isGoal = x === goal.x && y === goal.y;
            const isPlayer = x === pos.x && y === pos.y;
            return (
              <div
                key={`${x}-${y}`}
                className={`cell ${isWall ? "wall" : ""} ${
                  isGoal ? "goal" : ""
                }`}
              >
                {isPlayer ? "🧊" : isGoal ? "🚪" : ""}
              </div>
            );
          })
        )}
      </div>
      <div className="maze-controls">
        <button onClick={() => move(0, -1)}>▲</button>
        <div>
          <button onClick={() => move(-1, 0)}>◀</button>
          <button onClick={() => move(1, 0)}>▶</button>
        </div>
        <button onClick={() => move(0, 1)}>▼</button>
      </div>
    </div>
  );
}

// ── Конфети ─────────────────────────────────────────────────
function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 40 });
  const colors = ["#5eead4", "#818cf8", "#f0616d", "#fbbf24", "#fff"];
  return (
    <div className="confetti">
      {pieces.map((_, i) => (
        <span
          key={i}
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.6}s`,
            animationDuration: `${2 + Math.random() * 1.5}s`,
          }}
        />
      ))}
    </div>
  );
}
