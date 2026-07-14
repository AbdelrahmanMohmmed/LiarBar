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
  gold: "#FED23F",
  
  // Table themes
  tableGreen: "radial-gradient(circle, #165b33 0%, #0d3820 100%)",
  tableSlate: "radial-gradient(circle, #2d3748 0%, #1a202c 100%)",
  tableWood: "radial-gradient(circle, #5c3e21 0%, #301f10 100%)",

  // Tile designs
  tileIvory: { bg: "#FCFBF7", dots: "#1E1E1E", border: "#D8D3C9" },
  tileCarbon: { bg: "#1A1A1A", dots: "#E2E8F0", border: "#2D3748" },
  tileNeon: { bg: "#0D0E12", dots: "#00F2FE", border: "#00F2FE" },
} as const;

export const BUTTON_FONT = "'Baloo 2', sans-serif";

export function uiFont(isAr: boolean): string {
  return isAr ? "'Tajawal', sans-serif" : "'Baloo 2', sans-serif";
}
