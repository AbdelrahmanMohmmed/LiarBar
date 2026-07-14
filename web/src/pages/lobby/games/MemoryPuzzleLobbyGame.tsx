import { useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

const BOX = 52;
const GAP = 8;

type Shape = "donut" | "square" | "diamond" | "lines" | "oval";
type Color = { r: number; g: number; b: number };
type Icon = { shape: Shape; color: Color };

export default function MemoryPuzzleLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;

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

    let raf = 0;
    const loop = () => {
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
            const px = ox + x * (BOX + GAP);
            const py = oy + y * (BOX + GAP);

            ctx.fillStyle = "#2a2040";
            ctx.beginPath();
            ctx.roundRect(px, py, BOX, BOX, 6);
            ctx.fill();

            if (card.revealed || card.matched) {
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
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const i18n = {
    ar: { title: "لغز الذاكرة", you: "أنت", pairs: "الأزواج", moves: "المحاولات", countdown: "ابدأ!", won: "فزت!" },
    en: { title: "Memory Puzzle", you: "You", pairs: "Pairs", moves: "Moves", countdown: "Go!", won: "Won!" },
  }[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-[#0b0710]">
      <div className="flex items-center gap-4 flex-wrap justify-center text-sm">
        {(state?.players ?? []).map((p: any) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-fuchsia-500" />
            <span className="text-white/80">{p.name}{p.id === myPlayerId ? ` (${i18n.you})` : ""}</span>
            <span className="text-fuchsia-300">{p.score}</span>
          </div>
        ))}
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
        {state?.phase === "finished" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 rounded-xl">
            <div className="text-2xl font-bold text-fuchsia-300">{i18n.won}</div>
            <div className="text-white">
              {(state.winners ?? []).map((id: string) => {
                const w = state.players.find((p: any) => p.id === id);
                return w ? w.name : "";
              }).join(", ")}
            </div>
          </div>
        )}
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
  const half = size / 2;
  const quarter = size / 4;

  ctx.save();
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
