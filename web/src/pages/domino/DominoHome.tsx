import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Users, Loader2, Sparkles } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND, getGame, url } from "@/lib/brand";
import { Logo } from "@/components/brand/Logo";
import { LangToggle } from "@/components/LangToggle";
import DominoTile from "@/components/domino/DominoTile";

const LS_NAME = `${BRAND.id}_playerName`;

/**
 * Domino setup.
 *
 * Rewritten against the design system. The previous version was a 374-line
 * page with a hard-coded cream-and-black palette of its own, which meant it
 * looked like a different product from every other page, ignored the theme
 * tokens entirely, and — because its layout was built from fixed widths —
 * rendered as two overlapping columns at 375px, the width most of its users
 * are on.
 *
 * The settings here are deliberately few. Every option on a setup screen is a
 * decision a host has to make before anyone can play, while five people wait,
 * and most of them have a right answer. Mode, seats and the karak house rule
 * are genuine choices. Target score and turn timer have sensible defaults and
 * live behind a disclosure.
 */
export default function DominoHome() {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { createRoom, joinRoom, addToast } = useGame();

  const meta = getGame("domino");

  const [name, setName] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<"individual" | "teams">("individual");
  const [seats, setSeats] = useState(4);
  const [karak, setKarak] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [targetScore, setTargetScore] = useState(101);
  const [turnSeconds, setTurnSeconds] = useState(30);

  useEffect(() => {
    try {
      setName(localStorage.getItem(LS_NAME) ?? "");
    } catch {
      /* private mode */
    }
  }, []);

  // Team play is four seats by definition. Rather than letting the host pick
  // an invalid combination and rejecting it on submit, the seat control simply
  // follows the mode.
  useEffect(() => {
    if (mode === "teams") setSeats(4);
  }, [mode]);

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
        gameId: "domino",
        maxPlayers: seats,
        gameMode: mode,
        targetScore,
        turnTimeLimit: turnSeconds,
        karakBonus: karak,
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
        title={t("domino.seo_title")}
        description={meta?.description[lang] ?? BRAND.description[lang]}
        path="/domino"
        lang={lang}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "VideoGame",
          name: meta?.name[lang] ?? "Domino",
          url: url("/domino"),
          description: meta?.description[lang],
          genre: ["Party", "Tile game", "Strategy"],
          playMode: "MultiPlayer",
          gamePlatform: "Web browser",
          numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 4 },
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

      {/* A row of real tiles instead of a hero image: it costs nothing, it
          renders identically in both themes, and it tells you what the game is
          faster than any headline. */}
      <div className="flex justify-center gap-1.5 mb-4" aria-hidden>
        {[
          [6, 6],
          [6, 3],
          [3, 0],
        ].map(([l, r], i) => (
          <DominoTile
            key={i}
            left={l}
            right={r}
            size={56}
            className="drop-in"
            orientation="vertical"
          />
        ))}
      </div>

      <div className="text-center mb-6">
        <h1 className="font-display text-3xl text-cream">{t("domino.title")}</h1>
        <p className="text-sm text-sand mt-1">{meta?.blurb[lang]}</p>
      </div>

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
            <label className="block">
              <span className="block text-xs text-sand mb-1.5">{t("party.room_code")}</span>
              <input
                className="field font-numeric text-center text-xl"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
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
            <fieldset>
              <legend className="text-xs text-sand mb-1.5">{t("domino.mode")}</legend>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("individual")}
                  className={`btn btn-sm ${mode === "individual" ? "btn-ghost !border-coral !text-coral" : "btn-ghost"}`}
                >
                  {t("domino.mode_solo")}
                </button>
                <button
                  onClick={() => setMode("teams")}
                  className={`btn btn-sm ${mode === "teams" ? "btn-ghost !border-coral !text-coral" : "btn-ghost"}`}
                >
                  {t("domino.mode_teams")}
                </button>
              </div>
              <p className="text-[11px] text-sand mt-1.5">
                {mode === "teams" ? t("domino.mode_teams_hint") : t("domino.mode_solo_hint")}
              </p>
            </fieldset>

            <fieldset>
              <legend className="text-xs text-sand mb-1.5">
                <Users size={12} className="inline me-1" />
                {t("domino.seats")}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSeats(n)}
                    disabled={mode === "teams" && n !== 4}
                    className={`btn btn-sm ${seats === n ? "btn-ghost !border-coral !text-coral" : "btn-ghost"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {seats === 4 && (
                <p className="text-[11px] text-sand mt-1.5">{t("domino.four_hint")}</p>
              )}
            </fieldset>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={karak}
                onChange={(e) => setKarak(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-[hsl(var(--coral))]"
              />
              <span>
                <span className="text-sm text-cream inline-flex items-center gap-1.5">
                  <Sparkles size={13} className="text-gold" />
                  {t("domino.karak_label")}
                </span>
                <span className="block text-[11px] text-sand">
                  {t("domino.karak_hint")}
                </span>
              </span>
            </label>

            <div>
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="btn btn-quiet btn-sm w-full justify-between"
                aria-expanded={showAdvanced}
              >
                {t("domino.more_options")}
                <span className="text-sand">{showAdvanced ? "−" : "+"}</span>
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-3 mt-3 animate-in">
                  <label className="block">
                    <span className="block text-xs text-sand mb-1.5">
                      {t("domino.target_score")}
                    </span>
                    <select
                      className="field"
                      value={targetScore}
                      onChange={(e) => setTargetScore(Number(e.target.value))}
                    >
                      <option value={51}>51</option>
                      <option value={101}>101</option>
                      <option value={151}>151</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs text-sand mb-1.5">
                      {t("domino.turn_timer")}
                    </span>
                    <select
                      className="field"
                      value={turnSeconds}
                      onChange={(e) => setTurnSeconds(Number(e.target.value))}
                    >
                      <option value={0}>{t("domino.no_timer")}</option>
                      <option value={15}>15s</option>
                      <option value={30}>30s</option>
                      <option value={60}>60s</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

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

      {/* Rules, inline. Nobody reads a rules modal, and half the audience plays
          a house variant — saying exactly which rules these are up front
          prevents the "that's not how you play" argument at round three. */}
      <section className="surface rounded-xl p-4 mt-4">
        <h2 className="font-display text-base text-cream mb-2">{t("domino.how_title")}</h2>
        <ul className="space-y-2 text-sm text-sand">
          <li>{t("domino.how_1")}</li>
          <li>{t("domino.how_2")}</li>
          <li>{t("domino.how_3")}</li>
          <li>{t("domino.how_4")}</li>
        </ul>
      </section>
    </div>
  );
}
