import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Play } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { gameLabel } from "@/lib/brand";
import { gameRoute } from "@/components/party/PartyRouter";

/**
 * The settings page for a game staged in a party.
 *
 * The controls here are the ones each game's own setup route offers — Domino's
 * mode, target and karak rule; Codenames' word language; Spyfall's round length
 * and target; Liar's Bar's variant and deck — copied over rather than invented,
 * so a host who has set up that game before recognises every choice. The
 * difference is where they land: these write to the party's staged options
 * (`party_update_options`) instead of creating a room, and they apply when the
 * host starts the game.
 *
 * Rento has its own page at /rento/settings; everything else routes here.
 *
 * Route: /r/:roomId/settings/:gameId. Only the host can change anything.
 */

interface ChipOption {
  value: string | number;
  label: string;
}

function Chips({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string | number | undefined;
  options: ChipOption[];
  onChange: (value: string | number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-sand">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`py-2 px-4 rounded-lg border text-sm transition-all ${
                active
                  ? "bg-teal/20 border-teal text-cream font-bold shadow-sm"
                  : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
              } ${disabled ? "cursor-default opacity-80" : "cursor-pointer"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-surface-sunken border border-border/60 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-bold text-cream">{label}</div>
        {hint && <p className="text-xs text-sand/80 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? "bg-coral" : "bg-sand/30"
        } ${disabled ? "cursor-default" : "cursor-pointer"}`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white transition-transform ${
            checked
              ? "translate-x-6 rtl:-translate-x-6"
              : "translate-x-0.5 rtl:-translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function GameSettingsPage() {
  const { roomId = "", gameId: routeGameId = "" } = useParams<{
    roomId: string;
    gameId: string;
  }>();
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const isAr = lang === "ar";
  const {
    partyState,
    myPlayerId,
    reconnectRoom,
    partyUpdateOptions,
    codenamesSetLanguage,
    startGame,
    addToast,
  } = useGame();

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

  const back = () => navigate(`/r/${roomId}`);

  if (!partyState || partyState.roomId !== roomId) {
    return (
      <div className="page max-w-2xl mx-auto">
        <div className="skeleton h-11 w-40 rounded-lg mb-4" />
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    );
  }

  // The room wins over the URL: if the host switched games elsewhere, editing
  // the URL's game would send options for a game that is no longer staged.
  const gameId = partyState.activeGameId ?? routeGameId;
  const me = partyState.players.find((p) => p.id === myPlayerId);
  const isHost = Boolean(me?.isHost);
  const gameName = gameLabel(gameId, lang) ?? gameId;
  const opt = (partyState.activeOptions as Record<string, unknown> | null) ?? {};
  const seats = partyState.players.length;

  const apply = (patch: Record<string, unknown>) => {
    if (!isHost) return;
    partyUpdateOptions(patch).catch((err) =>
      addToast(
        err instanceof Error
          ? err.message
          : isAr
            ? "تعذر حفظ الإعدادات"
            : "Could not save settings",
        "error",
      ),
    );
  };

  const setLanguage = (code: "ar" | "en") => {
    if (!isHost) return;
    // Codenames' language can change in the lobby without losing team picks;
    // every other game just takes it as an option.
    if (gameId === "codenames") {
      codenamesSetLanguage(code).catch((err) =>
        addToast(
          err instanceof Error
            ? err.message
            : isAr
              ? "تعذر تغيير اللغة"
              : "Could not change the language",
          "error",
        ),
      );
      return;
    }
    apply({ language: code });
  };

  const handleStart = async () => {
    try {
      await startGame();
      navigate(gameRoute(gameId, roomId));
    } catch (err) {
      addToast(
        err instanceof Error
          ? err.message
          : isAr
            ? "تعذر بدء اللعبة"
            : "Could not start the game",
        "error",
      );
    }
  };

  const options = (() => {
    switch (gameId) {
      case "domino": {
        const mode = String(opt.gameMode ?? "individual");
        return (
          <>
            <Chips
              label={isAr ? "نوع اللعب" : "Game mode"}
              value={mode}
              disabled={!isHost}
              onChange={(v) =>
                apply(
                  v === "teams"
                    ? { gameMode: "teams", maxPlayers: 4 }
                    : { gameMode: "individual" },
                )
              }
              options={[
                { value: "individual", label: isAr ? "فردي" : "Solo" },
                {
                  value: "teams",
                  label: isAr ? "فرق (2 ضد 2)" : "Teams (2v2)",
                },
              ]}
            />
            {mode === "teams" && seats !== 4 && (
              <p className="text-xs text-coral">
                {isAr
                  ? "وضع الفرق محتاج ٤ لاعبين بالظبط."
                  : "Team mode needs exactly 4 players."}
              </p>
            )}
            <Chips
              label={isAr ? "الفورة من" : "Target score"}
              value={Number(opt.targetScore ?? 101)}
              disabled={!isHost}
              onChange={(v) => apply({ targetScore: Number(v) })}
              options={[51, 101, 151].map((n) => ({
                value: n,
                label: String(n),
              }))}
            />
            <Chips
              label={isAr ? "وقت الدور" : "Turn timer"}
              value={
                opt.turnTimeLimit !== undefined
                  ? Number(opt.turnTimeLimit)
                  : 30
              }
              disabled={!isHost}
              onChange={(v) => apply({ turnTimeLimit: Number(v) })}
              options={[
                { value: 0, label: isAr ? "مفتوح" : "No limit" },
                { value: 15, label: "15s" },
                { value: 30, label: "30s" },
                { value: 60, label: "60s" },
              ]}
            />
            <Toggle
              label={isAr ? "بونص الكرك ☕" : "Karak bonus ☕"}
              hint={
                isAr
                  ? "الدبل في القفلة بيضاعف نقاط الجولة."
                  : "A double on the closing tile doubles the round points."
              }
              checked={Boolean(opt.karakBonus)}
              disabled={!isHost}
              onChange={(next) => apply({ karakBonus: next })}
            />
          </>
        );
      }

      case "codenames":
        return (
          <Chips
            label={isAr ? "لغة الكلمات" : "Word language"}
            value={String(opt.language ?? lang)}
            disabled={!isHost}
            onChange={(v) => setLanguage(v as "ar" | "en")}
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        );

      case "spyfall":
        return (
          <>
            <Chips
              label={isAr ? "مدة الجولة" : "Round length"}
              value={Number(opt.roundSeconds ?? 480)}
              disabled={!isHost}
              onChange={(v) => apply({ roundSeconds: Number(v) })}
              options={[
                { value: 300, label: isAr ? "٥ دقايق" : "5 min" },
                { value: 480, label: isAr ? "٨ دقايق" : "8 min" },
                { value: 720, label: isAr ? "١٢ دقيقة" : "12 min" },
              ]}
            />
            <Chips
              label={isAr ? "اللعب لحد" : "Play to"}
              value={Number(opt.targetScore ?? 6)}
              disabled={!isHost}
              onChange={(v) => apply({ targetScore: Number(v) })}
              options={[4, 6, 10].map((n) => ({
                value: n,
                label: String(n),
              }))}
            />
          </>
        );

      case "chameleon":
        return (
          <Chips
            label={isAr ? "اللعب لحد" : "Play to"}
            value={Number(opt.targetScore ?? 8)}
            disabled={!isHost}
            onChange={(v) => apply({ targetScore: Number(v) })}
            options={[6, 8, 12].map((n) => ({ value: n, label: String(n) }))}
          />
        );

      case "taboo":
        return (
          <>
            <Chips
              label={isAr ? "اللعب لحد" : "Play to"}
              value={Number(opt.targetScore ?? 15)}
              disabled={!isHost}
              onChange={(v) => apply({ targetScore: Number(v) })}
              options={[10, 15, 25].map((n) => ({
                value: n,
                label: String(n),
              }))}
            />
            <Chips
              label={isAr ? "لغة الكلمات" : "Word language"}
              value={String(opt.language ?? lang)}
              disabled={!isHost}
              onChange={(v) => setLanguage(v as "ar" | "en")}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
          </>
        );

      case "bluff":
        return (
          <>
            <Chips
              label={isAr ? "عدد الجولات" : "Rounds"}
              value={Number(opt.rounds ?? 5)}
              disabled={!isHost}
              onChange={(v) => apply({ rounds: Number(v) })}
              options={[3, 5, 8].map((n) => ({ value: n, label: String(n) }))}
            />
            <Chips
              label={isAr ? "لغة الكلمات" : "Word language"}
              value={String(opt.language ?? lang)}
              disabled={!isHost}
              onChange={(v) => setLanguage(v as "ar" | "en")}
              options={[
                { value: "ar", label: "العربية" },
                { value: "en", label: "English" },
              ]}
            />
          </>
        );

      case "wyr":
        return (
          <Chips
            label={isAr ? "اللعب لحد" : "Play to"}
            value={Number(opt.targetScore ?? 10)}
            disabled={!isHost}
            onChange={(v) => apply({ targetScore: Number(v) })}
            options={[7, 10, 15].map((n) => ({ value: n, label: String(n) }))}
          />
        );

      case "liars-bar":
        return (
          <>
            <Chips
              label={isAr ? "نوع اللعب" : "Variant"}
              value={String(opt.variant ?? "cards")}
              disabled={!isHost}
              onChange={(v) => apply({ variant: v })}
              options={[
                { value: "cards", label: isAr ? "كروت" : "Cards" },
                { value: "dominoes", label: isAr ? "دومينو" : "Dominoes" },
              ]}
            />
            <Chips
              label={isAr ? "عدد الكروت" : "Deck count"}
              value={Number(opt.deckCount ?? 1)}
              disabled={!isHost}
              onChange={(v) => apply({ deckCount: Number(v) })}
              options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
            />
            <Chips
              label={isAr ? "نوع الدعوى" : "Claim type"}
              value={String(opt.claimType ?? "suit")}
              disabled={!isHost}
              onChange={(v) => apply({ claimType: v })}
              options={[
                { value: "suit", label: isAr ? "لون" : "Suit" },
                { value: "rank", label: isAr ? "رقم" : "Rank" },
              ]}
            />
            <Chips
              label={isAr ? "وقت الشك" : "Challenge mode"}
              value={String(opt.challengeMode ?? "timer")}
              disabled={!isHost}
              onChange={(v) => apply({ challengeMode: v })}
              options={[
                { value: "timer", label: isAr ? "مؤقت" : "Timer" },
                { value: "vote", label: isAr ? "تصويت" : "Vote" },
              ]}
            />
          </>
        );

      default:
        return (
          <p className="text-sm text-sand">
            {isAr
              ? "اللعبة دي ملهاش إعدادات غير عدد اللاعبين، واللي بيتحدد من الغرفة."
              : "This game has no options beyond the player count, which the room already sets."}
          </p>
        );
    }
  })();

  return (
    <div className="page max-w-2xl mx-auto pb-24">
      <header className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={back}
          className="btn btn-quiet btn-sm rounded-full p-2 shrink-0"
          aria-label={isAr ? "رجوع" : "Back"}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl text-cream truncate">
            {t("party.game_settings")}
          </h1>
          <p className="text-xs text-sand truncate">{gameName}</p>
        </div>
        {isHost && (
          <span className="chip chip-live shrink-0">
            <Crown size={12} />
            {isAr ? "المضيف" : "Host"}
          </span>
        )}
      </header>

      <div className="surface-lit rounded-2xl border border-border/80 p-5 space-y-5">
        {!isHost && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30 text-xs text-gold">
            <Crown size={16} className="shrink-0" />
            <span>{t("party.host_only")}</span>
          </div>
        )}

        {options}

        <p className="text-xs text-sand/80 pt-1 border-t border-border/40">
          {isAr
            ? "التغيير بيطبق لما اللعبة تبدأ."
            : "Changes apply when the game starts."}
        </p>
      </div>

      {isHost && (
        <button
          onClick={handleStart}
          disabled={seats < 2}
          className="btn btn-primary btn-lg w-full mt-4"
        >
          <Play size={18} />
          {t("party.start")}
        </button>
      )}
    </div>
  );
}
