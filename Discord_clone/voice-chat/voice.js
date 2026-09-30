/**
 * voice.js — the actual audio plane.
 *
 * Responsibilities:
 *   - getUserMedia() -> a local microphone MediaStream                 (§15)
 *   - one RTCPeerConnection per remote player (a full mesh)            (§5, §14)
 *   - mute / deafen without tearing down connections                   (§17, §18)
 *   - monitor connectionState / iceConnectionState and recover         (§19)
 *   - simple volume-based speaking detection                           (§16)
 *
 * Mesh topology (everyone connects to everyone) is the right choice for a
 * prototype, and it is exactly the design the future SFU replaces: when the
 * room grows past ~5 people, the browser stops creating a peer connection per
 * player and instead sends one upstream to an SFU. See README "Future:
 * SFU-based scaling".
 *
 * Everything here is transport-only: VoiceClient never talks to the WebSocket
 * directly, it asks the SignalingClient to relay offers/answers/candidates.
 */

import { CONFIG } from './config.js';
import { Emitter } from './signaling.js';

/** Per-peer lifecycle state, mirrored into the UI. §8 */
export const PeerState = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  FAILED: 'FAILED',
  CLOSED: 'CLOSED',
};

/**
 * Deterministic offerer election.
 *
 * Both sides learn about each other at (almost) the same moment, so if both
 * created an offer we would get "glare" and have to implement perfect-negotiation
 * rollback. Comparing ids is a one-line rule with the same effect: the lower id
 * offers, the higher id answers. Stable across reconnects, because playerId is.
 */
function isOfferer(selfId, peerId) {
  return String(selfId) < String(peerId);
}

/* -------------------------------------------------------------------------- */
/* Peer connection wrapper                                                     */
/* -------------------------------------------------------------------------- */

class PeerConnection {
  constructor({ peer, selfId, signaling, config, log, onStateChange, onRemoteStream }) {
    this.peerId = peer.playerId;
    this.username = peer.username ?? peer.playerId;
    this.selfId = selfId;
    this.signaling = signaling;
    this.config = config;
    this.log = log;
    this.onStateChange = onStateChange;
    this.onRemoteStream = onRemoteStream;

    this.state = PeerState.CONNECTING;
    this.offerer = isOfferer(selfId, peer.playerId);
    this.pendingCandidates = [];
    this.restartAttempts = 0;
    this.disconnectedTimer = null;

    this.pc = new RTCPeerConnection({ iceServers: config.ICE_SERVERS ?? [] });
    this._wireEvents();
  }

