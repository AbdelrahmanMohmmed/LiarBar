import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, Bot, Trophy, Wifi, WifiOff, Crown, Grid3x3, SlidersHorizontal } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { getGame, BRAND } from "@/lib/brand";
import { pickBotName } from "@/lib/botNames";
import { Seo } from "@/lib/seo";
import { Logo } from "@/components/brand/Logo";
import GamePicker from "@/components/party/GamePicker";
import GameSettingsDrawer from "@/components/party/GameSettingsDrawer";
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
    partyUpdateOptions,
    startGame,
    addBot,
    removeBot,
    addToast,
  } = useGame();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const me = partyState?.players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const activeMeta = partyState?.activeGameId ? getGame(partyState.activeGameId) : undefined;

  const optionsSummary = useMemo(() => {
    const gameId = partyState?.activeGameId;
    if (!gameId) return [];
    const opt = (partyState.activeOptions as Record<string, unknown> | null | undefined) ?? {};

    const tags: string[] = [];
    if (gameId === "domino") {
      tags.push(
        opt.gameMode === "teams"
          ? (lang === "ar" ? "زوجي (2 ضد 2)" : "2v2 Teams")
          : (lang === "ar" ? "فردي" : "Solo"),
      );
      tags.push(`${lang === "ar" ? "الفورة من" : "To"} ${opt.targetScore ?? 101}`);
      const turn = opt.turnTimeLimit !== undefined ? Number(opt.turnTimeLimit) : 30;
      tags.push(
        turn === 0
          ? (lang === "ar" ? "مفتوح" : "No limit")
          : `${turn}${lang === "ar" ? " ثانية" : "s"}`,
      );
      if (opt.karakBonus) {
        tags.push(lang === "ar" ? "كرك ☕" : "Karak ☕");
      }
    } else if (gameId === "codenames") {
      tags.push(opt.language === "en" ? "English" : "العربية");
    } else if (gameId === "rento") {
      tags.push(`$${opt.startingBalance ?? 1500}`);
      const turn = Math.round((Number(opt.turnTimer) || 45000) / 1000);
      tags.push(`${turn}${lang === "ar" ? " ثانية" : "s"}`);
    } else if (gameId === "spyfall") {
      const sec = Math.round((Number(opt.roundSeconds) || 480) / 60);
      tags.push(`${sec} ${lang === "ar" ? "دقائق" : "min"}`);
    } else if (gameId === "bluff") {
      tags.push(`${opt.rounds ?? 5} ${lang === "ar" ? "جولات" : "rounds"}`);
      tags.push(opt.language === "en" ? "English" : "العربية");
    } else if (gameId === "taboo") {
      tags.push(opt.language === "en" ? "English" : "العربية");
    }
    return tags;
  }, [partyState?.activeGameId, partyState?.activeOptions, lang]);

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
          <div className="flex flex-col gap-3 mb-4 p-4 rounded-xl bg-surface-sunken border border-border/60">
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0" aria-hidden>
                {activeMeta.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-cream font-bold text-base flex items-center gap-2">
                  <span>{activeMeta.name[lang]}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sand/15 text-sand font-sans font-normal">
                    {lang === "ar" ? "اللعبة المختارة" : "Staged"}
                  </span>
                </div>
                <div className="text-xs text-sand truncate">{activeMeta.blurb[lang]}</div>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="btn btn-quiet btn-sm shrink-0 flex items-center gap-1.5 border border-border/60 text-cream hover:border-sand/50"
                title={t("party.game_settings")}
              >
                <SlidersHorizontal size={14} className="text-sand" />
                <span className="text-xs">{t("party.customize")}</span>
              </button>
            </div>

            {/* Badges / Options summary */}
            {optionsSummary.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
                {optionsSummary.map((badge, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] px-2.5 py-0.5 rounded-full bg-sand/10 text-sand border border-sand/25 font-medium"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-sand mb-4">{t("party.no_game_chosen")}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleStart}
            disabled={!isHost || starting || (!canStart && Boolean(partyState.activeGameId))}
            className={`btn btn-primary btn-lg ${activeMeta ? "sm:col-span-1" : "sm:col-span-2"}`}
          >
            <Play size={18} />
            {activeMeta ? t("party.start") : t("party.pick_game")}
          </button>
          {activeMeta && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="btn btn-ghost btn-lg flex items-center justify-center gap-2 border border-border/60"
            >
              <SlidersHorizontal size={18} className="text-sand" />
              {t("party.game_settings")}
            </button>
          )}
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
              onClick={() =>
                addBot(
                  pickBotName(lang, partyState.players.map((p) => p.name)),
                ).catch(() => addToast(t("party.bot_failed"), "error"))
              }
              className="btn btn-accent-quiet btn-sm"
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
        onPick={async (gameId, options) => {
          await partyPickGame(gameId, options);
          setSettingsOpen(true);
        }}
      />

      {partyState.activeGameId && (
        <GameSettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          gameId={partyState.activeGameId}
          options={partyState.activeOptions as Record<string, unknown> | null}
          onUpdate={partyUpdateOptions}
          canEdit={isHost}
          onStartGame={handleStart}
          canStart={canStart}
        />
      )}
    </div>
  );
}
