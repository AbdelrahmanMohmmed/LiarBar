import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import type { Dominoe, Card } from "../liars-bar/Deck.js";

export interface DominoPlayerState {
  playerId: string;
  hand: Dominoe[];
  score: number;
}

export interface DominoRoundRecap {
  winnerId: string | null; // null if draw / tie in block
  winnerName: string | null;
  winnerTeam: "A" | "B" | null;
  pointsGained: number;
  method: "domino" | "block" | "draw";
  playerHands: Record<string, Dominoe[]>; // reveal all hands
  scores: Record<string, number>;
  teamScores: { A: number; B: number };
}

export interface DominoState {
  roomId: string;
  gameId: "domino";
  phase: "lobby" | "playing" | "round_recap" | "game_over";
  maxPlayers: number;
  players: any[];
  gameMode: "individual" | "teams";
  targetScore: number;
  turnTimeLimit: number;
  tableTheme: string;
  tileTheme: string;
  board: Dominoe[];
  leftEnd: number | null;
  rightEnd: number | null;
  boneyardCount: number;
  activePlayerId: string | null;
  turnDeadline: number | null;
  roundNumber: number;
  winnerId: string | null; // Overall game winner
  recap: DominoRoundRecap | null;
  playerScores: Record<string, number>;
  teamScores: { A: number; B: number };
}

export class DominoGame implements GameRoom {
  readonly gameId = "domino";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: "lobby" | "playing" | "round_recap" | "game_over" = "lobby";
  activePlayerId: string | null = null;
  gameMode: "individual" | "teams";
  targetScore: number;
  turnTimeLimit: number; // 0 for unlimited, or 15, 30, 45
  tableTheme: string;
  tileTheme: string;
  turnDeadline: number | null = null;
  roundNumber = 0;
  winnerId: string | null = null;
  recap: DominoRoundRecap | null = null;

  board: Dominoe[] = [];
  leftEnd: number | null = null;
  rightEnd: number | null = null;
  boneyard: Dominoe[] = [];

  private playerScores = new Map<string, number>(); // playerId -> overall score
  private teamScores = { A: 0, B: 0 }; // A: Player 0 & 2, B: Player 1 & 3
  private botDifficulties = new Map<string, string>(); // playerId -> difficulty

  private turnTimer: NodeJS.Timeout | null = null;
  private recapTimer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private callbacks: GameRoomCallbacks;
  private destroyed = false;
  private consecutivePasses = 0; // count of passes since last tile was played

  constructor(
    roomId: string,
    maxPlayers: number,
    gameMode: "individual" | "teams",
    targetScore: number,
    turnTimeLimit: number,
    callbacks: GameRoomCallbacks,
    tableTheme = "green",
    tileTheme = "ivory"
  ) {
    this.roomId = roomId;
    this.gameMode = gameMode;
    this.maxPlayers = gameMode === "teams" ? 4 : Math.max(2, Math.min(4, maxPlayers));
    this.targetScore = targetScore;
    this.turnTimeLimit = turnTimeLimit;
    this.callbacks = callbacks;
    this.tableTheme = tableTheme;
    this.tileTheme = tileTheme;
    this.lastActivityAt = Date.now();
  }

