import {
  type Card,
  type CardDeclaration,
  type GameVariant,
  type ClaimType,
  cardToString,
  createGameDeck,
  validateDeclaration,
} from "./Deck.js";
import { validateDeclarationByType } from "./Validation.js";
import { BotAI, type BotDifficulty } from "./BotAI.js";
import { Player, type PlayerData } from "./Player.js";
import { nanoid } from "nanoid";

export type GamePhase =
  | "lobby"
  | "playing"
  | "waiting_for_challenge"
  | "revealing"
  | "game_over";

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

const CHALLENGE_WINDOW_MS = 7000;

export class GameManager {
  roomId: string;
  players: Player[];
  phase: GamePhase;
  currentTurn: number;
  centralPile: Card[];
  lastDeclaration: CardDeclaration | null;
  lastPlayerId: string | null;
  currentRequiredClaim: CardDeclaration | null;
  skipCount: number;
  actionLog: GameAction[];
  variant: GameVariant;
  deckCount: number;
  maxPlayers: number;
  claimType: ClaimType;
  challengeDeadline: number | null;
  revealedCards: string[];
  revealTime: number;
  revealDeadline: number | null;
  botAIs: Map<string, BotAI>;
  botTimers: Map<string, NodeJS.Timeout>;
  private challengeTimer: NodeJS.Timeout | null;
  private revealTimer: NodeJS.Timeout | null;
  private destroyed: boolean = false;

  private broadcast: (state: GameState) => void;
  private onGameEnd: (roomId: string, winnerId: string) => void;
  private onChallengeResolved: (roomId: string) => void;

  constructor(
    roomId: string,
    variant: GameVariant,
    deckCount: number,
    maxPlayers: number,
    claimType: ClaimType,
    revealTime: number,
    broadcast: (state: GameState) => void,
    onGameEnd: (roomId: string, winnerId: string) => void,
    onChallengeResolved?: (roomId: string) => void,
  ) {
    this.roomId = roomId;
    this.players = [];
    this.phase = "lobby";
    this.currentTurn = 0;
    this.centralPile = [];
    this.lastDeclaration = null;
    this.lastPlayerId = null;
    this.currentRequiredClaim = null;
    this.skipCount = 0;
    this.actionLog = [];
    this.variant = variant;
    this.deckCount = deckCount;
    this.maxPlayers = maxPlayers;
    this.claimType = claimType;
    this.challengeDeadline = null;
    this.revealedCards = [];
    this.revealTime = revealTime;
    this.revealDeadline = null;
    this.botAIs = new Map();
    this.botTimers = new Map();
    this.challengeTimer = null;
    this.revealTimer = null;
    this.broadcast = broadcast;
    this.onGameEnd = onGameEnd;
    this.onChallengeResolved = onChallengeResolved || (() => {});
  }

