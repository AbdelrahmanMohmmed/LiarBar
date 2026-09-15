import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import {
  LOCATIONS,
  locationList,
  pickLocation,
  type SpyfallLocation,
} from "./locations.js";

/**
 * Spyfall — برا اللعبة.
 *
 * Everyone at the table is given the same location and a role at it. One
 * player is the spy: they get no location, only the list of possibilities.
 * Players question each other about the place. The spy has to work out where
 * they are without giving themselves away; everyone else has to identify the
 * spy without describing the location so precisely that the spy simply learns
 * it from the answers.
 *
 * ## Why this game, on this product
 *
 * It is the best possible fit for what this product actually is. Spyfall is
 * **entirely conversation** — there is no board, no pieces, and almost no
 * state. The engine deals a secret and runs a clock; the game itself happens
 * in the voice channel that is already built, always on, and (as of the party
 * rewrite) never drops.
 *
 * That also makes it the cheapest game in the catalogue by a wide margin: this
 * file is a few hundred lines and there is no UI to speak of. The value comes
 * almost entirely from the location list, which is content, not code.
 *
 * ## The three ways a round ends
 *
 * 1. **The spy is voted out.** Everyone else scores.
 * 2. **An innocent is voted out.** The spy scores heavily — a wrong accusation
 *    is punished harder than running out of time, which is what stops the
 *    table from accusing someone at random the moment the clock gets low.
 * 3. **The spy guesses the location.** Biggest score of all, and it can be
 *    done at any moment, which means the non-spies can never relax into
 *    obvious answers just because nobody suspects them yet.
 *
 * Running out of time with nobody accused is a win for the spy, but a small
 * one. Surviving is worth less than winning.
 */

export type SpyfallPhase = "lobby" | "playing" | "voting" | "reveal" | "game_over";

/** Points, tuned so that the risky play is the rewarded one. */
const SCORE = {
  /** Each non-spy, when the spy is caught. */
  spyCaught: 1,
  /** The spy, when an innocent is voted out. */
  wrongAccusation: 3,
  /** The spy, when they correctly name the location. */
  spyGuessedRight: 4,
  /** The spy, when the clock simply runs out. */
  spySurvived: 2,
} as const;

export interface SpyfallVote {
  voterId: string;
  targetId: string;
}

export interface SpyfallReveal {
  reason: "voted" | "spy_guessed" | "timeout";
  spyId: string;
  spyName: string;
  /** Who the table accused, if anyone. */
  accusedId: string | null;
  accusedName: string | null;
  locationId: string;
  locationName: { en: string; ar: string };
  /** What the spy guessed, when they guessed. */
  guessedLocationId: string | null;
  spyWon: boolean;
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface SpyfallPlayerView {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Has this player used their one accusation this round? */
  hasAccused: boolean;
  /** Who they voted for in the current vote, if anyone. */
  votedFor: string | null;
}

export interface SpyfallState {
  roomId: string;
  gameId: "spyfall";
  phase: SpyfallPhase;
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
  seats: SpyfallPlayerView[];
  roundNumber: number;
  roundSeconds: number;
  /** Absolute ms when the round ends, or null when not running. */
  roundEndsAt: number | null;
  /** Whose turn it is to ask a question. Advisory: the game is spoken. */
  askingPlayerId: string | null;
  /** All location names — everyone sees these; the spy guesses from them. */
  locations: Array<{ id: string; name: { en: string; ar: string } }>;
  /** An accusation in progress. */
  vote: {
    accuserId: string;
    accuserName: string;
    targetId: string;
    targetName: string;
    /** Votes cast so far, excluding the accused. */
    votes: SpyfallVote[];
    /** How many yes-votes convict. */
    needed: number;
    endsAt: number;
  } | null;
  reveal: SpyfallReveal | null;
  winnerId: string | null;
  targetScore: number;
}

/** Private slice: your location and role, or the fact that you're the spy. */
export interface SpyfallPrivate {
  isSpy: boolean;
  locationId: string | null;
  locationName: { en: string; ar: string } | null;
  role: { en: string; ar: string } | null;
}

const VOTE_WINDOW_MS = 45_000;
const REVEAL_SECONDS = 12;

export class SpyfallGame implements GameRoom {
  readonly gameId = "spyfall";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: SpyfallPhase = "lobby";

