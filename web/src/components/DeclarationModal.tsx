import { useState, useCallback, useMemo, memo } from "react";
import type { Card, CardDeclaration, GameVariant, ClaimType, Suit, Rank } from "@/lib/types";
import { SUIT_SYMBOLS, SUIT_COLORS, declarationToString } from "@/lib/types";
import { useLanguage } from "@/lib/languageContext";
import { X, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];
const DOMINO_VALUES = [0, 1, 2, 3, 4, 5, 6];

interface DeclarationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (declaration: CardDeclaration) => void;
  selectedCards: Card[];
  variant: GameVariant;
  claimType?: ClaimType;
  currentRequiredClaim?: CardDeclaration | null;
}

/** Find numbers that all selected dominoes have in common (truthful options) */
function commonDominoValues(cards: Card[]): number[] {
  const dominoes = cards.filter((c) => c.type === "dominoe") as (Card & { type: "dominoe"; left: number; right: number })[];
  if (dominoes.length === 0) return [];
  const common = new Set([dominoes[0].left, dominoes[0].right]);
  for (let i = 1; i < dominoes.length; i++) {
    const d = dominoes[i];
    for (const v of common) {
      if (d.left !== v && d.right !== v) {
        common.delete(v);
      }
    }
    if (common.size === 0) break;
  }
  return [...common];
}

