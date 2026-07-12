import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { Seo } from "@/lib/seo";
import type { CodenamesLang } from "@/lib/types";
import { COLORS, uiFont } from "./theme";
import { Panel, Field, TabButton, PillToggle, PrimaryButton, inputStyle } from "./ui";

const COPY = {
  ar: {
    back: "الرئيسية",
    title: "كودنيمز",
    subtitle: "لعبة تخمين الكلمات بالفرق — اختر لغة الكلمات وابدأ",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    createTab: "إنشاء غرفة",
    joinTab: "الانضمام لغرفة",
    boardLanguage: "لغة الكلمات",
    arabicOption: "العربية",
    englishOption: "English",
    playerCount: "عدد اللاعبين",
    createButton: "إنشاء الغرفة",
    creating: "جارٍ الإنشاء...",
    roomCode: "رمز الغرفة",
    roomCodePlaceholder: "مثال: AB12CD",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    codeRequired: "اكتب رمز الغرفة",
  },
  en: {
    back: "Home",
    title: "Codenames",
    subtitle: "The team word-guessing game — pick a board language and start",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    createTab: "Create room",
    joinTab: "Join room",
    boardLanguage: "Board language",
    arabicOption: "العربية",
    englishOption: "English",
    playerCount: "Players",
    createButton: "Create room",
    creating: "Creating...",
    roomCode: "Room code",
    roomCodePlaceholder: "e.g. AB12CD",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    codeRequired: "Enter a room code",
  },
} as const;

export default function CodenamesHome() {
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
  const [boardLanguage, setBoardLanguage] = useState<CodenamesLang>(isAr ? "ar" : "en");
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
        "codenames",
        boardLanguage,
      );
      navigate(`/codenames/room/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, boardLanguage, createRoom, navigate, addToast, c]);

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
      navigate(`/codenames/room/${joinRoomId.trim().toUpperCase()}`);
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
      title={isAr ? "كودنيمز أونلاين — لعبة تخمين الكلمات بالفرق" : "Codenames Online — Team word-guessing game"}
      description={
        isAr
          ? "العب كودنيمز أونلاين مع أصدقائك بالعربية أو الإنجليزية، مع دردشة صوتية. مجاناً وبدون تحميل."
          : "Play Codenames online with friends — the classic team word-guessing game in Arabic or English, with voice chat. Free, no download."
      }
      path="/codenames"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: "Codenames",
        alternateName: "كودنيمز",
        url: "https://games.safariyat.live/codenames",
        description:
          "The classic team word-guessing game, playable in Arabic and English with voice chat.",
        genre: ["Party", "Word game", "Team"],
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

      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>{c.title}</h1>
          <p style={{ color: COLORS.textSecondary, fontSize: 15, marginTop: 6, lineHeight: 1.5 }}>{c.subtitle}</p>
        </div>

        <Panel style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <TabButton active={tab === "create"} onClick={() => setTab("create")} label={c.createTab} />
            <TabButton active={tab === "join"} onClick={() => setTab("join")} label={c.joinTab} />
          </div>

          <Field label={c.yourName} align={textAlign}>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={c.namePlaceholder}
              maxLength={16}
              style={inputStyle(textAlign)}
            />
          </Field>

          {tab === "create" ? (
            <>
              <Field label={c.boardLanguage} align={textAlign}>
                <div style={{ display: "flex", gap: 8 }}>
                  <PillToggle
                    active={boardLanguage === "ar"}
                    onClick={() => setBoardLanguage("ar")}
                    label={c.arabicOption}
                    color={COLORS.teal}
                  />
                  <PillToggle
                    active={boardLanguage === "en"}
                    onClick={() => setBoardLanguage("en")}
                    label={c.englishOption}
                    color={COLORS.teal}
                  />
                </div>
              </Field>
              <Field label={c.playerCount} align={textAlign}>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  style={inputStyle(textAlign)}
                >
                  {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <PrimaryButton onClick={handleCreate} disabled={isLoading} color={COLORS.teal}>
                {isLoading ? c.creating : c.createButton}
              </PrimaryButton>
            </>
          ) : (
            <>
              <Field label={c.roomCode} align="center">
                <input
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder={c.roomCodePlaceholder}
                  maxLength={8}
                  style={{ ...inputStyle("center"), letterSpacing: 3, fontWeight: 700 }}
                />
              </Field>
              <PrimaryButton onClick={handleJoin} disabled={isLoading} color={COLORS.red}>
                {isLoading ? c.joining : c.joinButton}
              </PrimaryButton>
            </>
          )}
        </Panel>
      </div>
    </div>
    </>
  );
}
