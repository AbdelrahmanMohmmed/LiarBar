import { useEffect, useRef } from "react";
import DominoTile from "./DominoTile";
import type { PlacedTile, BoardEnds } from "@/lib/dominoTypes";

/**
 * The table: the snake of played tiles, plus the two open ends.
 *
 * ## Why a scroller and not a bending snake
 *
 * The obvious thing is to lay the snake out the way it sits on a real table —
 * running right, turning down, running back left. Every implementation of that
 * I have seen has the same two problems on a phone: tiles collide at the
 * turns, and as the round goes on the whole arrangement shrinks until nothing
 * is legible. A player then cannot answer the only question the board has to
 * answer, which is *what are the two open ends*.
 *
 * So the snake is a single horizontal run in a scroller, and the open ends are
 * pinned as large permanent markers at either side. The board scrolls itself
 * to whichever end just changed, so the last move is always in view without
 * anyone dragging. You lose the visual romance of the bent snake; you gain a
 * board that stays readable at tile 28 on a 375px screen, which is where this
 * game is actually played.
 *
 * Doubles render perpendicular, because that is the one piece of physical
 * domino grammar that carries real information — it's how you spot a spinner
 * at a glance — and it costs nothing here.
 */

interface Props {
  board: PlacedTile[];
  ends: BoardEnds;
  /** Highlight the end(s) the player's selected tile could go on. */
  highlightEnds?: Array<"left" | "right">;
  onEndClick?: (end: "left" | "right") => void;
  /** seq of the most recent tile, for the landing animation. */
  lastSeq?: number;
  /** Which end changed last, so the scroller knows where to look. */
  lastEnd?: "left" | "right" | null;
  tileSize?: number;
}

function EndMarker({
  value,
  side,
  highlighted,
  onClick,
}: {
  value: number | null;
  side: "left" | "right";
  highlighted: boolean;
  onClick?: () => void;
}) {
  const label = side === "left" ? "Left end" : "Right end";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${label}: ${value ?? "open"}`}
      className={[
        "shrink-0 grid place-items-center rounded-lg border-2 transition",
        "w-12 h-16 sm:w-14 sm:h-20",
        highlighted
          ? "border-coral bg-coral/15 pulse-glow"
          : "border-border bg-surface-sunken",
        onClick ? "cursor-pointer active:scale-95" : "cursor-default",
      ].join(" ")}
    >
      <span className="font-numeric text-2xl sm:text-3xl text-cream leading-none">
        {value ?? "–"}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-sand mt-0.5">
        {side}
      </span>
    </button>
  );
}

export default function DominoBoard({
  board,
  ends,
  highlightEnds = [],
  onEndClick,
  lastSeq,
  lastEnd,
  tileSize = 56,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Follow the play. Without this the newest tile lands off-screen the moment
  // the snake is longer than the viewport, and players lose track of the game
  // entirely — which is roughly tile nine on a phone.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
      ? "auto"
      : "smooth";
    el.scrollTo({
      left: lastEnd === "left" ? 0 : el.scrollWidth,
      behavior,
    });
  }, [board.length, lastEnd]);

  return (
    <div className="flex items-center gap-2 w-full">
      <EndMarker
        value={ends.left}
        side="left"
        highlighted={highlightEnds.includes("left")}
        onClick={onEndClick ? () => onEndClick("left") : undefined}
      />

      <div
        ref={scrollerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden min-w-0"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex items-center gap-1 px-2 py-3 min-h-[92px] w-max mx-auto">
          {board.length === 0 ? (
            <span className="text-sm text-sand px-4">—</span>
          ) : (
            board.map((tile) => {
              const double = tile.left === tile.right;
              return (
                <DominoTile
                  key={`${tile.seq}-${tile.left}-${tile.right}`}
                  left={tile.left}
                  right={tile.right}
                  // A double sits across the line. It's the one bit of physical
                  // domino grammar that carries information, and it's free here.
                  orientation={double ? "vertical" : "horizontal"}
                  size={tileSize}
                  justPlayed={tile.seq === lastSeq}
                  ariaLabel={`${tile.left} ${tile.right}`}
                />
              );
            })
          )}
        </div>
      </div>

      <EndMarker
        value={ends.right}
        side="right"
        highlighted={highlightEnds.includes("right")}
        onClick={onEndClick ? () => onEndClick("right") : undefined}
      />
    </div>
  );
}
