import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import { pickDilemma, type Dilemma } from "./dilemmas.js";

/**
 * Would You Rather — لو خيروك.
 *
 * ## The twist that makes it a game
 *
 * The obvious version of this is a poll: show two options, everyone votes, look
 * at the split. That's a conversation starter, not a game — nobody wins, so
 * there's no reason to have opinions about anyone else's answer.
 *
 * Here, **one player is the subject each round**. They answer privately.
 * Everyone else predicts what they picked.
 *
 * That turns "which would you choose" into "how well do you know Sara", which
 * is a completely different and much better question — and it's the question
 * this product exists to be good at, because the people playing already know
 * each other.
 *
 * ## Scoring, and why it's asymmetric
 *
 * - Each correct predictor scores **1**.
 * - The subject scores **1 for every person who got it wrong**.
 *
 * So the subject is rewarded for being *surprising*, not for being liked. That
 * matters: a symmetric scoring rule would push everyone toward the boring,
 * predictable answer, and the entire pleasure of the game is the moment
 * somebody says "wait, you'd pick THAT?".
 *
 * Being unanimously predicted is worth nothing to the subject, which is the
 * correct incentive — it means you're exactly who everyone thinks you are.
 *
 * ## Why it's here
 *
 * Almost no code, endless content, ninety-second rounds, and it produces the
 * single most shareable moment in the catalogue. The reveal — "four of five
 * thought you'd pick the other one" — is a screenshot. See
 * docs/CONTENT_STRATEGY.md.
 */

/**
 * The wire shapes live in `src/shared/wyr.ts` — the single source of truth for
 * what the client receives, copied into the web package by
 * `npm run types:sync`.
 */
export type {
  WyrPhase,
  WyrChoice,
  WyrSeat,
  WyrReveal,
  WyrState,
  WyrPrivate,
  WyrPlayerState,
} from "../../shared/wyr.js";

import type {
  WyrPhase,
  WyrChoice,
  WyrReveal,
  WyrState,
  WyrPrivate,
} from "../../shared/wyr.js";

const CHOOSE_SECONDS = 25;
const PREDICT_SECONDS = 30;
const REVEAL_SECONDS = 14;

export class WyrGame implements GameRoom {
  readonly gameId = "wyr";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: WyrPhase = "lobby";
  readonly targetScore: number;

  private roundNumber = 0;
  private subjectId: string | null = null;
  private dilemma: Dilemma | null = null;
  private answer: WyrChoice | null = null;
  private predictions = new Map<string, WyrChoice>();
  private scores = new Map<string, number>();
  private usedDilemmas = new Set<string>();
  /** Rotation so everyone is the subject roughly equally often. */
  private subjectQueue: string[] = [];

  private deadline: number | null = null;
  private reveal: WyrReveal | null = null;
  private winnerId: string | null = null;

  private timer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private callbacks: GameRoomCallbacks;

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks,
    targetScore = 10,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(3, Math.min(10, maxPlayers || 8));
    this.targetScore = Math.max(5, Math.min(40, targetScore));
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

  /** No bots: the game is entirely about knowing real people. */
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

