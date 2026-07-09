import express from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import cors from "cors";
import { nanoid } from "nanoid";
import { GameManager, type GamePhase, type GameTheme, type ChallengeMode } from "./GameManager.js";
import type { CardDeclaration, GameVariant, ClaimType } from "./Deck.js";
import type { BotDifficulty } from "./BotAI.js";
import type { Player } from "./Player.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",");

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = new Map<string, GameManager>();
const socketToPlayer = new Map<string, { roomId: string; playerId: string }>();

function generateRoomCode(): string {
  return nanoid(6).toUpperCase();
}

function getRoom(roomId: string): GameManager | undefined {
  return rooms.get(roomId);
}

// ============ REST API ============

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", rooms: rooms.size });
});

app.get("/api/room/:roomId", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({
    roomId: room.roomId,
    phase: room.phase,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    variant: room.variant,
    deckCount: room.deckCount,
  });
});

// ============ Socket.IO ============

io.on("connection", (socket: Socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ===== ROOM MANAGEMENT =====

  socket.on(
    "create_room",
    (
      data: {
        playerName: string;
        maxPlayers: number;
        variant: GameVariant;
        deckCount: number;
        claimType?: ClaimType;
        revealTime?: number;
        theme?: GameTheme;
        challengeMode?: ChallengeMode;
        challengeDuration?: number;
      },
      callback,
    ) => {
      try {
        const { playerName, maxPlayers, variant, deckCount, claimType, revealTime, theme, challengeMode, challengeDuration } = data;

        if (!playerName || playerName.trim().length === 0) {
          callback({ error: "Player name is required" });
          return;
        }

        if (maxPlayers < 2 || maxPlayers > 6) {
          callback({ error: "Players must be between 2 and 6" });
          return;
        }

        if (deckCount < 1 || deckCount > 4) {
          callback({ error: "Deck count must be between 1 and 4" });
          return;
        }

        const roomId = generateRoomCode();

        const revealSec = Math.max(3, Math.min(10, revealTime || 5));

        const validChallengeMode: ChallengeMode = (challengeMode === "timer" || challengeMode === "vote") ? challengeMode : "timer";
        const validChallengeDuration = (challengeDuration === 5 || challengeDuration === 10) ? challengeDuration : 5;

        const room = new GameManager(
          roomId,
          variant,
          deckCount,
          maxPlayers,
          variant === "cards" ? (claimType || "suit") : "suit",
          revealSec,
          theme || "standard",
          (state) => {
            io.to(roomId).emit("game_state", state);
          },
          (_roomId, winnerId) => {
            console.log(`Game over in room ${_roomId}, winner: ${winnerId}`);
          },
          (rid) => {
            // After challenge resolution (reveal timer done), send private hands
            const r = getRoom(rid);
            if (!r) return;
            for (const player of r.players) {
              if (!player.isBot && player.socketId) {
                const playerState = r.toPlayerState(player.id);
                io.to(player.socketId).emit("your_hand", {
                  hand: playerState.hand,
                });
              }
            }
          },
          validChallengeMode,
          validChallengeDuration,
        );

        const player = room.addPlayer(playerName.trim(), socket.id, true);
        rooms.set(roomId, room);
        socket.join(roomId);

        socketToPlayer.set(socket.id, { roomId, playerId: player.id });

        console.log(
          `Room ${roomId} created by ${playerName} (maxPlayers: ${maxPlayers}, variant: ${variant}, decks: ${deckCount}, challengeMode: ${validChallengeMode}, challengeDuration: ${validChallengeDuration}s)`,
        );

        callback({
          success: true,
          roomId,
          playerId: player.id,
          state: room.toPlayerState(player.id),
        });
      } catch (err) {
        console.error("Error creating room:", err);
        callback({ error: "Failed to create room" });
      }
    },
  );

  socket.on(
    "join_room",
    (
      data: { roomId: string; playerName: string },
      callback,
    ) => {
      try {
        const { roomId, playerName } = data;

        if (!playerName || playerName.trim().length === 0) {
          callback({ error: "Player name is required" });
          return;
        }

        const room = getRoom(roomId);
        if (!room) {
          callback({ error: "Room not found" });
          return;
        }

        if (room.phase !== "lobby") {
          callback({ error: "Game already in progress" });
          return;
        }

        if (room.players.length >= room.maxPlayers) {
          callback({ error: "Room is full" });
          return;
        }

        if (room.players.some((p) => p.name === playerName.trim())) {
          callback({ error: "Name already taken in this room" });
          return;
        }

        const player = room.addPlayer(playerName.trim(), socket.id);
        socket.join(roomId);

        socketToPlayer.set(socket.id, { roomId, playerId: player.id });

        io.to(roomId).emit("game_state", room.toState());

        console.log(`${playerName} joined room ${roomId}`);

        callback({
          success: true,
          playerId: player.id,
          state: room.toPlayerState(player.id),
        });
      } catch (err) {
        console.error("Error joining room:", err);
        callback({ error: "Failed to join room" });
      }
    },
  );

  socket.on(
    "reconnect_room",
    (
      data: { roomId: string; playerId: string },
      callback,
    ) => {
      try {
        const room = getRoom(data.roomId);
        if (!room) {
          callback({ error: "Room not found" });
          return;
        }

        const player = room.handleReconnect(data.playerId, socket.id);
        if (!player) {
          callback({ error: "Player not found in room" });
          return;
        }

        socket.join(data.roomId);
        socketToPlayer.set(socket.id, {
          roomId: data.roomId,
          playerId: data.playerId,
        });

        console.log(`Player ${player.name} reconnected to room ${data.roomId}`);

        callback({
          success: true,
          state: room.toPlayerState(data.playerId),
        });
      } catch (err) {
        console.error("Error reconnecting:", err);
        callback({ error: "Failed to reconnect" });
      }
    },
  );

  // ===== LOBBY ACTIONS =====

  socket.on(
    "add_bot",
    (data: { roomId: string; botName: string; difficulty?: BotDifficulty }, callback) => {
      const room = getRoom(data.roomId);
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      if (room.phase !== "lobby") {
        callback?.({ error: "Game already started" });
        return;
      }

      if (room.players.length >= room.maxPlayers) {
        callback?.({ error: "Room is full" });
        return;
      }

      const botName = data.botName || `Bot ${room.players.length + 1}`;
      const difficulty = data.difficulty || "medium";
      room.addBot(botName, difficulty);

      const state = room.toState();
      io.to(data.roomId).emit("game_state", state);

      callback?.({ success: true });
    },
  );

  socket.on(
    "remove_bot",
    (data: { roomId: string; botId: string }, callback) => {
      const room = getRoom(data.roomId);
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      if (room.phase !== "lobby") {
        callback?.({ error: "Game already started" });
        return;
      }

      const removed = room.removeBot(data.botId);
      if (!removed) {
        callback?.({ error: "Bot not found" });
        return;
      }

      const state = room.toState();
      io.to(data.roomId).emit("game_state", state);

      callback?.({ success: true });
    },
  );

  socket.on("start_game", (data: { roomId: string }, callback) => {
    const room = getRoom(data.roomId);
    if (!room) {
      callback?.({ error: "Room not found" });
      return;
    }

    if (!room.canStart()) {
      callback?.({
        error: "Need at least 2 players (including bots) to start",
      });
      return;
    }

    const state = room.startGame();
    if (!state) {
      callback?.({ error: "Failed to start game" });
      return;
    }

    // Send private hands to each player
    for (const player of room.players) {
      if (!player.isBot && player.socketId) {
        const playerState = room.toPlayerState(player.id);
        io.to(player.socketId).emit("your_hand", {
          hand: playerState.hand,
        });
      }
    }

    callback?.({ success: true });
  });

  // ===== GAMEPLAY ACTIONS =====

  socket.on(
    "play_cards",
    (
      data: {
        roomId: string;
        cardIndices: number[];
        declaration: CardDeclaration;
      },
      callback,
    ) => {
      const room = getRoom(data.roomId);
      if (!room) {
        callback?.({ error: "Room not found" });
        return;
      }

      const playerInfo = socketToPlayer.get(socket.id);
      if (!playerInfo) {
        callback?.({ error: "Not in a room" });
        return;
      }

      const result = room.playCards(
        playerInfo.playerId,
        data.cardIndices,
        data.declaration,
      );

      if (!result.success) {
        callback?.({ error: result.error });
        return;
      }

      // Send updated hands to each human player
      for (const player of room.players) {
        if (!player.isBot && player.socketId) {
          const playerState = room.toPlayerState(player.id);
          io.to(player.socketId).emit("your_hand", {
            hand: playerState.hand,
          });
        }
      }

      callback?.({ success: true });
    },
  );

  socket.on("call_liar", (data: { roomId: string }, callback) => {
    const room = getRoom(data.roomId);
    if (!room) {
      callback?.({ error: "Room not found" });
      return;
    }

    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback?.({ error: "Not in a room" });
      return;
    }

    const result = room.callLiar(playerInfo.playerId);

    if (!result.success) {
      callback?.({ error: result.error });
      return;
    }

    // Hands are NOT updated yet — they'll be sent after the reveal timer fires
    // via the onChallengeResolved callback

    callback?.({ success: true });
  });

  // ===== VOTE SKIP (for vote challenge mode) =====

  socket.on("vote_skip", (data: { roomId: string }, callback) => {
    const room = getRoom(data.roomId);
    if (!room) {
      callback?.({ error: "Room not found" });
      return;
    }

    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback?.({ error: "Not in a room" });
      return;
    }

    const result = room.voteSkipChallenge(playerInfo.playerId);

    if (!result.success) {
      callback?.({ error: result.error });
      return;
    }

    callback?.({ success: true, votesNow: result.votesNow, votesNeeded: result.votesNeeded });
  });

  socket.on("pass_turn", (data: { roomId: string }, callback) => {
    const room = getRoom(data.roomId);
    if (!room) {
      callback?.({ error: "Room not found" });
      return;
    }

    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback?.({ error: "Not in a room" });
      return;
    }

    const result = room.passTurn(playerInfo.playerId);

    if (!result.success) {
      callback?.({ error: result.error });
      return;
    }

    // Send updated hands (in case someone won)
    for (const player of room.players) {
      if (!player.isBot && player.socketId) {
        const playerState = room.toPlayerState(player.id);
        io.to(player.socketId).emit("your_hand", {
          hand: playerState.hand,
        });
      }
    }

    callback?.({ success: true });
  });

  // ===== MANUAL STATE REFRESH =====

  socket.on("get_state", (data: { roomId: string }, callback) => {
    const room = getRoom(data.roomId);
    if (!room) {
      callback?.({ error: "Room not found" });
      return;
    }

    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback?.({ error: "Not in a room" });
      return;
    }

    callback?.({
      success: true,
      state: room.toPlayerState(playerInfo.playerId),
    });
  });

  // ===== CHAT =====

  socket.on(
    "send_chat",
    (data: { roomId: string; message: string }) => {
      const playerInfo = socketToPlayer.get(socket.id);
      if (!playerInfo) return;

      const room = getRoom(data.roomId);
      if (!room) return;

      const player = room.getPlayer(playerInfo.playerId);
      if (!player) return;

      io.to(data.roomId).emit("chat_message", {
        playerId: player.id,
        playerName: player.name,
        message: data.message,
        timestamp: Date.now(),
      });
    },
  );

  // ===== WebRTC SIGNALING =====

  socket.on(
    "webrtc_signal",
    (data: {
      roomId: string;
      targetId: string;
      signal: unknown;
    }) => {
      const fromPlayer = socketToPlayer.get(socket.id);
      if (!fromPlayer) return;

      const room = getRoom(data.roomId);
      if (!room) return;

      const targetPlayer = room.getPlayer(data.targetId);
      if (!targetPlayer || !targetPlayer.socketId) return;

      io.to(targetPlayer.socketId).emit("webrtc_signal", {
        fromId: fromPlayer.playerId,
        signal: data.signal,
      });
    },
  );

  // ===== DISCONNECT =====

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) return;

    const room = getRoom(playerInfo.roomId);
    if (!room) {
      socketToPlayer.delete(socket.id);
      return;
    }

    room.handleDisconnect(socket.id);
    socketToPlayer.delete(socket.id);

    // Clean up empty rooms
    const humanPlayers = room.players.filter(
      (p) => !p.isBot && p.isConnected,
    );
    if (humanPlayers.length === 0) {
      console.log(`Cleaning up empty room ${playerInfo.roomId}`);
      room.destroy();
      rooms.delete(playerInfo.roomId);
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Liar's Bar server running on port ${PORT} (0.0.0.0)`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
