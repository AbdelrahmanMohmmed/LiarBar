/**
 * app.js — orchestration and UI.
 *
 * This file owns the *policy* layer: which room the player wants to be in, when
 * to ask for the microphone, what the roster shows, and the startup recovery
 * flow from §10. The transport details live in signaling.js and voice.js.
 *
 *   Startup (§10)                    On Leave (§13)
 *   ----------------                 --------------
 *   read localStorage                clear lastVoiceRoom
 *   playerId exists? create/restore  close peer connections
 *   lastVoiceRoom exists?            stop the microphone
 *   AUTO_REJOIN? -> join that room   stay connected, just not in a room
 */

import { CONFIG } from './config.js';
import { createIdentityProvider, createSessionStore } from './identity.js';
import { SignalingClient, SignalingState } from './signaling.js';
import { VoiceClient } from './voice.js';

/** Coarse UI states. Individual players also have their own states (§8). */
const AppState = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  DISCONNECTED: 'DISCONNECTED',
};

const el = {
  usernameInput: document.getElementById('username-input'),
  playerId: document.getElementById('player-id'),
  banner: document.getElementById('banner'),
  roomList: document.getElementById('room-list'),
  roomSelect: document.getElementById('room-select'),
  joinBtn: document.getElementById('join-btn'),
  currentRoom: document.getElementById('current-room'),
  connectionBadge: document.getElementById('connection-badge'),
  reconnectInfo: document.getElementById('reconnect-info'),
  playerList: document.getElementById('player-list'),
  muteBtn: document.getElementById('mute-btn'),
  deafenBtn: document.getElementById('deafen-btn'),
  leaveBtn: document.getElementById('leave-btn'),
  log: document.getElementById('log'),
};

const state = {
  identity: null,
  sessionStore: null,
  signaling: null,
  voice: null,
  selfId: null,
  username: null,
  /** Room we asked to be in. Drives automatic rejoin after a socket drop. */
  desiredRoom: null,
  /** Room the server has actually confirmed us into. */
  activeRoom: null,
  appState: AppState.IDLE,
  rooms: [...CONFIG.DEFAULT_ROOMS],
  /** playerId -> server-side presence (the source of truth for membership). */
  presence: new Map(),
  reconnecting: null,
  joining: false,
};

/* -------------------------------------------------------------------------- */
/* logging + banners                                                           */
/* -------------------------------------------------------------------------- */

function log(message) {
  if (CONFIG.DEBUG) console.log('[voice]', message);
  const line = `${new Date().toLocaleTimeString()}  ${message}`;
  el.log.textContent = `${line}\n${el.log.textContent}`.split('\n').slice(0, 200).join('\n');
}

function showBanner(message) {
  el.banner.textContent = message;
  el.banner.hidden = false;
}

function clearBanner() {
  el.banner.hidden = true;
  el.banner.textContent = '';
}

