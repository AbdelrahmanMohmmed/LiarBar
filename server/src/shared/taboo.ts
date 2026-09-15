/**
 * Taboo wire contract. See shared/README.md — this file is copied into
 * web/src/lib/generated/ by `npm run types:sync`.
 */

import type { RoomPlayerLite } from "./domino.js";

export type TabooPhase = "lobby" | "describing" | "turn_recap" | "game_over";

export type TabooTeam = "a" | "b";

/** What happened to one card. The word is only here once it's resolved. */
export interface TabooResult {
  word: string;
  outcome: "correct" | "buzzed" | "skipped";
}

export interface TabooSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  team: TabooTeam;
}

export interface TabooTurnRecap {
  describerId: string;
  describerName: string;
  team: TabooTeam;
  results: TabooResult[];
  points: number;
  nextTurnAt: number | null;
}

export interface TabooState {
  roomId: string;
  gameId: "taboo";
  phase: TabooPhase;
  maxPlayers: number;
  players: RoomPlayerLite[];
  seats: TabooSeat[];
  /** The room's language, which is the deck's language. */
  language: "en" | "ar";
  scores: Record<TabooTeam, number>;
  targetScore: number;
  turnNumber: number;
  describerId: string | null;
  describingTeam: TabooTeam | null;
  /** Resolved cards only — never the one currently being described. */
  turnResults: TabooResult[];
  deadline: number | null;
  recap: TabooTurnRecap | null;
  winningTeam: TabooTeam | null;
  /** Always null: Taboo is won by a team, not a player. */
  winnerId: string | null;
  cardsLeft: number;
}

/**
 * Arrives on `taboo_private`. The card goes to the describer and to the
 * opposing team — who, in the physical game, are the ones holding it — and
 * never to the describer's own teammates, who are the ones guessing.
 */
export interface TabooPrivate {
  card: { word: string; taboo: string[] } | null;
  myTeam: TabooTeam | null;
  amDescribing: boolean;
  canBuzz: boolean;
}

export type TabooPlayerState = TabooState & TabooPrivate;
