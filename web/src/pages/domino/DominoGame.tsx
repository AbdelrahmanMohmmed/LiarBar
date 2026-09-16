import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Trophy,
  Bot,
  WifiOff,
  Crown,
  RotateCcw,
  Home,
  Clock,
  Sparkles,
  Layers,
  Check,
} from "lucide-react";
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
import { playTileSfx } from "@/utils/sfx";

/**
 * The domino table: responsive wide desktop casino table & mobile portrait table.
 *
 * All played tiles remain visible on mobile and desktop without scrolling.
 * Round recap and game over appear as an unmissable, prominent modal overlay
 * with a live next-round countdown bar so players never miss results.
 */

const SEAT_LABEL_MAX = 12;

/**
 * Responsive domino size for the player's hand dock.
 * Scales up substantially on PC / desktop so dominoes feel substantial, tactile,
 * and easy to read, while remaining comfortably sized on mobile phones.
 */
function useHandTileSize(): number {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return 58;
    const w = window.innerWidth;
    if (w >= 1440) return 116; // Widescreen PC (58px x 116px per tile)
    if (w >= 1024) return 106; // Desktop / laptop (53px x 106px per tile)
    if (w >= 768) return 88;   // Tablets (44px x 88px per tile)
    if (w >= 480) return 72;   // Phablets / horizontal phones (36px x 72px)
    return 58;                 // Mobile portrait (29px x 58px)
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1440) setSize(116);
      else if (w >= 1024) setSize(106);
      else if (w >= 768) setSize(88);
      else if (w >= 480) setSize(72);
      else setSize(58);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

