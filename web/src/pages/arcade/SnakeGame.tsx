import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const SIZE = COLS * CELL;

type Phase = "start" | "playing" | "over";
type Dir = "up" | "down" | "left" | "right";

export default function SnakeGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [score, setScore] = useState(0);
  const [hiScore, setHiScore] = useState(0);

  const phaseRef = useRef<Phase>(phase);
  const scoreRef = useRef(score);
  phaseRef.current = phase;
  scoreRef.current = score;

  const start = () => setPhase("playing");
  const restart = () => {
    setScore(0);
    setPhase("playing");
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let snake: { x: number; y: number }[] = [];
    let dir: Dir = "down";
    let nextDir: Dir = "down";
    let food = { x: 10, y: 10 };
    let acc = 0;
    let stepInterval = 130;
    let raf = 0;
    let last = performance.now();
    let animT = 0;
    let deathFlash = 0;
    let scorePopups: { x: number; y: number; t: number }[] = [];

    const placeFood = () => {
      do {
        food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      } while (snake.some((s) => s.x === food.x && s.y === food.y));
    };

    const reset = () => {
      snake = [
        { x: 10, y: 1 },
        { x: 10, y: 0 },
      ];
      dir = "down";
      nextDir = "down";
      scoreRef.current = 0;
      setScore(0);
      acc = 0;
      stepInterval = 130;
      deathFlash = 0;
      scorePopups = [];
      placeFood();
    };

    const setDir = (d: Dir) => {
      if (d === "up" && dir !== "down") nextDir = "up";
      else if (d === "down" && dir !== "up") nextDir = "down";
      else if (d === "left" && dir !== "right") nextDir = "left";
      else if (d === "right" && dir !== "left") nextDir = "right";
    };

    const step = () => {
      dir = nextDir;
      const head = { x: snake[0].x, y: snake[0].y };
      if (dir === "up") head.y -= 1;
      else if (dir === "down") head.y += 1;
      else if (dir === "left") head.x -= 1;
      else head.x += 1;

      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
        deathFlash = 1;
        setPhase("over");
        return;
      }
      if (snake.some((s) => s.x === head.x && s.y === head.y)) {
        deathFlash = 1;
        setPhase("over");
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        const s = scoreRef.current + 1;
        scoreRef.current = s;
        setScore(s);
        scorePopups.push({ x: food.x * CELL + CELL / 2, y: food.y * CELL, t: 1 });
        stepInterval = Math.max(45, 130 - s * 2);
        placeFood();
      } else {
        snake.pop();
      }
    };

    const drawSnakeHead = (x: number, y: number, d: Dir) => {
      const cx = x * CELL + CELL / 2;
      const cy = y * CELL + CELL / 2;
      const r = CELL / 2 - 1;

      ctx.fillStyle = "#5ee08a";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // eyes
      const eyeOff = 3.5;
      const pupilOff = 1.5;
      let e1x: number, e1y: number, e2x: number, e2y: number;
      let p1x: number, p1y: number, p2x: number, p2y: number;
      if (d === "up") {
        e1x = cx - eyeOff; e1y = cy - eyeOff;
        e2x = cx + eyeOff; e2y = cy - eyeOff;
        p1x = e1x; p1y = e1y - pupilOff;
        p2x = e2x; p2y = e2y - pupilOff;
      } else if (d === "down") {
        e1x = cx - eyeOff; e1y = cy + eyeOff;
        e2x = cx + eyeOff; e2y = cy + eyeOff;
        p1x = e1x; p1y = e1y + pupilOff;
        p2x = e2x; p2y = e2y + pupilOff;
      } else if (d === "left") {
        e1x = cx - eyeOff; e1y = cy - eyeOff;
        e2x = cx - eyeOff; e2y = cy + eyeOff;
        p1x = e1x - pupilOff; p1y = e1y;
        p2x = e2x - pupilOff; p2y = e2y;
      } else {
        e1x = cx + eyeOff; e1y = cy - eyeOff;
        e2x = cx + eyeOff; e2y = cy + eyeOff;
        p1x = e1x + pupilOff; p1y = e1y;
        p2x = e2x + pupilOff; p2y = e2y;
      }

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(e1x, e1y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e2x, e2y, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(p1x, p1y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p2x, p2y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = () => {
      // bg
      if (deathFlash > 0) {
        ctx.fillStyle = `rgba(255,50,50,${deathFlash * 0.3})`;
        ctx.fillRect(0, 0, SIZE, SIZE);
        deathFlash = Math.max(0, deathFlash - 0.03);
      } else {
        ctx.fillStyle = "#0a0a12";
        ctx.fillRect(0, 0, SIZE, SIZE);
      }

      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(SIZE, i * CELL);
        ctx.stroke();
      }

      // food (pulsing)
      const pulse = 1 + 0.15 * Math.sin(animT * 0.006);
      const foodR = (CELL / 2 - 2) * pulse;
      ctx.fillStyle = "#ff4d4d";
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, foodR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,77,77,0.25)";
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, foodR + 4, 0, Math.PI * 2);
      ctx.fill();

      // snake body with gradient
      if (snake.length > 0) {
        const head = snake[0];
        drawSnakeHead(head.x, head.y, dir);
      }
      for (let i = 1; i < snake.length; i++) {
        const t = i / Math.max(1, snake.length - 1);
        const r = Math.round(46 + (42 - 46) * t);
        const g = Math.round(224 + (170 - 224) * t);
        const b = Math.round(138 + (90 - 138) * t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const pad = 1.5;
        ctx.fillRect(snake[i].x * CELL + pad, snake[i].y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
      }

      // score popups
      scorePopups = scorePopups.filter((p) => {
        p.t -= 0.02;
        if (p.t <= 0) return false;
        ctx.fillStyle = `rgba(255,255,255,${p.t})`;
        ctx.font = "bold 14px 'Baloo 2', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("+1", p.x, p.y - (1 - p.t) * 30);
        return true;
      });
    };

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      animT += dt;
      if (phaseRef.current === "playing") {
        acc += dt;
        while (acc >= stepInterval) {
          acc -= stepInterval;
          step();
          if (phaseRef.current !== "playing") break;
        }
        render();
      } else {
        render();
      }
      raf = requestAnimationFrame(loop);
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (phaseRef.current === "start") {
        if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
          e.preventDefault();
          reset();
          start();
        }
        return;
      }
      if (phaseRef.current === "over") {
        if (k === " " || k === "enter") {
          e.preventDefault();
          if (scoreRef.current > hiScore) setHiScore(scoreRef.current);
          reset();
          start();
        }
        return;
      }
      if (k === "arrowup" || k === "w") setDir("up");
      else if (k === "arrowdown" || k === "s") setDir("down");
      else if (k === "arrowleft" || k === "a") setDir("left");
      else if (k === "arrowright" || k === "d") setDir("right");
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    };

    // touch swipe
    let touchStart: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (phaseRef.current !== "playing") {
        reset();
        start();
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart || phaseRef.current !== "playing") return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? "right" : "left");
      else setDir(dy > 0 ? "down" : "up");
      touchStart = null;
    };

    const onPointerDown = () => {
      if (phaseRef.current !== "playing") {
        reset();
        start();
      }
    };

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("pointerdown", onPointerDown);

    reset();
    render();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const i18n = {
    ar: { sub: "Snake", score: "النقاط", hi: "الأفضل", start: "انقر أو اضغط سهماً للبدء", over: "انتهت اللعبة", again: "إعادة (مسافة)" },
    en: { sub: "Snake", score: "Score", hi: "Best", start: "Tap or press an arrow to start", over: "Game Over", again: "Restart (Space)" },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={`${i18n.score}: ${score}  •  ${i18n.hi}: ${hiScore}`}>
      <div className="relative" style={{ width: SIZE, maxWidth: "92vw" }}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="w-full rounded-xl border border-white/10 bg-[#0a0a12] touch-none"
          style={{ aspectRatio: "1 / 1", imageRendering: "pixelated" }}
        />
        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 rounded-xl text-center px-6">
            <div className="text-2xl font-bold">{phase === "start" ? i18n.start : i18n.over}</div>
            {phase === "over" && <div className="text-fuchsia-300">{i18n.score}: {score}</div>}
            <button
              onClick={() => { if (score > hiScore) setHiScore(score); restart(); }}
              className="mt-2 px-5 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-semibold transition-all"
            >
              {phase === "start" ? (isAr ? "ابدأ" : "Start") : i18n.again}
            </button>
          </div>
        )}
      </div>
    </ArcadeShell>
  );
}
