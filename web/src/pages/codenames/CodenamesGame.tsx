import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import type { CodenamesRole, CodenamesTeam, CodenamesCardType, CodenamesLogEntry } from "@/lib/types";
import { COLORS, uiFont, boardFont } from "./theme";
import { Panel, PrimaryButton, SecondaryButton, Badge, inputStyle } from "./ui";

const COPY = {
  ar: {
    back: "الرئيسية",
    leave: "مغادرة",
    roomLabel: "الغرفة",
    copy: "نسخ",
    copied: "تم نسخ رمز الغرفة!",
    redTeam: "الفريق الأحمر",
    tealTeam: "الفريق الأزرق المخضرّ",
    spymaster: "قائد التلميح",
    operative: "مخمّن",
    giveClue: "أعطِ تلميحاً",
    clueWord: "كلمة التلميح",
    clueCount: "عدد الكلمات",
    yourTurnClue: "دورك! أعطِ تلميحاً لفريقك",
    yourTurnGuess: "دور فريقك — خمّنوا!",
    waitingClue: "بانتظار تلميح القائد…",
    endTurn: "إنهاء الدور",
    guessesLeft: "تخمينات متبقية",
    redTurn: "دور الفريق الأحمر",
    tealTurn: "دور الفريق الأزرق المخضرّ",
    cluePhase: "ينتظر التلميح…",
    guessPhase: "يخمنون…",
    gameLog: "سجل اللعبة",
    submitClue: "إرسال التلميح",
    cluePlaceholder: "كلمة واحدة فقط",
    allRevealedReason: "تم كشف جميع الكلمات!",
    assassinReason: "كشفوا بطاقة الاغتيال! 💀",
    winnerOverlay: "فاز {team}!",
    playAgain: "العب مرة أخرى",
    roleLabel: "دورك: {role} ({team})",
    noTeam: "بدون فريق",
    unassigned: "غير معين",
    neutral: "محايد",
    assassin: "الاغتيال",
    playersList: "اللاعبون",
    connecting: "جاري الاتصال...",
    viewBoard: "عرض اللوحة",
    showOverlay: "عرض شاشة الفوز",
    clueRequired: "الرجاء كتابة كلمة التلميح",
    clueNoSpaces: "يجب أن يكون التلميح كلمة واحدة فقط",
    clueTooLong: "التلميح طويل جداً (أقصى حد 30 حرفاً)",
    clueMatchesBoard: "لا يمكن للتلميح مطابقة كلمة غير مكتشفة على اللوحة",
    you: "أنت",
    disconnected: "غير متصل",
  },
  en: {
    back: "Home",
    leave: "Leave",
    roomLabel: "Room",
    copy: "Copy",
    copied: "Room code copied!",
    redTeam: "Red Team",
    tealTeam: "Teal Team",
    spymaster: "Spymaster",
    operative: "Operative",
    giveClue: "Give a Clue",
    clueWord: "Clue Word",
    clueCount: "Count",
    yourTurnClue: "Your turn! Give your team a clue",
    yourTurnGuess: "Your team's turn — guess!",
    waitingClue: "Waiting for the spymaster's clue…",
    endTurn: "End Turn",
    guessesLeft: "guesses left",
    redTurn: "Red Team's Turn",
    tealTurn: "Teal Team's Turn",
    cluePhase: "waiting for clue…",
    guessPhase: "guessing…",
    gameLog: "Game Log",
    submitClue: "Submit Clue",
    cluePlaceholder: "Single word only",
    allRevealedReason: "All words revealed!",
    assassinReason: "Hit the assassin! 💀",
    winnerOverlay: "{team} Wins!",
    playAgain: "Play Again",
    roleLabel: "Your Role: {role} ({team})",
    noTeam: "No Team",
    unassigned: "Unassigned",
    neutral: "neutral",
    assassin: "assassin",
    playersList: "Players",
    connecting: "Connecting...",
    viewBoard: "View Board",
    showOverlay: "Show Winner Screen",
    clueRequired: "Please enter a clue word",
    clueNoSpaces: "Clue must be a single word",
    clueTooLong: "Clue is too long (max 30 chars)",
    clueMatchesBoard: "Clue cannot match an unrevealed word on the board",
    you: "you",
    disconnected: "offline",
  },
} as const;

