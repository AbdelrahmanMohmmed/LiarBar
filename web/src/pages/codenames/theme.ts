/**
 * This was a verbatim copy of `pages/theme.ts`. Three such copies existed and
 * drifted independently, so a palette change had to be made four times and
 * usually wasn't. It now re-exports the shared one, which is retargeted onto
 * the design system — see the note at the top of `pages/theme.ts`.
 */
export { COLORS, BUTTON_FONT, uiFont } from "../theme";

/** Codenames' board face. Same two families as everywhere else. */
export function boardFont(lang: "ar" | "en"): string {
  return lang === "ar" ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif";
}
