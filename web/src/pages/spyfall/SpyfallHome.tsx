import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Mic, Search, MapPin } from "lucide-react";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { BRAND, getGame, url } from "@/lib/brand";
import { Logo } from "@/components/brand/Logo";
import { LangToggle } from "@/components/LangToggle";

const LS_NAME = `${BRAND.id}_playerName`;

/**
 * Spyfall setup.
 *
 * Two settings only — round length and target score. The game has no board,
 * no variants and no house rules worth surfacing, so a long options list would
 * be inventing decisions for a host to make while five people wait.
 *
 * The one thing this page has to do beyond starting a room is **say clearly
 * that a microphone is required**. Spyfall without voice is not a reduced
 * version of Spyfall, it's nothing — and a group that starts it muted will
 * conclude the game is broken rather than that they are.
 */
export default function SpyfallHome() {
  const navigate = useNavigate();
  const { lang, t } = useLanguage();
  const { createRoom, joinRoom, addToast } = useGame();
  const meta = getGame("spyfall");

  const [name, setName] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [joinCode, setJoinCode] = useState("");
  const [minutes, setMinutes] = useState(8);
  const [targetScore, setTargetScore] = useState(6);
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
        gameId: "spyfall",
        maxPlayers: 8,
        roundSeconds: minutes * 60,
        targetScore,
      });
      remember(trimmed);
      navigate(`/r/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t("spyfall.create_failed"), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const trimmed = name.trim();
    const code = joinCode.trim();
    if (!trimmed || !code) {
      addToast(t("join.name_required"), "error");
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
        title={t("spyfall.seo_title")}
        description={meta?.description[lang] ?? BRAND.description[lang]}
        path="/spyfall"
        lang={lang}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "VideoGame",
          name: meta?.name[lang] ?? "Spyfall",
          url: url("/spyfall"),
          description: meta?.description[lang],
          genre: ["Party", "Social deduction", "Bluffing"],
          playMode: "MultiPlayer",
          gamePlatform: "Web browser",
          numberOfPlayers: { "@type": "QuantitativeValue", minValue: 3, maxValue: 10 },
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

      <div className="text-center mb-6">
        <div className="flex justify-center gap-3 mb-3" aria-hidden>
          <span className="grid place-items-center w-12 h-12 rounded-lg bg-mint/15 text-mint">
            <MapPin size={22} />
          </span>
          <span className="grid place-items-center w-12 h-12 rounded-lg bg-ruby/15 text-ruby">
            <Search size={22} />
          </span>
        </div>
        <h1 className="font-display text-3xl text-cream">{t("spyfall.title")}</h1>
        <p className="text-sm text-sand mt-1">{meta?.blurb[lang]}</p>
      </div>

      {/* Not a nice-to-have. Spyfall without voice isn't a reduced game, it's
          no game — and a group that starts it muted blames the product. */}
      <div className="flex items-start gap-2.5 surface rounded-lg p-3 mb-4 border-mint/30">
        <Mic size={16} className="text-mint mt-0.5 shrink-0" />
        <p className="text-xs text-sand">{t("spyfall.voice_required")}</p>
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
            <fieldset>
              <legend className="text-xs text-sand mb-1.5">{t("spyfall.round_length")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {[5, 8, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMinutes(m)}
                    className={`btn btn-sm ${minutes === m ? "btn-ghost !border-coral !text-coral" : "btn-ghost"}`}
                  >
                    {m} {t("spyfall.min")}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs text-sand mb-1.5">{t("spyfall.play_to")}</legend>
              <div className="grid grid-cols-3 gap-2">
                {[4, 6, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTargetScore(n)}
                    className={`btn btn-sm ${targetScore === n ? "btn-ghost !border-coral !text-coral" : "btn-ghost"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>

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

      <section className="surface rounded-xl p-4 mt-4">
        <h2 className="font-display text-base text-cream mb-2">{t("spyfall.how_title")}</h2>
        <ul className="space-y-2 text-sm text-sand">
          <li>{t("spyfall.how_1")}</li>
          <li>{t("spyfall.how_2")}</li>
          <li>{t("spyfall.how_3")}</li>
          <li>{t("spyfall.how_4")}</li>
        </ul>
      </section>
    </div>
  );
}
