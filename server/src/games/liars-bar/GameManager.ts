import {
  type Card,
  type CardDeclaration,
  type GameVariant,
  type ClaimType,
  cardToString,
  createGameDeck,
} from "./Deck.js";
import { validateDeclarationByType } from "./Validation.js";
import { BotAI, type BotDifficulty } from "./BotAI.js";
import { Player, type PlayerData } from "./Player.js";
import type { GameRoom } from "../types.js";
import { nanoid } from "nanoid";

export type GamePhase =
  | "lobby"
  | "playing"
  | "waiting_for_challenge"
  | "revealing"
  | "game_over";

/** Challenge mode: "timer" = fixed duration, "vote" = majority vote to skip */
export type ChallengeMode = "timer" | "vote";

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

export type GameTheme = "standard" | "classic" | "vip";

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
  theme: GameTheme;
  // Challenge mode settings
  challengeMode: ChallengeMode;
  challengeDuration: number; // in seconds (5 or 10)
  // Vote system state
  skipVotes: string[]; // playerIds who voted to skip
  skipVotesNeeded: number; // how many votes needed to skip
  challengeStartedAt: number | null; // timestamp when challenge window opened
  turnDeadline: number | null; // turn limit timestamp
}

const CHALLENGE_DURATION_OPTIONS = [5, 10] as const;
const MIN_CHALLENGE_TIME_BEFORE_VOTE_MS = 3000; // 3 seconds minimum before votes count

