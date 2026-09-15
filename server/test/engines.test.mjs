/**
 * Contract checks that every game engine has to pass.
 *
 *   cd server && npm run test:engines
 *
 * These are not tests of any game's rules. They check the things the code
 * *outside* the engines depends on — and every one of them exists because the
 * dependency was silently broken in several engines at once, with no error
 * anywhere.
 *
 * The pattern is worth naming: when thirteen independent classes implement one
 * interface, the interface can only enforce what TypeScript can see. It cannot
 * enforce "you must call this callback at some point" or "your phase names
 * must be ones the sweeper recognises". Those are contracts a type system has
 * no vocabulary for, so they need a test, or they rot.
 *
 * Deliberately static analysis rather than gameplay: driving thirteen games —
 * some real-time, some needing four humans, some with no bots at all — to a
 * natural conclusion is a large amount of fragile machinery to check one
 * property per engine. Reading the source is crude and catches exactly the
 * regression that actually happened.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gamesDir = resolve(here, "../src/games");

let failures = 0;
const ok = (msg) => console.log("  ok  " + msg);
const bad = (msg, detail) => {
  failures++;
  console.error("  FAIL " + msg + (detail ? "\n       " + detail : ""));
};

/** Every engine source file: src/games/<game>/<Something>Game.ts (+ GameManager). */
function engineFiles() {
  const out = [];
  for (const entry of readdirSync(gamesDir)) {
    const dir = join(gamesDir, entry);
    if (!statSync(dir).isDirectory()) continue;
    if (entry === "party" || entry === "lobby") continue; // containers, not games
    for (const file of readdirSync(dir)) {
      if (/(Game|GameManager)\.ts$/.test(file)) {
        out.push({ game: entry, path: join(dir, file), file });
      }
    }
  }
  return out;
}

const engines = engineFiles();
console.log(`\nEngine contract checks (${engines.length} engines)\n`);

// ---------------------------------------------------------------------------
// 1. Every engine must report a winner.
// ---------------------------------------------------------------------------
//
// The party's cross-game scoreboard — the room's main reason to keep playing —
// is built entirely from onGameEnd. Seven of thirteen engines never called it,
// so more than half the catalogue contributed nothing to the night's standings
// and nobody could tell, because a missing callback throws nothing.

