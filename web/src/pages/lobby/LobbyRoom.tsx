import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "@/lib/gameContext";
import { useLanguage } from "@/lib/languageContext";
import { VoiceControls } from "@/components/VoiceControls";
import Game from "../Game";
import CodenamesGame from "../codenames/CodenamesGame";
import HigherLowerGame from "../higher-lower/HigherLowerGame";
import SnakeLobbyGame from "./games/SnakeLobbyGame";
import TicTacToeLobbyGame from "./games/TicTacToeLobbyGame";
import SpaceInvadersLobbyGame from "./games/SpaceInvadersLobbyGame";
import FighterLobbyGame from "./games/FighterLobbyGame";
import {
  ArrowLeft,
  Crown,
  Users,
  MessageSquare,
  Send,
  Loader2,
  Gamepad2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export default function LobbyRoom() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const {
    lobbyState,
    myPlayerId,
    myRoomId,
    joinRoom,
    reconnectRoom,
    sendChat,
    chatMessages,
    lobbyStartGame,
    lobbyReturnToLobby,
    addToast,
  } = useGame();
  const { t, lang } = useLanguage();

  const [chatInput, setChatInput] = useState("");
  const [reconnected, setReconnected] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Selected game and settings in host options
  const [selectedGame, setSelectedGame] = useState<"liars-bar" | "codenames" | "higher-lower" | "snake" | "tictactoe" | "space-invaders" | "fighter">("liars-bar");
  
  // Liar's Bar options
  const [lbMaxPlayers, setLbMaxPlayers] = useState("4");
  const [lbVariant, setLbVariant] = useState<"cards" | "dominoes">("cards");
  const [lbClaimType, setLbClaimType] = useState<"suit" | "rank">("suit");
  const [lbRevealTime, setLbRevealTime] = useState("5");
  const [lbDeckCount, setLbDeckCount] = useState("2");
  const [lbChallengeMode, setLbChallengeMode] = useState<"timer" | "vote">("timer");
  const [lbChallengeDuration, setLbChallengeDuration] = useState("5");

  // Codenames options
  const [cnMaxPlayers, setCnMaxPlayers] = useState("6");
  const [cnLanguage, setCnLanguage] = useState<"ar" | "en">("ar");

  // Higher Lower options
  const [hlMaxPlayers, setHlMaxPlayers] = useState("4");

  // Snake options
  const [snakeDuration, setSnakeDuration] = useState("60");

  // Fighter options
  const [fighterWins, setFighterWins] = useState("3");

  const isInRoom = myPlayerId && lobbyState?.players.some((p) => p.id === myPlayerId);
  const me = lobbyState?.players.find((p) => p.id === myPlayerId);
  const isHost = me?.isHost === true;

  useEffect(() => {
    if (reconnected) return;
    const storedRoomId = localStorage.getItem("liarsbar_roomId");
    const storedPlayerId = localStorage.getItem("liarsbar_playerId");

    if (storedRoomId === paramRoomId && storedPlayerId && !lobbyState) {
      reconnectRoom(storedRoomId, storedPlayerId)
        .then(() => {
          setReconnected(true);
        })
        .catch(() => {
          setReconnected(true);
        });
    } else if (paramRoomId === myRoomId && isInRoom) {
      setReconnected(true);
    } else if (!lobbyState && !storedPlayerId) {
      setReconnected(true);
    }
  }, [paramRoomId, myRoomId, lobbyState, reconnectRoom, reconnected, isInRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinName.trim()) {
      addToast("Enter your name first", "error");
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom(paramRoomId!, joinName.trim());
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to join lobby", "error");
    } finally {
      setIsJoining(false);
    }
  }, [joinName, paramRoomId, joinRoom, addToast]);

  const handleSendChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      sendChat(chatInput.trim());
      setChatInput("");
    },
    [chatInput, sendChat]
  );

  const handleStartGame = useCallback(async () => {
    try {
      let options: any = {};
      if (selectedGame === "liars-bar") {
        options = {
          maxPlayers: parseInt(lbMaxPlayers),
          variant: lbVariant,
          deckCount: parseInt(lbDeckCount),
          claimType: lbVariant === "cards" ? lbClaimType : undefined,
          revealTime: parseInt(lbRevealTime),
          challengeMode: lbChallengeMode,
          challengeDuration: parseInt(lbChallengeDuration),
        };
      } else if (selectedGame === "codenames") {
        options = {
          maxPlayers: parseInt(cnMaxPlayers),
          language: cnLanguage,
        };
      } else if (selectedGame === "higher-lower") {
        options = {
          maxPlayers: parseInt(hlMaxPlayers),
        };
      } else if (selectedGame === "snake") {
        options = {
          duration: parseInt(snakeDuration),
        };
      } else if (selectedGame === "tictactoe" || selectedGame === "space-invaders") {
        options = {};
      } else if (selectedGame === "fighter") {
        options = { winTarget: parseInt(fighterWins) };
      }

      await lobbyStartGame(selectedGame, options);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to start game", "error");
    }
  }, [
    selectedGame,
    lbMaxPlayers,
    lbVariant,
    lbDeckCount,
    lbClaimType,
    lbRevealTime,
    lbChallengeMode,
    lbChallengeDuration,
    cnMaxPlayers,
    cnLanguage,
    hlMaxPlayers,
    snakeDuration,
    fighterWins,
    lobbyStartGame,
    addToast,
  ]);

  if (!reconnected) {
    return (
      <div className="min-h-screen bg-[#0e0606] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  // Join prompt screen
  if (!lobbyState || !isInRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#120717] via-[#1a0a20] to-[#120717] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#190c1f]/90 border border-purple-900/30 shadow-2xl rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-white text-2xl font-bold">Join Party Lobby</h2>
            <p className="text-purple-300/50 text-sm mt-1">
              Room Code: <span className="text-purple-400 font-mono font-bold">{paramRoomId}</span>
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="joinName" className="text-purple-200/80 text-xs block mb-1">
                Your Display Name
              </label>
              <input
                id="joinName"
                placeholder="Enter nickname..."
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={16}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJoinRoom();
                }}
                className="w-full px-3 py-2.5 rounded-lg bg-[#27152f] border border-purple-900/40 text-white placeholder:text-purple-200/30 focus:border-purple-500 focus:outline-none text-sm"
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={isJoining}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              Join Lobby
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full text-purple-300/40 hover:text-purple-300/60 text-xs py-1 transition-all"
            >
              Back to Games
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline render game screen if a sub-game is active!
  if (lobbyState.activeGameId) {
    return (
      <div className="relative min-h-screen bg-[#0d070f]">
        {/* Floating Return to Lobby button for host */}
        {isHost && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={lobbyReturnToLobby}
              className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white text-xs px-4 py-2 rounded-full shadow-lg shadow-black/40 ring-2 ring-purple-500/30 font-bold transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Return to Lobby Menu
            </button>
          </div>
        )}

        {/* Persistent Voice Controls display in the top right floating corner */}
        <div className="absolute top-4 right-4 z-50 bg-[#170e1c]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-900/40 shadow-md">
          <VoiceControls roomId={paramRoomId!} />
        </div>

        {/* Inline Game Views */}
        {lobbyState.activeGameId === "liars-bar" && <Game />}
        {lobbyState.activeGameId === "codenames" && <CodenamesGame />}
        {lobbyState.activeGameId === "higher-lower" && <HigherLowerGame />}
        {lobbyState.activeGameId === "snake" && <SnakeLobbyGame />}
        {lobbyState.activeGameId === "tictactoe" && <TicTacToeLobbyGame />}
        {lobbyState.activeGameId === "space-invaders" && <SpaceInvadersLobbyGame />}
        {lobbyState.activeGameId === "fighter" && <FighterLobbyGame />}
      </div>
    );
  }

  // Lobby Menu Page
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#100615] via-[#1a0c24] to-[#100615] flex flex-col p-4 font-sans text-purple-100">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col gap-6 py-4">
        {/* Top Navbar */}
        <div className="flex items-center justify-between border-b border-purple-950/30 pb-4">
          <button
            onClick={() => {
              localStorage.removeItem("liarsbar_roomId");
              localStorage.removeItem("liarsbar_playerId");
              navigate("/");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-purple-300/60 hover:text-white hover:bg-purple-950/40 transition-all text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave Party
          </button>
          
          <div className="text-center">
            <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent tracking-wide">
              LOBBY GAME HUB
            </h1>
            <p className="text-[10px] text-purple-400 font-mono tracking-widest mt-0.5">
              CODE: {paramRoomId}
            </p>
          </div>

          <div className="bg-[#1f0e2a] px-3 py-1.5 rounded-full border border-purple-900/40 shadow-sm flex items-center gap-2">
            <VoiceControls roomId={paramRoomId!} />
          </div>
        </div>

        {/* Main Columns */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Player List */}
          <div className="md:col-span-4 bg-[#180b20]/70 border border-purple-950/40 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-purple-950/30 pb-3">
              <Users className="w-5 h-5 text-purple-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-purple-300">
                Party Members ({lobbyState.players.length})
              </h2>
            </div>
            
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] md:max-h-[none]">
              {lobbyState.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    player.id === myPlayerId
                      ? "bg-[#251032]/85 border-purple-500/50"
                      : "bg-[#1d0d27]/40 border-purple-950/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
                        {player.name.slice(0, 2).toUpperCase()}
                      </div>
                      {!player.isConnected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full border-2 border-[#180b20]" title="Offline" />
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {player.name} {player.id === myPlayerId && "(You)"}
                      </span>
                      {!player.isConnected && (
                        <span className="text-[10px] text-red-400/80">Offline</span>
                      )}
                    </div>
                  </div>
                  {player.isHost && (
                    <Crown className="w-4 h-4 text-amber-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Center Column: Game Selection / Host Dashboard */}
          <div className="md:col-span-5 bg-[#180b20]/70 border border-purple-950/40 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-purple-950/30 pb-3">
              <Gamepad2 className="w-5 h-5 text-purple-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-purple-300">
                {isHost ? "Choose Next Game" : "Active Game Selection"}
              </h2>
            </div>

            {isHost ? (
              <div className="flex-1 flex flex-col gap-4">
                {/* Game Type Picker */}
                <div className="grid grid-cols-4 gap-2">
                  {(["liars-bar", "codenames", "higher-lower", "snake", "tictactoe", "space-invaders", "fighter"] as const).map((game) => (
                    <button
                      key={game}
                      onClick={() => setSelectedGame(game)}
                      className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition-all uppercase ${
                        selectedGame === game
                          ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-900/30"
                          : "bg-[#21112b]/50 border-purple-950/20 text-purple-300 hover:bg-[#251330] hover:text-white"
                      }`}
                    >
                      {game.replace("-", " ")}
                    </button>
                  ))}
                </div>

                {/* Configuration Options */}
                <div className="flex-1 bg-[#1e0e29] border border-purple-950/45 p-4 rounded-xl space-y-4 text-xs overflow-y-auto max-h-[300px]">
                  {selectedGame === "liars-bar" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Liar's Bar Settings</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Variant</span>
                          <select
                            value={lbVariant}
                            onChange={(e) => setLbVariant(e.target.value as any)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="cards">Cards</option>
                            <option value="dominoes">Dominoes</option>
                          </select>
                        </label>

                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Max Players</span>
                          <select
                            value={lbMaxPlayers}
                            onChange={(e) => setLbMaxPlayers(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                          </select>
                        </label>

                        {lbVariant === "cards" && (
                          <label className="space-y-1 block">
                            <span className="text-purple-300/70 block">Claim Style</span>
                            <select
                              value={lbClaimType}
                              onChange={(e) => setLbClaimType(e.target.value as any)}
                              className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                            >
                              <option value="suit">Suit (Standard)</option>
                              <option value="rank">Rank (All claims match)</option>
                            </select>
                          </label>
                        )}

                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Deck Count</span>
                          <select
                            value={lbDeckCount}
                            onChange={(e) => setLbDeckCount(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="1">1 Deck</option>
                            <option value="2">2 Decks</option>
                            <option value="3">3 Decks</option>
                            <option value="4">4 Decks</option>
                          </select>
                        </label>

                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Reveal Time</span>
                          <select
                            value={lbRevealTime}
                            onChange={(e) => setLbRevealTime(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="3">3s</option>
                            <option value="5">5s</option>
                            <option value="7">7s</option>
                            <option value="10">10s</option>
                          </select>
                        </label>

                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Challenge Mode</span>
                          <select
                            value={lbChallengeMode}
                            onChange={(e) => setLbChallengeMode(e.target.value as any)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="timer">Timer</option>
                            <option value="vote">Vote to Skip</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  {selectedGame === "codenames" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Codenames Settings</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Max Players</span>
                          <select
                            value={cnMaxPlayers}
                            onChange={(e) => setCnMaxPlayers(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="4">4</option>
                            <option value="6">6</option>
                            <option value="8">8</option>
                            <option value="10">10</option>
                          </select>
                        </label>

                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Language</span>
                          <select
                            value={cnLanguage}
                            onChange={(e) => setCnLanguage(e.target.value as any)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="ar">العربية (Arabic)</option>
                            <option value="en">English</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  {selectedGame === "higher-lower" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Higher or Lower Settings</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Max Players</span>
                          <select
                            value={hlMaxPlayers}
                            onChange={(e) => setHlMaxPlayers(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  {selectedGame === "snake" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Snake Battle Settings</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Match Duration</span>
                          <select
                            value={snakeDuration}
                            onChange={(e) => setSnakeDuration(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="15">15s</option>
                            <option value="30">30s</option>
                            <option value="60">60s</option>
                            <option value="120">120s</option>
                            <option value="180">180s</option>
                            <option value="300">300s</option>
                          </select>
                        </label>
                        <p className="text-purple-300/50 text-[10px] leading-snug col-span-2">
                          Up to 4 players. Highest score when time runs out wins. Make a friend
                          crash into your body to eliminate them!
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedGame === "tictactoe" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Tic-Tac-Toe Settings</h3>
                      <p className="text-purple-300/50 text-[10px] leading-snug">
                        Two players take turns placing X and O. First to a line of three wins the
                        round; best overall score wins.
                      </p>
                    </div>
                  )}

                  {selectedGame === "space-invaders" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Space Invaders Settings</h3>
                      <p className="text-purple-300/50 text-[10px] leading-snug">
                        Co-op survival. Everyone gets a ship — work together to clear waves of
                        aliens. Don't let them reach the bottom! Catch power-ups to boost speed
                        and firepower.
                      </p>
                    </div>
                  )}

                  {selectedGame === "fighter" && (
                    <div className="space-y-3">
                      <h3 className="font-black text-purple-400 border-b border-purple-950/20 pb-1.5">Fighter Settings</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1 block">
                          <span className="text-purple-300/70 block">Wins to Win Match</span>
                          <select
                            value={fighterWins}
                            onChange={(e) => setFighterWins(e.target.value)}
                            className="w-full bg-[#271533] border border-purple-900/40 rounded px-2 py-1.5 text-white focus:outline-none"
                          >
                            <option value="1">1</option>
                            <option value="3">3</option>
                            <option value="5">5</option>
                          </select>
                        </label>
                      </div>
                      <p className="text-purple-300/50 text-[10px] leading-snug">
                        One-on-one duel. Drop the opponent's health to zero to win a round. First to
                        the target wins the match. Need 2 players (or add a bot).
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleStartGame}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-900/20 active:scale-95 transition-all"
                >
                  <Play className="w-4 h-4" />
                  Launch Sub-Game
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#1b0d24]/60 rounded-xl border border-purple-950/30">
                <Sparkles className="w-8 h-8 text-purple-400 mb-3 animate-pulse" />
                <p className="text-purple-200/90 text-sm font-semibold mb-1">
                  Waiting for Host to Start
                </p>
                <p className="text-purple-300/40 text-xs">
                  Your host is selecting a game. Hang tight, and make sure your mic is set!
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Chat Box */}
          <div className="md:col-span-3 bg-[#180b20]/70 border border-purple-950/40 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-purple-950/30 pb-3">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider text-purple-300">
                Lobby Chat
              </h2>
            </div>

            <div className="flex-1 flex flex-col gap-3 min-h-[250px] md:min-h-0">
              <div className="flex-1 bg-[#150a1c]/90 border border-purple-950/35 rounded-xl p-3 overflow-y-auto space-y-3 h-[250px] md:h-[300px]">
                {chatMessages.length === 0 ? (
                  <p className="text-purple-300/20 text-xs text-center italic mt-4">
                    Send a message to start chatting!
                  </p>
                ) : (
                  chatMessages.map((msg, i) => {
                    const sender = lobbyState.players.find((p) => p.id === msg.playerId);
                    return (
                      <div key={i} className="text-xs">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`font-black ${msg.playerId === myPlayerId ? "text-purple-400" : "text-purple-200"}`}>
                            {msg.playerName}
                          </span>
                          <span className="text-[8px] text-purple-300/30">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-purple-100/90 leading-normal mt-0.5 bg-[#21112b]/40 rounded-lg p-2 border border-purple-950/10">
                          {msg.message}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Say something..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={100}
                  className="flex-1 bg-[#251032] border border-purple-900/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl p-2.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
