/**
 * server/server.js — the signaling server (the only backend this prototype needs).
 *
 * It does three things:
 *   1. serve the static files in ../voice-chat (so there is nothing else to run)
 *   2. relay WebRTC signaling messages (offers, answers, ICE candidates) between
 *      the players of a room
 *   3. hold the authoritative room state: who is in which room, who is connected,
 *      who dropped, and who is still allowed to come back
 *
 * It never touches audio. Audio is peer-to-peer (§5).
 *
 * ── The one idea that makes reconnection work ──────────────────────────────
 *
 *   ROOM  ≠  CONNECTION                       (§11)
 *
 *   A VoiceRoom owns its membership. A PlayerSession owns one player's
 *   connection state. When a browser disappears we do NOT delete the session —
 *   we flip it to `disconnected`, keep it for SESSION_TTL_MS, and keep the player
 *   in the room. If that player (same playerId, from localStorage) comes back
 *   within the TTL, their new socket adopts the existing session and the room is
 *   already populated, so the client can rebuild its WebRTC mesh immediately.
 *
 *   After the TTL expires the session is removed, exactly like a Discord user who
 *   loses connection for long enough stops showing as "in the channel".
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..', 'voice-chat');

/* -------------------------------------------------------------------------- */
/* defaults (override with env vars, or with createVoiceServer() options)      */
/* -------------------------------------------------------------------------- */

const DEFAULTS = {
  port: Number(process.env.PORT ?? 8080),
  /** Rooms offered in the UI. Any valid id can still be joined on demand. */
  rooms: (process.env.ROOMS ?? 'lobby,room-1,room-2').split(',').map((r) => r.trim()).filter(Boolean),
  /** How long a disconnected session (and its room slot) is kept. §13 */
  sessionTtlMs: Number(process.env.SESSION_TTL_MS ?? 30_000),
  /** How long a room with nobody in it sticks around before being collected. */
  roomTtlMs: Number(process.env.ROOM_TTL_MS ?? 10 * 60_000),
  /** Ping interval used to detect half-open sockets (browser killed, cable pulled). */
  heartbeatMs: Number(process.env.HEARTBEAT_MS ?? 15_000),
  /** How often the TTL sweeper runs. */
  sweepMs: Number(process.env.SWEEP_MS ?? 5_000),
  clientDir: CLIENT_DIR,
  log: (...args) => console.log(...args),
};

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/i;
const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const MAX_MESSAGE_BYTES = 256 * 1024;

/* -------------------------------------------------------------------------- */
/* data model (§12)                                                            */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {object} VoiceRoom
 * @property {string} roomId
 * @property {Set<string>} players      playerIds, in join order
 * @property {number|null} emptySince   when the last player left (for cleanup)
 */

/**
 * @typedef {object} PlayerSession
 * @property {string} playerId
 * @property {string} username
 * @property {string} sessionId
 * @property {string|null} roomId
 * @property {'connected'|'disconnected'} connectionState
 * @property {number} lastSeen
 * @property {boolean} muted
 * @property {boolean} deafened
 * @property {boolean} speaking
 * @property {import('ws').WebSocket|null} socket
 * @property {number|null} disconnectedAt
 * @property {boolean} alive            heartbeat flag
 */

const cleanString = (value, fallback = '') =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 64) : fallback;

