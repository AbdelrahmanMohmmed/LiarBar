import { useEffect, useRef, useState, useCallback } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const HS_KEY = "arcade_memory_highscore";

const BOARD_W = 10;
const BOARD_H = 7;
const BOX = 52;
const GAP = 8;
const REVEAL_SPEED = 6;

type Shape = "donut" | "square" | "diamond" | "lines" | "oval";
type Color = { r: number; g: number; b: number };
type Icon = { shape: Shape; color: Color };
type Phase = "intro" | "preview" | "playing" | "won";

const COLORS: Color[] = [
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
  { r: 255, g: 128, b: 0 },
  { r: 255, g: 0, b: 255 },
  { r: 0, g: 255, b: 255 },
];
const SHAPES: Shape[] = ["donut", "square", "diamond", "lines", "oval"];
const ALL_ICONS: Icon[] = [];
for (const c of COLORS) for (const s of SHAPES) ALL_ICONS.push({ shape: s, color: c });

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Card {
  icon: Icon;
  revealed: boolean;
  animating: boolean;
  animDir: "reveal" | "cover";
  animProgress: number;
}

function createBoard(): Card[][] {
  const numPairs = (BOARD_W * BOARD_H) / 2;
  const icons = shuffle(ALL_ICONS).slice(0, numPairs);
  const deck = shuffle([...icons, ...icons]);
  const board: Card[][] = [];
  for (let x = 0; x < BOARD_W; x++) {
    const col: Card[] = [];
    for (let y = 0; y < BOARD_H; y++) {
      col.push({
        icon: deck[x * BOARD_H + y],
        revealed: false,
        animating: false,
        animDir: "reveal",
        animProgress: 0,
      });
    }
    board.push(col);
  }
  return board;
}

