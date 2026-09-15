/**
 * Domino's palette: the shared tokens plus the table and tile finishes that
 * only this game has.
 *
 * The base colours were a verbatim copy of `pages/theme.ts` and have been
 * replaced by a re-export — see the note at the top of that file for why the
 * values moved rather than the markup.
 */
import { COLORS as BASE } from "../theme";

export { BUTTON_FONT, uiFont } from "../theme";

export const COLORS = {
  ...BASE,
  gold: "#FED23F",

  /** Felt finishes for the table surface. */
  tableGreen: "radial-gradient(circle, #165b33 0%, #0d3820 100%)",
  tableSlate: "radial-gradient(circle, #2d3748 0%, #1a202c 100%)",
  tableWood: "radial-gradient(circle, #5c3e21 0%, #301f10 100%)",

  /**
   * Tile finishes. Only used by the legacy DominoRoom preview now — the table
   * itself draws tiles as SVG (components/domino/DominoTile.tsx), which is why
   * these are no longer load-bearing.
   */
  tileIvory: { bg: "#FCFBF7", dots: "#1E1E1E", border: "#D8D3C9" },
  tileCarbon: { bg: "#1A1A1A", dots: "#E2E8F0", border: "#2D3748" },
  tileNeon: { bg: "#0D0E12", dots: "#00F2FE", border: "#00F2FE" },
} as const;
