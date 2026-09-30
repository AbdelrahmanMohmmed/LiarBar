/**
 * signaling.js — the WebSocket client, and the reconnection state machine.
 *
 * What the signaling server is for (§5):
 *   - presence / room membership (who is in the room right now)
 *   - SDP offers + answers and ICE candidates ("signaling")
 *   - telling the client when a peer appears/disappears so WebRTC can be rebuilt
 *
 * What it is NOT for: audio. Audio never travels through this socket; it goes
 * peer-to-peer over WebRTC (see voice.js). This socket only carries control
 * messages, which is why a tiny JSON relay is enough for the prototype.
 *
 * The class below owns the *transport* resilience (reopen the socket, restore
 * whatever room we asked to be in). It deliberately does NOT own the policy
 * decision "should we auto-rejoin at startup" — that is CONFIG.AUTO_REJOIN in
 * app.js (§10).
 */

import { CONFIG } from './config.js';

/** Connection states used by both this client and the UI (§8). */
export const SignalingState = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  DISCONNECTED: 'DISCONNECTED',
};

/** Close code the server uses when another tab/session takes over this player. */
export const CLOSE_SUPERSEDED = 4000;

/** Tiny event emitter — shared by signaling.js, voice.js and app.js. */
export class Emitter {
  #handlers = new Map();

