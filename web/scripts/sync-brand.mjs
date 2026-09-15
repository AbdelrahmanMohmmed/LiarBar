#!/usr/bin/env node
/**
 * Regenerate the files that crawlers read WITHOUT running JavaScript, from
 * `src/lib/brand.ts`.
 *
 *   cd web && npm run brand:sync
 *
 * ## Why this script exists
 *
 * Everything a user sees in the app comes from `brand.ts` at runtime. But
 * three files are read by machines that never execute the bundle:
 *
 *   - `index.html`            — the only markup a non-JS crawler sees. Google
 *                               does render JS, but link-preview scrapers
 *                               (WhatsApp, Telegram, Slack, Discord, X) do NOT,
 *                               and for this product the WhatsApp preview is
 *                               far more important than the Google snippet —
 *                               it is what every single invited player sees.
 *   - `public/sitemap.xml`    — read by the crawler directly.
 *   - `public/site.webmanifest` — read by the OS when someone installs the PWA.
 *
 * Those three therefore have to contain the brand as literal text. Generating
 * them means a rename can't leave the old name in the one place that is most
 * publicly visible, which is exactly the failure mode a manual checklist has.
 *
 * The generator parses `brand.ts` with regexes rather than importing it. That
 * looks lazy and is deliberate: importing would require a TS toolchain in the
 * script's own runtime, and the parse only has to handle the handful of
 * top-level string literals this script cares about. It fails loudly if it
 * can't find them, so a silently stale file isn't possible.
 *
 * ## `--check`
 *
 * Generating is only half of it: nothing forced anyone to *run* the generator,
 * and the files went stale the moment two games were added without it — which
 * is how `sitemap.xml` came to omit the two newest pages on a site whose owner
 * had asked why it doesn't appear in search results.
 *
 * `node scripts/sync-brand.mjs --check` regenerates into memory and compares,
 * and it runs as part of `npm run build`, so a stale static file now fails a
 * deploy rather than surviving one. `<lastmod>` is normalised out of the
 * comparison — it is today's date by construction and would otherwise make the
 * check fail every day for no reason.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_ONLY = process.argv.includes("--check");

/** Everything this script produces, so it can be written or compared. */
const outputs = [];
function emit(relPath, content) {
  outputs.push({ relPath, content });
}

/** `<lastmod>` is today's date by construction and must not fail the check. */
function comparable(text) {
  return text.replace(/<lastmod>[^<]*<\/lastmod>/g, "<lastmod/>");
}

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const brandPath = resolve(webRoot, "src/lib/brand.ts");

const source = readFileSync(brandPath, "utf8");

function field(name) {
  const match = source.match(new RegExp(`\\b${name}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!match) {
    console.error(
      `sync-brand: could not find \`${name}\` in src/lib/brand.ts.\n` +
        "The file's shape changed; update this script rather than editing the " +
        "generated files by hand.",
    );
    process.exit(1);
  }
  return match[1];
}

/** Pull one side of a `{ en: "...", ar: "..." }` block that follows `key:`. */
function bilingual(key) {
  const block = source.match(new RegExp(`\\b${key}:\\s*\\{([\\s\\S]*?)\\}`));
  if (!block) {
    console.error(`sync-brand: could not find bilingual field \`${key}\`.`);
    process.exit(1);
  }
  const en = block[1].match(/\ben:\s*"((?:[^"\\]|\\.)*)"/);
  const ar = block[1].match(/\bar:\s*"((?:[^"\\]|\\.)*)"/);
  if (!en || !ar) {
    console.error(`sync-brand: \`${key}\` is missing en or ar.`);
    process.exit(1);
  }
  return { en: en[1], ar: ar[1] };
}

const name = field("name");
const nameAr = field("nameAr");
const domain = field("domain");
const tagline = bilingual("tagline");
const description = bilingual("description");
const siteUrl = `https://${domain}`;

/** Escape for use inside an HTML attribute or XML text node. */
const esc = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const title = `${name} — ${tagline.en}`;

