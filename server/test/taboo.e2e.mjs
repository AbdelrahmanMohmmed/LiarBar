/**
 * End-to-end check for Taboo, against a live server.
 *
 *   cd server && npm run test:taboo     (server must be running)
 *
 * The rule that matters here is who can see the card, and it is not a simple
 * one: the describer sees it, the *opposing* team sees it — they're the ones
 * who buzz — and the describer's own teammates must not, because they're the
 * ones guessing. Three different answers for three groups of people, from one
 * `toPlayerState`, and only a real socket can tell you it got them right.
 *
 * The rest covers the scoring paths and the turn rotation, which are easy to
 * get subtly wrong in a way nobody notices until a match ends unfairly.
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
  s.on("game_state", (st) => s.states.push(st?.gameId === "party" ? st.subGameState : st));
  s.on("taboo_private", (st) => s.privates.push(st));
  return s;
}

const pub = (s) => s.states.at(-1);
const prv = (s) => s.privates.at(-1);

(async () => {
  console.log("\nTaboo end-to-end\n");

  // Four players: seats alternate, so A = {Ahmed, Omar}, B = {Sara, Nour}.
  const host = track(await connect());
  const created = await emit(host, "create_room", {
    playerName: "Ahmed",
    gameId: "taboo",
    maxPlayers: 8,
    targetScore: 5,
    language: "en",
  });
  const code = created.roomId;

  const clients = { Ahmed: host };
  const ids = { Ahmed: created.playerId };
  for (const name of ["Sara", "Omar", "Nour"]) {
    const c = track(await connect());
    const res = await emit(c, "join_room", { roomId: code, playerName: name });
    ids[name] = res.playerId;
    clients[name] = c;
  }
  await sleep(300);

  const seats = pub(host)?.seats ?? [];
  const teamOf = (name) => seats.find((s) => s.playerId === ids[name])?.team;
  if (teamOf("Ahmed") === "a" && teamOf("Sara") === "b" && teamOf("Omar") === "a" && teamOf("Nour") === "b") {
    ok("seats alternate into two teams with nobody choosing anything");
  } else {
    bad("teams", JSON.stringify(seats.map((s) => [s.name, s.team])));
  }

  await emit(host, "start_game", {});
  await sleep(400);

  const opening = pub(host);
  if (opening?.phase === "describing") ok("the match starts straight into a turn");
  else bad("start", `phase ${opening?.phase}`);

  if (opening?.describingTeam === "a" && opening.describerId === ids.Ahmed) {
    ok("team A opens, with the first seat describing");
  } else {
    bad("rotation", `team ${opening?.describingTeam}, describer ${opening?.describerId}`);
  }

  // ------------------------------------------------------------------
  // Who can see the card. The whole game.
  // ------------------------------------------------------------------
  const describerCard = prv(clients.Ahmed)?.card;
  const teammateCard = prv(clients.Omar)?.card;
  const opponentCard = prv(clients.Sara)?.card;

  if (describerCard?.word && Array.isArray(describerCard.taboo)) {
    ok(`the describer holds a card ("${describerCard.word}", ${describerCard.taboo.length} forbidden)`);
  } else {
    bad("card", JSON.stringify(describerCard));
  }
  if (opponentCard?.word === describerCard?.word) {
    ok("the opposing team sees the same card — they're the ones who buzz");
  } else {
    bad("card", `opponent saw ${JSON.stringify(opponentCard)}`);
  }
  if (teammateCard === null) {
    ok("the describer's own teammate sees nothing, because they're guessing");
  } else {
    bad("LEAK", `teammate saw ${JSON.stringify(teammateCard)}`);
  }

  const publicJson = JSON.stringify(opening);
  if (!publicJson.includes(describerCard.word)) {
    ok("and the word is nowhere in the public broadcast");
  } else {
    bad("LEAK", "the word in play is in the public state");
  }

  if (prv(clients.Sara)?.canBuzz === true && prv(clients.Omar)?.canBuzz === false) {
    ok("only the opposing team is told it may buzz");
  } else {
    bad("canBuzz", `Sara ${prv(clients.Sara)?.canBuzz}, Omar ${prv(clients.Omar)?.canBuzz}`);
  }

  // ------------------------------------------------------------------
  // Scoring.
  // ------------------------------------------------------------------
  let rejectedWrongTeam = false;
  try {
    await emit(clients.Omar, "taboo_buzz", {});
  } catch {
    rejectedWrongTeam = true;
  }
  if (rejectedWrongTeam) ok("a player on the describing team cannot buzz their own describer");
  else bad("buzz", "a teammate was allowed to buzz");

  let rejectedNonDescriber = false;
  try {
    await emit(clients.Omar, "taboo_correct", {});
  } catch {
    rejectedNonDescriber = true;
  }
  if (rejectedNonDescriber) ok("and only the describer can mark a card correct");
  else bad("correct", "a non-describer scored a card");

  const firstWord = describerCard.word;
  await emit(host, "taboo_correct", {});
  await sleep(200);
  if (pub(host)?.scores.a === 1) ok("a correct card is worth 1 to the describing team");
  else bad("score", JSON.stringify(pub(host)?.scores));

  const second = prv(clients.Ahmed)?.card;
  if (second?.word && second.word !== firstWord) ok("and a fresh card is dealt");
  else bad("deal", `second card ${JSON.stringify(second)}`);

  await emit(host, "taboo_skip", {});
  await sleep(200);
  if (pub(host)?.scores.a === 1) ok("a skip costs nothing but the clock");
  else bad("skip", JSON.stringify(pub(host)?.scores));

  await emit(clients.Sara, "taboo_buzz", {});
  await sleep(200);
  if (pub(host)?.scores.a === 0) ok("a buzz takes a point back off the describing team");
  else bad("buzz", JSON.stringify(pub(host)?.scores));

  const resolved = pub(host)?.turnResults ?? [];
  if (resolved.length === 3 && resolved.map((r) => r.outcome).join(",") === "correct,skipped,buzzed") {
    ok("the turn keeps a public record of what happened to each resolved card");
  } else {
    bad("turnResults", JSON.stringify(resolved));
  }
  if (!JSON.stringify(pub(host)).includes(prv(clients.Ahmed).card.word)) {
    ok("but still never the word currently in play");
  } else {
    bad("LEAK", "the live word leaked into turnResults");
  }

  // ------------------------------------------------------------------
  // The turn ends, and the other team goes.
  // ------------------------------------------------------------------
  console.log("\n  …waiting out the 60-second turn\n");
  const turnEnd = Date.now() + 90000;
  while (pub(host)?.phase === "describing" && Date.now() < turnEnd) await sleep(1000);

  const recapState = pub(host);
  if (recapState?.phase === "turn_recap" && recapState.recap) {
    ok("the clock ends the turn into a recap");
  } else {
    bad("recap", `phase ${recapState?.phase}`);
  }
  if (recapState?.recap?.results.length === 3 && recapState.recap.points === 0) {
    ok(`the recap totals the turn (${recapState.recap.results.length} cards, ${recapState.recap.points} points)`);
  } else {
    bad("recap", JSON.stringify(recapState?.recap));
  }
  if (prv(clients.Omar)?.card === null && prv(clients.Sara)?.card === null) {
    ok("and every private card is cleared once the turn is over");
  } else {
    bad("recap", "a stale card survived the turn");
  }

  console.log("\n  …waiting for the next turn\n");
  const nextTurn = Date.now() + 40000;
  while (pub(host)?.phase !== "describing" && Date.now() < nextTurn) await sleep(500);

  const turn2 = pub(host);
  if (turn2?.describingTeam === "b") ok("the next turn goes to the other team");
  else bad("rotation", `team ${turn2?.describingTeam}`);

  // Which *seat* describes is deliberately not asserted. `startTurn` skips a
  // team-mate whose socket has dropped, which is correct behaviour and which a
  // loaded machine can trigger on its own — so pinning a name here makes the
  // file fail for a reason that is not a bug. The rule is that the describer is
  // on the describing team, and that is what gets checked.
  const describer2 = turn2?.seats.find((s) => s.playerId === turn2.describerId);
  if (describer2?.team === "b") ok(`and to one of their seats (${describer2.name})`);
  else bad("rotation", `describer ${describer2?.name} is on team ${describer2?.team}`);

  // Same argument for the inversion: check the rule against whoever is
  // actually describing, not against a name decided before the turn began.
  const nameOnTeam = (team, exclude) =>
    Object.keys(ids).find(
      (name) =>
        ids[name] !== exclude &&
        turn2?.seats.find((s) => s.playerId === ids[name])?.team === team,
    );
  const opponent = nameOnTeam("a", null);
  const teammate = nameOnTeam("b", turn2?.describerId);
  const opponentSees = opponent ? prv(clients[opponent])?.card?.word : undefined;
  const teammateSees = teammate ? prv(clients[teammate])?.card : undefined;

  if (opponentSees && teammateSees === null) {
    ok(`the roles invert cleanly: ${opponent} now holds the card, ${teammate} is guessing`);
  } else {
    bad(
      "inversion",
      `${opponent} ${JSON.stringify(opponentSees)}, ${teammate} ${JSON.stringify(teammateSees)}`,
    );
  }

  Object.values(clients).forEach((c) => c.close());
  console.log(
    failures
      ? `\n=== TABOO: ${failures} CHECK(S) FAILED ===`
      : "\n=== TABOO: all checks passed ===",
  );
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
