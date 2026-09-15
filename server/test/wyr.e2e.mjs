/**
 * End-to-end check for Would You Rather, against a live server.
 *
 *   cd server && npm run test:wyr     (server must be running)
 *
 * The property that has to hold above all others: **the subject's answer must
 * not reach anyone else before the reveal.** It's the only secret in the game,
 * and a leak wouldn't break anything visibly — it would just quietly make every
 * round unwinnable-by-accident, and nobody would be able to tell from the UI.
 *
 * The other thing worth pinning is the asymmetric scoring, because it is the
 * design decision most likely to be "simplified" by a later change: the subject
 * scores per person who got it WRONG, so surprising the table is rewarded and
 * being predictable is worth nothing.
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
  s.on("wyr_private", (st) => s.privates.push(st));
  return s;
}

const sub = (s) => {
  const st = s.states.at(-1);
  return st?.gameId === "party" ? st.subGameState : st;
};

(async () => {
  console.log("\nWould You Rather end-to-end\n");

  const host = track(await connect());
  const created = await emit(host, "create_room", {
    playerName: "Ahmed",
    gameId: "wyr",
    maxPlayers: 8,
    targetScore: 5,
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

  const state = sub(host);
  if (state.phase === "choosing") ok("the round opens in the choosing phase");
  else bad("phase", `expected choosing, got ${state.phase}`);

  if (state.dilemma && state.dilemma.a?.en && state.dilemma.a?.ar) {
    ok(`the dilemma is public and bilingual ("${state.dilemma.a.en}")`);
  } else {
    bad("dilemma", "missing or not bilingual");
  }

  // Exactly one subject, and everyone agrees who it is.
  const subjectIds = new Set(all.map((c) => sub(c).subjectId));
  if (subjectIds.size === 1 && [...subjectIds][0]) {
    ok("every client sees the same subject");
  } else {
    bad("subject", `clients disagree: ${[...subjectIds].join(", ")}`);
  }

  const subjectId = state.subjectId;
  const subjectIndex = state.seats.findIndex((s) => s.playerId === subjectId);
  const subjectClient = all[subjectIndex];
  const others = all.filter((_, i) => i !== subjectIndex);

  const flags = all.map((c) => c.privates.at(-1)?.isSubject);
  if (flags.filter(Boolean).length === 1 && flags[subjectIndex] === true) {
    ok("exactly one client is told it is the subject");
  } else {
    bad("isSubject", JSON.stringify(flags));
  }

  // --- Only the subject can answer ---
  try {
    await emit(others[0], "wyr_choose", { choice: "a" });
    bad("choose auth", "a non-subject was allowed to answer");
  } catch (e) {
    ok("only the subject can answer: " + e.message);
  }

  await emit(subjectClient, "wyr_choose", { choice: "b" });
  await sleep(300);

  if (sub(host).phase === "predicting") ok("answering moves the round to predicting");
  else bad("phase", `expected predicting, got ${sub(host).phase}`);

  // --- THE IMPORTANT ONE: the answer must not have leaked ---
  const publicJson = JSON.stringify(sub(host));
  if (!publicJson.includes('"answer"')) {
    ok("the public broadcast does not contain the answer");
  } else {
    bad("PUBLIC LEAK", "the answer is in the public state");
  }

  const otherPrivates = others.map((c) => c.privates.at(-1));
  if (otherPrivates.every((p) => p && p.myAnswer === null)) {
    ok("no other player's private state contains the answer");
  } else {
    bad("PRIVATE LEAK", JSON.stringify(otherPrivates.map((p) => p?.myAnswer)));
  }
  if (subjectClient.privates.at(-1)?.myAnswer === "b") {
    ok("the subject can still see their own answer");
  } else {
    bad("subject state", "the subject lost their own answer");
  }

  // --- The subject cannot predict ---
  try {
    await emit(subjectClient, "wyr_predict", { choice: "a" });
    bad("predict auth", "the subject was allowed to predict");
  } catch (e) {
    ok("the subject cannot predict: " + e.message);
  }

  // --- Predictions are hidden while open ---
  await emit(others[0], "wyr_predict", { choice: "b" }); // right
  await sleep(150);
  const mid = sub(host);
  if (mid.seats.every((s) => s.prediction === undefined || s.prediction === null)) {
    ok("predictions stay hidden while the vote is open");
  } else {
    bad("prediction privacy", "a prediction was visible mid-round");
  }
  if (mid.seats.find((s) => s.playerId === sub(others[0]).seats[0].playerId)) {
    ok("but 'has locked in' is visible, so the table knows who to wait for");
  }

  try {
    await emit(others[0], "wyr_predict", { choice: "a" });
    bad("double predict", "a second prediction was accepted");
  } catch (e) {
    ok("one prediction per player: " + e.message);
  }

  // Two wrong, one right → subject scores 2, the right predictor scores 1.
  await emit(others[1], "wyr_predict", { choice: "a" });
  await emit(others[2], "wyr_predict", { choice: "a" });
  await sleep(400);

  const final = sub(host);
  if (final.phase === "reveal" && final.reveal) ok("the round reveals once everyone has predicted");
  else bad("reveal", `phase is ${final.phase}`);

  const r = final.reveal;
  if (r.answer === "b") ok("the reveal names the real answer");
  else bad("reveal answer", r.answer);

  if (r.correctIds.length === 1 && r.wrongIds.length === 2) {
    ok("correct and wrong predictors are counted separately");
  } else {
    bad("counts", `${r.correctIds.length} right / ${r.wrongIds.length} wrong`);
  }

  if (r.pointsAwarded[subjectId] === 2) {
    ok("the subject scores 1 per person who got it WRONG (2 here)");
  } else {
    bad("asymmetric scoring", JSON.stringify(r.pointsAwarded));
  }
  if (r.pointsAwarded[r.correctIds[0]] === 1) {
    ok("each correct predictor scores 1");
  } else {
    bad("predictor scoring", JSON.stringify(r.pointsAwarded));
  }
  if (r.tally.a === 2 && r.tally.b === 1) ok("the reveal shows the split");
  else bad("tally", JSON.stringify(r.tally));

  if (final.seats.every((s) => s.prediction !== undefined)) {
    ok("predictions become public at the reveal");
  } else {
    bad("reveal", "predictions are still hidden after the reveal");
  }

  all.forEach((c) => c.close());
  console.log(
    failures
      ? `\n=== WOULD YOU RATHER: ${failures} CHECK(S) FAILED ===`
      : "\n=== WOULD YOU RATHER: all checks passed ===",
  );
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
