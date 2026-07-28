import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface SnakeState {
  playerId: string;
  name: string;
  color: string;
  body: { x: number; y: number }[];
  dir: Dir;
  alive: boolean;
  score: number;
  isBot: boolean;
}

const COLORS = ["#22d3ee", "#fb7185", "#a3e635", "#fbbf24"];
const COLS = 24;
const ROWS = 24;
const TICK_MS = 110;
const START_LEN = 3;

export class SnakeGame implements GameRoom {
  readonly gameId = "snake";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: "countdown" | "playing" | "finished" = "countdown";
  cols = COLS;
  rows = ROWS;
  duration: number;
  timeLeft = 0;
  countdownLeft = 3;
  food: { x: number; y: number } = { x: 0, y: 0 };
  snakes: SnakeState[] = [];
  winners: string[] = [];

  private callbacks: GameRoomCallbacks;
  private tickTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private startTime = 0;

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks, duration = 60) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(4, maxPlayers || 4));
    this.callbacks = callbacks;
    this.duration = Math.max(15, Math.min(300, duration || 60));
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
      const s = this.snakes.find((sn) => sn.playerId === player.id);
      if (s) s.alive = false;
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
    this.snakes = [];
    const spawns = [
      { x: 4, y: 4, dir: DIRS.right as Dir },
      { x: COLS - 5, y: 4, dir: DIRS.left as Dir },
      { x: 4, y: ROWS - 5, dir: DIRS.right as Dir },
      { x: COLS - 5, y: ROWS - 5, dir: DIRS.left as Dir },
    ];
    this.players.slice(0, 4).forEach((p, i) => {
      const sp = spawns[i];
      const body: { x: number; y: number }[] = [];
      for (let k = 0; k < START_LEN; k++) {
        body.push({ x: sp.x - sp.dir.x * k, y: sp.y - sp.dir.y * k });
      }
      this.snakes.push({
        playerId: p.id,
        name: p.name,
        color: COLORS[i % COLORS.length],
        body,
        dir: { ...sp.dir },
        alive: true,
        score: 0,
        isBot: p.isBot,
      });
    });
    this.phase = "countdown";
    this.countdownLeft = 3;
    this.timeLeft = this.duration;
    this.winners = [];
    this.placeFood();
    this.broadcast();

    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.countdownTimer = setInterval(() => {
      this.countdownLeft -= 1;
      this.lastActivityAt = Date.now();
      if (this.countdownLeft <= 0) {
        if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
        this.phase = "playing";
        this.startTime = Date.now();
        this.startTicks();
      }
      this.broadcast();
    }, 1000);
    this.countdownTimer.unref?.();
    return null;
  }

  private startTicks() {
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    this.tickTimer.unref?.();
  }

  private placeFood() {
    const occupied = new Set(this.snakes.flatMap((s) => s.body.map((c) => c.x + "," + c.y)));
    const free: { x: number; y: number }[] = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!occupied.has(x + "," + y)) free.push({ x, y });
      }
    }
    this.food = free.length ? free[Math.floor(Math.random() * free.length)] : { x: 0, y: 0 };
  }

  setDirection(playerId: string, dir: keyof typeof DIRS): { success: boolean; error?: string } {
    const s = this.snakes.find((sn) => sn.playerId === playerId && sn.alive);
    if (!s) return { success: false, error: "Not playing" };
    const nd = DIRS[dir];
    if (!nd) return { success: false, error: "Invalid direction" };
    const cur = s.dir;
    if (nd.x === -cur.x && nd.y === -cur.y) return { success: false, error: "Cannot reverse" };
    s.dir = { ...nd };
    return { success: true };
  }

  private tick() {
    if (this.phase !== "playing") return;
    this.lastActivityAt = Date.now();

    // bot steering
    for (const s of this.snakes) {
      if (s.alive && s.isBot) this.botSteer(s);
    }

    // build occupied set minus tails (tails will move)
    const occupied = new Map<string, boolean>();
    for (const s of this.snakes) {
      for (let i = 0; i < s.body.length; i++) {
        if (i === s.body.length - 1) continue; // tail moves away
        occupied.set(s.body[i].x + "," + s.body[i].y, true);
      }
    }

    const deaths: SnakeState[] = [];
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const head = s.body[0];
      const nx = head.x + s.dir.x;
      const ny = head.y + s.dir.y;
      const eat = nx === this.food.x && ny === this.food.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS || occupied.has(nx + "," + ny)) {
        s.alive = false;
        deaths.push(s);
        continue;
      }
      s.body.unshift({ x: nx, y: ny });
      if (eat) {
        s.score += 1;
        this.placeFood();
      } else {
        s.body.pop();
      }
    }

    const elapsed = (Date.now() - this.startTime) / 1000;
    this.timeLeft = Math.max(0, Math.ceil(this.duration - elapsed));

    if (this.timeLeft <= 0 || this.snakes.every((s) => !s.alive)) {
      this.finish();
      return;
    }
    this.broadcast();
  }

  private botSteer(s: SnakeState) {
    const options: Dir[] = [s.dir, { x: -s.dir.x, y: -s.dir.y }, { x: s.dir.y, y: s.dir.x }, { x: -s.dir.y, y: s.dir.x }];
    const head = s.body[0];

    // Build occupied set from ALL snakes (not just self)
    const occupied = new Set<string>();
    for (const other of this.snakes) {
      for (let i = 0; i < other.body.length - 1; i++) {
        occupied.add(other.body[i].x + "," + other.body[i].y);
      }
    }

    let best: Dir | null = null;
    let bestScore = -Infinity;
    for (const d of options) {
      if (d.x === -s.dir.x && d.y === -s.dir.y) continue;
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (occupied.has(nx + "," + ny)) continue;

      // Score: prefer food, penalize cells near walls/occupied, add randomness
      const dist = Math.abs(nx - this.food.x) + Math.abs(ny - this.food.y);
      let score = -dist * 2 + (Math.random() * 3);

      // Lookahead: check if next cell has exits (avoid dead ends)
      let exits = 0;
      for (const nd of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]) {
        const ax = nx + nd.x, ay = ny + nd.y;
        if (ax >= 0 && ax < COLS && ay >= 0 && ay < ROWS && !occupied.has(ax + "," + ay)) exits++;
      }
      score += exits * 3;

      if (score > bestScore) { bestScore = score; best = d; }
    }
    if (best) s.dir = best;
  }

  private finish() {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    this.phase = "finished";
    const max = Math.max(0, ...this.snakes.map((s) => s.score));
    this.winners = max > 0 ? this.snakes.filter((s) => s.score === max).map((s) => s.playerId) : [];
    this.lastActivityAt = Date.now();
    this.broadcast();
  }

  toState(): unknown {
    return {
      gameId: this.gameId,
      phase: this.phase,
      cols: this.cols,
      rows: this.rows,
      food: this.food,
      snakes: this.snakes.map((s) => ({
        playerId: s.playerId,
        name: s.name,
        color: s.color,
        body: s.body,
        dir: s.dir,
        alive: s.alive,
        score: s.score,
        isBot: s.isBot,
      })),
      timeLeft: this.timeLeft,
      countdownLeft: this.countdownLeft,
      duration: this.duration,
      winners: this.winners,
    };
  }

  toPlayerState(playerId: string): unknown {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
  }
}
