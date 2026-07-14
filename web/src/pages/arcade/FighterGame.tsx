import { useEffect, useRef, useState } from "react";
import ArcadeShell from "@/components/ArcadeShell";
import { useLanguage } from "@/lib/languageContext";

const W = 1024;
const H = 720;
const GROUND = H - 100;

type Phase = "intro" | "fight" | "over";
type Action = "idle" | "walk" | "jump" | "hand" | "kick" | "special" | "parry" | "hit" | "dead";

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

class Fighter {
  x: number;
  y: number;
  facing: 1 | -1;
  health = 160;
  alive = true;
  jumping = false;
  attacking = false;
  attackTimer = 0;
  attackStyle: 1 | 2 | 3 = 1;
  hit = false;
  hitTimer = 0;
  cooldown = 0;
  parryTimer = 0;
  parryActive = false;
  parryFlash = 0;
  parryStamina = 100;
  guardBreak = false;
  specialMeter = 0;
  specialFlash = 0;
  stun = 0;
  action: Action = "idle";
  animT = 0;
  scoreWins = 0;
  isP1: boolean;
  walkDir = 0;

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
    this.parryTimer = 0;
    this.parryActive = false;
    this.parryFlash = 0;
    this.parryStamina = 100;
    this.guardBreak = false;
    this.specialMeter = 0;
    this.specialFlash = 0;
    this.stun = 0;
    this.action = "idle";
    this.facing = facing;
    this.walkDir = 0;
  }

  tryAttack(style: 1 | 2) {
    if (this.cooldown > 0 || this.attacking || !this.alive) return false;
    this.attacking = true;
    this.attackStyle = style;
    this.attackTimer = 18;
    this.cooldown = 34;
    return true;
  }

  tryParry() {
    if (this.attacking || !this.alive || this.stun > 0 || this.parryStamina <= 0) return false;
    this.parryTimer = 26;
    this.parryActive = true;
    this.parryFlash = 8;
    return true;
  }

  trySpecial(opponent: Fighter) {
    if (this.specialMeter < 100 || this.cooldown > 0 || this.attacking || !this.alive) return false;
    this.attacking = true;
    this.attackStyle = 3;
    this.attackTimer = 30;
    this.cooldown = 50;
    this.specialMeter = 0;
    this.specialFlash = 20;
    this.resolveHit(opponent, 50);
    return true;
  }

  resolveHit(target: Fighter, dmg = 20) {
    if (!target.alive) return;
    const dx = Math.abs(this.x - target.x);
    const dy = Math.abs(this.y - target.y);
    if (dx < 130 && dy < 120) {
      if (target.parryActive && target.parryStamina > 0) {
        // Blocked! Cost stamina
        const cost = dmg * 0.6;
        target.parryStamina = Math.max(0, target.parryStamina - cost);
        target.parryFlash = 14;
        this.attacking = false;
        this.stun = 26;
        // Guard break if stamina depleted
        if (target.parryStamina <= 0) {
          target.guardBreak = true;
          target.stun = 40;
          target.parryActive = false;
          target.parryTimer = 0;
          target.parryFlash = 20;
        }
        return;
      }
      target.health = Math.max(0, target.health - dmg);
      target.hit = true;
      target.hitTimer = 14;
      this.specialMeter = Math.min(100, this.specialMeter + 30);
      if (target.health <= 0) target.alive = false;
    }
  }

  actionRow(): number {
    switch (this.action) {
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

  update(input: { left: boolean; right: boolean; jump: boolean; attack1: boolean; attack2: boolean; special: boolean }, opponent: Fighter, canMove: boolean, f: number, dt: number) {
    this.animT += f;
    if (this.cooldown > 0) this.cooldown -= f;
    if (this.stun > 0) this.stun -= f;
    if (this.parryTimer > 0) {
      this.parryTimer -= f;
      if (this.parryTimer <= 0) { this.parryActive = false; }
      else if (this.parryTimer < 12) this.parryActive = false;
    }
    // Stamina recharge when not blocking
    if (!this.parryActive && this.parryStamina < 100) {
      this.parryStamina = Math.min(100, this.parryStamina + 0.8 * f);
    }
    if (this.parryFlash > 0) this.parryFlash -= f;
    if (this.specialFlash > 0) this.specialFlash -= f;
    if (this.hitTimer > 0) {
      this.hitTimer -= f;
      if (this.hitTimer <= 0) { this.hit = false; this.attacking = false; }
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= f;
      if (this.attackTimer <= 0) this.attacking = false;
    }
    if (this.guardBreak) {
      this.guardBreak = false;
      this.stun = 40;
    }

    if (!this.alive) { this.action = "dead"; }
    else if (this.stun > 0) { this.action = "hit"; }
    else if (this.hit) { this.action = "hit"; }
    else {
      let move = 0;
      this.walkDir = 0;
      if (canMove && this.parryTimer <= 0 && !this.attacking && this.stun <= 0) {
        if (input.left) move -= 10;
        if (input.right) move += 10;
        if (input.jump && !this.jumping) { this.vy = -40; this.jumping = true; }

        // Auto-block when walking AWAY from enemy (block stance)
        if (move !== 0 && this.parryStamina > 0) {
          const awayFromEnemy = (opponent.x > this.x && move < 0) || (opponent.x < this.x && move > 0);
          if (awayFromEnemy) {
            this.parryTimer = 26;
            this.parryActive = true;
            move = 0;
          }
        }

        if (!this.parryActive && !this.attacking) {
          if (input.special && this.specialMeter >= 100 && this.cooldown <= 0) {
            this.trySpecial(opponent);
          } else if (input.attack1 || input.attack2) {
            const style = input.attack2 ? 2 : 1;
            if (this.tryAttack(style)) this.resolveHit(opponent, 20);
          }
        }
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

      if (this.parryTimer > 0) this.action = "parry";
      else if (this.attacking) this.action = this.attackStyle === 2 ? "kick" : this.attackStyle === 3 ? "special" : "hand";
      else if (this.jumping) this.action = "jump";
      else if (move !== 0) this.action = "walk";
      else this.action = "idle";
    }

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

  draw(ctx: CanvasRenderingContext2D, flashT: number, particles: Particle[]) {
    const dir = this.facing || 1;

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 4, 45, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const dw = this.tile * this.scale;
    const dh = this.tile * this.scale;
    const row = this.actionRow();
    const fx = (this.frameIndex % (this.sheetRows[row] || 1)) * this.tile;
    const fy = row * this.tile;

    // special attack effect
    if (this.attackStyle === 3 && this.attacking && this.attackTimer > 5) {
      const progress = 1 - (this.attackTimer - 5) / 25;
      const radius = 60 + progress * 120;

      const grad = ctx.createRadialGradient(this.x + dir * 80, this.y - 80, 10, this.x + dir * 80, this.y - 80, radius);
      grad.addColorStop(0, "rgba(255,50,150,0.7)");
      grad.addColorStop(0.4, "rgba(255,100,50,0.4)");
      grad.addColorStop(1, "rgba(255,200,50,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x + dir * 80, this.y - 80, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255,200,50,${0.6 * (1 - progress)})`;
      ctx.lineWidth = 5;
      for (let r = 30; r < radius; r += 20) {
        ctx.beginPath();
        ctx.arc(this.x + dir * 80, this.y - 80, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(this.x + dir * 60, this.y - 80);
      ctx.rotate(flashT * 0.01);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - progress)})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sx = Math.cos(a) * radius * 0.7;
        const sy = Math.sin(a) * radius * 0.7;
        ctx.fillRect(sx - 4, sy - 4, 8, 8);
      }
      ctx.restore();
    }

    // parry deflected flash - only when enemy attacks and gets blocked
    if (this.parryFlash > 0) {
      const t = this.parryFlash / 14;

      // Shield effect during deflection
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(dir, 1);

      // glow behind
      const glowGrad = ctx.createRadialGradient(30, -90, 5, 30, -90, 80);
      glowGrad.addColorStop(0, `rgba(100,200,255,${0.5 * t})`);
      glowGrad.addColorStop(1, "rgba(100,200,255,0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(30, -90, 80, 0, Math.PI * 2);
      ctx.fill();

      // shield arc
      ctx.strokeStyle = `rgba(100,220,255,${0.95 * t})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(40, -85, 65, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();

      // inner arc
      ctx.strokeStyle = `rgba(200,240,255,${0.7 * t})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(40, -85, 50, -Math.PI / 2.5, Math.PI / 2.5);
      ctx.stroke();

      ctx.restore();

      // "PARRY!" flash text
      ctx.fillStyle = `rgba(100,220,255,${t})`;
      ctx.font = "bold 36px 'Baloo 2', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PARRY!", this.x + dir * 60, this.y - 120 - (1 - t) * 20);

      // flash ring
      ctx.strokeStyle = `rgba(100,220,255,${t * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 80, 40 + (1 - t) * 60, 0, Math.PI * 2);
      ctx.stroke();

      // sparks during deflection
      if (Math.random() < 0.5) {
        particles.push({
          x: this.x + dir * 50,
          y: this.y - 80 + (Math.random() - 0.5) * 60,
          vx: dir * (2 + Math.random() * 4),
          vy: -3 + Math.random() * 5,
          life: 18,
          maxLife: 18,
          color: "#64d8ff",
          size: 2 + Math.random() * 4,
        });
      }
    }

    // special flash text
    if (this.specialFlash > 0) {
      const t = this.specialFlash / 20;
      ctx.fillStyle = `rgba(255,100,200,${t})`;
      ctx.font = "bold 42px 'Baloo 2', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPECIAL!", this.x, this.y - 150 - (1 - t) * 30);

      // expanding ring
      ctx.strokeStyle = `rgba(255,100,200,${t * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 80, 30 + (1 - t) * 100, 0, Math.PI * 2);
      ctx.stroke();
    }

    // sprite
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

    // hit sparks
    if (this.hit && this.hitTimer > 8) {
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: this.x + (Math.random() - 0.5) * 40,
          y: this.y - 60 - Math.random() * 80,
          vx: (Math.random() - 0.5) * 6,
          vy: -3 - Math.random() * 4,
          life: 20,
          maxLife: 20,
          color: "#facc15",
          size: 2 + Math.random() * 4,
        });
      }
    }
  }
}

