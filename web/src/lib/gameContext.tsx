import createContextHook from "../utils/createContextHook";
import { useState, useCallback, useEffect, useRef } from "react";
import { getSocket, connectSocket, disconnectSocket } from "./socket";
import type {
  GameState,
  Card,
  CardDeclaration,
  GameVariant,
  ClaimType,
  GameTheme,
  ChallengeMode,
  BotDifficulty,
  ChatMessage,
  ToastNotification,
  PlayerData,
  CodenamesState,
  CodenamesTeam,
  CodenamesRole,
  CodenamesLang,
  HigherLowerState,
  LobbyState,
} from "./types";

interface GameActions {
  createRoom: (
    playerName: string,
    maxPlayers: number,
    variant: GameVariant,
    deckCount: number,
    claimType?: ClaimType,
    revealTime?: number,
    theme?: GameTheme,
    challengeMode?: ChallengeMode,
    challengeDuration?: number,
    gameId?: string,
    language?: CodenamesLang,
  ) => Promise<{ roomId: string; playerId: string }>;
  joinRoom: (
    roomId: string,
    playerName: string,
  ) => Promise<{ playerId: string }>;
  reconnectRoom: (
    roomId: string,
    playerId: string,
  ) => Promise<void>;
  startGame: () => Promise<void>;
  addBot: (botName?: string, difficulty?: BotDifficulty) => Promise<void>;
  removeBot: (botId: string) => Promise<void>;
    playCards: (
    cardIndices: number[],
    declaration: CardDeclaration,
  ) => Promise<void>;
  callLiar: () => Promise<void>;
  passTurn: () => Promise<void>;
  voteSkip: () => Promise<{ votesNow?: number; votesNeeded?: number }>;
  sendChat: (message: string) => void;
  sendWebRTCSignal: (targetId: string, signal: unknown) => void;
  addToast: (
    message: string,
    type?: ToastNotification["type"],
  ) => void;
  clearToasts: () => void;
  resetGame: () => void;
  codenamesJoinTeam: (team: CodenamesTeam, role: CodenamesRole) => Promise<void>;
  codenamesGiveClue: (word: string, count: number) => Promise<void>;
  codenamesGuess: (cardIndex: number) => Promise<void>;
  codenamesEndTurn: () => Promise<void>;
  codenamesRematch: () => Promise<void>;
  higherLowerGuess: (guess: number) => Promise<void>;
  higherLowerRematch: () => Promise<void>;
  lobbyStartGame: (gameId: string, options: any) => Promise<void>;
  lobbyReturnToLobby: () => Promise<void>;
}

interface GameContextValue extends GameActions {
  // State
  lobbyState: LobbyState | null;
  gameState: GameState | null;
  codenamesState: CodenamesState | null;
  higherLowerState: HigherLowerState | null;
  myHand: Card[];
  isConnected: boolean;
  myPlayerId: string | null;
  myRoomId: string | null;
  chatMessages: ChatMessage[];
  toasts: ToastNotification[];
  error: string | null;
}

// Local storage keys
const LS_ROOM_ID = "liarsbar_roomId";
const LS_PLAYER_ID = "liarsbar_playerId";

