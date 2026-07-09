/**
 * Centralized server configuration, read once from the environment.
 */
export interface ServerConfig {
  port: number;
  allowedOrigins: string[];
  /** How often the stale-room sweeper runs. */
  sweepIntervalMs: number;
  /** Room with no connected humans is removed after this idle time (reconnect grace). */
  emptyRoomGraceMs: number;
  /** Finished games are removed after this idle time. */
  finishedRoomTtlMs: number;
  /** Any room is removed after this much total inactivity. */
  idleRoomTtlMs: number;
  maxNameLength: number;
  maxChatLength: number;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3001", 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "*").split(","),
  sweepIntervalMs: 60_000,
  emptyRoomGraceMs: 2 * 60_000,
  finishedRoomTtlMs: 10 * 60_000,
  idleRoomTtlMs: 2 * 60 * 60_000,
  maxNameLength: 24,
  maxChatLength: 300,
};
