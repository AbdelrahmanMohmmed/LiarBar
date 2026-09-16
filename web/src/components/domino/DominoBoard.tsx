import { useMemo } from "react";
import { DominoTileDefs, DominoTileGraphic } from "./DominoTile";
import type { PlacedTile, BoardEnds } from "@/lib/dominoTypes";
import { useLanguage } from "@/lib/languageContext";

/**
 * The domino table: a stationary 2D serpentine track.
 *
 * All played tiles remain visible on mobile and desktop without scrolling.
 * Placed tiles are anchored to root (0, 0) and NEVER move, jump, or recenter
 * when new moves occur.
 *
 * Open ends are read directly from the physical tiles on the felt table.
 * When a player has choices, subtle glowing drop targets appear at the open
 * ends of the snake.
 */

interface Props {
  board: PlacedTile[];
  ends: BoardEnds;
  /** Highlight the end(s) the player's selected tile could go on. */
  highlightEnds?: Array<"left" | "right">;
  onEndClick?: (end: "left" | "right") => void;
  /** seq of the most recent tile, for the landing animation. */
  lastSeq?: number;
  lastEnd?: "left" | "right" | null;
  tileSize?: number;
}

export interface SlotCoord {
  x: number;
  y: number;
  /** Track direction angle in degrees (0: right, 90: down, 180: left, 270: up) */
  angle: number;
}

/**
 * Computes coordinates and track orientation for a given slot index (1-based)
 * on the Right Branch (which moves right, down to row 1, left, down to row 2, etc.)
 */
function getRightBranchSlot(slot: number): SlotCoord {
  // Row 0: Slots 1..4 (x = 48, 96, 144, 192; y = 0; advancing right)
  if (slot >= 1 && slot <= 4) {
    return { x: slot * 48, y: 0, angle: 0 };
  }

  // Turn 1: Slot 5 (x = 220, y = 27; advancing down to Row 1)
  if (slot === 5) {
    return { x: 220, y: 27, angle: 90 };
  }

  // Row 1: Slots 6..14 (y = 54; advancing left from x = 192 to x = -192)
  if (slot >= 6 && slot <= 14) {
    const col = slot - 6; // 0..8
    return { x: 192 - col * 48, y: 54, angle: 180 };
  }

  // Turn 2: Slot 15 (x = -220, y = 81; advancing down to Row 2)
  if (slot === 15) {
    return { x: -220, y: 81, angle: 90 };
  }

  // Row 2: Slots 16..24 (y = 108; advancing right from x = -192 to x = 192)
  if (slot >= 16 && slot <= 24) {
    const col = slot - 16; // 0..8
    return { x: -192 + col * 48, y: 108, angle: 0 };
  }

  // Turn 3: Slot 25 (x = 220, y = 135; advancing down to Row 3)
  if (slot === 25) {
    return { x: 220, y: 135, angle: 90 };
  }

  // Row 3: Slots 26..34 (y = 162; advancing left from x = 192 to x = -192)
  const col = Math.min(8, slot - 26);
  return { x: 192 - col * 48, y: 162, angle: 180 };
}

/**
 * Returns the slot coordinates for either the right or left branch.
 * The left branch is a 180° point reflection through the origin (0, 0),
 * ensuring zero collision with the right branch.
 */
function getBranchSlot(branch: "right" | "left", slot: number): SlotCoord {
  const rightSlot = getRightBranchSlot(slot);
  if (branch === "right") {
    return rightSlot;
  }
  return {
    x: -rightSlot.x,
    y: -rightSlot.y,
    angle: (rightSlot.angle + 180) % 360,
  };
}

