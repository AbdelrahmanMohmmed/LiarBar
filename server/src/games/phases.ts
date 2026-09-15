import type { GameRoom } from "./types.js";

/**
 * The phase vocabulary problem, and its fix.
 *
 * Each engine invented its own phase names. Across thirteen of them, the
 * pre-game state is spelled `"lobby"`, `"countdown"`, or simply doesn't exist
 * (Tic-Tac-Toe starts at `"playing"`), and the terminal state is `"finished"`
 * or `"game_over"`. Nothing enforced consistency, and nothing warned when a new
 * engine picked a fourth spelling.
 *
 * That was invisible until code outside the engines started asking questions
 * about phase, and then it produced three separate bugs, none of which threw:
 *
 *  1. **`join_room` rejected every join** to a standalone Tetris, Snake,
 *     Tic-Tac-Toe, Fighter, Memory or Space Invaders room, because it tested
 *     `phase !== "lobby"` and those engines never use that word. The room was
 *     live, the code was valid, and the server said "game already in progress"
 *     to the first person who tried to join.
 *
 *  2. **`add_bot` failed** in a party that had picked one of those games, for
 *     the same reason.
 *
 *  3. **The stale-room sweeper never fast-expired a finished game** of those
 *     types, because it tested `phase === "game_over"`. Those rooms sat in
 *     memory for the full two-hour idle TTL instead of ten minutes.
 *
 * The fix is one place that knows every spelling, rather than thirteen engines
 * being made to agree. Engines stay free to name their own phases — which is
 * reasonable, since a phase name is part of a game's own model and appears in
 * its client — and the transport layer asks a question instead of matching a
 * string.
 */

/**
 * Phases in which the roster can still change: nothing has been dealt, so a
 * player or bot can be added without corrupting a game in progress.
 *
 * `"countdown"` counts as pre-game on purpose. Those engines start their clock
 * the moment the room is created, but nothing is committed until it reaches
 * zero, and a latecomer arriving during the countdown is exactly the case a
 * party needs to handle.
 */
const PRE_GAME_PHASES = new Set(["lobby", "hub", "waiting", "countdown", "setup"]);

/** Phases meaning the game is over and the room is only being looked at. */
const TERMINAL_PHASES = new Set(["game_over", "finished", "ended", "complete"]);

export function isPreGamePhase(phase: string): boolean {
  return PRE_GAME_PHASES.has(phase);
}

export function isTerminalPhase(phase: string): boolean {
  return TERMINAL_PHASES.has(phase);
}

/** Can this room take another player or bot right now? */
export function acceptsRosterChanges(room: GameRoom): boolean {
  return isPreGamePhase(room.phase);
}

/** Is this room's game finished? Used by the sweeper to expire it sooner. */
export function isGameOver(room: GameRoom): boolean {
  return isTerminalPhase(room.phase);
}
