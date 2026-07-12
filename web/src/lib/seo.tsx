import { useEffect } from "react";

/**
 * Lightweight per-route SEO for the SPA. React 18 has no built-in document
 * metadata support, so this hook imperatively upserts the relevant <head>
 * tags whenever a page mounts or its inputs change. Google (and other
 * JS-executing crawlers) pick these up; the static defaults in index.html
 * cover crawlers that don't run JS.
 */

const SITE_NAME = "Safariyat Games";
export const SITE_URL = "https://games.safariyat.live";
const DEFAULT_OG_IMAGE = `${SITE_URL}/icon.png`;

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

export interface SeoProps {
  title: string;
  description: string;
  /** Path only, e.g. "/codenames". Combined with SITE_URL for canonical/og:url. */
  path?: string;
  image?: string;
  /** Set true for room/game/lobby routes that shouldn't be indexed. */
  noindex?: boolean;
  /** Page language for <html lang> and og:locale. */
  lang?: "en" | "ar";
  /** Optional JSON-LD structured data for rich results & AI answer engines. */
  jsonLd?: JsonLd;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const JSON_LD_ID = "route-json-ld";

export function Seo({
  title,
  description,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  noindex = false,
  lang = "en",
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const fullTitle = title.includes(SITE_NAME)
      ? title
      : `${title} — ${SITE_NAME}`;

    document.title = fullTitle;
    document.documentElement.lang = lang;

    upsertMeta("name", "description", description);
    upsertMeta(
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow",
    );
    upsertLink("canonical", url);

    // Open Graph
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:locale", lang === "ar" ? "ar_AR" : "en_US");

    // Twitter
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    // JSON-LD structured data (replace previous route's block)
    const existing = document.getElementById(JSON_LD_ID);
    if (existing) existing.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = JSON_LD_ID;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, path, image, noindex, lang, jsonLd]);

  return null;
}
