import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import {
  Copy, User, Bot, Play, X, Loader2, ArrowLeft, Crown, MessageCircle, LogIn,
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

  const [chatInput, setChatInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [reconnected, setReconnected] = useState(false);
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

  if (isJoining) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a0a] via-[#2d1111] to-[#1a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-amber-200/60">Joining room...</p>
        </div>
      </div>
    );
  }

  if (!gameState || !isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0a0a] via-[#2d1111] to-[#1a0a0a] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md bg-[#1c0d0d]/90 backdrop-blur-xl border border-amber-900/30 shadow-2xl shadow-black/50 rounded-2xl relative z-10">
          <div className="p-6 pb-2">
            <h2 className="text-white text-xl font-bold">Join Room</h2>
            <p className="text-amber-200/50 text-sm">
              Enter your name to join <span className="text-amber-400 font-mono">{paramRoomId}</span>
            </p>
          </div>
          <div className="p-6 pt-2 space-y-4">
            <div className="space-y-2">
              <label htmlFor="joinName" className="text-amber-200/80 text-sm block">Your Name</label>
              <input
                id="joinName"
                placeholder="Enter your name..."
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={16}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoinRoom(); }}
                className="w-full px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white placeholder:text-amber-200/30 focus:border-amber-500/60 focus:outline-none text-sm"
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={isJoining}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-amber-900/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {isJoining ? "Joining..." : "Join Room"}
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full text-amber-200/40 hover:text-amber-200/60 text-sm py-2 transition-all"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a0a] via-[#2d1111] to-[#1a0a0a] flex flex-col p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-amber-600/3 blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto w-full relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              localStorage.removeItem("liarsbar_roomId");
              localStorage.removeItem("liarsbar_playerId");
              navigate("/");
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-amber-200/60 hover:text-white hover:bg-[#2a1515] transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave
          </button>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">
              Room{" "}
              <span className="text-amber-400 font-mono tracking-widest">
                {gameState.roomId}
              </span>
            </h1>
            <p className="text-amber-200/40 text-sm">
              {gameState.variant === "cards" ? "Playing Cards" : "Dominoes"} &mdash;{" "}
              {gameState.deckCount} deck{gameState.deckCount > 1 ? "s" : ""}
              {gameState.claimType && gameState.variant === "cards" && (
                <> &mdash; <span className="text-amber-400/60">{gameState.claimType === "suit" ? "Suit Claim" : "Rank Claim"}</span></>
              )}
            </p>
          </div>

          <button
            onClick={copyInviteLink}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-900/40 text-amber-200/80 hover:bg-[#2a1515] hover:text-white transition-all text-sm"
          >
            <Copy className="w-4 h-4" />
            Copy Invite Link
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Player List */}
          <div className="md:col-span-2">
            <div className="bg-[#1c0d0d]/90 backdrop-blur-xl border border-amber-900/30 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-lg font-bold">
                    Players ({gameState.players.length}/{gameState.maxPlayers})
                  </h2>
                  {isHost && (
                    <div className="flex gap-2 items-center">
                      <select
                        value={pendingDifficulty}
                        onChange={(e) => setPendingDifficulty(e.target.value as BotDifficulty)}
                        className="px-2 py-1.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white text-xs focus:border-amber-500/60 focus:outline-none"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <button
                        onClick={handleAddBot}
                        disabled={gameState.players.length >= gameState.maxPlayers}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-900/40 text-amber-200/80 hover:bg-[#2a1515] disabled:opacity-30 text-sm transition-all"
                      >
                        <Bot className="w-4 h-4" />
                        Add Bot
                      </button>
                      <button
                        onClick={handleStart}
                        disabled={starting || gameState.players.length < 2}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-sm shadow-lg disabled:opacity-50 transition-all"
                      >
                        {starting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Start
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-amber-200/50 text-xs mt-1">
                  {gameState.players.length < 2
                    ? "Need at least 2 players. Add bots to fill slots."
                    : "Ready to play!"}
                </p>
              </div>

              <div className="p-6 pt-2 space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#2a1515] border border-amber-900/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                        {player.isBot ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-white font-medium flex items-center gap-2">
                          {player.name}
                          {player.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          {player.id === myPlayerId && (
                            <span className="text-xs text-amber-400/60">(you)</span>
                          )}
                        </p>
                        <p className="text-amber-200/40 text-xs">
                          {player.isBot ? "Bot" : "Human"}
                          {!player.isConnected && " \u2022 Disconnected"}
                        </p>
                      </div>
                    </div>
                    {isHost && player.isBot && !player.isHost && (
                      <button
                        onClick={() => handleRemoveBot(player.id)}
                        className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-900/20 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {Array.from({
                  length: gameState.maxPlayers - gameState.players.length,
                }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-amber-900/20 opacity-40"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#2a1515] flex items-center justify-center">
                      <User className="w-5 h-5 text-amber-200/30" />
                    </div>
                    <p className="text-amber-200/30 text-sm">Waiting for player...</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="md:col-span-1">
            <div className="bg-[#1c0d0d]/90 backdrop-blur-xl border border-amber-900/30 rounded-2xl shadow-xl h-full flex flex-col overflow-hidden">
              <div className="p-4 pb-2">
                <h2 className="text-white text-lg font-bold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-amber-400" />
                  Chat
                </h2>
              </div>

              <div className="flex-1 flex flex-col p-4 pt-0 gap-3 min-h-[300px] max-h-[400px]">
                <div className="flex-1 overflow-y-auto space-y-2">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-amber-400 font-medium">{msg.playerName}:</span>{" "}
                      <span className="text-amber-100/80">{msg.message}</span>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <p className="text-amber-200/30 text-xs text-center mt-8">No messages yet</p>
                  )}
                </div>

                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={200}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white placeholder:text-amber-200/30 text-sm focus:border-amber-500/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white shrink-0 transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
