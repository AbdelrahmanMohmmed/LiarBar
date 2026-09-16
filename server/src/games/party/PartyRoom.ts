import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import { createGameRoom, type CreateRoomOptions } from "../registry.js";
import { validateGameOptions, getSpec } from "../catalog.js";
import { acceptsRosterChanges } from "../phases.js";

/**
 * A party is a group of people who stay together while the games change.
 *
 * ## Why this exists
 *
 * Before this, a room *was* a game. Finishing domino and wanting to play
 * Codenames meant: everyone leaves, the host creates a new room, pastes a new
 * code into WhatsApp, and waits for six people to notice, tap it, retype their
 * name, and re-grant microphone permission. In practice the group just stopped
 * playing — the friction of switching was higher than the appeal of the next
 * game, so one bad game choice ended the night.
 *
 * A PartyRoom inverts the ownership: the *party* is the durable thing and the
 * game is a slot inside it. The room code, the roster, the chat history, the
 * voice mesh and the night's scoreboard all outlive any individual game. The
 * link is sent exactly once, at the start of the night.
 *
 * ## How it works
 *
 * PartyRoom implements `GameRoom` so the transport layer needs no special
 * case: it is just another room to the registry, the sweeper and the socket
 * handlers. Internally it owns an `activeSubRoom` — a real game engine created
 * through the same `registry.createGameRoom` factory any standalone room uses.
 *
 * Switching games destroys the sub-room and builds a new one from the same
 * roster, preserving each player's id. Preserving ids is what keeps voice
 * alive: the WebRTC mesh is keyed by player id, so a switch that kept the
 * people but changed their ids would tear down and rebuild every peer
 * connection, and everyone would hear a two-second silence and a click.
 *
 * ## What it deliberately does not do
 *
 * It does not proxy game-specific actions. `socket/handlers.ts` unwraps the
 * active sub-room and narrows it to the concrete engine type, exactly as it
 * did before. Adding a game therefore does not require touching this file.
 */

export type PartyPhase = "hub" | "playing";

export interface PartyScoreEntry {
  playerId: string;
  name: string;
  /** Games this player has won tonight, across every game type. */
  wins: number;
  /** Games they were present for. */
  played: number;
}

/** One line in the night's history, shown in the hub between games. */
export interface PartyHistoryEntry {
  gameId: string;
  winnerId: string | null;
  winnerName: string | null;
  endedAt: number;
}

export class PartyRoom implements GameRoom {
  readonly gameId = "party";
  readonly roomId: string;
  readonly players: Player[] = [];
  maxPlayers: number;
  lastActivityAt: number;

  phase: PartyPhase = "hub";
  activeGameId: string | null = null;
  activeSubRoom: GameRoom | null = null;

  /**
   * Options the active game was started with, kept so "rematch" can restart
   * the same game with the same settings without the host re-picking them.
   */
  private activeOptions: CreateRoomOptions | null = null;

  /** Cross-game scoreboard for the session. The reason to stay for game 4. */
  private scores = new Map<string, PartyScoreEntry>();
  private history: PartyHistoryEntry[] = [];

  /** Difficulty each bot was added with, so bots survive a game switch. */
  private botDifficulty = new Map<string, string>();

  private callbacks: GameRoomCallbacks;
  private destroyed = false;

