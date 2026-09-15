import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, WifiOff, Check, SkipForward, Bell, Shuffle, EyeOff } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import type { TabooState, TabooTeam } from "@/lib/tabooTypes";

/**
 * Taboo — تابو.
 *
 * ## Three different screens for three groups of people
 *
 * This is the only page in the product where what you see depends on which
 * team you are on, and the difference is the game rather than a convenience:
 *
 * - **The describer** sees the word, the four forbidden words, and two big
 *   buttons. Nothing else. They are talking at speed and looking at a phone
 *   in one hand; anything that isn't the card or a target is in the way.
 * - **The other team** sees exactly the same card — in the physical game they
 *   are the ones holding it — plus one enormous buzzer.
 * - **The describer's own team** must see none of it, so they get the clock,
 *   the score, and a note telling them to listen.
 *
 * The client never decides who is in which group. `card` arrives null for the
 * people who aren't entitled to it, from the server, on the private channel —
 * so a bug in this file can hide the card from someone who should see it, but
 * cannot show it to someone who shouldn't.
 *
 * ## Why the buttons are that big
 *
 * A describer taps "Got it" every four or five seconds while talking
 * continuously and not looking down. Anything smaller than a thumb-sized
 * target gets missed, and a missed tap in this game costs a word. The buzzer
 * is the same argument from the other side: the person buzzing has just heard
 * something and is already shouting about it.
 */