function prettyRoom(roomId) {
  return roomId === 'lobby' ? 'Lobby' : roomId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/* startup (§10)                                                               */
/* -------------------------------------------------------------------------- */

async function init() {
  const params = new URLSearchParams(location.search);

  // Dev/test escape hatch: ?player=demoA&name=Demo%20A lets two tabs of the same
  // browser act as two different players (localStorage is shared between tabs).
  const devPlayer = params.get('player');
  const overrides = devPlayer
    ? { playerId: `player_${devPlayer}`, username: params.get('name') || `Player${devPlayer}` }
    : undefined;

  state.identity = createIdentityProvider('localStorage', { overrides });
  state.sessionStore = createSessionStore();

  // Step 1-2: read localStorage / create the persistent anonymous identity.
  const me = await state.identity.load();
  state.selfId = me.playerId;
  state.username = me.username;
  el.usernameInput.value = me.username;
  el.playerId.textContent = `${me.playerId} (${me.provider})`;

  state.signaling = new SignalingClient({
    url: params.get('server') || CONFIG.SIGNALING_URL,
    identity: state.identity,
    sessionStore: state.sessionStore,
    config: CONFIG,
    log,
  });
  state.voice = new VoiceClient({
    signaling: state.signaling,
    selfId: me.playerId,
    config: CONFIG,
    log,
  });

  wireSignaling();
  wireVoice();
  wireUi();
  render();

  // Step 3: is there a previous room to restore?
  const lastRoom = state.sessionStore.getLastRoom();
  if (lastRoom) {
    log(`Saved session found: playerId=${me.playerId}, lastVoiceRoom=${lastRoom}`);
    selectRoom(lastRoom);
  } else {
    log('No saved voice room — starting on the lobby screen');
  }

  // Step 4: connect to the signaling server. Done either way, so presence and
  // the room list work even before the player joins anything.
  state.signaling.connect();

  // Step 5: automatic room restoration (configurable, §10).
  if (lastRoom && CONFIG.AUTO_REJOIN) {
    await joinRoom(lastRoom, { automatic: true });
  } else if (params.get('room')) {
    // Testing aid: ?room=lobby joins straight away, no clicking required.
    await joinRoom(params.get('room'));
  }

  // A clean socket close on unload lets the server flag us as disconnected
  // immediately instead of waiting for its own heartbeat timeout. We do NOT
  // clear lastVoiceRoom here — that is what makes closing the browser
  // recoverable (§13).
  window.addEventListener('beforeunload', () => {
    state.signaling.disconnect();
    state.voice.stop();
  });

  if (CONFIG.DEBUG) {
    // Debug hook: handy in devtools, and used by the automated browser test in
    // server/test/webrtc.e2e.mjs to inspect the live state.
    window.__voice = { state, config: CONFIG, signaling: state.signaling, voice: state.voice, joinRoom, leaveRoom };
  }
}

/* -------------------------------------------------------------------------- */
/* signaling wiring                                                            */
/* -------------------------------------------------------------------------- */

function wireSignaling() {
  const { signaling } = state;

  signaling.on('state', ({ state: signalState }) => {
    if (signalState === SignalingState.CONNECTED) state.reconnecting = null;
    updateAppState();
    render();
  });

  signaling.on('welcome', ({ playerId, rooms }) => {
    state.selfId = playerId;
    state.voice.selfId = playerId;
    if (Array.isArray(rooms) && rooms.length) {
      state.rooms = rooms;
      render();
    }
  });

  signaling.on('rooms', (rooms) => {
    state.rooms = rooms;
    render();
  });

  // Authoritative membership: this is the message that rebuilds voice after a
  // browser close, a refresh, or a network drop.
  signaling.on('room-state', async ({ roomId, players }) => {
    state.activeRoom = roomId;
    state.presence = new Map(players.map((p) => [p.playerId, p]));
    updateAppState();
    log(`Joined room "${roomId}" — ${players.length} player(s) present`);
    const others = players.filter((p) => p.playerId !== state.selfId);
    await state.voice.syncPeers(others);
    render();
  });

  signaling.on('peer-joined', (peer) => {
    state.presence.set(peer.playerId, peer);
    log(`${peer.username} joined ${state.activeRoom}`);
    if (state.voice.active) state.voice.addPeer(peer);
    render();
  });

  signaling.on('peer-left', ({ playerId, reason }) => {
    const who = state.presence.get(playerId)?.username ?? playerId;
    state.presence.delete(playerId);
    // One peer leaving must never touch anyone else's connection (§11).
    if (state.voice.active) state.voice.removePeer(playerId);
    log(`${who} left (${reason ?? 'left'})`);
    render();
  });

  signaling.on('peer-updated', (peer) => {
    state.presence.set(peer.playerId, peer);
    state.voice.updatePeerProfile(peer);
    render();
  });

  signaling.on('signal', (payload) => state.voice.handleSignal(payload));

  signaling.on('reconnect-scheduled', ({ attempt, delay }) => {
    state.reconnecting = { attempt, delay };
    showBanner('Connection lost — trying to reconnect automatically.');
    updateAppState();
    render();
  });

  signaling.on('server-error', ({ message }) => showBanner(message));

  signaling.on('superseded', () => {
    state.voice.stop();
    state.presence.clear();
    state.activeRoom = null;
    updateAppState();
    showBanner('This player connected from another tab, so voice was stopped here.');
    render();
  });

  signaling.on('gave-up', () => {
    showBanner('Could not reach the voice server. Check that it is running, then reload.');
    render();
  });
}

/* -------------------------------------------------------------------------- */
/* voice wiring                                                                */
/* -------------------------------------------------------------------------- */

function wireVoice() {
  // Per-peer WebRTC state changes (CONNECTING / CONNECTED / DISCONNECTED / ...)
  state.voice.on('peers', () => render());

  // Local speaking detection. We update our own row immediately for snappy
  // feedback, and tell the server so everyone else can render the same badge.
  state.voice.on('speaking', (speaking) => {
    const mine = state.presence.get(state.selfId);
    if (mine) {
      mine.speaking = speaking;
      mine.connectionState = 'connected';
    }
    state.signaling.sendState({ speaking });
    render();
  });

  state.voice.on('local-state', () => render());
  state.voice.on('stopped', () => render());
}

/* -------------------------------------------------------------------------- */
/* UI wiring                                                                   */
/* -------------------------------------------------------------------------- */

function wireUi() {
  el.joinBtn.addEventListener('click', () => joinRoom(el.roomSelect.value));
  el.roomSelect.addEventListener('change', () => selectRoom(el.roomSelect.value));

  el.muteBtn.addEventListener('click', () => state.voice.setMuted(!state.voice.muted));
  el.deafenBtn.addEventListener('click', () => state.voice.setDeafened(!state.voice.deafened));

  el.leaveBtn.addEventListener('click', () => leaveRoom());

  el.usernameInput.addEventListener('change', async () => {
    const updated = await state.identity.setUsername(el.usernameInput.value);
    state.username = updated.username;
    el.usernameInput.value = updated.username;
    // Re-announcing is how the server learns the new name; it is the same
    // message the client sends after a reconnect.
    state.signaling.connect();
    log(`Username set to ${updated.username}`);
  });
}

/* -------------------------------------------------------------------------- */
/* actions                                                                     */
/* -------------------------------------------------------------------------- */

function selectRoom(roomId) {
  if (!roomId) return;
  if (!state.rooms.includes(roomId)) state.rooms.push(roomId);
  el.roomSelect.value = roomId;
  renderRooms();
}

/** Explicit user click on "Join Voice". */
async function joinRoom(roomId, { automatic = false } = {}) {
  if (!roomId || state.joining) return;
  state.joining = true;
  try {
    clearBanner();
    if (state.activeRoom === roomId) return;

    // Switching rooms is just "leave, then join" from the server's perspective.
    if (state.activeRoom && state.activeRoom !== roomId) {
      state.signaling.leave();
      state.voice.stop();
      state.presence.clear();
      state.activeRoom = null;
    }

    // §20: the microphone is requested only when the player asks for voice,
    // never on page load.
    if (!state.voice.active) {
      log('Requesting microphone…');
      await state.voice.start();
      log('Microphone ready');
    }

    state.desiredRoom = roomId;
    // join() persists lastVoiceRoom, connects the socket if needed, and asks
    // the server to put us in the room.
    state.signaling.join(roomId);
    if (automatic) log(`Auto-rejoined ${roomId} from the previous session`);
  } catch (error) {
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    const missing = error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError';
    const message = denied
      ? 'Microphone permission was denied. Allow it in the browser, then press Join Voice again.'
      : missing
        ? 'No microphone was found. Voice chat needs an input device.'
        : `Could not start voice: ${error.message}`;
    showBanner(message);
    log(message);
    state.voice.stop();
  } finally {
    state.joining = false;
    updateAppState();
    render();
  }
}

/** Intentional leave (§13, Test E). */
function leaveRoom() {
  const room = state.activeRoom;
  log(`Leaving ${room ?? 'voice'} intentionally — clearing saved room so we do not auto-rejoin`);
  state.signaling.leave(); // clears localStorage lastVoiceRoom
  state.voice.stop(); // closes peer connections and releases the microphone
  state.desiredRoom = null;
  state.activeRoom = null;
  state.presence.clear();
  state.reconnecting = null;
  clearBanner();
  updateAppState();
  render();
}

/* -------------------------------------------------------------------------- */
/* rendering                                                                   */
/* -------------------------------------------------------------------------- */

function updateAppState() {
  const signalState = state.signaling?.state ?? SignalingState.IDLE;
  if (signalState === SignalingState.CONNECTED) {
    state.appState = state.activeRoom ? AppState.CONNECTED : AppState.IDLE;
  } else if (signalState === SignalingState.RECONNECTING) {
    state.appState = AppState.RECONNECTING;
  } else if (signalState === SignalingState.CONNECTING) {
    state.appState = AppState.CONNECTING;
  } else if (signalState === SignalingState.IDLE) {
    state.appState = AppState.IDLE;
  } else {
    state.appState = AppState.DISCONNECTED;
  }
}

function render() {
  el.connectionBadge.textContent = state.appState;
  el.connectionBadge.className = `state-badge ${state.appState}`;

  el.reconnectInfo.textContent = state.reconnecting
    ? `retrying in ${(state.reconnecting.delay / 1000).toFixed(1)}s (attempt ${state.reconnecting.attempt})`
    : '';

  el.currentRoom.textContent = state.activeRoom ? `🔊 ${prettyRoom(state.activeRoom)}` : 'Not connected';

  renderRooms();
  renderPlayers();
  renderControls();
}

function renderRooms() {
  el.roomList.innerHTML = '';
  for (const roomId of state.rooms) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = `room-btn${roomId === state.activeRoom ? ' active' : ''}`;
    const count = roomId === state.activeRoom ? state.presence.size : 0;
    button.textContent = `${roomId === state.activeRoom ? '🔊' : '🔈'} ${prettyRoom(roomId)}${
      count ? ` (${count})` : ''
    }`;
    button.addEventListener('click', () => {
      selectRoom(roomId);
      joinRoom(roomId);
    });
    li.appendChild(button);
    el.roomList.appendChild(li);
  }

  const selected = el.roomSelect.value;
  el.roomSelect.innerHTML = '';
  for (const roomId of state.rooms) {
    const option = document.createElement('option');
    option.value = roomId;
    option.textContent = prettyRoom(roomId);
    el.roomSelect.appendChild(option);
  }
  el.roomSelect.value = state.rooms.includes(selected) ? selected : state.rooms[0];
}

