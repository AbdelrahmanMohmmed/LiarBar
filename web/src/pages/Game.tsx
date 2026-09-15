import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame, storedSession } from "@/lib/gameContext";
import { GameTable } from "@/components/GameTable";
import { PlayerHand } from "@/components/PlayerHand";
import { MobileHandSheet } from "@/components/MobileHandSheet";
import { DeclarationModal } from "@/components/DeclarationModal";
import { Card } from "@/components/Card";
import { VoiceControls } from "@/components/VoiceControls";
import { GameOver } from "@/components/GameOver";
import { GuideModal } from "@/components/GuideModal";
import { LangToggle } from "@/components/LangToggle";
import { useLanguage } from "@/lib/languageContext";
import { useIsMobile } from "@/hooks/user-mobile";
import type { CardDeclaration } from "@/lib/types";
import { declarationToString } from "@/lib/types";
import { AlertTriangle, ThumbsDown, Play, Clock, Eye, SkipForward, MessageCircle, HelpCircle, ChevronDown, ChevronUp, Send } from "lucide-react";

export default function Game() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    lobbyState,
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
    leaveRoom,
    partyState,
    partyRematch,
  } = useGame();

  const { lang, toggleLang, t } = useLanguage();

  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [challengeCountdown, setChallengeCountdown] = useState<number | null>(null);
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [canVoteYet, setCanVoteYet] = useState(false);
  const [handSheetCollapsed, setHandSheetCollapsed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (reconnected) return;
    const { roomId: storedRoomId, playerId: storedPlayerId } = storedSession();

    if (storedRoomId === paramRoomId && storedPlayerId && !gameState) {
      reconnectRoom(storedRoomId, storedPlayerId).then(() => {
        setReconnected(true);
      }).catch(() => {});
    } else {
      setReconnected(true);
    }
  }, [paramRoomId, gameState, reconnectRoom, reconnected]);

  // A party never goes to /room/:id — that page is the classic standalone
  // lobby and asks a party member, who is already seated, to type their name
  // and join. PartyRouter owns where a party goes; this bounce is only for
  // the classic flow.
  const inParty = partyState?.roomId === paramRoomId;

  useEffect(() => {
    if (inParty) return;
    if (gameState?.phase === "lobby" || !gameState) {
      navigate(`/room/${paramRoomId}`);
    }
  }, [inParty, gameState, paramRoomId, navigate]);

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

  // Auto-scroll chat to the latest message while it's open
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

  const myPlayer = gameState?.players.find((p) => p.id === myPlayerId);
  const isMyTurn =
    gameState?.phase === "playing" &&
    gameState.players[gameState.currentTurn]?.id === myPlayerId;

  // On mobile, your turn takes over the screen with a full sliding hand
  // sheet instead of the small in-flow hand bar.
  const showMobileHandSheet = isMobile && isMyTurn;
  const claimLabel = gameState?.currentRequiredClaim
    ? `${t("game.current_claim")} ${declarationToString(gameState.currentRequiredClaim, gameState.claimType)}`
    : null;

  // Re-expand the hand sheet at the start of every turn, even if the player
  // collapsed it to peek at the table on a previous turn.
  useEffect(() => {
    if (isMyTurn) setHandSheetCollapsed(false);
  }, [isMyTurn]);

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
          <p className="text-amber-200/60">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    /*
      `h-[100dvh]`, not `min-h-screen`. The page already clips its overflow, so
      a minimum height bought nothing — but it let the column grow past the
      viewport the moment the table area reserved room for the hand sheet, and
      a taller column just pushed the table back down underneath it. A fixed
      viewport height is what makes that reservation mean anything. `dvh` so the
      mobile browser chrome collapsing doesn't leave a gap.
    */
    <div className="h-[100dvh] bg-gradient-to-b from-[#0d1a0d] via-[#1a2e0d] to-[#0d1a0d] flex flex-col overflow-hidden relative">
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
          {!lobbyState && <VoiceControls />}
        </div>
      </div>

      {/* Main game area */}
      {/*
        `min-h-0` on the column as well as on the table row. A flex item's
        default minimum is its content height, so without it this wrapper grew
        to fit the table plus the space reserved for the hand sheet, overflowed
        the fixed-height page, and pushed the table straight back under the
        sheet it was trying to avoid.
      */}
      <div className="flex-1 min-h-0 flex flex-col relative z-10">
        {/*
          Reserve the space the mobile hand sheet is occupying, so the table
          recentres into what's left instead of being covered by it. The sheet
          publishes its own height; it is 0px whenever the sheet is off screen,
          which is every desktop layout and most of a mobile game.
        */}
        <div
          className="flex-1 min-h-0 flex items-center justify-center p-4"
          style={{ paddingBottom: "calc(1rem + var(--hand-sheet-h, 0px))" }}
        >
          <GameTable
            gameState={gameState}
            myPlayerId={myPlayerId!}
            selectedCards={selectedCards}
            onCardSelect={handleCardSelect}
          />
        </div>

        {/* Action area. The bottom padding reserves room for the floating chat
            pill; while the mobile hand sheet is up the pill is hidden and
            everything else in here is too, so the padding is only stealing
            height from the table. */}
        <div className={`relative z-20 ${showMobileHandSheet ? "pb-0" : "pb-16"}`}>
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

          {/* Skip/Pass button when it's your turn (on mobile this lives inside the hand sheet instead) */}
          {isMyTurn && selectedCards.length === 0 && !showMobileHandSheet && (
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

          {/* Player hand — normal in-flow bar; replaced by the full sliding sheet on mobile during your turn */}
          {myPlayer && !showMobileHandSheet && (
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

      {/* Floating collapsible chat pill (bottom-center, expands upward).
          Hidden while the mobile hand sheet is up so it can't cover the
          sheet's Skip/Make Claim button, which sits in the same corner. */}
      <div
        className="fixed left-1/2 z-[90] w-[calc(100%-2rem)] max-w-[420px] rounded-3xl border border-border bg-surface/95 backdrop-blur-xl shadow-3 overflow-hidden flex flex-col transition-all duration-300"
        style={{
          // Clears the party dock. A fixed element can't be pushed by the
          // body padding that handles everything in normal flow, so it has to
          // offset itself — otherwise the dock sits squarely on top of it.
          bottom: "calc(12px + var(--party-dock-h))",
          height: chatOpen ? 300 : 48,
          // The X half is what centres this against `left: 50%`, and it has to
          // live in the same declaration as the Y half: `transform` is one
          // property, so an inline `translateY(...)` silently replaced the
          // `-translate-x-1/2` class that used to be on the element — and the
          // pill sat with 156 of its 343 pixels off the right of the screen,
          // in both languages, for as long as the slide-away animation has
          // existed.
          transform: showMobileHandSheet
            ? "translate(-50%, 150%)"
            : "translate(-50%, 0)",
          opacity: showMobileHandSheet ? 0 : 1,
          pointerEvents: showMobileHandSheet ? "none" : "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setChatOpen(!chatOpen)}
          className="flex h-12 items-center justify-between gap-2 px-4 shrink-0 text-cream"
        >
          <span className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-4 h-4 text-amber-400 shrink-0" />
            {!chatOpen && chatMessages.length > 0 ? (
              <span className="text-xs font-semibold text-amber-200/90 truncate">
                {chatMessages[chatMessages.length - 1].playerName}: {chatMessages[chatMessages.length - 1].message}
              </span>
            ) : (
              <span className="text-sm font-bold">{t("room.chat")}</span>
            )}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {chatMessages.length > 0 && !chatOpen && (
              <span className="w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {chatMessages.length > 9 ? "9+" : chatMessages.length}
              </span>
            )}
            {chatOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </button>

        {chatOpen && (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 border-t border-amber-900/20">
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
              <div ref={chatEndRef} />
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
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Full-screen sliding hand sheet (mobile, your turn only) */}
      <MobileHandSheet
        visible={showMobileHandSheet}
        collapsed={handSheetCollapsed}
        onToggleCollapse={() => setHandSheetCollapsed((v) => !v)}
        cards={myHand}
        selectedCards={selectedCards}
        onCardSelect={handleCardSelect}
        onPlayClick={() => setShowDeclaration(true)}
        onSkip={handleSkipTurn}
        claimLabel={claimLabel}
      />

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
          /*
            "Rematch" used to navigate to /room/:id for everyone. In a party
            that is the classic lobby, which greets a player who is already in
            the room with "enter your name to join" — so the one button on the
            game-over screen threw you out of the game you had just finished.
            A party deals again in place; only a classic room goes to a lobby.
          */
          onBackToLobby={() => {
            if (inParty) void partyRematch();
            else navigate(`/room/${paramRoomId}`);
          }}
          onHome={() => { leaveRoom(); navigate("/"); }}
        />
      )}
    </div>
  );
}
