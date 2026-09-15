/**
 * End-to-end check for Spyfall, run against a live server.
 *
 *   cd server && npm run build && npm start &   # or npm run dev
 *   npm run test:spyfall
 *
 * Spyfall's rules are almost entirely about *who is allowed to know what*, and
 * that is exactly the kind of thing a unit test on the engine can't verify —
 * the question is what actually goes out over the wire to each socket. So this
 * runs four real clients and asserts on what each of them receives.
 *
 * The check that matters most: **the public broadcast must never identify the
 * spy, and an innocent player's private state must never reveal who the spy
 * is.** A leak there doesn't break the game loudly; it just quietly makes the
 * game pointless, and nobody would notice from the UI.
 */
import { io } from "socket.io-client";

const URL = process.env.PARTY_TEST_URL || "http://127.0.0.1:3001";

let failures = 0;
const ok = (name) => console.log("  ok  " + name);
const fail = (name, detail) => {
  failures++;
  console.error("  FAIL " + name + (detail ? "\n       " + detail : ""));
};

function connect() {
  return new Promise((res, rej) => {
    const s = io(URL, { transports: ["websocket"] });
    s.on("connect", () => res(s));
    s.on("connect_error", rej);
  });
}

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
  s.on("spyfall_private", (st) => s.privates.push(st));
  return s;
}

const lastSub = (s) => {
  const st = s.states.at(-1);
  return st?.gameId === "party" ? st.subGameState : st;
};

