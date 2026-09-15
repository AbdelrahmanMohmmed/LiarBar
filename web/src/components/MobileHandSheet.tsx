import { memo, useLayoutEffect, useRef } from "react";
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
 * The player's hand on mobile, as a bottom sheet, while it's their turn.
 *
 * Two things were wrong with it and both were invisible until someone actually
 * tried to take a turn on a phone:
 *
 * 1. **The party dock sat on top of the action button.** The dock is fixed to
 *    the bottom of every page, so it covered "Make Claim" completely: you could
 *    see your hand, select cards, and had no reachable way to play them. Fixed
 *    by anchoring to `--party-dock-h` rather than to 0.
 *
 * 2. **At 82vh it hid the entire table.** With thirteen cards there is no
 *    avoiding a tall sheet, but Liar's Bar is a game about the pile — how much
 *    you lose by being caught is the whole decision — and a sheet that covers
 *    the pile removes the information the decision is made on. It's now capped
 *    so the top of the table stays visible, and the cards scroll instead.
 *
 *    Capping it was not enough on its own: the table is a square sized by the
 *    viewport width, so on a 375px phone it stayed 343px tall and centred, and
 *    the sheet still covered the pile and three of the four seats. So the sheet
 *    also publishes its height as `--hand-sheet-h`, the same trick the party
 *    dock uses, and the table area reserves that space and shrinks into what is
 *    left. The table becomes an oval rather than a circle, which is what a card
 *    table looks like anyway.
 *
 * Restyled onto the design tokens along the way; it was the last thing still
 * wearing the old amber-on-forest-green palette.
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
  const sheetRef = useRef<HTMLDivElement>(null);

  /**
   * Publish the sheet's height as `--hand-sheet-h`, or 0 while it is off
   * screen. Read by the table area in Game.tsx; see the note above.
   */
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = sheetRef.current;
    if (!el || !visible) {
      root.style.setProperty("--hand-sheet-h", "0px");
      return;
    }

    const publish = () => {
      root.style.setProperty(
        "--hand-sheet-h",
        `${Math.ceil(el.getBoundingClientRect().height)}px`,
      );
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty("--hand-sheet-h", "0px");
    };
  }, [visible, collapsed]);

  return (
    <div
      ref={sheetRef}
      className={cn(
        "fixed inset-x-0 z-40 flex flex-col rounded-t-xl border-t border-border",
        "bg-surface/98 backdrop-blur transition-transform duration-300 ease-out",
      )}
      style={{
        // Sits directly on top of the party dock. Never 0: see the note above.
        bottom: "var(--party-dock-h)",
        height: collapsed ? 56 : "min(58dvh, 420px)",
        boxShadow: "var(--shadow-3)",
        transform: visible ? "translateY(0)" : "translateY(110%)",
      }}
    >
      {/* Grab handle — tap to collapse and see the whole table. */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex shrink-0 flex-col items-center gap-1 px-4 pt-2 pb-1.5"
        aria-expanded={!collapsed}
      >
        <span className="h-1 w-10 rounded-pill bg-sand/30" />
        <span className="flex w-full items-center justify-between">
          <span className="text-sm font-bold text-coral">
            Your turn &mdash; {cards.length} card{cards.length !== 1 ? "s" : ""}
          </span>
          {collapsed ? (
            <ChevronUp className="w-4 h-4 text-sand" />
          ) : (
            <ChevronDown className="w-4 h-4 text-sand" />
          )}
        </span>
      </button>

      {!collapsed && (
        <>
          {claimLabel && (
            <p className="mx-4 mb-2 shrink-0 rounded-pill bg-coral/15 px-3 py-1.5 text-center font-numeric text-xs text-coral">
              {claimLabel}
            </p>
          )}

          <div className="flex-1 overflow-y-auto px-4 pb-2" style={{ scrollbarWidth: "none" }}>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {cards.map((card, index) => (
                <button
                  key={index}
                  onClick={() => onCardSelect(index)}
                  aria-pressed={selectedCards.includes(index)}
                  className={cn(
                    "transition-transform duration-200",
                    selectedCards.includes(index) && "-translate-y-3 scale-105",
                  )}
                >
                  <Card card={card} />
                </button>
              ))}
            </div>
          </div>

          {/* Skip while nothing is selected; claim once something is. */}
          <div
            className="shrink-0 border-t border-border/60 p-3"
            style={{ paddingBottom: "calc(0.75rem + var(--safe-b))" }}
          >
            {selectedCards.length > 0 ? (
              <button onClick={onPlayClick} className="btn btn-primary w-full">
                <Send className="w-4 h-4" />
                Make claim ({selectedCards.length})
              </button>
            ) : (
              <button onClick={onSkip} className="btn btn-ghost w-full">
                <SkipForward className="w-4 h-4" />
                Skip turn
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
});
