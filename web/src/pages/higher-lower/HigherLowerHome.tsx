import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import { COLORS, uiFont } from "./theme";
import { Panel, Field, TabButton, PrimaryButton, inputStyle } from "./ui";

const COPY = {
  ar: {
    back: "الرئيسية",
    title: "أعلى أو أقل",
    subtitle: "لعبة تخمين رقمك السري من 1 إلى 99 بالسرعة والذكاء!",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    createTab: "إنشاء غرفة",
    joinTab: "الانضمام لغرفة",
    playerCount: "عدد اللاعبين الأقصى",
    createButton: "إنشاء الغرفة",
    creating: "جارٍ الإنشاء...",
    roomCode: "رمز الغرفة",
    roomCodePlaceholder: "مثال: 123456",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    codeRequired: "اكتب رمز الغرفة",
  },
  en: {
    back: "Home",
    title: "Higher or Lower",
    subtitle: "Guess your secret number between 1 and 99 using logic and speed!",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    createTab: "Create room",
    joinTab: "Join room",
    playerCount: "Max Players",
    createButton: "Create room",
    creating: "Creating...",
    roomCode: "Room code",
    roomCodePlaceholder: "e.g. 123456",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    codeRequired: "Enter a room code",
  },
} as const;

export default function HigherLowerHome() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, addToast } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [tab, setTab] = useState<"create" | "join">("create");
  const [playerName, setPlayerName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!playerName.trim()) {
      addToast(c.nameRequired, "error");
      return;
    }
    setIsLoading(true);
    try {
      const { roomId } = await createRoom(
        playerName.trim(),
        parseInt(maxPlayers, 10),
        "cards",
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "higher-lower"
      );
      navigate(`/higher-lower/room/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, createRoom, navigate, addToast, c]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) {
      addToast(c.nameRequired, "error");
      return;
    }
    if (!joinRoomId.trim()) {
      addToast(c.codeRequired, "error");
      return;
    }
    setIsLoading(true);
    try {
      await joinRoom(joinRoomId.trim(), playerName.trim());
      navigate(`/higher-lower/room/${joinRoomId.trim()}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, joinRoomId, joinRoom, navigate, addToast, c]);

  return (
    <>
    <Seo
      lang={isAr ? "ar" : "en"}
      title={isAr ? "أعلى أو أقل — لعبة تخمين الأرقام أونلاين" : "Higher or Lower — Online number guessing game"}
      description={
        isAr
          ? "العب أعلى أو أقل مع أصدقائك — خمّن رقمك السري وكن الأول في الوصول إليه. مجاناً وبدون تحميل."
          : "Play Higher or Lower with friends — a fast number-guessing party game. Race to find your secret number first. Free, no download."
      }
      path="/higher-lower"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: "Higher or Lower",
        alternateName: "أعلى أو أقل",
        url: "https://games.safariyat.live/higher-lower",
        description:
          "A fast number-guessing party game — compare ranges with others and race to find your secret number first.",
        genre: ["Party", "Guessing"],
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
        minHeight: "100vh",
        background: COLORS.cream,
        fontFamily: font,
        color: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: isAr ? "flex-end" : "flex-start" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            border: `2px solid ${COLORS.ink}`,
            background: COLORS.white,
            color: COLORS.ink,
            fontFamily: "'Baloo 2', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          {isAr ? `${c.back} ←` : `← ${c.back}`}
        </button>
      </div>

      <Panel style={{ width: "100%", maxWidth: 420, padding: 24, boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px 0" }}>{c.title}</h1>
          <p style={{ fontSize: 14, color: COLORS.textSecondary, margin: 0 }}>{c.subtitle}</p>
        </div>

        <Field label={c.yourName} align={textAlign}>
          <input
            style={inputStyle(textAlign)}
            type="text"
            placeholder={c.namePlaceholder}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={14}
            disabled={isLoading}
          />
        </Field>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <TabButton active={tab === "create"} onClick={() => setTab("create")} label={c.createTab} />
          <TabButton active={tab === "join"} onClick={() => setTab("join")} label={c.joinTab} />
        </div>

        {tab === "create" ? (
          <div>
            <Field label={c.playerCount} align={textAlign}>
              <select
                style={inputStyle(textAlign)}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                disabled={isLoading}
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {isAr ? "لاعبين" : "Players"}
                  </option>
                ))}
              </select>
            </Field>

            <PrimaryButton onClick={handleCreate} disabled={isLoading} style={{ marginTop: 8 }}>
              {isLoading ? c.creating : c.createButton}
            </PrimaryButton>
          </div>
        ) : (
          <div>
            <Field label={c.roomCode} align={textAlign}>
              <input
                style={inputStyle(textAlign)}
                type="text"
                placeholder={c.roomCodePlaceholder}
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                maxLength={6}
                disabled={isLoading}
              />
            </Field>

            <PrimaryButton onClick={handleJoin} disabled={isLoading} style={{ marginTop: 8 }}>
              {isLoading ? c.joining : c.joinButton}
            </PrimaryButton>
          </div>
        )}
      </Panel>
    </div>
    </>
  );
}
