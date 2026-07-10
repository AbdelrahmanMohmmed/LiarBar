import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { COLORS, uiFont } from "./theme";
import { playTickSfx, playWinSfx, playTimeoutSfx } from "@/utils/sfx";
import { Panel, PrimaryButton, SecondaryButton } from "./ui";
import { VoiceControls } from "@/components/VoiceControls";
import {
  ArrowLeft, Copy, Share2, MessageCircle, Send,
  ChevronUp, ChevronDown, Smile, Trophy, Clock, HelpCircle
} from "lucide-react";

const COPY = {
  ar: {
    back: "مغادرة",
    room: "الغرفة",
    howToPlay: "كيفية اللعب",
    standings: "Standings",
    targetScore: "المكسب من 10",
    yourTurn: "دورك! خمن رقمك (1-99)",
    waitingFor: "في انتظار {name}...",
    seconds: "ثانية",
    send: "إرسال",
    otherPlayers: "اللاعبين الآخرين",
    chatPlaceholder: "اكتب رسالة...",
    noMessages: "لا توجد رسائل بعد",
    roundRecapTitle: "نهاية الجولة",
    winnerName: "الفائز: {name}",
    pointsGained: "النقاط المكتسبة: +{points}",
    secretNumberLabel: "الرقم السري كان: {number}",
    nextRoundCountdown: "تبدأ الجولة التالية خلال {seconds} ثوانٍ...",
    gameOverTitle: "انتهت اللعبة!",
    overallWinner: "الفائز بالبطولة هو {name}!",
    rematch: "جولة جديدة",
    backLobby: "رجوع للغرفة",
    backHome: "الرجوع للرئيسية",
    copy: "نسخ الرابط",
    copied: "تم نسخ الرابط!",
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
    rank: "الترتيب",
    score: "النقاط",
    yourSecretNumber: "رقمك السري للجولة: {num}",
    streakText: "متتالي {streak}",
    you: "أنت",
    youWonRound: "لقد فزت بالجولة! 🎉",
  },
  en: {
    back: "Leave",
    room: "Room",
    howToPlay: "How to Play",
    standings: "Standings",
    targetScore: "Target Score: 10",
    yourTurn: "Your turn! Guess your number (1-99)",
    waitingFor: "Waiting for {name}...",
    seconds: "sec",
    send: "Send",
    otherPlayers: "Other Players",
    chatPlaceholder: "Type a message...",
    noMessages: "No messages yet",
    roundRecapTitle: "Round Finished",
    winnerName: "Winner: {name}",
    pointsGained: "Points Gained: +{points}",
    secretNumberLabel: "Secret number was: {number}",
    nextRoundCountdown: "Next round starts in {seconds}s...",
    gameOverTitle: "Game Over!",
    overallWinner: "{name} Wins the Game!",
    rematch: "Rematch",
    backLobby: "Back to Lobby",
    backHome: "Back to Home",
    copy: "Copy Link",
    copied: "Link copied!",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    rank: "Rank",
    score: "Score",
    yourSecretNumber: "Your secret number: {num}",
    streakText: "{streak} streak",
    you: "you",
    youWonRound: "You won the round! 🎉",
  },
} as const;

