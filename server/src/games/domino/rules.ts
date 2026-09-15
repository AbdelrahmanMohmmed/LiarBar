/**
 * Egyptian / Levantine street domino — the rules, with no engine around them.
 *
 * Split out from the engine so the parts that are *decisions about the game*
 * can be read, argued with and tested without a socket, a timer or a room.
 * Everything here is pure.
 *
 * ## Why these rules and not "standard" domino
 *
 * The previous implementation was a generic Western block/draw game: deal
 * seven, match ends, draw from a boneyard when stuck, first to an arbitrary
 * 100 points wins. It was mechanically playable and completely flavourless,
 * and it wasn't the game anyone in this product's audience actually plays.
 *
 * The game played on a pavement in Cairo or Beirut differs in ways that turn
 * out to be exactly the ways that make it fun:
 *
 * - **Four players, partners across the table.** Domino is a *partnership*
 *   game. Playing it as a free-for-all removes the entire social layer: you
 *   stop having someone to protect, someone to set up, and someone to blame.
 * - **All 28 tiles are dealt. There is no boneyard.** This is the big one.
 *   With a boneyard, "I can't play" is a private inconvenience you fix by
 *   drawing. With no boneyard, "I can't play" is a public event — you knock,
 *   everyone hears it, and everyone now knows something about your hand.
 *   The knock is the information channel the whole game is built on.
 * - **The double-six opens.** A fixed opening removes the first-move
 *   guesswork and means every round starts from a known position, so reading
 *   the table is possible from tile one.
 * - **Race to 101.** Long enough that one bad round isn't fatal, short enough
 *   that a match fits in a sitting.
 *
 * Two- and three-player variants keep a boneyard, because without one the
 * hands are too big and the game degenerates.
 */

export interface Tile {
  left: number;
  right: number;
}

export interface PlacedTile extends Tile {
  /** Who played it, for the "who's been feeding the sixes" read. */
  playedBy: string;
  /** Which end it went on. The client lays the snake out from this. */
  end: "left" | "right" | "spinner";
  /** Order of play within the round, for staggered reveal animations. */
  seq: number;
}

export type Team = "A" | "B";

/** How a round ended. Drives which animation and which line of chatter fires. */
export type RoundEndMethod =
  /** Someone played their last tile. */
  | "domino"
  /** Nobody can play; the table is locked. Egyptian: مسكّرة / حجر. */
  | "blocked"
  /** Blocked and both sides hold identical pips. Nobody scores. */
  | "draw";

export const TARGET_SCORE_DEFAULT = 101;

// ---------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------

/** All 28 tiles of a double-six set, in canonical order. */
export function fullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) tiles.push({ left: a, right: b });
  }
  return tiles;
}

/**
 * Fisher-Yates, with an injectable RNG.
 *
 * The RNG is a parameter purely so tests can make a deal deterministic. The
 * engine always passes Math.random; there is no "seeded game" feature and this
 * is not a substitute for a CSPRNG, which this game does not need — the deal
 * is hidden from players by the server, not by being unguessable.
 */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function isDouble(t: Tile): boolean {
  return t.left === t.right;
}

export function pips(t: Tile): number {
  return t.left + t.right;
}

export function handPips(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + pips(t), 0);
}

export function sameTile(a: Tile, b: Tile): boolean {
  return (
    (a.left === b.left && a.right === b.right) ||
    (a.left === b.right && a.right === b.left)
  );
}

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

export interface Deal {
  hands: Tile[][];
  boneyard: Tile[];
}

/**
 * Deal for `playerCount` players.
 *
 * Four players get all 28 tiles and no boneyard — that is the whole point of
 * the four-handed game (see the header). Two and three players keep a
 * boneyard, or the hands become unplayably large.
 */
export function deal(playerCount: number, rng: () => number = Math.random): Deal {
  const tiles = shuffle(fullSet(), rng);
  const perHand = playerCount === 4 ? 7 : playerCount === 3 ? 7 : 7;
  const hands: Tile[][] = Array.from({ length: playerCount }, () => []);

  for (let round = 0; round < perHand; round++) {
    for (let seat = 0; seat < playerCount; seat++) {
      const tile = tiles.pop();
      if (tile) hands[seat].push(tile);
    }
  }

  return { hands, boneyard: tiles };
}

