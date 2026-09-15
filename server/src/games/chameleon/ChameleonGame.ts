import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import { pickTopic, type ChameleonTopic } from "./topics.js";

/**
 * Chameleon — الحرباية.
 *
 * Everyone sees a 4×4 grid of related words. Everyone except the chameleon
 * also knows which one is the secret word. Going around the table, each player
 * says exactly one word about it. Then everyone votes for who they think
 * didn't know.
 *
 * ## The shape of the tension
 *
 * The game is a squeeze, and both sides feel it:
 *
 * - **If your clue is too vague**, you look like the chameleon.
 * - **If your clue is too specific**, the chameleon simply learns the word and
 *   wins by naming it after they're caught.
 *
 * That second rule is what makes this a game rather than a vote. A caught
 * chameleon still gets one guess at the word, so the innocents are punished
 * for having been *too* clear — which means every clue is a real decision
 * rather than a formality. It is also why the losing side never feels cheated:
 * whichever way it goes, somebody made a specific choice that caused it.
 *
 * ## Why it's cheap to build and good to play here
 *
 * Like Spyfall, the game is conversation — one word each, spoken aloud, in the
 * voice channel that already exists. The engine deals a secret, collects
 * votes, and arbitrates one guess. All the value is in the topic grids, which
 * are content rather than code (see topics.ts for what makes a grid work).
 *
 * Rounds are short: a full round is typically 90 seconds. That makes it the
 * best game in the catalogue for the awkward moment when a group is deciding
 * whether to keep playing — it costs nothing to say yes to one more.
 */

export type ChameleonPhase =
  | "lobby"
  /** Everyone reads their card and says their clue out loud. */
  | "clues"
  /** Everyone picks who they think the chameleon is. */
  | "voting"
  /** The chameleon was caught and gets one guess at the word. */
  | "guessing"
  | "reveal"
  | "game_over";

const SCORE = {
  /** Each innocent, when the chameleon is caught AND fails to guess. */
  caught: 2,
  /** The chameleon, when the vote picks someone else. */
  escaped: 2,
  /** The chameleon, when caught but they name the word anyway. */
  caughtButGuessed: 1,
} as const;

const CLUE_SECONDS = 90;
const VOTE_SECONDS = 45;
const GUESS_SECONDS = 25;
const REVEAL_SECONDS = 10;

export interface ChameleonSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Their spoken clue, typed in so latecomers and the deaf can follow. */
  clue: string | null;
  /** Who they voted for this round. Public once voting closes. */
  votedFor: string | null;
  hasVoted: boolean;
}

export interface ChameleonReveal {
  chameleonId: string;
  chameleonName: string;
  secretIndex: number;
  secretWord: { en: string; ar: string };
  /** Who the table voted out, or null on a tie. */
  votedOutId: string | null;
  votedOutName: string | null;
  caught: boolean;
  /** Index the chameleon guessed, when they got to guess. */
  guessedIndex: number | null;
  guessedRight: boolean;
  chameleonWon: boolean;
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface ChameleonState {
  roomId: string;
  gameId: "chameleon";
  phase: ChameleonPhase;
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
  seats: ChameleonSeat[];
  roundNumber: number;
  targetScore: number;
  /** The grid. Public — everyone sees all sixteen words. */
  topic: { id: string; title: { en: string; ar: string }; words: Array<{ en: string; ar: string }> } | null;
  /** Whose turn it is to give a clue. */
  cluePlayerId: string | null;
  deadline: number | null;
  reveal: ChameleonReveal | null;
  winnerId: string | null;
}

/** Private slice: whether you're the chameleon, and the word if you're not. */
export interface ChameleonPrivate {
  isChameleon: boolean;
  /** Index into the topic grid, or null for the chameleon. */
  secretIndex: number | null;
}

export class ChameleonGame implements GameRoom {
  readonly gameId = "chameleon";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: ChameleonPhase = "lobby";
  readonly targetScore: number;

  private roundNumber = 0;
  private topic: ChameleonTopic | null = null;
  private secretIndex: number | null = null;
  private chameleonId: string | null = null;

  private clues = new Map<string, string>();
  private votes = new Map<string, string>();
  private scores = new Map<string, number>();
  private clueOrder: string[] = [];
  private clueCursor = 0;

  private deadline: number | null = null;
  private reveal: ChameleonReveal | null = null;
  private winnerId: string | null = null;