  readonly roundSeconds: number;
  readonly targetScore: number;

  private roundNumber = 0;
  private roundEndsAt: number | null = null;
  private askingPlayerId: string | null = null;

  private spyId: string | null = null;
  private location: SpyfallLocation | null = null;
  private roles = new Map<string, { en: string; ar: string }>();
  private scores = new Map<string, number>();
  private accusedThisRound = new Set<string>();

  private vote: SpyfallState["vote"] = null;
  private reveal: SpyfallReveal | null = null;
  private winnerId: string | null = null;

  private roundTimer: NodeJS.Timeout | null = null;
  private voteTimer: NodeJS.Timeout | null = null;
  private revealTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  private callbacks: GameRoomCallbacks;

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks,
    roundSeconds = 480,
    targetScore = 6,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(3, Math.min(10, maxPlayers || 8));
    this.roundSeconds = Math.max(120, Math.min(900, roundSeconds));
    this.targetScore = Math.max(3, Math.min(20, targetScore));
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
   * Spyfall has no bots and cannot have one.
   *
   * The entire game is unstructured conversation: a bot would have to ask a
   * plausible question about a location, evaluate a spoken answer, and lie
   * convincingly under questioning. A bot that just sits silently is worse
   * than an empty seat, because it looks like a player who has stopped
   * responding and the table wastes the round suspecting it.
   */
  addBot(name: string): Player {
    const player = new Player("bot_" + nanoid(6), name, true, false);
    // Not added to this.players on purpose — see above.
    return player;
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
    this.broadcast();
    return player;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    player.isConnected = true;
    player.socketId = socketId;
    this.lastActivityAt = Date.now();
    // Re-send their secret; they lost it when the tab reloaded.
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
    this.roundNumber = 0;
    this.winnerId = null;
    for (const player of this.players) this.scores.set(player.id, 0);
    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;
    this.clearTimers();

    this.roundNumber++;
    this.phase = "playing";
    this.reveal = null;
    this.vote = null;
    this.accusedThisRound.clear();

    const connected = this.players.filter((p) => p.isConnected);
    const pool = connected.length >= 3 ? connected : this.players;

    this.location = pickLocation();
    this.spyId = pool[Math.floor(Math.random() * pool.length)].id;

    // Deal roles. Shuffled so the same person doesn't get the same role every
    // time the same location comes up, which would leak information.
    const shuffledRoles = [...this.location.roles].sort(() => Math.random() - 0.5);
    this.roles.clear();
    let i = 0;
    for (const player of this.players) {
      if (player.id === this.spyId) continue;
      this.roles.set(player.id, shuffledRoles[i % shuffledRoles.length]);
      i++;
    }

    // Whoever asks first is random, and it rotates from there. The order is
    // advisory — the game is spoken and a table will ignore it the moment it
    // gets interesting, which is fine and expected. It exists so the first
    // thirty seconds aren't four people waiting for someone else to start.
    this.askingPlayerId = pool[Math.floor(Math.random() * pool.length)].id;

    this.roundEndsAt = Date.now() + this.roundSeconds * 1000;
    this.roundTimer = setTimeout(() => this.endRound("timeout", null), this.roundSeconds * 1000);

    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  // ---------------------------------------------------------------- actions

  /** Hand the questioning to someone else. Advisory, and anyone can do it. */
  passQuestion(playerId: string, toPlayerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Round isn't running" };
    if (this.askingPlayerId !== playerId) {
      return { success: false, error: "It's not your question" };
    }
    const target = this.getPlayer(toPlayerId);
    if (!target || target.id === playerId) {
      return { success: false, error: "Pick someone else" };
    }
    this.askingPlayerId = toPlayerId;
    this.lastActivityAt = Date.now();
    this.broadcast();
    return { success: true };
  }

  /**
   * Accuse someone.
   *
   * One accusation per player per round. Without that cap, one player can
   * repeatedly accuse everyone until something sticks, which turns a game of
   * reading people into a brute-force search and wastes the whole round.
   */
  accuse(accuserId: string, targetId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing") return { success: false, error: "Round isn't running" };
    if (this.vote) return { success: false, error: "A vote is already running" };
    if (this.accusedThisRound.has(accuserId)) {
      return { success: false, error: "You've already accused someone this round" };
    }
    const accuser = this.getPlayer(accuserId);
    const target = this.getPlayer(targetId);
    if (!accuser || !target) return { success: false, error: "Player not found" };
    if (accuserId === targetId) return { success: false, error: "You can't accuse yourself" };

    this.accusedThisRound.add(accuserId);

    // Everyone except the accused must agree. Unanimity among the rest is
    // deliberately hard: it means the table has to actually be convinced, and
    // it makes a wrong accusation a genuine group failure rather than one
    // person's mistake.
    const eligible = this.players.filter((p) => p.id !== targetId && p.isConnected);

    this.phase = "voting";
    this.vote = {
      accuserId,
      accuserName: accuser.name,
      targetId,
      targetName: target.name,
      votes: [{ voterId: accuserId, targetId }],
      needed: eligible.length,
      endsAt: Date.now() + VOTE_WINDOW_MS,
    };

    this.clearVoteTimer();
    this.voteTimer = setTimeout(() => this.resolveVote(false), VOTE_WINDOW_MS);

    this.lastActivityAt = Date.now();
    this.broadcast();
    this.checkVoteComplete();
    return { success: true };
  }

  castVote(voterId: string, agree: boolean): { success: boolean; error?: string } {
    if (this.phase !== "voting" || !this.vote) {
      return { success: false, error: "No vote running" };
    }
    if (voterId === this.vote.targetId) {
      return { success: false, error: "You can't vote on your own accusation" };
    }
    if (this.vote.votes.some((v) => v.voterId === voterId)) {
      return { success: false, error: "You already voted" };
    }

    if (!agree) {
      // A single no ends it immediately. Waiting out the timer after someone
      // has said no adds nothing but dead air, and dead air in a game that is
      // entirely conversation is the one thing that kills it.
      this.vote.votes.push({ voterId, targetId: "" });
      this.resolveVote(false);
      return { success: true };
    }

    this.vote.votes.push({ voterId, targetId: this.vote.targetId });
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.checkVoteComplete();
    return { success: true };
  }

  private checkVoteComplete(): void {
    if (!this.vote) return;
    const yes = this.vote.votes.filter((v) => v.targetId !== "").length;
    if (yes >= this.vote.needed) this.resolveVote(true);
  }

  private resolveVote(convicted: boolean): void {
    if (!this.vote) return;
    const targetId = this.vote.targetId;
    this.clearVoteTimer();

    if (!convicted) {
      // Accusation failed; play resumes. The accuser has spent their one shot.
      this.vote = null;
      this.phase = "playing";
      this.lastActivityAt = Date.now();
      this.broadcast();
      return;
    }

    this.endRound("voted", targetId);
  }

  /**
   * The spy names the location. Endable at any moment, including during a
   * vote — a spy about to be convicted should be able to go out swinging.
   */
  guessLocation(playerId: string, locationId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing" && this.phase !== "voting") {
      return { success: false, error: "Round isn't running" };
    }
    if (playerId !== this.spyId) return { success: false, error: "You're not the spy" };
    if (!LOCATIONS.some((l) => l.id === locationId)) {
      return { success: false, error: "Unknown location" };
    }
    this.endRound("spy_guessed", null, locationId);
    return { success: true };
  }

