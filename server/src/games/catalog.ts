import type { CreateRoomOptions } from "./registry.js";

/**
 * One description of every game, used for three things that used to be three
 * separate hand-maintained lists:
 *
 *   1. Validating `create_room` options.
 *   2. Validating `party_pick_game` options (previously unvalidated — a party
 *      could be switched into a game with an illegal player count, which then
 *      failed deep inside the engine).
 *   3. Telling the client which games a party of N people can actually play,
 *      so the game picker can grey out the ones that don't fit instead of
 *      letting the host pick one and get an error.
 *
 * Keep the ids in sync with `registry.ts` and with `web/src/lib/brand.ts`.
 */

export type GameSeating =
  /** Everyone plays together in one shared game. */
  | "party"
  /** Exactly two sides; more players spectate or rotate. */
  | "duel"
  /** Everyone plays their own board, scores compared at the end. */
  | "parallel";

export interface GameSpec {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  seating: GameSeating;
  /** Can empty seats be filled with bots? */
  bots: boolean;
  /**
   * Games whose whole point is the conversation. The client uses this to
   * prompt "turn your mic on" when a party picks one of them.
   */
  voiceMatters: boolean;
  /** Extra per-game option validation. Return an error string, or null. */
  validate?: (o: Partial<CreateRoomOptions>) => string | null;
}

function intInRange(
  value: unknown,
  min: number,
  max: number,
  label: string,
): string | null {
  if (value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    return `${label} must be between ${min} and ${max}`;
  }
  return null;
}

function oneOf(
  value: unknown,
  allowed: readonly string[],
  label: string,
): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !allowed.includes(value)) {
    return `${label} must be one of: ${allowed.join(", ")}`;
  }
  return null;
}

export const GAME_SPECS: Record<string, GameSpec> = {
  "liars-bar": {
    id: "liars-bar",
    minPlayers: 2,
    maxPlayers: 6,
    seating: "party",
    bots: true,
    voiceMatters: true,
    validate: (o) =>
      intInRange(o.deckCount, 1, 4, "Deck count") ??
      oneOf(o.variant, ["cards", "dominoes"], "Variant") ??
      oneOf(o.claimType, ["suit", "rank"], "Claim type") ??
      intInRange(o.revealTime, 3, 10, "Reveal time") ??
      oneOf(o.challengeMode, ["timer", "vote"], "Challenge mode"),
  },

  domino: {
    id: "domino",
    minPlayers: 2,
    maxPlayers: 4,
    seating: "party",
    bots: true,
    voiceMatters: true,
    validate: (o) => {
      const modeErr = oneOf(o.gameMode, ["individual", "teams"], "Game mode");
      if (modeErr) return modeErr;
      if (o.gameMode === "teams" && Number(o.maxPlayers) !== 4) {
        return "Team mode needs exactly 4 players";
      }
      return (
        intInRange(o.targetScore, 50, 300, "Target score") ??
        intInRange(o.turnTimeLimit, 0, 120, "Turn time limit")
      );
    },
  },

  codenames: {
    id: "codenames",
    minPlayers: 4,
    maxPlayers: 10,
    seating: "party",
    bots: false,
    voiceMatters: true,
    validate: (o) => oneOf(o.language, ["ar", "en"], "Language"),
  },

  spyfall: {
    id: "spyfall",
    minPlayers: 3,
    maxPlayers: 10,
    seating: "party",
    // No bots, and not for lack of effort: the whole game is unstructured
    // conversation. A bot would have to ask a plausible question, evaluate a
    // spoken answer, and lie under questioning. A silent bot is worse than an
    // empty seat — it looks like a player who stopped responding and the table
    // wastes the round suspecting it.
    bots: false,
    voiceMatters: true,
    validate: (o) =>
      intInRange(o.roundSeconds, 120, 900, "Round length") ??
      intInRange(o.targetScore, 3, 20, "Target score"),
  },

  chameleon: {
    id: "chameleon",
    minPlayers: 3,
    maxPlayers: 10,
    seating: "party",
    // Same reason as Spyfall: a bot would have to invent a one-word clue about
    // a word it can see, and judge whether everyone else's clue sounded
    // informed. Both are the game itself, not a supporting task.
    bots: false,
    voiceMatters: true,
    validate: (o) => intInRange(o.targetScore, 4, 30, "Target score"),
  },

  bluff: {
    id: "bluff",
    minPlayers: 3,
    maxPlayers: 10,
    seating: "party",
    // No bots. A bot would have to write a lie convincing enough to fool
    // people who know each other, and then guess — which is both halves of
    // the game rather than a supporting task.
    bots: false,
    // Playable in silence, unlike Spyfall or Chameleon: everything that
    // matters is typed. Voice makes it much funnier, but it isn't load-bearing,
    // which makes this the one party game that survives a bad connection.
    voiceMatters: false,
    validate: (o) =>
      intInRange(o.rounds, 3, 12, "Rounds") ??
      oneOf(o.language, ["ar", "en"], "Language"),
  },

  wyr: {
    id: "wyr",
    minPlayers: 3,
    maxPlayers: 10,
    seating: "party",
    // No bots: the whole game is how well you know the actual people at the
    // table. A bot has nothing to know and nothing to be known about.
    bots: false,
    voiceMatters: true,
    validate: (o) => intInRange(o.targetScore, 5, 40, "Target score"),
  },

  "higher-lower": {
    id: "higher-lower",
    minPlayers: 2,
    maxPlayers: 6,
    seating: "party",
    bots: false,
    voiceMatters: false,
  },

  rento: {
    id: "rento",
    minPlayers: 2,
    maxPlayers: 6,
    seating: "party",
    bots: true,
    voiceMatters: true,
    validate: (o) =>
      intInRange(o.startingBalance, 200, 10000, "Starting balance") ??
      intInRange(o.turnTimer, 30000, 120000, "Turn timer") ??
      intInRange(o.freeParkingBonus, 0, 2000, "Free parking bonus") ??
      oneOf(o.aiDifficulty, ["easy", "medium", "hard"], "AI difficulty") ??
      oneOf(o.mapId, ["middle_east", "europe", "americas"], "Map") ??
      oneOf(
        o.backgroundId,
        ["nebula", "ocean", "sunset", "emerald"],
        "Background",
      ),
  },

  "snake-ladder": {
    id: "snake-ladder",
    minPlayers: 2,
    maxPlayers: 6,
    seating: "party",
    bots: false,
    voiceMatters: false,
  },

  "memory-puzzle": {
    id: "memory-puzzle",
    minPlayers: 2,
    maxPlayers: 10,
    seating: "party",
    bots: false,
    voiceMatters: false,
    validate: (o) => oneOf(o.difficulty, ["easy", "medium", "hard"], "Difficulty"),
  },

  tictactoe: {
    id: "tictactoe",
    minPlayers: 2,
    maxPlayers: 10,
    seating: "duel",
    bots: false,
    voiceMatters: false,
  },

  fighter: {
    id: "fighter",
    minPlayers: 2,
    maxPlayers: 4,
    seating: "duel",
    bots: false,
    voiceMatters: false,
  },

  snake: {
    id: "snake",
    minPlayers: 2,
    maxPlayers: 4,
    seating: "parallel",
    bots: false,
    voiceMatters: false,
  },

  "space-invaders": {
    id: "space-invaders",
    minPlayers: 2,
    maxPlayers: 8,
    seating: "parallel",
    bots: false,
    voiceMatters: false,
  },

  tetris: {
    id: "tetris",
    minPlayers: 1,
    maxPlayers: 10,
    seating: "parallel",
    bots: false,
    voiceMatters: false,
  },
};

