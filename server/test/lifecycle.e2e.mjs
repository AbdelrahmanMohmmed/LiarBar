/**
 * Room lifecycle: the things that happen to a party because of phones, not
 * because of games.
 *
 *   cd server && npm run test:lifecycle     (server must be running)
 *
 * Every case here is something that happens on an ordinary evening — someone's
 * screen locks, someone re-taps the link, the host goes to answer the door —
 * and every one of them used to have a failure mode that produced no error and
 * no visible cause. They're grouped in one file because they share a shape:
 * the game is fine, the *connection* is what moved.
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
  s.superseded = null;
  s.on("game_state", (st) => s.states.push(st));
  s.on("session_superseded", (d) => {
    s.superseded = d;
  });
  return s;
}

const party = (s) => s.states.at(-1);

(async () => {
  console.log("\nRoom lifecycle\n");

  // -------------------------------------------------------------------
  // 1. A refresh mid-game restores everything.
  // -------------------------------------------------------------------
  {
    const host = track(await connect());
    const created = await emit(host, "create_room", {
      playerName: "Ahmed",
      gameId: "domino",
      maxPlayers: 4,
      gameMode: "individual",
    });
    const code = created.roomId;

    const sara = track(await connect());
    const saraJoin = await emit(sara, "join_room", { roomId: code, playerName: "Sara" });
    await emit(host, "add_bot", {});
    await emit(host, "start_game", {});
    await sleep(400);

    const beforeRound = party(host).subGameState.roundNumber;

    // Sara's phone locks: the socket dies without a "leave".
    sara.close();
    await sleep(300);

    // ...and she comes back on a new socket, as a page refresh would.
    const sara2 = track(await connect());
    const back = await emit(sara2, "reconnect_room", {
      roomId: code,
      playerId: saraJoin.playerId,
    });
    await sleep(300);

    if (back.success && back.state?.roomId === code) {
      ok("a refresh mid-game reconnects to the same room");
    } else {
      bad("reconnect", JSON.stringify(back));
    }

    const sub = back.state.subGameState;
    if (sub && sub.roundNumber === beforeRound) {
      ok("the game is still on the same round afterwards");
    } else {
      bad("round continuity", `was ${beforeRound}, now ${sub?.roundNumber}`);
    }
    if (Array.isArray(sub?.hand) && sub.hand.length > 0) {
      ok(`her hand comes back with the reconnect (${sub.hand.length} tiles)`);
    } else {
      bad("hand restore", "reconnect returned no hand");
    }

    const seenBySelf = party(host).players.find((p) => p.id === saraJoin.playerId);
    if (seenBySelf?.isConnected) {
      ok("the rest of the table sees her as connected again");
    } else {
      bad("presence", "still shows as offline to the others");
    }

    [host, sara2].forEach((c) => c.close());
  }

  // -------------------------------------------------------------------
  // 2. A second window takes over, and the first is told.
  // -------------------------------------------------------------------
  {
    const first = track(await connect());
    const created = await emit(first, "create_room", {
      playerName: "Omar",
      gameId: "party",
      maxPlayers: 6,
    });

    const second = track(await connect());
    await emit(second, "reconnect_room", {
      roomId: created.roomId,
      playerId: created.playerId,
    });
    await sleep(300);

    if (first.superseded?.roomId === created.roomId) {
      ok("the older window is told its session was taken over");
    } else {
      bad("supersede", "the first window was left as a silent zombie");
    }

    // And the old socket must no longer be treated as in the room.
    try {
      await emit(first, "add_bot", {});
      bad("supersede", "the superseded socket could still act on the room");
    } catch (e) {
      ok("the superseded socket can no longer act: " + e.message);
    }

    [first, second].forEach((c) => c.close());
  }

  // -------------------------------------------------------------------
  // 3. The host leaving doesn't strand the party.
  // -------------------------------------------------------------------
  {
    const host = track(await connect());
    const created = await emit(host, "create_room", {
      playerName: "Ahmed",
      gameId: "party",
      maxPlayers: 6,
    });
    const code = created.roomId;

    const sara = track(await connect());
    await emit(sara, "join_room", { roomId: code, playerName: "Sara" });
    const omar = track(await connect());
    await emit(omar, "join_room", { roomId: code, playerName: "Omar" });
    await sleep(200);

    await emit(host, "party_leave", {});
    await sleep(400);

    const after = party(sara);
    if (after.players.length === 2) {
      ok("leaving frees the seat rather than leaving a ghost in it");
    } else {
      bad("seat", `${after.players.length} players remain`);
    }

    const newHost = after.players.find((p) => p.isHost);
    if (newHost && newHost.id !== created.playerId) {
      ok(`the host role passes to someone still here (${newHost.name})`);
    } else {
      bad("host promotion", "the party was left with no host and cannot start anything");
    }

    // And the new host can actually do host things.
    const heir = newHost.name === "Sara" ? sara : omar;
    try {
      await emit(heir, "party_pick_game", { gameId: "tictactoe" });
      ok("the new host can start a game");
    } catch (e) {
      bad("host promotion", "the promoted host is not accepted: " + e.message);
    }

    [sara, omar].forEach((c) => c.close());
  }

  // -------------------------------------------------------------------
  // 4. A latecomer mid-game waits, then is dealt in.
  // -------------------------------------------------------------------
  {
    const host = track(await connect());
    const created = await emit(host, "create_room", {
      playerName: "Ahmed",
      gameId: "domino",
      maxPlayers: 4,
      gameMode: "individual",
    });
    const code = created.roomId;
    await emit(host, "add_bot", {});
    await emit(host, "start_game", {});
    await sleep(300);

    const late = track(await connect());
    const joined = await emit(late, "join_room", { roomId: code, playerName: "Nour" });
    await sleep(300);

    if (joined.success) ok("a latecomer is admitted mid-game rather than bounced");
    else bad("late join", JSON.stringify(joined));

    const seats = party(host).subGameState.seats.map((s) => s.playerId);
    if (!seats.includes(joined.playerId)) {
      ok("but is not seated into the hand already in progress");
    } else {
      bad("late join", "was dealt into a running hand, which corrupts turn order");
    }

    if (party(host).players.some((p) => p.id === joined.playerId)) {
      ok("and is in the party roster, ready for the next game");
    } else {
      bad("late join", "not in the party roster");
    }

    // The next game deals them in.
    await emit(host, "party_pick_game", { gameId: "domino", options: {} });
    await sleep(400);
    const nextSeats = party(host).subGameState.seats.map((s) => s.playerId);
    if (nextSeats.includes(joined.playerId)) {
      ok("the next game seats them automatically");
    } else {
      bad("late join", "still not seated after a new game started");
    }

    [host, late].forEach((c) => c.close());
  }

  console.log(
    failures
      ? `\n=== LIFECYCLE: ${failures} CHECK(S) FAILED ===`
      : "\n=== LIFECYCLE: all checks passed ===",
  );
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
