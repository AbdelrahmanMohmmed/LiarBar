/**
 * Full-match simulation for the domino engine.
 *
 *   cd server && npm run build && npm run test:domino-sim
 *
 * The rules tests (domino.test.mjs) prove each rule in isolation. This proves
 * the *engine* — timers, turn order, bots, disconnects — can actually drive a
 * match from deal to 101 without deadlocking, which is precisely what the
 * previous implementation could not do: a four-handed game with one
 * disconnected player skipped that seat forever, so its tiles never entered
 * play and the round could be neither won nor blocked. It simply hung until
 * the room sweeper deleted it.
 *
 * Runs many matches back to back with all-bot tables and asserts invariants
 * after every single move, so a rare ordering bug surfaces as a failure rather
 * than as a stuck game once a fortnight in production.
 */
import assert from "node:assert/strict";
import { DominoGame } from "../dist/games/domino/DominoGame.js";
import { handPips } from "../dist/games/domino/rules.js";

const MATCHES = Number(process.env.SIM_MATCHES || 60);

/** Drive all pending timers instantly instead of waiting real seconds. */
function withInstantTimers(run) {
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  const queue = new Map();
  let nextId = 1;

  global.setTimeout = (fn, ms) => {
    const id = nextId++;
    queue.set(id, { fn, at: ms ?? 0 });
    return id;
  };
  global.clearTimeout = (id) => {
    queue.delete(id);
  };

  /** Fire the earliest pending timer. Returns false when none remain. */
  const tick = () => {
    if (queue.size === 0) return false;
    let soonestId = null;
    let soonest = Infinity;
    for (const [id, entry] of queue) {
      if (entry.at < soonest) {
        soonest = entry.at;
        soonestId = id;
      }
    }
    const entry = queue.get(soonestId);
    queue.delete(soonestId);
    entry.fn();
    return true;
  };

  try {
    return run(tick, () => queue.size);
  } finally {
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
  }
}

function makeGame(mode, playerCount, difficulties) {
  let lastState = null;
  const game = new DominoGame(
    "SIMTST",
    playerCount,
    mode,
    101,
    30,
    {
      broadcast: (state) => {
        lastState = state;
      },
      onGameEnd: () => {},
      onHandsChanged: () => {},
    },
    "green",
    "ivory",
    true, // karak on, to exercise the bonus path
  );
  for (let i = 0; i < playerCount; i++) {
    game.addBot(`Bot${i}`, difficulties[i % difficulties.length]);
  }
  return { game, getState: () => lastState ?? game.toState() };
}

/**
 * Invariants that must hold after every move of every match. If any of these
 * can be broken, the game is wrong in a way a player will eventually notice.
 */
function checkInvariants(state, label) {
  const tilesOnTable = state.board.length;
  const tilesInHands = state.seats.reduce((n, s) => n + s.handCount, 0);
  const total = tilesOnTable + tilesInHands + state.boneyardCount;
  assert.equal(total, 28, `${label}: tile count is ${total}, not 28`);

  // The snake must actually connect: every adjacent pair shares a pip.
  for (let i = 1; i < state.board.length; i++) {
    assert.equal(
      state.board[i - 1].right,
      state.board[i].left,
      `${label}: board breaks between tile ${i - 1} and ${i} ` +
        `(${state.board[i - 1].left}-${state.board[i - 1].right} then ` +
        `${state.board[i].left}-${state.board[i].right})`,
    );
  }

  // The reported open ends must match the actual ends of the snake.
  if (state.board.length > 0) {
    assert.equal(state.ends.left, state.board[0].left, `${label}: left end wrong`);
    assert.equal(
      state.ends.right,
      state.board[state.board.length - 1].right,
      `${label}: right end wrong`,
    );
  }

  // A knock is a claim about a hand; it must never be recorded for a value
  // the seat could in fact play.
  assert.ok(
    state.seats.every((s) => s.knockedOn.every((v) => v >= 0 && v <= 6)),
    `${label}: knock memory holds an impossible pip value`,
  );

  if (state.phase === "playing") {
    assert.notEqual(state.activeSeat, null, `${label}: playing with no active seat`);
  }
}

let matchesPlayed = 0;
let roundsPlayed = 0;
let blockedRounds = 0;
let karakRounds = 0;
let failures = 0;

console.log(`\nSimulating ${MATCHES} matches...\n`);

