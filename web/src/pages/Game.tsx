import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { GameTable } from "@/components/GameTable";
import { PlayerHand } from "@/components/PlayerHand";
import { DeclarationModal } from "@/components/DeclarationModal";
import { Card } from "@/components/Card";
import { VoiceControls } from "@/components/VoiceControls";
import { GameOver } from "@/components/GameOver";
import { GuideModal } from "@/components/GuideModal";
import { LangToggle } from "@/components/LangToggle";
import { useLanguage } from "@/lib/languageContext";
import type { CardDeclaration } from "@/lib/types";
import { declarationToString } from "@/lib/types";
import { AlertTriangle, ThumbsDown, Play, Clock, Eye, SkipForward, MessageCircle, HelpCircle } from "lucide-react";

export default function Game() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    gameState,
    myHand,
    myPlayerId,
    chatMessages,
    playCards,
    callLiar,
    passTurn,
    voteSkip,
    sendChat,
    addToast,
    reconnectRoom,
  } = useGame();

  const { lang, toggleLang, t } = useLanguage();

  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [challengeCountdown, setChallengeCountdown] = useState<number | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [canVoteYet, setCanVoteYet] = useState(false);

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

  // Reset vote state when challenge window changes
  useEffect(() => {
    if (gameState?.phase !== "waiting_for_challenge") {
      setHasVoted(false);
      setCanVoteYet(false);
      return;
    }

    // Check if we already voted (from server state)
    if (gameState?.skipVotes && myPlayerId && gameState.skipVotes.includes(myPlayerId)) {
      setHasVoted(true);
    }

    // For vote mode: enable voting after 3 seconds
    if (gameState?.challengeMode === "vote" && gameState?.challengeStartedAt) {
      const elapsed = Date.now() - gameState.challengeStartedAt;
      if (elapsed >= 3000) {
        setCanVoteYet(true);
      } else {
        setCanVoteYet(false);
        const timer = setTimeout(() => setCanVoteYet(true), 3000 - elapsed);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState?.phase, gameState?.skipVotes, gameState?.challengeMode, gameState?.challengeStartedAt, myPlayerId]);

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

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput("");
  }, [chatInput, sendChat]);

  const handleVoteSkip = useCallback(async () => {
    try {
      const result = await voteSkip();
      setHasVoted(true);
      addToast(
        `Vote recorded (${result.votesNow}/${result.votesNeeded} needed)`,
        "info",
      );
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Failed to vote",
        "error",
      );
    }
  }, [voteSkip, addToast]);

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
      <div className="relative z-20 flex items-center justify-between gap-2 flex-wrap px-2 sm:px-4 py-2.5 border-b border-amber-900/20 bg-[#0d1a0d]/80 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-wrap">
          <button
            onClick={() => navigate(`/room/${paramRoomId}`)}
            className="text-amber-200/50 hover:text-white text-xs bg-transparent shrink-0"
          >
            {t("game.back_to_room")} {gameState.roomId}
          </button>
          {gameState.claimType && gameState.variant === "cards" && (
            <span className="text-[10px] text-amber-200/40 bg-amber-900/20 px-2 py-0.5 rounded-full">
              {gameState.claimType === "suit" ? t("game.suit_claim") : t("game.rank_claim")}
            </span>
          )}
          {gameState.currentRequiredClaim && (
            <span className="text-xs text-amber-300 bg-amber-900/30 px-2 py-1 rounded-full font-mono">
              {t("game.current_claim")} {declarationToString(gameState.currentRequiredClaim, gameState.claimType)}
            </span>
          )}
          {gameState.phase === "revealing" && (
            <span className="text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded-full animate-pulse">
              {t("game.revealing")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {gameState.phase === "playing" && (
            <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded-full">
              {t("game.playing")}
            </span>
          )}
          {gameState.phase === "waiting_for_challenge" && (
            <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full animate-pulse">
              {t("game.challenge_window")}
            </span>
          )}
          <LangToggle />
          <button
            onClick={() => setShowGuide(true)}
            className="p-2 rounded-lg text-amber-200/60 hover:text-white hover:bg-[#2a1515] transition-all"
            title={t("guide.title")}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="relative p-2 rounded-lg text-amber-200/60 hover:text-white hover:bg-[#2a1515] transition-all"
            title=              {showChat ? t("chat.hide") : t("chat.show")}
          >
            <MessageCircle className="w-4 h-4" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {chatMessages.length > 9 ? "9+" : chatMessages.length}
              </span>
            )}
          </button>
          <VoiceControls roomId={paramRoomId!} />
        </div>
      </div>

      {/* Chat panel */}
      {showChat && (
        <div className="absolute top-14 right-4 z-30 w-72 h-[calc(100vh-7rem)] flex flex-col bg-[#0d1a0d]/95 backdrop-blur-xl border border-amber-900/30 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-in slide-in-from-right-2 duration-200">
          <div className="p-3 pb-1 border-b border-amber-900/20">
              <h3 className="text-white text-sm font-bold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                {t("room.chat")}
              </h3>
          </div>
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0">
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {chatMessages.map((msg, i) => (
                <div key={i} className="text-xs">
                  <span className="text-amber-400 font-medium">{msg.playerName}:</span>{" "}
                  <span className="text-amber-100/80">{msg.message}</span>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <p className="text-amber-200/30 text-xs text-center mt-8">{t("room.no_messages")}</p>
              )}
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2 shrink-0">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t("room.type_message")}
                maxLength={200}
                className="flex-1 px-2.5 py-2 rounded-lg bg-[#2a1515] border border-amber-900/40 text-white placeholder:text-amber-200/30 text-xs focus:border-amber-500/60 focus:outline-none"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white shrink-0 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

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
                      {lastPlayer?.name} {t("game.claims")}:
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
                    {t("game.call_liar")}
                  </button>
                  {gameState?.challengeMode === "vote" && (
                    <button
                      onClick={handleVoteSkip}
                      disabled={hasVoted || !canVoteYet}
                      className="flex-1 inline-flex items-center justify-center gap-2 border border-amber-900/40 text-amber-200 hover:bg-amber-900/20 h-12 rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play className="w-5 h-5" />
                      {hasVoted
                        ? `${t("game.voted")} (${gameState.skipVotes?.length || 0}/${gameState.skipVotesNeeded || 0})`
                        : !canVoteYet
                          ? t("game.wait_to_vote")
                          : t("game.vote_skip")}
                    </button>
                  )}
                  {gameState?.challengeMode === "timer" && (
                    <div className="flex-1 inline-flex items-center justify-center gap-2 border border-amber-900/20 text-amber-200/40 h-12 rounded-xl">
                      <Clock className="w-4 h-4" />
                      {t("game.waiting_timer")}
                    </div>
                  )}
                </div>

                {/* Vote progress bar for vote mode */}
                {gameState?.challengeMode === "vote" && gameState.skipVotes && gameState.skipVotesNeeded > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-amber-200/40 mb-1">
                      <span>{t("game.votes")}: {gameState.skipVotes.length}/{gameState.skipVotesNeeded}</span>
                      <span>{Math.round((gameState.skipVotes.length / gameState.skipVotesNeeded) * 100)}%</span>
                    </div>
                    <div className="w-full bg-amber-900/30 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (gameState.skipVotes.length / gameState.skipVotesNeeded) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Show who's expected to act when it's not us and we can't challenge */}
          {gameState?.phase === "waiting_for_challenge" && !canChallenge && lastPlayer && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-full max-w-sm">
              <div className="bg-[#1c0d0d]/80 backdrop-blur border border-amber-900/30 rounded-xl p-3 text-center mx-4">
                <p className="text-amber-200/60 text-sm">
                  {lastPlayer.name} {t("game.claims")}{" "}
                  <span className="text-amber-400 font-bold font-mono">
                    {gameState.lastDeclaration
                      ? declarationToString(gameState.lastDeclaration, gameState.claimType)
                      : ""}
                  </span>
                </p>
                <p className="text-amber-200/30 text-xs mt-1">
                  {t("game.waiting_challenge")}
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
                    {challengeAction?.playerName ?? "Someone"} {t("game.revealing_title")} {lastPlayer?.name ?? "unknown"}!
                  </p>
                  <p className="text-amber-200/60 text-xs mt-1">
                    {lastPlayer?.name} {t("game.revealing_claimed")}{" "}
                    <span className="text-amber-400 font-mono">
                      {gameState.lastDeclaration
                        ? declarationToString(gameState.lastDeclaration, gameState.claimType)
                        : ""}
                    </span>
                  </p>
                </div>

                <div className="flex gap-2 justify-center flex-wrap mb-4">
                  {gameState.revealedCards.map((cardStr, i) => (
                    <Card key={i} cardStr={cardStr} small />
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
                {t("game.skip_pass")}
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

      {/* Guide modal */}
      <GuideModal
        open={showGuide}
        onClose={() => setShowGuide(false)}
      />

      {/* Declaration modal */}
      <DeclarationModal
        open={showDeclaration}
        onClose={() => setShowDeclaration(false)}
        onSubmit={handleDeclaration}
        selectedCards={selectedCards.map((i) => myHand[i]).filter(Boolean)}
        variant={gameState.variant}
        claimType={gameState.claimType}
        currentRequiredClaim={gameState.currentRequiredClaim}
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
