/**
 * config.js — single place for every tunable knob.
 *
 * Nothing in here talks to the network; it is imported by app.js, signaling.js
 * and voice.js so that all of them read the same numbers.
 */

const isSecure = globalThis.location?.protocol === 'https:';

export const CONFIG = {
  /**
   * Where the signaling server lives.
   * Served by server/server.js, so same host + same port as the page.
   * Production note: this must be wss:// (HTTPS page) — see README "Security".
   */
  SIGNALING_URL:
    (globalThis.VOICE_SIGNALING_URL ?? null) ||
    (isSecure ? 'wss://' : 'ws://') + (globalThis.location?.host ?? 'localhost:8080') + '/ws',

  /**
   * §10 of the spec: should opening the app automatically drop you back into
   * the room you were in last time? Set to false to always start on the lobby
   * screen while keeping the "last room" value in the picker.
   */
  AUTO_REJOIN: true,

  /** Fallback list shown before the server announces its own room list. */
  DEFAULT_ROOMS: ['lobby', 'room-1', 'room-2'],

  /** Socket reconnect policy (exponential backoff with jitter). §9 */
  RECONNECT: {
    baseDelayMs: 1000, // 1s
    factor: 2, // 1s, 2s, 4s, 8s ...
    maxDelayMs: 30000, // cap so we never wait forever or hammer the server
    jitterRatio: 0.2, // +/-20% so many clients do not retry in lockstep
    maxAttempts: Infinity, // keep trying forever by default
  },

  /** Speaking detection (RMS threshold with hysteresis). §16 */
  SPEAKING: {
    threshold: 0.03, // RMS above this => started speaking
    releaseThreshold: 0.018, // RMS below this => stopped speaking
    minChangeIntervalMs: 250, // <= 4 presence updates/second
    pollIntervalMs: 100,
  },

  /**
   * STUN lets two players behind home routers discover each other's public
   * address. No STUN/TURN is required when testing two browser tabs on the
   * same machine (host candidates are enough).
   *
   * Prototype limitation: symmetric NATs and corporate firewalls need a TURN
   * relay to carry the media. Add one in ICE_SERVERS before testing over the
   * open internet — see README "WebRTC in the real world".
   */
  ICE_SERVERS: [{ urls: 'stun:stun.l.google.com:19302' }],

  /** WebRTC peer connection recovery. §19 */
  ICE: {
    disconnectedGraceMs: 3000, // give "disconnected" a chance before acting
    maxRestartAttempts: 3,
    restartBackoffMs: 2000,
  },

  /** How long the UI keeps showing a peer that dropped before giving up. */
  PRESENCE_FADE_MS: 1000,

  /** Verbose logging to the on-page event log + console. */
  DEBUG: true,
};

export default CONFIG;
