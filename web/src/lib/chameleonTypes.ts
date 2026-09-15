/** Client mirror of `server/src/games/chameleon/ChameleonGame.ts`. */

export interface Bilingual {
  en: string;
  ar: string;
}

export type ChameleonPhase =
  | "lobby"
  | "clues"
  | "voting"
  | "guessing"
  | "reveal"
  | "game_over";

export interface ChameleonSeat {
  playerId: string;
  name: string;
  isConnected: boolean;
  flag?: string;
  score: number;
  /** Their one-word clue. */
  clue: string | null;
  /** Null during voting — running votes are hidden to stop a bandwagon. */
  votedFor: string | null;
  hasVoted: boolean;
}

export interface ChameleonReveal {
  chameleonId: string;
  chameleonName: string;
  secretIndex: number;
  secretWord: Bilingual;
  votedOutId: string | null;
  votedOutName: string | null;
  caught: boolean;
  guessedIndex: number | null;
  guessedRight: boolean;
  chameleonWon: boolean;
  pointsAwarded: Record<string, number>;
  nextRoundAt: number | null;
}

export interface ChameleonState {
  roomId: string;
  gameId: "chameleon";
  phase: ChameleonPhase;
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
  seats: ChameleonSeat[];
  roundNumber: number;
  targetScore: number;
  /** The 4x4 grid. Public — everyone sees all sixteen words. */
  topic: { id: string; title: Bilingual; words: Bilingual[] } | null;
  cluePlayerId: string | null;
  deadline: number | null;
  reveal: ChameleonReveal | null;
  winnerId: string | null;

  // --- Private slice ---
  isChameleon?: boolean;
  /** Index into `topic.words`, or null if you're the chameleon. */
  secretIndex?: number | null;
}
