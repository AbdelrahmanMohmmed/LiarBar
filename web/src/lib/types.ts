export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface PlayingCard {
  type: "playing-card";
  suit: Suit;
  rank: Rank;
}

export interface Dominoe {
  type: "dominoe";
  left: number;
  right: number;
}

export type Card = PlayingCard | Dominoe;

export type GameVariant = "cards" | "dominoes";

export type ClaimType = "suit" | "rank";

export type BotDifficulty = "easy" | "medium" | "hard";

export type CardDeclaration =
  | { type: "playing-card"; rank: Rank; suit: Suit; count: number }
  | { type: "dominoe"; value: number; count: number };

export type GamePhase =
  | "lobby"
  | "playing"
  | "waiting_for_challenge"
  | "revealing"
  | "game_over";

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  totalCardsPlayed: number;
  successfulBluffs: number;
  failedBluffs: number;
  successfulCalls: number;
  failedCalls: number;
}

export interface PlayerData {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  hand: Card[];
  cardCount: number;
  isConnected: boolean;
  avatarUrl?: string;
  stats?: PlayerStats;
}

export interface GameAction {
  type:
    | "play"
    | "call_liar"
    | "challenge_result"
    | "pile_taken"
    | "player_won";
  playerId: string;
  playerName: string;
  data?: unknown;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: PlayerData[];
  currentTurn: number;
  pileCount: number;
  lastDeclaration: CardDeclaration | null;
  lastPlayerId: string | null;
  currentRequiredClaim: CardDeclaration | null;
  winner: string | null;
  actionLog: GameAction[];
  variant: GameVariant;
  deckCount: number;
  maxPlayers: number;
  claimType: ClaimType;
  challengeDeadline: number | null;
  revealedCards: string[];
  revealTime: number;
  revealDeadline: number | null;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface ToastNotification {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "challenge";
  timestamp: number;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

export const SUIT_COLORS: Record<Suit, string> = {
  hearts: "#e74c3c",
  diamonds: "#e74c3c",
  clubs: "#2c3e50",
  spades: "#2c3e50",
};

export function cardToString(card: Card): string {
  if (card.type === "playing-card") {
    return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
  }
  return `${card.left}-${card.right}`;
}

export function declarationToString(d: CardDeclaration, claimType?: ClaimType): string {
  if (d.type === "dominoe") {
    return `${d.count}x number ${d.value}`;
  }
  if (claimType === "suit") {
    return `${d.count}x ${SUIT_SYMBOLS[d.suit]} ${d.suit}`;
  }
  if (claimType === "rank") {
    return `${d.count}x ${d.rank}`;
  }
  return `${d.count}x ${d.rank}${SUIT_SYMBOLS[d.suit]}`;
}

export function getRankValue(rank: Rank): number {
  const values: Record<Rank, number> = { A: 14, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13 };
  return values[rank];
}

const SYMBOL_TO_SUIT: Record<string, Suit> = {
  "\u2665": "hearts",
  "\u2666": "diamonds",
  "\u2663": "clubs",
  "\u2660": "spades",
};

export function parseCardString(cardStr: string): Card | null {
  const symbol = cardStr.slice(-1);
  const suit = SYMBOL_TO_SUIT[symbol];
  if (suit) {
    const rank = cardStr.slice(0, -1) as Rank;
    if (rank && getRankValue(rank)) {
      return { type: "playing-card", rank, suit };
    }
    return null;
  }
  const parts = cardStr.split("-");
  if (parts.length === 2) {
    const left = parseInt(parts[0], 10);
    const right = parseInt(parts[1], 10);
    if (!isNaN(left) && !isNaN(right)) {
      return { type: "dominoe", left, right };
    }
  }
  return null;
}
