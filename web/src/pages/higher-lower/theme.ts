export const COLORS = {
  cream: "#FDF6EC",
  ink: "#2B2420",
  red: "#E8574A",
  teal: "#3AA6A6",
  textSecondary: "#5B5147",
  textMuted: "#8A7F73",
  peach: "#F4C89A",
  paleTeal: "#CFE3E1",
  disabledBg: "#E7E1D8",
  disabledText: "#A79C8E",
  white: "#FFFFFF",
} as const;

export const BUTTON_FONT = "'Baloo 2', sans-serif";

export function uiFont(isAr: boolean): string {
  return isAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif";
}
