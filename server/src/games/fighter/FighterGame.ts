import { randomUUID } from "crypto";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types";

const W = 1024;
const H = 720;
const GROUND = H - 100;

type Phase = "countdown" | "playing" | "finished";
type Action = "idle" | "walk" | "jump" | "hand" | "kick" | "special" | "parry" | "hit" | "dead";

interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack1: boolean;
  attack2: boolean;
  parry: boolean;
  special: boolean;
}

const FIGHTER_COLORS = ["#22d3ee", "#fb7185", "#a3e635", "#fbbf24"];

class Fighter {
  playerId: string;
  name: string;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing: 1 | -1;
  health = 160;
  alive = true;
  jumping = false;
  attacking = false;
  attackTimer = 0;
  attackStyle: 1 | 2 | 3 = 1;
  hit = false;
  hitTimer = 0;
  cooldown = 0;
  /** True only for the current tick — holding away-from-opponent absorbs a hit landing right now. */
  blocking = false;
  parryFlash = 0;
  parryStamina = 100;
  guardBreak = false;
  specialMeter = 0;
  specialFlash = 0;
  stun = 0;
  action: Action = "idle";
  input: InputState = { left: false, right: false, jump: false, attack1: false, attack2: false, parry: false, special: false };
  difficulty: "easy" | "medium" | "hard" = "medium";
  characterId: string = "cat";

  constructor(playerId: string, name: string, color: string, isBot: boolean, x: number, facing: 1 | -1) {
    this.playerId = playerId;
    this.name = name;
    this.color = color;
    this.isBot = isBot;
    this.x = x;
    this.y = GROUND;
    this.facing = facing;
  }

  reset(x: number, facing: 1 | -1) {
    this.x = x;
    this.y = GROUND;
    this.vy = 0;
    this.health = 160;
    this.alive = true;
    this.jumping = false;
    this.attacking = false;
    this.attackTimer = 0;
    this.hit = false;
    this.hitTimer = 0;
    this.cooldown = 0;
    this.blocking = false;
    this.parryFlash = 0;
    this.parryStamina = 100;
    this.guardBreak = false;
    this.specialMeter = 0;
    this.specialFlash = 0;
    this.stun = 0;
    this.action = "idle";
    this.facing = facing;
    this.input = { left: false, right: false, jump: false, attack1: false, attack2: false, parry: false, special: false };
  }

  tryAttack(style: 1 | 2) {
    if (this.cooldown > 0 || this.attacking || !this.alive) return;
    this.attacking = true;
    this.attackStyle = style;
    this.attackTimer = 18;
    this.cooldown = 34;
  }

  resolveHit(target: Fighter, dmg = 20) {
    if (!target.alive) return;
    const dx = Math.abs(this.x - target.x);
    const dy = Math.abs(this.y - target.y);
    if (dx < 130 && dy < 120) {
      if (target.blocking && target.parryStamina > 0) {
        // Blocked! Cost stamina
        const cost = dmg * 0.6;
        target.parryStamina = Math.max(0, target.parryStamina - cost);
        target.parryFlash = 14;
        this.attacking = false;
        this.stun = 26;
        // Guard break if stamina depleted
        if (target.parryStamina <= 0) {
          target.guardBreak = true;
          target.stun = 40;
          target.blocking = false;
          target.parryFlash = 20;
        }
        return;
      }
      target.health = Math.max(0, target.health - dmg);
      target.hit = true;
      target.hitTimer = 14;
      this.specialMeter = Math.min(100, this.specialMeter + 30);
      if (target.health <= 0) target.alive = false;
    }
  }

