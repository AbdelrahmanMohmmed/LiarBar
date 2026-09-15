import {
  type Tile,
  type PlayOption,
  type BoardEnds,
  isDouble,
  pips,
  legalPlays,
  orient,
  teamForSeat,
} from "./rules.js";

/**
 * The domino bot.
 *
 * The old bot picked the heaviest legal tile, every time, forever. That is not
 * a difficulty level, it is a personality disorder — it's trivially readable,
 * it dumps its own doubles early, and it never once tries to block anyone. A
 * table with three of them was a table with no opponents.
 *
 * Real domino is played on public information: every tile on the table is
 * visible, and every knock tells you a number somebody doesn't hold. A bot
 * that ignores that is playing a different, much worse game. This one tracks
 * the same things a human at the table tracks:
 *
 *  - which pips are exhausted (seven of each value exist; count them down),
 *  - which numbers each opponent has knocked on — a hard fact, not a guess,
 *  - who their partner is, and therefore who to feed and who to starve.
 *
 * Difficulty is how much of that knowledge the bot is allowed to use, not how
 * much noise is added to its choice. A hard bot that plays well and an easy
 * bot that plays naively are recognisably the same game; a hard bot that plays
 * well and an easy bot that plays randomly are not, and players notice.
 */

export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotView {
  /** The bot's own tiles. */
  hand: Tile[];
  ends: BoardEnds;
  /** Seat index of the bot. */
  seat: number;
  seatCount: number;
  /** True when partners are in play (4 seats). */
  teams: boolean;
  /** How many tiles each seat still holds. */
  handSizes: number[];
  /**
   * Numbers each seat has knocked on. Public, hard information: if seat 2
   * knocked while the ends were 3 and 5, seat 2 holds no 3 and no 5.
   */
  knocks: number[][];
  /** How many of each pip value are already visible (played + in hand). */
  seenPipCount: number[];
}

const PROFILES: Record<
  BotDifficulty,
  {
    /** Weight on getting rid of heavy tiles. */
    weight: number;
    /** Weight on keeping options open (matching many of your own tiles). */
    flexibility: number;
    /** Weight on leaving ends the opponents are known to be dead on. */
    blocking: number;
    /** Weight on leaving ends your partner can probably play. */
    partnerAid: number;
    /** Chance of simply picking at random, ignoring all of the above. */
    slop: number;
  }
> = {
  // Plays plausibly, reads nothing. Feels like a beginner, not like noise.
  easy: { weight: 1.0, flexibility: 0.2, blocking: 0, partnerAid: 0, slop: 0.35 },
  // Reads the table but not the knocks.
  medium: { weight: 1.0, flexibility: 0.8, blocking: 0.6, partnerAid: 0.5, slop: 0.08 },
  // Uses everything, including which numbers each opponent is dead on.
  hard: { weight: 0.9, flexibility: 1.2, blocking: 1.6, partnerAid: 1.1, slop: 0 },
};

/**
 * Does `seat` hold no tile showing `value`, as far as anyone can prove?
 *
 * A knock is proof: you cannot knock while holding a playable tile, so every
 * number that was open when you knocked is a number you do not have.
 */
function isDeadOn(view: BotView, seat: number, value: number): boolean {
  return view.knocks[seat]?.includes(value) ?? false;
}

/** How many tiles in `hand` could be played onto an end showing `value`. */
function matchCount(hand: Tile[], value: number, exclude: Tile): number {
  return hand.filter(
    (t) =>
      !(t.left === exclude.left && t.right === exclude.right) &&
      (t.left === value || t.right === value),
  ).length;
}

