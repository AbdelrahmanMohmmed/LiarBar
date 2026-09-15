import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Crown, WifiOff, Check, Sparkles, PenLine } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import type { BluffState } from "@/lib/bluffTypes";

/**
 * Bluff — بلوف.
 *
 * ## Three screens, one at a time
 *
 * Writing, choosing, reveal. Each phase shows exactly one thing to do and
 * hides the rest, because this is the only game in the catalogue that asks
 * players to *type* — and a text field competing with a scoreboard, a timer
 * and eight other people's names on a 375px screen is a text field nobody
 * fills in before the clock runs out.
 *
 * ## The one piece of state that has to be right
 *
 * Your own answer is on the board during `choosing`, indistinguishable from
 * everyone else's, and you must not be able to pick it. The server refuses,
 * but an error after the tap is a bad way to learn a rule — so the client
 * marks your entry and disables it. That marker comes from `myOptionId` on
 * the private channel; if it is missing the option is merely unmarked, never
 * wrongly enabled on someone else's entry, because the failure that matters
 * is the one that misleads.
 *
 * ## Direction
 *
 * The room has a language, not the viewer (see the note on `language` in the
 * wire contract), so this page sets `dir` from `state.language` rather than
 * from the UI language. An English-speaking player in an Arabic room reads an
 * English interface around a right-to-left board, which is the honest way to
 * show what is actually happening.
 */
