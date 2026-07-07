import { memo, useMemo, useState, useEffect } from "react";
import type { GameState, Card, Suit } from "@/lib/types";
import { SUIT_SYMBOLS, SUIT_COLORS, declarationToString } from "@/lib/types";
import { Card as CardView } from "@/components/Card";
import { cn } from "@/lib/utils";
import { Crown, Bot, User, Zap, Clock, Eye } from "lucide-react";

interface GameTableProps {
  gameState: GameState;
  myPlayerId: string;
  selectedCards: number[];
  onCardSelect: (index: number) => void;
}

const CARD_BACK =
  "bg-gradient-to-br from-red-800 to-red-950 border border-red-700/60";

function getPlayerPositions(count: number, radius: number = 200) {
  const positions: { x: number; y: number; rotate: number; scale: number }[] = [];
  const startAngle = -90;
  for (let i = 0; i < count; i++) {
    const angle = startAngle + (360 / count) * i;
    const rad = (angle * Math.PI) / 180;
    const dist = Math.abs(Math.sin(rad));
    const scale = 0.85 + dist * 0.15;
    positions.push({
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      rotate: angle + 90,
      scale,
    });
  }
  return positions;
}

const MiniCard = memo(function MiniCard({
  card,
  small = false,
  faceDown = false,
}: {
  card: Card;
  small?: boolean;
  faceDown?: boolean;
}) {
  if (faceDown) {
    return (
      <div
        className={cn(
          `${CARD_BACK} rounded shadow flex items-center justify-center`,
          small ? "w-5 h-7" : "w-8 h-12",
        )}
      >
        <div className="w-3 h-3 rounded border border-red-600/40 flex items-center justify-center">
          <span className="text-red-500/60 text-[6px] font-bold">?</span>
        </div>
      </div>
    );
  }

  if (card.type === "dominoe") {
    return (
      <div
        className={cn(
          "bg-ivory-100 text-gray-900 rounded font-mono font-bold flex flex-col items-center justify-center border border-gray-300 shadow",
          small ? "w-5 h-7 text-[7px]" : "w-8 h-12 text-[10px]",
        )}
      >
        <span>{card.left}</span>
        <span className="w-full h-px bg-gray-400" />
        <span>{card.right}</span>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  return (
    <div
      className={cn(
        "bg-white rounded flex flex-col items-center justify-center border border-gray-200 shadow-sm",
        small ? "w-5 h-7" : "w-8 h-12",
      )}
    >
      <span className={cn("font-bold leading-none", small ? "text-[8px]" : "text-xs")} style={{ color }}>
        {card.rank}
      </span>
      <span className={cn("leading-none", small ? "text-[7px]" : "text-[10px]")} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
});

function CardFan({ cards, max = 5 }: { cards: Card[]; max?: number }) {
  const display = cards.slice(-max);
  return (
    <div className="flex -space-x-2">
      {display.map((card, i) => (
        <MiniCard key={i} card={card} small faceDown />
      ))}
      {cards.length > max && (
        <div className="w-5 h-7 bg-amber-900/50 rounded flex items-center justify-center text-[8px] text-amber-200 font-bold">
          +{cards.length - max}
        </div>
      )}
    </div>
  );
}

/** Pile of face-down cards in center */
function CardPile({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="w-10 h-14 rounded-lg border-2 border-dashed border-amber-800/30 flex items-center justify-center">
          <span className="text-amber-800/30 text-xs">0</span>
        </div>
        <p className="text-amber-200/30 text-xs mt-2 font-mono">Empty pile</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: 44, height: 60 }}>
        {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
          <div
            key={i}
            className="absolute w-10 h-14 rounded-lg bg-gradient-to-br from-red-800 to-red-950 border border-red-700/60 shadow-lg"
            style={{
              left: `${i * 1.5}px`,
              top: `${i * 0.8}px`,
              zIndex: i,
              transform: `rotate(${(i - 2) * 2}deg)`,
            }}
          />
        ))}
        <div
          className="absolute w-10 h-14 rounded-lg bg-gradient-to-br from-red-800 to-red-950 border border-red-700/60 shadow-lg flex items-center justify-center"
          style={{ left: 0, top: 0, zIndex: 10 }}
        >
          <div className="w-6 h-6 rounded border border-red-600/40 flex items-center justify-center">
            <span className="text-red-500/60 text-[8px] font-bold">?</span>
          </div>
        </div>
      </div>
      <p className="text-amber-200/50 text-xs mt-1 font-mono">
        {count} card{count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export const GameTable = memo(function GameTable({
  gameState,
  myPlayerId,
  selectedCards,
  onCardSelect,
}: GameTableProps) {
  const positions = useMemo(
    () => getPlayerPositions(gameState.players.length),
    [gameState.players.length],
  );

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!gameState.challengeDeadline || gameState.phase !== "waiting_for_challenge") {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((gameState.challengeDeadline! - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState.challengeDeadline, gameState.phase]);

  return (
    <div className="relative w-full max-w-[650px] aspect-square mx-auto perspective-1000">
      {/* 3D Table surface with perspective */}
      <div className="absolute inset-[12%] rounded-full preserve-3d" style={{ transform: "rotateX(15deg)" }}>
        {/* Table base */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#1a3a1a] via-[#0f2a0f] to-[#0a1f0a] border-[8px] border-amber-900/40 shadow-2xl shadow-black/60">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,_#1a4a1a_0%,_#0f2a0f_50%,_#0a1a0a_100%)]" />
          <div className="absolute inset-[10%] rounded-full border border-amber-700/20" />
          <div className="absolute inset-[22%] rounded-full border border-amber-700/15" />

          {/* Center pile */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <CardPile count={gameState.pileCount} />

              {gameState.lastDeclaration && (
                <p className="text-amber-400/60 text-[10px] mt-1 animate-in fade-in font-mono">
                  Claim: {declarationToString(gameState.lastDeclaration, gameState.claimType)}
                </p>
              )}

              {/* Challenge countdown */}
              {countdown !== null && countdown > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1 text-red-400 font-mono text-sm font-bold animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  {countdown}s
                </div>
              )}

              {/* Revealed cards */}
              {gameState.revealedCards && gameState.revealedCards.length > 0 && (
                <div className="mt-2 animate-in fade-in">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Eye className="w-3 h-3 text-red-400" />
                    <span className="text-red-400 text-[10px] font-semibold">Revealed:</span>
                  </div>
                  <div className="flex gap-1 justify-center flex-wrap max-w-[150px] mx-auto">
                    {gameState.revealedCards.map((cardStr, i) => (
                      <CardView key={i} cardStr={cardStr} small />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Player slots */}
      {gameState.players.map((player, idx) => {
        const pos = positions[idx];
        if (!pos) return null;

        const isMe = player.id === myPlayerId;
        const isCurrent =
          gameState.currentTurn === idx &&
          (gameState.phase === "playing" ||
            gameState.phase === "waiting_for_challenge");
        const isLastPlayer = player.id === gameState.lastPlayerId;

        return (
          <div
            key={player.id}
            className="absolute transition-all duration-500"
            style={{
              left: `calc(50% + ${pos.x}px)`,
              top: `calc(50% + ${pos.y}px)`,
              transform: `translate(-50%, -50%) scale(${pos.scale})`,
              zIndex: isCurrent ? 20 : 10,
            }}
          >
            <div
              className={cn(
                "flex flex-col items-center gap-1.5 p-2.5 rounded-xl min-w-[90px] transition-all duration-300",
                isCurrent &&
                  "bg-amber-500/15 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20 scale-110",
                isLastPlayer &&
                  gameState.phase === "waiting_for_challenge" &&
                  "bg-red-500/10 ring-2 ring-red-400/40",
                !isCurrent && !isLastPlayer && "bg-black/30 backdrop-blur-sm",
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner transition-all relative",
                  isMe
                    ? "bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-300/50"
                    : player.isBot
                      ? "bg-gradient-to-br from-gray-600 to-gray-800"
                      : "bg-gradient-to-br from-emerald-700 to-emerald-900",
                )}
              >
                {player.isBot ? (
                  <Bot className="w-5 h-5" />
                ) : player.isHost ? (
                  <Crown className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}

                {/* Connection indicator */}
                {!player.isConnected && !player.isBot && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-black" />
                )}
                {player.isConnected && !player.isBot && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                )}
              </div>

              {/* Name */}
              <p
                className={cn(
                  "text-xs font-medium text-center max-w-[90px] truncate",
                  isCurrent ? "text-amber-200" : "text-amber-100/70",
                )}
              >
                {player.name}
                {isMe && (
                  <span className="text-amber-400/60 ml-0.5">(you)</span>
                )}
              </p>

              {/* Card count */}
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all",
                    isCurrent
                      ? "bg-amber-500/40 text-amber-200"
                      : "bg-amber-900/30 text-amber-200/60",
                    player.cardCount === 0 && "text-green-400 bg-green-900/30",
                  )}
                >
                  {player.cardCount}
                </span>
                {isCurrent && (
                  <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
                )}
              </div>

              {/* Card fan (face-down cards) */}
              {player.cardCount > 0 && (
                <CardFan cards={Array(player.cardCount).fill(null)} max={4} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
