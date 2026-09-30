/**
 * server/test/signaling.test.mjs
 *
 * Integration tests for the signaling server using real WebSocket clients.
 *
 * These cover the server half of the spec's Phase 4 scenarios (Tests A-E):
 * joining, presence, disconnect/reconnect, session TTL, intentional leave and
 * session takeover. The WebRTC half (real audio between two browsers) can only
 * be verified manually — see "Testing" in voice-chat/README.md.
 *
 * Run with:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createVoiceServer } from '../server.js';

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

class TestClient {
  constructor(port) {
    this.inbox = [];
    this.waiters = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const waiter = this.waiters.find((w) => w.match(message));
      if (waiter) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      } else {
        this.inbox.push(message);
      }
    });
    this.closed = new Promise((resolve) => this.ws.on('close', (code) => resolve(code)));
  }

  async open() {
    if (this.ws.readyState !== WebSocket.OPEN) await once(this.ws, 'open');
    return this;
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }

  /** Waits for the first message matching `type` (and optional `match`). */
  waitFor(type, match = () => true, timeoutMs = 3000) {
    const predicate = (message) => message.type === type && match(message);
    const index = this.inbox.findIndex(predicate);
    if (index !== -1) return Promise.resolve(this.inbox.splice(index, 1)[0]);

    return new Promise((resolve, reject) => {
      const waiter = {
        match: predicate,
        resolve: (message) => {
          clearTimeout(waiter.timer);
          resolve(message);
        },
      };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for "${type}" (inbox: ${JSON.stringify(this.inbox)})`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  /** The full identify + join handshake, like the browser client performs. */
  async identifyAndJoin(playerId, username, roomId) {
    this.send({ type: 'hello', playerId, username });
    const welcome = await this.waitFor('welcome');
    if (roomId) this.send({ type: 'join', roomId });
    const roomState = roomId ? await this.waitFor('room-state') : null;
    return { welcome, roomState };
  }

  close() {
    this.ws.close();
  }

  terminate() {
    this.ws.terminate();
  }
}

async function withServer(options, run) {
  const server = createVoiceServer({
    rooms: ['lobby', 'room-1'],
    sweepMs: 50,
    heartbeatMs: 1000,
    log: () => {},
    ...options,
  });
  const port = await server.listen(0);
  try {
    await run({ server, port });
  } finally {
    await server.close();
  }
}

const names = (roomState) => roomState.players.map((p) => p.username).sort();

/* -------------------------------------------------------------------------- */
/* Test A — two players meet in a room                                          */
/* -------------------------------------------------------------------------- */

test('Test A: players joining the same room see each other', async () => {
  await withServer({}, async ({ port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    const { roomState: aState } = await a.identifyAndJoin('player_aaa', 'Player A', 'lobby');
    assert.deepEqual(names(aState), ['Player A'], 'the first joiner sees only themselves');

    const joinedNotice = a.waitFor('peer-joined', (m) => m.peer.username === 'Player B');
    const { roomState: bState } = await b.identifyAndJoin('player_bbb', 'Player B', 'lobby');
    assert.deepEqual(names(bState), ['Player A', 'Player B'], 'the second joiner gets the full roster');
    assert.equal((await joinedNotice).peer.playerId, 'player_bbb');

    a.close();
    b.close();
  });
});

test('rooms are isolated from each other', async () => {
  await withServer({}, async ({ port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'Player A', 'lobby');
    const { roomState } = await b.identifyAndJoin('player_bbb', 'Player B', 'room-1');

    assert.deepEqual(names(roomState), ['Player B'], 'a player only sees their own room');
    a.close();
    b.close();
  });
});

test('offers, answers and ICE candidates are relayed to one peer only', async () => {
  await withServer({}, async ({ port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();
    const c = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'A', 'lobby');
    await b.identifyAndJoin('player_bbb', 'B', 'lobby');
    await c.identifyAndJoin('player_ccc', 'C', 'lobby');

    a.send({ type: 'signal', to: 'player_bbb', data: { type: 'offer', sdp: { type: 'offer', sdp: 'v=0' } } });

    const relayed = await b.waitFor('signal');
    assert.equal(relayed.from, 'player_aaa');
    assert.equal(relayed.data.type, 'offer');
    assert.equal(relayed.data.sdp.sdp, 'v=0');
    // C is in the same room but must not receive someone else's negotiation.
    await assert.rejects(() => c.waitFor('signal', () => true, 150), /Timed out/);

    a.close();
    b.close();
    c.close();
  });
});

/* -------------------------------------------------------------------------- */
/* Test B / D — reconnecting with the same playerId restores the room          */
/* -------------------------------------------------------------------------- */

test('Test B/D: a player who drops keeps their room slot and can rejoin', async () => {
  await withServer({}, async ({ server, port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'Player A', 'lobby');
    await b.identifyAndJoin('player_bbb', 'Player B', 'lobby');

    // --- A closes the browser -------------------------------------------------
    const disconnectedNotice = b.waitFor(
      'peer-updated',
      (m) => m.peer.playerId === 'player_aaa' && m.peer.connectionState === 'disconnected',
    );
    a.terminate();
    const seenByB = await disconnectedNotice;
    assert.equal(seenByB.peer.connectionState, 'disconnected');
    assert.notEqual(seenByB.peer.playerId, undefined);

    // B is told the player is still in the room (ROOM != CONNECTION, §11)...
    const afterDrop = b.inbox.filter((m) => m.type === 'peer-left');
    assert.equal(afterDrop.length, 0, 'a disconnect must not look like leaving the room');
    // ...and the server agrees.
    const lobby = () => server.inspect().rooms.find((r) => r.roomId === 'lobby');
    assert.deepEqual([...lobby().players].sort(), ['player_aaa', 'player_bbb']);

    // --- A opens the browser again -------------------------------------------
    const a2 = await new TestClient(port).open();
    // B is told the slot is live again (re-adoption, not a fresh join).
    const rejoinedNotice = b.waitFor(
      'peer-updated',
      (m) => m.peer.playerId === 'player_aaa' && m.peer.connectionState === 'connected',
    );
    const { roomState } = await a2.identifyAndJoin('player_aaa', 'Player A', 'lobby');

    assert.deepEqual(names(roomState), ['Player A', 'Player B'], 'A gets the current roster and rebuilds WebRTC');
    assert.equal((await rejoinedNotice).peer.connectionState, 'connected');
    const presence = roomState.players.find((p) => p.playerId === 'player_aaa');
    assert.equal(presence.connectionState, 'connected');

    a2.close();
    b.close();
  });
});

test('a reconnect within the same session does not spam peers with left/joined', async () => {
  await withServer({}, async ({ port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'A', 'lobby');
    await b.identifyAndJoin('player_bbb', 'B', 'lobby');
    a.terminate();
    await b.waitFor('peer-updated', (m) => m.peer.connectionState === 'disconnected');

    const a2 = await new TestClient(port).open();
    const updated = b.waitFor(
      'peer-updated',
      (m) => m.peer.playerId === 'player_aaa' && m.peer.connectionState === 'connected',
    );
    await a2.identifyAndJoin('player_aaa', 'A', 'lobby');
    await updated;

    assert.equal(b.inbox.filter((m) => m.type === 'peer-left').length, 0);

    a2.close();
    b.close();
  });
});

/* -------------------------------------------------------------------------- */
/* Test E — intentional leave                                                   */
/* -------------------------------------------------------------------------- */

test('Test E: an intentional leave frees the room slot immediately', async () => {
  await withServer({}, async ({ server, port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'A', 'lobby');
    await b.identifyAndJoin('player_bbb', 'B', 'lobby');

    const leftNotice = b.waitFor('peer-left', (m) => m.playerId === 'player_aaa');
    a.send({ type: 'leave' });
    assert.equal((await leftNotice).reason, 'left');

    const lobby = server.inspect().rooms.find((r) => r.roomId === 'lobby');
    assert.deepEqual([...lobby.players], ['player_bbb'], 'the session survives, the membership does not');

    // The socket stays usable: presence still works, and re-joining is allowed.
    const { roomState } = await a.identifyAndJoin('player_aaa', 'A', 'lobby');
    assert.deepEqual(names(roomState), ['A', 'B']);

    a.close();
    b.close();
  });
});

/* -------------------------------------------------------------------------- */
/* Session TTL and takeover                                                     */
/* -------------------------------------------------------------------------- */

test('a session that never returns expires and is removed from the room', async () => {
  await withServer({ sessionTtlMs: 120 }, async ({ server, port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'A', 'lobby');
    await b.identifyAndJoin('player_bbb', 'B', 'lobby');

    const leftNotice = b.waitFor('peer-left', (m) => m.playerId === 'player_aaa' && m.reason === 'timeout');
    a.terminate();
    await leftNotice;

    assert.deepEqual(server.inspect().sessions.map((s) => s.playerId), ['player_bbb'], 'stale session forgotten');

    b.close();
  });
});

test('a second connection with the same playerId takes over the session', async () => {
  await withServer({}, async ({ server, port }) => {
    const first = await new TestClient(port).open();
    await first.identifyAndJoin('player_aaa', 'A', 'lobby');

    const second = await new TestClient(port).open();
    const takeover = await second.identifyAndJoin('player_aaa', 'A', 'lobby');

    // The new connection wins and is placed back into the same room.
    assert.deepEqual(names(takeover.roomState), ['A']);
    assert.equal(await first.closed, 4000, 'the old socket is closed with the "superseded" code');
    assert.equal(server.inspect().sessions.length, 1, 'still exactly one session for this player');

    second.close();
  });
});

/* -------------------------------------------------------------------------- */
/* Presence                                                                     */
/* -------------------------------------------------------------------------- */

test('mute / deafen / speaking updates are broadcast to the room', async () => {
  await withServer({}, async ({ port }) => {
    const a = await new TestClient(port).open();
    const b = await new TestClient(port).open();

    await a.identifyAndJoin('player_aaa', 'A', 'lobby');
    await b.identifyAndJoin('player_bbb', 'B', 'lobby');

    a.send({ type: 'state', muted: true });
    const muted = await b.waitFor('peer-updated', (m) => m.peer.playerId === 'player_aaa' && m.peer.muted === true);
    assert.equal(muted.peer.username, 'A');

    a.send({ type: 'state', speaking: true, deafened: true });
    const speaking = await b.waitFor('peer-updated', (m) => m.peer.speaking === true);
    assert.equal(speaking.peer.deafened, true);
    // The sender never receives an echo of its own state.
    assert.equal(a.inbox.filter((m) => m.type === 'peer-updated').length, 0, 'no self-echo');

    a.close();
    b.close();
  });
});

test('invalid room ids and unknown peers are rejected without crashing', async () => {
  await withServer({}, async ({ port }) => {
    const a = await new TestClient(port).open();
    a.send({ type: 'hello', playerId: 'player_aaa', username: 'A' });
    await a.waitFor('welcome');

    a.send({ type: 'join', roomId: '../etc/passwd' });
    const error = await a.waitFor('error');
    assert.match(error.message, /Invalid room id/);

    a.send({ type: 'signal', to: 'player_ghost', data: { type: 'offer' } });
    a.send({ type: 'nonsense' });
    const unknown = await a.waitFor('error');
    assert.match(unknown.message, /Unknown message type/);

    a.close();
  });
});

/* -------------------------------------------------------------------------- */
/* Static hosting                                                               */
/* -------------------------------------------------------------------------- */

test('the server also hosts the client files', async () => {
  await withServer({}, async ({ port }) => {
    const indexResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(indexResponse.status, 200);
    const html = await indexResponse.text();
    assert.match(html, /GAME VOICE CHAT/);

    const moduleResponse = await fetch(`http://127.0.0.1:${port}/app.js`);
    assert.equal(moduleResponse.headers.get('content-type'), 'text/javascript; charset=utf-8');

    const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(health.status, 'ok');

    const missing = await fetch(`http://127.0.0.1:${port}/nope.js`);
    assert.equal(missing.status, 404);

    const traversal = await fetch(`http://127.0.0.1:${port}/../package.json`);
    assert.notEqual(traversal.status, 200, 'path traversal must not serve files outside the client dir');
  });
});