/**
 * Who opens, and with what.
 *
 * Round 1 opens with the double-six, held by whoever was dealt it. If the six
 * is somehow absent (only possible in a 2- or 3-player deal where it sits in
 * the boneyard) the highest double in anyone's hand opens instead, and failing
 * that the heaviest tile.
 *
 * Later rounds are opened by the previous round's winner, who may open with
 * anything. That is the reward for winning: you get to set the shape of the
 * next round.
 */
export function findOpening(
  hands: Tile[][],
): { seat: number; tile: Tile } | null {
  for (let seat = 0; seat < hands.length; seat++) {
    const six = hands[seat].find((t) => t.left === 6 && t.right === 6);
    if (six) return { seat, tile: six };
  }

  let best: { seat: number; tile: Tile; rank: number } | null = null;
  for (let seat = 0; seat < hands.length; seat++) {
    for (const tile of hands[seat]) {
      // Doubles outrank everything; among equals, heavier wins.
      const rank = (isDouble(tile) ? 100 : 0) + pips(tile);
      if (!best || rank > best.rank) best = { seat, tile, rank };
    }
  }
  return best ? { seat: best.seat, tile: best.tile } : null;
}

// ---------------------------------------------------------------------------
// Legality
// ---------------------------------------------------------------------------

export interface BoardEnds {
  left: number | null;
  right: number | null;
}

export interface PlayOption {
  tile: Tile;
  end: "left" | "right";
}

/** Every legal placement of `hand` against the current ends. */
export function legalPlays(hand: Tile[], ends: BoardEnds): PlayOption[] {
  if (ends.left === null || ends.right === null) {
    // Empty board: anything opens, and which "end" is meaningless.
    return hand.map((tile) => ({ tile, end: "left" as const }));
  }

  const options: PlayOption[] = [];
  for (const tile of hand) {
    if (tile.left === ends.left || tile.right === ends.left) {
      options.push({ tile, end: "left" });
    }
    if (tile.left === ends.right || tile.right === ends.right) {
      options.push({ tile, end: "right" });
    }
  }
  return options;
}

export function canPlay(hand: Tile[], ends: BoardEnds): boolean {
  return legalPlays(hand, ends).length > 0;
}

/**
 * Orient a tile so it fits the end it's being played on, and report the new
 * open pip.
 *
 * The board is stored left-to-right, so a tile going on the left is prepended
 * with its *outward* half facing left. Getting this wrong is the classic
 * domino rendering bug: the game stays legal but the snake displays with
 * mismatched numbers touching, which makes players think the server cheated.
 */
