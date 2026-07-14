import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { COLORS, uiFont } from "./theme";
import { Panel, PrimaryButton, SecondaryButton, Badge } from "./ui";
import { VoiceControls } from "@/components/VoiceControls";
import {
  Trophy, MessageCircle, ChevronUp, ChevronDown, Send, Play, HelpCircle, AlertCircle, ArrowLeftRight
} from "lucide-react";
import type { Dominoe } from "@/lib/types";

// SVG Domino Tile Component
interface TileProps {
  left: number;
  right: number;
  tileTheme?: string;
  isPlayable?: boolean;
  isVertical?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  scale?: number;
  style?: React.CSSProperties;
}

function DominoTile({
  left,
  right,
  tileTheme = "ivory",
  isPlayable = false,
  isVertical = false,
  isSelected = false,
  onClick,
  scale = 1,
  style,
}: TileProps) {
  // Themes definition
  const themes = {
    ivory: { bg: "#FCFBF7", border: "#D8D3C9", dots: "#1E1E1E", divider: "#A19C92" },
    carbon: { bg: "#1F1F23", border: "#3F3F46", dots: "#F4F4F5", divider: "#52525B" },
    neon: { bg: "#09090B", border: "#00F2FE", dots: "#00F2FE", divider: "#00E0EC" },
  };

  const t = themes[tileTheme as keyof typeof themes] || themes.ivory;

  // Custom styling based on active playability or selection
  const tileStyle: React.CSSProperties = {
    width: isVertical ? 46 * scale : 80 * scale,
    height: isVertical ? 80 * scale : 46 * scale,
    backgroundColor: t.bg,
    borderRadius: 6 * scale,
    border: `2px solid ${isSelected ? "#FED23F" : isPlayable ? "#FEA500" : t.border}`,
    position: "relative",
    cursor: onClick ? "pointer" : "default",
    boxShadow: isSelected
      ? "0 0 12px #FED23F"
      : isPlayable
      ? "0 0 8px rgba(254, 165, 0, 0.6)"
      : "0 3px 6px rgba(0,0,0,0.15)",
    transition: "all 0.2s ease-in-out",
    flexShrink: 0,
    ...style,
  };

  // Coordinates of dots for a 40x46 area
  const getDots = (spots: number, cellX: number, cellY: number, vertical: boolean) => {
    // If vertical, cell size is 48x40. If horizontal, 40x46.
    // Let's normalize positions relative to 0-100 coordinates inside the cell
    const coordsMap = [
      [], // 0
      [[50, 50]], // 1
      [[25, 25], [75, 75]], // 2
      [[25, 25], [50, 50], [75, 75]], // 3
      [[25, 25], [25, 75], [75, 25], [75, 75]], // 4
      [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]], // 5
      [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]], // 6
    ];

    const spotsCoords = coordsMap[spots] || [];
    const cellW = vertical ? 46 : 40;
    const cellH = vertical ? 40 : 46;

    return spotsCoords.map(([px, py], idx) => {
      const cx = cellX + (px / 100) * cellW;
      const cy = cellY + (py / 100) * cellH;
      return (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={2.5 * scale}
          fill={t.dots}
          style={tileTheme === "neon" ? { filter: "drop-shadow(0 0 2px #00F2FE)" } : undefined}
        />
      );
    });
  };

  return (
    <div
      onClick={onClick}
      style={tileStyle}
      className={isPlayable && onClick ? "hover:-translate-y-1" : undefined}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${isVertical ? 46 : 80} ${isVertical ? 80 : 46}`}
        style={{ display: "block" }}
      >
        {isVertical ? (
          <>
            {/* Vertical Divider line */}
            <line x1="2" y1="40" x2="44" y2="40" stroke={t.divider} strokeWidth="1.5" />
            {/* Center Brass Pin */}
            <circle cx="23" cy="40" r="2.5" fill="#D4AF37" stroke="#9A7B1C" strokeWidth="0.5" />
            {/* Dots */}
            {getDots(left, 0, 0, true)}
            {getDots(right, 0, 40, true)}
          </>
        ) : (
          <>
            {/* Horizontal Divider line */}
            <line x1="40" y1="2" x2="40" y2="44" stroke={t.divider} strokeWidth="1.5" />
            {/* Center Brass Pin */}
            <circle cx="40" cy="23" r="2.5" fill="#D4AF37" stroke="#9A7B1C" strokeWidth="0.5" />
            {/* Dots */}
            {getDots(left, 0, 0, false)}
            {getDots(right, 40, 0, false)}
          </>
        )}
      </svg>
    </div>
  );
}

const COPY = {
  ar: {
    back: "مغادرة",
    roomLabel: "رمز الغرفة",
    targetScore: "الفورة من",
    boneyard: "السحبة",
    turnTime: "الوقت المتبقي",
    sec: "ث",
    yourTurn: "دورك!",
    noPlayDraw: "ليس لديك لعب، اسحب من السحبة",
    noPlayPass: "ليس لديك لعب والسحبة فارغة، مرر الدور",
    othersTurn: "دور:",
    emptyBoard: "لوحة اللعب فارغة. العب أي قطعة للبدء!",
    playLeft: "يمين",
    playRight: "يسار",
    passButton: "تمرير الدور",
    drawButton: "سحب قطعة",
    roundRecapTitle: "نهاية الجولة",
    winnerLabel: "الفائز بالجولة:",
    reasonLabel: "طريقة الفوز:",
    pointsGained: "النقاط المكتسبة:",
    scoresHeader: "النقاط الإجمالية",
    nextRoundCountdown: "تبدأ الجولة التالية خلال",
    methodDomino: "تنزيل كل القطع (دومينو)",
    methodBlock: "إقفال اللعب (قفلة)",
    drawRound: "جولة تعادل (لا نقاط)",
    handsReveal: "قطع اللاعبين في نهاية الجولة:",
    gameOverTitle: "🏆 نهاية اللعبة 🏆",
    gameWinner: "الفائز باللقب هو:",
    rematch: "لعب مجدداً",
    teamA: "الفريق (أ)",
    teamB: "الفريق (ب)",
    pts: "نقطة",
    chatPlaceholder: "اكتب رسالة...",
    chatTitle: "المحادثة",
    noMessages: "لا توجد رسائل بعد",
    howToPlayTitle: "كيف تلعب الدومينو الكلاسيكية؟",
    howToPlayText: "1. يبدأ الجولة من يملك أعلى قطعة دبل (مثل 6-6).\n2. يجب عليك لعب قطعة تطابق أحد الأرقام المفتوحة في طرفي السلسلة.\n3. إذا لم تجد قطعة مناسبة، يجب أن تسحب من السحبة حتى تجد واحدة.\n4. إذا كانت السحبة فارغة، يجب تمرير الدور (Pass).\n5. تنتهي الجولة عندما ينهي أحد اللاعبين قطعه، أو تقفل اللعبة (لا أحد يملك لعباً والسحبة فارغة).\n6. الفائز بالدورة يكسب مجموع نقاط قطع الآخرين.",
  },
  en: {
    back: "Leave",
    roomLabel: "Room",
    targetScore: "Target",
    boneyard: "Boneyard",
    turnTime: "Turn Time",
    sec: "s",
    yourTurn: "Your Turn!",
    noPlayDraw: "No moves, draw from boneyard",
    noPlayPass: "No moves and boneyard empty, pass turn",
    othersTurn: "Turn:",
    emptyBoard: "The board is empty. Play any tile to start!",
    playLeft: "Play Left",
    playRight: "Play Right",
    passButton: "Pass Turn",
    drawButton: "Draw Tile",
    roundRecapTitle: "Round Finished",
    winnerLabel: "Round Winner:",
    reasonLabel: "Winning Method:",
    pointsGained: "Points Gained:",
    scoresHeader: "Total Scores",
    nextRoundCountdown: "Starting next round in",
    methodDomino: "Cleared hand (Domino)",
    methodBlock: "Board blocked (Locked)",
    drawRound: "Draw round (No points)",
    handsReveal: "Player hands at round end:",
    gameOverTitle: "🏆 Game Over 🏆",
    gameWinner: "The champion is:",
    rematch: "Rematch",
    teamA: "Team A",
    teamB: "Team B",
    pts: "pts",
    chatPlaceholder: "Type a message...",
    chatTitle: "Chat Lobby",
    noMessages: "No messages yet",
    howToPlayTitle: "How to Play Classic Dominoes?",
    howToPlayText: "1. The player with the highest double tile (e.g. 6-6) starts the round.\n2. On your turn, place a tile from your hand matching either of the open ends.\n3. If you cannot make a play, draw from the boneyard until you get a playable tile.\n4. If the boneyard is empty, you must Pass your turn.\n5. The round ends when a player empties their hand, or the board becomes Locked.\n6. The winner scores points equal to the total spots of opponents' remaining tiles.",
  },
} as const;

export default function DominoGame() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    dominoState, myPlayerId, chatMessages, sendChat,
    dominoPlayTile, dominoDrawTile, dominoPass, dominoRematch, resetGame, addToast
  } = useGame();

  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const c = COPY[isAr ? "ar" : "en"];
  const dir = isAr ? "rtl" : "ltr";
  const font = uiFont(isAr);
  const textAlign = isAr ? "right" : "left";

  const [selectedTile, setSelectedTile] = useState<Dominoe | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardEndRef = useRef<HTMLDivElement>(null);

  // SFX play on board state change (placing tile sound)
  const lastBoardLength = useRef(dominoState?.board?.length ?? 0);
  useEffect(() => {
    const boardLen = dominoState?.board?.length ?? 0;
    if (boardLen > lastBoardLength.current) {
      import("@/utils/sfx").then(({ playTileSfx }) => playTileSfx());
    }
    lastBoardLength.current = boardLen;
  }, [dominoState?.board?.length]);

  // Responsive device checks
  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-scroll chat and board chain
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

  useEffect(() => {
    if (dominoState?.board.length) {
      boardEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
    }
  }, [dominoState?.board.length]);

  // Turn countdown timer
  useEffect(() => {
    if (!dominoState?.turnDeadline || dominoState.phase !== "playing") {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((dominoState.turnDeadline! - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [dominoState?.turnDeadline, dominoState?.phase]);

  if (!dominoState) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.cream, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <p style={{ fontFamily: font, color: COLORS.ink }}>Reconnecting to game room...</p>
        <SecondaryButton onClick={() => navigate("/domino")}>{isAr ? "الرئيسية" : "Home"}</SecondaryButton>
      </div>
    );
  }

  const myPlayer = dominoState.players.find((p) => p.id === myPlayerId);
  const isMyTurn = dominoState.activePlayerId === myPlayerId;
  const isMeHost = myPlayer?.isHost ?? false;

  // Determine valid play options for each tile in hand
  const getPlayableEnd = (tile: Dominoe): "left" | "right" | "both" | null => {
    if (dominoState.board.length === 0) return "both"; // Empty board starts anywhere

    const matchesLeft = tile.left === dominoState.leftEnd || tile.right === dominoState.leftEnd;
    const matchesRight = tile.left === dominoState.rightEnd || tile.right === dominoState.rightEnd;

    if (matchesLeft && matchesRight) return "both";
    if (matchesLeft) return "left";
    if (matchesRight) return "right";
    return null;
  };

  const handleTileClick = (tile: Dominoe) => {
    if (!isMyTurn) return;

    const playDirection = getPlayableEnd(tile);
    if (!playDirection) return;

    if (playDirection === "both") {
      setSelectedTile(tile);
    } else {
      // If only one option, play it instantly to streamline turns
      setSelectedTile(null);
      handlePlayTile(tile, playDirection);
    }
  };

  const handlePlayTile = async (tile: Dominoe, end: "left" | "right") => {
    try {
      await dominoPlayTile(tile, end);
      setSelectedTile(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Play failed", "error");
    }
  };

  const handleDrawTile = async () => {
    try {
      await dominoDrawTile();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Draw failed", "error");
    }
  };

  const handlePass = async () => {
    try {
      await dominoPass();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Pass failed", "error");
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
    navigate("/domino");
  };

  // Verify if player has any playable tiles in hand
  const hasPlayableTiles = myPlayer && dominoState.hand
    ? dominoState.hand.some((t) => getPlayableEnd(t) !== null)
    : false;

  // Active player info
  const activePlayerObj = dominoState.players.find((p) => p.id === dominoState.activePlayerId);

  // Background style based on tableTheme
  const getTableBg = () => {
    if (dominoState.tableTheme === "slate") return COLORS.tableSlate;
    if (dominoState.tableTheme === "wood") return COLORS.tableWood;
    return COLORS.tableGreen;
  };

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        background: getTableBg(),
        fontFamily: font,
        color: COLORS.white,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Device Rotation Warning */}
      {isPortrait && (
        <div style={{
          background: "linear-gradient(135deg, #fed23f 0%, #e7a339 100%)",
          color: COLORS.ink,
          padding: "8px 16px",
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          zIndex: 100,
        }}>
          <span>
            {isAr
              ? "🔄 للحصول على أفضل تجربة لعب، يرجى تدوير هاتفك للوضع الأفقي."
              : "🔄 For the best gameplay experience, please rotate your device to landscape."}
          </span>
        </div>
      )}

      {/* Top Navbar HUD */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          background: "rgba(0,0,0,0.5)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(5px)",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleLeave}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: COLORS.white,
              borderRadius: 999,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              fontFamily: font,
            }}
          >
            {c.back}
          </button>
          {/* Render Inline Scoreboard in place of room and target */}
          {dominoState.gameMode === "teams" ? (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", display: "flex", gap: 8, alignItems: "center" }}>
              <strong style={{ color: COLORS.teal }}>{isAr ? "أ" : "A"}: {dominoState.teamScores.A}</strong>
              <span style={{ opacity: 0.3 }}>|</span>
              <strong style={{ color: COLORS.red }}>{isAr ? "ب" : "B"}: {dominoState.teamScores.B}</strong>
              <span style={{ fontSize: 11, opacity: 0.5 }}>({isAr ? "الفورة من" : "Target"}: {dominoState.targetScore})</span>
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {dominoState.players.map((p, idx) => (
                <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  {idx > 0 && <span style={{ opacity: 0.3, marginRight: 3 }}>|</span>}
                  <strong style={{ fontWeight: dominoState.activePlayerId === p.id ? 800 : 500, color: dominoState.activePlayerId === p.id ? COLORS.gold : COLORS.white }}>
                    {p.name}: {p.score}
                  </strong>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>({p.cardCount}🎴)</span>
                </span>
              ))}
              <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 4 }}>({isAr ? "الفورة من" : "Target"}: {dominoState.targetScore})</span>
            </span>
          )}
        </div>

        {/* Timer Banner */}
        {dominoState.phase === "playing" && activePlayerObj && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: isMyTurn ? "rgba(254, 210, 63, 0.2)" : "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: 12, border: isMyTurn ? `1.5px solid ${COLORS.gold}` : "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {isMyTurn ? c.yourTurn : `${c.othersTurn} ${activePlayerObj.name}`}
            </span>
            {timeRemaining !== null && (
              <span style={{ fontWeight: 800, color: timeRemaining <= 10 ? COLORS.red : COLORS.gold, fontSize: 12 }}>
                ({timeRemaining}{c.sec})
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => setShowHowToPlay(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <HelpCircle size={18} />
          </button>
          <VoiceControls roomId={dominoState.roomId} />
          
          {/* Top Navbar Chat Toggle */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            style={{
              background: chatOpen ? COLORS.gold : "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: chatOpen ? COLORS.ink : COLORS.white,
              borderRadius: 999,
              padding: "6px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 700,
              fontSize: 12,
              fontFamily: font,
            }}
          >
            <MessageCircle size={14} style={{ color: chatOpen ? COLORS.ink : COLORS.gold }} />
            {chatMessages.length > 0 && !chatOpen && (
              <span style={{ background: COLORS.red, color: COLORS.white, borderRadius: "50%", padding: "1px 5px", fontSize: 9 }}>
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      </div>



      {/* Main Game Screen */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px", position: "relative" }}>
        
        {/* Scores Board HUD Card */}
        {dominoState.phase !== "playing" && (
          <div style={{ alignSelf: "center", display: "flex", gap: 16, background: "rgba(0,0,0,0.6)", padding: "10px 20px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.15)", marginBottom: 12, width: "100%", maxWidth: 500, justifyContent: "space-around" }}>
            {dominoState.gameMode === "teams" ? (
              <>
                {/* Teams score HUD */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: COLORS.teal, fontWeight: 800 }}>{c.teamA} (0-2)</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: COLORS.teal }}>
                    {dominoState.teamScores.A} <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>/ {dominoState.targetScore}</span>
                  </span>
                </div>
                <div style={{ borderRight: "1px solid rgba(255,255,255,0.2)" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: COLORS.red, fontWeight: 800 }}>{c.teamB} (1-3)</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: COLORS.red }}>
                    {dominoState.teamScores.B} <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>/ {dominoState.targetScore}</span>
                  </span>
                </div>
              </>
            ) : (
              // Solo Mode Score listings
              dominoState.players.map((p) => {
                const active = dominoState.activePlayerId === p.id;
                return (
                  <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2px 8px", borderRadius: 8, border: active ? `1.5px solid ${COLORS.gold}` : "1.5px solid transparent", background: active ? "rgba(254, 210, 63, 0.1)" : "transparent" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, opacity: p.isConnected ? 1 : 0.5 }}>{p.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.gold }}>
                      {p.score} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{c.pts}</span>
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>🎴 {p.cardCount}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Center: Scrollless Winding Snake Wrapping Board */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(0,0,0,0.15)",
            border: "3px dashed rgba(255,255,255,0.06)",
            borderRadius: 32,
            margin: "0 0 20px 0",
            padding: 16,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {dominoState.board.length === 0 ? (
            <div style={{ textAlign: "center", maxWidth: 300 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎴</div>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                {c.emptyBoard}
              </p>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                maxHeight: "100%",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-start",
                alignContent: "center",
                padding: "16px",
                boxSizing: "border-box",
                gap: 8,
                overflowY: "auto",
              }}
            >
              {dominoState.board.map((tile, idx) => {
                const isDouble = tile.left === tile.right;
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center" }}>
                    <DominoTile
                      left={tile.left}
                      right={tile.right}
                      isVertical={isDouble}
                      tileTheme={dominoState.tileTheme}
                      scale={0.75}
                    />
                  </div>
                );
              })}
              <div ref={boardEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Section: Private Player Hand Tray */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 30 }}>
          {myPlayer && dominoState.phase === "playing" && (
            <div style={{ width: "100%", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
              {dominoState.hand?.map((tile, idx) => {
                const playableDirection = getPlayableEnd(tile);
                const isPlayable = playableDirection !== null;
                const isSelected = selectedTile?.left === tile.left && selectedTile?.right === tile.right;

                return (
                  <div key={idx} style={{ position: "relative" }}>
                    <DominoTile
                      left={tile.left}
                      right={tile.right}
                      tileTheme={dominoState.tileTheme}
                      isPlayable={isPlayable}
                      isSelected={isSelected}
                      onClick={() => handleTileClick(tile)}
                      scale={1.05}
                    />

                    {/* Double option play popup choices */}
                    {isSelected && (
                      <div style={{ position: "absolute", bottom: "115%", left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, background: "rgba(0,0,0,0.85)", padding: 6, borderRadius: 8, boxShadow: "0 4px 10px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", zIndex: 60 }}>
                        <button
                          onClick={() => handlePlayTile(tile, "left")}
                          style={{
                            background: COLORS.teal,
                            color: COLORS.white,
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: font,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.playLeft}
                        </button>
                        <button
                          onClick={() => handlePlayTile(tile, "right")}
                          style={{
                            background: COLORS.red,
                            color: COLORS.white,
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: font,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.playRight}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Action trigger deck/buttons (Draw / Pass / Turn hints) */}
          {isMyTurn && dominoState.phase === "playing" && (
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {!hasPlayableTiles && dominoState.boneyardCount > 0 && (
                <button
                  onClick={handleDrawTile}
                  style={{
                    background: "linear-gradient(135deg, #fed23f 0%, #e7a339 100%)",
                    color: COLORS.ink,
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(254, 210, 63, 0.5)",
                    fontFamily: font,
                  }}
                >
                  {c.drawButton} ({dominoState.boneyardCount})
                </button>
              )}

              {!hasPlayableTiles && dominoState.boneyardCount === 0 && (
                <button
                  onClick={handlePass}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.red} 0%, #a82e24 100%)`,
                    color: COLORS.white,
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(232, 87, 74, 0.4)",
                    fontFamily: font,
                  }}
                >
                  {c.passButton}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide-out Sidebar Chat Drawer */}
      {chatOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            [isAr ? "left" : "right"]: 0,
            width: "100%",
            maxWidth: 340,
            background: "rgba(13, 14, 18, 0.98)",
            borderLeft: isAr ? "none" : "2px solid rgba(255,255,255,0.15)",
            borderRight: isAr ? "2px solid rgba(255,255,255,0.15)" : "none",
            boxShadow: "0 0 30px rgba(0,0,0,0.7)",
            zIndex: 150,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          {/* Drawer Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{c.chatTitle}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Room: {dominoState.roomId}</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: COLORS.white,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: font,
              }}
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>

          {/* Drawer Message Logs */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, wordBreak: "break-word" }}>
                <strong style={{ color: COLORS.gold }}>{msg.playerName}:</strong>{" "}
                <span style={{ color: "rgba(255,255,255,0.9)" }}>{msg.message}</span>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 40 }}>
                {c.noMessages}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Drawer Chat Input Form */}
          <form onSubmit={handleSendChat} style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={c.chatPlaceholder}
              maxLength={200}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "8px 12px",
                color: COLORS.white,
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                background: COLORS.gold,
                border: "none",
                borderRadius: 8,
                width: 38,
                height: 38,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Send size={16} color={COLORS.ink} />
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Round End Recap Panel */}
      {dominoState.phase === "round_recap" && dominoState.recap && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
          <Panel style={{ width: "100%", maxWidth: 500, padding: 24, background: COLORS.white, color: COLORS.ink }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, textAlign: "center", color: COLORS.ink, margin: "0 0 16px 0" }}>
              {c.roundRecapTitle}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.disabledBg}`, paddingBottom: 6 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.winnerLabel}</span>
                <span style={{ fontWeight: 800, color: COLORS.teal }}>
                  {dominoState.recap.winnerId
                    ? `${dominoState.recap.winnerName} ${dominoState.gameMode === "teams" ? `(${dominoState.recap.winnerTeam === "A" ? c.teamA : c.teamB})` : ""}`
                    : c.drawRound}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.disabledBg}`, paddingBottom: 6 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.reasonLabel}</span>
                <span style={{ fontWeight: 700 }}>
                  {dominoState.recap.method === "domino" ? c.methodDomino : dominoState.recap.method === "block" ? c.methodBlock : ""}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.disabledBg}`, paddingBottom: 6 }}>
                <span style={{ color: COLORS.textSecondary }}>{c.pointsGained}</span>
                <span style={{ fontWeight: 800, color: COLORS.red, fontSize: 18 }}>
                  +{dominoState.recap.pointsGained} {isAr ? "نقطة" : "pts"}
                </span>
              </div>
            </div>

            {/* Revealing hands details */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: COLORS.textSecondary, marginBottom: 12, textAlign }}>
                {c.handsReveal}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {dominoState.players.map((p) => {
                  const tiles = dominoState.recap?.playerHands[p.id] || [];
                  const isWinner = p.id === dominoState.recap?.winnerId;
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.cream, padding: "6px 10px", borderRadius: 10, border: isWinner ? `1.5px solid ${COLORS.teal}` : "1.5px solid transparent" }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</span>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {tiles.length === 0 ? (
                          <span style={{ fontSize: 11, color: COLORS.teal, fontWeight: 800 }}>Domino!</span>
                        ) : (
                          tiles.map((t, idx) => (
                            <DominoTile
                              key={idx}
                              left={t.left}
                              right={t.right}
                              tileTheme={dominoState.tileTheme}
                              scale={0.4}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: COLORS.textMuted, fontSize: 12 }}>
              <AlertCircle size={14} />
              <span>{c.nextRoundCountdown}...</span>
            </div>
          </Panel>
        </div>
      )}

      {/* MODAL: Game Over Screen */}
      {dominoState.phase === "game_over" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <Panel style={{ width: "100%", maxWidth: 450, padding: 32, textAlign: "center", background: COLORS.white, color: COLORS.ink }}>
            <Trophy size={64} color="#D4AF37" style={{ margin: "0 auto 16px" }} />
            <h1 style={{ fontSize: 28, fontWeight: 900, color: COLORS.ink, margin: "0 0 10px 0" }}>
              {c.gameOverTitle}
            </h1>
            
            <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: "0 0 20px 0" }}>
              {c.gameWinner}
            </p>

            <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.red, marginBottom: 24 }}>
              {dominoState.players.find((p) => p.id === dominoState.winnerId)?.name || "Player"}
            </div>

            <div style={{ background: COLORS.cream, borderRadius: 16, padding: 16, marginBottom: 32 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px 0", color: COLORS.textSecondary }}>
                {c.scoresHeader}
              </h3>
              {dominoState.gameMode === "teams" ? (
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.teal }}>{c.teamA}</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{dominoState.teamScores.A}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.red }}>{c.teamB}</div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>{dominoState.teamScores.B}</div>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dominoState.players.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 800 }}>{p.score} {c.pts}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isMeHost ? (
              <PrimaryButton onClick={dominoRematch}>
                {c.rematch}
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={handleLeave}>
                {isAr ? "الخروج للقائمة" : "Back to lobby"}
              </SecondaryButton>
            )}
          </Panel>
        </div>
      )}

      {/* MODAL: How to Play */}
      {showHowToPlay && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}>
          <Panel style={{ width: "100%", maxWidth: 450, padding: 24, background: COLORS.white, color: COLORS.ink }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px 0", textAlign: "center" }}>
              {c.howToPlayTitle}
            </h2>
            <div style={{ whiteSpace: "pre-line", fontSize: 13, lineHeight: 1.6, color: COLORS.textSecondary, marginBottom: 24, textAlign }}>
              {c.howToPlayText}
            </div>
            <PrimaryButton onClick={() => setShowHowToPlay(false)}>
              {isAr ? "موافق" : "Got it"}
            </PrimaryButton>
          </Panel>
        </div>
      )}
    </div>
  );
}
