import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";
import { VoiceControls } from "@/components/VoiceControls";
import { MessageCircle, Send, Crown, UserX } from "lucide-react";
import { flagImageUrl } from "@/lib/utils";

const CELL_SIZE = 78;       // each tile is 78×78 — compact board, less vertical scroll
const CORNER = CELL_SIZE;   // corners are square
const INNER_TILES = 9;      // tiles between corners on each side
const BOARD_W = CORNER + INNER_TILES * CELL_SIZE + CORNER; // 1100
const BOARD_H = CORNER + INNER_TILES * CELL_SIZE + CORNER; // 1100 square
const CANVAS_W = BOARD_W + 40;               // board padding only (sidebar is now DOM, not canvas)
const CANVAS_H = BOARD_H + 40;

const PLAYER_COLORS = ["#2dd4bf", "#f5a524", "#38bdf8", "#c084fc", "#fb7185", "#a3e635"];

// Token hop-animation tuning
const STEP_MS = 140;          // duration of a single-tile hop during a normal dice move
const JUMP_MS = 550;          // duration of a teleport-style jump (cards, jail, etc.)
const JUMP_HEIGHT_STEP = 16;  // arc height (px) for a single-tile hop
const JUMP_HEIGHT_BIG = 42;   // arc height (px) for a teleport jump

const withAlpha = (hex: string, alpha: number) => {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
};


interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- Drawn country flags (no external assets) ----
type FCtx = CanvasRenderingContext2D;
const rect = (c: FCtx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const circle = (c: FCtx, x: number, y: number, r: number, col: string) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
const hStripes = (c: FCtx, x: number, y: number, w: number, h: number, cols: string[]) => { const s = h / cols.length; cols.forEach((col, i) => rect(c, x, y + i * s, w, s + 0.6, col)); };
const vStripes = (c: FCtx, x: number, y: number, w: number, h: number, cols: string[]) => { const s = w / cols.length; cols.forEach((col, i) => rect(c, x + i * s, y, s + 0.6, h, col)); };
function star(c: FCtx, cx: number, cy: number, r: number, col: string, pts = 5) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const rad = i % 2 === 0 ? r : r / 2.4;
    const a = (Math.PI / pts) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath(); c.fill();
}
const HASH = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c"];
const hashCols = (code: string): string[] => {
  let n = 0; for (const ch of code) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return [HASH[n % 6], HASH[(n >> 3) % 6], HASH[(n >> 6) % 6]];
};

const FLAG_SPECS: Record<string, (c: FCtx, x: number, y: number, w: number, h: number) => void> = {
  US: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#B22234", "#fff", "#B22234", "#fff", "#B22234", "#fff", "#B22234"]); rect(c, x, y, w * 0.42, h / 2, "#3C3B6E"); },
  GB: (c, x, y, w, h) => { rect(c, x, y, w, h, "#012169"); rect(c, x + w / 2 - 1, y, 2, h, "#fff"); rect(c, x, y + h / 2 - 1, w, 2, "#fff"); rect(c, x + w / 2 - 0.6, y, 1.2, h, "#C8102E"); rect(c, x, y + h / 2 - 0.6, w, 1.2, "#C8102E"); },
  FR: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#0055A4", "#fff", "#EF4135"]),
  DE: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#000", "#DD0000", "#FFCE00"]),
  IT: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#009246", "#fff", "#CE2B37"]),
  ES: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#AA151B", "#F1BF00", "#AA151B"]),
  RU: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#fff", "#0039A6", "#D52B1E"]),
  NL: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#AE1C28", "#fff", "#21468B"]),
  IE: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#169B62", "#fff", "#FF883E"]),
  BR: (c, x, y, w, h) => { rect(c, x, y, w, h, "#009C3B"); c.fillStyle = "#FFDF00"; c.beginPath(); c.moveTo(x + w / 2, y + h * 0.1); c.lineTo(x + w * 0.95, y + h / 2); c.lineTo(x + w / 2, y + h * 0.9); c.lineTo(x + w * 0.05, y + h / 2); c.closePath(); c.fill(); circle(c, x + w / 2, y + h / 2, h * 0.16, "#002776"); },
  JP: (c, x, y, w, h) => { rect(c, x, y, w, h, "#fff"); circle(c, x + w / 2, y + h / 2, h * 0.3, "#BC002D"); },
  CN: (c, x, y, w, h) => { rect(c, x, y, w, h, "#DE2910"); star(c, x + w * 0.22, y + h * 0.32, h * 0.18, "#FFDE00"); [[0.5, 0.2], [0.62, 0.38], [0.58, 0.62], [0.42, 0.78]].forEach(([sx, sy]) => star(c, x + w * sx, y + h * sy, h * 0.07, "#FFDE00")); },
  KR: (c, x, y, w, h) => { rect(c, x, y, w, h, "#fff"); circle(c, x + w * 0.5, y + h / 2, h * 0.28, "#CD2E3A"); c.save(); c.globalCompositeOperation = "destination-out"; circle(c, x + w * 0.5, y + h / 2, h * 0.2, "#fff"); c.restore(); rect(c, x + w * 0.5 - h * 0.04, y + h / 2 - h * 0.28, h * 0.08, h * 0.56, "#0047A0"); },
  IN: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#FF9933", "#fff", "#138808"]); circle(c, x + w / 2, y + h / 2, h * 0.12, "#000080"); },
  PK: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#fff", "#01411C"]),
  BD: (c, x, y, w, h) => { rect(c, x, y, w, h, "#006A4E"); circle(c, x + w / 2, y + h / 2, h * 0.26, "#F42A41"); },
  ID: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#CE1126", "#fff", "#CE1126"]),
  SA: (c, x, y, w, h) => { rect(c, x, y, w, h, "#006C35"); rect(c, x + w * 0.12, y + h * 0.28, w * 0.76, h * 0.44, "#fff"); },
  AE: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#C8102E", "#00732F", "#fff", "#000"]),
  EG: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#CE1126", "#fff", "#000"]),
  JO: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#000", "#fff", "#007A3D"]); rect(c, x, y, w * 0.28, h, "#CE1126"); star(c, x + w * 0.14, y + h / 2, h * 0.16, "#fff"); },
  MA: (c, x, y, w, h) => { rect(c, x, y, w, h, "#C1272D"); star(c, x + w / 2, y + h / 2, h * 0.3, "#006233", 5); },
  TN: (c, x, y, w, h) => { rect(c, x, y, w, h, "#E70013"); circle(c, x + w / 2, y + h / 2, h * 0.24, "#fff"); star(c, x + w / 2, y + h / 2, h * 0.16, "#E70013"); },
  DZ: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#006233", "#fff", "#D21034"]),
  IQ: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#CE1126", "#fff", "#000"]),
  SY: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#CE1126", "#fff", "#000"]); star(c, x + w * 0.2, y + h / 2, h * 0.12, "#007A3D"); star(c, x + w * 0.34, y + h / 2, h * 0.12, "#007A3D"); },
  LB: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#ED1C24", "#fff", "#00A551"]),
  PS: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#000", "#fff", "#007A3D"]); c.fillStyle = "#CE1126"; c.beginPath(); c.moveTo(x, y); c.lineTo(w * 0.4, y + h / 2); c.lineTo(x, y + h); c.closePath(); c.fill(); },
  KW: (c, x, y, w, h) => { vStripes(c, x, y, w, h, ["#007A3D", "#fff", "#CE1126"]); c.fillStyle = "#000"; c.beginPath(); c.moveTo(x, y); c.lineTo(w * 0.28, y); c.lineTo(x, y + h); c.closePath(); c.fill(); },
  QA: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#8A1538", "#fff"]),
  OM: (c, x, y, w, h) => { vStripes(c, x, y, w, h, ["#CE1126", "#fff", "#007A3D"]); },
  TR: (c, x, y, w, h) => { rect(c, x, y, w, h, "#E30A17"); circle(c, x + w * 0.42, y + h / 2, h * 0.22, "#fff"); circle(c, x + w * 0.48, y + h / 2, h * 0.18, "#E30A17"); },
  CA: (c, x, y, w, h) => { vStripes(c, x, y, w, h, ["#fff", "#FF0000", "#fff"]); rect(c, x + w / 2 - h * 0.12, y + h * 0.2, h * 0.24, h * 0.6, "#FF0000"); },
  AU: (c, x, y, w, h) => { rect(c, x, y, w, h, "#00247D"); rect(c, x, y, w * 0.42, h / 2, "#012169"); rect(c, x + w * 0.21 - 1, y, 2, h / 2, "#fff"); rect(c, x, y + h / 4 - 1, w * 0.42, 2, "#fff"); star(c, x + w * 0.78, y + h / 2, h * 0.28, "#fff", 7); },
  GR: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#0D5EAF", "#fff", "#0D5EAF", "#fff", "#0D5EAF"]),
  MX: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#006847", "#fff", "#CE1126"]),
  AR: (c, x, y, w, h) => hStripes(c, x, y, w, h, ["#74ACDF", "#fff", "#74ACDF"]),
  ZA: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#E03C31", "#fff", "#002395", "#fff", "#007749"]); rect(c, x, y, w * 0.28, h, "#000"); },
  CO: (c, x, y, w, h) => { rect(c, x, y, w, h * 0.5, "#FCD116"); rect(c, x, y + h * 0.5, w, h * 0.25, "#003893"); rect(c, x, y + h * 0.75, w, h * 0.25, "#CE1126"); },
  EC: (c, x, y, w, h) => { rect(c, x, y, w, h * 0.5, "#FFDD00"); rect(c, x, y + h * 0.5, w, h * 0.25, "#034EA2"); rect(c, x, y + h * 0.75, w, h * 0.25, "#ED1C24"); circle(c, x + w / 2, y + h / 2, h * 0.14, "#FCD116"); },
  PE: (c, x, y, w, h) => vStripes(c, x, y, w, h, ["#D91023", "#fff", "#D91023"]),
  CL: (c, x, y, w, h) => { rect(c, x, y, w, h, "#fff"); rect(c, x, y + h / 2, w, h / 2, "#D52B1E"); rect(c, x, y, w * 0.34, h / 2, "#0039A6"); star(c, x + w * 0.17, y + h * 0.25, h * 0.16, "#fff"); },
  UY: (c, x, y, w, h) => { hStripes(c, x, y, w, h, ["#fff", "#0038A8", "#fff", "#0038A8", "#fff"]); rect(c, x, y, w * 0.4, h * 0.4, "#fff"); circle(c, x + w * 0.2, y + h * 0.2, h * 0.12, "#FCD116"); },
};

