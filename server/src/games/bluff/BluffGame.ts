import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import { dealPrompts, normalise, type BluffPrompt } from "./prompts.js";

/**
 * Bluff — بلوف.
 *
 * A sentence appears with one word missing. Everyone types an answer they've
 * invented. Then every invented answer is shuffled in with the real one, and
 * everyone picks the one they think is true. You score for finding the truth,
 * and for every person who falls for your lie.
 *
 * ## Why this game, in this catalogue
 *
 * Everything else here is either a hidden-role game (Spyfall, Chameleon,
 * Liar's Bar) or a board (domino, Rento). This is the only one where the
 * players *make* the content, which changes what a session feels like: the
 * funniest thing that happens in a round is something somebody at the table
 * wrote, not something the server dealt. That is also why it survives being
 * played twice in one evening with the same people — the deck is finite, but
 * the jokes aren't.
 *
 * It is also the least demanding game in the catalogue. There is no role to
 * remember, no turn order to follow, and nothing to lose by joining late. Two
 * taps a round.
 *
 * ## The two scores, and why they're different sizes
 *
 * Finding the truth is worth 2. Fooling one person is worth 1 each.
 *
 * Those numbers matter. If fooling were worth as much as finding, the
 * dominant strategy would be to write something wild, ignore the options and
 * click at random — and the game would stop being about judgement. As it is,
 * a lie that fools two people beats a correct answer, which keeps writing
 * worth doing, but you cannot win on lies alone in a table of four.
 *
 * ## Writing the truth by accident
 *
 * Someone will occasionally type the real answer. Their entry can't go on the
 * board — it would appear twice — so they get the truth bonus plus one, and
 * the table is told it happened. Silently dropping their answer instead would
 * look exactly like the game losing their submission, which is the single
 * worst thing a game like this can appear to do.
 */

export type BluffPhase =
  | "lobby"
  /** Everyone invents an answer. */
  | "writing"
  /** Every answer, plus the truth, shuffled. Everyone picks one. */
  | "choosing"
  | "reveal"
  | "game_over";

const SCORE = {
  /** For picking the true answer. */
  truth: 2,
  /** Per player who picked your lie. */
  fooled: 1,
  /** For typing the true answer yourself, before seeing it. */
  accidentalTruth: 3,
} as const;

const WRITE_SECONDS = 60;
const CHOOSE_SECONDS = 45;
const REVEAL_SECONDS = 14;

/** What the table sees about each player. Never their own lie, mid-round. */
export interface BluffSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Has an answer in this round. Not *which* answer. */
  hasWritten: boolean;
  hasChosen: boolean;
  /** Points from the round just revealed, for the scoreboard animation. */
  roundPoints: number;
}

/** One entry on the board during `choosing`. Authorship is hidden. */
export interface BluffOption {
  id: string;
  text: string;
}

export interface BluffRevealEntry {
  id: string;
  text: string;
  isTruth: boolean;
  /** Who wrote it — null for the truth itself. */
  authorId: string | null;
  authorName: string | null;
  /** Who picked it. */
  pickedBy: Array<{ playerId: string; name: string }>;
}

export interface BluffReveal {
  prompt: string;
  answer: string;
  entries: BluffRevealEntry[];
  /** Players who typed the true answer before seeing it. */
  accidentalTruthIds: string[];
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface BluffState {
  roomId: string;
  gameId: "bluff";
  phase: BluffPhase;
  maxPlayers: number;
  players: Array<{
    id: string;
    name: string;
    isBot: boolean;
    isHost: boolean;
    isConnected: boolean;
    flag?: string;
    cardCount: number;
    hand: never[];
  }>;
  seats: BluffSeat[];
  roundNumber: number;
  totalRounds: number;
  /**
   * The language the room is playing in.
   *
   * This is a room setting rather than a per-viewer one, and it has to be: the
   * true answer sits on the board next to answers players typed themselves. If
   * the truth rendered in each viewer's own language, an Arabic table would see
   * one English option among six Arabic ones and the game would be over before
   * anyone read it.
   */
  language: "en" | "ar";
  /** The sentence with the blank. Public from the moment writing opens. */
  prompt: string | null;
  /** Shuffled entries, during `choosing` only. */
  options: BluffOption[];
  deadline: number | null;
  reveal: BluffReveal | null;
  winnerId: string | null;
}

/** Private slice: what you wrote, and which option is yours. */
export interface BluffPrivate {
  myAnswer: string | null;
  /** The option id you must not be allowed to pick — your own. */
  myOptionId: string | null;
  myChoiceId: string | null;
}

interface Entry {
  id: string;
  text: string;
  isTruth: boolean;
  /** Everyone who wrote this exact answer. Two players can write the same lie. */
  authorIds: string[];
}

export class BluffGame implements GameRoom {
  readonly gameId = "bluff";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: BluffPhase = "lobby";
  readonly totalRounds: number;

