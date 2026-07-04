import type { Card, CardDeclaration, Suit, Rank } from "./Deck.js";

export type ClaimType = "suit" | "rank";

function dominoMatches(card: Card, value: number): boolean {
  return card.type === "dominoe" && (card.left === value || card.right === value);
}

export function validateDeclarationByType(
  declaration: CardDeclaration,
  actualCards: Card[],
  claimType?: ClaimType,
): boolean {
  if (declaration.type === "dominoe") {
    return actualCards.every((c) => dominoMatches(c, declaration.value));
  }

  if (claimType === "suit") {
    return actualCards.every(
      (c) => c.type === "playing-card" && c.suit === declaration.suit,
    );
  }

  if (claimType === "rank") {
    return actualCards.every(
      (c) => c.type === "playing-card" && c.rank === declaration.rank,
    );
  }

  return actualCards.every(
    (c) =>
      c.type === "playing-card" &&
      c.rank === declaration.rank &&
      c.suit === declaration.suit,
  );
}

export function isCardMatchingDeclaration(
  card: Card,
  declaration: CardDeclaration,
  claimType?: ClaimType,
): boolean {
  if (declaration.type === "dominoe") {
    return card.type === "dominoe" && dominoMatches(card, declaration.value);
  }
  if (card.type === "dominoe") return false;

  if (claimType === "suit") {
    return card.suit === declaration.suit;
  }
  if (claimType === "rank") {
    return card.rank === declaration.rank;
  }
  return card.rank === declaration.rank && card.suit === declaration.suit;
}

export function formatDeclaration(
  declaration: CardDeclaration,
  claimType?: ClaimType,
): string {
  if (declaration.type === "dominoe") {
    return `${declaration.count}x number ${declaration.value}`;
  }
  if (claimType === "suit") {
    return `${declaration.count}x ${declaration.suit}`;
  }
  if (claimType === "rank") {
    return `${declaration.count}x ${declaration.rank}`;
  }
  return `${declaration.count}x ${declaration.rank} of ${declaration.suit}`;
}

/** Count how many cards in a hand contain the claimed number (for dominoes) */
export function countDominoesWithValue(hand: Card[], value: number): number {
  return hand.filter((c) => c.type === "dominoe" && (c.left === value || c.right === value)).length;
}

/** Find the common value across all played dominoes, or null if none */
export function findCommonDominoValue(cards: Card[]): number | null {
  const dominoes = cards.filter((c) => c.type === "dominoe") as import("./Deck.js").Dominoe[];
  if (dominoes.length === 0) return null;
  // Collect all numbers present in the first domino
  const candidates = new Set([dominoes[0].left, dominoes[0].right]);
  for (let i = 1; i < dominoes.length; i++) {
    const d = dominoes[i];
    for (const val of candidates) {
      if (d.left !== val && d.right !== val) {
        candidates.delete(val);
      }
    }
    if (candidates.size === 0) return null;
  }
  return candidates.values().next().value ?? null;
}
