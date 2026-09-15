#!/usr/bin/env node
/**
 * Copy the wire contract from `server/src/shared/` into
 * `web/src/lib/generated/`.
 *
 *   cd server && npm run types:sync     # write the copies
 *   cd server && npm run types:check    # fail if they've drifted
 *
 * ## Why a copy and not a shared package
 *
 * Both deployments build from a single directory and nothing else: the
 * server's Dockerfile copies only `server/src`, and Vercel builds the web app
 * with `web/` as its root. A cross-package import would work perfectly on a
 * developer's machine and fail in both deployments — the worst possible place
 * to find out.
 *
 * Generating a committed copy keeps each package buildable standalone, exactly
 * as it is today, while still having one place where the contract is defined.
 * `types:check` in CI makes the copy impossible to edit by accident.
 *
 * ## What it does to the source
 *
 * Two small rewrites, both needed because the two toolchains resolve modules
 * differently:
 *
 *   - `from "./x.js"` → `from "./x"`. The server emits NodeNext-style ESM and
 *     needs the `.js` extension; Vite's bundler resolution does not want it.
 *   - Prepends a DO-NOT-EDIT banner naming the source file.
 *
 * Nothing else is transformed. If a shared file ever needs more than this, it
 * is doing something it shouldn't (see shared/README.md).
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../src/shared");
const DEST = resolve(here, "../../web/src/lib/generated");

const checkOnly = process.argv.includes("--check");

const BANNER = (source) => `/**
 * ============================================================================
 *  GENERATED FILE — DO NOT EDIT
 * ============================================================================
 *
 * Copied from server/src/shared/${source} by \`npm run types:sync\` (run from
 * the server package). Edit the source there, not this file.
 *
 * \`npm run types:check\` fails if this copy has drifted, so an edit here will
 * be caught rather than silently diverging from what the server actually sends.
 */

`;

function transform(source, filename) {
  // The server emits ESM with explicit extensions; Vite's resolver does not
  // want them. This is the only structural difference between the two copies.
  const body = source.replace(/(from\s+")(\.\/[^"]+)\.js(")/g, "$1$2$3");
  return BANNER(filename) + body;
}

if (!existsSync(SRC)) {
  console.error(`sync-types: ${SRC} does not exist.`);
  process.exit(1);
}

const files = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
if (files.length === 0) {
  console.error("sync-types: no .ts files in server/src/shared");
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });

let drifted = 0;
let written = 0;

for (const file of files) {
  const source = readFileSync(join(SRC, file), "utf8");

  // Guard the rules from shared/README.md at the point they'd be broken.
  if (/from\s+"(?!\.\/)/.test(source)) {
    const bad = source.match(/from\s+"([^"]+)"/g) ?? [];
    console.error(
      `sync-types: ${file} imports from outside shared/: ${bad.join(", ")}\n` +
        "  The generated copy has no way to resolve those. See shared/README.md.",
    );
    process.exit(1);
  }
  if (/\bnode:|require\(/.test(source)) {
    console.error(`sync-types: ${file} uses Node APIs. Shared files must run in a browser too.`);
    process.exit(1);
  }

  const expected = transform(source, file);
  const destPath = join(DEST, file);
  const current = existsSync(destPath) ? readFileSync(destPath, "utf8") : null;

  if (current === expected) continue;

  if (checkOnly) {
    drifted++;
    console.error(
      current === null
        ? `  MISSING  web/src/lib/generated/${file}`
        : `  DRIFTED  web/src/lib/generated/${file}`,
    );
    continue;
  }

  writeFileSync(destPath, expected, "utf8");
  written++;
  console.log(`  wrote  web/src/lib/generated/${file}`);
}

// An index barrel so the client imports one path rather than five.
const barrel =
  BANNER("(index, generated from the file list)") +
  files
    .map((f) => `export * from "./${basename(f, ".ts")}";`)
    .sort()
    .join("\n") +
  "\n";

const barrelPath = join(DEST, "index.ts");
const currentBarrel = existsSync(barrelPath) ? readFileSync(barrelPath, "utf8") : null;
if (currentBarrel !== barrel) {
  if (checkOnly) {
    drifted++;
    console.error("  DRIFTED  web/src/lib/generated/index.ts");
  } else {
    writeFileSync(barrelPath, barrel, "utf8");
    written++;
    console.log("  wrote  web/src/lib/generated/index.ts");
  }
}

if (checkOnly) {
  if (drifted > 0) {
    console.error(
      `\nsync-types: ${drifted} generated file(s) out of date.\n` +
        "Run `npm run types:sync` from the server package and commit the result.\n" +
        "If you edited the generated copy directly: don't — edit server/src/shared/ instead.",
    );
    process.exit(1);
  }
  console.log(`sync-types: ${files.length} contract file(s) in sync.`);
} else {
  console.log(
    written === 0
      ? `sync-types: already up to date (${files.length} files).`
      : `sync-types: wrote ${written} file(s).`,
  );
}