export class GameManager implements GameRoom {
  readonly gameId = "liars-bar";
  /** Updated on every state change; the room sweeper uses it to expire idle rooms. */
  lastActivityAt: number;
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
  theme: GameTheme;
  challengeDeadline: number | null;
  revealedCards: string[];
  revealTime: number;
  revealDeadline: number | null;
  botAIs: Map<string, BotAI>;
  botTimers: Map<string, NodeJS.Timeout>;
  turnDeadline: number | null;
  private challengeTimer: NodeJS.Timeout | null;
  private revealTimer: NodeJS.Timeout | null;
  private turnTimer: NodeJS.Timeout | null;
  private destroyed: boolean = false;
  // Challenge mode settings
  challengeMode: ChallengeMode;
  challengeDuration: number; // in seconds
  // Vote system state
  skipVotes: Set<string>;
  challengeStartedAt: number | null;

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
    theme: GameTheme,
    broadcast: (state: GameState) => void,
    onGameEnd: (roomId: string, winnerId: string) => void,
    onChallengeResolved?: (roomId: string) => void,
    challengeMode: ChallengeMode = "timer",
    challengeDuration: number = 5,
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
    this.theme = theme;
    this.challengeDeadline = null;
    this.revealedCards = [];
    this.revealTime = revealTime;
    this.revealDeadline = null;
    this.botAIs = new Map();
    this.botTimers = new Map();
    this.challengeTimer = null;
    this.revealTimer = null;
    this.turnTimer = null;
    this.turnDeadline = null;
    this.lastActivityAt = Date.now();
    // Every broadcast marks the room as active for the stale-room sweeper
    this.broadcast = (state) => {
      this.lastActivityAt = Date.now();
      broadcast(state);
    };
    this.onGameEnd = onGameEnd;
    this.onChallengeResolved = onChallengeResolved || (() => {});
    // Challenge mode
    this.challengeMode = challengeMode;
    this.challengeDuration = (CHALLENGE_DURATION_OPTIONS as readonly number[]).includes(challengeDuration) ? challengeDuration : 5;
    this.skipVotes = new Set();
    this.challengeStartedAt = null;
  }

  addPlayer(name: string, socketId: string, isHost: boolean = false): Player {
    const id = nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, difficulty: BotDifficulty = "medium"): Player {
    const id = `bot_${nanoid(6)}`;
    const player = new Player(id, name, true, false);
    this.players.push(player);
    this.botAIs.set(id, new BotAI(id, difficulty, this.deckCount));
    this.lastActivityAt = Date.now();
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
    this.lastActivityAt = Date.now();
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
    this.startTurnTimer();

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

    this.clearTurnTimer();
    currentPlayer.consecutiveTimeouts = 0;

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
    this.skipVotes = new Set();
    this.challengeStartedAt = Date.now();

    const challengeMs = this.challengeDuration * 1000;
    this.challengeDeadline = Date.now() + challengeMs;

    const state = this.toState();
    this.broadcast(state);

    // Start challenge timer (always runs as a hard deadline)
    this.clearChallengeTimer();
    this.challengeTimer = setTimeout(() => {
      this.onChallengeWindowEnd();
    }, challengeMs);

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

    challenger.consecutiveTimeouts = 0;
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
    this.skipVotes = new Set();
    this.challengeStartedAt = null;

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
    this.startTurnTimer();
  }

  /**
   * Called when the challenge window timer expires.
   * Advances the turn to the next player.
   */
  private onChallengeWindowEnd(): void {
    if (this.destroyed || this.phase !== "waiting_for_challenge") return;

    this.challengeDeadline = null;
    this.challengeTimer = null;
    this.skipVotes = new Set();
    this.challengeStartedAt = null;

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
    this.startTurnTimer();
  }

  /**
   * Called when a player chooses to NOT challenge and lets the turn advance.
   * Any non-lastPlayer can call this during the challenge window.
   * Also called during playing phase to skip your turn to play.
   */
  /**
   * Vote to skip the challenge window (vote mode).
   * Returns success if the vote was counted.
   */
  voteSkipChallenge(playerId: string): { success: boolean; error?: string; votesNow?: number; votesNeeded?: number } {
    if (this.destroyed) {
      return { success: false, error: "Game destroyed" };
    }

    if (this.phase !== "waiting_for_challenge") {
      return { success: false, error: "No challenge window active" };
    }

    if (this.challengeMode !== "vote") {
      return { success: false, error: "Voting is not enabled for this room" };
    }

    if (playerId === this.lastPlayerId) {
      return { success: false, error: "The player who just played cannot vote" };
    }

    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }

    // Check minimum time has passed
    if (this.challengeStartedAt && (Date.now() - this.challengeStartedAt) < MIN_CHALLENGE_TIME_BEFORE_VOTE_MS) {
      return { success: false, error: "Please wait before voting — others need time to decide" };
    }

    // Already voted
    if (this.skipVotes.has(playerId)) {
      return { success: false, error: "You already voted to skip" };
    }

    this.skipVotes.add(playerId);

    // Calculate votes needed: strict majority (> 50%) of eligible voters (all players minus lastPlayer)
    const eligibleVoters = this.players.filter((p) => p.id !== this.lastPlayerId).length;
    const votesNeeded = Math.floor(eligibleVoters / 2) + 1;
    const currentVotes = this.skipVotes.size;

    // Broadcast updated vote state
    const state = this.toState();
    this.broadcast(state);

    // Check if majority reached
    if (currentVotes >= votesNeeded) {
      this.onChallengeWindowEnd();
    }

    return { success: true, votesNow: currentVotes, votesNeeded };
  }

  passTurn(playerId: string, isAuto: boolean = false): { success: true } | { success: false; error: string } {
    if (this.phase === "waiting_for_challenge") {
      if (playerId === this.lastPlayerId) {
        return { success: false, error: "You can't pass on your own claim" };
      }

      // In timer mode: can't skip early, must wait for the full duration
      if (this.challengeMode === "timer") {
        return { success: false, error: "Cannot skip — wait for the timer to expire or call Liar" };
      }

      // In vote mode: use voting system instead of instant skip
      if (this.challengeMode === "vote") {
        const result = this.voteSkipChallenge(playerId);
        if (!result.success) {
          return { success: false, error: result.error || "Vote failed" };
        }
        return { success: true };
      }

      return { success: false, error: "Cannot pass at this time" };
    }

    if (this.phase === "playing") {
      // Skip your turn to play
      const currentPlayer = this.players[this.currentTurn];
      if (!currentPlayer || currentPlayer.id !== playerId) {
        return { success: false, error: "Not your turn" };
      }

      this.clearTurnTimer();
      if (!isAuto) {
        currentPlayer.consecutiveTimeouts = 0;
      }

      this.skipCount++;

      if (this.skipCount >= this.players.length - 1) {
        // All players skipped — advance to next player and reset claim (pile stays)
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
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
        this.startTurnTimer();
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
    this.startTurnTimer();
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
    } else if (this.challengeMode === "vote") {
      // If bot decides not to call liar, and we are in vote mode, the bot should vote to skip.
      // We must wait until the 3-second MIN_CHALLENGE_TIME_BEFORE_VOTE_MS has passed.
      const elapsedSinceStart = Date.now() - (this.challengeStartedAt || Date.now());
      const waitTimeRemaining = Math.max(0, MIN_CHALLENGE_TIME_BEFORE_VOTE_MS - elapsedSinceStart);
      
      // Add a slight random delay (500-1500ms) after the lock expires so bots don't vote instantly
      const botVoteDelay = waitTimeRemaining + 500 + Math.random() * 1000;

      const timer = setTimeout(() => {
        if (!this.destroyed && this.phase === "waiting_for_challenge") {
          this.voteSkipChallenge(botId);
        }
      }, botVoteDelay);
      this.botTimers.set(`${botId}_vote`, timer);
    }
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
    const eligibleVoters = this.players.filter((p) => p.id !== this.lastPlayerId).length;
    const votesNeeded = Math.floor(eligibleVoters / 2) + 1;

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
      theme: this.theme,
      // Challenge mode
      challengeMode: this.challengeMode,
      challengeDuration: this.challengeDuration,
      skipVotes: [...this.skipVotes],
      skipVotesNeeded: votesNeeded,
      challengeStartedAt: this.challengeStartedAt,
      turnDeadline: this.turnDeadline,
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
    this.clearTurnTimer();
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    
    if (this.phase !== "playing") return;

    const currentPlayer = this.currentPlayer;
    if (!currentPlayer || currentPlayer.isBot) return;

    this.turnDeadline = Date.now() + 35000;
    
    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(currentPlayer.id);
    }, 35000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnDeadline = null;
  }

  private handleTurnTimeout(playerId: string): void {
    this.clearTurnTimer();

    const player = this.getPlayer(playerId);
    if (!player) return;

    player.consecutiveTimeouts = (player.consecutiveTimeouts || 0) + 1;

    console.log(`Player ${player.name} (${playerId}) timed out. Consecutive timeouts: ${player.consecutiveTimeouts}`);

    if (player.consecutiveTimeouts >= 2) {
      this.kickPlayer(playerId);
    } else {
      this.logAction({
        type: "play",
        playerId: "system",
        playerName: "Game",
        data: { message: `${player.name} missed their turn (timeout).` },
        timestamp: Date.now(),
      });
      this.passTurn(playerId, true);
    }
  }

  kickPlayer(playerId: string): void {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;

    const player = this.players[idx];
    console.log(`Kicking player ${player.name} (${playerId}) from room ${this.roomId}`);

    this.logAction({
      type: "play",
      playerId: "system",
      playerName: "Game",
      data: { message: `${player.name} was kicked for inactivity.` },
      timestamp: Date.now(),
    });

    this.players.splice(idx, 1);

    if (this.players.length === 0) {
      this.phase = "game_over";
      this.endGame("system");
      return;
    }

    if (idx < this.currentTurn) {
      this.currentTurn--;
    } else if (idx === this.currentTurn) {
      this.currentTurn = this.currentTurn % this.players.length;
      this.phase = "playing";
      this.lastDeclaration = null;
      this.lastPlayerId = null;
      this.currentRequiredClaim = null;
      this.skipCount = 0;
    }

    const realPlayers = this.players.filter((p) => !p.isBot);
    if (realPlayers.length === 0 || this.players.length < 2) {
      const winner = this.players[0];
      if (winner) {
        this.endGame(winner.id);
      } else {
        this.phase = "game_over";
        this.broadcast(this.toState());
      }
      return;
    }

    const state = this.toState();
    this.broadcast(state);
    
    this.onChallengeResolved(this.roomId);

    this.triggerBotIfNeeded();
    this.startTurnTimer();
  }
}