function normalizeWord(word: string, lang: "ar" | "en"): string {
  const trimmed = word.trim();
  if (lang === "en") {
    return trimmed.toLowerCase();
  }
  return trimmed
    .replace(/[ً-ْ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

export default function CodenamesGame() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    codenamesState,
    myPlayerId,
    myRoomId,
    reconnectRoom,
    codenamesGiveClue,
    codenamesGuess,
    codenamesEndTurn,
    codenamesRematch,
    addToast,
  } = useGame();

  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [reconnected, setReconnected] = useState(false);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);
  const [rematching, setRematching] = useState(false);
  const [givingClue, setGivingClue] = useState(false);
  const [endingTurn, setEndingTurn] = useState(false);
  const [showLogMobile, setShowLogMobile] = useState(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(true);

  const isInRoom = myPlayerId && codenamesState?.players.some((p) => p.id === myPlayerId);

  // Reconnection logic
  useEffect(() => {
    if (reconnected) return;
    const storedRoomId = localStorage.getItem("liarsbar_roomId");
    const storedPlayerId = localStorage.getItem("liarsbar_playerId");

    if (storedRoomId === paramRoomId && storedPlayerId && !codenamesState) {
      reconnectRoom(storedRoomId, storedPlayerId)
        .then(() => setReconnected(true))
        .catch(() => setReconnected(true));
    } else if (paramRoomId === myRoomId && isInRoom) {
      setReconnected(true);
    } else if (!codenamesState && !storedPlayerId) {
      setReconnected(true);
    }
  }, [paramRoomId, myRoomId, codenamesState, reconnectRoom, reconnected, isInRoom]);

  // Phase navigation back to lobby
  useEffect(() => {
    if (codenamesState && codenamesState.phase === "lobby") {
      navigate(`/codenames/room/${paramRoomId}`);
    }
  }, [codenamesState, paramRoomId, navigate]);

  // Automatically show the finished game overlay when phase becomes finished
  useEffect(() => {
    if (codenamesState?.phase === "finished") {
      setShowGameOverOverlay(true);
    }
  }, [codenamesState?.phase]);

  const handleLeaveRoom = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const copyRoomCode = useCallback(() => {
    if (!paramRoomId) return;
    navigator.clipboard.writeText(paramRoomId).then(() => addToast(c.copied, "success"));
  }, [paramRoomId, addToast, c]);

  const handleGiveClue = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codenamesState) return;

    const trimmed = clueWord.trim();
    if (!trimmed) {
      addToast(c.clueRequired, "error");
      return;
    }
    if (trimmed.includes(" ")) {
      addToast(c.clueNoSpaces, "error");
      return;
    }
    if (trimmed.length > 30) {
      addToast(c.clueTooLong, "error");
      return;
    }

    // Client-side check against board unrevealed words
    const unrevealed = codenamesState.board.filter((card) => !card.revealed).map((card) => card.word);
    const normalizedClue = normalizeWord(trimmed, codenamesState.language);
    const normalizedBoardWords = unrevealed.map((w) => normalizeWord(w, codenamesState.language));

    if (normalizedBoardWords.includes(normalizedClue)) {
      addToast(c.clueMatchesBoard, "error");
      return;
    }

    setGivingClue(true);
    try {
      await codenamesGiveClue(trimmed, clueCount);
      setClueWord("");
      setClueCount(1);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to give clue", "error");
    } finally {
      setGivingClue(false);
    }
  }, [clueWord, clueCount, codenamesState, codenamesGiveClue, addToast, c]);

  const handleCardClick = useCallback(async (index: number) => {
    if (!codenamesState || !myPlayerId) return;
    const assignments = codenamesState.assignments;
    const me = assignments[myPlayerId];
    const turn = codenamesState.turn;

    const canClick =
      codenamesState.phase === "playing" &&
      turn &&
      turn.phase === "guess" &&
      me?.team === turn.team &&
      me?.role === "operative" &&
      !codenamesState.board[index].revealed;

    if (!canClick) return;

    try {
      await codenamesGuess(index);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to submit guess", "error");
    }
  }, [codenamesState, myPlayerId, codenamesGuess, addToast]);

  const handleEndTurn = useCallback(async () => {
    setEndingTurn(true);
    try {
      await codenamesEndTurn();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to end turn", "error");
    } finally {
      setEndingTurn(false);
    }
  }, [codenamesEndTurn, addToast]);

  const handleRematch = useCallback(async () => {
    setRematching(true);
    try {
      await codenamesRematch();
      setShowGameOverOverlay(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to start rematch", "error");
    } finally {
      setRematching(false);
    }
  }, [codenamesRematch, addToast]);

  // Return loading screen if state is not loaded yet
  if (!codenamesState || !isInRoom) {
    return (
      <div
        dir={dir}
        style={{
          minHeight: "100vh",
          background: COLORS.cream,
          color: COLORS.ink,
          fontFamily: font,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>{c.connecting}</div>
      </div>
    );
  }

  const { assignments, players, board, turn, clue, log, winner, winReason } = codenamesState;
  const me = players.find((p) => p.id === myPlayerId);
  const myAssignment = assignments[myPlayerId || ""];
  const myTeam = myAssignment?.team ?? null;
  const myRole = myAssignment?.role ?? null;
  const isHost = me?.isHost === true;

  const isCurrentTeamTurn = turn && myTeam === turn.team;
  const isMyRoleTurn = turn && ((turn.phase === "clue" && myRole === "spymaster") || (turn.phase === "guess" && myRole === "operative"));
  const isMyTurn = isCurrentTeamTurn && isMyRoleTurn;

  const spymasterKey = codenamesState.key;
  const isSpymaster = myRole === "spymaster";

  // Check if player can click any card
  const getCanClickCard = (cardIdx: number) => {
    return (
      codenamesState.phase === "playing" &&
      turn &&
      turn.phase === "guess" &&
      isCurrentTeamTurn &&
      myRole === "operative" &&
      !board[cardIdx].revealed
    );
  };

  const teamMembers = (team: CodenamesTeam | null, role?: CodenamesRole) =>
    players.filter((p) => {
      const a = assignments[p.id];
      const t = a?.team ?? null;
      if (t !== team) return false;
      if (role && a?.role !== role) return false;
      return true;
    });

  const getTeamName = (team: CodenamesTeam) => {
    return team === "red" ? c.redTeam : c.tealTeam;
  };

  const getRoleIcon = (role: CodenamesRole) => {
    return role === "spymaster" ? "♦" : "●";
  };

  const renderLogEntry = (entry: CodenamesLogEntry, idx: number) => {
    const teamName = entry.team === "red" ? c.redTeam : c.tealTeam;
    const teamColor = entry.team === "red" ? COLORS.red : COLORS.teal;

    if (entry.kind === "clue") {
      return (
        <div key={idx} style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
          <strong style={{ color: teamColor }}>{entry.player}</strong> ({teamName}):{" "}
          <span>
            {isAr ? `أعطى تلميحاً «${entry.word}» - ${entry.count}` : `gave clue "${entry.word}" - ${entry.count}`}
          </span>
        </div>
      );
    }
    if (entry.kind === "guess") {
      let resultName: string = entry.result;
      if (isAr) {
        if (entry.result === "red") resultName = "أحمر";
        else if (entry.result === "teal") resultName = "أزرق مخضرّ";
        else if (entry.result === "neutral") resultName = c.neutral;
        else if (entry.result === "assassin") resultName = c.assassin;
      }
      return (
        <div key={idx} style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
          <strong style={{ color: teamColor }}>{entry.player}</strong> ({teamName}):{" "}
          <span>
            {isAr ? `خمّن «${entry.word}» ← ${resultName}` : `guessed "${entry.word}" -> ${resultName}`}
          </span>
        </div>
      );
    }
    if (entry.kind === "pass") {
      return (
        <div key={idx} style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
          <strong style={{ color: teamColor }}>{entry.player}</strong> ({teamName}):{" "}
          <span>{isAr ? "أنهى الدور" : "passed turn"}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        background: COLORS.cream,
        color: COLORS.ink,
        fontFamily: font,
        padding: "16px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes dc-pop-in {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes dc-shake {
          0%, 100% { transform: translate(2px, 2px) translateX(0); }
          20%, 60% { transform: translate(2px, 2px) translateX(-4px); }
          40%, 80% { transform: translate(2px, 2px) translateX(4px); }
        }
        @keyframes dc-float-badge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .cn-pop-in {
          animation: dc-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .cn-shake {
          animation: dc-shake 0.4s ease-in-out;
        }
        .cn-float {
          animation: dc-float-badge 2s ease-in-out infinite;
        }
        .cn-main-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          max-width: 1080px;
          margin: 0 auto;
        }
        .cn-board-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cn-side-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cn-board-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 850px) {
          .cn-main-grid {
            grid-template-columns: 1fr 300px;
          }
          .cn-mobile-only-log {
            display: none !important;
          }
        }
        @media (max-width: 849px) {
          .cn-desktop-only-log {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <button
            onClick={handleLeaveRoom}
            style={{
              border: `2px solid ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            {isAr ? `${c.leave} ←` : `← ${c.leave}`}
          </button>

          {/* User role indicator */}
          <div
            style={{
              fontFamily: font,
              fontWeight: 800,
              fontSize: 14,
              color: myTeam === "red" ? COLORS.red : myTeam === "teal" ? COLORS.teal : COLORS.textSecondary,
              background: COLORS.white,
              border: `2px solid ${COLORS.ink}`,
              padding: "6px 14px",
              borderRadius: 999,
            }}
          >
            {myTeam
              ? c.roleLabel
                  .replace("{role}", myRole === "spymaster" ? c.spymaster : c.operative)
                  .replace("{team}", getTeamName(myTeam))
              : c.unassigned}
          </div>

          <button
            onClick={copyRoomCode}
            style={{
              border: `2px dashed ${COLORS.ink}`,
              background: COLORS.white,
              color: COLORS.ink,
              fontFamily: "'Baloo 2', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 999,
              cursor: "pointer",
              letterSpacing: 2,
            }}
            title={c.copy}
          >
            {c.roomLabel}: {codenamesState.roomId}
          </button>
        </div>

        {/* Main Grid */}
        <div className="cn-main-grid">
          {/* Board Column */}
          <div className="cn-board-col">
            {/* Turn and Score Banner */}
            <Panel
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {turn ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      background: turn.team === "red" ? COLORS.red : COLORS.teal,
                      color: COLORS.cream,
                      padding: "6px 14px",
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                    className="cn-float"
                  >
                    {turn.team === "red" ? c.redTurn : c.tealTurn}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.textSecondary }}>
                    {turn.phase === "clue" ? c.cluePhase : c.guessPhase}
                  </span>
                </div>
              ) : (
                <div />
              )}

              {/* Score indicators */}
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    background: COLORS.red,
                    color: COLORS.cream,
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {codenamesState.remaining.red} ●
                </span>
                <span
                  style={{
                    background: COLORS.teal,
                    color: COLORS.cream,
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {codenamesState.remaining.teal} ●
                </span>
              </div>
            </Panel>

            {/* The 5x5 Board */}
            <div className="cn-board-grid">
              {board.map((card, idx) => {
                const isRevealed = card.revealed;
                // If revealed, we use the server-provided card type.
                // If unrevealed and we are spymaster, we use the key type.
                const trueType = isRevealed ? card.type : (isSpymaster && spymasterKey ? spymasterKey[idx] : undefined);
                const canClick = getCanClickCard(idx);

                // Card states
                let background: string = COLORS.white;
                let color: string = COLORS.ink;
                let boxShadow = "3px 3px 0 rgba(43,36,32,0.25)";
                let transform = "translate(0, 0)";

                if (isRevealed) {
                  boxShadow = "none";
                  transform = "translate(2px, 2px)";
                  if (card.type === "red") {
                    background = COLORS.red;
                    color = COLORS.cream;
                  } else if (card.type === "teal") {
                    background = COLORS.teal;
                    color = COLORS.cream;
                  } else if (card.type === "neutral") {
                    background = COLORS.peach;
                    color = COLORS.ink;
                  } else if (card.type === "assassin") {
                    background = COLORS.ink;
                    color = COLORS.cream;
                  }
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleCardClick(idx)}
                    className={`cn-pop-in ${isRevealed && card.type === "assassin" ? "cn-shake" : ""}`}
                    style={{
                      background,
                      color,
                      border: `2px solid ${COLORS.ink}`,
                      borderRadius: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      aspectRatio: "4/3",
                      padding: 6,
                      boxSizing: "border-box",
                      fontFamily: boardFont(codenamesState.language),
                      fontWeight: 800,
                      fontSize: codenamesState.language === "ar" ? "clamp(12px, 3.5vw, 18px)" : "clamp(11px, 3vw, 16px)",
                      userSelect: "none",
                      boxShadow,
                      transform,
                      cursor: canClick ? "pointer" : "default",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    <span style={{ opacity: isRevealed && card.type === "neutral" ? 0.6 : 1 }}>
                      {card.word.toUpperCase()}
                    </span>

                    {/* Spymaster key diamond indicator */}
                    {isSpymaster && !isRevealed && trueType && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          [isAr ? "left" : "right"]: 6,
                          width: 8,
                          height: 8,
                          background:
                            trueType === "red"
                              ? COLORS.red
                              : trueType === "teal"
                              ? COLORS.teal
                              : trueType === "neutral"
                              ? "#8A7F73"
                              : COLORS.ink,
                          transform: "rotate(45deg)",
                          borderRadius: 2,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Interaction panel: Clue form or Guess status */}
            <Panel style={{ padding: 18 }}>
              {codenamesState.phase === "playing" && turn ? (
                <>
                  {turn.phase === "clue" ? (
                    isMyTurn ? (
                      // Clue Form for Spymaster
                      <form onSubmit={handleGiveClue}>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, textAlign }}>
                          {c.yourTurnClue}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <input
                              value={clueWord}
                              onChange={(e) => setClueWord(e.target.value)}
                              placeholder={c.cluePlaceholder}
                              maxLength={30}
                              style={inputStyle(textAlign)}
                              disabled={givingClue}
                            />
                          </div>

                          <div style={{ width: 80 }}>
                            <select
                              value={clueCount}
                              onChange={(e) => setClueCount(parseInt(e.target.value, 10))}
                              style={inputStyle("center")}
                              disabled={givingClue}
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>

                          <PrimaryButton
                            onClick={() => {}}
                            disabled={givingClue || !clueWord.trim()}
                            color={turn.team === "red" ? COLORS.red : COLORS.teal}
                            style={{ flexShrink: 0, width: "auto" }}
                          >
                            {givingClue ? (isAr ? "جارٍ الإرسال..." : "Sending...") : c.submitClue}
                          </PrimaryButton>
                        </div>
                      </form>
                    ) : (
                      // Waiting for Spymaster
                      <div style={{ textAlign: "center", padding: 8, color: COLORS.textSecondary, fontWeight: 700 }}>
                        {c.waitingClue}
                      </div>
                    )
                  ) : (
                    // Guess Phase
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        {clue ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: 20,
                                fontWeight: 800,
                                color: turn.team === "red" ? COLORS.red : COLORS.teal,
                              }}
                            >
                              «{clue.word.toUpperCase()}» — {clue.count}
                            </span>
                            <span
                              style={{
                                background: COLORS.disabledBg,
                                color: COLORS.textSecondary,
                                padding: "4px 10px",
                                borderRadius: 999,
                                fontSize: 13,
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {clue.guessesRemaining} {c.guessesLeft}
                              <span style={{ display: "flex", gap: 3 }}>
                                {Array.from({ length: clue.guessesRemaining }).map((_, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      background: turn.team === "red" ? COLORS.red : COLORS.teal,
                                    }}
                                  />
                                ))}
                              </span>
                            </span>
                          </div>
                        ) : null}

                        {isCurrentTeamTurn && myRole === "operative" && (
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: COLORS.textSecondary, textAlign }}>
                            {c.yourTurnGuess}
                          </p>
                        )}
                      </div>

                      {/* Operatives can pass/end turn */}
                      {isCurrentTeamTurn && myRole === "operative" ? (
                        <SecondaryButton onClick={handleEndTurn} disabled={endingTurn}>
                          {endingTurn ? (isAr ? "جارٍ الإنهاء..." : "Ending...") : c.endTurn}
                        </SecondaryButton>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", color: COLORS.textMuted, fontWeight: 700 }}>—</div>
              )}
            </Panel>

            {/* Mobile Game Log toggle */}
            <button
              className="cn-mobile-only-log-toggle"
              onClick={() => setShowLogMobile(!showLogMobile)}
              style={{
                border: `2px solid ${COLORS.ink}`,
                background: COLORS.paleTeal,
                color: COLORS.ink,
                fontFamily: font,
                fontWeight: 700,
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: 999,
                cursor: "pointer",
                width: "100%",
              }}
            >
              {showLogMobile ? (isAr ? "إخفاء السجل ✕" : "Hide Log ✕") : (isAr ? "عرض سجل اللعبة 📋" : "Show Game Log 📋")}
            </button>

            {/* Mobile collapsible log */}
            {showLogMobile && (
              <div className="cn-mobile-only-log" style={{ width: "100%" }}>
                <Panel style={{ padding: 16, background: COLORS.paleTeal }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      marginBottom: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{c.gameLog}</span>
                    <button
                      onClick={() => setShowLogMobile(false)}
                      style={{ background: "none", border: "none", color: COLORS.ink, fontSize: 16, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ maxHeight: 150, overflowY: "auto" }}>
                    {[...log].reverse().map((entry, idx) => renderLogEntry(entry, idx))}
                    {log.length === 0 && (
                      <div style={{ fontSize: 13, color: COLORS.textMuted }}>—</div>
                    )}
                  </div>
                </Panel>
              </div>
            )}
          </div>

          {/* Side Column (Log and Player list) */}
          <div className="cn-side-col">
            {/* Desktop Game Log */}
            <div className="cn-desktop-only-log">
              <Panel style={{ padding: 16, background: COLORS.paleTeal }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, textAlign }}>{c.gameLog}</div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {[...log].reverse().map((entry, idx) => renderLogEntry(entry, idx))}
                  {log.length === 0 && (
                    <div style={{ fontSize: 13, color: COLORS.textMuted, textAlign }}>—</div>
                  )}
                </div>
              </Panel>
            </div>

            {/* Players Panel */}
            <Panel style={{ padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, textAlign }}>{c.playersList}</div>

              {/* Red Team Section */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.red, marginBottom: 6, textAlign }}>
                  {c.redTeam} ({teamMembers("red").length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {teamMembers("red", "spymaster").map((p) => (
                    <PlayerRow key={p.id} player={p} isYou={p.id === myPlayerId} roleIcon={getRoleIcon("spymaster")} c={c} />
                  ))}
                  {teamMembers("red", "operative").map((p) => (
                    <PlayerRow key={p.id} player={p} isYou={p.id === myPlayerId} roleIcon={getRoleIcon("operative")} c={c} />
                  ))}
                </div>
              </div>

              {/* Teal Team Section */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.teal, marginBottom: 6, textAlign }}>
                  {c.tealTeam} ({teamMembers("teal").length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {teamMembers("teal", "spymaster").map((p) => (
                    <PlayerRow key={p.id} player={p} isYou={p.id === myPlayerId} roleIcon={getRoleIcon("spymaster")} c={c} />
                  ))}
                  {teamMembers("teal", "operative").map((p) => (
                    <PlayerRow key={p.id} player={p} isYou={p.id === myPlayerId} roleIcon={getRoleIcon("operative")} c={c} />
                  ))}
                </div>
              </div>

              {/* Unassigned Section */}
              {teamMembers(null).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, marginBottom: 6, textAlign }}>
                    {c.noTeam}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {teamMembers(null).map((p) => (
                      <PlayerRow key={p.id} player={p} isYou={p.id === myPlayerId} c={c} />
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {/* Game Over Overlay Modal */}
      {codenamesState.phase === "finished" && showGameOverOverlay && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(43,36,32,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <Panel
            style={{
              padding: "32px 24px",
              maxWidth: 400,
              width: "100%",
              textAlign: "center",
              animation: "dc-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              background: winner === "red" ? COLORS.red : COLORS.teal,
              color: COLORS.cream,
            }}
          >
            <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 8px" }}>
              {winner ? c.winnerOverlay.replace("{team}", getTeamName(winner)) : ""}
            </h2>
            <p style={{ fontSize: 16, color: COLORS.cream, opacity: 0.9, marginBottom: 24 }}>
              {winReason === "assassin" ? c.assassinReason : c.allRevealedReason}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {isHost ? (
                <PrimaryButton
                  onClick={handleRematch}
                  disabled={rematching}
                  color={COLORS.cream}
                  style={{ color: COLORS.ink, width: "100%" }}
                >
                  {rematching ? (isAr ? "جاري البدء..." : "Starting...") : c.playAgain}
                </PrimaryButton>
              ) : (
                <p style={{ fontSize: 14, color: COLORS.cream, opacity: 0.8 }}>
                  {isAr ? "بانتظار المضيف لبدء مباراة جديدة..." : "Waiting for host to start a rematch..."}
                </p>
              )}

              <button
                onClick={() => setShowGameOverOverlay(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: COLORS.cream,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {c.viewBoard}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* Button to show the game over overlay again if closed */}
      {codenamesState.phase === "finished" && !showGameOverOverlay && (
        <div style={{ position: "fixed", bottom: 20, [isAr ? "left" : "right"]: 20, zIndex: 99 }}>
          <PrimaryButton
            onClick={() => setShowGameOverOverlay(true)}
            color={winner === "red" ? COLORS.red : COLORS.teal}
            style={{ width: "auto", padding: "10px 18px", boxShadow: `3px 3px 0 ${COLORS.ink}`, border: `2px solid ${COLORS.ink}` }}
          >
            {c.showOverlay}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  isYou,
  roleIcon,
  c,
}: {
  player: { id: string; name: string; isHost: boolean; isConnected: boolean };
  isYou: boolean;
  roleIcon?: string;
  c: { you: string; disconnected: string };
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px",
        borderRadius: 10,
        background: COLORS.peach,
        fontSize: 13,
        fontWeight: 700,
        opacity: player.isConnected ? 1 : 0.5,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{player.name}</span>
        {roleIcon && <span style={{ color: COLORS.textSecondary }}>{roleIcon}</span>}
        {player.isHost && " ♦"}
        {isYou && <span style={{ fontWeight: 400, fontSize: 11, color: COLORS.textSecondary }}>({c.you})</span>}
      </div>
      {!player.isConnected && (
        <span style={{ fontWeight: 400, fontSize: 11, color: COLORS.textMuted }}>· {c.disconnected}</span>
      )}
    </div>
  );
}
