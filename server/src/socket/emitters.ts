import type { Server } from "socket.io";
import type { GameRoom } from "../games/types.js";
import { LobbyRoom } from "../games/lobby/LobbyRoom.js";
import { PartyRoom } from "../games/party/PartyRoom.js";

/**
 * Unwrap a container room (a party, or the legacy lobby) to the game engine
 * actually running inside it. Returns the room itself for a standalone game.
 *
 * Every piece of transport code that reasons about *the game* rather than
 * *the room* goes through this, so adding another container type is a
 * one-line change here instead of a grep for `instanceof`.
 */
export function activeGameRoom(room: GameRoom): GameRoom {
  if (room instanceof PartyRoom && room.activeSubRoom) return room.activeSubRoom;
  if (room instanceof LobbyRoom && room.activeSubRoom) return room.activeSubRoom;
  return room;
}

/**
 * Games that send a private, per-player slice of state in addition to the
 * public broadcast. The event name is `${prefix}_private`.
 *
 * This used to be an if-chain inside sendPrivateHands, which meant every new
 * game with hidden information silently shipped with no private channel until
 * someone noticed their hand was empty.
 */
const PRIVATE_STATE_EVENTS: Record<string, string> = {
  codenames: "codenames_private",
  "higher-lower": "higher_lower_private",
  domino: "domino_private",
  spyfall: "spyfall_private",
  chameleon: "chameleon_private",
  wyr: "wyr_private",
};

/**
 * Send each connected human their private state.
 *
 * The public `game_state` broadcast never contains hidden information; this is
 * the only channel that does, and it is addressed to one socket at a time.
 */
export function sendPrivateHands(io: Server, room: GameRoom): void {
  const target = activeGameRoom(room);
  const privateEvent = PRIVATE_STATE_EVENTS[target.gameId];

  for (const player of target.players) {
    if (player.isBot || !player.socketId) continue;

    const state = target.toPlayerState(player.id) as { hand?: unknown };
    io.to(player.socketId).emit("your_hand", { hand: state.hand ?? [] });

    if (privateEvent) {
      io.to(player.socketId).emit(privateEvent, target.toPlayerState(player.id));
    }
  }
}

/**
 * Broadcast public state to the room.
 *
 * Note this always sends the *container's* state, never the sub-room's: the
 * client must always receive the same envelope shape for a given room so that
 * a game switch is just a change of `activeGameId`, not a change of protocol.
 */
export function broadcastState(io: Server, room: GameRoom): void {
  io.to(room.roomId).emit("game_state", room.toState());
}