/**
 * The roster merges two independent sources:
 *   - server presence  (who the server believes is in the room)   -> membership
 *   - WebRTC peer states (who we actually have an audio path to)  -> audio
 * They are shown side by side on purpose: a player can be "in the room" while
 * their audio link is still CONNECTING after a reconnect (§11).
 */
function renderPlayers() {
  el.playerList.innerHTML = '';

  const peerStates = new Map(state.voice.getPeerStates().map((p) => [p.playerId, p]));
  const rows = [];

  for (const presence of state.presence.values()) {
    rows.push({ presence, webrtc: peerStates.get(presence.playerId) });
    peerStates.delete(presence.playerId);
  }
  // Peers we still hold a connection to but that the server already dropped.
  for (const webrtc of peerStates.values()) {
    rows.push({ presence: { playerId: webrtc.playerId, username: webrtc.username }, webrtc });
  }

  rows.sort((a, b) => {
    if (a.presence.playerId === state.selfId) return -1;
    if (b.presence.playerId === state.selfId) return 1;
    return String(a.presence.username ?? a.presence.playerId).localeCompare(
      String(b.presence.username ?? b.presence.playerId),
    );
  });

  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'player muted';
    li.textContent = 'No one is in this voice room yet.';
    el.playerList.appendChild(li);
    return;
  }

  for (const row of rows) {
    el.playerList.appendChild(renderPlayerRow(row));
  }
}

