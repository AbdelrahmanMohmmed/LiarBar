import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { COLORS, uiFont } from "./theme";
import { Panel, PrimaryButton, SecondaryButton, Badge } from "./ui";
import { Users, Bot, Share2, Copy, Trash2, ArrowLeft } from "lucide-react";

const COPY = {
  ar: {
    back: "الرئيسية",
    leave: "مغادرة",
    roomLabel: "رمز الغرفة",
    copy: "نسخ الرابط",
    share: "مشاركة",
    copied: "تم نسخ الرابط!",
    players: "لاعبون",
    you: "أنت",
    host: "المضيف",
    disconnected: "غير متصل",
    startGame: "ابدأ اللعبة",
    starting: "جارٍ البدء...",
    waitingForHost: "بانتظار أن يبدأ المضيف اللعبة…",
    addBot: "إضافة بوت",
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
    maxReached: "تم الوصول للحد الأقصى للاعبين",
    gameMode: "نمط اللعب",
    individual: "فردي (كل لاعب لنفسه)",
    teams: "زوجي (2 ضد 2)",
    targetScore: "الفورة من",
    turnTimeLimit: "وقت الدور",
    noLimit: "مفتوح",
    seconds: "ثانية",
    teamA: "الفريق (أ)",
    teamB: "الفريق (ب)",
    position: "موقع",
    settingsTitle: "خيارات الغرفة",
    tableTheme: "مظهر الطاولة",
    tileTheme: "تصميم القطع",
    themeGreen: "لباد أخضر",
    themeSlate: "صخر رمادي",
    themeWood: "خشب ماهوجني",
    tileIvory: "عاجي كلاسيكي",
    tileCarbon: "ألياف الكربون",
    tileNeon: "نيون مضيء",
  },
  en: {
    back: "Home",
    leave: "Leave",
    roomLabel: "Room Code",
    copy: "Copy Link",
    share: "Share",
    copied: "Link copied!",
    players: "players",
    you: "you",
    host: "host",
    disconnected: "offline",
    startGame: "Start game",
    starting: "Starting...",
    waitingForHost: "Waiting for the host to start the game…",
    addBot: "Add Bot",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    maxReached: "Max players reached",
    gameMode: "Game Mode",
    individual: "Solo (Individual)",
    teams: "2 vs 2 Teams",
    targetScore: "Target Score",
    turnTimeLimit: "Turn Timeout",
    noLimit: "Unlimited",
    seconds: "seconds",
    teamA: "Team A",
    teamB: "Team B",
    position: "Slot",
    settingsTitle: "Room Options",
    tableTheme: "Table Theme",
    tileTheme: "Tile Theme",
    themeGreen: "Green Felt",
    themeSlate: "Slate Gray",
    themeWood: "Mahogany Wood",
    tileIvory: "Classic Ivory",
    tileCarbon: "Carbon Fiber",
    tileNeon: "Neon Glow",
  },
} as const;

