import type { Player } from "./liars-bar/Player.js";

/**
 * Contract every game room must fulfill so the transport layer
 * (socket handlers, room registry) can stay game-agnostic.
 *
 * To add a new game: implement this interface and register a factory
 * in games/registry.ts. The socket layer never needs to change for
 * lifecycle concerns (join/leave/reconnect/cleanup); game-specific
 * actions get their own socket events that narrow the room to the
 * concrete game type.
 */
export interface GameRoom {
  readonly roomId: string;
  /** Which game this room runs, e.g. "liars-bar". */
  readonly gameId: string;
  readonly phase: string;
  readonly players: Player[];
  readonly maxPlayers: number;
  /** Timestamp of the last meaningful activity, used by the stale-room sweeper. */
  readonly lastActivityAt: number;

  addPlayer(name: string, socketId: string, isHost?: boolean, playerId?: string, flag?: string): Player;
  addBot(name: string, difficulty?: string): Player;
  removeBot(botId: string): boolean;
  getPlayer(id: string): Player | undefined;
  handleDisconnect(socketId: string): Player | null;
  handleReconnect(playerId: string, socketId: string): Player | null;

  canStart(): boolean;
  startGame(): unknown | null;

  /** Public state (no private hands) for broadcasting. */
  toState(): unknown;
  /** State as seen by one player (includes their private hand). */
  toPlayerState(playerId: string): unknown;

  /** Release timers and other resources. Must be idempotent. */
  destroy(): void;
}

/** Callbacks the engine uses to talk back to the transport layer. */
export interface GameRoomCallbacks {
  /** Broadcast public state to everyone in the room. */
  broadcast: (state: unknown) => void;
  /** A game ended with a winner. */
  onGameEnd: (roomId: string, winnerId: string) => void;
  /** Private hands changed server-side (e.g. after a challenge) and must be re-sent. */
  onHandsChanged: (roomId: string) => void;
}
