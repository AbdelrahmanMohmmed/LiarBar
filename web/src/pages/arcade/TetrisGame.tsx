import { useEffect, useRef, useState, useCallback } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const BOARD_W = 10;
const BOARD_H = 20;
const BOX = 28;
const BLANK = ".";

const HS_KEY = "arcade_tetris_highscore";

type ShapeName = "S" | "Z" | "I" | "O" | "J" | "L" | "T";

const SHAPES: Record<ShapeName, string[][]> = {
  S: [
    [".....", ".....", "..OO.", ".OO..", "....."],
    [".....", "..O..", "..OO.", "...O.", "....."],
  ],
  Z: [
    [".....", ".....", ".OO..", "..OO.", "....."],
    [".....", "..O..", ".OO..", ".O...", "....."],
  ],
  I: [
    ["..O..", "..O..", "..O..", "..O..", "....."],
    [".....", ".....", "OOOO.", ".....", "....."],
  ],
  O: [[".....", ".....", ".OO..", ".OO..", "....."]],
  J: [
    [".....", ".O...", ".OOO.", ".....", "....."],
    [".....", "..OO.", "..O..", "..O..", "....."],
    [".....", ".....", ".OOO.", "...O.", "....."],
    [".....", "..O..", "..O..", ".OO..", "....."],
  ],
  L: [
    [".....", "...O.", ".OOO.", ".....", "....."],
    [".....", "..O..", "..O..", "..OO.", "....."],
    [".....", ".....", ".OOO.", ".O...", "....."],
    [".....", ".OO..", "..O..", "..O..", "....."],
  ],
  T: [
    [".....", "..O..", ".OOO.", ".....", "....."],
    [".....", "..O..", "..OO.", "..O..", "....."],
    [".....", ".....", ".OOO.", "..O..", "....."],
    [".....", "..O..", ".OO..", "..O..", "....."],
  ],
};

const SHAPE_NAMES: ShapeName[] = ["S", "Z", "I", "O", "J", "L", "T"];

const PIECE_COLORS: Record<number, { fill: string; light: string }> = {
  0: { fill: "#00009b", light: "#1414af" },
  1: { fill: "#009b00", light: "#14af14" },
  2: { fill: "#9b0000", light: "#af1414" },
  3: { fill: "#9b9b00", light: "#afaf14" },
};

type Phase = "intro" | "playing" | "paused" | "over";

interface Piece {
  shape: ShapeName;
  rotation: number;
  x: number;
  y: number;
  color: number;
}