  update(opponent: Fighter, f: number) {
    if (this.cooldown > 0) this.cooldown -= f;
    if (this.stun > 0) this.stun -= f;
    // Stamina recharge when not blocking
    if (!this.blocking && this.parryStamina < 100) {
      this.parryStamina = Math.min(100, this.parryStamina + 0.8 * f);
    }
    if (this.parryFlash > 0) this.parryFlash -= f;
    if (this.specialFlash > 0) this.specialFlash -= f;
    if (this.hitTimer > 0) {
      this.hitTimer -= f;
      if (this.hitTimer <= 0) { this.hit = false; this.attacking = false; }
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= f;
      if (this.attackTimer <= 0) this.attacking = false;
    }
    if (this.guardBreak) {
      this.guardBreak = false;
      this.stun = 40;
    }

    if (!this.alive) { this.action = "dead"; return; }
    if (this.stun > 0) { this.action = "hit"; return; }
    if (this.hit) { this.action = "hit"; return; }

    let move = 0;
    this.blocking = false;
    const canAct = !this.attacking && this.stun <= 0;
    if (canAct) {
      if (this.input.left) move -= 10;
      if (this.input.right) move += 10;
      if (this.input.jump && !this.jumping) { this.vy = -40; this.jumping = true; }

      // Holding the direction AWAY from the opponent = guarding, like a normal
      // fighting game: you keep walking backward at full speed, but a hit that
      // lands on you while you're doing it is blocked (costs stamina) instead of
      // dealing damage. No freeze, no timer — just a reactive per-tick flag.
      const awayFromEnemy = move !== 0 && ((opponent.x > this.x && move < 0) || (opponent.x < this.x && move > 0));
      this.blocking = awayFromEnemy && this.parryStamina > 0 && !this.jumping;

      if (!this.blocking) {
        if (this.input.special && this.specialMeter >= 100 && this.cooldown <= 0) {
          this.attacking = true;
          this.attackStyle = 3;
          this.attackTimer = 26;
          this.cooldown = 50;
          this.specialMeter = 0;
          this.specialFlash = 14;
          this.resolveHit(opponent, 45);
        } else if ((this.input.attack1 || this.input.attack2) && this.cooldown <= 0) {
          this.tryAttack(this.input.attack2 ? 2 : 1);
          this.resolveHit(opponent, 20);
        }
      }
    }

    this.vy += 2 * f;
    this.x += move * f;
    this.y += this.vy * f;

    if (this.y > GROUND) { this.y = GROUND; this.vy = 0; this.jumping = false; }
    if (this.x < 40) this.x = 40;
    if (this.x > W - 40) this.x = W - 40;

    if (move !== 0) this.facing = move > 0 ? 1 : -1;
    else if (opponent.x > this.x) this.facing = 1;
    else this.facing = -1;

    if (this.blocking) this.action = "parry";
    else if (this.attacking) this.action = this.attackStyle === 2 ? "kick" : this.attackStyle === 3 ? "special" : "hand";
    else if (this.jumping) this.action = "jump";
    else if (move !== 0) this.action = "walk";
    else this.action = "idle";
  }
}

const TICK_MS = 33;

export class FighterGame implements GameRoom {
  roomId: string;
  gameId = "fighter";
  phase: Phase = "countdown";
  players: Player[] = [];
  maxPlayers: number;
  lastActivityAt = Date.now();

  private callbacks: GameRoomCallbacks;
  private fighters: Fighter[] = [];
  private loopId: any = null;
  private countdownTimer: any = null;
  private countdownLeft = 3;
  private winner: string | "draw" | null = null;
  private lastRoundWinner: string | "draw" | null = null;
  private matchWinner: string | null = null;
  private scores: Record<string, number> = {};
  private winTarget = 3;
  private theme = "default";
  private roundTimer: any = null;
  private botDifficulty: Map<string, "easy" | "medium" | "hard"> = new Map();

  constructor(roomId: string, options: any, callbacks: GameRoomCallbacks) {
    this.roomId = roomId;
    this.maxPlayers = options.maxPlayers ?? 4;
    this.winTarget = Math.max(1, Number(options?.winTarget) || 3);
    this.theme = options?.theme || "default";
    this.callbacks = callbacks;
  }

