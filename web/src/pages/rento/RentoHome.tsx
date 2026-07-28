import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { localeToFlag } from "@/lib/utils";
import { Seo } from "@/lib/seo";
import { COLORS, uiFont } from "@/pages/domino/theme";
import { Panel, Field, TabButton, PrimaryButton, inputStyle } from "@/pages/domino/ui";

const COPY = {
  ar: {
    back: "الرئيسية",
    title: "رينتو — المونوبولي العربية",
    subtitle: "اشترِ المدن، اجمع الإيجارات، وأفلس خصومك!",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    createTab: "إنشاء غرفة",
    joinTab: "الانضمام لغرفة",
    playerCount: "عدد اللاعبين",
    startingBalance: "رأس المال الابتدائي",
    jail: "السجن مفعل؟",
    jailOn: "مفعل",
    jailOff: "معطل",
    freeParking: "جائزة الوقوف المجاني",
    turnTimer: "وقت الدور",
    aiDifficulty: "ذكاء البوتات",
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
    createButton: "إنشاء الغرفة",
    creating: "جارٍ الإنشاء...",
    roomCode: "رمز الغرفة",
    roomCodePlaceholder: "مثال: 123456",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    codeRequired: "اكتب رمز الغرفة",
    off: "معطل",
    seconds: "ثانية",
  },
  en: {
    back: "Home",
    title: "Rento — Arabic Monopoly",
    subtitle: "Buy cities, collect rents, and bankrupt your rivals!",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    createTab: "Create room",
    joinTab: "Join room",
    playerCount: "Players",
    startingBalance: "Starting Balance",
    jail: "Jail enabled?",
    jailOn: "On",
    jailOff: "Off",
    freeParking: "Free Parking Bonus",
    turnTimer: "Turn Timer",
    aiDifficulty: "Bot Difficulty",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    createButton: "Create room",
    creating: "Creating...",
    roomCode: "Room code",
    roomCodePlaceholder: "e.g. 123456",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    codeRequired: "Enter a room code",
    off: "Off",
    seconds: "seconds",
  },
} as const;

export default function RentoHome() {
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
  const [startingBalance, setStartingBalance] = useState("1500");
  const [jailEnabled, setJailEnabled] = useState(true);
  const [freeParking, setFreeParking] = useState("0");
  const [turnTimer, setTurnTimer] = useState("0");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
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
        "dominoes",
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        "rento",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        parseInt(startingBalance, 10),
        jailEnabled,
        parseInt(freeParking, 10),
        parseInt(turnTimer, 10),
        aiDifficulty,
        localeToFlag(),
      );
      navigate(`/rento/room/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, startingBalance, jailEnabled, freeParking, turnTimer, aiDifficulty, createRoom, navigate, addToast, c]);

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
      await joinRoom(joinRoomId.trim().toUpperCase(), playerName.trim(), localeToFlag());
      navigate(`/rento/room/${joinRoomId.trim().toUpperCase()}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, joinRoomId, joinRoom, navigate, addToast, c]);

  const selectStyle = { ...inputStyle(textAlign), cursor: "pointer" };

  return (
    <>
      <Seo
        lang={isAr ? "ar" : "en"}
        title={isAr ? "رينتو — المونوبولي أونلاين" : "Rento — Arabic Monopoly Online"}
        description={
          isAr
            ? "العب رينتو أونلاين مع أصدقائك أو ضد البوتات. اضبط رأس المال والسجن ووقت الدور."
            : "Play Rento online with friends or bots. Customize starting balance, jail, and turn timer."
        }
        path="/rento"
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
              fontFamily: font,
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                    {c.playerCount}
                  </label>
                  <select
                    style={selectStyle}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    disabled={isLoading}
                  >
                    {["2", "3", "4", "5", "6"].map((n) => (
                      <option key={n} value={n}>{n} {isAr ? "لاعبين" : "Players"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                    {c.startingBalance}
                  </label>
                  <select
                    style={selectStyle}
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(e.target.value)}
                    disabled={isLoading}
                  >
                    {["1500", "3000", "6000"].map((n) => (
                      <option key={n} value={n}>${n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                    {c.jail}
                  </label>
                  <select
                    style={selectStyle}
                    value={jailEnabled ? "on" : "off"}
                    onChange={(e) => setJailEnabled(e.target.value === "on")}
                    disabled={isLoading}
                  >
                    <option value="on">{c.jailOn}</option>
                    <option value="off">{c.jailOff}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                    {c.freeParking}
                  </label>
                  <select
                    style={selectStyle}
                    value={freeParking}
                    onChange={(e) => setFreeParking(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="0">{c.off}</option>
                    <option value="100">$100</option>
                    <option value="200">$200</option>
                    <option value="500">$500</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                    {c.turnTimer}
                  </label>
                  <select
                    style={selectStyle}
                    value={turnTimer}
                    onChange={(e) => setTurnTimer(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="0">{c.off}</option>
                    <option value="30000">30 {c.seconds}</option>
                    <option value="45000">45 {c.seconds}</option>
                    <option value="60000">60 {c.seconds}</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                    {c.aiDifficulty}
                  </label>
                  <select
                    style={selectStyle}
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value as "easy" | "medium" | "hard")}
                    disabled={isLoading}
                  >
                    <option value="easy">{c.easy}</option>
                    <option value="medium">{c.medium}</option>
                    <option value="hard">{c.hard}</option>
                  </select>
                </div>
              </div>

              <PrimaryButton onClick={handleCreate} disabled={isLoading}>
                {isLoading ? c.creating : c.createButton}
              </PrimaryButton>
            </div>
          ) : (
            <div>
              <Field label={c.roomCode} align={textAlign}>
                <input
                  style={inputStyle("center")}
                  type="text"
                  placeholder={c.roomCodePlaceholder}
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  maxLength={8}
                  disabled={isLoading}
                />
              </Field>

              <PrimaryButton onClick={handleJoin} disabled={isLoading} color={COLORS.teal}>
                {isLoading ? c.joining : c.joinButton}
              </PrimaryButton>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
