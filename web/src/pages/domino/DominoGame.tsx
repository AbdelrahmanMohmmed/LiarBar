import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hand, Trophy, Bot, WifiOff, Crown, Users, Info } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import DominoTile from "@/components/domino/DominoTile";
import DominoBoard from "@/components/domino/DominoBoard";
import KnockMemory from "@/components/domino/KnockMemory";
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
  // Open by default. This panel is the whole reason the rewrite is more
  // interesting than the old game, and a collapsed panel is a panel nobody
  // discovers — it also fills the space between the table and the hand, which
  // is otherwise dead on a tall phone.
  const [showMemory, setShowMemory] = useState(true);
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
    <div className="page max-w-3xl mx-auto pb-40">
      <Seo
        title={t("domino.title")}
        description={BRAND.description[lang]}
        path={`/domino/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      {/* ---- Scoreboard ---- */}
      <ScoreHeader state={state} mySeat={mySeat} />

      {/* ---- Opponents ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {seats.map((seat) => (
          <SeatCard
            key={seat.seat}
            seat={seat}
            isMe={seat.seat === mySeat}
            isPartner={partner?.seat === seat.seat}
            isActive={state.activeSeat === seat.seat}
            teams={state.mode === "teams"}
            secondsLeft={state.activeSeat === seat.seat ? turnSecondsLeft : null}
          />
        ))}
      </div>

      {/* ---- Table ---- */}
      <section
        className="rounded-xl p-3 mb-3 border border-border/70"
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

      {/* ---- Reading aid ---- */}
      <div className="mb-3">
        <button
          onClick={() => setShowMemory((v) => !v)}
          className="btn btn-quiet btn-sm w-full justify-between"
          aria-expanded={showMemory}
        >
          <span className="inline-flex items-center gap-2">
            <Info size={15} />
            {t("domino.reading_the_table")}
          </span>
          <span className="text-sand">{showMemory ? "−" : "+"}</span>
        </button>
        {showMemory && (
          <div className="mt-2 animate-in">
            <KnockMemory
              seats={seats}
              mySeat={mySeat}
              playedPipCount={state.playedPipCount ?? [0, 0, 0, 0, 0, 0, 0]}
            />
          </div>
        )}
      </div>

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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-surface/95 backdrop-blur"
        style={{ paddingBottom: "calc(4.5rem + var(--safe-b))" }}
      >
        <div className="max-w-3xl mx-auto px-3 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-sand inline-flex items-center gap-1.5">
              <Hand size={13} />
              {t("domino.your_tiles")} ({hand.length})
              <span className="text-sand/60">·</span>
              {t("domino.pips")}: {hand.reduce((n, tile) => n + pips(tile), 0)}
            </span>

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
                .map((tile) => {
                  const ends = endsForTile.get(tileKey(tile)) ?? [];
                  return (
                    <DominoTile
                      key={tileKey(tile)}
                      left={tile.left}
                      right={tile.right}
                      orientation="vertical"
                      size={76}
                      dimmed={myTurn && ends.length === 0}
                      active={Boolean(selected && sameTile(selected, tile))}
                      onClick={() => onTileTap(tile)}
                      ariaLabel={`${tile.left} ${tile.right}${
                        ends.length === 0 && myTurn ? ` — ${t("domino.unplayable")}` : ""
                      }`}
                    />
                  );
                })
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

function ScoreHeader({
  state,
  mySeat,
}: {
  state: DominoStateV2;
  mySeat: number | null;
}) {
  const { t } = useLanguage();
  const teams = state.mode === "teams";

  if (teams) {
    const myTeam = mySeat !== null ? state.seats[mySeat]?.team : null;
    return (
      <header className="surface-lit rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between text-xs text-sand mb-2">
          <span>
            {t("domino.round")} {state.roundNumber}
          </span>
          <span>
            {t("domino.race_to")} {state.targetScore}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["A", "B"] as const).map((team) => (
            <div
              key={team}
              className={`rounded-lg p-2.5 ${
                myTeam === team ? "bg-mint/10 border border-mint/30" : "bg-surface-sunken"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-sand">
                  {team === "A" ? t("domino.team_a") : t("domino.team_b")}
                  {myTeam === team && ` (${t("domino.you")})`}
                </span>
                <span className="font-numeric text-2xl text-gold">
                  {state.scores[team]}
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-pill bg-black/30 overflow-hidden">
                <div
                  className="h-full bg-gold transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (state.scores[team] / state.targetScore) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </header>
    );
  }

  return (
    <header className="surface-lit rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between text-xs text-sand mb-2">
        <span>
          {t("domino.round")} {state.roundNumber}
        </span>
        <span>
          {t("domino.race_to")} {state.targetScore}
        </span>
      </div>
      <ul className="space-y-1">
        {state.seats.map((seat) => (
          <li key={seat.seat} className="flex items-center gap-2">
            <span className="text-xs text-cream flex-1 truncate">{seat.name}</span>
            <div className="w-24 h-1 rounded-pill bg-surface-sunken overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-500"
                style={{
                  width: `${Math.min(100, (seat.score / state.targetScore) * 100)}%`,
                }}
              />
            </div>
            <span className="font-numeric text-sm text-gold w-8 text-end">
              {seat.score}
            </span>
          </li>
        ))}
      </ul>
    </header>
  );
}

function SeatCard({
  seat,
  isMe,
  isPartner,
  isActive,
  teams,
  secondsLeft,
}: {
  seat: DominoSeatState;
  isMe: boolean;
  isPartner: boolean;
  isActive: boolean;
  teams: boolean;
  secondsLeft: number | null;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={[
        "rounded-lg p-2.5 border transition",
        isActive
          ? "border-coral bg-coral/10 pulse-glow"
          : "border-border bg-surface-sunken",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {!seat.isConnected && !seat.isBot && (
          <WifiOff size={12} className="text-ruby shrink-0" aria-label={t("domino.offline")} />
        )}
        {seat.isBot && <Bot size={12} className="text-sand shrink-0" />}
        <span className="text-xs text-cream truncate">
          {seat.flag ? `${seat.flag} ` : ""}
          {isMe ? t("domino.you") : seat.name.slice(0, SEAT_LABEL_MAX)}
        </span>
        {isPartner && (
          <span className="chip chip-live !px-1.5 !py-0 !text-[9px] shrink-0">
            {t("domino.partner")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-sand text-xs">
          <Users size={11} />
          <span className="font-numeric">{seat.handCount}</span>
        </span>
        {teams && (
          <span className="text-[10px] text-sand">
            {seat.team === "A" ? t("domino.team_a") : t("domino.team_b")}
          </span>
        )}
        {secondsLeft !== null && (
          <span
            className={`font-numeric text-xs ${
              secondsLeft <= 5 ? "text-ruby" : "text-sand"
            }`}
          >
            {secondsLeft}s
          </span>
        )}
      </div>

      {/* A bar rather than a number: at a glance you want "who's nearly out",
          not an exact count. */}
      <div className="mt-1.5 flex gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className={`flex-1 h-1 rounded-pill ${
              i < seat.handCount ? "bg-cream/70" : "bg-cream/10"
            }`}
          />
        ))}
      </div>
    </div>
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
                <span className="text-xs text-mint">{t("domino.went_out")}</span>
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
