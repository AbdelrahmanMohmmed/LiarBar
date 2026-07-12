import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { GuideModal } from "@/components/GuideModal";
import { ThemeSelector } from "@/components/ThemeSelector";
import { useTheme } from "@/lib/themeContext";
import { COLORS, uiFont } from "./theme";
import { Panel, Field, inputStyle, PrimaryButton, TabButton, PillToggle } from "./ui";
import { Swords, Users, Gamepad2, Dice1, LogIn, HelpCircle, ArrowLeft, ChevronDown, SlidersHorizontal, Globe } from "lucide-react";
import type { GameVariant, ClaimType, ChallengeMode } from "@/lib/types";
import { isFirebaseConfigured, signInWithGoogle, onAuthChange } from "@/lib/firebase";

export default function Index() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, addToast } = useGame();
  const { t, lang, toggleLang } = useLanguage();
  const { theme } = useTheme();

  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [playerName, setPlayerName] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [variant, setVariant] = useState<GameVariant>("cards");
  const [claimType, setClaimType] = useState<ClaimType>("suit");
  const [revealTime, setRevealTime] = useState("5");
  const [deckCount, setDeckCount] = useState("2");
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>("timer");
  const [challengeDuration, setChallengeDuration] = useState("5");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; photo?: string } | null>(null);
  const [tab, setTab] = useState<"create" | "join">("create");

  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsub = onAuthChange((user) => {
        if (user) {
          setGoogleUser({ name: user.displayName || "Player", photo: user.photoURL || undefined });
          setPlayerName(user.displayName || "");
        } else {
          setGoogleUser(null);
        }
      });
      return unsub;
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      addToast("Google Sign-In is not configured. Set up Firebase first.", "error");
      return;
    }
    const user = await signInWithGoogle();
    if (!user) {
      addToast("Google sign-in failed or was cancelled", "error");
    }
  }, [addToast]);

  const handleCreate = useCallback(async () => {
    if (!playerName.trim()) {
      addToast("Enter your name first", "error");
      return;
    }
    setIsLoading(true);
    try {
      const { roomId } = await createRoom(
        playerName.trim(),
        parseInt(maxPlayers),
        variant,
        parseInt(deckCount),
        variant === "cards" ? claimType : undefined,
        parseInt(revealTime),
        theme,
        challengeMode,
        parseInt(challengeDuration),
      );
      navigate(`/room/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, variant, deckCount, revealTime, createRoom, navigate, addToast]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) {
      addToast("Enter your name first", "error");
      return;
    }
    if (!joinRoomId.trim()) {
      addToast("Enter a room code", "error");
      return;
    }
    setIsLoading(true);
    try {
      await joinRoom(joinRoomId.trim(), playerName.trim());
      navigate(`/room/${joinRoomId.trim().toUpperCase()}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, joinRoomId, joinRoom, navigate, addToast]);

  const selectStyle = { ...inputStyle(textAlign), cursor: "pointer" };
  const labelStyle = { fontSize: 12, color: COLORS.textSecondary, display: "block", marginBottom: 6, textAlign } as const;

  return (
    <>
    <Seo
      lang={lang === "ar" ? "ar" : "en"}
      title={lang === "ar" ? "أشك (Liar's Bar) — لعبة الخداع والكذب أونلاين" : "Liar's Bar — Online multiplayer bluffing card game"}
      description={
        lang === "ar"
          ? "العب أشك أونلاين مع أصدقائك — لعبة خداع وكذب بالورق. اكشف الكذابين وكن أول من يفرغ يده. مجاناً."
          : "Play Liar's Bar online — a real-time multiplayer bluffing card game. Call out the liars and be first to empty your hand. Free, no download."
      }
      path="/play"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: "Liar's Bar",
        alternateName: "أشك",
        url: "https://games.safariyat.live/play",
        description:
          "A real-time multiplayer bluffing card game — play cards, call out liars, and be the first to empty your hand.",
        genre: ["Party", "Bluffing", "Card game"],
        playMode: "MultiPlayer",
        gamePlatform: "Web browser",
        operatingSystem: "Any",
        applicationCategory: "Game",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      }}
    />
    <div
      dir={dir}
      style={{
        minHeight: "100vh", background: COLORS.cream, fontFamily: font, color: COLORS.ink,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 40px",
        boxSizing: "border-box", position: "relative",
      }}
    >
      <button
        onClick={() => navigate("/")}
        style={{
          position: "absolute", top: 20, [isAr ? "right" : "left"]: 20,
          display: "flex", alignItems: "center", gap: 6, border: `2px solid ${COLORS.ink}`,
          background: COLORS.white, color: COLORS.ink, fontWeight: 700, fontSize: 13,
          padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: font,
        }}
      >
        <ArrowLeft className="w-4 h-4" style={isAr ? { transform: "scaleX(-1)" } : undefined} />
        {t("index.back_to_arcade")}
      </button>

      <div style={{ marginBottom: 20, marginTop: 36, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div
            style={{
              width: 42, height: 42, borderRadius: 10, background: COLORS.red,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Swords className="w-5 h-5" color={COLORS.cream} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{t("index.title")}</h1>
        </div>
        <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: 0 }}>{t("index.subtitle")}</p>
      </div>

      <Panel style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ textAlign }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{t("index.join_table")}</h2>
            <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "2px 0 0" }}>{t("index.enter_name_hint")}</p>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => setShowGuide(true)}
              style={{ border: "none", background: "transparent", color: COLORS.textMuted, cursor: "pointer", padding: 6 }}
              title={t("guide.title")}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={toggleLang}
              style={{ border: "none", background: "transparent", color: COLORS.textMuted, cursor: "pointer", padding: 6, display: "flex", alignItems: "center", gap: 4 }}
              title={t("lang.switch_to")}
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>
        </div>

        <Field label={t("index.your_name")} align={textAlign}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="name"
              placeholder={t("index.name_placeholder")}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={16}
              style={{ ...inputStyle(textAlign), flex: 1 }}
            />
            {isFirebaseConfigured() && (
              <button
                onClick={handleGoogleSignIn}
                style={{
                  border: `2px solid ${COLORS.ink}`, background: COLORS.white, color: COLORS.ink,
                  borderRadius: 12, padding: "0 12px", cursor: "pointer", flexShrink: 0,
                }}
                title={googleUser ? `Signed in as ${googleUser.name}` : "Sign in with Google"}
              >
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
          {googleUser && (
            <p style={{ color: COLORS.teal, fontSize: 12, margin: "6px 0 0" }}>
              {t("index.signed_in_as")} {googleUser.name}
            </p>
          )}
        </Field>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <TabButton active={tab === "create"} onClick={() => setTab("create")} label={t("index.create_room_tab")} icon={<Gamepad2 className="w-4 h-4" />} />
          <TabButton active={tab === "join"} onClick={() => setTab("join")} label={t("index.join_room_tab")} icon={<Users className="w-4 h-4" />} />
        </div>

        {tab === "create" ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>{t("index.max_players")}</label>
                <select value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} style={selectStyle}>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={String(n)}>{n} {t("index.n_players")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t("index.game_type")}</label>
                <select value={variant} onChange={(e) => setVariant(e.target.value as GameVariant)} style={selectStyle}>
                  <option value="cards">{t("index.cards")}</option>
                  <option value="dominoes">{t("index.dominoes")}</option>
                </select>
              </div>
            </div>

            {variant === "cards" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>{t("index.claim_type")}</label>
                <select value={claimType} onChange={(e) => setClaimType(e.target.value as ClaimType)} style={selectStyle}>
                  <option value="suit">{t("index.suit_only")}</option>
                  <option value="rank">{t("index.rank_only")}</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, padding: "10px 14px", borderRadius: 12, border: `2px dashed ${COLORS.ink}`,
                background: "transparent", color: COLORS.textSecondary, cursor: "pointer", fontFamily: font,
                marginBottom: showAdvanced ? 14 : 16,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <SlidersHorizontal className="w-4 h-4" />
                {t("index.advanced")}
              </span>
              <ChevronDown className="w-4 h-4" style={{ transform: showAdvanced ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
            </button>

            {showAdvanced && (
              <div style={{ borderInlineStart: `2px solid ${COLORS.disabledBg}`, paddingInlineStart: 12, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>{t("index.num_decks")}</label>
                  <select value={deckCount} onChange={(e) => setDeckCount(e.target.value)} style={selectStyle}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={String(n)}>{n} {n === 1 ? "Deck" : "Decks"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    {t("index.reveal_duration")}: <span style={{ color: COLORS.red, fontFamily: "monospace" }}>{revealTime}s</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={revealTime}
                    onChange={(e) => setRevealTime(e.target.value)}
                    style={{ width: "100%", accentColor: COLORS.red }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMuted }}>
                    <span>3s</span>
                    <span>10s</span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t("index.challenge_mode")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PillToggle active={challengeMode === "timer"} onClick={() => setChallengeMode("timer")} label={t("index.timer_mode")} color={COLORS.teal} />
                    <PillToggle active={challengeMode === "vote"} onClick={() => setChallengeMode("vote")} label={t("index.vote_mode")} color={COLORS.teal} />
                  </div>
                  <p style={{ color: COLORS.textMuted, fontSize: 11, margin: "6px 0 0", textAlign }}>
                    {challengeMode === "timer" ? t("index.timer_mode_desc") : t("index.vote_mode_desc")}
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>{t("index.challenge_duration")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PillToggle active={challengeDuration === "5"} onClick={() => setChallengeDuration("5")} label="5s" />
                    <PillToggle active={challengeDuration === "10"} onClick={() => setChallengeDuration("10")} label="10s" />
                  </div>
                  <p style={{ color: COLORS.textMuted, fontSize: 11, margin: "6px 0 0", textAlign }}>
                    {challengeMode === "timer" ? t("index.challenge_duration_timer_desc") : t("index.challenge_duration_vote_desc")}
                  </p>
                </div>

                <ThemeSelector />
              </div>
            )}

            <PrimaryButton onClick={handleCreate} disabled={isLoading}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%" }}>
                <Dice1 className="w-4 h-4" />
                {isLoading ? t("index.creating") : t("index.create_room")}
              </span>
            </PrimaryButton>
          </div>
        ) : (
          <div>
            <Field label={t("index.room_code")} align={textAlign}>
              <input
                placeholder={t("index.room_code_placeholder")}
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ ...inputStyle("center"), fontSize: 18, letterSpacing: 4, fontFamily: "monospace" }}
              />
            </Field>

            <PrimaryButton onClick={handleJoin} disabled={isLoading} color={COLORS.teal}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%" }}>
                <Users className="w-4 h-4" />
                {isLoading ? t("index.joining") : t("index.join_room")}
              </span>
            </PrimaryButton>
          </div>
        )}
      </Panel>

      <p style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 20 }}>{t("index.footer")}</p>

      <GuideModal
        open={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </div>
    </>
  );
}