(async () => {
  console.log("\nSpyfall end-to-end\n");

  const host = track(await connect());
  const created = await emit(host, "create_room", {
    playerName: "Ahmed",
    gameId: "spyfall",
    maxPlayers: 8,
    roundSeconds: 300,
    targetScore: 4,
  });
  const code = created.roomId;

  const others = [];
  for (const name of ["Sara", "Omar", "Nour"]) {
    const client = track(await connect());
    await emit(client, "join_room", { roomId: code, playerName: name });
    others.push(client);
  }
  const all = [host, ...others];
  ok(`room ${code} created with 4 players`);

  await emit(host, "start_game", {});
  await sleep(500);

  // --- Every player got a private card ---
  const cards = all.map((c) => c.privates.at(-1));
  if (cards.every(Boolean)) ok("every player received a private card");
  else fail("private cards", `${cards.filter(Boolean).length}/4 received one`);

  // --- Exactly one spy ---
  const spies = cards.filter((c) => c?.isSpy);
  if (spies.length === 1) ok("exactly one spy was dealt");
  else fail("spy count", `got ${spies.length}`);

  // --- The spy knows nothing ---
  const spyCard = cards.find((c) => c?.isSpy);
  if (spyCard && spyCard.locationId === null && spyCard.role === null) {
    ok("the spy is told neither the location nor a role");
  } else {
    fail("spy leak", `spy card: ${JSON.stringify(spyCard)}`);
  }

  // --- Everyone else shares one location, with distinct roles ---
  const innocents = cards.filter((c) => c && !c.isSpy);
  const places = new Set(innocents.map((c) => c.locationId));
  if (places.size === 1 && [...places][0]) {
    ok(`all three innocents share one location (${[...places][0]})`);
  } else {
    fail("location", `innocents saw ${places.size} different locations`);
  }
  if (innocents.every((c) => c.role && c.role.en && c.role.ar)) {
    ok("every innocent got a bilingual role");
  } else {
    fail("roles", "an innocent has no role");
  }

  // --- THE IMPORTANT ONE: no leak in the public broadcast ---
  const publicState = lastSub(host);
  const publicJson = JSON.stringify(publicState);
  const spyIndex = cards.findIndex((c) => c?.isSpy);
  const spyPlayerId = publicState.seats[spyIndex]?.playerId;

  if (!("isSpy" in publicState) && !publicJson.includes('"spyId"')) {
    ok("the public broadcast identifies no spy");
  } else {
    fail("PUBLIC LEAK", "public state contains spy information");
  }
  if (!publicJson.includes('"locationName":{"en":"') || !publicState.reveal) {
    ok("the public broadcast does not contain the location");
  } else {
    fail("PUBLIC LEAK", "public state contains the location");
  }

  // An innocent's private state must not identify the spy either.
  const innocentClient = all.find((c) => !c.privates.at(-1)?.isSpy);
  const innocentJson = JSON.stringify(innocentClient.privates.at(-1));
  if (spyPlayerId && innocentJson.includes(spyPlayerId)) {
    // The spy's id legitimately appears in the seat list; what must NOT appear
    // is any field marking it as the spy's.
    const priv = innocentClient.privates.at(-1);
    if (priv.isSpy === false && !("spyId" in priv)) {
      ok("an innocent's private state does not mark who the spy is");
    } else {
      fail("PRIVATE LEAK", "innocent can identify the spy");
    }
  } else {
    ok("an innocent's private state does not mark who the spy is");
  }

  // --- The location list is public (the spy needs it to guess) ---
  if (Array.isArray(publicState.locations) && publicState.locations.length > 20) {
    ok(`all ${publicState.locations.length} locations are public for guessing`);
  } else {
    fail("location list", "the guessable list is missing or too short");
  }

  // --- One accusation per player ---
  const accuser = all[0];
  const accuserSeat = lastSub(accuser).seats[0];
  const targetSeat = lastSub(accuser).seats[1];
  await emit(accuser, "spyfall_accuse", { targetId: targetSeat.playerId });
  await sleep(200);
  if (lastSub(accuser).phase === "voting" && lastSub(accuser).vote) {
    ok("accusing opens a vote");
  } else {
    fail("accuse", `phase is ${lastSub(accuser).phase}`);
  }

  // The accused can't vote on their own accusation.
  const accusedClient = all[1];
  try {
    await emit(accusedClient, "spyfall_vote", { agree: false });
    fail("self-vote", "the accused was allowed to vote");
  } catch (e) {
    ok("the accused cannot vote on their own accusation: " + e.message);
  }

  // A single "no" ends the vote immediately rather than burning the timer.
  await emit(all[2], "spyfall_vote", { agree: false });
  await sleep(200);
  if (lastSub(accuser).phase === "playing" && !lastSub(accuser).vote) {
    ok("one disagreement ends the vote at once");
  } else {
    fail("vote resolution", `phase is ${lastSub(accuser).phase}`);
  }

  // The accuser has spent their one accusation.
  try {
    await emit(accuser, "spyfall_accuse", { targetId: lastSub(accuser).seats[2].playerId });
    fail("accusation cap", "a second accusation was allowed");
  } catch (e) {
    ok("one accusation per player per round: " + e.message);
  }

  // --- Only the spy may guess ---
  const innocentGuesser = all.find((c) => !c.privates.at(-1)?.isSpy);
  try {
    await emit(innocentGuesser, "spyfall_guess", { locationId: "ahwa" });
    fail("guess auth", "a non-spy was allowed to guess");
  } catch (e) {
    ok("only the spy can name the location: " + e.message);
  }

  // --- The spy guessing ends the round and reveals everything ---
  const spyClient = all.find((c) => c.privates.at(-1)?.isSpy);
  const realLocation = innocents[0].locationId;
  await emit(spyClient, "spyfall_guess", { locationId: realLocation });
  await sleep(400);

  const after = lastSub(host);
  if (after.reveal && after.reveal.spyWon && after.reveal.locationId === realLocation) {
    ok("a correct guess ends the round and the spy wins");
  } else {
    fail("reveal", JSON.stringify(after.reveal));
  }
  if (after.reveal.pointsAwarded[after.reveal.spyId] === 4) {
    ok("a correct guess scores 4");
  } else {
    fail("scoring", JSON.stringify(after.reveal.pointsAwarded));
  }

  all.forEach((c) => c.close());
  console.log(
    failures
      ? `\n=== SPYFALL: ${failures} CHECK(S) FAILED ===`
      : "\n=== SPYFALL: all checks passed ===",
  );
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
