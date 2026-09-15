import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Users,
  Clock,
  Mic,
  Bot,
  Loader2,
  Link2,
  Zap,
  Trophy,
} from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND, GAMES, COLORS, url, type GameMeta } from "@/lib/brand";
import { Logo } from "@/components/brand/Logo";
import { LangToggle } from "@/components/LangToggle";
import DominoTile from "@/components/domino/DominoTile";

const LS_NAME = `${BRAND.id}_playerName`;

/**
 * The landing page.
 *
 * ## What it is for
 *
 * Almost nobody arrives here. The overwhelming majority of players arrive on
 * `/j/<code>` from a WhatsApp message, having never seen this page and never
 * needing to. This page has exactly two jobs, in order:
 *
 * 1. **Get the one person who did arrive into a room in one tap**, because
 *    they are the host and nothing happens until they act.
 * 2. **Be legible to a search engine**, since it is the only indexable page
 *    with real content.
 *
 * Everything that isn't one of those two things is cut. The previous landing
 * was 1,123 lines including a full illustrated explanation of how to play
 * Liar's Bar — a game-specific tutorial on a multi-game homepage, read by
 * nobody, ranking for nothing, and the first thing a host had to scroll past.
 *
 * ## The one-tap start
 *
 * The primary action creates a party immediately. It deliberately does NOT ask
 * which game first: a host who has to pick a game before they can send the
 * link is a host making a decision on behalf of five people who haven't
 * arrived yet, and if they pick wrong the group used to be stuck with it. Pick
 * the people first, the game second — which is the whole thesis of the party
 * model.
 */