export default function BluffGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { bluffState, myPlayerId, reconnectRoom, addToast, bluffAnswer, bluffChoose } =
    useGame();

  const state = bluffState as BluffState | null;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Clear the box between rounds. Without this the previous round's answer sits
  // in the field looking submitted, and people wait instead of writing.
  const round = state?.roundNumber ?? 0;
  useEffect(() => {
    setDraft("");
  }, [round]);

  const seatsByScore = useMemo(
    () => [...(state?.seats ?? [])].sort((a, b) => b.score - a.score),
    [state?.seats],
  );

  if (!state) {
    return (
      <div className="page max-w-lg mx-auto space-y-3">
        <div className="skeleton h-12 rounded-lg" />
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-14 rounded-xl" />
      </div>
    );
  }

  const boardDir = state.language === "ar" ? "rtl" : "ltr";
  const secondsLeft = state.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;

  const myAnswer = state.myAnswer ?? null;
  const myChoiceId = state.myChoiceId ?? null;
  const stillWriting = state.seats.filter((s) => s.isConnected && !s.hasWritten).length;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await bluffAnswer(text);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("bluff.failed"), "error");
    } finally {
      setSending(false);
    }
  };

  const pick = async (optionId: string) => {
    if (myChoiceId || sending) return;
    setSending(true);
    try {
      await bluffChoose(optionId);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("bluff.failed"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page max-w-lg mx-auto pb-32">
      <Seo
        title={t("bluff.title")}
        description={BRAND.description[lang]}
        path={`/bluff/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      <header className="flex items-center justify-between mb-3">
        <span className="text-xs text-sand">
          {t("bluff.round_of")
            .replace("{n}", String(state.roundNumber))
            .replace("{total}", String(state.totalRounds))}
        </span>
        {secondsLeft !== null && (
          <span className={`chip font-numeric ${secondsLeft <= 10 ? "chip-hot" : ""}`}>
            <Clock size={12} />
            {secondsLeft}
            {t("common.seconds_short")}
          </span>
        )}
      </header>

      {/* ---- The prompt: the same sentence all round, never moves ---- */}
      {state.prompt && (
        <section
          dir={boardDir}
          className="surface-lit rounded-xl p-4 mb-4 text-center"
        >
          <p className="font-display text-lg text-cream leading-relaxed">
            {state.prompt}
          </p>
        </section>
      )}

      {/* ---- Writing ---- */}
      {state.phase === "writing" && (
        <section className="mb-4">
          <p className="text-sm text-sand mb-2 text-center">{t("bluff.write_prompt")}</p>
          <div className="flex gap-2">
            <input
              dir={boardDir}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              maxLength={60}
              placeholder={t("bluff.write_placeholder")}
              className="field flex-1"
              aria-label={t("bluff.write_placeholder")}
            />
            <button
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="btn btn-primary shrink-0"
            >
              <PenLine size={16} />
              {myAnswer ? t("bluff.change") : t("bluff.submit")}
            </button>
          </div>

          {myAnswer && (
            <p className="text-center text-sm text-mint mt-3">
              {t("bluff.written")}
              <span dir={boardDir} className="block text-cream font-display mt-1">
                “{myAnswer}”
              </span>
            </p>
          )}
          {stillWriting > 0 && (
            <p className="text-center text-xs text-sand mt-2">
              {t("bluff.waiting_writers").replace("{n}", String(stillWriting))}
            </p>
          )}
        </section>
      )}

      {/* ---- Choosing ---- */}
      {state.phase === "choosing" && (
        <section className="mb-4">
          <p className="text-sm text-sand mb-2 text-center">{t("bluff.choose_prompt")}</p>
          <ul className="space-y-2">
            {state.options.map((option) => {
              const mine = option.id === state.myOptionId;
              const picked = option.id === myChoiceId;
              return (
                <li key={option.id}>
                  <button
                    dir={boardDir}
                    disabled={mine || Boolean(myChoiceId) || sending}
                    onClick={() => void pick(option.id)}
                    className={[
                      "w-full rounded-lg border-2 p-3.5 text-start transition",
                      "flex items-center gap-2 min-h-[56px]",
                      picked
                        ? "border-coral bg-coral/12"
                        : mine
                          ? "border-border bg-surface-sunken opacity-60"
                          : "border-border bg-surface hover:bg-surface-raised active:scale-[0.99]",
                    ].join(" ")}
                  >
                    <span className="flex-1 text-cream">{option.text}</span>
                    {mine && (
                      <span className="chip text-[10px] shrink-0">
                        {t("bluff.your_answer_tag")}
                      </span>
                    )}
                    {picked && <Check size={18} className="text-coral shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {myChoiceId && (
            <p className="text-center text-sm text-mint mt-3">{t("bluff.chosen")}</p>
          )}
        </section>
      )}

      {/* ---- Reveal ---- */}
      {(state.phase === "reveal" || state.phase === "game_over") && state.reveal && (
        <section className="mb-4 space-y-2 animate-in">
          {state.reveal.entries.map((entry) => {
            const fooled = entry.pickedBy.length;
            const iPicked = entry.pickedBy.some((p) => p.playerId === myPlayerId);
            return (
              <div
                key={entry.id}
                dir={boardDir}
                className={[
                  "rounded-lg border-2 p-3.5",
                  entry.isTruth ? "border-mint bg-mint/12" : "border-border bg-surface",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-cream font-display">{entry.text}</span>
                  {entry.isTruth && (
                    <span className="chip chip-mint text-[10px] shrink-0">
                      <Check size={11} />
                      {t("bluff.truth")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-sand mt-1.5" dir={lang === "ar" ? "rtl" : "ltr"}>
                  {entry.authorName && (
                    <span className="text-gold">
                      {entry.authorName} {t("bluff.wrote_it")}
                    </span>
                  )}
                  {entry.authorName && " · "}
                  {fooled === 0
                    ? t("bluff.nobody_picked")
                    : entry.isTruth
                      ? entry.pickedBy.map((p) => p.name).join(", ")
                      : t("bluff.fooled_n").replace("{n}", String(fooled)) +
                        ": " +
                        entry.pickedBy.map((p) => p.name).join(", ")}
                  {iPicked && ` · ${t("bluff.you_picked")}`}
                </p>
              </div>
            );
          })}

          {state.reveal.accidentalTruthIds.map((id) => {
            const seat = state.seats.find((s) => s.playerId === id);
            return (
              <p key={id} className="chip chip-gold w-full justify-center">
                <Sparkles size={12} />
                {t("bluff.accidental").replace("{name}", seat?.name ?? "—")}
              </p>
            );
          })}

          {state.reveal.nextRoundAt && (
            <p className="text-center text-xs text-sand pt-1">
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
          {seatsByScore.map((seat) => (
            <li key={seat.playerId} className="flex items-center gap-2 px-1 py-0.5">
              {!seat.isConnected && <WifiOff size={11} className="text-ruby shrink-0" />}
              {state.winnerId === seat.playerId && (
                <Crown size={12} className="text-gold shrink-0" />
              )}
              <span className="flex-1 truncate text-sm text-cream">
                {seat.flag ? `${seat.flag} ` : ""}
                {seat.name}
                {seat.playerId === myPlayerId && (
                  <span className="text-sand text-xs"> ({t("party.you")})</span>
                )}
              </span>

              {/* Whether they've acted, never what they wrote or picked. */}
              {state.phase === "writing" && (
                <span
                  className={`text-[10px] ${seat.hasWritten ? "text-mint" : "text-sand"}`}
                >
                  {seat.hasWritten ? t("wyr.locked") : t("wyr.thinking")}
                </span>
              )}
              {state.phase === "choosing" && (
                <span
                  className={`text-[10px] ${seat.hasChosen ? "text-mint" : "text-sand"}`}
                >
                  {seat.hasChosen ? t("wyr.locked") : t("wyr.thinking")}
                </span>
              )}
              {state.phase === "reveal" && seat.roundPoints > 0 && (
                <span className="text-[10px] text-mint font-numeric">
                  +{seat.roundPoints}
                </span>
              )}

              <span className="font-numeric text-sm text-gold w-7 text-end">
                {seat.score}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
