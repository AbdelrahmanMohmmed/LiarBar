/**
 * Domino wire contract. See shared/README.md — this file is copied into
 * web/src/lib/generated/ by `npm run types:sync`.
 */

export interface Tile {
  left: number;
  right: number;
}

export interface PlacedTile extends Tile {
  /** Who played it — for the "who's been feeding the sixes" read. */
  playedBy: string;
  end: "left" | "right" | "spinner";
  /** Order within the round; drives the landing animation. */
  seq: number;
}

export interface BoardEnds {
  left: number | null;
  right: number | null;
}

export type DominoTeam = "A" | "B";
export type DominoMode = "individual" | "teams";
export type DominoPhase = "lobby" | "playing" | "round_recap" | "game_over";
export type RoundEndMethod = "domino" | "blocked" | "draw";

export interface DominoEvent {
  kind:
    | "play"
    | "knock"
    | "draw"
    | "round_start"
    | "round_end"
    | "timeout"
    | "match_end";
  seat: number;
  playerId: string;
  playerName: string;
  at: number;
  tile?: Tile;
  /** For a knock: the pips that were open — i.e. what this player lacks. */
  deadOn?: number[];
  method?: RoundEndMethod;
  points?: number;
}

export interface DominoSeatState {
  seat: number;
  playerId: string;
  name: string;
  team: DominoTeam;
  isBot: boolean;
  isConnected: boolean;
  flag?: string;
  handCount: number;
  /** Numbers this seat proved it doesn't hold, by knocking. Public. */
  knockedOn: number[];
  score: number;
  /** Present only during the round recap, when all hands are revealed. */
  hand?: Tile[];
  pips?: number;
}

export interface DominoRecap {
  method: RoundEndMethod;
  winnerSeat: number | null;
  winnerName: string | null;
  winnerTeam: DominoTeam | null;
  points: number;
  karak: boolean;
  pipsBySeat: number[];
  handsBySeat: Tile[][];
  nextRoundAt: number | null;
}

/**
 * One player as it appears in the shared room envelope.
 *
 * Mirrors `Player.toPublicData()` on the server. `icon` and `characterId` are
 * chosen in the lobby (a board token, a fighter) and are genuinely public —
 * every client renders them next to the name.
 */
export interface RoomPlayerLite {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  isConnected: boolean;
  flag?: string;
  /** Emoji token for board games (Rento, Snakes & Ladders). */
  icon?: string;
  /** Chosen fighter, for the Fighter game. */
  characterId?: string;
  avatarUrl?: string;
  cardCount: number;
  /** Always empty in public state; the owner's hand arrives on a private event. */
  hand: never[];
}

export interface DominoState {
  roomId: string;
  gameId: "domino";
  phase: DominoPhase;
  mode: DominoMode;
  targetScore: number;
  turnSeconds: number;
  karakBonus: boolean;
  tableTheme: string;
  tileTheme: string;

  players: RoomPlayerLite[];
  seats: DominoSeatState[];
  maxPlayers: number;

  board: PlacedTile[];
  ends: BoardEnds;
  boneyardCount: number;

  activeSeat: number | null;
  turnDeadline: number | null;
  roundNumber: number;
  /** How many of each pip value are face-up on the table. A public read-aid. */
  playedPipCount: number[];

  scores: { A: number; B: number };
  seatScores: number[];
  winnerTeam: DominoTeam | null;
  winnerId: string | null;

  recap: DominoRecap | null;
  events: DominoEvent[];
}

/**
 * The per-player slice, delivered on `domino_private` and never present in the
 * public broadcast.
 */
export interface DominoPrivate {
  hand: Tile[];
  mySeat: number | null;
  myPartnerSeat: number | null;
  /**
   * Legal plays, computed by the server.
   *
   * The client deliberately does not re-derive this. An earlier version had
   * its own copy of the matching rule and the two disagreed about flipped
   * tiles, so the UI offered plays the server then rejected.
   */
  playable: Array<{ tile: Tile; end: "left" | "right" }>;
}

export type DominoPlayerState = DominoState & DominoPrivate;

// ---------------------------------------------------------------------------
// Pure helpers both sides need
// ---------------------------------------------------------------------------

/** Tiles are unordered pairs: 3|5 and 5|3 are the same tile. */
export function sameTile(a: Tile, b: Tile): boolean {
  return (
    (a.left === b.left && a.right === b.right) ||
    (a.left === b.right && a.right === b.left)
  );
}

/** Stable key for a tile regardless of orientation. Safe as a React key. */
export function tileKey(t: Tile): string {
  const lo = Math.min(t.left, t.right);
  const hi = Math.max(t.left, t.right);
  return `${lo}-${hi}`;
}

export function pips(t: Tile): number {
  return t.left + t.right;
}

export function isDouble(t: Tile): boolean {
  return t.left === t.right;
}
