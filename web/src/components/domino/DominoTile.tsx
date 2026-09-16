import { memo } from "react";

/**
 * A domino tile, drawn as pure vector SVG.
 *
 * SVG costs nothing to download, is sharp at any size, inherits the design
 * tokens, and can be individually animated with authentic tactile feel:
 * - Rich ivory gradient with subtle bevel and soft shadow
 * - Authentic brass spinner rivet in the center of the dividing line
 * - Standard 3x3 pip pattern with distinct, high-contrast colors
 */

export type DominoOrientation = "horizontal" | "vertical";

export interface DominoTileProps {
  left: number;
  right: number;
  orientation?: DominoOrientation;
  /** Rendered height in px for vertical, width for horizontal. */
  size?: number;
  /** Dim the tile: it exists but cannot be played right now. */
  dimmed?: boolean;
  /** Highlight: this tile is selected, or was just played. */
  active?: boolean;
  /** Face down — used for opponents' hands. */
  faceDown?: boolean;
  onClick?: () => void;
  className?: string;
  /** Fires the landing animation. */
  justPlayed?: boolean;
  ariaLabel?: string;
}

/** Pip positions on a 3×3 grid, in units of the half-tile's coordinate space. */
export const PIP_GRID: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/**
 * Per-value pip colour.
 *
 * High-contrast, authentic tones:
 * 1: Deep charcoal, 2: Forest green, 3: Crimson red,
 * 4: Cobalt blue, 5: Royal purple, 6: Amber gold-brown.
 */
export const PIP_COLOR: Record<number, string> = {
  0: "transparent",
  1: "#2B2621",
  2: "#1B7340",
  3: "#B83226",
  4: "#1E58A4",
  5: "#75399E",
  6: "#8B5718",
};

/**
 * Common SVG gradient and filter definitions for ivory dominoes.
 */
export function DominoTileDefs() {
  return (
    <defs>
      {/* Soft ivory face with delicate specular and bottom bevel */}
      <linearGradient id="domino-tile-face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="7%" stopColor="#FBF8F0" />
        <stop offset="88%" stopColor="#EDE3D1" />
        <stop offset="100%" stopColor="#D9C9A8" />
      </linearGradient>

      {/* Dark wood back for face-down opponent tiles */}
      <linearGradient id="domino-tile-back" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#3A281E" />
        <stop offset="50%" stopColor="#2A1B12" />
        <stop offset="100%" stopColor="#1B0F09" />
      </linearGradient>

      {/* Authentic brass spinner rivet */}
      <radialGradient id="domino-brass-pin" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#FFF7D6" />
        <stop offset="35%" stopColor="#E2B755" />
        <stop offset="75%" stopColor="#9C7722" />
        <stop offset="100%" stopColor="#4A360C" />
      </radialGradient>

      {/* Recessed pip depth gradient */}
      <radialGradient id="domino-pip-depth" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="rgba(0,0,0,0.05)" />
        <stop offset="80%" stopColor="rgba(0,0,0,0.4)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
      </radialGradient>
    </defs>
  );
}

/**
 * Pips for a single half-domino.
 * Assumes a 50×50 box centered at (cx, cy).
 */
