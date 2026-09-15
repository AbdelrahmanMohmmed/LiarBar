import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Gavel,
  MapPin,
  Search,
  Clock,
  Check,
  X,
  Crown,
  WifiOff,
} from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND } from "@/lib/brand";
import type { SpyfallState, SpyfallSeat } from "@/lib/spyfallTypes";

/**
 * Spyfall — برا اللعبة.
 *
 * ## The design constraint
 *
 * **The game is the conversation. The screen is a reference card.**
 *
 * Everything that matters happens in voice. The screen's entire job is to hold
 * one secret you glance at, a clock, and the three buttons the server has to
 * arbitrate. Anything more competes with the thing that IS the game — and a
 * player looking at their phone is a player not reading the room, which is the
 * only skill Spyfall tests.
 *
 * So: no chat, no move log, no animations, no decoration. The largest element
 * on screen is your own secret, because that is the single piece of
 * information you will re-check a dozen times a round.
 *
 * ## The one non-obvious UI decision
 *
 * Your location is **hidden behind a tap-to-reveal**, not shown permanently.
 * People play this in the same room as each other as often as they play it
 * remotely, and a location sitting openly on screen is read over a shoulder in
 * the first thirty seconds. A hold-to-see control makes the secret yours in a
 * way a printed card never was.
 */
