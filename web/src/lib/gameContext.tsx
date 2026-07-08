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
  BotDifficulty,
  ChatMessage,
  ToastNotification,
  PlayerData,
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
  sendChat: (message: string) => void;
  sendWebRTCSignal: (targetId: string, signal: unknown) => void;
  addToast: (
    message: string,
    type?: ToastNotification["type"],
  ) => void;
  clearToasts: () => void;
  resetGame: () => void;
}

interface GameContextValue extends GameActions {
  // State
  gameState: GameState | null;
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
  const [gameState, setGameState] = useState<GameState | null>(null);
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
    setGameState(null);
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

    const onGameState = (state: GameState) => {
      setGameState(state);
    };

    const onYourHand = (data: { hand: Card[] }) => {
      setMyHand(data.hand);
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

  const createRoom = useCallback(
    async (
      playerName: string,
      maxPlayers: number,
      variant: GameVariant,
      deckCount: number,
      claimType?: ClaimType,
      revealTime?: number,
      theme?: GameTheme,
    ): Promise<{ roomId: string; playerId: string }> => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        roomId: string;
        playerId: string;
        state: GameState;
      }>("create_room", { playerName, maxPlayers, variant, deckCount, claimType, revealTime, theme });

      setMyRoomId(res.roomId);
      setMyPlayerId(res.playerId);
      setGameState(res.state);
      localStorage.setItem(LS_ROOM_ID, res.roomId);
      localStorage.setItem(LS_PLAYER_ID, res.playerId);
      return { roomId: res.roomId, playerId: res.playerId };
    },
    [emitWithAck],
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
        state: GameState;
      }>("join_room", { roomId: roomId.toUpperCase(), playerName });

      setMyRoomId(roomId.toUpperCase());
      setMyPlayerId(res.playerId);
      setGameState(res.state);
      localStorage.setItem(LS_ROOM_ID, roomId.toUpperCase());
      localStorage.setItem(LS_PLAYER_ID, res.playerId);
      return { playerId: res.playerId };
    },
    [emitWithAck],
  );

  const reconnectRoom = useCallback(
    async (roomId: string, playerId: string) => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        state: GameState;
      }>("reconnect_room", { roomId, playerId });
      setGameState(res.state);
    },
    [emitWithAck],
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

  const sendChat = useCallback(
    (message: string) => {
      if (!myRoomId) return;
      const socket = getSocket();
      socket.emit("send_chat", { roomId: myRoomId, message });
    },
    [myRoomId],
  );

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
    gameState,
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
    sendChat,
    sendWebRTCSignal,
    addToast,
    clearToasts,
    resetGame,
  };
});