export function createVoiceServer(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const log = (...args) => config.log('[signaling]', ...args);

  /** playerId -> PlayerSession */
  const sessions = new Map();
  /** roomId -> VoiceRoom */
  const rooms = new Map();
  let sessionCounter = 0;

  /* ------------------------------ serializers ---------------------------- */

  /** The public shape of a player, used for presence in every room message. */
  const toPresence = (session) => ({
    playerId: session.playerId,
    username: session.username,
    connectionState: session.connectionState,
    muted: session.muted,
    deafened: session.deafened,
    speaking: session.speaking,
    lastSeen: session.lastSeen,
  });

  const send = (session, message) => {
    const socket = session?.socket;
    if (!socket || socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  };

  const roomMembers = (room) => [...room.players].map((id) => sessions.get(id)).filter(Boolean);

  const broadcast = (room, message, exceptPlayerId = null) => {
    for (const member of roomMembers(room)) {
      if (member.playerId === exceptPlayerId) continue;
      send(member, message);
    }
  };

  /* -------------------------------- rooms -------------------------------- */

  const ensureRoom = (roomId) => {
    let room = rooms.get(roomId);
    if (!room) {
      room = { roomId, players: new Set(), emptySince: null };
      rooms.set(roomId, room);
      log(`room created: ${roomId}`);
    }
    return room;
  };

  const roomStateMessage = (room) => ({
    type: 'room-state',
    roomId: room.roomId,
    // Sent to one player, and it contains EVERY member including themselves.
    // This single authoritative list is what the client rebuilds its WebRTC
    // mesh from after a refresh or a network drop (§11, §14).
    players: roomMembers(room).map(toPresence),
  });

  const joinRoom = (session, roomId) => {
    const existing = session.roomId ? rooms.get(session.roomId) : null;

    // Rejoining a room the session never really left (the reconnect path).
    if (existing && session.roomId === roomId) {
      session.connectionState = 'connected';
      session.disconnectedAt = null;
      send(session, roomStateMessage(existing));
      broadcast(existing, { type: 'peer-updated', peer: toPresence(session) }, session.playerId);
      log(`${session.username} re-adopted ${roomId} (session ${session.sessionId})`);
      return;
    }

    if (existing) leaveRoom(session, 'switched');

    const room = ensureRoom(roomId);
    room.emptySince = null;
    room.players.add(session.playerId);
    session.roomId = roomId;
    session.connectionState = 'connected';
    session.disconnectedAt = null;

    // Order matters: the joiner gets the full roster first, so it knows who to
    // call; then everyone else is told about the newcomer.
    send(session, roomStateMessage(room));
    broadcast(room, { type: 'peer-joined', peer: toPresence(session) }, session.playerId);
    log(`${session.username} joined ${roomId} (${room.players.size} in room)`);
  };

  /**
   * Remove a player from their room. The session itself survives unless the
   * caller deletes it — that separation is the whole point of §11.
   */
  const leaveRoom = (session, reason) => {
    if (!session.roomId) return;
    const room = rooms.get(session.roomId);
    session.roomId = null;
    if (!room) return;

    room.players.delete(session.playerId);
    if (room.players.size === 0) room.emptySince = Date.now();
    broadcast(room, { type: 'peer-left', playerId: session.playerId, reason });
    log(`${session.username} left ${room.roomId} (${reason})`);
  };

  const dropSession = (session, reason) => {
    leaveRoom(session, reason);
    sessions.delete(session.playerId);
  };

  /* ------------------------------ messages ------------------------------- */

  const handleHello = (socket, message) => {
    const playerId = cleanString(message.playerId);
    if (!PLAYER_ID_PATTERN.test(playerId)) {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid playerId' }));
      socket.close(1008, 'invalid playerId');
      return null;
    }
    const username = cleanString(message.username, playerId) || playerId;

    let session = sessions.get(playerId);
    if (session) {
      // Someone is already using this identity (an old tab, or the player
      // reconnecting). The newest connection wins; the old one is told why it
      // was closed so it does not try to reconnect in a loop.
      if (session.socket && session.socket !== socket && session.socket.readyState === socket.OPEN) {
        log(`${username}: closing previous connection (session taken over)`);
        session.socket.close(4000, 'superseded by a new connection');
      }
      session.username = username;
      session.socket = socket;
      session.connectionState = 'connected';
      session.disconnectedAt = null;
      session.alive = true;
      session.lastSeen = Date.now();
      if (session.roomId) {
        const room = rooms.get(session.roomId);
        if (room) broadcast(room, { type: 'peer-updated', peer: toPresence(session) }, session.playerId);
      }
    } else {
      sessionCounter += 1;
      session = {
        playerId,
        username,
        sessionId: `s${sessionCounter}`,
        roomId: null,
        connectionState: 'connected',
        lastSeen: Date.now(),
        muted: false,
        deafened: false,
        speaking: false,
        socket,
        disconnectedAt: null,
        alive: true,
      };
      sessions.set(playerId, session);
      log(`session created: ${username} (${playerId})`);
    }

    socket.playerId = playerId;
    send(session, { type: 'welcome', playerId, username, rooms: config.rooms, sessionId: session.sessionId });
    return session;
  };

  const handleMessage = (socket, message) => {
    // `hello` is the only message allowed before a session exists: it is what
    // creates or adopts one. It also doubles as "update my username".
    if (message.type === 'hello') {
      handleHello(socket, message);
      return;
    }

    const session = sessions.get(socket.playerId);
    if (!session) {
      socket.send(JSON.stringify({ type: 'error', message: 'Send hello first' }));
      return;
    }
    session.lastSeen = Date.now();

    switch (message.type) {
      case 'join': {
        const roomId = cleanString(message.roomId);
        if (!ROOM_ID_PATTERN.test(roomId)) {
          send(session, { type: 'error', message: `Invalid room id: ${roomId}` });
          return;
        }
        joinRoom(session, roomId);
        break;
      }

      case 'leave':
        // Intentional leave: out of the room, but the socket and the identity
        // stay alive so presence keeps working and the player can rejoin.
        leaveRoom(session, 'left');
        send(session, { type: 'left', roomId: null });
        break;

      case 'state': {
        if (typeof message.muted === 'boolean') session.muted = message.muted;
        if (typeof message.deafened === 'boolean') session.deafened = message.deafened;
        if (typeof message.speaking === 'boolean') session.speaking = message.speaking;
        const room = session.roomId ? rooms.get(session.roomId) : null;
        if (room) broadcast(room, { type: 'peer-updated', peer: toPresence(session) }, session.playerId);
        break;
      }

      case 'signal': {
        const target = sessions.get(cleanString(message.to));
        if (!target) {
          log(`dropping signal from ${session.username}: unknown peer`);
          return;
        }
        // Relay only. The server never looks inside the SDP; it just moves
        // opaque blobs between two peers. A production server would validate
        // size/rate here.
        send(target, { type: 'signal', from: session.playerId, data: message.data });
        break;
      }

      case 'pong':
        session.alive = true;
        break;

      default:
        send(session, { type: 'error', message: `Unknown message type: ${message.type}` });
        break;
    }
  };

  /* ------------------------------ lifecycle ------------------------------ */

  const handleClose = (socket, code, reason) => {
    const session = sessions.get(socket.playerId);
    // Ignore a close event from a socket that already lost a takeover race.
    if (!session || session.socket !== socket) return;

    session.socket = null;
    session.connectionState = 'disconnected';
    session.disconnectedAt = Date.now();
    session.lastSeen = Date.now();
    session.speaking = false;

    // The session and its room slot are deliberately kept (§13). Everyone else
    // sees them as "reconnecting", not as gone.
    const room = session.roomId ? rooms.get(session.roomId) : null;
    if (room) broadcast(room, { type: 'peer-updated', peer: toPresence(session) }, session.playerId);
    log(`${session.username} disconnected (${code}${reason ? ` ${reason}` : ''}) — keeping session for ${config.sessionTtlMs}ms`);
  };

  const sweep = () => {
    const now = Date.now();
    for (const session of [...sessions.values()]) {
      // Connected but silent: ping to detect half-open sockets.
      if (session.socket && session.socket.readyState === session.socket.OPEN) {
        if (session.alive === false) {
          log(`${session.username} failed heartbeat`);
          session.socket.terminate();
          continue;
        }
        session.alive = false;
        try {
          session.socket.ping();
        } catch {
          session.socket.terminate();
        }
        continue;
      }
      // Disconnected: is the session still worth keeping?
      if (session.connectionState === 'disconnected' && now - session.disconnectedAt > config.sessionTtlMs) {
        log(`${session.username}: session TTL expired, forgetting session`);
        dropSession(session, 'timeout');
      }
    }
    // Collect rooms that have been empty for a while, so memory does not grow
    // forever. A room is never deleted while it has members.
    for (const room of [...rooms.values()]) {
      if (room.emptySince && now - room.emptySince > config.roomTtlMs) {
        rooms.delete(room.roomId);
        log(`room collected: ${room.roomId}`);
      }
    }
  };

  /* ------------------------------ static files --------------------------- */

  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
  };

  const serveStatic = (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          rooms: [...rooms.values()].map((r) => ({ roomId: r.roomId, players: [...r.players] })),
          sessions: sessions.size,
        }),
      );
      return;
    }

    const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const resolved = path.resolve(config.clientDir, relative);

    // Path traversal guard: never serve anything outside the client directory.
    if (!resolved.startsWith(path.resolve(config.clientDir))) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.stat(resolved, (error, stats) => {
      const filePath = !error && stats.isDirectory() ? path.join(resolved, 'index.html') : resolved;
      fs.readFile(filePath, (readError, data) => {
        if (readError) {
          if (filePath.endsWith('favicon.ico')) {
            res.writeHead(204).end();
            return;
          }
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] ?? 'application/octet-stream' });
        res.end(data);
      });
    });
  };

  /* ------------------------------- the server ---------------------------- */

  const httpServer = http.createServer(serveStatic);
  // noServer + manual upgrade: one port for both the page and the socket.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (socket) => {
    socket.playerId = null;
    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Malformed JSON' }));
        return;
      }
      if (!message || typeof message.type !== 'string') {
        socket.send(JSON.stringify({ type: 'error', message: 'Missing message type' }));
        return;
      }
      try {
        handleMessage(socket, message);
      } catch (error) {
        log('message handler failed:', error);
        socket.send(JSON.stringify({ type: 'error', message: 'Server failed to handle message' }));
      }
    });

    socket.on('pong', () => {
      const session = sessions.get(socket.playerId);
      if (session) session.alive = true;
    });

    socket.on('close', (code, reason) => handleClose(socket, code, reason.toString()));
    socket.on('error', () => socket.terminate());
  });

  const sweeper = setInterval(sweep, config.sweepMs);
  sweeper.unref?.();

  return {
    httpServer,
    wss,
    config,
    /** Introspection for tests and debugging. */
    inspect: () => ({
      sessions: [...sessions.values()].map((s) => ({
        playerId: s.playerId,
        username: s.username,
        roomId: s.roomId,
        connectionState: s.connectionState,
      })),
      rooms: [...rooms.values()].map((r) => ({ roomId: r.roomId, players: [...r.players] })),
    }),
    async listen(port = config.port) {
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, () => {
          httpServer.off('error', reject);
          resolve();
        });
      });
      return httpServer.address().port;
    },
    async close() {
      clearInterval(sweeper);
      for (const socket of wss.clients) socket.terminate();
      await new Promise((resolve) => wss.close(resolve));
      // Keep-alive sockets from `fetch` would otherwise hold the HTTP server open.
      httpServer.closeAllConnections?.();
      await new Promise((resolve) => httpServer.close(resolve));
    },
  };
}

/* -------------------------------------------------------------------------- */
/* run directly: `npm start`                                                   */
/* -------------------------------------------------------------------------- */

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const server = createVoiceServer();
  const port = await server.listen();
  console.log(`Game Voice Chat running:`);
  console.log(`  page      http://localhost:${port}/`);
  console.log(`  signaling ws://localhost:${port}/ws`);
  console.log(`  rooms     ${DEFAULTS.rooms.join(', ')}`);
  console.log(`  session TTL ${DEFAULTS.sessionTtlMs}ms (disconnected players keep their room slot)`);
  console.log('Open the page in two different browsers (or use ?player=demoA / ?player=demoB) to hear it work.');

  const shutdown = async () => {
    console.log('\nShutting down…');
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default createVoiceServer;
