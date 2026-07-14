import { useGame } from "@/lib/gameContext";
import { getSocket } from "@/lib/socket";
import { useLanguage } from "@/lib/languageContext";

export default function TicTacToeLobbyGame() {
  const { lobbyState, myPlayerId } = useGame();
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const state = (lobbyState?.subGameState ?? null) as any;
  const socket = getSocket();

  const mySymbol = state?.players?.find((p: any) => p.id === myPlayerId)?.symbol;

  const play = (i: number) => {
    if (!state || state.phase !== "playing") return;
    if (state.board[i]) return;
    if (state.turn !== mySymbol) return;
    socket.emit("ttt_move", { index: i });
  };

  const i18n = {
    ar: { title: "تيك تاك تو", turn: "دور", you: "أنت", win: "فاز", tie: "تعادل", x: "س", o: "ص", target: "هدف", matchWin: "فاز بالمباراة!" },
    en: { title: "Tic-Tac-Toe", turn: "Turn", you: "(You)", win: "wins!", tie: "It's a tie!", x: "X", o: "O", target: "Target", matchWin: "Wins the match!" },
  }[isAr ? "ar" : "en"];

  if (!state) return null;

  // Match winner check
  if (state.matchWinner) {
    const winnerName = state.players?.find((p: any) => p.symbol === state.matchWinner)?.name;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-[#0b0710]">
        <div className="text-3xl font-black text-fuchsia-300">
          {winnerName} {i18n.matchWin}
        </div>
        <div className="flex gap-4 text-lg text-white/80">
          <span>{i18n.x}: {state.scores?.X ?? 0} / {state.winTarget}</span>
          <span>{i18n.o}: {state.scores?.O ?? 0} / {state.winTarget}</span>
        </div>
      </div>
    );
  }

  const status = state.phase === "finished"
    ? state.winner === "tie"
      ? i18n.tie
      : `${state.winner} ${i18n.win}`
    : `${i18n.turn}: ${state.turn}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-[#0b0710]">
      <div className="text-white/70 text-sm">
        {state.players.filter((p: any) => p.symbol).map((p: any) => (
          <span key={p.id} className="mx-2">
            <b style={{ color: p.symbol === "X" ? "#f472b6" : "#38bdf8" }}>{p.symbol}</b> {p.name}
            {p.id === myPlayerId ? ` ${i18n.you}` : ""}
          </span>
        ))}
      </div>

      <div className="text-xl font-bold text-white">{status}</div>

      <div className="grid grid-cols-3 gap-2 bg-white/5 p-2 rounded-2xl border border-white/10" style={{ width: 320, maxWidth: "92vw" }}>
        {state.board.map((cell: string, i: number) => {
          const win = state.winningLine?.includes(i);
          return (
            <button
              key={i}
              onClick={() => play(i)}
              className={`aspect-square flex items-center justify-center text-5xl font-extrabold rounded-xl transition-all ${
                win ? "bg-emerald-500/30 text-emerald-300" : "bg-[#16121f] hover:bg-white/10"
              } ${cell === "X" ? "text-fuchsia-400" : cell === "O" ? "text-sky-400" : ""}`}
            >
              {cell}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-sm text-white/60">
        <span>{i18n.x}: {state.scores?.X ?? 0}{state.winTarget ? ` / ${state.winTarget}` : ""}</span>
        <span>{i18n.o}: {state.scores?.O ?? 0}{state.winTarget ? ` / ${state.winTarget}` : ""}</span>
        <span>{i18n.tie}: {state.scores?.ties ?? 0}</span>
      </div>
    </div>
  );
}
