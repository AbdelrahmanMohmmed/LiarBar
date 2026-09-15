import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Crown, WifiOff, Check, X, Sparkles, Eye } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import type { WyrState, WyrChoice } from "@/lib/wyrTypes";

/**
 * Would You Rather — لو خيروك.
 *
 * ## The whole screen is two cards
 *
 * Two options, full width, stacked, and enormous. That's the entire interface
 * for the part of the round that matters. Everything else — the timer, the
 * scores, who's still deciding — is a thin strip.
 *
 * The reason is that the decision is supposed to be instant and instinctive.
 * "Would you rather" is a game you answer with your gut and then defend out
 * loud; a screen that makes you read carefully to find the tap target turns a
 * gut reaction into an admin task, and the reaction is the game.
 *
 * ## Why predictions are hidden until the reveal
 *
 * A live tally would let late predictors follow the crowd, which removes the
 * only decision they get to make. The seat list shows only *whether* someone
 * has locked in, never what.
 */
export default function WyrGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { wyrState, myPlayerId, reconnectRoom, addToast, wyrChoose, wyrPredict } =
    useGame();

  const state = wyrState as WyrState | null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  if (!state) {
    return (
      <div className="page max-w-lg mx-auto space-y-3">
        <div className="skeleton h-12 rounded-lg" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  const isSubject = state.isSubject ?? false;
  const subject = state.seats.find((s) => s.playerId === state.subjectId);
  const secondsLeft = state.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;

  const myChoice: WyrChoice | null =
    (isSubject ? state.myAnswer : state.myPrediction) ?? null;

  const canAct =
    (state.phase === "choosing" && isSubject && !myChoice) ||
    (state.phase === "predicting" && !isSubject && !myChoice);

  const act = async (choice: WyrChoice) => {
    try {
      if (state.phase === "choosing") await wyrChoose(choice);
      else await wyrPredict(choice);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("wyr.failed"), "error");
    }
  };

  const showResult = state.phase === "reveal" || state.phase === "game_over";

  return (
    <div className="page max-w-lg mx-auto pb-32">
      <Seo
        title={t("wyr.title")}
        description={BRAND.description[lang]}
        path={`/wyr/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      <header className="flex items-center justify-between mb-3">
        <span className="text-xs text-sand">
          {t("chameleon.round")} {state.roundNumber} ·{" "}
          {t("spyfall.first_to").replace("{n}", String(state.targetScore))}
        </span>
        {secondsLeft !== null && (
          <span className={`chip font-numeric ${secondsLeft <= 8 ? "chip-hot" : ""}`}>
            <Clock size={12} />
            {secondsLeft}
            {t("common.seconds_short")}
          </span>
        )}
      </header>

      {/* ---- Who is being read ---- */}
      <div className="text-center mb-4">
        {state.phase === "choosing" && (
          <p className="font-display text-xl text-cream">
            {isSubject ? t("wyr.your_turn") : t("wyr.waiting_on").replace("{name}", subject?.name ?? "")}
          </p>
        )}
        {state.phase === "predicting" && (
          <p className="font-display text-xl text-cream">
            {isSubject
              ? t("wyr.they_are_guessing")
              : t("wyr.what_did_they_pick").replace("{name}", subject?.name ?? "")}
          </p>
        )}
        {state.phase === "choosing" && isSubject && (
          <p className="text-xs text-sand mt-1">{t("wyr.answer_honestly")}</p>
        )}
      </div>

      {/* ---- The two cards: the whole game ---- */}
      {state.dilemma && (
        <div className="space-y-3 mb-4">
          {(["a", "b"] as const).map((key) => {
            const option = state.dilemma![key];
            const chosen = myChoice === key;
            const wasAnswer = showResult && state.reveal?.answer === key;
            const votes = showResult ? (state.reveal?.tally[key] ?? 0) : 0;

            return (
              <button
                key={key}
                disabled={!canAct}
                onClick={() => canAct && void act(key)}
                className={[
                  "w-full rounded-xl p-5 text-start border-2 transition relative overflow-hidden",
                  "min-h-[104px] flex items-center",
                  wasAnswer
                    ? "border-mint bg-mint/12"
                    : chosen
                      ? "border-coral bg-coral/12"
                      : "border-border bg-surface",
                  canAct ? "active:scale-[0.98] hover:bg-surface-raised" : "",
                ].join(" ")}
              >
                <span className="relative z-10 flex-1">
                  <span className="block font-display text-lg text-cream leading-snug">
                    {option[lang]}
                  </span>
                  {showResult && (
                    <span className="block text-xs text-sand mt-1.5">
                      {votes === 0
                        ? t("wyr.nobody_said")
                        : t("wyr.n_said").replace("{n}", String(votes))}
                      {wasAnswer && ` · ${t("wyr.actual")}`}
                    </span>
                  )}
                </span>

                {wasAnswer && <Check size={22} className="text-mint shrink-0 relative z-10" />}
                {chosen && !wasAnswer && showResult && (
                  <X size={22} className="text-ruby shrink-0 relative z-10" />
                )}

                {/* Result bar behind the text — a share of the card rather than
                    a separate chart, so the result reads as part of the option
                    instead of as a second thing to look at. */}
                {showResult && state.reveal && (
                  <span
                    className="absolute inset-y-0 start-0 bg-cream/5 transition-all duration-700"
                    style={{
                      width: `${
                        (votes /
                          Math.max(1, state.reveal.tally.a + state.reveal.tally.b)) *
                        100
                      }%`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Waiting / locked in ---- */}
      {myChoice && !showResult && (
        <p className="text-center text-sm text-mint mb-4">
          {isSubject ? t("wyr.locked_answer") : t("wyr.locked_guess")}
        </p>
      )}
      {state.phase === "predicting" && isSubject && (
        <p className="text-center text-sm text-sand mb-4 inline-flex items-center gap-1.5 w-full justify-center">
          <Eye size={14} />
          {t("wyr.sit_tight")}
        </p>
      )}

      {/* ---- Reveal ---- */}
      {showResult && state.reveal && (
        <section className="surface-lit rounded-xl p-4 mb-4 text-center animate-in">
          {state.reveal.fooledEveryone && (
            <p className="chip chip-gold mb-2 inline-flex">
              <Sparkles size={12} />
              {t("wyr.fooled_everyone")}
            </p>
          )}
          {state.reveal.readLikeABook && (
            <p className="chip mb-2 inline-flex">{t("wyr.read_like_a_book")}</p>
          )}
          <p className="text-sm text-sand">
            {t("wyr.summary")
              .replace("{name}", state.reveal.subjectName)
              .replace("{right}", String(state.reveal.correctIds.length))
              .replace(
                "{total}",
                String(state.reveal.correctIds.length + state.reveal.wrongIds.length),
              )}
          </p>
          {state.reveal.nextRoundAt && (
            <p className="text-xs text-sand mt-2">
              {t("spyfall.next_round").replace(
                "{n}",
                String(Math.max(0, Math.ceil((state.reveal.nextRoundAt - now) / 1000))),
              )}
            </p>
          )}
        </section>
      )}

      {/* ---- Scores ---- */}
      <section className="surface rounded-xl p-3">
        <ul className="space-y-1">
          {[...state.seats]
            .sort((a, b) => b.score - a.score)
            .map((seat) => {
              const isSubjectRow = seat.playerId === state.subjectId;
              return (
                <li key={seat.playerId} className="flex items-center gap-2 px-1 py-0.5">
                  {!seat.isConnected && <WifiOff size={11} className="text-ruby shrink-0" />}
                  {state.winnerId === seat.playerId && (
                    <Crown size={12} className="text-gold shrink-0" />
                  )}
                  <span
                    className={`flex-1 truncate text-sm ${
                      isSubjectRow ? "text-coral font-bold" : "text-cream"
                    }`}
                  >
                    {seat.flag ? `${seat.flag} ` : ""}
                    {seat.name}
                    {seat.playerId === myPlayerId && (
                      <span className="text-sand text-xs"> ({t("party.you")})</span>
                    )}
                  </span>

                  {/* During predicting: only whether they've locked in, never what. */}
                  {state.phase === "predicting" && !isSubjectRow && (
                    <span
                      className={`text-[10px] ${seat.hasPredicted ? "text-mint" : "text-sand"}`}
                    >
                      {seat.hasPredicted ? t("wyr.locked") : t("wyr.thinking")}
                    </span>
                  )}
                  {showResult && seat.correct !== undefined && !isSubjectRow && (
                    <span className="shrink-0">
                      {seat.correct ? (
                        <Check size={13} className="text-mint" />
                      ) : (
                        <X size={13} className="text-ruby" />
                      )}
                    </span>
                  )}

                  <span className="font-numeric text-sm text-gold w-7 text-end">
                    {seat.score}
                  </span>
                </li>
              );
            })}
        </ul>
      </section>
    </div>
  );
}
