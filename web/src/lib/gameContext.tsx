import createContextHook from "../utils/createContextHook";
import { useState, useCallback, useEffect, useRef } from "react";
import { getSocket, connectSocket, disconnectSocket } from "./socket";
import { BRAND } from "./brand";
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
  PartyState,
  GameSpecPublic,
  DominoState,
  Dominoe,
  RentoState,
} from "./types";
import type { SpyfallState } from "./spyfallTypes";
import type { ChameleonState } from "./chameleonTypes";
import type { WyrState, WyrChoice } from "./wyrTypes";

/**
 * Everything the client can ask the server to do about a room.
 *
 * `createRoom` takes an options object. It used to take 23 positional
 * parameters, which meant every call site was a column of `undefined`s
 * counted by hand — and the domino setup page had a "karak" toggle wired to
 * nothing at all, because there was no 24th slot to put it in and nobody
 * noticed the value being dropped. An options object makes adding a game
 * setting a one-line change that cannot silently go nowhere.
 */
export interface CreateRoomInput {
  playerName: string;
  /** Server gameId. Omit for a hub-only party with no game chosen yet. */
  gameId?: string;
  maxPlayers: number;
  flag?: string;

  // Liar's Bar
  variant?: GameVariant;
  deckCount?: number;
  claimType?: ClaimType;
  revealTime?: number;
  theme?: GameTheme;
  challengeMode?: ChallengeMode;
  challengeDuration?: number;

  // Codenames
  language?: CodenamesLang;

  // Domino
  gameMode?: "individual" | "teams";
  targetScore?: number;
  turnTimeLimit?: number;
  tableTheme?: string;
  tileTheme?: string;
  karakBonus?: boolean;

  // Rento
  startingBalance?: number;
  jailEnabled?: boolean;
  freeParkingBonus?: number;
  turnTimer?: number;
  aiDifficulty?: "easy" | "medium" | "hard";
  mapId?: string;
  backgroundId?: string;

  // Memory puzzle
  difficulty?: "easy" | "medium" | "hard";

  // Spyfall
  roundSeconds?: number;
}

interface GameActions {
  createRoom: (input: CreateRoomInput) => Promise<{ roomId: string; playerId: string }>;
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
  setPlayerIcon: (icon: string) => Promise<void>;
  setPlayerCharacter: (characterId: string) => Promise<void>;
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
  leaveRoom: () => void;
  codenamesJoinTeam: (team: CodenamesTeam, role: CodenamesRole) => Promise<void>;
  codenamesGiveClue: (word: string, count: number) => Promise<void>;
  codenamesGuess: (cardIndex: number) => Promise<void>;
  codenamesEndTurn: () => Promise<void>;
  codenamesRematch: () => Promise<void>;
  higherLowerGuess: (guess: number) => Promise<void>;
  higherLowerRematch: () => Promise<void>;
  lobbyStartGame: (gameId: string, options: any) => Promise<void>;
  lobbyReturnToLobby: () => Promise<void>;
  dominoPlayTile: (tile: { left: number; right: number }, end: "left" | "right") => Promise<void>;
  dominoDrawTile: () => Promise<void>;
  dominoPass: () => Promise<void>;
  /** Declare you can't play. Public: proves you hold neither open pip. */
  dominoKnock: () => Promise<void>;
  dominoRematch: () => Promise<void>;
  /** Switch the whole party into a different game. Keeps the room + voice. */
  partyPickGame: (gameId: string, options?: Record<string, unknown>) => Promise<void>;
  /** Same game, same settings, same people, fresh deal. */
  partyRematch: () => Promise<void>;
  /** Abandon the current game, back to the picker. */
  partyReturnHub: () => Promise<void>;
  /** Free the seat for good (as opposed to disconnecting). */
  partyLeave: () => Promise<void>;
  /** Which games exist and how many players each needs. */
  loadGameCatalog: () => Promise<GameSpecPublic[]>;
  spyfallAccuse: (targetId: string) => Promise<void>;
  spyfallVote: (agree: boolean) => Promise<void>;
  spyfallGuess: (locationId: string) => Promise<void>;
  spyfallPass: (toPlayerId: string) => Promise<void>;
  chameleonClue: (clue: string) => Promise<void>;
  chameleonVote: (targetId: string) => Promise<void>;
  chameleonGuess: (index: number) => Promise<void>;
  wyrChoose: (choice: WyrChoice) => Promise<void>;
  wyrPredict: (choice: WyrChoice) => Promise<void>;
}