  addPlayer(name: string, socketId: string, isHost: boolean = false): Player {
    const id = nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);
    return player;
  }

  addBot(name: string, difficulty: BotDifficulty = "medium"): Player {
    const id = `bot_${nanoid(6)}`;
    const player = new Player(id, name, true, false);
    this.players.push(player);
    this.botAIs.set(id, new BotAI(id, difficulty, this.deckCount));
    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.botAIs.delete(botId);
    const timer = this.botTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.botTimers.delete(botId);
    }
    return true;
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    player.isConnected = false;
    player.socketId = undefined;

    if (
      this.phase !== "lobby" &&
      this.phase !== "game_over" &&
      this.players[this.currentTurn]?.id === player.id
    ) {
      this.advanceTurn();
    }
    return player;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.isConnected = true;
    player.socketId = socketId;
    return player;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  get currentPlayer(): Player | undefined {
    if (this.players.length === 0) return undefined;
    return this.players[this.currentTurn % this.players.length];
  }

  canStart(): boolean {
    const realPlayers = this.players.filter((p) => !p.isBot);
    return this.players.length >= 2 && realPlayers.length >= 1;
  }

  startGame(): GameState | null {
    if (!this.canStart()) return null;

    const deck = createGameDeck(this.variant, this.deckCount);

    const playerCount = this.players.length;
    const cardsPerPlayer = Math.floor(deck.length / playerCount);

    for (let i = 0; i < playerCount; i++) {
      this.players[i].hand = deck.slice(
        i * cardsPerPlayer,
        (i + 1) * cardsPerPlayer,
      );
    }

    this.centralPile = [];
    this.phase = "playing";
    this.currentTurn = 0;
    this.lastDeclaration = null;
    this.lastPlayerId = null;
    this.currentRequiredClaim = null;
    this.skipCount = 0;
    this.actionLog = [];
    this.revealedCards = [];
    this.revealDeadline = null;
    this.challengeDeadline = null;

    for (const player of this.players) {
      if (player.isBot && !this.botAIs.has(player.id)) {
        this.botAIs.set(player.id, new BotAI(player.id, "medium", this.deckCount));
      }
    }

    this.logAction({
      type: "play",
      playerId: "system",
      playerName: "Game",
      data: { message: "Game started!" },
      timestamp: Date.now(),
    });

    const state = this.toState();
    this.broadcast(state);

    this.triggerBotIfNeeded();

    return state;
  }

  /**
   * Player plays cards and makes a declaration.
   */
  playCards(
    playerId: string,
    cardIndices: number[],
    declaration: CardDeclaration,
  ): { success: boolean; error?: string } {
    if (this.destroyed) {
      return { success: false, error: "Game destroyed" };
    }

    if (this.phase !== "playing") {
      return { success: false, error: "Game is not in playing phase" };
    }

    const currentPlayer = this.players[this.currentTurn];
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, error: "Not your turn" };
    }

    if (cardIndices.length < 1 || cardIndices.length > currentPlayer.hand.length) {
      return { success: false, error: "Must play at least 1 card" };
    }

    if (cardIndices.length !== declaration.count) {
      return { success: false, error: "Declaration count must match number of cards played" };
    }

    // Validate against current required claim (persistent claim)
    if (this.currentRequiredClaim) {
      const matchesRequired = this.isDeclarationMatchingRequiredClaim(declaration);
      if (!matchesRequired) {
        return { success: false, error: "Declaration must match the current required claim" };
      }
    }

    const unique = new Set(cardIndices);
    if (unique.size !== cardIndices.length) {
      return { success: false, error: "Duplicate card indices" };
    }

    for (const idx of cardIndices) {
      if (idx < 0 || idx >= currentPlayer.hand.length) {
        return { success: false, error: "Invalid card index" };
      }
    }

    const played = currentPlayer.removeCards(cardIndices);
    currentPlayer.recordPlay(played.length);

    this.centralPile.push(...played);

    // Set the persistent claim if this starts a new round
    if (!this.currentRequiredClaim) {
      this.currentRequiredClaim = declaration;
    }
    this.skipCount = 0;

    this.lastDeclaration = declaration;
    this.lastPlayerId = playerId;

    this.logAction({
      type: "play",
      playerId,
      playerName: currentPlayer.name,
      data: {
        declaration,
        cardCount: cardIndices.length,
      },
      timestamp: Date.now(),
    });

    // Open challenge window for ALL other players
    this.phase = "waiting_for_challenge";
    this.revealedCards = [];
    this.challengeDeadline = Date.now() + CHALLENGE_WINDOW_MS;

    const state = this.toState();
    this.broadcast(state);

    // Start challenge timer
    this.clearChallengeTimer();
    this.challengeTimer = setTimeout(() => {
      this.onChallengeWindowEnd();
    }, CHALLENGE_WINDOW_MS);

    // Trigger ALL bots to make a challenge decision (except the one who played)
    this.triggerBotChallenges();

    return { success: true };
  }

  /**
   * Any player (except the one who just played) can call "Liar!".
   * First caller wins.
   */
  callLiar(challengerId: string): { success: boolean; error?: string } {
    if (this.destroyed) {
      return { success: false, error: "Game destroyed" };
    }

    if (this.phase !== "waiting_for_challenge") {
      return { success: false, error: "No pending declaration to challenge" };
    }

    if (challengerId === this.lastPlayerId) {
      return { success: false, error: "You cannot challenge your own play" };
    }

    // Check that the challenger is actually in the game
    const challenger = this.getPlayer(challengerId);
    if (!challenger) {
      return { success: false, error: "Player not found" };
    }

    return this.resolveChallenge(challengerId);
  }

  /**
   * Resolve a liar challenge — first reveal phase, then after revealTime resolve.
   */
  private resolveChallenge(
    challengerId: string,
  ): { success: boolean; error?: string } {
    if (!this.lastDeclaration || !this.lastPlayerId) {
      return { success: false, error: "No declaration to resolve" };
    }

    this.clearChallengeTimer();

    // Get the cards that were just placed
    const lastPlayCount = this.lastDeclaration.count;
    const challengedCards = this.centralPile.slice(-lastPlayCount);

    const isTruth = validateDeclarationByType(
      this.lastDeclaration,
      challengedCards,
      this.claimType,
    );

    // Store revealed cards for broadcast
    this.revealedCards = challengedCards.map(cardToString);

    const challenger = this.getPlayer(challengerId);
    const challenged = this.getPlayer(this.lastPlayerId);

    if (!challenger || !challenged) {
      return { success: false, error: "Player not found" };
    }

    let winner: Player;
    let loser: Player;

    if (isTruth) {
      winner = challenged;
      loser = challenger;
      challenged.recordCall(false);
      challenger.recordCall(true);
    } else {
      winner = challenger;
      loser = challenged;
      challenger.recordBluff(true);
      challenged.recordBluff(false);
    }

    this.logAction({
      type: "challenge_result",
      playerId: challengerId,
      playerName: challenger.name,
      data: {
        isTruth,
        challengedName: challenged.name,
        challengedId: challenged.id,
        revealedCards: this.revealedCards,
        declaration: this.lastDeclaration,
      },
      timestamp: Date.now(),
    });

    // Phase to "revealing" — show cards to everyone for revealTime seconds
    const revealMs = this.revealTime * 1000;
    this.phase = "revealing";
    this.revealDeadline = Date.now() + revealMs;

    const revealState = this.toState();
    this.broadcast(revealState);

    // Set timer to complete resolution after revealTime
    this.clearRevealTimer();
    this.revealTimer = setTimeout(() => {
      this.onRevealCompleted(winner, loser, challengedCards);
    }, revealMs);

    return { success: true };
  }

  /** Called when the reveal timer expires — actually assign the pile and advance turn */
  private onRevealCompleted(
    winner: Player,
    loser: Player,
    challengedCards: Card[],
  ): void {
    if (this.destroyed) return;

    this.revealDeadline = null;
    this.revealTimer = null;

    // Loser takes the entire central pile
    const pileCards = [...this.centralPile];
    loser.addCards(pileCards);

    this.logAction({
      type: "pile_taken",
      playerId: loser.id,
      playerName: loser.name,
      data: { cardCount: pileCards.length },
      timestamp: Date.now(),
    });

    this.centralPile = [];
    this.lastDeclaration = null;
    this.lastPlayerId = null;
    this.currentRequiredClaim = null;
    this.skipCount = 0;
    this.revealedCards = [];
    this.challengeDeadline = null;

    // Winner starts the new round
    this.currentTurn = this.players.findIndex((p) => p.id === winner.id);

    if (winner.hasWon) {
      this.endGame(winner.id);
      return;
    }

    this.phase = "playing";

    const state = this.toState();
    this.broadcast(state);

    // Notify index.ts to send private hands
    this.onChallengeResolved(this.roomId);

    this.triggerBotIfNeeded();
  }

  /**
   * Called when the challenge window timer expires.
   * Advances the turn to the next player.
   */
  private onChallengeWindowEnd(): void {
    if (this.destroyed || this.phase !== "waiting_for_challenge") return;

    this.challengeDeadline = null;
    this.challengeTimer = null;

    // Check if the last player emptied their hand - they win!
    if (this.lastPlayerId) {
      const lastPlayer = this.getPlayer(this.lastPlayerId);
      if (lastPlayer && lastPlayer.hasWon) {
        this.endGame(lastPlayer.id);
        return;
      }
    }

    // Advance to next player
    const lastPlayerIdx = this.lastPlayerId
      ? this.players.findIndex((p) => p.id === this.lastPlayerId)
      : this.currentTurn;
    const nextIdx = (lastPlayerIdx + 1) % this.players.length;

    this.phase = "playing";
    this.currentTurn = nextIdx;
    this.lastDeclaration = null;
    this.lastPlayerId = null;
    this.revealedCards = [];

    const state = this.toState();
    this.broadcast(state);

    this.triggerBotIfNeeded();
  }

  /**
   * Called when a player chooses to NOT challenge and lets the turn advance.
   * Any non-lastPlayer can call this during the challenge window.
   * Also called during playing phase to skip your turn to play.
   */
  passTurn(playerId: string): { success: true } | { success: false; error: string } {
    if (this.phase === "waiting_for_challenge") {
      if (playerId === this.lastPlayerId) {
        return { success: false, error: "You can't pass on your own claim" };
      }
      // First caller wins - effectively advance turn immediately
      this.onChallengeWindowEnd();
      return { success: true };
    }

    if (this.phase === "playing") {
      // Skip your turn to play
      const currentPlayer = this.players[this.currentTurn];
      if (!currentPlayer || currentPlayer.id !== playerId) {
        return { success: false, error: "Not your turn" };
      }

      this.skipCount++;

      if (this.skipCount >= this.players.length - 1) {
        // Full round of skips — clear the pile and reset claim
        this.clearPileAndResetClaim();
      } else {
        this.advanceTurn();
      }
      return { success: true };
    }

    return { success: false, error: "Cannot pass at this time" };
  }

  /** Advance turn to next player (for disconnects) */
  private advanceTurn(): void {
    this.clearChallengeTimer();
    this.currentTurn = (this.currentTurn + 1) % this.players.length;
    this.phase = "playing";
    this.lastDeclaration = null;
    this.lastPlayerId = null;
    this.revealedCards = [];
    this.challengeDeadline = null;
    const state = this.toState();
    this.broadcast(state);
    this.triggerBotIfNeeded();
  }

  /** End the game with a winner */
  private endGame(winnerId: string): void {
    if (this.destroyed) return;

    this.clearChallengeTimer();

    this.phase = "game_over";
    const winner = this.getPlayer(winnerId);
    if (winner) {
      winner.recordGame(true);
      this.logAction({
        type: "player_won",
        playerId: winnerId,
        playerName: winner.name,
        timestamp: Date.now(),
      });
    }

    for (const player of this.players) {
      if (player.id !== winnerId) {
        player.recordGame(false);
      }
    }

    const state = this.toState();
    this.broadcast(state);
    this.clearBotTimers();
    this.onGameEnd(this.roomId, winnerId);
  }

  /** Trigger bot move if it's a bot's turn */
  private triggerBotIfNeeded(): void {
    if (this.destroyed) return;
    this.clearBotTimers();

    if (this.phase !== "playing") return;

    const currentPlayer = this.currentPlayer;
    if (!currentPlayer || !currentPlayer.isBot) return;

    const botAI = this.botAIs.get(currentPlayer.id);
    if (!botAI) return;

    const timer = setTimeout(() => {
      if (!this.destroyed) {
        this.executeBotMove(currentPlayer.id);
      }
    }, botAI.delay);
    this.botTimers.set(currentPlayer.id, timer);
  }

  /** Trigger ALL bots to decide on challenging */
  private triggerBotChallenges(): void {
    if (this.destroyed) return;
    this.clearBotTimers();

    if (this.phase !== "waiting_for_challenge" || !this.lastPlayerId) return;

    for (const player of this.players) {
      if (!player.isBot || player.id === this.lastPlayerId) continue;

      const botAI = this.botAIs.get(player.id);
      if (!botAI) continue;

      const timer = setTimeout(() => {
        if (!this.destroyed && this.phase === "waiting_for_challenge") {
          this.executeBotChallengeDecision(player.id);
        }
      }, botAI.delay);
      this.botTimers.set(player.id, timer);
    }
  }

  /** Execute a bot's move */
  private executeBotMove(botId: string): void {
    if (this.destroyed) return;

    const botAI = this.botAIs.get(botId);
    if (!botAI) return;

    const player = this.getPlayer(botId);
    if (!player || !player.isBot) return;

    if (this.currentPlayer?.id !== botId) return;

    const move = botAI.makePlay(
      player.hand,
      this.centralPile.length,
      this.currentRequiredClaim,
      this.claimType,
    );

    if (!move) {
      // Bot can't find a valid play - skip turn
      this.passTurn(botId);
      return;
    }

    this.playCards(botId, move.cardIndices, move.declaration);
  }

  /** Execute a bot's challenge decision */
  private executeBotChallengeDecision(botId: string): void {
    if (this.destroyed || this.phase !== "waiting_for_challenge") return;

    const botAI = this.botAIs.get(botId);
    if (!botAI) return;

    const player = this.getPlayer(botId);
    if (!player || !player.isBot) return;

    if (!this.lastDeclaration) return;

    const lastPlayer = this.getPlayer(this.lastPlayerId!);

    const shouldCall = botAI.shouldCallLiar(
      this.lastDeclaration,
      lastPlayer?.cardCount ?? 0,
      this.centralPile.length,
      player.hand,
      this.claimType,
    );

    if (shouldCall) {
      this.callLiar(botId);
    }
    // If bot chooses not to call liar, it simply waits for the window to expire
  }

  /** Clear the challenge timer */
  private clearChallengeTimer(): void {
    if (this.challengeTimer) {
      clearTimeout(this.challengeTimer);
      this.challengeTimer = null;
    }
  }

  /** Clear the reveal timer */
  private clearRevealTimer(): void {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }

  /** Clear all bot timers */
  private clearBotTimers(): void {
    for (const timer of this.botTimers.values()) {
      clearTimeout(timer);
    }
    this.botTimers.clear();
  }

  /** Add an action to the log */
  private logAction(action: GameAction): void {
    this.actionLog.push(action);
    if (this.actionLog.length > 50) {
      this.actionLog = this.actionLog.slice(-50);
    }
  }

  /** Serialize to GameState */
  toState(): GameState {
    return {
      roomId: this.roomId,
      phase: this.phase,
      players: this.players.map((p) => p.toPublicData()),
      currentTurn: this.currentTurn,
      pileCount: this.centralPile.length,
      lastDeclaration: this.lastDeclaration,
      lastPlayerId: this.lastPlayerId,
      currentRequiredClaim: this.currentRequiredClaim,
      winner:
        this.phase === "game_over"
          ? this.players.find((p) => p.hasWon)?.id ?? null
          : null,
      actionLog: this.actionLog,
      variant: this.variant,
      deckCount: this.deckCount,
      maxPlayers: this.maxPlayers,
      claimType: this.claimType,
      challengeDeadline: this.challengeDeadline,
      revealedCards: this.revealedCards,
      revealTime: this.revealTime,
      revealDeadline: this.revealDeadline,
    };
  }

  /** Serialize player-specific state (includes their hand) */
  toPlayerState(playerId: string): GameState & { hand: Card[] } {
    const base = this.toState();
    const player = this.getPlayer(playerId);
    return {
      ...base,
      hand: player ? [...player.hand] : [],
    };
  }

  /** Clear the central pile and reset the persistent claim. Used when all players skip or after a challenge. */
  private clearPileAndResetClaim(): void {
    this.centralPile = [];
    this.currentRequiredClaim = null;
    this.lastDeclaration = null;
    this.lastPlayerId = null;
    this.skipCount = 0;
    this.revealedCards = [];
    this.challengeDeadline = null;
    this.phase = "playing";

    const state = this.toState();
    this.broadcast(state);
    this.triggerBotIfNeeded();
  }

  /** Check if a declaration matches the current required claim (persistent suit/rank/value) */
  private isDeclarationMatchingRequiredClaim(declaration: CardDeclaration): boolean {
    if (!this.currentRequiredClaim) return true;

    if (declaration.type === "playing-card" && this.currentRequiredClaim.type === "playing-card") {
      if (this.claimType === "suit") {
        return declaration.suit === this.currentRequiredClaim.suit;
      }
      if (this.claimType === "rank") {
        return declaration.rank === this.currentRequiredClaim.rank;
      }
      return declaration.suit === this.currentRequiredClaim.suit && declaration.rank === this.currentRequiredClaim.rank;
    }

    if (declaration.type === "dominoe" && this.currentRequiredClaim.type === "dominoe") {
      return declaration.value === this.currentRequiredClaim.value;
    }

    return false;
  }

  /** Clean up */
  destroy(): void {
    this.destroyed = true;
    this.clearChallengeTimer();
    this.clearRevealTimer();
    this.clearBotTimers();
  }
}
