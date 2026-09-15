/**
 * ============================================================================
 *  GENERATED FILE — DO NOT EDIT
 * ============================================================================
 *
 * Copied from server/src/shared/spyfall.ts by `npm run types:sync` (run from
 * the server package). Edit the source there, not this file.
 *
 * `npm run types:check` fails if this copy has drifted, so an edit here will
 * be caught rather than silently diverging from what the server actually sends.
 */

/**
 * Spyfall wire contract. See shared/README.md — this file is copied into
 * web/src/lib/generated/ by `npm run types:sync`.
 */

import type { RoomPlayerLite } from "./domino";

/** A string that exists in both languages. */
export interface Bilingual {
  en: string;
  ar: string;
}

export type SpyfallPhase = "lobby" | "playing" | "voting" | "reveal" | "game_over";

export interface SpyfallSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Each player gets one accusation per round. */
  hasAccused: boolean;
  votedFor: string | null;
}

export interface SpyfallVote {
  voterId: string;
  /** Empty string means they voted NO. */
  targetId: string;
}

export interface SpyfallReveal {
  reason: "voted" | "spy_guessed" | "timeout";
  spyId: string;
  spyName: string;
  accusedId: string | null;
  accusedName: string | null;
  locationId: string;
  locationName: Bilingual;
  guessedLocationId: string | null;
  spyWon: boolean;
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface SpyfallState {
  roomId: string;
  gameId: "spyfall";
  phase: SpyfallPhase;
  maxPlayers: number;
  players: RoomPlayerLite[];
  seats: SpyfallSeat[];
  roundNumber: number;
  roundSeconds: number;
  roundEndsAt: number | null;
  /** Whose turn it is to ask. Advisory: the game is spoken. */
  askingPlayerId: string | null;
  /** Every location. Public — the spy needs the list to guess from. */
  locations: Array<{ id: string; name: Bilingual }>;
  vote: {
    accuserId: string;
    accuserName: string;
    targetId: string;
    targetName: string;
    votes: SpyfallVote[];
    needed: number;
    endsAt: number;
  } | null;
  reveal: SpyfallReveal | null;
  winnerId: string | null;
  targetScore: number;
}

/**
 * Per-player slice, delivered on `spyfall_private`.
 *
 * The spy gets `isSpy: true` and nothing else — critically, NOT the identity
 * of anyone. An innocent gets the location and their role. Neither is ever
 * present in the public broadcast.
 */
export interface SpyfallPrivate {
  isSpy: boolean;
  locationId: string | null;
  locationName: Bilingual | null;
  role: Bilingual | null;
}

export type SpyfallPlayerState = SpyfallState & SpyfallPrivate;
