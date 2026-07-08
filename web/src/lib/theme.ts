export type GameTheme = "standard" | "classic" | "vip";

export interface ThemeAssets {
  name: string;
  dominoFolder: string;
  cardBackClass: string;
  cardSuitColors: Record<string, string>;
  tableBg: string;
  tableBorder: string;
  accentColor: string;
}

export const THEMES: Record<GameTheme, ThemeAssets> = {
  standard: {
    name: "Standard",
    dominoFolder: "Light theme",
    cardBackClass: "from-red-800 to-red-950 border-red-700/60",
    cardSuitColors: {
      hearts: "#DC2626",
      diamonds: "#2563EB",
      clubs: "#16A34A",
      spades: "#7C3AED",
    },
    tableBg: "#0d1a0d",
    tableBorder: "#166534",
    accentColor: "#F59E0B",
  },
  classic: {
    name: "Classic",
    dominoFolder: "Dark Theme",
    cardBackClass: "from-blue-900 to-blue-950 border-blue-700/60",
    cardSuitColors: {
      hearts: "#991B1B",
      diamonds: "#1E40AF",
      clubs: "#15803D",
      spades: "#6B21A8",
    },
    tableBg: "#0F172A",
    tableBorder: "#1E3A5F",
    accentColor: "#FBBF24",
  },
  vip: {
    name: "VIP",
    dominoFolder: "Dark Theme",
    cardBackClass: "from-yellow-900 to-yellow-950 border-yellow-600/60",
    cardSuitColors: {
      hearts: "#FBBF24",
      diamonds: "#F59E0B",
      clubs: "#10B981",
      spades: "#FBBF24",
    },
    tableBg: "#111827",
    tableBorder: "#92400E",
    accentColor: "#FBBF24",
  },
};

export function getDominoImagePath(
  left: number,
  right: number,
  theme: GameTheme,
): string {
  const a = Math.min(left, right);
  const b = Math.max(left, right);
  const index = (15 * a - a * a) / 2 + (b - a) + 1;
  const folder = THEMES[theme].dominoFolder;
  const encoded = encodeURIComponent(folder);
  return `/Dominoe/${encoded}/${index}.png`;
}
