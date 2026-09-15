import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import {
  type Tile,
  type PlacedTile,
  type BoardEnds,
  type RoundOutcome,
  type Team,
  TARGET_SCORE_DEFAULT,
  deal,
  findOpening,
  legalPlays,
  canPlay,
  orient,
  sameTile,
  isDouble,
  handPips,
  teamForSeat,
  partnerSeat,
  scoreDomino,
  scoreBlocked,
  applyKarak,
} from "./rules.js";
import { chooseDominoPlay, botThinkMs, type BotDifficulty } from "./DominoBot.js";

/**
 * Egyptian / Levantine street domino.
 *
 * A full rewrite. The rules themselves live in `rules.ts` (pure, testable) and
 * the opponent in `DominoBot.ts`; this file is the part that has to deal with
 * time, sockets, people closing their laptops, and whose turn it is.
 *
 * ## What the rewrite fixed
 *
 * The previous engine had five defects that each independently broke a game:
 *
 * 1. **Teams were array indices.** Scoring read `players[0]` and `players[2]`
 *    as team A. A player leaving mid-match shifted the array and silently
 *    reassigned partners — you'd finish a round scoring for the other side.
 *    Seats are now fixed for the life of the match and teams derive from the
 *    seat index, so a departure can't reshuffle anybody's partner.
 *
 * 2. **Disconnected players were skipped entirely.** `nextTurn` walked past
 *    anyone offline, so their tiles never entered play and a four-handed game
 *    with one dropout could not be blocked *or* won — it just ran until the
 *    room was swept. A disconnected seat now keeps its turn and is auto-played
 *    by the bot after a grace period.
 *
 * 3. **The "all passed" test counted disconnected seats.** Block detection
 *    compared consecutive passes against total player count, so it could
 *    trigger early or never.
 *
 * 4. **No fixed opening.** Any tile could open, which removes the shared
 *    starting position the whole reading game depends on.
 *
 * 5. **The timeout handler mutated the hand and then called the play path
 *    that also mutates the hand.** On some paths the tile was removed twice.
 *
 * ## What the rewrite added, and why
 *
 * The brief was that the old game wasn't *fun*. The mechanics were roughly
 * right; what was missing was everything that makes the physical game
 * sociable. Three additions carry most of that:
 *
 * - **The knock is a first-class event, not a silent pass.** In the physical
 *   game you rap the table and everyone hears it. It's theatre and it's
 *   information. It's now broadcast with the numbers that were open, which is
 *   what makes the next point possible.
 *
 * - **Knock memory is public and rendered.** A good player remembers that
 *   Omar knocked when the ends were 3 and 5, and therefore knows Omar holds no
 *   3 and no 5. Casual players don't remember, feel like they're guessing, and
 *   conclude the game is luck. Surfacing what was always publicly derivable
 *   turns a game people bounce off into a game people feel clever playing —
 *   without giving anyone information they weren't entitled to.
 *
 * - **An event log with intent.** Every state carries the last few events
 *   typed by kind, so the client can animate the slam, play the knock sound,
 *   and fire the right line of chatter instead of diffing state and guessing.
 */

export type DominoMode = "individual" | "teams";

export interface DominoEvent {
  kind:
    | "play"
    | "knock"
    | "draw"
    | "round_start"
    | "round_end"
    | "timeout"
    | "match_end";
  seat: number;
  playerId: string;
  playerName: string;
  at: number;
  tile?: Tile;
  /** For a knock: the pips that were open, i.e. what this player lacks. */
  deadOn?: number[];
  method?: RoundOutcome["method"];
  points?: number;
}

export interface DominoSeatState {
  seat: number;
  playerId: string;
  name: string;
  team: Team;
  isBot: boolean;
  isConnected: boolean;
  flag?: string;
  handCount: number;
  /** Numbers this seat has proved it doesn't hold, by knocking. */
  knockedOn: number[];
  score: number;
  /** Revealed only in the recap. */
  hand?: Tile[];
  pips?: number;
}

export interface DominoRecap {
  method: RoundOutcome["method"];
  winnerSeat: number | null;
  winnerName: string | null;
  winnerTeam: Team | null;
  points: number;
  karak: boolean;
  pipsBySeat: number[];
  handsBySeat: Tile[][];
  nextRoundAt: number | null;
}