export default function DominoBoard({
  board,
  ends,
  highlightEnds = [],
  onEndClick,
  lastSeq,
}: Props) {
  const { t } = useLanguage();

  // Decompose board into root tile, left branch, and right branch.
  const { rootTile, leftBranchFromRoot, rightBranchFromRoot } = useMemo(() => {
    if (board.length === 0) {
      return {
        rootTile: null,
        leftBranchFromRoot: [] as PlacedTile[],
        rightBranchFromRoot: [] as PlacedTile[],
      };
    }

    const rootIdx = board.findIndex((t) => t.seq === 0 || t.end === "spinner");
    const safeRootIdx = rootIdx >= 0 ? rootIdx : 0;
    const root = board[safeRootIdx];

    // Left branch: tiles unshifted to the left of root, ordered outwards from root.
    const leftRaw = board.slice(0, safeRootIdx);
    const leftBranch = [...leftRaw].reverse();

    // Right branch: tiles pushed to the right of root, ordered outwards from root.
    const rightBranch = board.slice(safeRootIdx + 1);

    return {
      rootTile: root,
      leftBranchFromRoot: leftBranch,
      rightBranchFromRoot: rightBranch,
    };
  }, [board]);

  const canClickLeft = highlightEnds.includes("left") && Boolean(onEndClick);
  const canClickRight = highlightEnds.includes("right") && Boolean(onEndClick);

  // Next slot index for drop targets at open ends
  const nextRightSlotIdx = rightBranchFromRoot.length + 1;
  const nextLeftSlotIdx = leftBranchFromRoot.length + 1;

  const rightTargetCoord = getBranchSlot("right", nextRightSlotIdx);
  const leftTargetCoord = getBranchSlot("left", nextLeftSlotIdx);

  return (
    <div
      className="w-full h-full min-h-[220px] flex items-center justify-center relative select-none"
      role="region"
      aria-label={`${t("domino.title")}. ${t("domino.open_end")}: ${ends.left ?? "–"} / ${ends.right ?? "–"}`}
    >
      <svg
        viewBox="-255 -140 510 280"
        className="w-full h-full max-h-[360px] overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <DominoTileDefs />

        {/* Felt table center subtle emblem */}
        <g opacity={0.25}>
          <circle cx={0} cy={0} r={28} fill="none" stroke="#D4AF37" strokeWidth={0.8} strokeDasharray="3 3" />
          <circle cx={0} cy={0} r={4} fill="#D4AF37" opacity={0.6} />
        </g>

        {/* Empty board drop target */}
        {board.length === 0 && (
          <g
            transform="translate(0, 0)"
            className={onEndClick ? "cursor-pointer" : ""}
            onClick={() => onEndClick?.("left")}
            role="button"
            tabIndex={0}
            aria-label={t("domino.open_end")}
          >
            <rect
              x={-23}
              y={-11.5}
              width={46}
              height={23}
              rx={4}
              fill="rgba(224, 109, 83, 0.12)"
              stroke="#E06D53"
              strokeWidth={1.8}
              strokeDasharray="4 3"
              className="pulse-glow"
            />
            <circle cx={0} cy={0} r={3} fill="#E06D53" />
          </g>
        )}

        {/* Placed domino snake */}
        {board.length > 0 && rootTile && (
          <>
            {/* Root Tile (seq: 0) */}
            {(() => {
              const isDbl = rootTile.left === rootTile.right;
              const angle = isDbl ? 90 : 0;
              const isJustPlayed = rootTile.seq === lastSeq;
              return (
                <g
                  key={`root-${rootTile.seq}`}
                  transform={`translate(0, 0) rotate(${angle}) scale(0.46)`}
                >
                  <g className={isJustPlayed ? "domino-drop" : ""}>
                    <DominoTileGraphic
                      left={rootTile.left}
                      right={rootTile.right}
                    />
                  </g>
                </g>
              );
            })()}

            {/* Right Branch tiles */}
            {rightBranchFromRoot.map((tile, i) => {
              const slotIdx = i + 1;
              const slot = getBranchSlot("right", slotIdx);
              const isDbl = tile.left === tile.right;
              const renderAngle = isDbl ? (slot.angle + 90) % 360 : slot.angle;
              const isJustPlayed = tile.seq === lastSeq;
              const isOuter = i === rightBranchFromRoot.length - 1;

              return (
                <g
                  key={`r-${tile.seq}-${tile.left}-${tile.right}`}
                  transform={`translate(${slot.x}, ${slot.y}) rotate(${renderAngle}) scale(0.46)`}
                  className={isOuter && canClickRight ? "cursor-pointer" : ""}
                  onClick={isOuter && canClickRight ? () => onEndClick?.("right") : undefined}
                >
                  <g className={isJustPlayed ? "domino-drop" : ""}>
                    <DominoTileGraphic
                      left={tile.left}
                      right={tile.right}
                      active={isOuter && canClickRight}
                    />
                  </g>
                </g>
              );
            })}

            {/* Left Branch tiles */}
            {leftBranchFromRoot.map((tile, i) => {
              const slotIdx = i + 1;
              const slot = getBranchSlot("left", slotIdx);
              const isDbl = tile.left === tile.right;
              const renderAngle = isDbl ? (slot.angle + 90) % 360 : slot.angle;
              const isJustPlayed = tile.seq === lastSeq;
              const isOuter = i === leftBranchFromRoot.length - 1;

              return (
                <g
                  key={`l-${tile.seq}-${tile.left}-${tile.right}`}
                  transform={`translate(${slot.x}, ${slot.y}) rotate(${renderAngle}) scale(0.46)`}
                  className={isOuter && canClickLeft ? "cursor-pointer" : ""}
                  onClick={isOuter && canClickLeft ? () => onEndClick?.("left") : undefined}
                >
                  <g className={isJustPlayed ? "domino-drop" : ""}>
                    {/*
                      In the left branch, tile.right touches inward towards root,
                      and tile.left points outward towards the open end.
                    */}
                    <DominoTileGraphic
                      left={tile.right}
                      right={tile.left}
                      active={isOuter && canClickLeft}
                    />
                  </g>
                </g>
              );
            })}

            {/* Glowing Drop Target: Right End */}
            {canClickRight && (
              <g
                transform={`translate(${rightTargetCoord.x}, ${rightTargetCoord.y}) rotate(${rightTargetCoord.angle})`}
                className="cursor-pointer"
                onClick={() => onEndClick?.("right")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEndClick?.("right");
                  }
                }}
                aria-label={`${t("domino.open_end")}: ${ends.right}`}
              >
                {/* Generous touch hit area */}
                <rect x={-26} y={-16} width={52} height={32} fill="transparent" />
                <rect
                  x={-22}
                  y={-11}
                  width={44}
                  height={22}
                  rx={4}
                  fill="rgba(224, 109, 83, 0.22)"
                  stroke="#E06D53"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  className="pulse-glow"
                />
                <circle cx={0} cy={0} r={3} fill="#E06D53" />
              </g>
            )}

            {/* Glowing Drop Target: Left End */}
            {canClickLeft && (
              <g
                transform={`translate(${leftTargetCoord.x}, ${leftTargetCoord.y}) rotate(${leftTargetCoord.angle})`}
                className="cursor-pointer"
                onClick={() => onEndClick?.("left")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEndClick?.("left");
                  }
                }}
                aria-label={`${t("domino.open_end")}: ${ends.left}`}
              >
                {/* Generous touch hit area */}
                <rect x={-26} y={-16} width={52} height={32} fill="transparent" />
                <rect
                  x={-22}
                  y={-11}
                  width={44}
                  height={22}
                  rx={4}
                  fill="rgba(224, 109, 83, 0.22)"
                  stroke="#E06D53"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  className="pulse-glow"
                />
                <circle cx={0} cy={0} r={3} fill="#E06D53" />
              </g>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