export function DominoHalfPips({
  value,
  cx,
  cy,
}: {
  value: number;
  cx: number;
  cy: number;
}) {
  const pips = PIP_GRID[value] ?? [];
  const color = PIP_COLOR[value] ?? "#2B2621";
  const step = 14;
  const r = 4.2;

  return (
    <g>
      {pips.map(([gx, gy], i) => {
        // Grid points gx, gy are in {0, 1, 2}. Center is (1, 1).
        const px = cx + (gx - 1) * step;
        const py = cy + (gy - 1) * step;
        return (
          <g key={i}>
            {/* Subtle recessed bevel behind pip */}
            <circle cx={px} cy={py + 0.6} r={r} fill="rgba(255,255,255,0.45)" />
            <circle cx={px} cy={py} r={r} fill={color} />
            <circle cx={px} cy={py} r={r} fill="url(#domino-pip-depth)" />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Core vector graphic of a domino tile.
 * Drawn centered at (0, 0) in a 100×50 coordinate frame (length: 100, width: 50).
 * - Left half is centered at (-25, 0)
 * - Right half is centered at (+25, 0)
 * - Center dividing line and brass spinner pin are at (0, 0)
 */
export function DominoTileGraphic({
  left,
  right,
  active = false,
  faceDown = false,
}: {
  left: number;
  right: number;
  active?: boolean;
  faceDown?: boolean;
}) {
  return (
    <g className="select-none">
      {/* Tile shadow / base rim */}
      <rect
        x={-49}
        y={-24}
        width={98}
        height={48}
        rx={6}
        fill="rgba(0,0,0,0.3)"
        transform="translate(0, 1.5)"
      />

      {/* Main tile body */}
      <rect
        x={-49}
        y={-24}
        width={98}
        height={48}
        rx={6}
        fill={faceDown ? "url(#domino-tile-back)" : "url(#domino-tile-face)"}
        stroke={active ? "#E06D53" : "rgba(45, 30, 15, 0.45)"}
        strokeWidth={active ? 2.6 : 1.2}
      />

      {/* Top subtle highlight bevel */}
      <line
        x1={-44}
        y1={-22.5}
        x2={44}
        y2={-22.5}
        stroke="rgba(255,255,255,0.65)"
        strokeWidth={1}
        strokeLinecap="round"
      />

      {faceDown ? (
        /* Wood inlay pattern on back */
        <g>
          <circle
            cx={0}
            cy={0}
            r={12}
            fill="none"
            stroke="rgba(230,195,140,0.25)"
            strokeWidth={1.5}
          />
          <circle
            cx={0}
            cy={0}
            r={6}
            fill="none"
            stroke="rgba(230,195,140,0.2)"
            strokeWidth={1}
          />
        </g>
      ) : (
        <>
          {/* Dividing groove */}
          <line
            x1={0}
            y1={-20}
            x2={0}
            y2={20}
            stroke="rgba(40, 25, 12, 0.35)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <line
            x1={0.8}
            y1={-19.5}
            x2={0.8}
            y2={19.5}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={0.8}
            strokeLinecap="round"
          />

          {/* Authentic brass spinner pin (metal rivet) */}
          <circle cx={0} cy={0} r={3.2} fill="url(#domino-brass-pin)" stroke="#4A360C" strokeWidth={0.7} />
          <circle cx={-0.8} cy={-0.8} r={0.9} fill="#FFFFFF" opacity={0.6} />

          {/* Half 1 (left) pips */}
          <DominoHalfPips value={left} cx={-25} cy={0} />

          {/* Half 2 (right) pips */}
          <DominoHalfPips value={right} cx={25} cy={0} />
        </>
      )}
    </g>
  );
}

function DominoTileBase({
  left,
  right,
  orientation = "vertical",
  size = 72,
  dimmed = false,
  active = false,
  faceDown = false,
  onClick,
  className = "",
  justPlayed = false,
  ariaLabel,
}: DominoTileProps) {
  // Tile aspect ratio is 1:2.
  const long = size;
  const short = size / 2;
  const w = orientation === "vertical" ? short : long;
  const h = orientation === "vertical" ? long : short;

  const interactive = Boolean(onClick) && !dimmed;

  return (
    <svg
      width={w}
      height={h}
      viewBox={orientation === "vertical" ? "-25 -50 50 100" : "-50 -25 100 50"}
      className={[
        className,
        justPlayed ? "domino-drop" : "",
        interactive ? "cursor-pointer" : "",
        dimmed ? "opacity-40 saturate-50" : "",
        "transition-all duration-150 ease-out",
        interactive ? "hover:-translate-y-1 active:translate-y-0" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={ariaLabel ?? (faceDown ? "Face-down tile" : `${left} ${right}`)}
      aria-disabled={dimmed || undefined}
    >
      <DominoTileDefs />
      <g transform={orientation === "vertical" ? "rotate(90)" : ""}>
        <DominoTileGraphic
          left={left}
          right={right}
          active={active}
          faceDown={faceDown}
        />
      </g>
    </svg>
  );
}

export const DominoTile = memo(DominoTileBase);
export default DominoTile;