export function orient(
  tile: Tile,
  end: "left" | "right",
  ends: BoardEnds,
): { placed: Tile; newEnd: number } | null {
  if (ends.left === null || ends.right === null) {
    return { placed: tile, newEnd: tile.left };
  }

  if (end === "left") {
    const target = ends.left;
    // The half that touches the board must equal the open pip; the other
    // half becomes the new open pip.
    if (tile.right === target) return { placed: tile, newEnd: tile.left };
    if (tile.left === target) {
      return { placed: { left: tile.right, right: tile.left }, newEnd: tile.right };
    }
    return null;
  }

  const target = ends.right;
  if (tile.left === target) return { placed: tile, newEnd: tile.right };
  if (tile.right === target) {
    return { placed: { left: tile.right, right: tile.left }, newEnd: tile.left };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

/**
 * Partners sit across from each other: seats 0 and 2 are team A, seats 1 and 3
 * are team B. Turn order runs around the table, so play alternates between the
 * teams — which is what makes blocking an opponent meaningful rather than
 * arbitrary.
 *
 * Teams are derived from seat index, never from array position in a mutable
 * player list. The old implementation read `players[0]` and `players[2]` at
 * scoring time; a player leaving mid-match shifted the array and silently
 * swapped somebody's partner.
 */
export function teamForSeat(seat: number): Team {
  return seat % 2 === 0 ? "A" : "B";
}

export function partnerSeat(seat: number, seatCount: number): number | null {
  if (seatCount !== 4) return null;
  return (seat + 2) % 4;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface RoundOutcome {
  method: RoundEndMethod;
  /** The seat that played out, or the seat of the lighter hand when blocked. */
  winnerSeat: number | null;
  winnerTeam: Team | null;
  /** Points awarded to the winning side this round. */
  points: number;
  /** Pip totals per seat, revealed at the end of the round. */
  pipsBySeat: number[];
  /** Winner's last tile was a double — the "karak" bonus fired. */
  karak: boolean;
}

export interface ScoreOptions {
  /** Team play (4 players) scores per team; otherwise per seat. */
  teams: boolean;
  /**
   * House rule: finishing on a double doubles the round's score. Off by
   * default because it makes blow-out rounds swingier, but it's the single
   * most-requested piece of street flavour — going out on a double is a small
   * act of showmanship and players want it to be worth something.
   */
  karakBonus: boolean;
}

/**
 * Score a round that ended with someone playing out.
 *
 * The winning side takes the total pips still held by the LOSING side. In team
 * play that means the two opponents' hands; in singles it means everyone
 * else's. The winner's own partner's remaining tiles never count against them,
 * which is what makes "feed your partner" a real strategy rather than a
 * sentiment.
 */
export function scoreDomino(
  winnerSeat: number,
  hands: Tile[][],
  opts: ScoreOptions,
): RoundOutcome {
  const pipsBySeat = hands.map(handPips);
  const winnerTeam = opts.teams ? teamForSeat(winnerSeat) : null;

  let points = 0;
  for (let seat = 0; seat < hands.length; seat++) {
    if (opts.teams) {
      if (teamForSeat(seat) !== winnerTeam) points += pipsBySeat[seat];
    } else if (seat !== winnerSeat) {
      points += pipsBySeat[seat];
    }
  }

  return {
    method: "domino",
    winnerSeat,
    winnerTeam,
    points,
    pipsBySeat,
    karak: false,
  };
}

/**
 * Score a blocked round — nobody can play and the table is locked.
 *
 * The lighter side wins and takes the heavier side's pips. A genuine tie
 * scores nothing for anyone; inventing a winner there would make the fairest
 * possible outcome feel arbitrary.
 */
export function scoreBlocked(hands: Tile[][], opts: ScoreOptions): RoundOutcome {
  const pipsBySeat = hands.map(handPips);

  if (opts.teams) {
    const totalA = pipsBySeat.reduce(
      (sum, p, seat) => (teamForSeat(seat) === "A" ? sum + p : sum),
      0,
    );
    const totalB = pipsBySeat.reduce(
      (sum, p, seat) => (teamForSeat(seat) === "B" ? sum + p : sum),
      0,
    );

    if (totalA === totalB) {
      return {
        method: "draw",
        winnerSeat: null,
        winnerTeam: null,
        points: 0,
        pipsBySeat,
        karak: false,
      };
    }

    const winnerTeam: Team = totalA < totalB ? "A" : "B";
    // Attribute the win to the lighter hand on the winning team, so the recap
    // can name a person rather than only a letter.
    let winnerSeat = -1;
    let lightest = Infinity;
    for (let seat = 0; seat < pipsBySeat.length; seat++) {
      if (teamForSeat(seat) === winnerTeam && pipsBySeat[seat] < lightest) {
        lightest = pipsBySeat[seat];
        winnerSeat = seat;
      }
    }

    return {
      method: "blocked",
      winnerSeat,
      winnerTeam,
      points: winnerTeam === "A" ? totalB : totalA,
      pipsBySeat,
      karak: false,
    };
  }

  const lightest = Math.min(...pipsBySeat);
  const tied = pipsBySeat.filter((p) => p === lightest).length > 1;
  if (tied) {
    return {
      method: "draw",
      winnerSeat: null,
      winnerTeam: null,
      points: 0,
      pipsBySeat,
      karak: false,
    };
  }

  const winnerSeat = pipsBySeat.indexOf(lightest);
  const points = pipsBySeat.reduce(
    (sum, p, seat) => (seat === winnerSeat ? sum : sum + p),
    0,
  );

  return {
    method: "blocked",
    winnerSeat,
    winnerTeam: null,
    points,
    pipsBySeat,
    karak: false,
  };
}

/** Apply the karak (finished-on-a-double) bonus to an already-scored round. */
export function applyKarak(
  outcome: RoundOutcome,
  lastTile: Tile | null,
  opts: ScoreOptions,
): RoundOutcome {
  if (!opts.karakBonus || outcome.method !== "domino") return outcome;
  if (!lastTile || !isDouble(lastTile)) return outcome;
  return { ...outcome, points: outcome.points * 2, karak: true };
}
