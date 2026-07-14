import { useCallback, useRef, useEffect, useState } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";
import { VoiceControls } from "@/components/VoiceControls";
import { MessageCircle, Send } from "lucide-react";
import { codeToEmoji } from "@/lib/utils";

const CELL_SIZE = 100;      // each tile is 100×100
const CORNER = CELL_SIZE;   // corners are square
const INNER_TILES = 9;      // tiles between corners on each side
const BOARD_W = CORNER + INNER_TILES * CELL_SIZE + CORNER; // 1100
const BOARD_H = CORNER + INNER_TILES * CELL_SIZE + CORNER; // 1100 square
const CANVAS_W = BOARD_W + 260;              // extra space for sidebar
const CANVAS_H = BOARD_H + 40;               // padding

// Map each cell id to a 2-letter country code for the flag
const CELL_COUNTRIES: Record<number, string> = {
  1:"SA",3:"SA",5:"SA",
  6:"EG",8:"EG",9:"EG",
  11:"AE",12:"AE",
  14:"TR",16:"TR",17:"TR",23:"TR",
  20:"IQ",21:"IQ",
  24:"MA",25:"MA",27:"MA",
  28:"QA",29:"KW",
  31:"OM",32:"JO",
  34:"LB",35:"LY",37:"TN",39:"DZ",
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
  const [tradeTarget, setTradeTarget] = useState<string>("");
  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [requestMoney, setRequestMoney] = useState(0);

  const me = state?.players?.find((p: any) => p.id === myPlayerId);
  const otherPlayers = state?.players?.filter((p: any) => p.id !== myPlayerId && !p.bankrupt) ?? [];
  const pendingTrades = state?.tradeProposals?.filter((t: any) => t.status === "pending") ?? [];
  const myPendingTrades = pendingTrades.filter((t: any) => t.toPlayerId === myPlayerId);
  const sentTrades = pendingTrades.filter((t: any) => t.fromPlayerId === myPlayerId);

  const rollDice = () => { getSocket().emit("rento_roll"); };
  const buyProperty = () => { getSocket().emit("rento_buy"); };
  const endTurn = () => { getSocket().emit("rento_end_turn"); };

  const proposeTrade = () => {
    if (!tradeTarget) return;
    getSocket().emit("rento_trade", {
      toPlayerId: tradeTarget,
      offerProperties,
      offerMoney,
      requestProperties,
      requestMoney,
    });
    setShowTradeModal(false);
    setTradeTarget("");
    setOfferProperties([]);
    setOfferMoney(0);
    setRequestProperties([]);
    setRequestMoney(0);
  };

  const acceptTrade = (tradeId: string) => {
    getSocket().emit("rento_accept_trade", { tradeId });
  };

  const rejectTrade = (tradeId: string) => {
    getSocket().emit("rento_reject_trade", { tradeId });
  };

  const cancelTrade = (tradeId: string) => {
    getSocket().emit("rento_cancel_trade", { tradeId });
  };

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

      // Draw empty center (dark background)
      ctx.fillStyle = "#1a1030";
      roundRect(ctx, ox + CELL_SIZE, oy + CELL_SIZE, BOARD_W - CELL_SIZE * 2, BOARD_H - CELL_SIZE * 2, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(168,85,247,0.15)";
      ctx.lineWidth = 2;
      roundRect(ctx, ox + CELL_SIZE, oy + CELL_SIZE, BOARD_W - CELL_SIZE * 2, BOARD_H - CELL_SIZE * 2, 8);
      ctx.stroke();

      // Center text
      ctx.fillStyle = "rgba(168,85,247,0.12)";
      ctx.font = "bold 36px 'Baloo 2', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RENTO", ox + BOARD_W / 2, oy + BOARD_H / 2);
      ctx.font = "14px 'Baloo 2', sans-serif";
      ctx.fillText(isAr ? "رينتو — لعبة الم_properties" : "Property Trading Game", ox + BOARD_W / 2, oy + BOARD_H / 2 + 30);

      // Draw all tiles
      for (let i = 0; i < board.length; i++) {
        const cell = board[i];
        const pos = getTilePos(i);
        const px = ox + pos.x;
        const py = oy + pos.y;

        const isCorner = i === 0 || i === 10 || i === 20 || i === 30;
        const cc = CELL_COUNTRIES[cell.id];

        // Tile background: full flag for properties, solid color for corners/specials
        if (cc) {
          drawFlag(ctx, cc, px, py, pos.w, pos.h);
          // Dark overlay for text readability
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(px, py, pos.w, pos.h);
        } else if (isCorner) {
          ctx.fillStyle = "#1f1535";
          ctx.fillRect(px, py, pos.w, pos.h);
        } else {
          ctx.fillStyle = cell.color || "#333";
          ctx.globalAlpha = 0.25;
          ctx.fillRect(px, py, pos.w, pos.h);
          ctx.globalAlpha = 1;
        }

        // Border
        ctx.strokeStyle = isCorner ? "#6b7280" : "#4b5563";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, pos.w, pos.h);

        // Cell name + price
        const name = isAr ? cell.nameAr : cell.name;
        ctx.textAlign = "center";

        if (isCorner) {
          ctx.font = "bold 13px 'Baloo 2', sans-serif";
          ctx.fillStyle = "#fbbf24";
          ctx.fillText(name, px + pos.w / 2, py + pos.h / 2 - 4);
          if (cell.type === "start") {
            ctx.font = "18px sans-serif";
            ctx.fillText("▶", px + pos.w / 2, py + pos.h / 2 + 18);
          } else if (cell.type === "jail") {
            ctx.font = "16px sans-serif";
            ctx.fillText(i === 10 ? "🔒" : "🚔", px + pos.w / 2, py + pos.h / 2 + 18);
          } else if (cell.type === "go") {
            ctx.font = "16px sans-serif";
            ctx.fillText("🅿", px + pos.w / 2, py + pos.h / 2 + 18);
          }
        } else if (cc) {
          // Full-flag tile: name at top, price at bottom
          ctx.font = "bold 11px 'Baloo 2', sans-serif";
          ctx.fillStyle = "#fff";
          // Wrap name at top
          const maxW = pos.w - 8;
          const words = name.split(" ");
          let line = "";
          let ly = py + 14;
          for (const word of words) {
            const test = line ? line + " " + word : word;
            if (ctx.measureText(test).width > maxW && line) {
              ctx.fillText(line, px + pos.w / 2, ly);
              line = word;
              ly += 11;
            } else {
              line = test;
            }
          }
          ctx.fillText(line, px + pos.w / 2, ly);
          // Price at bottom
          if (cell.price > 0) {
            ctx.fillStyle = "#fbbf24";
            ctx.font = "bold 12px 'Baloo 2', sans-serif";
            ctx.fillText(`$${cell.price}`, px + pos.w / 2, py + pos.h - 6);
          }
        } else {
          // Non-flag special tiles (chance, chest, tax, etc.)
          ctx.font = "bold 12px 'Baloo 2', sans-serif";
          ctx.fillStyle = "#d1d5db";
          ctx.fillText(name, px + pos.w / 2, py + pos.h / 2 + 4);
          if (cell.type === "utility") {
            ctx.font = "14px sans-serif";
            ctx.fillText(cell.id === 13 ? "💧" : "⚡", px + pos.w / 2, py + pos.h / 2 + 20);
          } else if (cell.type === "chance") {
            ctx.font = "14px sans-serif";
            ctx.fillText("❓", px + pos.w / 2, py + pos.h / 2 + 20);
          } else if (cell.type === "chest") {
            ctx.font = "14px sans-serif";
            ctx.fillText("📦", px + pos.w / 2, py + pos.h / 2 + 20);
          } else if (cell.type === "tax") {
            ctx.font = "14px sans-serif";
            ctx.fillText("💰", px + pos.w / 2, py + pos.h / 2 + 20);
          }
        }

        // Ownership indicator
        for (const p of st.players ?? []) {
          if (p.properties?.includes(cell.id)) {
            ctx.fillStyle = p.id === myPlayerId ? "#fbbf24" : "#a78bfa";
            ctx.fillRect(px, py + pos.h - 3, pos.w, 3);
            break;
          }
        }
      }

      // Draw player tokens
      const occupiedCells: Record<number, number> = {};
      for (const p of st.players ?? []) {
        if (p.bankrupt) continue;
        const pos = p.position;
        const tile = getTilePos(pos);
        const px = ox + tile.x + tile.w / 2;
        const py = oy + tile.y + tile.h / 2;
        const offset = (occupiedCells[pos] ?? 0);
        occupiedCells[pos] = offset + 1;

        const tx = px + (offset % 3 - 1) * 14;
        const ty = py + Math.floor(offset / 3) * 14;

        // Token shadow
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.ellipse(tx + 1, ty + 11, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Token emoji
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.token, tx, ty + 8);

        // Active player glow
        if (p.id === st.currentPlayerId) {
          const pulse = 0.3 + 0.2 * Math.sin(flashT * 0.006);
          ctx.strokeStyle = `rgba(34,197,94,${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(tx, ty + 2, 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Sidebar
      const sbx = BOARD_W + 40;
      let sby = 30;

      // Dice
      if (st.dice && st.dice[0] > 0) {
        for (let d = 0; d < 2; d++) {
          const dx = sbx + d * 50;
          ctx.fillStyle = "#fff";
          roundRect(ctx, dx, sby, 42, 42, 8);
          ctx.fill();
          ctx.fillStyle = "#0e0b16";
          ctx.font = "bold 36px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(st.dice[d]), dx + 21, sby + 30);
        }
      }
      sby += 60;

      // Players list
      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 16px 'Baloo 2', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(isAr ? "اللاعبون" : "Players", sbx, sby);
      sby += 24;

      for (const p of st.players ?? []) {
        const me = p.id === myPlayerId;
        const current = p.id === st.currentPlayerId;

        // Highlight bar
        if (current) {
          ctx.fillStyle = "rgba(34,197,94,0.15)";
          roundRect(ctx, sbx - 5, sby - 14, 240, 26, 4);
          ctx.fill();
        }

        ctx.fillStyle = p.bankrupt ? "#6b7280" : me ? "#fbbf24" : current ? "#22c55e" : "#d8b4fe";
        ctx.font = `${me || current ? "bold " : ""}14px 'Baloo 2', sans-serif`;
        ctx.textAlign = "left";
        if (p.flag) drawFlag(ctx, p.flag, sbx, sby - 13, 20, 13);
        ctx.fillText(`${p.token} ${p.name}${p.bankrupt ? " 💀" : ""}`, sbx + 26, sby);

        ctx.fillStyle = "#9ca3af";
        ctx.font = "13px 'Baloo 2', sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`$${p.money}`, sbx + 220, sby);

        sby += 26;
      }

      // Properties owned
      sby += 10;
      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 12px 'Baloo 2', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(isAr ? "ملكياتك" : "Your Properties", sbx, sby);
      sby += 18;

      const me = st.players?.find((p: any) => p.id === myPlayerId);
      if (me?.properties?.length > 0) {
        for (const pid of me.properties) {
          const cell = board[pid];
          if (!cell) continue;
          ctx.fillStyle = cell.color;
          ctx.fillRect(sbx, sby - 8, 10, 10);
          ctx.fillStyle = "#d1d5db";
          ctx.font = "9px 'Baloo 2', sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(isAr ? cell.nameAr : cell.name, sbx + 14, sby);
          sby += 14;
        }
      } else {
        ctx.fillStyle = "#6b7280";
        ctx.font = "10px 'Baloo 2', sans-serif";
        ctx.fillText(isAr ? "لا ملكيات بعد" : "No properties yet", sbx, sby);
        sby += 14;
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
    ar: { title: "رينتو", roll: "ارمي النرد", buy: "شراء الملكية", endTurn: "انتهاء الدور", turn: "دورك", notTurn: "انتظر...", dice: "النرد", trade: "تبادل", tradeTitle: "اقتراح تبادل", selectPlayer: "اختر لاعب", offerProperties: "ملكيات تقدمها", offerMoney: "مال تقدمه", requestProperties: "ملكيات تطلبها", requestMoney: "مال تطلبه", propose: "اقتراح", cancel: "إلغاء", accept: "قبول", reject: "رفض", pendingTrades: "تبادل معلق", sentTrades: "تبادل مرسل" },
    en: { title: "Rento", roll: "Roll Dice", buy: "Buy Property", endTurn: "End Turn", turn: "Your turn", notTurn: "Waiting...", dice: "Dice", trade: "Trade", tradeTitle: "Propose Trade", selectPlayer: "Select player", offerProperties: "Properties you offer", offerMoney: "Money you offer", requestProperties: "Properties you request", requestMoney: "Money you request", propose: "Propose", cancel: "Cancel", accept: "Accept", reject: "Reject", pendingTrades: "Pending Trades", sentTrades: "Sent Trades" },
  }[isAr ? "ar" : "en"];

  const currentCell = me ? state?.board?.[me.position] : null;

  return (
    <div className="min-h-screen flex flex-col items-center gap-3 p-4 bg-[#0b0710]">
      {/* Top bar: title + mic + chat */}
      <div className="w-full flex items-center justify-between gap-3" style={{ maxWidth: "98vw" }}>
        <div className="text-white font-bold text-2xl">{i18n.title}</div>
        <div className="flex items-center gap-2">
          {state?.roomId && <VoiceControls roomId={state.roomId} />}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-white font-bold text-sm"
            style={{ color: chatOpen ? "#2B2420" : "#fff", background: chatOpen ? "#FED23F" : "rgba(255,255,255,0.1)" }}
          >
            <MessageCircle size={14} />
            {isAr ? "دردشة" : "Chat"}
            {chatMessages.length > 0 && !chatOpen && (
              <span className="rounded-full bg-[#E8574A] px-1.5 text-[9px] text-white">{chatMessages.length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto" style={{ maxWidth: "100vw" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-xl border border-white/10 touch-none"
          style={{ width: "100%", maxWidth: CANVAS_W, imageRendering: "auto", background: "#0e0b16", display: "block" }}
        />
      </div>

      {/* Action banner (clear, no board overlap) */}
      {state?.lastAction && (
        <div
          className="w-full max-w-3xl rounded-xl border border-fuchsia-500/30 bg-black/70 px-4 py-3 text-center"
          style={{ maxWidth: "min(98vw, 1100px)" }}
        >
          <span className="text-amber-300 font-extrabold" style={{ fontSize: 26, lineHeight: 1.3 }}>
            {state.lastAction}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        {isMyTurn && state?.phase === "playing" && (
          <>
            {state?.canRoll && (
              <button
                onClick={rollDice}
                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold transition-all text-sm active:scale-95"
              >
                🎲 {i18n.roll}
              </button>
            )}
            {!!state?.hasRolled && currentCell && (currentCell.type === "property" || currentCell.type === "utility") && !state.players.some((p: any) => p.properties?.includes(currentCell.id)) && me && me.money >= currentCell.price && (
              <button
                onClick={buyProperty}
                className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold transition-all text-sm active:scale-95"
              >
                🏠 {i18n.buy} (${currentCell.price})
              </button>
            )}
            {!!state?.hasRolled && (
              <button
                onClick={endTurn}
                className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 font-bold transition-all text-sm active:scale-95"
              >
                ⏭ {i18n.endTurn}
              </button>
            )}
            {!!state?.hasRolled && otherPlayers.length > 0 && (
              <button
                onClick={() => setShowTradeModal(true)}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold transition-all text-sm active:scale-95"
              >
                🔄 {i18n.trade}
              </button>
            )}
          </>
        )}
        {state?.phase === "finished" && (
          <div className="text-fuchsia-300 font-bold text-lg">
            🎉 {state.players?.find((p: any) => p.id === state.winnerId)?.name} wins!
          </div>
        )}
      </div>

      {/* Pending trades (received) */}
      {myPendingTrades.length > 0 && (
        <div className="w-full max-w-lg space-y-2">
          <div className="text-amber-400 font-bold text-sm">{i18n.pendingTrades}</div>
          {myPendingTrades.map((trade: any) => {
            const fromPlayer = state.players?.find((p: any) => p.id === trade.fromPlayerId);
            return (
              <div key={trade.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="text-white text-sm">
                  <span className="font-bold">{fromPlayer?.name}</span>
                  {trade.offerMoney > 0 && <span className="text-amber-400"> offers ${trade.offerMoney}</span>}
                  {trade.offerProperties.length > 0 && (
                    <span className="text-emerald-400">
                      {" "}+ {trade.offerProperties.length} {isAr ? "ملكيات" : "properties"}
                    </span>
                  )}
                  {" → "}
                  {trade.requestMoney > 0 && <span className="text-amber-400">asks ${trade.requestMoney}</span>}
                  {trade.requestProperties.length > 0 && (
                    <span className="text-rose-400">
                      {" "}+ {trade.requestProperties.length} {isAr ? "ملكيات" : "properties"}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptTrade(trade.id)}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                  >
                    {i18n.accept}
                  </button>
                  <button
                    onClick={() => rejectTrade(trade.id)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                  >
                    {i18n.reject}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sent trades (waiting for response) */}
      {sentTrades.length > 0 && (
        <div className="w-full max-w-lg space-y-2">
          <div className="text-blue-400 font-bold text-sm">{i18n.sentTrades}</div>
          {sentTrades.map((trade: any) => {
            const toPlayer = state.players?.find((p: any) => p.id === trade.toPlayerId);
            return (
              <div key={trade.id} className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="text-white text-sm">
                  <span className="font-bold">{toPlayer?.name}</span>
                  <span className="text-gray-400"> {isAr ? "ينتظر..." : "pending..."}</span>
                </div>
                <button
                  onClick={() => cancelTrade(trade.id)}
                  className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold"
                >
                  {i18n.cancel}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Trade Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1d0d29] border border-purple-500/30 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="text-white font-bold text-lg">{i18n.tradeTitle}</div>

            {/* Select player */}
            <div>
              <label className="text-purple-300 text-sm font-bold">{i18n.selectPlayer}</label>
              <select
                value={tradeTarget}
                onChange={(e) => setTradeTarget(e.target.value)}
                className="w-full mt-1 p-2 rounded bg-white/10 border border-white/20 text-white"
              >
                <option value="">{isAr ? "اختر لاعب..." : "Select player..."}</option>
                {otherPlayers.map((p: any) => (
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
                        className={`px-2 py-1 rounded text-xs font-bold border ${
                          selected
                            ? "bg-amber-500/30 border-amber-400 text-amber-300"
                            : "bg-white/5 border-white/20 text-white"
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
                className="w-full p-2 rounded bg-white/10 border border-white/20 text-white"
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
                            className={`px-2 py-1 rounded text-xs font-bold border ${
                              selected
                                ? "bg-rose-500/30 border-rose-400 text-rose-300"
                                : "bg-white/5 border-white/20 text-white"
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
                  className="w-full p-2 rounded bg-white/10 border border-white/20 text-white"
                  placeholder="$0"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTradeModal(false);
                  setTradeTarget("");
                  setOfferProperties([]);
                  setOfferMoney(0);
                  setRequestProperties([]);
                  setRequestMoney(0);
                }}
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 font-bold text-sm"
              >
                {i18n.cancel}
              </button>
              <button
                onClick={proposeTrade}
                disabled={!tradeTarget || (offerProperties.length === 0 && offerMoney === 0 && requestProperties.length === 0 && requestMoney === 0)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {i18n.propose}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-white/40 text-xs text-center max-w-lg">
        {isAr
          ? "ارمي النرد واشترِ الملكيات. اجمع الإيجار واجعل الخصوم يُفلسون! اللاعبون الآليون يلعبون تلقائياً."
          : "Roll dice, buy properties, collect rent, and bankrupt your opponents! Bots play automatically."}
      </p>

      {/* Slide-out Chat Drawer */}
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
            zIndex: 300,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
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
                <strong style={{ color: "#FED23F" }}>
                  {msg.flag ? codeToEmoji(msg.flag) + " " : ""}{msg.playerName}:
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