  constructor(
    roomId: string,
    maxPlayers: number,
    callbacks: GameRoomCallbacks,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(10, maxPlayers || 8));
    this.callbacks = callbacks;
    this.lastActivityAt = Date.now();
  }

  // ---------------------------------------------------------------------
  // Roster
  // ---------------------------------------------------------------------

  addPlayer(
    name: string,
    socketId: string,
    isHost = false,
    playerId?: string,
    flag?: string,
    icon?: string,
    characterId?: string,
  ): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    if (flag) player.flag = flag;
    if (icon) player.icon = icon;
    if (characterId) player.characterId = characterId;
    this.players.push(player);
    this.ensureScore(player);
    this.lastActivityAt = Date.now();

    // Someone arriving while a game is still in its own lobby gets seated in
    // it. Someone arriving mid-game does NOT — engines push unconditionally
    // in addPlayer, so seating a latecomer into a running game would hand
    // them an empty hand and corrupt turn order. They wait in the party
    // roster instead and are seated automatically on the next game, which is
    // still infinitely better than being bounced back to WhatsApp.
    if (this.canSeatInActiveGame()) {
      const subPlayer = this.activeSubRoom!.addPlayer(
        name,
        socketId,
        isHost,
        id,
        player.flag,
        player.icon,
        player.characterId,
      );
      subPlayer.isConnected = true;
    }

    return player;
  }

  /**
   * Can a newcomer be seated in the game that's running right now? Only if a
   * game exists, it hasn't dealt yet, and it has a free seat.
   */
  private canSeatInActiveGame(): boolean {
    const sub = this.activeSubRoom;
    if (!sub) return false;
    if (!acceptsRosterChanges(sub)) return false;
    return sub.players.length < sub.maxPlayers;
  }

  addBot(name: string, difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);
    this.botDifficulty.set(id, difficulty);
    this.ensureScore(player);
    this.lastActivityAt = Date.now();

    if (this.canSeatInActiveGame()) {
      this.activeSubRoom!.addBot(name, difficulty);
    }

    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.botDifficulty.delete(botId);
    this.scores.delete(botId);
    this.lastActivityAt = Date.now();

    this.activeSubRoom?.removeBot(botId);
    return true;
  }

  /**
   * Remove a human from the party entirely (they pressed Leave, or the host
   * kicked them). Distinct from a disconnect, which keeps the seat warm.
   */
  removePlayer(playerId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return false;
    const [gone] = this.players.splice(idx, 1);
    this.lastActivityAt = Date.now();

    // If the host left, promote the longest-present connected human so the
    // party isn't stranded with nobody able to start the next game.
    if (gone.isHost) {
      const heir = this.players.find((p) => !p.isBot && p.isConnected);
      if (heir) {
        heir.isHost = true;
        const subHeir = this.activeSubRoom?.getPlayer(heir.id);
        if (subHeir) subHeir.isHost = true;
      }
    }
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
    this.activeSubRoom?.handleDisconnect(socketId);
    return player;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    player.isConnected = true;
    player.socketId = socketId;
    this.lastActivityAt = Date.now();
    this.activeSubRoom?.handleReconnect(playerId, socketId);
    return player;
  }

  /** Humans currently connected. Bots don't count toward "is anyone here". */
  get connectedHumanCount(): number {
    return this.players.filter((p) => !p.isBot && p.isConnected).length;
  }

  // ---------------------------------------------------------------------
  // GameRoom contract
  // ---------------------------------------------------------------------

  /**
   * Delegates to the staged game, because "can we start" is a question about
   * the game's own seating rules (Codenames needs 4, domino teams needs
   * exactly 4), not about the party.
   */
  canStart(): boolean {
    if (this.activeSubRoom) return this.activeSubRoom.canStart();
    return this.players.length >= 2;
  }

  /**
   * A party itself is never "started" — `pickGame` is the real entry point.
   * Delegating keeps the generic `start_game` event working for the classic
   * create-room-then-wait-for-friends flow, where the game is staged at
   * creation time and started once everyone has arrived.
   */
  startGame(): unknown | null {
    if (!this.activeSubRoom) return null;
    // Phase flips BEFORE the engine starts, not after. Engines broadcast from
    // inside startGame(), and that broadcast is re-wrapped by toState() — so
    // setting the phase afterwards means the state clients actually receive
    // still says "hub", and nobody's screen moves to the game.
    this.phase = "playing";
    this.lastActivityAt = Date.now();
    const result = this.activeSubRoom.startGame();
    this.broadcast();
    return result;
  }

  // ---------------------------------------------------------------------
  // Game switching — the point of this class
  // ---------------------------------------------------------------------

  /**
   * Swap the active game. Safe to call from any phase: a game in progress is
   * torn down first. The roster, the room code, the chat and the voice mesh
   * are untouched.
   */
  pickGame(
    gameId: string,
    options: Partial<CreateRoomOptions> = {},
    { autoStart = false }: { autoStart?: boolean } = {},
  ): { success: boolean; error?: string } {
    if (this.destroyed) return { success: false, error: "Party is closed" };

    const spec = getSpec(gameId);
    if (!spec) return { success: false, error: `Unknown game: ${gameId}` };

    // Bots don't fill seats in every game. Count only the seats that will
    // really be occupied, so a party of 2 humans + 2 bots can't pick
    // Codenames (which has no bots) and land in a 2-player game needing 4.
    const seatCount = spec.bots
      ? this.players.length
      : this.players.filter((p) => !p.isBot).length;

    const merged: CreateRoomOptions = {
      variant: "cards",
      deckCount: 1,
      ...options,
      // The game's seat count is the party's size, clamped to what the game
      // supports — a host should never have to set "max players" twice.
      maxPlayers: Math.min(
        spec.maxPlayers,
        Math.max(
          spec.minPlayers,
          Number(options.maxPlayers) || Math.max(seatCount, this.maxPlayers),
        ),
      ),
    } as CreateRoomOptions;

    // Seat count is only enforced when the game is about to start. While the
    // party is still filling up (room just created, friends still tapping the
    // link) a game may legitimately be staged with nobody in it yet.
    const err = validateGameOptions(
      gameId,
      merged,
      autoStart ? seatCount : undefined,
    );
    if (err) return { success: false, error: err };

    // Only tear the old game down once the new one is known to be valid —
    // otherwise a rejected pick would leave the party with no game at all.
    this.teardownSubRoom();

    const subRoom = createGameRoom(gameId, this.roomId, merged, {
      // Sub-games broadcast their own state; the party re-wraps it so the
      // client always receives one consistent envelope regardless of which
      // game is active.
      broadcast: () => this.broadcast(),
      onGameEnd: (_rid, winnerId) => this.onSubGameEnd(winnerId),
      onHandsChanged: () => this.callbacks.onHandsChanged(this.roomId),
    });

    if (!subRoom) return { success: false, error: `Unknown game: ${gameId}` };

    this.activeSubRoom = subRoom;
    this.activeGameId = gameId;
    this.activeOptions = merged;
    this.lastActivityAt = Date.now();

    this.seatRoster(subRoom, spec.bots);

    if (autoStart) {
      this.phase = "playing";
      // Same ordering rule as startGame(): phase first, engine second.
      subRoom.startGame();
    } else {
      // Staged but not dealt: the party sits in the hub while people arrive,
      // and the sub-room is in its own lobby phase so joiners get seated.
      this.phase = "hub";
    }
    this.broadcast();
    return { success: true };
  }

  /** Update configuration of the currently staged game before starting. */
  updateOptions(options: Partial<CreateRoomOptions>): { success: boolean; error?: string } {
    if (this.destroyed) return { success: false, error: "Party is closed" };
    if (!this.activeGameId) {
      return { success: false, error: "No game staged" };
    }
    const merged = {
      ...this.activeOptions,
      ...options,
    };
    return this.pickGame(this.activeGameId, merged, { autoStart: false });
  }

  /** Restart the current game with the same settings and the same people. */
  rematch(): { success: boolean; error?: string } {
    if (!this.activeGameId) {
      return { success: false, error: "No game to rematch" };
    }
    return this.pickGame(this.activeGameId, this.activeOptions ?? {}, { autoStart: true });
  }

  /** Back to the hub — no game running, roster and voice intact. */
  returnToHub(): void {
    this.teardownSubRoom();
    this.activeGameId = null;
    this.activeOptions = null;
    this.phase = "hub";
    this.lastActivityAt = Date.now();
    this.broadcast();
  }

  /**
   * Copy the party roster into a freshly created engine, preserving player
   * ids. Ids must survive the switch or the voice mesh (keyed by player id)
   * rebuilds every peer connection and everyone hears a dropout.
   */
  private seatRoster(subRoom: GameRoom, allowBots: boolean): void {
    for (const player of this.players) {
      if (player.isBot) {
        if (allowBots) {
          subRoom.addBot(player.name, this.botDifficulty.get(player.id) ?? "medium");
        }
        continue;
      }
      // Engines cap their own seat counts; a party larger than the game
      // allows leaves the overflow as spectators rather than throwing.
      if (subRoom.players.length >= subRoom.maxPlayers) break;
      const subPlayer = subRoom.addPlayer(
        player.name,
        player.socketId ?? "",
        player.isHost,
        player.id,
        player.flag,
        player.icon,
        player.characterId,
      );
      subPlayer.isConnected = player.isConnected;
    }
  }

  private teardownSubRoom(): void {
    if (this.activeSubRoom) {
      this.activeSubRoom.destroy();
      this.activeSubRoom = null;
    }
  }

  // ---------------------------------------------------------------------
  // The night's scoreboard
  // ---------------------------------------------------------------------

  private ensureScore(player: Player): PartyScoreEntry {
    let entry = this.scores.get(player.id);
    if (!entry) {
      entry = { playerId: player.id, name: player.name, wins: 0, played: 0 };
      this.scores.set(player.id, entry);
    }
    // Names can change between games; keep the scoreboard current.
    entry.name = player.name;
    return entry;
  }

  private onSubGameEnd(winnerId: string): void {
    for (const player of this.players) {
      const entry = this.ensureScore(player);
      entry.played++;
      if (player.id === winnerId) entry.wins++;
    }

    const winner = this.getPlayer(winnerId);
    this.history.push({
      gameId: this.activeGameId ?? "unknown",
      winnerId: winnerId || null,
      winnerName: winner?.name ?? null,
      endedAt: Date.now(),
    });
    // Keep the hub readable; nobody scrolls past a dozen games.
    if (this.history.length > 20) this.history.shift();

    this.lastActivityAt = Date.now();
    this.callbacks.onGameEnd(this.roomId, winnerId);
    this.broadcast();
  }

  /** Scoreboard, best first. */
  get leaderboard(): PartyScoreEntry[] {
    return [...this.scores.values()]
      .filter((e) => this.players.some((p) => p.id === e.playerId))
      .sort((a, b) => b.wins - a.wins || b.played - a.played);
  }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  private broadcast(): void {
    if (this.destroyed) return;
    this.callbacks.broadcast(this.toState());
  }

  toState(): unknown {
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      phase: this.phase,
      activeGameId: this.activeGameId,
      activeOptions: this.activeOptions,
      players: this.players.map((p) => p.toPublicData()),
      maxPlayers: this.maxPlayers,
      leaderboard: this.leaderboard,
      history: this.history,
      subGameState: this.activeSubRoom ? this.activeSubRoom.toState() : null,
    };
  }

  toPlayerState(playerId: string): unknown {
    const player = this.getPlayer(playerId);
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      phase: this.phase,
      activeGameId: this.activeGameId,
      activeOptions: this.activeOptions,
      players: this.players.map((p) =>
        p.id === playerId ? p.toData() : p.toPublicData(),
      ),
      maxPlayers: this.maxPlayers,
      leaderboard: this.leaderboard,
      history: this.history,
      hand: player ? player.hand : [],
      subGameState: this.activeSubRoom
        ? this.activeSubRoom.toPlayerState(playerId)
        : null,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.teardownSubRoom();
  }
}
