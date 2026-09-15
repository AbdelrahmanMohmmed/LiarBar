import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import { shuffledDeck, type TabooCard } from "./cards.js";

/**
 * Taboo — تابو.
 *
 * One player describes a word to their own team without using any of the four
 * words printed under it. Their team shouts guesses. The other team is holding
 * the card — they can see it — and buzzes the moment a forbidden word slips
 * out. Sixty seconds, then the turn passes to the other team.
 *
 * ## Why this game is the one that justifies the voice channel
 *
 * Every other game here is *better* with voice. This one does not exist
 * without it. The entire round is a person talking fast and a room shouting
 * over them, and the only thing on screen is a card and three buttons. That
 * makes it the strongest possible demonstration of the thing this product has
 * that a web board-game site does not — and it is also the game an Arab
 * friend group is most likely to have already played in a living room, which
 * means nobody has to be taught the rules.
 *
 * ## Teams without a team-picking screen
 *
 * Codenames makes everyone choose a team and a role before it will start, and
 * that screen is the single biggest drop-off in the catalogue: five people
 * tapping through a lobby while one person explains what a spymaster is.
 *
 * Taboo needs teams too, so it assigns them — alternating around the seat
 * order, which is join order, which is usually the order people are sitting
 * in. Nobody chooses anything and the game starts on one tap. A party that
 * wants to re-balance can shuffle and start again; that is cheaper than a
 * screen everyone has to pass through every time.
 *
 * ## Who can see the card
 *
 * The describer and the *opposing* team see the card. The describer's own
 * teammates must not — they're the ones guessing. That is exactly how the
 * physical game works (the other team holds the card and watches you), and it
 * is why this engine has a real private slice rather than a public board.
 *
 * ## Scoring, and why a skip costs nothing
 *
 * Correct: +1 to the describing team. Buzzed: −1, and the card is burned.
 * Skipped: nothing at all.
 *
 * A free skip is deliberate. Penalising it makes describers grind through a
 * card nobody is going to get, which is sixty seconds of one person suffering
 * while five people watch — the opposite of what the game is for. The real
 * cost of a skip is the clock, and the clock is enough.
 */

export type TabooPhase =
  | "lobby"
  /** Someone is describing. The clock is running. */
  | "describing"
  /** Between turns: the card list from the turn just played. */
  | "turn_recap"
  | "game_over";

const SCORE = {
  correct: 1,
  buzzed: -1,
} as const;

const TURN_SECONDS = 60;
const RECAP_SECONDS = 9;

export type TabooTeam = "a" | "b";

/** What happened to one card during a turn. */
export interface TabooResult {
  word: string;
  outcome: "correct" | "buzzed" | "skipped";
}

export interface TabooSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  team: TabooTeam;
}

export interface TabooTurnRecap {
  describerId: string;
  describerName: string;
  team: TabooTeam;
  results: TabooResult[];
  points: number;
  nextTurnAt: number | null;
}

export interface TabooState {
  roomId: string;
  gameId: "taboo";
  phase: TabooPhase;
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
  seats: TabooSeat[];
  /** The room's language, which is the deck's language. */
  language: "en" | "ar";
  scores: Record<TabooTeam, number>;
  targetScore: number;
  turnNumber: number;
  /** Whose turn it is to describe, and for which team. */
  describerId: string | null;
  describingTeam: TabooTeam | null;
  /** Cards resolved so far this turn. The word is public once it's resolved. */
  turnResults: TabooResult[];
  deadline: number | null;
  recap: TabooTurnRecap | null;
  winningTeam: TabooTeam | null;
  /** Kept for the transport's winner bookkeeping. */
  winnerId: string | null;
  /** How many cards are left in the deck, so a table can see the end coming. */
  cardsLeft: number;
}

/**
 * Private slice: the card, and only for the people entitled to it — the
 * describer and everyone on the other team.
 */
export interface TabooPrivate {
  /** Null for the describer's own teammates. */
  card: { word: string; taboo: string[] } | null;
  myTeam: TabooTeam | null;
  amDescribing: boolean;
  /** Whether this player may buzz: on the other team, during a turn. */
  canBuzz: boolean;
}

export class TabooGame implements GameRoom {
  readonly gameId = "taboo";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: TabooPhase = "lobby";
  readonly targetScore: number;
  readonly language: "en" | "ar";

  private deck: TabooCard[] = [];
  private card: TabooCard | null = null;
  private teams = new Map<string, TabooTeam>();
  private scores: Record<TabooTeam, number> = { a: 0, b: 0 };

  private turnNumber = 0;
  private describerId: string | null = null;
  private describingTeam: TabooTeam = "a";
  /** Index into each team's rotation, so describing goes round evenly. */
  private nextUp: Record<TabooTeam, number> = { a: 0, b: 0 };
  private turnResults: TabooResult[] = [];

