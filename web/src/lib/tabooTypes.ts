/**
 * Taboo types — see the note in dominoTypes.ts. Generated from
 * `server/src/shared/taboo.ts`.
 */

export type {
  TabooPhase,
  TabooTeam,
  TabooResult,
  TabooSeat,
  TabooTurnRecap,
  TabooPrivate,
} from "./generated/taboo";

import type { TabooState as TabooPublicState, TabooPrivate } from "./generated/taboo";

/** Public state plus this player's own view of the card, which arrives separately. */
export type TabooState = TabooPublicState & Partial<TabooPrivate>;
