import { useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

const W = 540;
const H = 720;

const PU_COLORS: Record<string, string> = {
  speed: "#a3e635",
  rapid: "#fde047",
  double: "#22d3ee",
  shield: "#818cf8",
};
const PU_LABEL: Record<string, string> = { speed: "»", rapid: "≫", double: "⋔", shield: "⛨" };

function loadImage(src: string): HTMLImageElement {
  const i = new Image();
  i.src = src;
  return i;
}

export default function SpaceInvadersLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputRef = useRef({ dx: 0, dy: 0, fire: false });

  useEffect(() => {
    const socket = getSocket();
    const emit = () => socket.emit("si_input", { ...inputRef.current });

    const skins: Record<string, HTMLImageElement> = {
      trainer: loadImage("/arcade-assets/space-invaders/graphics/ships/trainer.png"),
      beetle: loadImage("/arcade-assets/space-invaders/graphics/ships/beetle.png"),
      enemy1: loadImage("/arcade-assets/space-invaders/graphics/ships/enemy1.png"),
      boss: loadImage("/arcade-assets/space-invaders/graphics/ships/boss.png"),
    };
    const blueBullet = loadImage("/arcade-assets/space-invaders/graphics/bullets/blue_bullet.png");
    const redBullet = loadImage("/arcade-assets/space-invaders/graphics/bullets/red_bullet.png");
    const bg = loadImage("/arcade-assets/space-invaders/graphics/backgrounds/background.png");

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      let changed = false;
      if (k === "arrowleft" || k === "a") { inputRef.current.dx = -1; changed = true; }
      else if (k === "arrowright" || k === "d") { inputRef.current.dx = 1; changed = true; }
      else if (k === "arrowup" || k === "w") { inputRef.current.dy = -1; changed = true; }
      else if (k === "arrowdown" || k === "s") { inputRef.current.dy = 1; changed = true; }
      else if (k === " ") { inputRef.current.fire = true; changed = true; }
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
      if (changed) emit();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      let changed = false;
      if ((k === "arrowleft" || k === "a") && inputRef.current.dx === -1) { inputRef.current.dx = 0; changed = true; }
      else if ((k === "arrowright" || k === "d") && inputRef.current.dx === 1) { inputRef.current.dx = 0; changed = true; }
      else if ((k === "arrowup" || k === "w") && inputRef.current.dy === -1) { inputRef.current.dy = 0; changed = true; }
      else if ((k === "arrowdown" || k === "s") && inputRef.current.dy === 1) { inputRef.current.dy = 0; changed = true; }
      else if (k === " ") { inputRef.current.fire = false; changed = true; }
      if (changed) emit();
    };

    const canvas = canvasRef.current!;
    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const st = stateRef.current;
      const px = ((e.clientX - rect.left) / rect.width) * (st?.width ?? W);
      const py = ((e.clientY - rect.top) / rect.height) * (st?.height ?? H);
      const me = (st?.ships ?? []).find((s: any) => s.playerId === myPlayerId);
      if (me) {
        inputRef.current.dx = px < me.x - 10 ? -1 : px > me.x + 10 ? 1 : 0;
        inputRef.current.dy = py < me.y - 10 ? -1 : py > me.y + 10 ? 1 : 0;
      }
      inputRef.current.fire = true;
      emit();
    };
    const onPointerUp = () => {
      inputRef.current.dx = 0; inputRef.current.dy = 0; inputRef.current.fire = false; emit();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointer);
    canvas.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    const loop = () => {
      const ctx = canvas.getContext("2d");
      const st = stateRef.current;
      if (!ctx || !st) { raf = requestAnimationFrame(loop); return; }
      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, W, H);
      if (bg.width) ctx.drawImage(bg, 0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 2, 2);

      // powerups
      for (const p of st.powerups ?? []) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = PU_COLORS[p.type] ?? "#fff";
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#05060f";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(PU_LABEL[p.type] ?? "?", 0, 1);
        ctx.restore();
      }

      // enemies
      for (const e of st.enemies ?? []) {
        const img = skins.enemy1;
        if (img.width) ctx.drawImage(img, e.x - 27, e.y - 25, 54, 50);
        else { ctx.fillStyle = "#7CFC00"; ctx.beginPath(); ctx.ellipse(e.x, e.y, 24, 20, 0, 0, Math.PI * 2); ctx.fill(); }
      }

      // bursts (explosions)
      for (const b of st.bursts ?? []) {
        const r = 6 + (1 - b.ttl / b.max) * 38;
        ctx.save();
        ctx.globalAlpha = Math.max(0, b.ttl / b.max);
        ctx.strokeStyle = b.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // bullets
      for (const b of st.eBullets ?? []) {
        if (redBullet.width) ctx.drawImage(redBullet, b.x - 4, b.y, 8, 16);
        else { ctx.fillStyle = "#ff5470"; ctx.fillRect(b.x - 4, b.y, 8, 15); }
      }
      for (const b of st.pBullets ?? []) {
        if (blueBullet.width) ctx.drawImage(blueBullet, b.x - 4, b.y, 8, 16);
        else { ctx.fillStyle = "#67e8f9"; ctx.fillRect(b.x - 4, b.y, 8, 15); }
      }

      // ships
      for (const s of st.ships ?? []) {
        if (!s.alive) continue;
        const img = skins[s.skin] || skins.trainer;
        if (img.width) ctx.drawImage(img, s.x - 27, s.y - 25, 54, 50);
        else { ctx.fillStyle = s.color; ctx.beginPath(); ctx.moveTo(s.x, s.y - 25); ctx.lineTo(s.x + 27, s.y + 25); ctx.lineTo(s.x - 27, s.y + 25); ctx.closePath(); ctx.fill(); }
        if (s.shield) {
          ctx.strokeStyle = "rgba(129,140,248,0.9)"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(s.x, s.y, 34, 0, Math.PI * 2); ctx.stroke();
        }
        const badges: string[] = [];
        if (s.speed) badges.push(PU_LABEL.speed); if (s.rapid) badges.push(PU_LABEL.rapid);
        if (s.double) badges.push(PU_LABEL.double);
        if (badges.length) {
          ctx.fillStyle = "#fde047"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(badges.join(" "), s.x, s.y - 34);
        }
      }

      // HUD
      ctx.fillStyle = "#fde047"; ctx.font = "bold 20px 'Baloo 2', sans-serif"; ctx.textAlign = "right";
      ctx.fillText(String(st.score ?? 0), W - 12, 28);
      ctx.fillStyle = "#a78bfa"; ctx.textAlign = "left";
      ctx.fillText(`${isAr ? "مستوى" : "Lv"} ${st.level ?? 1}`, 12, 28);
      for (const s of st.ships ?? []) {
        ctx.fillStyle = s.color; ctx.font = "12px 'Baloo 2', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`${s.name}${s.playerId === myPlayerId ? (isAr ? " (أنت)" : " (You)") : ""}`, s.x, H - 8);
      }

      if (st.phase === "countdown") {
        ctx.fillStyle = "#67e8f9"; ctx.font = "bold 90px 'Baloo 2', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(String(Math.max(1, st.countdownLeft)), W / 2, H / 2 + 30);
      }
      if (st.phase === "finished") {
        ctx.fillStyle = "#67e8f9"; ctx.font = "bold 40px 'Baloo 2', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(isAr ? "انتهت الموجة!" : "Wave Cleared!", W / 2, H / 2);
        ctx.fillStyle = "#fde047"; ctx.font = "bold 26px 'Baloo 2', sans-serif";
        ctx.fillText(`${isAr ? "النقاط" : "Score"}: ${st.score ?? 0}`, W / 2, H / 2 + 40);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [myPlayerId]);

  const i18n = {
    ar: { title: "غزاة الفضاء — تعاون", score: "النقاط", level: "المستوى", countdown: "ابدأ!", dead: "خرجت!", you: "أنت", hint: "الأسهم/WASD للتحرك • مسافة لإطلاق النار • التقط التعزيزات!" },
    en: { title: "Space Invaders — Co-op", score: "Score", level: "Level", countdown: "Go!", dead: "Down!", you: "You", hint: "Arrows/WASD to move • Space to fire • grab power-ups!" },
  }[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-[#05060f]">
      <div className="flex items-center gap-4 flex-wrap justify-center text-sm">
        <span className="text-white font-bold">{i18n.score}: {state?.score ?? 0}</span>
        <span className="text-fuchsia-300">{i18n.level}: {state?.level ?? 1}</span>
        {(state?.ships ?? []).map((s: any) => (
          <span key={s.playerId} className="flex items-center gap-1" style={{ color: s.color }}>
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-white/80">{s.name}{s.playerId === myPlayerId ? ` (${i18n.you})` : ""}</span>
            <span className={s.alive ? "text-emerald-400" : "text-red-400"}>{s.alive ? s.hp : i18n.dead}</span>
          </span>
        ))}
      </div>

      <div className="relative w-full" style={{ maxWidth: 460 }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full rounded-xl border border-white/10 touch-none" style={{ aspectRatio: `${W} / ${H}`, background: "#05060f" }} />
      </div>
      <p className="text-white/40 text-xs text-center max-w-md">{i18n.hint}</p>
    </div>
  );
}
