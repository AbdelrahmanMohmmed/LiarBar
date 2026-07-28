import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

const BOARD_W = 10;
const BOARD_H = 20;
const BLANK = ".";

type ShapeName = "S" | "Z" | "I" | "O" | "J" | "L" | "T";

const SHAPES: Record<ShapeName, string[][]> = {
  S: [
    [".....", ".....", "..OO.", ".OO..", "....."],
    [".....", "..O..", "..OO.", "...O.", "....."],
  ],
  Z: [
    [".....", ".....", ".OO..", "..OO.", "....."],
    [".....", "..O..", ".OO..", ".O...", "....."],
  ],
  I: [
    ["..O..", "..O..", "..O..", "..O..", "....."],
    [".....", ".....", "OOOO.", ".....", "....."],
  ],
  O: [[".....", ".....", ".OO..", ".OO..", "....."]],
  J: [
    [".....", ".O...", ".OOO.", ".....", "....."],
    [".....", "..OO.", "..O..", "..O..", "....."],
    [".....", ".....", ".OOO.", "...O.", "....."],
    [".....", "..O..", "..O..", ".OO..", "....."],
  ],
  L: [
    [".....", "...O.", ".OOO.", ".....", "....."],
    [".....", "..O..", "..O..", "..OO.", "....."],
    [".....", ".....", ".OOO.", ".O...", "....."],
    [".....", ".OO..", "..O..", "..O..", "....."],
  ],
  T: [
    [".....", "..O..", ".OOO.", ".....", "....."],
    [".....", "..O..", "..OO.", "..O..", "....."],
    [".....", ".....", ".OOO.", "..O..", "....."],
    [".....", "..O..", ".OO..", "..O..", "....."],
  ],
};

const SHAPE_NAMES: ShapeName[] = ["S", "Z", "I", "O", "J", "L", "T"];

const COLORS = [
  [0, 0, 155],
  [0, 155, 0],
  [155, 0, 0],
  [155, 155, 0],
];

interface Piece {
  shape: ShapeName;
  rotation: number;
  x: number;
  y: number;
  color: number;
}

interface PlayerTetrisState {
  board: (number | typeof BLANK)[][];
  fallingPiece: Piece | null;
  nextPiece: Piece | null;
  score: number;
  level: number;
  lines: number;
  alive: boolean;
  lastFall: number;
}

export class TetrisGame implements GameRoom {
  readonly gameId = "tetris";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: "countdown" | "playing" | "finished" = "countdown";
  countdownLeft = 3;
  winners: string[] = [];