export interface DominoState {
  roomId: string;
  gameId: "domino";
  phase: "lobby" | "playing" | "round_recap" | "game_over";
  mode: DominoMode;
  targetScore: number;
  turnSeconds: number;
  karakBonus: boolean;
  tableTheme: string;
  tileTheme: string;

  /** Legacy alias; the client's shared player list still reads `players`. */
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

  seats: DominoSeatState[];
  maxPlayers: number;

  board: PlacedTile[];
  ends: BoardEnds;
  boneyardCount: number;

  activeSeat: number | null;
  turnDeadline: number | null;
  roundNumber: number;
  /** How many of each pip value are visible on the table. Public read-aid. */
  playedPipCount: number[];

  scores: { A: number; B: number };
  seatScores: number[];
  winnerTeam: Team | null;
  winnerId: string | null;

  recap: DominoRecap | null;
  events: DominoEvent[];
}

const RECAP_SECONDS = 8;
/** How long a disconnected player's turn is held before the bot takes over. */
const DISCONNECT_GRACE_MS = 6000;

export class DominoGame implements GameRoom {
  readonly gameId = "domino";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: DominoState["phase"] = "lobby";

  readonly mode: DominoMode;
  readonly targetScore: number;
  readonly turnSeconds: number;
  readonly karakBonus: boolean;
  readonly tableTheme: string;
  readonly tileTheme: string;

  /**
   * Seat order, fixed once the match starts. Everything positional — teams,
   * turn order, partner — derives from index into this array, never from the
   * `players` array, which can be mutated by joins and leaves.
   */
  private seatOrder: string[] = [];
  private hands = new Map<string, Tile[]>();
  private knocks = new Map<string, number[]>();
  private seatScores = new Map<string, number>();
  private botDifficulty = new Map<string, BotDifficulty>();

  private board: PlacedTile[] = [];
  private ends: BoardEnds = { left: null, right: null };
  private boneyard: Tile[] = [];
  private playedPipCount = [0, 0, 0, 0, 0, 0, 0];

  private activeSeat: number | null = null;
  private turnDeadline: number | null = null;
  private roundNumber = 0;
  private consecutiveKnocks = 0;
  /** Seat that opens the next round — the last round's winner. */
  private nextOpenerSeat: number | null = null;

  private teamScores: { A: number; B: number } = { A: 0, B: 0 };
  private winnerTeam: Team | null = null;
  private winnerId: string | null = null;
  private recap: DominoRecap | null = null;
  private events: DominoEvent[] = [];

  private turnTimer: NodeJS.Timeout | null = null;
  private recapTimer: NodeJS.Timeout | null = null;
  private botTimer: NodeJS.Timeout | null = null;
  private destroyed = false;

  private callbacks: GameRoomCallbacks;

  constructor(
    roomId: string,
    maxPlayers: number,
    mode: DominoMode,
    targetScore: number,
    turnSeconds: number,
    callbacks: GameRoomCallbacks,
    tableTheme = "green",
    tileTheme = "ivory",
    karakBonus = false,
  ) {
    this.roomId = roomId;
    this.mode = mode === "teams" ? "teams" : "individual";
    this.maxPlayers =
      this.mode === "teams" ? 4 : Math.max(2, Math.min(4, maxPlayers || 4));
    this.targetScore = Math.max(50, Math.min(300, targetScore || TARGET_SCORE_DEFAULT));
    this.turnSeconds = Math.max(0, Math.min(120, turnSeconds ?? 30));
    this.karakBonus = karakBonus;
    this.tableTheme = tableTheme;
    this.tileTheme = tileTheme;
    this.callbacks = callbacks;
    this.lastActivityAt = Date.now();
  }