export default function MemoryPuzzleGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [moves, setMoves] = useState(0);
  const [pairs, setPairs] = useState(0);
  const [high, setHigh] = useState(0);
  const [timer, setTimer] = useState(0);

  const phaseRef = useRef(phase);
  const movesRef = useRef(moves);
  const pairsRef = useRef(pairs);
  const highRef = useRef(high);
  const timerRef = useRef(timer);
  const boardRef = useRef<Card[][]>([]);
  const firstPick = useRef<{ x: number; y: number } | null>(null);
  const lockInput = useRef(false);
  const rafRef = useRef(0);
  const startT = useRef(0);
  const totalPairs = useRef(0);

  phaseRef.current = phase;
  movesRef.current = moves;
  pairsRef.current = pairs;
  highRef.current = high;
  timerRef.current = timer;

  useEffect(() => {
    const stored = Number(localStorage.getItem(HS_KEY) || 0);
    setHigh(stored);
    highRef.current = stored;
  }, []);

  const startGame = useCallback(() => {
    const board = createBoard();
    boardRef.current = board;
    totalPairs.current = (BOARD_W * BOARD_H) / 2;
    firstPick.current = null;
    lockInput.current = false;
    setMoves(0);
    setPairs(0);
    setTimer(0);
    startT.current = performance.now();

    // Briefly show all cards
    for (const col of board) for (const c of col) { c.revealed = true; c.animProgress = 1; }
    setPhase("preview");

    setTimeout(() => {
      for (const col of board) for (const c of col) { c.revealed = false; c.animating = true; c.animDir = "cover"; c.animProgress = 1; }
      setTimeout(() => {
        for (const col of board) for (const c of col) { c.animating = false; c.animProgress = 0; }
        setPhase("playing");
      }, 600);
    }, 1200);
  }, []);

  const restart = useCallback(() => { startGame(); }, [startGame]);

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing" || lockInput.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const totalW = BOARD_W * (BOX + GAP) - GAP;
    const totalH = BOARD_H * (BOX + GAP) - GAP;
    const ox = (canvas.width - totalW) / 2;
    const oy = (canvas.height - totalH) / 2;

    const bx = Math.floor((mx - ox) / (BOX + GAP));
    const by = Math.floor((my - oy) / (BOX + GAP));
    if (bx < 0 || bx >= BOARD_W || by < 0 || by >= BOARD_H) return;

    const card = boardRef.current[bx]?.[by];
    if (!card || card.revealed || card.animating) return;

    card.revealed = true;
    card.animating = true;
    card.animDir = "reveal";
    card.animProgress = 0;

    if (!firstPick.current) {
      firstPick.current = { x: bx, y: by };
    } else {
      const fp = firstPick.current;
      firstPick.current = null;
      lockInput.current = true;
      setMoves((m) => m + 1);

      const c1 = boardRef.current[fp.x][fp.y];
      const c2 = card;
      if (c1.icon.shape === c2.icon.shape && c1.icon.color.r === c2.icon.color.r && c1.icon.color.g === c2.icon.color.g && c1.icon.color.b === c2.icon.color.b) {
        // Match
        setTimeout(() => {
          const np = pairsRef.current + 1;
          setPairs(np);
          if (np >= totalPairs.current) {
            const elapsed = Math.floor((performance.now() - startT.current) / 1000);
            setTimer(elapsed);
            const score = Math.max(1, 1000 - movesRef.current * 10 + elapsed);
            if (score > highRef.current) {
              highRef.current = score;
              setHigh(score);
              localStorage.setItem(HS_KEY, String(score));
            }
            setPhase("won");
          }
          lockInput.current = false;
        }, 400);
      } else {
        // No match
        setTimeout(() => {
          c1.animating = true; c1.animDir = "cover"; c1.animProgress = 1;
          c2.animating = true; c2.animDir = "cover"; c2.animProgress = 1;
          setTimeout(() => {
            c1.revealed = false; c1.animating = false; c1.animProgress = 0;
            c2.revealed = false; c2.animating = false; c2.animProgress = 0;
            lockInput.current = false;
          }, 400);
        }, 800);
      }
    }
  }, []);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const totalW = BOARD_W * (BOX + GAP) - GAP;
    const totalH = BOARD_H * (BOX + GAP) - GAP;
    canvas.width = totalW + 40;
    canvas.height = totalH + 40;

    const loop = () => {
      const ox = 20;
      const oy = 20;

      ctx.fillStyle = "#0e0b16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (boardRef.current.length === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      for (let x = 0; x < BOARD_W; x++) {
        for (let y = 0; y < BOARD_H; y++) {
          const card = boardRef.current[x][y];
          const px = ox + x * (BOX + GAP);
          const py = oy + y * (BOX + GAP);

          if (card.animating) {
            if (card.animDir === "reveal") {
              card.animProgress = Math.min(1, card.animProgress + REVEAL_SPEED / BOX);
              if (card.animProgress >= 1) { card.animating = false; card.animProgress = 1; }
            } else {
              card.animProgress = Math.max(0, card.animProgress - REVEAL_SPEED / BOX);
              if (card.animProgress <= 0) { card.animating = false; card.animProgress = 0; }
            }
          }

          const coverage = card.animDir === "cover" ? card.animProgress : (1 - card.animProgress);
          const showIcon = card.revealed || card.animating && card.animDir === "cover";

          // Draw card background
          ctx.fillStyle = "#2a2040";
          ctx.beginPath();
          ctx.roundRect(px, py, BOX, BOX, 6);
          ctx.fill();

          // Draw icon if visible
          if (showIcon && coverage < 1) {
            drawIcon(ctx, card.icon, px, py, BOX, 1 - coverage);
          }

          // Draw cover
          if (coverage > 0) {
            ctx.globalAlpha = coverage;
            ctx.fillStyle = "#e8e0f0";
            ctx.beginPath();
            ctx.roundRect(px, py, BOX, BOX, 6);
            ctx.fill();
            // Cover pattern
            ctx.fillStyle = "#c8b8e0";
            const q = BOX / 4;
            ctx.beginPath();
            ctx.arc(px + BOX / 2, py + BOX / 2, q, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }

      // HUD
      ctx.font = "bold 18px 'Baloo 2', sans-serif";
      ctx.fillStyle = "#a78bfa";
      ctx.textAlign = "center";
      ctx.fillText(
        `${isAr ? "النقاط" : "Pairs"}: ${pairsRef.current}/${totalPairs.current}   ${isAr ? "المحاولات" : "Moves"}: ${movesRef.current}`,
        canvas.width / 2,
        canvas.height - 6
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isAr]);

  const i18n = {
    ar: {
      sub: "لغز الذاكرة",
      start: "اقلب البطاقات وابحث عن الأزواج المتطابقة!",
      play: "ابدأ",
      over: "أحسنت!",
      moves: "المحاولات",
      pairs: "الأزواج",
      score: "النقاط",
      again: "إعادة",
      won: "فزت!",
    },
    en: {
      sub: "Memory Puzzle",
      start: "Flip cards and find matching pairs!",
      play: "Start",
      over: "Well done!",
      moves: "Moves",
      pairs: "Pairs",
      score: "Score",
      again: "Play Again",
      won: "You Won!",
    },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={`${i18n.pairs}: ${pairs}  •  ${i18n.moves}: ${moves}`}>
      <div className="relative w-full" style={{ maxWidth: 620 }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-white/10 cursor-pointer touch-none"
          onClick={handleClick}
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 rounded-xl text-center px-6">
            <div className="text-3xl font-extrabold">
              {phase === "intro" ? i18n.sub : phase === "won" ? i18n.won : i18n.over}
            </div>
            {phase === "won" && (
              <div className="text-fuchsia-300">
                {i18n.moves}: {moves}  •  {i18n.pairs}: {pairs}
              </div>
            )}
            <p className="text-white/60 text-sm">{phase === "intro" ? i18n.start : ""}</p>
            <button
              onClick={restart}
              className="mt-2 px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-semibold transition-all"
            >
              {phase === "intro" ? i18n.play : i18n.again}
            </button>
          </div>
        )}
      </div>
    </ArcadeShell>
  );
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: Icon, px: number, py: number, size: number, alpha: number) {
  const { r, g, b } = icon.color;
  const color = `rgb(${r},${g},${b})`;
  const half = size / 2;
  const quarter = size / 4;

  ctx.save();
  ctx.globalAlpha = alpha;

  switch (icon.shape) {
    case "donut":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px + half, py + half, half - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0e0b16";
      ctx.beginPath();
      ctx.arc(px + half, py + half, quarter - 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "square":
      ctx.fillStyle = color;
      ctx.fillRect(px + quarter, py + quarter, half, half);
      break;
    case "diamond":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(px + half, py + 2);
      ctx.lineTo(px + size - 2, py + half);
      ctx.lineTo(px + half, py + size - 2);
      ctx.lineTo(px + 2, py + half);
      ctx.closePath();
      ctx.fill();
      break;
    case "lines":
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = 0; i < size; i += 4) {
        ctx.beginPath();
        ctx.moveTo(px + i, py);
        ctx.lineTo(px, py + i);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + i, py + size - 1);
        ctx.lineTo(px + size - 1, py + i);
        ctx.stroke();
      }
      break;
    case "oval":
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(px + half, py + half, half - 2, quarter, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  ctx.restore();
}
