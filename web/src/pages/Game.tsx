import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { GameTable } from "@/components/GameTable";
import { PlayerHand } from "@/components/PlayerHand";
import { DeclarationModal } from "@/components/DeclarationModal";
import { VoiceControls } from "@/components/VoiceControls";
import { GameOver } from "@/components/GameOver";
import type { CardDeclaration } from "@/lib/types";
import { declarationToString } from "@/lib/types";
import { AlertTriangle, ThumbsDown, Play, Clock, Eye, SkipForward } from "lucide-react";

export default function Game() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    gameState,
    myHand,
    myPlayerId,
    playCards,
    callLiar,
    passTurn,
    addToast,
    reconnectRoom,
  } = useGame();

  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [challengeCountdown, setChallengeCountdown] = useState<number | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (reconnected) return;
    const storedRoomId = localStorage.getItem("liarsbar_roomId");
    const storedPlayerId = localStorage.getItem("liarsbar_playerId");

    if (storedRoomId === paramRoomId && storedPlayerId && !gameState) {
      reconnectRoom(storedRoomId, storedPlayerId).then(() => {
        setReconnected(true);
      }).catch(() => {});
    } else {
      setReconnected(true);
    }
  }, [paramRoomId, gameState, reconnectRoom, reconnected]);

  useEffect(() => {
    if (gameState?.phase === "lobby" || !gameState) {
      navigate(`/room/${paramRoomId}`);
    }
  }, [gameState, paramRoomId, navigate]);

  // Countdown timer for challenge window
  useEffect(() => {
    if (!gameState?.challengeDeadline || gameState.phase !== "waiting_for_challenge") {
      setChallengeCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((gameState.challengeDeadline! - Date.now()) / 1000));
      setChallengeCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState?.challengeDeadline, gameState?.phase]);

  // Countdown timer for reveal phase
  useEffect(() => {
    if (!gameState?.revealDeadline || gameState.phase !== "revealing") {
      setRevealCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((gameState.revealDeadline! - Date.now()) / 1000));
      setRevealCountdown(remaining + 1);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState?.revealDeadline, gameState?.phase]);

  // Auto-pass when challenge window expires
  useEffect(() => {
    if (!gameState?.challengeDeadline || gameState.phase !== "waiting_for_challenge") return;
    const remaining = gameState.challengeDeadline - Date.now();
    if (remaining <= 0) {
      passTurn().catch(() => {});
    }
  }, [gameState?.challengeDeadline, gameState?.phase, passTurn]);

  const myPlayer = gameState?.players.find((p) => p.id === myPlayerId);
  const isMyTurn =
    gameState?.phase === "playing" &&
    gameState.players[gameState.currentTurn]?.id === myPlayerId;

  const canChallenge =
    gameState?.phase === "waiting_for_challenge" &&
    gameState.lastPlayerId !== null &&
    gameState.lastPlayerId !== myPlayerId;

  const handleCardSelect = useCallback(
    (index: number) => {
      if (!isMyTurn) return;
      setSelectedCards((prev) => {
        if (prev.includes(index)) {
          return prev.filter((i) => i !== index);
        }
        return [...prev, index].sort((a, b) => a - b);
      });
    },
    [isMyTurn],
  );

  const handleDeclaration = useCallback(
    async (declaration: CardDeclaration) => {
      try {
        await playCards(selectedCards, declaration);
        setSelectedCards([]);
        setShowDeclaration(false);
      } catch (err) {
        addToast(
          err instanceof Error ? err.message : "Failed to play",
          "error",
        );
      }
    },
    [selectedCards, playCards, addToast],
  );

  const handleCallLiar = useCallback(async () => {
    try {
      await callLiar();
      setSelectedCards([]);
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to call liar",
        "error",
      );
    }
  }, [callLiar, addToast]);

  const handleSkipTurn = useCallback(async () => {
    try {
      await passTurn();
      setSelectedCards([]);
      addToast("You skipped your turn!", "info");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to skip",
        "error",
      );
    }
  }, [passTurn, addToast]);

  const handlePlayInstead = useCallback(async () => {
    try {
      await passTurn();
      setSelectedCards([]);
      addToast("It's your turn to play! Select cards and make a claim.", "info");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to pass",
        "error",
      );
    }
  }, [passTurn, addToast]);

  const lastPlayer = gameState?.lastPlayerId
    ? gameState.players.find((p) => p.id === gameState.lastPlayerId)
    : null;

  // Get the challenge caller from the action log
  const challengeAction = useMemo(() => {
    if (!gameState?.actionLog) return null;
    const challengeResult = [...gameState.actionLog].reverse().find(
      (a) => a.type === "challenge_result" || a.type === "call_liar",
    );
    return challengeResult;
  }, [gameState?.actionLog]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#1a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-amber-200/60">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d1a0d] via-[#1a2e0d] to-[#0d1a0d] flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-600/4 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-800/5 rounded-full blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-amber-900/20 bg-[#0d1a0d]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/room/${paramRoomId}`)}
            className="text-amber-200/50 hover:text-white text-xs bg-transparent"
          >
            Room {gameState.roomId}
          </button>
          {gameState.claimType && gameState.variant === "cards" && (
            <span className="text-[10px] text-amber-200/40 bg-amber-900/20 px-2 py-0.5 rounded-full">
              {gameState.claimType === "suit" ? "Suit Claim" : "Rank Claim"}
            </span>
          )}
          {gameState.currentRequiredClaim && gameState.phase === "playing" && (
            <span className="text-xs text-amber-300 bg-amber-900/30 px-2 py-1 rounded-full font-mono">
              Must play: {declarationToString(gameState.currentRequiredClaim, gameState.claimType)}
            </span>
          )}
          {gameState.phase === "revealing" && (
            <span className="text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded-full animate-pulse">
              Revealing...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {gameState.phase === "playing" && (
            <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded-full">
              Playing
            </span>
          )}
          {gameState.phase === "waiting_for_challenge" && (
            <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full animate-pulse">
              Challenge Window
            </span>
          )}
          <VoiceControls roomId={paramRoomId!} />
        </div>
      </div>

      {/* Main game area */}
      <div className="flex-1 flex flex-col relative z-10">
        <div className="flex-1 flex items-center justify-center p-4">
          <GameTable
            gameState={gameState}
            myPlayerId={myPlayerId!}
            selectedCards={selectedCards}
            onCardSelect={handleCardSelect}
          />
        </div>

        {/* Action area */}
        <div className="relative z-20">
          {/* Challenge notification for ANY player (except lastPlayer) */}
          {canChallenge && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gradient-to-r from-red-900/90 to-amber-900/90 backdrop-blur-xl border border-red-500/40 rounded-2xl p-4 shadow-2xl shadow-red-900/30 mx-4">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-white font-semibold">
                      {lastPlayer?.name} claims:
                    </p>
                    <p className="text-amber-200 text-lg font-bold font-mono">
                      {gameState.lastDeclaration
                        ? declarationToString(gameState.lastDeclaration, gameState.claimType)
                        : ""}
                    </p>
                  </div>
                  {challengeCountdown !== null && (
                    <div className="flex items-center gap-1 text-amber-400 font-mono text-lg font-bold">
                      <Clock className="w-4 h-4" />
                      {challengeCountdown}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCallLiar}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold h-12 rounded-xl shadow-lg shadow-red-900/40 transition-all active:scale-95"
                  >
                    <ThumbsDown className="w-5 h-5" />
                    Call Liar!
                  </button>
                  <button
                    onClick={handlePlayInstead}
                    className="flex-1 inline-flex items-center justify-center gap-2 border border-amber-900/40 text-amber-200 hover:bg-amber-900/20 h-12 rounded-xl transition-all active:scale-95"
                  >
                    <Play className="w-5 h-5" />
                    Play Cards
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Show who's expected to act when it's not us and we can't challenge */}
          {gameState?.phase === "waiting_for_challenge" && !canChallenge && lastPlayer && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-full max-w-sm">
              <div className="bg-[#1c0d0d]/80 backdrop-blur border border-amber-900/30 rounded-xl p-3 text-center mx-4">
                <p className="text-amber-200/60 text-sm">
                  {lastPlayer.name} claims{" "}
                  <span className="text-amber-400 font-bold font-mono">
                    {gameState.lastDeclaration
                      ? declarationToString(gameState.lastDeclaration, gameState.claimType)
                      : ""}
                  </span>
                </p>
                <p className="text-amber-200/30 text-xs mt-1">
                  Waiting for someone to challenge...
                </p>
              </div>
            </div>
          )}

          {/* Reveal phase overlay */}
          {gameState.phase === "revealing" && gameState.revealedCards.length > 0 && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gradient-to-r from-red-900/90 to-amber-900/90 backdrop-blur-xl border border-red-500/40 rounded-2xl p-6 shadow-2xl shadow-red-900/30 mx-4">
                <div className="text-center mb-4">
                  <Eye className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-white font-bold text-lg">
                    {challengeAction?.playerName ?? "Someone"} called Liar on {lastPlayer?.name ?? "unknown"}!
                  </p>
                  <p className="text-amber-200/60 text-xs mt-1">
                    {lastPlayer?.name} claimed{" "}
                    <span className="text-amber-400 font-mono">
                      {gameState.lastDeclaration
                        ? declarationToString(gameState.lastDeclaration, gameState.claimType)
                        : ""}
                    </span>
                  </p>
                </div>

                <div className="flex gap-2 justify-center flex-wrap mb-4">
                  {gameState.revealedCards.map((cardStr, i) => (
                    <div
                      key={i}
                      className="w-12 h-16 rounded-lg bg-gradient-to-b from-[#faf3e0] to-[#e8d5b0] border border-amber-700/60 shadow-lg flex items-center justify-center"
                    >
                      <span className="text-gray-900 font-mono text-xs font-bold">
                        {cardStr}
                      </span>
                    </div>
                  ))}
                </div>

                {revealCountdown !== null && (
                  <div className="flex items-center justify-center gap-2 text-amber-400 font-mono text-xl font-bold">
                    <Clock className="w-5 h-5" />
                    {revealCountdown}
                  </div>
                )}
                <div className="mt-2 w-full bg-amber-900/30 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${revealCountdown !== null ? (revealCountdown / gameState.revealTime) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Skip/Pass button when it's your turn */}
          {isMyTurn && selectedCards.length === 0 && (
            <div className="flex justify-center mb-2">
              <button
                onClick={handleSkipTurn}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-amber-900/40 text-amber-200/80 hover:bg-[#2a1515] hover:text-white transition-all text-sm"
              >
                <SkipForward className="w-4 h-4" />
                Skip / Pass
              </button>
            </div>
          )}

          {/* Player hand */}
          {myPlayer && (
            <PlayerHand
              cards={myHand}
              selectedCards={selectedCards}
              onCardSelect={handleCardSelect}
              canPlay={isMyTurn}
              onPlayClick={() => setShowDeclaration(true)}
            />
          )}
        </div>
      </div>

      {/* Declaration modal */}
      <DeclarationModal
        open={showDeclaration}
        onClose={() => setShowDeclaration(false)}
        onSubmit={handleDeclaration}
        selectedCards={selectedCards.map((i) => myHand[i]).filter(Boolean)}
        variant={gameState.variant}
        claimType={gameState.claimType}
      />

      {/* Game over overlay */}
      {gameState.phase === "game_over" && (
        <GameOver
          gameState={gameState}
          myPlayerId={myPlayerId!}
          onBackToLobby={() => navigate(`/room/${paramRoomId}`)}
          onHome={() => { localStorage.removeItem("liarsbar_roomId"); localStorage.removeItem("liarsbar_playerId"); navigate("/"); }}
        />
      )}
    </div>
  );
}