export default function SpyfallGamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const {
    spyfallState,
    myPlayerId,
    reconnectRoom,
    addToast,
    spyfallAccuse,
    spyfallVote,
    spyfallGuess,
    spyfallPass,
  } = useGame();

  const state = spyfallState as SpyfallState | null;

  const [now, setNow] = useState(() => Date.now());
  const [secretShown, setSecretShown] = useState(false);
  const [guessOpen, setGuessOpen] = useState(false);
  const [guessFilter, setGuessFilter] = useState("");

  useEffect(() => {
    if (!roomId || state?.roomId === roomId || !myPlayerId) return;
    void reconnectRoom(roomId, myPlayerId).catch(() => navigate(`/j/${roomId}`));
  }, [roomId, state?.roomId, myPlayerId, reconnectRoom, navigate]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Hide the secret again between rounds. Leaving it revealed means the next
  // round starts with your new identity already showing to the room.
  useEffect(() => {
    setSecretShown(false);
    setGuessOpen(false);
  }, [state?.roundNumber]);

  const me = state?.seats.find((s) => s.playerId === myPlayerId);
  const isSpy = state?.isSpy ?? false;

  const secondsLeft = state?.roundEndsAt
    ? Math.max(0, Math.ceil((state.roundEndsAt - now) / 1000))
    : null;

  const voteSecondsLeft = state?.vote
    ? Math.max(0, Math.ceil((state.vote.endsAt - now) / 1000))
    : null;

  const filteredLocations = useMemo(() => {
    const list = state?.locations ?? [];
    const query = guessFilter.trim().toLowerCase();
    if (!query) return list;
    return list.filter((l) => l.name[lang].toLowerCase().includes(query));
  }, [state?.locations, guessFilter, lang]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        addToast(err instanceof Error ? err.message : t("spyfall.failed"), "error");
      }
    },
    [addToast, t],
  );

  if (!state) {
    return (
      <div className="page max-w-lg mx-auto space-y-3">
        <div className="skeleton h-16 rounded-lg" />
        <div className="skeleton h-48 rounded-lg" />
      </div>
    );
  }

  const iHaveVoted =
    state.vote !== null &&
    state.vote.votes.some((v) => v.voterId === myPlayerId);
  const iAmAccused = state.vote?.targetId === myPlayerId;

  return (
    <div className="page max-w-lg mx-auto pb-32">
      <Seo
        title={t("spyfall.title")}
        description={BRAND.description[lang]}
        path={`/spyfall/game/${state.roomId}`}
        noindex
        lang={lang}
      />

      {/* ---- Clock ---- */}
      <header className="flex items-center justify-between mb-4">
        <span className="text-xs text-sand">
          {t("spyfall.round")} {state.roundNumber} ·{" "}
          {t("spyfall.first_to").replace("{n}", String(state.targetScore))}
        </span>
        {secondsLeft !== null && (
          <span
            className={`chip font-numeric ${
              secondsLeft <= 60 ? "chip-hot" : ""
            }`}
          >
            <Clock size={12} />
            {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, "0")}
          </span>
        )}
      </header>

      {/* ---- Your secret: the biggest thing on screen ---- */}
      {(state.phase === "playing" || state.phase === "voting") && (
        <section className="mb-4">
          <button
            onClick={() => setSecretShown((v) => !v)}
            className={`w-full surface-lit rounded-xl p-6 text-center transition ${
              secretShown ? "" : "hover:bg-surface-raised"
            }`}
            aria-expanded={secretShown}
          >
            {!secretShown ? (
              <>
                <EyeOff size={28} className="mx-auto text-sand mb-2" />
                <p className="font-display text-lg text-cream">
                  {t("spyfall.tap_to_see")}
                </p>
                <p className="text-xs text-sand mt-1">{t("spyfall.keep_it_hidden")}</p>
              </>
            ) : isSpy ? (
              <>
                <Search size={28} className="mx-auto text-ruby mb-2" />
                <p className="font-display text-3xl text-ruby">
                  {t("spyfall.you_are_spy")}
                </p>
                <p className="text-sm text-sand mt-2">{t("spyfall.spy_brief")}</p>
              </>
            ) : (
              <>
                <MapPin size={24} className="mx-auto text-live mb-2" />
                <p className="font-display text-2xl text-cream">
                  {state.locationName?.[lang]}
                </p>
                <p className="text-sm text-gold mt-1">{state.role?.[lang]}</p>
                <p className="text-xs text-sand mt-3">{t("spyfall.innocent_brief")}</p>
              </>
            )}
            {secretShown && (
              <span className="inline-flex items-center gap-1 text-[11px] text-sand mt-4">
                <Eye size={11} />
                {t("spyfall.tap_to_hide")}
              </span>
            )}
          </button>
        </section>
      )}

      {/* ---- Whose question ---- */}
      {state.phase === "playing" && state.askingPlayerId && (
        <p className="text-center text-sm text-sand mb-4">
          {state.askingPlayerId === myPlayerId
            ? t("spyfall.your_question")
            : t("spyfall.their_question").replace(
                "{name}",
                state.seats.find((s) => s.playerId === state.askingPlayerId)?.name ?? "",
              )}
        </p>
      )}

      {/* ---- Vote in progress ---- */}
      {state.phase === "voting" && state.vote && (
        <section className="surface-lit rounded-xl p-5 mb-4 animate-in">
          <div className="text-center mb-4">
            <Gavel size={22} className="mx-auto text-coral mb-2" />
            <p className="font-display text-lg text-cream">
              {t("spyfall.accused")
                .replace("{accuser}", state.vote.accuserName)
                .replace("{target}", state.vote.targetName)}
            </p>
            <p className="text-xs text-sand mt-1">
              {t("spyfall.votes_needed")
                .replace(
                  "{have}",
                  String(state.vote.votes.filter((v) => v.targetId !== "").length),
                )
                .replace("{need}", String(state.vote.needed))}
              {voteSecondsLeft !== null && ` · ${voteSecondsLeft}s`}
            </p>
          </div>

          {iAmAccused ? (
            <p className="text-center text-sm text-ruby">{t("spyfall.youre_accused")}</p>
          ) : iHaveVoted ? (
            <p className="text-center text-sm text-sand">{t("spyfall.vote_cast")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void run(() => spyfallVote(true))}
                className="btn btn-primary"
              >
                <Check size={16} />
                {t("spyfall.agree")}
              </button>
              <button
                onClick={() => void run(() => spyfallVote(false))}
                className="btn btn-ghost"
              >
                <X size={16} />
                {t("spyfall.disagree")}
              </button>
            </div>
          )}

          {/* A spy about to be convicted should be able to go out swinging. */}
          {isSpy && (
            <button
              onClick={() => setGuessOpen(true)}
              className="btn btn-quiet btn-sm w-full mt-3 text-gold"
            >
              {t("spyfall.guess_now")}
            </button>
          )}
        </section>
      )}

      {/* ---- Reveal ---- */}
      {(state.phase === "reveal" || state.phase === "game_over") && state.reveal && (
        <section className="surface-lit rounded-xl p-5 mb-4 animate-in text-center">
          <p className="font-display text-2xl text-cream mb-1">
            {state.reveal.spyWon ? t("spyfall.spy_wins") : t("spyfall.table_wins")}
          </p>
          <p className="text-sm text-sand mb-4">
            {t("spyfall.reveal_line")
              .replace("{spy}", state.reveal.spyName)
              .replace("{place}", state.reveal.locationName[lang])}
          </p>

          {state.reveal.reason === "spy_guessed" && (
            <p className="text-sm text-gold mb-3">
              {state.reveal.spyWon
                ? t("spyfall.guessed_right")
                : t("spyfall.guessed_wrong")}
            </p>
          )}
          {state.reveal.reason === "voted" && state.reveal.accusedName && (
            <p className="text-sm text-sand mb-3">
              {t("spyfall.table_chose").replace("{name}", state.reveal.accusedName)}
            </p>
          )}
          {state.reveal.reason === "timeout" && (
            <p className="text-sm text-sand mb-3">{t("spyfall.ran_out")}</p>
          )}

          {state.reveal.nextRoundAt && (
            <p className="text-xs text-sand">
              {t("spyfall.next_round").replace(
                "{n}",
                String(Math.max(0, Math.ceil((state.reveal.nextRoundAt - now) / 1000))),
              )}
            </p>
          )}
        </section>
      )}

      {/* ---- Players ---- */}
      <section className="surface rounded-xl p-4 mb-4">
        <ul className="space-y-1.5">
          {state.seats.map((seat) => (
            <SeatRow
              key={seat.playerId}
              seat={seat}
              isMe={seat.playerId === myPlayerId}
              isAsking={state.askingPlayerId === seat.playerId}
              canAccuse={
                state.phase === "playing" &&
                seat.playerId !== myPlayerId &&
                !(me?.hasAccused ?? false)
              }
              canPassTo={
                state.phase === "playing" &&
                state.askingPlayerId === myPlayerId &&
                seat.playerId !== myPlayerId
              }
              onAccuse={() => void run(() => spyfallAccuse(seat.playerId))}
              onPass={() => void run(() => spyfallPass(seat.playerId))}
              isWinner={state.winnerId === seat.playerId}
            />
          ))}
        </ul>
        {me?.hasAccused && state.phase === "playing" && (
          <p className="text-[11px] text-sand text-center mt-3">
            {t("spyfall.already_accused")}
          </p>
        )}
      </section>

      {/* ---- Spy's guess ---- */}
      {isSpy && state.phase === "playing" && (
        <button
          onClick={() => setGuessOpen(true)}
          className="btn btn-ghost w-full mb-4 text-gold border-gold/40"
        >
          <MapPin size={16} />
          {t("spyfall.i_know_where")}
        </button>
      )}

      {guessOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in"
          onClick={() => setGuessOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="surface-lit w-full sm:max-w-md rounded-t-xl sm:rounded-xl max-h-[85dvh] flex flex-col"
            style={{ paddingBottom: "var(--safe-b)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border/60">
              <h2 className="font-display text-lg text-cream mb-1">
                {t("spyfall.where_are_you")}
              </h2>
              <p className="text-xs text-sand mb-3">{t("spyfall.guess_warning")}</p>
              <input
                className="field"
                value={guessFilter}
                onChange={(e) => setGuessFilter(e.target.value)}
                placeholder={t("spyfall.filter")}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-3 grid grid-cols-2 gap-2">
              {filteredLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setGuessOpen(false);
                    void run(() => spyfallGuess(loc.id));
                  }}
                  className="btn btn-ghost btn-sm !justify-start text-start !h-auto py-2.5"
                >
                  <span className="truncate">{loc.name[lang]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SeatRow({
  seat,
  isMe,
  isAsking,
  canAccuse,
  canPassTo,
  onAccuse,
  onPass,
  isWinner,
}: {
  seat: SpyfallSeat;
  isMe: boolean;
  isAsking: boolean;
  canAccuse: boolean;
  canPassTo: boolean;
  onAccuse: () => void;
  onPass: () => void;
  isWinner: boolean;
}) {
  const { t } = useLanguage();

  return (
    <li
      className={`flex items-center gap-2 px-3 py-2 rounded-md ${
        isAsking ? "bg-coral/10 border border-coral/30" : "bg-surface-sunken"
      }`}
    >
      {!seat.isConnected && <WifiOff size={12} className="text-ruby shrink-0" />}
      {isWinner && <Crown size={13} className="text-gold shrink-0" />}
      <span className="flex-1 truncate text-sm text-cream">
        {seat.flag ? `${seat.flag} ` : ""}
        {seat.name}
        {isMe && <span className="text-sand text-xs"> ({t("party.you")})</span>}
      </span>
      <span className="font-numeric text-sm text-gold shrink-0">{seat.score}</span>

      {canPassTo && (
        <button onClick={onPass} className="btn btn-quiet btn-sm !min-h-0 !py-1 shrink-0">
          {t("spyfall.ask_them")}
        </button>
      )}
      {canAccuse && (
        <button
          onClick={onAccuse}
          className="btn btn-quiet btn-sm !min-h-0 !py-1 text-ruby shrink-0"
          aria-label={t("spyfall.accuse")}
        >
          <Gavel size={14} />
        </button>
      )}
    </li>
  );
}
