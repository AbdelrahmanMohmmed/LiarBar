import { memo, useMemo } from "react";
import type { Card as CardType } from "@/lib/types";
import { parseCardString, SUIT_SYMBOLS } from "@/lib/types";
import { useTheme } from "@/lib/themeContext";
import { getDominoImagePath } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface CardProps {
  card?: CardType;
  cardStr?: string;
  faceDown?: boolean;
  small?: boolean;
  /** Slightly smaller than the default size, used to fit a full hand on narrow screens. */
  compact?: boolean;
}

export const SuitIcon = memo(function SuitIcon({
  suit,
  className,
  style,
}: {
  suit: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (suit === "hearts") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    );
  }
  if (suit === "diamonds") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M12 2L2 12l10 10 10-10L12 2z"/>
      </svg>
    );
  }
  if (suit === "clubs") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        <path d="M12 9.5a3.5 3.5 0 0 1 3.5-3.5c1.9 0 3.5 1.6 3.5 3.5 0 2.5-3 4-3 4s1.5.5 3 2c1.5 1.5 1.5 3.5 0 5s-3.5 1.5-5 0c-.8-.8-1-2-1-2s-.2 1.2-1 2c-1.5 1.5-3.5 1.5-5 0s-1.5-3.5 0-5c1.5-1.5 3-2 3-2s-3-1.5-3-4C4 7.6 5.6 6 7.5 6A3.5 3.5 0 0 1 12 9.5zm-3 7.5v5h6v-5h-6z"/>
      </svg>
    );
  }
  // spades
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 2C9 5 5 8 5 11.5c0 3 2.5 5.5 5.5 5.5.9 0 1.7-.2 2.5-.5V22h-3v1h8v-1h-3v-5.5c.8.3 1.6.5 2.5.5 3 0 5.5-2.5 5.5-5.5C23 8 19 5 12 2Z"/>
    </svg>
  );
});

export const Card = memo(function Card({ card: cardProp, cardStr, faceDown = false, small = false, compact = false }: CardProps) {
  const { assets, theme } = useTheme();

  const card = useMemo(() => {
    if (cardProp) return cardProp;
    if (cardStr) return parseCardString(cardStr);
    return null;
  }, [cardProp, cardStr]);

  // Standard aspect ratio for playing cards (88x124 VIP sheets ratio)
  const size = small ? "h-12 aspect-[88/124]" : compact ? "h-14 aspect-[88/124]" : "h-20 aspect-[88/124]";

  if (faceDown) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 bg-gradient-to-br flex items-center justify-center select-none shadow-md",
          assets.cardBackClass,
          size,
        )}
      >
        <div className="w-5 h-5 rounded border border-red-600/40 flex items-center justify-center">
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
          size,
          small ? "text-[8px]" : "text-xs",
        )}
      >
        <span className="text-gray-900 font-mono font-bold">{cardStr ?? "?"}</span>
      </div>
    );
  }

  if (card.type === "dominoe") {
    const imgPath = getDominoImagePath(card.left, card.right, theme);
    const textSize = small ? "text-[10px]" : "text-sm";

    return (
      <div
        className={cn(
          "relative flex-shrink-0 select-none flex items-center justify-center overflow-hidden rounded-lg",
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
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] border border-amber-900/30 shadow-lg"
          style={{ display: "none" }}
        >
          <span className={cn("text-gray-900 font-mono font-bold", textSize)}>{card.left}</span>
          <span className="w-2/3 h-px bg-gray-400" />
          <span className={cn("text-gray-900 font-mono font-bold", textSize)}>{card.right}</span>
        </div>
      </div>
    );
  }

    if (theme === "standard") {
    // Render the playing card with pure HTML + CSS (old standard-theme style).
    const suitColor = assets.cardSuitColors[card.suit] ?? "#111827";
    const symbol = SUIT_SYMBOLS[card.suit];
    const cornerRank = cn(
      "absolute top-1 left-1.5 font-bold leading-none",
      small ? "text-[9px]" : "text-xs",
    );
    const cornerSuit = cn(
      "absolute top-3.5 left-1.5 leading-none",
      small ? "text-[8px]" : "text-[10px]",
    );
    const centerSuit = cn(
      "leading-none",
      small ? "text-base" : "text-xl",
    );

    return (
      <div
        className={cn(
          "relative rounded-lg flex-shrink-0 select-none shadow-md bg-white border border-gray-300/80 flex items-center justify-center",
          size,
        )}
        style={{ color: suitColor }}
      >
        <span className={cornerRank} style={{ color: suitColor }}>{card.rank}</span>
        <span className={cornerSuit} style={{ color: suitColor }}>{symbol}</span>
        <span className={centerSuit} style={{ color: suitColor }}>{symbol}</span>
        <span
          className={cn(cornerRank, "bottom-1 right-1.5 rotate-180")}
          style={{ color: suitColor }}
        >
          {card.rank}
        </span>
      </div>
    );
  }

    if (theme === "classic") {
    let rankFile = card.rank;
    if (card.rank !== "A" && card.rank !== "J" && card.rank !== "Q" && card.rank !== "K" && card.rank !== "10") {
      rankFile = `0${card.rank}` as any;
    }
    const imgPath = `/Cards/card_${card.suit}_${rankFile}.png`;

    // Use an img tag with object-cover and scaling to crop out the built-in border from the asset
    return (
      <div
        className={cn(
          "relative rounded-lg overflow-hidden flex-shrink-0 select-none shadow-md bg-transparent",
          size,
        )}
      >
        <img
          src={imgPath}
          alt={`${card.rank} of ${card.suit}`}
          className="w-[115%] h-[115%] max-w-none -ml-[7.5%] -mt-[7.5%] object-fill"
        />
      </div>
    );
  }

    if (theme === "vip") {
    const suitFileMap: Record<string, string> = {
      hearts: "Hearts-88x124.png",
      diamonds: "Diamonds-88x124.png",
      clubs: "Clubs-88x124.png",
      spades: "Spades-88x124.png",
    };

    const rankIndex = {
      "A": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7, "9": 8, "10": 9, "J": 10, "Q": 11, "K": 12,
    }[card.rank] ?? 0;

    const imgPath = `/Cards_VIP/${suitFileMap[card.suit]}`;

    // Each VIP sprite sheet is a 5x3 grid of 88x124 cells (13 cards in order
    // A,2..10,J,Q,K, then 2 empty cells). Select the right cell.
    const col = rankIndex % 5;
    const row = Math.floor(rankIndex / 5);

    return (
      <div
        className={cn(
          "relative rounded-lg flex-shrink-0 select-none overflow-hidden shadow-md",
          size,
        )}
      >
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url('${imgPath}')`,
            backgroundSize: "500% 300%",
            backgroundPosition: `${(col / (5 - 1)) * 100}% ${(row / (3 - 1)) * 100}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    );
  }

  // Fallback (should not be reached for playing cards)
  return (
    <div
      className={cn(
        "relative rounded-lg border border-gray-300/80 bg-gradient-to-br from-white to-gray-50 shadow-md flex items-center justify-center select-none overflow-hidden flex-shrink-0",
        size,
      )}
    >
      <span className="font-bold text-gray-900">{card.rank}</span>
    </div>
  );
});