function renderPlayerRow({ presence, webrtc }) {
  const isSelf = presence.playerId === state.selfId;
  const connected = (presence.connectionState ?? 'connected') === 'connected';
  const speaking = Boolean(presence.speaking) && !presence.muted;

  const li = document.createElement('li');
  li.className = `player${speaking ? ' speaking' : ''}${isSelf ? ' self' : ''}`;

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.textContent = connected ? '🟢' : '🟡';
  li.appendChild(dot);

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = `${presence.username ?? presence.playerId}${isSelf ? ' (you)' : ''}`;
  li.appendChild(name);

  const tags = document.createElement('span');
  tags.className = 'tags';

  if (speaking) tags.appendChild(tag('🎤 Speaking', 'tag-speaking'));
  if (!connected) tags.appendChild(tag('Reconnecting…', 'tag-warn'));
  if (webrtc && webrtc.state !== 'CONNECTED') {
    tags.appendChild(tag(webrtc.state.toLowerCase(), webrtc.state === 'FAILED' ? 'tag-bad' : 'tag-warn'));
  }
  tags.appendChild(tag(presence.muted ? '🔇' : '🎤', ''));
  if (presence.deafened) tags.appendChild(tag('🔇 deafened', 'tag-warn'));
  li.appendChild(tags);

  return li;
}

function tag(text, className) {
  const span = document.createElement('span');
  if (className) span.className = className;
  span.textContent = text;
  return span;
}

function renderControls() {
  const inVoice = Boolean(state.activeRoom) && state.voice.active;
  el.muteBtn.disabled = !inVoice;
  el.deafenBtn.disabled = !inVoice;
  el.leaveBtn.disabled = !inVoice;

  el.muteBtn.textContent = `🎤 ${state.voice.muted ? 'Unmute' : 'Mute'}`;
  el.muteBtn.className = state.voice.muted ? 'on' : '';
  el.deafenBtn.textContent = `🔊 ${state.voice.deafened ? 'Undeafen' : 'Deafen'}`;
  el.deafenBtn.className = state.voice.deafened ? 'on' : '';

  // Nothing to do if we are already sitting in the selected room.
  el.joinBtn.disabled = state.joining || (Boolean(state.activeRoom) && state.activeRoom === el.roomSelect.value);
}

init().catch((error) => {
  console.error(error);
  showBanner(`Startup failed: ${error.message}`);
});