  on(event, handler) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this.#handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    for (const handler of this.#handlers.get(event) ?? []) {
      try {
        handler(payload);
      } catch (error) {
        // One broken listener must not stop the others.
        console.error(`[signaling] listener for "${event}" threw`, error);
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Message protocol (client -> server)                                        */
/* -------------------------------------------------------------------------- */
export const ClientMessage = {
  hello: 'hello', // { playerId, username }             -> server replies `welcome`
  join: 'join', // { roomId }                          -> server replies `room-state`
  leave: 'leave', // {}                                 -> intentional leave
  state: 'state', // { muted, deafened, speaking }      -> presence update
  signal: 'signal', // { to, data }                     -> relayed to one peer
  pong: 'pong', // {}                                 -> answer to server `ping`
};

/* Message protocol (server -> client) — handled in _handleMessage(). */
// welcome, rooms, room-state, peer-joined, peer-left, peer-updated, signal, error, ping

export class SignalingClient extends Emitter {
  #socket = null;
  #attempt = 0;
  #reconnectTimer = null;
  #intentRoom = null;
  #closedByUser = false;
  #identity = null;
  /** True once this connection has sent `hello`; anything else must wait. */
  #ready = false;
  #outbox = [];

  /**
   * @param {object} options
   * @param {string} options.url            ws:// or wss:// signaling endpoint
   * @param {object} options.identity       IdentityProvider (identity.js)
   * @param {object} options.sessionStore   SessionStore (identity.js)
   * @param {object} [options.config]       defaults to shared CONFIG
   * @param {(msg: string) => void} [options.log]
   */
  constructor({ url, identity, sessionStore, config = CONFIG, log = () => {} }) {
    super();
    this.url = url;
    // Deliberately private: `hello` must be announced from the identity
    // provider, never from something a caller can accidentally overwrite.
    this.#identity = identity;
    this.sessionStore = sessionStore;
    this.config = config;
    this.log = log;
    this.state = SignalingState.IDLE;
    this.selfId = null;
  }

  /** Stable public accessor: the room we want to be in (or null). */
  get intendedRoom() {
    return this.#intentRoom;
  }

  get isOpen() {
    return this.#socket?.readyState === WebSocket.OPEN;
  }

  /* ---------------------------------------------------------------------- */
  /* connection lifecycle                                                    */
  /* ---------------------------------------------------------------------- */

  /** Opens the socket. Safe to call when already connected (it re-announces). */
  connect() {
    this.#closedByUser = false;
    if (this.isOpen) {
      this._announce();
      return;
    }
    if (this.#socket && this.#socket.readyState === WebSocket.CONNECTING) return;

    this._setState(this.#attempt > 0 ? SignalingState.RECONNECTING : SignalingState.CONNECTING);

    let socket;
    try {
      socket = new WebSocket(this.url);
    } catch (error) {
      this.log(`Signaling URL rejected: ${error.message}`);
      this._scheduleReconnect();
      return;
    }
    this.#socket = socket;

    socket.addEventListener('open', async () => {
      this.#attempt = 0;
      this.#ready = false;
      this._setState(SignalingState.CONNECTED);
      this.log('Signaling socket open');
      // `hello` must be the first message on every new socket: it is what
      // creates (or re-adopts) our server-side session. Everything else waits
      // in the outbox until it has been sent.
      await this._announce();
      // Restore the room we were in before the socket dropped, if any.
      if (this.#intentRoom) this._send(ClientMessage.join, { roomId: this.#intentRoom });
      this._flushOutbox();
      this.emit('open');
    });

    socket.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        this.log('Ignoring malformed signaling frame');
        return;
      }
      this._handleMessage(message);
    });

    socket.addEventListener('close', (event) => {
      this.#socket = null;
      this.#ready = false;
      this.#outbox.length = 0;
      if (this.#closedByUser) {
        this._setState(SignalingState.DISCONNECTED);
        return;
      }
      if (event.code === CLOSE_SUPERSEDED) {
        // Another tab took over this playerId. Reconnecting would fight it forever.
        this.#closedByUser = true;
        this._setState(SignalingState.DISCONNECTED);
        this.log('Session taken over by another connection');
        this.emit('superseded');
        return;
      }
      this.log(`Signaling socket closed (${event.code}${event.reason ? ` ${event.reason}` : ''})`);
      this.emit('close', event);
      this._scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // 'close' always follows, so reconnection is handled there.
      this.emit('error', { message: 'Signaling socket error' });
    });
  }

  /** Closes the socket for good (page unload, or explicit shutdown). */
  disconnect() {
    this.#closedByUser = true;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    this.#attempt = 0;
    this.#socket?.close(1000, 'client shutdown');
    this.#socket = null;
    this._setState(SignalingState.DISCONNECTED);
  }

  /* ---------------------------------------------------------------------- */
  /* room operations                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * Join a room. The room id is remembered in two places on purpose:
   *   - #intentRoom  : in-memory, survives a socket drop  -> automatic rejoin
   *   - sessionStore : localStorage, survives a page close -> auto-rejoin at startup
   */
  join(roomId) {
    this.#intentRoom = roomId;
    this.sessionStore?.setLastRoom(roomId);
    this.connect();
    if (this.isOpen) this._send(ClientMessage.join, { roomId });
    return roomId;
  }

  /**
   * Intentional leave (§13). This is the difference between "my connection
   * broke" and "I chose to go": we drop the remembered room so the next startup
   * does not drag the player back in (Test E), and keep the identity intact.
   */
  leave() {
    if (this.isOpen) this._send(ClientMessage.leave, {});
    this.#intentRoom = null;
    this.sessionStore?.clear();
  }

  /** Presence update: mute/deafen/speaking (§8). */
  sendState(patch) {
    if (this.isOpen) this._send(ClientMessage.state, patch);
  }

  /** Relay one WebRTC offer/answer/candidate to a specific peer. */
  sendSignal(to, data) {
    if (this.isOpen) this._send(ClientMessage.signal, { to, data });
  }

  /* ---------------------------------------------------------------------- */
  /* internals                                                               */
  /* ---------------------------------------------------------------------- */

  async _announce() {
    if (!this.#identity) return;
    const identity = await this.#identity.load();
    this.selfId = identity.playerId;
    this.#ready = true;
    this._send(ClientMessage.hello, { playerId: identity.playerId, username: identity.username });
    this._flushOutbox();
  }

  /**
   * Sends a message, or holds it back while the `hello` handshake is still in
   * flight. Without this, a join() issued right after connect() would reach the
   * server before the message that identifies us, and the server would (quite
   * correctly) answer "Send hello first".
   */
  _send(type, payload = {}) {
    if (!this.isOpen) return false;
    if (!this.#ready && type !== ClientMessage.hello) {
      this.#outbox.push({ type, payload });
      return false;
    }
    this.#socket.send(JSON.stringify({ type, ...payload }));
    return true;
  }

  _flushOutbox() {
    if (!this.isOpen || !this.#ready) return;
    const queued = this.#outbox.splice(0);
    for (const message of queued) this._send(message.type, message.payload);
  }

  _handleMessage(message) {
    switch (message.type) {
      case 'welcome':
        this.selfId = message.playerId;
        this.emit('welcome', message);
        break;
      case 'rooms':
        this.emit('rooms', message.rooms);
        break;
      case 'room-state':
        // Authoritative membership list for the room, sent on every join so a
        // reconnecting client can rebuild its WebRTC mesh from scratch.
        this.emit('room-state', message);
        break;
      case 'peer-joined':
        this.emit('peer-joined', message.peer);
        break;
      case 'peer-left':
        this.emit('peer-left', message);
        break;
      case 'peer-updated':
        this.emit('peer-updated', message.peer);
        break;
      case 'signal':
        this.emit('signal', { from: message.from, data: message.data });
        break;
      case 'error':
        this.log(`Server error: ${message.message}`);
        this.emit('server-error', message);
        break;
      case 'ping':
        this._send(ClientMessage.pong, {});
        break;
      default:
        break;
    }
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('state', { state });
  }

  /** Exponential backoff with jitter: 1s, 2s, 4s, 8s ... capped (§9). */
  _nextDelay() {
    const { baseDelayMs, factor, maxDelayMs, jitterRatio } = this.config.RECONNECT;
    const raw = Math.min(baseDelayMs * factor ** this.#attempt, maxDelayMs);
    const jitter = raw * jitterRatio * (Math.random() * 2 - 1);
    return Math.round(Math.max(0, raw + jitter));
  }

  _scheduleReconnect() {
    const { maxAttempts } = this.config.RECONNECT;
    if (this.#attempt >= maxAttempts) {
      this._setState(SignalingState.DISCONNECTED);
      this.log('Giving up on signaling reconnect');
      this.emit('gave-up');
      return;
    }
    const delay = this._nextDelay();
    this.#attempt += 1;
    this._setState(SignalingState.RECONNECTING);
    this.log(`Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.#attempt})`);
    this.emit('reconnect-scheduled', { attempt: this.#attempt, delay });
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = setTimeout(() => {
      // Browsers fire 'online' but may still have no route; the connect()
      // attempt just fails again and the backoff grows. That is the intended
      // "retry -> wait -> retry" loop from §9.
      this.connect();
    }, delay);
  }
}

export default SignalingClient;
