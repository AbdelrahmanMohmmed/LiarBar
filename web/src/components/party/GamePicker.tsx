import { useEffect, useMemo, useState } from "react";
import { Users, Clock, Mic, Bot, Check, X } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { GAMES, COLORS, type GameMeta } from "@/lib/brand";
import type { GameSpecPublic } from "@/lib/types";

/**
 * The game picker a party uses to change what they're playing.
 *
 * Design rule that drives the whole component: **never offer a choice that
 * will fail.** A card for a game the current group can't play is rendered
 * greyed out with the reason written on it ("needs 4 — you're 3"), because a
 * host tapping a game and getting a red error toast is the exact experience
 * that made people give up and go back to WhatsApp. The seat maths comes from
 * the server's own catalogue (`party_catalog`), so the client can't drift from
 * what the server will actually accept.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  /** Currently active game, highlighted as "playing now". */
  currentGameId: string | null;
  onPick: (gameId: string) => void | Promise<void>;
  /** Only the host can actually switch; others browse and can suggest. */
  canPick: boolean;
}

/** Games in the catalogue that have no marketing entry yet still get a card. */
const FALLBACK_META: Record<string, { emoji: string; en: string; ar: string }> = {
  tictactoe: { emoji: "⭕", en: "Tic-Tac-Toe", ar: "إكس أو" },
  snake: { emoji: "🐍", en: "Snake", ar: "الثعبان" },
  tetris: { emoji: "🧱", en: "Tetris", ar: "تتريس" },
  "memory-puzzle": { emoji: "🧠", en: "Memory", ar: "الذاكرة" },
  "space-invaders": { emoji: "👾", en: "Space Invaders", ar: "غزاة الفضاء" },
  fighter: { emoji: "🥊", en: "Fighter", ar: "قتال" },
  "snake-ladder": { emoji: "🪜", en: "Snakes & Ladders", ar: "سلم وثعبان" },
};

export default function GamePicker({
  open,
  onClose,
  currentGameId,
  onPick,
  canPick,
}: Props) {
  const { partyState, gameCatalog, loadGameCatalog, addToast } = useGame();
  const { lang, t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (open && gameCatalog.length === 0) {
      void loadGameCatalog().catch(() => {
        /* The picker falls back to the static catalogue in brand.ts. */
      });
    }
  }, [open, gameCatalog.length, loadGameCatalog]);

  const humans = partyState?.players.filter((p) => !p.isBot).length ?? 0;
  const total = partyState?.players.length ?? 0;

  /**
   * Merge the server's authoritative seat rules with the client's marketing
   * copy. The server is the source of truth for what's playable; brand.ts is
   * the source of truth for what it's called and how it looks.
   */
  const cards = useMemo(() => {
    const specs: GameSpecPublic[] =
      gameCatalog.length > 0
        ? gameCatalog
        : GAMES.map((g) => ({
            id: g.id,
            minPlayers: g.minPlayers,
            maxPlayers: g.maxPlayers,
            seating: "party" as const,
            bots: g.supportsBots,
            voiceMatters: g.voiceMatters,
          }));

    return specs.map((spec) => {
      const meta: GameMeta | undefined = GAMES.find((g) => g.id === spec.id);
      const fb = FALLBACK_META[spec.id];

      // Bots only count as players in games that support them.
      const seats = spec.bots ? total : humans;
      let blocked: string | null = null;
      if (seats < spec.minPlayers) {
        blocked = t("party.needs_n")
          .replace("{n}", String(spec.minPlayers))
          .replace("{have}", String(seats));
      } else if (seats > spec.maxPlayers) {
        blocked = t("party.max_n").replace("{n}", String(spec.maxPlayers));
      }

      return {
        spec,
        meta,
        blocked,
        name: meta ? meta.name[lang] : fb ? fb[lang] : spec.id,
        blurb: meta?.blurb[lang] ?? "",
        emoji: meta?.emoji ?? fb?.emoji ?? "🎲",
        accent: meta ? COLORS[meta.accent] : COLORS.sand,
        minutes: meta?.minutes,
      };
    });
  }, [gameCatalog, humans, total, lang, t]);

  if (!open) return null;

  const handlePick = async (gameId: string, blocked: string | null) => {
    if (blocked) {
      addToast(blocked, "error");
      return;
    }
    if (!canPick) {
      addToast(t("party.host_only"), "info");
      return;
    }
    setBusy(gameId);
    try {
      await onPick(gameId);
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("party.switch_failed"), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("party.pick_game")}
    >
      <div
        className="surface-lit w-full sm:max-w-3xl max-h-[88dvh] overflow-hidden flex flex-col rounded-t-xl sm:rounded-xl"
        style={{ paddingBottom: "var(--safe-b)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — the sheet is bottom-anchored on phones, and a handle
            is the one affordance users already read as "this is draggable/
            dismissible" without a label. */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-pill bg-sand/30" />
        </div>

        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-cream truncate">
              {t("party.pick_game")}
            </h2>
            <p className="text-sm text-sand truncate">
              {t("party.you_are_n").replace("{n}", String(total))}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-quiet btn-sm shrink-0"
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {cards.map((c) => {
              const isCurrent = c.spec.id === currentGameId;
              const disabled = Boolean(c.blocked) || busy !== null;

              return (
                <button
                  key={c.spec.id}
                  onClick={() => handlePick(c.spec.id, c.blocked)}
                  disabled={disabled}
                  className={[
                    "group relative text-start rounded-lg border p-4 transition",
                    "flex flex-col gap-2 min-h-[116px]",
                    c.blocked
                      ? "opacity-45 cursor-not-allowed border-border/50 bg-surface-sunken"
                      : "border-border bg-surface hover:bg-surface-raised active:scale-[0.98]",
                    isCurrent ? "ring-2 ring-offset-0" : "",
                  ].join(" ")}
                  style={isCurrent ? { borderColor: c.accent, boxShadow: `0 0 0 2px ${c.accent}55` } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid place-items-center w-11 h-11 rounded-md text-2xl shrink-0"
                      style={{ background: `${c.accent}1f` }}
                      aria-hidden
                    >
                      {c.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base text-cream truncate">
                          {c.name}
                        </span>
                        {isCurrent && (
                          <span className="chip chip-live shrink-0">
                            <Check size={11} />
                            {t("party.playing_now")}
                          </span>
                        )}
                      </div>
                      {c.blurb && (
                        <p className="text-xs text-sand line-clamp-2 mt-0.5">{c.blurb}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sand">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} />
                      {c.spec.minPlayers}–{c.spec.maxPlayers}
                    </span>
                    {c.minutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {c.minutes[0]}–{c.minutes[1]}m
                      </span>
                    )}
                    {c.spec.bots && (
                      <span className="inline-flex items-center gap-1" title={t("party.bots_ok")}>
                        <Bot size={12} />
                      </span>
                    )}
                    {c.spec.voiceMatters && (
                      <span
                        className="inline-flex items-center gap-1 text-mint"
                        title={t("party.voice_recommended")}
                      >
                        <Mic size={12} />
                      </span>
                    )}
                  </div>

                  {c.blocked && (
                    <span className="absolute inset-x-4 bottom-3 text-[11px] font-bold text-ruby">
                      {c.blocked}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {!canPick && (
            <p className="mt-4 text-center text-xs text-sand">{t("party.host_only")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
