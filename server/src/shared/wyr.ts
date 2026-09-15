/**
 * Would You Rather wire contract. See shared/README.md — this file is copied
 * into web/src/lib/generated/ by `npm run types:sync`.
 */

import type { RoomPlayerLite } from "./domino.js";
import type { Bilingual } from "./spyfall.js";

export type { Bilingual };

export type WyrChoice = "a" | "b";

export type WyrPhase =
  | "lobby"
  /** The subject is answering, privately. */
  | "choosing"
  /** Everyone else is predicting what they answered. */
  | "predicting"
  | "reveal"
  | "game_over";

export interface WyrSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Locked in a prediction? Their answer stays hidden until the reveal. */
  hasPredicted: boolean;
  /** Present only from the reveal onward. */
  prediction?: WyrChoice | null;
  correct?: boolean;
}

export interface WyrReveal {
  subjectId: string;
  subjectName: string;
  answer: WyrChoice;
  tally: { a: number; b: number };
  correctIds: string[];
  wrongIds: string[];
  pointsAwarded: Record<string, number>;
  /** Nobody called it — the best outcome for the subject. */
  fooledEveryone: boolean;
  /** Everyone called it — the subject is exactly who they seem. */
  readLikeABook: boolean;
  nextRoundAt: number | null;
}

export interface WyrState {
  roomId: string;
  gameId: "wyr";
  phase: WyrPhase;
  maxPlayers: number;
  players: RoomPlayerLite[];
  seats: WyrSeat[];
  roundNumber: number;
  targetScore: number;
  /** Whose answer everyone is predicting this round. */
  subjectId: string | null;
  /** The card. Public from the start — everyone reads the same one. */
  dilemma: { id: string; a: Bilingual; b: Bilingual } | null;
  deadline: number | null;
  reveal: WyrReveal | null;
  winnerId: string | null;
}

/**
 * Per-player slice on `wyr_private`.
 *
 * The subject's answer is the one secret in the game. It is present here only
 * for the subject themselves, and only while the round is live.
 */
export interface WyrPrivate {
  isSubject: boolean;
  myAnswer: WyrChoice | null;
  myPrediction: WyrChoice | null;
}

export type WyrPlayerState = WyrState & WyrPrivate;
