import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trophy, Bot, WifiOff, Crown } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import DominoTile from "@/components/domino/DominoTile";
import DominoBoard from "@/components/domino/DominoBoard";
import {
  type DominoStateV2,
  type Tile,
  type DominoSeatState,
  sameTile,
  tileKey,
  pips,
} from "@/lib/dominoTypes";

/**
 * The domino table.
 *
 * A rewrite against the new engine state (seats, knock memory, server-computed
 * legal plays, a typed event log). The previous page was 1,849 lines that
 * re-derived the rules client-side, disagreed with the server about flipped
 * tiles, and had no way to show a player *why* a tile was unplayable.
 *
 * Three principles, all downstream of "this is played on a phone while
 * talking":
 *
 * 1. **The board answers one question: what are the open ends.** Everything
 *    else is secondary and can be scrolled to.
 * 2. **Unplayable tiles are dimmed, never hidden.** Hiding them would be
 *    cleaner and would also destroy the game: knowing you're holding three
 *    dead tiles is the information you're supposed to be sweating over.
 * 3. **One tap when there's one choice, two when there are two.** Tapping a
 *    tile that fits only one end plays it immediately. A tile that fits both
 *    ends arms the end markers and waits — because guessing wrong there costs
 *    a turn, and the whole round.
 */

const SEAT_LABEL_MAX = 10;

