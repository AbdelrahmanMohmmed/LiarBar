import type { Server, Socket } from "socket.io";
import { config } from "../config.js";
import { RoomRegistry } from "../core/RoomRegistry.js";
import { RateLimiter } from "./rateLimit.js";
import { sendPrivateHands, broadcastState } from "./emitters.js";
import {
  createGameRoom,
  DEFAULT_GAME_ID,
  type CreateRoomOptions,
} from "../games/registry.js";
import type { GameRoom } from "../games/types.js";
import { GameManager } from "../games/liars-bar/GameManager.js";
import type { CardDeclaration } from "../games/liars-bar/Deck.js";
import type { BotDifficulty } from "../games/liars-bar/BotAI.js";
import type { Player } from "../games/liars-bar/Player.js";
import { CodenamesGame } from "../games/codenames/CodenamesGame.js";
import { HigherLowerGame } from "../games/higher-lower/HigherLowerGame.js";
import { TicTacToeGame } from "../games/tictactoe/TicTacToeGame.js";
import { SnakeGame } from "../games/snake/SnakeGame.js";
import { SpaceInvadersGame } from "../games/space-invaders/SpaceInvadersGame.js";
import { FighterGame } from "../games/fighter/FighterGame.js";
import { LobbyRoom } from "../games/lobby/LobbyRoom.js";

type Ack = ((response: unknown) => void) | undefined;

function reply(callback: Ack, response: unknown): void {
  if (typeof callback === "function") callback(response);
}

function fail(callback: Ack, error: string): void {
  reply(callback, { error });
}

/** Validate and normalize a player-provided display name. */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, config.maxNameLength);
  return name.length > 0 ? name : null;
}