export const [GameProvider, useGame] = createContextHook(() => {
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [codenamesState, setCodenamesState] = useState<CodenamesState | null>(null);
  const [higherLowerState, setHigherLowerState] = useState<HigherLowerState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myRoomId, setMyRoomId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;

  const addToast = useCallback(
    (message: string, type: ToastNotification["type"] = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [
        ...prev,
        { id, message, type, timestamp: Date.now() },
      ]);
      // Auto-remove after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const clearToasts = useCallback(() => setToasts([]), []);

  const resetGame = useCallback(() => {
    setLobbyState(null);
    setGameState(null);
    setCodenamesState(null);
    setHigherLowerState(null);
    setMyHand([]);
    setChatMessages([]);
    setToasts([]);
    setError(null);
  }, []);

  // Socket setup
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onGameState = (state: GameState | CodenamesState | HigherLowerState | LobbyState) => {
      if ((state as LobbyState).gameId === "lobby") {
        const next = state as LobbyState;
        setLobbyState(next);
        if (next.activeGameId === "liars-bar") {
          setGameState(next.subGameState);
          setCodenamesState(null);
          setHigherLowerState(null);
        } else if (next.activeGameId === "codenames") {
          setCodenamesState((prev) => {
            const nextSub = next.subGameState as CodenamesState;
            return nextSub ? { ...nextSub, you: prev?.you, key: prev?.key } : null;
          });
          setGameState(null);
          setHigherLowerState(null);
        } else if (next.activeGameId === "higher-lower") {
          setHigherLowerState((prev) => {
            const nextSub = next.subGameState as HigherLowerState;
            return nextSub ? { ...nextSub, mySecretNumber: prev?.mySecretNumber } : null;
          });
          setGameState(null);
          setCodenamesState(null);
        } else {
          setGameState(null);
          setCodenamesState(null);
          setHigherLowerState(null);
        }
      } else if ((state as CodenamesState).gameId === "codenames") {
        const next = state as CodenamesState;
        setCodenamesState((prev) => ({ ...next, you: prev?.you, key: prev?.key }));
      } else if ((state as HigherLowerState).gameId === "higher-lower") {
        const next = state as HigherLowerState;
        setHigherLowerState((prev) => ({ ...next, mySecretNumber: prev?.mySecretNumber }));
      } else {
        setGameState(state as GameState);
      }
    };

    const onYourHand = (data: { hand: Card[] }) => {
      setMyHand(data.hand);
    };

    const onCodenamesPrivate = (state: CodenamesState) => {
      setCodenamesState(state);
    };

    const onHigherLowerPrivate = (state: HigherLowerState) => {
      setHigherLowerState(state);
    };

    const onChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-99), msg]);
    };

    const onWebRTCSignal = (data: {
      fromId: string;
      signal: unknown;
    }) => {
      // Handled by VoiceControls component via custom event
      window.dispatchEvent(
        new CustomEvent("webrtc_signal", {
          detail: data,
        }),
      );
    };

    const onError = (data: { error: string }) => {
      setError(data.error);
      addToast(data.error, "error");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("game_state", onGameState);
    socket.on("your_hand", onYourHand);
    socket.on("codenames_private", onCodenamesPrivate);
    socket.on("higher_lower_private", onHigherLowerPrivate);
    socket.on("chat_message", onChatMessage);
    socket.on("webrtc_signal", onWebRTCSignal);
    socket.on("error", onError);

    // Check for stored room/player
    const storedRoomId = localStorage.getItem(LS_ROOM_ID);
    const storedPlayerId = localStorage.getItem(LS_PLAYER_ID);

    if (storedRoomId && storedPlayerId) {
      setMyRoomId(storedRoomId);
      setMyPlayerId(storedPlayerId);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("game_state", onGameState);
      socket.off("your_hand", onYourHand);
      socket.off("codenames_private", onCodenamesPrivate);
      socket.off("higher_lower_private", onHigherLowerPrivate);
      socket.off("chat_message", onChatMessage);
      socket.off("webrtc_signal", onWebRTCSignal);
      socket.off("error", onError);
    };
  }, [addToast]);

  const emitWithAck = useCallback(
    <T,>(event: string, data: unknown): Promise<T> => {
      return new Promise((resolve, reject) => {
        const socket = connectSocket();
        socket.emit(event, data, (response: T & { error?: string }) => {
          if (response && typeof response === "object" && "error" in response) {
            reject(new Error(response.error as string));
          } else {
            resolve(response as T);
          }
        });
      });
    },
    [],
  );

  const applyRoomState = useCallback((state: GameState | CodenamesState | HigherLowerState | LobbyState) => {
    if ((state as LobbyState).gameId === "lobby") {
      const next = state as LobbyState;
      setLobbyState(next);
      if (next.activeGameId === "liars-bar") {
        setGameState(next.subGameState);
        setCodenamesState(null);
        setHigherLowerState(null);
      } else if (next.activeGameId === "codenames") {
        setCodenamesState(next.subGameState);
        setGameState(null);
        setHigherLowerState(null);
      } else if (next.activeGameId === "higher-lower") {
        setHigherLowerState(next.subGameState);
        setGameState(null);
        setCodenamesState(null);
      } else {
        setGameState(null);
        setCodenamesState(null);
        setHigherLowerState(null);
      }
    } else if ((state as CodenamesState).gameId === "codenames") {
      setCodenamesState(state as CodenamesState);
    } else if ((state as HigherLowerState).gameId === "higher-lower") {
      setHigherLowerState(state as HigherLowerState);
    } else {
      setGameState(state as GameState);
    }
  }, []);

    const createRoom = useCallback(
    async (
      playerName: string,
      maxPlayers: number,
      variant: GameVariant,
      deckCount: number,
      claimType?: ClaimType,
      revealTime?: number,
      theme?: GameTheme,
      challengeMode?: ChallengeMode,
      challengeDuration?: number,
      gameId?: string,
      language?: CodenamesLang,
    ): Promise<{ roomId: string; playerId: string }> => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        roomId: string;
        playerId: string;
        state: GameState | CodenamesState;
      }>("create_room", { playerName, maxPlayers, variant, deckCount, claimType, revealTime, theme, challengeMode, challengeDuration, gameId, language });

      setMyRoomId(res.roomId);
      setMyPlayerId(res.playerId);
      applyRoomState(res.state);
      localStorage.setItem(LS_ROOM_ID, res.roomId);
      localStorage.setItem(LS_PLAYER_ID, res.playerId);
      return { roomId: res.roomId, playerId: res.playerId };
    },
    [emitWithAck, applyRoomState],
  );

  const joinRoom = useCallback(
    async (
      roomId: string,
      playerName: string,
    ): Promise<{ playerId: string }> => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        playerId: string;
        state: GameState | CodenamesState;
      }>("join_room", { roomId: roomId.toUpperCase(), playerName });

      setMyRoomId(roomId.toUpperCase());
      setMyPlayerId(res.playerId);
      applyRoomState(res.state);
      localStorage.setItem(LS_ROOM_ID, roomId.toUpperCase());
      localStorage.setItem(LS_PLAYER_ID, res.playerId);
      return { playerId: res.playerId };
    },
    [emitWithAck, applyRoomState],
  );

  const reconnectRoom = useCallback(
    async (roomId: string, playerId: string) => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        state: GameState | CodenamesState;
      }>("reconnect_room", { roomId, playerId });
      applyRoomState(res.state);
    },
    [emitWithAck, applyRoomState],
  );

  const startGame = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("start_game", { roomId: myRoomId });
  }, [myRoomId, emitWithAck]);

  const addBot = useCallback(
    async (botName?: string, difficulty?: BotDifficulty) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("add_bot", { roomId: myRoomId, botName, difficulty });
    },
    [myRoomId, emitWithAck],
  );

  const removeBot = useCallback(
    async (botId: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("remove_bot", { roomId: myRoomId, botId });
    },
    [myRoomId, emitWithAck],
  );

  const playCards = useCallback(
    async (cardIndices: number[], declaration: CardDeclaration) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("play_cards", {
        roomId: myRoomId,
        cardIndices,
        declaration,
      });
    },
    [myRoomId, emitWithAck],
  );

  const callLiar = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("call_liar", { roomId: myRoomId });
  }, [myRoomId, emitWithAck]);

    const passTurn = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("pass_turn", { roomId: myRoomId });
  }, [myRoomId, emitWithAck]);

  const voteSkip = useCallback(async (): Promise<{ votesNow?: number; votesNeeded?: number }> => {
    if (!myRoomId) throw new Error("Not in a room");
    const res = await emitWithAck<{
      success: boolean;
      votesNow?: number;
      votesNeeded?: number;
    }>("vote_skip", { roomId: myRoomId });
    return { votesNow: res.votesNow, votesNeeded: res.votesNeeded };
  }, [myRoomId, emitWithAck]);

  const sendChat = useCallback(
    (message: string) => {
      if (!myRoomId) return;
      const socket = getSocket();
      socket.emit("send_chat", { roomId: myRoomId, message });
    },
    [myRoomId],
  );

  const codenamesJoinTeam = useCallback(
    async (team: CodenamesTeam, role: CodenamesRole) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("codenames_join_team", { team, role });
    },
    [myRoomId, emitWithAck],
  );

  const codenamesGiveClue = useCallback(
    async (word: string, count: number) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("codenames_give_clue", { word, count });
    },
    [myRoomId, emitWithAck],
  );

  const codenamesGuess = useCallback(
    async (cardIndex: number) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("codenames_guess", { cardIndex });
    },
    [myRoomId, emitWithAck],
  );

  const codenamesEndTurn = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("codenames_end_turn", {});
  }, [myRoomId, emitWithAck]);

  const codenamesRematch = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("codenames_rematch", {});
  }, [myRoomId, emitWithAck]);

  const higherLowerGuess = useCallback(async (guess: number) => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("higher_lower_guess", { guess });
  }, [myRoomId, emitWithAck]);

  const higherLowerRematch = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("higher_lower_rematch", {});
  }, [myRoomId, emitWithAck]);

  const lobbyStartGame = useCallback(
    async (gameId: string, options: any) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("lobby_start_game", { gameId, options });
    },
    [myRoomId, emitWithAck],
  );

  const lobbyReturnToLobby = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("lobby_return_to_lobby", {});
  }, [myRoomId, emitWithAck]);

  const sendWebRTCSignal = useCallback(
    (targetId: string, signal: unknown) => {
      if (!myRoomId) return;
      const socket = getSocket();
      socket.emit("webrtc_signal", {
        roomId: myRoomId,
        targetId,
        signal,
      });
    },
    [myRoomId],
  );

  // Watch for game events to show toasts
  useEffect(() => {
    if (!gameState?.actionLog.length) return;
    const lastAction = gameState.actionLog[gameState.actionLog.length - 1];
    if (!lastAction) return;

    // Don't re-toast for the same action
    const toastKey = `${lastAction.type}_${lastAction.timestamp}`;

    switch (lastAction.type) {
      case "call_liar":
        addToast(`${lastAction.playerName} called Liar!`, "challenge");
        break;
      case "challenge_result": {
        const data = lastAction.data as {
          isTruth: boolean;
          challengedName: string;
        } | null;
        if (data) {
          if (data.isTruth) {
            addToast(
              `${lastAction.playerName} checked cards for ${data.challengedName} — Truth! ${data.challengedName} was honest. ${lastAction.playerName} takes the pile!`,
              "success",
            );
          } else {
            addToast(
              `${lastAction.playerName} checked cards for ${data.challengedName} — Liar! ${data.challengedName} was bluffing and takes the pile!`,
              "error",
            );
          }
        }
        break;
      }
      case "player_won":
        addToast(`${lastAction.playerName} wins!`, "success");
        break;
    }
  }, [gameState?.actionLog]);

  return {
    lobbyState,
    gameState,
    codenamesState,
    higherLowerState,
    myHand,
    isConnected,
    myPlayerId,
    myRoomId,
    chatMessages,
    toasts,
    error,
    createRoom,
    joinRoom,
    reconnectRoom,
    startGame,
    addBot,
    removeBot,
    playCards,
    callLiar,
    passTurn,
    voteSkip,
    sendChat,
    sendWebRTCSignal,
    addToast,
    clearToasts,
    resetGame,
    codenamesJoinTeam,
    codenamesGiveClue,
    codenamesGuess,
    codenamesEndTurn,
    codenamesRematch,
    higherLowerGuess,
    higherLowerRematch,
    lobbyStartGame,
    lobbyReturnToLobby,
  };
});
