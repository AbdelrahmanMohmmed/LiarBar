import { useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

export default function SnakeLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const socket = getSocket();
    const send = (dir: string) => socket.emit("snake_set_dir", { dir });
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, string> = {
        arrowup: "up", w: "up", arrowdown: "down", s: "down",
        arrowleft: "left", a: "left", arrowright: "right", d: "right",
      };
      if (map[k]) { e.preventDefault(); send(map[k]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cols = state.cols, rows = state.rows;
    const cell = 20;
    canvas.width = cols * cell;
    canvas.height = rows * cell;

    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let i = 1; i < cols; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke();
    }

    // food (with pulse)
    const pulse = 1 + 0.15 * Math.sin(Date.now() * 0.006);
    const foodR = (cell / 2 - 2) * pulse;
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.arc(state.food.x * cell + cell / 2, state.food.y * cell + cell / 2, foodR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,77,77,0.25)";
    ctx.beginPath();
    ctx.arc(state.food.x * cell + cell / 2, state.food.y * cell + cell / 2, foodR + 4, 0, Math.PI * 2);
    ctx.fill();

    // snakes
    for (const s of state.snakes) {
      s.body.forEach((c: any, i: number) => {
        if (i === 0) {
          // head with eyes
          const cx = c.x * cell + cell / 2;
          const cy = c.y * cell + cell / 2;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(cx, cy, cell / 2 - 1, 0, Math.PI * 2);
          ctx.fill();

          const dirObj = s.dir || { x: 0, y: 1 };
          let d = "down";
          if (dirObj.x === 0 && dirObj.y === -1) d = "up";
          else if (dirObj.x === 0 && dirObj.y === 1) d = "down";
          else if (dirObj.x === -1 && dirObj.y === 0) d = "left";
          else if (dirObj.x === 1 && dirObj.y === 0) d = "right";
          const off = 3;
          let e1x: number, e1y: number, e2x: number, e2y: number;
          if (d === "up") { e1x = cx - off; e1y = cy - off; e2x = cx + off; e2y = cy - off; }
          else if (d === "down") { e1x = cx - off; e1y = cy + off; e2x = cx + off; e2y = cy + off; }
          else if (d === "left") { e1x = cx - off; e1y = cy - off; e2x = cx - off; e2y = cy + off; }
          else { e1x = cx + off; e1y = cy - off; e2x = cx + off; e2y = cy + off; }
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(e1x, e1y, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e2x, e2y, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#111";
          ctx.beginPath(); ctx.arc(e1x, e1y, 1.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(e2x, e2y, 1.2, 0, Math.PI * 2); ctx.fill();
        } else {
          const t = i / Math.max(1, s.body.length - 1);
          ctx.fillStyle = shade(s.color, 1 - t * 0.4);
          const pad = 1;
          ctx.fillRect(c.x * cell + pad, c.y * cell + pad, cell - pad * 2, cell - pad * 2);
        }
      });
      if (!s.alive) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        const h = s.body[0];
        if (h) ctx.fillRect(h.x * cell, h.y * cell, cell, cell);
      }
    }
  }, [state]);

  const i18n = {
    ar: { title: "الأفعى — تنافس", time: "الوقت", you: "أنت", countdown: "ابدأ!", winners: "الفائزون", score: "النقاط" },
    en: { title: "Snake — Battle", time: "Time", you: "You", countdown: "Go!", winners: "Winners", score: "Score" },
  }[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-[#0b0710]">
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {(state?.snakes ?? []).map((s: any) => (
          <div key={s.playerId} className="flex items-center gap-1.5 text-sm" style={{ color: s.color }}>
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-white/80">{s.name}{s.playerId === myPlayerId ? ` (${i18n.you})` : ""}</span>
            <span className="text-white/50">{s.score}</span>
            {!s.alive && <span className="text-red-400">✕</span>}
          </div>
        ))}
        {state?.phase === "playing" && (
          <div className="text-white font-bold ml-2">{i18n.time}: {state.timeLeft}s</div>
        )}
      </div>

      <div className="relative" style={{ width: 480, maxWidth: "92vw" }}>
        <canvas ref={canvasRef} className="w-full rounded-xl border border-white/10 touch-none" style={{ aspectRatio: "1 / 1", imageRendering: "pixelated", background: "#0a0a12" }} />
        {state?.phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-fuchsia-300">
            {state.countdownLeft > 0 ? state.countdownLeft : i18n.countdown}
          </div>
        )}
        {state?.phase === "finished" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 rounded-xl">
            <div className="text-2xl font-bold text-fuchsia-300">{i18n.winners}</div>
            <div className="text-white">
              {(state.winners ?? []).map((id: string) => {
                const w = state.snakes.find((s: any) => s.playerId === id);
                return w ? w.name : "";
              }).join(", ")}
            </div>
          </div>
        )}
      </div>
      <p className="text-white/40 text-xs text-center max-w-md">
        {isAr
          ? "أسهم أو WASD للتحرك. اجعل صديقك يصطدم بجسد أفعاك لقتله! أعلى نقطة عند انتهاء الوقت يفوز."
          : "Arrows / WASD to move. Make a friend crash into your body to kill them! Highest score when time runs out wins."}
      </p>
    </div>
  );
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
