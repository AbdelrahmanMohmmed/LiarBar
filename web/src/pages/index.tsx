import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { Swords, Users, Gamepad2, Dice1, LogIn } from "lucide-react";
import type { GameVariant, ClaimType } from "@/lib/types";
import { isFirebaseConfigured, signInWithGoogle, onAuthChange } from "@/lib/firebase";

export default function Index() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, addToast } = useGame();

  const [playerName, setPlayerName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [variant, setVariant] = useState<GameVariant>("cards");
  const [claimType, setClaimType] = useState<ClaimType>("suit");
  const [revealTime, setRevealTime] = useState("5");
  const [deckCount, setDeckCount] = useState("2");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; photo?: string } | null>(null);
  const [tab, setTab] = useState<"create" | "join">("create");

  useEffect(() => {
    if (isFirebaseConfigured()) {
      const unsub = onAuthChange((user) => {
        if (user) {
          setGoogleUser({ name: user.displayName || "Player", photo: user.photoURL || undefined });
          setPlayerName(user.displayName || "");
        } else {
          setGoogleUser(null);
        }
      });
      return unsub;
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      addToast("Google Sign-In is not configured. Set up Firebase first.", "error");
      return;
    }
    const user = await signInWithGoogle();
    if (!user) {
      addToast("Google sign-in failed or was cancelled", "error");
    }
  }, [addToast]);

  const handleCreate = useCallback(async () => {
    if (!playerName.trim()) {
      addToast("Enter your name first", "error");
      return;
    }
    setIsLoading(true);
    try {
      const { roomId } = await createRoom(
        playerName.trim(),
        parseInt(maxPlayers),
        variant,
        parseInt(deckCount),
        variant === "cards" ? claimType : undefined,
        parseInt(revealTime),
      );
      navigate(`/room/${roomId}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, maxPlayers, variant, deckCount, revealTime, createRoom, navigate, addToast]);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) {
      addToast("Enter your name first", "error");
      return;
    }
    if (!joinRoomId.trim()) {
      addToast("Enter a room code", "error");
      return;
    }
    setIsLoading(true);
    try {
      await joinRoom(joinRoomId.trim(), playerName.trim());
      navigate(`/room/${joinRoomId.trim().toUpperCase()}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join room", "error");
    } finally {
      setIsLoading(false);
    }
  }, [playerName, joinRoomId, joinRoom, navigate, addToast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0a0a] via-[#2d1111] to-[#1a0a0a] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-800/5 rounded-full blur-3xl" />
      </div>

      <div className="mb-8 text-center relative z-10">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/50">
            <Swords className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Liar's Bar
          </h1>
        </div>
        <p className="text-amber-200/60 text-sm mt-1">
          A game of deception, risk, and nerve
        </p>
      </div>

      <div className="w-full max-w-md bg-[#1c0d0d]/90 backdrop-blur-xl border border-amber-900/30 shadow-2xl shadow-black/50 rounded-2xl relative z-10">
        <div className="p-6 pb-2">
          <h2 className="text-white text-xl font-bold">Join the Table</h2>
          <p className="text-amber-200/50 text-sm">Enter your display name to get started</p>
        </div>
        <div className="p-6 pt-2 space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-amber-200/80 text-sm block">Your Name</label>
            <div className="flex gap-2">
              <input
                id="name"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={16}
                className="flex-1 px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white placeholder:text-amber-200/30 focus:border-amber-500/60 focus:outline-none text-sm"
              />
              {isFirebaseConfigured() && (
                <button
                  onClick={handleGoogleSignIn}
                  className="px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-amber-200/70 hover:bg-[#3a1f1f] hover:text-white transition-all"
                  title={googleUser ? `Signed in as ${googleUser.name}` : "Sign in with Google"}
                >
                  <LogIn className="w-4 h-4" />
                </button>
              )}
            </div>
            {googleUser && (
              <p className="text-emerald-400/60 text-xs">
                Signed in as {googleUser.name}
              </p>
            )}
          </div>

          <div className="flex rounded-lg bg-[#2a1515] p-0.5">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === "create"
                  ? "bg-amber-900/60 text-white shadow-sm"
                  : "text-amber-200/60 hover:text-amber-200/80"
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Create Room
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === "join"
                  ? "bg-amber-900/60 text-white shadow-sm"
                  : "text-amber-200/60 hover:text-amber-200/80"
              }`}
            >
              <Users className="w-4 h-4" />
              Join Room
            </button>
          </div>

          {tab === "create" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-amber-200/80 text-xs block">Max Players</label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white text-sm focus:border-amber-500/60 focus:outline-none"
                  >
                    {[3, 4, 5, 6].map((n) => (
                      <option key={n} value={String(n)}>{n} Players</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-amber-200/80 text-xs block">Game Type</label>
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value as GameVariant)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white text-sm focus:border-amber-500/60 focus:outline-none"
                  >
                    <option value="cards">Cards</option>
                    <option value="dominoes">Dominoes</option>
                  </select>
                </div>
              </div>

              {variant === "cards" && (
                <div className="space-y-2">
                  <label className="text-amber-200/80 text-xs block">Claim Type</label>
                  <select
                    value={claimType}
                    onChange={(e) => setClaimType(e.target.value as ClaimType)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white text-sm focus:border-amber-500/60 focus:outline-none"
                  >
                    <option value="suit">Suit-only (e.g. "2x Hearts")</option>
                    <option value="rank">Rank-only (e.g. "2x A")</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-amber-200/80 text-xs block">Number of Decks</label>
                <select
                  value={deckCount}
                  onChange={(e) => setDeckCount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white text-sm focus:border-amber-500/60 focus:outline-none"
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={String(n)}>{n} Deck{n > 1 ? "s" : ""}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-amber-200/80 text-xs block">
                  Reveal Duration: <span className="text-amber-400 font-mono">{revealTime}s</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={revealTime}
                  onChange={(e) => setRevealTime(e.target.value)}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-amber-200/30">
                  <span>3s</span>
                  <span>10s</span>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-amber-900/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <>
                    <Dice1 className="w-4 h-4" />
                    Create Room
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-amber-200/80 text-xs block">Room Code</label>
                <input
                  placeholder="e.g. ABC123"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white placeholder:text-amber-200/30 focus:border-amber-500/60 focus:outline-none text-center text-lg tracking-widest font-mono"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-900/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </span>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Join Room
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-amber-200/20 text-xs mt-6 relative z-10">
        Liar's Bar &mdash; A game of bluff and nerve
      </p>
    </div>
  );
}
