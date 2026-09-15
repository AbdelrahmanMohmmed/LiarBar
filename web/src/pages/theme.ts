/**
 * Legacy palette, retargeted onto the design system.
 *
 * ## What this file is
 *
 * Several pages (Liar's Bar, Codenames, Higher or Lower, Rento, the lobby)
 * were built against a cream-and-black neo-brutalist palette with its own
 * primitives in `ui.tsx`. They look like a different product from every page
 * built since — different background, different accent, different shape
 * language — and the seam is visible the moment a player moves between them.
 *
 * Rewriting ~2,000 lines of page markup to fix that would be a large, risky
 * change spread across five games. Instead, **the names stay and the values
 * move**: every token here now resolves to the corresponding design-system
 * colour from `index.css`. One file, and every page that imports it lands on
 * the new palette without a single page component being touched.
 *
 * The naming is now deliberately wrong — `cream` is no longer cream — which is
 * the honest signal that this is a compatibility shim, not a palette anyone
 * should design against. New work uses the Tailwind tokens (`text-cream`,
 * `bg-surface`, `.btn-primary`); see docs/DESIGN_SYSTEM.md.
 *
 * ## Retiring it
 *
 * Convert a page to `components/game/GameSetupPage.tsx` and the token classes,
 * then drop its import. When nothing imports this file, delete it and the
 * per-game `ui.tsx` copies alongside it.
 */

import { COLORS as BRAND_COLORS } from "@/lib/brand";

export const COLORS = {
  /**
   * Was `#FDF6EC`, a cream page background. Now the page ground — which is
   * dark. Pages using this as a background get the correct dark ground; pages
   * using it as *text on ink* would now be invisible, so `ui.tsx` maps those
   * to `cream` explicitly instead.
   */
  cream: BRAND_COLORS.ink900,

  /** Was near-black ink on cream. Now the light text/border colour on dark. */
  ink: BRAND_COLORS.cream,

  /** The accent. Unchanged in meaning; now the brand coral. */
  red: BRAND_COLORS.coral,

  /** Secondary accent, used by Codenames for one team. Now the brand sky. */
  teal: BRAND_COLORS.sky,

  textSecondary: BRAND_COLORS.sand,
  textMuted: BRAND_COLORS.sand,

  /**
   * These two were PALE BACKGROUNDS in the old cream palette — a soft peach
   * panel, a soft mint panel. Mapping them to the saturated brand `gold` and
   * `mint` made every panel that used them shout, and put mint on things like
   * a "Show game log" button — which breaks the one rule the palette has, that
   * mint means "live right now" and nothing else (DESIGN_SYSTEM.md §2).
   *
   * They now map to raised surfaces, which is the role they were actually
   * playing. Where the old code used `peach` as an *accent* rather than a
   * background it now reads as a subtle highlight, which is the closer of the
   * two wrong answers and is correct far more often.
   */
  peach: BRAND_COLORS.gold,
  paleTeal: BRAND_COLORS.ink600,

  disabledBg: BRAND_COLORS.ink600,
  disabledText: BRAND_COLORS.sand,

  /**
   * Was literal white, used for panel fills. Now a raised surface, so a
   * `background: COLORS.white` panel reads as an elevated card on the dark
   * ground rather than a white rectangle punched into it.
   */
  white: BRAND_COLORS.ink700,

  /** Genuinely white, for the few places that need it (text on coral). */
  trueWhite: "#FFFFFF",
} as const;

export const BUTTON_FONT = "'Baloo 2', sans-serif";

export function uiFont(isAr: boolean): string {
  return isAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif";
}
