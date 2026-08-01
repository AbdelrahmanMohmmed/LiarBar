import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

// Face-down domino tile (tile back)
function TileBack({
  width = 64,
  height = 40,
  scale = 1,
  borderRadius = 6,
}: {
  width?: number;
  height?: number;
  scale?: number;
  borderRadius?: number;
}) {
  return (
    <div
      style={{
        width: width * scale,
        height: height * scale,
        borderRadius: borderRadius * scale,
        background: "linear-gradient(135deg, #3b5b92 0%, #2c4470 100%)",
        border: `${1.5 * scale}px solid #1f2f4d`,
        boxShadow: "0 2px 5px rgba(0,0,0,0.35)",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "72%",
          height: "72%",
          borderRadius: "50%",
          border: "1.5px dashed rgba(255,255,255,0.45)",
        }}
      />
      <div style={{ position: "absolute", fontSize: Math.max(8, 10 * scale), color: "rgba(255,255,255,0.65)", fontWeight: 800 }}>
        ◆
      </div>
    </div>
  );
}

// A single tile animating from one point to another on the screen
interface Rect { x: number; y: number; w: number; h: number }
interface Point { x: number; y: number }
interface Flight {
  id: number;
  from: Point;
  to: Point;
  faceUp: boolean;
  tile?: Dominoe;
  tileTheme?: string;
  isVertical?: boolean;
  scale?: number;
  duration: number;
  shake?: boolean;
  onDone?: () => void;
}

