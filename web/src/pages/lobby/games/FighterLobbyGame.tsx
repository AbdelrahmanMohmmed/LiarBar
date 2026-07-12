import { useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

const W = 1024;
const H = 720;
const GROUND = H - 100;
const MAX_HP = 160;

const CAT_FRAMES = [4, 2, 4, 6, 1, 4, 4, 6];
const MON_FRAMES = [4, 4, 4, 4, 1, 3, 7, 7];

function loadImage(src: string): HTMLImageElement {
  const i = new Image();
  i.src = src;
  return i;
}

function actionRow(a: string): number {
  switch (a) {
    case "walk": return 1;
    case "kick": return 3;
    case "jump": return 4;
    case "hand": return 4;
    case "special": return 4;
    case "parry": return 4;
    case "hit": return 5;
    case "dead": return 6;
    default: return 0;
  }
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

export default function FighterLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;
  const socket = getSocket();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const cat = loadImage("/arcade-assets/fighter/fighters/cat_fighter_sprite1.png");
    const mon = loadImage("/arcade-assets/fighter/fighters/mon2_sprite_base.png");
    const bg = loadImage("/arcade-assets/fighter/9e0a805a0d4420a555df6741aebffd4b.gif");

    const held = { left: false, right: false, jump: false, attack1: false, attack2: false, parry: false, special: false };
    const send = () => socket.emit("fighter_input", { ...held });
    const myIdx = (stateRef.current?.fighters ?? []).findIndex((f: any) => f.playerId === myPlayerId);

    const keyMap: Record<string, keyof typeof held> = {
      a: "left", d: "right", w: "jump", j: "attack1", k: "attack2", l: "parry", u: "special",
      arrowleft: "left", arrowright: "right", arrowup: "jump",
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keyMap) { e.preventDefault(); if (!held[keyMap[k]]) { held[keyMap[k]] = true; send(); } }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keyMap) { held[keyMap[k]] = false; send(); }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    let raf = 0;
    let frameT = 0;
    const frames: Record<string, number> = {};

    const drawHealth = (f: any, x: number, y: number, flip: boolean, score: number, target: number) => {
      const w = 400;
      const ratio = Math.max(0, f.health / MAX_HP);
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, x - 5, y - 5, w + 10, 35, 6); ctx.fill();
      ctx.fillStyle = "#7f1d1d";
      roundRect(ctx, x, y, w, 25, 4); ctx.fill();
      ctx.fillStyle = "#facc15";
      if (flip) roundRect(ctx, x + w * (1 - ratio), y, w * ratio, 25, 4);
      else roundRect(ctx, x, y, w * ratio, 25, 4);
      ctx.fill();
      ctx.fillStyle = f.color;
      ctx.font = "bold 22px 'Baloo 2', sans-serif";
      ctx.textAlign = flip ? "right" : "left";
      ctx.fillText(`${f.name}${f.playerId === myPlayerId ? (isAr ? " (أنت)" : " (You)") : ""}`, flip ? x + w : x, y + 56);
      ctx.fillStyle = "#e9d5ff";
      ctx.font = "bold 18px 'Baloo 2', sans-serif";
      ctx.fillText(`${isAr ? "فوز" : "Wins"}: ${score}/${target}`, flip ? x + w : x, y + 80);

      if (typeof f.special === "number") {
        const mw = 200;
        const bx = flip ? x + w - mw : x;
        const ratio = Math.max(0, Math.min(1, f.special / 100));
        ctx.fillStyle = "#1f2937";
        roundRect(ctx, bx, y + 92, mw, 9, 4); ctx.fill();
        ctx.fillStyle = ratio >= 1 ? "#f472b6" : "#a78bfa";
        roundRect(ctx, bx, y + 92, mw * ratio, 9, 4); ctx.fill();
        ctx.fillStyle = ratio >= 1 ? "#f9a8d4" : "#ddd6fe";
        ctx.font = "bold 13px 'Baloo 2', sans-serif";
        ctx.textAlign = flip ? "right" : "left";
        ctx.fillText(isAr ? "خاص (U)" : "SPECIAL (U)", bx, y + 113);
      }
    };

    const loop = () => {
      const st = stateRef.current;
      frameT += 16;
      ctx.fillStyle = "#1a1030";
      ctx.fillRect(0, 0, W, H);
      if (bg.width) ctx.drawImage(bg, 0, 0, W, H);
      ctx.fillStyle = "rgba(42,26,74,0.85)";
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, GROUND, W, 4);

      const fs = st?.fighters ?? [];
      fs.forEach((f: any, i: number) => {
        const sheet = i === 0 ? cat : mon;
        const fr = i === 0 ? CAT_FRAMES : MON_FRAMES;
        const tile = i === 0 ? 50 : 60;
        const scale = i === 0 ? 4 : 3;
        const row = actionRow(f.action);
        const count = fr[row] || 1;
        frames[f.playerId] = frames[f.playerId] ?? 0;
        if (frameT > 100) { frameT = 0; frames[f.playerId] = (frames[f.playerId] + 1) % count; }
        const fx = frames[f.playerId] * tile;
        const fy = row * tile;
        const dw = tile * scale;
        const dh = tile * scale;

        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + 4, 45, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.facing, 1);
        if (sheet.width) ctx.drawImage(sheet, fx, fy, tile, tile, -dw / 2, -dh, dw, dh);
        else { ctx.fillStyle = f.color; ctx.fillRect(-35, -150, 70, 150); }
        ctx.restore();

        const dir = f.facing || 1;
        if (f.action === "kick") {
          ctx.strokeStyle = "rgba(251,146,60,0.9)";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(f.x + dir * 30, f.y - 45);
          ctx.lineTo(f.x + dir * 115, f.y - 45);
          ctx.stroke();
        }
        if (f.action === "special" || (f.specialFlash ?? 0) > 0) {
          const grad = ctx.createRadialGradient(f.x, f.y - 80, 10, f.x, f.y - 80, 130);
          grad.addColorStop(0, "rgba(244,114,182,0.55)");
          grad.addColorStop(1, "rgba(244,114,182,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x, f.y - 80, 130, 0, Math.PI * 2);
          ctx.fill();
        }
        if (f.action === "parry") {
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.scale(dir, 1);
          ctx.strokeStyle = f.parryActive ? "rgba(125,211,252,0.95)" : "rgba(148,163,184,0.7)";
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.arc(42, -80, 60, -Math.PI / 2.2, Math.PI / 2.2);
          ctx.stroke();
          ctx.restore();
        }
        if ((f.parryFlash ?? 0) > 0) {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.font = "bold 30px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(isAr ? "صد!" : "PARRY!", f.x + dir * 60, f.y - 110);
        }
      });

      // fixed health bars (arcade style)
      if (fs[0]) drawHealth(fs[0], 20, 30, false, st?.scores?.[fs[0].playerId] ?? 0, st?.winTarget ?? 3);
      if (fs[1]) drawHealth(fs[1], W - 420, 30, true, st?.scores?.[fs[1].playerId] ?? 0, st?.winTarget ?? 3);

      const nameOf = (id: string) => fs.find((f: any) => f.playerId === id)?.name ?? "";

      if (st?.phase === "countdown") {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 160px 'Baloo 2', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(Math.max(1, st.countdownLeft)), W / 2, H / 2 + 50);
      }
      if (st?.phase === "finished" && !st.matchWinner && st.lastRoundWinner) {
        ctx.fillStyle = "#fb7185";
        ctx.font = "bold 64px 'Baloo 2', sans-serif";
        ctx.textAlign = "center";
        const t = st.lastRoundWinner === "draw"
          ? (isAr ? "تعادل!" : "Draw!")
          : (isAr ? `${nameOf(st.lastRoundWinner)} فاز الجولة!` : `${nameOf(st.lastRoundWinner)} wins the round!`);
        ctx.fillText(t, W / 2, H / 2);
      }
      if (st?.phase === "finished" && st.matchWinner) {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 70px 'Baloo 2', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(isAr ? `${nameOf(st.matchWinner)} فاز بالمباراة!` : `${nameOf(st.matchWinner)} wins the match!`, W / 2, H / 2);
        ctx.fillStyle = "#e9d5ff";
        ctx.font = "bold 26px 'Baloo 2', sans-serif";
        ctx.fillText(`${isAr ? "النقاط" : "Score"}: ${(st.scores?.[st.matchWinner] ?? 0)} / ${st.winTarget ?? 3}`, W / 2, H / 2 + 50);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [myPlayerId]);

  const i18n = {
    ar: { controls: "تحرك: A/D • قفز: W • يد: J • ركل: K • صد: L • خاص: U", spectate: "أنت تُشاهد (أضف لاعبًا ثانيًا للعب)" },
    en: { controls: "Move: A/D • Jump: W • Hand: J • Kick: K • Parry: L • Special: U", spectate: "You are spectating (add a 2nd player to fight)" },
  }[isAr ? "ar" : "en"];

  const amFighter = (state?.fighters ?? []).some((f: any) => f.playerId === myPlayerId);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-[#0b0710]">
      <div className="relative w-full" style={{ maxWidth: 900 }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-xl border border-white/10 touch-none" style={{ aspectRatio: `${W} / ${H}` }} />
      </div>
      <p className="text-white/50 text-xs text-center">{amFighter ? i18n.controls : i18n.spectate}</p>
    </div>
  );
}
