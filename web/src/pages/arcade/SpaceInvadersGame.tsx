import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const W = 480;
const H = 720;

type Phase = "start" | "playing" | "over";
type ShipType = "trainer" | "beetle";

interface Bullet { x: number; y: number; vy: number; color: string; w: number; h: number; }
interface Enemy { x: number; y: number; hp: number; maxHp: number; }
interface Boss { x: number; y: number; hp: number; maxHp: number; vx: number; }

export default function SpaceInvadersGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [score, setScore] = useState(0);
  const [shipType, setShipType] = useState<ShipType>("trainer");

  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const shipRef = useRef(shipType);
  phaseRef.current = phase;
  scoreRef.current = score;
  shipRef.current = shipType;
  const keysRef = useRef(new Set<string>());

  const start = () => setPhase("playing");
  const restart = () => { setScore(0); setPhase("playing"); };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = keysRef.current;
    const pointer = { x: W / 2, y: H - 80, active: false };

    const IMG = (src: string) => { const i = new Image(); i.src = src; return i; };
    const trainerImg = IMG("/arcade-assets/space-invaders/graphics/ships/trainer.png");
    const beetleImg = IMG("/arcade-assets/space-invaders/graphics/ships/beetle.png");
    const enemyImg = IMG("/arcade-assets/space-invaders/graphics/ships/enemy1.png");
    const bossImg = IMG("/arcade-assets/space-invaders/graphics/ships/boss.png");
    const blueBullet = IMG("/arcade-assets/space-invaders/graphics/bullets/blue_bullet.png");
    const redBullet = IMG("/arcade-assets/space-invaders/graphics/bullets/red_bullet.png");

    const state = {
      ship: { x: W / 2, y: H - 80, w: 54, h: 50, hp: 200, maxHp: 200 },
      pBullets: [] as Bullet[],
      eBullets: [] as Bullet[],
      enemies: [] as Enemy[],
      boss: null as Boss | null,
      spawnT: 0,
      eFireT: 0,
      pFireT: 0,
      bossSpawned: false,
      bgScroll: 0,
    };

    const reset = () => {
      state.ship = { x: W / 2, y: H - 80, w: 54, h: 50, hp: 200, maxHp: 200 };
      state.pBullets = []; state.eBullets = []; state.enemies = [];
      state.boss = null; state.spawnT = 0; state.eFireT = 0; state.pFireT = 0;
      state.bossSpawned = false;
    };

    const spawnEnemy = () => {
      const size = 56;
      state.enemies.push({ x: 20 + Math.random() * (W - 40 - size), y: -size, hp: 60, maxHp: 60 });
    };

    const loop = (now: number) => {
      const dt = Math.min(50, now - (loop as any)._last || 16);
      (loop as any)._last = now;
      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, W, H);

      // starfield
      state.bgScroll = (state.bgScroll + 0.4) % 40;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 97) % W;
        const sy = ((i * 53) % H + state.bgScroll) % H;
        ctx.fillRect(sx, sy, 2, 2);
      }

      if (phaseRef.current === "start") {
        drawTitle(ctx, isAr);
      } else if (phaseRef.current === "over") {
        drawShip(ctx, state.ship, shipRef.current, shipRef.current === "beetle" ? beetleImg : trainerImg);
        drawText(ctx, isAr ? "انتهت اللعبة" : "GAME OVER", W / 2, H / 2, 46, "#ff4d4d");
      } else {
        // movement
        const s = state.ship;
        const speed = 6;
        if (keys.has("arrowleft") || keys.has("a")) s.x -= speed;
        if (keys.has("arrowright") || keys.has("d")) s.x += speed;
        if (keys.has("arrowup") || keys.has("w")) s.y -= speed;
        if (keys.has("arrowdown") || keys.has("s")) s.y += speed;
        if (pointer.active) {
          s.x += (pointer.x - s.x) * 0.25;
          s.y += (pointer.y - s.y) * 0.25;
        }
        s.x = Math.max(s.w / 2, Math.min(W - s.w / 2, s.x));
        s.y = Math.max(s.h / 2, Math.min(H - s.h / 2, s.y));

        // player fire
        state.pFireT += dt;
        const fireRate = 420;
        if (state.pFireT >= fireRate) {
          state.pFireT = 0;
          if (shipRef.current === "beetle") {
            state.pBullets.push(mkBullet(s.x - 14, s.y - 24, -7, "#67e8f9"));
            state.pBullets.push(mkBullet(s.x + 14, s.y - 24, -7, "#67e8f9"));
          } else {
            state.pBullets.push(mkBullet(s.x, s.y - 24, -7, "#67e8f9"));
          }
        }

        // enemy spawn
        state.spawnT += dt;
        if (state.spawnT >= 1400) { state.spawnT = 0; spawnEnemy(); }

        // boss
        if (!state.bossSpawned && scoreRef.current >= 300) {
          state.bossSpawned = true;
          state.boss = { x: W / 2 - 60, y: 60, hp: 600, maxHp: 600, vx: 2.4 };
        }

        // player bullets
        state.pBullets = state.pBullets.filter((b) => {
          b.y += b.vy * (dt / 16.67);
          if (b.y < -20) return false;
          for (const e of state.enemies) {
            if (hit(b, e.x, e.y, 56, 56)) {
              e.hp -= 20;
              return false;
            }
          }
          if (state.boss && hit(b, state.boss.x, state.boss.y, 120, 80)) {
            state.boss.hp -= 20;
            if (state.boss.hp <= 0) {
              state.boss = null;
              addScore(250, setScore, scoreRef);
            }
            return false;
          }
          return true;
        });

        // enemies move + fire
        state.eFireT += dt;
        const fire = state.eFireT >= 1100;
        if (fire) state.eFireT = 0;
        state.enemies = state.enemies.filter((e) => {
          e.y += 2.2 * (dt / 16.67);
          if (fire) state.eBullets.push(mkBullet(e.x + 28, e.y + 50, 5, "#ff5470"));
          if (e.y > H) { s.hp -= 15; return false; }
          if (e.hp <= 0) { addScore(10, setScore, scoreRef); return false; }
          return true;
        });

        // boss move + fire
        if (state.boss) {
          const bo = state.boss;
          bo.x += bo.vx * (dt / 16.67);
          if (bo.x < 10 || bo.x > W - 130) bo.vx *= -1;
          if (fire) {
            state.eBullets.push(mkBullet(bo.x + 20, bo.y + 70, 5, "#ff5470"));
            state.eBullets.push(mkBullet(bo.x + 100, bo.y + 70, 5, "#ff5470"));
          }
        } else if (fire) {
          // ensure occasional fire even without enemies
        }

        // enemy bullets
        state.eBullets = state.eBullets.filter((b) => {
          b.y += b.vy * (dt / 16.67);
          if (b.y > H + 20) return false;
          if (hit(b, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h)) {
            s.hp -= 10;
            if (s.hp <= 0) { s.hp = 0; setPhase("over"); }
            return false;
          }
          return true;
        });

        // draw
        for (const e of state.enemies) drawEnemy(ctx, e, enemyImg);
        if (state.boss) drawBoss(ctx, state.boss, bossImg);
        for (const b of state.pBullets) drawBullet(ctx, b, blueBullet);
        for (const b of state.eBullets) drawBullet(ctx, b, redBullet);
        drawShip(ctx, s, shipRef.current, shipRef.current === "beetle" ? beetleImg : trainerImg);
        drawHud(ctx, scoreRef.current, s.hp, s.maxHp, isAr);
      }

      raf = requestAnimationFrame(loop);
    };

    let raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (phaseRef.current === "start") {
        if (k === "arrowleft") setShipType("trainer");
        if (k === "arrowright") setShipType("beetle");
        if (k === " " || k === "enter" || k === "p") { e.preventDefault(); reset(); setScore(0); start(); }
        return;
      }
      if (phaseRef.current === "over") {
        if (k === " " || k === "enter" || k === "p") { e.preventDefault(); reset(); setScore(0); start(); }
        return;
      }
      keysRef.current.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * W;
      pointer.y = ((e.clientY - rect.top) / rect.height) * H;
      pointer.active = true;
    };
    const onLeave = () => { pointer.active = false; };
    const onDown = () => {
      if (phaseRef.current !== "playing") { reset(); setScore(0); start(); }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [isAr]);

  const i18n = {
    ar: {
      sub: "غزاة الفضاء",
      play: "ابدأ",
      again: "إعادة (مسافة)",
      score: "النقاط",
      select: "اختر السفينة: ← / →",
      trainer: "المدرّب (طلقة واحدة)",
      beetle: "الخنفساء (طلقتان)",
    },
    en: {
      sub: "Space Invaders",
      play: "Play",
      again: "Restart (Space)",
      score: "Score",
      select: "Pick ship: ← / →",
      trainer: "Trainer (single shot)",
      beetle: "Beetle (double shot)",
    },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={`${i18n.score}: ${score}`}>
      <div className="relative w-full" style={{ maxWidth: 460 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-xl border border-white/10 touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 rounded-xl text-center px-6">
            {phase === "start" ? (
              <>
                <div className="text-2xl font-extrabold">{i18n.sub}</div>
                <div className="text-white/70 text-sm">{i18n.select}</div>
                <div className="text-fuchsia-300 text-lg font-semibold">
                  {shipType === "trainer" ? i18n.trainer : i18n.beetle}
                </div>
                <button
                  onClick={restart}
                  className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-semibold transition-all"
                >
                  {i18n.play}
                </button>
              </>
            ) : (
              <>
                <div className="text-3xl font-extrabold text-rose-400">{i18n.sub}</div>
                <div className="text-fuchsia-300">{i18n.score}: {score}</div>
                <button
                  onClick={restart}
                  className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-semibold transition-all"
                >
                  {i18n.again}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </ArcadeShell>
  );
}

function mkBullet(x: number, y: number, vy: number, color: string): Bullet {
  return { x, y, vy, color, w: 6, h: 18 };
}
function hit(b: Bullet, x: number, y: number, w: number, h: number) {
  return b.x > x && b.x < x + w && b.y > y && b.y < y + h;
}
function addScore(n: number, setScore: (v: number) => void, ref: React.MutableRefObject<number>) {
  const v = ref.current + n;
  ref.current = v;
  setScore(v);
}
function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet, img?: HTMLImageElement) {
  if (img && img.width) {
    ctx.drawImage(img, b.x - b.w / 2, b.y, b.w, b.h);
  } else {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(b.x - b.w / 2, b.y, b.w, 4);
  }
}
function drawShip(ctx: CanvasRenderingContext2D, s: { x: number; y: number; w: number; h: number }, type: ShipType, img?: HTMLImageElement) {
  if (img && img.width) {
    ctx.drawImage(img, s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
  } else {
    ctx.save();
    ctx.translate(s.x, s.y);
    const col = type === "beetle" ? "#a855f7" : "#22d3ee";
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -s.h / 2);
    ctx.lineTo(s.w / 2, s.h / 2);
    ctx.lineTo(s.w / 4, s.h / 2);
    ctx.lineTo(0, s.h / 4);
    ctx.lineTo(-s.w / 4, s.h / 2);
    ctx.lineTo(-s.w / 2, s.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0e0b16";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, img?: HTMLImageElement) {
  if (img && img.width) {
    ctx.drawImage(img, e.x, e.y, 56, 56);
  } else {
    ctx.save();
    ctx.translate(e.x + 28, e.y + 28);
    ctx.fillStyle = "#7CFC00";
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.ellipse(0, 6, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.arc(-9, -4, 4, 0, Math.PI * 2);
    ctx.arc(9, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // hp bar
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(e.x, e.y - 6, 56, 4);
  ctx.fillStyle = "#84cc16";
  ctx.fillRect(e.x, e.y - 6, 56 * (e.hp / e.maxHp), 4);
}
function drawBoss(ctx: CanvasRenderingContext2D, b: Boss, img?: HTMLImageElement) {
  if (img && img.width) {
    ctx.drawImage(img, b.x, b.y, 120, 80);
  } else {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.ellipse(60, 40, 60, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.ellipse(60, 20, 36, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.arc(40, 18, 6, 0, Math.PI * 2);
    ctx.arc(80, 18, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(b.x, b.y - 10, 120, 6);
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(b.x, b.y - 10, 120 * (b.hp / b.maxHp), 6);
}
function drawHud(ctx: CanvasRenderingContext2D, score: number, hp: number, maxHp: number, isAr: boolean) {
  ctx.font = "bold 22px 'Baloo 2', sans-serif";
  ctx.fillStyle = "#fde047";
  ctx.textAlign = "right";
  ctx.fillText(String(score), W - 12, 30);
  // health bar
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(12, 14, 160, 14);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(12, 14, 160 * (hp / maxHp), 14);
}
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `bold ${size}px 'Baloo 2', sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}
function drawTitle(ctx: CanvasRenderingContext2D, isAr: boolean) {
  drawText(ctx, isAr ? "غزاة الفضاء" : "SPACE INVADERS", W / 2, H / 2 - 40, 30, "#67e8f9");
  drawText(ctx, isAr ? "حركة: الماوس أو الأسهم" : "Move: mouse or arrows", W / 2, H / 2 + 10, 16, "rgba(255,255,255,0.6)");
  drawText(ctx, isAr ? "إطلاق تلقائي" : "Auto fire", W / 2, H / 2 + 36, 16, "rgba(255,255,255,0.6)");
}
