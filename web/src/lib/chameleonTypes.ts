/**
 * Chameleon types — see the note in dominoTypes.ts. Generated from
 * `server/src/shared/chameleon.ts`.
 */

export type {
  Bilingual,
  ChameleonPhase,
  ChameleonSeat,
  ChameleonReveal,
  ChameleonPrivate,
} from "./generated/chameleon";

import type {
  ChameleonState as ChameleonPublicState,
  ChameleonPrivate,
} from "./generated/chameleon";

/** Public state plus this player's secret, which arrives on a separate event. */
export type ChameleonState = ChameleonPublicState & Partial<ChameleonPrivate>;