  addPlayer(name: string, socketId: string, isHost = false, playerId?: string): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);

    this.playerScores.set(id, 0);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);

    this.botDifficulties.set(id, difficulty);
    this.playerScores.set(id, 0);
    this.lastActivityAt = Date.now();
    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;

    this.players.splice(idx, 1);
    this.playerScores.delete(botId);
    this.botDifficulties.delete(botId);

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

    if (this.activePlayerId === player.id && this.phase === "playing") {
      // Setup small delay before botting or passing turn to allow quick reconnect
      this.clearTurnTimer();
      this.turnDeadline = Date.now() + 5000;
      this.turnTimer = setTimeout(() => {
        this.handleTurnTimeout();
      }, 5000);
    }

    this.lastActivityAt = Date.now();
    return player;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return null;

    player.isConnected = true;
    player.socketId = socketId;

    if (this.activePlayerId === playerId && this.phase === "playing") {
      // Reset turn timer for reconnected player
      this.startTurn(playerId);
    }

    this.lastActivityAt = Date.now();
    return player;
  }

  canStart(): boolean {
    if (this.gameMode === "teams") {
      return this.players.length === 4;
    }
    return this.players.length >= 2;
  }

  startGame(): boolean {
    if (!this.canStart()) return false;
    this.roundNumber = 0;
    this.winnerId = null;
    this.recap = null;

    // Reset scores
    for (const pid of this.playerScores.keys()) {
      this.playerScores.set(pid, 0);
    }
    this.teamScores = { A: 0, B: 0 };

    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;

    const prevWinnerId = this.recap?.winnerId;

    this.roundNumber++;
    this.phase = "playing";
    this.recap = null;
    this.board = [];
    this.leftEnd = null;
    this.rightEnd = null;
    this.consecutivePasses = 0;

    this.clearRecapTimer();
    this.clearTurnTimer();
    this.clearBotTimer();

    // 1. Create a full 28 dominoes set
    const fullSet: Dominoe[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        fullSet.push({ type: "dominoe", left: i, right: j });
      }
    }

    // 2. Shuffle
    for (let i = fullSet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fullSet[i], fullSet[j]] = [fullSet[j], fullSet[i]];
    }

    // 3. Clear hands
    for (const p of this.players) {
      p.hand = [];
    }

    // 4. Deal 7 tiles to each player
    for (let k = 0; k < 7; k++) {
      for (const p of this.players) {
        const tile = fullSet.pop();
        if (tile) p.hand.push(tile);
      }
    }

    // 5. Remaining tiles are in the boneyard
    this.boneyard = fullSet;

    // 6. Find who goes first (highest double)
    let startingPlayerId: string | null = null;

    if (this.roundNumber === 1) {
      // In first round, player with highest double starts
      let highestDouble = -1;
      for (const p of this.players) {
        const hand = p.hand as Dominoe[];
        for (const tile of hand) {
          if (tile.left === tile.right && tile.left > highestDouble) {
            highestDouble = tile.left;
            startingPlayerId = p.id;
          }
        }
      }

      // If no doubles at all, find highest sum tile
      if (startingPlayerId === null) {
        let highestSum = -1;
        for (const p of this.players) {
          const hand = p.hand as Dominoe[];
          for (const tile of hand) {
            const sum = tile.left + tile.right;
            if (sum > highestSum) {
              highestSum = sum;
              startingPlayerId = p.id;
            }
          }
        }
      }
    } else {
      // In subsequent rounds, the last round winner (if any) starts
      startingPlayerId = prevWinnerId || this.players[0].id;
    }

    if (!startingPlayerId) {
      startingPlayerId = this.players[0].id;
    }

    this.startTurn(startingPlayerId);
    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.callbacks.broadcast(this.toState());
  }

  private startTurn(playerId: string): void {
    if (this.destroyed || this.phase !== "playing") return;

    this.activePlayerId = playerId;
    this.clearTurnTimer();
    this.clearBotTimer();

    if (this.turnTimeLimit > 0) {
      this.turnDeadline = Date.now() + this.turnTimeLimit * 1000;
      this.turnTimer = setTimeout(() => {
        this.handleTurnTimeout();
      }, this.turnTimeLimit * 1000);
    } else {
      this.turnDeadline = null;
    }

    const activePlayer = this.getPlayer(playerId);
    if (activePlayer?.isBot) {
      this.scheduleBotPlay(playerId);
    }
  }

  private handleTurnTimeout(): void {
    if (this.destroyed || this.phase !== "playing" || !this.activePlayerId) return;

    // Timeout Auto-Play Logic
    const player = this.getPlayer(this.activePlayerId);
    if (!player) return;

    const playable = this.getPlayableTiles(player.hand as Dominoe[]);
    if (playable.length > 0) {
      // Play the first playable tile on the first valid end
      const action = playable[0];
      // Properly remove the played tile from player's hand
      const idx = (player.hand as Dominoe[]).findIndex(
        (t) => (t.left === action.tile.left && t.right === action.tile.right) || (t.left === action.tile.right && t.right === action.tile.left)
      );
      if (idx !== -1) player.hand.splice(idx, 1);
      
      this.executePlayTile(this.activePlayerId, action.tile, action.end);
    } else {
      // No playable tiles. Try drawing until playable, or pass
      if (this.boneyard.length > 0) {
        let drawnPlayable = false;
        while (this.boneyard.length > 0 && !drawnPlayable) {
          const tile = this.boneyard.pop()!;
          const fits = this.canPlayTileOnBoard(tile);
          if (fits) {
            // Play immediately without putting in hand
            this.executePlayTile(this.activePlayerId, tile, fits);
            drawnPlayable = true;
          } else {
            // Doesn't fit, put in hand
            player.hand.push(tile);
          }
        }

        if (!drawnPlayable) {
          // Drew everything and still cannot play, so pass
          this.executePass(this.activePlayerId);
        }
      } else {
        // No boneyard, must pass
        this.executePass(this.activePlayerId);
      }
    }
  }

  private getPlayableTiles(hand: Dominoe[]): Array<{ tile: Dominoe; end: "left" | "right" }> {
    const list: Array<{ tile: Dominoe; end: "left" | "right" }> = [];
    if (this.board.length === 0) {
      // Any tile is playable on either end
      for (const tile of hand) {
        list.push({ tile, end: "left" });
      }
      return list;
    }

    for (const tile of hand) {
      if (tile.left === this.leftEnd || tile.right === this.leftEnd) {
        list.push({ tile, end: "left" });
      }
      if (tile.left === this.rightEnd || tile.right === this.rightEnd) {
        list.push({ tile, end: "right" });
      }
    }
    return list;
  }

  private canPlayTileOnBoard(tile: Dominoe): "left" | "right" | null {
    if (this.board.length === 0) return "left";
    if (tile.left === this.leftEnd || tile.right === this.leftEnd) return "left";
    if (tile.left === this.rightEnd || tile.right === this.rightEnd) return "right";
    return null;
  }

  playTile(playerId: string, tile: { left: number; right: number }, end: "left" | "right"): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game is not playing" };
    if (this.activePlayerId !== playerId) return { success: false, error: "Not your turn" };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: "Player not found" };

    // Find tile in hand
    const idx = (player.hand as Dominoe[]).findIndex(
      (t) => (t.left === tile.left && t.right === tile.right) || (t.left === tile.right && t.right === tile.left)
    );

    if (idx === -1) return { success: false, error: "Tile not in hand" };
    const handTile = player.hand[idx] as Dominoe;

    // Validate play
    if (this.board.length > 0) {
      if (end === "left") {
        if (handTile.left !== this.leftEnd && handTile.right !== this.leftEnd) {
          return { success: false, error: "Tile does not match the left end" };
        }
      } else {
        if (handTile.left !== this.rightEnd && handTile.right !== this.rightEnd) {
          return { success: false, error: "Tile does not match the right end" };
        }
      }
    }

    // Perform play
    player.hand.splice(idx, 1);
    this.executePlayTile(playerId, handTile, end);
    return { success: true };
  }

  private executePlayTile(playerId: string, tile: Dominoe, end: "left" | "right"): void {
    this.clearTurnTimer();
    this.clearBotTimer();
    this.consecutivePasses = 0;

    if (this.board.length === 0) {
      this.board.push(tile);
      this.leftEnd = tile.left;
      this.rightEnd = tile.right;
    } else if (end === "left") {
      if (tile.right === this.leftEnd) {
        // [left, right] -> matches leftEnd, prepended as is
        this.board.unshift(tile);
        this.leftEnd = tile.left;
      } else {
        // [left, right] -> left matches leftEnd, needs flip
        const flipped = { type: "dominoe" as const, left: tile.right, right: tile.left };
        this.board.unshift(flipped);
        this.leftEnd = tile.right;
      }
    } else {
      if (tile.left === this.rightEnd) {
        // [left, right] -> left matches rightEnd, appended as is
        this.board.push(tile);
        this.rightEnd = tile.right;
      } else {
        // [left, right] -> right matches rightEnd, needs flip
        const flipped = { type: "dominoe" as const, left: tile.right, right: tile.left };
        this.board.push(flipped);
        this.rightEnd = tile.left;
      }
    }

    // Check round win (hand empty)
    const player = this.getPlayer(playerId)!;
    if (player.hand.length === 0) {
      this.endRound(playerId, "domino");
      return;
    }

    this.callbacks.onHandsChanged(this.roomId);
    this.nextTurn();
  }

  drawTile(playerId: string): { success: boolean; error?: string; tile?: Dominoe } {
    if (this.phase !== "playing") return { success: false, error: "Game is not playing" };
    if (this.activePlayerId !== playerId) return { success: false, error: "Not your turn" };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: "Player not found" };

    // Verify player has no playable tiles
    const playable = this.getPlayableTiles(player.hand as Dominoe[]);
    if (playable.length > 0) {
      return { success: false, error: "You have playable tiles in your hand" };
    }

    if (this.boneyard.length === 0) {
      return { success: false, error: "Boneyard is empty" };
    }

    const tile = this.boneyard.pop()!;
    player.hand.push(tile);

    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.callbacks.broadcast(this.toState());

    // Bot immediate replay if bot draws
    if (player.isBot) {
      this.scheduleBotPlay(playerId);
    }

    return { success: true, tile };
  }

  passTurn(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game is not playing" };
    if (this.activePlayerId !== playerId) return { success: false, error: "Not your turn" };

    const player = this.getPlayer(playerId);
    if (!player) return { success: false, error: "Player not found" };

    // Verify no playable tiles
    const playable = this.getPlayableTiles(player.hand as Dominoe[]);
    if (playable.length > 0) {
      return { success: false, error: "You cannot pass because you have playable tiles" };
    }

    // Verify boneyard is empty
    if (this.boneyard.length > 0) {
      return { success: false, error: "You cannot pass while there are tiles in the boneyard" };
    }

    this.executePass(playerId);
    return { success: true };
  }

  private executePass(playerId: string): void {
    this.clearTurnTimer();
    this.clearBotTimer();
    this.consecutivePasses++;

    if (this.consecutivePasses >= this.players.length) {
      // All players have passed, game is blocked!
      this.endRound(null, "block");
      return;
    }

    this.nextTurn();
  }

  private nextTurn(): void {
    if (this.destroyed || this.phase !== "playing") return;

    const currentIdx = this.players.findIndex((p) => p.id === this.activePlayerId);
    let nextIdx = currentIdx === -1 ? 0 : currentIdx;
    let nextPlayer = null;

    // Clockwise turn order search
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
      this.lastActivityAt = Date.now();
      this.callbacks.broadcast(this.toState());
    } else {
      this.activePlayerId = null;
      this.turnDeadline = null;
      this.clearTurnTimer();
      this.callbacks.broadcast(this.toState());
    }
  }

  private endRound(winnerId: string | null, method: "domino" | "block"): void {
    this.clearTurnTimer();
    this.clearBotTimer();

    this.phase = "round_recap";
    this.activePlayerId = null;
    this.turnDeadline = null;

    let points = 0;
    let actualWinnerId = winnerId;
    let winnerTeam: "A" | "B" | null = null;

    // Get sum of spots in hands
    const spotSums: Record<string, number> = {};
    for (const p of this.players) {
      let sum = 0;
      for (const tile of (p.hand as Dominoe[])) {
        sum += tile.left + tile.right;
      }
      spotSums[p.id] = sum;
    }

    if (method === "domino" && winnerId) {
      const winner = this.getPlayer(winnerId)!;
      if (this.gameMode === "individual") {
        // Winner gets sum of everyone else's hands
        for (const p of this.players) {
          if (p.id !== winnerId) {
            points += spotSums[p.id];
          }
        }
        const newScore = (this.playerScores.get(winnerId) || 0) + points;
        this.playerScores.set(winnerId, newScore);
      } else {
        // Teams Mode
        const winnerIndex = this.players.findIndex((p) => p.id === winnerId);
        winnerTeam = winnerIndex % 2 === 0 ? "A" : "B";

        // Winner gets sum of opposing team's hands
        for (let i = 0; i < this.players.length; i++) {
          if (i % 2 !== winnerIndex % 2) {
            points += spotSums[this.players[i].id];
          }
        }

        if (winnerTeam === "A") {
          this.teamScores.A += points;
        } else {
          this.teamScores.B += points;
        }
      }
    } else if (method === "block") {
      if (this.gameMode === "individual") {
        // Player with lowest spot sum wins
        let minSpots = Infinity;
        let blockWinner: string | null = null;
        let isTie = false;

        for (const p of this.players) {
          const sum = spotSums[p.id];
          if (sum < minSpots) {
            minSpots = sum;
            blockWinner = p.id;
            isTie = false;
          } else if (sum === minSpots) {
            isTie = true;
          }
        }

        if (!isTie && blockWinner) {
          actualWinnerId = blockWinner;
          // Score matches sum of everyone else's spots
          for (const p of this.players) {
            if (p.id !== blockWinner) {
              points += spotSums[p.id];
            }
          }
          const newScore = (this.playerScores.get(blockWinner) || 0) + points;
          this.playerScores.set(blockWinner, newScore);
        } else {
          // Tie block, draw round
          actualWinnerId = null;
          points = 0;
        }
      } else {
        // Teams Mode block
        const spotsA = spotSums[this.players[0].id] + spotSums[this.players[2].id];
        const spotsB = spotSums[this.players[1].id] + spotSums[this.players[3].id];

        if (spotsA < spotsB) {
          winnerTeam = "A";
          points = spotsB; // Score is opposite team's spots sum
          this.teamScores.A += points;
          actualWinnerId = spotSums[this.players[0].id] <= spotSums[this.players[2].id] ? this.players[0].id : this.players[2].id;
        } else if (spotsB < spotsA) {
          winnerTeam = "B";
          points = spotsA;
          this.teamScores.B += points;
          actualWinnerId = spotSums[this.players[1].id] <= spotSums[this.players[3].id] ? this.players[1].id : this.players[3].id;
        } else {
          // Tie
          winnerTeam = null;
          actualWinnerId = null;
          points = 0;
        }
      }
    }

    // Reveal hands map
    const playerHands: Record<string, Dominoe[]> = {};
    for (const p of this.players) {
      playerHands[p.id] = p.hand as Dominoe[];
    }

    const scoresObj: Record<string, number> = {};
    for (const [pid, score] of this.playerScores) {
      scoresObj[pid] = score;
    }

    const winnerName = actualWinnerId ? this.getPlayer(actualWinnerId)?.name || null : null;

    this.recap = {
      winnerId: actualWinnerId,
      winnerName,
      winnerTeam,
      pointsGained: points,
      method,
      playerHands,
      scores: scoresObj,
      teamScores: { ...this.teamScores },
    };

    // Check game over
    let isGameOver = false;
    let gameWinnerId: string | null = null;

    if (this.gameMode === "individual") {
      for (const [pid, score] of this.playerScores) {
        if (score >= this.targetScore) {
          isGameOver = true;
          gameWinnerId = pid;
          break;
        }
      }
    } else {
      if (this.teamScores.A >= this.targetScore) {
        isGameOver = true;
        gameWinnerId = this.players[0].id;
      } else if (this.teamScores.B >= this.targetScore) {
        isGameOver = true;
        gameWinnerId = this.players[1].id;
      }
    }

    if (isGameOver && gameWinnerId) {
      this.phase = "game_over";
      this.winnerId = gameWinnerId;
      this.lastActivityAt = Date.now();
      this.callbacks.broadcast(this.toState());
      this.callbacks.onGameEnd(this.roomId, gameWinnerId);
    } else {
      this.lastActivityAt = Date.now();
      this.callbacks.broadcast(this.toState());

      // Auto start next round in 7 seconds
      this.recapTimer = setTimeout(() => {
        this.startRound();
      }, 7000);
    }
  }

  private scheduleBotPlay(botId: string): void {
    this.clearBotTimer();
    const delay = Math.floor(Math.random() * 1500) + 1500; // 1.5 - 3 seconds delay
    this.botTimer = setTimeout(() => {
      this.executeBotPlay(botId);
    }, delay);
  }

  private executeBotPlay(botId: string): void {
    if (this.destroyed || this.phase !== "playing" || this.activePlayerId !== botId) return;

    const bot = this.getPlayer(botId);
    if (!bot) return;

    const playable = this.getPlayableTiles(bot.hand as Dominoe[]);
    if (playable.length > 0) {
      // Select tile based on difficulty
      const diff = this.botDifficulties.get(botId) || "medium";
      let chosenPlay = playable[0];

      if (diff === "easy") {
        chosenPlay = playable[Math.floor(Math.random() * playable.length)];
      } else if (diff === "medium") {
        let maxSpots = -1;
        for (const play of playable) {
          const spots = play.tile.left + play.tile.right;
          if (spots > maxSpots) {
            maxSpots = spots;
            chosenPlay = play;
          }
        }
      } else {
        let bestScore = -1;
        for (const play of playable) {
          let score = play.tile.left + play.tile.right;
          if (play.tile.left === play.tile.right) {
            score += 100;
          }
          if (score > bestScore) {
            bestScore = score;
            chosenPlay = play;
          }
        }
      }

      this.playTile(botId, chosenPlay.tile, chosenPlay.end);
    } else {
      // Draw or pass
      if (this.boneyard.length > 0) {
        this.drawTile(botId);
      } else {
        this.passTurn(botId);
      }
    }
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

  toState(): DominoState {
    const scoresObj: Record<string, number> = {};
    for (const [pid, score] of this.playerScores) {
      scoresObj[pid] = score;
    }

    return {
      roomId: this.roomId,
      gameId: "domino",
      phase: this.phase,
      maxPlayers: this.maxPlayers,
      players: this.players.map((p) => {
        const pub = p.toPublicData();
        return {
          ...pub,
          score: this.playerScores.get(p.id) || 0,
        };
      }),
      gameMode: this.gameMode,
      targetScore: this.targetScore,
      turnTimeLimit: this.turnTimeLimit,
      tableTheme: this.tableTheme,
      tileTheme: this.tileTheme,
      board: this.board,
      leftEnd: this.leftEnd,
      rightEnd: this.rightEnd,
      boneyardCount: this.boneyard.length,
      activePlayerId: this.activePlayerId,
      turnDeadline: this.turnDeadline,
      roundNumber: this.roundNumber,
      winnerId: this.winnerId,
      recap: this.recap,
      playerScores: scoresObj,
      teamScores: { ...this.teamScores },
    };
  }

  toPlayerState(playerId: string): DominoState & { hand: Dominoe[] } {
    const base = this.toState();
    const player = this.getPlayer(playerId);
    return {
      ...base,
      hand: player ? (player.hand as Dominoe[]) : [],
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
