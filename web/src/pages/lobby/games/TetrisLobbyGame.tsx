import { useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

const BOX = 24;

const PIECE_COLORS: Record<number, { fill: string; light: string }> = {
  0: { fill: "#00009b", light: "#1414af" },
  1: { fill: "#009b00", light: "#14af14" },
  2: { fill: "#9b0000", light: "#af1414" },
  3: { fill: "#9b9b00", light: "#afaf14" },
};

const SHAPES: Record<string, string[][]> = {
  S: [
    [".....", ".....", "..OO.", ".OO..", "....."],
    [".....", "..O..", "..OO.", "...O.", "....."],
  ],
  Z: [
    [".....", ".....", ".OO..", "..OO.", "....."],
    [".....", "..O..", ".OO..", ".O...", "....."],
  ],
  I: [
    ["..O..", "..O..", "..O..", "..O..", "....."],
    [".....", ".....", "OOOO.", ".....", "....."],
  ],
  O: [[".....", ".....", ".OO..", ".OO..", "....."]],
  J: [
    [".....", ".O...", ".OOO.", ".....", "....."],
    [".....", "..OO.", "..O..", "..O..", "....."],
    [".....", ".....", ".OOO.", "...O.", "....."],
    [".....", "..O..", "..O..", ".OO..", "....."],
  ],
  L: [
    [".....", "...O.", ".OOO.", ".....", "....."],
    [".....", "..O..", "..O..", "..OO.", "....."],
    [".....", ".....", ".OOO.", ".O...", "....."],
    [".....", ".OO..", "..O..", "..O..", "....."],
  ],
  T: [
    [".....", "..O..", ".OOO.", ".....", "....."],
    [".....", "..O..", "..OO.", "..O..", "....."],
    [".....", ".....", ".OOO.", "..O..", "....."],
    [".....", "..O..", ".OO..", "..O..", "....."],
  ],
};

export default function TetrisLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = (lobbyState?.subGameState ?? null) as any;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const socket = getSocket();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const actionMap: Record<string, string> = {
        arrowleft: "left", a: "left",
        arrowright: "right", d: "right",
        arrowup: "rotate", w: "rotate", z: "rotateCCW",
        arrowdown: "down", s: "down",
        " ": "drop",
      };
      if (actionMap[k]) {
        e.preventDefault();
        socket.emit("tetris_input", { action: actionMap[k] });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const loop = () => {
      const st = stateRef.current;
      const bw = st?.boardW || 10;
      const bh = st?.boardH || 20;
      canvas.width = bw * BOX + 140;
      canvas.height = bh * BOX + 20;

      ctx.fillStyle = "#0e0b16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Get my player data from per-player boards
      const myData = myPlayerId ? st?.boards?.[myPlayerId] : null;
      const board = myData?.board;
      const fallingPiece = myData?.fallingPiece;
      const nextPiece = myData?.nextPiece;

      if (board) {
        const boardX = 0;
        const boardY = 10;

        // Board cells
        for (let x = 0; x < bw; x++) {
          for (let y = 0; y < bh; y++) {
            const cell = board[x]?.[y];
            const px = boardX + x * BOX;
            const py = boardY + y * BOX;
            if (cell !== "." && cell !== undefined && cell !== null) {
              const c = PIECE_COLORS[cell] ?? { fill: "#555", light: "#777" };
              ctx.fillStyle = c.fill;
              ctx.fillRect(px + 1, py + 1, BOX - 2, BOX - 2);
              ctx.fillStyle = c.light;
              ctx.fillRect(px + 1, py + 1, BOX - 4, BOX - 4);
            } else {
              ctx.fillStyle = "#12101a";
              ctx.fillRect(px, py, BOX, BOX);
            }
          }
        }

        // Border
        ctx.strokeStyle = "#00009b";
        ctx.lineWidth = 3;
        ctx.strokeRect(boardX - 2, boardY - 2, bw * BOX + 4, bh * BOX + 4);

        // Falling piece
        if (fallingPiece) {
          const template = SHAPES[fallingPiece.shape]?.[fallingPiece.rotation];
          if (template) {
            for (let tx = 0; tx < 5; tx++) {
              for (let ty = 0; ty < 5; ty++) {
                if (template[ty]?.[tx] !== ".") {
                  const px = boardX + (fallingPiece.x + tx) * BOX;
                  const py = boardY + (fallingPiece.y + ty) * BOX;
                  const c = PIECE_COLORS[fallingPiece.color] ?? { fill: "#555", light: "#777" };
                  ctx.fillStyle = c.fill;
                  ctx.fillRect(px + 1, py + 1, BOX - 2, BOX - 2);
                  ctx.fillStyle = c.light;
                  ctx.fillRect(px + 1, py + 1, BOX - 4, BOX - 4);
                }
              }
            }
          }
        }

        // Next piece
        const nextX = bw * BOX + 16;
        ctx.font = "bold 14px 'Baloo 2', sans-serif";
        ctx.fillStyle = "#a78bfa";
        ctx.textAlign = "left";
        ctx.fillText(isAr ? "التالي:" : "Next:", nextX, 28);
        if (nextPiece) {
          const template = SHAPES[nextPiece.shape]?.[nextPiece.rotation];
          if (template) {
            for (let tx = 0; tx < 5; tx++) {
              for (let ty = 0; ty < 5; ty++) {
                if (template[ty]?.[tx] !== ".") {
                  const px = nextX + tx * (BOX - 4);
                  const py = 42 + ty * (BOX - 4);
                  const c = PIECE_COLORS[nextPiece.color] ?? { fill: "#555", light: "#777" };
                  ctx.fillStyle = c.fill;
                  ctx.fillRect(px + 1, py + 1, BOX - 6, BOX - 6);
                  ctx.fillStyle = c.light;
                  ctx.fillRect(px + 1, py + 1, BOX - 8, BOX - 8);
                }
              }
            }
          }
        }

        // HUD
        const hudY = 180;
        ctx.fillStyle = "#a78bfa";
        ctx.fillText(`${isAr ? "اللاعبون:" : "Players:"}`, nextX, hudY);

        let py = hudY + 20;
        for (const p of st.players ?? []) {
          const me = p.id === myPlayerId;
          ctx.fillStyle = me ? "#fde047" : "#d8b4fe";
          ctx.fillText(`${p.name}${me ? " *" : ""}`, nextX, py);
          ctx.fillStyle = "#a78bfa";
          ctx.fillText(`${p.score ?? 0}`, nextX + 80, py);
          if (!p.alive) {
            ctx.fillStyle = "#ef4444";
            ctx.fillText("✕", nextX + 110, py);
          }
          py += 22;
        }

        // Countdown
        if (st.phase === "countdown") {
          ctx.fillStyle = "#a78bfa";
          ctx.font = "bold 72px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(Math.max(1, st.countdownLeft)), bw * BOX / 2, bh * BOX / 2 + 20);
        }

        // Finished
        if (st.phase === "finished") {
          ctx.fillStyle = "#fde047";
          ctx.font = "bold 36px 'Baloo 2', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(isAr ? "انتهت اللعبة!" : "Game Over!", bw * BOX / 2, bh * BOX / 2);
          ctx.font = "bold 20px 'Baloo 2', sans-serif";
          ctx.fillText(
            `${isAr ? "الفائز" : "Winner"}: ${(st.winners ?? []).map((id: string) => {
              const w = st.players.find((pp: any) => pp.id === id);
              return w ? w.name : "";
            }).join(", ")}`,
            bw * BOX / 2,
            bh * BOX / 2 + 30
          );
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [myPlayerId, isAr]);

  const i18n = {
    ar: { title: "تيتريس — تنافس", you: "أنت", hint: "الأسهم: حركة • أعلى: دوران • مسافة: سقوط سريع" },
    en: { title: "Tetris — Battle", you: "You", hint: "Arrows: Move • Up: Rotate • Space: Hard Drop" },
  }[isAr ? "ar" : "en"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4 bg-[#0b0710]">
      <div className="text-white font-bold text-lg">{i18n.title}</div>
      <div className="relative" style={{ maxWidth: "92vw" }}>
        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border border-white/10 touch-none"
          style={{ imageRendering: "pixelated", background: "#0e0b16" }}
        />
      </div>
      <p className="text-white/40 text-xs text-center max-w-md">{i18n.hint}</p>
    </div>
  );
}