console.log("onGameEnd");
for (const { game, path, file } of engines) {
  const src = readFileSync(path, "utf8");
  if (/callbacks\.onGameEnd\s*\(|this\.onGameEnd\s*\(/.test(src)) {
    ok(`${game} reports a winner`);
  } else {
    bad(
      `${game} never calls onGameEnd`,
      `${file}: wins in this game will not appear on the party scoreboard.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Every phase name an engine assigns must be one games/phases.ts knows.
// ---------------------------------------------------------------------------
//
// Engines are free to name their own phases — a phase name is part of a game's
// own model and shows up in its client. But the transport layer asks questions
// about phase (can this room take a joiner? is this game over?), and a phase
// spelling it has never heard of silently answers "no" to both. That produced
// join_room rejecting every join to a Tetris room, add_bot failing in a party,
// and the sweeper never fast-expiring finished games of six types.

console.log("\nPhase vocabulary");
const phasesSrc = readFileSync(join(gamesDir, "phases.ts"), "utf8");
const known = new Set();
for (const match of phasesSrc.matchAll(/new Set\(\[([^\]]*)\]\)/g)) {
  for (const quoted of match[1].matchAll(/"([^"]+)"/g)) known.add(quoted[1]);
}
// Mid-game phases are the engine's own business; the transport layer only
// needs to recognise the pre-game and terminal ones.
const MIDGAME_OK = new Set([
  "playing",
  "voting",
  "reveal",
  "revealing",
  "round_recap",
  "waiting_for_challenge",
  "clue",
  "guess",
  "paused",
]);

for (const { game, path } of engines) {
  const src = readFileSync(path, "utf8");
  const assigned = new Set(
    [...src.matchAll(/(?:this\.)?phase(?:\s*:[^=]+)?\s*=\s*"([a-z_]+)"/g)].map((m) => m[1]),
  );
  const unknown = [...assigned].filter((p) => !known.has(p) && !MIDGAME_OK.has(p));

  if (unknown.length === 0) {
    ok(`${game} uses recognised phase names (${[...assigned].join(", ") || "none"})`);
  } else {
    bad(
      `${game} uses unrecognised phase name(s): ${unknown.join(", ")}`,
      "Add them to PRE_GAME_PHASES or TERMINAL_PHASES in games/phases.ts, or " +
        "to MIDGAME_OK in this test if they're genuinely mid-game.",
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Every engine must clean up its timers.
// ---------------------------------------------------------------------------
//
// destroy() is how the stale-room sweeper reclaims a room. An engine holding a
// live setInterval keeps its whole closure — board, hands, player list —
// reachable forever, and a busy server slowly fills up with games nobody is
// playing. The failure is invisible until the process runs out of memory.

console.log("\nTimer cleanup");
for (const { game, path } of engines) {
  const src = readFileSync(path, "utf8");
  const usesTimers = /setInterval\s*\(|setTimeout\s*\(/.test(src);
  if (!usesTimers) {
    ok(`${game} uses no timers`);
    continue;
  }
  const destroyBody = src.match(/destroy\s*\(\s*\)\s*:?\s*\w*\s*\{([\s\S]*?)\n  \}/);
  if (!destroyBody) {
    bad(`${game} has no destroy()`, "Timers will outlive the room.");
    continue;
  }
  if (/clearInterval|clearTimeout|clear\w*Timers?|stopLoop|stopTicking/.test(destroyBody[1])) {
    ok(`${game} clears its timers in destroy()`);
  } else {
    bad(
      `${game}'s destroy() clears no timers`,
      "A live timer keeps the whole engine closure reachable after the room is swept.",
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Every engine in the registry must have a catalogue entry.
// ---------------------------------------------------------------------------
//
// The catalogue is what the party picker reads and what validates options. An
// engine registered but not catalogued is unreachable from the picker and its
// options are unvalidated — it can only be started through a hand-crafted
// socket payload.

console.log("\nRegistry / catalogue agreement");
const registrySrc = readFileSync(join(gamesDir, "registry.ts"), "utf8");
const catalogSrc = readFileSync(join(gamesDir, "catalog.ts"), "utf8");

const registered = new Set(
  [...registrySrc.matchAll(/registerGame\(\s*"([a-z-]+)"/g)].map((m) => m[1]),
);
// The default game is registered via a constant rather than a literal.
if (/registerGame\(DEFAULT_GAME_ID/.test(registrySrc)) registered.add("liars-bar");

for (const id of registered) {
  if (id === "party" || id === "lobby") continue;
  const inCatalog =
    new RegExp(`\\bid:\\s*"${id}"`).test(catalogSrc) ||
    new RegExp(`"${id}":\\s*\\{`).test(catalogSrc);
  if (inCatalog) ok(`${id} is in the catalogue`);
  else bad(`${id} is registered but not in catalog.ts`, "It won't appear in the party picker.");
}

const ordered = new Set(
  [...catalogSrc.matchAll(/PARTY_GAME_ORDER[\s\S]*?\] as const/g)]
    .flatMap((m) => [...m[0].matchAll(/"([a-z-]+)"/g)].map((x) => x[1])),
);
for (const id of registered) {
  if (id === "party" || id === "lobby") continue;
  if (!ordered.has(id)) {
    bad(`${id} is missing from PARTY_GAME_ORDER`, "A party can never switch into it.");
  }
}
if ([...registered].every((id) => id === "party" || id === "lobby" || ordered.has(id))) {
  ok("every game appears in PARTY_GAME_ORDER");
}

console.log(
  failures
    ? `\n=== ENGINE CONTRACTS: ${failures} FAILURE(S) ===`
    : "\n=== ENGINE CONTRACTS: all engines pass ===",
);
process.exit(failures ? 1 : 0);
