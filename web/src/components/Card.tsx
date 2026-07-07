import { memo, useMemo } from "react";
import type { Card as CardType } from "@/lib/types";
import { SUIT_SYMBOLS, SUIT_COLORS, parseCardString } from "@/lib/types";

interface CardProps {
  card?: CardType;
  cardStr?: string;
  faceDown?: boolean;
  small?: boolean;
}

export const Card = memo(function Card({ card: cardProp, cardStr, faceDown = false, small = false }: CardProps) {
  const card = useMemo(() => {
    if (cardProp) return cardProp;
    if (cardStr) return parseCardString(cardStr);
    return null;
  }, [cardProp, cardStr]);

  if (faceDown) {
    return (
      <div
        className={`rounded-lg border-2 border-red-700/60 bg-gradient-to-br from-red-800 to-red-950 flex items-center justify-center select-none ${
          small ? "w-8 h-12" : "w-14 h-20"
        }`}
      >
        <div className="w-6 h-6 rounded border border-red-600/40 flex items-center justify-center">
          <span className="text-red-500/60 text-[8px] font-bold">?</span>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div
        className={`rounded-lg border-2 border-amber-700/60 bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] shadow-lg flex items-center justify-center select-none ${
          small ? "w-8 h-12 text-[8px]" : "w-14 h-20 text-xs"
        }`}
      >
        <span className="text-gray-900 font-mono font-bold">{cardStr ?? "?"}</span>
      </div>
    );
  }

  if (card.type === "dominoe") {
    const size = small ? "w-8 h-12" : "w-14 h-20";
    const textSize = small ? "text-[10px]" : "text-sm";
    return (
      <div
        className={`relative ${size} rounded-lg border-2 border-amber-900/40 bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] shadow-lg flex flex-col items-center justify-center gap-1 select-none overflow-hidden flex-shrink-0`}
      >
        <div className="w-full h-px bg-gray-400 absolute top-1/2" />
        <span className={`text-gray-900 font-mono font-bold z-10 ${textSize}`}>{card.left}</span>
        <span className={`text-gray-900 font-mono font-bold z-10 ${textSize}`}>{card.right}</span>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  const size = small ? "w-8 h-12" : "w-14 h-20";
  const rankSize = small ? "text-[9px]" : "text-xs";
  const symSize = small ? "text-[8px]" : "text-[10px]";
  const centerSym = small ? "text-sm" : "text-xl";

  return (
    <div
      className={`relative ${size} rounded-lg border-2 border-gray-300/80 bg-white shadow-lg flex flex-col items-center justify-center select-none overflow-hidden flex-shrink-0`}
    >
      <span className={`absolute top-1 left-1.5 font-bold leading-none ${rankSize}`} style={{ color }}>
        {card.rank}
      </span>
      <span className={`absolute top-3.5 left-1.5 leading-none ${symSize}`} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={centerSym} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={`absolute bottom-1 right-1.5 font-bold leading-none rotate-180 ${rankSize}`} style={{ color }}>
        {card.rank}
      </span>
    </div>
  );
});
