import { useEffect, useMemo, useState } from "react";
import { DominoTileDefs, DominoTileGraphic } from "./DominoTile";
import type { PlacedTile, BoardEnds } from "@/lib/dominoTypes";
import { useLanguage } from "@/lib/languageContext";

/**
 * The domino table: a stationary 2D serpentine track designed for both
 * mobile phones (compact portrait) and PC/desktop screens (wide landscape).
 *
 * All played tiles remain visible on mobile and desktop without scrolling.
 * Placed tiles are anchored to root (0, 0) and NEVER drift from center.
 * Smooth GPU-accelerated adaptive framing ensures dominoes are large and tactile
 * at all stages of the game, eliminating empty table space.
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
 * Hook to reactively detect desktop/wide screen viewports.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}

/**
 * Mobile Portrait Track:
 * Compact horizontal span (x: -120 to +120) with vertical progression to fill
 * portrait mobile tables with large, readable dominoes.
 */
function getMobileRightBranchSlot(slot: number): SlotCoord {
  // Row 0: Slots 1..2 (x = 60, 120; y = 0; advancing right)
  if (slot === 1) return { x: 60, y: 0, angle: 0 };
  if (slot === 2) return { x: 120, y: 0, angle: 0 };

  // Turn 1: Slot 3 (x = 155, y = 31; advancing down to Row 1)
  if (slot === 3) return { x: 155, y: 31, angle: 90 };

  // Row 1: Slots 4..8 (y = 62; advancing left from x = 120 down to x = -120)
  if (slot >= 4 && slot <= 8) {
    const col = slot - 4; // 0..4
    return { x: 120 - col * 60, y: 62, angle: 180 };
  }

  // Turn 2: Slot 9 (x = -155, y = 93; advancing down to Row 2)
  if (slot === 9) return { x: -155, y: 93, angle: 90 };

  // Row 2: Slots 10..14 (y = 124; advancing right from x = -120 to x = 120)
  if (slot >= 10 && slot <= 14) {
    const col = slot - 10; // 0..4
    return { x: -120 + col * 60, y: 124, angle: 0 };
  }

  // Turn 3: Slot 15 (x = 155, y = 155; advancing down to Row 3)
  if (slot === 15) return { x: 155, y: 155, angle: 90 };

  // Row 3: Slots 16..20 (y = 186; advancing left from x = 120 to x = -120)
  if (slot >= 16 && slot <= 20) {
    const col = slot - 16; // 0..4
    return { x: 120 - col * 60, y: 186, angle: 180 };
  }

  // Turn 4: Slot 21 (x = -155, y = 217; advancing down to Row 4)
  if (slot === 21) return { x: -155, y: 217, angle: 90 };

  // Row 4: Slots 22..26 (y = 248; advancing right from x = -120 to x = 120)
  const col = Math.min(4, slot - 22);
  return { x: -120 + col * 60, y: 248, angle: 0 };
}

/**
 * Desktop Landscape Track:
 * Wide horizontal span (x: -300 to +300) that fills PC monitors and landscape displays.
 * Row 0 alone spans 11 dominoes across the felt, utilizing the full screen width.
 */
function getDesktopRightBranchSlot(slot: number): SlotCoord {
  // Row 0: Slots 1..5 (x = 60, 120, 180, 240, 300; y = 0; advancing right)
  if (slot >= 1 && slot <= 5) {
    return { x: slot * 60, y: 0, angle: 0 };
  }

  // Turn 1: Slot 6 (x = 335, y = 31; advancing down to Row 1)
  if (slot === 6) return { x: 335, y: 31, angle: 90 };

  // Row 1: Slots 7..17 (y = 62; advancing left from x = 300 down to x = -300)
  if (slot >= 7 && slot <= 17) {
    const col = slot - 7; // 0..10
    return { x: 300 - col * 60, y: 62, angle: 180 };
  }

  // Turn 2: Slot 18 (x = -335, y = 93; advancing down to Row 2)
  if (slot === 18) return { x: -335, y: 93, angle: 90 };

  // Row 2: Slots 19..29 (y = 124; advancing right from x = -300 to x = 300)
  if (slot >= 19 && slot <= 29) {
    const col = slot - 19; // 0..10
    return { x: -300 + col * 60, y: 124, angle: 0 };
  }

  // Turn 3: Slot 30 (x = 335, y = 155; advancing down to Row 3)
  if (slot === 30) return { x: 335, y: 155, angle: 90 };

  // Row 3: Slots 31..40 (y = 186; advancing left from x = 300 to -300)
  const col = Math.min(10, slot - 31);
  return { x: 300 - col * 60, y: 186, angle: 180 };
}

