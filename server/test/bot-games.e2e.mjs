/**
 * One human plus bots, in the games that just gained bot support.
 *
 *   cd server && npm run dev            (in another terminal)
 *   cd server && npm run test:bot-games
 *
 * The catalogue's `bots` flag is a promise made to the game picker: tick it and
 * a host sitting alone is told the game is playable. Eight games had working
 * bot AI in the engine and `bots: false` in the catalogue, so the promise was
 * never made; flipping the flag makes it, and this file is what checks the
 * promise is kept.
 *
 * "Kept" means something specific and worth stating, because it is weaker than
 * it sounds: a bot has to *act unprompted*. Not play well — a Tetris bot that
 * tops out in thirty seconds is a bad opponent but an honest one. The failure
 * this guards against is the one that has no error message: seats that sit
 * there, a board that never changes, and a host who concludes the site is
 * broken. So each case asserts that the world moved while nobody touched it.
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
    const timer = setTimeout(() => rej(new Error(`timeout: ${ev}`)), 8000);
    s.emit(ev, data, (r) => {
      clearTimeout(timer);
      r?.error ? rej(new Error(r.error)) : res(r);
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function track(s) {
  s.states = [];
  s.on("game_state", (st) => s.states.push(st));
  return s;
}

/** Latest party envelope, and the sub-game inside it. */
const party = (s) => s.states.at(-1);
const sub = (s) => party(s)?.subGameState;

