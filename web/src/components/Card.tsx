import { memo, useMemo } from "react";
import type { Card as CardType } from "@/lib/types";
import { SUIT_SYMBOLS, SUIT_COLORS, parseCardString } from "@/lib/types";
import { useTheme } from "@/lib/themeContext";
import { getDominoImagePath } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface CardProps {
  card?: CardType;
  cardStr?: string;
  faceDown?: boolean;
  small?: boolean;
}

export const Card = memo(function Card({ card: cardProp, cardStr, faceDown = false, small = false }: CardProps) {
  const { assets, theme } = useTheme();

  const card = useMemo(() => {
    if (cardProp) return cardProp;
    if (cardStr) return parseCardString(cardStr);
    return null;
  }, [cardProp, cardStr]);

  if (faceDown) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 bg-gradient-to-br flex items-center justify-center select-none",
          assets.cardBackClass,
          small ? "w-8 h-12" : "w-14 h-20",
        )}
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
        className={cn(
          "rounded-lg border-2 border-amber-700/60 bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] shadow-lg flex items-center justify-center select-none",
          small ? "w-8 h-12 text-[8px]" : "w-14 h-20 text-xs",
        )}
      >
        <span className="text-gray-900 font-mono font-bold">{cardStr ?? "?"}</span>
      </div>
    );
  }

  if (card.type === "dominoe") {
    // All themes render dominoes as proper tile images (both the Light and Dark
    // theme folders ship the full 0–6 double set). If an image ever fails to
    // load we fall back to a clean CSS tile so the value is still readable.
    const size = small ? "w-8 h-12" : "w-14 h-20";
    const textSize = small ? "text-[10px]" : "text-sm";
    const imgPath = getDominoImagePath(card.left, card.right, theme);

    return (
      <div
        className={cn(
          "relative rounded-lg overflow-hidden flex-shrink-0 select-none flex items-center justify-center bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] border border-amber-900/30",
          size,
        )}
      >
        <img
          src={imgPath}
          alt={`domino ${card.left}|${card.right}`}
          className="w-full h-full object-contain"
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const fallback = el.nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "flex";
          }}
        />
        <div
          className="absolute inset-0 flex-col items-center justify-center gap-0.5 hidden"
          style={{ display: "none" }}
        >
          <span className={cn("text-gray-900 font-mono font-bold", textSize)}>{card.left}</span>
          <span className="w-2/3 h-px bg-gray-400" />
          <span className={cn("text-gray-900 font-mono font-bold", textSize)}>{card.right}</span>
        </div>
      </div>
    );
  }

  const size = small ? "w-8 h-12" : "w-14 h-20";
  
  if (theme === "classic") {
    // Map rank to the filename suffix
    let rankFile = card.rank;
    if (card.rank !== "A" && card.rank !== "J" && card.rank !== "Q" && card.rank !== "K" && card.rank !== "10") {
      rankFile = `0${card.rank}` as any;
    }
    const imgPath = `/Cards/card_${card.suit}_${rankFile}.png`;

    return (
      <div
        className={cn(
          "relative rounded-lg overflow-hidden flex-shrink-0 select-none flex items-center justify-center",
          size,
        )}
        style={{ backgroundColor: "#fff" }}
      >
        <img
          src={imgPath}
          alt={`${card.rank} of ${card.suit}`}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  if (theme === "vip") {
    // Map suit to the correct spritesheet file
    const suitFileMap: Record<string, string> = {
      hearts: "Hearts-88x124.png",
      diamonds: "Diamonds-88x124.png",
      clubs: "Clubs-88x124.png",
      spades: "Spades-88x124.png",
    };
    
    // Assume standard 13 rank order: A(0), 2(1), ... 10(9), J(10), Q(11), K(12)
    const rankIndex = {
      "A": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7, "9": 8, "10": 9, "J": 10, "Q": 11, "K": 12,
    }[card.rank] ?? 0;

    const imgPath = `/Cards_VIP/${suitFileMap[card.suit]}`;
    
    // Using CSS background to crop the spritesheet
    // Assuming standard layout: 13 columns of 88px width
    return (
      <div
        className={cn(
          "relative rounded-lg flex-shrink-0 select-none overflow-hidden",
          size,
        )}
      >
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `url('${imgPath}')`,
            backgroundSize: `auto 100%`,
            backgroundPosition: `${(rankIndex / (13 - 1)) * 100}% 0%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    );
  }

  // Standard theme (CSS text based)
  const color = SUIT_COLORS[card.suit];
  const rankSize = small ? "text-[9px]" : "text-xs";
  const symSize = small ? "text-[8px]" : "text-[10px]";
  const centerSym = small ? "text-sm" : "text-xl";

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-gray-300/80 bg-white shadow-lg flex flex-col items-center justify-center select-none overflow-hidden flex-shrink-0",
        size,
      )}
    >
      <span className={cn("absolute top-1 left-1.5 font-bold leading-none", rankSize)} style={{ color }}>
        {card.rank}
      </span>
      <span className={cn("absolute top-3.5 left-1.5 leading-none", symSize)} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={centerSym} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={cn("absolute bottom-1 right-1.5 font-bold leading-none rotate-180", rankSize)} style={{ color }}>
        {card.rank}
      </span>
    </div>
  );
});
