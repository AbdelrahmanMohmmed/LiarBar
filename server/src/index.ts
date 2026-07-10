import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { config } from "./config.js";
import { RoomRegistry } from "./core/RoomRegistry.js";
import { registerSocketHandlers } from "./socket/handlers.js";
import { GameManager } from "./games/liars-bar/GameManager.js";

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
    ...(room instanceof GameManager
      ? { variant: room.variant, deckCount: room.deckCount }
      : {}),
  });
});

// ============ Socket.IO ============

registerSocketHandlers(io, registry);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Liar's Bar server running on port ${config.port} (0.0.0.0)`);
  console.log(`Allowed origins: ${config.allowedOrigins.join(", ")}`);
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