  // ------------------------------------------------------------- round end

  private endRound(
    reason: SpyfallReveal["reason"],
    accusedId: string | null,
    guessedLocationId: string | null = null,
  ): void {
    if (this.destroyed || !this.location || !this.spyId) return;
    this.clearTimers();

    this.phase = "reveal";
    this.roundEndsAt = null;
    this.vote = null;

    const spy = this.getPlayer(this.spyId);
    const accused = accusedId ? this.getPlayer(accusedId) : null;
    const points: Record<string, number> = {};
    let spyWon: boolean;

    if (reason === "spy_guessed") {
      spyWon = guessedLocationId === this.location.id;
      if (spyWon) {
        points[this.spyId] = SCORE.spyGuessedRight;
      } else {
        // A wrong guess ends the round and hands it to everyone else — the
        // spy has revealed themselves for nothing.
        for (const player of this.players) {
          if (player.id !== this.spyId) points[player.id] = SCORE.spyCaught;
        }
      }
    } else if (reason === "voted") {
      spyWon = accusedId !== this.spyId;
      if (spyWon) {
        points[this.spyId] = SCORE.wrongAccusation;
      } else {
        for (const player of this.players) {
          if (player.id !== this.spyId) points[player.id] = SCORE.spyCaught;
        }
      }
    } else {
      // Ran out of time. The spy survived, which is worth something but
      // deliberately less than actually winning.
      spyWon = true;
      points[this.spyId] = SCORE.spySurvived;
    }

    for (const [id, value] of Object.entries(points)) {
      this.scores.set(id, (this.scores.get(id) ?? 0) + value);
    }

    const over = this.checkGameOver();

    this.reveal = {
      reason,
      spyId: this.spyId,
      spyName: spy?.name ?? "—",
      accusedId,
      accusedName: accused?.name ?? null,
      locationId: this.location.id,
      locationName: this.location.name,
      guessedLocationId,
      spyWon,
      pointsAwarded: points,
      nextRoundAt: over ? null : Date.now() + REVEAL_SECONDS * 1000,
    };

    this.lastActivityAt = Date.now();

    if (over) {
      this.phase = "game_over";
      this.broadcast();
      if (this.winnerId) this.callbacks.onGameEnd(this.roomId, this.winnerId);
      return;
    }

    this.broadcast();
    this.revealTimer = setTimeout(() => this.startRound(), REVEAL_SECONDS * 1000);
  }

