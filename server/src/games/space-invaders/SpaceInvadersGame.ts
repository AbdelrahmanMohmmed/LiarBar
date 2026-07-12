import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

const WIDTH = 540;
const HEIGHT = 720;
const TICK_MS = 40;
const COLORS = ["#22d3ee", "#fb7185", "#a3e635", "#fbbf24", "#c084fc", "#f97316"];
const SKINS = ["trainer", "beetle", "enemy1", "boss"];

interface Ship {
  playerId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  color: string;
  skin: string;
  isBot: boolean;
  input: { dx: number; dy: number; fire: boolean };
  fireCd: number;
  effects: { speedUntil: number; rapidUntil: number; doubleUntil: number; shield: boolean };
}

interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  vy: number;
  fireCd: number;
}

interface Bullet {
  x: number;
  y: number;
  vy: number;
  owner: "player" | "enemy";
}

interface PowerUp {
  id: string;
  x: number;
  y: number;
  vy: number;
  type: "speed" | "rapid" | "double" | "shield";
}

interface Burst {
  x: number;
  y: number;
  ttl: number;
  max: number;
  color: string;
}

type Effect = "speed" | "rapid" | "double" | "shield";

export class SpaceInvadersGame implements GameRoom {
  readonly gameId = "space-invaders";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: "countdown" | "playing" | "finished" = "countdown";
  countdownLeft = 3;
  width = WIDTH;
  height = HEIGHT;
  ships: Ship[] = [];
  enemies: Enemy[] = [];
  pBullets: Bullet[] = [];
  eBullets: Bullet[] = [];
  powerups: PowerUp[] = [];
  bursts: Burst[] = [];
  score = 0;
  level = 1;
  kills = 0;

