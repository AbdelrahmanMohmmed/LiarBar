import { useState } from "react";
import {
  X,
  SlidersHorizontal,
  Check,
  Crown,
  Sparkles,
  Users,
  Clock,
  Palette,
  Flame,
  Globe,
  Coins,
  Shield,
  Layers,
} from "lucide-react";
import { useLanguage } from "@/lib/languageContext";
import { getGame, gameLabel, gameEmoji, type GameMeta } from "@/lib/brand";

interface Props {
  open: boolean;
  onClose: () => void;
  gameId: string;
  options: Record<string, unknown> | null;
  onUpdate: (options: Record<string, unknown>) => Promise<void> | void;
  canEdit: boolean;
  onStartGame?: () => void;
  canStart?: boolean;
}

export default function GameSettingsDrawer({
  open,
  onClose,
  gameId,
  options,
  onUpdate,
  canEdit,
  onStartGame,
  canStart = false,
}: Props) {
  const { lang, t } = useLanguage();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  if (!open) return null;

  const meta: GameMeta | undefined = getGame(gameId);
  const title = gameLabel(gameId, lang) ?? gameId;
  const emoji = gameEmoji(gameId) ?? "🎲";

  const opt = options ?? {};

  const handleOptionChange = async (
    keyOrUpdates: string | Record<string, unknown>,
    value?: unknown,
  ) => {
    if (!canEdit) return;
    const updates =
      typeof keyOrUpdates === "string"
        ? { [keyOrUpdates]: value }
        : keyOrUpdates;
    setUpdatingKey(typeof keyOrUpdates === "string" ? keyOrUpdates : "batch");
    try {
      const next = {
        ...opt,
        ...updates,
      };
      await onUpdate(next);
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("party.game_settings")}
    >
      <div
        className="surface-lit w-full sm:max-w-xl max-h-[90dvh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl border border-border/80 shadow-2xl animate-scale-in"
        style={{ paddingBottom: "var(--safe-b)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile pull handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-sand/30" />
        </div>

        {/* Header */}
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60 bg-surface-sunken/40">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0" aria-hidden>
              {emoji}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl text-cream truncate">
                  {t("party.game_settings")}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sand/15 text-sand font-medium">
                  {title}
                </span>
              </div>
              <p className="text-xs text-sand truncate">
                {canEdit ? t("party.settings_hint") : t("party.waiting_host")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-quiet btn-sm shrink-0 rounded-full p-2"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </header>

        {/* Body content */}
        <div className="overflow-y-auto px-5 py-5 space-y-6">
          {!canEdit && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30 text-xs text-gold">
              <Crown size={16} className="shrink-0" />
              <span>{t("party.host_only")}</span>
            </div>
          )}

          {/* === DOMINO SETTINGS === */}
          {gameId === "domino" && (
            <div className="space-y-5">
              {/* Game Mode: Solo vs Teams */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                  <Users size={14} className="text-teal" />
                  {t("party.domino_mode")}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleOptionChange("gameMode", "individual")}
                    className={`flex flex-col text-start p-3 rounded-xl border transition-all ${
                      (opt.gameMode ?? "individual") === "individual"
                        ? "bg-teal/15 border-teal text-cream shadow-sm"
                        : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
                    } ${!canEdit ? "cursor-default opacity-85" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-sm text-cream">
                        {t("party.individual")}
                      </span>
                      {(opt.gameMode ?? "individual") === "individual" && (
                        <Check size={16} className="text-teal" />
                      )}
                    </div>
                    <span className="text-xs text-sand/80">
                      {lang === "ar" ? "2 إلى 4 لاعبين (كل لاعب لنفسه)" : "2 to 4 players, free-for-all"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      handleOptionChange({ gameMode: "teams", maxPlayers: 4 });
                    }}
                    className={`flex flex-col text-start p-3 rounded-xl border transition-all ${
                      opt.gameMode === "teams"
                        ? "bg-teal/15 border-teal text-cream shadow-sm"
                        : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
                    } ${!canEdit ? "cursor-default opacity-85" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-sm text-cream">
                        {t("party.teams")}
                      </span>
                      {opt.gameMode === "teams" && (
                        <Check size={16} className="text-teal" />
                      )}
                    </div>
                    <span className="text-xs text-sand/80">
                      {lang === "ar" ? "4 لاعبين (فريق 1 و 3 ضد 2 و 4)" : "Exactly 4 players (Team A vs Team B)"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Target Score */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sand">
                  <span className="flex items-center gap-2">
                    <Flame size={14} className="text-coral" />
                    {t("party.target_score")}
                  </span>
                  <span className="font-numeric text-cream">
                    {Number(opt.targetScore) || 101} {lang === "ar" ? "نقطة" : "pts"}
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[50, 101, 150, 200].map((score) => {
                    const active = (Number(opt.targetScore) || 101) === score;
                    return (
                      <button
                        key={score}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOptionChange("targetScore", score)}
                        className={`py-2 px-2 text-center rounded-lg border font-numeric text-sm transition-all ${
                          active
                            ? "bg-coral/20 border-coral text-cream font-bold shadow-sm"
                            : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
                        } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {score}
                        {score === 101 && (
                          <span className="block text-[10px] text-coral font-sans">
                            {lang === "ar" ? "الشارع" : "Classic"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Turn Timer */}
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-sand">
                  <span className="flex items-center gap-2">
                    <Clock size={14} className="text-gold" />
                    {t("party.turn_timer")}
                  </span>
                  <span className="font-numeric text-cream">
                    {(Number(opt.turnTimeLimit) === 0)
                      ? t("party.unlimited")
                      : `${Number(opt.turnTimeLimit) || 30} ${t("party.seconds")}`}
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 15, label: "15s" },
                    { val: 30, label: "30s" },
                    { val: 60, label: "60s" },
                    { val: 0, label: t("party.unlimited") },
                  ].map(({ val, label }) => {
                    const currentVal = opt.turnTimeLimit !== undefined ? Number(opt.turnTimeLimit) : 30;
                    const active = currentVal === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOptionChange("turnTimeLimit", val)}
                        className={`py-2 px-2 text-center rounded-lg border text-sm transition-all ${
                          active
                            ? "bg-gold/20 border-gold text-cream font-bold shadow-sm"
                            : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
                        } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Karak Bonus toggle */}
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-border/60 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-cream flex items-center gap-1.5">
                    <span>☕</span>
                    <span>{t("party.karak")}</span>
                  </div>
                  <p className="text-xs text-sand/80 mt-0.5">
                    {lang === "ar"
                      ? "لو نزلت دبل في القفلة، نقاط الجولة بتتدبل لفريقك!"
                      : "Playing a double on the domino win doubles your round points!"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => handleOptionChange("karakBonus", !opt.karakBonus)}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    opt.karakBonus ? "bg-coral" : "bg-sand/30"
                  } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      opt.karakBonus ? "translate-x-6 rtl:-translate-x-6" : "translate-x-0.5 rtl:-translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Visual Themes: Felt & Tiles */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                  <Palette size={14} className="text-mint" />
                  {t("party.table_theme")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "green", name: t("party.theme_green"), bg: "#0d3b25" },
                    { id: "slate", name: t("party.theme_slate"), bg: "#1f2937" },
                    { id: "wood", name: t("party.theme_wood"), bg: "#3e1c0d" },
                  ].map((theme) => {
                    const active = (opt.tableTheme ?? "green") === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOptionChange("tableTheme", theme.id)}
                        className={`p-2.5 rounded-lg border text-xs text-center flex flex-col items-center gap-1.5 transition-all ${
                          active
                            ? "border-mint text-cream font-bold shadow-sm"
                            : "border-border/50 text-sand hover:border-sand/40"
                        }`}
                        style={{ background: theme.bg }}
                      >
                        <span className="w-3 h-3 rounded-full border border-white/40 shadow-inner" style={{ background: theme.bg }} />
                        <span className="truncate w-full">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* === CODENAMES SETTINGS === */}
          {gameId === "codenames" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                <Globe size={14} className="text-teal" />
                {t("party.language")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "ar", label: t("party.arabic") },
                  { id: "en", label: t("party.english") },
                ].map((l) => {
                  const active = (opt.language ?? lang) === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleOptionChange("language", l.id)}
                      className={`p-3 rounded-xl border text-center font-bold text-sm transition-all ${
                        active
                          ? "bg-teal/20 border-teal text-cream shadow-sm"
                          : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* === RENTO SETTINGS === */}
          {gameId === "rento" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                  <Coins size={14} className="text-gold" />
                  {t("party.starting_balance")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 1500, 2000].map((amt) => {
                    const active = (Number(opt.startingBalance) || 1500) === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOptionChange("startingBalance", amt)}
                        className={`p-2.5 rounded-lg border font-numeric text-sm transition-all ${
                          active
                            ? "bg-gold/20 border-gold text-cream font-bold shadow-sm"
                            : "bg-surface-sunken border-border/50 text-sand"
                        }`}
                      >
                        ${amt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                  <Clock size={14} className="text-sand" />
                  {t("party.turn_timer")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { ms: 30000, label: "30s" },
                    { ms: 45000, label: "45s" },
                    { ms: 60000, label: "60s" },
                  ].map(({ ms, label }) => {
                    const active = (Number(opt.turnTimer) || 45000) === ms;
                    return (
                      <button
                        key={ms}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOptionChange("turnTimer", ms)}
                        className={`p-2.5 rounded-lg border text-sm transition-all ${
                          active
                            ? "bg-sand/20 border-sand text-cream font-bold shadow-sm"
                            : "bg-surface-sunken border-border/50 text-sand"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* === SPYFALL SETTINGS === */}
          {gameId === "spyfall" && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                <Clock size={14} className="text-coral" />
                {t("party.round_length")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { sec: 300, label: "5 min" },
                  { sec: 480, label: "8 min" },
                  { sec: 600, label: "10 min" },
                ].map(({ sec, label }) => {
                  const active = (Number(opt.roundSeconds) || 480) === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleOptionChange("roundSeconds", sec)}
                      className={`p-2.5 rounded-lg border text-sm transition-all ${
                        active
                          ? "bg-coral/20 border-coral text-cream font-bold shadow-sm"
                          : "bg-surface-sunken border-border/50 text-sand"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* === BLUFF / TABOO SETTINGS === */}
          {(gameId === "bluff" || gameId === "taboo") && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                <Globe size={14} className="text-teal" />
                {t("party.language")}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "ar", label: t("party.arabic") },
                  { id: "en", label: t("party.english") },
                ].map((l) => {
                  const active = (opt.language ?? lang) === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleOptionChange("language", l.id)}
                      className={`p-3 rounded-xl border text-center font-bold text-sm transition-all ${
                        active
                          ? "bg-teal/20 border-teal text-cream shadow-sm"
                          : "bg-surface-sunken border-border/50 text-sand hover:border-sand/40"
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>

              {gameId === "bluff" && (
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                    <Layers size={14} className="text-gold" />
                    {t("party.rounds")}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 5, 7].map((rounds) => {
                      const active = (Number(opt.rounds) || 5) === rounds;
                      return (
                        <button
                          key={rounds}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => handleOptionChange("rounds", rounds)}
                          className={`p-2.5 rounded-lg border font-numeric text-sm transition-all ${
                            active
                              ? "bg-gold/20 border-gold text-cream font-bold shadow-sm"
                              : "bg-surface-sunken border-border/50 text-sand"
                          }`}
                        >
                          {rounds} {lang === "ar" ? "جولات" : "Rounds"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === LIAR'S BAR SETTINGS === */}
          {gameId === "liars-bar" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sand">
                  <Layers size={14} className="text-coral" />
                  {lang === "ar" ? "نوع اللعب" : "Variant"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "cards", label: lang === "ar" ? "كروت" : "Cards" },
                    { id: "dominoes", label: lang === "ar" ? "دومينو" : "Dominoes" },
                  ].map((v) => {
                    const active = (opt.variant ?? "cards") === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleOptionChange("variant", v.id)}
                        className={`p-2.5 rounded-lg border text-sm font-bold transition-all ${
                          active
                            ? "bg-coral/20 border-coral text-cream shadow-sm"
                            : "bg-surface-sunken border-border/50 text-sand"
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-border/60 bg-surface-sunken/40 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="btn btn-ghost flex-1 text-sand"
          >
            {lang === "ar" ? "تم" : "Done"}
          </button>
          {canEdit && onStartGame && (
            <button
              onClick={() => {
                onClose();
                onStartGame();
              }}
              disabled={!canStart}
              className="btn btn-primary flex-1 font-bold shadow-lg shadow-coral/20"
            >
              <Sparkles size={16} />
              {t("party.start")}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