interface GameContextValue extends GameActions {
  // State
  partyState: PartyState | null;
  gameCatalog: GameSpecPublic[];
  lobbyState: LobbyState | null;
  gameState: GameState | null;
  codenamesState: CodenamesState | null;
  higherLowerState: HigherLowerState | null;
  dominoState: DominoState | null;
  rentoState: RentoState | null;
  spyfallState: SpyfallState | null;
  chameleonState: ChameleonState | null;
  wyrState: WyrState | null;
  myHand: Card[];
  isConnected: boolean;
  myPlayerId: string | null;
  myRoomId: string | null;
  chatMessages: ChatMessage[];
  toasts: ToastNotification[];
  error: string | null;
  /** Non-null when a newer window took over this player's session. */
  supersededRoomId: string | null;
}

/** Anything the server can send on `game_state` or a command ack. */
export type AnyRoomState =
  | PartyState
  | LobbyState
  | GameState
  | CodenamesState
  | HigherLowerState
  | DominoState
  | RentoState
  | SpyfallState
  | ChameleonState
  | WyrState;

// Local storage keys. Prefixed by brand id so a rename doesn't silently
// resurrect a stale room from a previous build.
const LS_ROOM_ID = `${BRAND.id}_roomId`;
const LS_PLAYER_ID = `${BRAND.id}_playerId`;
/** Older builds used these; read once so a returning player isn't logged out. */
const LEGACY_LS_ROOM_ID = "liarsbar_roomId";
const LEGACY_LS_PLAYER_ID = "liarsbar_playerId";

function readStored(key: string, legacyKey: string): string | null {
  try {
    return localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
  } catch {
    return null;
  }
}