withInstantTimers((tick, pending) => {
  const configs = [
    { mode: "teams", players: 4, diff: ["hard", "medium", "hard", "easy"] },
    { mode: "individual", players: 4, diff: ["medium", "medium", "easy", "hard"] },
    { mode: "individual", players: 3, diff: ["hard", "medium", "easy"] },
    { mode: "individual", players: 2, diff: ["hard", "easy"] },
  ];

  for (let m = 0; m < MATCHES; m++) {
    const cfg = configs[m % configs.length];
    const { game, getState } = makeGame(cfg.mode, cfg.players, cfg.diff);
    const label = `match ${m} (${cfg.mode}, ${cfg.players}p)`;

    try {
      assert.ok(game.startGame(), `${label}: startGame refused`);

      let steps = 0;
      // Generous: a 101-point match is typically 5-12 rounds of <=28 moves.
      const MAX_STEPS = 60000;

      while (getState().phase !== "game_over" && steps < MAX_STEPS) {
        checkInvariants(getState(), label);
        if (!tick()) break;
        steps++;
      }

      const final = getState();
      checkInvariants(final, `${label} final`);

      assert.equal(
        final.phase,
        "game_over",
        `${label}: did not finish (phase=${final.phase}, steps=${steps}, ` +
          `pending timers=${pending()}) — this is the deadlock the old engine had`,
      );
      assert.ok(final.winnerId, `${label}: finished with no winner`);

      const top = Math.max(...final.seatScores);
      if (cfg.mode === "teams") {
        assert.ok(
          final.scores.A >= 101 || final.scores.B >= 101,
          `${label}: finished below the target score`,
        );
      } else {
        assert.ok(top >= 101, `${label}: finished at ${top}, below 101`);
      }

      matchesPlayed++;
      roundsPlayed += final.roundNumber;
      if (final.recap?.method === "blocked" || final.recap?.method === "draw") blockedRounds++;
      if (final.recap?.karak) karakRounds++;

      game.destroy();
    } catch (err) {
      failures++;
      console.error("  FAIL " + err.message);
      if (failures > 3) break;
    }
  }
});

// ---------------------------------------------------------------------------
// The regression that motivated the rewrite.
// ---------------------------------------------------------------------------

console.log("");
console.log("Disconnect regression");
withInstantTimers((tick) => {
  let lastState = null;
  const game = new DominoGame(
    "DISCON",
    4,
    "teams",
    101,
    30,
    {
      broadcast: (state) => { lastState = state; },
      onGameEnd: () => {},
      onHandsChanged: () => {},
    },
  );

  // Three bots and one human who walks away mid-match. The old engine skipped
  // a disconnected seat forever, so its seven tiles never entered play: the
  // round could be neither won nor blocked, and the match hung until the room
  // sweeper deleted it. The seat must now keep its turn and be auto-played.
  game.addBot("Bot0", "medium");
  game.addPlayer("Ghost", "socket-ghost", false);
  game.addBot("Bot2", "medium");
  game.addBot("Bot3", "medium");

  assert.ok(game.startGame(), "disconnect regression: startGame refused");
  game.handleDisconnect("socket-ghost");

  let steps = 0;
  const getState = () => lastState ?? game.toState();
  while (getState().phase !== "game_over" && steps < 60000) {
    if (!tick()) break;
    steps++;
  }

  const final = getState();
  if (final.phase !== "game_over") {
    failures++;
    console.error(
      `  FAIL match hung with a disconnected seat (phase=${final.phase}, ` +
        `steps=${steps}) — this is exactly the old bug`,
    );
  } else {
    console.log("  ok  a match with a disconnected seat still reaches a winner");
    console.log(`      ${final.roundNumber} rounds, winner ${final.winnerId}`);
  }
  game.destroy();
});

console.log("");
console.log(`  matches completed : ${matchesPlayed}/${MATCHES}`);
console.log(`  rounds played     : ${roundsPlayed}`);
console.log(
  `  avg rounds/match  : ${(roundsPlayed / Math.max(matchesPlayed, 1)).toFixed(1)}`,
);
console.log(`  ended blocked     : ${blockedRounds}`);
console.log(`  karak finishes    : ${karakRounds}`);

if (failures > 0 || matchesPlayed < MATCHES) {
  console.error("\n=== DOMINO SIM: FAILED ===");
  process.exit(1);
}
console.log("\n=== DOMINO SIM: all matches completed cleanly ===");