function drawFlag(ctx: FCtx, code: string | undefined, x: number, y: number, w: number, h: number) {
  const c = (code || "").toUpperCase();
  ctx.save();
  const spec = FLAG_SPECS[c];
  if (spec) spec(ctx, x, y, w, h);
  else hStripes(ctx, x, y, w, h, hashCols(c || "??"));
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}


// Map board position → canvas (x,y) for rectangular perimeter
function getTilePos(i: number): { x: number; y: number; w: number; h: number } {
  if (i <= 10) {
    // Bottom row: left → right (0=GO corner, 10=Jail corner)
    if (i === 0)  return { x: 0,                       y: BOARD_H - CORNER, w: CORNER, h: CORNER };
    if (i === 10) return { x: CORNER + INNER_TILES * CELL_SIZE, y: BOARD_H - CORNER, w: CORNER, h: CORNER };
    return           { x: CORNER + (i - 1) * CELL_SIZE,   y: BOARD_H - CORNER, w: CELL_SIZE, h: CORNER };
  }
  if (i <= 19) {
    // Right column: bottom → top (11-19, all inner tiles)
    const vi = i - 10; // 1..9
    return { x: BOARD_W - CORNER, y: BOARD_H - CORNER - vi * CELL_SIZE, w: CORNER, h: CELL_SIZE };
  }
  if (i <= 30) {
    // Top row: right → left (20=FreeParking corner, 30=GoToJail corner)
    if (i === 20) return { x: BOARD_W - CORNER, y: 0, w: CORNER, h: CORNER };
    if (i === 30) return { x: 0,                       y: 0, w: CORNER, h: CORNER };
    const ri = 30 - i; // 1..9 from left
    return           { x: CORNER + (ri - 1) * CELL_SIZE, y: 0, w: CELL_SIZE, h: CORNER };
  }
  // Left column: top → bottom (31-39, all inner tiles)
  const vi = i - 30; // 1..9
  return { x: 0, y: CORNER + (vi - 1) * CELL_SIZE, w: CORNER, h: CELL_SIZE };
}