// Games listed in the static structured data. Kept minimal on purpose: rich
// results need name/url/description and nothing else, and a long hand-mirrored
// list here is a second source of truth that will drift from brand.ts.
const games = [...source.matchAll(/id:\s*"([a-z-]+)",\s*\n\s*name:\s*\{\s*en:\s*"([^"]+)"[\s\S]*?path:\s*"([^"]+)"/g)]
  .map(([, id, gameName, path]) => ({ id, name: gameName, path }));

const routes = ["/", ...new Set(games.map((g) => g.path))];

// ---------------------------------------------------------------------------
// index.html
// ---------------------------------------------------------------------------

const html = `<!doctype html>
<html lang="en">
  <head>
    <!--
      GENERATED by scripts/sync-brand.mjs from src/lib/brand.ts.
      Do not edit the branded strings here by hand — run \`npm run brand:sync\`.
      Everything below the marked section is hand-written and is preserved.
    -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />

    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description.en)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <!-- Matches --ink-900 in index.css so the browser chrome doesn't flash a
         different colour than the page behind it. -->
    <meta name="theme-color" content="#14100E" />
    <meta name="author" content="${esc(name)}" />
    <link rel="canonical" href="${siteUrl}/" />

    <!-- Open Graph. This is what a WhatsApp link preview renders, and for this
         product that preview is seen by every invited player — it matters more
         than any search snippet. -->
    <meta property="og:site_name" content="${esc(name)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description.en)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${siteUrl}/" />
    <meta property="og:image" content="${siteUrl}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:locale:alternate" content="ar_AR" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description.en)}" />
    <meta name="twitter:image" content="${siteUrl}/og.png" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" href="/favicon.png" sizes="any" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Baloo+2:wght@500;600;700;800&display=swap"
      rel="stylesheet"
    />

    <script type="application/ld+json">
${JSON.stringify(
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name,
        alternateName: nameAr,
        description: description.en,
        inLanguage: ["en", "ar"],
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name,
        alternateName: nameAr,
        url: `${siteUrl}/`,
        logo: `${siteUrl}/icon.png`,
      },
      {
        "@type": "ItemList",
        name: `Games on ${name}`,
        itemListElement: games.map((game, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "VideoGame",
            name: game.name,
            url: `${siteUrl}${game.path}`,
            playMode: "MultiPlayer",
            gamePlatform: "Web browser",
            applicationCategory: "Game",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        })),
      },
    ],
  },
  null,
  2,
)
  .split("\n")
  .map((line) => "      " + line)
  .join("\n")}
    </script>
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

emit("index.html", html);

// ---------------------------------------------------------------------------
// sitemap.xml
// ---------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by scripts/sync-brand.mjs. Run \`npm run brand:sync\`. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}${route === "/" ? "/" : route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route === "/" ? "1.0" : "0.8"}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
emit("public/sitemap.xml", sitemap);

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

const robots = `# GENERATED by scripts/sync-brand.mjs. Run \`npm run brand:sync\`.
User-agent: *
Allow: /

# Room and invite URLs are per-session and contain nothing useful to a crawler;
# indexing them would fill the index with dead pages as rooms expire.
Disallow: /r/
Disallow: /j/
Disallow: /room/
Disallow: /game/
Disallow: /lobby/

Sitemap: ${siteUrl}/sitemap.xml
`;
emit("public/robots.txt", robots);

// ---------------------------------------------------------------------------
// site.webmanifest
// ---------------------------------------------------------------------------

const manifest = {
  name,
  short_name: name,
  description: description.en,
  start_url: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#14100E",
  theme_color: "#14100E",
  icons: [
    { src: "/favicon.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  categories: ["games", "entertainment", "social"],
  lang: "en",
  dir: "ltr",
};
emit("public/site.webmanifest", JSON.stringify(manifest, null, 2) + "\n");

// ---------------------------------------------------------------------------
// Write, or compare and complain
// ---------------------------------------------------------------------------

if (CHECK_ONLY) {
  const stale = [];
  for (const { relPath, content } of outputs) {
    let onDisk = "";
    try {
      onDisk = readFileSync(resolve(webRoot, relPath), "utf8");
    } catch {
      stale.push(`${relPath} (missing)`);
      continue;
    }
    if (comparable(onDisk) !== comparable(content)) stale.push(relPath);
  }

  if (stale.length === 0) {
    console.log(`sync-brand: ${outputs.length} generated file(s) in sync.`);
    process.exit(0);
  }

  console.error("");
  console.error("sync-brand: generated files are out of date:");
  for (const f of stale) console.error(`  - ${f}`);
  console.error("");
  console.error("  These are the files crawlers and link previews read without");
  console.error("  running JavaScript, so a stale one is invisible in the app and");
  console.error("  wrong everywhere else. Fix with:");
  console.error("");
  console.error("      cd web && npm run brand:sync");
  console.error("");
  process.exit(1);
}

for (const { relPath, content } of outputs) {
  writeFileSync(resolve(webRoot, relPath), content, "utf8");
}

console.log(`sync-brand: wrote index.html, sitemap.xml, robots.txt, site.webmanifest`);
console.log(`  brand : ${name} (${nameAr})`);
console.log(`  domain: ${siteUrl}`);
console.log(`  routes: ${routes.join(", ")}`);
