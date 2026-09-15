import { memo } from "react";

/**
 * A domino tile, drawn as SVG.
 *
 * The previous implementation used 56 PNGs (28 tiles × 2 themes) loaded by
 * index from a path built with arithmetic. That meant: 56 network requests on
 * a first load, tiles that blur when scaled up on a tablet, a theme system
 * limited to the two folders that happened to exist, no way to tint a tile for
 * "playable" or "just landed", and a filename-index formula that silently
 * produced the wrong tile if anyone changed the sort order of the folder.
 *
 * SVG costs nothing to download, is sharp at any size, inherits the design
 * tokens so a re-theme is a CSS variable, and can be individually animated.
 *
 * ## Pip layout
 *
 * Pips sit on the standard 3×3 grid used by every physical domino and die.
 * This is not arbitrary: people read pip patterns as *shapes*, not by
 * counting, so a non-standard arrangement makes a tile measurably slower to
 * identify. On a phone, mid-conversation, that delay is the difference between
 * reading the table and giving up on it.
 */

type Orientation = "horizontal" | "vertical";

interface Props {
  left: number;
  right: number;
  orientation?: Orientation;
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
const PIP_GRID: Record<number, Array<[number, number]>> = {
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
 * Standard dominoes are all-black, but on a 44px-wide tile on a phone, six
 * black dots and five black dots are genuinely hard to tell apart at a glance.
 * Colouring by value gives a second, faster channel: players start recognising
 * "the green ones are fives" long before they start counting. Every colour is
 * also distinguishable by position (the pip pattern), so this never becomes
 * the *only* cue — which matters for the ~8% of men with colour deficiency in
 * an audience this one skews toward.
 */
const PIP_COLOR: Record<number, string> = {
  0: "transparent",
  1: "#2E2A26",
  2: "#1F7A4D",
  3: "#B03A2E",
  4: "#1F4E8C",
  5: "#6B3FA0",
  6: "#8A5A1E",
};

function Half({
  value,
  x,
  y,
  cell,
}: {
  value: number;
  x: number;
  y: number;
  cell: number;
}) {
  const pips = PIP_GRID[value] ?? [];
  const pad = cell * 0.5;
  const step = cell * 0.9;
  const r = cell * 0.26;

  return (
    <g>
      {pips.map(([gx, gy], i) => (
        <circle
          key={i}
          cx={x + pad + gx * step}
          cy={y + pad + gy * step}
          r={r}
          fill={PIP_COLOR[value]}
        />
      ))}
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
}: Props) {
  // A tile is 1:2. `size` is the long edge.
  const long = size;
  const short = size / 2;
  const w = orientation === "vertical" ? short : long;
  const h = orientation === "vertical" ? long : short;

  // Coordinate space: the short edge is 50 units, so a half is 50×50.
  const unit = 50;
  const vbW = orientation === "vertical" ? unit : unit * 2;
  const vbH = orientation === "vertical" ? unit * 2 : unit;
  const cell = unit / 3;

  const interactive = Boolean(onClick) && !dimmed;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={[
        className,
        justPlayed ? "drop-in" : "",
        interactive ? "cursor-pointer" : "",
        dimmed ? "opacity-40 saturate-50" : "",
        "transition-transform duration-150 ease-out",
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
      <defs>
        {/* Ivory face with a hint of vertical gradient: a flat fill reads as a
            sticker, a gradient reads as an object with a top surface. */}
        <linearGradient id="tile-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBF6EC" />
          <stop offset="100%" stopColor="#E9DFCE" />
        </linearGradient>
        <linearGradient id="tile-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3A2E27" />
          <stop offset="100%" stopColor="#241C17" />
        </linearGradient>
      </defs>

      <rect
        x={1}
        y={1}
        width={vbW - 2}
        height={vbH - 2}
        rx={7}
        fill={faceDown ? "url(#tile-back)" : "url(#tile-face)"}
        stroke={active ? "hsl(var(--coral))" : "rgba(0,0,0,0.35)"}
        strokeWidth={active ? 3 : 1.5}
      />

      {faceDown ? (
        <circle
          cx={vbW / 2}
          cy={vbH / 2}
          r={unit * 0.18}
          fill="none"
          stroke="rgba(245,237,226,0.25)"
          strokeWidth={2}
        />
      ) : (
        <>
          {/* The dividing bar. Physical dominoes have one and its absence is
              immediately noticeable — the tile stops looking like a domino. */}
          {orientation === "vertical" ? (
            <line
              x1={unit * 0.14}
              y1={unit}
              x2={unit * 0.86}
              y2={unit}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : (
            <line
              x1={unit}
              y1={unit * 0.14}
              x2={unit}
              y2={unit * 0.86}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          <Half value={left} x={0} y={0} cell={cell} />
          <Half
            value={right}
            x={orientation === "vertical" ? 0 : unit}
            y={orientation === "vertical" ? unit : 0}
            cell={cell}
          />
        </>
      )}
    </svg>
  );
}

export const DominoTile = memo(DominoTileBase);
export default DominoTile;
