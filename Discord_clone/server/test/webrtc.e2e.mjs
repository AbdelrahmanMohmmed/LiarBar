/**
 * server/test/webrtc.e2e.mjs
 *
 * End-to-end test of the WHOLE voice path, driven through the Chrome DevTools
 * Protocol (no puppeteer, just `ws` + Chrome's own debugging endpoint):
 *
 *   real page -> real signaling server -> real getUserMedia (fake device)
 *             -> real RTCPeerConnection -> real inbound audio RTP
 *
 * It walks the spec's Phase 4 scenarios:
 *   Test A : two players join Lobby and get a live audio path
 *   Test B : one player's tab disappears; the other keeps the room; the player
 *            returns and audio is re-established
 *   Test D : the returning player rebuilds its session from localStorage
 *   Test E : an intentional Leave must NOT auto-rejoin on the next startup
 *
 * (Test C — losing internet mid-call — cannot be simulated reliably inside one
 * machine; it is covered by the reconnection state machine and the signaling
 * tests instead. See the README "Testing" section.)
 *
 * Run with:  npm run test:e2e      (needs Chrome installed)
 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createVoiceServer } from '../server.js';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const step = (message) => console.log(`\n▶ ${message}`);
const pass = (message) => console.log(`  ✔ ${message}`);

/* -------------------------------------------------------------------------- */
/* Chrome DevTools Protocol plumbing                                           */
/* -------------------------------------------------------------------------- */

/** Minimal CDP client: one chrome tab, JSON-RPC over a websocket. */
class Tab {
  constructor(websocketUrl, targetId) {
    this.websocketUrl = websocketUrl;
    this.targetId = targetId;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.websocketUrl, { perMessageDeflate: false });
    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message}`));
      else pending.resolve(message.result);
    });
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluates an expression in the page and returns its value. */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`Page error: ${result.exceptionDetails.exception?.description ?? 'unknown'}`);
    }
    return result.result.value;
  }

  /** Polls an expression until it returns a truthy value. */
  async waitFor(expression, { timeoutMs = 20000, intervalMs = 250, label = expression } = {}) {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      try {
        last = await this.evaluate(expression);
        if (last) return last;
      } catch (error) {
        last = error.message;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Timed out waiting for: ${label}\n  last value: ${JSON.stringify(last)}`);
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
  }
}

