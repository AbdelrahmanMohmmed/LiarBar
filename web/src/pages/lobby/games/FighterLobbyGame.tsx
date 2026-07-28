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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

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

    // Parry is automatic — no key needed. L is removed.
    const held = { left: false, right: false, jump: false, attack1: false, attack2: false, special: false };
    const send = () => socket.emit("fighter_input", { ...held, parry: false });

    const keyMap: Record<string, keyof typeof held> = {
      a: "left", d: "right", w: "jump", j: "attack1", k: "attack2", u: "special",
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
    const particles: Particle[] = [];
    let flashT = 0;
    let screenShake = 0;
    let lastTime = performance.now();

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

      // Special meter
      if (typeof f.special === "number") {
        const mw = 200;
        const bx = flip ? x + w - mw : x;
        const mratio = Math.max(0, Math.min(1, f.special / 100));
        const full = mratio >= 1;

        ctx.fillStyle = "#1f2937";
        roundRect(ctx, bx, y + 92, mw, 14, 4); ctx.fill();

        if (full) {
          const pulse = 0.6 + 0.4 * Math.sin(flashT * 0.008);
          ctx.fillStyle = `rgba(244,114,182,${pulse})`;
          roundRect(ctx, bx - 2, y + 90, mw + 4, 18, 5); ctx.fill();
        }

        ctx.fillStyle = full ? "#f472b6" : "#a78bfa";
        roundRect(ctx, bx, y + 92, mw * mratio, 14, 4); ctx.fill();

        ctx.fillStyle = full ? "#fbb" : "#ddd6fe";
        ctx.font = "bold 11px 'Baloo 2', sans-serif";
        ctx.textAlign = flip ? "right" : "left";
        const label = full
          ? (isAr ? "✨ خاص جاهز! اضغط U" : "✨ SPECIAL READY! Press U")
          : (isAr ? "خاص" : "SPECIAL");
        ctx.fillText(label, bx, y + 120);

        // Block stamina bar
        const sw = 160;
        const sx = flip ? x + w - sw : x;
        const sRatio = Math.max(0, Math.min(1, (f.parryStamina ?? 100) / 100));
        const lowStam = sRatio < 0.3;

        ctx.fillStyle = "#1f2937";
        roundRect(ctx, sx, y + 124, sw, 10, 3); ctx.fill();

        if (lowStam) {
          const pulse = 0.6 + 0.4 * Math.sin(flashT * 0.015);
          ctx.fillStyle = `rgba(239,68,68,${pulse})`;
          roundRect(ctx, sx - 1, y + 123, sw + 2, 12, 4); ctx.fill();
        }

        ctx.fillStyle = lowStam ? "#ef4444" : sRatio < 0.6 ? "#eab308" : "#22c55e";
        roundRect(ctx, sx, y + 124, sw * sRatio, 10, 3); ctx.fill();

        ctx.fillStyle = "#d1d5db";
        ctx.font = "bold 8px 'Baloo 2', sans-serif";
        ctx.textAlign = flip ? "right" : "left";
        ctx.fillText(isAr ? "صد" : "BLOCK", sx, y + 146);
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(50, now - lastTime);
      lastTime = now;
      const st = stateRef.current;
      frameT += dt;
      flashT += dt;

      // Screen shake
      if (screenShake > 0) {
        screenShake -= dt;
        const intensity = Math.max(0, screenShake / 300);
        ctx.save();
        ctx.translate(
          (Math.random() - 0.5) * intensity * 12,
          (Math.random() - 0.5) * intensity * 12
        );
      }

      if (bg.width) ctx.drawImage(bg, 0, 0, W, H);
      else { ctx.fillStyle = "#1a1030"; ctx.fillRect(0, 0, W, H); }

      // Theme overlay
      const theme = st?.theme || "default";
      if (theme === "night") {
        ctx.fillStyle = "rgba(10,10,40,0.45)";
        ctx.fillRect(0, 0, W, H);
      } else if (theme === "sunset") {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(255,100,50,0.2)");
        grad.addColorStop(0.5, "rgba(255,50,100,0.1)");
        grad.addColorStop(1, "rgba(80,20,80,0.3)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      } else if (theme === "cyber") {
        ctx.fillStyle = "rgba(80,0,120,0.2)";
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(0,255,150,${0.08 + 0.04 * Math.sin(flashT * 0.003)})`;
        ctx.lineWidth = 1;
        for (let gy = 0; gy < H; gy += 40) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(W, gy);
          ctx.stroke();
        }
      }

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
        const dir = f.facing || 1;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + 4, 45, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Special attack radial effect
        if (f.action === "special" || (f.specialFlash ?? 0) > 0) {
          const flashProg = (f.specialFlash ?? 0) / 14;
          const radius = 80 + (1 - flashProg) * 100;

          const grad = ctx.createRadialGradient(f.x + dir * 60, f.y - 80, 10, f.x + dir * 60, f.y - 80, radius);
          grad.addColorStop(0, `rgba(255,50,150,${0.6 * flashProg})`);
          grad.addColorStop(0.4, `rgba(255,100,50,${0.35 * flashProg})`);
          grad.addColorStop(1, "rgba(255,200,50,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x + dir * 60, f.y - 80, radius, 0, Math.PI * 2);
          ctx.fill();

          // Shockwave rings
          ctx.strokeStyle = `rgba(255,200,50,${0.5 * flashProg})`;
          ctx.lineWidth = 3;
          for (let r = 30; r < radius; r += 25) {
            ctx.beginPath();
            ctx.arc(f.x + dir * 60, f.y - 80, r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Rotating particles
          ctx.save();
          ctx.translate(f.x + dir * 60, f.y - 80);
          ctx.rotate(flashT * 0.01);
          ctx.fillStyle = `rgba(255,255,255,${0.5 * flashProg})`;
          for (let j = 0; j < 8; j++) {
            const a = (j / 8) * Math.PI * 2;
            const sx = Math.cos(a) * radius * 0.7;
            const sy = Math.sin(a) * radius * 0.7;
            ctx.fillRect(sx - 4, sy - 4, 8, 8);
          }
          ctx.restore();
        }

        // Parry deflected flash - only when enemy attacks and gets blocked
        if ((f.parryFlash ?? 0) > 0) {
          const t = f.parryFlash / 14;

          // Shield effect during deflection
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.scale(dir, 1);

          const glowGrad = ctx.createRadialGradient(30, -90, 5, 30, -90, 80);
          glowGrad.addColorStop(0, `rgba(100,200,255,${0.5 * t})`);
          glowGrad.addColorStop(1, "rgba(100,200,255,0)");
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(30, -90, 80, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(100,220,255,${0.95 * t})`;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(40, -85, 65, -Math.PI / 2.5, Math.PI / 2.5);
          ctx.stroke();

          ctx.strokeStyle = `rgba(200,240,255,${0.7 * t})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(40, -85, 50, -Math.PI / 2.5, Math.PI / 2.5);
          ctx.stroke();

          ctx.restore();

          // Flash text
          ctx.fillStyle = `rgba(100,220,255,${t})`;
          ctx.font = "bold 36px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(isAr ? "صد!" : "PARRY!", f.x + dir * 60, f.y - 120 - (1 - t) * 20);

          ctx.strokeStyle = `rgba(100,220,255,${t * 0.6})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(f.x, f.y - 80, 40 + (1 - t) * 60, 0, Math.PI * 2);
          ctx.stroke();

          // Sparks during deflection
          if (Math.random() < 0.5) {
            particles.push({
              x: f.x + dir * 50,
              y: f.y - 80 + (Math.random() - 0.5) * 60,
              vx: dir * (2 + Math.random() * 4),
              vy: -3 + Math.random() * 5,
              life: 18,
              maxLife: 18,
              color: "#64d8ff",
              size: 2 + Math.random() * 4,
            });
          }
        }

        // Kick attack trail
        if (f.action === "kick") {
          ctx.strokeStyle = "rgba(251,146,60,0.9)";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(f.x + dir * 30, f.y - 45);
          ctx.lineTo(f.x + dir * 115, f.y - 45);
          ctx.stroke();
        }

        // Parry deflected flash text
        if ((f.parryFlash ?? 0) > 0) {
          const t = f.parryFlash / 14;
          ctx.fillStyle = `rgba(100,220,255,${t})`;
          ctx.font = "bold 36px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(isAr ? "صد!" : "PARRY!", f.x + dir * 60, f.y - 120 - (1 - t) * 20);

          // Flash ring
          ctx.strokeStyle = `rgba(100,220,255,${t * 0.6})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(f.x, f.y - 80, 40 + (1 - t) * 60, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Special flash text
        if ((f.specialFlash ?? 0) > 0) {
          const t = f.specialFlash / 14;
          ctx.fillStyle = `rgba(255,100,200,${t})`;
          ctx.font = "bold 42px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(isAr ? "خاص!" : "SPECIAL!", f.x, f.y - 150 - (1 - t) * 30);

          ctx.strokeStyle = `rgba(255,100,200,${t * 0.5})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(f.x, f.y - 80, 30 + (1 - t) * 100, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Sprite
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.facing, 1);
        if (sheet.width) ctx.drawImage(sheet, fx, fy, tile, tile, -dw / 2, -dh, dw, dh);
        else { ctx.fillStyle = f.color; ctx.fillRect(-35, -150, 70, 150); }
        ctx.restore();

        // Hit sparks
        if (f.action === "hit") {
          for (let j = 0; j < 2; j++) {
            particles.push({
              x: f.x + (Math.random() - 0.5) * 40,
              y: f.y - 60 - Math.random() * 80,
              vx: (Math.random() - 0.5) * 6,
              vy: -3 - Math.random() * 4,
              life: 18,
              maxLife: 18,
              color: "#facc15",
              size: 2 + Math.random() * 4,
            });
          }
          // Screen shake on hit
          screenShake = Math.max(screenShake, 200);
        }
      });

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 1;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Health bars (fixed positions)
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

      if (screenShake > 0) ctx.restore();

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
    ar: { controls: "تحرك: A/D • قفز: W • يد: J • ركل: K • صد تلقائي عند التراجع (يخزن طاقة) • خاص: U", spectate: "أنت تُشاهد (أضف لاعبًا ثانيًا للعب)" },
    en: { controls: "Move: A/D • Jump: W • Hand: J • Kick: K • Walk away to block (uses stamina) • Special: U", spectate: "You are spectating (add a 2nd player to fight)" },
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