/** Ids a party can switch into, in the order the picker should show them. */
export const PARTY_GAME_ORDER = [
  "domino",
  "spyfall",
  "chameleon",
  "bluff",
  "wyr",
  "liars-bar",
  "codenames",
  "higher-lower",
  "rento",
  "tictactoe",
  "snake",
  "tetris",
  "memory-puzzle",
  "space-invaders",
  "fighter",
  "snake-ladder",
] as const;

export function getSpec(gameId: string): GameSpec | undefined {
  return GAME_SPECS[gameId];
}

/**
 * Validate the options for a game. Returns an error message, or null if the
 * options are acceptable.
 *
 * `playerCount` is checked separately from `options.maxPlayers` because the
 * two mean different things: when creating a room, maxPlayers is the seat
 * count being requested; when a party switches game, the seats are already
 * filled and what matters is how many people are actually in the room.
 */
export function validateGameOptions(
  gameId: string,
  options: Partial<CreateRoomOptions>,
  playerCount?: number,
): string | null {
  const spec = GAME_SPECS[gameId];
  if (!spec) return `Unknown game: ${gameId}`;

  if (playerCount !== undefined) {
    if (playerCount < spec.minPlayers) {
      return `${gameId} needs at least ${spec.minPlayers} players`;
    }
    if (playerCount > spec.maxPlayers) {
      return `${gameId} supports at most ${spec.maxPlayers} players`;
    }
  } else {
    const max = Number(options.maxPlayers);
    if (
      !Number.isInteger(max) ||
      max < spec.minPlayers ||
      max > spec.maxPlayers
    ) {
      return `Players must be between ${spec.minPlayers} and ${spec.maxPlayers}`;
    }
  }

  return spec.validate?.(options) ?? null;
}

/** Public catalogue for the client's game picker. Safe to send to anyone. */
export function publicCatalog(): Array<
  Pick<
    GameSpec,
    "id" | "minPlayers" | "maxPlayers" | "seating" | "bots" | "voiceMatters"
  >
> {
  return PARTY_GAME_ORDER.filter((id) => GAME_SPECS[id]).map((id) => {
    const s = GAME_SPECS[id];
    return {
      id: s.id,
      minPlayers: s.minPlayers,
      maxPlayers: s.maxPlayers,
      seating: s.seating,
      bots: s.bots,
      voiceMatters: s.voiceMatters,
    };
  });
}