export default function DominoGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const handTileSize = useHandTileSize();
  const {
    dominoState,
    myPlayerId,
    partyState,
    reconnectRoom,
    addToast,
    dominoPlayTile,
    dominoDrawTile,
    dominoKnock,
    dominoRematch,
    partyRematch,
    partyReturnHub,
  } = useGame();

  const state = dominoState as unknown as DominoStateV2 | null;

  const [selected, setSelected] = useState<Tile | null>(null);
  const [shakingTile, setShakingTile] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastEventRef = useRef<number>(0);
  const prevBoardLenRef = useRef<number>(0);

  // Re-attach on a refresh rather than rendering an empty table.
  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  // One shared clock for the turn timer and the recap countdown
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

  // Announce what just happened via audio and toasts
  useEffect(() => {
    const events = state?.events ?? [];
    const latest = events[events.length - 1];
    if (!latest || latest.at <= lastEventRef.current) return;
    lastEventRef.current = latest.at;

    const isMe = latest.seat === mySeat;

    switch (latest.kind) {
      case "play":
        if (!isMe) {
          playTileSfx();
        }
        break;
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
          "error",
        );
        break;
    }
  }, [state?.events, mySeat, addToast, t]);

  // Audio clack on opponent or bot tile placement
  useEffect(() => {
    const currentLen = state?.board.length ?? 0;
    if (prevBoardLenRef.current > 0 && currentLen > prevBoardLenRef.current) {
      playTileSfx();
    }
    prevBoardLenRef.current = currentLen;
  }, [state?.board.length]);

  const play = useCallback(
    async (tile: Tile, end: "left" | "right") => {
      setSelected(null);
      playTileSfx();
      try {
        await dominoPlayTile(tile, end);
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : t("domino.bad_move"),
          "error",
        );
      }
    },
    [dominoPlayTile, addToast, t],
  );

  const onTileTap = (tile: Tile) => {
    const validEnds = endsForTile.get(tileKey(tile)) ?? [];

    if (!myTurn || validEnds.length === 0) {
      const key = tileKey(tile);
      setShakingTile(key);
      window.setTimeout(() => setShakingTile(null), 450);
      if (myTurn) {
        addToast(t("domino.bad_move"), "info");
      }
      return;
    }

    if (validEnds.length === 1) {
      void play(tile, validEnds[0]);
      return;
    }

    if (selected && sameTile(selected, tile)) {
      setSelected(null);
    } else {
      setSelected(tile);
    }
  };

  const selectedEnds = useMemo(() => {
    if (!selected) return [];
    return endsForTile.get(tileKey(selected)) ?? [];
  }, [selected, endsForTile]);

  useEffect(() => {
    if (!myTurn) setSelected(null);
  }, [myTurn]);

  if (!state) {
    return (
      <div className="page grid place-items-center">
        <div className="skeleton w-64 h-32 rounded-xl" />
      </div>
    );
  }

  const seats = state.seats ?? [];
  const partner =
    state.myPartnerSeat !== null
      ? seats.find((s) => s.seat === state.myPartnerSeat)
      : null;

  const isHost = Boolean(
    partyState?.players.find((p) => p.id === myPlayerId)?.isHost ??
      state.players.find((p) => p.id === myPlayerId)?.isHost,
  );

  const turnSecondsLeft =
    state.turnDeadline !== null
      ? Math.max(0, Math.ceil((state.turnDeadline - now) / 1000))
      : null;

  const recapSecondsLeft =
    state.recap?.nextRoundAt != null
      ? Math.max(0, Math.ceil((state.recap.nextRoundAt - now) / 1000))
      : null;

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

  const isRecapOpen =
    (state.phase === "round_recap" || state.phase === "game_over") &&
    Boolean(state.recap);

  return (
    <div
      className="page w-full max-w-6xl xl:max-w-7xl mx-auto flex flex-col px-2 sm:px-4 md:px-6"
      style={{
        minHeight: "calc(100dvh - var(--party-dock-h))",
        paddingBottom: handTileSize >= 90 ? "12rem" : "9rem",
      }}
    >
      <Seo
        title={t("domino.title")}
        description={BRAND.description[lang]}
        path={`/domino/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      {/* ---- Who holds what (Responsive Table Header) ---- */}
      <SeatStrip
        seats={seats}
        mySeat={mySeat}
        activeSeat={state.activeSeat}
        partnerSeat={partner?.seat ?? null}
        secondsLeft={turnSecondsLeft}
        teams={state.mode === "teams"}
        scores={state.scores}
        targetScore={state.targetScore}
        roundNumber={state.roundNumber}
      />

      {/* ---- The Felt Table ---- */}
      <section
        className="rounded-2xl md:rounded-3xl p-2 sm:p-4 mb-3 border-4 md:border-8 border-[#2d1e14] flex-1 flex flex-col justify-center relative overflow-hidden min-h-[440px] md:min-h-[540px] lg:min-h-[620px] shadow-2xl"
        style={{
          background:
            "radial-gradient(120% 140% at 50% 30%, #184c2b 0%, #113820 50%, #081d11 90%)",
          boxShadow:
            "inset 0 0 60px rgba(0,0,0,0.85), 0 12px 36px rgba(0,0,0,0.6)",
          outline: "2px solid rgba(212, 175, 55, 0.4)",
          outlineOffset: "-4px",
        }}
      >
        <DominoBoard
          board={state.board}
          ends={state.ends}
          highlightEnds={selectedEnds}
          lastSeq={lastSeq >= 0 ? lastSeq : undefined}
          lastEnd={lastEnd}
          onEndClick={
            selected && selectedEnds.length > 0
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

      {/* ---- Unmissable Round Recap & Game Over Centered Modal Overlay ---- */}
      {isRecapOpen && state.recap && (
        <RoundRecapModal
          recap={state.recap}
          seats={seats}
          mySeat={mySeat}
          secondsLeft={recapSecondsLeft}
          teams={state.mode === "teams"}
          scores={state.scores}
          targetScore={state.targetScore}
          isGameOver={state.phase === "game_over"}
          isHost={isHost}
          onRematch={async () => {
            try {
              if (partyState?.roomId) {
                await partyRematch();
              } else {
                await dominoRematch();
              }
            } catch (err) {
              addToast(
                err instanceof Error ? err.message : "Failed to rematch",
                "error",
              );
            }
          }}
          onBackToHub={async () => {
            try {
              if (partyState?.roomId) {
                await partyReturnHub();
                navigate(`/r/${partyState.roomId}`);
              } else {
                navigate("/domino");
              }
            } catch {
              navigate("/");
            }
          }}
        />
      )}

      {/* ---- Your hand (Responsive Bottom Dock) ---- */}
      <section
        className="fixed inset-x-0 z-30 border-t border-border/70 bg-surface/95 backdrop-blur shadow-2xl"
        style={{ bottom: "var(--party-dock-h)", paddingBottom: "0.75rem" }}
      >
        <div className="w-full max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-6 pt-2">
          <div className="flex items-center justify-between min-h-[28px] mb-1.5">
            <span className="text-xs sm:text-sm text-sand font-semibold hidden sm:inline">
              {lang === "ar" ? "قطعك في اليد" : "Your hand"} ({hand.length})
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

          <div
            className="flex gap-2 sm:gap-3 md:gap-3.5 overflow-x-auto pb-2 justify-start sm:justify-center items-center py-1"
            style={{ scrollbarWidth: "none" }}
          >
            {hand.length === 0 ? (
              <span className="text-sm text-sand py-4">{t("domino.no_tiles")}</span>
            ) : (
              [...hand]
                .sort((a, b) => pips(b) - pips(a))
                .map((tile) => {
                  const key = tileKey(tile);
                  const isSelected = selected !== null && sameTile(tile, selected);
                  const isShaking = shakingTile === key;
                  return (
                    <button
                      key={key}
                      onClick={() => onTileTap(tile)}
                      className={`relative shrink-0 rounded transition-all duration-200 ${
                        isShaking ? "tile-shake" : ""
                      } ${
                        isSelected
                          ? "-translate-y-3 sm:-translate-y-4 shadow-xl shadow-gold/50 ring-2 sm:ring-4 ring-gold scale-105"
                          : "hover:-translate-y-2 hover:scale-105"
                      }`}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      title={`${tile.left}-${tile.right}`}
                    >
                      <DominoTile
                        left={tile.left}
                        right={tile.right}
                        size={handTileSize}
                        orientation="vertical"
                        active={isSelected}
                      />
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function KnockButton({
  boneyardCount,
  onKnock,
  onDraw,
}: {
  boneyardCount: number;
  onKnock: () => void;
  onDraw: () => void;
}) {
  const { lang, t } = useLanguage();
  return boneyardCount > 0 ? (
    <button
      onClick={onDraw}
      className="btn btn-primary btn-sm flex items-center gap-1.5 animate-in"
    >
      <Layers size={14} />
      <span>{lang === "ar" ? `اسحب من البحر (${boneyardCount})` : `Draw (${boneyardCount})`}</span>
    </button>
  ) : (
    <button
      onClick={onKnock}
      className="btn btn-primary btn-sm flex items-center gap-1.5 animate-in"
    >
      <span>👊</span>
      <span>{lang === "ar" ? "طَق (معنديش)" : "Knock (Pass)"}</span>
    </button>
  );
}

/**
 * Seat strip rendered responsively:
 * - Mobile: Clean compact line.
 * - Desktop: Grand casino table scoreboard with Team A / Team B pods or individual player pods.
 */
function SeatStrip({
  seats,
  mySeat,
  activeSeat,
  partnerSeat,
  secondsLeft,
  teams,
  scores,
  targetScore,
  roundNumber,
}: {
  seats: DominoSeatState[];
  mySeat: number | null;
  activeSeat: number | null;
  partnerSeat: number | null;
  secondsLeft: number | null;
  teams: boolean;
  scores: DominoStateV2["scores"];
  targetScore: number;
  roundNumber: number;
}) {
  const { lang, t } = useLanguage();

  return (
    <>
      {/* Mobile Compact Header (< md) */}
      <ul className="flex md:hidden items-center justify-center flex-wrap gap-x-3 gap-y-1 mb-2 text-sm">
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
              {isActive && secondsLeft !== null && (
                <span
                  className={`font-numeric text-xs ${
                    secondsLeft <= 5 ? "text-ruby font-bold animate-pulse" : "text-sand"
                  }`}
                >
                  {secondsLeft}s
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop Wide Casino Header (>= md) */}
      <div className="hidden md:flex items-center justify-between gap-4 mb-3 py-2 px-4 rounded-xl bg-surface-sunken/60 border border-border/50">
        {teams ? (
          <>
            {/* Team A Pod */}
            <div className="flex items-center gap-3 p-2 px-3 rounded-lg bg-teal/10 border border-teal/30">
              <div className="text-start">
                <span className="text-[11px] font-bold text-teal block uppercase tracking-wider">
                  {t("domino.team_a")} (1 & 3)
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  {[0, 2].map((idx) => {
                    const s = seats[idx];
                    if (!s) return null;
                    const isActive = s.seat === activeSeat;
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          isActive ? "bg-coral/25 text-cream font-bold" : "text-sand"
                        }`}
                      >
                        {s.seat === mySeat ? t("domino.you") : s.name}
                        <span className="font-numeric text-teal font-bold ml-1">({s.handCount})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="font-numeric text-2xl font-bold text-teal pl-2 border-l border-teal/20">
                {scores.A}
              </div>
            </div>

            {/* Center: Match Progress */}
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sand/15 text-sand font-medium">
                  {lang === "ar" ? `الجولة ${roundNumber}` : `Round ${roundNumber}`}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold">
                  {t("domino.race_to")} {targetScore}
                </span>
              </div>
              {secondsLeft !== null && (
                <span className="text-xs text-sand mt-1 font-numeric">
                  {lang === "ar" ? "الوقت المتبقي: " : "Turn time: "}
                  <strong className={secondsLeft <= 5 ? "text-ruby animate-pulse" : "text-gold"}>
                    {secondsLeft}s
                  </strong>
                </span>
              )}
            </div>

            {/* Team B Pod */}
            <div className="flex items-center gap-3 p-2 px-3 rounded-lg bg-coral/10 border border-coral/30">
              <div className="font-numeric text-2xl font-bold text-coral pr-2 border-r border-coral/20">
                {scores.B}
              </div>
              <div className="text-end">
                <span className="text-[11px] font-bold text-coral block uppercase tracking-wider">
                  {t("domino.team_b")} (2 & 4)
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-xs justify-end">
                  {[1, 3].map((idx) => {
                    const s = seats[idx];
                    if (!s) return null;
                    const isActive = s.seat === activeSeat;
                    return (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                          isActive ? "bg-coral/25 text-cream font-bold" : "text-sand"
                        }`}
                      >
                        {s.seat === mySeat ? t("domino.you") : s.name}
                        <span className="font-numeric text-coral font-bold ml-1">({s.handCount})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Solo Mode Desktop Header */
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold">
                {t("domino.race_to")} {targetScore}
              </span>
              <span className="text-xs text-sand">
                {lang === "ar" ? `الجولة ${roundNumber}` : `Round ${roundNumber}`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {seats.map((seat) => {
                const isMe = seat.seat === mySeat;
                const isActive = seat.seat === activeSeat;
                return (
                  <div
                    key={seat.seat}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                      isActive
                        ? "bg-coral/20 border-coral text-cream shadow-md shadow-coral/20"
                        : "bg-surface-sunken border-border/40 text-sand"
                    }`}
                  >
                    {seat.isBot && <Bot size={13} className="text-sand" />}
                    <span className="text-xs font-bold truncate max-w-[90px]">
                      {isMe ? t("domino.you") : seat.name}
                    </span>
                    <span className="text-xs px-1.5 py-0.2 rounded bg-surface font-numeric font-bold text-cream">
                      {seat.handCount}
                    </span>
                    <span className="text-xs font-numeric text-gold font-bold">
                      {seat.score} pts
                    </span>
                    {isActive && secondsLeft !== null && (
                      <span className="text-[11px] font-numeric text-ruby font-bold ml-1 animate-pulse">
                        {secondsLeft}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Unmissable Centered Modal Overlay for Round Recap and Game Over.
 * Appears on top of everything with a backdrop blur and countdown bar.
 */
function RoundRecapModal({
  recap,
  seats,
  mySeat,
  secondsLeft,
  teams,
  scores,
  targetScore,
  isGameOver = false,
  isHost = false,
  onRematch,
  onBackToHub,
}: {
  recap: NonNullable<DominoStateV2["recap"]>;
  seats: DominoSeatState[];
  mySeat: number | null;
  secondsLeft: number | null;
  teams: boolean;
  scores: DominoStateV2["scores"];
  targetScore: number;
  isGameOver?: boolean;
  isHost?: boolean;
  onRematch?: () => void;
  onBackToHub?: () => void;
}) {
  const { lang, t } = useLanguage();

  const headline = isGameOver
    ? t("domino.match_over")
    : recap.method === "draw"
      ? t("domino.recap_draw")
      : recap.method === "blocked"
        ? t("domino.recap_blocked").replace("{name}", recap.winnerName ?? "")
        : t("domino.recap_domino").replace("{name}", recap.winnerName ?? "");

  const progress =
    secondsLeft !== null ? Math.max(0, Math.min(100, (secondsLeft / 8) * 100)) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in"
      role="dialog"
      aria-modal="true"
      aria-label={headline}
    >
      <div
        className="surface-lit w-full max-w-md sm:max-w-lg rounded-2xl p-5 sm:p-6 border-2 border-[#D4AF37]/50 shadow-2xl animate-scale-in max-h-[92dvh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon & Title */}
        <div className="text-center mb-4">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-2.5 ${
              isGameOver
                ? "bg-gold/25 border-2 border-gold text-gold animate-bounce"
                : "bg-teal/20 border-2 border-teal text-teal"
            }`}
          >
            {isGameOver ? <Trophy size={30} /> : <Sparkles size={28} />}
          </div>

          <h2 className="font-display text-xl sm:text-2xl text-cream font-bold">
            {headline}
          </h2>

          {/* Points gained */}
          {!isGameOver && recap.points > 0 && (
            <p className="font-numeric text-3xl sm:text-4xl text-gold font-bold mt-1">
              +{recap.points}
            </p>
          )}

          {recap.karak && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-coral/20 border border-coral text-xs text-cream font-bold mt-2">
              <span>☕</span>
              <span>{t("domino.karak")}</span>
            </div>
          )}

          {/* Countdown bar to next round */}
          {!isGameOver && secondsLeft !== null && (
            <div className="w-full max-w-xs mx-auto mt-3">
              <div className="flex justify-between text-xs text-sand mb-1 font-medium">
                <span>{lang === "ar" ? "الجولة القادمة تبدأ خلال" : "Next round in"}</span>
                <span className="font-numeric text-gold font-bold">{secondsLeft}s</span>
              </div>
              <div className="h-2 w-full bg-surface-sunken rounded-full overflow-hidden border border-border/40">
                <div
                  className="h-full bg-gradient-to-r from-teal via-gold to-coral rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Face-up Reveal of all players' hands */}
        <div className="space-y-2 mb-4 p-3 rounded-xl bg-surface-sunken border border-border/50">
          <p className="text-[11px] font-bold text-sand uppercase tracking-wider mb-2">
            {lang === "ar" ? "كروت كل لاعب في اليد" : "Hand Reveal"}
          </p>
          {seats.map((seat) => (
            <div key={seat.seat} className="flex items-center gap-2 py-0.5">
              <span
                className={`text-xs w-20 shrink-0 truncate ${
                  seat.seat === recap.winnerSeat ? "text-gold font-bold" : "text-sand"
                }`}
              >
                {seat.seat === recap.winnerSeat && <Crown size={12} className="inline me-1 text-gold" />}
                {seat.seat === mySeat ? t("domino.you") : seat.name}
              </span>
              <div className="flex gap-1 flex-1 overflow-x-auto py-1" style={{ scrollbarWidth: "none" }}>
                {(recap.handsBySeat[seat.seat] ?? []).map((tile, i) => (
                  <DominoTile
                    key={`${tileKey(tile)}-${i}`}
                    left={tile.left}
                    right={tile.right}
                    size={32}
                    orientation="vertical"
                  />
                ))}
                {(recap.handsBySeat[seat.seat] ?? []).length === 0 && (
                  <span className="text-xs text-teal font-bold py-1">
                    {t("domino.went_out")} 🎯
                  </span>
                )}
              </div>
              <span className="font-numeric text-xs text-sand font-bold w-8 text-end shrink-0">
                {recap.pipsBySeat[seat.seat] ?? 0}
              </span>
            </div>
          ))}
        </div>

        {/* Match Scores & Target Progress */}
        <div className="p-3 rounded-xl bg-surface-sunken/60 border border-border/40 mb-4">
          <div className="flex justify-between items-center text-xs text-sand font-bold uppercase tracking-wider mb-2">
            <span>{t("domino.race_to")} {targetScore}</span>
            {teams && recap.winnerTeam && (
              <span className="text-gold font-bold">
                {t("domino.team_scored")
                  .replace("{team}", recap.winnerTeam === "A" ? t("domino.team_a") : t("domino.team_b"))
                  .replace("{n}", String(recap.points))}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {teams
              ? (["A", "B"] as const).map((team) => {
                  const score = scores[team];
                  const pct = Math.min(100, Math.round((score / targetScore) * 100));
                  const isA = team === "A";
                  return (
                    <div key={team}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isA ? "text-teal font-bold" : "text-coral font-bold"}>
                          {isA ? t("domino.team_a") : t("domino.team_b")}
                        </span>
                        <span className="font-numeric font-bold text-cream">
                          {score} / {targetScore}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isA ? "bg-teal" : "bg-coral"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              : seats.map((seat) => {
                  const score = seat.score;
                  const pct = Math.min(100, Math.round((score / targetScore) * 100));
                  const isMe = seat.seat === mySeat;
                  return (
                    <div key={seat.seat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isMe ? "text-cream font-bold" : "text-sand"}>
                          {isMe ? t("domino.you") : seat.name}
                        </span>
                        <span className="font-numeric font-bold text-cream">
                          {score} / {targetScore}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Game Over Actions (Rematch / Return to Hub) */}
        {isGameOver && (
          <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/50">
            {isHost && onRematch && (
              <button
                onClick={onRematch}
                className="btn btn-primary btn-lg flex-1 font-bold shadow-lg shadow-coral/25"
              >
                <RotateCcw size={18} />
                {lang === "ar" ? "لفة تانية (إعادة)" : "Rematch"}
              </button>
            )}
            {onBackToHub && (
              <button
                onClick={onBackToHub}
                className="btn btn-ghost btn-lg flex-1"
              >
                <Home size={18} />
                {lang === "ar" ? "الرجوع للّمة" : "Back to Hub"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