export const [GameProvider, useGame] = createContextHook(() => {
  const [partyState, setPartyState] = useState<PartyState | null>(null);
  const [gameCatalog, setGameCatalog] = useState<GameSpecPublic[]>([]);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [codenamesState, setCodenamesState] = useState<CodenamesState | null>(null);
  const [higherLowerState, setHigherLowerState] = useState<HigherLowerState | null>(null);
  const [dominoState, setDominoState] = useState<DominoState | null>(null);
  const [rentoState, setRentoState] = useState<RentoState | null>(null);
  const [spyfallState, setSpyfallState] = useState<SpyfallState | null>(null);
  const [chameleonState, setChameleonState] = useState<ChameleonState | null>(null);
  const [wyrState, setWyrState] = useState<WyrState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myRoomId, setMyRoomId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * This window's session was taken over by a newer one — the same player
   * opened the room again in another tab, or re-tapped the invite link.
   *
   * Surfaced rather than ignored because the alternative is a tab that keeps
   * receiving broadcasts while showing its own player as offline, which looks
   * like a bug in the game and is impossible for a player to diagnose.
   */
  const [supersededRoomId, setSupersededRoomId] = useState<string | null>(null);

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
    // Force a real disconnect so the server immediately unbinds this socket's
    // room session — otherwise the same connection is still "in a room" server-side
    // and the next create_room/join_room fails with "Already in a room".
    disconnectSocket();
    setPartyState(null);
    setLobbyState(null);
    setGameState(null);
    setCodenamesState(null);
    setHigherLowerState(null);
    setDominoState(null);
    setRentoState(null);
    setSpyfallState(null);
    setChameleonState(null);
    setWyrState(null);
    setMyHand([]);
    setChatMessages([]);
    setToasts([]);
    setError(null);
    setMyRoomId(null);
    setMyPlayerId(null);
    setSupersededRoomId(null);
  }, []);

  // Single entry point for "leave the room and go home" — every leave button
  // across the app should call this instead of duplicating the reset + cleanup.
  const leaveRoom = useCallback(() => {
    resetGame();
    try {
      localStorage.removeItem(LS_ROOM_ID);
      localStorage.removeItem(LS_PLAYER_ID);
      localStorage.removeItem(LEGACY_LS_ROOM_ID);
      localStorage.removeItem(LEGACY_LS_PLAYER_ID);
    } catch {
      /* ignore */
    }
  }, [resetGame]);

  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  // Socket setup
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onGameState = (state: AnyRoomState) => {
      applyRoomStateRef.current(state);
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

    const onDominoPrivate = (state: DominoState) => {
      setDominoState(state);
    };

    const onSpyfallPrivate = (state: SpyfallState) => {
      setSpyfallState(state);
    };

    const onChameleonPrivate = (state: ChameleonState) => {
      setChameleonState(state);
    };

    const onWyrPrivate = (state: WyrState) => {
      setWyrState(state);
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

    const onSuperseded = (data: { roomId: string }) => {
      setSupersededRoomId(data?.roomId ?? null);
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
    socket.on("domino_private", onDominoPrivate);
    socket.on("spyfall_private", onSpyfallPrivate);
    socket.on("chameleon_private", onChameleonPrivate);
    socket.on("wyr_private", onWyrPrivate);
    socket.on("chat_message", onChatMessage);
    socket.on("webrtc_signal", onWebRTCSignal);
    socket.on("session_superseded", onSuperseded);
    socket.on("error", onError);

    // Check for stored room/player
    const storedRoomId = readStored(LS_ROOM_ID, LEGACY_LS_ROOM_ID);
    const storedPlayerId = readStored(LS_PLAYER_ID, LEGACY_LS_PLAYER_ID);

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
      socket.off("domino_private", onDominoPrivate);
      socket.off("spyfall_private", onSpyfallPrivate);
      socket.off("chameleon_private", onChameleonPrivate);
      socket.off("wyr_private", onWyrPrivate);
      socket.off("chat_message", onChatMessage);
      socket.off("webrtc_signal", onWebRTCSignal);
      socket.off("session_superseded", onSuperseded);
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

  /**
   * Which state slot each game writes into, and which fields of that slot are
   * private (delivered over a `*_private` event, absent from the public
   * broadcast) and must therefore survive a public update.
   *
   * Adding a game with hidden information means adding one line here. Before
   * this table the same knowledge was spelled out four times across two
   * functions, which is how the Codenames key got lost on reconnect.
   */
  const routeSubState = useCallback(
    (gameId: string | null, sub: unknown) => {
      const clearOthers = (keep: string | null) => {
        if (keep !== "liars-bar") setGameState(null);
        if (keep !== "codenames") setCodenamesState(null);
        if (keep !== "higher-lower") setHigherLowerState(null);
        if (keep !== "domino") setDominoState(null);
        if (keep !== "rento") setRentoState(null);
        if (keep !== "spyfall") setSpyfallState(null);
        if (keep !== "chameleon") setChameleonState(null);
        if (keep !== "wyr") setWyrState(null);
      };

      if (!gameId || !sub) {
        clearOthers(null);
        return;
      }

      switch (gameId) {
        case "liars-bar":
          setGameState(sub as GameState);
          break;
        case "codenames":
          // `you` (your team/role) and `key` (the spymaster grid) only ever
          // arrive on codenames_private — never clobber them with a public update.
          setCodenamesState((prev) => ({
            ...(sub as CodenamesState),
            you: (sub as CodenamesState).you ?? prev?.you,
            key: (sub as CodenamesState).key ?? prev?.key,
          }));
          break;
        case "higher-lower":
          setHigherLowerState((prev) => ({
            ...(sub as HigherLowerState),
            mySecretNumber:
              (sub as HigherLowerState).mySecretNumber ?? prev?.mySecretNumber,
          }));
          break;
        case "domino": {
          // The public broadcast carries no private slice by design. Every
          // one of these fields arrives only on domino_private, so a naive
          // replace wipes them and the hand renders with nothing playable —
          // which looked exactly like "the game thinks I'm stuck".
          const next = sub as DominoState;
          setDominoState((prev) => ({
            ...next,
            hand: next.hand ?? prev?.hand,
            mySeat: next.mySeat ?? prev?.mySeat ?? null,
            myPartnerSeat: next.myPartnerSeat ?? prev?.myPartnerSeat ?? null,
            playable: next.playable ?? prev?.playable,
          }));
          break;
        }
        case "rento":
          setRentoState(sub as RentoState);
          break;
        case "spyfall": {
          // isSpy / locationName / role arrive only on spyfall_private. A
          // naive replace from the public broadcast would blank the player's
          // own secret every time anyone did anything.
          const next = sub as SpyfallState;
          setSpyfallState((prev) => ({
            ...next,
            isSpy: next.isSpy ?? prev?.isSpy,
            locationId: next.locationId ?? prev?.locationId,
            locationName: next.locationName ?? prev?.locationName,
            role: next.role ?? prev?.role,
          }));
          break;
        }
        case "chameleon": {
          // isChameleon / secretIndex arrive only on chameleon_private.
          const next = sub as ChameleonState;
          setChameleonState((prev) => ({
            ...next,
            isChameleon: next.isChameleon ?? prev?.isChameleon,
            secretIndex: next.secretIndex ?? prev?.secretIndex ?? null,
          }));
          break;
        }
        case "wyr": {
          // isSubject / myAnswer / myPrediction arrive only on wyr_private.
          const next = sub as WyrState;
          setWyrState((prev) => ({
            ...next,
            isSubject: next.isSubject ?? prev?.isSubject,
            myAnswer: next.myAnswer ?? prev?.myAnswer ?? null,
            myPrediction: next.myPrediction ?? prev?.myPrediction ?? null,
          }));
          break;
        }
        default:
          // Arcade-style games (tetris, snake, fighter, ...) render straight
          // from the party envelope and keep no dedicated slot.
          break;
      }
      clearOthers(gameId);
    },
    [],
  );

  /**
   * Route one inbound room state into the right slot.
   *
   * Rooms come in two shapes: a *container* (a party, or the legacy lobby)
   * whose real game hangs off `subGameState`, and a bare game engine's own
   * state. Previously this logic existed twice — once in the socket listener
   * and once for command acks — as two parallel if-chains that had already
   * drifted apart (the ack path dropped the private-state merge, so a
   * Codenames spymaster who reconnected lost their key). One router, used by
   * both paths, is the fix.
   *
   * The merge callbacks matter: `game_state` is the PUBLIC broadcast and by
   * design contains no hidden information, so naively replacing state with it
   * would wipe the private slice delivered separately over `*_private`. Each
   * game names the private fields to carry forward.
   */
  const applyRoomState = useCallback((state: AnyRoomState) => {
    if (!state) return;

    const container = state as PartyState | LobbyState;
    if (container.gameId === "party" || container.gameId === "lobby") {
      if (container.gameId === "party") setPartyState(state as PartyState);
      else setLobbyState(state as LobbyState);

      routeSubState(container.activeGameId, container.subGameState);
      return;
    }

    // A bare engine state (a standalone room, or a direct `*_private` push).
    routeSubState((state as { gameId?: string }).gameId ?? null, state);
  }, []);

  // Callbacks are stable, but the socket listener is registered once on mount
  // and must always call the current router.
  const applyRoomStateRef = useRef(applyRoomState);
  applyRoomStateRef.current = applyRoomState;

  const createRoom = useCallback(
    async (input: CreateRoomInput): Promise<{ roomId: string; playerId: string }> => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        roomId: string;
        playerId: string;
        state: AnyRoomState;
      }>("create_room", {
        // Sensible shapes for the fields every game's validator reads, so a
        // caller only has to name what its own game actually cares about.
        variant: "cards",
        deckCount: 1,
        ...input,
      });

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
      flag?: string,
    ): Promise<{ playerId: string }> => {
      connectSocket();
      const res = await emitWithAck<{
        success: boolean;
        playerId: string;
        state: GameState | CodenamesState;
      }>("join_room", { roomId: roomId.toUpperCase(), playerName, flag });

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

  const setPlayerIcon = useCallback(
    async (icon: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("set_player_icon", { roomId: myRoomId, icon });
    },
    [myRoomId, emitWithAck],
  );

  const setPlayerCharacter = useCallback(
    async (characterId: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("set_player_character", { roomId: myRoomId, characterId });
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

  const dominoPlayTile = useCallback(
    async (tile: { left: number; right: number }, end: "left" | "right") => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("domino_play_tile", { tile, end });
    },
    [myRoomId, emitWithAck],
  );

  const dominoDrawTile = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("domino_draw_tile", {});
  }, [myRoomId, emitWithAck]);

  const dominoPass = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("domino_pass", {});
  }, [myRoomId, emitWithAck]);

  /**
   * Knock: "I can't play."
   *
   * Named for the physical act rather than "pass", because it isn't a silent
   * skip — everyone at a real table hears it, and it proves the knocker holds
   * neither open pip. The server validates it and publishes what it proved.
   */
  const dominoKnock = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("domino_knock", {});
  }, [myRoomId, emitWithAck]);

  const dominoRematch = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("domino_rematch", {});
  }, [myRoomId, emitWithAck]);

  // ===== Party =====
  //
  // The point of these: the room code, the roster, the chat and the WebRTC
  // voice mesh all survive a game change, so a group never has to re-share a
  // link on WhatsApp just because they finished a game.

  const partyPickGame = useCallback(
    async (gameId: string, options: Record<string, unknown> = {}) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("party_pick_game", { gameId, options });
    },
    [myRoomId, emitWithAck],
  );

  const partyRematch = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("party_rematch", {});
  }, [myRoomId, emitWithAck]);

  const partyReturnHub = useCallback(async () => {
    if (!myRoomId) throw new Error("Not in a room");
    await emitWithAck("party_return_hub", {});
  }, [myRoomId, emitWithAck]);

  /**
   * Leave for good. Distinct from a disconnect: this frees the seat, so the
   * party isn't stuck showing "5/5" with a ghost in one chair.
   */
  const partyLeave = useCallback(async () => {
    try {
      if (myRoomId) await emitWithAck("party_leave", {});
    } catch {
      /* Server already forgot us, or we're offline. Leave locally anyway. */
    }
    leaveRoomRef.current();
  }, [myRoomId, emitWithAck]);

  const loadGameCatalog = useCallback(async (): Promise<GameSpecPublic[]> => {
    const res = await emitWithAck<{ success: boolean; games: GameSpecPublic[] }>(
      "party_catalog",
      {},
    );
    setGameCatalog(res.games ?? []);
    return res.games ?? [];
  }, [emitWithAck]);

  // ===== Spyfall =====
  // The game itself is spoken; these are only the moves the server arbitrates.

  const spyfallAccuse = useCallback(
    async (targetId: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("spyfall_accuse", { targetId });
    },
    [myRoomId, emitWithAck],
  );

  const spyfallVote = useCallback(
    async (agree: boolean) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("spyfall_vote", { agree });
    },
    [myRoomId, emitWithAck],
  );

  const spyfallGuess = useCallback(
    async (locationId: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("spyfall_guess", { locationId });
    },
    [myRoomId, emitWithAck],
  );

  const spyfallPass = useCallback(
    async (toPlayerId: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("spyfall_pass", { toPlayerId });
    },
    [myRoomId, emitWithAck],
  );

  // ===== Chameleon =====

  const chameleonClue = useCallback(
    async (clue: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("chameleon_clue", { clue });
    },
    [myRoomId, emitWithAck],
  );

  const chameleonVote = useCallback(
    async (targetId: string) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("chameleon_vote", { targetId });
    },
    [myRoomId, emitWithAck],
  );

  const chameleonGuess = useCallback(
    async (index: number) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("chameleon_guess", { index });
    },
    [myRoomId, emitWithAck],
  );

  // ===== Would You Rather =====

  const wyrChoose = useCallback(
    async (choice: WyrChoice) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("wyr_choose", { choice });
    },
    [myRoomId, emitWithAck],
  );

  const wyrPredict = useCallback(
    async (choice: WyrChoice) => {
      if (!myRoomId) throw new Error("Not in a room");
      await emitWithAck("wyr_predict", { choice });
    },
    [myRoomId, emitWithAck],
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
    partyState,
    gameCatalog,
    lobbyState,
    gameState,
    codenamesState,
    higherLowerState,
    dominoState,
    rentoState,
    spyfallState,
    chameleonState,
    wyrState,
    myHand,
    isConnected,
    myPlayerId,
    myRoomId,
    chatMessages,
    toasts,
    error,
    supersededRoomId,
    createRoom,
    joinRoom,
    reconnectRoom,
    startGame,
    addBot,
    removeBot,
    setPlayerIcon,
    setPlayerCharacter,
    playCards,
    callLiar,
    passTurn,
    voteSkip,
    sendChat,
    sendWebRTCSignal,
    addToast,
    clearToasts,
    resetGame,
    leaveRoom,
    codenamesJoinTeam,
    codenamesGiveClue,
    codenamesGuess,
    codenamesEndTurn,
    codenamesRematch,
    higherLowerGuess,
    higherLowerRematch,
    lobbyStartGame,
    lobbyReturnToLobby,
    dominoPlayTile,
    dominoDrawTile,
    dominoPass,
    dominoKnock,
    dominoRematch,
    partyPickGame,
    partyRematch,
    partyReturnHub,
    partyLeave,
    loadGameCatalog,
    spyfallAccuse,
    spyfallVote,
    spyfallGuess,
    spyfallPass,
    chameleonClue,
    chameleonVote,
    chameleonGuess,
    wyrChoose,
    wyrPredict,
  } satisfies GameContextValue;
});
