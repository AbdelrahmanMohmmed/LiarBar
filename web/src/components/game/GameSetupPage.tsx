import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Mic } from "lucide-react";
import { useGame, type CreateRoomInput } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND, getGame, url } from "@/lib/brand";
import { Logo } from "@/components/brand/Logo";
import { LangToggle } from "@/components/LangToggle";

const LS_NAME = `${BRAND.id}_playerName`;

/**
 * The shared setup page: name, create-or-join, a few options, and the rules.
 *
 * Every game's setup screen was doing the same nine things — remembering the
 * player's name, validating it, switching between create and join, calling
 * createRoom, navigating to the party, emitting the right JSON-LD — plus two
 * or three genuinely game-specific choices. Copying that per game is how the
 * old domino page ended up with its own colour palette and its own broken
 * mobile layout: divergence accumulates in the parts nobody meant to change.
 *
 * Game-specific settings go in `options`, which is rendered between the tabs
 * and the create button. A game that wants something unusual passes a node;
 * a game with no settings passes nothing and gets a one-field page.
 */

export interface OptionChoice<T> {
  value: T;
  label: string;
  hint?: string;
}

/** A row of segmented buttons — the only option control most games need. */
export function OptionRow<T extends string | number>({
  legend,
  value,
  choices,
  onChange,
  hint,
}: {
  legend: string;
  value: T;
  choices: Array<OptionChoice<T>>;
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="text-xs text-sand mb-1.5">{legend}</legend>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(choices.length, 3)}, 1fr)` }}
      >
        {choices.map((choice) => (
          <button
            key={String(choice.value)}
            type="button"
            onClick={() => onChange(choice.value)}
            className={`btn btn-sm ${
              value === choice.value ? "btn-ghost !border-coral !text-coral" : "btn-ghost"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-[11px] text-sand mt-1.5">{hint}</p>}
    </fieldset>
  );
}

interface Props {
  /** Must match a `GAMES` entry in brand.ts and a server gameId. */
  gameId: string;
  /** Page title, usually `t("<game>.seo_title")`. */
  seoTitle: string;
  /** Hero artwork or icons. Rendered above the name. */
  hero?: ReactNode;
  /** Game-specific settings, shown only on the create tab. */
  options?: ReactNode;
  /** Everything the server needs beyond playerName/gameId. */
  buildInput: () => Omit<CreateRoomInput, "playerName" | "gameId">;
  /** Four short rule lines. */
  rules: string[];
  rulesTitle: string;
  /** Shown as a prominent note when the game genuinely needs a microphone. */
  voiceNote?: string;
  /** Structured-data genres. */
  genres?: string[];
}

export default function GameSetupPage({
  gameId,
  seoTitle,
  hero,
  options,
  buildInput,
  rules,
  rulesTitle,
  voiceNote,
  genres = ["Party"],
}: Props) {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { createRoom, joinRoom, addToast } = useGame();
  const meta = getGame(gameId);

  const [name, setName] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

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

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast(t("join.name_required"), "error");
      return;
    }
    setBusy(true);
    try {
      const { roomId } = await createRoom({
        playerName: trimmed,
        gameId,
        ...buildInput(),
      });
      remember(trimmed);
      navigate(`/r/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("domino.create_failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const trimmed = name.trim();
    const code = joinCode.trim();
    if (!trimmed) {
      addToast(t("join.name_required"), "error");
      return;
    }
    if (!code) {
      addToast(t("domino.enter_code"), "error");
      return;
    }
    setBusy(true);
    try {
      await joinRoom(code, trimmed);
      remember(trimmed);
      navigate(`/r/${code}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("join.failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page max-w-lg mx-auto pb-24">
      <Seo
        title={seoTitle}
        description={meta?.description[lang] ?? BRAND.description[lang]}
        path={meta?.path ?? `/${gameId}`}
        lang={lang}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "VideoGame",
          name: meta?.name[lang] ?? gameId,
          url: url(meta?.path ?? `/${gameId}`),
          description: meta?.description[lang],
          genre: genres,
          playMode: "MultiPlayer",
          gamePlatform: "Web browser",
          numberOfPlayers: {
            "@type": "QuantitativeValue",
            minValue: meta?.minPlayers ?? 2,
            maxValue: meta?.maxPlayers ?? 8,
          },
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />

      <header className="flex items-center justify-between gap-2 mb-6">
        <button onClick={() => navigate("/")} className="btn btn-quiet btn-sm">
          <ArrowLeft size={16} className="rtl:-scale-x-100" />
          <Logo size={22} markOnly />
        </button>
        <LangToggle />
      </header>

      {hero && <div className="flex justify-center mb-4">{hero}</div>}

      <div className="text-center mb-6">
        <h1 className="font-display text-3xl text-cream">{meta?.name[lang] ?? gameId}</h1>
        <p className="text-sm text-sand mt-1">{meta?.blurb[lang]}</p>
      </div>

      {voiceNote && (
        <div className="flex items-start gap-2.5 surface rounded-lg p-3 mb-4 border-mint/30">
          <Mic size={16} className="text-mint mt-0.5 shrink-0" />
          <p className="text-xs text-sand">{voiceNote}</p>
        </div>
      )}

      <div className="surface-lit rounded-xl p-5">
        <label className="block mb-4">
          <span className="block text-xs text-sand mb-1.5">{t("join.your_name")}</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("join.name_placeholder")}
            maxLength={24}
            autoComplete="nickname"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setTab("create")}
            className={`btn ${tab === "create" ? "btn-primary" : "btn-ghost"}`}
          >
            {t("domino.create_room")}
          </button>
          <button
            onClick={() => setTab("join")}
            className={`btn ${tab === "join" ? "btn-primary" : "btn-ghost"}`}
          >
            {t("domino.join_room")}
          </button>
        </div>

        {tab === "join" ? (
          <div className="space-y-3">
            <input
              className="field font-numeric text-center text-xl"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="123456"
              inputMode="numeric"
              aria-label={t("party.room_code")}
            />
            <button
              onClick={handleJoin}
              disabled={busy || !name.trim() || !joinCode.trim()}
              className="btn btn-primary btn-lg w-full"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : t("join.join")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {options}
            <button
              onClick={handleCreate}
              disabled={busy || !name.trim()}
              className="btn btn-primary btn-lg w-full"
            >
              {busy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {t("domino.create_room")}
                  <ArrowRight size={18} className="rtl:-scale-x-100" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Rules inline, not behind a modal. Nobody opens a rules modal, and for
          games with regional variants, saying which rules these are up front
          prevents the "that's not how you play" argument at round three. */}
      <section className="surface rounded-xl p-4 mt-4">
        <h2 className="font-display text-base text-cream mb-2">{rulesTitle}</h2>
        <ul className="space-y-2 text-sm text-sand">
          {rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
