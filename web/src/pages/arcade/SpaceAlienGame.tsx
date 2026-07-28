import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const W = 1024;
const H = 720;
const HS_KEY = "arcade_alien_highscore";

type Phase = "start" | "playing" | "story" | "over";

interface Alien { x: number; y: number; alive: boolean; }
interface Bullet { x: number; y: number; vy: number; }

export default function SpaceAlienGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);

  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const highRef = useRef(high);
  const livesRef = useRef(lives);
  const levelRef = useRef(level);
  const keysRef = useRef(new Set<string>());
  phaseRef.current = phase;
  scoreRef.current = score;
  highRef.current = high;
  livesRef.current = lives;
  levelRef.current = level;

  useEffect(() => {
    const stored = Number(localStorage.getItem(HS_KEY) || 0);
    setHigh(stored);
    highRef.current = stored;
  }, []);

  const start = () => setPhase("playing");
  const restart = () => { setScore(0); setLives(3); setLevel(1); setPhase("playing"); };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = keysRef.current;

    const shipImg = new Image();
    shipImg.src = "/arcade-assets/space-alien/image/space-ship.png";
    const ufoImg = new Image();
    ufoImg.src = "/arcade-assets/space-alien/image/ufo.png";

    const ship = { x: W / 2, y: H - 60, w: 54, h: 72 };
    let aliens: Alien[] = [];
    let bullets: Bullet[] = [];
    let mega: { x: number; y: number; h: number } | null = null;
    let dir = 1;
    let alienSpeed = 1;
    let bulletCooldown = 0;
    let megaCooldown = 0;
    let raf = 0;
    let last = performance.now();
    let invuln = 0;

    const cols = 11, rows = 5;
    const aW = 54, aH = 40, gapX = 18, gapY = 24;
    const fleetLeft = 60, fleetTop = 90;

    const createFleet = () => {
      aliens = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          aliens.push({ x: fleetLeft + c * (aW + gapX), y: fleetTop + r * (aH + gapY), alive: true });
        }
      }
    };

    const reset = () => {
      ship.x = W / 2; ship.y = H - 60;
      bullets = []; mega = null; dir = 1; alienSpeed = 1.6 + (levelRef.current - 1) * 0.4;
      bulletCooldown = 0; megaCooldown = 0; invuln = 0;
      createFleet();
    };

    const loseLife = () => {
      const l = livesRef.current - 1;
      livesRef.current = l;
      setLives(l);
      if (l <= 0) { setPhase("over"); }
      else { createFleet(); ship.x = W / 2; invuln = 60; }
    };

    const addScore = (n: number) => {
      const v = scoreRef.current + n;
      scoreRef.current = v;
      setScore(v);
      if (v > highRef.current) { highRef.current = v; setHigh(v); localStorage.setItem(HS_KEY, String(v)); }
    };

    const loop = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      const f = dt / 16.67;

      ctx.fillStyle = "#82e6e6";
      ctx.fillRect(0, 0, W, H);

      if (phaseRef.current === "start") {
        drawTitle(ctx, isAr);
      } else if (phaseRef.current === "story") {
        drawStory(ctx, isAr);
      } else if (phaseRef.current === "over") {
        drawShip(ctx, ship, false, shipImg);
        drawText(ctx, isAr ? "انتهت اللعبة" : "GAME OVER", W / 2, H / 2 - 20, 56, "#b91c1c");
        drawText(ctx, `${isAr ? "النقاط" : "Score"}: ${scoreRef.current}`, W / 2, H / 2 + 40, 30, "#0e0b16");
      } else {
        // ship move
        const sp = 5 * f;
        if (keys.has("arrowleft") || keys.has("a")) ship.x -= sp;
        if (keys.has("arrowright") || keys.has("d")) ship.x += sp;
        if (keys.has("arrowup") || keys.has("w")) ship.y -= sp;
        if (keys.has("arrowdown") || keys.has("s")) ship.y += sp;
        ship.x = Math.max(ship.w / 2, Math.min(W - ship.w / 2, ship.x));
        ship.y = Math.max(H / 2, Math.min(H - ship.h / 2, ship.y));

        if (bulletCooldown > 0) bulletCooldown -= f;
        if (megaCooldown > 0) megaCooldown -= f;
        if (keys.has(" ") && bulletCooldown <= 0 && bullets.length < 6) {
          bullets.push({ x: ship.x, y: ship.y - ship.h / 2, vy: -10 });
          bulletCooldown = 12;
        }
        if ((keys.has("c")) && megaCooldown <= 0) {
          mega = { x: ship.x, y: ship.y - ship.h / 2, h: ship.y };
          megaCooldown = 90;
        }

        // bullets
        bullets = bullets.filter((b) => {
          b.y += b.vy * f;
          if (b.y < -20) return false;
          for (const a of aliens) {
            if (a.alive && b.x > a.x && b.x < a.x + aW && b.y > a.y && b.y < a.y + aH) {
              a.alive = false;
              addScore(50 + (levelRef.current - 1) * 25);
              return false;
            }
          }
          return true;
        });

        // mega beam
        if (mega) {
          mega.h -= 24 * f;
          for (const a of aliens) {
            if (a.alive && Math.abs(a.x + aW / 2 - mega.x) < 60 && a.y < ship.y - mega.h + 40) {
              a.alive = false;
              addScore(50);
            }
          }
          if (mega.h <= 0) mega = null;
        }

        // fleet movement
        let hitEdge = false;
        for (const a of aliens) {
          if (!a.alive) continue;
          if (a.x <= 30 || a.x + aW >= W - 30) hitEdge = true;
        }
        if (hitEdge) {
          dir *= -1;
          for (const a of aliens) if (a.alive) a.y += 24;
        }
        for (const a of aliens) if (a.alive) a.x += alienSpeed * dir * f;

        // collisions with ship / bottom
        if (invuln > 0) invuln -= f;
        let touched = false;
        for (const a of aliens) {
          if (!a.alive) continue;
          if (a.y + aH >= H - 10) { touched = true; break; }
          if (a.x < ship.x + ship.w / 2 && a.x + aW > ship.x - ship.w / 2 &&
              a.y < ship.y + ship.h / 2 && a.y + aH > ship.y - ship.h / 2) {
            touched = true; break;
          }
        }
        if (touched && invuln <= 0) loseLife();

        // level cleared
        if (aliens.every((a) => !a.alive)) {
          const nl = levelRef.current + 1;
          levelRef.current = nl; setLevel(nl);
          alienSpeed = 1.6 + (nl - 1) * 0.4;
          createFleet();
        }

        // draw aliens
        for (const a of aliens) if (a.alive) drawAlien(ctx, a, ufoImg);
        // bullets
        ctx.fillStyle = "#640014";
        for (const b of bullets) ctx.fillRect(b.x - 4, b.y, 8, 15);
        if (mega) {
          ctx.fillStyle = "rgba(100,255,20,0.8)";
          ctx.fillRect(mega.x - 60, mega.h, 120, ship.y - mega.h);
        }
        drawShip(ctx, ship, invuln > 0, shipImg);
        drawHud(ctx, scoreRef.current, livesRef.current, levelRef.current, isAr);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (phaseRef.current === "start") {
        if (k === " " || k === "enter" || k === "p") { e.preventDefault(); reset(); start(); }
        else if (k === "s") setPhase("story");
        return;
      }
      if (phaseRef.current === "story") {
        if (k === "b" || k === "escape" || k === " " || k === "enter") setPhase("start");
        return;
      }
      if (phaseRef.current === "over") {
        if (k === " " || k === "enter" || k === "p") { e.preventDefault(); reset(); start(); }
        return;
      }
      keys.add(k);
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onDown = () => {
      if (phaseRef.current === "start") { reset(); start(); }
      else if (phaseRef.current === "story") setPhase("start");
      else if (phaseRef.current === "over") { reset(); start(); }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [isAr]);

  const i18n = {
    ar: {
      sub: "غزو الفضائيين",
      play: "ابدأ (مسافة)",
      story: "القصة (S)",
      back: "رجوع (B)",
      again: "إعادة (مسافة)",
      score: "النقاط",
      lives: "الحيوات",
      level: "المستوى",
      move: "حركة: الأسهم • إطلاق: مسافة • شعاع: C",
    },
    en: {
      sub: "Alien Fleet",
      play: "Play (Space)",
      story: "Story (S)",
      back: "Back (B)",
      again: "Restart (Space)",
      score: "Score",
      lives: "Lives",
      level: "Level",
      move: "Move: arrows • Fire: Space • Beam: C",
    },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={i18n.move}>
      <div className="relative w-full" style={{ maxWidth: 820 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-xl border border-white/10 touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {/* Mobile touch controls - only show on touch devices */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 sm:hidden animate-fade-in">
          <button
            className="w-20 h-14 rounded-full bg-cyan-600/20 active:bg-cyan-500/30 border border-cyan-500/40 flex items-center justify-center font-bold text-white text-lg"
            onTouchStart={() => keysRef.current.add("arrowleft")}
            onTouchEnd={() => keysRef.current.delete("arrowleft")}
            onMouseDown={() => keysRef.current.add("arrowleft")}
            onMouseUp={() => keysRef.current.delete("arrowleft")}
            onMouseLeave={() => keysRef.current.delete("arrowleft")}
          >
            ←
          </button>
          <div className="flex gap-2 items-center">
            <button
              className="w-20 h-14 rounded-lg bg-emerald-600/20 active:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("arrowleft")}
              onTouchEnd={() => keysRef.current.delete("arrowleft")}
              onMouseDown={() => keysRef.current.add("arrowleft")}
              onMouseUp={() => keysRef.current.delete("arrowleft")}
              onMouseLeave={() => keysRef.current.delete("arrowleft")}
            >
              Left
            </button>
            <button
              className="w-20 h-14 rounded-lg bg-emerald-600/20 active:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("arrowright")}
              onTouchEnd={() => keysRef.current.delete("arrowright")}
              onMouseDown={() => keysRef.current.add("arrowright")}
              onMouseUp={() => keysRef.current.delete("arrowright")}
              onMouseLeave={() => keysRef.current.delete("arrowright")}
            >
              Right
            </button>
            <button
              className="w-20 h-14 rounded-lg bg-rose-600/20 active:bg-rose-500/30 border border-rose-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add(" ")}
              onTouchEnd={() => keysRef.current.delete(" ")}
              onMouseDown={() => keysRef.current.add(" ")}
              onMouseUp={() => keysRef.current.delete(" ")}
              onMouseLeave={() => keysRef.current.delete(" ")}
            >
              Fire
            </button>
            <button
              className="w-20 h-14 rounded-lg bg-violet-600/20 active:bg-violet-500/30 border border-violet-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("c")}
              onTouchEnd={() => keysRef.current.delete("c")}
              onMouseDown={() => keysRef.current.add("c")}
              onMouseUp={() => keysRef.current.delete("c")}
              onMouseLeave={() => keysRef.current.delete("c")}
            >
              Beam
            </button>
          </div>
          <p className="text-xs text-white/60">{i18n.move}</p>
        </div>
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 rounded-xl text-center px-6">
            {phase === "start" ? (
              <>
                <div className="text-3xl font-extrabold">{i18n.sub}</div>
                <button onClick={restart} className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition-all">{i18n.play}</button>
                <button onClick={() => setPhase("story")} className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 font-semibold transition-all">{i18n.story}</button>
              </>
            ) : phase === "story" ? (
              <>
                <div className="text-xl font-bold max-w-md leading-relaxed">
                  {isAr
                    ? "من أعماق المجرة، هبط أسطول غريب ليغزو الأرض. قِد سفينتك الوحيدة وابدأ القصف قبل أن تصلهم الأرض!"
                    : "From deep in the galaxy, a strange fleet descends to invade Earth. Pilot your lone ship and blast them before they reach the ground!"}
                </div>
                <button onClick={() => setPhase("start")} className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition-all">{i18n.back}</button>
              </>
            ) : (
              <>
                <div className="text-3xl font-extrabold text-rose-400">{i18n.sub}</div>
                <div className="text-fuchsia-300">{i18n.score}: {score}</div>
                <button onClick={restart} className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition-all">{i18n.again}</button>
              </>
            )}
          </div>
        )}
      </div>
    </ArcadeShell>
  );
}

function drawShip(ctx: CanvasRenderingContext2D, s: { x: number; y: number; w: number; h: number }, flash: boolean, img?: HTMLImageElement) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalAlpha = flash ? (Math.floor(performance.now() / 100) % 2 ? 0.4 : 1) : 1;
  if (img && img.width) {
    ctx.drawImage(img, -s.w / 2, -s.h / 2, s.w, s.h);
  } else {
    ctx.fillStyle = "#1f2937";
    ctx.beginPath();
    ctx.moveTo(0, -s.h / 2);
    ctx.lineTo(s.w / 2, s.h / 2);
    ctx.lineTo(s.w / 4, s.h / 2);
    ctx.lineTo(0, s.h / 4);
    ctx.lineTo(-s.w / 4, s.h / 2);
    ctx.lineTo(-s.w / 2, s.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(0, -4, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawAlien(ctx: CanvasRenderingContext2D, a: Alien, img?: HTMLImageElement) {
  const w = 54, h = 40;
  if (img && img.width) {
    ctx.drawImage(img, a.x, a.y, w, h);
  } else {
    ctx.save();
    ctx.translate(a.x + 27, a.y + 20);
    ctx.fillStyle = "#7c3aed";
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a78bfa";
    ctx.beginPath();
    ctx.ellipse(0, -6, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0e0b16";
    ctx.beginPath();
    ctx.arc(-7, -6, 3, 0, Math.PI * 2);
    ctx.arc(7, -6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
function drawHud(ctx: CanvasRenderingContext2D, score: number, lives: number, level: number, isAr: boolean) {
  ctx.font = "bold 24px 'Baloo 2', sans-serif";
  ctx.fillStyle = "#0e0b16";
  ctx.textAlign = "left";
  ctx.fillText(`${isAr ? "نقاط" : "Score"}: ${score}`, 16, 34);
  ctx.fillText(`${isAr ? "مستوى" : "Lv"}: ${level}`, 16, 64);
  ctx.textAlign = "right";
  ctx.fillText(`${isAr ? "حيوات" : "Lives"}: ${"❤".repeat(Math.max(0, lives))}`, W - 16, 34);
}
function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `bold ${size}px 'Baloo 2', sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}
function drawTitle(ctx: CanvasRenderingContext2D, isAr: boolean) {
  drawText(ctx, isAr ? "غزو الفضائيين" : "ALIEN FLEET", W / 2, H / 2 - 40, 56, "#0e0b16");
  drawText(ctx, isAr ? "دافع عن الأرض!" : "Defend the Earth!", W / 2, H / 2 + 10, 22, "#1f2937");
}
function drawStory(ctx: CanvasRenderingContext2D, isAr: boolean) {
  drawText(ctx, isAr ? "القصة" : "STORY", W / 2, H / 2 - 40, 40, "#0e0b16");
}