export default function DominoGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const {
    dominoState,
    myPlayerId,
    partyState,
    reconnectRoom,
    addToast,
    dominoPlayTile,
    dominoDrawTile,
    dominoKnock,
  } = useGame();

  const state = dominoState as unknown as DominoStateV2 | null;

  const [selected, setSelected] = useState<Tile | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastEventRef = useRef<number>(0);

  // Re-attach on a refresh rather than rendering an empty table.
  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  // One shared clock for the turn timer and the recap countdown, rather than
  // a timer per component. At 4 players that's the difference between one
  // interval and nine.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const mySeat = state?.mySeat ?? null;
  const myTurn =
    state?.phase === "playing" && mySeat !== null && state.activeSeat === mySeat;
  const hand = useMemo(() => state?.hand ?? [], [state?.hand]);
  const playable = useMemo(() => state?.playable ?? [], [state?.playable]);

  /** Which ends each held tile can legally go on, from the server's answer. */
  const endsForTile = useMemo(() => {
    const map = new Map<string, Array<"left" | "right">>();
    for (const option of playable) {
      const key = tileKey(option.tile);
      const list = map.get(key) ?? [];
      if (!list.includes(option.end)) list.push(option.end);
      map.set(key, list);
    }
    return map;
  }, [playable]);

  const canPlayAnything = playable.length > 0;

  // Announce what just happened. The engine types its events precisely so the
  // client doesn't have to diff state and guess — a knock and a timeout look
  // identical in a state diff but mean completely different things.
  useEffect(() => {
    const events = state?.events ?? [];
    const latest = events[events.length - 1];
    if (!latest || latest.at <= lastEventRef.current) return;
    lastEventRef.current = latest.at;

    const isMe = latest.seat === mySeat;
    switch (latest.kind) {
      case "knock":
        addToast(
          isMe
            ? t("domino.you_knocked")
            : t("domino.someone_knocked").replace("{name}", latest.playerName),
          "info",
        );
        break;
      case "timeout":
        addToast(
          t("domino.auto_played").replace("{name}", latest.playerName),
          "info",
        );
        break;
      case "round_end":
        if (latest.method === "blocked") addToast(t("domino.blocked"), "challenge");
        else if (latest.method === "draw") addToast(t("domino.drawn_round"), "info");
        break;
    }
  }, [state?.events, mySeat, addToast, t]);

  const play = useCallback(
    async (tile: Tile, end: "left" | "right") => {
      setSelected(null);
      try {
        await dominoPlayTile(tile, end);
      } catch (err) {
        addToast(err instanceof Error ? err.message : t("domino.bad_move"), "error");
      }
    },
    [dominoPlayTile, addToast, t],
  );

  const onTileTap = useCallback(
    (tile: Tile) => {
      if (!myTurn) return;
      const ends = endsForTile.get(tileKey(tile)) ?? [];
      if (ends.length === 0) {
        addToast(t("domino.tile_doesnt_fit"), "info");
        return;
      }
      // One legal end: just play it. Making someone confirm a move with only
      // one possible outcome is pure friction.
      if (ends.length === 1) {
        void play(tile, ends[0]);
        return;
      }
      // Two legal ends: arm the markers and let them choose. Guessing here
      // costs a turn, and in a close round that's the round.
      setSelected((prev) => (prev && sameTile(prev, tile) ? null : tile));
    },
    [myTurn, endsForTile, play, addToast, t],
  );

  const selectedEnds = selected ? endsForTile.get(tileKey(selected)) ?? [] : [];

  if (!state) {
    return (
      <div className="page max-w-3xl mx-auto space-y-3">
        <div className="skeleton h-16 rounded-lg" />
        <div className="skeleton h-40 rounded-lg" />
        <div className="skeleton h-24 rounded-lg" />
      </div>
    );
  }

  const seats = state.seats ?? [];
  const partner =
    state.myPartnerSeat !== null && state.myPartnerSeat !== undefined
      ? seats[state.myPartnerSeat]
      : undefined;

  const turnSecondsLeft =
    state.turnDeadline !== null
      ? Math.max(0, Math.ceil((state.turnDeadline - now) / 1000))
      : null;

  const recapSecondsLeft =
    state.recap?.nextRoundAt != null
      ? Math.max(0, Math.ceil((state.recap.nextRoundAt - now) / 1000))
      : null;

  // Which end moved last, so the board scroller looks in the right direction.
  // Read off the board rather than the event log: the log records the tile but
  // not which side of the snake it landed on.
  const lastPlaced = state.board.length > 0 ? state.board[state.board.length - 1] : null;
  const lastEnd =
    state.board.length === 0
      ? null
      : state.board[0].end === "left" && state.board[0].seq > (lastPlaced?.seq ?? 0)
        ? "left"
        : (state.board[state.board.length - 1].end === "right" ? "right" : "left");
  const lastSeq = Math.max(
    ...state.board.map((tile) => tile.seq),
    -1,
  );

  return (
    /*
       A column that fills the screen, with the table taking whatever is left
       between the seat line and the hand. Stripping the two panels out from
       between them left a large dead gap on a tall phone; now the board grows
       into it and sits in the middle of the screen, which is where the thing
       you are supposed to be looking at belongs.
    */
    <div
      className="page max-w-3xl mx-auto flex flex-col"
      style={{ minHeight: "calc(100dvh - var(--party-dock-h))", paddingBottom: "9rem" }}
    >
      <Seo
        title={t("domino.title")}
        description={BRAND.description[lang]}
        path={`/domino/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      {/* ---- Who holds what ----
          One line. Across a real table this is all you can see of anyone
          else's hand — how many tiles are left in it — and everything the
          screen used to add on top of that (score bars, progress bars,
          partner badges, a per-seat timer) was competing with the board for
          attention in a game whose whole content is the board. */}
      <SeatStrip
        seats={seats}
        mySeat={mySeat}
        activeSeat={state.activeSeat}
        partnerSeat={partner?.seat ?? null}
        secondsLeft={turnSecondsLeft}
      />

      {/* ---- Table ---- */}
      <section
        className="rounded-xl p-3 mb-3 border-2 border-border flex-1 flex flex-col justify-center"
        style={{
          // A felt surface rather than a flat panel: this is the one place in
          // the app that should read as a physical table.
          background:
            "radial-gradient(120% 140% at 50% 0%, #17301f 0%, #0E1C14 70%)",
          boxShadow: "inset 0 2px 20px rgba(0,0,0,0.6)",
        }}
      >
        <DominoBoard
          board={state.board}
          ends={state.ends}
          highlightEnds={selectedEnds}
          lastSeq={lastSeq >= 0 ? lastSeq : undefined}
          lastEnd={lastEnd}
          onEndClick={
            selected && selectedEnds.length > 1
              ? (end) => void play(selected, end)
              : undefined
          }
        />

        {selected && selectedEnds.length > 1 && (
          <p className="text-center text-xs text-coral mt-2 font-bold animate-in">
            {t("domino.choose_end")}
          </p>
        )}
      </section>

      {/* ---- Recap ---- */}
      {state.phase === "round_recap" && state.recap && (
        <RoundRecap
          recap={state.recap}
          seats={seats}
          mySeat={mySeat}
          secondsLeft={recapSecondsLeft}
          teams={state.mode === "teams"}
        />
      )}

      {/* ---- Your hand ---- */}
      <section
        className="fixed inset-x-0 z-30 border-t border-border/70 bg-surface/95 backdrop-blur"
        // Sits directly on top of the dock rather than guessing at its height,
        // which was a hardcoded 4.5rem and wrong whenever the dock expanded.
        style={{ bottom: "var(--party-dock-h)", paddingBottom: "0.5rem" }}
      >
        <div className="max-w-3xl mx-auto px-3 pt-2">
          <div className="flex items-center justify-end min-h-[28px] mb-1">
            {/* No tile count and no pip total. You are looking at the tiles;
                counting them is not work the screen needs to do for you, and
                the pip total in particular is a calculation the game expects
                you to be making in your head. */}

            {myTurn && !canPlayAnything && (
              <KnockButton
                boneyardCount={state.boneyardCount}
                onKnock={async () => {
                  try {
                    await dominoKnock();
                  } catch (err) {
                    addToast(
                      err instanceof Error ? err.message : t("domino.cant_knock"),
                      "error",
                    );
                  }
                }}
                onDraw={async () => {
                  try {
                    await dominoDrawTile();
                  } catch (err) {
                    addToast(
                      err instanceof Error ? err.message : t("domino.cant_draw"),
                      "error",
                    );
                  }
                }}
              />
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {hand.length === 0 ? (
              <span className="text-sm text-sand py-4">{t("domino.no_tiles")}</span>
            ) : (
              [...hand]
                // Heaviest first: the tiles you most want rid of are the ones
                // you should see first, and it keeps the order stable as tiles
                // leave (a hand that reshuffles itself is maddening).
                .sort((a, b) => pips(b) - pips(a))
                .map((tile) => (
                  /*
                   * Every tile looks the same, whether or not it fits.
                   *
                   * The server still says which plays are legal and still
                   * rejects the rest — but it no longer says so *before* you
                   * choose. Dimming the tiles that don't fit turns the game
                   * into picking the one option left, and the part of domino
                   * that is actually domino is looking at two open ends and
                   * working out what you can do about them.
                   */
                  <DominoTile
                    key={tileKey(tile)}
                    left={tile.left}
                    right={tile.right}
                    orientation="vertical"
                    size={76}
                    active={Boolean(selected && sameTile(selected, tile))}
                    onClick={() => onTileTap(tile)}
                    ariaLabel={`${tile.left} ${tile.right}`}
                  />
                ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KnockButton({
  boneyardCount,
  onKnock,
  onDraw,
}: {
  boneyardCount: number;
  onKnock: () => void;
  onDraw: () => void;
}) {
  const { t } = useLanguage();

  // With tiles left in the boneyard you must draw; only when it's empty may
  // you knock. Showing the wrong one and letting the server reject it is how
  // the old version taught people the rules — badly.
  if (boneyardCount > 0) {
    return (
      <button onClick={onDraw} className="btn btn-ghost btn-sm">
        {t("domino.draw")} ({boneyardCount})
      </button>
    );
  }

  return (
    <button onClick={onKnock} className="btn btn-primary btn-sm pulse-glow">
      {t("domino.knock")}
    </button>
  );
}

/**
 * Every seat on one line: a name and the number of tiles in that hand.
 *
 * This replaced a score header and four seat cards. Both were accurate and
 * both were wrong for the game — domino is played by looking at the table, and
 * a screen that puts a scoreboard, four progress bars, a partner badge and a
 * per-seat countdown above the board is asking the player to read instead of
 * to think. What you can actually see across a real table is how many tiles
 * are left in front of each person, so that is what this shows.
 *
 * The round score moved into the recap between rounds, which is the moment
 * anybody cares about it.
 */
function SeatStrip({
  seats,
  mySeat,
  activeSeat,
  partnerSeat,
  secondsLeft,
}: {
  seats: DominoSeatState[];
  mySeat: number | null;
  activeSeat: number | null;
  partnerSeat: number | null;
  secondsLeft: number | null;
}) {
  const { t } = useLanguage();

  return (
    <ul className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mb-2 text-sm">
      {seats.map((seat) => {
        const isMe = seat.seat === mySeat;
        const isActive = seat.seat === activeSeat;
        return (
          <li key={seat.seat} className="inline-flex items-center gap-1.5">
            {!seat.isConnected && !seat.isBot && (
              <WifiOff size={11} className="text-ruby shrink-0" aria-label={t("domino.offline")} />
            )}
            {seat.isBot && <Bot size={11} className="text-sand shrink-0" />}
            <span
              className={
                isActive ? "font-bold text-coral" : isMe ? "text-cream" : "text-sand"
              }
            >
              {isMe ? t("domino.you") : seat.name.slice(0, SEAT_LABEL_MAX)}
              {seat.seat === partnerSeat && " ·"}
            </span>
            <span className={`font-numeric ${isActive ? "text-coral" : "text-cream"}`}>
              {seat.handCount}
            </span>
            {/* The clock only exists for whoever it is running against. */}
            {isActive && secondsLeft !== null && (
              <span
                className={`font-numeric text-xs ${
                  secondsLeft <= 5 ? "text-ruby" : "text-sand"
                }`}
              >
                {secondsLeft}
                {t("common.seconds_short")}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RoundRecap({
  recap,
  seats,
  mySeat,
  secondsLeft,
  teams,
}: {
  recap: NonNullable<DominoStateV2["recap"]>;
  seats: DominoSeatState[];
  mySeat: number | null;
  secondsLeft: number | null;
  teams: boolean;
}) {
  const { t } = useLanguage();

  const headline =
    recap.method === "draw"
      ? t("domino.recap_draw")
      : recap.method === "blocked"
        ? t("domino.recap_blocked").replace("{name}", recap.winnerName ?? "")
        : t("domino.recap_domino").replace("{name}", recap.winnerName ?? "");

  return (
    <section className="surface-lit rounded-xl p-4 mb-3 animate-in">
      <div className="text-center mb-4">
        <p className="font-display text-xl text-cream">{headline}</p>
        {recap.points > 0 && (
          <p className="font-numeric text-3xl text-gold mt-1">+{recap.points}</p>
        )}
        {recap.karak && (
          <p className="chip chip-gold mt-2 inline-flex">
            <Trophy size={12} />
            {t("domino.karak")}
          </p>
        )}
        {secondsLeft !== null && (
          <p className="text-xs text-sand mt-2">
            {t("domino.next_round_in").replace("{n}", String(secondsLeft))}
          </p>
        )}
      </div>

      {/* Everyone's hand, face up. This is the moment the round pays off —
          you find out whether the person who kept knocking was genuinely
          stuck or just sitting on the six-six. */}
      <div className="space-y-2">
        {seats.map((seat) => (
          <div key={seat.seat} className="flex items-center gap-2">
            <span
              className={`text-xs w-16 shrink-0 truncate ${
                seat.seat === recap.winnerSeat ? "text-gold font-bold" : "text-sand"
              }`}
            >
              {seat.seat === recap.winnerSeat && <Crown size={11} className="inline me-1" />}
              {seat.seat === mySeat ? t("domino.you") : seat.name}
            </span>
            <div className="flex gap-0.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {(recap.handsBySeat[seat.seat] ?? []).map((tile, i) => (
                <DominoTile
                  key={`${tileKey(tile)}-${i}`}
                  left={tile.left}
                  right={tile.right}
                  size={34}
                  orientation="vertical"
                />
              ))}
              {(recap.handsBySeat[seat.seat] ?? []).length === 0 && (
                <span className="text-xs text-live">{t("domino.went_out")}</span>
              )}
            </div>
            <span className="font-numeric text-sm text-sand w-7 text-end shrink-0">
              {recap.pipsBySeat[seat.seat] ?? 0}
            </span>
          </div>
        ))}
      </div>

      {teams && recap.winnerTeam && (
        <p className="text-center text-xs text-sand mt-3">
          {t("domino.team_scored")
            .replace("{team}", recap.winnerTeam === "A" ? t("domino.team_a") : t("domino.team_b"))
            .replace("{n}", String(recap.points))}
        </p>
      )}
    </section>
  );
}
