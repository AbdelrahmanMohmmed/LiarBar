import { useMemo } from "react";

const CONFETTI_COLORS = ["#fbbf24", "#f472b6", "#22d3ee", "#a78bfa", "#4ade80", "#fb923c"];

/** Shared win-screen: confetti burst + a trophy card, used by any lobby sub-game's finished state. */
export default function WinOverlay({
  winnerName,
  color = "#fbbf24",
  subtitle,
}: {
  winnerName: string;
  color?: string;
  subtitle?: string;
}) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 44 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 1.3 + Math.random() * 1.3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 5 + Math.random() * 6,
        rotate: Math.random() * 360,
      })),
    []
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 overflow-hidden rounded-xl">
      {confetti.map((c, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm animate-confetti-fall"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size * 1.4,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}
      <div
        className="relative bg-[#1b0d24] border-2 rounded-2xl px-8 py-6 text-center shadow-2xl animate-bubble-in"
        style={{ borderColor: color }}
      >
        <div className="text-5xl mb-2">🏆</div>
        <div className="text-2xl font-black" style={{ color }}>
          {winnerName}
        </div>
        <div className="text-white/70 text-sm mt-1">{subtitle ?? "Wins!"}</div>
      </div>
    </div>
  );
}
