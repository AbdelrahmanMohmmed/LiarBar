/** Card suits */
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

/** Card ranks */
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

/** A standard playing card */
export interface PlayingCard {
  type: "playing-card";
  suit: Suit;
  rank: Rank;
}

/** A domino tile */
export interface Dominoe {
  type: "dominoe";
  left: number; // 0-6
  right: number; // 0-6
}

/** Union type for any card in the game */
export type Card = PlayingCard | Dominoe;

/** Game variant */
export type GameVariant = "cards" | "dominoes";

/** Claim type for playing cards (suit-only or rank-only) */
export type ClaimType = "suit" | "rank";

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};

/** String representation of a card */
export function cardToString(card: Card): string {
  if (card.type === "playing-card") {
    return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
  }
  return `${card.left}-${card.right}`;
}

/** Check if two cards match (same type and values) */
export function cardsMatch(a: Card, b: Card): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "playing-card" && b.type === "playing-card") {
    return a.suit === b.suit && a.rank === b.rank;
  }
  if (a.type === "dominoe" && b.type === "dominoe") {
    return (
      (a.left === b.left && a.right === b.right) ||
      (a.left === b.right && a.right === b.left)
    );
  }
  return false;
}

/** Create a standard 52-card deck */
export function createPlayingCardDeck(): PlayingCard[] {
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks: Rank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const deck: PlayingCard[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ type: "playing-card", suit, rank });
    }
  }
  return deck;
}

/** Create a full dominoes set (0-0 through 6-6, 28 tiles) */
export function createDominoeSet(): Dominoe[] {
  const set: Dominoe[] = [];
  for (let left = 0; left <= 6; left++) {
    for (let right = left; right <= 6; right++) {
      set.push({ type: "dominoe", left, right });
    }
  }
  return set;
}

/** Fisher-Yates shuffle */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Create and shuffle the game deck based on variant and number of decks */
export function createGameDeck(
  variant: GameVariant,
  deckCount: number,
): Card[] {
  if (variant === "cards") {
    const decks: Card[] = [];
    for (let i = 0; i < deckCount; i++) {
      decks.push(...createPlayingCardDeck());
    }
    return shuffle(decks);
  }
  // Dominoes - deckCount means number of sets
  const sets: Card[] = [];
  for (let i = 0; i < deckCount; i++) {
    sets.push(...createDominoeSet());
  }
  return shuffle(sets);
}

/** Validate if a declaration matches the actual cards played */
export function validateDeclaration(
  declaration: CardDeclaration,
  actualCards: Card[],
): boolean {
  if (declaration.type === "playing-card") {
    return actualCards.every(
      (c) =>
        c.type === "playing-card" &&
        c.rank === declaration.rank &&
        c.suit === declaration.suit,
    );
  }
  // Dominoe declaration: each domino must have the claimed number on one half
  return actualCards.every(
    (c) =>
      c.type === "dominoe" &&
      (c.left === declaration.value || c.right === declaration.value),
  );
}

/** A player's declaration of what they're placing */
export type CardDeclaration =
  | {
      type: "playing-card";
      rank: Rank;
      suit: Suit;
      count: number;
    }
  | {
      type: "dominoe";
      value: number; // single claimed number (0-6) — match on left OR right
      count: number;
    };

/** Count how many of a specific card exist in a full game deck */
export function countCardsInDeck(
  variant: GameVariant,
  deckCount: number,
  declaration: CardDeclaration,
): number {
  if (variant === "cards" && declaration.type === "playing-card") {
    return deckCount * 4; // 4 suits per rank per deck
  }
  if (variant === "dominoes" && declaration.type === "dominoe") {
    // Each number (0-6) appears in 7 dominoes per set
    return 7 * deckCount;
  }
  return 0;
}