function scorePlay(view: BotView, option: PlayOption, profile: (typeof PROFILES)[BotDifficulty]): number {
  const oriented = orient(option.tile, option.end, view.ends);
  if (!oriented) return -Infinity;

  // The two pips that will be open after this play.
  const nextEnds: [number, number] =
    option.end === "left"
      ? [oriented.newEnd, view.ends.right ?? oriented.newEnd]
      : [view.ends.left ?? oriented.newEnd, oriented.newEnd];

  let score = 0;

  // 1. Shed weight. Points left in hand are points the other side scores, so
  //    heavy tiles are a liability that grows as the round goes on.
  score += pips(option.tile) * profile.weight;

  // 2. Doubles are the hardest tiles to place — only one number will ever take
  //    them. Getting stuck holding a double is how rounds are lost.
  if (isDouble(option.tile)) score += 4 * profile.weight;

  // 3. Stay flexible: prefer leaving ends that the bot's own remaining tiles
  //    can answer. A bot that plays itself into a knock loses on tempo alone.
  const flexibility =
    matchCount(view.hand, nextEnds[0], option.tile) +
    matchCount(view.hand, nextEnds[1], option.tile);
  score += flexibility * 2.5 * profile.flexibility;

  // 4. Block. Leaving both ends on numbers an opponent is known to be dead on
  //    forces a knock, which in team play hands the turn straight back to your
  //    partner. This is the single strongest move in the game and the old bot
  //    never made it.
  if (profile.blocking > 0) {
    for (let seat = 0; seat < view.seatCount; seat++) {
      if (seat === view.seat) continue;
      if (view.teams && teamForSeat(seat) === teamForSeat(view.seat)) continue;

      const deadOnBoth =
        isDeadOn(view, seat, nextEnds[0]) && isDeadOn(view, seat, nextEnds[1]);
      if (deadOnBoth) score += 14 * profile.blocking;
      else if (isDeadOn(view, seat, nextEnds[0]) || isDeadOn(view, seat, nextEnds[1])) {
        score += 5 * profile.blocking;
      }

      // Squeezing someone down to their last tiles is worth more than
      // squeezing someone with a full hand.
      if (deadOnBoth && view.handSizes[seat] <= 3) score += 8 * profile.blocking;
    }
  }

  // 5. Help your partner: don't leave ends they're known to be dead on, and
  //    do leave numbers that are still plentiful (so they likely hold one).
  if (profile.partnerAid > 0 && view.teams) {
    const partner = (view.seat + 2) % 4;
    for (const end of nextEnds) {
      if (isDeadOn(view, partner, end)) score -= 9 * profile.partnerAid;
      // Seven tiles show each value. The fewer seen, the more are still out
      // there, so the likelier the partner holds one.
      const unseen = 7 - (view.seenPipCount[end] ?? 0);
      score += unseen * 0.7 * profile.partnerAid;
    }
  }

  // 6. Endgame: with two tiles left, playing the one whose partner-pip you
  //    also hold sets up going out next turn.
  if (view.hand.length <= 3) {
    score += flexibility * 3;
  }

  return score;
}

/**
 * Choose a play. Returns null when the bot has nothing legal, which the engine
 * turns into a draw (2–3 players) or a knock (4 players).
 */
export function chooseDominoPlay(
  view: BotView,
  difficulty: BotDifficulty = "medium",
): PlayOption | null {
  const options = legalPlays(view.hand, view.ends);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];

  const profile = PROFILES[difficulty] ?? PROFILES.medium;

  if (profile.slop > 0 && Math.random() < profile.slop) {
    return options[Math.floor(Math.random() * options.length)];
  }

  let best = options[0];
  let bestScore = -Infinity;
  for (const option of options) {
    const score = scorePlay(view, option, profile);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  return best;
}

/**
 * How long a bot should "think" before playing.
 *
 * Instant bot moves make a table feel like a simulation rather than a game,
 * and — more practically — they make it impossible to follow what happened,
 * because three bots resolve their whole turn before the human's eye has
 * moved. The delay scales with how many options there were, so a bot with one
 * legal tile snaps it down and a bot with a real decision visibly pauses.
 * That small tell is most of what makes bots feel like people.
 */
export function botThinkMs(optionCount: number, difficulty: BotDifficulty): number {
  const base = difficulty === "hard" ? 900 : 700;
  const perOption = Math.min(optionCount, 6) * 110;
  return base + perOption + Math.random() * 400;
}
