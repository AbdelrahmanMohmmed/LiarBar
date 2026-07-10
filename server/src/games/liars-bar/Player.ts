import type { Card } from "./Deck.js";

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

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  totalCardsPlayed: number;
  successfulBluffs: number;
  failedBluffs: number;
  successfulCalls: number;
  failedCalls: number;
}

export class Player {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  hand: Card[];
  isConnected: boolean;
  avatarUrl?: string;
  socketId?: string;
  stats: PlayerStats;
  consecutiveTimeouts: number;

  constructor(
    id: string,
    name: string,
    isBot: boolean = false,
    isHost: boolean = false,
    stats?: PlayerStats,
  ) {
    this.id = id;
    this.name = name;
    this.isBot = isBot;
    this.consecutiveTimeouts = 0;
    this.isHost = isHost;
    this.hand = [];
    this.isConnected = !isBot;
    this.stats = stats || {
      gamesPlayed: 0,
      gamesWon: 0,
      totalCardsPlayed: 0,
      successfulBluffs: 0,
      failedBluffs: 0,
      successfulCalls: 0,
      failedCalls: 0,
    };
  }

  get cardCount(): number {
    return this.hand.length;
  }

  /** Remove cards at given indices from hand. Returns the removed cards. */
  removeCards(indices: number[]): Card[] {
    const sorted = [...indices].sort((a, b) => b - a);
    const removed: Card[] = [];
    for (const idx of sorted) {
      if (idx >= 0 && idx < this.hand.length) {
        removed.push(this.hand.splice(idx, 1)[0]);
      }
    }
    return removed.reverse();
  }

  /** Add cards to hand */
  addCards(cards: Card[]): void {
    this.hand.push(...cards);
  }

  /** Check if player has won (empty hand) */
  get hasWon(): boolean {
    return this.hand.length === 0;
  }

  /** Record a played card (for stats) */
  recordPlay(cardCount: number): void {
    this.stats.totalCardsPlayed += cardCount;
  }

  /** Record a bluff attempt */
  recordBluff(success: boolean): void {
    if (success) {
      this.stats.successfulBluffs++;
    } else {
      this.stats.failedBluffs++;
    }
  }

  /** Record a liar call attempt */
  recordCall(success: boolean): void {
    if (success) {
      this.stats.successfulCalls++;
    } else {
      this.stats.failedCalls++;
    }
  }

  /** Record game result */
  recordGame(won: boolean): void {
    this.stats.gamesPlayed++;
    if (won) {
      this.stats.gamesWon++;
    }
  }

  /** Full data including hand (for owner) */
  toData(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      isBot: this.isBot,
      isHost: this.isHost,
      hand: this.hand,
      cardCount: this.cardCount,
      isConnected: this.isConnected,
      avatarUrl: this.avatarUrl,
      stats: this.stats,
    };
  }

  /** Public data (no hand cards) */
  toPublicData(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      isBot: this.isBot,
      isHost: this.isHost,
      hand: [],
      cardCount: this.cardCount,
      isConnected: this.isConnected,
      avatarUrl: this.avatarUrl,
      stats: this.stats,
    };
  }

  /** Create player from stored data */
  static fromData(data: PlayerData): Player {
    const player = new Player(
      data.id,
      data.name,
      data.isBot,
      data.isHost,
      data.stats,
    );
    player.hand = data.hand || [];
    player.isConnected = data.isConnected;
    player.avatarUrl = data.avatarUrl;
    return player;
  }
}