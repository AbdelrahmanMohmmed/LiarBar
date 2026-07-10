import type { Server } from "socket.io";
import type { GameRoom } from "../games/types.js";

/**
 * Send each connected human player their private state (their hand).
 * Public state is broadcast separately via the room's broadcast callback.
 */
export function sendPrivateHands(io: Server, room: GameRoom): void {
  for (const player of room.players) {
    if (!player.isBot && player.socketId) {
      const state = room.toPlayerState(player.id) as { hand?: unknown };
      io.to(player.socketId).emit("your_hand", { hand: state.hand ?? [] });

      if (room.gameId === "codenames") {
        io.to(player.socketId).emit("codenames_private", room.toPlayerState(player.id));
      }
      if (room.gameId === "higher-lower") {
        io.to(player.socketId).emit("higher_lower_private", room.toPlayerState(player.id));
      }
    }
  }
}

export function broadcastState(io: Server, room: GameRoom): void {
  io.to(room.roomId).emit("game_state", room.toState());
}
