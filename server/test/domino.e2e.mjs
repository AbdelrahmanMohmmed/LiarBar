/**
 * Domino, against a live server — specifically the private slice.
 *
 *   cd server && npm run test:domino:live     (server must be running)
 *
 * `domino.test.mjs` proves the rules and `domino.sim.mjs` proves a match
 * completes. Both passed while the game was, for a human, unplayable: every
 * tile rendered dimmed and the only control on screen was "Knock", every turn,
 * for everyone.
 *
 * The reason neither caught it is that the rules were right and the *public*
 * state was right. What was wrong was `playable` — the precomputed list of
 * legal moves that only ever appears on the private channel, and that only a
 * real client reads. It was pushed while the previous player's move was being
 * finished, so it was computed before the turn had moved, and "legal plays, if
 * it is your turn" was correctly empty. Nothing re-sent it once the turn
 * actually arrived.
 *
 * So this file checks one thing the other two structurally cannot: that at the
 * moment the server says it is your turn, the hand it says you hold and the
 * moves it says you may make agree with the board it is showing everyone.
 */
import { io } from "socket.io-client";

const URL = process.env.PARTY_TEST_URL || "http://127.0.0.1:3001";

let failures = 0;
const ok = (m) => console.log("  ok  " + m);
const bad = (m, d) => {
  failures++;
  console.error("  FAIL " + m + (d ? "\n       " + d : ""));
};

const connect = () =>
  new Promise((res, rej) => {
    const s = io(URL, { transports: ["websocket"] });
    s.on("connect", () => res(s));
    s.on("connect_error", rej);
  });

const emit = (s, ev, data) =>
  new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout: ${ev}`)), 6000);
    s.emit(ev, data, (r) => {
      clearTimeout(timer);
      r?.error ? rej(new Error(r.error)) : res(r);
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("\nDomino end-to-end (the private slice)\n");

  const host = await connect();
  let pub = null;
  let prv = null;
  host.on("game_state", (st) => {
    pub = st?.gameId === "party" ? st.subGameState : st;
  });
  host.on("domino_private", (st) => {
    prv = st;
  });

  await emit(host, "create_room", {
    playerName: "Ahmed",
    gameId: "domino",
    maxPlayers: 4,
    gameMode: "individual",
    targetScore: 101,
    turnTimeLimit: 20,
  });
  for (let i = 0; i < 3; i++) await emit(host, "add_bot", {});
  await emit(host, "start_game", {});
  await sleep(700);

  if (pub?.phase === "playing") ok("a four-seat match starts with three bots");
  else bad("start", `phase ${pub?.phase}`);

  // Seven each, or six if we happened to hold the double-six and have already
  // opened with it by the time this samples.
  if (Array.isArray(prv?.hand) && (prv.hand.length === 7 || prv.hand.length === 6)) {
    ok(`the private slice deals you a hand (${prv.hand.length} tiles)`);
  } else {
    bad("deal", `hand length ${prv?.hand?.length}`);
  }

  let turnsSeen = 0;
  let mismatches = 0;
  let sawAPlayableTurn = false;

  const check = () => {
    if (!pub || !prv || pub.phase !== "playing") return;
    if (pub.activeSeat !== prv.mySeat) return;
    turnsSeen++;

    const ends = [pub.ends?.left, pub.ends?.right].filter(
      (v) => v !== null && v !== undefined,
    );
    const hand = prv.hand ?? [];
    // An empty board means anything goes; otherwise a tile fits if either of
    // its halves matches either open pip.
    const couldPlay =
      ends.length === 0
        ? hand.length > 0
        : hand.some((t) => ends.includes(t.left) || ends.includes(t.right));
    const serverSaysCan = (prv.playable ?? []).length > 0;

    if (serverSaysCan) sawAPlayableTurn = true;
    if (couldPlay !== serverSaysCan) {
      mismatches++;
      console.error(
        `       ends ${JSON.stringify(ends)} · hand ${hand
          .map((t) => `${t.left}|${t.right}`)
          .join(",")} · playable ${JSON.stringify(prv.playable)}`,
      );
    }
  };

  // Check a moment after each message so the pair has settled.
  host.on("game_state", () => setTimeout(check, 30));
  host.on("domino_private", () => setTimeout(check, 30));

  // Never act. The turn timer plays this seat, the bots play theirs, and every
  // time the turn comes back round we get another sample.
  console.log("\n  …letting a round play itself out\n");
  await sleep(100000);

  if (turnsSeen >= 3) ok(`the turn came round to us ${turnsSeen} times`);
  else bad("turns", `only saw ${turnsSeen} of our own turns — too few to judge`);

  if (mismatches === 0) {
    ok("and every time, `playable` agreed with the board everyone could see");
  } else {
    bad("playable", `${mismatches} of ${turnsSeen} turns disagreed (see above)`);
  }

  if (sawAPlayableTurn) {
    ok("at least one of those turns offered a legal move at all");
  } else {
    bad(
      "playable",
      "every turn said we had nothing to play — technically consistent, " +
        "but this is the exact shape of the bug this file exists for",
    );
  }

  host.close();
  console.log(
    failures
      ? `\n=== DOMINO E2E: ${failures} CHECK(S) FAILED ===`
      : "\n=== DOMINO E2E: all checks passed ===",
  );
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