function FlyingTile({ flight }: { flight: Flight }) {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setArrived(true));
    const t = window.setTimeout(() => flight.onDone?.(), flight.duration + 40);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dx = flight.to.x - flight.from.x;
  const dy = flight.to.y - flight.from.y;

  return (
    <div
      style={{
        position: "fixed",
        left: flight.from.x,
        top: flight.from.y,
        zIndex: 60,
        pointerEvents: "none",
        transform: `translate(${arrived ? dx : 0}px, ${arrived ? dy : 0}px) translate(-50%, -50%)`,
        transition: `transform ${flight.duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        willChange: "transform",
      }}
    >
      <div
        style={{
          animation: flight.shake
            ? "dominoInvalidShake 0.28s ease"
            : flight.faceUp
            ? "dominoTilePop 0.3s ease"
            : undefined,
        }}
      >
        {flight.faceUp && flight.tile ? (
          <DominoTile
            left={flight.tile.left}
            right={flight.tile.right}
            tileTheme={flight.tileTheme ?? "ivory"}
            isVertical={flight.isVertical ?? false}
            scale={flight.scale ?? 1}
          />
        ) : (
          <TileBack width={64} height={40} />
        )}
      </div>
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

// Helpers
const tileKey = (t: { left: number; right: number }) => `${t.left}-${t.right}`;
const toRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
const rectCenter = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

  // ---- Animation & interaction state ----
  const [flying, setFlying] = useState<Flight[]>([]);
  const [dealing, setDealing] = useState(false);
  const [dealSteps, setDealSteps] = useState<{ playerId: string; myIndex: number }[]>([]);
  const [seatCounts, setSeatCounts] = useState<Record<string, number>>({});
  const [boneyardVisualCount, setBoneyardVisualCount] = useState(0);
  const [hiddenTiles, setHiddenTiles] = useState<Record<string, boolean>>({});
  const [hiddenBoardTiles, setHiddenBoardTiles] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{
    tile: Dominoe;
    pos: Point;
    returning?: boolean;
    returnTo?: Point;
  } | null>(null);
  const [hoverEnd, setHoverEnd] = useState<"left" | "right" | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const boardEndRef = useRef<HTMLDivElement>(null);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const boneyardRef = useRef<HTMLDivElement>(null);
  const seatRefs = useRef<Record<string, HTMLDivElement>>({});
  const handTileEls = useRef<Record<string, HTMLDivElement | null>>({});
  const boardTileEls = useRef<Record<string, HTMLDivElement | null>>({});
  const handTileRects = useRef<Record<string, Rect>>({});
  const boardTileRects = useRef<Record<string, Rect>>({});
  const handRectsPrev = useRef<Record<string, Rect>>({});
  const flightIdRef = useRef(0);
  const prevRoundKeyRef = useRef<string | null>(null);
  const dealtRoundKeyRef = useRef<string | null>(null);
  const prevHandKeysRef = useRef<string[] | null>(null);
  const prevBoardKeysRef = useRef<string[] | null>(null);
  const prevCardCountsRef = useRef<Record<string, number> | null>(null);
  const pendingDrawRef = useRef<string[]>([]);
  const dealingRef = useRef(false);
  const hiddenTilesRef = useRef<Record<string, boolean>>({});
  const didDragRef = useRef(false);
  const dragStateRef = useRef<{
    tile: Dominoe;
    startRect: Rect;
    offsetX: number;
    offsetY: number;
    dragging: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const stateRef = useRef(dominoState);
  const myPlayerIdRef = useRef(myPlayerId);
  const tileThemeRef = useRef(dominoState?.tileTheme);
  const isArRef = useRef(isAr);

  stateRef.current = dominoState;
  myPlayerIdRef.current = myPlayerId;
  tileThemeRef.current = dominoState?.tileTheme;
  isArRef.current = isAr;
  hiddenTilesRef.current = hiddenTiles;

  // Launch a flying tile and auto-remove it when done
  const launchFlight = useCallback(
    (data: Omit<Flight, "id" | "onDone"> & { onFinish?: () => void }) => {
      const id = ++flightIdRef.current;
      const onFinish = data.onFinish;
      setFlying((prev) => [
        ...prev,
        {
          ...data,
          id,
          onDone: () => {
            setFlying((prev2) => prev2.filter((f) => f.id !== id));
            onFinish?.();
          },
        },
      ]);
    },
    [],
  );

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

  // ---- Detect a fresh round start and trigger the dealing animation ----
  useEffect(() => {
    const st = dominoState;
    if (!st) return;
    const key = `${st.phase}_${st.roundNumber}`;
    const prev = prevRoundKeyRef.current;
    prevRoundKeyRef.current = key;

    if (!prev) return; // First mount / reconnect: skip animation
    if (st.phase !== "playing") {
      dealtRoundKeyRef.current = null;
      return;
    }
    if (dealtRoundKeyRef.current === key) return; // Already dealt this round
    if (st.board.length > 0) return;
    const hand = st.hand;
    if (!hand || hand.length === 0) return;

    // The public broadcast may arrive before the private hand for a new round.
    // Only deal once the hand is actually the fresh set (not the previous round's).
    const handKeys = hand.map(tileKey).join(",");
    const prevHand = prevHandKeysRef.current;
    if (prevHand && prevHand.join(",") === handKeys) return;

    dealtRoundKeyRef.current = key;
    dealingRef.current = true;
    setDealing(true);
    setHiddenBoardTiles({});
    setSelectedTile(null);

    const hidden: Record<string, boolean> = {};
    hand.forEach((t) => (hidden[tileKey(t)] = true));
    setHiddenTiles(hidden);

    const players = st.players;
    const myIdx = players.findIndex((p) => p.id === myPlayerId);
    const steps: { playerId: string; myIndex: number }[] = [];
    for (let k = 0; k < 7; k++) {
      players.forEach((p, i) => steps.push({ playerId: p.id, myIndex: i === myIdx ? k : -1 }));
    }
    setDealSteps(steps);
    setSeatCounts({});
    setBoneyardVisualCount(28);
  }, [dominoState]);

  // ---- Process dealing steps one tile at a time ----
  useEffect(() => {
    if (!dealSteps.length) return;

    let i = 0;
    const interval = window.setInterval(() => {
      if (i >= dealSteps.length) {
        window.clearInterval(interval);
        dealingRef.current = false;
        setDealing(false);
        setHiddenTiles({});
        setSeatCounts({});
        setDealSteps([]);
        setBoneyardVisualCount(stateRef.current?.boneyardCount ?? 0);
        return;
      }

      const step = dealSteps[i++];
      setBoneyardVisualCount((v) => Math.max(0, v - 1));
      setSeatCounts((prev) => ({ ...prev, [step.playerId]: (prev[step.playerId] ?? 0) + 1 }));

      const fromEl = boneyardRef.current;
      const from = fromEl ? rectCenter(toRect(fromEl)) : { x: window.innerWidth / 2, y: 80 };

      if (step.playerId === myPlayerIdRef.current && step.myIndex >= 0) {
        const st = stateRef.current;
        const tile = st?.hand?.[step.myIndex];
        if (tile) {
          const key = tileKey(tile);
          const target = handTileRects.current[key];
          launchFlight({
            from,
            to: target ? rectCenter(target) : { x: window.innerWidth / 2, y: window.innerHeight - 60 },
            faceUp: true,
            tile,
            tileTheme: tileThemeRef.current,
            isVertical: tile.left === tile.right,
            duration: 300,
            onFinish: () =>
              setHiddenTiles((prev) => {
                if (!prev[key]) return prev;
                const n = { ...prev };
                delete n[key];
                return n;
              }),
          });
        }
      } else {
        const seatEl = seatRefs.current[step.playerId];
        const to = seatEl ? rectCenter(toRect(seatEl)) : { x: window.innerWidth / 2, y: 60 };
        launchFlight({ from, to, faceUp: false, duration: 300 });
      }
    }, 155);

    return () => window.clearInterval(interval);
  }, [dealSteps]);

  // ---- Detect newly drawn tiles (from boneyard into my hand) ----
  useEffect(() => {
    const st = dominoState;
    if (!st) return;
    const hand = st.hand ?? [];
    const keys = hand.map(tileKey);
    const prevKeys = prevHandKeysRef.current;

    if (prevKeys === null) {
      prevHandKeysRef.current = keys;
      return;
    }
    prevHandKeysRef.current = keys;

    if (dealingRef.current || st.phase !== "playing") return;

    const prevSet = new Set(prevKeys);
    const added = keys.filter((k) => !prevSet.has(k));
    if (!added.length) return;

    const hidden = { ...hiddenTilesRef.current };
    added.forEach((k) => (hidden[k] = true));
    setHiddenTiles(hidden);
    pendingDrawRef.current = added;
  }, [dominoState?.hand]);

  // ---- Launch draw flights once the newly drawn tiles are hidden in the hand ----
  useEffect(() => {
    if (!pendingDrawRef.current.length) return;
    const keys = pendingDrawRef.current;
    pendingDrawRef.current = [];

    const fromEl = boneyardRef.current;
    const from = fromEl ? rectCenter(toRect(fromEl)) : { x: window.innerWidth / 2, y: 80 };
    const st = stateRef.current;
    const hand = st?.hand ?? [];

    keys.forEach((key) => {
      const tile = hand.find((t) => tileKey(t) === key);
      const target = handTileRects.current[key];
      launchFlight({
        from,
        to: target ? rectCenter(target) : { x: window.innerWidth / 2, y: window.innerHeight - 60 },
        faceUp: true,
        tile,
        tileTheme: tileThemeRef.current,
        isVertical: tile ? tile.left === tile.right : false,
        duration: 340,
        onFinish: () =>
          setHiddenTiles((prev) => {
            if (!prev[key]) return prev;
            const n = { ...prev };
            delete n[key];
            return n;
          }),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenTiles]);

  // ---- Detect a tile being played (board grows) and animate it onto the board ----
  useEffect(() => {
    const st = dominoState;
    if (!st) return;
    const board = st.board;
    const keys = board.map(tileKey);
    const prevKeys = prevBoardKeysRef.current;
    prevBoardKeysRef.current = keys;

    if (prevKeys === null) return;
    if (dealingRef.current || st.phase !== "playing") return;
    if (board.length <= prevKeys.length) return;

    const newKey = keys[0] !== prevKeys[0] ? keys[0] : keys[keys.length - 1];
    const newTile = board.find((t) => tileKey(t) === newKey);

    // Which player played? (their card count decreased)
    const prevCounts = prevCardCountsRef.current ?? {};
    let playedBy: string | null = null;
    for (const p of st.players) {
      if (prevCounts[p.id] !== undefined && p.cardCount < prevCounts[p.id]) playedBy = p.id;
    }

    setHiddenBoardTiles((prev) => (prev[newKey] ? prev : { ...prev, [newKey]: true }));

    let from: Point | null = null;
    const myRect = handTileRects.current[newKey];
    if (myRect) {
      from = rectCenter(myRect);
    } else if (playedBy && seatRefs.current[playedBy]) {
      from = rectCenter(toRect(seatRefs.current[playedBy]));
    } else {
      const be = boneyardRef.current;
      from = be ? rectCenter(toRect(be)) : null;
    }

    requestAnimationFrame(() => {
      if (!from || !newTile) return;
      const target = boardTileRects.current[newKey];
      launchFlight({
        from,
        to: target ? rectCenter(target) : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        faceUp: true,
        tile: newTile,
        tileTheme: tileThemeRef.current,
        isVertical: newTile.left === newTile.right,
        duration: 320,
        onFinish: () =>
          setHiddenBoardTiles((prev) => {
            if (!prev[newKey]) return prev;
            const n = { ...prev };
            delete n[newKey];
            return n;
          }),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominoState?.board]);

  // ---- Track previous card counts for detecting who played ----
  useEffect(() => {
    if (!dominoState) return;
    const counts: Record<string, number> = {};
    dominoState.players.forEach((p) => (counts[p.id] = p.cardCount));
    prevCardCountsRef.current = counts;
  }, [dominoState?.players]);

  // ---- Measure tile rects + FLIP animation for the player's hand reflow ----
  useLayoutEffect(() => {
    const st = dominoState;
    if (!st) return;

    for (const key of Object.keys(boardTileEls.current)) {
      const el = boardTileEls.current[key];
      if (el) boardTileRects.current[key] = toRect(el);
    }

    const hand = st.hand;
    if (hand) {
      const prev = handRectsPrev.current;
      const next: Record<string, Rect> = {};
      const moved: { el: HTMLDivElement; dx: number; dy: number }[] = [];

      hand.forEach((t) => {
        const key = tileKey(t);
        const el = handTileEls.current[key];
        if (!el) return;
        const cur = toRect(el);
        next[key] = cur;
        handTileRects.current[key] = cur;
        const old = prev[key];
        if (old && (Math.abs(old.x - cur.x) > 1 || Math.abs(old.y - cur.y) > 1)) {
          moved.push({ el, dx: old.x - cur.x, dy: old.y - cur.y });
        }
      });

      handRectsPrev.current = next;

      if (moved.length) {
        document.body.offsetHeight; // reflow
        moved.forEach((m) => {
          m.el.style.transition = "none";
          m.el.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
        });
        document.body.offsetHeight; // reflow
        moved.forEach((m) => {
          m.el.style.transition = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";
          m.el.style.transform = "";
        });
        window.setTimeout(() => {
          moved.forEach((m) => (m.el.style.transition = ""));
        }, 340);
      }
    }
  }, [dominoState?.hand, dominoState?.board, hiddenTiles]);

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
    if (!isMyTurn || dealing) return;

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

  // ---- Drag & drop helpers ----
  const getDropZones = (tile: Dominoe): { end: "left" | "right"; rect: Rect }[] => {
    if (dominoState.board.length === 0) {
      const r = boardAreaRef.current ? toRect(boardAreaRef.current) : null;
      if (!r) return [];
      return [
        {
          end: "right",
          rect: { x: r.x + r.w * 0.22, y: r.y + r.h * 0.25, w: r.w * 0.56, h: r.h * 0.5 },
        },
      ];
    }

    const res: { end: "left" | "right"; rect: Rect }[] = [];
    const first = boardTileRects.current[tileKey(dominoState.board[0])];
    const last = boardTileRects.current[tileKey(dominoState.board[dominoState.board.length - 1])];
    const canLeft = tile.left === dominoState.leftEnd || tile.right === dominoState.leftEnd;
    const canRight = tile.left === dominoState.rightEnd || tile.right === dominoState.rightEnd;
    const w = 80;
    const h = 46;
    const gap = 10;

    if (first && canLeft) {
      res.push({ end: "left", rect: { x: first.x - w - gap, y: first.y + first.h / 2 - h / 2, w, h } });
    }
    if (last && canRight) {
      res.push({ end: "right", rect: { x: last.x + last.w + gap, y: last.y + last.h / 2 - h / 2, w, h } });
    }
    return res;
  };

  const computeDropEnd = (x: number, y: number, tile: Dominoe): "left" | "right" | null => {
    const zones = getDropZones(tile);
    const margin = 30;
    for (const z of zones) {
      if (
        x >= z.rect.x - margin && x <= z.rect.x + z.rect.w + margin &&
        y >= z.rect.y - margin && y <= z.rect.y + z.rect.h + margin
      ) {
        return z.end;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent, tile: Dominoe) => {
    if (!isMyTurn || dealing || dominoState.phase !== "playing") return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    dragStateRef.current = {
      tile,
      startRect: toRect(el),
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      dragging: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragStateRef.current;
    if (!d) return;
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
        d.dragging = true;
        setDrag({ tile: d.tile, pos: { x: e.clientX, y: e.clientY } });
      }
    } else {
      setDrag((prev) => (prev ? { ...prev, pos: { x: e.clientX, y: e.clientY } } : prev));
      const end = computeDropEnd(e.clientX, e.clientY, d.tile);
      setHoverEnd((prev) => (prev === end ? prev : end));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const d = dragStateRef.current;
    if (!d) return;
    dragStateRef.current = null;
    if (!d.dragging) return; // plain click handled by onClick

    didDragRef.current = true;
    const end = computeDropEnd(e.clientX, e.clientY, d.tile);
    setHoverEnd(null);

    if (end) {
      setDrag(null);
      handlePlayTile(d.tile, end);
    } else {
      const from = { x: e.clientX - d.offsetX, y: e.clientY - d.offsetY };
      const to = { x: d.startRect.x, y: d.startRect.y };
      setDrag((prev) => (prev ? { ...prev, returning: true, returnTo: to } : prev));
      launchFlight({
        from,
        to,
        faceUp: true,
        tile: d.tile,
        tileTheme: dominoState.tileTheme,
        isVertical: d.tile.left === d.tile.right,
        shake: true,
        duration: 280,
        onFinish: () => setDrag(null),
      });
    }
  };

  const handlePointerCancel = () => {
    const d = dragStateRef.current;
    if (!d) return;
    dragStateRef.current = null;
    if (!d.dragging) return;
    setHoverEnd(null);
    const pos = drag?.pos ?? { x: d.startX, y: d.startY };
    const to = { x: d.startRect.x, y: d.startRect.y };
    setDrag((prev) => (prev ? { ...prev, returning: true, returnTo: to } : prev));
    launchFlight({
      from: pos,
      to,
      faceUp: true,
      tile: d.tile,
      tileTheme: dominoState.tileTheme,
      isVertical: d.tile.left === d.tile.right,
      duration: 260,
      onFinish: () => setDrag(null),
    });
  };

  const displayBoneyardCount = dealing ? boneyardVisualCount : (dominoState.boneyardCount ?? 0);
  const dropZones = drag && !drag.returning ? getDropZones(drag.tile) : [];
  const previewZone = dropZones.find((z) => z.end === hoverEnd);

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
      <style>{`
        @keyframes dominoTilePop {
          0% { transform: scale(0.55); }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes dominoInvalidShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(-5px, 0) rotate(-4deg); }
          40% { transform: translate(5px, 0) rotate(3deg); }
          60% { transform: translate(-3px, 0) rotate(-2deg); }
          80% { transform: translate(3px, 0) rotate(1deg); }
        }
      `}</style>

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

      {/* Opponent Seats Strip */}
      {dominoState.phase === "playing" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", padding: "10px 16px 4px" }}>
          {dominoState.players.map((p) => {
            if (p.id === myPlayerId) return null;
            const count = dealing ? (seatCounts[p.id] ?? 0) : p.cardCount;
            const isActive = dominoState.activePlayerId === p.id;
            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) seatRefs.current[p.id] = el;
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 12px",
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.35)",
                  border: `1.5px solid ${isActive ? COLORS.gold : "rgba(255,255,255,0.12)"}`,
                  boxShadow: isActive ? "0 0 14px rgba(254,210,63,0.4)" : "none",
                  minWidth: 72,
                  transition: "border-color .25s ease, box-shadow .25s ease",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: isActive ? COLORS.gold : "rgba(255,255,255,0.2)",
                    color: isActive ? COLORS.ink : COLORS.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 2, minHeight: 14 }}>
                  {Array.from({ length: clamp(count, 0, 7) }).map((_, i) => (
                    <TileBack key={i} width={11} height={8} borderRadius={2} />
                  ))}
                  <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 3, fontWeight: 700 }}>{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Game Screen */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 20px 16px", position: "relative" }}>
        
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
          ref={boardAreaRef}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(0,0,0,0.15)",
            border: "3px dashed rgba(255,255,255,0.06)",
            borderRadius: 32,
            margin: "0 0 16px 0",
            padding: 16,
            overflowY: "auto",
            position: "relative",
            minHeight: 220,
            maxHeight: "55vh",
          }}
        >
          {/* Draw pile / Boneyard */}
          <div
            ref={boneyardRef}
            style={{
              position: "absolute",
              top: 12,
              right: 16,
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 52,
                height: 16 + Math.min(displayBoneyardCount, 14) * 3,
                position: "relative",
                transition: "height .25s ease",
              }}
            >
              {Array.from({ length: Math.min(displayBoneyardCount, 14) }).map((_, i) => (
                <div key={i} style={{ position: "absolute", left: 0, right: 0, bottom: i * 3 }}>
                  <TileBack width={52} height={34} />
                </div>
              ))}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                background: "rgba(0,0,0,0.5)",
                padding: "2px 8px",
                borderRadius: 999,
                color: COLORS.white,
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {isAr ? "السحبة" : "Boneyard"} · {displayBoneyardCount}
            </span>
          </div>

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
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                alignContent: "center",
                padding: "16px",
                boxSizing: "border-box",
                gap: 8,
              }}
            >
              {dominoState.board.map((tile, idx) => {
                const isDouble = tile.left === tile.right;
                const key = tileKey(tile);
                const isHidden = !!hiddenBoardTiles[key];
                return (
                  <div
                    key={key}
                    ref={(el) => {
                      boardTileEls.current[key] = el;
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      opacity: isHidden ? 0 : 1,
                      transition: "opacity .25s ease",
                    }}
                  >
                    <DominoTile
                      left={tile.left}
                      right={tile.right}
                      isVertical={isDouble}
                      tileTheme={dominoState.tileTheme}
                      scale={isMobile ? 0.7 : 0.85}
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
                const key = tileKey(tile);
                const playableDirection = getPlayableEnd(tile);
                const isPlayable = playableDirection !== null;
                const isSelected = selectedTile?.left === tile.left && selectedTile?.right === tile.right;
                const isDragging = drag?.tile.left === tile.left && drag?.tile.right === tile.right;
                const isHidden = !!hiddenTiles[key];

                return (
                  <div
                    key={key}
                    ref={(el) => {
                      handTileEls.current[key] = el;
                    }}
                    onPointerDown={(e) => handlePointerDown(e, tile)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onClick={() => {
                      if (didDragRef.current) {
                        didDragRef.current = false;
                        return;
                      }
                      handleTileClick(tile);
                    }}
                    style={{
                      position: "relative",
                      opacity: isHidden || isDragging ? 0 : 1,
                      transition: "opacity .25s ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                      pointerEvents: isHidden ? "none" : "auto",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      touchAction: "none",
                    }}
                  >
                    <DominoTile
                      left={tile.left}
                      right={tile.right}
                      tileTheme={dominoState.tileTheme}
                      isPlayable={isPlayable}
                      isSelected={isSelected}
                      onClick={undefined}
                      scale={1.05}
                    />

                    {/* Double option play popup choices */}
                    {isSelected && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ position: "absolute", bottom: "115%", left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, background: "rgba(0,0,0,0.85)", padding: 6, borderRadius: 8, boxShadow: "0 4px 10px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", zIndex: 60 }}
                      >
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
          {isMyTurn && dominoState.phase === "playing" && !dealing && (
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

      {/* Drag & Drop Overlay */}
      {drag && !drag.returning && (
        <>
          {dropZones.map((z) => (
            <div
              key={z.end}
              style={{
                position: "fixed",
                left: z.rect.x,
                top: z.rect.y,
                width: z.rect.w,
                height: z.rect.h,
                zIndex: 55,
                borderRadius: 10,
                border: `2px dashed ${hoverEnd === z.end ? "#4ade80" : "rgba(255,255,255,0.4)"}`,
                background: hoverEnd === z.end ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                transition: "all .15s ease",
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 800, color: hoverEnd === z.end ? "#4ade80" : "rgba(255,255,255,0.55)" }}>
                {isAr ? (z.end === "left" ? "يسار" : "يمين") : z.end === "left" ? "LEFT" : "RIGHT"}
              </span>
            </div>
          ))}

          {previewZone && (
            <div
              style={{
                position: "fixed",
                left: previewZone.rect.x + previewZone.rect.w / 2,
                top: previewZone.rect.y + previewZone.rect.h / 2,
                zIndex: 56,
                pointerEvents: "none",
                transform: "translate(-50%, -50%)",
                opacity: 0.92,
              }}
            >
              <div style={{ filter: "drop-shadow(0 0 10px rgba(74,222,128,0.8))", borderRadius: 8 }}>
                <DominoTile
                  left={drag.tile.left}
                  right={drag.tile.right}
                  tileTheme={dominoState.tileTheme}
                  isVertical={drag.tile.left === drag.tile.right}
                  scale={0.9}
                />
              </div>
            </div>
          )}

          {/* Dragged ghost tile following the pointer */}
          <div
            style={{
              position: "fixed",
              left: drag.pos.x,
              top: drag.pos.y,
              zIndex: 70,
              pointerEvents: "none",
              transform: "translate(-50%, -50%) scale(1.06)",
              filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.45))",
              opacity: 0.95,
            }}
          >
            <DominoTile
              left={drag.tile.left}
              right={drag.tile.right}
              tileTheme={dominoState.tileTheme}
              isVertical={drag.tile.left === drag.tile.right}
            />
          </div>
        </>
      )}

      {/* Flying tiles overlay */}
      {flying.map((f) => (
        <FlyingTile key={f.id} flight={f} />
      ))}
    </div>
  );
}