  get playerCount() {
    return this.players.length;
  }

  addPlayer(name: string, socketId: string, isHost = false, existingId?: string, flag?: string, icon?: string, characterId?: string): Player {
    const id = existingId ?? randomUUID();
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    if (flag) player.flag = flag;
    if (icon) player.icon = icon;
    if (characterId) player.characterId = characterId;
    this.players.push(player);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, difficulty: "easy" | "medium" | "hard" = "medium"): Player {
    const bot = new Player(randomUUID(), name, true, false);
    this.players.push(bot);
    this.botDifficulty.set(bot.id, difficulty);
    this.lastActivityAt = Date.now();
    return bot;
  }

  removeBot(botId: string): boolean {
    const before = this.players.length;
    this.players = this.players.filter((p) => p.id !== botId || !p.isBot);
    this.lastActivityAt = Date.now();
    return this.players.length !== before;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  handleDisconnect(socketId: string): Player | null {
    const p = this.players.find((pl) => pl.socketId === socketId);
    if (p) p.isConnected = false;
    this.lastActivityAt = Date.now();
    return p || null;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const p = this.getPlayer(playerId);
    if (p) {
      p.socketId = socketId;
      p.isConnected = true;
    }
    this.lastActivityAt = Date.now();
    return p || null;
  }

  canStart(): boolean {
    return this.players.length >= 2;
  }

  startGame(): { success: boolean; error?: string } {
    if (this.players.length < 2) this.addBot("Bot Fighter", "medium");
    if (!this.canStart()) return { success: false, error: "Need at least 2 players" };
    this.assignFighters();
    this.scores = {};
    for (const p of this.players) this.scores[p.id] = 0;
    this.matchWinner = null;
    this.lastRoundWinner = null;
    this.winner = null;
    this.resetRound();
    this.beginCountdown();
    return { success: true };
  }

  private beginCountdown() {
    this.phase = "countdown";
    this.countdownLeft = 3;
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    this.countdownTimer = setInterval(() => {
      this.countdownLeft -= 1;
      if (this.countdownLeft <= 0) {
        if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
        this.phase = "playing";
        this.startTicks();
      }
      this.broadcast();
    }, 1000);
    this.countdownTimer.unref?.();
    this.broadcast();
  }

  private nextRound() {
    this.roundTimer = null;
    this.resetRound();
    this.beginCountdown();
  }

  private assignFighters() {
    const DEFAULT_CHARACTER_IDS = ["cat", "mon"];
    this.fighters = this.players.slice(0, 2).map((p, i) => {
      const f = new Fighter(p.id, p.name, FIGHTER_COLORS[i % FIGHTER_COLORS.length], p.isBot, i === 0 ? 200 : 824, i === 0 ? 1 : -1);
      if (p.isBot) f.difficulty = this.botDifficulty.get(p.id) ?? "medium";
      f.characterId = p.characterId ?? DEFAULT_CHARACTER_IDS[i % DEFAULT_CHARACTER_IDS.length];
      return f;
    });
    this.scores = {};
    for (const p of this.players) this.scores[p.id] = 0;
  }

  private resetRound() {
    if (this.fighters.length < 2) this.assignFighters();
    this.fighters[0].reset(200, 1);
    this.fighters[1].reset(824, -1);
  }

  private startTicks() {
    if (this.loopId) { clearInterval(this.loopId); this.loopId = null; }
    this.loopId = setInterval(() => this.tick(), TICK_MS);
    this.loopId.unref?.();
  }

  private stopLoop() {
    if (this.loopId) { clearInterval(this.loopId); this.loopId = null; }
  }

  setInput(playerId: string, input: Partial<InputState>): { success: boolean; error?: string } {
    const f = this.fighters.find((x) => x.playerId === playerId);
    if (!f) return { success: false, error: "Not a fighter" };
    f.input = {
      left: !!input.left,
      right: !!input.right,
      jump: !!input.jump,
      attack1: !!input.attack1,
      attack2: !!input.attack2,
      parry: !!input.parry,
      special: !!input.special,
    };
    return { success: true };
  }

  private tick() {
    if (this.phase !== "playing") return;
    const f = TICK_MS / 16.67;
    const [a, b] = this.fighters;
    if (!a || !b) return;

    for (const fi of this.fighters) {
      if (fi.isBot) this.botSteer(fi, fi === a ? b : a);
    }

    a.update(b, f);
    b.update(a, f);

    if (!a.alive || !b.alive) {
      const w = a.alive ? a.playerId : b.alive ? b.playerId : "draw";
      this.winner = w;
      this.lastRoundWinner = w;
      if (w !== "draw") this.scores[w] = (this.scores[w] ?? 0) + 1;
      this.phase = "finished";
      this.stopLoop();
      this.broadcast();

      if (w !== "draw" && this.scores[w] >= this.winTarget) {
        this.matchWinner = w;
      } else {
        this.roundTimer = setTimeout(() => this.nextRound(), 2500);
        this.roundTimer.unref?.();
      }
      return;
    }
    this.broadcast();
  }

  private botSteer(bot: Fighter, opp: Fighter) {
    const dx = opp.x - bot.x;
    const dir = dx > 0 ? 1 : -1;
    const dist = Math.abs(dx);
    bot.input = { left: false, right: false, jump: false, attack1: false, attack2: false, parry: false, special: false };

    const diff = bot.difficulty;
    const attackRange = diff === "easy" ? 60 : diff === "hard" ? 85 : 70;
    const attackChance = diff === "easy" ? 0.35 : diff === "hard" ? 0.95 : 0.7;
    const retreatChance = diff === "hard" ? 0.15 : diff === "easy" ? 0.02 : 0.06;
    const jumpChance = diff === "easy" ? 0.01 : diff === "hard" ? 0.035 : 0.02;

    if (dist > attackRange) {
      if (dir > 0) bot.input.right = true; else bot.input.left = true;
    } else if (Math.random() < retreatChance && bot.parryStamina > 20) {
      // Step back into the auto-block stance instead of trading hits
      if (dir > 0) bot.input.left = true; else bot.input.right = true;
    } else if (Math.random() < attackChance) {
      if (diff === "hard" && bot.specialMeter >= 100 && Math.random() < 0.5) {
        bot.input.special = true;
      } else if (diff !== "easy" && Math.random() < 0.3) {
        bot.input.attack2 = true;
      } else {
        bot.input.attack1 = true;
      }
    }
    if (bot.y >= GROUND && Math.random() < jumpChance) bot.input.jump = true;
    // face opponent
    bot.facing = dir > 0 ? 1 : -1;
  }

  toState() {
    return {
      gameId: this.gameId,
      phase: this.phase,
      countdownLeft: this.countdownLeft,
      fighters: this.fighters.map((fi) => ({
        playerId: fi.playerId,
        name: fi.name,
        color: fi.color,
        characterId: fi.characterId,
        x: Math.round(fi.x),
        y: Math.round(fi.y),
        facing: fi.facing,
        health: fi.health,
        alive: fi.alive,
        action: fi.action,
        attackStyle: fi.attackStyle,
        special: fi.specialMeter,
        parryActive: fi.blocking,
        parryFlash: fi.parryFlash,
        parryStamina: fi.parryStamina,
        specialFlash: fi.specialFlash,
        isBot: fi.isBot,
      })),
      winner: this.winner,
      lastRoundWinner: this.lastRoundWinner,
      matchWinner: this.matchWinner,
      scores: this.scores,
      winTarget: this.winTarget,
      theme: this.theme,
      maxHealth: 160,
    };
  }

  toPlayerState(playerId: string) {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    this.stopLoop();
    if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null; }
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
  }
}