export default function TabooGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const {
    tabooState,
    myPlayerId,
    reconnectRoom,
    addToast,
    tabooCorrect,
    tabooSkip,
    tabooBuzz,
    tabooShuffleTeams,
  } = useGame();

  const state = tabooState as TabooState | null;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  if (!state) {
    return (
      <div className="page max-w-lg mx-auto space-y-3">
        <div className="skeleton h-12 rounded-lg" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-16 rounded-xl" />
      </div>
    );
  }

  const teamName = (team: TabooTeam) =>
    team === "a" ? t("taboo.team_a") : t("taboo.team_b");

  const secondsLeft = state.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;
  const describer = state.seats.find((s) => s.playerId === state.describerId);
  const amDescribing = state.amDescribing ?? false;
  const canBuzz = state.canBuzz ?? false;
  const card = state.card ?? null;
  const running = state.phase === "describing";

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("taboo.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page max-w-lg mx-auto pb-32">
      <Seo
        title={t("taboo.title")}
        description={BRAND.description[lang]}
        path={`/taboo/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      {/* ---- Clock and score: the only thing on every version of this screen ---- */}
      <header className="flex items-center justify-between mb-3">
        <span className="text-xs text-sand">
          {t("taboo.turn_of").replace("{n}", String(state.turnNumber))}
        </span>
        {secondsLeft !== null && (
          <span
            className={`chip font-numeric text-base ${secondsLeft <= 10 ? "chip-hot" : ""}`}
          >
            <Clock size={14} />
            {secondsLeft}
            {t("common.seconds_short")}
          </span>
        )}
      </header>

      <section className="grid grid-cols-2 gap-2 mb-4">
        {(["a", "b"] as const).map((team) => (
          <div
            key={team}
            className={[
              "rounded-lg border-2 p-3 text-center",
              state.describingTeam === team
                ? "border-coral bg-coral/10"
                : "border-border bg-surface",
            ].join(" ")}
          >
            <p className="text-xs text-sand truncate">
              {teamName(team)}
              {state.myTeam === team && ` · ${t("taboo.your_team")}`}
            </p>
            <p className="font-numeric text-2xl text-gold">{state.scores[team]}</p>
          </div>
        ))}
      </section>

      {/* ---- The card, for the two groups entitled to it ---- */}
      {running && card && (
        <section className="surface-lit rounded-xl p-5 mb-4 text-center">
          <p className="font-display text-3xl text-cream mb-3 break-words">{card.word}</p>
          <p className="text-[11px] uppercase tracking-wider text-sand mb-2">
            {t("taboo.dont_say")}
          </p>
          <ul className="flex flex-wrap justify-center gap-1.5">
            {card.taboo.map((word) => (
              <li
                key={word}
                className="rounded-pill bg-ruby/15 px-2.5 py-1 text-sm text-ruby"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- …and the deliberately empty version for the guessers ---- */}
      {running && !card && (
        <section className="surface rounded-xl p-6 mb-4 text-center">
          <EyeOff size={26} className="mx-auto text-sand mb-2" />
          <p className="font-display text-lg text-cream">
            {t("taboo.guessing_now").replace("{name}", describer?.name ?? "")}
          </p>
          <p className="text-xs text-sand mt-1">{t("taboo.cant_see")}</p>
        </section>
      )}

      {/* ---- Controls ---- */}
      {running && amDescribing && (
        <section className="space-y-2 mb-4">
          <p className="text-center text-sm text-coral">{t("taboo.you_describe")}</p>
          <button
            onClick={() => void act(tabooCorrect)}
            disabled={busy}
            className="btn btn-primary w-full !min-h-[64px] text-lg"
          >
            <Check size={22} />
            {t("taboo.correct")}
          </button>
          <button
            onClick={() => void act(tabooSkip)}
            disabled={busy}
            className="btn btn-ghost w-full !min-h-[52px]"
          >
            <SkipForward size={18} />
            {t("taboo.skip")}
          </button>
        </section>
      )}

      {running && canBuzz && (
        <section className="mb-4">
          <p className="text-center text-sm text-sand mb-2">
            {t("taboo.watch_them").replace("{name}", describer?.name ?? "")}
          </p>
          <button
            onClick={() => void act(tabooBuzz)}
            disabled={busy}
            className="btn w-full !min-h-[72px] text-lg bg-ruby text-cream hover:brightness-110"
          >
            <Bell size={24} />
            {t("taboo.buzz")}
          </button>
        </section>
      )}

      {/* ---- What's been resolved this turn ---- */}
      {running && state.turnResults.length > 0 && (
        <ul className="space-y-1 mb-4">
          {state.turnResults.map((result, i) => (
            <li
              key={`${result.word}-${i}`}
              className="flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-sm"
            >
              <span className="text-cream truncate">{result.word}</span>
              <span
                className={
                  result.outcome === "correct"
                    ? "text-live text-xs"
                    : result.outcome === "buzzed"
                      ? "text-ruby text-xs"
                      : "text-sand text-xs"
                }
              >
                {t(`taboo.outcome_${result.outcome}`)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Between turns ---- */}
      {state.phase === "turn_recap" && state.recap && (
        <section className="surface-lit rounded-xl p-4 mb-4 animate-in">
          <p className="font-display text-lg text-cream text-center mb-1">
            {t("taboo.recap_title").replace("{name}", state.recap.describerName)}
          </p>
          <p className="text-center text-sm text-gold mb-3">
            {t("taboo.points_n").replace("{n}", String(state.recap.points))}
          </p>
          <ul className="space-y-1">
            {state.recap.results.map((result, i) => (
              <li
                key={`${result.word}-${i}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-cream truncate">{result.word}</span>
                <span
                  className={
                    result.outcome === "correct"
                      ? "text-live text-xs"
                      : result.outcome === "buzzed"
                        ? "text-ruby text-xs"
                        : "text-sand text-xs"
                  }
                >
                  {t(`taboo.outcome_${result.outcome}`)}
                </span>
              </li>
            ))}
          </ul>
          {state.recap.nextTurnAt && (
            <p className="text-center text-xs text-sand mt-3">
              {t("taboo.next_turn").replace(
                "{n}",
                String(Math.max(0, Math.ceil((state.recap.nextTurnAt - now) / 1000))),
              )}
            </p>
          )}
        </section>
      )}

      {state.phase === "game_over" && state.winningTeam && (
        <section className="surface-lit rounded-xl p-6 mb-4 text-center animate-in">
          <p className="font-display text-2xl text-gold">
            {t("taboo.team_wins").replace("{team}", teamName(state.winningTeam))}
          </p>
        </section>
      )}

      {/* ---- Teams ---- */}
      <section className="surface rounded-xl p-3">
        <ul className="space-y-1">
          {state.seats.map((seat) => (
            <li key={seat.playerId} className="flex items-center gap-2 px-1 py-0.5">
              <span
                className={`w-1.5 h-4 rounded-pill shrink-0 ${
                  seat.team === "a" ? "bg-sky" : "bg-violet"
                }`}
                aria-hidden
              />
              {!seat.isConnected && <WifiOff size={11} className="text-ruby shrink-0" />}
              <span
                className={`flex-1 truncate text-sm ${
                  seat.playerId === state.describerId ? "text-coral font-bold" : "text-cream"
                }`}
              >
                {seat.flag ? `${seat.flag} ` : ""}
                {seat.name}
                {seat.playerId === myPlayerId && (
                  <span className="text-sand text-xs"> ({t("table.you")})</span>
                )}
              </span>
              <span className="text-[10px] text-sand shrink-0">{teamName(seat.team)}</span>
            </li>
          ))}
        </ul>

        {/* Between turns only: a lopsided draw is fixable without a lobby. */}
        {state.phase !== "describing" && (
          <button
            onClick={() => void act(tabooShuffleTeams)}
            disabled={busy}
            className="btn btn-quiet btn-sm w-full mt-2"
          >
            <Shuffle size={14} />
            {t("taboo.shuffle_teams")}
          </button>
        )}
      </section>
    </div>
  );
}
