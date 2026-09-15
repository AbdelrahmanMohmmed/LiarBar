import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";

type Shape = "donut" | "square" | "diamond" | "lines" | "oval" | "star" | "triangle";
type Color = { r: number; g: number; b: number };
type Icon = { shape: Shape; color: Color };

const COLORS: Color[] = [
  { r: 255, g: 0, b: 0 },
  { r: 0, g: 255, b: 0 },
  { r: 0, g: 0, b: 255 },
  { r: 255, g: 255, b: 0 },
  { r: 255, g: 128, b: 0 },
  { r: 255, g: 0, b: 255 },
  { r: 0, g: 255, b: 255 },
];
const SHAPES: Shape[] = ["donut", "square", "diamond", "lines", "oval", "star", "triangle"];
const ALL_ICONS: Icon[] = [];
for (const c of COLORS) for (const s of SHAPES) ALL_ICONS.push({ shape: s, color: c });

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface CardState {
  icon: Icon;
  revealed: boolean;
  matched: boolean;
  revealedBy: string | null;
}

interface BotMemory {
  // Map of "x,y" -> icon that the bot has seen
  seen: Map<string, Icon>;
  timer: NodeJS.Timeout | null;
}

export class MemoryPuzzleGame implements GameRoom {
  readonly gameId = "memory-puzzle";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt = Date.now();

  phase: "countdown" | "playing" | "finished" = "countdown";
  board: CardState[][] = [];
  boardW = 8;
  boardH = 6;
  turn: number = 0;
  firstPick: { x: number; y: number; playerId: string } | null = null;
  scores: Record<string, number> = {};
  pairsFound = 0;
  totalPairs = 0;
  countdownLeft = 3;
  winners: string[] = [];

