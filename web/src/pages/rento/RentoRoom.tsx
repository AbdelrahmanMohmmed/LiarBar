import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { codeToEmoji } from "@/lib/utils";
import { COLORS, uiFont } from "@/pages/domino/theme";
import { Panel, PrimaryButton, SecondaryButton, Badge } from "@/pages/domino/ui";
import { Users, Bot, Share2, Copy, Trash2 } from "lucide-react";

const COPY = {
  ar: {
    leave: "مغادرة",
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
    maxReached: "تم الوصول للحد الأقصى",
    settingsTitle: "خيارات الغرفة",
    startingBalance: "رأس المال الابتدائي",
    jail: "السجن",
    freeParking: "جائزة الوقوف",
    turnTimer: "وقت الدور",
    aiDifficulty: "ذكاء البوتات",
    on: "مفعل",
    off: "معطل",
    seconds: "ثانية",
  },
  en: {
    leave: "Leave",
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
    settingsTitle: "Room Options",
    startingBalance: "Starting Balance",
    jail: "Jail",
    freeParking: "Free Parking",
    turnTimer: "Turn Timer",
    aiDifficulty: "Bot Difficulty",
    on: "On",
    off: "Off",
    seconds: "seconds",
  },
} as const;

export default function RentoRoom() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    rentoState, myPlayerId, joinRoom, reconnectRoom,
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

  const isInRoom = myPlayerId && rentoState?.players.some((p) => p.id === myPlayerId);

  useEffect(() => {
    if (rentoState && rentoState.phase !== "lobby") {
      navigate(`/rento/game/${rentoState.roomId}`);
    }
  }, [rentoState, navigate]);

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
    const link = `${window.location.origin}/rento/room/${paramRoomId}`;
    navigator.clipboard.writeText(link)
      .then(() => addToast(c.copied, "success"))
      .catch(() => addToast("Failed to copy", "error"));
  }, [paramRoomId, addToast, c]);

  const handleShare = useCallback(() => {
    const link = `${window.location.origin}/rento/room/${paramRoomId}`;
    if (navigator.share) {
      navigator.share({
        title: isAr ? "انضم للعب رينتو!" : "Join Rento!",
        text: isAr ? `تعال والعب معي رينتو! رمز الغرفة هو ${paramRoomId}` : `Come play Rento with me! Room code: ${paramRoomId}`,
        url: link,
      }).catch(() => handleCopyLink());
    } else {
      handleCopyLink();
    }
  }, [paramRoomId, handleCopyLink, isAr]);

  const handleAddBot = useCallback(async () => {
    if (!rentoState) return;
    try {
      const names = isAr
        ? ["عبده", "أبو حميد", "الحريف", "المعلم", "زياد", "فارس"]
        : ["Spark", "Logic", "Bluffer", "Quantum", "King", "Champ"];
      const botName = (isAr ? "آلي " : "Bot ") + (names[Math.floor(Math.random() * names.length)]);
      await addBot(botName, botDifficulty);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add bot", "error");
    }
  }, [addBot, botDifficulty, rentoState, addToast, isAr]);

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
    navigate("/rento");
  }, [resetGame, navigate]);

  if (!reconnected) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Loading...</p>
      </div>
    );
  }

  if (!rentoState) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Room not found or disconnected.</p>
        <SecondaryButton onClick={() => navigate("/rento")}>{c.leave}</SecondaryButton>
      </div>
    );
  }

  const isMeHost = rentoState.players.find((p) => p.id === myPlayerId)?.isHost ?? false;
  const isFull = rentoState.players.length >= rentoState.maxPlayers;

  const turnSec = Math.round((rentoState.turnTimerMs || 0) / 1000);

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
                {rentoState.players.length} / {rentoState.maxPlayers}
              </Badge>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rentoState.players.map((p) => (
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
                    {p.isBot ? <Bot className="w-4 h-4" /> : <span>{codeToEmoji(p.flag)}</span>}
                    {p.name} {p.id === myPlayerId ? `(${c.you})` : ""}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {p.isHost ? <Badge color={COLORS.peach}>{c.host}</Badge> : null}
                    {isMeHost && p.isBot ? (
                      <button
                        onClick={() => removeBot(p.id)}
                        style={{ border: "none", background: "transparent", color: COLORS.red, cursor: "pointer", padding: 4 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}

              {Array.from({ length: Math.max(0, rentoState.maxPlayers - rentoState.players.length) }).map((_, i) => (
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
                  {isAr ? "بانتظار لاعبين آخرين..." : "Waiting for player..."}
                </div>
              ))}
            </div>
          </Panel>

          {isMeHost && !isFull ? (
            <Panel style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 800, textAlign }}>
                {c.addBot}
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

        <div>
          <Panel style={{ padding: 24, height: "fit-content" }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px 0", textAlign }}>
              {c.settingsTitle}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.startingBalance}</span>
                <span style={{ fontWeight: 700 }}>${rentoState.startingBalance}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.jail}</span>
                <span style={{ fontWeight: 700 }}>{rentoState.jailEnabled ? c.on : c.off}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.freeParking}</span>
                <span style={{ fontWeight: 700 }}>${rentoState.freeParkingBonus}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #E7E1D8", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.turnTimer}</span>
                <span style={{ fontWeight: 700 }}>
                  {turnSec > 0 ? `${turnSec} ${c.seconds}` : c.off}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.aiDifficulty}</span>
                <span style={{ fontWeight: 700 }}>{c[rentoState.aiDifficulty]}</span>
              </div>
            </div>

            {isMeHost ? (
              <PrimaryButton onClick={handleStartGame} disabled={starting || rentoState.players.length < 2}>
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