export default function Landing() {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { createRoom, joinRoom, addToast } = useGame();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(LS_NAME) ?? "");
    } catch {
      /* private mode */
    }
  }, []);

  const remember = (value: string) => {
    try {
      localStorage.setItem(LS_NAME, value);
    } catch {
      /* ignore */
    }
  };

  const startParty = async (gameId?: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast(t("join.name_required"), "error");
      document.getElementById("landing-name")?.focus();
      return;
    }
    setBusy("create");
    try {
      const { roomId } = await createRoom({
        playerName: trimmed,
        gameId: gameId ?? "party",
        maxPlayers: 8,
      });
      remember(trimmed);
      navigate(`/r/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("landing.create_failed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    const trimmed = name.trim();
    const roomCode = code.trim();
    if (!roomCode) {
      addToast(t("domino.enter_code"), "error");
      return;
    }
    // With no name yet, hand off to the join page, which shows what's in the
    // room before asking for one — much better than a bare error here.
    if (!trimmed) {
      navigate(`/j/${roomCode}`);
      return;
    }
    setBusy("join");
    try {
      await joinRoom(roomCode, trimmed);
      remember(trimmed);
      navigate(`/r/${roomCode}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("join.failed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const jsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${url("/")}#website`,
        url: url("/"),
        name: BRAND.name,
        description: BRAND.description[lang],
        inLanguage: ["en", "ar"],
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Games on ${BRAND.name}`,
        itemListElement: GAMES.map((game, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "VideoGame",
            name: game.name[lang],
            url: url(game.path),
            description: game.description[lang],
            playMode: "MultiPlayer",
            gamePlatform: "Web browser",
            applicationCategory: "Game",
            numberOfPlayers: {
              "@type": "QuantitativeValue",
              minValue: game.minPlayers,
              maxValue: game.maxPlayers,
            },
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        })),
      },
    ],
    [lang],
  );

  return (
    <div className="page max-w-3xl mx-auto pb-16">
      <Seo
        title={`${BRAND.name} — ${BRAND.tagline[lang]}`}
        description={BRAND.description[lang]}
        path="/"
        lang={lang}
        jsonLd={jsonLd}
      />

      <header className="flex items-center justify-between mb-10">
        <Logo size={30} animated />
        <LangToggle />
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="text-center mb-8">
        <h1 className="font-display text-4xl sm:text-5xl text-cream leading-tight">
          {BRAND.tagline[lang]}
        </h1>
        <p className="text-base text-sand mt-3 max-w-md mx-auto">
          {/* The count comes from the catalogue rather than the copy. Both
              languages had a hard-coded number in this sentence, both were
              already wrong by one, and the first line of the landing page is
              the worst place in the product to be caught overclaiming. */}
          {t("landing.hero_sub").replace("{n}", String(GAMES.length))}
        </p>
      </section>

      {/* ---------------- Start ---------------- */}
      <section className="surface-lit rounded-xl p-5 mb-8">
        <label htmlFor="landing-name" className="block mb-3">
          <span className="block text-xs text-sand mb-1.5">{t("join.your_name")}</span>
          <input
            id="landing-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("join.name_placeholder")}
            maxLength={24}
            autoComplete="nickname"
          />
        </label>

        <button
          onClick={() => void startParty()}
          disabled={busy !== null}
          className="btn btn-primary btn-lg w-full mb-3"
        >
          {busy === "create" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              {t("landing.start_party")}
              <ArrowRight size={18} className="rtl:-scale-x-100" />
            </>
          )}
        </button>

        <div className="flex items-center gap-2">
          <input
            className="field font-numeric text-center"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={t("landing.code_placeholder")}
            inputMode="numeric"
            aria-label={t("party.room_code")}
          />
          <button
            onClick={() => void join()}
            disabled={busy !== null || !code.trim()}
            className="btn btn-ghost shrink-0"
          >
            {busy === "join" ? <Loader2 size={16} className="animate-spin" /> : t("join.join")}
          </button>
        </div>

        <p className="text-[11px] text-sand text-center mt-3">
          {t("landing.no_signup")}
        </p>
      </section>

      {/* ---------------- Why ---------------- */}
      {/* Three claims, each one a thing the product actually does that the
          alternatives don't. No feature grid of things every website has. */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
        <Pitch
          icon={<Link2 size={18} />}
          title={t("landing.why_1_t")}
          body={t("landing.why_1_b")}
          color={COLORS.coral}
        />
        <Pitch
          icon={<Mic size={18} />}
          title={t("landing.why_2_t")}
          body={t("landing.why_2_b")}
          color={COLORS.mint}
        />
        <Pitch
          icon={<Zap size={18} />}
          title={t("landing.why_3_t")}
          body={t("landing.why_3_b")}
          color={COLORS.gold}
        />
      </section>

      {/* ---------------- Games ---------------- */}
      <section className="mb-10">
        <h2 className="font-display text-2xl text-cream mb-1">{t("landing.games_title")}</h2>
        <p className="text-sm text-sand mb-4">{t("landing.games_sub")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GAMES.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={() => void startParty(game.id)}
              busy={busy !== null}
            />
          ))}
        </div>
      </section>

      {/* ---------------- How ---------------- */}
      {/* Kept because it is the page's only substantial indexable text, and
          because the model (one room, many games) is unusual enough that a
          first-time visitor genuinely needs it explained once. */}
      <section className="surface rounded-xl p-5 mb-10">
        <h2 className="font-display text-xl text-cream mb-4">{t("landing.how_title")}</h2>
        <ol className="space-y-4">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex gap-3">
              <span className="font-numeric text-xl text-coral shrink-0 w-6">{n}</span>
              <span>
                <span className="block text-sm font-bold text-cream">
                  {t(`landing.how_${n}_t`)}
                </span>
                <span className="block text-sm text-sand">{t(`landing.how_${n}_b`)}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="text-center">
        <div className="flex justify-center gap-1.5 mb-4 opacity-40" aria-hidden>
          {[
            [6, 6],
            [6, 2],
            [2, 0],
          ].map(([l, r], i) => (
            <DominoTile key={i} left={l} right={r} size={34} />
          ))}
        </div>
        <p className="text-xs text-sand">
          {BRAND.name} · {BRAND.subTagline[lang]}
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Pitch({
  icon,
  title,
  body,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  color: string;
}) {
  return (
    <div className="surface rounded-lg p-4">
      <span
        className="grid place-items-center w-9 h-9 rounded-md mb-2.5"
        style={{ background: `${color}22`, color }}
      >
        {icon}
      </span>
      <h3 className="text-sm font-bold text-cream mb-1">{title}</h3>
      <p className="text-xs text-sand leading-relaxed">{body}</p>
    </div>
  );
}

function GameCard({
  game,
  onPlay,
  busy,
}: {
  game: GameMeta;
  onPlay: () => void;
  busy: boolean;
}) {
  const { lang, t } = useLanguage();
  const accent = COLORS[game.accent];

  return (
    <article className="surface rounded-lg p-4 flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <span
          className="grid place-items-center w-12 h-12 rounded-md text-2xl shrink-0"
          style={{ background: `${accent}1f` }}
          aria-hidden
        >
          {game.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-cream truncate">
            {game.name[lang]}
          </h3>
          <p className="text-xs text-sand line-clamp-2">{game.blurb[lang]}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sand">
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          {game.minPlayers}–{game.maxPlayers}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} />
          {game.minutes[0]}–{game.minutes[1]}m
        </span>
        {game.supportsBots && (
          <span className="inline-flex items-center gap-1" title={t("party.bots_ok")}>
            <Bot size={12} />
          </span>
        )}
        {game.voiceMatters && (
          <span
            className="inline-flex items-center gap-1 text-live"
            title={t("party.voice_recommended")}
          >
            <Mic size={12} />
          </span>
        )}
      </div>

      {/* Starting a game from a card still creates a PARTY with that game
          staged, not a single-game room — so the group can switch later
          without anyone re-sending a link. */}
      <button
        onClick={onPlay}
        disabled={busy}
        className="btn btn-ghost btn-sm mt-auto w-full"
      >
        <Trophy size={14} />
        {t("landing.play_this")}
      </button>
    </article>
  );
}