  private phaseTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private callbacks: GameRoomCallbacks;

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks,
    targetScore = 8,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(3, Math.min(10, maxPlayers || 8));
    this.targetScore = Math.max(4, Math.min(30, targetScore));
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

  /** No bots: a bot would have to invent a one-word clue and judge others'. */
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

    // Don't let one dropout stall the round: if we were waiting on them, move
    // on. Waiting for a phone that's gone into a tunnel is how a 90-second
    // game turns into three minutes of silence.
    if (this.phase === "clues" && this.currentCluePlayer() === player.id) {
      this.advanceClue();
    } else if (this.phase === "voting") {
      this.checkVotesComplete();
    }

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
    this.roundNumber = 0;
    this.winnerId = null;
    for (const player of this.players) this.scores.set(player.id, 0);
    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;
    this.clearTimer();

    this.roundNumber++;
    this.phase = "clues";
    this.reveal = null;
    this.clues.clear();
    this.votes.clear();

    this.topic = pickTopic();
    this.secretIndex = Math.floor(Math.random() * this.topic.words.length);

    const pool = this.players.filter((p) => p.isConnected);
    const eligible = pool.length >= 3 ? pool : this.players;
    this.chameleonId = eligible[Math.floor(Math.random() * eligible.length)].id;

    // Clue order is shuffled every round. With a fixed order, going last is a
    // large and permanent advantage — you hear everyone else first — and the
    // same player would hold it all night.
    this.clueOrder = [...eligible]
      .map((p) => p.id)
      .sort(() => Math.random() - 0.5);
    this.clueCursor = 0;

    this.setDeadline(CLUE_SECONDS, () => this.beginVoting());
    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  private currentCluePlayer(): string | null {
    return this.clueOrder[this.clueCursor] ?? null;
  }

  // ---------------------------------------------------------------- actions

  /**
   * Record your clue.
   *
   * The clue is *spoken* — this is a voice game — but it's typed in as well so
   * that the table has a record to argue over, latecomers can catch up, and
   * players who can't hear well aren't excluded from the one piece of
   * information the game runs on.
   */
  submitClue(playerId: string, clue: string): { success: boolean; error?: string } {
    if (this.phase !== "clues") return { success: false, error: "Not the clue phase" };
    if (this.currentCluePlayer() !== playerId) {
      return { success: false, error: "Wait for your turn" };
    }

    // One word. The entire design rests on a single word being all you get;
    // a sentence lets an innocent be unambiguous at no risk, which removes
    // the squeeze the game is built on.
    const word = clue.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!word) return { success: false, error: "Say something" };
    if (word.includes(" ")) return { success: false, error: "One word only" };

    this.clues.set(playerId, word);
    this.lastActivityAt = Date.now();
    this.advanceClue();
    return { success: true };
  }

  private advanceClue(): void {
    this.clueCursor++;
    if (this.clueCursor >= this.clueOrder.length) {
      this.beginVoting();
      return;
    }
    this.broadcast();
  }

  private beginVoting(): void {
    if (this.destroyed) return;
    this.phase = "voting";
    this.setDeadline(VOTE_SECONDS, () => this.resolveVotes());
    this.broadcast();
  }

  vote(playerId: string, targetId: string): { success: boolean; error?: string } {
    if (this.phase !== "voting") return { success: false, error: "Not the voting phase" };
    if (playerId === targetId) return { success: false, error: "You can't vote for yourself" };
    if (!this.getPlayer(targetId)) return { success: false, error: "Player not found" };
    if (this.votes.has(playerId)) return { success: false, error: "You already voted" };

    this.votes.set(playerId, targetId);
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.checkVotesComplete();
    return { success: true };
  }

  private checkVotesComplete(): void {
    const voters = this.players.filter((p) => p.isConnected);
    if (this.votes.size >= voters.length) this.resolveVotes();
  }

  private resolveVotes(): void {
    if (this.destroyed || !this.topic || this.secretIndex === null || !this.chameleonId) {
      return;
    }
    this.clearTimer();

    const tally = new Map<string, number>();
    for (const target of this.votes.values()) {
      tally.set(target, (tally.get(target) ?? 0) + 1);
    }

    let top: string | null = null;
    let topCount = 0;
    let tied = false;
    for (const [id, count] of tally) {
      if (count > topCount) {
        top = id;
        topCount = count;
        tied = false;
      } else if (count === topCount) {
        tied = true;
      }
    }

    // A tie means the table failed to agree, which counts as the chameleon
    // getting away with it — they only had to create doubt, not conviction.
    const caught = !tied && top === this.chameleonId;

    if (caught) {
      // Caught, but not beaten yet: one guess at the word. This is what
      // punishes innocents for clues that were too specific, and it's why
      // every clue is a real decision.
      this.phase = "guessing";
      this.setDeadline(GUESS_SECONDS, () => this.finishRound(top, true, null));
      this.broadcast();
      return;
    }

    this.finishRound(tied ? null : top, false, null);
  }

