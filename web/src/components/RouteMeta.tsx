import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Seo, claimedPathname } from "@/lib/seo";
import { BRAND, GAMES } from "@/lib/brand";
import { useLanguage } from "@/lib/languageContext";

/**
 * Head metadata for every route that doesn't set its own.
 *
 * ## Why this exists
 *
 * `<Seo>` upserts tags into a single shared `<head>`, so whatever the last
 * page set stays set. Fourteen of the forty pages render it; the rest inherit
 * the previous route's title, description, canonical URL and robots directive.
 *
 * The visible symptom is small — switch a party from Chameleon to Rento and
 * the tab still says "Chameleon" — but the invisible one is not. A player who
 * arrived from the landing page carries `robots: index, follow` and a canonical
 * pointing at the landing page into every room they then open. Room URLs are
 * private, disposable and worthless to a search engine, and a stale canonical
 * is exactly the kind of thing that makes a site rank for nothing: every
 * crawled URL claims to be the same page.
 *
 * ## How it decides
 *
 * `<Seo>` records the pathname it rendered for. This waits one macrotask after
 * the route settles — long enough for a lazily-loaded page to mount and claim
 * it — and fills in a default only if nobody did. A page that renders `<Seo>`
 * always wins; a page that doesn't gets a correct, uninteresting default
 * instead of the previous page's identity.
 *
 * Giving a page its own `<Seo>` is still the better answer when it has
 * something specific to say. This is the floor, not the ceiling.
 */

interface Fallback {
  title: string;
  description: string;
  path: string;
  noindex: boolean;
}

/** Room and game routes: real pages, but nothing a search engine should hold. */
const PRIVATE_PREFIXES = ["/r/", "/j/", "/room/", "/game/", "/lobby/"];

function isPrivateRoute(pathname: string): boolean {
  if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Per-game room and game routes: /domino/game/123, /codenames/room/123, …
  return /\/(room|game)\/[^/]+$/.test(pathname);
}

/**
 * A readable name for a route we have no page metadata for.
 *
 * The catalogue already knows every game's name in both languages, and every
 * game route starts with that game's own path, so this is a prefix match
 * rather than another list to keep in sync.
 */
function titleFor(pathname: string, lang: "en" | "ar"): string {
  const game = GAMES.find(
    (g) => pathname === g.path || pathname.startsWith(`${g.path}/`),
  );
  if (game) return game.name[lang];
  // Liar's Bar is the one game whose room and board predate the per-game
  // route convention: its setup page is /play but it plays at /game/:code and
  // /room/:code, which no prefix match can reach.
  if (/^\/(game|room)\//.test(pathname)) {
    const liars = GAMES.find((g) => g.id === "liars-bar");
    if (liars) return liars.name[lang];
  }
  if (pathname.startsWith("/arcade")) return lang === "ar" ? "الأركيد" : "Arcade";
  return BRAND.name;
}

export default function RouteMeta() {
  const { pathname } = useLocation();
  const { lang } = useLanguage();
  const [fallback, setFallback] = useState<Fallback | null>(null);

  useEffect(() => {
    setFallback(null);
    const timer = window.setTimeout(() => {
      if (claimedPathname() === pathname) return;
      setFallback({
        title: titleFor(pathname, lang),
        description: BRAND.description[lang],
        path: pathname,
        noindex: isPrivateRoute(pathname),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, lang]);

  if (!fallback) return null;

  return (
    <Seo
      title={fallback.title}
      description={fallback.description}
      path={fallback.path}
      noindex={fallback.noindex}
      lang={lang}
    />
  );
}
