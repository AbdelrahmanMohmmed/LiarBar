import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import {
  shuffle,
  generateKey,
  pickWords,
  type Team,
  type Role,
  type Lang,
  type CardType,
  type LogEntry,
  type CodenamesState,
} from "./board.js";
import { validateClue } from "./validation.js";
import { getWordPool } from "./words/index.js";

interface Assignment {
  team: Team | null;
  role: Role | null;
}

interface InternalCard {
  word: string;
  revealed: boolean;
  type: CardType;
}

export type CodenamesPhase = "lobby" | "playing" | "finished";

export class CodenamesGame implements GameRoom {
  readonly gameId = "codenames";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: CodenamesPhase = "lobby";
  language: Lang;

  private assignments = new Map<string, Assignment>();
  private board: InternalCard[] = [];
  private startingTeam: Team | null = null;
  private turn: { team: Team; phase: "clue" | "guess" } | null = null;
  private clue: { word: string; count: number; guessesRemaining: number } | null = null;
  private log: LogEntry[] = [];
  private winner: Team | null = null;
  private winReason: "all_revealed" | "assassin" | null = null;

  private callbacks: GameRoomCallbacks;

  constructor(
    roomId: string,
    maxPlayers: number,
    language: Lang,
    callbacks: GameRoomCallbacks,
  ) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(4, Math.min(10, maxPlayers));
    this.language = language;
    this.callbacks = callbacks;
    this.lastActivityAt = Date.now();
  }

  addPlayer(name: string, socketId: string, isHost: boolean = false): Player {
    const id = nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);
    this.assignments.set(id, { team: null, role: null });
    this.lastActivityAt = Date.now();
    return player;
  }

  addBot(): Player {
    throw new Error("Bots are not supported in Codenames");
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
    return player;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return null;
    player.isConnected = true;
    player.socketId = socketId;
    this.lastActivityAt = Date.now();
    return player;
  }

  canStart(): boolean {
    if (this.players.length < 4) return false;
    for (const player of this.players) {
      if (!this.assignments.get(player.id)?.team) return false;
    }
    for (const team of ["red", "teal"] as Team[]) {
      const members = this.players.filter((p) => this.assignments.get(p.id)?.team === team);
      const spymasters = members.filter((p) => this.assignments.get(p.id)?.role === "spymaster");
      const operatives = members.filter((p) => this.assignments.get(p.id)?.role === "operative");
      if (spymasters.length !== 1 || operatives.length < 1) return false;
    }
    return true;
  }

  startGame(): CodenamesState | null {
    if (!this.canStart()) return null;

    const startingTeam: Team = shuffle(["red", "teal"] as Team[])[0];
    this.startingTeam = startingTeam;
    this.setupBoard(startingTeam);
    this.phase = "playing";
    this.turn = { team: startingTeam, phase: "clue" };
    this.clue = null;
    this.log = [];
    this.winner = null;
    this.winReason = null;

    const state = this.toState();
    this.emit();
    this.callbacks.onHandsChanged(this.roomId);
    return state;
  }

  joinTeam(playerId: string, team: Team, role: Role): { success: boolean; error?: string } {
    if (this.phase !== "lobby") {
      return { success: false, error: "Teams are locked once the game starts" };
    }
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }
    if (team !== "red" && team !== "teal") {
      return { success: false, error: "Invalid team" };
    }
    if (role !== "spymaster" && role !== "operative") {
      return { success: false, error: "Invalid role" };
    }
    if (role === "spymaster") {
      const taken = [...this.assignments.entries()].some(
        ([id, a]) => id !== playerId && a.team === team && a.role === "spymaster",
      );
      if (taken) {
        return { success: false, error: "That team's spymaster seat is already taken" };
      }
    }
    this.assignments.set(playerId, { team, role });
    this.emit();
    return { success: true };
  }

  giveClue(playerId: string, word: string, count: number): { success: boolean; error?: string } {
    if (this.phase !== "playing" || !this.turn || this.turn.phase !== "clue") {
      return { success: false, error: "Not awaiting a clue right now" };
    }
    const player = this.getPlayer(playerId);
    const assignment = this.assignments.get(playerId);
    if (!player || !assignment || assignment.team !== this.turn.team || assignment.role !== "spymaster") {
      return { success: false, error: "Only the current team's spymaster can give a clue" };
    }

    const unrevealedWords = this.board.filter((c) => !c.revealed).map((c) => c.word);
    const result = validateClue(word, count, unrevealedWords, this.language);
    if (!result.ok) {
      return { success: false, error: result.error };
    }

    const cleanWord = word.trim();
    this.clue = { word: cleanWord, count, guessesRemaining: count + 1 };
    this.turn = { team: this.turn.team, phase: "guess" };
    this.pushLog({ kind: "clue", team: assignment.team!, player: player.name, word: cleanWord, count });
    this.emit();
    return { success: true };
  }

  guessCard(playerId: string, cardIndex: number): { success: boolean; error?: string } {
    if (this.phase !== "playing" || !this.turn || this.turn.phase !== "guess") {
      return { success: false, error: "Not awaiting a guess right now" };
    }
    const player = this.getPlayer(playerId);
    const assignment = this.assignments.get(playerId);
    if (!player || !assignment || assignment.team !== this.turn.team || assignment.role !== "operative") {
      return { success: false, error: "Only the current team's operatives can guess" };
    }
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex > 24) {
      return { success: false, error: "Invalid card index" };
    }
    const card = this.board[cardIndex];
    if (!card || card.revealed) {
      return { success: false, error: "That card is already revealed" };
    }

    card.revealed = true;
    const guessingTeam = this.turn.team;
    const otherTeam = guessingTeam === "red" ? "teal" : "red";
    this.pushLog({
      kind: "guess",
      team: guessingTeam,
      player: player.name,
      word: card.word,
      result: card.type,
    });

    if (card.type === "assassin") {
      this.finishGame(otherTeam, "assassin");
      this.emit();
      return { success: true };
    }

    if (card.type === guessingTeam) {
      if (this.remainingFor(guessingTeam) === 0) {
        this.finishGame(guessingTeam, "all_revealed");
        this.emit();
        return { success: true };
      }
      if (this.clue) {
        this.clue.guessesRemaining -= 1;
        if (this.clue.guessesRemaining <= 0) {
          this.passTurn();
        }
      }
      this.emit();
      return { success: true };
    }

    // Neutral or the other team's card: the guess ends the turn.
    if (card.type !== "neutral" && this.remainingFor(card.type) === 0) {
      this.finishGame(card.type, "all_revealed");
      this.emit();
      return { success: true };
    }
    this.passTurn();
    this.emit();
    return { success: true };
  }

  endTurn(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "playing" || !this.turn || this.turn.phase !== "guess") {
      return { success: false, error: "Not in a guessing phase" };
    }
    const player = this.getPlayer(playerId);
    const assignment = this.assignments.get(playerId);
    if (!player || !assignment || assignment.team !== this.turn.team || assignment.role !== "operative") {
      return { success: false, error: "Only the current team's operatives can end the turn" };
    }
    this.pushLog({ kind: "pass", team: assignment.team!, player: player.name });
    this.passTurn();
    this.emit();
    return { success: true };
  }

  rematch(playerId: string): { success: boolean; error?: string } {
    if (this.phase !== "finished") {
      return { success: false, error: "Game is not finished" };
    }
    const player = this.getPlayer(playerId);
    if (!player || !player.isHost) {
      return { success: false, error: "Only the host can start a rematch" };
    }

    const nextStartingTeam: Team = this.startingTeam === "red" ? "teal" : "red";
    this.startingTeam = nextStartingTeam;
    this.setupBoard(nextStartingTeam);
    this.phase = "playing";
    this.turn = { team: nextStartingTeam, phase: "clue" };
    this.clue = null;
    this.log = [];
    this.winner = null;
    this.winReason = null;

    this.emit();
    this.callbacks.onHandsChanged(this.roomId);
    return { success: true };
  }

  toState(): CodenamesState {
    const board = this.board.map((c) =>
      c.revealed
        ? { word: c.word, revealed: true, type: c.type }
        : { word: c.word, revealed: false },
    );

    const assignments: Record<string, { team: Team | null; role: Role | null }> = {};
    for (const p of this.players) {
      const a = this.assignments.get(p.id) ?? { team: null, role: null };
      assignments[p.id] = { team: a.team, role: a.role };
    }

    return {
      roomId: this.roomId,
      gameId: "codenames",
      phase: this.phase,
      language: this.language,
      maxPlayers: this.maxPlayers,
      players: this.players.map((p) => p.toPublicData()),
      assignments,
      board,
      startingTeam: this.startingTeam,
      remaining: { red: this.remainingFor("red"), teal: this.remainingFor("teal") },
      turn: this.turn,
      clue: this.clue,
      log: this.log,
      winner: this.winner,
      winReason: this.winReason,
    };
  }

  toPlayerState(
    playerId: string,
  ): CodenamesState & { you: { playerId: string; team: Team | null; role: Role | null }; key?: CardType[] } {
    const base = this.toState();
    const assignment = this.assignments.get(playerId) ?? { team: null, role: null };
    const result: CodenamesState & {
      you: { playerId: string; team: Team | null; role: Role | null };
      key?: CardType[];
    } = {
      ...base,
      you: { playerId, team: assignment.team, role: assignment.role },
    };
    if (assignment.role === "spymaster" && this.board.length > 0) {
      result.key = this.board.map((c) => c.type);
    }
    return result;
  }

  destroy(): void {
    // No timers or other resources to release in v1.
  }

  private setupBoard(startingTeam: Team): void {
    const words = pickWords(getWordPool(this.language));
    const key = generateKey(startingTeam);
    this.board = words.map((word, i) => ({ word, revealed: false, type: key[i] }));
  }

  private remainingFor(team: Team): number {
    return this.board.filter((c) => c.type === team && !c.revealed).length;
  }

  private passTurn(): void {
    if (!this.turn) return;
    const nextTeam: Team = this.turn.team === "red" ? "teal" : "red";
    this.turn = { team: nextTeam, phase: "clue" };
    this.clue = null;
  }

  private finishGame(winner: Team, reason: "all_revealed" | "assassin"): void {
    this.phase = "finished";
    this.winner = winner;
    this.winReason = reason;
    this.callbacks.onGameEnd(this.roomId, winner);
  }

  private pushLog(entry: LogEntry): void {
    this.log.push(entry);
    if (this.log.length > 50) {
      this.log = this.log.slice(-50);
    }
  }

  private emit(): void {
    this.lastActivityAt = Date.now();
    this.callbacks.broadcast(this.toState());
  }
}
