import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Bot, Trophy, Wifi, WifiOff, Crown, Grid3x3 } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { getGame, BRAND } from "@/lib/brand";
import { Seo } from "@/lib/seo";
import { Logo } from "@/components/brand/Logo";
import GamePicker from "@/components/party/GamePicker";
import { LangToggle } from "@/components/LangToggle";

/**
 * The hub a party sits in between games.
 *
 * This page exists so that "the game ended" is not the same event as "the
 * night ended". When a game finishes the group lands here — still together,
 * still on voice, still holding the same room code — looking at a scoreboard
 * and a grid of what to play next. The previous product dropped them onto a
 * game-over screen whose only real exit was leaving the room.
 *
 * Route: /r/:roomId. The short /j/:roomId invite link resolves here after the
 * joiner has entered a name.
 */
export default function PartyHub() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const {
    partyState,
    myPlayerId,
    myRoomId,
    isConnected,
    reconnectRoom,
    partyPickGame,
    startGame,
    addBot,
    removeBot,
    addToast,
  } = useGame();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  // Landing here directly (refresh, or opening the link on a second device
  // where the id is already stored) has to re-attach to the room rather than
  // showing an empty page.
  useEffect(() => {
    if (!roomId) return;
    if (partyState?.roomId === roomId) return;
    if (!myPlayerId) {
      navigate(`/j/${roomId}`, { replace: true });
      return;
    }
    void reconnectRoom(roomId, myPlayerId).catch(() => {
      navigate(`/j/${roomId}`, { replace: true });
    });
  }, [roomId, partyState?.roomId, myPlayerId, reconnectRoom, navigate]);

  // When the host starts a game, everyone follows automatically. Without this
  // the host would have to tell five people "go to the game" out loud, which
  // is precisely the kind of coordination the product is supposed to remove.
  useEffect(() => {
    if (!partyState || partyState.phase !== "playing" || !partyState.activeGameId) return;
    const route = gameRoute(partyState.activeGameId, partyState.roomId);
    if (route) navigate(route);
  }, [partyState?.phase, partyState?.activeGameId, partyState?.roomId, navigate]);

  const me = partyState?.players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const activeMeta = partyState?.activeGameId ? getGame(partyState.activeGameId) : undefined;

  const leaderboard = useMemo(
    () => (partyState?.leaderboard ?? []).filter((e) => e.played > 0),
    [partyState?.leaderboard],
  );

  if (!partyState) {
    return (
      <div className="page grid place-items-center">
        <div className="w-full max-w-sm space-y-3">
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
      </div>
    );
  }

  const humans = partyState.players.filter((p) => !p.isBot);
  const canStart = Boolean(partyState.activeGameId) && partyState.players.length >= 2;

  const handleStart = async () => {
    setStarting(true);
    try {
      if (partyState.activeGameId) {
        // A game is already staged (room was created with one chosen) — deal it.
        await startGame();
      } else {
        setPickerOpen(true);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("party.start_failed"), "error");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="page pb-32 max-w-2xl mx-auto">
      <Seo
        title={`${t("party.title")} ${partyState.roomId}`}
        description={BRAND.description[lang]}
        path={`/r/${partyState.roomId}`}
        noindex
        lang={lang}
      />

      <header className="flex items-center justify-between gap-3 mb-6">
        <button onClick={() => navigate("/")} aria-label={BRAND.name}>
          <Logo size={28} />
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`chip ${isConnected ? "chip-live" : ""}`}
            title={isConnected ? t("party.connected") : t("party.reconnecting")}
          >
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span className="font-numeric">{partyState.roomId}</span>
          </span>
          <LangToggle />
        </div>
      </header>

      {/* ---- What's next ---- */}
      <section className="surface-lit rounded-xl p-5 mb-4">
        <h1 className="font-display text-2xl text-cream mb-1">
          {t("party.whats_next")}
        </h1>
        <p className="text-sm text-sand mb-4">{t("party.whats_next_sub")}</p>

        {activeMeta ? (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-surface-sunken">
            <span className="text-3xl" aria-hidden>
              {activeMeta.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-cream">{activeMeta.name[lang]}</div>
              <div className="text-xs text-sand truncate">{activeMeta.blurb[lang]}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-sand mb-4">{t("party.no_game_chosen")}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleStart}
            disabled={!isHost || starting || (!canStart && Boolean(partyState.activeGameId))}
            className="btn btn-primary btn-lg"
          >
            <Play size={18} />
            {activeMeta ? t("party.start") : t("party.pick_game")}
          </button>
          <button onClick={() => setPickerOpen(true)} className="btn btn-ghost btn-lg">
            <Grid3x3 size={18} />
            {t("party.browse_games")}
          </button>
        </div>

        {!isHost && (
          <p className="text-center text-xs text-sand mt-3">{t("party.waiting_host")}</p>
        )}
      </section>

      {/* ---- Who's here ---- */}
      <section className="surface rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base text-cream">
            {t("party.whos_here")}{" "}
            <span className="font-numeric text-sand">
              {partyState.players.length}/{partyState.maxPlayers}
            </span>
          </h2>
          {isHost && partyState.players.length < partyState.maxPlayers && (
            <button
              onClick={() => addBot().catch(() => addToast(t("party.bot_failed"), "error"))}
              className="btn btn-quiet btn-sm"
            >
              <Bot size={15} />
              {t("party.add_bot")}
            </button>
          )}
        </div>

        <ul className="space-y-1.5">
          {partyState.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface-sunken"
            >
              <span
                className={`w-2 h-2 rounded-pill shrink-0 ${
                  p.isConnected ? "bg-mint" : "bg-sand/40"
                }`}
                aria-label={p.isConnected ? t("party.connected") : t("party.offline")}
              />
              <span className="truncate text-sm text-cream flex-1">
                {p.flag ? `${p.flag} ` : ""}
                {p.name}
                {p.id === myPlayerId && (
                  <span className="text-sand text-xs"> ({t("party.you")})</span>
                )}
              </span>
              {p.isHost && <Crown size={14} className="text-gold shrink-0" />}
              {p.isBot && (
                <>
                  <Bot size={14} className="text-sand shrink-0" />
                  {isHost && (
                    <button
                      onClick={() => removeBot(p.id).catch(() => {})}
                      className="text-xs text-ruby px-1"
                      aria-label={t("party.remove_bot")}
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>

        {humans.length === 1 && (
          <p className="text-xs text-sand mt-3 text-center">{t("party.alone_hint")}</p>
        )}
      </section>

      {/* ---- Tonight's scoreboard ---- */}
      {leaderboard.length > 0 && (
        <section className="surface rounded-xl p-4">
          <h2 className="font-display text-base text-cream mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-gold" />
            {t("party.tonight")}
          </h2>
          <ul className="space-y-1">
            {leaderboard.map((e, i) => (
              <li key={e.playerId} className="flex items-center gap-3 px-2 py-1.5">
                <span className="font-numeric text-sm text-sand w-5">{i + 1}</span>
                <span className="flex-1 truncate text-sm text-cream">{e.name}</span>
                <span className="font-numeric text-sm text-gold">
                  {e.wins}
                  <span className="text-sand">/{e.played}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GamePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentGameId={partyState.activeGameId}
        canPick={isHost}
        onPick={(gameId) => partyPickGame(gameId)}
      />
    </div>
  );
}

/**
 * Where a given game renders. Kept here (rather than on each game's own page)
 * so that "which URL does this game live at" is answered in exactly one place;
 * games that render inside the generic lobby shell share one route.
 */
export function gameRoute(gameId: string, roomId: string): string | null {
  switch (gameId) {
    case "liars-bar":
      return `/game/${roomId}`;
    case "codenames":
      return `/codenames/game/${roomId}`;
    case "higher-lower":
      return `/higher-lower/game/${roomId}`;
    case "domino":
      return `/domino/game/${roomId}`;
    case "spyfall":
      return `/spyfall/game/${roomId}`;
    case "chameleon":
      return `/chameleon/game/${roomId}`;
    case "rento":
      return `/rento/game/${roomId}`;
    default:
      // Arcade-style games render inside the shared lobby shell.
      return `/lobby/${roomId}`;
  }
}
