import { useRef, useEffect, useState } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";
import WinOverlay from "./WinOverlay";

const COLS = 10;
const ROWS = 10;
const CELL = 50;
const PAD = 20;

// Token hop-animation tuning — mirrors Rento's tile-by-tile hop + arc mechanism:
// normal dice movement hops one tile at a time with a small arc, while landing on
// a ladder/snake plays one bigger single-arc "leap" from the landing tile to the
// ladder top / snake tail, distinct from the regular hops.
const STEP_MS = 140;
const JUMP_MS_LADDER = 550;
const JUMP_MS_SNAKE = 420;
const ARC_STEP = 14;
const ARC_LADDER = 40;
const ARC_SNAKE = 16;

interface SnlAnim {
  from: number;
  mid: number;
  to: number;
  start: number;
  stepDistance: number;
  hasJump: boolean;
  jumpKind: "ladder" | "snake" | null;
}

function cellToPos(n: number): { x: number; y: number } {
  const idx = n - 1;
  const row = Math.floor(idx / COLS);
  const col = row % 2 === 0 ? (idx % COLS) : (COLS - 1 - (idx % COLS));
  const y = (ROWS - 1 - row);
  return { x: PAD + col * CELL, y: PAD + y * CELL };
}

function drawSnake(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number, t: number) {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const amp = 20 + 15 * Math.sin(t * 0.002 + fx * 0.1);

  const grad = ctx.createLinearGradient(fx, fy, tx, ty);
  grad.addColorStop(0, "#f87171");
  grad.addColorStop(0.5, "#b91c1c");
  grad.addColorStop(1, "#7f1d1d");

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 5;
  ctx.strokeStyle = grad;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  const steps = 24;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const x = fx + dx * p + nx * amp * Math.sin(p * Math.PI * 4);
    const y = fy + dy * p + ny * amp * Math.sin(p * Math.PI * 4);
    points.push({ x, y });
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // scale pattern — small dark ellipses along the body
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 2; i < points.length - 2; i += 3) {
    const pt = points[i];
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, 3, 2, (Math.atan2(dy, dx) || 0), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // snake head
  const hx = fx + dx * 0.95 + nx * amp * Math.sin(0.95 * Math.PI * 4);
  const hy = fy + dy * 0.95 + ny * amp * Math.sin(0.95 * Math.PI * 4);
  ctx.fillStyle = "#b91c1c";
  ctx.beginPath();
  ctx.arc(hx, hy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(hx - 3, hy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + 3, hy - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(hx - 3, hy - 2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + 3, hy - 2, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // flicking tongue
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 1.2;
  const tongueLen = 6 + 2 * Math.sin(t * 0.006);
  ctx.beginPath();
  ctx.moveTo(hx + (dx / len) * 9, hy + (dy / len) * 9);
  ctx.lineTo(hx + (dx / len) * (9 + tongueLen), hy + (dy / len) * (9 + tongueLen));
  ctx.stroke();
}

function drawLadder(ctx: CanvasRenderingContext2D, fx: number, fy: number, tx: number, ty: number) {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = (-dy / len) * 8;
  const ny = (dx / len) * 8;

  const woodGrad = ctx.createLinearGradient(fx, fy, tx, ty);
  woodGrad.addColorStop(0, "#a3e635");
  woodGrad.addColorStop(0.5, "#65a30d");
  woodGrad.addColorStop(1, "#3f6212");

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = woodGrad;
  ctx.lineWidth = 4;
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
  ctx.shadowBlur = 0;

  // rungs
  const rungs = 6;
  ctx.strokeStyle = "#84cc16";
  ctx.lineWidth = 3;
  for (let i = 1; i < rungs; i++) {
    const p = i / rungs;
    const rx = fx + dx * p;
    const ry = fy + dy * p;
    ctx.beginPath();
    ctx.moveTo(rx - nx, ry - ny);
    ctx.lineTo(rx + nx, ry + ny);
    ctx.stroke();
  }
  ctx.restore();
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

  // Track player movement so the board can animate tile-by-tile hops (+ a bigger
  // single-arc leap for ladder climbs/snake slides) instead of snapping tokens.
  const prevPosRef = useRef<Record<string, number>>({});
  const animRef = useRef<Record<string, SnlAnim>>({});
  useEffect(() => {
    if (!state?.players) return;
    const dice = state.dice || 0;
    const sl = state.snakesLadders ?? [];
    for (const p of state.players) {
      const prev = prevPosRef.current[p.id];
      const cur = p.position || 0;
      if (prev !== undefined && prev !== cur && prev > 0 && dice > 0) {
        const mid = Math.min(100, prev + dice);
        const entry = sl.find((e: any) => e.from === mid);
        animRef.current[p.id] = {
          from: prev,
          mid,
          to: cur,
          start: performance.now(),
          stepDistance: Math.max(1, mid - prev),
          hasJump: !!entry && mid !== cur,
          jumpKind: entry ? entry.type : null,
        };
      }
      prevPosRef.current[p.id] = cur;
    }
  }, [state?.players, state?.dice, state?.snakesLadders]);

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

      // Draw cells with subtle gradients per cell type
      for (let n = 1; n <= 100; n++) {
        const { x, y } = cellToPos(n);
        const isEven = (Math.floor((n - 1) / COLS)) % 2 === 0;
        const colIdx = isEven ? ((n - 1) % COLS) : (COLS - 1 - ((n - 1) % COLS));
        const rowIdx = Math.floor((n - 1) / COLS);

        const light = (colIdx + rowIdx) % 2 === 0;
        const cellGrad = ctx.createLinearGradient(x, y, x, y + CELL);
        if (n === 1) {
          cellGrad.addColorStop(0, "#22c55e");
          cellGrad.addColorStop(1, "#14532d");
        } else if (n === 100) {
          cellGrad.addColorStop(0, "#a855f7");
          cellGrad.addColorStop(1, "#581c87");
        } else if (light) {
          cellGrad.addColorStop(0, "#242038");
          cellGrad.addColorStop(1, "#1a1729");
        } else {
          cellGrad.addColorStop(0, "#1a1730");
          cellGrad.addColorStop(1, "#120f22");
        }
        ctx.fillStyle = cellGrad;
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = "#2d2545";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL, CELL);

        ctx.fillStyle = n === 1 ? "#4ade80" : n === 100 ? "#e9d5ff" : "#6b7280";
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

      // Draw player tokens — tile-by-tile hop with a parabolic arc + squash/stretch,
      // and a bigger single-arc leap when a ladder/snake teleport kicks in.
      for (const p of st.players ?? []) {
        const targetPos = p.position || 0;
        if (targetPos <= 0) continue;

        const anim = animRef.current[p.id];
        let cx: number, cy: number;
        let jumpY = 0, scaleX = 1, scaleY = 1;
        let labelX: number, labelY: number;

        if (anim) {
          const stepDuration = anim.stepDistance * STEP_MS;
          const jumpDuration = anim.jumpKind === "snake" ? JUMP_MS_SNAKE : JUMP_MS_LADDER;
          const totalDuration = stepDuration + (anim.hasJump ? jumpDuration : 0);
          const elapsed = now - anim.start;

          if (elapsed >= totalDuration) {
            delete animRef.current[p.id];
            const final = cellToPos(anim.to);
            cx = final.x + CELL / 2;
            cy = final.y + CELL / 2;
            labelX = final.x + CELL / 2;
            labelY = final.y + CELL - 4;
          } else if (elapsed < stepDuration) {
            const progress = elapsed / stepDuration;
            const stepFloat = progress * anim.stepDistance;
            const stepIdx = Math.min(anim.stepDistance - 1, Math.floor(stepFloat));
            const t = stepFloat - stepIdx;
            const a = cellToPos(anim.from + stepIdx);
            const b = cellToPos(Math.min(anim.mid, anim.from + stepIdx + 1));
            const ax = a.x + CELL / 2, ay = a.y + CELL / 2;
            const bx = b.x + CELL / 2, by = b.y + CELL / 2;
            cx = ax + (bx - ax) * t;
            cy = ay + (by - ay) * t;
            jumpY = -ARC_STEP * Math.sin(t * Math.PI);
            scaleY = 1 + 0.22 * Math.sin(t * Math.PI);
            scaleX = 1 - 0.14 * Math.sin(t * Math.PI);
            labelX = bx; labelY = by + CELL / 2 - 4;
          } else {
            const t = (elapsed - stepDuration) / jumpDuration;
            const a = cellToPos(anim.mid);
            const b = cellToPos(anim.to);
            const ax = a.x + CELL / 2, ay = a.y + CELL / 2;
            const bx = b.x + CELL / 2, by = b.y + CELL / 2;
            cx = ax + (bx - ax) * t;
            cy = ay + (by - ay) * t;
            const arcH = anim.jumpKind === "snake" ? ARC_SNAKE : ARC_LADDER;
            jumpY = -arcH * Math.sin(t * Math.PI);
            const stretch = anim.jumpKind === "snake" ? 0.14 : 0.3;
            scaleY = 1 + stretch * Math.sin(t * Math.PI);
            scaleX = 1 - stretch * 0.6 * Math.sin(t * Math.PI);
            labelX = bx; labelY = by + CELL / 2 - 4;
          }
        } else {
          const final = cellToPos(targetPos);
          cx = final.x + CELL / 2;
          cy = final.y + CELL / 2;
          labelX = final.x + CELL / 2;
          labelY = final.y + CELL - 4;
        }

        const color = p.color || "#fff";
        const tx = cx;
        const ty = cy + jumpY;

        // contact shadow — shrinks while airborne, for a sense of weight
        const shadowScale = 1 - Math.min(0.55, Math.abs(jumpY) / 55);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(cx + 1, cy + 10, 9 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // token circle with glow for current player
        if (p.id === st.currentPlayerId) {
          const pulse = 0.3 + 0.2 * Math.sin(animT * 0.005);
          ctx.fillStyle = `rgba(251,191,36,${pulse})`;
          ctx.beginPath();
          ctx.arc(tx, ty - 2, 13, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        ctx.translate(tx, ty - 2);
        ctx.scale(scaleX, scaleY);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // initial letter
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.name.charAt(0).toUpperCase(), 0, 0);
        ctx.restore();

        // Player name label
        ctx.fillStyle = color;
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(p.name.slice(0, 5), labelX, labelY);
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

        {state?.phase === "finished" && (() => {
          const winner = state.players?.find((p: any) => p.id === state.winnerId);
          return (
            <WinOverlay
              winnerName={winner?.name ?? "?"}
              color={winner?.color}
              subtitle={i18n.win}
            />
          );
        })()}
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
