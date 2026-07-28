import type { GameRoom, GameRoomCallbacks } from "./types.js";
import {
  GameManager,
  type GameTheme,
  type ChallengeMode,
} from "./liars-bar/GameManager.js";
import type { GameVariant, ClaimType } from "./liars-bar/Deck.js";
import { CodenamesGame } from "./codenames/CodenamesGame.js";
import { HigherLowerGame } from "./higher-lower/HigherLowerGame.js";
import { LobbyRoom } from "./lobby/LobbyRoom.js";
import { TicTacToeGame } from "./tictactoe/TicTacToeGame.js";
import { SnakeGame } from "./snake/SnakeGame.js";
import { SpaceInvadersGame } from "./space-invaders/SpaceInvadersGame.js";
import { FighterGame } from "./fighter/FighterGame.js";
import { DominoGame } from "./domino/DominoGame.js";
import { MemoryPuzzleGame } from "./memory-puzzle/MemoryPuzzleGame.js";
import { TetrisGame } from "./tetris/TetrisGame.js";
import { RentoGame } from "./rento/RentoGame.js";
import { SnakeLadderGame } from "./snake-ladder/SnakeLadderGame.js";
import type { Lang } from "./codenames/board.js";

/**
 * Options sent by the client when creating a room. Each game validates
 * the subset it cares about inside its factory.
 */
export interface CreateRoomOptions {
  maxPlayers: number;
  variant: GameVariant;
  deckCount: number;
  claimType?: ClaimType;
  revealTime?: number;
  theme?: GameTheme;
  challengeMode?: ChallengeMode;
  challengeDuration?: number;
  language?: Lang;
  // Domino options
  gameMode?: "individual" | "teams";
  targetScore?: number;
  turnTimeLimit?: number;
  tableTheme?: string;
  tileTheme?: string;
  // Rento options
  startingBalance?: number;
  jailEnabled?: boolean;
  freeParkingBonus?: number;
  turnTimer?: number;
  aiDifficulty?: "easy" | "medium" | "hard";
}

export type GameFactory = (
  roomId: string,
  options: CreateRoomOptions,
  callbacks: GameRoomCallbacks,
) => GameRoom;

/**
 * Registry of playable games. To add a new game:
 *   1. Create src/games/<your-game>/ implementing GameRoom.
 *   2. Register its factory here under a new gameId.
 *   3. The client passes `gameId` in create_room to pick it.
 */
const factories = new Map<string, GameFactory>();

export function registerGame(gameId: string, factory: GameFactory): void {
  factories.set(gameId, factory);
}

export function createGameRoom(
  gameId: string,
  roomId: string,
  options: CreateRoomOptions,
  callbacks: GameRoomCallbacks,
): GameRoom | null {
  const factory = factories.get(gameId);
  if (!factory) return null;
  return factory(roomId, options, callbacks);
}

export const DEFAULT_GAME_ID = "liars-bar";

registerGame(DEFAULT_GAME_ID, (roomId, options, callbacks) => {
  const revealSec = Math.max(3, Math.min(10, options.revealTime || 5));
  const challengeMode: ChallengeMode =
    options.challengeMode === "vote" ? "vote" : "timer";
  const challengeDuration =
    options.challengeDuration === 10 ? 10 : 5;

  return new GameManager(
    roomId,
    options.variant,
    options.deckCount,
    options.maxPlayers,
    options.variant === "cards" ? options.claimType || "suit" : "suit",
    revealSec,
    options.theme || "standard",
    callbacks.broadcast,
    callbacks.onGameEnd,
    (rid) => callbacks.onHandsChanged(rid),
    challengeMode,
    challengeDuration,
  );
});

registerGame("codenames", (roomId, options, callbacks) => {
  return new CodenamesGame(
    roomId,
    options.maxPlayers,
    options.language ?? "ar",
    callbacks,
  );
});

registerGame("higher-lower", (roomId, options, callbacks) => {
  return new HigherLowerGame(
    roomId,
    options.maxPlayers,
    callbacks,
  );
});

registerGame("lobby", (roomId, options, callbacks) => {
  return new LobbyRoom(
    roomId,
    options.maxPlayers,
    callbacks,
  );
});

registerGame("tictactoe", (roomId, options, callbacks) => {
  const winTarget = Number((options as any).winTarget) || 3;
  return new TicTacToeGame(roomId, options.maxPlayers, callbacks, winTarget);
});

registerGame("snake", (roomId, options, callbacks) => {
  const duration = Number((options as any).duration) || 60;
  return new SnakeGame(roomId, options.maxPlayers, callbacks, duration);
});

registerGame("space-invaders", (roomId, options, callbacks) => {
  return new SpaceInvadersGame(roomId, options.maxPlayers, callbacks);
});

registerGame("fighter", (roomId, options, callbacks) => {
  return new FighterGame(roomId, options, callbacks);
});

registerGame("domino", (roomId, options, callbacks) => {
  const gameMode = options.gameMode === "teams" ? "teams" : "individual";
  const targetScore = Number(options.targetScore) || 100;
  const turnTimeLimit = Number(options.turnTimeLimit) !== undefined ? Number(options.turnTimeLimit) : 30;
  const tableTheme = options.tableTheme || "green";
  const tileTheme = options.tileTheme || "ivory";
  return new DominoGame(
    roomId,
    options.maxPlayers,
    gameMode,
    targetScore,
    turnTimeLimit,
    callbacks,
    tableTheme,
    tileTheme
  );
});

registerGame("memory-puzzle", (roomId, options, callbacks) => {
  return new MemoryPuzzleGame(roomId, options.maxPlayers, callbacks);
});

registerGame("tetris", (roomId, options, callbacks) => {
  return new TetrisGame(roomId, options.maxPlayers, callbacks);
});

registerGame("rento", (roomId, options, callbacks) => {
  return new RentoGame(
    roomId,
    {
      maxPlayers: options.maxPlayers,
      startingBalance: Number(options.startingBalance) || 1500,
      jailEnabled: options.jailEnabled !== false,
      freeParkingBonus: Number(options.freeParkingBonus) || 0,
      turnTimer: Number(options.turnTimer) || 15000,
      aiDifficulty: options.aiDifficulty === "easy" || options.aiDifficulty === "hard" ? options.aiDifficulty : "medium",
    },
    callbacks,
  );
});

registerGame("snake-ladder", (roomId, options, callbacks) => {
  return new SnakeLadderGame(roomId, options.maxPlayers, callbacks);
});