export default function RentoLobbyGame(props?: { state?: any; myPlayerId?: string }) {
  const { lobbyState, myPlayerId: ctxMyId, chatMessages, sendChat } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (props?.state ?? lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;
  const myPlayerId = props?.myPlayerId ?? ctxMyId;

  // Flag display preference (CSS-drawn vs real flag photo), persisted per-browser.
  // Any previously-stored "emoji" value is treated as "image" (the old emoji mode
  // was replaced by real flagsapi.com photos).
  const [flagMode, setFlagMode] = useState<"css" | "image">(() => {
    try {
      return localStorage.getItem("rento_flag_mode") === "css" ? "css" : "image";
    } catch {
      return "css";
    }
  });
  const flagModeRef = useRef(flagMode);
  flagModeRef.current = flagMode;
  const toggleFlagMode = () => {
    setFlagMode((prev) => {
      const next = prev === "css" ? "image" : "css";
      try { localStorage.setItem("rento_flag_mode", next); } catch { /* ignore */ }
      return next;
    });
  };

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput("");
  }, [chatInput, sendChat]);

  useEffect(() => {
    if (chatOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  const isMyTurn = state?.currentPlayerId === myPlayerId;

  // Trade state
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [viewingTradeId, setViewingTradeId] = useState<string | null>(null);
  const [tradeTarget, setTradeTarget] = useState<string>("");
  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [requestMoney, setRequestMoney] = useState(0);

  // Bankrupt confirm state
  const [showBankruptConfirm, setShowBankruptConfirm] = useState(false);

  // Trades tip dismissal (persisted)
  const [tipDismissed, setTipDismissed] = useState(() => {
    try { return localStorage.getItem("rento_trades_tip_dismissed") === "1"; } catch { return false; }
  });
  const dismissTip = () => {
    setTipDismissed(true);
    try { localStorage.setItem("rento_trades_tip_dismissed", "1"); } catch { /* ignore */ }
  };

  const me = state?.players?.find((p: any) => p.id === myPlayerId);
  const otherPlayers = state?.players?.filter((p: any) => p.id !== myPlayerId) ?? [];
  const otherAlivePlayers = otherPlayers.filter((p: any) => !p.bankrupt);
  const pendingTrades = state?.tradeProposals?.filter((t: any) => t.status === "pending") ?? [];
  const myPendingTrades = pendingTrades.filter((t: any) => t.toPlayerId === myPlayerId);
  const sentTrades = pendingTrades.filter((t: any) => t.fromPlayerId === myPlayerId);

  // Stable color per player, based on join order (players array order is stable)
  const playerColors = useMemo(() => {
    const map: Record<string, string> = {};
    (state?.players ?? []).forEach((p: any, i: number) => {
      map[p.id] = PLAYER_COLORS[i % PLAYER_COLORS.length];
    });
    return map;
  }, [state?.players]);

  // Money delta popups (e.g. "-$50" / "+$300") next to each player's balance
  const prevMoneyRef = useRef<Record<string, number>>({});
  const [deltas, setDeltas] = useState<Record<string, { amount: number; key: number }>>({});
  useEffect(() => {
    if (!state?.players) return;
    const next: Record<string, { amount: number; key: number }> = {};
    let changed = false;
    for (const p of state.players) {
      const prev = prevMoneyRef.current[p.id];
      if (prev !== undefined && prev !== p.money) {
        next[p.id] = { amount: p.money - prev, key: Date.now() + Math.random() };
        changed = true;
      }
      prevMoneyRef.current[p.id] = p.money;
    }
    if (changed) {
      setDeltas((old) => ({ ...old, ...next }));
      const ids = Object.keys(next);
      const t = setTimeout(() => {
        setDeltas((old) => {
          const copy = { ...old };
          for (const id of ids) delete copy[id];
          return copy;
        });
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [state?.players]);

  // Rolling log of recent lastAction messages
  const [actionLog, setActionLog] = useState<{ id: number; text: string }[]>([]);
  const lastLoggedRef = useRef<string>("");
  const actionLogSeq = useRef(0);
  useEffect(() => {
    const la = state?.lastAction;
    if (la && la !== lastLoggedRef.current) {
      lastLoggedRef.current = la;
      actionLogSeq.current += 1;
      setActionLog((prev) => [...prev.slice(-4), { id: actionLogSeq.current, text: la }]);
    }
  }, [state?.lastAction]);

  // Track player movement so the board can animate hops instead of snapping tokens
  const prevPosRef = useRef<Record<string, number>>({});
  const animRef = useRef<Record<string, { from: number; to: number; start: number; distance: number; mode: "step" | "jump" }>>({});
  useEffect(() => {
    if (!state?.players) return;
    const diceSum = (state.dice?.[0] ?? 0) + (state.dice?.[1] ?? 0);
    const boardLen = state.board?.length || 40;
    for (const p of state.players) {
      const prev = prevPosRef.current[p.id];
      if (prev !== undefined && prev !== p.position && !p.bankrupt) {
        const forward = (p.position - prev + boardLen) % boardLen;
        const isDiceMove = diceSum > 0 && forward === diceSum;
        animRef.current[p.id] = {
          from: prev,
          to: p.position,
          start: performance.now(),
          distance: forward,
          mode: isDiceMove && forward <= 12 ? "step" : "jump",
        };
      }
      prevPosRef.current[p.id] = p.position;
    }
  }, [state?.players, state?.dice, state?.board]);

  const rollDice = () => { getSocket().emit("rento_roll"); };
  const buyProperty = () => { getSocket().emit("rento_buy"); };
  const endTurn = () => { getSocket().emit("rento_end_turn"); };
  const declareBankrupt = () => { getSocket().emit("rento_bankrupt"); setShowBankruptConfirm(false); };
  const voteKick = (targetPlayerId: string) => { getSocket().emit("rento_votekick", { targetPlayerId }); };

  const resetTradeForm = () => {
    setShowTradeModal(false);
    setEditingTradeId(null);
    setTradeTarget("");
    setOfferProperties([]);
    setOfferMoney(0);
    setRequestProperties([]);
    setRequestMoney(0);
  };

  const submitTrade = () => {
    if (!tradeTarget) return;
    if (editingTradeId) {
      getSocket().emit("rento_edit_trade", {
        tradeId: editingTradeId,
        offerProperties,
        offerMoney,
        requestProperties,
        requestMoney,
      });
    } else {
      getSocket().emit("rento_trade", {
        toPlayerId: tradeTarget,
        offerProperties,
        offerMoney,
        requestProperties,
        requestMoney,
      });
    }
    resetTradeForm();
  };

  const openEditTrade = (trade: any) => {
    setEditingTradeId(trade.id);
    setTradeTarget(trade.toPlayerId);
    setOfferProperties([...trade.offerProperties]);
    setOfferMoney(trade.offerMoney);
    setRequestProperties([...trade.requestProperties]);
    setRequestMoney(trade.requestMoney);
    setViewingTradeId(null);
    setShowTradeModal(true);
  };

  const acceptTrade = (tradeId: string) => {
    getSocket().emit("rento_accept_trade", { tradeId });
  };

  const rejectTrade = (tradeId: string) => {
    getSocket().emit("rento_reject_trade", { tradeId });
  };

  const cancelTrade = (tradeId: string) => {
    getSocket().emit("rento_cancel_trade", { tradeId });
    setViewingTradeId(null);
  };

  const buildHouse = (propertyId: number) => { getSocket().emit("rento_build_house", { propertyId }); };
  const sellHouse = (propertyId: number) => { getSocket().emit("rento_sell_house", { propertyId }); };
  const sellProperty = (propertyId: number) => { getSocket().emit("rento_sell_property", { propertyId }); };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    let raf = 0;
    let flashT = 0;
    let lastTime = performance.now();
    const particles: Particle[] = [];
    let lastDice: [number, number] = [0, 0];
    let diceRollStart = 0;
    const DICE_ROLL_MS = 550;

    // Real flag images (flagsapi.com), lazily loaded and cached per country code.
    const flagImgCache: Record<string, HTMLImageElement> = {};
    const getFlagImg = (code: string): HTMLImageElement => {
      let img = flagImgCache[code];
      if (!img) {
        img = new Image();
        img.src = flagImageUrl(code, 64) || "";
        flagImgCache[code] = img;
      }
      return img;
    };
    const pseudoRand = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const loop = (now: number) => {
      const dt = Math.min(50, now - lastTime);
      lastTime = now;
      flashT += dt;

      const st = stateRef.current;
      ctx.fillStyle = "#0e0b16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!st) { raf = requestAnimationFrame(loop); return; }

      const board = st.board || [];
      const ox = 20;
      const oy = 20;

      // Board interior: soft radial glow instead of a flat fill
      const interiorX = ox + CORNER, interiorY = oy + CORNER;
      const interiorW = BOARD_W - CORNER * 2, interiorH = BOARD_H - CORNER * 2;
      const centerX = ox + BOARD_W / 2;
      const centerY = oy + BOARD_H / 2;

      roundRect(ctx, interiorX, interiorY, interiorW, interiorH, 18);
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, interiorW / 1.3);
      bgGrad.addColorStop(0, "#271a47");
      bgGrad.addColorStop(1, "#140c24");
      ctx.fillStyle = bgGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(196,145,255,0.2)";
      ctx.lineWidth = 2;
      roundRect(ctx, interiorX, interiorY, interiorW, interiorH, 18);
      ctx.stroke();

      if (st.dice && st.dice[0] > 0) {
        // Detect a fresh roll and kick off the tumble animation
        if (st.dice[0] !== lastDice[0] || st.dice[1] !== lastDice[1]) {
          diceRollStart = now;
          lastDice = [st.dice[0], st.dice[1]];
        }
        const rollElapsed = now - diceRollStart;
        const isRolling = rollElapsed < DICE_ROLL_MS;
        const justLanded = rollElapsed >= DICE_ROLL_MS && rollElapsed < DICE_ROLL_MS + 200;

        // Dice, centered in the board interior — bigger, with room below for the action buttons
        const DICE_SIZE = 70;
        const DICE_GAP = 16;
        const DICE_HALF = DICE_SIZE / 2;
        const dTotalW = DICE_SIZE * 2 + DICE_GAP;
        for (let d = 0; d < 2; d++) {
          const dx = centerX - dTotalW / 2 + d * (DICE_SIZE + DICE_GAP);
          const dy = centerY - DICE_HALF;

          let faceValue = st.dice[d];
          let rotate = 0;
          let scale = 1;
          if (isRolling) {
            const step = Math.floor(rollElapsed / 80);
            faceValue = 1 + Math.floor(pseudoRand(step * 12.9898 + d * 78.233) * 6);
            rotate = (pseudoRand(step * 45.164 + d * 3.14) - 0.5) * 0.5;
            scale = 0.92 + pseudoRand(step * 91.7 + d) * 0.16;
          } else if (justLanded) {
            const t = (rollElapsed - DICE_ROLL_MS) / 200;
            scale = 1.22 - 0.22 * t;
          }

          ctx.save();
          ctx.translate(dx + DICE_HALF, dy + DICE_HALF);
          ctx.rotate(rotate);
          ctx.scale(scale, scale);
          ctx.translate(-DICE_HALF, -DICE_HALF);

          const diceGrad = ctx.createLinearGradient(0, 0, 0, DICE_SIZE);
          diceGrad.addColorStop(0, "#ffffff");
          diceGrad.addColorStop(1, "#e7e1f5");
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.45)";
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 5;
          roundRect(ctx, 0, 0, DICE_SIZE, DICE_SIZE, 19);
          ctx.fillStyle = diceGrad;
          ctx.fill();
          ctx.restore();
          ctx.strokeStyle = "rgba(0,0,0,0.08)";
          ctx.lineWidth = 1;
          roundRect(ctx, 0, 0, DICE_SIZE, DICE_SIZE, 19);
          ctx.stroke();

          ctx.fillStyle = "#241640";
          ctx.font = "bold 40px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(faceValue), DICE_HALF, DICE_HALF + 14);
          ctx.restore();
        }
      } else {
        // Idle wordmark before the first roll
        const wordGrad = ctx.createLinearGradient(centerX - 90, centerY, centerX + 90, centerY);
        wordGrad.addColorStop(0, "rgba(45,212,191,0.35)");
        wordGrad.addColorStop(1, "rgba(196,145,255,0.35)");
        ctx.fillStyle = wordGrad;
        ctx.font = "bold 40px 'Baloo 2', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("RENTO", centerX, centerY);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.font = "14px 'Baloo 2', sans-serif";
        ctx.fillText(isAr ? "رينتو — لعبة تبادل الملكيات" : "Property Trading Game", centerX, centerY + 32);
      }

      // Draw all tiles
      for (let i = 0; i < board.length; i++) {
        const cell = board[i];
        const pos = getTilePos(i);
        const px = ox + pos.x;
        const py = oy + pos.y;

        const isCorner = i === 0 || i === 10 || i === 20 || i === 30;
        const cc = cell.flag as string | undefined;
        const TR = 9; // tile corner radius

        // Ownership lookup — used both to boost the flag's vividness and to draw
        // the border below, so the player's own color is consistent everywhere.
        let ownerColor: string | null = null;
        let ownerHouses = 0;
        for (let pi = 0; pi < (st.players?.length ?? 0); pi++) {
          if (st.players[pi].properties?.includes(cell.id)) {
            ownerColor = PLAYER_COLORS[pi % PLAYER_COLORS.length];
            ownerHouses = st.players[pi].houses?.[cell.id] ?? 0;
            break;
          }
        }

        // Tile background: full flag for properties, gradient for corners/specials — all rounded
        ctx.save();
        roundRect(ctx, px + 1, py + 1, pos.w - 2, pos.h - 2, TR);
        ctx.clip();

        if (cc) {
          if (flagModeRef.current === "image") {
            const img = getFlagImg(cc);
            if (img.complete && img.naturalWidth) {
              if (ownerColor) ctx.filter = "saturate(180%) brightness(1.12) contrast(1.06)";
              ctx.drawImage(img, px, py, pos.w, pos.h);
              ctx.filter = "none";
            } else {
              // Still loading — subtle placeholder so the tile isn't blank for a frame.
              ctx.fillStyle = "rgba(255,255,255,0.06)";
              ctx.fillRect(px, py, pos.w, pos.h);
            }
          } else {
            // Draw the flag full-bleed and vivid — once it's owned, boost its
            // saturation so it visibly "pops".
            if (ownerColor) ctx.filter = "saturate(180%) brightness(1.12) contrast(1.06)";
            drawFlag(ctx, cc, px, py, pos.w, pos.h);
            ctx.filter = "none";
          }
          // Scrim small strips behind the text (top name, bottom price) either way.
          const topScrim = ctx.createLinearGradient(px, py, px, py + pos.h * 0.3);
          topScrim.addColorStop(0, "rgba(0,0,0,0.6)");
          topScrim.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = topScrim;
          ctx.fillRect(px, py, pos.w, pos.h * 0.3);
          const bottomScrim = ctx.createLinearGradient(px, py + pos.h * 0.72, px, py + pos.h);
          bottomScrim.addColorStop(0, "rgba(0,0,0,0)");
          bottomScrim.addColorStop(1, "rgba(0,0,0,0.6)");
          ctx.fillStyle = bottomScrim;
          ctx.fillRect(px, py + pos.h * 0.72, pos.w, pos.h * 0.28);
        } else if (isCorner) {
          const cornerGrad = ctx.createLinearGradient(px, py, px, py + pos.h);
          cornerGrad.addColorStop(0, "#2c1c4d");
          cornerGrad.addColorStop(1, "#170e2a");
          ctx.fillStyle = cornerGrad;
          ctx.fillRect(px, py, pos.w, pos.h);
        } else {
          const tileGrad = ctx.createLinearGradient(px, py, px, py + pos.h);
          tileGrad.addColorStop(0, withAlpha(ownerColor ?? cell.color ?? "#333333", ownerColor ? 0.5 : 0.4));
          tileGrad.addColorStop(1, "rgba(16,11,24,0.92)");
          ctx.fillStyle = tileGrad;
          ctx.fillRect(px, py, pos.w, pos.h);
        }
        ctx.restore();

        // Unowned properties/utilities get a dim overlay so it's obvious at a
        // glance which tiles are still up for grabs — cleared once bought.
        if (!ownerColor && (cell.type === "property" || cell.type === "utility")) {
          ctx.save();
          roundRect(ctx, px + 1, py + 1, pos.w - 2, pos.h - 2, TR);
          ctx.clip();
          ctx.fillStyle = "rgba(10,8,16,0.4)";
          ctx.fillRect(px, py, pos.w, pos.h);
          ctx.restore();
        }

        // No default border — only owned tiles get a border, in the buying
        // player's own color, so ownership reads identically everywhere.

        // Cell name + price
        const name = isAr ? cell.nameAr : cell.name;
        ctx.textAlign = "center";

        if (isCorner) {
          ctx.font = "bold 13px 'Baloo 2', sans-serif";
          ctx.fillStyle = "#fbbf24";
          ctx.fillText(name, px + pos.w / 2, py + pos.h / 2 - 3);
          if (cell.type === "start") {
            ctx.font = "15px sans-serif";
            ctx.fillText("▶", px + pos.w / 2, py + pos.h / 2 + 14);
          } else if (cell.type === "jail") {
            ctx.font = "13px sans-serif";
            ctx.fillText(i === 10 ? "🔒" : "🚔", px + pos.w / 2, py + pos.h / 2 + 14);
          } else if (cell.type === "go") {
            ctx.font = "13px sans-serif";
            ctx.fillText("🅿", px + pos.w / 2, py + pos.h / 2 + 14);
          }
        } else if (cc) {
          // Full-flag tile: name at top, price at bottom — bigger, with a drop
          // shadow (not a solid scrim) so the flag's real colors stay vivid.
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 3;
          ctx.font = "bold 11.5px 'Baloo 2', sans-serif";
          ctx.fillStyle = "#fff";
          // Wrap name at top
          const maxW = pos.w - 4;
          const words = name.split(" ");
          let line = "";
          let ly = py + 13;
          for (const word of words) {
            const test = line ? line + " " + word : word;
            if (ctx.measureText(test).width > maxW && line) {
              ctx.fillText(line, px + pos.w / 2, ly);
              line = word;
              ly += 12;
            } else {
              line = test;
            }
          }
          ctx.fillText(line, px + pos.w / 2, ly);
          // Price at bottom
          if (cell.price > 0) {
            ctx.fillStyle = "#fde047";
            ctx.font = "bold 11px 'Baloo 2', sans-serif";
            ctx.fillText(`$${cell.price}`, px + pos.w / 2, py + pos.h - 5);
          }
          ctx.restore();
        } else {
          // Non-flag special tiles (chance, chest, tax, etc.)
          ctx.font = "bold 11.5px 'Baloo 2', sans-serif";
          ctx.fillStyle = "#e5e7eb";
          ctx.fillText(name, px + pos.w / 2, py + pos.h / 2 + 3);
          if (cell.type === "utility") {
            ctx.font = "12px sans-serif";
            ctx.fillText(cell.id === 13 ? "💧" : "⚡", px + pos.w / 2, py + pos.h / 2 + 16);
          } else if (cell.type === "chance") {
            ctx.font = "12px sans-serif";
            ctx.fillText("❓", px + pos.w / 2, py + pos.h / 2 + 16);
          } else if (cell.type === "chest") {
            ctx.font = "12px sans-serif";
            ctx.fillText("📦", px + pos.w / 2, py + pos.h / 2 + 16);
          } else if (cell.type === "tax") {
            ctx.font = "12px sans-serif";
            ctx.fillText("💰", px + pos.w / 2, py + pos.h / 2 + 16);
          }
        }

        // Ownership indicator: border + glowing capsule, always in the owner's exact color
        if (ownerColor) {
          ctx.strokeStyle = ownerColor;
          ctx.lineWidth = 3;
          roundRect(ctx, px + 1.5, py + 1.5, pos.w - 3, pos.h - 3, TR - 1);
          ctx.stroke();

          ctx.save();
          ctx.shadowColor = ownerColor;
          ctx.shadowBlur = 7;
          ctx.fillStyle = ownerColor;
          roundRect(ctx, px + pos.w * 0.14, py + pos.h - 8, pos.w * 0.72, 5, 2.5);
          ctx.fill();
          ctx.restore();

          // House/hotel badge — big, centered right on top of the flag.
          if (ownerHouses > 0) {
            ctx.save();
            const iconSize = Math.max(16, Math.round(Math.min(pos.w, pos.h) * 0.62));
            ctx.font = `bold ${iconSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 5;
            ctx.fillStyle = "#fff";
            ctx.fillText(ownerHouses >= 5 ? "🏨" : `🏠${ownerHouses}`, px + pos.w / 2, py + pos.h / 2);
            ctx.restore();
          }
        }
      }

      // ---- Player tokens: bigger, colored, animated hops ----
      const occupiedCells: Record<number, number> = {};
      const boardLen = board.length || 40;

      for (let pi = 0; pi < (st.players?.length ?? 0); pi++) {
        const p = st.players[pi];
        if (p.bankrupt) continue;

        const offset = occupiedCells[p.position] ?? 0;
        occupiedCells[p.position] = offset + 1;
        const fanX = (offset % 3 - 1) * 14;
        const fanY = Math.floor(offset / 3) * 14;

        const finalTile = getTilePos(p.position);
        let cx = ox + finalTile.x + finalTile.w / 2;
        let cy = oy + finalTile.y + finalTile.h / 2;
        let jumpY = 0, scaleX = 1, scaleY = 1;

        const anim = animRef.current[p.id];
        if (anim) {
          const isStep = anim.mode === "step";
          const totalMs = isStep ? Math.max(anim.distance, 1) * STEP_MS : JUMP_MS;
          const elapsed = now - anim.start;
          if (elapsed >= totalMs) {
            delete animRef.current[p.id];
          } else {
            let ax: number, ay: number, bx: number, by: number, t: number;
            if (isStep) {
              const progress = elapsed / totalMs;
              const stepFloat = progress * anim.distance;
              const stepIdx = Math.min(anim.distance - 1, Math.floor(stepFloat));
              t = stepFloat - stepIdx;
              const tileA = getTilePos((anim.from + stepIdx) % boardLen);
              const tileB = getTilePos((anim.from + stepIdx + 1) % boardLen);
              ax = ox + tileA.x + tileA.w / 2; ay = oy + tileA.y + tileA.h / 2;
              bx = ox + tileB.x + tileB.w / 2; by = oy + tileB.y + tileB.h / 2;
            } else {
              t = elapsed / totalMs;
              const tileA = getTilePos(anim.from);
              const tileB = getTilePos(anim.to);
              ax = ox + tileA.x + tileA.w / 2; ay = oy + tileA.y + tileA.h / 2;
              bx = ox + tileB.x + tileB.w / 2; by = oy + tileB.y + tileB.h / 2;
            }
            cx = ax + (bx - ax) * t;
            cy = ay + (by - ay) * t;
            const arcH = isStep ? JUMP_HEIGHT_STEP : JUMP_HEIGHT_BIG;
            jumpY = -arcH * Math.sin(t * Math.PI);
            scaleY = 1 + 0.22 * Math.sin(t * Math.PI);
            scaleX = 1 - 0.14 * Math.sin(t * Math.PI);
          }
        }

        const groundX = cx + fanX;
        const groundY = cy + fanY;
        const tx = groundX;
        const ty = groundY + jumpY;

        const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
        const isCurrent = p.id === st.currentPlayerId;

        // Contact shadow on the tile (shrinks while airborne, for weight)
        const shadowScale = 1 - Math.min(0.55, Math.abs(jumpY) / 55);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.ellipse(groundX, groundY + 13, 10 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Active-player glow ring
        if (isCurrent) {
          const pulse = 0.35 + 0.25 * Math.sin(flashT * 0.006);
          ctx.strokeStyle = `rgba(45,212,191,${pulse})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(tx, ty, 17, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scaleX, scaleY);

        // Colored plate behind the emoji — this is what makes the token easy to spot
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "17px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";
        ctx.fillText(p.token, 0, 6);

        ctx.restore();
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= 1;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [myPlayerId, isAr]);

  const i18n = {
    ar: {
      title: "رينتو", roll: "ارمي النرد", buy: "شراء الملكية", endTurn: "انتهاء الدور", turn: "دورك", notTurn: "انتظر...",
      dice: "النرد", trade: "تبادل", tradeTitle: "اقتراح تبادل", selectPlayer: "اختر لاعب", offerProperties: "ملكيات تقدمها",
      offerMoney: "مال تقدمه", requestProperties: "ملكيات تطلبها", requestMoney: "مال تطلبه", propose: "اقتراح", cancel: "إلغاء",
      accept: "قبول", reject: "رفض", pendingTrades: "تبادل معلق", sentTrades: "تبادل مرسل",
      players: "اللاعبون", myProperties: "ملكياتي", noProperties: "لا ملكيات بعد", trades: "التبادلات", create: "إنشاء",
      tradesDesc: "قم بالتبادل مع اللاعبين الآخرين لمبادلة الملكيات والمال.", gotIt: "فهمت",
      votekick: "طرد بالتصويت", bankrupt: "إفلاس", bankruptConfirmTitle: "إعلان الإفلاس؟",
      bankruptConfirmBody: "ستفقد جميع ممتلكاتك وتخرج من اللعبة نهائياً. هل أنت متأكد؟",
      isPlaying: "يلعب الآن...", waitingTurn: "بانتظار دوره...",
      flagImage: "صورة حقيقية", flagCss: "رسم", tradeDetails: "تفاصيل التبادل", offering: "يعرض", requesting: "يطلب",
      total: "الإجمالي", edit: "تعديل", save: "حفظ", close: "إغلاق", completeSet: "مجموعة كاملة",
      build: "بناء", houseCount: "منزل", hotel: "فندق", notEnoughForHouse: "لا يوجد مال كافٍ",
      editTradeTitle: "تعديل التبادل", viewDetails: "عرض التفاصيل", with: "مع",
      sellHouse: "بيع منزل", sellProperty: "بيع الملكية", sellHousesFirst: "بع المنازل أولاً",
    },
    en: {
      title: "Rento", roll: "Roll Dice", buy: "Buy Property", endTurn: "End Turn", turn: "Your turn", notTurn: "Waiting...",
      dice: "Dice", trade: "Trade", tradeTitle: "Propose Trade", selectPlayer: "Select player", offerProperties: "Properties you offer",
      offerMoney: "Money you offer", requestProperties: "Properties you request", requestMoney: "Money you request", propose: "Propose", cancel: "Cancel",
      accept: "Accept", reject: "Reject", pendingTrades: "Pending Trades", sentTrades: "Sent Trades",
      players: "Players", myProperties: "My properties", noProperties: "No properties yet", trades: "Trades", create: "Create",
      tradesDesc: "Make trades with other players to exchange properties and money.", gotIt: "Got it",
      votekick: "Votekick", bankrupt: "Bankrupt", bankruptConfirmTitle: "Declare bankruptcy?",
      bankruptConfirmBody: "You'll lose all your properties and be eliminated from the game. Are you sure?",
      isPlaying: "is playing...", waitingTurn: "is waiting...",
      flagImage: "Real", flagCss: "Drawn", tradeDetails: "Trade Details", offering: "Offering", requesting: "Requesting",
      total: "Total", edit: "Edit", save: "Save", close: "Close", completeSet: "Complete set",
      build: "Build", houseCount: "house", hotel: "hotel", notEnoughForHouse: "Not enough money",
      editTradeTitle: "Edit Trade", viewDetails: "View details", with: "with",
      sellHouse: "Sell house", sellProperty: "Sell property", sellHousesFirst: "Sell houses first",
    },
  }[isAr ? "ar" : "en"];

  const currentCell = me ? state?.board?.[me.position] : null;
  const currentPlayer = state?.players?.find((p: any) => p.id === state?.currentPlayerId);
  const bgId = ["nebula", "ocean", "sunset", "emerald"].includes(state?.backgroundId) ? state.backgroundId : "nebula";

  return (
    <div
      className="min-h-screen flex flex-col items-center gap-3 p-4 pb-28 relative overflow-hidden"
      style={{
        backgroundImage: `url('/rento-bg-${bgId}.svg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundColor: "#0b0710",
      }}
    >
      {/* Ambient color blobs — a "lovely" generated background instead of flat black */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }} aria-hidden="true">
        <div
          className="absolute rounded-full animate-blob-float"
          style={{ width: 560, height: 560, top: "-15%", left: "-10%", background: "radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)", filter: "blur(60px)" }}
        />
        <div
          className="absolute rounded-full animate-blob-float"
          style={{ width: 620, height: 620, top: "10%", right: "-15%", background: "radial-gradient(circle, rgba(192,132,252,0.28), transparent 70%)", filter: "blur(60px)", animationDelay: "-7s" }}
        />
        <div
          className="absolute rounded-full animate-blob-float"
          style={{ width: 480, height: 480, bottom: "-10%", left: "15%", background: "radial-gradient(circle, rgba(245,165,36,0.22), transparent 70%)", filter: "blur(60px)", animationDelay: "-13s" }}
        />
        <div
          className="absolute rounded-full animate-blob-float"
          style={{ width: 420, height: 420, bottom: "5%", right: "10%", background: "radial-gradient(circle, rgba(251,113,133,0.20), transparent 70%)", filter: "blur(60px)", animationDelay: "-3s" }}
        />
      </div>

      {/* Top bar: title + mic */}
      <div className="relative z-10 w-full flex items-center justify-between gap-3" style={{ maxWidth: "98vw" }}>
        <div
          className="font-extrabold text-2xl tracking-wide"
          style={{
            backgroundImage: "linear-gradient(135deg, #2dd4bf, #c084fc)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {i18n.title}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFlagMode}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80 transition-colors hover:bg-white/10"
            title={isAr ? "تبديل نمط الأعلام" : "Toggle flag style"}
          >
            {flagMode === "image" ? "🏳️" : "🎨"} {flagMode === "image" ? i18n.flagImage : i18n.flagCss}
          </button>
          {state?.roomId && <VoiceControls roomId={state.roomId} />}
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col lg:flex-row gap-3 items-start justify-center" style={{ maxWidth: "98vw" }}>
        {/* Board column */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
          <div className="relative w-full overflow-x-auto">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="rounded-2xl border border-white/10 touch-none"
              style={{
                width: "100%",
                maxWidth: CANVAS_W,
                imageRendering: "auto",
                background: "#0e0b16",
                display: "block",
                boxShadow: "0 20px 60px -20px rgba(124,58,237,0.35), 0 0 0 1px rgba(255,255,255,0.04)",
              }}
            />

            {/* Speech-bubble notification + status/log, overlaid on the board */}
            <div
              className="absolute flex flex-col items-center text-center"
              style={{ top: "20%", left: "50%", transform: "translateX(-50%)", width: "min(80%, 420px)", pointerEvents: "none" }}
            >
              {state?.lastAction && (
                <div
                  key={state.lastAction}
                  className="relative rounded-2xl px-4 py-3 text-white font-bold animate-bubble-in"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    fontSize: "clamp(12px, 1.6vw, 15px)",
                    lineHeight: 1.3,
                    boxShadow: "0 10px 30px -8px rgba(124,58,237,0.6)",
                  }}
                >
                  {state.lastAction}
                  <div
                    style={{
                      position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%) rotate(45deg)",
                      width: 14, height: 14, background: "#4f46e5",
                    }}
                  />
                </div>
              )}

              {state?.phase === "playing" && currentPlayer && (
                <div className="mt-4 text-white/90 font-bold animate-pop-in" style={{ fontSize: "clamp(11px, 1.4vw, 14px)" }}>
                  {currentPlayer.token} {currentPlayer.name} {i18n.isPlaying}
                </div>
              )}

              {actionLog.length > 1 && (
                <div className="mt-2 flex flex-col gap-0.5">
                  {actionLog.slice(0, -1).slice(-4).map((entry) => (
                    <div key={entry.id} className="text-white/40 animate-pop-in" style={{ fontSize: "clamp(9px, 1.1vw, 11px)" }}>
                      {entry.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Turn actions — sit just below the dice, in the middle of the board */}
            {isMyTurn && state?.phase === "playing" && (state?.canRoll || !!state?.hasRolled) && (
              <div
                className="absolute flex flex-wrap items-center justify-center"
                style={{ top: "58%", left: "50%", transform: "translate(-50%, 0)", gap: "clamp(6px, 1.5vw, 12px)", maxWidth: "92%" }}
              >
                {state?.canRoll && (
                  <button
                    onClick={rollDice}
                    className="rounded-full font-bold text-[#0e0b16] transition-transform duration-150 hover:scale-105 active:scale-95 animate-pulse-glow"
                    style={{
                      padding: "clamp(6px, 1.4vw, 14px) clamp(12px, 2.6vw, 28px)",
                      fontSize: "clamp(10px, 1.5vw, 16px)",
                      background: "linear-gradient(135deg, #5eead4, #2dd4bf)",
                      boxShadow: "0 8px 24px -4px rgba(45,212,191,0.65)",
                    }}
                  >
                    🎲 {i18n.roll}
                  </button>
                )}
                {!!state?.hasRolled && currentCell && (currentCell.type === "property" || currentCell.type === "utility") && !state.players.some((p: any) => p.properties?.includes(currentCell.id)) && me && me.money >= currentCell.price && (
                  <button
                    onClick={buyProperty}
                    className="rounded-full font-bold text-[#0e0b16] transition-transform duration-150 hover:scale-105 active:scale-95 animate-pop-in"
                    style={{
                      padding: "clamp(6px, 1.4vw, 14px) clamp(12px, 2.6vw, 28px)",
                      fontSize: "clamp(10px, 1.5vw, 16px)",
                      background: "linear-gradient(135deg, #fcd34d, #f5a524)",
                      boxShadow: "0 8px 24px -4px rgba(245,165,36,0.55)",
                    }}
                  >
                    🏠 {i18n.buy} (${currentCell.price})
                  </button>
                )}
                {!!state?.hasRolled && (
                  <button
                    onClick={endTurn}
                    className="rounded-full font-bold text-white transition-transform duration-150 hover:scale-105 active:scale-95 animate-pop-in"
                    style={{
                      padding: "clamp(6px, 1.4vw, 14px) clamp(12px, 2.6vw, 28px)",
                      fontSize: "clamp(10px, 1.5vw, 16px)",
                      background: "linear-gradient(135deg, #a78bfa, #8b5cf6)",
                      boxShadow: "0 8px 24px -4px rgba(139,92,246,0.55)",
                    }}
                  >
                    ⏭ {i18n.endTurn}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Branding wordmark */}
          <div className="w-full flex items-center justify-start">
            <span
              className="font-extrabold tracking-wider text-xs"
              style={{
                backgroundImage: "linear-gradient(135deg, rgba(45,212,191,0.5), rgba(192,132,252,0.5))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              RENTO
            </span>
          </div>

          {/* Finished-game banner (turn actions now live centered on the board above) */}
          {state?.phase === "finished" && (
            <div className="text-fuchsia-300 font-bold text-lg animate-pop-in">
              🎉 {state.players?.find((p: any) => p.id === state.winnerId)?.name} wins!
            </div>
          )}

          <p className="text-white/40 text-xs text-center max-w-lg">
            {isAr
              ? "ارمي النرد واشترِ الملكيات. اجمع الإيجار واجعل الخصوم يُفلسون! اللاعبون الآليون يلعبون تلقائياً."
              : "Roll dice, buy properties, collect rent, and bankrupt your opponents! Bots play automatically."}
          </p>
        </div>

        {/* Sidebar column */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-3">
          {/* Player list */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm overflow-hidden shadow-lg shadow-black/30">
            {state?.players?.map((p: any) => {
              const isMe = p.id === myPlayerId;
              const isCurrent = p.id === state?.currentPlayerId;
              const votes: string[] = state?.kickVotes?.[p.id] ?? [];
              // 60% of the WHOLE room (bots included) — matches server logic. A 2-player
              // room (human or bot) can never vote-kick at all, so one player can't win
              // by unilaterally kicking their only opponent.
              const totalPlayers = state?.players?.length ?? 0;
              const eligibleVoters = state?.players?.filter((pp: any) => !pp.isBot && pp.id !== p.id).length ?? 0;
              const threshold = Math.ceil(totalPlayers * 0.6);
              const kickPossible = totalPlayers > 2 && eligibleVoters >= threshold;
              const myVote = votes.includes(myPlayerId ?? "");
              const delta = deltas[p.id];
              const color = playerColors[p.id] ?? "#666";

              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-3 border-b border-white/5 last:border-b-0 transition-colors duration-300 hover:bg-white/[0.03]"
                  style={{
                    background: isCurrent ? `linear-gradient(90deg, ${withAlpha(color, 0.16)}, transparent)` : "transparent",
                    borderLeft: `3px solid ${color}`,
                    opacity: p.bankrupt || !p.isConnected ? 0.45 : 1,
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 34, height: 34, background: color, fontSize: 16,
                      boxShadow: isCurrent ? `0 0 0 2px #0b0710, 0 0 0 4px ${color}` : "0 2px 6px rgba(0,0,0,0.35)",
                      transition: "box-shadow 0.3s",
                    }}
                  >
                    {p.token}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-white text-sm font-bold truncate">
                      {p.isHost && <Crown size={12} color="#fbbf24" />}
                      <span className="truncate">{p.name}</span>
                      {p.bankrupt && <span>💀</span>}
                    </div>
                    {votes.length > 0 && !p.bankrupt && (
                      <div className="text-[10px] text-rose-400 font-bold animate-pop-in">{votes.length}/{threshold} {i18n.votekick.toLowerCase()}</div>
                    )}
                  </div>
                  <div className="relative flex items-center gap-1.5">
                    {delta && (
                      <span
                        key={delta.key}
                        className="absolute -top-4 right-0 text-[11px] font-bold animate-float-up"
                        style={{ color: delta.amount >= 0 ? "#4ade80" : "#f87171" }}
                      >
                        {delta.amount >= 0 ? "+" : ""}{delta.amount}
                      </span>
                    )}
                    <span className="text-white/80 text-sm font-semibold">${p.money}</span>
                    {!isMe && !p.bankrupt && state?.phase === "playing" && (
                      <button
                        onClick={() => kickPossible && voteKick(p.id)}
                        disabled={!kickPossible}
                        title={kickPossible ? i18n.votekick : (isAr ? "يحتاج المزيد من اللاعبين للتصويت" : "Need more players to vote")}
                        className={`p-1.5 rounded-full transition-colors ${kickPossible ? "hover:bg-rose-500/15" : "cursor-not-allowed opacity-30"}`}
                        style={{ color: myVote ? "#f87171" : "rgba(255,255,255,0.35)" }}
                      >
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bankrupt action */}
          {me && !me.bankrupt && state?.phase === "playing" && (
            <button
              onClick={() => setShowBankruptConfirm(true)}
              className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 font-bold text-xs hover:bg-rose-500/20 hover:border-rose-500/50 transition-colors"
            >
              {i18n.bankrupt}
            </button>
          )}

          {/* Trades panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-4 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold text-sm">{i18n.trades}</span>
              <button
                onClick={() => { resetTradeForm(); setShowTradeModal(true); }}
                disabled={state?.phase !== "playing" || otherAlivePlayers.length === 0}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95"
              >
                {i18n.create}
              </button>
            </div>
            {!tipDismissed && (
              <div className="rounded-lg bg-white/5 p-2 mb-2">
                <p className="text-white/50 text-[11px] leading-snug mb-1.5">{i18n.tradesDesc}</p>
                <button
                  onClick={dismissTip}
                  className="text-[11px] font-bold text-purple-300 hover:text-purple-200"
                >
                  ✓ {i18n.gotIt}
                </button>
              </div>
            )}

            {/* Pending trades (received) */}
            {myPendingTrades.length > 0 && (
              <div className="space-y-2 mb-2">
                <div className="text-amber-400 font-bold text-[11px]">{i18n.pendingTrades}</div>
                {myPendingTrades.map((trade: any) => {
                  const fromPlayer = state.players?.find((p: any) => p.id === trade.fromPlayerId);
                  return (
                    <div
                      key={trade.id}
                      onClick={() => setViewingTradeId(trade.id)}
                      className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center justify-between gap-2 animate-pop-in cursor-pointer transition-colors hover:bg-white/10"
                    >
                      <div className="text-white text-[11px]">
                        <span className="font-bold">{fromPlayer?.name}</span>
                        {trade.offerMoney > 0 && <span className="text-amber-400"> ${trade.offerMoney}</span>}
                        {trade.offerProperties.length > 0 && (
                          <span className="text-emerald-400"> +{trade.offerProperties.length} {isAr ? "ملكيات" : "props"}</span>
                        )}
                        {" → "}
                        {trade.requestMoney > 0 && <span className="text-amber-400">${trade.requestMoney}</span>}
                        {trade.requestProperties.length > 0 && (
                          <span className="text-rose-400"> +{trade.requestProperties.length} {isAr ? "ملكيات" : "props"}</span>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); acceptTrade(trade.id); }} className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-colors">{i18n.accept}</button>
                        <button onClick={(e) => { e.stopPropagation(); rejectTrade(trade.id); }} className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition-colors">{i18n.reject}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sent trades (waiting for response) */}
            {sentTrades.length > 0 && (
              <div className="space-y-2">
                <div className="text-blue-400 font-bold text-[11px]">{i18n.sentTrades}</div>
                {sentTrades.map((trade: any) => {
                  const toPlayer = state.players?.find((p: any) => p.id === trade.toPlayerId);
                  return (
                    <div
                      key={trade.id}
                      onClick={() => setViewingTradeId(trade.id)}
                      className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center justify-between gap-2 animate-pop-in cursor-pointer transition-colors hover:bg-white/10"
                    >
                      <div className="text-white text-[11px]">
                        <span className="font-bold">{toPlayer?.name}</span>
                        <span className="text-gray-400"> {isAr ? "ينتظر..." : "pending..."}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); openEditTrade(trade); }} className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors">{i18n.edit}</button>
                        <button onClick={(e) => { e.stopPropagation(); cancelTrade(trade.id); }} className="px-2 py-1 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-[10px] font-bold transition-colors">{i18n.cancel}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {myPendingTrades.length === 0 && sentTrades.length === 0 && tipDismissed && (
              <p className="text-white/30 text-[11px] text-center py-1">{isAr ? "لا توجد تبادلات نشطة" : "No active trades"}</p>
            )}
          </div>

          {/* My properties panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-4 shadow-lg shadow-black/30">
            <div className="text-white font-bold text-sm mb-2">{i18n.myProperties} ({me?.properties?.length ?? 0})</div>
            {me?.properties?.length > 0 ? (
              <div className="flex flex-col gap-3">
                {(() => {
                  const groups: Record<string, any[]> = {};
                  for (const pid of me.properties) {
                    const cell = state.board?.[pid];
                    if (!cell) continue;
                    (groups[cell.color] ??= []).push(cell);
                  }
                  return Object.entries(groups).map(([color, cells]) => {
                    const allOfColor = (state.board ?? []).filter((c: any) => c.color === color && (c.type === "property" || c.type === "utility"));
                    const isComplete = allOfColor.length > 0 && allOfColor.every((c: any) => me.properties.includes(c.id));
                    return (
                      <div key={color}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${withAlpha(color, 0.7)}` }} />
                          {isComplete && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">{i18n.completeSet}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {cells.map((cell: any) => {
                            const houses = me.houses?.[cell.id] ?? 0;
                            const canBuild = isComplete && cell.type === "property" && houses < 5;
                            const buildCost = Math.round(cell.price / 2);
                            const canAffordBuild = me.money >= buildCost;
                            const houseSellRefund = Math.round(buildCost / 2);
                            const propertySellRefund = Math.round(cell.price / 2);
                            const canSellProperty = houses === 0;
                            const flagUrl = flagImageUrl(cell.flag);
                            return (
                              <div key={cell.id} className="flex flex-col gap-1 animate-pop-in">
                                <span className="text-white/70 text-xs truncate flex items-center gap-1.5">
                                  {flagUrl ? (
                                    <img src={flagUrl} alt="" className="w-4 h-3 rounded-sm object-cover flex-shrink-0" />
                                  ) : (
                                    <span className="flex-shrink-0">🌐</span>
                                  )}
                                  <span className="truncate">{isAr ? cell.nameAr : cell.name}</span>
                                  {houses > 0 && <span className="ms-1 flex-shrink-0">{houses >= 5 ? "🏨" : "🏠".repeat(houses)}</span>}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {canBuild && (
                                    <button
                                      onClick={() => buildHouse(cell.id)}
                                      disabled={!canAffordBuild}
                                      title={!canAffordBuild ? i18n.notEnoughForHouse : undefined}
                                      className="flex-shrink-0 px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                                    >
                                      {houses === 4 ? `🏨 $${buildCost}` : `🏠 $${buildCost}`}
                                    </button>
                                  )}
                                  {houses > 0 && (
                                    <button
                                      onClick={() => sellHouse(cell.id)}
                                      className="flex-shrink-0 px-2 py-0.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                                    >
                                      {i18n.sellHouse} ${houseSellRefund}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => sellProperty(cell.id)}
                                    disabled={!canSellProperty}
                                    title={!canSellProperty ? i18n.sellHousesFirst : undefined}
                                    className="flex-shrink-0 px-2 py-0.5 rounded-full bg-rose-600/80 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[10px] font-bold transition-all hover:scale-105 active:scale-95"
                                  >
                                    {i18n.sellProperty} ${propertySellRefund}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <p className="text-white/30 text-xs">{i18n.noProperties}</p>
            )}
          </div>
        </div>
      </div>

      {/* Bankrupt confirm modal */}
      {showBankruptConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-pop-in" onClick={() => setShowBankruptConfirm(false)}>
          <div className="bg-[#1d0d29] border border-rose-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl shadow-rose-900/30 animate-bubble-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-white font-bold text-lg">{i18n.bankruptConfirmTitle}</div>
            <p className="text-white/60 text-sm">{i18n.bankruptConfirmBody}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowBankruptConfirm(false)} className="px-4 py-2 rounded-full bg-gray-600 hover:bg-gray-500 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.cancel}</button>
              <button onClick={declareBankrupt} className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.bankrupt}</button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1d0d29] border border-purple-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-purple-900/30 animate-bubble-in max-h-[90vh] overflow-y-auto">
            <div className="text-white font-bold text-lg">{editingTradeId ? i18n.editTradeTitle : i18n.tradeTitle}</div>

            {/* Select player */}
            <div>
              <label className="text-purple-300 text-sm font-bold">{i18n.selectPlayer}</label>
              <select
                value={tradeTarget}
                onChange={(e) => setTradeTarget(e.target.value)}
                disabled={!!editingTradeId}
                className="w-full mt-1 p-2 rounded-lg bg-white/10 border border-white/20 text-white transition-colors focus:border-purple-400 focus:outline-none disabled:opacity-60"
              >
                <option value="">{isAr ? "اختر لاعب..." : "Select player..."}</option>
                {otherAlivePlayers.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.token} {p.name} (${p.money})</option>
                ))}
              </select>
            </div>

            {/* Offer section */}
            <div className="space-y-2">
              <div className="text-amber-400 font-bold text-sm">{i18n.offerProperties}</div>
              {me?.properties?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {me.properties.map((pid: number) => {
                    const cell = state.board?.[pid];
                    if (!cell) return null;
                    const selected = offerProperties.includes(pid);
                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          setOfferProperties(prev =>
                            selected ? prev.filter(p => p !== pid) : [...prev, pid]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-150 hover:scale-105 active:scale-95 ${
                          selected
                            ? "bg-amber-500/30 border-amber-400 text-amber-300"
                            : "bg-white/5 border-white/20 text-white hover:border-white/40"
                        }`}
                      >
                        {isAr ? cell.nameAr : cell.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="text-amber-400 font-bold text-sm">{i18n.offerMoney}</div>
              <input
                type="number"
                min={0}
                max={me?.money ?? 0}
                value={offerMoney}
                onChange={(e) => setOfferMoney(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white transition-colors focus:border-amber-400 focus:outline-none"
                placeholder="$0"
              />
            </div>

            {/* Request section */}
            {tradeTarget && (
              <div className="space-y-2">
                <div className="text-rose-400 font-bold text-sm">{i18n.requestProperties}</div>
                {(() => {
                  const target = state.players?.find((p: any) => p.id === tradeTarget);
                  if (!target?.properties?.length) return <div className="text-gray-400 text-xs">{isAr ? "لا ملكيات" : "No properties"}</div>;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {target.properties.map((pid: number) => {
                        const cell = state.board?.[pid];
                        if (!cell) return null;
                        const selected = requestProperties.includes(pid);
                        return (
                          <button
                            key={pid}
                            onClick={() => {
                              setRequestProperties(prev =>
                                selected ? prev.filter(p => p !== pid) : [...prev, pid]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-150 hover:scale-105 active:scale-95 ${
                              selected
                                ? "bg-rose-500/30 border-rose-400 text-rose-300"
                                : "bg-white/5 border-white/20 text-white hover:border-white/40"
                            }`}
                          >
                            {isAr ? cell.nameAr : cell.name}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="text-rose-400 font-bold text-sm">{i18n.requestMoney}</div>
                <input
                  type="number"
                  min={0}
                  max={(() => {
                    const target = state.players?.find((p: any) => p.id === tradeTarget);
                    return target?.money ?? 0;
                  })()}
                  value={requestMoney}
                  onChange={(e) => setRequestMoney(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white transition-colors focus:border-rose-400 focus:outline-none"
                  placeholder="$0"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={resetTradeForm}
                className="px-4 py-2 rounded-full bg-gray-600 hover:bg-gray-500 font-bold text-sm transition-all hover:scale-105 active:scale-95"
              >
                {i18n.cancel}
              </button>
              <button
                onClick={submitTrade}
                disabled={!tradeTarget || (offerProperties.length === 0 && offerMoney === 0 && requestProperties.length === 0 && requestMoney === 0)}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                {editingTradeId ? i18n.save : i18n.propose}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Detail Modal */}
      {viewingTradeId && (() => {
        const trade = state?.tradeProposals?.find((t: any) => t.id === viewingTradeId);
        if (!trade) return null;
        const fromPlayer = state.players?.find((p: any) => p.id === trade.fromPlayerId);
        const toPlayer = state.players?.find((p: any) => p.id === trade.toPlayerId);
        const offerProps = trade.offerProperties.map((pid: number) => state.board?.[pid]).filter(Boolean);
        const requestProps = trade.requestProperties.map((pid: number) => state.board?.[pid]).filter(Boolean);
        const offerTotal = trade.offerMoney + offerProps.reduce((s: number, c: any) => s + (c.price || 0), 0);
        const requestTotal = trade.requestMoney + requestProps.reduce((s: number, c: any) => s + (c.price || 0), 0);
        const isSender = trade.fromPlayerId === myPlayerId;
        const isReceiver = trade.toPlayerId === myPlayerId;

        const renderSide = (title: string, player: any, money: number, props: any[], total: number, accent: string) => (
          <div className="flex-1 rounded-xl border border-white/10 bg-white/5 p-3 min-w-0">
            <div className="text-xs font-bold mb-2 truncate" style={{ color: accent }}>{title}: {player?.token} {player?.name}</div>
            {money > 0 && <div className="text-amber-300 text-sm font-bold mb-1">${money}</div>}
            <div className="flex flex-col gap-1.5">
              {props.map((cell: any) => (
                <div key={cell.id} className="flex items-center justify-between gap-2 text-white/80 text-xs">
                  <span className="flex items-center gap-1.5 truncate">
                    {flagImageUrl(cell.flag) ? (
                      <img src={flagImageUrl(cell.flag)!} alt="" className="w-4 h-3 rounded-sm object-cover flex-shrink-0" />
                    ) : (
                      <span>🌐</span>
                    )}
                    <span className="truncate">{isAr ? cell.nameAr : cell.name}</span>
                  </span>
                  <span className="text-amber-300 font-semibold flex-shrink-0">${cell.price}</span>
                </div>
              ))}
              {props.length === 0 && money === 0 && <div className="text-white/30 text-xs">—</div>}
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-xs font-bold">
              <span className="text-white/50">{i18n.total}</span>
              <span style={{ color: accent }}>${total}</span>
            </div>
          </div>
        );

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingTradeId(null)}>
            <div className="bg-[#1d0d29] border border-purple-500/30 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl shadow-purple-900/30 animate-bubble-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="text-white font-bold text-lg">{i18n.tradeDetails}</div>
              <div className="text-white/50 text-xs -mt-2">{fromPlayer?.name} {i18n.with} {toPlayer?.name}</div>
              <div className="flex gap-3">
                {renderSide(i18n.offering, fromPlayer, trade.offerMoney, offerProps, offerTotal, "#34d399")}
                {renderSide(i18n.requesting, toPlayer, trade.requestMoney, requestProps, requestTotal, "#fb7185")}
              </div>
              <div className="flex gap-3 justify-end flex-wrap">
                {isSender && (
                  <>
                    <button onClick={() => cancelTrade(trade.id)} className="px-4 py-2 rounded-full bg-gray-600 hover:bg-gray-500 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.cancel}</button>
                    <button onClick={() => openEditTrade(trade)} className="px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.edit}</button>
                  </>
                )}
                {isReceiver && (
                  <>
                    <button onClick={() => { rejectTrade(trade.id); setViewingTradeId(null); }} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.reject}</button>
                    <button onClick={() => { acceptTrade(trade.id); setViewingTradeId(null); }} className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.accept}</button>
                  </>
                )}
                <button onClick={() => setViewingTradeId(null)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 font-bold text-sm text-white transition-all hover:scale-105 active:scale-95">{i18n.close}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating chat bubble */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed flex items-center justify-center rounded-full z-40 transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          [isAr ? "left" : "right"]: 20,
          bottom: "max(20px, env(safe-area-inset-bottom))",
          width: 54,
          height: 54,
          background: chatOpen ? "#FED23F" : "linear-gradient(135deg, #a78bfa, #7c3aed)",
          color: chatOpen ? "#2B2420" : "#fff",
          boxShadow: chatOpen ? "0 8px 24px -6px rgba(254,210,63,0.6)" : "0 8px 24px -6px rgba(124,58,237,0.6)",
        } as React.CSSProperties}
        aria-label="Chat"
      >
        <MessageCircle size={22} />
        {chatMessages.length > 0 && !chatOpen && (
          <span
            className="absolute -top-1 -right-1 rounded-full bg-[#E8574A] text-white text-[10px] font-bold flex items-center justify-center animate-pulse-glow"
            style={{ minWidth: 18, height: 18, padding: "0 4px" }}
          >
            {chatMessages.length}
          </span>
        )}
      </button>

      {/* Slide-out Chat Drawer */}
      {chatOpen && (
        <div
          className="animate-pop-in"
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            [isAr ? "left" : "right"]: 0,
            width: "100%",
            maxWidth: 340,
            background: "rgba(13, 14, 18, 0.98)",
            backdropFilter: "blur(8px)",
            borderLeft: isAr ? "none" : "2px solid rgba(255,255,255,0.15)",
            borderRight: isAr ? "2px solid rgba(255,255,255,0.15)" : "none",
            boxShadow: "0 0 30px rgba(0,0,0,0.7)",
            zIndex: 300,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{isAr ? "دردشة" : "Chat"}</span>
            <button
              onClick={() => setChatOpen(false)}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
            >
              {isAr ? "إغلاق" : "Close"}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, wordBreak: "break-word" }}>
                <strong style={{ color: "#FED23F", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {flagImageUrl(msg.flag) && (
                    <img src={flagImageUrl(msg.flag)!} alt="" style={{ width: 14, height: 11, borderRadius: 2, objectFit: "cover" }} />
                  )}
                  {msg.playerName}:
                </strong>{" "}
                <span style={{ color: "rgba(255,255,255,0.9)" }}>{msg.message}</span>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 40 }}>
                {isAr ? "لا رسائل بعد" : "No messages yet"}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isAr ? "اكتب رسالة..." : "Type a message..."}
              maxLength={200}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                background: "#FED23F",
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
              <Send size={16} color="#2B2420" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
