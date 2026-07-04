import type {
  Card,
  CardDeclaration,
  PlayingCard,
  Rank,
  Suit,
  ClaimType,
} from "./Deck.js";

import { countDominoesWithValue, findCommonDominoValue } from "./Validation.js";

export type BotDifficulty = "easy" | "medium" | "hard";

interface BotProfile {
  lieFrequency: [number, number];
  callThreshold: number;
  callLiarAggression: number;
  delayRange: [number, number];
  minCardsToBluff: number;
  truthBias: number;
}

const PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    lieFrequency: [0.3, 0.6],
    callThreshold: 0.7,
    callLiarAggression: 0.4,
    delayRange: [2000, 4000],
    minCardsToBluff: 2,
    truthBias: 0.3,
  },
  medium: {
    lieFrequency: [0.2, 0.45],
    callThreshold: 0.55,
    callLiarAggression: 0.6,
    delayRange: [1000, 3000],
    minCardsToBluff: 1,
    truthBias: 0.5,
  },
  hard: {
    lieFrequency: [0.15, 0.35],
    callThreshold: 0.4,
    callLiarAggression: 0.8,
    delayRange: [800, 2000],
    minCardsToBluff: 1,
    truthBias: 0.7,
  },
};

const ALL_SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const ALL_RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const DOMINO_VALUES = [0, 1, 2, 3, 4, 5, 6];

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function weightedPick<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.value;
  }
  return options[options.length - 1].value;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class BotAI {
  private profile: BotProfile;
  private id: string;
  difficulty: BotDifficulty;
  deckCount: number;

  constructor(id: string, difficulty: BotDifficulty = "medium", deckCount: number = 2) {
    this.difficulty = difficulty;
    this.profile = {
      ...PROFILES[difficulty],
      lieFrequency: [
        randBetween(PROFILES[difficulty].lieFrequency[0], PROFILES[difficulty].lieFrequency[1]),
        randBetween(PROFILES[difficulty].lieFrequency[0], PROFILES[difficulty].lieFrequency[1]),
      ],
    };
    this.id = id;
    this.deckCount = deckCount;
  }

  get delay(): number {
    return randBetween(this.profile.delayRange[0], this.profile.delayRange[1]);
  }

  /** Group hand cards by matching key (suit, rank, exact card, or domino type) */
  private analyzeHand(hand: Card[], claimType?: ClaimType) {
    const groups: { cards: Card[]; indices: number[]; key: string }[] = [];
    const seen = new Map<string, { cards: Card[]; indices: number[] }>();

    hand.forEach((card, idx) => {
      let key = "";
      if (card.type === "playing-card") {
        if (claimType === "suit") {
          key = `suit-${card.suit}`;
        } else if (claimType === "rank") {
          key = `rank-${card.rank}`;
        } else {
          key = `card-${card.rank}-${card.suit}`;
        }
      } else {
        key = `dom-${Math.min(card.left, card.right)}-${Math.max(card.left, card.right)}`;
      }
      if (!seen.has(key)) {
        seen.set(key, { cards: [], indices: [] });
      }
      seen.get(key)!.cards.push(card);
      seen.get(key)!.indices.push(idx);
    });

    for (const [key, val] of seen) {
      groups.push({ key, cards: val.cards, indices: val.indices });
    }

    groups.sort((a, b) => b.cards.length - a.cards.length);
    return groups;
  }

  /**
   * Decide whether to call liar.
   * Uses probability estimation based on own hand, pile size, claimant status.
   */
  shouldCallLiar(
    lastDeclaration: CardDeclaration,
    lastPlayerCardCount: number,
    pileSize: number,
    myHand: Card[],
    claimType?: ClaimType,
  ): boolean {
    const lieProb = this.estimateLieProbability(
      lastDeclaration, myHand, claimType,
    );

    if (this.difficulty === "easy") {
      // Easy bots sometimes ignore the math and call randomly
      if (Math.random() < 0.2) return Math.random() < 0.5;
    }

    // Adjust threshold based on game context
    let threshold = this.profile.callThreshold;

    // Bigger pile = more to lose = less likely to challenge
    const pileFactor = Math.min(pileSize / 25, 0.4);
    threshold += pileFactor;

    // If claimant is almost out, urgency to stop them
    if (lastPlayerCardCount <= 2) {
      threshold -= 0.2;
    } else if (lastPlayerCardCount === 3) {
      threshold -= 0.1;
    }

    // If bot has very few cards, avoid picking up pile
    if (myHand.length <= 2) {
      threshold += 0.25;
    } else if (myHand.length <= 4) {
      threshold += 0.1;
    }

    // If pile is empty, challenge is safer (nothing to lose)
    if (pileSize === 0) {
      threshold -= 0.15;
    }

    // Aggression factor
    threshold -= (this.profile.callLiarAggression - 0.5) * 0.2;

    return lieProb > threshold;
  }

  /**
   * Estimate probability the declaration is a lie.
   */
  private estimateLieProbability(
    declaration: CardDeclaration,
    myHand: Card[],
    claimType?: ClaimType,
  ): number {
    if (declaration.type === "playing-card") {
      return this.estimateCardLieProb(declaration, myHand, claimType);
    }
    return this.estimateDominoLieProb(declaration, myHand);
  }

  private estimateCardLieProb(
    declaration: CardDeclaration & { type: "playing-card" },
    myHand: Card[],
    claimType?: ClaimType,
  ): number {
    const declaredCount = declaration.count;
    const myHandCards = myHand.filter((c) => c.type === "playing-card") as PlayingCard[];

    let owned: number;
    let totalAvailable: number;
    let suitInfo: string;

    if (claimType === "suit") {
      owned = myHandCards.filter((c) => c.suit === declaration.suit).length;
      totalAvailable = 13 * this.deckCount;
    } else if (claimType === "rank") {
      owned = myHandCards.filter((c) => c.rank === declaration.rank).length;
      totalAvailable = 4 * this.deckCount;
    } else {
      owned = myHandCards.filter(
        (c) => c.rank === declaration.rank && c.suit === declaration.suit,
      ).length;
      totalAvailable = this.deckCount;
    }

    // If the bot owns a large share of the total available, it's unlikely the claimant has enough
    const remainingOutsideHand = totalAvailable - owned;
    const claimedOutsideHand = declaredCount - owned;

    if (claimedOutsideHand <= 0) return 0.95; // Bot has enough of these cards, claim is almost certainly a lie
    if (remainingOutsideHand <= 0) return 0.99; // No such cards exist outside bot's hand

    // Probability that claimant actually has `claimedOutsideHand` copies given remaining distribution
    // Simplified: the higher the proportion needed, the more suspicious
    const proportionNeeded = claimedOutsideHand / remainingOutsideHand;
    const suspicion = Math.min(proportionNeeded * 1.5, 0.95);

    // Low card count play is less suspicious
    if (declaredCount <= 1) {
      return suspicion * 0.6;
    }

    return suspicion;
  }

  private estimateDominoLieProb(
    declaration: CardDeclaration & { type: "dominoe" },
    myHand: Card[],
  ): number {
    const value = declaration.value;
    const declaredCount = declaration.count;

    const owned = countDominoesWithValue(myHand, value);
    const totalAvailable = 7 * this.deckCount;

    const remainingOutsideHand = totalAvailable - owned;
    const claimedOutsideHand = declaredCount - owned;

    if (claimedOutsideHand <= 0) return 0.95;
    if (remainingOutsideHand <= 0) return 0.99;

    const proportionNeeded = claimedOutsideHand / remainingOutsideHand;
    const suspicion = Math.min(proportionNeeded * 1.5, 0.95);

    if (declaredCount <= 1) {
      return suspicion * 0.6;
    }

    return suspicion;
  }

  /**
   * Decide what cards to play and what to declare.
   */
  makePlay(
    hand: Card[],
    pileSize: number,
    _lastDeclaration: CardDeclaration | null,
    claimType?: ClaimType,
  ): { cardIndices: number[]; declaration: CardDeclaration } | null {
    if (hand.length === 0) return null;

    const groups = this.analyzeHand(hand, claimType);

    // More truthful when close to winning (few cards)
    const handSizeBonus = hand.length <= 3 ? 0.2 : 0;
    const truthThreshold = this.profile.truthBias + handSizeBonus;

    // Decide whether to lie
    const willLie = Math.random() > truthThreshold && hand.length >= this.profile.minCardsToBluff;

    if (willLie) {
      return this.createBluffPlay(hand, groups, claimType);
    }

    return this.createTruthfulPlay(groups, claimType);
  }

  /** Create a truthful play from the largest matching group */
  private createTruthfulPlay(
    groups: { cards: Card[]; indices: number[]; key: string }[],
    claimType?: ClaimType,
  ): { cardIndices: number[]; declaration: CardDeclaration } | null {
    if (groups.length === 0) return null;

    const group = groups[0];
    const maxPlay = Math.min(4, group.cards.length);
    const playCount = weightedPick([
      { value: 1, weight: maxPlay >= 4 ? 0.3 : 0.5 },
      { value: 2, weight: maxPlay >= 2 ? 0.4 : 0 },
      { value: 3, weight: maxPlay >= 3 ? 0.2 : 0 },
      { value: 4, weight: maxPlay >= 4 ? 0.1 : 0 },
    ]);

    const indices = group.indices.slice(0, playCount);
    const first = group.cards[0];

    let declaration: CardDeclaration;
    if (first.type === "playing-card") {
      declaration = { type: "playing-card", rank: first.rank, suit: first.suit, count: playCount };
    } else {
      // For dominoes, pick a value that all played dominoes share
      const playedCards = group.cards.slice(0, playCount);
      const commonVal = findCommonDominoValue(playedCards);
      declaration = { type: "dominoe", value: commonVal ?? first.left, count: playCount };
    }

    return { cardIndices: indices, declaration };
  }

  /** Create a bluff: play some cards but claim something different */
  private createBluffPlay(
    hand: Card[],
    groups: { cards: Card[]; indices: number[]; key: string }[],
    claimType?: ClaimType,
  ): { cardIndices: number[]; declaration: CardDeclaration } | null {
    const maxPlay = Math.min(4, hand.length);
    const playCount = weightedPick([
      { value: 1, weight: 0.5 },
      { value: 2, weight: maxPlay >= 2 ? 0.3 : 0 },
      { value: 3, weight: maxPlay >= 3 ? 0.15 : 0 },
      { value: 4, weight: maxPlay >= 4 ? 0.05 : 0 },
    ]);

    // Pick cards to sacrifice (small groups first)
    const indices = this.pickSacrificialCards(groups, playCount);
    if (indices.length === 0) return this.createTruthfulPlay(groups, claimType);

    // Pick played cards for truth preview calculation
    const playedCards = indices.map((i) => hand[i]);

    // Create a believable lie
    const declaration = this.createBelievableLie(
      groups, playedCards, indices.length, claimType,
    );

    return { cardIndices: indices, declaration };
  }

  /** Pick cards to sacrifice when bluffing */
  private pickSacrificialCards(
    groups: { cards: Card[]; indices: number[]; key: string }[],
    count: number,
  ): number[] {
    const sorted = [...groups].sort((a, b) => a.cards.length - b.cards.length);
    const picked: number[] = [];

    for (const group of sorted) {
      if (picked.length >= count) break;
      picked.push(group.indices[0]);
    }

    if (picked.length < count) {
      for (const group of sorted) {
        for (let i = 1; i < group.indices.length; i++) {
          if (picked.length >= count) break;
          picked.push(group.indices[i]);
        }
        if (picked.length >= count) break;
      }
    }

    return picked.sort((a, b) => a - b);
  }

  /** Create a believable lie: claim something the bot actually has in hand */
  private createBelievableLie(
    groups: { cards: Card[]; indices: number[]; key: string }[],
    playedCards: Card[],
    count: number,
    claimType?: ClaimType,
  ): CardDeclaration {
    // Prefer to claim something we have a large group of (more believable on hand inspection)
    if (groups.length > 0) {
      const bigGroups = groups.filter((g) => g.cards.length >= 2);
      if (bigGroups.length > 0) {
        const target = bigGroups[Math.floor(Math.random() * bigGroups.length)];
        const card = target.cards[0];
        if (card.type === "playing-card") {
          return { type: "playing-card", rank: card.rank, suit: card.suit, count };
        }
        // Claim a value that appears in the played cards or a random one
        const commonVal = findCommonDominoValue(playedCards);
        return { type: "dominoe", value: commonVal ?? card.left, count };
      }

      // Claim a random card from a group we have
      const group = groups[Math.floor(Math.random() * groups.length)];
      const card = group.cards[0];
      if (card.type === "playing-card") {
        return { type: "playing-card", rank: card.rank, suit: card.suit, count };
      }
      const commonVal = findCommonDominoValue(playedCards);
      return { type: "dominoe", value: commonVal ?? card.left, count };
    }

    return this.createRandomDeclaration(count);
  }

  /** Fallback random declaration */
  private createRandomDeclaration(count: number): CardDeclaration {
    // 50/50 chance of card vs domino in fallback — use variant info if available
    if (Math.random() > 0.5) {
      return {
        type: "playing-card",
        rank: ALL_RANKS[Math.floor(Math.random() * ALL_RANKS.length)],
        suit: ALL_SUITS[Math.floor(Math.random() * ALL_SUITS.length)],
        count,
      };
    }
    return {
      type: "dominoe",
      value: DOMINO_VALUES[Math.floor(Math.random() * DOMINO_VALUES.length)],
      count,
    };
  }
}
