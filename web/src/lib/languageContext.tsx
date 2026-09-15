import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Language } from "./translations";
import { t } from "./translations";
import { BRAND } from "./brand";

import { LanguageTransitionOverlay } from "@/components/LanguageTransitionOverlay";

interface LanguageContextValue {
  lang: Language;
  isSwitching: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LS_LANG = `${BRAND.id}_lang`;

/**
 * Work out which language to open in.
 *
 * Previously this was hardcoded to English with no persistence, so an Arabic
 * speaker had to toggle on **every single page load** — including the one that
 * matters most, the invite link they just tapped in WhatsApp. For a product
 * whose primary audience reads Arabic, opening in the wrong language and
 * forgetting the correction every time is not a small annoyance; it reads as a
 * product that isn't for you.
 *
 * Order of preference:
 *   1. What they chose last time.
 *   2. What their browser says they read.
 *   3. English.
 */
function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(LS_LANG);
    if (stored === "ar" || stored === "en") return stored;
  } catch {
    /* Private mode, or storage disabled. Fall through to the locale. */
  }

  try {
    // `languages` is the full ordered list the user actually configured;
    // `language` alone is just the first of them.
    const preferences = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
    for (const tag of preferences) {
      const primary = tag.toLowerCase().split("-")[0];
      if (primary === "ar") return "ar";
      if (primary === "en") return "en";
    }
  } catch {
    /* No navigator (SSR, tests). */
  }

  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Read synchronously in the initialiser rather than in an effect: doing it
  // in an effect renders one frame of English first, which on a slow phone is
  // a visible flash of the wrong language *and* a layout jump when the
  // direction flips.
  const [lang, setLangState] = useState<Language>(initialLanguage);
  const [isSwitching, setIsSwitching] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<"entering" | "holding" | "leaving" | "idle">("idle");
  const [targetLang, setTargetLang] = useState<Language | null>(null);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LS_LANG, lang);
    } catch {
      /* Private mode. The session still works; it just won't be remembered. */
    }
  }, [lang]);

  const transitionTo = useCallback((next: Language) => {
    if (isSwitching || next === lang) return;
    setIsSwitching(true);
    setTargetLang(next);
    setTransitionPhase("entering");

    // Phase 1: Screen smoothly covers over 160ms
    setTimeout(() => {
      // Phase 2: Under complete cover, switch language and direction
      setLangState(next);
      setTransitionPhase("holding");

      // Phase 3: Hold briefly for layout stabilization, then dissolve out
      setTimeout(() => {
        setTransitionPhase("leaving");

        // Phase 4: Reset state and release anti-spam lock
        setTimeout(() => {
          setTransitionPhase("idle");
          setIsSwitching(false);
          setTargetLang(null);
        }, 220);
      }, 200);
    }, 160);
  }, [isSwitching, lang]);

  const setLang = useCallback((next: Language) => {
    transitionTo(next);
  }, [transitionTo]);

  const toggleLang = useCallback(() => {
    const next = lang === "en" ? "ar" : "en";
    transitionTo(next);
  }, [lang, transitionTo]);

  const translate = useCallback((key: string) => t(key, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, isSwitching, setLang, toggleLang, t: translate }}>
      {children}
      <LanguageTransitionOverlay
        show={isSwitching}
        phase={transitionPhase}
        targetLang={targetLang}
      />
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
