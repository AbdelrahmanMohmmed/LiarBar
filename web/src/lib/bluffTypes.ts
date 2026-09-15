/**
 * Bluff types — see the note in dominoTypes.ts. Generated from
 * `server/src/shared/bluff.ts`.
 */

export type {
  BluffPhase,
  BluffSeat,
  BluffOption,
  BluffRevealEntry,
  BluffReveal,
  BluffPrivate,
} from "./generated/bluff";

import type { BluffState as BluffPublicState, BluffPrivate } from "./generated/bluff";

/** Public state plus this player's own answer, which arrives separately. */
export type BluffState = BluffPublicState & Partial<BluffPrivate>;
