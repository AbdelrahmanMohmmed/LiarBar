/**
 * End-to-end check for Chameleon, against a live server.
 *
 *   cd server && npm run test:chameleon    (server must be running)
 *
 * Like Spyfall, the rules here are mostly about who is allowed to know what,
 * so the checks that matter are on what each socket actually receives — the
 * public broadcast must never say which cell is the secret, and the
 * chameleon's own private state must not contain it either.
 *
 * The other thing worth pinning is the "caught but guessed" path. It's the
 * rule that makes the game a game rather than a vote, and it's the one most
 * likely to be broken by a well-meaning refactor that treats being caught as
 * the end of the round.
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

function track(s) {
  s.states = [];
  s.privates = [];
  s.on("game_state", (st) => s.states.push(st));
  s.on("chameleon_private", (st) => s.privates.push(st));
  return s;
}

const sub = (s) => {
  const st = s.states.at(-1);
  return st?.gameId === "party" ? st.subGameState : st;
};

(async () => {
  console.log("\nChameleon end-to-end\n");

  const host = track(await connect());
  const created = await emit(host, "create_room", {
    playerName: "Ahmed",
    gameId: "chameleon",
    maxPlayers: 8,
    targetScore: 4,
  });
  const code = created.roomId;

  const rest = [];
  for (const name of ["Sara", "Omar", "Nour"]) {
    const c = track(await connect());
    await emit(c, "join_room", { roomId: code, playerName: name });
    rest.push(c);
  }
  const all = [host, ...rest];
  ok(`room ${code} created with 4 players`);

  await emit(host, "start_game", {});
  await sleep(500);

  const cards = all.map((c) => c.privates.at(-1));
  const chameleons = cards.filter((c) => c?.isChameleon);
  if (chameleons.length === 1) ok("exactly one chameleon was dealt");
  else bad("chameleon count", `got ${chameleons.length}`);

  const cham = cards.find((c) => c?.isChameleon);
  if (cham && cham.secretIndex === null) {
    ok("the chameleon is not told the secret word");
  } else {
    bad("chameleon leak", `secretIndex = ${cham?.secretIndex}`);
  }

  const innocents = cards.filter((c) => c && !c.isChameleon);
  const indices = new Set(innocents.map((c) => c.secretIndex));
  if (indices.size === 1 && typeof [...indices][0] === "number") {
    ok(`all innocents share one secret word (index ${[...indices][0]})`);
  } else {
    bad("secret word", `innocents saw ${indices.size} different indices`);
  }

  const publicState = sub(host);
  if (publicState.secretIndex === undefined && !("isChameleon" in publicState)) {
    ok("the public broadcast contains no secret");
  } else {
    bad("PUBLIC LEAK", JSON.stringify(Object.keys(publicState)));
  }

  if (Array.isArray(publicState.topic?.words) && publicState.topic.words.length === 16) {
    ok(`the grid is public: "${publicState.topic.title.en}", 16 words`);
  } else {
    bad("grid", "the topic grid is missing or not 16 words");
  }
  if (publicState.topic.words.every((w) => w.en && w.ar)) {
    ok("every grid word is bilingual");
  } else {
    bad("grid", "a word is missing a translation");
  }

  // --- Clue order and the one-word rule ---
  const clueOrder = [];
  for (let i = 0; i < 4; i++) {
    const current = sub(host).cluePlayerId;
    if (!current) break;
    clueOrder.push(current);
    const client = all.find((c) => sub(c).seats.some((s) => s.playerId === current) &&
      c.privates.at(-1) && sub(c).seats.find((s) => s.playerId === current));
    // Find the socket whose own id matches, via the create/join playerId.
    const owner =
      all.find((c) => c === host && created.playerId === current) ??
      all[sub(host).seats.findIndex((s) => s.playerId === current)];

    if (i === 0) {
      try {
        await emit(owner, "chameleon_clue", { clue: "two words" });
        bad("one-word rule", "a two-word clue was accepted");
      } catch (e) {
        ok("clues must be one word: " + e.message);
      }
    }
    await emit(owner, "chameleon_clue", { clue: `clue${i}` });
    await sleep(120);
  }

  if (new Set(clueOrder).size === clueOrder.length) {
    ok(`each player gave exactly one clue (${clueOrder.length} clues)`);
  } else {
    bad("clue order", "a player was asked twice");
  }

  await sleep(200);
  if (sub(host).phase === "voting") ok("voting opens after the last clue");
  else bad("phase", `expected voting, got ${sub(host).phase}`);

  // Running votes must stay hidden — a visible tally turns the vote into a
  // bandwagon and removes the deliberation it exists for.
  const seats = sub(host).seats;
  const chamSeatIndex = cards.findIndex((c) => c?.isChameleon);
  const chamId = seats[chamSeatIndex].playerId;

  for (const [i, client] of all.entries()) {
    if (i === chamSeatIndex) continue;
    const target = chamId;
    await emit(client, "chameleon_vote", { targetId: target });
    await sleep(80);
  }
  const midVote = sub(host);
  if (midVote.phase !== "voting" || midVote.seats.every((s) => s.votedFor === null)) {
    ok("running votes are hidden while voting is open");
  } else {
    bad("vote privacy", "votedFor was visible during voting");
  }

  // The chameleon votes too, and that closes the vote.
  await emit(all[chamSeatIndex], "chameleon_vote", {
    targetId: seats[(chamSeatIndex + 1) % seats.length].playerId,
  });
  await sleep(300);

  if (sub(host).phase === "guessing") {
    ok("catching the chameleon gives them one guess — not an instant loss");
  } else {
    bad("guess phase", `expected guessing, got ${sub(host).phase}`);
  }

  // Only the chameleon may guess.
  const innocentIdx = all.findIndex((_, i) => i !== chamSeatIndex);
  try {
    await emit(all[innocentIdx], "chameleon_guess", { index: 0 });
    bad("guess auth", "an innocent was allowed to guess");
  } catch (e) {
    ok("only the chameleon can guess: " + e.message);
  }

  // A correct guess salvages the round.
  const realIndex = innocents[0].secretIndex;
  await emit(all[chamSeatIndex], "chameleon_guess", { index: realIndex });
  await sleep(300);

  const final = sub(host);
  if (final.reveal?.guessedRight && final.reveal.chameleonWon) {
    ok("caught but guessed right → the chameleon still wins");
  } else {
    bad("reveal", JSON.stringify(final.reveal));
  }
  if (final.reveal.pointsAwarded[chamId] === 1) {
    ok("a salvaged round scores 1, less than escaping clean");
  } else {
    bad("scoring", JSON.stringify(final.reveal.pointsAwarded));
  }
  if (typeof final.reveal.secretWord?.ar === "string") {
    ok("the reveal names the word in both languages");
  } else {
    bad("reveal", "secretWord is not bilingual");
  }

  all.forEach((c) => c.close());
  console.log(
    failures
      ? `\n=== CHAMELEON: ${failures} CHECK(S) FAILED ===`
      : "\n=== CHAMELEON: all checks passed ===",
  );
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
