import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const W = 1024;
const H = 720;
const GROUND = H - 100;

type Phase = "intro" | "fight" | "over";
type Action = "idle" | "walk" | "jump" | "attack" | "hit" | "dead";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

const CAT_FRAMES = [4, 2, 4, 6, 1, 4, 4, 6];
const MON_FRAMES = [4, 4, 4, 4, 1, 3, 7, 7];

class Fighter {
  x: number;
  y: number;
  facing: 1 | -1;
  health = 160;
  alive = true;
  jumping = false;
  attacking = false;
  attackTimer = 0;
  attackStyle: 1 | 2 = 1;
  hit = false;
  hitTimer = 0;
  cooldown = 0;
  action: Action = "idle";
  animT = 0;
  scoreWins = 0;
  isP1: boolean;

  sheet: HTMLImageElement;
  sheetRows: number[];
  tile: number;
  scale: number;
  frameIndex = 0;
  frameTimer = 0;

  constructor(x: number, facing: 1 | -1, isP1: boolean, sheet: HTMLImageElement, sheetRows: number[], tile: number, scale: number) {
    this.x = x;
    this.y = GROUND;
    this.facing = facing;
    this.isP1 = isP1;
    this.sheet = sheet;
    this.sheetRows = sheetRows;
    this.tile = tile;
    this.scale = scale;
  }

  get rect() {
    return { x: this.x, y: this.y - 180, w: 80, h: 180 };
  }

  reset(x: number, facing: 1 | -1) {
    this.x = x;
    this.y = GROUND;
    this.vy = 0;
    this.health = 160;
    this.alive = true;
    this.jumping = false;
    this.attacking = false;
    this.attackTimer = 0;
    this.hit = false;
    this.hitTimer = 0;
    this.cooldown = 0;
    this.action = "idle";
    this.facing = facing;
  }

  tryAttack(style: 1 | 2) {
    if (this.cooldown > 0 || this.attacking || !this.alive) return false;
    this.attacking = true;
    this.attackStyle = style;
    this.attackTimer = 18;
    this.cooldown = 34;
    return true;
  }

  resolveHit(target: Fighter) {
    if (!target.alive) return;
    const dx = Math.abs(this.x - target.x);
    const dy = Math.abs(this.y - target.y);
    if (dx < 120 && dy < 120) {
      target.health = Math.max(0, target.health - 20);
      target.hit = true;
      target.hitTimer = 14;
      if (target.health <= 0) target.alive = false;
    }
  }

  private actionRow(): number {
    switch (this.action) {
      case "walk": return 1;
      case "jump": return 4;
      case "attack": return this.attackStyle === 2 ? 3 : 4;
      case "hit": return 5;
      case "dead": return 6;
      default: return 0;
    }
  }

  update(input: { left: boolean; right: boolean; jump: boolean; attack1: boolean; attack2: boolean }, opponent: Fighter, canMove: boolean, f: number, dt: number) {
    this.animT += f;
    if (this.cooldown > 0) this.cooldown -= f;
    if (this.hitTimer > 0) {
      this.hitTimer -= f;
      if (this.hitTimer <= 0) { this.hit = false; this.attacking = false; }
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= f;
      if (this.attackTimer <= 0) this.attacking = false;
    }

    if (!this.alive) { this.action = "dead"; }
    else if (this.hit) { this.action = "hit"; }
    else {
      let move = 0;
      if (canMove && !this.attacking) {
        if (input.left) move -= 10;
        if (input.right) move += 10;
        if (input.jump && !this.jumping) { this.vy = -40; this.jumping = true; }
        if (input.attack1) { if (this.tryAttack(1)) this.resolveHit(opponent); }
        if (input.attack2) { if (this.tryAttack(2)) this.resolveHit(opponent); }
      }

      this.vy += 2 * f;
      this.x += move * f;
      this.y += this.vy * f;

      if (this.y > GROUND) { this.y = GROUND; this.vy = 0; this.jumping = false; }
      if (this.x < 40) this.x = 40;
      if (this.x > W - 40) this.x = W - 40;

      if (move !== 0) this.facing = move > 0 ? 1 : -1;
      else if (opponent.x > this.x) this.facing = 1;
      else this.facing = -1;

      if (this.attacking) this.action = "attack";
      else if (this.jumping) this.action = "jump";
      else if (move !== 0) this.action = "walk";
      else this.action = "idle";
    }

    // sprite frame cycling
    this.frameTimer += dt;
    const row = this.actionRow();
    const frames = this.sheetRows[row] || 1;
    if (this.frameTimer > 100) {
      this.frameTimer = 0;
      this.frameIndex += 1;
      if (this.frameIndex >= frames) this.frameIndex = this.alive ? 0 : frames - 1;
    }
  }