  // =====================================================================
  // Roster
  // =====================================================================

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
    this.seatScores.set(id, 0);
    this.knocks.set(id, []);
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(name: string, difficulty: string = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);
    this.botDifficulty.set(
      id,
      difficulty === "easy" || difficulty === "hard" ? difficulty : "medium",
    );
    this.seatScores.set(id, 0);
    this.knocks.set(id, []);
    this.lastActivityAt = Date.now();
    return player;
  }

  removeBot(botId: string): boolean {
    // Once seats are assigned, removing a player would renumber the table
    // mid-match. Refuse rather than silently repartnering everyone.
    if (this.phase !== "lobby") return false;
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.botDifficulty.delete(botId);
    this.seatScores.delete(botId);
    this.knocks.delete(botId);
    this.lastActivityAt = Date.now();
    return true;
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

    // Do NOT skip their seat. Skipping was the old engine's approach and it
    // made a four-handed game with one dropout impossible to either win or
    // block: their tiles never entered play, so the table could never lock.
    // Instead the seat keeps its turn and the bot takes over shortly.
    if (this.phase === "playing" && this.seatOf(player.id) === this.activeSeat) {
      this.clearTurnTimer();
      this.turnDeadline = Date.now() + DISCONNECT_GRACE_MS;
      this.turnTimer = setTimeout(() => this.autoPlay("timeout"), DISCONNECT_GRACE_MS);
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

    // Give a returning player a full turn rather than whatever was left of the
    // disconnect grace period.
    if (this.phase === "playing" && this.seatOf(playerId) === this.activeSeat) {
      this.beginTurn(this.activeSeat);
    }

    this.broadcast();
    return player;
  }

  canStart(): boolean {
    if (this.mode === "teams") return this.players.length === 4;
    return this.players.length >= 2 && this.players.length <= 4;
  }

  // =====================================================================
  // Match lifecycle
  // =====================================================================

  startGame(): boolean {
    if (!this.canStart()) return false;

    // Seats are locked here and never change for the rest of the match.
    this.seatOrder = this.players.map((p) => p.id);
    for (const id of this.seatOrder) this.seatScores.set(id, 0);
    this.teamScores = { A: 0, B: 0 };
    this.winnerTeam = null;
    this.winnerId = null;
    this.roundNumber = 0;
    this.nextOpenerSeat = null;
    this.events = [];

    this.startRound();
    return true;
  }

  private startRound(): void {
    if (this.destroyed) return;

    this.clearAllTimers();
    this.phase = "playing";
    this.recap = null;
    this.board = [];
    this.ends = { left: null, right: null };
    this.playedPipCount = [0, 0, 0, 0, 0, 0, 0];
    this.consecutiveKnocks = 0;
    this.roundNumber++;

    for (const id of this.seatOrder) this.knocks.set(id, []);

    const { hands, boneyard } = deal(this.seatOrder.length);
    this.boneyard = boneyard;
    this.seatOrder.forEach((id, seat) => this.hands.set(id, hands[seat]));

    let openerSeat: number;
    if (this.roundNumber === 1 || this.nextOpenerSeat === null) {
      // Round one: the double-six opens, and whoever holds it must lead it.
      // A fixed opening is what makes reading the table possible from tile one.
      const opening = findOpening(hands);
      openerSeat = opening?.seat ?? 0;
      this.beginTurn(openerSeat);
      this.pushEvent({ kind: "round_start", seat: openerSeat });

      if (opening) {
        const opener = this.seatOrder[openerSeat];
        // Play it for them immediately — there is no decision to make, and
        // making a player tap a forced move is friction with no game in it.
        this.commitPlay(opener, opening.tile, "left");
        return;
      }
    } else {
      // Later rounds: the previous winner opens, with anything they like.
      openerSeat = this.nextOpenerSeat;
      this.beginTurn(openerSeat);
      this.pushEvent({ kind: "round_start", seat: openerSeat });
    }

    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();
  }

  private beginTurn(seat: number | null): void {
    if (this.destroyed || this.phase !== "playing" || seat === null) return;

    this.activeSeat = seat;
    this.clearTurnTimer();
    this.clearBotTimer();

    const playerId = this.seatOrder[seat];
    const player = this.getPlayer(playerId);

    if (this.turnSeconds > 0) {
      this.turnDeadline = Date.now() + this.turnSeconds * 1000;
      this.turnTimer = setTimeout(
        () => this.autoPlay("timeout"),
        this.turnSeconds * 1000,
      );
    } else {
      this.turnDeadline = null;
    }

    // Bots think, and so do absent humans — the bot plays for a disconnected
    // seat so the round can still reach a conclusion.
    if (player?.isBot) {
      this.scheduleBot(playerId);
    } else if (player && !player.isConnected) {
      this.clearTurnTimer();
      this.turnDeadline = Date.now() + DISCONNECT_GRACE_MS;
      this.turnTimer = setTimeout(() => this.autoPlay("timeout"), DISCONNECT_GRACE_MS);
    }
  }

  private advanceTurn(): void {
    if (this.destroyed || this.phase !== "playing" || this.activeSeat === null) return;
    const next = (this.activeSeat + 1) % this.seatOrder.length;
    this.beginTurn(next);
    this.lastActivityAt = Date.now();
    this.broadcast();
  }

  // =====================================================================
  // Player actions
  // =====================================================================

  /** Play a tile onto one end of the snake. */
  playTile(
    playerId: string,
    tile: Tile,
    end: "left" | "right",
  ): { success: boolean; error?: string } {
    const guard = this.guardTurn(playerId);
    if (guard) return guard;

    const hand = this.hands.get(playerId) ?? [];
    const index = hand.findIndex((t) => sameTile(t, tile));
    if (index === -1) return { success: false, error: "You don't have that tile" };

    const held = hand[index];
    if (this.board.length > 0) {
      const oriented = orient(held, end, this.ends);
      if (!oriented) {
        return {
          success: false,
          error: `That tile doesn't match the ${end} end`,
        };
      }
    }

    this.commitPlay(playerId, held, end);
    return { success: true };
  }

  /**
   * Knock: declare you cannot play.
   *
   * Validated server-side rather than trusted, because a knock is *public
   * information* — it proves the knocker holds neither open pip, and the bots
   * and the UI both act on that. A client that could knock while holding a
   * legal tile could feed the whole table a lie.
   */
  knock(playerId: string): { success: boolean; error?: string } {
    const guard = this.guardTurn(playerId);
    if (guard) return guard;

    const hand = this.hands.get(playerId) ?? [];
    if (canPlay(hand, this.ends)) {
      return { success: false, error: "You have a tile you can play" };
    }
    if (this.boneyard.length > 0) {
      return { success: false, error: "Draw from the boneyard first" };
    }

    this.commitKnock(playerId);
    return { success: true };
  }

  /** Draw one tile. Only exists in 2- and 3-player games, which keep a boneyard. */
  drawTile(playerId: string): { success: boolean; error?: string; tile?: Tile } {
    const guard = this.guardTurn(playerId);
    if (guard) return guard;

    const hand = this.hands.get(playerId) ?? [];
    if (canPlay(hand, this.ends)) {
      return { success: false, error: "You have a tile you can play" };
    }
    if (this.boneyard.length === 0) {
      return { success: false, error: "The boneyard is empty — knock instead" };
    }

    const tile = this.boneyard.pop()!;
    hand.push(tile);
    this.hands.set(playerId, hand);

    this.pushEvent({ kind: "draw", seat: this.seatOf(playerId) ?? 0 });
    this.lastActivityAt = Date.now();
    this.callbacks.onHandsChanged(this.roomId);
    this.broadcast();

    return { success: true, tile };
  }

  private guardTurn(playerId: string): { success: false; error: string } | null {
    if (this.phase !== "playing") {
      return { success: false, error: "The round isn't running" };
    }
    if (this.activeSeat === null || this.seatOrder[this.activeSeat] !== playerId) {
      return { success: false, error: "Not your turn" };
    }
    return null;
  }

  // =====================================================================
  // Committing moves
  // =====================================================================

  private commitPlay(playerId: string, tile: Tile, end: "left" | "right"): void {
    this.clearTurnTimer();
    this.clearBotTimer();
    this.consecutiveKnocks = 0;

    const hand = this.hands.get(playerId) ?? [];
    const index = hand.findIndex((t) => sameTile(t, tile));
    if (index !== -1) hand.splice(index, 1);

    const seat = this.seatOf(playerId) ?? 0;
    const seq = this.board.length;

    if (this.board.length === 0) {
      this.board.push({ ...tile, playedBy: playerId, end: "spinner", seq });
      this.ends = { left: tile.left, right: tile.right };
    } else {
      const oriented = orient(tile, end, this.ends)!;
      const placed: PlacedTile = {
        ...oriented.placed,
        playedBy: playerId,
        end,
        seq,
      };
      if (end === "left") {
        this.board.unshift(placed);
        this.ends = { ...this.ends, left: oriented.newEnd };
      } else {
        this.board.push(placed);
        this.ends = { ...this.ends, right: oriented.newEnd };
      }
    }

    this.playedPipCount[tile.left]++;
    if (!isDouble(tile)) this.playedPipCount[tile.right]++;
    else this.playedPipCount[tile.right]++; // a double shows the value twice

    this.pushEvent({ kind: "play", seat, tile });
    this.lastActivityAt = Date.now();

    if (hand.length === 0) {
      this.endRound(scoreDomino(seat, this.handsBySeat(), this.scoreOpts()), tile);
      return;
    }

    this.callbacks.onHandsChanged(this.roomId);
    this.advanceTurn();
  }

  private commitKnock(playerId: string): void {
    this.clearTurnTimer();
    this.clearBotTimer();

    // Record what this knock proves. Both open pips are numbers the knocker
    // demonstrably does not hold — that's the information the rest of the
    // table (and the bots) get to use for the rest of the round.
    const deadOn = [this.ends.left, this.ends.right].filter(
      (v): v is number => v !== null,
    );
    const known = this.knocks.get(playerId) ?? [];
    for (const value of deadOn) {
      if (!known.includes(value)) known.push(value);
    }
    this.knocks.set(playerId, known);

    this.consecutiveKnocks++;
    this.pushEvent({
      kind: "knock",
      seat: this.seatOf(playerId) ?? 0,
      deadOn,
    });
    this.lastActivityAt = Date.now();

    // Everyone knocking in succession means the table is locked. Counting
    // against seat count (not "connected player count") is deliberate: a
    // disconnected seat is still played, by the bot, so it still knocks.
    if (this.consecutiveKnocks >= this.seatOrder.length) {
      this.endRound(scoreBlocked(this.handsBySeat(), this.scoreOpts()), null);
      return;
    }

    this.advanceTurn();
  }

  /**
   * Play for whoever's turn it is — used for timeouts and for seats whose
   * player has dropped.
   *
   * It plays a real move rather than forfeiting, because forfeiting a turn in
   * a partnership game punishes the absent player's partner, who did nothing
   * wrong. It uses the easy bot on purpose: an absent player's seat should not
   * suddenly start playing better than they were.
   */
  private autoPlay(reason: "timeout"): void {
    if (this.destroyed || this.phase !== "playing" || this.activeSeat === null) return;

    const playerId = this.seatOrder[this.activeSeat];
    const hand = this.hands.get(playerId) ?? [];

    this.pushEvent({ kind: reason, seat: this.activeSeat });

    // 2–3 players: exhaust the boneyard before a knock is legal.
    while (!canPlay(hand, this.ends) && this.boneyard.length > 0) {
      hand.push(this.boneyard.pop()!);
    }
    this.hands.set(playerId, hand);

    const choice = chooseDominoPlay(this.botView(this.activeSeat), "easy");
    if (choice) this.commitPlay(playerId, choice.tile, choice.end);
    else this.commitKnock(playerId);
  }

  // =====================================================================
  // Round / match end
  // =====================================================================

  private endRound(outcome: RoundOutcome, lastTile: Tile | null): void {
    this.clearAllTimers();

    const scored = applyKarak(outcome, lastTile, this.scoreOpts());
    this.phase = "round_recap";
    this.activeSeat = null;
    this.turnDeadline = null;

    if (scored.winnerSeat !== null && scored.points > 0) {
      if (this.mode === "teams" && scored.winnerTeam) {
        this.teamScores[scored.winnerTeam] += scored.points;
      }
      const winnerId = this.seatOrder[scored.winnerSeat];
      this.seatScores.set(winnerId, (this.seatScores.get(winnerId) ?? 0) + scored.points);
    }

    // The winner opens the next round — the reward for taking it is choosing
    // the shape of what comes next.
    this.nextOpenerSeat =
      scored.winnerSeat ??
      (this.activeSeat ?? (this.nextOpenerSeat !== null ? this.nextOpenerSeat : 0));

    const winnerName =
      scored.winnerSeat !== null
        ? this.getPlayer(this.seatOrder[scored.winnerSeat])?.name ?? null
        : null;

    this.pushEvent({
      kind: "round_end",
      seat: scored.winnerSeat ?? 0,
      method: scored.method,
      points: scored.points,
    });

    const matchOver = this.checkMatchOver();

    this.recap = {
      method: scored.method,
      winnerSeat: scored.winnerSeat,
      winnerName,
      winnerTeam: scored.winnerTeam,
      points: scored.points,
      karak: scored.karak,
      pipsBySeat: scored.pipsBySeat,
      handsBySeat: this.handsBySeat(),
      nextRoundAt: matchOver ? null : Date.now() + RECAP_SECONDS * 1000,
    };

    this.lastActivityAt = Date.now();

    if (matchOver) {
      this.phase = "game_over";
      this.broadcast();
      if (this.winnerId) this.callbacks.onGameEnd(this.roomId, this.winnerId);
      return;
    }

    this.broadcast();
    this.recapTimer = setTimeout(() => this.startRound(), RECAP_SECONDS * 1000);
  }

  private checkMatchOver(): boolean {
    if (this.mode === "teams") {
      const winner: Team | null =
        this.teamScores.A >= this.targetScore
          ? "A"
          : this.teamScores.B >= this.targetScore
            ? "B"
            : null;
      if (!winner) return false;

      this.winnerTeam = winner;
      // Name the higher scorer on the winning team as the nominal winner, so
      // the party leaderboard has a person to credit.
      let bestId: string | null = null;
      let bestScore = -1;
      this.seatOrder.forEach((id, seat) => {
        if (teamForSeat(seat) !== winner) return;
        const score = this.seatScores.get(id) ?? 0;
        if (score > bestScore) {
          bestScore = score;
          bestId = id;
        }
      });
      this.winnerId = bestId;
      this.pushEvent({ kind: "match_end", seat: 0 });
      return true;
    }

    for (const [id, score] of this.seatScores) {
      if (score >= this.targetScore) {
        this.winnerId = id;
        this.pushEvent({ kind: "match_end", seat: this.seatOf(id) ?? 0 });
        return true;
      }
    }
    return false;
  }

  /** Host-triggered fresh match with the same table. */
  rematch(playerId: string): { success: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player?.isHost) {
      return { success: false, error: "Only the host can start a rematch" };
    }
    if (this.phase !== "game_over") {
      return { success: false, error: "The match isn't over yet" };
    }
    this.startGame();
    return { success: true };
  }

  // =====================================================================
  // Bots
  // =====================================================================

  private scheduleBot(botId: string): void {
    this.clearBotTimer();
    const seat = this.seatOf(botId);
    if (seat === null) return;

    const options = legalPlays(this.hands.get(botId) ?? [], this.ends);
    const difficulty = this.botDifficulty.get(botId) ?? "medium";
    const delay = botThinkMs(options.length, difficulty);

    this.botTimer = setTimeout(() => this.runBot(botId), delay);
  }

  private runBot(botId: string): void {
    if (this.destroyed || this.phase !== "playing") return;
    if (this.activeSeat === null || this.seatOrder[this.activeSeat] !== botId) return;

    const hand = this.hands.get(botId) ?? [];

    // Draw until playable (2–3 players only; at 4 the boneyard is empty).
    while (!canPlay(hand, this.ends) && this.boneyard.length > 0) {
      hand.push(this.boneyard.pop()!);
    }
    this.hands.set(botId, hand);

    const choice = chooseDominoPlay(
      this.botView(this.activeSeat),
      this.botDifficulty.get(botId) ?? "medium",
    );

    if (choice) this.commitPlay(botId, choice.tile, choice.end);
    else this.commitKnock(botId);
  }

  private botView(seat: number) {
    const playerId = this.seatOrder[seat];
    return {
      hand: this.hands.get(playerId) ?? [],
      ends: this.ends,
      seat,
      seatCount: this.seatOrder.length,
      teams: this.mode === "teams" && this.seatOrder.length === 4,
      handSizes: this.seatOrder.map((id) => (this.hands.get(id) ?? []).length),
      knocks: this.seatOrder.map((id) => this.knocks.get(id) ?? []),
      // What the bot can legitimately count: tiles on the table, plus its own.
      seenPipCount: this.playedPipCount.map((count, value) => {
        const inHand = (this.hands.get(playerId) ?? []).reduce(
          (n, t) => n + (t.left === value ? 1 : 0) + (t.right === value ? 1 : 0),
          0,
        );
        return count + inHand;
      }),
    };
  }

  // =====================================================================
  // State
  // =====================================================================

  private seatOf(playerId: string): number | null {
    const index = this.seatOrder.indexOf(playerId);
    return index === -1 ? null : index;
  }

  private handsBySeat(): Tile[][] {
    return this.seatOrder.map((id) => [...(this.hands.get(id) ?? [])]);
  }

  private scoreOpts() {
    return {
      teams: this.mode === "teams" && this.seatOrder.length === 4,
      karakBonus: this.karakBonus,
    };
  }

  private pushEvent(event: Omit<DominoEvent, "playerId" | "playerName" | "at">): void {
    const playerId = this.seatOrder[event.seat] ?? "";
    this.events.push({
      ...event,
      playerId,
      playerName: this.getPlayer(playerId)?.name ?? "",
      at: Date.now(),
    });
    // The client only animates the tail; an unbounded log would grow the
    // broadcast payload for every round of a long match.
    if (this.events.length > 12) this.events.splice(0, this.events.length - 12);
  }

  private broadcast(): void {
    if (this.destroyed) return;
    this.callbacks.broadcast(this.toState());
  }

  private seatStates(reveal: boolean): DominoSeatState[] {
    const order = this.seatOrder.length > 0 ? this.seatOrder : this.players.map((p) => p.id);
    return order.map((id, seat) => {
      const player = this.getPlayer(id);
      const hand = this.hands.get(id) ?? [];
      return {
        seat,
        playerId: id,
        name: player?.name ?? "—",
        team: teamForSeat(seat),
        isBot: player?.isBot ?? false,
        isConnected: player?.isConnected ?? false,
        flag: player?.flag,
        handCount: hand.length,
        knockedOn: [...(this.knocks.get(id) ?? [])],
        score: this.seatScores.get(id) ?? 0,
        ...(reveal ? { hand: [...hand], pips: handPips(hand) } : {}),
      };
    });
  }

  toState(): DominoState {
    const reveal = this.phase === "round_recap" || this.phase === "game_over";
    return {
      roomId: this.roomId,
      gameId: "domino",
      phase: this.phase,
      mode: this.mode,
      targetScore: this.targetScore,
      turnSeconds: this.turnSeconds,
      karakBonus: this.karakBonus,
      tableTheme: this.tableTheme,
      tileTheme: this.tileTheme,

      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: p.isHost,
        isConnected: p.isConnected,
        flag: p.flag,
        cardCount: (this.hands.get(p.id) ?? []).length,
        hand: [] as never[],
      })),

      seats: this.seatStates(reveal),
      maxPlayers: this.maxPlayers,

      board: this.board,
      ends: this.ends,
      boneyardCount: this.boneyard.length,

      activeSeat: this.activeSeat,
      turnDeadline: this.turnDeadline,
      roundNumber: this.roundNumber,
      playedPipCount: [...this.playedPipCount],

      scores: { ...this.teamScores },
      seatScores: this.seatOrder.map((id) => this.seatScores.get(id) ?? 0),
      winnerTeam: this.winnerTeam,
      winnerId: this.winnerId,

      recap: this.recap,
      events: this.events,
    };
  }

  toPlayerState(playerId: string): DominoState & {
    hand: Tile[];
    mySeat: number | null;
    myPartnerSeat: number | null;
    /** Legal plays, precomputed — see the comment below. */
    playable: Array<{ tile: Tile; end: "left" | "right" }>;
  } {
    const base = this.toState();
    const hand = this.hands.get(playerId) ?? [];
    const mySeat = this.seatOf(playerId);
    const myTurn = mySeat !== null && mySeat === this.activeSeat;

    return {
      ...base,
      hand: [...hand],
      mySeat,
      myPartnerSeat:
        mySeat === null ? null : partnerSeat(mySeat, this.seatOrder.length),
      // The server computes which tiles are legal rather than leaving the
      // client to re-derive it. Two reasons: the client's copy of the rule
      // would be a second implementation that can drift from the server's
      // (the old client did exactly that and disagreed on flipped tiles), and
      // the UI needs this on every render to dim unplayable tiles — the single
      // most useful affordance in the whole game on a small screen.
      playable: myTurn && this.phase === "playing" ? legalPlays(hand, this.ends) : [],
    };
  }

  // =====================================================================
  // Teardown
  // =====================================================================

  destroy(): void {
    this.destroyed = true;
    this.clearAllTimers();
  }

  private clearAllTimers(): void {
    this.clearTurnTimer();
    this.clearRecapTimer();
    this.clearBotTimer();
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private clearRecapTimer(): void {
    if (this.recapTimer) {
      clearTimeout(this.recapTimer);
      this.recapTimer = null;
    }
  }

  private clearBotTimer(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }
}