// Tekken/StreetFighter-style fullscreen portrait flash on special attack
function drawSpecialPortrait(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  flashT: number,
  alpha: number,
  W: number,
  H: number,
  isAr: boolean,
) {
  if (alpha <= 0) return;

  const portraitSize = 320;

  // Full screen dark overlay
  ctx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
  ctx.fillRect(0, 0, W, H);

  // Speed lines radiating from center
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(flashT * 0.002);
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const len = 300 + Math.sin(flashT * 0.01 + i) * 100;
    ctx.strokeStyle = `rgba(255,100,200,${0.4 * alpha * (0.5 + 0.5 * Math.sin(flashT * 0.008 + i * 0.5))})`;
    ctx.lineWidth = 2 + Math.sin(flashT * 0.015 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 80, Math.sin(angle) * 80);
    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();

  // Color burst flash
  const burstR = 150 + (1 - alpha) * 300;
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, burstR);
  grad.addColorStop(0, `rgba(255,50,150,${0.5 * alpha})`);
  grad.addColorStop(0.5, `rgba(255,100,50,${0.25 * alpha})`);
  grad.addColorStop(1, "rgba(255,200,50,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, burstR, 0, Math.PI * 2);
  ctx.fill();

  // Draw character portrait (large sprite centered)
  if (fighter.sheet && fighter.sheet.width) {
    const row = fighter.actionRow();
    const fx = 0; // first frame of idle for portrait
    const fy = row * fighter.tile;

    ctx.save();
    // Clip to a diamond shape
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - portraitSize / 2 - 20);
    ctx.lineTo(W / 2 + portraitSize / 2 + 20, H / 2);
    ctx.lineTo(W / 2, H / 2 + portraitSize / 2 + 20);
    ctx.lineTo(W / 2 - portraitSize / 2 - 20, H / 2);
    ctx.closePath();
    ctx.clip();

    // Background flash inside clip
    ctx.fillStyle = `rgba(255,50,150,${0.3 * alpha})`;
    ctx.fillRect(0, 0, W, H);

    // Draw the sprite large
    ctx.drawImage(
      fighter.sheet,
      fx, fy, fighter.tile, fighter.tile,
      W / 2 - portraitSize / 2,
      H / 2 - portraitSize / 2,
      portraitSize,
      portraitSize,
    );
    ctx.restore();

    // Diamond border glow
    ctx.strokeStyle = `rgba(255,100,200,${0.9 * alpha})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - portraitSize / 2 - 20);
    ctx.lineTo(W / 2 + portraitSize / 2 + 20, H / 2);
    ctx.lineTo(W / 2, H / 2 + portraitSize / 2 + 20);
    ctx.lineTo(W / 2 - portraitSize / 2 - 20, H / 2);
    ctx.closePath();
    ctx.stroke();
  }

  // "SPECIAL!" text with glow
  ctx.save();
  ctx.shadowColor = "rgba(255,50,150,0.9)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.font = `bold 64px 'Baloo 2', sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(isAr ? "خاصة!" : "SPECIAL!", W / 2, H / 2 + portraitSize / 2 + 80);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Scanline effect
  ctx.fillStyle = `rgba(0,0,0,${0.06 * alpha})`;
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
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
  const keysRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const keys = keysRef.current;
    const particles: Particle[] = [];

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
      let flashT = 0;
      let screenShake = 0;

      const resetRound = (cd: number) => {
        p1.reset(200, 1);
        p2.reset(824, -1);
        particles.length = 0;
        screenShake = 0;
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

        // special meter
        const mw = 200;
        const bx = flip ? x + w - mw : x;
        const mratio = Math.max(0, Math.min(1, f.specialMeter / 100));
        const full = mratio >= 1;

        ctx.fillStyle = "#1f2937";
        roundRect(ctx, bx, y + 28, mw, 12, 4); ctx.fill();

        if (full) {
          const pulse = 0.6 + 0.4 * Math.sin(flashT * 0.008);
          ctx.fillStyle = `rgba(244,114,182,${pulse})`;
          roundRect(ctx, bx - 2, y + 26, mw + 4, 16, 5); ctx.fill();
        }

        ctx.fillStyle = full ? "#f472b6" : "#a78bfa";
        roundRect(ctx, bx, y + 28, mw * mratio, 12, 4); ctx.fill();

        ctx.fillStyle = full ? "#fbb" : "#ddd6fe";
        ctx.font = `bold 10px 'Baloo 2', sans-serif`;
        ctx.textAlign = flip ? "right" : "left";
        const label = full
          ? (isAr ? "✨ خاص جاهز! اضغط I" : "✨ SPECIAL READY! Press I")
          : (isAr ? "خاص" : "SPECIAL");
        ctx.fillText(label, bx, y + 55);

        // Block stamina bar
        const sw = 160;
        const sx = flip ? x + w - sw : x;
        const sRatio = Math.max(0, Math.min(1, f.parryStamina / 100));
        const lowStam = sRatio < 0.3;

        ctx.fillStyle = "#1f2937";
        roundRect(ctx, sx, y + 60, sw, 10, 3); ctx.fill();

        if (lowStam) {
          const pulse = 0.6 + 0.4 * Math.sin(flashT * 0.015);
          ctx.fillStyle = `rgba(239,68,68,${pulse})`;
          roundRect(ctx, sx - 1, y + 59, sw + 2, 12, 4); ctx.fill();
        }

        ctx.fillStyle = lowStam ? "#ef4444" : sRatio < 0.6 ? "#eab308" : "#22c55e";
        roundRect(ctx, sx, y + 60, sw * sRatio, 10, 3); ctx.fill();

        ctx.fillStyle = "#d1d5db";
        ctx.font = `bold 8px 'Baloo 2', sans-serif`;
        ctx.textAlign = flip ? "right" : "left";
        ctx.fillText(isAr ? "صد" : "BLOCK", sx, y + 82);
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
        flashT += dt;

        if (screenShake > 0) {
          screenShake -= dt;
          const intensity = Math.max(0, screenShake / 300);
          ctx.save();
          ctx.translate(
            (Math.random() - 0.5) * intensity * 12,
            (Math.random() - 0.5) * intensity * 12
          );
        }

        if (bgImg && bgImg.width) {
          ctx.drawImage(bgImg, 0, 0, W, H);
        } else {
          ctx.fillStyle = "#1a1030";
          ctx.fillRect(0, 0, W, H);
        }
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
          p1.draw(ctx, flashT, particles); p2.draw(ctx, flashT, particles);
          drawHealth(p1, 20, 30, false);
          drawHealth(p2, W - 420, 30, true);
          if (countdown > 0) drawText(String(countdown), W / 2, H / 2, 160, "#facc15");
          else drawText(isAr ? "اقتال!" : "FIGHT!", W / 2, H / 2, 120, "#fb7185");
        } else if (phaseRef.current === "fight") {
          const in1 = { left: keysRef.current.has("a"), right: keysRef.current.has("d"), jump: keysRef.current.has("w"), attack1: keysRef.current.has("k"), attack2: keysRef.current.has("l"), special: keysRef.current.has("i") };
          const in2 = { left: keysRef.current.has("arrowleft"), right: keysRef.current.has("arrowright"), jump: keysRef.current.has("arrowup"), attack1: keysRef.current.has("n"), attack2: keysRef.current.has("m"), special: keysRef.current.has("h") };
          p1.update(in1, p2, true, f, dt);
          p2.update(in2, p1, true, f, dt);

          p1.draw(ctx, flashT, particles); p2.draw(ctx, flashT, particles);
          drawHealth(p1, 20, 30, false);
          drawHealth(p2, W - 420, 30, true);
          drawText(isAr ? `ف1: ${scoresRef.current[0]}` : `P1: ${scoresRef.current[0]}`, 20, 80, 26, "#22d3ee");
          drawText(isAr ? `ف2: ${scoresRef.current[1]}` : `P2: ${scoresRef.current[1]}`, W - 20, 80, 26, "#fb7185");

          // screen shake on hit
          if (p1.hit && p1.hitTimer > 10) screenShake = Math.max(screenShake, 200);
          if (p2.hit && p2.hitTimer > 10) screenShake = Math.max(screenShake, 200);
          if (p1.specialFlash > 15 || p2.specialFlash > 15) screenShake = Math.max(screenShake, 400);

          // Tekken-style special attack portrait overlay
          if (p1.specialFlash > 0) drawSpecialPortrait(ctx, p1, flashT, p1.specialFlash / 20, W, H, isAr);
          if (p2.specialFlash > 0) drawSpecialPortrait(ctx, p2, flashT, p2.specialFlash / 20, W, H, isAr);

          // particles
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

          if (!p1.alive || !p2.alive) {
            screenShake = 500;
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
          p1.draw(ctx, flashT, particles); p2.draw(ctx, flashT, particles);
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

        if (screenShake > 0) ctx.restore();

        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
      cleanupRaf = () => cancelAnimationFrame(raf);
    });

    let cleanupRaf = () => {};

    const onKey = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      const blocked = ["arrowup", "arrowdown", "arrowleft", "arrowright", " "];
      if (blocked.includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());

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
    ar: { sub: "نزال — لاعبان", controls: "ف1: A/D تحرك، W قفز، K/L هجوم، امشِ بعيد عن العدو للصد (يخزن طاقة) • I خاص • ف2: أسهم + N/M هجوم، H خاص", mobile: "التحكم: استخدم الأزرار في الأسفل (أو لوحة المفاتيح)" },
    en: { sub: "Fighter — 2 Players", controls: "P1: A/D move, W jump, K/L attack, walk away to block (uses stamina) • I special • P2: Arrows + N/M attack, H special", mobile: "Controls: Use buttons below (or keyboard)" },
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
        {/* Mobile touch controls - only show on touch devices */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-2 sm:hidden animate-fade-in">
          {/* P1 controls (left side) */}
          <div className="flex gap-2 items-center">
            <button
              className="w-12 h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center font-bold text-white text-lg"
              onTouchStart={() => keysRef.current.add("a")}
              onTouchEnd={() => keysRef.current.delete("a")}
              onMouseDown={() => keysRef.current.add("a")}
              onMouseUp={() => keysRef.current.delete("a")}
              onMouseLeave={() => keysRef.current.delete("a")}
            >
              ←
            </button>
            <button
              className="w-12 h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center font-bold text-white text-lg"
              onTouchStart={() => keysRef.current.add("d")}
              onTouchEnd={() => keysRef.current.delete("d")}
              onMouseDown={() => keysRef.current.add("d")}
              onMouseUp={() => keysRef.current.delete("d")}
              onMouseLeave={() => keysRef.current.delete("d")}
            >
              →
            </button>
            <button
              className="w-12 h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center font-bold text-white text-lg"
              onTouchStart={() => keysRef.current.add("w")}
              onTouchEnd={() => keysRef.current.delete("w")}
              onMouseDown={() => keysRef.current.add("w")}
              onMouseUp={() => keysRef.current.delete("w")}
              onMouseLeave={() => keysRef.current.delete("w")}
            >
              ↑
            </button>
          </div>
          <div className="flex gap-4 items-center">
            <button
              className="w-16 h-16 rounded-full bg-emerald-600/20 active:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("k")}
              onTouchEnd={() => keysRef.current.delete("k")}
              onMouseDown={() => keysRef.current.add("k")}
              onMouseUp={() => keysRef.current.delete("k")}
              onMouseLeave={() => keysRef.current.delete("k")}
            >
              Y1
            </button>
            <button
              className="w-16 h-16 rounded-full bg-rose-600/20 active:bg-rose-500/30 border border-rose-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("l")}
              onTouchEnd={() => keysRef.current.delete("l")}
              onMouseDown={() => keysRef.current.add("l")}
              onMouseUp={() => keysRef.current.delete("l")}
              onMouseLeave={() => keysRef.current.delete("l")}
            >
              Y2
            </button>
            <button
              className="w-20 h-14 rounded-full bg-indigo-600/30 active:bg-indigo-500/40 border border-indigo-500/40 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-indigo-500/20"
              onTouchStart={() => keysRef.current.add("i")}
              onTouchEnd={() => keysRef.current.delete("i")}
              onMouseDown={() => keysRef.current.add("i")}
              onMouseUp={() => keysRef.current.delete("i")}
              onMouseLeave={() => keysRef.current.delete("i")}
            >
              SPECIAL
            </button>
          </div>
          {/* P2 controls (right side - mirrored) */}
          <div className="flex gap-2 items-center">
            <button
              className="w-12 h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center font-bold text-white text-lg"
              onTouchStart={() => keysRef.current.add("arrowleft")}
              onTouchEnd={() => keysRef.current.delete("arrowleft")}
              onMouseDown={() => keysRef.current.add("arrowleft")}
              onMouseUp={() => keysRef.current.delete("arrowleft")}
              onMouseLeave={() => keysRef.current.delete("arrowleft")}
            >
              ←
            </button>
            <button
              className="w-12 h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center font-bold text-white text-lg"
              onTouchStart={() => keysRef.current.add("arrowright")}
              onTouchEnd={() => keysRef.current.delete("arrowright")}
              onMouseDown={() => keysRef.current.add("arrowright")}
              onMouseUp={() => keysRef.current.delete("arrowright")}
              onMouseLeave={() => keysRef.current.delete("arrowright")}
            >
              →
            </button>
            <button
              className="w-12 h-12 rounded-lg bg-white/10 active:bg-white/20 flex items-center justify-center font-bold text-white text-lg"
              onTouchStart={() => keysRef.current.add("arrowup")}
              onTouchEnd={() => keysRef.current.delete("arrowup")}
              onMouseDown={() => keysRef.current.add("arrowup")}
              onMouseUp={() => keysRef.current.delete("arrowup")}
              onMouseLeave={() => keysRef.current.delete("arrowup")}
            >
              ↑
            </button>
          </div>
          <div className="flex gap-4 items-center">
            <button
              className="w-16 h-16 rounded-full bg-emerald-600/20 active:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("n")}
              onTouchEnd={() => keysRef.current.delete("n")}
              onMouseDown={() => keysRef.current.add("n")}
              onMouseUp={() => keysRef.current.delete("n")}
              onMouseLeave={() => keysRef.current.delete("n")}
            >
              A1
            </button>
            <button
              className="w-16 h-16 rounded-full bg-rose-600/20 active:bg-rose-500/30 border border-rose-500/40 flex items-center justify-center font-bold text-white text-sm"
              onTouchStart={() => keysRef.current.add("m")}
              onTouchEnd={() => keysRef.current.delete("m")}
              onMouseDown={() => keysRef.current.add("m")}
              onMouseUp={() => keysRef.current.delete("m")}
              onMouseLeave={() => keysRef.current.delete("m")}
            >
              A2
            </button>
            <button
              className="w-20 h-14 rounded-full bg-indigo-600/30 active:bg-indigo-500/40 border border-indigo-500/40 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-indigo-500/20"
              onTouchStart={() => keysRef.current.add("h")}
              onTouchEnd={() => keysRef.current.delete("h")}
              onMouseDown={() => keysRef.current.add("h")}
              onMouseUp={() => keysRef.current.delete("h")}
              onMouseLeave={() => keysRef.current.delete("h")}
            >
              SPECIAL
            </button>
          </div>
          <p className="text-xs text-white/60 mt-2">{i18n.mobile}</p>
        </div>
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
