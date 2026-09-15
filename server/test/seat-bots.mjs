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
  socket.on("game_state", async (envelope) => {
    const state = envelope?.gameId === "party" ? envelope.subGameState : envelope;
    if (!state) return;

    // Small human-ish delay, and a guard so overlapping broadcasts don't make
    // the same seat act twice for one phase.
    const key = `${state.gameId}:${state.phase}:${state.roundNumber ?? 0}`;
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