/**
 * Returns slot coordinates for either the right or left branch.
 * The left branch is an exact 180° point reflection through (0, 0),
 * mathematically guaranteeing ZERO collision and symmetric balance.
 */
function getBranchSlot(branch: "right" | "left", slot: number, isDesktop: boolean): SlotCoord {
  const rightSlot = isDesktop
    ? getDesktopRightBranchSlot(slot)
    : getMobileRightBranchSlot(slot);
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
  const isDesktop = useIsDesktop();

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

  const rightTargetCoord = useMemo(
    () => getBranchSlot("right", nextRightSlotIdx, isDesktop),
    [nextRightSlotIdx, isDesktop],
  );
  const leftTargetCoord = useMemo(
    () => getBranchSlot("left", nextLeftSlotIdx, isDesktop),
    [nextLeftSlotIdx, isDesktop],
  );

  // Compute adaptive zoom centered on (0, 0) to maximize domino size and minimize empty space
  const currentZoom = useMemo(() => {
    if (board.length === 0) return isDesktop ? 1.35 : 1.45;

    let maxSpanX = 60;
    let maxSpanY = 60;

    rightBranchFromRoot.forEach((tile, i) => {
      const slot = getBranchSlot("right", i + 1, isDesktop);
      const isDbl = tile.left === tile.right;
      maxSpanX = Math.max(maxSpanX, Math.abs(slot.x) + (isDbl ? 20 : 35));
      maxSpanY = Math.max(maxSpanY, Math.abs(slot.y) + (isDbl ? 35 : 20));
    });

    leftBranchFromRoot.forEach((tile, i) => {
      const slot = getBranchSlot("left", i + 1, isDesktop);
      const isDbl = tile.left === tile.right;
      maxSpanX = Math.max(maxSpanX, Math.abs(slot.x) + (isDbl ? 20 : 35));
      maxSpanY = Math.max(maxSpanY, Math.abs(slot.y) + (isDbl ? 35 : 20));
    });

    if (canClickRight) {
      maxSpanX = Math.max(maxSpanX, Math.abs(rightTargetCoord.x) + 32);
      maxSpanY = Math.max(maxSpanY, Math.abs(rightTargetCoord.y) + 32);
    }
    if (canClickLeft) {
      maxSpanX = Math.max(maxSpanX, Math.abs(leftTargetCoord.x) + 32);
      maxSpanY = Math.max(maxSpanY, Math.abs(leftTargetCoord.y) + 32);
    }

    if (isDesktop) {
      // Desktop bounds: viewBox="-360 -160 720 320"
      const zoomX = 330 / maxSpanX;
      const zoomY = 140 / maxSpanY;
      const fitZoom = Math.min(zoomX, zoomY);
      return Math.max(1.0, Math.min(1.4, Number(fitZoom.toFixed(2))));
    } else {
      // Mobile bounds: viewBox="-175 -260 350 520"
      const zoomX = 160 / maxSpanX;
      const zoomY = 240 / maxSpanY;
      const fitZoom = Math.min(zoomX, zoomY);
      return Math.max(1.0, Math.min(1.45, Number(fitZoom.toFixed(2))));
    }
  }, [
    board.length,
    rightBranchFromRoot,
    leftBranchFromRoot,
    canClickRight,
    canClickLeft,
    rightTargetCoord,
    leftTargetCoord,
    isDesktop,
  ]);

  const viewBox = isDesktop ? "-360 -160 720 320" : "-175 -260 350 520";
  const tileScale = isDesktop ? 0.62 : 0.58;

  return (
    <div
      className="w-full h-full flex-1 flex items-center justify-center relative select-none"
      role="region"
      aria-label={`${t("domino.title")}. ${t("domino.open_end")}: ${ends.left ?? "–"} / ${ends.right ?? "–"}`}
    >
      <svg
        viewBox={viewBox}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <DominoTileDefs />

        {/* Felt table center subtle emblem */}
        <g opacity={0.25}>
          <circle cx={0} cy={0} r={34} fill="none" stroke="#D4AF37" strokeWidth={0.8} strokeDasharray="3 3" />
          <circle cx={0} cy={0} r={4} fill="#D4AF37" opacity={0.6} />
        </g>

        {/* Board content centered at (0, 0) with smooth adaptive scale */}
        <g
          style={{
            transform: `scale(${currentZoom})`,
            transformOrigin: "0px 0px",
            transition: "transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1)",
          }}
        >
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
                x={-28}
                y={-14}
                width={56}
                height={28}
                rx={5}
                fill="rgba(224, 109, 83, 0.12)"
                stroke="#E06D53"
                strokeWidth={2}
                strokeDasharray="4 3"
                className="pulse-glow"
              />
              <circle cx={0} cy={0} r={4} fill="#E06D53" />
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
                    transform={`translate(0, 0) rotate(${angle}) scale(${tileScale})`}
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
                const slot = getBranchSlot("right", slotIdx, isDesktop);
                const isDbl = tile.left === tile.right;
                const renderAngle = isDbl ? (slot.angle + 90) % 360 : slot.angle;
                const isJustPlayed = tile.seq === lastSeq;
                const isOuter = i === rightBranchFromRoot.length - 1;

                return (
                  <g
                    key={`r-${tile.seq}-${tile.left}-${tile.right}`}
                    transform={`translate(${slot.x}, ${slot.y}) rotate(${renderAngle}) scale(${tileScale})`}
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
                const slot = getBranchSlot("left", slotIdx, isDesktop);
                const isDbl = tile.left === tile.right;
                const renderAngle = isDbl ? (slot.angle + 90) % 360 : slot.angle;
                const isJustPlayed = tile.seq === lastSeq;
                const isOuter = i === leftBranchFromRoot.length - 1;

                return (
                  <g
                    key={`l-${tile.seq}-${tile.left}-${tile.right}`}
                    transform={`translate(${slot.x}, ${slot.y}) rotate(${renderAngle}) scale(${tileScale})`}
                    className={isOuter && canClickLeft ? "cursor-pointer" : ""}
                    onClick={isOuter && canClickLeft ? () => onEndClick?.("left") : undefined}
                  >
                    <g className={isJustPlayed ? "domino-drop" : ""}>
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
                  <rect x={-32} y={-20} width={64} height={40} fill="transparent" />
                  <rect
                    x={-28}
                    y={-14}
                    width={56}
                    height={28}
                    rx={5}
                    fill="rgba(224, 109, 83, 0.22)"
                    stroke="#E06D53"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    className="pulse-glow"
                  />
                  <circle cx={0} cy={0} r={4} fill="#E06D53" />
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
                  <rect x={-32} y={-20} width={64} height={40} fill="transparent" />
                  <rect
                    x={-28}
                    y={-14}
                    width={56}
                    height={28}
                    rx={5}
                    fill="rgba(224, 109, 83, 0.22)"
                    stroke="#E06D53"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    className="pulse-glow"
                  />
                  <circle cx={0} cy={0} r={4} fill="#E06D53" />
                </g>
              )}
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
