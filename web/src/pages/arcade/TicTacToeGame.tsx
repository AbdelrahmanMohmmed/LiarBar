import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

type Player = "X" | "O";
type Cell = Player | "";
type Winner = Player | "tie" | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findWinner(board: Cell[]): { winner: Winner; line: number[] | null } {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line };
    }
  }
  if (board.every((c) => c !== "")) return { winner: "tie", line: null };
  return { winner: null, line: null };
}

function cpuMove(board: Cell[], cpu: Player): number {
  const human: Player = cpu === "X" ? "O" : "X";
  // win
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      const b = [...board]; b[i] = cpu;
      if (findWinner(b).winner === cpu) return i;
    }
  }
  // block
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      const b = [...board]; b[i] = human;
      if (findWinner(b).winner === human) return i;
    }
  }
  // center
  if (!board[4]) return 4;
  // corner
  const corners = [0, 2, 6, 8].filter((i) => !board[i]);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  // any
  const free = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  return free[Math.floor(Math.random() * free.length)];
}

export default function TicTacToeGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  const [board, setBoard] = useState<Cell[]>(Array(9).fill(""));
  const [turn, setTurn] = useState<Player>("X");
  const [vsCPU, setVsCPU] = useState(true);
  const [result, setResult] = useState<{ winner: Winner; line: number[] | null }>({ winner: null, line: null });
  const timer = useRef<number | null>(null);

  const reset = () => {
    setBoard(Array(9).fill(""));
    setTurn("X");
    setResult({ winner: null, line: null });
  };

  useEffect(() => {
    if (vsCPU && turn === "O" && !result.winner) {
      timer.current = window.setTimeout(() => {
        const i = cpuMove(board, "O");
        play(i, "O");
      }, 420);
      return () => { if (timer.current) window.clearTimeout(timer.current); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, vsCPU, board, result.winner]);

  const play = (i: number, player: Player) => {
    if (board[i] || result.winner) return;
    const nb = [...board];
    nb[i] = player;
    setBoard(nb);
    const res = findWinner(nb);
    if (res.winner) {
      setResult(res);
    } else {
      setTurn(player === "X" ? "O" : "X");
    }
  };

  const handleClick = (i: number) => {
    if (result.winner || board[i]) return;
    if (vsCPU && turn === "O") return;
    play(i, turn);
  };

  const i18n = {
    ar: {
      sub: "تيك تاك تو",
      vs: "ضد الحاسوب",
      p2: "لاعبان",
      turn: (p: Player) => `دور ${p === "X" ? "س" : "ص"}`,
      xwon: "فاز س!",
      owon: "فاز ص!",
      tie: "تعادل",
      reset: "لعبة جديدة",
    },
    en: {
      sub: "Tic-Tac-Toe",
      vs: "Vs CPU",
      p2: "2 Players",
      turn: (p: Player) => `${p}'s turn`,
      xwon: "X wins!",
      owon: "O wins!",
      tie: "It's a tie!",
      reset: "New game",
    },
  }[isAr ? "ar" : "en"];

  const status = result.winner
    ? result.winner === "tie"
      ? i18n.tie
      : result.winner === "X"
        ? i18n.xwon
        : i18n.owon
    : i18n.turn(turn);

  return (
    <ArcadeShell title={i18n.sub} subtitle={status}>
      <div className="flex flex-col items-center gap-5">
        <div className="inline-flex rounded-lg bg-white/5 p-1 border border-white/10">
          <button
            onClick={() => { setVsCPU(true); reset(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${vsCPU ? "bg-fuchsia-600 text-white" : "text-white/60"}`}
          >
            {i18n.vs}
          </button>
          <button
            onClick={() => { setVsCPU(false); reset(); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${!vsCPU ? "bg-fuchsia-600 text-white" : "text-white/60"}`}
          >
            {i18n.p2}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-white/5 p-2 rounded-2xl border border-white/10" style={{ width: 320, maxWidth: "92vw" }}>
          {board.map((cell, i) => {
            const win = result.line?.includes(i);
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                className={`aspect-square flex items-center justify-center text-5xl font-extrabold rounded-xl transition-all ${
                  win ? (result.winner === "tie" ? "bg-yellow-400/30 text-yellow-300" : "bg-emerald-500/30 text-emerald-300") : "bg-[#16121f] text-white hover:bg-white/10"
                } ${cell === "X" ? "text-fuchsia-400" : cell === "O" ? "text-cyan-400" : ""}`}
              >
                {cell}
              </button>
            );
          })}
        </div>

        <button
          onClick={reset}
          className="px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-semibold transition-all"
        >
          {i18n.reset}
        </button>
      </div>
    </ArcadeShell>
  );
}
