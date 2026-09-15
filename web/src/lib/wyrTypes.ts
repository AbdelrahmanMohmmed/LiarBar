/**
 * Would You Rather types — see the note in dominoTypes.ts. Generated from
 * `server/src/shared/wyr.ts`.
 */

export type {
  Bilingual,
  WyrChoice,
  WyrPhase,
  WyrSeat,
  WyrReveal,
  WyrPrivate,
} from "./generated/wyr";

import type { WyrState as WyrPublicState, WyrPrivate } from "./generated/wyr";

/** Public state plus this player's own secret, which arrives separately. */
export type WyrState = WyrPublicState & Partial<WyrPrivate>;
