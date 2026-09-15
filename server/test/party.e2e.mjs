/**
 * End-to-end check for the party flow, run against a live server.
 *
 *   cd server && npm run build && npm run test:party
 *
 * Deliberately not a unit test: every bug this file has caught so far was a
 * *sequencing* bug between the engine, the party wrapper and the socket layer
 * (for example, PartyRoom.startGame flipping its phase after the engine had
 * already broadcast, so clients received a state still saying "hub" and
 * nobody's screen moved to the game). Only a real socket round-trip sees those.
 *
 * Set PARTY_TEST_URL to point at a different server.
 */

import { io } from "socket.io-client";

const URL = process.env.PARTY_TEST_URL || "http://127.0.0.1:3999";
const log = (...a) => console.log(...a);
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };

function connect() {
  return new Promise((res, rej) => {
    const s = io(URL, { transports: ["websocket"] });
    s.on("connect", () => res(s));
    s.on("connect_error", rej);
  });
}
const emit = (s, ev, data) =>
  new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout ${ev}`)), 5000);
    s.emit(ev, data, (r) => { clearTimeout(timer); r?.error ? rej(new Error(r.error)) : res(r); });
  });

const states = new Map();
function track(s, name) {
  states.set(name, []);
  s.on("game_state", (st) => states.get(name).push(st));
  s.on("domino_private", (st) => { s.lastPrivate = st; });
  s.on("your_hand", (h) => { s.lastHand = h.hand; });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // --- Host creates a domino party ---
  const host = await connect(); track(host, "host");
  const created = await emit(host, "create_room", {
    playerName: "Ahmed", gameId: "domino", maxPlayers: 4,
    gameMode: "individual", targetScore: 100, turnTimeLimit: 30,
  });
  const code = created.roomId;
  log("1. created room", code, "envelope gameId =", created.state.gameId,
      "activeGameId =", created.state.activeGameId);
  if (created.state.gameId !== "party") fail("room is not a party");
  if (created.state.activeGameId !== "domino") fail("domino not staged");

  // --- Preview endpoint ---
  const preview = await (await fetch(`${URL}/api/room/${code}`)).json();
  log("2. preview:", JSON.stringify(preview));
  if (preview.activeGameId !== "domino") fail("preview missing activeGameId");

  // --- Two friends join ---
  const b = await connect(); track(b, "b");
  await emit(b, "join_room", { roomId: code, playerName: "Sara" });
  const c = await connect(); track(c, "c");
  await emit(c, "join_room", { roomId: code, playerName: "Omar" });
  log("3. three players joined");

  // --- Start the staged game ---
  await emit(host, "start_game", {});
  await sleep(300);
  const afterStart = states.get("host").at(-1);
  log("4. started. party phase =", afterStart.phase,
      "sub phase =", afterStart.subGameState?.phase,
      "board len =", afterStart.subGameState?.board?.length);
  if (afterStart.phase !== "playing") fail("party did not enter playing");
  if (!host.lastHand || host.lastHand.length !== 7) fail(`host hand = ${host.lastHand?.length}`);
  log("   host hand size:", host.lastHand.length);

  // --- THE headline feature: switch game, same room ---
  const playerIdsBefore = afterStart.players.map((p) => p.id).sort().join(",");
  await emit(host, "party_pick_game", { gameId: "higher-lower", options: {} });
  await sleep(300);
  const afterSwitch = states.get("host").at(-1);
  const playerIdsAfter = afterSwitch.players.map((p) => p.id).sort().join(",");
  log("5. switched to:", afterSwitch.activeGameId, "| room still", afterSwitch.roomId);
  if (afterSwitch.roomId !== code) fail("room code changed on switch!");
  if (afterSwitch.activeGameId !== "higher-lower") fail("switch did not take");
  if (playerIdsBefore !== playerIdsAfter) fail("PLAYER IDS CHANGED — voice mesh would drop");
  log("   player ids preserved (voice survives):", playerIdsAfter === playerIdsBefore);

  // --- A latecomer arrives mid-game ---
  const d = await connect(); track(d, "d");
  const late = await emit(d, "join_room", { roomId: code, playerName: "Nour" });
  log("6. latecomer joined mid-game:", late.success, "| party size:",
      states.get("host").at(-1).players.length);

  // --- A game the group is too small for is refused with a readable reason ---
  try {
    await emit(host, "party_pick_game", { gameId: "nonsense-game" });
    fail("unknown game was accepted");
  } catch (e) { log("7a. unknown game refused:", e.message); }
  // Codenames needs 4 and we have 4, so this must SUCCEED.
  await emit(host, "party_pick_game", { gameId: "codenames", options: { language: "en" } });
  await sleep(200);
  log("7b. codenames accepted with 4 players:",
      states.get("host").at(-1).activeGameId);

  // --- Non-host cannot switch ---
  try {
    await emit(b, "party_pick_game", { gameId: "tictactoe" });
    fail("non-host was allowed to switch");
  } catch (e) { log("8. non-host blocked:", e.message); }

  // --- Back to hub ---
  await emit(host, "party_return_hub", {});
  await sleep(200);
  const hub = states.get("host").at(-1);
  log("9. back to hub. phase =", hub.phase, "activeGameId =", hub.activeGameId);
  if (hub.phase !== "hub") fail("did not return to hub");

  // --- Leaving frees the seat ---
  const sizeBefore = hub.players.length;
  await emit(d, "party_leave", {});
  await sleep(200);
  const afterLeave = states.get("host").at(-1);
  log("10. after leave:", sizeBefore, "->", afterLeave.players.length);
  if (afterLeave.players.length !== sizeBefore - 1) fail("seat not freed on leave");

  // --- Catalog ---
  const cat = await emit(host, "party_catalog", {});
  log("11. catalog games:", cat.games.map((g) => g.id).join(", "));

  log(process.exitCode ? "\n=== SOME CHECKS FAILED ===" : "\n=== ALL PARTY CHECKS PASSED ===");
  [host, b, c, d].forEach((s) => s.close());
  process.exit(process.exitCode ?? 0);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