  private deck: BluffPrompt[] = [];
  private roundNumber = 0;
  private prompt: BluffPrompt | null = null;

  /** playerId -> what they typed, as typed. */
  private answers = new Map<string, string>();
  /** playerId -> entry id they picked. */
  private choices = new Map<string, string>();
  private entries: Entry[] = [];
  private accidentalTruthIds: string[] = [];

  private scores = new Map<string, number>();
  private roundPoints = new Map<string, number>();

  private deadline: number | null = null;
  private reveal: BluffReveal | null = null;
  private winnerId: string | null = null;

  private phaseTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private callbacks: GameRoomCallbacks;

  readonly language: "en" | "ar";

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks,
    totalRounds = 5,
    language: "en" | "ar" = "ar",
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(3, Math.min(10, maxPlayers || 8));
    this.totalRounds = Math.max(3, Math.min(12, totalRounds));
    this.language = language === "en" ? "en" : "ar";
    this.callbacks = callbacks;
    this.lastActivityAt = Date.now();
  }

  // ---------------------------------------------------------------- roster

  addPlayer(
    name: string,
    socketId: string,
    isHost = false,
    playerId?: string,
    flag?: string,
  ): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    if (flag) player.flag = flag;
    this.players.push(player);
    if (!this.scores.has(id)) this.scores.set(id, 0);
    this.lastActivityAt = Date.now();
    return player;
  }

  /**
   * No bots. A bot's contribution would be a lie convincing enough to fool
   * people who know each other — which is the whole game, not a supporting
   * task — and its guess would be a coin flip dressed as a player.
   */
  addBot(name: string): Player {
    return new Player("bot_" + nanoid(6), name, true, false);
  }

  removeBot(): boolean {
    return false;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    player.isConnected = false;
    player.socketId = undefined;
    this.lastActivityAt = Date.now();

    // A phone in a tunnel must not hold the round open: whoever is left may
    // now be the whole table.
    if (this.phase === "writing") this.checkWritingComplete();
    else if (this.phase === "choosing") this.checkChoicesComplete();

    this.broadcast();
    return player;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    player.isConnected = true;
    player.socketId = socketId;
    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
    return player;
  }

  canStart(): boolean {
    return this.players.length >= 3;
  }

  // ------------------------------------------------------------- lifecycle

  startGame(): boolean {
    if (!this.canStart()) return false;
    this.deck = dealPrompts(this.totalRounds);
    this.roundNumber = 0;
    this.winnerId = null;
    for (const player of this.players) this.scores.set(player.id, 0);
    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;
    this.clearTimer();

    const next = this.deck[this.roundNumber];
    if (!next) {
      this.endMatch();
      return;
    }

    this.roundNumber++;
    this.prompt = next;
    this.phase = "writing";
    this.reveal = null;
    this.answers.clear();
    this.choices.clear();
    this.entries = [];
    this.accidentalTruthIds = [];
    this.roundPoints.clear();

    this.setDeadline(WRITE_SECONDS, () => this.beginChoosing());
    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  // ---------------------------------------------------------------- actions

  /** Invent an answer. Re-submitting before the deadline replaces it. */
  submitAnswer(playerId: string, answer: string): { success: boolean; error?: string } {
    if (this.phase !== "writing") return { success: false, error: "Not the writing phase" };
    if (!this.getPlayer(playerId)) return { success: false, error: "Player not found" };

    const text = answer.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!text) return { success: false, error: "Write something" };

    this.answers.set(playerId, text);
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.checkWritingComplete();
    return { success: true };
  }

  private checkWritingComplete(): void {
    const expected = this.players.filter((p) => p.isConnected && !p.isBot);
    if (expected.length > 0 && expected.every((p) => this.answers.has(p.id))) {
      this.beginChoosing();
    }
  }

  private beginChoosing(): void {
    if (this.destroyed || !this.prompt) return;
    this.clearTimer();

    const truth = normalise(this.prompt.answer.en);
    const truthAr = normalise(this.prompt.answer.ar);

    // Group identical lies into one entry. Two people writing "Sudan" must
    // produce one option — listing it twice tells the table which answers are
    // popular, which is information the game never meant to give away.
    const byText = new Map<string, Entry>();
    this.accidentalTruthIds = [];

    for (const [playerId, text] of this.answers) {
      const key = normalise(text);
      if (!key) continue;
      if (key === truth || key === truthAr) {
        this.accidentalTruthIds.push(playerId);
        continue;
      }
      const existing = byText.get(key);
      if (existing) {
        existing.authorIds.push(playerId);
      } else {
        byText.set(key, {
          id: nanoid(6),
          text,
          isTruth: false,
          authorIds: [playerId],
        });
      }
    }

    const truthEntry: Entry = {
      id: nanoid(6),
      text: this.prompt.answer[this.language],
      isTruth: true,
      authorIds: [],
    };

    this.entries = [...byText.values(), truthEntry];
    for (let i = this.entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.entries[i], this.entries[j]] = [this.entries[j], this.entries[i]];
    }

    this.phase = "choosing";
    this.setDeadline(CHOOSE_SECONDS, () => this.finishRound());
    // Push private state, not just the broadcast: `myOptionId` — the one
    // option you're not allowed to pick — only exists once the entries are
    // built, and this is the moment they are. Without it, a writing phase that
    // ends on the *timer* rather than on the last submission leaves everyone
    // able to tap their own lie and get an error they can't explain.
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  /** Pick the answer you believe. Not your own. */
  choose(playerId: string, optionId: string): { success: boolean; error?: string } {
    if (this.phase !== "choosing") return { success: false, error: "Not the choosing phase" };
    if (!this.getPlayer(playerId)) return { success: false, error: "Player not found" };
    if (this.choices.has(playerId)) return { success: false, error: "You already chose" };

    const entry = this.entries.find((e) => e.id === optionId);
    if (!entry) return { success: false, error: "No such answer" };
    if (entry.authorIds.includes(playerId)) {
      return { success: false, error: "That's your own answer" };
    }

    this.choices.set(playerId, optionId);
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.checkChoicesComplete();
    return { success: true };
  }

  private checkChoicesComplete(): void {
    // Someone whose own lie is the only entry they could not pick still has to
    // pick; someone who wrote the truth by accident has nothing of their own
    // on the board and picks normally. So everyone connected is expected.
    const expected = this.players.filter((p) => p.isConnected && !p.isBot);
    if (expected.length > 0 && expected.every((p) => this.choices.has(p.id))) {
      this.finishRound();
    }
  }

  private finishRound(): void {
    if (this.destroyed || !this.prompt) return;
    this.clearTimer();
    this.phase = "reveal";
    this.deadline = null;

    const points: Record<string, number> = {};
    const add = (id: string, value: number) => {
      points[id] = (points[id] ?? 0) + value;
    };

    for (const id of this.accidentalTruthIds) {
      add(id, SCORE.accidentalTruth);
    }

    const pickedByEntry = new Map<string, Array<{ playerId: string; name: string }>>();
    for (const [playerId, entryId] of this.choices) {
      const player = this.getPlayer(playerId);
      if (!player) continue;
      const list = pickedByEntry.get(entryId) ?? [];
      list.push({ playerId, name: player.name });
      pickedByEntry.set(entryId, list);
    }

    for (const entry of this.entries) {
      const picked = pickedByEntry.get(entry.id) ?? [];
      if (entry.isTruth) {
        for (const p of picked) add(p.playerId, SCORE.truth);
      } else {
        // Everyone who wrote this lie is paid for everyone it fooled. Shared
        // lies pay in full to each author rather than splitting: two people
        // landing on the same good lie both had the good idea.
        for (const authorId of entry.authorIds) {
          if (picked.length > 0) add(authorId, SCORE.fooled * picked.length);
        }
      }
    }

    for (const [id, value] of Object.entries(points)) {
      this.scores.set(id, (this.scores.get(id) ?? 0) + value);
      this.roundPoints.set(id, value);
    }

    const over = this.roundNumber >= this.deck.length;

    this.reveal = {
      prompt: this.prompt.text[this.language],
      answer: this.prompt.answer[this.language],
      entries: this.entries.map((entry) => {
        const author = entry.authorIds[0] ? this.getPlayer(entry.authorIds[0]) : null;
        const extra = entry.authorIds.length - 1;
        return {
          id: entry.id,
          text: entry.text,
          isTruth: entry.isTruth,
          authorId: entry.authorIds[0] ?? null,
          authorName: author
            ? extra > 0
              ? `${author.name} +${extra}`
              : author.name
            : null,
          pickedBy: pickedByEntry.get(entry.id) ?? [],
        };
      }),
      accidentalTruthIds: [...this.accidentalTruthIds],
      pointsAwarded: points,
      nextRoundAt: over ? null : Date.now() + REVEAL_SECONDS * 1000,
    };

    this.lastActivityAt = Date.now();
    // The reveal makes every answer's author public, so the private slice has
    // to go back out or a player's own screen still thinks a round is running.
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();

    this.phaseTimer = setTimeout(
      () => (over ? this.endMatch() : this.startRound()),
      REVEAL_SECONDS * 1000,
    );
  }

  private endMatch(): void {
    if (this.destroyed) return;
    this.clearTimer();
    this.phase = "game_over";
    this.deadline = null;

    let best: { id: string; score: number } | null = null;
    for (const [id, score] of this.scores) {
      if (!best || score > best.score) best = { id, score };
    }
    this.winnerId = best?.id ?? null;

    this.broadcast();
    if (this.winnerId) this.callbacks.onGameEnd(this.roomId, this.winnerId);
  }

  rematch(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) return { success: false, error: "Only the host can restart" };
    if (this.phase !== "game_over") return { success: false, error: "Game isn't over" };
    this.startGame();
    return { success: true };
  }

  // ------------------------------------------------------------------ state

  private setDeadline(seconds: number, onExpire: () => void): void {
    this.clearTimer();
    this.deadline = Date.now() + seconds * 1000;
    this.phaseTimer = setTimeout(onExpire, seconds * 1000);
  }

  private broadcast(): void {
    if (this.destroyed) return;
    this.callbacks.broadcast(this.toState());
  }

  toState(): BluffState {
    return {
      roomId: this.roomId,
      gameId: "bluff",
      phase: this.phase,
      maxPlayers: this.maxPlayers,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: p.isHost,
        isConnected: p.isConnected,
        flag: p.flag,
        cardCount: 0,
        hand: [] as never[],
      })),
      seats: this.players.map((p) => ({
        playerId: p.id,
        name: p.name,
        isConnected: p.isConnected,
        flag: p.flag,
        score: this.scores.get(p.id) ?? 0,
        hasWritten: this.answers.has(p.id),
        hasChosen: this.choices.has(p.id),
        roundPoints: this.roundPoints.get(p.id) ?? 0,
      })),
      roundNumber: this.roundNumber,
      totalRounds: this.deck.length || this.totalRounds,
      language: this.language,
      prompt: this.prompt ? this.prompt.text[this.language] : null,
      // Entries exist from the moment writing closes, but authorship never
      // rides on the public broadcast — only the text and an opaque id.
      options:
        this.phase === "choosing"
          ? this.entries.map((e) => ({ id: e.id, text: e.text }))
          : [],
      deadline: this.deadline,
      reveal: this.reveal,
      winnerId: this.winnerId,
    };
  }

  toPlayerState(playerId: string): BluffState & BluffPrivate {
    const base = this.toState();
    const mine = this.entries.find((e) => e.authorIds.includes(playerId));
    return {
      ...base,
      myAnswer: this.answers.get(playerId) ?? null,
      myOptionId: this.phase === "choosing" ? (mine?.id ?? null) : null,
      myChoiceId: this.choices.get(playerId) ?? null,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }
}