  private playerState = new Map<string, PlayerTetrisState>();
  private callbacks: GameRoomCallbacks;
  private countdownTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private botTimers: NodeJS.Timeout[] = [];

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(1, Math.min(10, maxPlayers || 1));
    this.callbacks = callbacks;
  }

  addPlayer(name: string, socketId: string, isHost = false, playerId?: string): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, _difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);
    this.lastActivityAt = Date.now();
    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.lastActivityAt = Date.now();
    return true;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (player) {
      player.isConnected = false;
      player.socketId = undefined;
      this.lastActivityAt = Date.now();
    }
    return player || null;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isConnected = true;
      player.socketId = socketId;
      this.lastActivityAt = Date.now();
    }
    return player || null;
  }

  canStart(): boolean {
    return this.players.length >= 1;
  }

  startGame(): unknown | null {
    this.phase = "countdown";
    this.countdownLeft = 3;
    this.lastActivityAt = Date.now();
    this.winners = [];
    this.playerState.clear();

    for (const p of this.players) {
      this.playerState.set(p.id, {
        board: this.createBlankBoard(),
        fallingPiece: this.newPiece(),
        nextPiece: this.newPiece(),
        score: 0,
        level: 1,
        lines: 0,
        alive: true,
        lastFall: 0,
      });
    }

    this.broadcast();
    this.startCountdown();
    return null;
  }

  private createBlankBoard(): (number | typeof BLANK)[][] {
    const board: (number | typeof BLANK)[][] = [];
    for (let x = 0; x < BOARD_W; x++) {
      board.push(new Array(BOARD_H).fill(BLANK));
    }
    return board;
  }

  private newPiece(): Piece {
    const shape = SHAPE_NAMES[Math.floor(Math.random() * SHAPE_NAMES.length)];
    return {
      shape,
      rotation: Math.floor(Math.random() * SHAPES[shape].length),
      x: Math.floor(BOARD_W / 2) - 2,
      y: -2,
      color: Math.floor(Math.random() * COLORS.length),
    };
  }

  private startCountdown() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.countdownLeft--;
      if (this.countdownLeft <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.phase = "playing";
        this.startTick();
      }
      this.broadcast();
    }, 1000);
    this.countdownTimer.unref?.();
  }

  private startTick() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = setInterval(() => this.tick(), 50);
    this.tickTimer.unref?.();
  }

  private tick() {
    if (this.phase !== "playing") return;
    const now = Date.now();

    for (const p of this.players) {
      const ps = this.playerState.get(p.id);
      if (!ps || !ps.alive) continue;

      // Bot AI
      if (p.isBot) this.runBotAI(p.id, ps);

      const lv = ps.level;
      const fallInterval = Math.max(50, 800 - (lv - 1) * 70);

      if (now - ps.lastFall >= fallInterval) {
        ps.lastFall = now;
        if (ps.fallingPiece && !this.isValidPos(ps, ps.fallingPiece, 0, 1)) {
          this.placePiece(ps);
          this.clearLines(p.id, ps);
          ps.fallingPiece = ps.nextPiece;
          ps.nextPiece = this.newPiece();

          if (ps.fallingPiece && !this.isValidPos(ps, ps.fallingPiece, 0, 0)) {
            ps.alive = false;
          }
        } else if (ps.fallingPiece) {
          ps.fallingPiece.y++;
        }
      }
    }

    const alivePlayers = this.players.filter((p) => {
      const ps = this.playerState.get(p.id);
      return ps && ps.alive;
    });
    if (alivePlayers.length === 0) {
      this.phase = "finished";
      let maxScore = 0;
      for (const [, ps] of this.playerState) maxScore = Math.max(maxScore, ps.score);
      this.winners = [];
      for (const [id, ps] of this.playerState) {
        if (ps.score === maxScore) this.winners.push(id);
      }
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.broadcast();
  }

  input(playerId: string, action: "left" | "right" | "rotate" | "rotateCCW" | "down" | "drop"): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    const ps = this.playerState.get(playerId);
    if (!ps || !ps.alive) return { success: false, error: "You are eliminated" };
    if (!ps.fallingPiece) return { success: false, error: "No piece falling" };

    this.lastActivityAt = Date.now();
    const piece = ps.fallingPiece;

    switch (action) {
      case "left":
        if (this.isValidPos(ps, piece, -1, 0)) piece.x--;
        break;
      case "right":
        if (this.isValidPos(ps, piece, 1, 0)) piece.x++;
        break;
      case "down":
        if (this.isValidPos(ps, piece, 0, 1)) piece.y++;
        break;
      case "rotate": {
        const oldRot = piece.rotation;
        piece.rotation = (piece.rotation + 1) % SHAPES[piece.shape].length;
        if (!this.isValidPos(ps, piece, 0, 0)) piece.rotation = oldRot;
        break;
      }
      case "rotateCCW": {
        const oldRot = piece.rotation;
        piece.rotation = (piece.rotation - 1 + SHAPES[piece.shape].length) % SHAPES[piece.shape].length;
        if (!this.isValidPos(ps, piece, 0, 0)) piece.rotation = oldRot;
        break;
      }
      case "drop":
        while (this.isValidPos(ps, piece, 0, 1)) piece.y++;
        this.placePiece(ps);
        this.clearLines(playerId, ps);
        ps.fallingPiece = ps.nextPiece;
        ps.nextPiece = this.newPiece();
        if (ps.fallingPiece && !this.isValidPos(ps, ps.fallingPiece, 0, 0)) {
          ps.alive = false;
          this.checkGameEnd();
        }
        break;
    }

    this.broadcast();
    return { success: true };
  }

  private isValidPos(ps: PlayerTetrisState, piece: Piece, adjX: number, adjY: number): boolean {
    const template = SHAPES[piece.shape][piece.rotation];
    for (let tx = 0; tx < 5; tx++) {
      for (let ty = 0; ty < 5; ty++) {
        if (template[ty][tx] === ".") continue;
        const bx = piece.x + tx + adjX;
        const by = piece.y + ty + adjY;
        if (by < 0) continue;
        if (bx < 0 || bx >= BOARD_W || by >= BOARD_H) return false;
        if (ps.board[bx][by] !== BLANK) return false;
      }
    }
    return true;
  }

  private placePiece(ps: PlayerTetrisState) {
    if (!ps.fallingPiece) return;
    const piece = ps.fallingPiece;
    const template = SHAPES[piece.shape][piece.rotation];
    for (let tx = 0; tx < 5; tx++) {
      for (let ty = 0; ty < 5; ty++) {
        if (template[ty][tx] === ".") continue;
        const bx = piece.x + tx;
        const by = piece.y + ty;
        if (bx >= 0 && bx < BOARD_W && by >= 0 && by < BOARD_H) {
          ps.board[bx][by] = piece.color;
        }
      }
    }
  }

  private clearLines(playerId: string, ps: PlayerTetrisState) {
    let linesCleared = 0;
    let y = BOARD_H - 1;
    while (y >= 0) {
      if (ps.board.every((col) => col[y] !== BLANK)) {
        for (let pullY = y; pullY > 0; pullY--) {
          for (let x = 0; x < BOARD_W; x++) {
            ps.board[x][pullY] = ps.board[x][pullY - 1];
          }
        }
        for (let x = 0; x < BOARD_W; x++) {
          ps.board[x][0] = BLANK;
        }
        linesCleared++;
      } else {
        y--;
      }
    }

    if (linesCleared > 0) {
      ps.lines += linesCleared;
      ps.score += linesCleared * 10;
      ps.level = Math.floor(ps.score / 10) + 1;
    }
  }

  private checkGameEnd() {
    const alivePlayers = this.players.filter((p) => {
      const ps = this.playerState.get(p.id);
      return ps && ps.alive;
    });
    if (alivePlayers.length === 0) {
      this.phase = "finished";
      let maxScore = 0;
      for (const [, ps] of this.playerState) maxScore = Math.max(maxScore, ps.score);
      this.winners = [];
      for (const [id, ps] of this.playerState) {
        if (ps.score === maxScore) this.winners.push(id);
      }
      if (this.tickTimer) clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // ===== BOT AI =====
  private runBotAI(botId: string, ps: PlayerTetrisState) {
    if (!ps.fallingPiece || !ps.alive) return;

    // Simple bot: every ~200ms make a decision
    const now = Date.now();
    const piece = ps.fallingPiece;

    // Try to find a good position: scan rotations and x positions
    let bestScore = -Infinity;
    let bestAction: { dx: number; rot: number; drop: boolean } = { dx: 0, rot: 0, drop: false };

    const origRot = piece.rotation;
    const origX = piece.x;

    for (let rot = 0; rot < SHAPES[piece.shape].length; rot++) {
      piece.rotation = rot;
      for (let dx = -5; dx <= 5; dx++) {
        piece.x = origX + dx;
        if (!this.isValidPos(ps, piece, 0, 0)) continue;

        // Find where it would land
        let dropY = 0;
        while (this.isValidPos(ps, piece, 0, dropY + 1)) dropY++;

        // Simulate placement
        const simBoard = ps.board.map((col) => [...col]);
        const template = SHAPES[piece.shape][rot];
        for (let tx = 0; tx < 5; tx++) {
          for (let ty = 0; ty < 5; ty++) {
            if (template[ty][tx] === ".") continue;
            const bx = piece.x + tx;
            const by = piece.y + ty + dropY;
            if (bx >= 0 && bx < BOARD_W && by >= 0 && by < BOARD_H) {
              simBoard[bx][by] = piece.color;
            }
          }
        }

        // Score: count holes, aggregate height, complete lines
        let holes = 0;
        let maxHeight = 0;
        let completeLines = 0;

        for (let x = 0; x < BOARD_W; x++) {
          let foundBlock = false;
          let colHeight = 0;
          for (let y = 0; y < BOARD_H; y++) {
            if (simBoard[x][y] !== BLANK) {
              foundBlock = true;
              colHeight = BOARD_H - y;
            } else if (foundBlock) {
              holes++;
            }
          }
          maxHeight = Math.max(maxHeight, colHeight);
        }
        for (let y = 0; y < BOARD_H; y++) {
          if (simBoard.every((col) => col[y] !== BLANK)) completeLines++;
        }

        const score = completeLines * 40 - holes * 5 - maxHeight * 2;
        if (score > bestScore) {
          bestScore = score;
          bestAction = { dx: dx, rot: rot, drop: true };
        }
      }
    }

    // Restore original position
    piece.rotation = origRot;
    piece.x = origX;

    // Apply best action
    if (bestAction.rot > 0) {
      piece.rotation = (piece.rotation + bestAction.rot) % SHAPES[piece.shape].length;
    }
    if (bestAction.dx !== 0) {
      piece.x = origX + bestAction.dx;
    }

    // Auto-drop
    while (this.isValidPos(ps, piece, 0, 1)) piece.y++;
  }

  toState(): unknown {
    const players: any[] = [];
    for (const p of this.players) {
      const ps = this.playerState.get(p.id);
      players.push({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        score: ps?.score ?? 0,
        level: ps?.level ?? 1,
        alive: ps?.alive ?? true,
      });
    }

    // Send each player's own board (or first human's board as "spectator view")
    const boards: Record<string, any> = {};
    for (const p of this.players) {
      const ps = this.playerState.get(p.id);
      if (ps) {
        boards[p.id] = {
          board: ps.board,
          fallingPiece: ps.fallingPiece,
          nextPiece: ps.nextPiece,
        };
      }
    }

    return {
      gameId: this.gameId,
      phase: this.phase,
      boards,
      boardW: BOARD_W,
      boardH: BOARD_H,
      scores: Object.fromEntries([...this.playerState.entries()].map(([id, ps]) => [id, ps.score])),
      level: Object.fromEntries([...this.playerState.entries()].map(([id, ps]) => [id, ps.level])),
      lines: Object.fromEntries([...this.playerState.entries()].map(([id, ps]) => [id, ps.lines])),
      alive: Object.fromEntries([...this.playerState.entries()].map(([id, ps]) => [id, ps.alive])),
      countdownLeft: this.countdownLeft,
      winners: this.winners,
      players,
    };
  }

  toPlayerState(_playerId: string): unknown {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers = [];
  }
}