export const DeclarationModal = memo(function DeclarationModal({
  open,
  onClose,
  onSubmit,
  selectedCards,
  variant,
  claimType,
  currentRequiredClaim,
}: DeclarationModalProps) {
  const { t } = useLanguage();
  const forcedSuit = currentRequiredClaim?.type === "playing-card" ? currentRequiredClaim.suit : undefined;
  const forcedRank = currentRequiredClaim?.type === "playing-card" ? currentRequiredClaim.rank : undefined;
  const forcedDominoValue = currentRequiredClaim?.type === "dominoe" ? currentRequiredClaim.value : undefined;
  const isLocked = !!currentRequiredClaim;

  const [declaredRank, setDeclaredRank] = useState<Rank>(forcedRank ?? "A");
  const [declaredSuit, setDeclaredSuit] = useState<Suit>(forcedSuit ?? "hearts");
  const [dominoValue, setDominoValue] = useState(forcedDominoValue ?? 0);

  const count = selectedCards.length;

  const effectiveRank = isLocked ? forcedRank! : declaredRank;
  const effectiveSuit = isLocked ? forcedSuit! : declaredSuit;
  const effectiveDominoValue = isLocked ? forcedDominoValue! : dominoValue;

  const handleSubmit = useCallback(() => {
    if (count < 1) return;
    if (variant === "cards") {
      onSubmit({ type: "playing-card", rank: effectiveRank, suit: effectiveSuit, count });
    } else {
      onSubmit({ type: "dominoe", value: effectiveDominoValue, count });
    }
  }, [variant, effectiveRank, effectiveSuit, effectiveDominoValue, count, onSubmit]);

  const truthPreview = useMemo(() => {
    if (selectedCards.length === 0) return "nothing";
    const first = selectedCards[0];
    if (variant === "cards" && first.type === "playing-card") {
      if (claimType === "suit") {
        const allSameSuit = selectedCards.every(
          (c) => c.type === "playing-card" && c.suit === first.suit,
        );
        if (allSameSuit) return `${SUIT_SYMBOLS[first.suit]} ${first.suit}`;
        return "mixed suits";
      }
      if (claimType === "rank") {
        const allSameRank = selectedCards.every(
          (c) => c.type === "playing-card" && c.rank === first.rank,
        );
        if (allSameRank) return `${first.rank}s`;
        return "mixed ranks";
      }
      const allSame = selectedCards.every(
        (c) => c.type === "playing-card" && c.suit === first.suit && c.rank === first.rank,
      );
      if (allSame) return `${first.rank}${SUIT_SYMBOLS[first.suit]}`;
      return "mixed cards";
    }
    if (first.type === "dominoe") {
      const common = commonDominoValues(selectedCards);
      if (common.length > 0) return `all contain ${common.join(" or ")}`;
      return "no common number";
    }
    return "mixed";
  }, [selectedCards, variant, claimType]);

  const previewClaim = useMemo(() => {
    if (variant === "cards") {
      if (claimType === "suit") {
        return `${count}x ${SUIT_SYMBOLS[effectiveSuit]} ${effectiveSuit}`;
      }
      if (claimType === "rank") {
        return `${count}x ${effectiveRank}`;
      }
      return `${count}x ${effectiveRank}${SUIT_SYMBOLS[effectiveSuit]}`;
    }
    return `${count}x number ${effectiveDominoValue}`;
  }, [variant, claimType, effectiveRank, effectiveSuit, effectiveDominoValue, count]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm bg-[#1c0d0d]/95 backdrop-blur-xl border border-amber-900/40 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-amber-900/20">
          <h3 className="text-white font-bold text-lg">{t("claim.title")}</h3>
          <button onClick={onClose} className="text-amber-200/40 hover:text-white p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-amber-200/60 text-xs mb-2">
              {t("claim.playing")} {count} {count === 1 ? t("claim.card") : t("claim.cards")}:
            </p>
            <div className="flex gap-1 justify-center flex-wrap">
              {selectedCards.map((card, i) => (
                <div key={i} className="w-10 h-14 rounded border border-amber-900/40 bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] flex items-center justify-center">
                  {card.type === "playing-card" ? (
                    <span className="text-lg font-bold" style={{ color: SUIT_COLORS[card.suit] }}>
                      {SUIT_SYMBOLS[card.suit]}
                    </span>
                  ) : (
                    <span className="text-gray-900 font-mono text-xs font-bold">
                      {card.left}|{card.right}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-amber-200/60 text-xs mb-2">
              {t("claim.declare_as")} {count} {count === 1 ? t("claim.card") : t("claim.cards")}:
            </p>

            {isLocked ? (
              // LOCKED claim — must match currentRequiredClaim
              <div className="bg-gradient-to-r from-amber-900/40 to-amber-800/20 border border-amber-600/40 rounded-xl p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-amber-400 text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t("claim.locked")}</span>
                </div>
                <p className="text-white font-bold text-lg">
                  {previewClaim}
                </p>
                {currentRequiredClaim && (
                  <p className="text-amber-200/40 text-[10px]">
                    {t("claim.required")} {declarationToString(currentRequiredClaim, claimType)}
                  </p>
                )}
                <p className="text-amber-200/30 text-[10px]">
                  {t("claim.actually_playing")} {truthPreview}
                </p>
              </div>
            ) : variant === "cards" && claimType === "suit" ? (
              // SUIT-ONLY mode
              <div className="space-y-3">
                <div>
                  <p className="text-amber-200/40 text-[10px] mb-1.5">{t("claim.suit")}</p>
                  <div className="flex gap-2">
                    {SUITS.map((suit) => (
                      <button
                        key={suit}
                        onClick={() => setDeclaredSuit(suit)}
                        className={cn(
                          "flex-1 py-3 rounded-md text-lg font-bold transition-all",
                          declaredSuit === suit
                            ? "bg-amber-600 text-white shadow shadow-amber-900/50 scale-105"
                            : "bg-[#2a1515] hover:bg-[#3a1f1f]",
                        )}
                      >
                        <span style={{ color: declaredSuit === suit ? "white" : SUIT_COLORS[suit] }}>
                          {SUIT_SYMBOLS[suit]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#2a1515] rounded-lg p-3 text-center">
                  <p className="text-amber-200/40 text-[10px] mb-1">{t("claim.your_claim")}</p>
                  <p className="text-white font-bold text-lg">
                    {count}x <span style={{ color: SUIT_COLORS[effectiveSuit] }}>{SUIT_SYMBOLS[effectiveSuit]} {effectiveSuit}</span>
                  </p>
                  <p className="text-amber-200/30 text-[10px] mt-1">
                    {t("claim.actually_playing")} {truthPreview}
                  </p>
                </div>
              </div>
            ) : variant === "cards" && claimType === "rank" ? (
              // RANK-ONLY mode
              <div className="space-y-3">
                <div>
                  <p className="text-amber-200/40 text-[10px] mb-1.5">{t("claim.rank")}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {RANKS.map((rank) => (
                      <button
                        key={rank}
                        onClick={() => setDeclaredRank(rank)}
                        className={cn(
                          "py-1.5 rounded-md text-sm font-bold transition-all",
                          declaredRank === rank
                            ? "bg-amber-600 text-white shadow shadow-amber-900/50"
                            : "bg-[#2a1515] text-amber-200/70 hover:bg-[#3a1f1f]",
                        )}
                      >
                        {rank}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#2a1515] rounded-lg p-3 text-center">
                  <p className="text-amber-200/40 text-[10px] mb-1">{t("claim.your_claim")}</p>
                  <p className="text-white font-bold text-lg">
                    {count}x {effectiveRank}
                  </p>
                  <p className="text-amber-200/30 text-[10px] mt-1">
                    {t("claim.actually_playing")} {truthPreview}
                  </p>
                </div>
              </div>
            ) : variant === "cards" ? (
              // BOTH rank AND suit mode
              <div className="space-y-3">
                <div>
                  <p className="text-amber-200/40 text-[10px] mb-1.5">{t("claim.rank")}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {RANKS.map((rank) => (
                      <button
                        key={rank}
                        onClick={() => setDeclaredRank(rank)}
                        className={cn(
                          "py-1.5 rounded-md text-sm font-bold transition-all",
                          declaredRank === rank
                            ? "bg-amber-600 text-white shadow shadow-amber-900/50"
                            : "bg-[#2a1515] text-amber-200/70 hover:bg-[#3a1f1f]",
                        )}
                      >
                        {rank}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-amber-200/40 text-[10px] mb-1.5">{t("claim.suit")}</p>
                  <div className="flex gap-2">
                    {SUITS.map((suit) => (
                      <button
                        key={suit}
                        onClick={() => setDeclaredSuit(suit)}
                        className={cn(
                          "flex-1 py-2 rounded-md text-lg font-bold transition-all",
                          declaredSuit === suit
                            ? "bg-amber-600 text-white shadow shadow-amber-900/50 scale-105"
                            : "bg-[#2a1515] hover:bg-[#3a1f1f]",
                        )}
                      >
                        <span style={{ color: declaredSuit === suit ? "white" : SUIT_COLORS[suit] }}>
                          {SUIT_SYMBOLS[suit]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#2a1515] rounded-lg p-3 text-center">
                  <p className="text-amber-200/40 text-[10px] mb-1">{t("claim.your_claim")}</p>
                  <p className="text-white font-bold text-lg">
                    {count}x{" "}
                    <span style={{ color: SUIT_COLORS[effectiveSuit] }}>
                      {effectiveRank}{SUIT_SYMBOLS[effectiveSuit]}
                    </span>
                  </p>
                  <p className="text-amber-200/30 text-[10px] mt-1">
                    {t("claim.actually_playing")} {truthPreview}
                  </p>
                </div>
              </div>
            ) : (
              // DOMINOES mode – single number claim
              <div className="space-y-3">
                <div>
                  <p className="text-amber-200/40 text-[10px] mb-1.5">{t("claim.number")}</p>
                  <div className="flex gap-1">
                    {DOMINO_VALUES.map((n) => (
                      <button
                        key={n}
                        onClick={() => setDominoValue(n)}
                        className={cn(
                          "flex-1 py-3 rounded-md text-lg font-bold transition-all",
                          dominoValue === n
                            ? "bg-amber-600 text-white shadow shadow-amber-900/50 scale-105"
                            : "bg-[#2a1515] text-amber-200/70 hover:bg-[#3a1f1f]",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#2a1515] rounded-lg p-3 text-center">
                  <p className="text-amber-200/40 text-[10px] mb-1">{t("claim.your_claim")}</p>
                  <p className="text-white font-bold text-lg font-mono">
                    {count}x number {effectiveDominoValue}
                  </p>
                  <p className="text-amber-200/30 text-[10px] mt-1">
                    {t("claim.actually_playing")} {truthPreview}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-amber-900/20">
          <button
            onClick={handleSubmit}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-900/30 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            {t("claim.confirm")} ({previewClaim})
          </button>
          <p className="text-amber-200/20 text-[10px] text-center mt-2">
            {t("claim.you_can_lie")}
          </p>
        </div>
      </div>
    </div>
  );
});