  private callbacks: GameRoomCallbacks;
  private tickTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private spawnCd = 0;
  private enemyFireCd = 0;
  private powerupCd = 0;

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(8, maxPlayers || 4));
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
      const s = this.ships.find((sh) => sh.playerId === player.id);
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
    this.ships = [];
    const n = this.players.length;
    this.players.forEach((p, i) => {
      const x = WIDTH * (i + 1) / (n + 1);
      this.ships.push({
        playerId: p.id,
        name: p.name,
        x,
        y: HEIGHT - 70,
        hp: 100,
        maxHp: 100,
        alive: true,
        color: COLORS[i % COLORS.length],
        skin: SKINS[i % SKINS.length],
        isBot: p.isBot,
        input: { dx: 0, dy: 0, fire: false },
        fireCd: 0,
        effects: { speedUntil: 0, rapidUntil: 0, doubleUntil: 0, shield: false },
      });
    });
    this.enemies = [];
    this.pBullets = [];
    this.eBullets = [];
    this.powerups = [];
    this.bursts = [];
    this.score = 0;
    this.level = 1;
    this.kills = 0;
    this.phase = "countdown";
    this.countdownLeft = 3;
    this.spawnCd = 0;
    this.powerupCd = 0;
    this.broadcast();

    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.countdownTimer = setInterval(() => {
      this.countdownLeft -= 1;
      this.lastActivityAt = Date.now();
      if (this.countdownLeft <= 0) {
        if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
        this.phase = "playing";
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

  setInput(playerId: string, input: { dx?: number; dy?: number; fire?: boolean }): { success: boolean; error?: string } {
    const s = this.ships.find((sh) => sh.playerId === playerId && sh.alive);
    if (!s) return { success: false, error: "Not playing" };
    if (typeof input.dx === "number") s.input.dx = Math.max(-1, Math.min(1, input.dx));
    if (typeof input.dy === "number") s.input.dy = Math.max(-1, Math.min(1, input.dy));
    if (typeof input.fire === "boolean") s.input.fire = input.fire;
    return { success: true };
  }

  private tick() {
    if (this.phase !== "playing") return;
    this.lastActivityAt = Date.now();
    const now = Date.now();

    // ships move + fire
    for (const s of this.ships) {
      if (!s.alive) continue;
      if (s.isBot) this.botSteer(s);
      const speed = 7 * (s.effects.speedUntil > now ? 1.7 : 1);
      s.x += s.input.dx * speed;
      s.y += s.input.dy * speed;
      s.x = Math.max(27, Math.min(WIDTH - 27, s.x));
      s.y = Math.max(HEIGHT / 2, Math.min(HEIGHT - 30, s.y));
      if (s.fireCd > 0) s.fireCd -= TICK_MS;
      if (s.input.fire && s.fireCd <= 0) {
        const cd = s.effects.rapidUntil > now ? 150 : 300;
        this.pBullets.push({ x: s.x - 10, y: s.y - 28, vy: -12, owner: "player" });
        if (s.effects.doubleUntil > now) {
          this.pBullets.push({ x: s.x + 10, y: s.y - 28, vy: -12, owner: "player" });
        }
        s.fireCd = cd;
      }
    }

    // spawn enemies (faster)
    this.spawnCd -= TICK_MS;
    const spawnInterval = Math.max(350, 1000 - this.level * 60);
    if (this.spawnCd <= 0) {
      this.spawnCd = spawnInterval;
      const count = 1 + (Math.random() < 0.5 ? 1 : 0) + (this.level > 4 && Math.random() < 0.3 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        this.enemies.push({
          id: nanoid(6),
          x: 40 + Math.random() * (WIDTH - 80),
          y: -40,
          hp: 1 + (this.level > 3 ? 1 : 0),
          vy: 2.2 + this.level * 0.3,
          fireCd: 800 + Math.random() * 1200,
        });
      }
    }

    // enemy fire
    this.enemyFireCd -= TICK_MS;
    for (const e of this.enemies) {
      e.y += e.vy;
      e.fireCd -= TICK_MS;
      if (e.fireCd <= 0 && this.ships.some((s) => s.alive)) {
        e.fireCd = 1100 + Math.random() * 1200;
        this.eBullets.push({ x: e.x, y: e.y + 25, vy: 6, owner: "enemy" });
      }
    }

    // player bullets
    this.pBullets = this.pBullets.filter((b) => {
      b.y += b.vy;
      if (b.y < -20) return false;
      for (const e of this.enemies) {
        if (Math.abs(b.x - e.x) < 26 && Math.abs(b.y - e.y) < 22) {
          e.hp -= 1;
          return false;
        }
      }
      return true;
    });

    // enemy bullets
    this.eBullets = this.eBullets.filter((b) => {
      b.y += b.vy;
      if (b.y > HEIGHT + 20) return false;
      for (const s of this.ships) {
        if (s.alive && Math.abs(b.x - s.x) < 27 && Math.abs(b.y - s.y) < 26) {
          this.damageShip(s, 10);
          return false;
        }
      }
      return true;
    });

    // enemies reaching bottom
    this.enemies = this.enemies.filter((e) => {
      if (e.y > HEIGHT - 10) {
        const alive = this.ships.filter((s) => s.alive);
        if (alive.length) {
          const target = alive[Math.floor(Math.random() * alive.length)];
          this.damageShip(target, 20);
        }
        return false;
      }
      return true;
    });

    // power-ups
    this.powerupCd -= TICK_MS;
    if (this.powerupCd <= 0) {
      this.powerupCd = 5000 + Math.random() * 3000;
      const types: Effect[] = ["speed", "rapid", "double", "shield"];
      const t = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({
        id: nanoid(6),
        x: 40 + Math.random() * (WIDTH - 80),
        y: -30,
        vy: 2.4,
        type: t,
      });
    }
    this.powerups = this.powerups.filter((p) => {
      p.y += p.vy;
      if (p.y > HEIGHT + 20) return false;
      for (const s of this.ships) {
        if (s.alive && Math.abs(p.x - s.x) < 32 && Math.abs(p.y - s.y) < 30) {
          this.applyPowerUp(s, p.type);
          return false;
        }
      }
      return true;
    });

    // bursts decay
    this.bursts = this.bursts.filter((b) => {
      b.ttl -= TICK_MS;
      return b.ttl > 0;
    });

    // remove dead enemies, tally kills
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((e) => {
      if (e.hp <= 0) {
        this.bursts.push({ x: e.x, y: e.y, ttl: 320, max: 320, color: "#ffd23f" });
        return false;
      }
      return true;
    });
    const killed = before - this.enemies.length;
    if (killed > 0) {
      this.kills += killed;
      this.score += killed * 10 * this.level;
      if (this.kills >= this.level * 10) this.level += 1;
    }

    if (this.ships.every((s) => !s.alive)) {
      this.phase = "finished";
      if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    }
    this.broadcast();
  }

  private damageShip(s: Ship, amount: number) {
    if (!s.alive) return;
    if (s.effects.shield) {
      s.effects.shield = false;
      this.bursts.push({ x: s.x, y: s.y, ttl: 260, max: 260, color: "#67e8f9" });
      return;
    }
    s.hp -= amount;
    if (s.hp <= 0) {
      s.alive = false;
      this.bursts.push({ x: s.x, y: s.y, ttl: 400, max: 400, color: s.color });
    }
  }

  private applyPowerUp(s: Ship, type: Effect) {
    const now = Date.now();
    if (type === "speed") s.effects.speedUntil = now + 6000;
    else if (type === "rapid") s.effects.rapidUntil = now + 6000;
    else if (type === "double") s.effects.doubleUntil = now + 6000;
    else if (type === "shield") s.effects.shield = true;
    this.bursts.push({ x: s.x, y: s.y, ttl: 260, max: 260, color: "#a3e635" });
  }

  private botSteer(s: Ship) {
    const target = this.enemies[0];
    if (target) {
      if (target.x < s.x - 8) s.input.dx = -1;
      else if (target.x > s.x + 8) s.input.dx = 1;
      else s.input.dx = 0;
      s.input.dy = s.y < HEIGHT - 120 ? 1 : 0;
    } else {
      s.input.dx = 0;
      s.input.dy = 0;
    }
    s.input.fire = true;
  }

  toState(): unknown {
    const now = Date.now();
    return {
      gameId: this.gameId,
      phase: this.phase,
      width: this.width,
      height: this.height,
      countdownLeft: this.countdownLeft,
      ships: this.ships.map((s) => ({
        playerId: s.playerId,
        name: s.name,
        x: Math.round(s.x),
        y: Math.round(s.y),
        hp: s.hp,
        maxHp: s.maxHp,
        alive: s.alive,
        color: s.color,
        skin: s.skin,
        isBot: s.isBot,
        speed: s.effects.speedUntil > now,
        rapid: s.effects.rapidUntil > now,
        double: s.effects.doubleUntil > now,
        shield: s.effects.shield,
      })),
      enemies: this.enemies.map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp })),
      pBullets: this.pBullets.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) })),
      eBullets: this.eBullets.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y) })),
      powerups: this.powerups.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y), type: p.type })),
      bursts: this.bursts.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), ttl: b.ttl, max: b.max, color: b.color })),
      score: this.score,
      level: this.level,
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
