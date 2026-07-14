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
    title: "الدومينو الكلاسيكية",
    subtitle: "العب الدومينو الشعبية أونلاين مع أصدقائك أو ضد البوتات!",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    createTab: "إنشاء غرفة",
    joinTab: "الانضمام لغرفة",
    playerCount: "عدد اللاعبين الأقصى",
    gameMode: "نمط اللعب",
    individual: "فردي (كل لاعب لنفسه)",
    teams: "زوجي (2 ضد 2)",
    targetScore: "الفورة من كام (النقاط)",
    turnTimeLimit: "وقت الدور لكل لاعب",
    tableTheme: "مظهر الطاولة",
    tileTheme: "تصميم قطع الدومينو",
    createButton: "إنشاء الغرفة",
    creating: "جارٍ الإنشاء...",
    roomCode: "رمز الغرفة",
    roomCodePlaceholder: "مثال: 123456",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    codeRequired: "اكتب رمز الغرفة",
    // Options
    themeGreen: "لباد أخضر (كازينو)",
    themeSlate: "صخر رمادي (عصري)",
    themeWood: "خشب ماهوجني (كلاسيكي)",
    tileIvory: "عاجي كلاسيكي",
    tileCarbon: "ألياف الكربون",
    tileNeon: "نيون مضيء",
    noLimit: "بدون وقت محدد",
    seconds: "ثانية",
  },
  en: {
    back: "Home",
    title: "Classic Dominoes",
    subtitle: "Play the traditional Domino game online with friends or bots!",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    createTab: "Create room",
    joinTab: "Join room",
    playerCount: "Max Players",
    gameMode: "Game Mode",
    individual: "Individual (Solo)",
    teams: "2 vs 2 Teams",
    targetScore: "Target Score (Points)",
    turnTimeLimit: "Turn Timeout",
    tableTheme: "Table Theme",
    tileTheme: "Domino Tile Design",
    createButton: "Create room",
    creating: "Creating...",
    roomCode: "Room code",
    roomCodePlaceholder: "e.g. 123456",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    codeRequired: "Enter a room code",
    // Options
    themeGreen: "Green Felt (Casino)",
    themeSlate: "Dark Slate (Modern)",
    themeWood: "Mahogany Wood (Classic)",
    tileIvory: "Classic Ivory",
    tileCarbon: "Carbon Fiber",
    tileNeon: "Neon Glow",
    noLimit: "Unlimited (No timer)",
    seconds: "seconds",
  },
} as const;

export default function DominoHome() {
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
  const [gameMode, setGameMode] = useState<"individual" | "teams">("individual");
  const [targetScore, setTargetScore] = useState("100");
  const [turnTimeLimit, setTurnTimeLimit] = useState("30");
  const [tableTheme, setTableTheme] = useState("green");
  const [tileTheme, setTileTheme] = useState("ivory");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Force 4 players in Teams Mode
  const handleGameModeChange = (mode: "individual" | "teams") => {
    setGameMode(mode);
    if (mode === "teams") {
      setMaxPlayers("4");
    }
  };

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
        "dominoes", // variant
        1,          // deckCount
        undefined,  // claimType
        undefined,  // revealTime
        undefined,  // theme
        undefined,  // challengeMode
        undefined,  // challengeDuration
        "domino",   // gameId
        undefined,  // language
        gameMode,
        parseInt(targetScore, 10),
        parseInt(turnTimeLimit, 10),
        tableTheme,
        tileTheme
      );

      navigate(`/domino/room/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, gameMode, targetScore, turnTimeLimit, tableTheme, tileTheme, createRoom, navigate, addToast, c]);

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
      await joinRoom(joinRoomId.trim().toUpperCase(), playerName.trim());
      navigate(`/domino/room/${joinRoomId.trim().toUpperCase()}`);
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
      title={isAr ? "لعبة الدومينو أونلاين — العب زوجي وفردي" : "Classic Dominoes Online — Play Solo or Teams"}
      description={
        isAr
          ? "العب الدومينو الكلاسيكية مع أصدقائك أونلاين. يدعم اللعب الفردي والزوجي مع إضافة البوتات وعداد الوقت."
          : "Play Classic Dominoes with friends online. Supports Solo or 2v2 Teams mode with customizable bots and turn limits."
      }
      path="/domino"
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
                  {c.gameMode}
                </label>
                <select
                  style={selectStyle}
                  value={gameMode}
                  onChange={(e) => handleGameModeChange(e.target.value as "individual" | "teams")}
                  disabled={isLoading}
                >
                  <option value="individual">{c.individual}</option>
                  <option value="teams">{c.teams}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                  {c.playerCount}
                </label>
                <select
                  style={selectStyle}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  disabled={isLoading || gameMode === "teams"}
                >
                  {gameMode === "teams" ? (
                    <option value="4">4 {isAr ? "لاعبين" : "Players"}</option>
                  ) : (
                    ["2", "3", "4"].map((n) => (
                      <option key={n} value={n}>
                        {n} {isAr ? "لاعبين" : "Players"}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                  {c.targetScore}
                </label>
                <select
                  style={selectStyle}
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  disabled={isLoading}
                >
                  {["50", "100", "150", "200"].map((s) => (
                    <option key={s} value={s}>
                      {s} {isAr ? "نقطة" : "pts"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                  {c.turnTimeLimit}
                </label>
                <select
                  style={selectStyle}
                  value={turnTimeLimit}
                  onChange={(e) => setTurnTimeLimit(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="0">{c.noLimit}</option>
                  <option value="15">15 {c.seconds}</option>
                  <option value="30">30 {c.seconds}</option>
                  <option value="45">45 {c.seconds}</option>
                  <option value="90">90 {c.seconds} (1:30)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                  {c.tableTheme}
                </label>
                <select
                  style={selectStyle}
                  value={tableTheme}
                  onChange={(e) => setTableTheme(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="green">{c.themeGreen}</option>
                  <option value="slate">{c.themeSlate}</option>
                  <option value="wood">{c.themeWood}</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, textAlign }}>
                  {c.tileTheme}
                </label>
                <select
                  style={selectStyle}
                  value={tileTheme}
                  onChange={(e) => setTileTheme(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="ivory">{c.tileIvory}</option>
                  <option value="carbon">{c.tileCarbon}</option>
                  <option value="neon">{c.tileNeon}</option>
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
