import { memo, useMemo } from "react";
import type { Card } from "@/lib/types";
import { parseCardString, SUIT_SYMBOLS, SUIT_COLORS } from "@/lib/types";

interface RevealedCardViewProps {
  cardStr: string;
}

export const RevealedCardView = memo(function RevealedCardView({
  cardStr,
}: RevealedCardViewProps) {
  const card = useMemo(() => parseCardString(cardStr), [cardStr]);

  if (!card) {
    return (
      <div className="w-12 h-16 rounded-lg bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] border border-amber-700/60 shadow-lg flex items-center justify-center">
        <span className="text-gray-900 font-mono text-xs font-bold">
          {cardStr}
        </span>
      </div>
    );
  }

  return <CardFace card={card} />;
});

function CardFace({ card }: { card: Card }) {
  if (card.type === "dominoe") {
    return (
      <div className="w-12 h-16 rounded-lg bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] border border-amber-700/60 shadow-lg flex flex-col items-center justify-center gap-0.5 select-none">
        <div className="w-full h-px bg-gray-400 absolute" />
        <span className="text-gray-900 font-mono font-bold text-xs z-10">{card.left}</span>
        <span className="text-gray-900 font-mono font-bold text-xs z-10">{card.right}</span>
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  return (
    <div className="w-12 h-16 rounded-lg bg-white border border-gray-300 shadow-lg flex flex-col items-center justify-center select-none">
      <span className="absolute top-1 left-1 text-[9px] font-bold leading-none" style={{ color }}>
        {card.rank}
      </span>
      <span className="absolute top-3 left-1 text-[8px] leading-none" style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className="text-base" style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className="absolute bottom-1 right-1 text-[9px] font-bold leading-none rotate-180" style={{ color }}>
        {card.rank}
      </span>
    </div>
  );
}