  private deadline: number | null = null;
  private recap: TabooTurnRecap | null = null;
  private winningTeam: TabooTeam | null = null;
  private winnerId: string | null = null;

  private phaseTimer: NodeJS.Timeout | null = null;
  private destroyed = false;
  private callbacks: GameRoomCallbacks;

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks,
    targetScore = 15,
    language: "en" | "ar" = "ar",
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(4, Math.min(12, maxPlayers || 8));
    this.targetScore = Math.max(5, Math.min(40, targetScore));
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
    this.assignTeams();
    this.lastActivityAt = Date.now();
    return player;
  }

  /**
   * No bots. A bot would have to describe a word out loud, in Arabic, to
   * people who can hear it — and then judge whether a human's spoken guess
   * was close enough. There is no part of this game a bot can hold up.
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

  /**
   * Alternate around the seat order.
   *
   * Seat order is join order, which for a group in one room is usually the
   * order they're sitting in — so this tends to split the sofa, which is
   * exactly what you want and what people do by hand anyway.
   */
  private assignTeams(): void {
    this.players.forEach((player, index) => {
      if (!this.teams.has(player.id)) {
        this.teams.set(player.id, index % 2 === 0 ? "a" : "b");
      }
    });
  }

  private teamOf(playerId: string): TabooTeam | null {
    return this.teams.get(playerId) ?? null;
  }

  private membersOf(team: TabooTeam): Player[] {
    return this.players.filter((p) => this.teams.get(p.id) === team);
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    player.isConnected = false;
    player.socketId = undefined;
    this.lastActivityAt = Date.now();

    // The describer's phone dying must not eat the whole minute: the turn ends
    // where it stands and the other team goes.
    if (this.phase === "describing" && this.describerId === player.id) {
      this.endTurn();
    } else {
      this.broadcast();
    }
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

  /** Four: two a side is the smallest game that is still Taboo. */
  canStart(): boolean {
    return (
      this.players.length >= 4 &&
      this.membersOf("a").length >= 1 &&
      this.membersOf("b").length >= 1
    );
  }

  // ------------------------------------------------------------- lifecycle

  startGame(): boolean {
    if (!this.canStart()) return false;
    this.deck = shuffledDeck(this.language);
    this.scores = { a: 0, b: 0 };
    this.turnNumber = 0;
    this.nextUp = { a: 0, b: 0 };
    this.describingTeam = "b"; // flipped by startTurn, so team A opens
    this.winningTeam = null;
    this.winnerId = null;
    this.startTurn();
    return true;
  }

  private startTurn(): void {
    if (this.destroyed) return;
    this.clearTimer();

    this.describingTeam = this.describingTeam === "a" ? "b" : "a";
    const roster = this.membersOf(this.describingTeam);
    if (roster.length === 0) {
      this.endMatch(null);
      return;
    }

    // Prefer someone still connected, but never stall: if the whole team has
    // dropped, the seat still takes its turn and the clock runs out.
    const start = this.nextUp[this.describingTeam] % roster.length;
    let describer = roster[start];
    for (let i = 0; i < roster.length; i++) {
      const candidate = roster[(start + i) % roster.length];
      if (candidate.isConnected) {
        describer = candidate;
        this.nextUp[this.describingTeam] = (start + i + 1) % roster.length;
        break;
      }
    }

    this.turnNumber++;
    this.describerId = describer.id;
    this.phase = "describing";
    this.recap = null;
    this.turnResults = [];
    this.drawCard();

    this.setDeadline(TURN_SECONDS, () => this.endTurn());
    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  private drawCard(): void {
    this.card = this.deck.pop() ?? null;
    if (!this.card) {
      // Out of cards mid-match: reshuffle rather than end abruptly. Everyone
      // has seen them, which makes the last cards easy, which is a fine way
      // for a match to accelerate towards its finish.
      this.deck = shuffledDeck(this.language);
      this.card = this.deck.pop() ?? null;
    }
  }

  // ---------------------------------------------------------------- actions

  /** The describer's team said it. */
  correct(playerId: string): { success: boolean; error?: string } {
    return this.resolveCard(playerId, "correct");
  }

  /** The describer gives up on this card. Costs nothing but the clock. */
  skip(playerId: string): { success: boolean; error?: string } {
    return this.resolveCard(playerId, "skipped");
  }

  private resolveCard(
    playerId: string,
    outcome: "correct" | "skipped",
  ): { success: boolean; error?: string } {
    if (this.phase !== "describing") return { success: false, error: "No turn running" };
    if (this.describerId !== playerId) {
      return { success: false, error: "Only the describer can do that" };
    }
    if (!this.card) return { success: false, error: "No card" };

    this.turnResults.push({ word: this.card.word, outcome });
    if (outcome === "correct") {
      this.scores[this.describingTeam] += SCORE.correct;
    }

    this.lastActivityAt = Date.now();

    if (this.scores[this.describingTeam] >= this.targetScore) {
      this.endTurn();
      return { success: true };
    }

    this.drawCard();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
    return { success: true };
  }

  /**
   * Someone on the other team heard a forbidden word.
   *
   * Only the opposing team may buzz, because only the opposing team can see
   * the card. There's no confirmation step and no appeal: the argument about
   * whether it counted is the best part of the game and belongs in the room,
   * not in a modal.
   */
  buzz(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "describing") return { success: false, error: "No turn running" };
    if (!this.card) return { success: false, error: "No card" };
    const team = this.teamOf(playerId);
    if (!team) return { success: false, error: "Player not found" };
    if (team === this.describingTeam) {
      return { success: false, error: "You're on the describing team" };
    }

    this.turnResults.push({ word: this.card.word, outcome: "buzzed" });
    this.scores[this.describingTeam] += SCORE.buzzed;
    this.lastActivityAt = Date.now();

    this.drawCard();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
    return { success: true };
  }

  private endTurn(): void {
    if (this.destroyed) return;
    this.clearTimer();

    const describer = this.describerId ? this.getPlayer(this.describerId) : null;
    const points = this.turnResults.reduce(
      (sum, r) =>
        sum + (r.outcome === "correct" ? SCORE.correct : r.outcome === "buzzed" ? SCORE.buzzed : 0),
      0,
    );

    const teamWon = this.scores[this.describingTeam] >= this.targetScore;

    this.phase = "turn_recap";
    this.deadline = null;
    this.card = null;
    this.recap = {
      describerId: this.describerId ?? "",
      describerName: describer?.name ?? "—",
      team: this.describingTeam,
      results: [...this.turnResults],
      points,
      nextTurnAt: teamWon ? null : Date.now() + RECAP_SECONDS * 1000,
    };

    this.lastActivityAt = Date.now();
    // The card is gone and the words are public now, so everyone's private
    // slice has to be refreshed or a describer's teammates keep a stale null
    // and the other team keeps a stale card.
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();

    if (teamWon) {
      this.phaseTimer = setTimeout(
        () => this.endMatch(this.describingTeam),
        RECAP_SECONDS * 1000,
      );
      return;
    }
    this.phaseTimer = setTimeout(() => this.startTurn(), RECAP_SECONDS * 1000);
  }

  private endMatch(team: TabooTeam | null): void {
    if (this.destroyed) return;
    this.clearTimer();
    this.phase = "game_over";
    this.deadline = null;
    this.describerId = null;
    this.winningTeam = team;

    // The transport records a single winning player id. Naming the winning
    // team's first member is a lie of convenience, so it names nobody and the
    // client reads `winningTeam` — but onGameEnd still has to fire or the
    // party never returns to its hub.
    this.winnerId = null;
    this.broadcast();
    this.callbacks.onGameEnd(this.roomId, "system");
  }

  rematch(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) return { success: false, error: "Only the host can restart" };
    if (this.phase !== "game_over") return { success: false, error: "Game isn't over" };
    this.startGame();
    return { success: true };
  }

  /** Re-draw the teams and start again. The party's answer to a lopsided game. */
  shuffleTeams(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) return { success: false, error: "Only the host can shuffle" };
    if (this.phase === "describing") {
      return { success: false, error: "Wait for the turn to finish" };
    }

    const shuffled = [...this.players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.teams.clear();
    shuffled.forEach((p, index) => this.teams.set(p.id, index % 2 === 0 ? "a" : "b"));

    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
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

  toState(): TabooState {
    return {
      roomId: this.roomId,
      gameId: "taboo",
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
        team: this.teams.get(p.id) ?? "a",
      })),
      language: this.language,
      scores: { ...this.scores },
      targetScore: this.targetScore,
      turnNumber: this.turnNumber,
      describerId: this.describerId,
      describingTeam: this.phase === "describing" ? this.describingTeam : null,
      // Resolved cards only. The word currently in play is never in here —
      // it's the one thing the describer's team must not read.
      turnResults: [...this.turnResults],
      deadline: this.deadline,
      recap: this.recap,
      winningTeam: this.winningTeam,
      winnerId: this.winnerId,
      cardsLeft: this.deck.length,
    };
  }

  toPlayerState(playerId: string): TabooState & TabooPrivate {
    const base = this.toState();
    const myTeam = this.teamOf(playerId);
    const amDescribing = this.describerId === playerId;
    const running = this.phase === "describing";
    // The describer holds the card; so does the other team, who in the real
    // game are the ones physically holding it. Only the describer's own
    // teammates are in the dark, because they're the ones guessing.
    const entitled =
      running && Boolean(this.card) && (amDescribing || (myTeam !== null && myTeam !== this.describingTeam));

    return {
      ...base,
      card: entitled && this.card ? { word: this.card.word, taboo: [...this.card.taboo] } : null,
      myTeam,
      amDescribing,
      canBuzz: running && myTeam !== null && myTeam !== this.describingTeam,
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
