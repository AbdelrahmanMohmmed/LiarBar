import type { GameRoom, GameRoomCallbacks } from "./types.js";
import {
  GameManager,
  type GameTheme,
  type ChallengeMode,
} from "./liars-bar/GameManager.js";
import type { GameVariant, ClaimType } from "./liars-bar/Deck.js";
import { CodenamesGame } from "./codenames/CodenamesGame.js";
import { HigherLowerGame } from "./higher-lower/HigherLowerGame.js";
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