export function registerSocketHandlers(
  io: Server,
  registry: RoomRegistry,
): void {
  const limiter = new RateLimiter();

  io.on("connection", (socket: Socket) => {
    /**
     * Resolve the caller's room + player from the server-side session,
     * never trusting a client-sent roomId for authorization.
     */
    function membership(): { room: GameRoom; player: Player } | null {
      const session = registry.getSession(socket.id);
      if (!session) return null;
      const room = registry.get(session.roomId);
      if (!room) return null;
      const player = room.getPlayer(session.playerId);
      if (!player) return null;
      return { room, player };
    }

    /** Membership + host check for lobby-management actions. */
    function hostMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      if (!m.player.isHost) {
        fail(callback, "Only the host can do that");
        return null;
      }
      return m;
    }

    /** Narrow a generic room to the Liar's Bar engine for game actions. */
    function liarsBarMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof GameManager)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      const player = targetRoom.getPlayer(m.player.id) || m.player;
      return { room: targetRoom, player };
    }

    /** Narrow a generic room to the Codenames engine for game actions. */
    function codenamesMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof CodenamesGame)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      const player = targetRoom.getPlayer(m.player.id) || m.player;
      return { room: targetRoom, player };
    }

    /** Narrow a generic room to the Higher or Lower engine for game actions. */
    function higherLowerMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof HigherLowerGame)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      const player = targetRoom.getPlayer(m.player.id) || m.player;
      return { room: targetRoom, player };
    }

    /** Narrow to the Tic-Tac-Toe engine. */
    function tttMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof TicTacToeGame)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      return { room: targetRoom, player: m.player };
    }

    /** Narrow to the Snake engine. */
    function snakeMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof SnakeGame)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      return { room: targetRoom, player: m.player };
    }

    /** Narrow to the Space Invaders engine. */
    function siMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof SpaceInvadersGame)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      return { room: targetRoom, player: m.player };
    }

    /** Narrow to the Fighter engine. */
    function fighterMembership(callback: Ack) {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return null;
      }
      let targetRoom = m.room;
      if (targetRoom instanceof LobbyRoom && targetRoom.activeSubRoom) {
        targetRoom = targetRoom.activeSubRoom;
      }
      if (!(targetRoom instanceof FighterGame)) {
        fail(callback, "Action not supported by this game");
        return null;
      }
      return { room: targetRoom, player: m.player };
    }

    // ===== ROOM LIFECYCLE =====

    socket.on(
      "create_room",
      (data: { playerName: string; gameId?: string } & CreateRoomOptions, callback: Ack) => {
        try {
          if (!limiter.allow(`${socket.id}:create`, 5, 60_000)) {
            fail(callback, "Too many rooms created, slow down");
            return;
          }

          const playerName = cleanName(data?.playerName);
          if (!playerName) {
            fail(callback, "Player name is required");
            return;
          }
          if (registry.getSession(socket.id)) {
            fail(callback, "Already in a room");
            return;
          }

          const gameId = data.gameId || DEFAULT_GAME_ID;
          const maxPlayers = Number(data.maxPlayers);

          if (gameId === DEFAULT_GAME_ID) {
            const deckCount = Number(data.deckCount);
            if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 6) {
              fail(callback, "Players must be between 2 and 6");
              return;
            }
            if (!Number.isInteger(deckCount) || deckCount < 1 || deckCount > 4) {
              fail(callback, "Deck count must be between 1 and 4");
              return;
            }
            if (data.variant !== "cards" && data.variant !== "dominoes") {
              fail(callback, "Unknown game variant");
              return;
            }
          } else if (gameId === "codenames") {
            if (!Number.isInteger(maxPlayers) || maxPlayers < 4 || maxPlayers > 10) {
              fail(callback, "Players must be between 4 and 10");
              return;
            }
            if (data.language !== "ar" && data.language !== "en") {
              fail(callback, "Language must be 'ar' or 'en'");
              return;
            }
          } else if (gameId === "higher-lower") {
            if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 6) {
              fail(callback, "Players must be between 2 and 6");
              return;
            }
          } else if (gameId === "lobby") {
            if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
              fail(callback, "Players must be between 2 and 10");
              return;
            }
          } else {
            fail(callback, `Unknown game: ${gameId}`);
            return;
          }

          const roomId = registry.generateRoomCode();

          const room = createGameRoom(gameId, roomId, data, {
            broadcast: (state) => io.to(roomId).emit("game_state", state),
            onGameEnd: (rid, winnerId) => {
              console.log(`Game over in room ${rid}, winner: ${winnerId}`);
            },
            onHandsChanged: (rid) => {
              const r = registry.get(rid);
              if (r) sendPrivateHands(io, r);
            },
          });

          if (!room) {
            fail(callback, `Unknown game: ${gameId}`);
            return;
          }

          const player = room.addPlayer(playerName, socket.id, true);
          registry.add(room);
          socket.join(roomId);
          registry.bindSocket(socket.id, { roomId, playerId: player.id });

          console.log(`Room ${roomId} created by ${playerName} (game: ${gameId})`);

          reply(callback, {
            success: true,
            roomId,
            playerId: player.id,
            state: room.toPlayerState(player.id),
          });
        } catch (err) {
          console.error("Error creating room:", err);
          fail(callback, "Failed to create room");
        }
      },
    );

    socket.on(
      "join_room",
      (data: { roomId: string; playerName: string }, callback: Ack) => {
        try {
          const playerName = cleanName(data?.playerName);
          if (!playerName) {
            fail(callback, "Player name is required");
            return;
          }

          const room = registry.get(String(data?.roomId ?? "").trim().toUpperCase());
          if (!room) {
            fail(callback, "Room not found");
            return;
          }
          if (room.phase !== "lobby") {
            fail(callback, "Game already in progress");
            return;
          }
          if (room.players.length >= room.maxPlayers) {
            fail(callback, "Room is full");
            return;
          }
          if (room.players.some((p) => p.name === playerName)) {
            fail(callback, "Name already taken in this room");
            return;
          }

          const player = room.addPlayer(playerName, socket.id);
          socket.join(room.roomId);
          registry.bindSocket(socket.id, { roomId: room.roomId, playerId: player.id });

          broadcastState(io, room);
          console.log(`${playerName} joined room ${room.roomId}`);

          reply(callback, {
            success: true,
            playerId: player.id,
            state: room.toPlayerState(player.id),
          });
        } catch (err) {
          console.error("Error joining room:", err);
          fail(callback, "Failed to join room");
        }
      },
    );

    socket.on(
      "reconnect_room",
      (data: { roomId: string; playerId: string }, callback: Ack) => {
        try {
          const room = registry.get(String(data?.roomId ?? ""));
          if (!room) {
            fail(callback, "Room not found");
            return;
          }

          const player = room.handleReconnect(String(data?.playerId ?? ""), socket.id);
          if (!player) {
            fail(callback, "Player not found in room");
            return;
          }

          socket.join(room.roomId);
          registry.bindSocket(socket.id, { roomId: room.roomId, playerId: player.id });

          console.log(`Player ${player.name} reconnected to room ${room.roomId}`);

          reply(callback, {
            success: true,
            state: room.toPlayerState(player.id),
          });
        } catch (err) {
          console.error("Error reconnecting:", err);
          fail(callback, "Failed to reconnect");
        }
      },
    );

    // ===== LOBBY ACTIONS (host only) =====

    socket.on(
      "add_bot",
      (data: { botName?: string; difficulty?: BotDifficulty }, callback: Ack) => {
        const m = hostMembership(callback);
        if (!m) return;
        const { room } = m;

        if (room.phase !== "lobby") {
          fail(callback, "Game already started");
          return;
        }
        if (room.players.length >= room.maxPlayers) {
          fail(callback, "Room is full");
          return;
        }

        const botName =
          cleanName(data?.botName) || `Bot ${room.players.length + 1}`;
        room.addBot(botName, data?.difficulty || "medium");

        broadcastState(io, room);
        reply(callback, { success: true });
      },
    );

    socket.on("remove_bot", (data: { botId: string }, callback: Ack) => {
      const m = hostMembership(callback);
      if (!m) return;
      const { room } = m;

      if (room.phase !== "lobby") {
        fail(callback, "Game already started");
        return;
      }
      if (!room.removeBot(String(data?.botId ?? ""))) {
        fail(callback, "Bot not found");
        return;
      }

      broadcastState(io, room);
      reply(callback, { success: true });
    });

    socket.on("start_game", (_data: unknown, callback: Ack) => {
      const m = hostMembership(callback);
      if (!m) return;
      const { room } = m;

      if (!room.canStart()) {
        fail(callback, "Need at least 2 players (including bots) to start");
        return;
      }
      if (!room.startGame()) {
        fail(callback, "Failed to start game");
        return;
      }

      sendPrivateHands(io, room);
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Liar's Bar) =====

    socket.on(
      "play_cards",
      (data: { cardIndices: number[]; declaration: CardDeclaration }, callback: Ack) => {
        const m = liarsBarMembership(callback);
        if (!m) return;

        const result = m.room.playCards(
          m.player.id,
          Array.isArray(data?.cardIndices) ? data.cardIndices : [],
          data?.declaration,
        );
        if (!result.success) {
          fail(callback, result.error ?? "Invalid play");
          return;
        }

        sendPrivateHands(io, m.room);
        reply(callback, { success: true });
      },
    );

    socket.on("call_liar", (_data: unknown, callback: Ack) => {
      const m = liarsBarMembership(callback);
      if (!m) return;

      const result = m.room.callLiar(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot call liar");
        return;
      }
      // Hands are re-sent after the reveal timer via onHandsChanged
      reply(callback, { success: true });
    });

    socket.on("vote_skip", (_data: unknown, callback: Ack) => {
      const m = liarsBarMembership(callback);
      if (!m) return;

      const result = m.room.voteSkipChallenge(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot vote");
        return;
      }
      reply(callback, {
        success: true,
        votesNow: result.votesNow,
        votesNeeded: result.votesNeeded,
      });
    });

    socket.on("pass_turn", (_data: unknown, callback: Ack) => {
      const m = liarsBarMembership(callback);
      if (!m) return;

      const result = m.room.passTurn(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot pass");
        return;
      }

      sendPrivateHands(io, m.room);
      reply(callback, { success: true });
    });

    socket.on("get_state", (_data: unknown, callback: Ack) => {
      const m = membership();
      if (!m) {
        fail(callback, "Not in a room");
        return;
      }
      reply(callback, {
        success: true,
        state: m.room.toPlayerState(m.player.id),
      });
    });

    // ===== GAMEPLAY (Codenames) =====

    socket.on(
      "codenames_join_team",
      (data: { team: "red" | "teal"; role: "spymaster" | "operative" }, callback: Ack) => {
        const m = codenamesMembership(callback);
        if (!m) return;

        const result = m.room.joinTeam(m.player.id, data?.team, data?.role);
        if (!result.success) {
          fail(callback, result.error ?? "Cannot join team");
          return;
        }
        reply(callback, { success: true });
      },
    );

    socket.on(
      "codenames_give_clue",
      (data: { word: string; count: number }, callback: Ack) => {
        const m = codenamesMembership(callback);
        if (!m) return;

        const word = typeof data?.word === "string" ? data.word.trim().slice(0, 30) : "";
        const result = m.room.giveClue(m.player.id, word, Number(data?.count));
        if (!result.success) {
          fail(callback, result.error ?? "Cannot give clue");
          return;
        }
        reply(callback, { success: true });
      },
    );

    socket.on(
      "codenames_guess",
      (data: { cardIndex: number }, callback: Ack) => {
        const m = codenamesMembership(callback);
        if (!m) return;

        const cardIndex = Number(data?.cardIndex);
        if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex > 24) {
          fail(callback, "Invalid card index");
          return;
        }
        const result = m.room.guessCard(m.player.id, cardIndex);
        if (!result.success) {
          fail(callback, result.error ?? "Cannot guess");
          return;
        }
        reply(callback, { success: true });
      },
    );

    socket.on("codenames_end_turn", (_data: unknown, callback: Ack) => {
      const m = codenamesMembership(callback);
      if (!m) return;

      const result = m.room.endTurn(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot end turn");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("codenames_rematch", (_data: unknown, callback: Ack) => {
      const m = hostMembership(callback);
      if (!m) return;
      if (!(m.room instanceof CodenamesGame)) {
        fail(callback, "Action not supported by this game");
        return;
      }

      const result = m.room.rematch(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot start rematch");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("higher_lower_guess", (data: { guess: number }, callback: Ack) => {
      const m = higherLowerMembership(callback);
      if (!m) return;

      const guess = Number(data?.guess);
      if (!Number.isInteger(guess) || guess < 1 || guess > 99) {
        fail(callback, "Invalid guess");
        return;
      }

      const result = m.room.submitGuess(m.player.id, guess);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot guess");
        return;
      }

      reply(callback, { success: true });
    });

    socket.on("higher_lower_rematch", (_data: unknown, callback: Ack) => {
      const m = higherLowerMembership(callback);
      if (!m) return;

      const result = m.room.rematch(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot start rematch");
        return;
      }
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Tic-Tac-Toe) =====

    socket.on("ttt_move", (data: { index: number }, callback: Ack) => {
      const m = tttMembership(callback);
      if (!m) return;
      const result = m.room.move(m.player.id, Number(data?.index));
      if (!result.success) {
        fail(callback, result.error ?? "Invalid move");
        return;
      }
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Snake) =====

    socket.on("snake_set_dir", (data: { dir: "up" | "down" | "left" | "right" }, callback: Ack) => {
      const m = snakeMembership(callback);
      if (!m) return;
      const result = m.room.setDirection(m.player.id, data?.dir);
      if (!result.success) {
        fail(callback, result.error ?? "Invalid direction");
        return;
      }
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Space Invaders) =====

    socket.on(
      "si_input",
      (data: { dx?: number; dy?: number; fire?: boolean }, callback: Ack) => {
        const m = siMembership(callback);
        if (!m) return;
        const result = m.room.setInput(m.player.id, {
          dx: data?.dx,
          dy: data?.dy,
          fire: data?.fire,
        });
        if (!result.success) {
          fail(callback, result.error ?? "Invalid input");
          return;
        }
        reply(callback, { success: true });
      },
    );

    // ===== GAMEPLAY (Fighter) =====

    socket.on(
      "fighter_input",
      (data: { left?: boolean; right?: boolean; jump?: boolean; attack1?: boolean; attack2?: boolean }, callback: Ack) => {
        const m = fighterMembership(callback);
        if (!m) return;
        const result = m.room.setInput(m.player.id, {
          left: data?.left,
          right: data?.right,
          jump: data?.jump,
          attack1: data?.attack1,
          attack2: data?.attack2,
        });
        if (!result.success) {
          fail(callback, result.error ?? "Invalid input");
          return;
        }
        reply(callback, { success: true });
      },
    );

    // ===== LOBBY MODE SUB-GAMES =====

    socket.on(
      "lobby_start_game",
      (data: { gameId: string; options: any }, callback: Ack) => {
        const m = hostMembership(callback);
        if (!m) return;
        const { room } = m;

        if (!(room instanceof LobbyRoom)) {
          fail(callback, "Not in a lobby room");
          return;
        }

        const success = room.startSubGame(data?.gameId, data?.options);
        if (!success) {
          fail(callback, "Failed to start sub-game");
          return;
        }

        sendPrivateHands(io, room);
        reply(callback, { success: true });
      }
    );

    socket.on("lobby_return_to_lobby", (_data: unknown, callback: Ack) => {
      const m = hostMembership(callback);
      if (!m) return;
      const { room } = m;

      if (!(room instanceof LobbyRoom)) {
        fail(callback, "Not in a lobby room");
        return;
      }

      room.returnToLobby();
      broadcastState(io, room);
      reply(callback, { success: true });
    });

    // ===== CHAT =====

    socket.on("send_chat", (data: { message: string }) => {
      const m = membership();
      if (!m) return;
      if (!limiter.allow(`${socket.id}:chat`, 8, 5_000)) return;

      const message =
        typeof data?.message === "string"
          ? data.message.trim().slice(0, config.maxChatLength)
          : "";
      if (!message) return;

      io.to(m.room.roomId).emit("chat_message", {
        playerId: m.player.id,
        playerName: m.player.name,
        message,
        timestamp: Date.now(),
      });
    });

    // ===== WebRTC SIGNALING (voice chat) =====

    socket.on(
      "webrtc_signal",
      (data: { targetId: string; signal: unknown }) => {
        const m = membership();
        if (!m) return;

        const target = m.room.getPlayer(String(data?.targetId ?? ""));
        if (!target?.socketId) return;

        io.to(target.socketId).emit("webrtc_signal", {
          fromId: m.player.id,
          signal: data.signal,
        });
      },
    );

    // ===== DISCONNECT =====

    socket.on("disconnect", () => {
      limiter.clearPrefix(socket.id);

      const session = registry.getSession(socket.id);
      registry.unbindSocket(socket.id);
      if (!session) return;

      const room = registry.get(session.roomId);
      if (!room) return;

      room.handleDisconnect(socket.id);
      // The room is NOT destroyed here even if it's now empty — the
      // registry sweeper removes it after a grace period, so a page
      // refresh or brief network drop doesn't kill the game.
      broadcastState(io, room);
    });
  });
}
