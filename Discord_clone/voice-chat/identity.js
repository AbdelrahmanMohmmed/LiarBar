/**
 * identity.js — "who is this player?"
 *
 * Two separate concerns live here, and keeping them separate is what makes the
 * future Google login (§24) a small change instead of a rewrite:
 *
 *   1. IdentityProvider  -> WHO the player is          (localStorage now, Google later)
 *   2. SessionStore      -> WHERE the player was last  (pure client-side recovery info)
 *
 * Both are behind tiny async interfaces so the rest of the app never touches
 * `localStorage` directly and never has to know which provider is in use.
 *
 * The golden rule from the spec (§12): this file is NOT the source of truth for
 * room membership. It only stores hints that let the client ask the server
 * "put me back where I was". The server decides whether that is allowed.
 */

export const STORAGE_KEYS = {
  playerId: 'playerId', // e.g. "player_8f72a91c"
  username: 'username', // e.g. "Player91c"
  lastVoiceRoom: 'lastVoiceRoom', // e.g. "lobby" — cleared on an intentional leave
};

/* -------------------------------------------------------------------------- */
/* storage helpers (private mode / disabled storage must not crash the app)   */
/* -------------------------------------------------------------------------- */

/** Returns a working Storage-like object, or an in-memory one as a fallback. */
function resolveStorage(storage) {
  const candidate = storage ?? globalThis.localStorage;
  try {
    const probeKey = '__voice_probe__';
    candidate.setItem(probeKey, '1');
    candidate.removeItem(probeKey);
    return candidate;
  } catch {
    return createMemoryStorage();
  }
}

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get length() {
      return map.size;
    },
  };
}

/** Cryptographically-random hex string, e.g. "8f72a91c". */
function randomHex(bytes = 4) {
  const buffer = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------------------- */
/* IdentityProvider interface                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Every provider implements:
 *
 *   provider                          -> string id, e.g. 'localStorage'
 *   isAvailable()                     -> boolean
 *   async load()                      -> { playerId, username, provider }
 *   async setUsername(username)       -> { playerId, username, provider }
 *   async reset()                     -> void      (new anonymous identity)
 *
 * The contract that matters: `load()` must return the SAME playerId for the same
 * browser across restarts (§3), which today means "read it from localStorage".
 */

/**
 * Method 1 (implemented): anonymous identity persisted in localStorage.
 * The playerId is generated once and then reused forever in this browser.
 */
export function createLocalStorageIdentity({ storage, playerIdFactory, overrides } = {}) {
  // `overrides` exists purely so two browser tabs can pretend to be two
  // different players while testing (see "Testing" in the README). When it is
  // used, nothing is written to the real localStorage.
  const store = overrides?.playerId ? createMemoryStorage() : resolveStorage(storage);
  const makePlayerId = playerIdFactory ?? (() => `player_${randomHex(4)}`);

  const readOrCreate = () => {
    if (overrides?.playerId) return overrides.playerId;
    let playerId = store.getItem(STORAGE_KEYS.playerId);
    if (!playerId) {
      playerId = makePlayerId();
      store.setItem(STORAGE_KEYS.playerId, playerId);
    }
    return playerId;
  };

  return {
    provider: 'localStorage',

    isAvailable() {
      return true;
    },

    async load() {
      const playerId = readOrCreate();
      if (overrides?.username) return { playerId, username: overrides.username, provider: 'localStorage' };
      let username = store.getItem(STORAGE_KEYS.username);
      if (!username) {
        username = `Player${playerId.slice(-4)}`;
        store.setItem(STORAGE_KEYS.username, username);
      }
      return { playerId, username, provider: 'localStorage' };
    },

    async setUsername(username) {
      const clean = String(username ?? '').trim().slice(0, 24) || 'Player';
      store.setItem(STORAGE_KEYS.username, clean);
      return { playerId: readOrCreate(), username: clean, provider: 'localStorage' };
    },

    async reset() {
      const playerId = makePlayerId();
      store.setItem(STORAGE_KEYS.playerId, playerId);
      store.setItem(STORAGE_KEYS.username, `Player${playerId.slice(-4)}`);
      return { playerId, username: store.getItem(STORAGE_KEYS.username), provider: 'localStorage' };
    },
  };
}

/**
 * Method 2 (NOT implemented, on purpose — §4 / §24).
 *
 * This is a placeholder that already satisfies the IdentityProvider interface,
 * so swapping it in later only means filling in the OAuth call and returning the
 * Google account id as `playerId`. Nothing in signaling.js / voice.js / app.js
 * has to change, because they only ever call `identity.load()`.
 *
 *   Google login -> Google account (sub) -> server verifies token -> playerId
 */
export function createGoogleIdentity() {
  const notImplemented = () => {
    throw new Error('GoogleIdentity is not implemented yet. See README "Future: Google login".');
  };
  return {
    provider: 'google',
    isAvailable: () => false,
    load: notImplemented,
    setUsername: notImplemented,
    reset: notImplemented,
  };
}

/** Factory used by the app. Swap the provider here later (or via config). */
export function createIdentityProvider(providerName = 'localStorage', options = {}) {
  switch (providerName) {
    case 'google':
      return createGoogleIdentity(options);
    case 'localStorage':
    default:
      return createLocalStorageIdentity(options);
  }
}

/* -------------------------------------------------------------------------- */
/* Client-side recovery info (NOT identity, NOT source of truth)               */
/* -------------------------------------------------------------------------- */

/**
 * Remembers the last voice room so the client can ask the server to restore it.
 * `clear()` is what makes the "intentional leave" test (Test E) pass: after
 * pressing Leave, the next startup must NOT auto-rejoin.
 */
export function createSessionStore({ storage } = {}) {
  const store = resolveStorage(storage);
  return {
    getLastRoom() {
      return store.getItem(STORAGE_KEYS.lastVoiceRoom) || null;
    },
    setLastRoom(roomId) {
      if (roomId) store.setItem(STORAGE_KEYS.lastVoiceRoom, String(roomId));
      else store.removeItem(STORAGE_KEYS.lastVoiceRoom);
    },
    clear() {
      store.removeItem(STORAGE_KEYS.lastVoiceRoom);
    },
    /** Everything stored is lightweight recovery data only. §20 */
    snapshot() {
      return {
        playerId: store.getItem(STORAGE_KEYS.playerId),
        username: store.getItem(STORAGE_KEYS.username),
        lastVoiceRoom: store.getItem(STORAGE_KEYS.lastVoiceRoom),
      };
    },
  };
}

/** Exported for tests / debugging. */
export const __internals = { randomHex, createMemoryStorage, resolveStorage };
