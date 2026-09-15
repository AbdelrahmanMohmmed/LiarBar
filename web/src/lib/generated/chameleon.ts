/**
 * ============================================================================
 *  GENERATED FILE — DO NOT EDIT
 * ============================================================================
 *
 * Copied from server/src/shared/chameleon.ts by `npm run types:sync` (run from
 * the server package). Edit the source there, not this file.
 *
 * `npm run types:check` fails if this copy has drifted, so an edit here will
 * be caught rather than silently diverging from what the server actually sends.
 */

/**
 * Chameleon wire contract. See shared/README.md — this file is copied into
 * web/src/lib/generated/ by `npm run types:sync`.
 */

import type { RoomPlayerLite } from "./domino";
import type { Bilingual } from "./spyfall";

export type { Bilingual };

export type ChameleonPhase =
  | "lobby"
  | "clues"
  | "voting"
  | "guessing"
  | "reveal"
  | "game_over";

export interface ChameleonSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Their one-word clue. */
  clue: string | null;
  /** Null while voting is open — running votes are hidden to stop a bandwagon. */
  votedFor: string | null;
  hasVoted: boolean;
}

export interface ChameleonReveal {
  chameleonId: string;
  chameleonName: string;
  secretIndex: number;
  secretWord: Bilingual;
  votedOutId: string | null;
  votedOutName: string | null;
  caught: boolean;
  guessedIndex: number | null;
  guessedRight: boolean;
  chameleonWon: boolean;
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface ChameleonState {
  roomId: string;
  gameId: "chameleon";
  phase: ChameleonPhase;
  maxPlayers: number;
  players: RoomPlayerLite[];
  seats: ChameleonSeat[];
  roundNumber: number;
  targetScore: number;
  /** The 4x4 grid. Public — everyone sees all sixteen words. */
  topic: { id: string; title: Bilingual; words: Bilingual[] } | null;
  cluePlayerId: string | null;
  deadline: number | null;
  reveal: ChameleonReveal | null;
  winnerId: string | null;
}

/** Per-player slice, delivered on `chameleon_private`. */
export interface ChameleonPrivate {
  isChameleon: boolean;
  /** Index into `topic.words`, or null if you're the chameleon. */
  secretIndex: number | null;
}

export type ChameleonPlayerState = ChameleonState & ChameleonPrivate;
