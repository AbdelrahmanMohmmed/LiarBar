import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { GameTheme } from "./theme";
import { THEMES } from "./theme";

interface ThemeContextValue {
  theme: GameTheme;
  setTheme: (t: GameTheme) => void;
  assets: (typeof THEMES)[GameTheme];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const LS_KEY = "liarsbar_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<GameTheme>(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "standard" || stored === "classic" || stored === "vip") {
      return stored;
    }
    return "standard";
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: GameTheme) => {
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, assets: THEMES[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
