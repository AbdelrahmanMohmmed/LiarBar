import { memo, useCallback } from "react";
import type { Card as CardType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Send, Hand } from "lucide-react";
import { Card } from "@/components/Card";

interface PlayerHandProps {
  cards: CardType[];
  selectedCards: number[];
  onCardSelect: (index: number) => void;
  canPlay: boolean;
  onPlayClick: () => void;
}

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
          <button
            key={index}
            onClick={() => handleCardClick(index)}
            disabled={!canPlay}
            className={cn(
              "transition-all duration-200",
              selectedCards.includes(index) && "-translate-y-5 scale-105 z-10",
              !canPlay && !selectedCards.includes(index) && "opacity-50 cursor-not-allowed",
            )}
          >
            <Card card={card} />
          </button>
        ))}
      </div>
    </div>
  );
});
