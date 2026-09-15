import type { Server, Socket } from "socket.io";
import { config } from "../config.js";
import { RoomRegistry } from "../core/RoomRegistry.js";
import { RateLimiter } from "./rateLimit.js";
import { sendPrivateHands, broadcastState, activeGameRoom } from "./emitters.js";
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
import { PartyRoom } from "../games/party/PartyRoom.js";
import { validateGameOptions, publicCatalog } from "../games/catalog.js";
import { acceptsRosterChanges } from "../games/phases.js";
import { DominoGame } from "../games/domino/DominoGame.js";
import { MemoryPuzzleGame } from "../games/memory-puzzle/MemoryPuzzleGame.js";
import { TetrisGame } from "../games/tetris/TetrisGame.js";
import { RentoGame } from "../games/rento/RentoGame.js";
import { SnakeLadderGame } from "../games/snake-ladder/SnakeLadderGame.js";
import { SpyfallGame } from "../games/spyfall/SpyfallGame.js";
import { ChameleonGame } from "../games/chameleon/ChameleonGame.js";
import { WyrGame } from "../games/wyr/WyrGame.js";

type Ack = ((response: unknown) => void) | undefined;

function reply(callback: Ack, response: unknown): void {
  if (typeof callback === "function") callback(response);
}

function fail(callback: Ack, error: string): void {
  reply(callback, { error });
}

/**
 * Is this room still in a pre-game state where the roster can change?
 *
 * A party is open while it's in the hub, or while a game is staged but not yet
 * dealt. Every other room defers to games/phases.ts, which knows every phase
 * spelling the engines use — see that file for the three bugs the mismatch
 * was causing.
 */
