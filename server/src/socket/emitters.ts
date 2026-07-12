import type { Server } from "socket.io";
import type { GameRoom } from "../games/types.js";
import { LobbyRoom } from "../games/lobby/LobbyRoom.js";

/**
 * Send each connected human player their private state (their hand).
 * Public state is broadcast separately via the room's broadcast callback.
 */
export function sendPrivateHands(io: Server, room: GameRoom): void {
  let targetRoom = room;
  if (room instanceof LobbyRoom && room.activeSubRoom) {
    targetRoom = room.activeSubRoom;
  }

  for (const player of targetRoom.players) {
    if (!player.isBot && player.socketId) {
      const state = targetRoom.toPlayerState(player.id) as { hand?: unknown };
      io.to(player.socketId).emit("your_hand", { hand: state.hand ?? [] });

      if (targetRoom.gameId === "codenames") {
        io.to(player.socketId).emit("codenames_private", targetRoom.toPlayerState(player.id));
      }
      if (targetRoom.gameId === "higher-lower") {
        io.to(player.socketId).emit("higher_lower_private", targetRoom.toPlayerState(player.id));
      }
    }
  }
}

export function broadcastState(io: Server, room: GameRoom): void {
  io.to(room.roomId).emit("game_state", room.toState());
}
