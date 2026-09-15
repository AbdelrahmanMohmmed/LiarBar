/**
 * Domino types.
 *
 * These are no longer declared here. They come from
 * `generated/domino.ts`, which is copied from `server/src/shared/domino.ts` by
 * `npm run types:sync` (run from the server package) — so the client is
 * provably describing the same shape the server actually sends.
 *
 * This file stays as the import path the rest of the app already uses.
 */

export type {
  Tile,
  PlacedTile,
  BoardEnds,
  DominoTeam,
  DominoMode,
  DominoPhase,
  RoundEndMethod,
  DominoEvent,
  DominoSeatState,
  DominoRecap,
  DominoState,
  DominoPrivate,
  RoomPlayerLite,
} from "./generated/domino";

export { sameTile, tileKey, pips, isDouble } from "./generated/domino";

/**
 * What the domino pages actually hold: the public state merged with this
 * player's private slice, which arrives separately on `domino_private` and is
 * therefore optional until it does.
 */
import type { DominoState, DominoPrivate } from "./generated/domino";
export type DominoStateV2 = DominoState & Partial<DominoPrivate>;
