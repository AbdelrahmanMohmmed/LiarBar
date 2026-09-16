/**
 * Party wire contract. See shared/README.md — this file is copied into
 * web/src/lib/generated/ by `npm run types:sync`.
 *
 * The party envelope is the outermost shape of every room message. Whatever
 * game is running, the client receives this, with the game's own state hanging
 * off `subGameState` — so a game change is a change of `activeGameId`, never a
 * change of protocol.
 */

import type { RoomPlayerLite } from "./domino.js";

export type PartyPhase = "hub" | "playing";

/** One player's standing across every game played tonight. */
export interface PartyScoreEntry {
  playerId: string;
  name: string;
  wins: number;
  played: number;
}

export interface PartyHistoryEntry {
  gameId: string;
  winnerId: string | null;
  winnerName: string | null;
  endedAt: number;
}

export interface PartyState {
  roomId: string;
  gameId: "party";
  phase: PartyPhase;
  /** Which game is loaded, or null in the hub. */
  activeGameId: string | null;
  activeOptions?: Record<string, unknown> | null;
  players: RoomPlayerLite[];
  maxPlayers: number;
  leaderboard: PartyScoreEntry[];
  history: PartyHistoryEntry[];
  /** The active game's own state, or null. Shape depends on activeGameId. */
  subGameState: unknown;
}

/** How a game seats its players — drives what the picker says about it. */
export type GameSeating = "party" | "duel" | "parallel";

/**
 * What the party picker needs in order to never offer a choice that will fail.
 * Served by the `party_catalog` socket event and `GET /api/games`.
 */
export interface GameSpecPublic {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  seating: GameSeating;
  /** Can empty seats be filled with bots? */
  bots: boolean;
  /** Is this game substantially better with microphones on? */
  voiceMatters: boolean;
}

/** `GET /api/room/:code` — the preview shown before someone types a name. */
export interface RoomPreview {
  roomId: string;
  gameId: string;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  /** Party rooms only. */
  activeGameId?: string | null;
  joinable?: boolean;
}
