import { io, type Socket } from "socket.io-client";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

/**
 * Reconnection policy: keep trying forever.
 *
 * This used to cap at 10 attempts (~15s), which is less time than a phone
 * takes to switch from wifi to mobile data and back — so a player who
 * dropped for a minute came back to a dead app and a game going on without
 * them. The server keeps the room (and the seat) for minutes, so the client
 * has no good reason to stop before the room does. Exponential backoff with
 * a cap keeps the retries polite to the server.
 */
export const SOCKET_RECONNECT = {
  attempts: Infinity, // the room outlives the outage; so do we
  delay: 1000,
  maxDelay: 30_000,
  jitter: 0.2, // +/-20% so a roomful of clients doesn't retry in lockstep
} as const;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: SOCKET_RECONNECT.attempts,
      reconnectionDelay: SOCKET_RECONNECT.delay,
      reconnectionDelayMax: SOCKET_RECONNECT.maxDelay,
      randomizationFactor: SOCKET_RECONNECT.jitter,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
