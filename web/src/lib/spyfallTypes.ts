/**
 * Client mirror of the Spyfall server state.
 *
 * Mirrors `server/src/games/spyfall/SpyfallGame.ts` — see
 * [ARCHITECTURE.md §3](../../../docs/ARCHITECTURE.md) on why these types are
 * currently duplicated by hand and what should replace that.
 */

export interface Bilingual {
  en: string;
  ar: string;
}

export type SpyfallPhase = "lobby" | "playing" | "voting" | "reveal" | "game_over";

export interface SpyfallSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Each player gets one accusation per round. */
  hasAccused: boolean;
  votedFor: string | null;
}

export interface SpyfallVote {
  voterId: string;
  /** Empty string means they voted NO. */
  targetId: string;
}

export interface SpyfallReveal {
  reason: "voted" | "spy_guessed" | "timeout";
  spyId: string;
  spyName: string;
  accusedId: string | null;
  accusedName: string | null;
  locationId: string;
  locationName: Bilingual;
  guessedLocationId: string | null;
  spyWon: boolean;
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface SpyfallState {
  roomId: string;
  gameId: "spyfall";
  phase: SpyfallPhase;
  maxPlayers: number;
  players: Array<{
    id: string;
    name: string;
    isBot: boolean;
    isHost: boolean;
    isConnected: boolean;
    flag?: string;
    cardCount: number;
    hand: never[];
  }>;
  seats: SpyfallSeat[];
  roundNumber: number;
  roundSeconds: number;
  roundEndsAt: number | null;
  askingPlayerId: string | null;
  /** All locations. Public — the spy needs the list to guess from. */
  locations: Array<{ id: string; name: Bilingual }>;
  vote: {
    accuserId: string;
    accuserName: string;
    targetId: string;
    targetName: string;
    votes: SpyfallVote[];
    needed: number;
    endsAt: number;
  } | null;
  reveal: SpyfallReveal | null;
  winnerId: string | null;
  targetScore: number;

  // --- Private slice, only present in the per-player state ---
  /** True if YOU are the spy. Never true in the public broadcast. */
  isSpy?: boolean;
  locationId?: string | null;
  locationName?: Bilingual | null;
  role?: Bilingual | null;
}