  private checkGameOver(): boolean {
    let best: { id: string; score: number } | null = null;
    for (const [id, score] of this.scores) {
      if (!best || score > best.score) best = { id, score };
    }
    if (best && best.score >= this.targetScore) {
      this.winnerId = best.id;
      return true;
    }
    return false;
  }

  rematch(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) return { success: false, error: "Only the host can restart" };
    if (this.phase !== "game_over") return { success: false, error: "Game isn't over" };
    this.startGame();
    return { success: true };
  }

  // ------------------------------------------------------------------ state

  private broadcast(): void {
    if (this.destroyed) return;
    this.callbacks.broadcast(this.toState());
  }

  toState(): SpyfallState {
    return {
      roomId: this.roomId,
      gameId: "spyfall",
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
        hasAccused: this.accusedThisRound.has(p.id),
        votedFor:
          this.vote?.votes.find((v) => v.voterId === p.id)?.targetId || null,
      })),
      roundNumber: this.roundNumber,
      roundSeconds: this.roundSeconds,
      roundEndsAt: this.roundEndsAt,
      askingPlayerId: this.askingPlayerId,
      locations: locationList(),
      vote: this.vote,
      reveal: this.reveal,
      winnerId: this.winnerId,
      targetScore: this.targetScore,
    };
  }

  toPlayerState(playerId: string): SpyfallState & SpyfallPrivate {
    const base = this.toState();

    // Secrets are only withheld while they are still secret. Once the round is
    // over the reveal is public anyway, so there's nothing to protect.
    const roundLive = this.phase === "playing" || this.phase === "voting";
    const isSpy = playerId === this.spyId;

    if (!roundLive || !this.location) {
      return { ...base, isSpy, locationId: null, locationName: null, role: null };
    }

    if (isSpy) {
      return { ...base, isSpy: true, locationId: null, locationName: null, role: null };
    }

    return {
      ...base,
      isSpy: false,
      locationId: this.location.id,
      locationName: this.location.name,
      role: this.roles.get(playerId) ?? null,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    this.clearVoteTimer();
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }

  private clearVoteTimer(): void {
    if (this.voteTimer) {
      clearTimeout(this.voteTimer);
      this.voteTimer = null;
    }
  }
}
