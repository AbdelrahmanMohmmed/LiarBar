/**
 * Spyfall types — see the note in dominoTypes.ts. Generated from
 * `server/src/shared/spyfall.ts`.
 */

export type {
  Bilingual,
  SpyfallPhase,
  SpyfallSeat,
  SpyfallVote,
  SpyfallReveal,
  SpyfallPrivate,
} from "./generated/spyfall";

import type {
  SpyfallState as SpyfallPublicState,
  SpyfallPrivate,
} from "./generated/spyfall";

/** Public state plus this player's secret, which arrives on a separate event. */
export type SpyfallState = SpyfallPublicState & Partial<SpyfallPrivate>;
