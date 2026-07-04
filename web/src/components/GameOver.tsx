import { memo } from "react";
import type { GameState } from "@/lib/types";
import { Trophy, RotateCcw, Home } from "lucide-react";

interface GameOverProps {
  gameState: GameState;
  myPlayerId: string;
  onBackToLobby: () => void;
  onHome: () => void;
}

export const GameOver = memo(function GameOver({
  gameState,
  myPlayerId,
  onBackToLobby,
  onHome,
}: GameOverProps) {
  const winner = gameState.players.find(
    (p) => p.id === gameState.winner,
  );
  const isMeWinner = winner?.id === myPlayerId;

  const sorted = [...gameState.players].sort(
    (a, b) => a.cardCount - b.cardCount,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-md bg-gradient-to-b from-[#1c1500] to-[#1c0d0d] border border-amber-900/40 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Confetti decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-fade opacity-60"
              style={{
                background:
                  i % 3 === 0 ? "#f59e0b" : i % 3 === 1 ? "#ef4444" : "#10b981",
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.15}s`,
                transform: `scale(${0.5 + Math.random() * 1.5})`,
              }}
            />
          ))}
        </div>

        <div className="p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/20 border-2 border-amber-400/40">
            <Trophy className="w-10 h-10 text-amber-400" />
          </div>

          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {isMeWinner ? "You Won!" : `${winner?.name || "Someone"} Wins!`}
            </h2>
            <p className="text-amber-200/60 text-sm">
              {isMeWinner
                ? "You emptied your hand first. Well played!"
                : "Better luck next round."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-amber-200/40 text-xs uppercase tracking-wider">
              Final Standings
            </p>
            {sorted.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#2a1515]/60 border border-amber-900/20"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0
                        ? "bg-amber-500 text-white"
                        : idx === 1
                          ? "bg-gray-400 text-gray-900"
                          : idx === 2
                            ? "bg-amber-700 text-white"
                            : "bg-[#3a1f1f] text-amber-200/40"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`font-medium ${
                      player.id === myPlayerId
                        ? "text-amber-400"
                        : "text-white"
                    }`}
                  >
                    {player.name}
                    {player.id === myPlayerId && (
                      <span className="text-amber-400/60 text-xs ml-1">
                        (you)
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-amber-200/40 font-mono text-sm">
                  {player.cardCount} cards
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onBackToLobby}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-900/40 text-amber-200 hover:bg-amber-900/20 transition-all text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Rematch
            </button>
            <button
              onClick={onHome}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold shadow-lg transition-all active:scale-95"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
