import { memo, useCallback } from "react";
import type { Card, Rank } from "@/lib/types";
import { SUIT_SYMBOLS, SUIT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Send, Hand } from "lucide-react";

interface PlayerHandProps {
  cards: Card[];
  selectedCards: number[];
  onCardSelect: (index: number) => void;
  canPlay: boolean;
  onPlayClick: () => void;
}

const PlayingCardView = memo(function PlayingCardView({
  card,
  selected,
  onClick,
  disabled,
  index,
}: {
  card: Card;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
  index: number;
}) {
  if (card.type === "dominoe") {
    return (
      <button
        onClick={onClick}
        disabled={disabled && !selected}
        className={cn(
          "relative w-14 h-20 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 select-none",
          selected
            ? "border-amber-400 bg-amber-500/20 -translate-y-5 shadow-lg shadow-amber-500/30 scale-105 z-10"
            : "border-amber-900/40 bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] hover:border-amber-600/60 hover:-translate-y-2",
          disabled && !selected && "opacity-50 cursor-not-allowed",
        )}
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <div className="w-full h-px bg-gray-400 absolute top-1/2" />
        <span className="text-gray-900 font-mono font-bold text-sm z-10">{card.left}</span>
        <span className="text-gray-900 font-mono font-bold text-sm z-10">{card.right}</span>
      </button>
    );
  }

  const color = SUIT_COLORS[card.suit];
  return (
    <button
      onClick={onClick}
      disabled={disabled && !selected}
      className={cn(
        "relative w-14 h-20 rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center select-none animate-in fade-in",
        selected
          ? "border-amber-400 bg-white -translate-y-5 shadow-lg shadow-amber-500/30 scale-105 z-10"
          : "border-gray-300/80 bg-white hover:border-amber-600/60 hover:-translate-y-2 shadow-md",
        disabled && !selected && "opacity-50 cursor-not-allowed",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <span className="absolute top-1 left-1.5 text-xs font-bold leading-none" style={{ color }}>
        {card.rank}
      </span>
      <span className="absolute top-3.5 left-1.5 text-[10px] leading-none" style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className="text-xl" style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className="absolute bottom-1 right-1.5 text-xs font-bold leading-none rotate-180" style={{ color }}>
        {card.rank}
      </span>
    </button>
  );
});

export const PlayerHand = memo(function PlayerHand({
  cards,
  selectedCards,
  onCardSelect,
  canPlay,
  onPlayClick,
}: PlayerHandProps) {
  const handleCardClick = useCallback(
    (index: number) => onCardSelect(index),
    [onCardSelect],
  );

  if (cards.length === 0) {
    return (
      <div className="bg-[#0d1a0d]/90 backdrop-blur-sm border-t border-amber-900/20 px-4 py-6">
        <div className="flex items-center justify-center text-amber-200/30 text-sm">
          <Hand className="w-4 h-4 mr-2" />
          No cards in hand
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1a0d]/90 backdrop-blur-sm border-t border-amber-900/20 px-4 pt-3 pb-6">
      <div className="flex items-center justify-between mb-3 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-amber-200/60 text-xs">
            Your hand &mdash; {cards.length} card{cards.length !== 1 ? "s" : ""}
          </span>
          {selectedCards.length > 0 && (
            <span className="text-amber-400 text-xs font-bold bg-amber-900/30 px-2 py-0.5 rounded-full">
              {selectedCards.length} selected
            </span>
          )}
        </div>
        {canPlay && selectedCards.length > 0 && (
          <button
            onClick={onPlayClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm shadow-lg shadow-amber-900/30 transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            Make Claim
          </button>
        )}
        {!canPlay && (
          <span className="text-amber-200/30 text-xs italic">
            Wait for your turn
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 max-w-2xl mx-auto">
        {cards.map((card, index) => (
          <PlayingCardView
            key={index}
            card={card}
            index={index}
            selected={selectedCards.includes(index)}
            onClick={() => handleCardClick(index)}
            disabled={!canPlay}
          />
        ))}
      </div>
    </div>
  );
});
