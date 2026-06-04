"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./Pinboard.module.css";
import { Pin } from "./Decorations";

// ─── Tic-tac-toe ─────────────────────────────────────────────
// A torn notebook page pinned to the wall. You play X (blue ink),
// the computer plays O (red ink). The AI is "smart with a wobble":
// usually finds wins/blocks and prefers center→corner→edge, but
// makes a random move ~12% of the time so it feels like playing a
// friend at school rather than a perfect minimax.
//
// Notable design choices:
//   - All marks animate in with a stamping motion (.tictacInk)
//   - Grid is drawn in SVG with deliberately wobbly Bezier paths,
//     so it reads as ink-on-paper rather than CSS borders
//   - Win line is a single ink stroke from first cell center past
//     the last cell center, with slight extension overshoot

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const CELL_CENTERS = [
  [30, 30], [90, 30], [150, 30],
  [30, 90], [90, 90], [150, 90],
  [30, 150], [90, 150], [150, 150],
];

function findWinner(b) {
  for (const line of WIN_LINES) {
    const [a, b1, c] = line;
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return { winner: b[a], line };
  }
  return null;
}

function isWinningMoveFor(b, mark) {
  // Returns true iff placing `mark` results in `mark` winning.
  for (const line of WIN_LINES) {
    const cells = line.map((i) => b[i]);
    if (cells.every((c) => c === mark)) return true;
  }
  return false;
}

// AI strategy:
//   1. Take a winning move if available.
//   2. Block an opponent winning move.
//   3. Center.
//   4. A random corner.
//   5. A random edge.
function pickAIMove(board) {
  // 12% of the time, just play any random open square (the "human-y" wobble)
  const open = board.map((c, i) => (c ? null : i)).filter((i) => i !== null);
  if (open.length === 0) return -1;
  if (Math.random() < 0.12) return open[Math.floor(Math.random() * open.length)];

  for (const i of open) {
    const t = [...board]; t[i] = "O";
    if (isWinningMoveFor(t, "O")) return i;
  }
  for (const i of open) {
    const t = [...board]; t[i] = "X";
    if (isWinningMoveFor(t, "X")) return i;
  }
  if (board[4] == null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] == null);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  const edges = [1, 3, 5, 7].filter((i) => board[i] == null);
  if (edges.length) return edges[Math.floor(Math.random() * edges.length)];
  return open[0];
}

function winLineEndpoints(line) {
  // Extend past the cell centers a bit so the ink overshoots the marks,
  // the way you'd actually scratch out a win line on paper.
  const [a, , c] = line;
  const [ax, ay] = CELL_CENTERS[a];
  const [cx, cy] = CELL_CENTERS[c];
  const dx = cx - ax, dy = cy - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ex = (dx / len) * 22;
  const ey = (dy / len) * 22;
  return { x1: ax - ex, y1: ay - ey, x2: cx + ex, y2: cy + ey };
}

export function TicTacToe() {
  const [board, setBoard] = useState(() => Array(9).fill(null));
  const [turn, setTurn] = useState("X"); // X = you, O = computer
  const [winner, setWinner] = useState(null); // 'X' | 'O' | 'draw'
  const [winLine, setWinLine] = useState(null);
  const [score, setScore] = useState({ X: 0, O: 0 });
  const [lastResultShown, setLastResultShown] = useState(false);

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setWinLine(null);
    setLastResultShown(false);
  }, []);

  // Resolve game state from a candidate next board.
  const settleAfterMove = (next, justMoved) => {
    const w = findWinner(next);
    if (w) {
      setBoard(next);
      setWinner(w.winner);
      setWinLine(w.line);
      setScore((s) => ({ ...s, [w.winner]: s[w.winner] + 1 }));
      return;
    }
    if (next.every((c) => c)) {
      setBoard(next);
      setWinner("draw");
      return;
    }
    setBoard(next);
    setTurn(justMoved === "X" ? "O" : "X");
  };

  const onCell = (i) => (e) => {
    e.stopPropagation();
    if (board[i] || winner || turn !== "X") return;
    const next = [...board];
    next[i] = "X";
    settleAfterMove(next, "X");
  };

  // Computer's turn — delay slightly so the move doesn't feel snapped.
  useEffect(() => {
    if (turn !== "O" || winner) return;
    const timer = setTimeout(() => {
      const i = pickAIMove(board);
      if (i < 0) return;
      const next = [...board];
      next[i] = "O";
      settleAfterMove(next, "O");
    }, 580);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, board, winner]);

  // Fade in the result text on its own beat so the win line shows first.
  useEffect(() => {
    if (!winner) { setLastResultShown(false); return; }
    const t = setTimeout(() => setLastResultShown(true), 350);
    return () => clearTimeout(t);
  }, [winner]);

  const wle = winLine ? winLineEndpoints(winLine) : null;

  const resultText =
    winner === "X" ? "you got it!" :
    winner === "O" ? "they got it" :
    winner === "draw" ? "a draw" : "";

  const turnText = turn === "X" ? "your turn" : "their turn";

  return (
    <div
      className={styles.wallDeco}
      style={{ left: 1330, top: 740, width: 240 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Pin color="#c4a050" />
      <div className={styles.tictacPaper}>
        <div className={styles.tictacTitle}>tic · tac · toe</div>
        {/* Status line — between the title and the board. Shows whose
            turn it is during play; once the game ends, the result text
            takes the same slot (just bigger / handwritten) so it doesn't
            cover the board or the win line. */}
        {winner && lastResultShown ? (
          <div className={styles.tictacStatusResult}>{resultText}</div>
        ) : (
          <div className={styles.tictacStatus}>{winner ? "" : turnText}</div>
        )}

        <div className={styles.tictacBoard}>
          <div className={styles.tictacGrid}>
            {board.map((cell, i) => (
              <button
                key={i}
                className={styles.tictacCell}
                data-mark={cell || undefined}
                onClick={onCell(i)}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!!cell || !!winner || turn !== "X"}
                aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ", empty"}`}
              >
                {cell && <span className={styles.tictacInk}>{cell === "X" ? "✕" : "○"}</span>}
              </button>
            ))}
          </div>

          {/* Hand-drawn grid + win line. Bezier curves give a slight wobble
              that reads as ink, not CSS borders. */}
          <svg className={styles.tictacGridSvg} viewBox="0 0 180 180">
            <path d="M 60 8 Q 58 90 62 172" stroke="rgba(40,22,10,.7)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M 120 6 Q 122 92 118 173" stroke="rgba(40,22,10,.7)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M 8 60 Q 92 58 172 62" stroke="rgba(40,22,10,.7)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M 6 120 Q 92 122 173 118" stroke="rgba(40,22,10,.7)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            {wle && (
              <line
                x1={wle.x1}
                y1={wle.y1}
                x2={wle.x2}
                y2={wle.y2}
                stroke="rgba(185,50,30,.85)"
                strokeWidth="3.6"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 240,
                  strokeDashoffset: 240,
                  animation: "tictacInkDraw 0.42s cubic-bezier(0.4,0,0.2,1) forwards",
                }}
              />
            )}
          </svg>
        </div>

        <div className={styles.tictacFoot}>
          <div className={styles.tictacScore}>
            <b>you {score.X}</b> · <i>cpu {score.O}</i>
          </div>
          <button
            className={styles.tictacReset}
            onClick={(e) => { e.stopPropagation(); reset(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            new game
          </button>
        </div>
      </div>

      {/* Inline keyframe — only this component uses it, keep it local. */}
      <style jsx global>{`
        @keyframes tictacInkDraw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
