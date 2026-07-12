import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

export interface HigherLowerPlayerState {
  playerId: string;
  score: number;
  streak: number;
  lowerBound: number | null;
  upperBound: number | null;
  lastGuess: number | null;
  lastGuessResult: "higher" | "lower" | "correct" | null;
  secretNumber: number;
}

export interface HigherLowerRoundRecap {
  winnerId: string;
  winnerName: string;
  winnerScore: number;
  winnerStreak: number;
  pointsGained: number;
  secretNumbers: Record<string, number>;
}

export interface HigherLowerState {
  roomId: string;
  gameId: "higher-lower";
  phase: "lobby" | "playing" | "round_recap" | "game_over";
  maxPlayers: number;
  players: any[];
  playerStates: Record<string, Omit<HigherLowerPlayerState, "secretNumber">>;
  activePlayerId: string | null;
  turnTimeLimit: number;
  turnDeadline: number | null;
  roundNumber: number;
  winnerId: string | null;
  recap: HigherLowerRoundRecap | null;
}

export class HigherLowerGame implements GameRoom {
  readonly gameId = "higher-lower";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: "lobby" | "playing" | "round_recap" | "game_over" = "lobby";
  activePlayerId: string | null = null;
  turnTimeLimit = 15; // 15 seconds per turn
  turnDeadline: number | null = null;
  roundNumber = 0;
  winnerId: string | null = null;
  recap: HigherLowerRoundRecap | null = null;

  // Game-specific player states map (stores scores, streaks, secret numbers, bounds)
  private playerStates = new Map<string, HigherLowerPlayerState>();
  private botDifficulties = new Map<string, string>(); // playerId -> difficulty ("easy" | "medium" | "hard")