  /** The caught chameleon names the word. */
  guessWord(playerId: string, index: number): { success: boolean; error?: string } {
    if (this.phase !== "guessing") return { success: false, error: "Not the guessing phase" };
    if (playerId !== this.chameleonId) return { success: false, error: "You're not the chameleon" };
    if (!this.topic) return { success: false, error: "No round running" };
    if (!Number.isInteger(index) || index < 0 || index >= this.topic.words.length) {
      return { success: false, error: "Pick a word from the grid" };
    }
    this.finishRound(playerId, true, index);
    return { success: true };
  }

  private finishRound(
    votedOutId: string | null,
    caught: boolean,
    guessedIndex: number | null,
  ): void {
    if (this.destroyed || !this.topic || this.secretIndex === null || !this.chameleonId) {
      return;
    }
    this.clearTimer();
    this.phase = "reveal";
    this.deadline = null;

    const guessedRight = guessedIndex !== null && guessedIndex === this.secretIndex;
    const points: Record<string, number> = {};
    let chameleonWon: boolean;

    if (!caught) {
      chameleonWon = true;
      points[this.chameleonId] = SCORE.escaped;
    } else if (guessedRight) {
      // Caught but salvaged it — worth less than escaping cleanly.
      chameleonWon = true;
      points[this.chameleonId] = SCORE.caughtButGuessed;
    } else {
      chameleonWon = false;
      for (const player of this.players) {
        if (player.id !== this.chameleonId) points[player.id] = SCORE.caught;
      }
    }

    for (const [id, value] of Object.entries(points)) {
      this.scores.set(id, (this.scores.get(id) ?? 0) + value);
    }

    const chameleon = this.getPlayer(this.chameleonId);
    const votedOut = votedOutId ? this.getPlayer(votedOutId) : null;
    const over = this.checkGameOver();

    this.reveal = {
      chameleonId: this.chameleonId,
      chameleonName: chameleon?.name ?? "—",
      secretIndex: this.secretIndex,
      secretWord: this.topic.words[this.secretIndex],
      votedOutId,
      votedOutName: votedOut?.name ?? null,
      caught,
      guessedIndex,
      guessedRight,
      chameleonWon,
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
    this.phaseTimer = setTimeout(() => this.startRound(), REVEAL_SECONDS * 1000);
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

  private setDeadline(seconds: number, onExpire: () => void): void {
    this.clearTimer();
    this.deadline = Date.now() + seconds * 1000;
    this.phaseTimer = setTimeout(onExpire, seconds * 1000);
  }

  private broadcast(): void {
    if (this.destroyed) return;
    this.callbacks.broadcast(this.toState());
  }

  toState(): ChameleonState {
    // Votes stay hidden until voting closes. Visible running votes turn the
    // phase into a bandwagon: two early votes and everyone piles on, which
    // removes the deliberation that is the point of it.
    const votesPublic = this.phase !== "voting";

    return {
      roomId: this.roomId,
      gameId: "chameleon",
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
        clue: this.clues.get(p.id) ?? null,
        votedFor: votesPublic ? (this.votes.get(p.id) ?? null) : null,
        hasVoted: this.votes.has(p.id),
      })),
      roundNumber: this.roundNumber,
      targetScore: this.targetScore,
      topic: this.topic
        ? { id: this.topic.id, title: this.topic.title, words: this.topic.words }
        : null,
      cluePlayerId: this.phase === "clues" ? this.currentCluePlayer() : null,
      deadline: this.deadline,
      reveal: this.reveal,
      winnerId: this.winnerId,
    };
  }

  toPlayerState(playerId: string): ChameleonState & ChameleonPrivate {
    const base = this.toState();
    const secretLive =
      this.phase === "clues" || this.phase === "voting" || this.phase === "guessing";
    const isChameleon = playerId === this.chameleonId;

    if (!secretLive) {
      return { ...base, isChameleon, secretIndex: null };
    }

    return {
      ...base,
      isChameleon,
      secretIndex: isChameleon ? null : this.secretIndex,
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
