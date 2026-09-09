import { useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";
import WinOverlay from "./WinOverlay";

const BOX = 52;
const GAP = 8;
const FLIP_MS = 220;
const PLAYER_COLORS = ["#2dd4bf", "#f5a524", "#38bdf8", "#c084fc", "#fb7185", "#a3e635"];

type Shape = "donut" | "square" | "diamond" | "lines" | "oval" | "star" | "triangle";
type Color = { r: number; g: number; b: number };
type Icon = { shape: Shape; color: Color };

interface CardAnim {
  fromProgress: number;
  toProgress: number;
  start: number;
}

export default function MemoryPuzzleLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Flip-animation tween: track each card's revealed-ness (0 = showing the cover
  // pattern, 1 = showing its icon) and tween between the two whenever the server
  // toggles `revealed`/`matched`, instead of the previous instant toggle.
  const cardVisibleRef = useRef<Record<string, boolean>>({});
  const cardAnimRef = useRef<Record<string, CardAnim>>({});

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const st = stateRef.current;
    if (!st || st.phase !== "playing") return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const bw = st.boardW || 8;
    const bh = st.boardH || 6;
    const totalW = bw * (BOX + GAP) - GAP;
    const totalH = bh * (BOX + GAP) - GAP;
    const ox = (canvas.width - totalW) / 2;
    const oy = (canvas.height - totalH) / 2;

    const bx = Math.floor((mx - ox) / (BOX + GAP));
    const by = Math.floor((my - oy) / (BOX + GAP));
    if (bx < 0 || bx >= bw || by < 0 || by >= bh) return;

    const card = st.board?.[bx]?.[by];
    if (!card || card.revealed || card.matched) return;

    getSocket().emit("memory_puzzle_flip", { x: bx, y: by });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const getProgress = (key: string, now: number): number => {
      const a = cardAnimRef.current[key];
      if (!a) return cardVisibleRef.current[key] ? 1 : 0;
      const t = Math.min(1, (now - a.start) / FLIP_MS);
      return a.fromProgress + (a.toProgress - a.fromProgress) * t;
    };

    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const st = stateRef.current;
      const bw = st?.boardW || 8;
      const bh = st?.boardH || 6;
      const totalW = bw * (BOX + GAP) - GAP;
      const totalH = bh * (BOX + GAP) - GAP;
      canvas.width = totalW + 40;
      canvas.height = totalH + 40;

      ctx.fillStyle = "#0e0b16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (st?.board) {
        const ox = 20;
        const oy = 20;
        for (let x = 0; x < bw; x++) {
          for (let y = 0; y < bh; y++) {
            const card = st.board[x]?.[y];
            if (!card) continue;
            const key = `${x},${y}`;
            const px = ox + x * (BOX + GAP);
            const py = oy + y * (BOX + GAP);

            const visible = !!(card.revealed || card.matched);
            const wasVisible = cardVisibleRef.current[key];
            if (wasVisible === undefined) {
              cardVisibleRef.current[key] = visible;
            } else if (wasVisible !== visible) {
              cardAnimRef.current[key] = {
                fromProgress: getProgress(key, now),
                toProgress: visible ? 1 : 0,
                start: now,
              };
              cardVisibleRef.current[key] = visible;
            }

            const progress = getProgress(key, now);
            const showIcon = progress >= 0.5;
            const scaleX = Math.max(0.04, Math.abs(Math.cos(progress * Math.PI)));

            ctx.save();
            ctx.translate(px + BOX / 2, py + BOX / 2);
            ctx.scale(scaleX, 1);
            ctx.translate(-(px + BOX / 2), -(py + BOX / 2));

            ctx.fillStyle = "#2a2040";
            ctx.beginPath();
            ctx.roundRect(px, py, BOX, BOX, 6);
            ctx.fill();

            if (showIcon) {
              drawIcon(ctx, card.icon, px, py, BOX);
              if (card.matched) {
                ctx.strokeStyle = "#a78bfa";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(px - 1, py - 1, BOX + 2, BOX + 2, 7);
                ctx.stroke();
              }
            } else {
              ctx.fillStyle = "#e8e0f0";
              ctx.beginPath();
              ctx.roundRect(px, py, BOX, BOX, 6);
              ctx.fill();
              ctx.fillStyle = "#c8b8e0";
              ctx.beginPath();
              ctx.arc(px + BOX / 2, py + BOX / 2, BOX / 4, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const i18n = {
    ar: { title: "لغز الذاكرة", you: "أنت", pairs: "الأزواج", moves: "المحاولات", countdown: "ابدأ!", won: "فزتم!" },
    en: { title: "Memory Puzzle", you: "You", pairs: "Pairs", moves: "Moves", countdown: "Go!", won: "Wins!" },
  }[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-[#0b0710]">
      <div className="flex items-center gap-4 flex-wrap justify-center text-sm">
        {(state?.players ?? []).map((p: any, i: number) => {
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          return (
            <div key={p.id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-white/80">{p.name}{p.id === myPlayerId ? ` (${i18n.you})` : ""}</span>
              <span style={{ color }} className="font-bold">{p.score}</span>
            </div>
          );
        })}
        {state?.phase === "playing" && (
          <div className="text-white/70 font-bold ml-2">
            {i18n.pairs}: {state.pairsFound}/{state.totalPairs}
          </div>
        )}
      </div>

      <div className="relative" style={{ maxWidth: "92vw" }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-white/10 cursor-pointer touch-none"
          style={{ aspectRatio: "1 / 1", imageRendering: "pixelated", background: "#0e0b16" }}
          onClick={handleClick}
        />
        {state?.phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-fuchsia-300">
            {state.countdownLeft > 0 ? state.countdownLeft : i18n.countdown}
          </div>
        )}
        {state?.phase === "finished" && (() => {
          const winnerIds: string[] = state.winners ?? [];
          const winnerNames = winnerIds
            .map((id) => state.players?.find((p: any) => p.id === id)?.name)
            .filter(Boolean)
            .join(", ");
          const winnerIdx = state.players?.findIndex((p: any) => p.id === winnerIds[0]) ?? -1;
          const color = winnerIdx >= 0 ? PLAYER_COLORS[winnerIdx % PLAYER_COLORS.length] : undefined;
          return <WinOverlay winnerName={winnerNames || "?"} color={color} subtitle={i18n.won} />;
        })()}
      </div>
      <p className="text-white/40 text-xs text-center max-w-md">
        {isAr
          ? "اقلب البطاقات وابحث عن الأزواج المتطابقة! صاحب أكبر عدد من الأزواج يفوز."
          : "Flip cards and find matching pairs! The player with the most pairs wins."}
      </p>
    </div>
  );
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: Icon, px: number, py: number, size: number) {
  const { r, g, b } = icon.color;
  const color = `rgb(${r},${g},${b})`;
  const darker = `rgb(${Math.floor(r * 0.6)},${Math.floor(g * 0.6)},${Math.floor(b * 0.6)})`;
  const half = size / 2;
  const quarter = size / 4;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  const grad = ctx.createLinearGradient(px, py, px + size, py + size);
  grad.addColorStop(0, color);
  grad.addColorStop(1, darker);

  switch (icon.shape) {
    case "donut":
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px + half, py + half, half - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "#0e0b16";
      ctx.beginPath();
      ctx.arc(px + half, py + half, quarter - 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "square":
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(px + quarter, py + quarter, half, half, 4);
      ctx.fill();
      break;
    case "diamond":
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px + half, py + 2);
      ctx.lineTo(px + size - 2, py + half);
      ctx.lineTo(px + half, py + size - 2);
      ctx.lineTo(px + 2, py + half);
      ctx.closePath();
      ctx.fill();
      break;
    case "lines":
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = grad;
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
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px + half, py + half, half - 2, quarter, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "star": {
      ctx.fillStyle = grad;
      const cx = px + half, cy = py + half;
      const spikes = 5;
      const outerR = half - 3;
      const innerR = outerR * 0.45;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r2 = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * r2;
        const y = cy + Math.sin(angle) * r2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "triangle":
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(px + half, py + 3);
      ctx.lineTo(px + size - 3, py + size - 3);
      ctx.lineTo(px + 3, py + size - 3);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}
