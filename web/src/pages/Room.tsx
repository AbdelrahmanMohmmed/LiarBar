import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { GuideModal } from "@/components/GuideModal";
import { COLORS, uiFont } from "./theme";
import { Panel, Field, inputStyle, PrimaryButton, SecondaryButton } from "./ui";
import {
  Copy, User, Bot, Play, X, Loader2, ArrowLeft, Crown, MessageCircle, LogIn, HelpCircle, Send, Globe,
} from "lucide-react";
import type { BotDifficulty } from "@/lib/types";

const BOT_NAMES = ["Lucky", "Ace", "Deuce", "Sly", "Smokey", "Whiskey"];

export default function Room() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    gameState, myPlayerId, myRoomId, joinRoom, startGame, addBot, removeBot,
    addToast, reconnectRoom, sendChat, chatMessages,
  } = useGame();
  const { lang, toggleLang, t } = useLanguage();

  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [chatInput, setChatInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  // Track pending difficulty for the "Add Bot" button
  const [pendingDifficulty, setPendingDifficulty] = useState<BotDifficulty>("medium");

  const isInRoom = myPlayerId && gameState?.players.some((p) => p.id === myPlayerId);

  useEffect(() => {
    if (reconnected) return;
    const storedRoomId = localStorage.getItem("liarsbar_roomId");
    const storedPlayerId = localStorage.getItem("liarsbar_playerId");

    if (storedRoomId === paramRoomId && storedPlayerId && !gameState) {
      reconnectRoom(storedRoomId, storedPlayerId).then(() => {
        setReconnected(true);
      }).catch(() => {
        // Reconnection failed — user needs to join fresh
        setReconnected(true);
      });
    } else if (paramRoomId === myRoomId && isInRoom) {
      setReconnected(true);
    } else if (!gameState && !storedPlayerId) {
      // No stored credentials — show join prompt
      setReconnected(true);
    }
  }, [paramRoomId, myRoomId, gameState, reconnectRoom, reconnected, isInRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinName.trim()) {
      addToast("Enter your name first", "error");
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom(paramRoomId!, joinName.trim());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join room", "error");
    } finally {
      setIsJoining(false);
    }
  }, [joinName, paramRoomId, joinRoom, addToast]);

  useEffect(() => {
    if (gameState && gameState.phase !== "lobby" && gameState.phase !== "game_over") {
      navigate(`/game/${paramRoomId}`);
    }
  }, [gameState, paramRoomId, navigate]);

  const me = gameState?.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost === true;

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await startGame();
      navigate(`/game/${paramRoomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to start game", "error");
    } finally {
      setStarting(false);
    }
  }, [startGame, paramRoomId, navigate, addToast]);

  const handleAddBot = useCallback(async () => {
    try {
      const randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      await addBot(randomName, pendingDifficulty);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to add bot", "error");
    }
  }, [addBot, pendingDifficulty, addToast]);

  const handleRemoveBot = useCallback(async (botId: string) => {
    try {
      await removeBot(botId);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to remove bot", "error");
    }
  }, [removeBot, addToast]);

  const copyInviteLink = useCallback(() => {
    const link = `${window.location.origin}/room/${paramRoomId}`;
    navigator.clipboard.writeText(link).then(() => {
      addToast("Invite link copied!", "success");
    });
  }, [paramRoomId, addToast]);

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput("");
  }, [chatInput, sendChat]);

  // Small pill button matching the header controls on the landing page
  const pillButtonStyle = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    border: `2px solid ${COLORS.ink}`,
    background: COLORS.white,
    color: COLORS.ink,
    fontWeight: 700,
    fontSize: 13,
    padding: "8px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontFamily: font,
  } as const;

  if (isJoining) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100vh", background: COLORS.cream, fontFamily: font, color: COLORS.ink,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Loader2 size={32} color={COLORS.red} className="animate-spin" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: COLORS.textSecondary }}>{t("room.joining_room")}</p>
        </div>
      </div>
    );
  }

  if (!gameState || !isInRoom) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100vh", background: COLORS.cream, fontFamily: font, color: COLORS.ink,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "24px 16px 40px", boxSizing: "border-box",
        }}
      >
        <Panel style={{ width: "100%", maxWidth: 400, padding: 24 }}>
          <div style={{ marginBottom: 20, textAlign }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t("room.join_title")}</h2>
            <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: "6px 0 0" }}>
              {t("room.join_desc")}{" "}
              <span style={{ color: COLORS.red, fontWeight: 700, fontFamily: "monospace" }}>{paramRoomId}</span>
            </p>
          </div>

          <Field label={t("room.your_name")} align={textAlign}>
            <input
              id="joinName"
              placeholder={t("room.name_placeholder")}
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              maxLength={16}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoinRoom(); }}
              style={inputStyle(textAlign)}
            />
          </Field>

          <PrimaryButton onClick={handleJoinRoom} disabled={isJoining}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%" }}>
              <LogIn size={16} />
              {isJoining ? t("room.joining") : t("room.join_room_btn")}
            </span>
          </PrimaryButton>

          <button
            onClick={() => navigate("/")}
            style={{
              width: "100%", border: "none", background: "transparent", color: COLORS.textMuted,
              fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 16, fontFamily: font,
            }}
          >
            {t("room.back_home")}
          </button>
        </Panel>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh", background: COLORS.cream, fontFamily: font, color: COLORS.ink,
        padding: "20px 16px 40px", boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <button
            onClick={() => {
              localStorage.removeItem("liarsbar_roomId");
              localStorage.removeItem("liarsbar_playerId");
              navigate("/");
            }}
            style={pillButtonStyle}
          >
            <ArrowLeft size={16} />
            {t("room.leave")}
          </button>

          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
              {t("room.room_title")}{" "}
              <span style={{ color: COLORS.red, fontFamily: "monospace", letterSpacing: 2 }}>
                {gameState.roomId}
              </span>
            </h1>
            <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "2px 0 0" }}>
              {gameState.variant === "cards" ? t("room.playing_cards") : t("room.dominoes")} &mdash;{" "}
              {gameState.deckCount} {gameState.deckCount === 1 ? "deck" : "decks"}
              {gameState.claimType && gameState.variant === "cards" && (
                <> &mdash; <span style={{ color: COLORS.teal }}>{gameState.claimType === "suit" ? t("room.suit_claim") : t("room.rank_claim")}</span></>
              )}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setShowGuide(true)} style={{ ...pillButtonStyle, padding: 8 }} title={t("guide.title")}>
              <HelpCircle size={16} />
            </button>
            <button onClick={toggleLang} style={pillButtonStyle}>
              <Globe size={14} />
              {t("lang.switch_to")}
            </button>
            <button onClick={copyInviteLink} style={pillButtonStyle}>
              <Copy size={16} />
              {t("room.copy_invite")}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          {/* Player List */}
          <div style={{ flex: "2 1 420px", minWidth: 280 }}>
            <Panel style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
                  {t("room.players")} ({gameState.players.length}/{gameState.maxPlayers})
                </h2>
                {isHost && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={pendingDifficulty}
                      onChange={(e) => setPendingDifficulty(e.target.value as BotDifficulty)}
                      style={{
                        padding: "8px 10px", borderRadius: 999, border: `2px solid ${COLORS.ink}`,
                        background: COLORS.white, color: COLORS.ink, fontSize: 12, fontFamily: font, outline: "none",
                      }}
                    >
                      <option value="easy">{t("room.easy")}</option>
                      <option value="medium">{t("room.medium")}</option>
                      <option value="hard">{t("room.hard")}</option>
                    </select>
                    <SecondaryButton
                      onClick={handleAddBot}
                      disabled={gameState.players.length >= gameState.maxPlayers}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Bot size={16} />
                      {t("room.add_bot")}
                    </SecondaryButton>
                    <PrimaryButton
                      onClick={handleStart}
                      disabled={starting || gameState.players.length < 2}
                      style={{ width: "auto", padding: "10px 20px" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        {starting ? t("room.starting") : t("room.start")}
                      </span>
                    </PrimaryButton>
                  </div>
                )}
              </div>
              <p style={{ color: COLORS.textMuted, fontSize: 12, margin: "6px 0 16px" }}>
                {gameState.players.length < 2 ? t("room.need_players") : t("room.ready")}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 12, border: `2px solid ${COLORS.ink}`,
                      background: player.id === myPlayerId ? `${COLORS.peach}55` : COLORS.white,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center",
                          justifyContent: "center", color: COLORS.cream,
                          background: player.isBot ? COLORS.textMuted : COLORS.teal,
                        }}
                      >
                        {player.isBot ? <Bot size={18} /> : <User size={18} />}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                          {player.name}
                          {player.isHost && <Crown size={14} color={COLORS.red} />}
                          {player.id === myPlayerId && (
                            <span style={{ color: COLORS.textMuted, fontWeight: 500, fontSize: 12 }}>({t("room.you")})</span>
                          )}
                        </p>
                        <p style={{ margin: 0, color: COLORS.textMuted, fontSize: 12 }}>
                          {player.isBot ? t("room.bot") : t("room.human")}
                          {!player.isConnected && ` • ${t("room.disconnected")}`}
                        </p>
                      </div>
                    </div>
                    {isHost && player.isBot && !player.isHost && (
                      <button
                        onClick={() => handleRemoveBot(player.id)}
                        style={{ border: "none", background: "transparent", color: COLORS.red, cursor: "pointer", padding: 4 }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}

                {Array.from({
                  length: gameState.maxPlayers - gameState.players.length,
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                      borderRadius: 12, border: `2px dashed ${COLORS.disabledText}`, opacity: 0.6,
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.disabledBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={18} color={COLORS.disabledText} />
                    </div>
                    <p style={{ margin: 0, color: COLORS.disabledText, fontSize: 13 }}>{t("room.waiting")}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Chat */}
          <div style={{ flex: "1 1 260px", minWidth: 260 }}>
            <Panel style={{ padding: 20, display: "flex", flexDirection: "column", height: 420 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <MessageCircle size={16} color={COLORS.teal} />
                {t("room.chat")}
              </h2>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ fontSize: 13 }}>
                    <span style={{ color: COLORS.red, fontWeight: 700 }}>{msg.playerName}:</span>{" "}
                    <span style={{ color: COLORS.textSecondary }}>{msg.message}</span>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <p style={{ color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: 32 }}>{t("room.no_messages")}</p>
                )}
              </div>

              <form onSubmit={handleSendChat} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t("room.type_message")}
                  maxLength={200}
                  style={{ ...inputStyle(textAlign), flex: 1, padding: "8px 12px", fontSize: 13 }}
                />
                <button
                  type="submit"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", border: "none",
                    background: COLORS.teal, color: COLORS.cream, borderRadius: 12, width: 38, cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
            </Panel>
          </div>
        </div>
      </div>

      <GuideModal
        open={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </div>
  );
}
