import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { COLORS, uiFont } from "./theme";
import { Panel, Field, PrimaryButton, SecondaryButton, inputStyle } from "./ui";
import { Users, Bot, Share2, Copy, Trash2, ArrowLeft } from "lucide-react";

const COPY = {
  ar: {
    back: "الرئيسية",
    leave: "مغادرة",
    roomLabel: "الغرفة",
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
    joinTitle: "انضم إلى الغرفة",
    yourName: "اسمك",
    namePlaceholder: "اكتب اسمك",
    joinButton: "انضمام",
    joining: "جارٍ الانضمام...",
    nameRequired: "اكتب اسمك أولاً",
    addBot: "إضافة بوت",
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
    maxReached: "تم الوصول إلى الحد الأقصى للاعبين",
  },
  en: {
    back: "Home",
    leave: "Leave",
    roomLabel: "Room",
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
    joinTitle: "Join the room",
    yourName: "Your name",
    namePlaceholder: "Enter your name",
    joinButton: "Join",
    joining: "Joining...",
    nameRequired: "Enter your name first",
    addBot: "Add Bot",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    maxReached: "Max players reached",
  },
} as const;

export default function HigherLowerRoom() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    higherLowerState, myPlayerId, myRoomId, joinRoom, reconnectRoom,
    startGame, addBot, removeBot, addToast, resetGame,
  } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [reconnected, setReconnected] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  const isInRoom = myPlayerId && higherLowerState?.players.some((p) => p.id === myPlayerId);

  // Auto redirect to gameplay screen if game is in progress
  useEffect(() => {
    if (higherLowerState && higherLowerState.phase !== "lobby") {
      navigate(`/higher-lower/game/${higherLowerState.roomId}`);
    }
  }, [higherLowerState, navigate]);

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

  const handleJoin = useCallback(async () => {
    if (!joinName.trim() || !paramRoomId) {
      addToast(c.nameRequired, "error");
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom(paramRoomId, joinName.trim());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Join failed", "error");
    } finally {
      setIsJoining(false);
    }
  }, [joinName, paramRoomId, joinRoom, addToast, c]);

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/higher-lower/room/${paramRoomId}`;
    navigator.clipboard.writeText(link)
      .then(() => addToast(c.copied, "success"))
      .catch(() => addToast("Failed to copy", "error"));
  }, [paramRoomId, addToast, c]);

  const handleShare = useCallback(() => {
    const link = `${window.location.origin}/higher-lower/room/${paramRoomId}`;
    if (navigator.share) {
      navigator.share({
        title: isAr ? "انضم للعب أعلى أو أقل!" : "Join Higher or Lower game!",
        text: isAr ? `تعال والعب معي! رمز الغرفة هو ${paramRoomId}` : `Come play with me! Room code is ${paramRoomId}`,
        url: link,
      }).catch(() => handleCopyLink());
    } else {
      handleCopyLink();
    }
  }, [paramRoomId, handleCopyLink, isAr]);

  const handleAddBot = useCallback(async () => {
    if (!higherLowerState) return;
    try {
      const names = [
        "سندباد", "علاء الدين", "شهريار", "شهد", "ياسمين", "زين",
        "Spark", "Logic", "Bluffer", "Quantum", "Alpha", "Omega"
      ];
      const botName = (isAr ? "آلي " : "Bot ") + (names[Math.floor(Math.random() * names.length)]);
      await addBot(botName, botDifficulty);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add bot", "error");
    }
  }, [addBot, botDifficulty, higherLowerState, addToast, isAr]);

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
    navigate("/higher-lower");
  }, [resetGame, navigate]);

  if (!reconnected) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Loading...</p>
      </div>
    );
  }

  // If not joined yet, show join name dialog
  if (!isInRoom) {
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
        <Panel style={{ width: "100%", maxWidth: 400, padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{c.joinTitle}</h1>
            <p style={{ fontSize: 18, color: COLORS.red, fontWeight: 700, margin: "6px 0" }}>
              {c.roomLabel}: {paramRoomId}
            </p>
          </div>

          <Field label={c.yourName} align={textAlign}>
            <input
              style={inputStyle(textAlign)}
              type="text"
              placeholder={c.namePlaceholder}
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              maxLength={12}
            />
          </Field>

          <PrimaryButton onClick={handleJoin} disabled={isJoining}>
            {isJoining ? c.joining : c.joinButton}
          </PrimaryButton>

          <button
            onClick={() => navigate("/higher-lower")}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              color: COLORS.textMuted,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              marginTop: 16,
              fontFamily: font,
            }}
          >
            {c.back}
          </button>
        </Panel>
      </div>
    );
  }

  const hostPlayer = higherLowerState?.players.find((p) => p.isHost);
  const myPlayer = higherLowerState?.players.find((p) => p.id === myPlayerId);
  const isHost = myPlayer?.isHost;
  const numPlayers = higherLowerState?.players.length ?? 0;
  const maxPlayers = higherLowerState?.maxPlayers ?? 6;

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
      {/* Header bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <button
          onClick={handleLeave}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: `2px solid ${COLORS.ink}`,
            background: COLORS.white,
            color: COLORS.ink,
            fontWeight: 700,
            fontSize: 14,
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: font,
          }}
        >
          <ArrowLeft size={16} />
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
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: font,
            }}
          >
            <Copy size={16} />
            {c.copy}
          </button>
          <button
            onClick={handleShare}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `2px solid ${COLORS.ink}`,
              background: COLORS.peach,
              color: COLORS.ink,
              padding: "8px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <Panel style={{ width: "100%", maxWidth: 480, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            {isAr ? "غرفة الانتظار" : "Room Lobby"}
          </h1>
          <p style={{ fontSize: 22, color: COLORS.red, fontWeight: 800, margin: "6px 0" }}>
            {paramRoomId}
          </p>
          <p style={{ fontSize: 13, color: COLORS.textSecondary, margin: 0 }}>
            <Users size={14} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: 4 }} />
            {numPlayers} / {maxPlayers} {isAr ? "لاعبين" : "players"}
          </p>
        </div>

        {/* Player lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {higherLowerState?.players.map((player) => {
            const isMe = player.id === myPlayerId;
            const pState = higherLowerState.playerStates[player.id];
            return (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `2px solid ${COLORS.ink}`,
                  background: isMe ? `${COLORS.peach}33` : COLORS.white,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {player.isBot ? (
                    <Bot size={18} style={{ color: COLORS.textMuted }} />
                  ) : (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: player.isConnected ? COLORS.teal : COLORS.disabledText }} />
                  )}
                  <span style={{ fontWeight: isMe ? 800 : 600 }}>
                    {player.name} {isMe ? `(${c.you})` : ""}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {player.isHost && (
                    <span style={{ fontSize: 11, background: COLORS.ink, color: COLORS.cream, padding: "2px 8px", borderRadius: 999 }}>
                      {c.host}
                    </span>
                  )}
                  {!player.isBot && !player.isConnected && (
                    <span style={{ fontSize: 11, color: COLORS.red }}>
                      {c.disconnected}
                    </span>
                  )}
                  {player.isBot && isHost && (
                    <button
                      onClick={() => removeBot(player.id)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: COLORS.red,
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Bot Panel (Host Only) */}
        {isHost && numPlayers < maxPlayers && (
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: `2px dashed ${COLORS.ink}`,
              marginBottom: 24,
            }}
          >
            <Field label={isAr ? "درجة ذكاء البوت" : "Bot Difficulty"} align={textAlign}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setBotDifficulty("easy")}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 999,
                    border: `2px solid ${COLORS.ink}`,
                    background: botDifficulty === "easy" ? COLORS.teal : COLORS.white,
                    color: botDifficulty === "easy" ? COLORS.cream : COLORS.ink,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {c.easy}
                </button>
                <button
                  onClick={() => setBotDifficulty("medium")}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 999,
                    border: `2px solid ${COLORS.ink}`,
                    background: botDifficulty === "medium" ? COLORS.teal : COLORS.white,
                    color: botDifficulty === "medium" ? COLORS.cream : COLORS.ink,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {c.medium}
                </button>
                <button
                  onClick={() => setBotDifficulty("hard")}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 999,
                    border: `2px solid ${COLORS.ink}`,
                    background: botDifficulty === "hard" ? COLORS.teal : COLORS.white,
                    color: botDifficulty === "hard" ? COLORS.cream : COLORS.ink,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {c.hard}
                </button>
              </div>
            </Field>

            <SecondaryButton onClick={handleAddBot} style={{ width: "100%", height: 38, padding: 0 }}>
              {c.addBot}
            </SecondaryButton>
          </div>
        )}

        {/* Start Game Action */}
        {isHost ? (
          <PrimaryButton onClick={handleStartGame} disabled={numPlayers < 2 || starting}>
            {starting ? c.starting : c.startGame}
          </PrimaryButton>
        ) : (
          <div style={{ textAlign: "center", color: COLORS.textSecondary, fontStyle: "italic", fontSize: 14 }}>
            {c.waitingForHost}
          </div>
        )}
      </Panel>
    </div>
  );
}
