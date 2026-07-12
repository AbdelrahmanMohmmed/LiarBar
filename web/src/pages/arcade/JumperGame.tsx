import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const W = 800;
const H = 600;
const GROUND = 500;
const HS_KEY = "arcade_runner_highscore";

type Phase = "intro" | "playing" | "over";

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "snail" | "fly";
}

export default function JumperGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(0);

  const phaseRef = useRef(phase);
  const scoreRef = useRef(score);
  const highRef = useRef(high);
  phaseRef.current = phase;
  scoreRef.current = score;

  useEffect(() => {
    const stored = Number(localStorage.getItem(HS_KEY) || 0);
    setHigh(stored);
    highRef.current = stored;
  }, []);

  const start = () => setPhase("playing");
  const restart = () => { setScore(0); setPhase("playing"); };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let px = 100;
    let py = GROUND;
    let vy = 0;
    let jumpCount = 0;
    let maxJumps = 1;
    let obstacles: Obstacle[] = [];
    let spawnTimer = 0;
    let spawnInterval = 1280;
    let scroll = 0;
    let startT = 0;
    let elapsed = 0;
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    const keys = new Set<string>();

    const IMG = (src: string) => { const i = new Image(); i.src = src; return i; };
    const skyImg = IMG("/arcade-assets/jumper/graphics/Sky.png");
    const groundImg = IMG("/arcade-assets/jumper/graphics/ground.png");
    const playerStand = IMG("/arcade-assets/jumper/graphics/Player/player_stand.png");
    const playerWalk1 = IMG("/arcade-assets/jumper/graphics/Player/player_walk_1.png");
    const playerWalk2 = IMG("/arcade-assets/jumper/graphics/Player/player_walk_2.png");
    const playerJump = IMG("/arcade-assets/jumper/graphics/Player/jump.png");
    const fly1 = IMG("/arcade-assets/jumper/graphics/Fly/Fly1.png");
    const fly2 = IMG("/arcade-assets/jumper/graphics/Fly/Fly2.png");
    const snail1 = IMG("/arcade-assets/jumper/graphics/snail/snail1.png");
    const snail2 = IMG("/arcade-assets/jumper/graphics/snail/snail2.png");

    const reset = () => {
      px = 100; py = GROUND; vy = 0; jumpCount = 0; maxJumps = 1;
      obstacles = []; spawnTimer = 0; spawnInterval = 1280; scroll = 0;
      startT = performance.now(); elapsed = 0;
    };

    const doJump = () => {
      if (jumpCount < maxJumps) { vy = -22; jumpCount += 1; }
    };

    const loop = (now: number) => {
      const dt = Math.min(50, now - last); last = now;
      frame += dt;

      // background
      if (skyImg && skyImg.width) {
        ctx.drawImage(skyImg, 0, 0, W, H);
      } else {
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#5e8cb0");
        sky.addColorStop(1, "#9fc0d8");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);
      }
      // ground
      ctx.fillStyle = "#3c2f23";
      ctx.fillRect(0, GROUND, W, H - GROUND);

      if (phaseRef.current === "playing") {
        elapsed = Math.floor((now - startT) / 1000);
        if (elapsed !== scoreRef.current) { setScore(elapsed); }

        const speed = elapsed > 100 ? 12 : elapsed > 50 ? 8 : 5;
        spawnInterval = elapsed > 100 ? 680 : elapsed > 50 ? 880 : 1280;
        maxJumps = elapsed > 100 ? 10 : elapsed > 50 ? 5 : 1;

        scroll -= speed;
        if (scroll < -W) scroll += W;

        // input
        if (keys.has(" ") || keys.has("arrowup") || keys.has("w")) doJump();

        vy += 1;
        py += vy;
        if (py >= GROUND) { py = GROUND; vy = 0; jumpCount = 0; }

        // spawn
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
          spawnTimer = 0;
          if (Math.random() < 0.66) {
            obstacles.push({ x: W + 40, y: GROUND - 40, w: 50, h: 40, type: "snail" });
          } else {
            obstacles.push({ x: W + 40, y: GROUND - 130, w: 46, h: 34, type: "fly" });
          }
        }

        // move + collide
        const pw = 44, ph = 64;
        const pRect = { x: px - pw / 2, y: py - ph, w: pw, h: ph };
        obstacles = obstacles.filter((o) => {
          o.x -= speed;
          if (o.x + o.w < -40) return false;
          if (rectHit(pRect, o)) {
            const finalScore = elapsed;
            if (finalScore > highRef.current) {
              highRef.current = finalScore;
              setHigh(finalScore);
              localStorage.setItem(HS_KEY, String(finalScore));
            }
            setPhase("over");
            return false;
          }
          return true;
        });
      } else {
        // idle scroll a touch
        scroll -= 2;
        if (scroll < -W) scroll += W;
      }

      // ground
      if (groundImg && groundImg.width) {
        for (let i = -1; i < Math.ceil(W / groundImg.width) + 1; i++) {
          const gx = i * groundImg.width + (scroll % groundImg.width);
          ctx.drawImage(groundImg, gx, GROUND, groundImg.width, H - GROUND);
        }
      } else {
        ctx.fillStyle = "#4a3a2b";
        for (let i = 0; i < 2; i++) {
          const sx = ((i * W) + scroll) % (W * 2);
          ctx.fillRect(sx, GROUND, W, H - GROUND);
        }
      }

      // player
      drawPlayer(ctx, px, py, frame, phaseRef.current === "playing", {
        stand: playerStand, walk1: playerWalk1, walk2: playerWalk2, jump: playerJump,
      });

      // obstacles
      for (const o of obstacles) {
        if (o.type === "snail") drawSnail(ctx, o.x, o.y, frame, { a: snail1, b: snail2 });
        else drawFly(ctx, o.x, o.y, frame, { a: fly1, b: fly2 });
      }

      // score
      ctx.font = "bold 30px 'Baloo 2', sans-serif";
      ctx.fillStyle = "#3b2f2f";
      ctx.textAlign = "right";
      ctx.fillText(`Score: ${scoreRef.current}`, W - 16, 36);
      ctx.textAlign = "left";
      ctx.fillText(`Best: ${highRef.current}`, 16, 36);

      raf = requestAnimationFrame(loop);
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (phaseRef.current !== "playing") {
        if (k === " " || k === "enter" || k === "arrowup") { e.preventDefault(); reset(); start(); }
        return;
      }
      keys.add(k);
      if ([" ", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onPointer = () => {
      if (phaseRef.current === "playing") doJump();
      else { reset(); start(); }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointer);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const i18n = {
    ar: {
      sub: "العدّاء",
      start: "انقر أو اضغط مسافة للقفز والبدء",
      over: "اصطدمت!",
      score: "النقاط",
      best: "الأفضل",
      again: "إعادة (مسافة)",
    },
    en: {
      sub: "Super Runner",
      start: "Tap or press Space to jump & start",
      over: "You crashed!",
      score: "Score",
      best: "Best",
      again: "Restart (Space)",
    },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={`${i18n.score}: ${score}  •  ${i18n.best}: ${high}`}>
      <div className="relative w-full" style={{ maxWidth: 760 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-xl border border-white/10 touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/65 rounded-xl text-center px-6">
            <div className="text-3xl font-extrabold">
              {phase === "intro" ? (isAr ? "العدّاء" : "Super Runner") : i18n.over}
            </div>
            {phase === "over" && (
              <div className="text-fuchsia-300">
                {i18n.score}: {score}  •  {i18n.best}: {high}
              </div>
            )}
            <p className="text-white/60 text-sm">{phase === "intro" ? i18n.start : ""}</p>
            <button
              onClick={restart}
              className="mt-2 px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-semibold transition-all"
            >
              {phase === "intro" ? (isAr ? "ابدأ" : "Start") : i18n.again}
            </button>
          </div>
        )}
      </div>
    </ArcadeShell>
  );
}

function rectHit(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
  moving: boolean,
  imgs: { stand: HTMLImageElement; walk1: HTMLImageElement; walk2: HTMLImageElement; jump: HTMLImageElement },
) {
  let img: HTMLImageElement | undefined;
  if (y < GROUND - 2) img = imgs.jump;
  else if (moving) img = Math.floor(frame / 120) % 2 === 0 ? imgs.walk1 : imgs.walk2;
  else img = imgs.stand;

  if (img && img.width) {
    ctx.drawImage(img, x - 40, y - 80, 80, 80);
  } else {
    const legSwing = moving ? Math.sin(frame * 0.02) * 10 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#3b2f2f";
    ctx.fillRect(-16 + legSwing, -28, 12, 28);
    ctx.fillRect(6 - legSwing, -28, 12, 28);
    ctx.fillStyle = "#6ee7b7";
    ctx.beginPath();
    ctx.roundRect(-20, -64, 40, 40, 10);
    ctx.fill();
    ctx.fillStyle = "#a7f3d0";
    ctx.beginPath();
    ctx.arc(0, -74, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0e0b16";
    ctx.beginPath();
    ctx.arc(7, -76, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSnail(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, imgs: { a: HTMLImageElement; b: HTMLImageElement }) {
  const img = Math.floor(frame / 200) % 2 === 0 ? imgs.a : imgs.b;
  if (img && img.width) {
    ctx.drawImage(img, x - 4, y - 8, 56, 52);
  } else {
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.ellipse(x + 18, y + 30, 20, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(x + 16, y + 14, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7c2d12";
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 28, y + 18);
    ctx.lineTo(x + 34, y + 2);
    ctx.stroke();
    ctx.fillStyle = "#0e0b16";
    ctx.beginPath();
    ctx.arc(x + 34, y + 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFly(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, imgs: { a: HTMLImageElement; b: HTMLImageElement }) {
  const img = Math.floor(frame / 120) % 2 === 0 ? imgs.a : imgs.b;
  if (img && img.width) {
    ctx.drawImage(img, x - 4, y - 4, 54, 40);
  } else {
    const flap = Math.sin(frame * 0.03) * 6;
    ctx.fillStyle = "#4b5563";
    ctx.beginPath();
    ctx.ellipse(x + 23, y + 17, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x + 14, y + 8 - flap, 12, 7, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + 32, y + 8 - flap, 12, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0e0b16";
    ctx.beginPath();
    ctx.arc(x + 36, y + 14, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