  _wireEvents() {
    const { pc } = this;

    pc.addEventListener('icecandidate', (event) => {
      // Trickle ICE: forward each candidate as soon as it is gathered.
      if (event.candidate) {
        this.signaling.sendSignal(this.peerId, {
          type: 'candidate',
          candidate: event.candidate.toJSON?.() ?? event.candidate,
        });
      } else {
        this.log(`ICE gathering finished for ${this.username}`);
      }
    });

    pc.addEventListener('track', (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.onRemoteStream(this.peerId, stream);
    });

    pc.addEventListener('connectionstatechange', () => {
      this._syncState(pc.connectionState);
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      this.log(`ICE ${this.username}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') this._recover('ice-failed');
    });
  }

  /** Attach our microphone track(s) to this peer. Call once, after start(). */
  addLocalStream(stream) {
    for (const track of stream.getAudioTracks()) {
      const existing = this.pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (existing) existing.replaceTrack(track);
      else this.pc.addTrack(track, stream);
    }
  }

  /** The offerer creates and sends the first offer for a brand new peer. */
  async negotiate() {
    if (!this.offerer) return;
    try {
      await this.pc.setLocalDescription(await this.pc.createOffer());
      this.signaling.sendSignal(this.peerId, { type: 'offer', sdp: this.pc.localDescription });
    } catch (error) {
      this.log(`Failed to create offer for ${this.username}: ${error.message}`);
    }
  }

  /** Handle an inbound relayed message from this peer. */
  async handleSignal(data) {
    const { pc } = this;
    try {
      switch (data.type) {
        case 'offer': {
          await pc.setRemoteDescription(data.sdp);
          await this._flushCandidates();
          await pc.setLocalDescription(await pc.createAnswer());
          this.signaling.sendSignal(this.peerId, { type: 'answer', sdp: pc.localDescription });
          break;
        }
        case 'answer': {
          // Ignore answers we did not ask for (stale offers after an ICE restart).
          if (pc.signalingState !== 'have-local-offer') {
            this.log(`Ignoring unexpected answer from ${this.username}`);
            return;
          }
          await pc.setRemoteDescription(data.sdp);
          await this._flushCandidates();
          break;
        }
        case 'candidate': {
          if (!pc.remoteDescription) {
            // Candidates routinely arrive before the description they belong to.
            this.pendingCandidates.push(data.candidate);
          } else {
            await pc.addIceCandidate(data.candidate);
          }
          break;
        }
        case 'ice-restart-request': {
          // The answerer noticed trouble; only the offerer may start an ICE restart.
          if (this.offerer) this._restartIce();
          break;
        }
        default:
          break;
      }
    } catch (error) {
      this.log(`Signaling for ${this.username} failed: ${error.message}`);
    }
  }

  async _flushCandidates() {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (error) {
        this.log(`Dropped stale candidate for ${this.username}: ${error.message}`);
      }
    }
  }

  _syncState(connectionState) {
    const mapped = {
      new: PeerState.CONNECTING,
      connecting: PeerState.CONNECTING,
      connected: PeerState.CONNECTED,
      disconnected: PeerState.DISCONNECTED,
      failed: PeerState.FAILED,
      closed: PeerState.CLOSED,
    }[connectionState];

    if (!mapped || mapped === this.state) return;
    this.state = mapped;
    if (mapped === PeerState.CONNECTED) this.restartAttempts = 0;
    this.onStateChange(this);

    // "disconnected" is often a transient blip (Wi-Fi handover, brief packet
    // loss). Wait a moment before treating it as a real problem. §19
    if (mapped === PeerState.DISCONNECTED) {
      clearTimeout(this.disconnectedTimer);
      this.disconnectedTimer = setTimeout(() => {
        if (this.state === PeerState.DISCONNECTED) this._recover('disconnected-timeout');
      }, this.config.ICE.disconnectedGraceMs);
    } else {
      clearTimeout(this.disconnectedTimer);
    }
  }

  _recover(reason) {
    if (this.state === PeerState.CLOSED) return;
    const { maxRestartAttempts, restartBackoffMs } = this.config.ICE;
    if (this.restartAttempts >= maxRestartAttempts) {
      this.log(`Giving up on ${this.username} after ${this.restartAttempts} ICE restarts`);
      this.state = PeerState.FAILED;
      this.onStateChange(this);
      return;
    }
    this.restartAttempts += 1;
    this.log(`Recovering ${this.username} (${reason}, attempt ${this.restartAttempts})`);
    // Do not recreate the whole connection: an ICE restart re-gathers candidates
    // and renegotiates on the SAME peer connection, which keeps the audio
    // pipeline (and the peer identity) intact.
    queueMicrotask(() => this._restartIce());
  }

  async _restartIce() {
    if (this.state === PeerState.CLOSED) return;
    try {
      if (this.offerer) {
        if (typeof this.pc.restartIce === 'function') this.pc.restartIce();
        await this.pc.setLocalDescription(await this.pc.createOffer({ iceRestart: true }));
        this.signaling.sendSignal(this.peerId, { type: 'offer', sdp: this.pc.localDescription });
      } else {
        // The answerer cannot restart ICE alone, so it asks the offerer to.
        this.signaling.sendSignal(this.peerId, { type: 'ice-restart-request' });
      }
    } catch (error) {
      this.log(`ICE restart for ${this.username} failed: ${error.message}`);
    }
  }

  close() {
    clearTimeout(this.disconnectedTimer);
    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
    this.state = PeerState.CLOSED;
  }
}

/* -------------------------------------------------------------------------- */
/* Speaking detection (§16)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cheap RMS loudness meter over the local microphone stream.
 * Uses hysteresis (a higher threshold to start, a lower one to stop) so a
 * player hovering around the threshold does not flicker on and off.
 */
class SpeakingDetector {
  #context = null;
  #analyser = null;
  #buffer = null;
  #timer = null;

  constructor({ stream, config, onChange, log }) {
    this.stream = stream;
    this.config = config;
    this.onChange = onChange;
    this.log = log;
    this.speaking = false;
    this.lastChangeAt = 0;
  }

  start() {
    if (!this.stream?.getAudioTracks().length) return;
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) {
      this.log('Web Audio API unavailable — speaking indicator disabled');
      return;
    }
    this.#context = new AudioContextCtor();
    if (this.#context.state === 'suspended') this.#context.resume().catch(() => {});

    const source = this.#context.createMediaStreamSource(this.stream);
    this.#analyser = this.#context.createAnalyser();
    this.#analyser.fftSize = 512;
    this.#buffer = new Float32Array(this.#analyser.fftSize);
    source.connect(this.#analyser);

    this.#timer = setInterval(() => this.#tick(), this.config.SPEAKING.pollIntervalMs);
  }

  #tick() {
    this.#analyser.getFloatTimeDomainData(this.#buffer);
    let sum = 0;
    for (let i = 0; i < this.#buffer.length; i += 1) sum += this.#buffer[i] * this.#buffer[i];
    const rms = Math.sqrt(sum / this.#buffer.length);
    const { threshold, releaseThreshold, minChangeIntervalMs } = this.config.SPEAKING;

    const next = this.speaking ? rms > releaseThreshold : rms > threshold;
    if (next === this.speaking) return;

    const now = Date.now();
    if (now - this.lastChangeAt < minChangeIntervalMs) return;
    this.lastChangeAt = now;
    this.speaking = next;
    this.onChange(next);
  }

  /** While muted we must report "not speaking" immediately. */
  forceSilent() {
    if (!this.speaking) return;
    this.speaking = false;
    this.lastChangeAt = Date.now();
    this.onChange(false);
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
    this.#context?.close().catch(() => {});
    this.#context = null;
  }
}

/* -------------------------------------------------------------------------- */
/* VoiceClient                                                                 */
/* -------------------------------------------------------------------------- */

export class VoiceClient extends Emitter {
  #peers = new Map(); // playerId -> PeerConnection
  #audioElements = new Map(); // playerId -> HTMLAudioElement
  #detector = null;

  constructor({ signaling, selfId, config = CONFIG, log = () => {} }) {
    super();
    this.signaling = signaling;
    this.selfId = selfId;
    this.config = config;
    this.log = log;
    this.localStream = null;
    this.muted = false;
    this.deafened = false;
  }

  get active() {
    return Boolean(this.localStream);
  }

  /**
   * Ask for the microphone and start the audio pipeline.
   * Called only on an explicit "Join Voice" click — permission prompts should
   * never appear on page load (§20).
   */
  async start() {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false, // voice only (§15)
    });
    // Never upload/store recordings: the stream stays in memory only. §20
    this.#detector = new SpeakingDetector({
      stream: this.localStream,
      config: this.config,
      log: this.log,
      onChange: (speaking) => this.emit('speaking', speaking),
    });
    this.#detector.start();

    // Mute state can be toggled before the microphone existed; re-apply it.
    this._applyMuteToTracks();
    this.emit('local-stream', this.localStream);
    return this.localStream;
  }

  /**
   * Reconcile the mesh against the authoritative room list from the server.
   * Called on every `room-state`, which is what makes "close the browser, come
   * back, voice works again" work: the client does not try to resume old
   * connections (impossible), it rebuilds the mesh from the current roster. §11
   */
  async syncPeers(peers) {
    const wanted = new Set(peers.map((p) => p.playerId));
    for (const playerId of [...this.#peers.keys()]) {
      if (!wanted.has(playerId)) this.removePeer(playerId);
    }
    for (const peer of peers) {
      if (peer.playerId === this.selfId) continue;
      const entry = this.#ensurePeer(peer);
      // A brand-new connection is offered by whichever side has the lower id.
      // (The other side has never seen this peer, so nobody else offers.)
      if (!entry.pc.currentRemoteDescription && !entry.pc.localDescription) await entry.negotiate();
    }
    this.emit('peers', this.getPeerStates());
  }

  addPeer(peer) {
    if (peer.playerId === this.selfId) return null;
    const entry = this.#ensurePeer(peer);
    entry.negotiate();
    this.emit('peers', this.getPeerStates());
    return entry;
  }

  removePeer(playerId) {
    const entry = this.#peers.get(playerId);
    if (!entry) return;
    entry.close();
    this.#peers.delete(playerId);
    this.#teardownAudioElement(playerId);
    this.log(`Closed voice connection to ${entry.username}`);
    this.emit('peers', this.getPeerStates());
  }

  /** Relay an inbound signal from signaling.js to the right peer connection. */
  async handleSignal({ from, data }) {
    const entry = this.#ensurePeer({ playerId: from, username: from });
    await entry.handleSignal(data);
    this.emit('peers', this.getPeerStates());
  }

  updatePeerProfile(peer) {
    const entry = this.#peers.get(peer.playerId);
    if (entry && peer.username) entry.username = peer.username;
  }

  #ensurePeer(peer) {
    let entry = this.#peers.get(peer.playerId);
    if (!entry) {
      entry = new PeerConnection({
        peer,
        selfId: this.selfId,
        signaling: this.signaling,
        config: this.config,
        log: this.log,
        onStateChange: () => this.emit('peers', this.getPeerStates()),
        onRemoteStream: (playerId, stream) => this.#attachRemoteAudio(playerId, stream),
      });
      if (this.localStream) entry.addLocalStream(this.localStream);
      this.#peers.set(peer.playerId, entry);
    }
    if (peer.username) entry.username = peer.username;
    return entry;
  }

  /* --------------------------- microphone control ------------------------- */

  setMuted(muted) {
    this.muted = Boolean(muted);
    this._applyMuteToTracks();
    if (this.muted) this.#detector?.forceSilent();
    this.signaling.sendState({ muted: this.muted });
    this.emit('local-state', { muted: this.muted, deafened: this.deafened });
  }

  _applyMuteToTracks() {
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      // §17: muting disables the outgoing track, it does not remove it.
      // The connection stays up, so unmuting is instant.
      track.enabled = !this.muted;
    }
  }

  /* ---------------------------- speaker control --------------------------- */

  setDeafened(deafened) {
    this.deafened = Boolean(deafened);
    // §18: WebRTC connections are deliberately left alone — we only stop
    // playing remote audio locally.
    for (const element of this.#audioElements.values()) element.muted = this.deafened;
    this.signaling.sendState({ deafened: this.deafened });
    this.emit('local-state', { muted: this.muted, deafened: this.deafened });
  }

  #attachRemoteAudio(playerId, stream) {
    let element = this.#audioElements.get(playerId);
    if (!element) {
      element = document.createElement('audio');
      element.autoplay = true;
      element.dataset.playerId = playerId;
      element.muted = this.deafened;
      // Kept out of the visible layout; it only exists to play the remote track.
      element.className = 'remote-audio';
      document.body.appendChild(element);
      this.#audioElements.set(playerId, element);
    }
    element.srcObject = stream;
    element.play?.().catch(() => {
      // Autoplay can be blocked until the user interacts with the page; the
      // Join click normally satisfies that requirement already.
      this.log('Remote audio blocked by autoplay policy — click the page once');
    });
    this.emit('peers', this.getPeerStates());
  }

  #teardownAudioElement(playerId) {
    const element = this.#audioElements.get(playerId);
    if (!element) return;
    element.srcObject = null;
    element.remove();
    this.#audioElements.delete(playerId);
  }

  /* ------------------------------- teardown ------------------------------- */

  /** Full teardown: used on Leave, page unload, or a fatal mic error. */
  stop() {
    for (const playerId of [...this.#peers.keys()]) this.removePeer(playerId);
    this.#detector?.stop();
    this.#detector = null;
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    // Only the live stream is dropped; nothing about the audio is persisted. §20
    this.emit('stopped');
  }

  /**
   * Debug/testing helper: the live RTCPeerConnection objects themselves, so a
   * test can read getStats() and prove audio is really flowing (§22).
   */
  getPeerConnections() {
    return [...this.#peers.values()];
  }

  /**
   * Debug/testing helper: the live RTCPeerConnection objects themselves, so a
   * test can read getStats() and prove audio is really flowing (§22).
   */
  getPeerConnections() {
    return [...this.#peers.values()];
  }

  getPeerStates() {
    return [...this.#peers.values()].map((entry) => ({
      playerId: entry.peerId,
      username: entry.username,
      state: entry.state,
      offerer: entry.offerer,
    }));
  }
}

export default VoiceClient;
