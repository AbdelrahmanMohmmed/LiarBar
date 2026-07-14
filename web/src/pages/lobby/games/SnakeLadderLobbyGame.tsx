import { useRef, useEffect, useState, useCallback } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

const COLS = 10;
const ROWS = 10;
const CELL = 50;
const PAD = 20;

function cellToPos(n: number): { x: number; y: number } {
  const idx = n - 1;
  const row = Math.floor(idx / COLS);
  const col = row % 2 === 0 ? (idx % COLS) : (COLS - 1 - (idx % COLS));
  const y = (ROWS - 1 - row);
  return { x: PAD + col * CELL, y: PAD + y * CELL };
}

function drawSnake(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number, t: number) {
  const midx = (fx + tx) / 2;
  const midy = (fy + ty) / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const amp = 20 + 15 * Math.sin(t * 0.002 + fx * 0.1);

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const x = fx + dx * p + nx * amp * Math.sin(p * Math.PI * 4);
    const y = fy + dy * p + ny * amp * Math.sin(p * Math.PI * 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // snake head
  const hx = fx + dx * 0.95 + nx * amp * Math.sin(0.95 * Math.PI * 4);
  const hy = fy + dy * 0.95 + ny * amp * Math.sin(0.95 * Math.PI * 4);
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(hx - 3, hy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + 3, hy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawLadder(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number) {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len * 8;
  const ny = dx / len * 8;

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // two rails
  ctx.beginPath();
  ctx.moveTo(fx - nx, fy - ny);
  ctx.lineTo(tx - nx, ty - ny);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(fx + nx, fy + ny);
  ctx.lineTo(tx + nx, ty + ny);
  ctx.stroke();

  // rungs
  const rungs = 5;
  ctx.lineWidth = 2;
  for (let i = 1; i < rungs; i++) {
    const p = i / rungs;
    const rx = fx + dx * p;
    const ry = fy + dy * p;
    ctx.beginPath();
    ctx.moveTo(rx - nx, ry - ny);
    ctx.lineTo(rx + nx, ry + ny);
    ctx.stroke();
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export default function SnakeLadderLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState(1);

  // Smooth movement animation state
  const animStateRef = useRef<{
    prevPositions: Record<string, number>;
    animating: Record<string, { from: number; to: number; startTime: number; duration: number }>;
  }>({
    prevPositions: {},
    animating: {},
  });

  const isMyTurn = state?.currentPlayerId === myPlayerId;

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setDiceFace(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count >= 8) {
        clearInterval(interval);
        setRolling(false);
        getSocket().emit("snl_roll");
      }
    }, 80);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalW = COLS * CELL + PAD * 2;
    const totalH = ROWS * CELL + PAD * 2;
    canvas.width = totalW;
    canvas.height = totalH + 60;

    let raf = 0;
    let animT = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      animT += dt;
      const st = stateRef.current;
      ctx.fillStyle = "#0e0b16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!st) { raf = requestAnimationFrame(loop); return; }

      // Detect position changes and start animations
      const anim = animStateRef.current;
      for (const p of st.players ?? []) {
        const curPos = p.position || 0;
        const prevPos = anim.prevPositions[p.id];
        if (prevPos !== undefined && prevPos !== curPos) {
          // Position changed — animate from old to new
          anim.animating[p.id] = {
            from: prevPos,
            to: curPos,
            startTime: now,
            duration: Math.min(1200, 200 + Math.abs(curPos - prevPos) * 40),
          };
        }
        anim.prevPositions[p.id] = curPos;
      }

      // Draw cells
      for (let n = 1; n <= 100; n++) {
        const { x, y } = cellToPos(n);
        const isEven = (Math.floor((n - 1) / COLS)) % 2 === 0;
        const colIdx = isEven ? ((n - 1) % COLS) : (COLS - 1 - ((n - 1) % COLS));
        const rowIdx = Math.floor((n - 1) / COLS);

        const light = (colIdx + rowIdx) % 2 === 0;
        if (n === 1) {
          ctx.fillStyle = "#14532d";
        } else if (n === 100) {
          ctx.fillStyle = "#7c3aed";
        } else {
          ctx.fillStyle = light ? "#1e1b2e" : "#15122a";
        }
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = "#2d2545";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL, CELL);

        ctx.fillStyle = n === 1 ? "#4ade80" : n === 100 ? "#c084fc" : "#6b7280";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(n), x + CELL / 2, y + 10);
      }

      // Draw snakes and ladders
      const sl = st.snakesLadders ?? [];
      for (const entry of sl) {
        const from = cellToPos(entry.from);
        const to = cellToPos(entry.to);
        const fx = from.x + CELL / 2;
        const fy = from.y + CELL / 2;
        const tx = to.x + CELL / 2;
        const ty = to.y + CELL / 2;

        if (entry.type === "snake") {
          drawSnake(ctx, fx, fy, tx, ty, animT);
        } else {
          drawLadder(ctx, fx, fy, tx, ty);
        }
      }

      // highlight current cell
      const currentPlayer = st.players?.find((p: any) => p.id === st.currentPlayerId);
      if (currentPlayer && currentPlayer.position > 0) {
        const cp = cellToPos(currentPlayer.position);
        ctx.strokeStyle = "rgba(251,191,36,0.5)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cp.x - 1, cp.y - 1, CELL + 2, CELL + 2);
      }

      // Draw player tokens with smooth animation
      for (const p of st.players ?? []) {
        const targetPos = p.position || 0;
        if (targetPos <= 0) continue;

        const a = anim.animating[p.id];
        let drawPos = targetPos;

        if (a) {
          const elapsed = now - a.startTime;
          const progress = Math.min(1, elapsed / a.duration);
          const eased = easeInOut(progress);

          // Interpolate position along the path step by step
          if (progress < 1) {
            // Calculate current visual position
            const totalSteps = a.to - a.from;
            const currentStep = Math.round(a.from + totalSteps * eased);
            drawPos = Math.max(1, Math.min(100, currentStep));
          } else {
            drawPos = a.to;
            delete anim.animating[p.id];
          }
        }

        const { x, y } = cellToPos(drawPos);
        const cx = x + CELL / 2;
        const cy = y + CELL / 2;
        const color = p.color || "#fff";

        // token shadow
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(cx + 1, cy + 8, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // token circle with glow for current player
        if (p.id === st.currentPlayerId) {
          const pulse = 0.3 + 0.2 * Math.sin(animT * 0.005);
          ctx.fillStyle = `rgba(251,191,36,${pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy - 2, 13, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // initial letter
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.name.charAt(0).toUpperCase(), cx, cy - 2);

        // Player name label
        ctx.fillStyle = color;
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(p.name.slice(0, 5), x + CELL / 2, y + CELL - 4);
      }

      // Draw start and finish icons
      const start = cellToPos(1);
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("START", start.x + CELL / 2, start.y + CELL - 12);

      const end = cellToPos(100);
      ctx.fillStyle = "#c084fc";
      ctx.fillText("FINISH", end.x + CELL / 2, end.y + CELL - 12);

      // dice display
      const diceX = totalW - 80;
      const diceY = totalH + 8;
      const diceSize = 36;
      const face = rolling ? diceFace : (st.dice || 1);

      ctx.fillStyle = "#fff";
      roundRect(ctx, diceX, diceY, diceSize, diceSize, 6);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(face), diceX + diceSize / 2, diceY + diceSize / 2 + 1);

      // Players list below board
      const listY = totalH + 10;
      for (let i = 0; i < (st.players ?? []).length; i++) {
        const p = st.players[i];
        const me = p.id === myPlayerId;
        const current = p.id === st.currentPlayerId;
        ctx.fillStyle = me ? "#fbbf24" : current ? "#22c55e" : "#d8b4fe";
        ctx.font = `${me || current ? "bold " : ""}10px sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(`${p.name}${me ? " *" : ""} → ${p.position}`, PAD + i * 90, listY);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [myPlayerId]);

  const i18n = {
    ar: { title: "Snake & Ladder", roll: "ارمي النرد", turn: "دورك", notTurn: "انتظر...", win: "فاز!" },
    en: { title: "Snake & Ladder", roll: "Roll Dice", turn: "Your turn", notTurn: "Waiting...", win: "wins!" },
  }[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen flex flex-col items-center gap-3 p-4 bg-[#0b0710]">
      <div className="text-white font-bold text-lg">{i18n.title}</div>

      {/* Player info bar */}
      <div className="flex gap-4 flex-wrap justify-center text-sm">
        {(state?.players ?? []).map((p: any) => (
          <div key={p.id} className="flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
            <span className="text-white/80">{p.name}{p.id === myPlayerId ? " *" : ""}</span>
            <span className="text-white/50">{p.position}/100</span>
          </div>
        ))}
      </div>

      <div className="relative" style={{ maxWidth: "92vw" }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-white/10 touch-none"
          style={{ imageRendering: "pixelated", background: "#0e0b16" }}
        />

        {/* Dice overlay during countdown */}
        {state?.phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-fuchsia-300">
            {state.countdownLeft > 0 ? state.countdownLeft : "Go!"}
          </div>
        )}
      </div>

      {/* Roll button */}
      <div className="flex gap-3 flex-wrap justify-center">
        {isMyTurn && state?.phase === "playing" && (
          <button
            onClick={rollDice}
            disabled={rolling}
            className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all text-lg active:scale-95"
          >
            🎲 {i18n.roll}
          </button>
        )}
        {state?.phase === "finished" && (
          <div className="text-fuchsia-300 font-bold text-xl">
            🎉 {state.players?.find((p: any) => p.id === state.winnerId)?.name} {i18n.win}
          </div>
        )}
      </div>

      {/* Last action */}
      {state?.lastAction && (
        <p className="text-white/60 text-xs text-center max-w-md">{state.lastAction}</p>
      )}

      <p className="text-white/40 text-xs text-center max-w-md">
        {isAr
          ? "ارمي النرد والتسلق على الدرجات! اهرب من الأفعى! الأول الذي يصل 100 يفوز!"
          : "Roll the dice, climb ladders, dodge snakes! First to reach 100 wins!"}
      </p>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
