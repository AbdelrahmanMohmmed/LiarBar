import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

type Sym = "X" | "O";
type Cell = Sym | "";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export class TicTacToeGame implements GameRoom {
  readonly gameId = "tictactoe";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: "playing" | "finished" = "playing";
  board: Cell[] = Array(9).fill("");
  turn: Sym = "X";
  winner: Sym | "tie" | null = null;
  winningLine: number[] | null = null;
  scores: { X: number; O: number; ties: number } = { X: 0, O: 0, ties: 0 };

  private callbacks: GameRoomCallbacks;
  private symbolOf = new Map<string, Sym>();
  private botTimer: NodeJS.Timeout | null = null;

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(10, maxPlayers || 2));
    this.callbacks = callbacks;
  }

  private symbolFor(playerId: string): Sym | null {
    return this.symbolOf.get(playerId) ?? null;
  }

  addPlayer(name: string, socketId: string, isHost = false, playerId?: string): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);
    this.assignSymbol(id);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, _difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);
    this.assignSymbol(id);
    this.lastActivityAt = Date.now();
    return player;
  }

  private assignSymbol(id: string) {
    if (this.symbolOf.has(id)) return;
    const xs = [...this.symbolOf.values()].filter((s) => s === "X").length;
    const os = [...this.symbolOf.values()].filter((s) => s === "O").length;
    if (xs === 0) this.symbolOf.set(id, "X");
    else if (os === 0) this.symbolOf.set(id, "O");
    // extra players/bots beyond 2 simply spectate (no symbol)
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    const [removed] = this.players.splice(idx, 1);
    if (removed) this.symbolOf.delete(removed.id);
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
    return this.players.some((p) => this.symbolFor(p.id) === "X") &&
      this.players.some((p) => this.symbolFor(p.id) === "O");
  }

  startGame(): unknown | null {
    this.resetBoard();
    this.turn = "X";
    this.phase = "playing";
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.maybeBotMove();
    return null;
  }

  private resetBoard() {
    this.board = Array(9).fill("");
    this.winner = null;
    this.winningLine = null;
  }

  /** Public API: a player places a mark. */
  move(playerId: string, index: number): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    const sym = this.symbolFor(playerId);
    if (!sym) return { success: false, error: "You are not playing" };
    if (sym !== this.turn) return { success: false, error: "Not your turn" };
    if (!Number.isInteger(index) || index < 0 || index > 8) {
      return { success: false, error: "Invalid cell" };
    }
    if (this.board[index] !== "") return { success: false, error: "Cell taken" };

    this.board[index] = sym;
    this.lastActivityAt = Date.now();

    const res = this.checkWinner();
    if (res.winner) {
      this.winner = res.winner;
      this.winningLine = res.line;
      this.phase = "finished";
      if (res.winner === "tie") this.scores.ties += 1;
      else this.scores[res.winner] += 1;
    } else {
      this.turn = sym === "X" ? "O" : "X";
      this.maybeBotMove();
    }
    this.broadcast();
    return { success: true };
  }

  private checkWinner(): { winner: Sym | "tie" | null; line: number[] | null } {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return { winner: this.board[a] as Sym, line };
      }
    }
    if (this.board.every((c) => c !== "")) return { winner: "tie", line: null };
    return { winner: null, line: null };
  }

  private maybeBotMove() {
    if (this.botTimer) { clearTimeout(this.botTimer); this.botTimer = null; }
    const sym = this.turn;
    const bot = this.players.find((p) => p.isBot && this.symbolFor(p.id) === sym);
    if (!bot) return;
    this.botTimer = setTimeout(() => {
      if (this.phase !== "playing" || this.turn !== sym) return;
      const idx = this.botChooseCell(sym);
      if (idx >= 0) this.move(bot.id, idx);
    }, 600);
    this.botTimer.unref?.();
  }

  private botChooseCell(sym: Sym): number {
    const opp: Sym = sym === "X" ? "O" : "X";
    const free = this.board.map((c, i) => (c === "" ? i : -1)).filter((i) => i >= 0);
    // win
    for (const i of free) {
      const b = [...this.board]; b[i] = sym;
      if (this.wouldWin(b, sym)) return i;
    }
    // block
    for (const i of free) {
      const b = [...this.board]; b[i] = opp;
      if (this.wouldWin(b, opp)) return i;
    }
    if (this.board[4] === "") return 4;
    const corners = [0, 2, 6, 8].filter((i) => this.board[i] === "");
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return free[Math.floor(Math.random() * free.length)];
  }

  private wouldWin(b: Cell[], sym: Sym): boolean {
    return LINES.some(([a, c, d]) => b[a] === sym && b[c] === sym && b[d] === sym);
  }

  toState(): unknown {
    return {
      gameId: this.gameId,
      phase: this.phase,
      board: this.board,
      turn: this.turn,
      winner: this.winner,
      winningLine: this.winningLine,
      scores: this.scores,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        symbol: this.symbolFor(p.id),
      })),
    };
  }

  toPlayerState(playerId: string): unknown {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    if (this.botTimer) { clearTimeout(this.botTimer); this.botTimer = null; }
  }
}