export default function TetrisGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(0);
  const [level, setLevel] = useState(1);

  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const highRef = useRef(high);
  const levelRef = useRef(level);
  const boardRef = useRef<(number | typeof BLANK)[][]>([]);
  const fallingRef = useRef<Piece | null>(null);
  const nextRef = useRef<Piece | null>(null);
  const lastFallRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const lastMoveSidewaysRef = useRef(0);
  const lastMoveDownRef = useRef(0);

  phaseRef.current = phase;
  scoreRef.current = score;
  highRef.current = high;
  levelRef.current = level;

  useEffect(() => {
    const stored = Number(localStorage.getItem(HS_KEY) || 0);
    setHigh(stored);
    highRef.current = stored;
  }, []);

  const createBlankBoard = useCallback(() => {
    const board: (number | typeof BLANK)[][] = [];
    for (let x = 0; x < BOARD_W; x++) board.push(new Array(BOARD_H).fill(BLANK));
    return board;
  }, []);

  const newPiece = useCallback((): Piece => {
    const shape = SHAPE_NAMES[Math.floor(Math.random() * SHAPE_NAMES.length)];
    return {
      shape,
      rotation: Math.floor(Math.random() * SHAPES[shape].length),
      x: Math.floor(BOARD_W / 2) - 2,
      y: -2,
      color: Math.floor(Math.random() * 4),
    };
  }, []);

  const isValidPos = useCallback((piece: Piece, adjX: number, adjY: number): boolean => {
    const template = SHAPES[piece.shape][piece.rotation];
    const board = boardRef.current;
    for (let tx = 0; tx < 5; tx++) {
      for (let ty = 0; ty < 5; ty++) {
        if (template[ty][tx] === ".") continue;
        const bx = piece.x + tx + adjX;
        const by = piece.y + ty + adjY;
        if (by < 0) continue;
        if (bx < 0 || bx >= BOARD_W || by >= BOARD_H) return false;
        if (board[bx][by] !== BLANK) return false;
      }
    }
    return true;
  }, []);

  const placePiece = useCallback(() => {
    const piece = fallingRef.current;
    if (!piece) return;
    const template = SHAPES[piece.shape][piece.rotation];
    const board = boardRef.current;
    for (let tx = 0; tx < 5; tx++) {
      for (let ty = 0; ty < 5; ty++) {
        if (template[ty][tx] === ".") continue;
        const bx = piece.x + tx;
        const by = piece.y + ty;
        if (bx >= 0 && bx < BOARD_W && by >= 0 && by < BOARD_H) {
          board[bx][by] = piece.color;
        }
      }
    }
  }, []);

  const clearLines = useCallback(() => {
    const board = boardRef.current;
    let linesCleared = 0;
    let y = BOARD_H - 1;
    while (y >= 0) {
      if (board.every((col) => col[y] !== BLANK)) {
        for (let pullY = y; pullY > 0; pullY--) {
          for (let x = 0; x < BOARD_W; x++) board[x][pullY] = board[x][pullY - 1];
        }
        for (let x = 0; x < BOARD_W; x++) board[x][0] = BLANK;
        linesCleared++;
      } else {
        y--;
      }
    }
    if (linesCleared > 0) {
      const newScore = scoreRef.current + linesCleared * 10;
      const newLevel = Math.floor(newScore / 10) + 1;
      setScore(newScore);
      setLevel(newLevel);
      scoreRef.current = newScore;
      levelRef.current = newLevel;
      if (newScore > highRef.current) {
        highRef.current = newScore;
        setHigh(newScore);
        localStorage.setItem(HS_KEY, String(newScore));
      }
    }
  }, []);

  const startGame = useCallback(() => {
    boardRef.current = createBlankBoard();
    fallingRef.current = newPiece();
    nextRef.current = newPiece();
    lastFallRef.current = 0;
    scoreRef.current = 0;
    levelRef.current = 1;
    setScore(0);
    setLevel(1);
    setPhase("playing");
  }, [createBlankBoard, newPiece]);

  const restart = useCallback(() => { startGame(); }, [startGame]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = BOARD_W * BOX + 160;
    canvas.height = BOARD_H * BOX + 20;

    const moveSidewaysFreq = 150;
    const moveDownFreq = 80;

    const loop = (now: number) => {
      ctx.fillStyle = "#0e0b16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (phaseRef.current === "playing") {
        const board = boardRef.current;
        const fallInterval = Math.max(50, 800 - (levelRef.current - 1) * 70);
        const keys = keysRef.current;

        // Auto-fall
        if (now - lastFallRef.current >= fallInterval) {
          lastFallRef.current = now;
          const piece = fallingRef.current;
          if (piece) {
            if (!isValidPos(piece, 0, 1)) {
              placePiece();
              clearLines();
              fallingRef.current = nextRef.current;
              nextRef.current = newPiece();
              if (!isValidPos(fallingRef.current!, 0, 0)) {
                const fs = scoreRef.current;
                if (fs > highRef.current) {
                  highRef.current = fs;
                  setHigh(fs);
                  localStorage.setItem(HS_KEY, String(fs));
                }
                setPhase("over");
              }
            } else {
              piece.y++;
            }
          }
        }

        // Held key movement
        const piece = fallingRef.current;
        if (piece) {
          if ((keys.has("arrowleft") || keys.has("a")) && now - lastMoveSidewaysRef.current > moveSidewaysFreq) {
            if (isValidPos(piece, -1, 0)) piece.x--;
            lastMoveSidewaysRef.current = now;
          }
          if ((keys.has("arrowright") || keys.has("d")) && now - lastMoveSidewaysRef.current > moveSidewaysFreq) {
            if (isValidPos(piece, 1, 0)) piece.x++;
            lastMoveSidewaysRef.current = now;
          }
          if ((keys.has("arrowdown") || keys.has("s")) && now - lastMoveDownRef.current > moveDownFreq) {
            if (isValidPos(piece, 0, 1)) piece.y++;
            lastMoveDownRef.current = now;
          }
        }

        // Draw board
        const boardX = 0;
        const boardY = 10;
        ctx.strokeStyle = "#1a1530";
        ctx.lineWidth = 1;
        for (let x = 0; x < BOARD_W; x++) {
          for (let y = 0; y < BOARD_H; y++) {
            const px = boardX + x * BOX;
            const py = boardY + y * BOX;
            if (board[x][y] !== BLANK) {
              const c = PIECE_COLORS[board[x][y] as number] ?? { fill: "#555", light: "#777" };
              ctx.fillStyle = c.fill;
              ctx.fillRect(px + 1, py + 1, BOX - 2, BOX - 2);
              ctx.fillStyle = c.light;
              ctx.fillRect(px + 1, py + 1, BOX - 4, BOX - 4);
            } else {
              ctx.fillStyle = "#12101a";
              ctx.fillRect(px, py, BOX, BOX);
            }
          }
        }

        // Board border
        ctx.strokeStyle = "#00009b";
        ctx.lineWidth = 3;
        ctx.strokeRect(boardX - 2, boardY - 2, BOARD_W * BOX + 4, BOARD_H * BOX + 4);

        // Ghost piece
        if (fallingRef.current) {
          const ghost = { ...fallingRef.current };
          while (isValidPos(ghost, 0, 1)) ghost.y++;
          const template = SHAPES[ghost.shape][ghost.rotation];
          ctx.globalAlpha = 0.25;
          for (let tx = 0; tx < 5; tx++) {
            for (let ty = 0; ty < 5; ty++) {
              if (template[ty][tx] !== ".") {
                const px = boardX + (ghost.x + tx) * BOX;
                const py = boardY + (ghost.y + ty) * BOX;
                const c = PIECE_COLORS[ghost.color] ?? { fill: "#555", light: "#777" };
                ctx.fillStyle = c.fill;
                ctx.fillRect(px + 1, py + 1, BOX - 2, BOX - 2);
              }
            }
          }
          ctx.globalAlpha = 1;
        }

        // Falling piece
        if (fallingRef.current) {
          const template = SHAPES[fallingRef.current.shape][fallingRef.current.rotation];
          for (let tx = 0; tx < 5; tx++) {
            for (let ty = 0; ty < 5; ty++) {
              if (template[ty][tx] !== ".") {
                const px = boardX + (fallingRef.current.x + tx) * BOX;
                const py = boardY + (fallingRef.current.y + ty) * BOX;
                const c = PIECE_COLORS[fallingRef.current.color] ?? { fill: "#555", light: "#777" };
                ctx.fillStyle = c.fill;
                ctx.fillRect(px + 1, py + 1, BOX - 2, BOX - 2);
                ctx.fillStyle = c.light;
                ctx.fillRect(px + 1, py + 1, BOX - 4, BOX - 4);
              }
            }
          }
        }

        // Next piece
        const nextX = BOARD_W * BOX + 20;
        const nextY = 10;
        ctx.font = "bold 16px 'Baloo 2', sans-serif";
        ctx.fillStyle = "#a78bfa";
        ctx.textAlign = "left";
        ctx.fillText(isAr ? "التالي:" : "Next:", nextX, nextY + 16);
        if (nextRef.current) {
          const template = SHAPES[nextRef.current.shape][nextRef.current.rotation];
          for (let tx = 0; tx < 5; tx++) {
            for (let ty = 0; ty < 5; ty++) {
              if (template[ty][tx] !== ".") {
                const px = nextX + tx * (BOX - 4);
                const py = nextY + 28 + ty * (BOX - 4);
                const c = PIECE_COLORS[nextRef.current.color] ?? { fill: "#555", light: "#777" };
                ctx.fillStyle = c.fill;
                ctx.fillRect(px + 1, py + 1, BOX - 6, BOX - 6);
                ctx.fillStyle = c.light;
                ctx.fillRect(px + 1, py + 1, BOX - 8, BOX - 8);
              }
            }
          }
        }

        // Score & level
        const hudX = BOARD_W * BOX + 20;
        ctx.font = "bold 16px 'Baloo 2', sans-serif";
        ctx.fillStyle = "#a78bfa";
        ctx.fillText(`${isAr ? "النقاط" : "Score"}: ${scoreRef.current}`, hudX, nextY + 150);
        ctx.fillText(`${isAr ? "المستوى" : "Level"}: ${levelRef.current}`, hudX, nextY + 180);
        ctx.fillStyle = "#fde047";
        ctx.fillText(`${isAr ? "الأفضل" : "Best"}: ${highRef.current}`, hudX, nextY + 210);

        // Controls
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px 'Baloo 2', sans-serif";
        const ctrlY = nextY + 260;
        ctx.fillText(isAr ? "الأسهم: حركة" : "Arrows: Move", hudX, ctrlY);
        ctx.fillText(isAr ? "أعلى: دوران" : "Up/W: Rotate", hudX, ctrlY + 18);
        ctx.fillText(isAr ? "مسافة: سقوط" : "Space: Drop", hudX, ctrlY + 36);
        ctx.fillText(isAr ? "P: إيقاف مؤقت" : "P: Pause", hudX, ctrlY + 54);
      }

      requestAnimationFrame(loop);
    };

    const raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (phaseRef.current === "intro" || phaseRef.current === "over") {
        if (k === " " || k === "enter") { e.preventDefault(); restart(); }
        return;
      }
      if (k === "p") {
        setPhase((prev) => prev === "paused" ? "playing" : "paused");
        return;
      }
      if (phaseRef.current !== "playing") return;

      keysRef.current.add(k);

      const piece = fallingRef.current;
      if (!piece) return;

      if (k === "arrowup" || k === "w") {
        e.preventDefault();
        const oldRot = piece.rotation;
        piece.rotation = (piece.rotation + 1) % SHAPES[piece.shape].length;
        if (!isValidPos(piece, 0, 0)) piece.rotation = oldRot;
      }
      if (k === "q") {
        const oldRot = piece.rotation;
        piece.rotation = (piece.rotation - 1 + SHAPES[piece.shape].length) % SHAPES[piece.shape].length;
        if (!isValidPos(piece, 0, 0)) piece.rotation = oldRot;
      }
      if (k === " ") {
        e.preventDefault();
        while (isValidPos(piece, 0, 1)) piece.y++;
        placePiece();
        clearLines();
        fallingRef.current = nextRef.current;
        nextRef.current = newPiece();
        lastFallRef.current = performance.now();
        if (!isValidPos(fallingRef.current!, 0, 0)) {
          const fs = scoreRef.current;
          if (fs > highRef.current) {
            highRef.current = fs;
            setHigh(fs);
            localStorage.setItem(HS_KEY, String(fs));
          }
          setPhase("over");
        }
      }
      if (["arrowleft", "arrowright", "arrowdown", " "].includes(k)) e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isValidPos, placePiece, clearLines, newPiece, restart, isAr]);

  const i18n = {
    ar: {
      sub: "تيتريس",
      start: "اضغط مسافة للبدء",
      over: "انتهت اللعبة!",
      paused: "مؤقت",
      score: "النقاط",
      best: "الأفضل",
      level: "المستوى",
      again: "إعادة (مسافة)",
    },
    en: {
      sub: "Tetris",
      start: "Press Space to start",
      over: "Game Over!",
      paused: "Paused",
      score: "Score",
      best: "Best",
      level: "Level",
      again: "Restart (Space)",
    },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={`${i18n.score}: ${score}  •  ${i18n.level}: ${level}  •  ${i18n.best}: ${high}`}>
      <div className="relative w-full" style={{ maxWidth: 520 }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-white/10 touch-none"
          style={{ aspectRatio: `${BOARD_W * BOX + 160} / ${BOARD_H * BOX + 20}` }}
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 rounded-xl text-center px-6">
            <div className="text-3xl font-extrabold">
              {phase === "intro" ? i18n.sub : phase === "paused" ? i18n.paused : i18n.over}
            </div>
            {phase === "over" && (
              <div className="text-fuchsia-300">
                {i18n.score}: {score}  •  {i18n.best}: {high}
              </div>
            )}
            <p className="text-white/60 text-sm">{phase === "intro" ? i18n.start : ""}</p>
            <button
              onClick={restart}
              className="mt-2 px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-semibold transition-all"
            >
              {phase === "intro" ? (isAr ? "ابدأ" : "Start") : i18n.again}
            </button>
          </div>
        )}
      </div>
    </ArcadeShell>
  );
}
