/**
 * ============================================================================
 *  GENERATED FILE — DO NOT EDIT
 * ============================================================================
 *
 * Copied from server/src/shared/bluff.ts by `npm run types:sync` (run from
 * the server package). Edit the source there, not this file.
 *
 * `npm run types:check` fails if this copy has drifted, so an edit here will
 * be caught rather than silently diverging from what the server actually sends.
 */

/**
 * Bluff wire contract. See shared/README.md — this file is copied into
 * web/src/lib/generated/ by `npm run types:sync`.
 */

import type { RoomPlayerLite } from "./domino";

export type BluffPhase = "lobby" | "writing" | "choosing" | "reveal" | "game_over";

export interface BluffSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** That they have written, never what. */
  hasWritten: boolean;
  hasChosen: boolean;
  /** Points from the round just revealed. */
  roundPoints: number;
}

/** One answer on the board. The id is opaque; authorship is not sent. */
export interface BluffOption {
  id: string;
  text: string;
}

export interface BluffRevealEntry {
  id: string;
  text: string;
  isTruth: boolean;
  /** Null for the true answer — nobody wrote it. */
  authorId: string | null;
  /** "Sara +1" when more than one player landed on the same lie. */
  authorName: string | null;
  pickedBy: Array<{ playerId: string; name: string }>;
}

export interface BluffReveal {
  prompt: string;
  answer: string;
  entries: BluffRevealEntry[];
  /** Players who typed the true answer before they saw it. */
  accidentalTruthIds: string[];
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface BluffState {
  roomId: string;
  gameId: "bluff";
  phase: BluffPhase;
  maxPlayers: number;
  players: RoomPlayerLite[];
  seats: BluffSeat[];
  roundNumber: number;
  totalRounds: number;
  /**
   * The language of the room, not of the viewer: the true answer sits on the
   * board beside answers players typed, so it has to be in the same language
   * they are typing in.
   */
  language: "en" | "ar";
  prompt: string | null;
  /** Populated during `choosing` only. */
  options: BluffOption[];
  deadline: number | null;
  reveal: BluffReveal | null;
  winnerId: string | null;
}

/** Arrives on `bluff_private`. Never on the public broadcast. */
export interface BluffPrivate {
  myAnswer: string | null;
  /** Your own entry — the one option you are not allowed to pick. */
  myOptionId: string | null;
  myChoiceId: string | null;
}

export type BluffPlayerState = BluffState & BluffPrivate;