export default function DominoRoom() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    dominoState, myPlayerId, joinRoom, reconnectRoom,
    startGame, addBot, removeBot, addToast, resetGame,
  } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [reconnected, setReconnected] = useState(false);
  const [starting, setStarting] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  const isInRoom = myPlayerId && dominoState?.players.some((p) => p.id === myPlayerId);

  // Auto redirect to gameplay screen if game is in progress
  useEffect(() => {
    if (dominoState && dominoState.phase !== "lobby") {
      navigate(`/domino/game/${dominoState.roomId}`);
    }
  }, [dominoState, navigate]);

  // Handle reconnect or sync state
  useEffect(() => {
    if (reconnected) return;
    const storedRoomId = localStorage.getItem("liarsbar_roomId");
    const storedPlayerId = localStorage.getItem("liarsbar_playerId");

    if (paramRoomId) {
      if (storedRoomId === paramRoomId && storedPlayerId) {
        reconnectRoom(paramRoomId, storedPlayerId)
          .then(() => setReconnected(true))
          .catch(() => setReconnected(true));
      } else {
        setReconnected(true);
      }
    }
  }, [paramRoomId, reconnectRoom, reconnected]);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/domino/room/${paramRoomId}`;
    navigator.clipboard.writeText(link)
      .then(() => addToast(c.copied, "success"))
      .catch(() => addToast("Failed to copy", "error"));
  }, [paramRoomId, addToast, c]);

  const handleShare = useCallback(() => {
    const link = `${window.location.origin}/domino/room/${paramRoomId}`;
    if (navigator.share) {
      navigator.share({
        title: isAr ? "انضم للعب الدومينو الكلاسيكية!" : "Join Classic Dominoes!",
        text: isAr ? `تعال والعب معي دومينو! رمز الغرفة هو ${paramRoomId}` : `Come play dominoes with me! Room code: ${paramRoomId}`,
        url: link,
      }).catch(() => handleCopyLink());
    } else {
      handleCopyLink();
    }
  }, [paramRoomId, handleCopyLink, isAr]);

  const handleAddBot = useCallback(async () => {
    if (!dominoState) return;
    try {
      const names = [
        "عبده", "أبو حميد", "الحريف", "المعلم", "حبيبة", "زياد", "فارس",
        "Spark", "Logic", "Bluffer", "Quantum", "DominoKing", "IvoryChamp"
      ];
      const botName = (isAr ? "آلي " : "Bot ") + (names[Math.floor(Math.random() * names.length)]);
      await addBot(botName, botDifficulty);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add bot", "error");
    }
  }, [addBot, botDifficulty, dominoState, addToast, isAr]);

  const handleStartGame = useCallback(async () => {
    setStarting(true);
    try {
      await startGame();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to start", "error");
    } finally {
      setStarting(false);
    }
  }, [startGame, addToast]);

  const handleLeave = useCallback(() => {
    resetGame();
    localStorage.removeItem("liarsbar_roomId");
    localStorage.removeItem("liarsbar_playerId");
    navigate("/domino");
  }, [resetGame, navigate]);

  if (!reconnected) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Loading...</p>
      </div>
    );
  }

  // If room details are missing or not joined, redirect back to home page
  if (!dominoState) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Room not found or disconnected.</p>
        <SecondaryButton onClick={() => navigate("/domino")}>{c.back}</SecondaryButton>
      </div>
    );
  }

  const hostPlayer = dominoState.players.find((p) => p.isHost);
  const isMeHost = dominoState.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
  const isFull = dominoState.players.length >= dominoState.maxPlayers;

  const getThemeText = (themeKey: string) => {
    if (themeKey === "green") return c.themeGreen;
    if (themeKey === "slate") return c.themeSlate;
    if (themeKey === "wood") return c.themeWood;
    return themeKey;
  };

  const getTileText = (tileKey: string) => {
    if (tileKey === "ivory") return c.tileIvory;
    if (tileKey === "carbon") return c.tileCarbon;
    if (tileKey === "neon") return c.tileNeon;
    return tileKey;
  };

  return (
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
      <div style={{ width: "100%", maxWidth: 600, display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <button
          onClick={handleLeave}
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
          }}
        >
          {c.leave}
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopyLink}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `2px solid ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: font,
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <Copy className="w-4 h-4" />
            {c.copy}
          </button>
          <button
            onClick={handleShare}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `2px solid ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: font,
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <Share2 className="w-4 h-4" />
            {c.share}
          </button>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 600, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Left column: Players List */}
        <div>
          <Panel style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users className="w-5 h-5" />
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                  {isAr ? "اللاعبين المتصلين" : "Connected Players"}
                </h2>
              </div>
              <Badge color={COLORS.ink}>
                {dominoState.players.length} / {dominoState.maxPlayers}
              </Badge>
            </div>

            {/* Layout for Teams Mode vs Individual Mode */}
            {dominoState.gameMode === "teams" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Team A block */}
                <div style={{ border: `2px solid ${COLORS.teal}`, borderRadius: 16, padding: 12, background: `${COLORS.teal}0c` }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 800, color: COLORS.teal, textAlign }}>
                    {c.teamA} (1 & 3)
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[0, 2].map((idx) => {
                      const p = dominoState.players[idx];
                      return p ? (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: COLORS.white, border: `2px solid ${COLORS.ink}`, borderRadius: 10 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                            {p.isBot ? <Bot className="w-4 h-4" /> : null}
                            {p.name} {p.id === myPlayerId ? `(${c.you})` : ""}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {p.isHost ? <span style={{ fontSize: 11, color: COLORS.textMuted }}>{c.host}</span> : null}
                            {!p.isConnected && !p.isBot ? <span style={{ fontSize: 11, color: COLORS.red }}>{c.disconnected}</span> : null}
                            {isMeHost && p.isBot ? (
                              <button onClick={() => removeBot(p.id)} style={{ border: "none", background: "transparent", color: COLORS.red, cursor: "pointer", padding: 2 }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div key={`empty-${idx}`} style={{ height: 38, border: "2px dashed #A79C8E", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>
                          {isAr ? `في انتظار اللاعب الثالث...` : `Waiting for teammate...`}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team B block */}
                <div style={{ border: `2px solid ${COLORS.red}`, borderRadius: 16, padding: 12, background: `${COLORS.red}0c` }}>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 800, color: COLORS.red, textAlign }}>
                    {c.teamB} (2 & 4)
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 3].map((idx) => {
                      const p = dominoState.players[idx];
                      return p ? (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: COLORS.white, border: `2px solid ${COLORS.ink}`, borderRadius: 10 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
                            {p.isBot ? <Bot className="w-4 h-4" /> : null}
                            {p.name} {p.id === myPlayerId ? `(${c.you})` : ""}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {p.isHost ? <span style={{ fontSize: 11, color: COLORS.textMuted }}>{c.host}</span> : null}
                            {!p.isConnected && !p.isBot ? <span style={{ fontSize: 11, color: COLORS.red }}>{c.disconnected}</span> : null}
                            {isMeHost && p.isBot ? (
                              <button onClick={() => removeBot(p.id)} style={{ border: "none", background: "transparent", color: COLORS.red, cursor: "pointer", padding: 2 }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div key={`empty-${idx}`} style={{ height: 38, border: "2px dashed #A79C8E", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>
                          {isAr ? `في انتظار الخصم...` : `Waiting for opponent...`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              // Individual Solo List
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dominoState.players.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: COLORS.white,
                      border: `2px solid ${COLORS.ink}`,
                      borderRadius: 12,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      {p.isBot ? <Bot className="w-4 h-4" /> : null}
                      {p.name} {p.id === myPlayerId ? `(${c.you})` : ""}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.isHost ? <Badge color={COLORS.peach}>{c.host}</Badge> : null}
                      {!p.isConnected && !p.isBot ? <Badge color={COLORS.red}>{c.disconnected}</Badge> : null}
                      {isMeHost && p.isBot ? (
                        <button
                          onClick={() => removeBot(p.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: COLORS.red,
                            cursor: "pointer",
                            padding: 4,
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {/* Empty slots placeholders */}
                {Array.from({ length: Math.max(0, dominoState.maxPlayers - dominoState.players.length) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      border: "2px dashed #A79C8E",
                      borderRadius: 12,
                      padding: "12px 14px",
                      textAlign: "center",
                      color: COLORS.textMuted,
                      fontSize: 13,
                    }}
                  >
                    {isAr ? "بانتظار لاعبين آخرين للاتصال..." : "Waiting for player..."}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Add Bots panel for the Host */}
          {isMeHost && !isFull ? (
            <Panel style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800, textAlign }}>
                {isAr ? "إضافة لاعبين آليين (البوتات)" : "Add Artificial Bots"}
              </h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["easy", "medium", "hard"] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setBotDifficulty(diff)}
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: `2px solid ${COLORS.ink}`,
                      background: botDifficulty === diff ? COLORS.ink : COLORS.white,
                      color: botDifficulty === diff ? COLORS.cream : COLORS.ink,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {c[diff]}
                  </button>
                ))}
              </div>
              <PrimaryButton onClick={handleAddBot} color={COLORS.teal}>
                {c.addBot}
              </PrimaryButton>
            </Panel>
          ) : null}
        </div>

        {/* Right column: Room Config Summary */}
        <div>
          <Panel style={{ padding: 24, height: "fit-content" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px 0", textAlign }}>
              {c.settingsTitle}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.gameMode}</span>
                <span style={{ fontWeight: 700 }}>{dominoState.gameMode === "teams" ? c.teams : c.individual}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.targetScore}</span>
                <span style={{ fontWeight: 700 }}>{dominoState.targetScore} {isAr ? "نقطة" : "points"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.turnTimeLimit}</span>
                <span style={{ fontWeight: 700 }}>
                  {dominoState.turnTimeLimit > 0 ? `${dominoState.turnTimeLimit} ${c.seconds}` : c.noLimit}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.tableTheme}</span>
                <span style={{ fontWeight: 700 }}>{getThemeText(dominoState.tableTheme)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.tileTheme}</span>
                <span style={{ fontWeight: 700 }}>{getTileText(dominoState.tileTheme)}</span>
              </div>
            </div>

            {isMeHost ? (
              <PrimaryButton onClick={handleStartGame} disabled={starting || dominoState.players.length < 2}>
                {starting ? c.starting : c.startGame}
              </PrimaryButton>
            ) : (
              <p style={{ color: COLORS.textMuted, fontSize: 13, textAlign: "center", margin: 0, fontStyle: "italic" }}>
                {c.waitingForHost}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
