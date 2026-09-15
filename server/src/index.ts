import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { config, describeOrigins } from "./config.js";
import { RoomRegistry } from "./core/RoomRegistry.js";
import { registerSocketHandlers } from "./socket/handlers.js";
import { GameManager } from "./games/liars-bar/GameManager.js";
import { PartyRoom } from "./games/party/PartyRoom.js";
import { publicCatalog } from "./games/catalog.js";

const app = express();
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const registry = new RoomRegistry();
registry.startSweeper();

// ============ REST API ============

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", rooms: registry.size, uptime: process.uptime() });
});

/**
 * Room preview, used by the join page so someone opening an invite link sees
 * "Ahmed's party — 4 playing Domino" before they type a name, instead of a
 * bare code. Deliberately reveals nothing private: no player names, no hands.
 */
app.get("/api/room/:roomId", (req, res) => {
  const room = registry.get(req.params.roomId.toUpperCase());
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({
    roomId: room.roomId,
    gameId: room.gameId,
    phase: room.phase,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    ...(room instanceof PartyRoom
      ? {
          activeGameId: room.activeGameId,
          /** Parties accept latecomers; the join page shows this as "you can hop in". */
          joinable: room.players.length < room.maxPlayers,
        }
      : {}),
    ...(room instanceof GameManager
      ? { variant: room.variant, deckCount: room.deckCount }
      : {}),
  });
});

/** Which games exist and how many people each needs. Cached hard by clients. */
app.get("/api/games", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ games: publicCatalog() });
});

// ============ Socket.IO ============

registerSocketHandlers(io, registry);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Game server running on port ${config.port} (0.0.0.0)`);
  console.log(`Allowed origins: ${describeOrigins()}`);
});

// Graceful shutdown so platform restarts/redeploys (e.g. DigitalOcean)
// close sockets cleanly instead of dropping clients mid-write.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down...`);
  registry.stopSweeper();
  io.close(() => {
    console.log("All connections closed");
    process.exit(0);
  });
  // Force-exit if connections don't drain in time
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