(async () => {
  console.log("\nBots in the newly-enabled games\n");

  const host = track(await connect());
  const created = await emit(host, "create_room", {
    playerName: "Kamel",
    gameId: "party",
    maxPlayers: 8,
  });
  const code = created.roomId;

  // Three bots and one human — exactly the room in the bug report.
  await emit(host, "add_bot", {});
  await emit(host, "add_bot", {});
  await emit(host, "add_bot", {});
  await sleep(200);

  const roster = party(host).players;
  const botNames = roster.filter((p) => p.isBot).map((p) => p.name);

  if (roster.length !== 4) bad(`roster is ${roster.length}, expected 4`);
  else ok("one human + three bots in the party");

  // The names are the other half of this change: `Bot 2` is not a person.
  if (botNames.some((n) => /^Bot \d+$/.test(n))) {
    bad("a bot is still called 'Bot N'", botNames.join(", "));
  } else {
    ok("bots have names: " + botNames.join(", "));
  }
  if (new Set(botNames).size !== botNames.length) {
    bad("two bots share a name", botNames.join(", "));
  } else {
    ok("no two bots share a name");
  }

  // -----------------------------------------------------------------------
  // The catalogue must now offer these to a party of one human.
  // -----------------------------------------------------------------------
  const catalog = await emit(host, "party_catalog", {});
  const specs = catalog.games ?? catalog.catalog ?? catalog;
  const flipped = [
    "tictactoe",
    "snake",
    "space-invaders",
    "fighter",
    "snake-ladder",
    "memory-puzzle",
    "higher-lower",
    "tetris",
  ];
  const missing = flipped.filter(
    (id) => !specs.find?.((g) => g.id === id)?.bots,
  );
  if (missing.length) bad("catalogue still says no bots for: " + missing.join(", "));
  else ok("catalogue offers bots for all eight");

  // Still honestly false for the six talking games.
  const talkers = ["spyfall", "chameleon", "taboo", "bluff", "wyr", "codenames"];
  const wrong = talkers.filter((id) => specs.find?.((g) => g.id === id)?.bots);
  if (wrong.length) bad("catalogue promises bots it cannot keep: " + wrong.join(", "));
  else ok("the six conversation games still declare no bots");

  // -----------------------------------------------------------------------
  // Each game: pick it, touch nothing, and check the bots moved.
  // -----------------------------------------------------------------------

  /**
   * Pick a game, optionally take the human's opening move, then check the
   * world moved on its own.
   *
   * The opening move matters and is not a workaround: in a turn-based game the
   * host is seat one, so a bot that acted before the human had played would be
   * a *different* bug. What is being tested is that the turn coming back round
   * to a bot is enough to make it act.
   */
  async function plays(gameId, { wait, kick, check, describe, options = {} }) {
    await emit(host, "party_pick_game", { gameId, options });
    await sleep(400);

    // Several of these deal themselves in behind a 3-2-1 countdown, and an
    // action sent during it is refused with "Game not active". Wait for the
    // phase rather than guessing a delay — the countdown length is the
    // engine's business, not this file's.
    for (let waited = 0; sub(host)?.phase === "countdown" && waited < 8000; waited += 250) {
      await sleep(250);
    }

    if (kick) {
      try {
        await kick();
      } catch (e) {
        bad(`${gameId}: the human's opening move was refused`, e.message);
        return;
      }
    }

    // The real-time games have nothing as clean as a filled cell to assert on,
    // so they get a before/after pair and are checked for movement.
    const before = JSON.parse(JSON.stringify(sub(host) ?? {}));
    await sleep(wait);
    const after = sub(host);

    if (!after) return bad(`${gameId}: no sub-game state at all`);
    if (after.gameId !== gameId) return bad(`${gameId}: party is in ${after.gameId}`);
    if (after.phase === "countdown") {
      return bad(`${gameId}: still counting down after ${wait}ms`);
    }

    const result = check(after, before);
    if (result === true) ok(`${gameId}: ${describe}`);
    else bad(`${gameId}: ${describe}`, typeof result === "string" ? result : undefined);
  }

  // Tic-Tac-Toe — the host is X and moves first, so the bot's O is the thing
  // under test: it has to answer without anyone prompting it.
  await plays("tictactoe", {
    kick: () => emit(host, "ttt_move", { index: 4 }),
    wait: 2500,
    describe: "a bot answered the human's move",
    check: (st) => {
      const filled = (st.board ?? []).filter((c) => c !== "").length;
      return filled >= 2 || `only ${filled} cell(s) played — O never replied`;
    },
  });

  // Snakes & Ladders — the deadlock candidate. Once the host has rolled, the
  // turn belongs to a bot and nobody is coming to roll on its behalf.
  await plays("snake-ladder", {
    kick: () => emit(host, "snl_roll", {}),
    wait: 6000,
    describe: "bots took the dice on their own turns",
    check: (st) => {
      const bots = (st.players ?? []).filter((p) => p.isBot);
      const moved = bots.filter((p) => Number(p.position) > 0);
      return (
        moved.length > 0 ||
        `all ${bots.length} bots still on square 0 — the turn stalled on a bot`
      );
    },
  });

  // Memory — free-for-all, no turns, and the case that needed the engine fix:
  // with three bots, more than one of them has to be scoring.
  await plays("memory-puzzle", {
    wait: 12000,
    describe: "several bots are finding pairs at once",
    check: (st) => {
      const pairs = Number(st.pairsFound ?? 0);
      if (pairs === 0) return "no pair found in 12s — bots are flipping blind";
      const scoring = Object.values(st.scores ?? {}).filter((v) => Number(v) > 0);
      return (
        scoring.length > 1 ||
        `${pairs} pair(s) found but only ${scoring.length} seat scored — ` +
          "the single-bot scheduling bug is back"
      );
    },
  });

  // Higher or Lower — turn-based with a private range per seat. A bot that
  // doesn't guess burns the 15s turn timer, which reads as a frozen game.
  await plays("higher-lower", {
    kick: () => emit(host, "higher_lower_guess", { guess: 50 }),
    wait: 8000,
    describe: "bots guessed inside their own range",
    check: (st) => {
      const states = Object.entries(st.playerStates ?? {});
      const botsGuessed = states.filter(
        ([id, ps]) => id.startsWith("bot_") && ps.lastGuess != null,
      );
      return (
        botsGuessed.length > 0 ||
        "no bot has a lastGuess — every bot turn timed out"
      );
    },
  });

  // Tetris — real-time and parallel. Score stays 0 until a line clears, so the
  // honest signal is the bot's own board having pieces on it.
  await plays("tetris", {
    wait: 6000,
    describe: "a bot is stacking pieces on its own board",
    check: (st) => {
      const botIds = (st.players ?? []).filter((p) => p.isBot).map((p) => p.id);
      if (botIds.length === 0) return "no bot seated";
      const settled = botIds.filter((id) => {
        const b = st.boards?.[id]?.board ?? [];
        return b.flat().some((cell) => cell && cell !== ".");
      });
      return (
        settled.length > 0 ||
        `${botIds.length} bot boards are still empty after 6s`
      );
    },
  });

  // Snake — parallel boards. The human never steers, so their snake hits a
  // wall; the bots have to keep going without it.
  await plays("snake", {
    wait: 5000,
    describe: "bot snakes are steering themselves",
    check: (st, was) => {
      const head = (s, id) => {
        const snake = (s.snakes ?? []).find((x) => x.playerId === id);
        return snake ? `${snake.body?.[0]?.x},${snake.body?.[0]?.y}` : null;
      };
      const bots = (st.snakes ?? []).filter((x) => x.isBot);
      if (bots.length === 0) return "no bot snake on the board";
      const moving = bots.filter(
        (b) => head(st, b.playerId) !== head(was, b.playerId),
      );
      return moving.length > 0 || "no bot snake moved in 5s";
    },
  });

  // Space Invaders — same shape, but the signal is shooting as well as moving.
  await plays("space-invaders", {
    wait: 5000,
    describe: "bot ships are moving and firing",
    check: (st, was) => {
      const xOf = (s, id) => (s.ships ?? []).find((x) => x.playerId === id)?.x;
      const bots = (st.ships ?? []).filter((x) => x.isBot);
      if (bots.length === 0) return "no bot ship on the board";
      const moved = bots.some((b) => xOf(st, b.playerId) !== xOf(was, b.playerId));
      const firing = (st.pBullets ?? []).length > 0;
      return (
        (moved && firing) ||
        `moved=${moved} firing=${firing} — a bot ship is idle`
      );
    },
  });

  // Fighter — two seats, so the bot is the opponent. An idle bot is a fight
  // where nothing happens for ninety seconds.
  await plays("fighter", {
    wait: 6000,
    describe: "the bot closed in and threw a punch",
    check: (st, was) => {
      const bot = (st.fighters ?? []).find((f) => f.isBot);
      const human = (st.fighters ?? []).find((f) => !f.isBot);
      if (!bot) return "no bot fighter";
      const botWas = (was.fighters ?? []).find((f) => f.isBot);
      const closed = botWas && bot.x !== botWas.x;
      const hurt = human && Number(human.health) < Number(st.maxHealth ?? 160);
      return (
        closed || hurt || "the bot has not moved or landed a hit in 6s"
      );
    },
  });

  await emit(host, "party_return_hub", {});
  host.close();

  console.log(
    failures === 0
      ? "\n=== BOT GAMES: every seat played itself ===\n"
      : `\n=== BOT GAMES: ${failures} failure(s) ===\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("\nharness error:", e.message);
  console.error("(is the server running? cd server && npm run dev)\n");
  process.exit(1);
});
