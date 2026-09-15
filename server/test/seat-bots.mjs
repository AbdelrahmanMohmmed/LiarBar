/**
 * Fill a room with scripted players and keep them connected.
 *
 *   node test/seat-bots.mjs <ROOM_CODE> [count]
 *
 * A development aid, not a test. Three of the party games (Spyfall, Chameleon,
 * Would You Rather) deliberately have no bots — a bot that can't bluff under
 * questioning is worse than an empty seat — which makes them impossible to
 * look at in a browser on your own.
 *
 * These are not bots in the game sense: they take the minimum legal action
 * after a short delay so the round advances, and nothing more. That's enough
 * to drive the UI through every phase while you watch it.
 */
import { io } from "socket.io-client";

const URL = process.env.PARTY_TEST_URL || "http://127.0.0.1:3001";
const code = process.argv[2];
const count = Number(process.argv[3] || 3);

if (!code) {
  console.error("usage: node test/seat-bots.mjs <ROOM_CODE> [count]");
  process.exit(1);
}

const NAMES = ["Sara", "Omar", "Nour", "Hoda", "Karim", "Mai", "Tarek"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const clients = [];

function act(socket, self) {
  // Bluff decides what a seat may do from private fields (what you wrote, and
  // which option is your own), and those never ride on the public broadcast.
  // Merging the last private payload in is enough for a scripted seat.
  socket.on("bluff_private", (st) => {
    self.private = st;
  });
  socket.on("taboo_private", (st) => {
    self.private = st;
  });

  socket.on("game_state", async (envelope) => {
    const base = envelope?.gameId === "party" ? envelope.subGameState : envelope;
    if (!base) return;
    const state =
      (base.gameId === "bluff" || base.gameId === "taboo") && self.private
        ? { ...self.private, ...base }
        : base;

    // Small human-ish delay, and a guard so overlapping broadcasts don't make
    // the same seat act twice for one phase.
    //
    // The key includes whoever the phase is currently waiting on. Chameleon
    // takes clues one seat at a time within a single phase, so a key of
    // game:phase:round made every seat act at most once for the whole clue
    // phase — the first bot spoke and the round then sat there until the
    // timer killed it, which looks exactly like the game being broken.
    const waitingOn =
      state.cluePlayerId ?? state.activeSeat ?? (state.turnResults?.length ?? "");
    const key = `${state.gameId}:${state.phase}:${state.roundNumber ?? 0}:${waitingOn}`;
    if (self.lastKey === key) return;
    self.lastKey = key;
    await sleep(700 + Math.random() * 900);

    const send = (ev, data) => socket.emit(ev, data, () => {});

    switch (state.gameId) {
      case "wyr":
        if (state.phase === "choosing" && state.subjectId === self.playerId) {
          send("wyr_choose", { choice: pick(["a", "b"]) });
        } else if (state.phase === "predicting" && state.subjectId !== self.playerId) {
          send("wyr_predict", { choice: pick(["a", "b"]) });
        }
        break;

      case "chameleon":
        if (state.phase === "clues" && state.cluePlayerId === self.playerId) {
          send("chameleon_clue", { clue: pick(["hot", "loud", "far", "old", "sweet"]) });
        } else if (state.phase === "voting") {
          const other = state.seats.find((s) => s.playerId !== self.playerId);
          if (other) send("chameleon_vote", { targetId: other.playerId });
        }
        break;

      case "codenames":
        // Codenames can't start until every seat has a team and a role, and it
        // has no bots — so without this the game is unreachable for one person
        // testing alone. Seats are assigned by index so the teams are balanced
        // and the human (who created the room) is always red spymaster.
        if (state.phase === "lobby") {
          const mine = state.players.findIndex((p) => p.id === self.playerId);
          const team = mine % 2 === 0 ? "red" : "teal";
          const role = mine < 2 ? "spymaster" : "operative";
          send("codenames_join_team", { team, role });
        }
        break;

      case "bluff":
        // Bluff has no bots and needs three players, so a solo tester can't
        // reach the choosing screen at all without these. The "lies" are
        // deliberately obvious nonsense — the point is to advance the phase,
        // not to make the round fair.
        if (state.phase === "writing" && !state.myAnswer) {
          send("bluff_answer", {
            answer: pick(["a brass bell", "Malta", "seventeen goats", "a wooden spoon"]) +
              " " + Math.floor(Math.random() * 99),
          });
        } else if (state.phase === "choosing" && !state.myChoiceId) {
          const notMine = (state.options || []).filter((o) => o.id !== state.myOptionId);
          if (notMine.length) send("bluff_choose", { optionId: pick(notMine).id });
        }
        break;

      case "taboo":
        // Taboo needs four players and has no bots, so a solo tester can't
        // reach a turn at all without these. A scripted describer marks a
        // card every couple of seconds so the turn visibly moves; scripted
        // opponents never buzz, because a buzz is a judgement about something
        // said out loud and there is nothing here to hear.
        if (state.phase === "describing" && state.amDescribing) {
          send("taboo_correct", {});
        }
        break;

      case "spyfall":
        // Spyfall needs no scripted action — the round runs on its clock and
        // the human drives the accusations.
        break;

      case "domino":
        // Domino has real bots; nothing to do here.
        break;
    }
  });
}

for (let i = 0; i < count; i++) {
  const socket = io(URL, { transports: ["websocket"] });
  const self = { playerId: null, lastKey: null };

  socket.on("connect", () => {
    socket.emit(
      "join_room",
      { roomId: code, playerName: NAMES[i % NAMES.length] },
      (res) => {
        if (res?.error) {
          console.error(`  ${NAMES[i]}: ${res.error}`);
          return;
        }
        self.playerId = res.playerId;
        console.log(`  ${NAMES[i % NAMES.length]} joined (${res.playerId})`);
      },
    );
  });

  act(socket, self);
  clients.push(socket);
}

console.log(`Seating ${count} scripted player(s) in room ${code}. Ctrl-C to stop.`);
process.on("SIGINT", () => {
  clients.forEach((c) => c.close());
  process.exit(0);
});
