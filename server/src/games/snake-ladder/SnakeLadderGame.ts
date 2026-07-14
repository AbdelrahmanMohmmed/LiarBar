import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

// Board: 10x10, cells numbered 1-100
// Snakes go down, ladders go up

interface SnlEntry {
  from: number;
  to: number;
  type: "snake" | "ladder";
}

const SNAKES_LADDERS: SnlEntry[] = [
  // Ladders (go up)
  { from: 2, to: 38, type: "ladder" },
  { from: 7, to: 14, type: "ladder" },
  { from: 8, to: 31, type: "ladder" },
  { from: 15, to: 26, type: "ladder" },
  { from: 21, to: 42, type: "ladder" },
  { from: 28, to: 84, type: "ladder" },
  { from: 36, to: 44, type: "ladder" },
  { from: 51, to: 67, type: "ladder" },
  { from: 71, to: 91, type: "ladder" },
  { from: 78, to: 98, type: "ladder" },
  { from: 87, to: 94, type: "ladder" },
  // Snakes (go down)
  { from: 16, to: 6, type: "snake" },
  { from: 46, to: 25, type: "snake" },
  { from: 49, to: 11, type: "snake" },
  { from: 62, to: 19, type: "snake" },
  { from: 64, to: 60, type: "snake" },
  { from: 74, to: 53, type: "snake" },
  { from: 89, to: 28, type: "snake" },
  { from: 92, to: 51, type: "snake" },
  { from: 95, to: 75, type: "snake" },
  { from: 99, to: 80, type: "snake" },
];

type Phase = "lobby" | "countdown" | "playing" | "finished";

export class SnakeLadderGame implements GameRoom {
  readonly gameId = "snake-ladder";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: Phase = "lobby";
  positions: Map<string, number> = new Map();
  dice = 0;
  lastAction = "";
  countdownLeft = 3;
  winnerId: string | null = null;
  turnIndex = 0;
  turnDeadline: number | null = null;
  moveLock = false;

  private callbacks: GameRoomCallbacks;
  private countdownTimer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(6, maxPlayers || 4));
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
    return this.players.length >= 2;
  }

  startGame(): unknown | null {
    this.phase = "countdown";
    this.countdownLeft = 3;
    this.winnerId = null;
    this.turnIndex = 0;
    this.positions.clear();
    this.lastAction = "";

    for (const p of this.players) {
      this.positions.set(p.id, 0);
    }

    this.lastActivityAt = Date.now();
    this.broadcast();
    this.startCountdown();
    return null;
  }

  private startCountdown() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.countdownLeft--;
      if (this.countdownLeft <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.phase = "playing";
        this.startTurn();
      }
      this.broadcast();
    }, 1000);
    this.countdownTimer.unref?.();
  }

  private startTurn() {
    const currentId = this.getCurrentPlayerId();
    if (!currentId) return;
    this.lastAction = `${this.getPlayerName(currentId)}'s turn`;
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnDeadline = Date.now() + 20000;
    this.turnTimer = setTimeout(() => {
      if (this.phase === "playing" && !this.moveLock) {
        this.lastAction = "Time's up! Turn skipped.";
        this.nextTurn();
      }
    }, 20000);
    this.turnTimer.unref?.();
    this.broadcast();
  }

  private getCurrentPlayerId(): string | null {
    if (this.players.length === 0) return null;
    const idx = this.turnIndex % this.players.length;
    return this.players[idx].id;
  }

  rollDice(playerId: string): { success: boolean; error?: string; dice?: number } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    if (this.moveLock) return { success: false, error: "Wait for current action" };

    const currentId = this.getCurrentPlayerId();
    if (currentId !== playerId) return { success: false, error: "Not your turn" };

    this.moveLock = true;
    const dice = Math.floor(Math.random() * 6) + 1;
    this.dice = dice;

    const pos = this.positions.get(playerId) || 0;
    const newPos = pos + dice;
    const name = this.getPlayerName(playerId);

    if (newPos > 100) {
      this.lastAction = `${name} rolled ${dice} — too far! Bouncing back.`;
      this.broadcast();
      setTimeout(() => {
        this.moveLock = false;
        this.nextTurn();
      }, 1200);
      return { success: true, dice };
    }

    const finalPos = this.processSquare(newPos);
    this.positions.set(playerId, finalPos);

    let eventMsg = "";
    const entry = SNAKES_LADDERS.find((e) => e.from === finalPos);
    if (entry) {
      if (entry.type === "ladder") {
        eventMsg = ` 🪜 Ladder! ${name} climbed from ${entry.from} to ${entry.to}!`;
      } else {
        eventMsg = ` 🐍 Snake! ${name} slid from ${entry.from} to ${entry.to}!`;
      }
    }

    this.lastAction = `${name} rolled ${dice} → moved to ${finalPos}.${eventMsg}`;
    this.lastActivityAt = Date.now();
    this.broadcast();

    if (finalPos === 100) {
      this.phase = "finished";
      this.winnerId = playerId;
      this.lastAction = `🎉 ${name} wins! Reached 100!`;
      if (this.turnTimer) clearTimeout(this.turnTimer);
      this.moveLock = false;
      this.broadcast();
      return { success: true, dice };
    }

    setTimeout(() => {
      this.moveLock = false;
      if (this.phase === "playing") this.nextTurn();
    }, 1500);

    return { success: true, dice };
  }

  private processSquare(pos: number): number {
    const entry = SNAKES_LADDERS.find((e) => e.from === pos);
    if (entry) return entry.to;
    return pos;
  }

  private nextTurn() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnIndex = (this.turnIndex + 1) % this.players.length;
    this.startTurn();
  }

  private getPlayerName(id: string): string {
    return this.players.find((p) => p.id === id)?.name || id;
  }

  toState(): unknown {
    return {
      gameId: this.gameId,
      phase: this.phase,
      boardSize: 100,
      snakesLadders: SNAKES_LADDERS,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        position: this.positions.get(p.id) ?? 0,
        color: this.getPlayerColor(p.id),
      })),
      currentPlayerId: this.getCurrentPlayerId(),
      dice: this.dice,
      lastAction: this.lastAction,
      countdownLeft: this.countdownLeft,
      turnDeadline: this.turnDeadline,
      winnerId: this.winnerId,
    };
  }

  private getPlayerColor(id: string): string {
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899"];
    const idx = this.players.findIndex((p) => p.id === id);
    return colors[idx % colors.length];
  }

  toPlayerState(_playerId: string): unknown {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }
}
