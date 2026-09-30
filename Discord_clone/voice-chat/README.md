# Game Voice Chat — prototype

A Discord-style **voice channel** system, built as a testing prototype with
**native HTML, CSS and vanilla JavaScript** on the client and a tiny Node
signaling server. Audio is real: real microphone, real `RTCPeerConnection`, real
signaling, real remote audio. Nothing about the voice path is mocked.

The interesting part of this prototype is not the UI — it is **reconnection**:
close the browser (or refresh, or lose the network) and the player is put back
into the room they were in, with working audio, without touching anything.

```text
npm install
npm start          # http://localhost:8080
```

Open the page in **two different browsers** (or two private windows) to hear it
work. The same browser profile has one identity, so two tabs would be the same
player — see [Testing](#testing).

---

## File map

```text
voice-chat/                  the client (served by server/server.js)
├── index.html               UI shell
├── style.css                plain CSS, no framework
├── config.js                every tunable in one place (rooms, backoff, thresholds)
├── identity.js              WHO the player is + WHERE they were last
├── signaling.js             WebSocket client + reconnection state machine
├── voice.js                 WebRTC mesh, mute/deafen, speaking detection, ICE restart
├── app.js                   startup recovery flow, application state, UI rendering
└── README.md                this file

server/
├── server.js                signaling + static file server (VoiceRoom / PlayerSession)
└── test/
    ├── signaling.test.mjs   11 server tests: presence, TTL, takeover, relay, Test A-E
    └── webrtc.e2e.mjs       full-browser test: two headless Chromes, real audio
```

```text
npm test           # signaling tests (no browser needed)
npm run test:e2e   # end-to-end: drives two real Chrome tabs through the voice flow
```

---

## Architecture, explained

### 1. How the voice room works

A room is a **server-side object**, not a client-side idea:

```js
VoiceRoom    { roomId, players:Set<playerId>, emptySince }
PlayerSession{ playerId, username, roomId, connectionState, lastSeen,
               muted, deafened, speaking, socket }
```

The server keeps both maps (`rooms`, `sessions`) and is the single source of
truth for membership. A client never decides whether it is "in" a room; it asks
(`join`) and the server answers with `room-state`, the authoritative roster.

```text
lobby   -> [Player A, Player B, Player C]
room-1  -> [Player D]
```

Only players in the same room ever exchange signaling messages, so only they
ever build WebRTC connections, so only they hear each other.

### 2. How WebRTC carries audio

WebRTC is a full-mesh here: every player has one `RTCPeerConnection` per other
player in the room.

```text
getUserMedia({audio:true})
        |
   MediaStream --> addTrack() --> RTCPeerConnection (A<->B)
                                             (A<->C)
                                             (B<->C)
```

The audio itself travels **peer to peer over SRTP (UDP)** and never touches the
server. The `connectionState` of each connection is shown in the roster, so you
can see the audio plane separately from the room membership.

Who offers? A deterministic rule, to avoid offer/answer glare — the peer with
the lexicographically smaller `playerId` creates the offer. Because `playerId`
is stable, the rule stays consistent across reconnects.

### 3. What the signaling server does

It is a **relay plus a bookkeeper**. It handles presence and connection setup:

| Message (client → server) | Meaning |
| --- | --- |
| `hello {playerId, username}` | identify / adopt my session (also used to rename) |
| `join {roomId}` | put me in this room, send me the roster |
| `leave` | intentional leave |
| `state {muted, deafened, speaking}` | presence update |
| `signal {to, data}` | relay this offer/answer/candidate to one peer |

| Message (server → client) | Meaning |
| --- | --- |
| `welcome {playerId, rooms}` | session established |
| `room-state {roomId, players[]}` | **authoritative roster** (includes you) |
| `peer-joined` / `peer-left` / `peer-updated` | someone appeared, left, or changed state |
| `signal {from, data}` | a relayed offer/answer/candidate |
| `ping` / `error` | liveness and validation |

It never inspects SDP and never touches audio. In production it would also do
auth, rate limiting, and room permissions — the message shapes stay the same.

### 4. What localStorage does

Only two things, both **recovery hints**:

```text
playerId        player_8f72a91c   (stable anonymous identity for this browser)
username        Player91c
lastVoiceRoom   lobby             (cleared on an intentional Leave)
```

Nothing is written there but that: no audio, no tokens, no passwords. And the
hint is only a *question* asked at startup — the server still decides whether the
room exists and who is in it (§12: localStorage is never the source of truth for
membership).

`identity.js` puts this behind an `IdentityProvider` interface so the identity
source can be swapped later (see #8).

### 5. What happens when the browser closes

```text
socket closes (or disappears entirely)
        |
server: session.connectionState = 'disconnected'   <- session KEPT
        room membership KEPT                       <- room does NOT disappear
        everyone else is told 'peer-updated: disconnected'
        |
after SESSION_TTL_MS (30s default) with no return:
        session removed, 'peer-left: timeout'      <- no stale ghosts
```

The client side also does the right thing on `beforeunload`: it closes the socket
cleanly, and it deliberately does **not** clear `lastVoiceRoom`.

### 6. What happens when the user reconnects

```text
open the app
   -> read localStorage (playerId, lastVoiceRoom)
   -> AUTO_REJOIN?  (config.js)
   -> connect to the signaling server
   -> send `hello`  -> the server recognizes the playerId and ADOPTS the
                       existing disconnected session (room included)
   -> send `join`   -> server replies `room-state` with the CURRENT roster
   -> client diffs the roster against its (empty) peer set
   -> builds a brand-new RTCPeerConnection per player and negotiates
   -> audio works again
```

Two independent retry loops make this robust without any user action:

```text
signaling socket : 1s, 2s, 4s, 8s ... capped at 30s, +/-20% jitter   (§9)
WebRTC per peer  : ICE restart (renegotiate on the same connection),
                   after a 3s grace period for "disconnected"      (§19)
```

The WebRTC retry deliberately does **not** recreate the whole connection on every
transient state change — `disconnected` usually recovers by itself.

### 7. Why the connection itself cannot survive closing the browser

Because a `RTCPeerConnection` is **in-memory state inside a running process**:

* the JavaScript context, the DTLS certificate and the ICE agent all die with the page;
* the SRTP keys negotiated in that context die with it;
* the OS closes the UDP sockets on the way out;
* browsers deliberately give a page no way to keep a live media plane alive — and
  they should not: nothing may keep using your microphone after the tab is gone.

`localStorage` is a disk-backed string store. It can remember *who* you are and
*where* you were, but it cannot hold a socket or an encryption context. So
reconnection is always "restore the identity and the room, then **build a new
media connection**", which is exactly what this prototype does.

### 8. How this architecture can later support Google login

Identity is already behind one interface, and the voice system never asks who the
provider is:

```text
        IdentityProvider  (identity.js)
                |
     +----------+-----------+
     |                      |
LocalStorageIdentity   GoogleIdentity   <- placeholder, returns isAvailable() === false
 (implemented)              (future)
```

To add Google login, implement `load()` in `GoogleIdentity` to run the OAuth flow
and return the Google account id as `playerId`:

```text
Browser -> Google OAuth -> ID token -> backend verifies -> playerId
```

The server side then maps provider identity to a persistent session key. Nothing
in `signaling.js`, `voice.js`, `app.js` or the protocol changes, because all of
them only ever call `identity.load()`.

### 9. How this becomes SFU-based (Discord-like)

Today: mesh. Every client uploads once per peer, which is fine up to ~4-5 people.

```text
        now (mesh)                     later (SFU)
   A --- B --- C                    A ---+
    \   |   /                            |
     \  |  /                       B ---[ SFU ]--- C,D,E
      \ | /                             |
       D,E                             (one upstream per client)
```

The migration keeps this prototype's call sites:

* **Room state moves to the SFU/voice infrastructure** (the `VoiceRoom` /
  `PlayerSession` model here is already the right shape for Redis or a database).
* Each client creates **one** `RTCPeerConnection` — to the SFU instead of to each
  peer — and publishes its microphone track. `voice.js` changes from
  `syncPeers(peers)` to `connectToSFU(roomId)` + `subscribe(peerIds)`, while
  mute/deafen/speaking/ICE-restart logic stays as it is.
* Signaling keeps `room-state` and `signal`, but offers/answers are exchanged
  with the SFU rather than between players (usually the SFU is the offerer).
* The reconnection story is unchanged, and gets better: the session TTL moves to
  the shared store, so a reconnecting player can be restored by any server node.

---

## Player states

The spec lists CONNECTING / CONNECTED / DISCONNECTED / RECONNECTING / MUTED /
DEAFENED. They are modelled in two layers, because they are really two different
kinds of fact:

| Layer | Values | Where it lives |
| --- | --- | --- |
| Session state | `connected`, `disconnected` | server (`PlayerSession.connectionState`) |
| Media state | `CONNECTING`, `CONNECTED`, `DISCONNECTED`, `FAILED`, `CLOSED` | client (`voice.js`, per peer) |
| Flags | `muted`, `deafened`, `speaking` | both (client sets, server broadcasts) |
| App state | `IDLE`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `DISCONNECTED` | client (`app.js`) |

So a roster row can honestly say *"Player A — in the room, disconnected, audio
reconnecting"* instead of pretending the two are the same thing.

---

## Testing

### Automated

```bash
npm test           # 11 signaling tests, ~1s, no browser needed
npm run test:e2e   # 2 real Chrome tabs, real mic (fake device), ~25s
```

The end-to-end test (`server/test/webrtc.e2e.mjs`) drives Chrome over the
DevTools Protocol and asserts on real RTP counters, not on the UI:

```text
Test A  two players join Lobby -> peer CONNECTED -> inbound audio bytes > 0
        mute -> outgoing track disabled, connection still up
        deafen -> remote playback muted, connection still up
Test B  tab closed -> other tab keeps the room slot -> tab reopened ->
        new WebRTC connection -> audio bytes flowing again
Test D  the returning tab rebuilt its session from localStorage
Test E  Leave -> lastVoiceRoom cleared -> a fresh start stays on the lobby screen
```

Test C (losing internet mid-call) cannot be simulated reliably on one machine; it
is covered indirectly by the reconnect/backoff tests in `signaling.test.mjs` and
by the state machine in `signaling.js`. To run it by hand, see the checklist below.

### Manual (the real experience)

```bash
npm start
# browser 1: http://localhost:8080
# browser 2: a different browser, or an incognito window
```

Two tabs in the same browser profile share `localStorage`, so they are the **same
player** (the server will take the session over and close the older socket — on
purpose, so a stale tab cannot keep a zombie session). Use `?player=` to override
that for testing:

```text
http://localhost:8080/?player=demoA&name=Demo%20A
http://localhost:8080/?player=demoB&name=Demo%20B
```

These query parameters are a test aid only. They switch the identity provider to
in-memory values, so nothing is written to `localStorage`. `?room=lobby` joins
immediately without clicking, which is handy for scripted checks.

Manual checklist:

| # | Steps | Expected |
| --- | --- | --- |
| A | A joins Lobby, B joins Lobby | both hear each other, both show 🎤 |
| B | A closes the browser, waits < 30s, reopens the page | B saw A as disconnected *but still in the room*; A is restored and audio works again |
| C | Unplug the network / toggle Wi-Fi off, then back on | badge goes RECONNECTING with `retrying in Ns`, then CONNECTED; audio recovers (ICE restart) |
| D | Refresh the page (F5) | same playerId, same room, voice restored |
| E | Press **Leave**, then reload | stays on the lobby screen, does **not** auto-rejoin |
| F | Leave a browser closed for > 30s (`SESSION_TTL_MS`) | the other player sees a `peer-left (timeout)` and the slot is gone |
| G | Open the same `?player=` id in two tabs | the newer tab wins, the older is closed with code 4000 and stops reconnecting |

---

## Configuration

Everything tunable is in `voice-chat/config.js`:

```javascript
AUTO_REJOIN: true            // §10 — restore the previous room on startup
RECONNECT: { baseDelayMs: 1000, factor: 2, maxDelayMs: 30000, jitterRatio: 0.2 }
SPEAKING:  { threshold: 0.03, releaseThreshold: 0.018, minChangeIntervalMs: 250 }
ICE:       { disconnectedGraceMs: 3000, maxRestartAttempts: 3 }
ICE_SERVERS: [{ urls: 'stun:stun.l.google.com:19302' }]
```

Server-side knobs are env vars: `PORT`, `ROOMS`, `SESSION_TTL_MS`, `ROOM_TTL_MS`,
`HEARTBEAT_MS`, `SWEEP_MS`.

---

## Security and privacy (§20)

* microphone permission is requested **only** when the player presses Join;
* audio is never recorded, stored, uploaded, or written to `localStorage`;
* `localStorage` holds three short strings and nothing else;
* Mute disables the outgoing track (the connection stays up); deafen only mutes
  local playback;
* the server validates room ids, player ids, and message size, and never trusts
  the client for membership;
* for production: serve over **HTTPS**, so the page gets **WSS** and a secure
  WebRTC context, add TURN, and put auth in front of `hello`.

---

## WebRTC in the real world

Two tabs on one machine connect with host candidates alone. Over the internet you
usually need:

* **STUN** (already configured) so each side learns its public address;
* **TURN** for symmetric NATs and corporate firewalls, because without a relay the
  media simply cannot get through. Add it to `ICE_SERVERS`.

---

## What is real, and what is not

| Real | Notes |
| --- | --- |
| Microphone capture | `getUserMedia`, echo cancellation / noise suppression / AGC |
| WebRTC audio | one `RTCPeerConnection` per peer, SRTP, ICE, verified by RTP counters in the e2e test |
| Signaling | real WebSocket relay + presence + session TTL |
| Reconnection | exponential backoff, session re-adoption, ICE restart, browser-close recovery |
| Mute / deafen / speaking indicator | real track flags, real audio analysis |

| Not built (documented instead) | Where it goes |
| --- | --- |
| Google login | `createGoogleIdentity()` in `identity.js` |
| SFU scaling, recording, video, screen share | `voice.js` (one upstream instead of a mesh) |
| SFU-grade auth, rate limiting, persistence | `server/server.js` `hello` handler + a session store |

In-memory server state is intentional for a prototype: restarting the server
loses rooms. Moving `rooms`/`sessions` into Redis is a drop-in change, because all
room logic already goes through a handful of functions.

---

## Suggested next steps

1. Run the manual checklist in two real browsers with real microphones.
2. Add a TURN server to `ICE_SERVERS` and repeat test B over the internet.
3. Replace the mesh with an SFU (`mediasoup`, `LiveKit`, `Janus`) once rooms pass
   ~5 players — `voice.js` is the only file that needs to change.
4. Move `rooms`/`sessions` into Redis and add an HTTP auth layer in front of
   `hello`, so a session can be restored by any signaling node.
