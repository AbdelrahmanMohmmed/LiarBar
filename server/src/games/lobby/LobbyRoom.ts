import { nanoid } from "nanoid";
import { Player } from "../liars-bar/Player.js";
import type { GameRoom, GameRoomCallbacks } from "../types.js";
import { createGameRoom, type CreateRoomOptions } from "../registry.js";

export class LobbyRoom implements GameRoom {
  readonly gameId = "lobby";
  readonly roomId: string;
  readonly players: Player[] = [];
  readonly maxPlayers: number;
  lastActivityAt: number;

  phase: "lobby" | "playing" = "lobby";
  activeGameId: string | null = null;
  activeSubRoom: GameRoom | null = null;
  private callbacks: GameRoomCallbacks;

  constructor(roomId: string, maxPlayers: number, callbacks: GameRoomCallbacks) {
    this.roomId = roomId;
    this.maxPlayers = Math.max(2, Math.min(10, maxPlayers || 10));
    this.callbacks = callbacks;
    this.lastActivityAt = Date.now();
  }

  addPlayer(name: string, socketId: string, isHost = false, playerId?: string): Player {
    const id = playerId || nanoid(8);
    const player = new Player(id, name, false, isHost);
    player.socketId = socketId;
    player.isConnected = true;
    this.players.push(player);
    this.lastActivityAt = Date.now();

    if (this.activeSubRoom) {
      const subPlayer = this.activeSubRoom.addPlayer(name, socketId, isHost, id);
      subPlayer.isConnected = true;
    }

    return player;
  }

  addBot(name: string, difficulty = "medium"): Player {
    const id = "bot_" + nanoid(6);
    const player = new Player(id, name, true, false);
    player.isConnected = true;
    this.players.push(player);
    this.lastActivityAt = Date.now();

    if (this.activeSubRoom) {
      this.activeSubRoom.addBot(name, difficulty);
    }

    return player;
  }

  removeBot(botId: string): boolean {
    const idx = this.players.findIndex((p) => p.id === botId && p.isBot);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.lastActivityAt = Date.now();

    if (this.activeSubRoom) {
      this.activeSubRoom.removeBot(botId);
    }

    return true;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find((p) => p.id === id);
  }

  handleDisconnect(socketId: string): Player | null {
    const player = this.players.find((p) => p.socketId === socketId);
    if (player) {
      player.isConnected = false;
      player.socketId = undefined;
      this.lastActivityAt = Date.now();

      if (this.activeSubRoom) {
        this.activeSubRoom.handleDisconnect(socketId);
      }
    }
    return player || null;
  }

  handleReconnect(playerId: string, socketId: string): Player | null {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isConnected = true;
      player.socketId = socketId;
      this.lastActivityAt = Date.now();

      if (this.activeSubRoom) {
        this.activeSubRoom.handleReconnect(playerId, socketId);
      }
    }
    return player || null;
  }

  canStart(): boolean {
    return this.players.length >= 2;
  }

  startGame(): unknown | null {
    return null;
  }

  startSubGame(gameId: string, options: CreateRoomOptions): boolean {
    this.activeGameId = gameId;
    this.phase = "playing";
    this.lastActivityAt = Date.now();

    const subCallbacks: GameRoomCallbacks = {
      broadcast: () => {
        this.callbacks.broadcast(this.toState());
      },
      onGameEnd: () => {
        this.callbacks.broadcast(this.toState());
      },
      onHandsChanged: () => {
        this.callbacks.onHandsChanged(this.roomId);
      },
    };

    // Instantiate sub-game room using registry
    const subRoom = createGameRoom(gameId, this.roomId, options, subCallbacks);
    if (!subRoom) return false;

    this.activeSubRoom = subRoom;

    // Synchronize current lobby players to the subRoom
    for (const player of this.players) {
      if (player.isBot) {
        subRoom.addBot(player.name, "medium");
      } else {
        const subPlayer = subRoom.addPlayer(
          player.name,
          player.socketId ?? "",
          player.isHost,
          player.id
        );
        subPlayer.isConnected = player.isConnected;
      }
    }

    // Launch sub-game
    subRoom.startGame();
    return true;
  }

  returnToLobby(): void {
    if (this.activeSubRoom) {
      this.activeSubRoom.destroy();
      this.activeSubRoom = null;
    }
    this.activeGameId = null;
    this.phase = "lobby";
    this.lastActivityAt = Date.now();
  }

  toState(): unknown {
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      phase: this.phase,
      activeGameId: this.activeGameId,
      players: this.players.map((p) => p.toPublicData()),
      maxPlayers: this.maxPlayers,
      subGameState: this.activeSubRoom ? this.activeSubRoom.toState() : null,
    };
  }

  toPlayerState(playerId: string): unknown {
    const player = this.getPlayer(playerId);
    const hand = player ? player.hand : [];
    return {
      roomId: this.roomId,
      gameId: this.gameId,
      phase: this.phase,
      activeGameId: this.activeGameId,
      players: this.players.map((p) => (p.id === playerId ? p.toData() : p.toPublicData())),
      maxPlayers: this.maxPlayers,
      hand,
      subGameState: this.activeSubRoom ? this.activeSubRoom.toPlayerState(playerId) : null,
    };
  }

  destroy(): void {
    if (this.activeSubRoom) {
      this.activeSubRoom.destroy();
      this.activeSubRoom = null;
    }
  }
}
