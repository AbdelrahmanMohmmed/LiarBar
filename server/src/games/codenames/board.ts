import type { PlayerData } from "../liars-bar/Player.js";

export type Team = "red" | "teal";
export type Role = "spymaster" | "operative";
export type Lang = "ar" | "en";
export type CardType = "red" | "teal" | "neutral" | "assassin";

export interface BoardCard {
  word: string;
  revealed: boolean;
  type?: CardType;
}

export type LogEntry =
  | { kind: "clue"; team: Team; player: string; word: string; count: number }
  | { kind: "guess"; team: Team; player: string; word: string; result: CardType }
  | { kind: "pass"; team: Team; player: string };

export interface CodenamesState {
  roomId: string;
  gameId: "codenames";
  phase: "lobby" | "playing" | "finished";
  language: Lang;
  maxPlayers: number;
  players: PlayerData[];
  assignments: Record<string, { team: Team | null; role: Role | null }>;
  board: BoardCard[];
  startingTeam: Team | null;
  remaining: { red: number; teal: number };
  turn: { team: Team; phase: "clue" | "guess" } | null;
  clue: { word: string; count: number; guessesRemaining: number } | null;
  log: LogEntry[];
  winner: Team | null;
  winReason: "all_revealed" | "assassin" | null;
}

/** Fisher-Yates shuffle, non-mutating. */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 9 cards for the starting team, 8 for the other, 7 neutral, 1 assassin. */
export function generateKey(startingTeam: Team): CardType[] {
  const otherTeam: Team = startingTeam === "red" ? "teal" : "red";
  const types: CardType[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill("neutral"),
    "assassin",
  ];
  return shuffle(types);
}

/** Pick 25 unique random words from the pool. */
export function pickWords(pool: string[]): string[] {
  return shuffle(pool).slice(0, 25);
}