function isAcceptingRosterChanges(room: GameRoom): boolean {
  if (room instanceof PartyRoom) {
    if (room.phase === "hub") return true;
    return room.activeSubRoom ? acceptsRosterChanges(room.activeSubRoom) : true;
  }
  return acceptsRosterChanges(room);
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

    /**
     * Build a membership-narrowing function for a specific game engine: resolves the
     * caller's room + player, unwraps a LobbyRoom's active sub-room, and confirms the
     * sub-room is an instance of `GameClass`. Some engines (Liar's Bar, Codenames,
     * Higher/Lower) keep their own copy of the Player with extra game state, so their
     * membership must re-resolve the player via `targetRoom.getPlayer()`.
     */
    function makeMembership<T extends GameRoom>(
      GameClass: new (...args: any[]) => T,
      opts: { resolvePlayer?: boolean } = {},
    ) {
      return (callback: Ack): { room: T; player: Player } | null => {
        const m = membership();
        if (!m) {
          fail(callback, "Not in a room");
          return null;
        }
        const targetRoom = activeGameRoom(m.room);
        if (!(targetRoom instanceof GameClass)) {
          fail(callback, "Action not supported by this game");
          return null;
        }
        const player = opts.resolvePlayer ? targetRoom.getPlayer(m.player.id) || m.player : m.player;
        return { room: targetRoom, player };
      };
    }

    const liarsBarMembership = makeMembership(GameManager, { resolvePlayer: true });
    const codenamesMembership = makeMembership(CodenamesGame, { resolvePlayer: true });
    const higherLowerMembership = makeMembership(HigherLowerGame, { resolvePlayer: true });
    const tttMembership = makeMembership(TicTacToeGame);
    const snakeMembership = makeMembership(SnakeGame);
    const siMembership = makeMembership(SpaceInvadersGame);
    const fighterMembership = makeMembership(FighterGame);
    const dominoMembership = makeMembership(DominoGame);
    const memoryPuzzleMembership = makeMembership(MemoryPuzzleGame);
    const tetrisMembership = makeMembership(TetrisGame);
    const rentoMembership = makeMembership(RentoGame);
    const snakeLadderMembership = makeMembership(SnakeLadderGame);
    const spyfallMembership = makeMembership(SpyfallGame, { resolvePlayer: true });
    const chameleonMembership = makeMembership(ChameleonGame, { resolvePlayer: true });
    const wyrMembership = makeMembership(WyrGame, { resolvePlayer: true });

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

          // "party" / the legacy "lobby" id mean "open a room with no game
          // chosen yet"; anything else means "open a room and stage that
          // game in it". Either way the room itself is a PartyRoom, so the
          // group can switch games later without a new invite link.
          const wantsHubOnly = gameId === "party" || gameId === "lobby";

          if (!wantsHubOnly) {
            const optionError = validateGameOptions(gameId, data);
            if (optionError) {
              fail(callback, optionError);
              return;
            }
          } else if (
            !Number.isInteger(Number(data.maxPlayers)) ||
            Number(data.maxPlayers) < 2 ||
            Number(data.maxPlayers) > 10
          ) {
            fail(callback, "Players must be between 2 and 10");
            return;
          }

          const roomId = registry.generateRoomCode();

          const room = new PartyRoom(roomId, Number(data.maxPlayers), {
            broadcast: (state) => io.to(roomId).emit("game_state", state),
            onGameEnd: (rid, winnerId) => {
              console.log(`Game over in room ${rid}, winner: ${winnerId}`);
            },
            onHandsChanged: (rid) => {
              const r = registry.get(rid);
              if (r) sendPrivateHands(io, r);
            },
          });

          const player = room.addPlayer(playerName, socket.id, true, undefined, (data as any).flag);

          // Stage the requested game without dealing: the host is alone at
          // this point, and the classic flow is create -> share link -> wait
          // -> press Start. Auto-starting here would deal to one person.
          if (!wantsHubOnly) {
            const staged = room.pickGame(gameId, data, { autoStart: false });
            if (!staged.success) {
              room.destroy();
              fail(callback, staged.error ?? "Failed to set up that game");
              return;
            }
          }
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

          // A party always accepts arrivals. If a game is mid-hand the
          // newcomer waits in the hub and is dealt into the next one — which
          // is the entire reason parties exist. Only standalone game rooms
          // (created before this change, or by a direct engine route) still
          // reject a mid-game join, because their engines cannot seat one.
          if (!(room instanceof PartyRoom) && !acceptsRosterChanges(room)) {
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

          const player = room.addPlayer(playerName, socket.id, false, undefined, (data as any).flag);
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

        if (!isAcceptingRosterChanges(room)) {
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

      if (!isAcceptingRosterChanges(room)) {
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

    // Player-chosen piece icon (Rento/Snake & Ladder board token) and fighter
    // character id — generic, game-agnostic mutations on the caller's own Player.
    // Only meaningful before a sub-game has started; picking after that point
    // won't retroactively change an already-running sub-game's own player copy.
    socket.on("set_player_icon", (data: { icon?: string }, callback: Ack) => {
      const m = membership();
      if (!m) { fail(callback, "Not in a room"); return; }
      if (typeof data?.icon === "string" && data.icon.length > 0 && data.icon.length <= 8) {
        m.player.icon = data.icon;
      }
      broadcastState(io, m.room);
      reply(callback, { success: true });
    });

    socket.on("set_player_character", (data: { characterId?: string }, callback: Ack) => {
      const m = membership();
      if (!m) { fail(callback, "Not in a room"); return; }
      if (typeof data?.characterId === "string" && data.characterId.length > 0 && data.characterId.length <= 32) {
        m.player.characterId = data.characterId;
      }
      broadcastState(io, m.room);
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

    // ===== GAMEPLAY (Domino) =====

    socket.on(
      "domino_play_tile",
      (data: { tile: { left: number; right: number }; end: "left" | "right" }, callback: Ack) => {
        const m = dominoMembership(callback);
        if (!m) return;

        if (!data?.tile || typeof data.tile.left !== "number" || typeof data.tile.right !== "number" || !data.end) {
          fail(callback, "Invalid play parameters");
          return;
        }

        const result = m.room.playTile(m.player.id, data.tile, data.end);
        if (!result.success) {
          fail(callback, result.error ?? "Cannot play tile");
          return;
        }

        reply(callback, { success: true });
      }
    );

    socket.on("domino_draw_tile", (_data: unknown, callback: Ack) => {
      const m = dominoMembership(callback);
      if (!m) return;

      const result = m.room.drawTile(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot draw tile");
        return;
      }

      reply(callback, { success: true, tile: result.tile });
    });

    /**
     * Knock: "I can't play."
     *
     * Named for what it is at a real table rather than "pass", because it is
     * not a silent skip — it is a public declaration that proves the knocker
     * holds neither open pip, and the whole table plays on that afterwards.
     * The server validates it for exactly that reason: a client that could
     * knock while holding a legal tile would be feeding everyone a lie.
     */
    socket.on("domino_knock", (_data: unknown, callback: Ack) => {
      const m = dominoMembership(callback);
      if (!m) return;

      const result = m.room.knock(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot knock");
        return;
      }

      reply(callback, { success: true });
    });

    /** Legacy alias for clients still cached on the previous build. */
    socket.on("domino_pass", (_data: unknown, callback: Ack) => {
      const m = dominoMembership(callback);
      if (!m) return;

      const result = m.room.knock(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot knock");
        return;
      }

      reply(callback, { success: true });
    });

    socket.on("domino_rematch", (_data: unknown, callback: Ack) => {
      const m = dominoMembership(callback);
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
      (data: { left?: boolean; right?: boolean; jump?: boolean; attack1?: boolean; attack2?: boolean; special?: boolean; parry?: boolean }, callback: Ack) => {
        const m = fighterMembership(callback);
        if (!m) return;
        const result = m.room.setInput(m.player.id, {
          left: data?.left,
          right: data?.right,
          jump: data?.jump,
          attack1: data?.attack1,
          attack2: data?.attack2,
          special: data?.special,
          parry: data?.parry,
        });
        if (!result.success) {
          fail(callback, result.error ?? "Invalid input");
          return;
        }
        reply(callback, { success: true });
      },
    );

    // ===== GAMEPLAY (Memory Puzzle) =====

    socket.on(
      "memory_puzzle_flip",
      (data: { x: number; y: number }, callback: Ack) => {
        const m = memoryPuzzleMembership(callback);
        if (!m) return;
        const result = m.room.flip(m.player.id, Number(data?.x), Number(data?.y));
        if (!result.success) {
          fail(callback, result.error ?? "Invalid flip");
          return;
        }
        reply(callback, { success: true });
      },
    );

    // ===== GAMEPLAY (Tetris) =====

    socket.on(
      "tetris_input",
      (data: { action: "left" | "right" | "rotate" | "rotateCCW" | "down" | "drop" }, callback: Ack) => {
        const m = tetrisMembership(callback);
        if (!m) return;
        const result = m.room.input(m.player.id, data?.action);
        if (!result.success) {
          fail(callback, result.error ?? "Invalid input");
          return;
        }
        reply(callback, { success: true });
      },
    );

    // ===== GAMEPLAY (Rento) =====

    socket.on("rento_roll", (_data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const result = m.room.rollDice(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot roll");
        return;
      }
      reply(callback, { success: true, dice: result.dice });
    });

    socket.on("rento_buy", (_data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const result = m.room.buyProperty(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot buy");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_end_turn", (_data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const result = m.room.endTurn(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot end turn");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_trade", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as {
        toPlayerId?: string;
        offerProperties?: number[];
        offerMoney?: number;
        requestProperties?: number[];
        requestMoney?: number;
      };
      if (!d.toPlayerId) {
        fail(callback, "Missing toPlayerId");
        return;
      }
      const result = m.room.proposeTrade(
        m.player.id,
        d.toPlayerId,
        d.offerProperties ?? [],
        d.offerMoney ?? 0,
        d.requestProperties ?? [],
        d.requestMoney ?? 0
      );
      if (!result.success) {
        fail(callback, result.error ?? "Cannot trade");
        return;
      }
      reply(callback, { success: true, tradeId: result.tradeId });
    });

    socket.on("rento_edit_trade", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as {
        tradeId?: string;
        offerProperties?: number[];
        offerMoney?: number;
        requestProperties?: number[];
        requestMoney?: number;
      };
      if (!d.tradeId) {
        fail(callback, "Missing tradeId");
        return;
      }
      const result = m.room.editTrade(
        m.player.id,
        d.tradeId,
        d.offerProperties ?? [],
        d.offerMoney ?? 0,
        d.requestProperties ?? [],
        d.requestMoney ?? 0
      );
      if (!result.success) {
        fail(callback, result.error ?? "Cannot edit trade");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_build_house", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as { propertyId?: number };
      if (d.propertyId === undefined) {
        fail(callback, "Missing propertyId");
        return;
      }
      const result = m.room.buildHouse(m.player.id, Number(d.propertyId));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot build house");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_accept_trade", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as { tradeId?: string };
      if (!d.tradeId) {
        fail(callback, "Missing tradeId");
        return;
      }
      const result = m.room.acceptTrade(m.player.id, d.tradeId);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot accept trade");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_reject_trade", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as { tradeId?: string };
      if (!d.tradeId) {
        fail(callback, "Missing tradeId");
        return;
      }
      const result = m.room.rejectTrade(m.player.id, d.tradeId);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot reject trade");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_cancel_trade", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as { tradeId?: string };
      if (!d.tradeId) {
        fail(callback, "Missing tradeId");
        return;
      }
      const result = m.room.cancelTrade(m.player.id, d.tradeId);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot cancel trade");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_bankrupt", (_data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const result = m.room.declareBankrupt(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot declare bankruptcy");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("rento_votekick", (data: unknown, callback: Ack) => {
      const m = rentoMembership(callback);
      if (!m) return;
      const d = data as { targetPlayerId?: string };
      if (!d.targetPlayerId) {
        fail(callback, "Missing targetPlayerId");
        return;
      }
      const result = m.room.voteKick(m.player.id, d.targetPlayerId);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot vote");
        return;
      }
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Snake & Ladder) =====

    socket.on("snl_roll", (_data: unknown, callback: Ack) => {
      const m = snakeLadderMembership(callback);
      if (!m) return;
      const result = m.room.rollDice(m.player.id);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot roll");
        return;
      }
      reply(callback, { success: true, dice: result.dice });
    });

    // ===== GAMEPLAY (Spyfall) =====
    //
    // The whole game happens in the voice channel; these events only move the
    // few pieces of state the server has to arbitrate — who's being accused,
    // who agreed, and what the spy thinks the location is.

    socket.on("spyfall_pass", (data: { toPlayerId?: string }, callback: Ack) => {
      const m = spyfallMembership(callback);
      if (!m) return;
      const result = m.room.passQuestion(m.player.id, String(data?.toPlayerId ?? ""));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot pass the question");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("spyfall_accuse", (data: { targetId?: string }, callback: Ack) => {
      const m = spyfallMembership(callback);
      if (!m) return;
      const result = m.room.accuse(m.player.id, String(data?.targetId ?? ""));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot accuse");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("spyfall_vote", (data: { agree?: boolean }, callback: Ack) => {
      const m = spyfallMembership(callback);
      if (!m) return;
      const result = m.room.castVote(m.player.id, data?.agree === true);
      if (!result.success) {
        fail(callback, result.error ?? "Cannot vote");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("spyfall_guess", (data: { locationId?: string }, callback: Ack) => {
      const m = spyfallMembership(callback);
      if (!m) return;
      const result = m.room.guessLocation(m.player.id, String(data?.locationId ?? ""));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot guess");
        return;
      }
      // The reveal contains everyone's secret, so private state must go out
      // again immediately — otherwise the spy's own screen still says "you are
      // the spy" while everyone else is looking at the result.
      sendPrivateHands(io, m.room);
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Would You Rather) =====

    socket.on("wyr_choose", (data: { choice?: "a" | "b" }, callback: Ack) => {
      const m = wyrMembership(callback);
      if (!m) return;
      const result = m.room.choose(m.player.id, data?.choice as "a" | "b");
      if (!result.success) {
        fail(callback, result.error ?? "Cannot choose");
        return;
      }
      // The phase advanced; everyone's private slice changed with it.
      sendPrivateHands(io, m.room);
      reply(callback, { success: true });
    });

    socket.on("wyr_predict", (data: { choice?: "a" | "b" }, callback: Ack) => {
      const m = wyrMembership(callback);
      if (!m) return;
      const result = m.room.predict(m.player.id, data?.choice as "a" | "b");
      if (!result.success) {
        fail(callback, result.error ?? "Cannot predict");
        return;
      }
      sendPrivateHands(io, m.room);
      reply(callback, { success: true });
    });

    // ===== GAMEPLAY (Chameleon) =====

    socket.on("chameleon_clue", (data: { clue?: string }, callback: Ack) => {
      const m = chameleonMembership(callback);
      if (!m) return;
      const result = m.room.submitClue(m.player.id, String(data?.clue ?? ""));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot give that clue");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("chameleon_vote", (data: { targetId?: string }, callback: Ack) => {
      const m = chameleonMembership(callback);
      if (!m) return;
      const result = m.room.vote(m.player.id, String(data?.targetId ?? ""));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot vote");
        return;
      }
      reply(callback, { success: true });
    });

    socket.on("chameleon_guess", (data: { index?: number }, callback: Ack) => {
      const m = chameleonMembership(callback);
      if (!m) return;
      const result = m.room.guessWord(m.player.id, Number(data?.index));
      if (!result.success) {
        fail(callback, result.error ?? "Cannot guess");
        return;
      }
      // The reveal makes every secret public, so private state must go back
      // out or the chameleon's own screen still says "you don't know the word".
      sendPrivateHands(io, m.room);
      reply(callback, { success: true });
    });

    // ===== PARTY =====
    //
    // These four events are the whole answer to "we finished a game, now we
    // have to send a new link on WhatsApp". The room code, the roster, the
    // chat and the voice mesh survive every one of them.

    /** Public game catalogue, so the picker can grey out games that don't fit. */
    socket.on("party_catalog", (_data: unknown, callback: Ack) => {
      reply(callback, { success: true, games: publicCatalog() });
    });

    /** Host switches the party into a different game. Works from any phase. */
    socket.on(
      "party_pick_game",
      (data: { gameId?: string; options?: Partial<CreateRoomOptions> }, callback: Ack) => {
        const m = hostMembership(callback);
        if (!m) return;
        if (!(m.room instanceof PartyRoom)) {
          fail(callback, "This room can't switch games");
          return;
        }
        // Switching rebuilds a game engine and reseats everyone, so it is
        // cheap but not free; rate-limit it against a stuck client looping.
        if (!limiter.allow(`${socket.id}:party_pick`, 12, 30_000)) {
          fail(callback, "Slow down a moment");
          return;
        }

        const result = m.room.pickGame(
          String(data?.gameId ?? ""),
          data?.options ?? {},
        );
        if (!result.success) {
          fail(callback, result.error ?? "Could not start that game");
          return;
        }

        sendPrivateHands(io, m.room);
        reply(callback, { success: true });
      },
    );

    /** Same game, same settings, same people, fresh deal. */
    socket.on("party_rematch", (_data: unknown, callback: Ack) => {
      const m = hostMembership(callback);
      if (!m) return;
      if (!(m.room instanceof PartyRoom)) {
        fail(callback, "This room can't rematch");
        return;
      }
      if (!limiter.allow(`${socket.id}:party_pick`, 12, 30_000)) {
        fail(callback, "Slow down a moment");
        return;
      }

      const result = m.room.rematch();
      if (!result.success) {
        fail(callback, result.error ?? "Could not restart the game");
        return;
      }

      sendPrivateHands(io, m.room);
      reply(callback, { success: true });
    });

    /** Abandon the current game and go back to the picker. */
    socket.on("party_return_hub", (_data: unknown, callback: Ack) => {
      const m = hostMembership(callback);
      if (!m) return;
      if (!(m.room instanceof PartyRoom)) {
        fail(callback, "This room has no hub");
        return;
      }
      m.room.returnToHub();
      reply(callback, { success: true });
    });

    /**
     * Leave for good, as opposed to disconnecting. A disconnect keeps the
     * seat warm for a reconnect; this frees it so the party isn't stuck at
     * "5/5 players" with a ghost in one chair.
     */
    socket.on("party_leave", (_data: unknown, callback: Ack) => {
      const m = membership();
      if (!m) {
        reply(callback, { success: true });
        return;
      }
      const { room, player } = m;

      if (room instanceof PartyRoom) {
        room.removePlayer(player.id);
        room.activeSubRoom?.handleDisconnect(socket.id);
      } else {
        room.handleDisconnect(socket.id);
      }

      registry.unbindSocket(socket.id);
      socket.leave(room.roomId);
      broadcastState(io, room);
      reply(callback, { success: true });
    });

    // ===== LOBBY MODE SUB-GAMES =====

    socket.on(
      "lobby_start_game",
      (data: { gameId: string; options: any }, callback: Ack) => {
        const m = hostMembership(callback);
        if (!m) return;
        const { room } = m;

        // Legacy alias for party_pick_game. Kept because clients cached on
        // a user's phone will keep sending it for a while after deploy.
        if (room instanceof PartyRoom) {
          const result = room.pickGame(String(data?.gameId ?? ""), data?.options ?? {});
          if (!result.success) {
            fail(callback, result.error ?? "Failed to start sub-game");
            return;
          }
          sendPrivateHands(io, room);
          reply(callback, { success: true });
          return;
        }

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

      // Legacy alias for party_return_hub.
      if (room instanceof PartyRoom) {
        room.returnToHub();
        reply(callback, { success: true });
        return;
      }

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
        flag: m.player.flag,
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