const cdpJson = async (pathname, method = 'GET') => {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}${pathname}`, { method });
  return response.json();
};

/** Opens a new tab and navigates it to `url`. */
async function openTab(url) {
  const target = await cdpJson(`/json/new?${encodeURIComponent(url)}`, 'PUT');
  const tab = await new Tab(target.webSocketDebuggerUrl, target.id).connect();
  await tab.send('Runtime.enable');
  await tab.send('Page.enable');
  return tab;
}

const closeTab = (tab) => cdpJson(`/json/close/${tab.targetId}`).catch(() => {});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------------------- */
/* page-side helpers (evaluated inside the tab)                                */
/* -------------------------------------------------------------------------- */

const SNAPSHOT = `JSON.stringify({
  appState: window.__voice.state.appState,
  activeRoom: window.__voice.state.activeRoom,
  lastVoiceRoom: localStorage.getItem('lastVoiceRoom'),
  playerId: window.__voice.state.selfId,
  username: window.__voice.state.username,
  muted: window.__voice.voice.muted,
  deafened: window.__voice.voice.deafened,
  presence: [...window.__voice.state.presence.values()],
  peers: window.__voice.voice.getPeerStates(),
  remoteAudioElements: document.querySelectorAll('audio.remote-audio').length,
})`;

const snapshot = async (tab) => JSON.parse(await tab.evaluate(SNAPSHOT));

/** Reads real RTP counters, so "connected" is not just a UI assumption (§22). */
const AUDIO_STATS = `(async () => JSON.stringify({
  bytes: await (async () => {
    let total = 0;
    for (const entry of window.__voice.voice.getPeerConnections()) {
      const stats = await entry.pc.getStats();
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') total += report.bytesReceived || 0;
      });
    }
    return total;
  })(),
  peers: window.__voice.voice.getPeerConnections().map((entry) => ({
    playerId: entry.peerId,
    connection: entry.pc.connectionState,
    ice: entry.pc.iceConnectionState,
  })),
}))()`;

/** Total inbound audio bytes, as a plain number (for polling). */
const AUDIO_BYTES = `(async () => {
  let total = 0;
  for (const entry of window.__voice.voice.getPeerConnections()) {
    const stats = await entry.pc.getStats();
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') total += report.bytesReceived || 0;
    });
  }
  return total;
})()`;

const audioStats = async (tab) => JSON.parse(await tab.evaluate(AUDIO_STATS));

const waitForPeerConnected = (tab) =>
  tab.waitFor(
    `(() => {
       const peers = window.__voice.voice.getPeerStates();
       return peers.length > 0 && peers.every((p) => p.state === 'CONNECTED');
     })()`,
    { label: 'all WebRTC peers CONNECTED', timeoutMs: 30000 },
  );

const waitForBytes = (tab, minimum = 1000) =>
  tab.waitFor(`(async () => { const bytes = await ${AUDIO_BYTES}; return bytes > ${minimum} ? bytes : 0; })()`, {
    label: `inbound audio bytes > ${minimum}`,
    timeoutMs: 30000,
    intervalMs: 500,
  });

/* -------------------------------------------------------------------------- */
/* the test                                                                    */
/* -------------------------------------------------------------------------- */

async function main() {
  const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!chromePath) throw new Error(`Chrome not found. Set CHROME_PATH. Tried:\n${CHROME_CANDIDATES.join('\n')}`);

  const server = createVoiceServer({ log: () => {} });
  const port = await server.listen(0);
  const base = `http://127.0.0.1:${port}`;
  console.log(`signaling server on ${base}`);

  // Must be absolute: Chrome refuses to start with a relative --user-data-dir.
  // Kept in the OS temp dir so a locked profile never pollutes the project.
  const profileDir = path.join(os.tmpdir(), `voice-chat-e2e-${process.pid}`);
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${CDP_PORT}`,
      '--remote-allow-origins=*',
      `--user-data-dir=${profileDir}`,
      // Fake microphone + auto-accepted permission prompt, so the real
      // getUserMedia -> RTCPeerConnection path can be exercised headlessly.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      // Local ICE candidates instead of mDNS hostnames (works offline / sandboxed).
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const cleanup = async () => {
    chrome.kill();
    // Wait for Chrome to release its profile lock before deleting the directory.
    await new Promise((resolve) => {
      if (chrome.exitCode !== null || chrome.signalCode) return resolve();
      chrome.once('exit', resolve);
      setTimeout(resolve, 5000);
    });
    await server.close();
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      console.warn(`  (could not delete the temporary Chrome profile: ${error.message})`);
    }
  };

  try {
    // Wait for Chrome's debugging endpoint.
    let cdpReady = false;
    for (let i = 0; i < 120 && !cdpReady; i += 1) {
      try {
        await cdpJson('/json/version');
        cdpReady = true;
      } catch {
        await sleep(250);
      }
    }
    if (!cdpReady) throw new Error(`Chrome never opened the DevTools port ${CDP_PORT} (binary: ${chromePath})`);

    /* ------------------------------- Test A ------------------------------- */
    step('Test A: player A joins Lobby (real microphone + WebRTC)');
    const tabA = await openTab(`${base}/?player=e2eA&name=Player%20A&room=lobby`);
    await tabA.waitFor('Boolean(window.__voice)', { label: 'app booted' });
    await tabA.waitFor(`window.__voice.state.appState === 'CONNECTED'`, { label: 'A is CONNECTED' });
    const soloA = await snapshot(tabA);
    assert.equal(soloA.activeRoom, 'lobby');
    assert.equal(soloA.lastVoiceRoom, 'lobby', 'the last room is persisted for recovery');
    assert.equal(soloA.presence.length, 1);
    pass(`A is alone in lobby as ${soloA.playerId}, lastVoiceRoom saved`);

    step('Test A: player B joins Lobby, both get an audio path');
    const tabB = await openTab(`${base}/?player=e2eB&name=Player%20B&room=lobby`);
    await tabB.waitFor('Boolean(window.__voice)', { label: 'app booted' });
    await tabB.waitFor(`window.__voice.state.appState === 'CONNECTED'`, { label: 'B is CONNECTED' });

    for (const [label, tab] of [['A', tabA], ['B', tabB]]) {
      await waitForPeerConnected(tab);
      const bytes = await waitForBytes(tab);
      const state = await snapshot(tab);
      assert.equal(state.presence.length, 2, `${label} sees 2 players in the room`);
      assert.equal(state.remoteAudioElements, 1, `${label} attached a remote audio element`);
      pass(`${label}: peer CONNECTED, ${bytes} inbound audio bytes received`);
    }

    const statsA = await audioStats(tabA);
    assert.match(statsA.peers[0].ice, /connected|completed/, 'ICE really connected');
    pass(`audio is flowing over ICE (iceConnectionState=${statsA.peers[0].ice})`);

    /* ----------------------------- Mute/deafen ---------------------------- */
    step('Mute and deafen update presence without dropping the call');
    await tabA.evaluate(`document.getElementById('mute-btn').click()`);
    await tabB.waitFor(
      `[...window.__voice.state.presence.values()].some((p) => p.playerId === 'player_e2eA' && p.muted)`,
      { label: 'B sees A as muted' },
    );
    const mutedTrack = await tabA.evaluate(
      `window.__voice.voice.localStream.getAudioTracks().every((t) => t.enabled === false)`,
    );
    assert.equal(mutedTrack, true, 'muting disables the outgoing track, not the connection');
    assert.equal((await audioStats(tabA)).peers[0].connection, 'connected');
    pass('A is muted on B\'s roster, WebRTC connection still up');

    await tabA.evaluate(`document.getElementById('mute-btn').click()`);
    await tabA.waitFor(`window.__voice.voice.muted === false`, { label: 'A unmuted' });
    pass('unmute restores the outgoing audio instantly');

    step('Deafen silences remote audio locally, without touching WebRTC (§18)');
    await tabA.evaluate(`document.getElementById('deafen-btn').click()`);
    await tabB.waitFor(
      `[...window.__voice.state.presence.values()].some((p) => p.playerId === 'player_e2eA' && p.deafened)`,
      { label: 'B sees A as deafened' },
    );
    assert.equal(
      await tabA.evaluate(`[...document.querySelectorAll('audio.remote-audio')].every((el) => el.muted)`),
      true,
      'remote playback is muted locally while the connection stays up',
    );
    assert.equal((await audioStats(tabA)).peers[0].connection, 'connected');
    await tabA.evaluate(`document.getElementById('deafen-btn').click()`);
    await tabA.waitFor(`window.__voice.voice.deafened === false`, { label: 'A undeafened' });
    pass('deafen only mutes local playback; undeafen restores it');

    /* --------------------------- Test B and D ----------------------------- */
    step('Test B/D: A closes the browser; B keeps the room; A returns');
    await closeTab(tabA);
    await tabB.waitFor(
      `window.__voice.state.presence.get('player_e2eA')?.connectionState === 'disconnected'`,
      { label: 'B sees A as disconnected' },
    );
    const afterDrop = await snapshot(tabB);
    assert.equal(afterDrop.presence.length, 2, 'A is STILL in the room (ROOM != CONNECTION, §11)');
    assert.equal(afterDrop.activeRoom, 'lobby');
    pass('B keeps A\'s slot: disconnected but still in the room');

    const tabA2 = await openTab(`${base}/?player=e2eA&name=Player%20A&room=lobby`);
    await tabA2.waitFor('Boolean(window.__voice)');
    await tabA2.waitFor(`window.__voice.state.appState === 'CONNECTED'`, { label: 'A is back in the room' });
    for (const [label, tab] of [['A', tabA2], ['B', tabB]]) {
      await waitForPeerConnected(tab);
      await waitForBytes(tab);
    }
    const backState = await snapshot(tabA2);
    assert.equal(backState.presence.length, 2);
    pass('voice is restored with a brand-new WebRTC connection (old one is gone for good)');

    /* ------------------------------- Test E ------------------------------- */
    step('Test E: an intentional Leave must not auto-rejoin later');
    await tabA2.evaluate(`document.getElementById('leave-btn').click()`);
    await tabA2.waitFor(`window.__voice.state.activeRoom === null`, { label: 'A left the room' });
    const afterLeave = await snapshot(tabA2);
    assert.equal(afterLeave.lastVoiceRoom, null, 'lastVoiceRoom is cleared on an intentional leave');
    assert.equal(afterLeave.appState, 'IDLE');
    await tabB.waitFor(`window.__voice.state.presence.size === 1`, { label: 'B sees A gone' });
    pass('Leave removed A from the room and cleared the saved room');

    // A plain restart must land on the lobby screen, not back in voice.
    const restart = await openTab(`${base}/?player=e2eA&name=Player%20A`);
    await restart.waitFor('Boolean(window.__voice)');
    await sleep(1500);
    const restarted = await snapshot(restart);
    assert.equal(restarted.activeRoom, null, 'no automatic rejoin after an intentional leave');
    assert.equal(restarted.appState, 'IDLE');
    pass('a fresh start stays on the lobby screen (Test E passes)');

    closeTab(restart);
    closeTab(tabA2);
    closeTab(tabB);
    console.log('\n✅ all end-to-end voice checks passed');
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error('\n❌ end-to-end test failed:', error.message);
  process.exitCode = 1;
});