export default function HigherLowerGame() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    lobbyState,
    higherLowerState, myPlayerId, myRoomId, reconnectRoom,
    higherLowerGuess, higherLowerRematch, sendChat, chatMessages, addToast, resetGame
  } = useGame();

  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [reconnected, setReconnected] = useState(false);
  const [guessInput, setGuessInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync state or reconnect
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

  // Turn timer countdown sync
  useEffect(() => {
    if (!higherLowerState || higherLowerState.phase !== "playing" || !higherLowerState.turnDeadline) {
      return;
    }

    const updateTimer = () => {
      const diff = higherLowerState.turnDeadline! - Date.now();
      const seconds = Math.max(0, Math.ceil(diff / 1000));
      setTimeLeft(seconds);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [higherLowerState]);

  // Audio effects triggers
  const prevActivePlayerRef = useRef<string | null>(null);
  const prevTimeLeftRef = useRef<number>(15);

  useEffect(() => {
    if (!higherLowerState) return;

    if (higherLowerState.phase === "round_recap" && prevActivePlayerRef.current !== "recap") {
      const winnerId = higherLowerState.recap?.winnerId;
      if (winnerId === myPlayerId) {
        playWinSfx();
      }
      prevActivePlayerRef.current = "recap";
    } else if (higherLowerState.phase === "playing") {
      prevActivePlayerRef.current = higherLowerState.activePlayerId;
    }
  }, [higherLowerState, myPlayerId]);

  useEffect(() => {
    if (!higherLowerState || higherLowerState.phase !== "playing") return;

    if (higherLowerState.activePlayerId === myPlayerId) {
      // Play ticking sound on every second change
      if (timeLeft > 0 && timeLeft !== prevTimeLeftRef.current) {
        playTickSfx();
      }
      // Play timeout sound when timer hits 0
      if (timeLeft === 0 && prevTimeLeftRef.current > 0) {
        playTimeoutSfx();
      }
    }
    prevTimeLeftRef.current = timeLeft;
  }, [timeLeft, higherLowerState, myPlayerId]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

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
        text: isAr ? `رمز الغرفة هو ${paramRoomId}` : `Room code is ${paramRoomId}`,
        url: link,
      }).catch(() => handleCopyLink());
    } else {
      handleCopyLink();
    }
  }, [paramRoomId, handleCopyLink, isAr]);

  const handleSubmitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim()) return;

    const val = parseInt(guessInput, 10);
    if (isNaN(val) || val < 1 || val > 99) {
      addToast(isAr ? "يجب أن يكون التخمين بين 1 و 99" : "Guess must be between 1 and 99", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await higherLowerGuess(val);
      setGuessInput("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Guess failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput("");
  };

  const handleLeave = () => {
    resetGame();
    localStorage.removeItem("liarsbar_roomId");
    localStorage.removeItem("liarsbar_playerId");
    navigate("/higher-lower");
  };

  const handleRematch = async () => {
    try {
      await higherLowerRematch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Rematch failed", "error");
    }
  };

  if (!reconnected || !higherLowerState) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Loading...</p>
      </div>
    );
  }

  const myPlayer = higherLowerState.players.find((p) => p.id === myPlayerId);
  const isMyTurn = higherLowerState.activePlayerId === myPlayerId && higherLowerState.phase === "playing";
  const activePlayer = higherLowerState.players.find((p) => p.id === higherLowerState.activePlayerId);

  // Standings / Leaderboard layout calculation
  const rankedPlayers = [...higherLowerState.players]
    .map((p) => ({
      ...p,
      state: higherLowerState.playerStates[p.id],
    }))
    .filter((p) => p.state)
    .sort((a, b) => b.state.score - a.state.score);

  const activeState = higherLowerState.activePlayerId
    ? higherLowerState.playerStates[higherLowerState.activePlayerId]
    : null;

  const myPlayerState = myPlayerId
    ? higherLowerState.playerStates[myPlayerId]
    : null;

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
        padding: "16px 16px 80px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {/* 1. Header Navigation Bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button
          onClick={handleLeave}
          style={{
            border: `2px solid ${COLORS.ink}`,
            background: COLORS.white,
            color: COLORS.ink,
            fontWeight: 700,
            fontSize: 13,
            padding: "6px 12px",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: font,
          }}
        >
          {c.back}
        </button>

        <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.ink }}>
          {paramRoomId}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setShowHowToPlay(true)}
            style={{
              border: "none",
              background: "transparent",
              color: "#B47C3B",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: font,
              padding: "4px 8px",
            }}
          >
            {c.howToPlay}
          </button>
          {!lobbyState && <VoiceControls roomId={higherLowerState.roomId} />}
        </div>
      </div>

      {/* Standings Table Card */}
      <Panel style={{ width: "100%", maxWidth: 480, padding: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2px solid ${COLORS.cream}`, paddingBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 14 }}>
            <Trophy size={16} style={{ color: "#D4AF37" }} />
            <span>{isAr ? "النتائج" : c.standings}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary }}>
            {c.targetScore}
          </span>
        </div>

        {/* Horizontal Mini Podium */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", paddingTop: 8 }}>
          {rankedPlayers.slice(0, 3).map((player, idx) => {
            const colors = ["#D4AF37", "#C0C0C0", "#CD7F32"];
            return (
              <div key={player.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "30%" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: colors[idx] }}>
                  {idx + 1}🏆
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 80,
                  }}
                >
                  {player.name}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.red }}>
                  {player.state.score}
                </span>
                {player.state.streak > 1 && (
                  <span style={{ fontSize: 9, background: COLORS.teal, color: COLORS.cream, padding: "1px 4px", borderRadius: 4, transform: "scale(0.85)" }}>
                    {c.streakText.replace("{streak}", String(player.state.streak))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 2. Active Guess Bounds Panel */}
      <Panel
        style={{
          width: "100%",
          maxWidth: 480,
          padding: "20px 16px",
          textAlign: "center",
          marginBottom: 16,
          position: "relative",
        }}
      >
        {/* Bounds Circles */}
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 16 }}>
          {/* Lower Bound circle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: `2px solid ${COLORS.ink}`,
                background: myPlayerState?.lowerBound ? COLORS.white : COLORS.disabledBg,
                color: myPlayerState?.lowerBound ? COLORS.teal : COLORS.disabledText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 800,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              {myPlayerState?.lowerBound ?? "--"}
            </div>
            <span style={{ color: COLORS.teal, fontWeight: 800, fontSize: 16, marginTop: 4 }}>
              ↑
            </span>
          </div>

          {/* Upper Bound circle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                border: `2px solid ${COLORS.ink}`,
                background: myPlayerState?.upperBound ? COLORS.white : COLORS.disabledBg,
                color: myPlayerState?.upperBound ? COLORS.red : COLORS.disabledText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 800,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              {myPlayerState?.upperBound ?? "--"}
            </div>
            <span style={{ color: COLORS.red, fontWeight: 800, fontSize: 16, marginTop: 4 }}>
              ↓
            </span>
          </div>
        </div>

        {/* Active phase text & active player */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: COLORS.red, margin: "0 0 10px 0" }}>
          {higherLowerState.phase === "playing" && (
            isMyTurn
              ? c.yourTurn
              : c.waitingFor.replace("{name}", activePlayer?.name ?? "")
          )}
        </h2>

        {/* Turn Timer Countdown */}
        {higherLowerState.phase === "playing" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FFFBEB",
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid #FEF3C7",
            }}
          >
            <Clock size={16} style={{ color: "#F59E0B" }} />
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#D97706" }}>
              {timeLeft} {c.seconds}
            </span>
          </div>
        )}

        {/* Guess input form */}
        {isMyTurn && (
          <form onSubmit={handleSubmitGuess} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px",
                borderRadius: 14,
                border: `3px solid ${COLORS.ink}`,
                fontSize: 24,
                fontWeight: 800,
                textAlign: "center",
                outline: "none",
                background: COLORS.white,
                color: COLORS.ink,
              }}
              type="number"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="(1-99)"
              min={1}
              max={99}
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />

            <PrimaryButton onClick={() => {}} disabled={isSubmitting} style={{ border: `3px solid ${COLORS.ink}`, boxShadow: `3px 3px 0 ${COLORS.ink}` }}>
              {c.send}
            </PrimaryButton>
          </form>
        )}
      </Panel>

      {/* 3. Other Players Bounds List ("اللاعبين الآخرين") */}
      <div style={{ width: "100%", maxWidth: 480, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px 0", textAlign }}>
          {c.otherPlayers}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {higherLowerState.players.map((player) => {
            const pState = higherLowerState.playerStates[player.id];
            if (!pState) return null;

            const isCurrentAct = higherLowerState.activePlayerId === player.id && higherLowerState.phase === "playing";
            const isMe = player.id === myPlayerId;

            return (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 16,
                  border: isCurrentAct ? `3px solid #8B5CF6` : `2px solid ${COLORS.ink}`,
                  background: isMe ? "#FFFBEB" : COLORS.white,
                  boxShadow: "2px 2px 0px rgba(43,36,32,0.1)",
                  transition: "all 0.2s ease-in-out",
                  transform: isCurrentAct ? "scale(1.01)" : "scale(1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: COLORS.peach,
                      color: COLORS.ink,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      border: `1.5px solid ${COLORS.ink}`,
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                      {player.name} {isMe ? `(${c.you})` : ""}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                      {isAr ? "النقاط" : "Score"}: {pState.score}
                      {pState.streak > 1 && ` | 🔥 ${pState.streak}`}
                    </span>
                  </div>
                </div>

                {/* Bounds indicators in opposing player row */}
                <div style={{ display: "flex", gap: 12 }}>
                  {/* Lower bound value */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: `1.5px solid ${COLORS.ink}`,
                        background: pState.lowerBound ? COLORS.white : COLORS.disabledBg,
                        color: pState.lowerBound ? COLORS.teal : COLORS.disabledText,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {pState.lowerBound ?? "--"}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.teal }}>↑</span>
                  </div>

                  {/* Upper bound value */}
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        border: `1.5px solid ${COLORS.ink}`,
                        background: pState.upperBound ? COLORS.white : COLORS.disabledBg,
                        color: pState.upperBound ? COLORS.red : COLORS.disabledText,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {pState.upperBound ?? "--"}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.red }}>↓</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Round Recap Modal */}
      {higherLowerState.phase === "round_recap" && higherLowerState.recap && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43, 36, 32, 0.7)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <Panel style={{ width: "100%", maxWidth: 400, padding: 24, textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: COLORS.red, marginBottom: 12 }}>
              {c.roundRecapTitle}
            </h2>

            <div style={{ margin: "20px 0" }}>
              {higherLowerState.recap.winnerId === myPlayerId ? (
                <p style={{ fontSize: 20, fontWeight: 800, color: COLORS.teal }}>
                  {c.youWonRound}
                </p>
              ) : (
                <p style={{ fontSize: 18, fontWeight: 800 }}>
                  {c.winnerName.replace("{name}", higherLowerState.recap.winnerName)}
                </p>
              )}
              <p style={{ fontSize: 14, color: COLORS.teal, fontWeight: 700 }}>
                {c.pointsGained.replace("{points}", String(higherLowerState.recap.pointsGained))}
              </p>
            </div>

            {/* Secret Numbers Grid */}
            <div
              style={{
                background: COLORS.cream,
                borderRadius: 14,
                padding: 14,
                border: `2px solid ${COLORS.ink}`,
                marginBottom: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {Object.entries(higherLowerState.recap.secretNumbers).map(([pid, number]) => {
                const player = higherLowerState.players.find((p) => p.id === pid);
                return (
                  <div key={pid} style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                    <span>{player?.name ?? "Player"}</span>
                    <span style={{ color: COLORS.red }}>{number}</span>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic" }}>
              {c.nextRoundCountdown.replace("{seconds}", "...")}
            </p>
          </Panel>
        </div>
      )}

      {/* 5. Game Over Modal */}
      {higherLowerState.phase === "game_over" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43, 36, 32, 0.8)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(6px)",
          }}
        >
          <Panel style={{ width: "100%", maxWidth: 400, padding: 24, textAlign: "center" }}>
            <Trophy size={48} style={{ color: "#D4AF37", margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 24, fontWeight: 800, color: COLORS.red, marginBottom: 8 }}>
              {c.gameOverTitle}
            </h2>

            {higherLowerState.winnerId && (
              <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>
                {c.overallWinner.replace(
                  "{name}",
                  higherLowerState.players.find((p) => p.id === higherLowerState.winnerId)?.name ?? ""
                )}
              </p>
            )}

            {/* Overall Standings grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {rankedPlayers.map((player, idx) => (
                <div
                  key={player.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1.5px solid ${COLORS.ink}`,
                    background: player.id === higherLowerState.winnerId ? "#FEF3C7" : COLORS.white,
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  <span>{idx + 1}. {player.name}</span>
                  <span>{player.state.score} {isAr ? "نقاط" : "pts"}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {myPlayer?.isHost ? (
                <PrimaryButton onClick={handleRematch}>
                  {c.rematch}
                </PrimaryButton>
              ) : (
                <p style={{ fontSize: 12, color: COLORS.textMuted }}>
                  {isAr ? "في انتظار المضيف لبدء جولة جديدة..." : "Waiting for host to rematch..."}
                </p>
              )}
              <SecondaryButton onClick={handleLeave}>
                {c.backHome}
              </SecondaryButton>
            </div>
          </Panel>
        </div>
      )}

      {/* 6. Floating Collapsible Chat Tray (Bottom Pill-Style) */}
      <div
        style={{
          position: "fixed",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: 480,
          background: "#2E1065", // Deep purple pill color
          borderRadius: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          color: COLORS.cream,
          zIndex: 90,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflow: "hidden",
          border: `2px solid ${COLORS.cream}`,
          height: chatOpen ? 300 : 48,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Chat Header (Pill visual container) */}
        <div
          onClick={() => setChatOpen(!chatOpen)}
          style={{
            height: 48,
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} />
            {/* Show last message when collapsed */}
            {!chatOpen && chatMessages.length > 0 ? (
              <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>
                {chatMessages[chatMessages.length - 1].playerName}: {chatMessages[chatMessages.length - 1].message}
              </span>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {isAr ? "الدردشة" : "Chat"}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {chatMessages.length > 0 && !chatOpen && (
              <span style={{ background: COLORS.red, color: COLORS.cream, fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 999 }}>
                {chatMessages.length}
              </span>
            )}
            {chatOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </div>
        </div>

        {/* Expanded Messages list + input Form */}
        {chatOpen && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1E1B4B", padding: 12, overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 8, overflowX: "hidden" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ fontSize: 13, alignSelf: "flex-start", wordBreak: "break-word" }}>
                  <span style={{ color: COLORS.peach, fontWeight: 700, marginInlineEnd: 4 }}>
                    {msg.playerName}:
                  </span>
                  <span style={{ opacity: 0.9 }}>{msg.message}</span>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", color: COLORS.textMuted, fontSize: 12, marginTop: 40 }}>
                  {c.noMessages}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} style={{ display: "flex", gap: 8, marginTop: 8, flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={c.chatPlaceholder}
                maxLength={100}
                style={{
                  flex: 1,
                  background: "#312E81",
                  border: "none",
                  borderRadius: 12,
                  padding: "8px 12px",
                  color: COLORS.cream,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  background: COLORS.teal,
                  color: COLORS.cream,
                  border: "none",
                  borderRadius: 12,
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 7. How To Play Modal */}
      {showHowToPlay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43, 36, 32, 0.6)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(2px)",
          }}
        >
          <Panel style={{ width: "100%", maxWidth: 400, padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: COLORS.red, marginBottom: 12, textAlign: "center" }}>
              {isAr ? "كيفية اللعب" : "How to Play"}
            </h2>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: COLORS.textSecondary, marginBottom: 24, textAlign: isAr ? "right" : "left" }}>
              {isAr ? (
                <ol style={{ paddingInlineStart: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <li>يتم تعيين رقم سري عشوائي لكل لاعب بين 1 و 99.</li>
                  <li>تأخذون الأدوار بالدور، في دورك تقوم بتخمين رقم.</li>
                  <li>إذا كان تخمينك خاطئًا، سيتم تضييق النطاق:
                    <ul style={{ paddingInlineStart: 16, marginTop: 4 }}>
                      <li>سهم أحمر لأسفل (↓) يعني أن الرقم السري الفعلي <b>أقل</b> من تخمينك.</li>
                      <li>سهم أخضر لأعلى (↑) يعني أن الرقم الفعلي <b>أكبر</b> من تخمينك.</li>
                    </ul>
                  </li>
                  <li>أول لاعب يخمّن رقمه الصحيح يفوز بالجولة ويحصل على نقطتين.</li>
                  <li>إذا فزت بجولتين متتاليتين أو أكثر، ستحصل على <b>3 نقاط</b> بدلاً من نقطتين!</li>
                  <li>اللاعب الأول الذي يصل إلى 10 نقاط يفوز باللعبة بأكملها.</li>
                </ol>
              ) : (
                <ol style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <li>Each player is assigned a secret number between 1 and 99.</li>
                  <li>You take turns. On your turn, enter a guess.</li>
                  <li>If incorrect, your bounds will shrink:
                    <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                      <li>A red down arrow (↓) means the secret number is <b>lower</b> than your guess.</li>
                      <li>A green up arrow (↑) means the secret number is <b>higher</b> than your guess.</li>
                    </ul>
                  </li>
                  <li>The first player to guess their number wins the round (+2 points).</li>
                  <li>Winning consecutive rounds grants a streak bonus of <b>+3 points</b> instead of 2!</li>
                  <li>The first to reach 10 points wins the entire game.</li>
                </ol>
              )}
            </div>
            <PrimaryButton onClick={() => setShowHowToPlay(false)}>
              {isAr ? "فهمت" : "Got it"}
            </PrimaryButton>
          </Panel>
        </div>
      )}
    </div>
  );
}
