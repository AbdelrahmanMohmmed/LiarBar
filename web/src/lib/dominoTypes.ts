/**
 * Client-side mirror of the domino server state.
 *
 * Kept in its own file rather than in `types.ts` because domino is the largest
 * single game surface and burying 8 interfaces in the shared type file makes
 * both harder to read. The server is authoritative: every shape here
 * corresponds 1:1 to something in `server/src/games/domino/`.
 */

export interface Tile {
  left: number;
  right: number;
}

export interface PlacedTile extends Tile {
  playedBy: string;
  end: "left" | "right" | "spinner";
  /** Order of play within the round; drives the landing animation. */
  seq: number;
}

export interface BoardEnds {
  left: number | null;
  right: number | null;
}

export type DominoTeam = "A" | "B";
export type DominoMode = "individual" | "teams";
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
  /** Only present during the round recap, when all hands are revealed. */
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

export interface DominoStateV2 {
  roomId: string;
  gameId: "domino";
  phase: "lobby" | "playing" | "round_recap" | "game_over";
  mode: DominoMode;
  targetScore: number;
  turnSeconds: number;
  karakBonus: boolean;
  tableTheme: string;
  tileTheme: string;

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

  // --- Private slice, present only in the per-player state ---
  hand?: Tile[];
  mySeat?: number | null;
  myPartnerSeat?: number | null;
  /**
   * Legal plays, computed by the server.
   *
   * The client deliberately does NOT re-derive this. The previous version had
   * its own copy of the matching rule and the two disagreed about flipped
   * tiles, so the UI would offer a play the server then rejected. One
   * implementation, on the authoritative side.
   */
  playable?: Array<{ tile: Tile; end: "left" | "right" }>;
}

export function sameTile(a: Tile, b: Tile): boolean {
  return (
    (a.left === b.left && a.right === b.right) ||
    (a.left === b.right && a.right === b.left)
  );
}

export function tileKey(t: Tile): string {
  const lo = Math.min(t.left, t.right);
  const hi = Math.max(t.left, t.right);
  return `${lo}-${hi}`;
}

export function pips(t: Tile): number {
  return t.left + t.right;
}