  vy = 0;

  draw(ctx: CanvasRenderingContext2D) {
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 4, 45, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const dw = this.tile * this.scale;
    const dh = this.tile * this.scale;
    const row = this.actionRow();
    const fx = (this.frameIndex % (this.sheetRows[row] || 1)) * this.tile;
    const fy = row * this.tile;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing, 1);
    if (this.sheet && this.sheet.width) {
      ctx.drawImage(this.sheet, fx, fy, this.tile, this.tile, -dw / 2, -dh, dw, dh);
    } else {
      ctx.fillStyle = this.isP1 ? "#22d3ee" : "#fb7185";
      ctx.fillRect(-35, -150, 70, 150);
    }
    ctx.restore();
  }
}

export default function FighterGame() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [countdown, setCountdown] = useState(3);
  const [scores, setScores] = useState<[number, number]>([0, 0]);

  const phaseRef = useRef(phase);
  const scoresRef = useRef(scores);
  phaseRef.current = phase;
  scoresRef.current = scores;

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = new Set<string>();

    let bgImg: HTMLImageElement | null = null;
    let victoryImg: HTMLImageElement | null = null;
    let catSheet: HTMLImageElement | null = null;
    let monSheet: HTMLImageElement | null = null;

    Promise.all([
      loadImage("/arcade-assets/fighter/9e0a805a0d4420a555df6741aebffd4b.gif").then((i) => (bgImg = i)),
      loadImage("/arcade-assets/fighter/victory.png").then((i) => (victoryImg = i)),
      loadImage("/arcade-assets/fighter/fighters/cat_fighter_sprite1.png").then((i) => (catSheet = i)),
      loadImage("/arcade-assets/fighter/fighters/mon2_sprite_base.png").then((i) => (monSheet = i)),
    ]).then(() => {
      if (cancelled) return;

      const p1 = new Fighter(200, 1, true, catSheet!, CAT_FRAMES, 50, 4);
      const p2 = new Fighter(824, -1, false, monSheet!, MON_FRAMES, 60, 3);

      let introT = 0;
      let introLeft = 3;
      let overT = 0;
      let raf = 0;
      let last = performance.now();

      const resetRound = (cd: number) => {
        p1.reset(200, 1);
        p2.reset(824, -1);
        setCountdown(cd);
      };

      const drawHealth = (f: Fighter, x: number, y: number, flip: boolean) => {
        const ratio = f.health / 160;
        const w = 400;
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, x - 5, y - 5, w + 10, 35, 6); ctx.fill();
        ctx.fillStyle = "#7f1d1d";
        roundRect(ctx, x, y, w, 25, 4); ctx.fill();
        ctx.fillStyle = "#facc15";
        if (flip) roundRect(ctx, x + w * (1 - ratio), y, w * ratio, 25, 4);
        else roundRect(ctx, x, y, w * ratio, 25, 4);
        ctx.fill();
      };

      const drawText = (text: string, x: number, y: number, size: number, color: string) => {
        ctx.font = `bold ${size}px 'Baloo 2', sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(text, x, y);
      };

      const loop = (now: number) => {
        const dt = Math.min(50, now - last);
        last = now;
        const f = dt / 16.67;

        if (bgImg && bgImg.width) {
          ctx.drawImage(bgImg, 0, 0, W, H);
        } else {
          ctx.fillStyle = "#1a1030";
          ctx.fillRect(0, 0, W, H);
        }
        // arena floor
        ctx.fillStyle = "rgba(42,26,74,0.85)";
        ctx.fillRect(0, GROUND, W, H - GROUND);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(0, GROUND, W, 4);

        if (phaseRef.current === "intro") {
          introT += dt;
          if (introT >= 1000) {
            introLeft -= 1;
            setCountdown(Math.max(0, introLeft));
            introT = 0;
            if (introLeft <= 0) setPhase("fight");
          }
          p1.draw(ctx); p2.draw(ctx);
          drawHealth(p1, 20, 30, false);
          drawHealth(p2, W - 420, 30, true);
          if (countdown > 0) drawText(String(countdown), W / 2, H / 2, 160, "#facc15");
          else drawText(isAr ? "اقتال!" : "FIGHT!", W / 2, H / 2, 120, "#fb7185");
        } else if (phaseRef.current === "fight") {
          const in1 = { left: keys.has("a"), right: keys.has("d"), jump: keys.has("w"), attack1: keys.has("k"), attack2: keys.has("l") };
          const in2 = { left: keys.has("arrowleft"), right: keys.has("arrowright"), jump: keys.has("arrowup"), attack1: keys.has("n"), attack2: keys.has("m") };
          p1.update(in1, p2, true, f, dt);
          p2.update(in2, p1, true, f, dt);

          p1.draw(ctx); p2.draw(ctx);
          drawHealth(p1, 20, 30, false);
          drawHealth(p2, W - 420, 30, true);
          drawText(isAr ? `ف1: ${scoresRef.current[0]}` : `P1: ${scoresRef.current[0]}`, 20, 80, 26, "#22d3ee");
          drawText(isAr ? `ف2: ${scoresRef.current[1]}` : `P2: ${scoresRef.current[1]}`, W - 20, 80, 26, "#fb7185");

          if (!p1.alive || !p2.alive) {
            const winner = p2.alive ? 1 : p1.alive ? 0 : -1;
            if (winner >= 0) {
              const w = winner as 0 | 1;
              const ns: [number, number] = [...scoresRef.current];
              ns[w] += 1;
              setScores(ns);
            }
            overT = 0;
            setPhase("over");
          }
        } else {
          overT += dt;
          p1.draw(ctx); p2.draw(ctx);
          drawHealth(p1, 20, 30, false);
          drawHealth(p2, W - 420, 30, true);
          if (victoryImg && victoryImg.width) {
            ctx.drawImage(victoryImg, W / 2 - 200, H / 2 - 120, 400, 240);
          }
          const winnerText = !p1.alive ? (isAr ? "اللاعب 2 فاز!" : "Player 2 wins!") : !p2.alive ? (isAr ? "اللاعب 1 فاز!" : "Player 1 wins!") : (isAr ? "تعادل!" : "Draw!");
          drawText(winnerText, W / 2, H / 2 + 90, 56, "#facc15");
          if (overT >= 2200) {
            resetRound(3);
            setPhase("intro");
          }
        }

        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
      cleanupRaf = () => cancelAnimationFrame(raf);
    });

    let cleanupRaf = () => {};

    const onKey = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      const blocked = ["arrowup", "arrowdown", "arrowleft", "arrowright", " "];
      if (blocked.includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelled = true;
      cleanupRaf();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isAr]);

  const i18n = {
    ar: { sub: "نزال — لاعبان", controls: "ف1: A/D تحرك، W قفز، K/L هجوم   •   ف2: الأسهم + N/M هجوم" },
    en: { sub: "Fighter — 2 Players", controls: "P1: A/D move, W jump, K/L attack   •   P2: Arrows + N/M attack" },
  }[isAr ? "ar" : "en"];

  return (
    <ArcadeShell title={i18n.sub} subtitle={i18n.controls}>
      <div className="relative w-full" style={{ maxWidth: 900 }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full rounded-xl border border-white/10 bg-[#1a1030] touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
      </div>
    </ArcadeShell>
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
