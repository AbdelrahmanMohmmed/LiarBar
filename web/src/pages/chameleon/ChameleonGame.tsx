import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Gavel, Send, Crown, WifiOff, EyeOff, Target } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import type { ChameleonState } from "@/lib/chameleonTypes";

/**
 * Chameleon — الحرباية.
 *
 * ## The one screen that matters
 *
 * The grid. Sixteen words, four by four, with your secret word marked if you
 * know it. Everything else on this page is a strip around it.
 *
 * A 4×4 grid is very close to the largest thing that fits legibly on a 375px
 * phone, so it gets the width and the other elements get whatever is left.
 * That's the right trade: a player spends the whole round looking at the grid
 * and glancing at everything else.
 *
 * ## Why the clue input rejects spaces
 *
 * The rule is one word, and the server enforces it — but bouncing a two-word
 * clue back as an error after someone typed it is a bad way to teach a rule
 * that's easy to state up front. The input itself refuses the space, so the
 * constraint is discovered in the first half second rather than on submit.
 */
export default function ChameleonGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const {
    chameleonState,
    myPlayerId,
    reconnectRoom,
    addToast,
    chameleonClue,
    chameleonVote,
    chameleonGuess,
  } = useGame();

  const state = chameleonState as ChameleonState | null;

  const [clue, setClue] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => setClue(""), [state?.roundNumber]);

  const myTurn = state?.cluePlayerId === myPlayerId;

  // Focus the input the moment it becomes your turn. The round is 90 seconds
  // for the whole table; making someone find and tap a field first costs a
  // meaningful slice of it.
  useEffect(() => {
    if (myTurn) inputRef.current?.focus();
  }, [myTurn]);

  const secondsLeft = state?.deadline
    ? Math.max(0, Math.ceil((state.deadline - now) / 1000))
    : null;

  const me = state?.seats.find((s) => s.playerId === myPlayerId);
  const isChameleon = state?.isChameleon ?? false;
  const secretIndex = state?.secretIndex ?? null;

  const cluesSoFar = useMemo(
    () => (state?.seats ?? []).filter((s) => s.clue),
    [state?.seats],
  );

  if (!state) {
    return (
      <div className="page max-w-lg mx-auto space-y-3">
        <div className="skeleton h-14 rounded-lg" />
        <div className="skeleton h-64 rounded-lg" />
      </div>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("chameleon.failed"), "error");
    }
  };

  const revealIndex = state.reveal?.secretIndex ?? null;
  const showSecret = state.phase === "reveal" || state.phase === "game_over";

  return (
    <div className="page max-w-lg mx-auto pb-32">
      <Seo
        title={t("chameleon.title")}
        description={BRAND.description[lang]}
        path={`/chameleon/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      <header className="flex items-center justify-between mb-3">
        <span className="text-xs text-sand">
          {t("chameleon.round")} {state.roundNumber} ·{" "}
          {t("spyfall.first_to").replace("{n}", String(state.targetScore))}
        </span>
        {secondsLeft !== null && (
          <span className={`chip font-numeric ${secondsLeft <= 15 ? "chip-hot" : ""}`}>
            <Clock size={12} />
            {secondsLeft}s
          </span>
        )}
      </header>

      {/* ---- Who you are ---- */}
      {(state.phase === "clues" || state.phase === "voting") && (
        <div
          className={`rounded-lg p-3 mb-3 text-center border ${
            isChameleon ? "bg-ruby/10 border-ruby/40" : "bg-mint/10 border-mint/30"
          }`}
        >
          {isChameleon ? (
            <p className="font-display text-lg text-ruby inline-flex items-center gap-2">
              <EyeOff size={18} />
              {t("chameleon.you_are_it")}
            </p>
          ) : (
            <p className="text-sm text-mint">
              {t("chameleon.secret_is")}{" "}
              <strong className="font-display text-base">
                {secretIndex !== null ? state.topic?.words[secretIndex][lang] : "…"}
              </strong>
            </p>
          )}
        </div>
      )}

      {/* ---- The grid ---- */}
      {state.topic && (
        <section className="mb-4">
          <h2 className="text-xs uppercase tracking-wider text-sand mb-2 text-center">
            {state.topic.title[lang]}
          </h2>
          <div className="grid grid-cols-4 gap-1.5">
            {state.topic.words.map((word, i) => {
              const isSecret = !isChameleon && secretIndex === i;
              const isRevealed = showSecret && revealIndex === i;
              const guessable = state.phase === "guessing" && isChameleon;

              return (
                <button
                  key={i}
                  disabled={!guessable}
                  onClick={() => guessable && void run(() => chameleonGuess(i))}
                  className={[
                    "aspect-square rounded-md p-1 text-[11px] leading-tight",
                    "grid place-items-center text-center break-words transition",
                    isRevealed
                      ? "bg-gold/25 border-2 border-gold text-cream font-bold"
                      : isSecret
                        ? "bg-mint/20 border-2 border-mint text-cream font-bold"
                        : "bg-surface-sunken border border-border text-sand",
                    guessable ? "cursor-pointer hover:bg-surface-raised active:scale-95" : "",
                  ].join(" ")}
                >
                  {word[lang]}
                </button>
              );
            })}
          </div>
          {state.phase === "guessing" && isChameleon && (
            <p className="text-center text-sm text-gold mt-2 font-bold animate-in">
              <Target size={14} className="inline me-1" />
              {t("chameleon.caught_guess")}
            </p>
          )}
          {state.phase === "guessing" && !isChameleon && (
            <p className="text-center text-sm text-sand mt-2">
              {t("chameleon.waiting_guess")}
            </p>
          )}
        </section>
      )}

      {/* ---- Clues ---- */}
      {state.phase === "clues" && (
        <section className="surface rounded-lg p-3 mb-3">
          {cluesSoFar.length > 0 && (
            <ul className="space-y-1 mb-3">
              {cluesSoFar.map((seat) => (
                <li key={seat.playerId} className="flex items-baseline gap-2 text-sm">
                  <span className="text-sand truncate w-20 shrink-0">{seat.name}</span>
                  <span className="font-display text-cream">{seat.clue}</span>
                </li>
              ))}
            </ul>
          )}

          {myTurn ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const word = clue.trim();
                if (!word) return;
                void run(() => chameleonClue(word));
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                className="field flex-1"
                value={clue}
                // Strip spaces as they're typed. The one-word rule is easy to
                // state and annoying to learn from a rejection after you've
                // already composed a phrase.
                onChange={(e) => setClue(e.target.value.replace(/\s/g, "").slice(0, 24))}
                placeholder={t("chameleon.your_word")}
                maxLength={24}
                autoComplete="off"
              />
              <button type="submit" disabled={!clue.trim()} className="btn btn-primary shrink-0">
                <Send size={16} />
              </button>
            </form>
          ) : (
            <p className="text-sm text-sand text-center">
              {t("chameleon.waiting_for").replace(
                "{name}",
                state.seats.find((s) => s.playerId === state.cluePlayerId)?.name ?? "",
              )}
            </p>
          )}
        </section>
      )}

      {/* ---- Voting ---- */}
      {state.phase === "voting" && (
        <section className="surface-lit rounded-lg p-4 mb-3">
          <p className="text-center font-display text-lg text-cream mb-1">
            <Gavel size={18} className="inline me-1.5" />
            {t("chameleon.who_was_it")}
          </p>
          <p className="text-center text-xs text-sand mb-3">
            {t("chameleon.votes_in")
              .replace("{have}", String(state.seats.filter((s) => s.hasVoted).length))
              .replace("{need}", String(state.seats.filter((s) => s.isConnected).length))}
          </p>

          {/* All clues stay visible during the vote — the vote is an argument
              about the clues, and hiding them turns it into a memory test. */}
          <ul className="space-y-1.5">
            {state.seats.map((seat) => (
              <li key={seat.playerId}>
                <button
                  disabled={seat.playerId === myPlayerId || me?.hasVoted}
                  onClick={() => void run(() => chameleonVote(seat.playerId))}
                  className={[
                    "w-full flex items-baseline gap-2 px-3 py-2 rounded-md text-start transition",
                    seat.playerId === myPlayerId || me?.hasVoted
                      ? "bg-surface-sunken opacity-60 cursor-default"
                      : "bg-surface-sunken hover:bg-surface-raised active:scale-[0.99]",
                  ].join(" ")}
                >
                  <span className="text-sm text-sand truncate w-20 shrink-0">
                    {seat.name}
                  </span>
                  <span className="font-display text-cream flex-1 truncate">
                    {seat.clue ?? "—"}
                  </span>
                  {seat.hasVoted && (
                    <span className="text-[10px] text-mint shrink-0">
                      {t("chameleon.voted")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Reveal ---- */}
      {(state.phase === "reveal" || state.phase === "game_over") && state.reveal && (
        <section className="surface-lit rounded-lg p-4 mb-3 text-center animate-in">
          <p className="font-display text-2xl text-cream mb-1">
            {state.reveal.chameleonWon
              ? t("chameleon.cham_wins")
              : t("chameleon.table_wins")}
          </p>
          <p className="text-sm text-sand">
            {t("chameleon.reveal_line")
              .replace("{name}", state.reveal.chameleonName)
              .replace("{word}", state.reveal.secretWord[lang])}
          </p>
          {state.reveal.caught && (
            <p className="text-sm text-sand mt-2">
              {state.reveal.guessedRight
                ? t("chameleon.caught_but_guessed")
                : t("chameleon.caught_clean")}
            </p>
          )}
          {!state.reveal.caught && (
            <p className="text-sm text-sand mt-2">
              {state.reveal.votedOutName
                ? t("chameleon.wrong_person").replace("{name}", state.reveal.votedOutName)
                : t("chameleon.no_agreement")}
            </p>
          )}
          {state.reveal.nextRoundAt && (
            <p className="text-xs text-sand mt-3">
              {t("spyfall.next_round").replace(
                "{n}",
                String(Math.max(0, Math.ceil((state.reveal.nextRoundAt - now) / 1000))),
              )}
            </p>
          )}
        </section>
      )}

      {/* ---- Scores ---- */}
      <section className="surface rounded-lg p-3">
        <ul className="space-y-1">
          {[...state.seats]
            .sort((a, b) => b.score - a.score)
            .map((seat) => (
              <li key={seat.playerId} className="flex items-center gap-2 px-1">
                {!seat.isConnected && <WifiOff size={11} className="text-ruby shrink-0" />}
                {state.winnerId === seat.playerId && (
                  <Crown size={12} className="text-gold shrink-0" />
                )}
                <span className="flex-1 truncate text-sm text-cream">
                  {seat.flag ? `${seat.flag} ` : ""}
                  {seat.name}
                </span>
                <span className="font-numeric text-sm text-gold">{seat.score}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