    // Don't let a dropout stall a 90-second round.
    if (this.phase === "choosing" && this.subjectId === player.id) {
      // The subject left mid-answer. Pick for them rather than hanging: the
      // round is unscoreable either way, but a dead screen is worse.
      this.answer = Math.random() < 0.5 ? "a" : "b";
      this.beginPredicting();
    } else if (this.phase === "predicting") {
      this.checkPredictionsComplete();
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
    this.usedDilemmas.clear();
    this.subjectQueue = [];
    for (const player of this.players) this.scores.set(player.id, 0);
    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;
    this.clearTimer();

    this.roundNumber++;
    this.phase = "choosing";
    this.reveal = null;
    this.answer = null;
    this.predictions.clear();

    this.dilemma = pickDilemma(this.usedDilemmas);
    this.usedDilemmas.add(this.dilemma.id);

    this.subjectId = this.nextSubject();

    this.setDeadline(CHOOSE_SECONDS, () => {
      // Out of time: pick for them and move on. A round that stalls because
      // one person put their phone down is how a group stops playing.
      if (!this.answer) this.answer = Math.random() < 0.5 ? "a" : "b";
      this.beginPredicting();
    });

    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  /**
   * Rotate the subject through everyone before repeating.
   *
   * A random subject each round means, with five players, someone plausibly
   * goes four rounds without a turn — and the subject's turn is the
   * interesting one. A shuffled queue drained to empty gives everyone a turn
   * per cycle without the order being predictable.
   */
  private nextSubject(): string {
    const present = this.players.filter((p) => p.isConnected).map((p) => p.id);
    const pool = present.length >= 3 ? present : this.players.map((p) => p.id);

    this.subjectQueue = this.subjectQueue.filter((id) => pool.includes(id));
    if (this.subjectQueue.length === 0) {
      this.subjectQueue = [...pool].sort(() => Math.random() - 0.5);
    }
    return this.subjectQueue.shift() ?? pool[0];
  }

  // ---------------------------------------------------------------- actions

  /** The subject locks in their real answer. */
  choose(playerId: string, choice: WyrChoice): { success: boolean; error?: string } {
    if (this.phase !== "choosing") return { success: false, error: "Not the choosing phase" };
    if (playerId !== this.subjectId) {
      return { success: false, error: "It's not your turn to answer" };
    }
    if (choice !== "a" && choice !== "b") return { success: false, error: "Pick one" };

    this.answer = choice;
    this.lastActivityAt = Date.now();
    this.beginPredicting();
    return { success: true };
  }

  private beginPredicting(): void {
    if (this.destroyed) return;
    this.phase = "predicting";
    this.setDeadline(PREDICT_SECONDS, () => this.finishRound());
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  /** Everyone else guesses what the subject picked. */
  predict(playerId: string, choice: WyrChoice): { success: boolean; error?: string } {
    if (this.phase !== "predicting") return { success: false, error: "Not the predicting phase" };
    if (playerId === this.subjectId) {
      return { success: false, error: "You're the one being guessed" };
    }
    if (choice !== "a" && choice !== "b") return { success: false, error: "Pick one" };
    if (this.predictions.has(playerId)) {
      return { success: false, error: "You already locked that in" };
    }

    this.predictions.set(playerId, choice);
    this.lastActivityAt = Date.now();
    this.broadcast();
    this.checkPredictionsComplete();
    return { success: true };
  }

  private checkPredictionsComplete(): void {
    const expected = this.players.filter(
      (p) => p.isConnected && p.id !== this.subjectId,
    ).length;
    if (this.predictions.size >= expected) this.finishRound();
  }

  private finishRound(): void {
    if (this.destroyed || !this.subjectId || !this.answer) return;
    this.clearTimer();
    this.phase = "reveal";
    this.deadline = null;

    const correctIds: string[] = [];
    const wrongIds: string[] = [];
    const tally = { a: 0, b: 0 };

    for (const [id, prediction] of this.predictions) {
      tally[prediction]++;
      if (prediction === this.answer) correctIds.push(id);
      else wrongIds.push(id);
    }

    const points: Record<string, number> = {};
    for (const id of correctIds) points[id] = 1;
    // The subject scores for surprising people, not for being liked. See the
    // note at the top of this file on why this is asymmetric.
    if (wrongIds.length > 0) points[this.subjectId] = wrongIds.length;

    for (const [id, value] of Object.entries(points)) {
      this.scores.set(id, (this.scores.get(id) ?? 0) + value);
    }

    const predictorCount = this.predictions.size;
    const over = this.checkGameOver();

    this.reveal = {
      subjectId: this.subjectId,
      subjectName: this.getPlayer(this.subjectId)?.name ?? "—",
      answer: this.answer,
      tally,
      correctIds,
      wrongIds,
      pointsAwarded: points,
      fooledEveryone: predictorCount > 0 && correctIds.length === 0,
      readLikeABook: predictorCount > 0 && wrongIds.length === 0,
      nextRoundAt: over ? null : Date.now() + REVEAL_SECONDS * 1000,
    };

    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);

    if (over) {
      this.phase = "game_over";
      this.broadcast();
      if (this.winnerId) this.callbacks.onGameEnd(this.roomId, this.winnerId);
      return;
    }

    this.broadcast();
    this.timer = setTimeout(() => this.startRound(), REVEAL_SECONDS * 1000);
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
    this.timer = setTimeout(onExpire, seconds * 1000);
  }

  private broadcast(): void {
    if (this.destroyed) return;
    this.callbacks.broadcast(this.toState());
  }

  toState(): WyrState {
    // Predictions stay hidden until the reveal. A visible running tally would
    // let late predictors follow the crowd, which removes the only decision
    // they get to make.
    const showPredictions = this.phase === "reveal" || this.phase === "game_over";

    return {
      roomId: this.roomId,
      gameId: "wyr",
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
      seats: this.players.map((p) => {
        const prediction = this.predictions.get(p.id) ?? null;
        return {
          playerId: p.id,
          name: p.name,
          isConnected: p.isConnected,
          flag: p.flag,
          score: this.scores.get(p.id) ?? 0,
          hasPredicted: this.predictions.has(p.id),
          ...(showPredictions
            ? {
                prediction,
                correct: prediction !== null && prediction === this.answer,
              }
            : {}),
        };
      }),
      roundNumber: this.roundNumber,
      targetScore: this.targetScore,
      subjectId: this.subjectId,
      dilemma: this.dilemma
        ? { id: this.dilemma.id, a: this.dilemma.a, b: this.dilemma.b }
        : null,
      deadline: this.deadline,
      reveal: this.reveal,
      winnerId: this.winnerId,
    };
  }

  toPlayerState(playerId: string): WyrState & WyrPrivate {
    const base = this.toState();
    const isSubject = playerId === this.subjectId;
    const roundLive = this.phase === "choosing" || this.phase === "predicting";

    return {
      ...base,
      isSubject,
      // The subject's answer is the one secret in the game and must not leak
      // to anyone else before the reveal — including via their own state.
      myAnswer: isSubject && roundLive ? this.answer : null,
      myPrediction: roundLive ? (this.predictions.get(playerId) ?? null) : null,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
