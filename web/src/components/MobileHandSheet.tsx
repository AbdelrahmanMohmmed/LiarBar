import { memo } from "react";
import type { Card as CardType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Send, SkipForward, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/Card";

interface MobileHandSheetProps {
  /** Slides the sheet on/off screen; kept mounted so the slide transition can play. */
  visible: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  cards: CardType[];
  selectedCards: number[];
  onCardSelect: (index: number) => void;
  onPlayClick: () => void;
  onSkip: () => void;
  /** Formatted reminder of what must be claimed, e.g. "Current claim: 2x Hearts". */
  claimLabel: string | null;
}

/**
 * Full-screen takeover for the player's hand on mobile, shown while it's the
 * player's turn. Unlike the compact in-flow hand bar, this shows every card
 * at full size in a scrollable grid so nothing needs to be squeezed to fit,
 * and lets the player select cards and make their claim without needing to
 * see the table.
 */
export const MobileHandSheet = memo(function MobileHandSheet({
  visible,
  collapsed,
  onToggleCollapse,
  cards,
  selectedCards,
  onCardSelect,
  onPlayClick,
  onSkip,
  claimLabel,
}: MobileHandSheetProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-3xl border-t-2 border-amber-900/40 bg-[#0d1a0d] shadow-[0_-8px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out"
      style={{
        height: collapsed ? 64 : "82vh",
        transform: visible ? "translateY(0)" : "translateY(110%)",
      }}
    >
      {/* Grab handle / header — tap to collapse and peek at the table */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex shrink-0 flex-col items-center gap-1.5 px-4 pt-2 pb-2"
      >
        <span className="h-1 w-10 rounded-full bg-amber-700/50" />
        <span className="flex w-full items-center justify-between">
          <span className="text-sm font-bold text-amber-300">
            Your Turn &mdash; {cards.length} card{cards.length !== 1 ? "s" : ""}
          </span>
          {collapsed ? <ChevronUp className="w-4 h-4 text-amber-200/60" /> : <ChevronDown className="w-4 h-4 text-amber-200/60" />}
        </span>
      </button>

      {!collapsed && (
        <>
          {claimLabel && (
            <p className="mx-4 mb-2 shrink-0 rounded-full bg-amber-900/30 px-3 py-1.5 text-center font-mono text-xs text-amber-300">
              {claimLabel}
            </p>
          )}

          {/* Scrollable full-size hand */}
          <div className="flex-1 overflow-y-auto px-4 pb-2">
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {cards.map((card, index) => (
                <button
                  key={index}
                  onClick={() => onCardSelect(index)}
                  className={cn(
                    "transition-all duration-200",
                    selectedCards.includes(index) && "-translate-y-3 scale-105",
                  )}
                >
                  <Card card={card} />
                </button>
              ))}
            </div>
          </div>

          {/* Footer action — skip while nothing is selected, claim once it is */}
          <div className="shrink-0 border-t border-amber-900/20 p-3">
            {selectedCards.length > 0 ? (
              <button
                onClick={onPlayClick}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold shadow-lg shadow-amber-900/30 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                Make Claim ({selectedCards.length})
              </button>
            ) : (
              <button
                onClick={onSkip}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-amber-900/40 text-amber-200/80 hover:bg-[#2a1515] transition-all"
              >
                <SkipForward className="w-4 h-4" />
                Skip Turn
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});