  private callbacks: GameRoomCallbacks;
  private countdownTimer: NodeJS.Timeout | null = null;
  private flipLock = false;
  private botMemory: Map<string, BotMemory> = new Map();
  private difficulty: "easy" | "medium" | "hard";

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks, difficulty: "easy" | "medium" | "hard" = "medium") {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(10, maxPlayers || 2));
    this.callbacks = callbacks;
    this.difficulty = difficulty;
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
    this.initBoard();
    this.phase = "countdown";
    this.countdownLeft = 3;
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.startCountdown();
    return null;
  }

  private initBoard() {
    const numPairs = Math.floor((this.boardW * this.boardH) / 2);
    const icons = shuffle(ALL_ICONS).slice(0, numPairs);
    const deck = shuffle([...icons, ...icons]);
    this.board = [];
    for (let x = 0; x < this.boardW; x++) {
      const col: CardState[] = [];
      for (let y = 0; y < this.boardH; y++) {
        col.push({
          icon: deck[x * this.boardH + y],
          revealed: false,
          matched: false,
          revealedBy: null,
        });
      }
      this.board.push(col);
    }
    this.firstPick = null;
    this.pairsFound = 0;
    this.totalPairs = numPairs;
    this.scores = {};
    for (const p of this.players) this.scores[p.id] = 0;
    this.turn = 0;
    this.winners = [];
  }

  private startCountdown() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.countdownLeft--;
      if (this.countdownLeft <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.phase = "playing";
        this.revealAllBriefly();
      }
      this.broadcast();
    }, 1000);
    this.countdownTimer.unref?.();
  }

  private revealAllBriefly() {
    for (const col of this.board) for (const c of col) c.revealed = true;
    this.broadcast();
    setTimeout(() => {
      // Let bots memorize what they saw before hiding
      this.memorizeForBots();
      for (const col of this.board) for (const c of col) { c.revealed = false; c.matched = false; }
      this.broadcast();
      // Start bot turns after reveal
      this.scheduleBotFlip();
    }, 1500);
  }

  private memorizeForBots() {
    for (const p of this.players) {
      if (!p.isBot) continue;
      let mem = this.botMemory.get(p.id);
      if (!mem) {
        mem = { seen: new Map(), timer: null };
        this.botMemory.set(p.id, mem);
      }
      // All cards are revealed right now, remember them all
      for (let x = 0; x < this.boardW; x++) {
        for (let y = 0; y < this.boardH; y++) {
          const card = this.board[x][y];
          if (!card.matched) {
            mem.seen.set(`${x},${y}`, { ...card.icon });
          }
        }
      }
    }
  }

  flip(playerId: string, x: number, y: number): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Game not active" };
    if (this.flipLock) return { success: false, error: "Wait for cards to settle" };
    if (x < 0 || x >= this.boardW || y < 0 || y >= this.boardH) {
      return { success: false, error: "Invalid position" };
    }
    const card = this.board[x][y];
    if (card.revealed || card.matched) return { success: false, error: "Card already revealed" };

    card.revealed = true;
    card.revealedBy = playerId;
    this.lastActivityAt = Date.now();

    // Let bots learn from human flips
    if (!this.getPlayer(playerId)?.isBot) {
      this.learnForBots(x, y, card);
    }

    if (!this.firstPick) {
      this.firstPick = { x, y, playerId };
      this.broadcast();
      return { success: true };
    }

    const fp = this.firstPick;
    this.firstPick = null;
    this.flipLock = true;

    const c1 = this.board[fp.x][fp.y];
    const c2 = card;

    if (c1.icon.shape === c2.icon.shape &&
        c1.icon.color.r === c2.icon.color.r &&
        c1.icon.color.g === c2.icon.color.g &&
        c1.icon.color.b === c2.icon.color.b) {
      // Match!
      c1.matched = true;
      c2.matched = true;
      this.pairsFound++;
      this.scores[fp.playerId] = (this.scores[fp.playerId] || 0) + 1;

      // Remove matched cards from bot memory
      for (const [, mem] of this.botMemory) {
        mem.seen.delete(`${fp.x},${fp.y}`);
        mem.seen.delete(`${x},${y}`);
      }

      // Let bots learn from this second reveal
      if (!this.getPlayer(playerId)?.isBot) {
        this.learnForBots(x, y, c2);
      }

      this.broadcast();

      setTimeout(() => {
        this.flipLock = false;
        if (this.pairsFound >= this.totalPairs) {
          this.phase = "finished";
          const maxScore = Math.max(...Object.values(this.scores));
          this.winners = Object.entries(this.scores)
            .filter(([_, s]) => s === maxScore)
            .map(([id]) => id);
          // Report the winner so the party's cross-game scoreboard records it.
          if (this.winners.length > 0) {
            this.callbacks.onGameEnd(this.roomId, this.winners[0]);
          }
        } else {
          this.scheduleBotFlip();
        }
        this.broadcast();
      }, 600);
    } else {
      // No match
      // Let bots learn from this second reveal
      if (!this.getPlayer(playerId)?.isBot) {
        this.learnForBots(x, y, c2);
      }

      this.broadcast();
      setTimeout(() => {
        c1.revealed = false;
        c1.revealedBy = null;
        c2.revealed = false;
        c2.revealedBy = null;
        this.flipLock = false;
        this.scheduleBotFlip();
        this.broadcast();
      }, 1000);
    }

    return { success: true };
  }

  private learnForBots(x: number, y: number, card: CardState) {
    for (const p of this.players) {
      if (!p.isBot) continue;
      let mem = this.botMemory.get(p.id);
      if (!mem) {
        mem = { seen: new Map(), timer: null };
        this.botMemory.set(p.id, mem);
      }
      mem.seen.set(`${x},${y}`, { ...card.icon });
    }
  }

  /**
   * Give *every* bot a pending flip.
   *
   * This used to schedule `players.find((p) => p.isBot)` — only ever the first
   * bot in the roster. That was invisible while bots were a rare second seat,
   * and wrong the moment a host could fill a Memory board with three of them:
   * bots two and three never flipped a card and finished on nought, which
   * reads as the game quietly ignoring them. Memory has no turn order — it is
   * a race arbitrated by `flipLock` — so each bot just runs its own timer.
   */
  private scheduleBotFlip() {
    if (this.flipLock || this.phase !== "playing") return;

    const [minDelay, maxDelay] =
      this.difficulty === "easy" ? [1400, 2400] : this.difficulty === "hard" ? [400, 900] : [800, 1500];

    for (const bot of this.players) {
      if (!bot.isBot) continue;

      let mem = this.botMemory.get(bot.id);
      if (!mem) {
        mem = { seen: new Map(), timer: null };
        this.botMemory.set(bot.id, mem);
      }

      // Clear any existing timer
      if (mem.timer) { clearTimeout(mem.timer); mem.timer = null; }

      mem.timer = setTimeout(() => {
        if (this.phase !== "playing" || this.flipLock) return;
        this.runBotFlip(bot.id);
      }, minDelay + Math.random() * (maxDelay - minDelay));
      mem.timer.unref?.();
    }
  }

  private recallChance(): number {
    return this.difficulty === "easy" ? 0.45 : this.difficulty === "hard" ? 1 : 0.8;
  }

  /**
   * One flip, decided from the board rather than from what this bot did last.
   *
   * The old version kept a private `firstFlip` per bot and assumed the two
   * flips of a turn were its own. Memory has no turns — it is a race settled
   * by `flipLock` — so with more than one bot that assumption was wrong on
   * roughly every other flip: bot A would open a card it knew the partner of,
   * bot B would fire its own "first" flip into the same open pick, the two
   * cards wouldn't match, and both would turn back over. Three bots ran for
   * twelve seconds across a 48-card board they had *memorised in full* and
   * found nothing, which looks precisely like bots that can't play.
   *
   * `this.firstPick` is the truth and everyone can see it, so that is what a
   * bot decides from: complete the card that is face up, or open one you know.
   */
  private runBotFlip(botId: string) {
    if (this.phase !== "playing" || this.flipLock) return;
    const mem = this.botMemory.get(botId);
    if (!mem) return;

    // Unmatched, face-down cards — everything that is legal to flip.
    const candidates: { x: number; y: number }[] = [];
    for (let x = 0; x < this.boardW; x++) {
      for (let y = 0; y < this.boardH; y++) {
        const card = this.board[x][y];
        if (!card.revealed && !card.matched) candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return;

    const randomPick = () => candidates[Math.floor(Math.random() * candidates.length)];
    const open = this.firstPick;

    if (open) {
      // A card is already face up — anyone's. Finish it if we remember where
      // its partner is, which is what a person does when they see one.
      const openCard = this.board[open.x]?.[open.y];
      if (openCard && !openCard.matched && Math.random() < this.recallChance()) {
        const partner = this.recall(mem, openCard.icon, open);
        if (partner) {
          this.flip(botId, partner.x, partner.y);
          return;
        }
      }
      const blind = randomPick();
      this.flip(botId, blind.x, blind.y);
      return;
    }

    // Board is clear. Open a pair we know both halves of, so the flip after
    // this one can close it.
    if (mem.seen.size > 0 && Math.random() < this.recallChance()) {
      const groups = new Map<string, { x: number; y: number }[]>();
      for (const [key, icon] of mem.seen) {
        const [sx, sy] = key.split(",").map(Number);
        const card = this.board[sx]?.[sy];
        if (!card || card.matched || card.revealed) continue;
        const cardKey = this.iconKey(icon);
        if (!groups.has(cardKey)) groups.set(cardKey, []);
        groups.get(cardKey)!.push({ x: sx, y: sy });
      }
      for (const [, positions] of groups) {
        if (positions.length >= 2) {
          const pick = positions[Math.floor(Math.random() * positions.length)];
          this.flip(botId, pick.x, pick.y);
          return;
        }
      }
    }

    const pick = randomPick();
    this.flip(botId, pick.x, pick.y);
  }

  private iconKey(icon: Icon): string {
    return `${icon.shape}_${icon.color.r}_${icon.color.g}_${icon.color.b}`;
  }

  /** Where this bot remembers the twin of `icon` being, if anywhere. */
  private recall(
    mem: BotMemory,
    icon: Icon,
    not: { x: number; y: number },
  ): { x: number; y: number } | null {
    const want = this.iconKey(icon);
    for (const [key, seen] of mem.seen) {
      if (this.iconKey(seen) !== want) continue;
      const [sx, sy] = key.split(",").map(Number);
      if (sx === not.x && sy === not.y) continue;
      const card = this.board[sx]?.[sy];
      if (!card || card.matched || card.revealed) continue;
      return { x: sx, y: sy };
    }
    return null;
  }

  toState(): unknown {
    return {
      gameId: this.gameId,
      phase: this.phase,
      board: this.board.map((col) =>
        col.map((c) => ({
          icon: c.icon,
          revealed: c.revealed,
          matched: c.matched,
        }))
      ),
      boardW: this.boardW,
      boardH: this.boardH,
      turn: this.turn,
      scores: this.scores,
      pairsFound: this.pairsFound,
      totalPairs: this.totalPairs,
      countdownLeft: this.countdownLeft,
      winners: this.winners,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        score: this.scores[p.id] || 0,
      })),
    };
  }

  toPlayerState(_playerId: string): unknown {
    return this.toState();
  }

  private broadcast() {
    this.callbacks.broadcast(this.toState());
  }

  destroy(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    for (const [, mem] of this.botMemory) {
      if (mem.timer) clearTimeout(mem.timer);
    }
    this.botMemory.clear();
  }
}
