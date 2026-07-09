import { customAlphabet } from "nanoid";
import type { GameRoom } from "../games/types.js";
import { config } from "../config.js";

/** Which room/player a connected socket belongs to. */
export interface SocketSession {
  roomId: string;
  playerId: string;
}

/** Unambiguous room codes: no 0/O, 1/I/L, or lowercase. */
const roomCode = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6);

/**
 * Owns all live rooms and socket sessions for this node.
 *
 * This is the single seam for scaling out: to move room state off-process
 * (e.g. Redis), only this class and the GameRoom serialization need to
 * change — socket handlers go through here for every lookup.
 */
export class RoomRegistry {
  private rooms = new Map<string, GameRoom>();
  private sessions = new Map<string, SocketSession>();
  private sweepTimer: NodeJS.Timeout | null = null;

  generateRoomCode(): string {
    // Retry on the (unlikely) collision instead of silently overwriting a room
    for (let i = 0; i < 5; i++) {
      const code = roomCode();
      if (!this.rooms.has(code)) return code;
    }
    return roomCode() + roomCode().slice(0, 2);
  }

  add(room: GameRoom): void {
    this.rooms.set(room.roomId, room);
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  remove(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.destroy();
    this.rooms.delete(roomId);
  }

  get size(): number {
    return this.rooms.size;
  }

  bindSocket(socketId: string, session: SocketSession): void {
    this.sessions.set(socketId, session);
  }

  getSession(socketId: string): SocketSession | undefined {
    return this.sessions.get(socketId);
  }

  unbindSocket(socketId: string): void {
    this.sessions.delete(socketId);
  }

  /**
   * Periodically remove rooms nobody will come back to. Keeping a grace
   * period (instead of deleting the moment the last human disconnects)
   * lets players survive a page refresh and reconnect.
   */
  startSweeper(): void {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweep(), config.sweepIntervalMs);
    this.sweepTimer.unref?.();
  }

  stopSweeper(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  sweep(now: number = Date.now()): string[] {
    const removed: string[] = [];
    for (const [roomId, room] of this.rooms) {
      const idleMs = now - room.lastActivityAt;
      const hasConnectedHumans = room.players.some(
        (p) => !p.isBot && p.isConnected,
      );

      const expired =
        (!hasConnectedHumans && idleMs > config.emptyRoomGraceMs) ||
        (room.phase === "game_over" && idleMs > config.finishedRoomTtlMs) ||
        idleMs > config.idleRoomTtlMs;

      if (expired) {
        room.destroy();
        this.rooms.delete(roomId);
        removed.push(roomId);
      }
    }
    if (removed.length > 0) {
      console.log(`Swept ${removed.length} stale room(s): ${removed.join(", ")}`);
    }
    return removed;
  }
}