  private turnTimer: NodeJS.Timeout | null = null;
  private recapTimer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private callbacks: GameRoomCallbacks;
  private destroyed = false;

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(6, maxPlayers));
    this.callbacks = callbacks;
    this.lastActivityAt = Date.now();
  }

  addPlayer(name: string, socketId: string, isHost = false, playerId?: string): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);

    // Initialize game-specific player state
    this.playerStates.set(id, {
      playerId: id,
      score: 0,
      streak: 0,
      lowerBound: null,
      upperBound: null,
      lastGuess: null,
      lastGuessResult: null,
      secretNumber: 0,
    });

    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);

    this.botDifficulties.set(id, difficulty);
    this.playerStates.set(id, {
      playerId: id,
      score: 0,
      streak: 0,
      lowerBound: null,
      upperBound: null,
      lastGuess: null,
      lastGuessResult: null,
      secretNumber: 0,
    });

    this.lastActivityAt = Date.now();
    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;

    this.players.splice(idx, 1);
    this.playerStates.delete(botId);
    this.botDifficulties.delete(botId);

    // If it was the bot's turn, transition to next player
    if (this.activePlayerId === botId && this.phase === "playing") {
      this.nextTurn();
    }

    this.lastActivityAt = Date.now();
    return true;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return null;

    player.isConnected = false;
    player.socketId = undefined;

    // If the disconnecting player is the active player, rotate turns
    if (this.activePlayerId === player.id && this.phase === "playing") {
      this.nextTurn();
    }

    this.lastActivityAt = Date.now();
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

  canStart(): boolean {
    // Need at least 2 players (humans or bots) to start
    return this.players.length >= 2;
  }

  startGame(): boolean {
    if (!this.canStart()) return false;
    this.roundNumber = 0;
    this.winnerId = null;
    this.recap = null;

    // Clear scores and streaks
    for (const [_, state] of this.playerStates) {
      state.score = 0;
      state.streak = 0;
    }

    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;

    this.roundNumber++;
    this.phase = "playing";
    this.recap = null;

    // Clear timers
    this.clearRecapTimer();
    this.clearTurnTimer();
    this.clearBotTimer();

    // Assign a unique secret number to each player between 1 and 99 (inclusive)
    for (const [playerId, state] of this.playerStates) {
      state.lowerBound = null;
      state.upperBound = null;
      state.lastGuess = null;
      state.lastGuessResult = null;
      state.secretNumber = Math.floor(Math.random() * 99) + 1;
    }

    // Determine who starts the round (sequential rotation based on round number, or start with host)
    const startingIndex = (this.roundNumber - 1) % this.players.length;
    const starter = this.players[startingIndex];

    if (starter && (starter.isBot || starter.isConnected)) {
      this.startTurn(starter.id);
    } else {
      // Find the first connected player/bot
      const active = this.players.find((p) => p.isBot || p.isConnected);
      if (active) {
        this.startTurn(active.id);
      } else {
        // Pause or fallback
        this.activePlayerId = null;
        this.turnDeadline = null;
      }
    }

    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.callbacks.broadcast(this.toState());
  }

  private startTurn(playerId: string): void {
    if (this.destroyed || this.phase !== "playing") return;

    this.activePlayerId = playerId;
    this.clearTurnTimer();
    this.clearBotTimer();

    this.turnDeadline = Date.now() + this.turnTimeLimit * 1000;
    this.turnTimer = setTimeout(() => {
      this.handleTurnTimeout();
    }, this.turnTimeLimit * 1000);

    const activePlayer = this.getPlayer(playerId);
    if (activePlayer?.isBot) {
      this.scheduleBotGuess(playerId);
    }

    this.lastActivityAt = Date.now();
    this.callbacks.broadcast(this.toState());
  }

  private handleTurnTimeout(): void {
    if (this.destroyed || this.phase !== "playing") return;
    this.nextTurn();
  }

  private nextTurn(): void {
    if (this.destroyed || this.phase !== "playing") return;

    const currentIdx = this.players.findIndex((p) => p.id === this.activePlayerId);
    let nextIdx = currentIdx === -1 ? 0 : currentIdx;
    let nextPlayer = null;

    // Search for next connected player or bot
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (nextIdx + i) % this.players.length;
      const candidate = this.players[idx];
      if (candidate && (candidate.isBot || candidate.isConnected)) {
        nextPlayer = candidate;
        break;
      }
    }

    if (nextPlayer) {
      this.startTurn(nextPlayer.id);
    } else {
      // No active players to take turns
      this.activePlayerId = null;
      this.turnDeadline = null;
      this.clearTurnTimer();
      this.callbacks.broadcast(this.toState());
    }
  }

  submitGuess(playerId: string, guess: number): { success: boolean; error?: string } {
    if (this.phase !== "playing") {
      return { success: false, error: "Game is not in active playing state" };
    }
    if (this.activePlayerId !== playerId) {
      return { success: false, error: "It is not your turn" };
    }
    if (isNaN(guess) || guess < 1 || guess > 99 || !Number.isInteger(guess)) {
      return { success: false, error: "Guess must be an integer between 1 and 99" };
    }

    const state = this.playerStates.get(playerId);
    if (!state) {
      return { success: false, error: "Player state not found" };
    }

    this.clearTurnTimer();
    this.clearBotTimer();

    const secret = state.secretNumber;
    state.lastGuess = guess;

    if (guess === secret) {
      // Correct guess! Player wins the round
      state.lastGuessResult = "correct";
      state.streak += 1;
      const pointsGained = state.streak >= 2 ? 3 : 2;
      state.score += pointsGained;

      // Reset streaks of all other players
      for (const [otherId, otherState] of this.playerStates) {
        if (otherId !== playerId) {
          otherState.streak = 0;
        }
      }

      const player = this.getPlayer(playerId)!;

      // Populate recap secret numbers mapping
      const secretNumbers: Record<string, number> = {};
      for (const [pid, pstate] of this.playerStates) {
        secretNumbers[pid] = pstate.secretNumber;
      }

      this.recap = {
        winnerId: playerId,
        winnerName: player.name,
        winnerScore: state.score,
        winnerStreak: state.streak,
        pointsGained,
        secretNumbers,
      };

      // Check if player won the entire game (10 points)
      if (state.score >= 10) {
        this.phase = "game_over";
        this.winnerId = playerId;
        this.activePlayerId = null;
        this.turnDeadline = null;
        this.lastActivityAt = Date.now();
        this.callbacks.broadcast(this.toState());
        this.callbacks.onGameEnd(this.roomId, playerId);
      } else {
        this.phase = "round_recap";
        this.activePlayerId = null;
        this.turnDeadline = null;
        this.lastActivityAt = Date.now();
        this.callbacks.broadcast(this.toState());

        // Schedule next round in 6 seconds
        this.recapTimer = setTimeout(() => {
          this.startRound();
        }, 6000);
      }
    } else {
      // Incorrect guess
      if (guess < secret) {
        // Secret is higher: update lower bound
        state.lowerBound = Math.max(state.lowerBound ?? 1, guess);
        state.lastGuessResult = "higher";
      } else {
        // Secret is lower: update upper bound
        state.upperBound = Math.min(state.upperBound ?? 99, guess);
        state.lastGuessResult = "lower";
      }

      this.nextTurn();
    }

    return { success: true };
  }

  private scheduleBotGuess(botId: string): void {
    this.clearBotTimer();
    const delay = Math.floor(Math.random() * 1500) + 1500; // 1.5 to 3 seconds delay
    this.botTimer = setTimeout(() => {
      this.executeBotGuess(botId);
    }, delay);
  }

  private executeBotGuess(botId: string): void {
    if (this.destroyed || this.phase !== "playing" || this.activePlayerId !== botId) return;

    const state = this.playerStates.get(botId);
    if (!state) return;

    const l = state.lowerBound ?? 1;
    const u = state.upperBound ?? 99;
    const secret = state.secretNumber;
    const difficulty = this.botDifficulties.get(botId) || "medium";

    let guess = Math.floor((l + u) / 2); // default midpoint

    if (difficulty === "easy") {
      // Easy bot makes wild guesses inside the bounds, occasionally outside
      if (u - l > 2) {
        // 90% chance within bounds, 10% completely random
        if (Math.random() > 0.1) {
          guess = Math.floor(Math.random() * (u - l - 1)) + l + 1;
        } else {
          guess = Math.floor(Math.random() * 99) + 1;
        }
      } else {
        guess = Math.random() > 0.5 ? l : u;
      }
    } else if (difficulty === "medium") {
      // Medium bot selects a random number closer to the midpoint
      if (u - l > 2) {
        const mid = (l + u) / 2;
        const spread = (u - l) / 4; // limit standard deviation
        // Select around mid
        guess = Math.round(mid + (Math.random() - 0.5) * spread * 2);
        guess = Math.max(l + 1, Math.min(u - 1, guess));
      } else {
        guess = Math.random() > 0.5 ? l : u;
      }
    } else {
      // Hard bot does efficient binary search
      if (u - l > 1) {
        guess = Math.floor((l + u) / 2);
        // Avoid repeating the bounds themselves if they were already guessed
        if (guess === l) guess = l + 1;
        if (guess === u) guess = u - 1;
      } else {
        guess = Math.random() > 0.5 ? l : u;
      }
    }

    // Double check constraints
    guess = Math.max(1, Math.min(99, guess));

    this.submitGuess(botId, guess);
  }

  rematch(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player || !player.isHost) {
      return { success: false, error: "Only the host can start a rematch" };
    }
    if (this.phase !== "game_over") {
      return { success: false, error: "Can only rematch when the game is over" };
    }

    this.startGame();
    return { success: true };
  }

  toState(): HigherLowerState {
    const publicPlayerStates: Record<string, Omit<HigherLowerPlayerState, "secretNumber">> = {};

    for (const [playerId, state] of this.playerStates) {
      // Hide the secret number during active play
      const { secretNumber, ...pub } = state;
      // If round_recap or game_over, we reveal it
      if (this.phase === "round_recap" || this.phase === "game_over") {
        publicPlayerStates[playerId] = {
          ...pub,
          // We include it under recap or we can keep it hidden here but send it in recap.
          // Let's add bounds / guess details
        };
      } else {
        publicPlayerStates[playerId] = pub;
      }
    }

    return {
      roomId: this.roomId,
      gameId: "higher-lower",
      phase: this.phase,
      maxPlayers: this.maxPlayers,
      players: this.players.map((p) => p.toPublicData()),
      playerStates: publicPlayerStates,
      activePlayerId: this.activePlayerId,
      turnTimeLimit: this.turnTimeLimit,
      turnDeadline: this.turnDeadline,
      roundNumber: this.roundNumber,
      winnerId: this.winnerId,
      recap: this.recap,
    };
  }

  toPlayerState(playerId: string): HigherLowerState & { mySecretNumber?: number } {
    const base = this.toState();
    const state = this.playerStates.get(playerId);
    return {
      ...base,
      mySecretNumber: state ? state.secretNumber : undefined,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTurnTimer();
    this.clearRecapTimer();
    this.clearBotTimer();
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private clearRecapTimer(): void {
    if (this.recapTimer) {
      clearTimeout(this.recapTimer);
      this.recapTimer = null;
    }
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }
}
