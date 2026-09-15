# Voice

> How voice chat actually works here, why every piece of it exists, how to
> diagnose it when a player says "voice is broken", and what it would take to
> grow it.

Code: [`web/src/lib/voiceContext.tsx`](../web/src/lib/voiceContext.tsx),
[`web/src/lib/voiceLevels.ts`](../web/src/lib/voiceLevels.ts),
[`web/src/components/party/VoicePanel.tsx`](../web/src/components/party/VoicePanel.tsx).
Server: the `webrtc_signal` handler in
[`server/src/socket/handlers.ts`](../server/src/socket/handlers.ts) — about
fifteen lines, and that is the whole server-side implementation.

---

## 1. The one-paragraph version

Every pair of humans in a room holds one direct WebRTC audio connection. The
server's only job is to pass the handshake messages between them; once
connected, **audio never touches the server.** If the two devices can't reach
each other directly (different networks, strict NAT, mobile data), the audio is
relayed through a TURN server. Muting doesn't close anything — it disables the
outgoing track, so you keep hearing everyone.

---

## 2. Why it's a mesh, and when to stop

Every player connects directly to every other player:

```
        A ──── B
        │ ╲  ╱ │
        │  ╳   │        4 people = 6 connections
        │ ╱  ╲ │        6 people = 15 connections
        C ──── D        N people = N(N-1)/2
```

Cost per person is what matters, and it's linear, not quadratic: you send your
own audio N−1 times. At Opus voice bitrates (~24–40 kbps) six people is roughly
200 kbps up — fine on any 4G connection and any phone made in the last decade.

**The alternative is an SFU** (LiveKit, mediasoup, Janus): everyone sends one
stream to a server, which forwards it. Upload becomes constant regardless of
room size. That is strictly better above about ten people and strictly worse
below, because it costs a server, its bandwidth bill, and its operational
burden — for rooms of six, to solve a problem rooms of six don't have.

**The line to watch:** rooms above ~10, or adding spectators. Spectators are the
real trigger — a mesh with 30 watchers is 435 connections and simply will not
work. If you add "watch a table", you need an SFU first. The migration is
contained: `voiceContext.tsx` is the only file that knows what a peer
connection is.

---

## 3. How a connection gets made

### Who calls whom

```ts
if (myPlayerId < peerId) ensurePeer(peerId, true);   // I initiate
// otherwise: wait for their offer
```

String comparison of player ids decides the initiator. It's arbitrary but it's
*consistent*, which is the entire requirement — both sides compute the same
answer with no coordination, so there's exactly one connection per pair instead
of two half-built ones racing.

### Connected before anyone unmutes

The initiator opens the connection with a `recvonly` audio transceiver:

```ts
const transceiver = pc.addTransceiver("audio", { direction: "recvonly" });
```

This is deliberate and slightly unusual. It means **a player who never touches
their microphone is still fully connected and can hear everyone immediately.**
Most naive implementations call `getUserMedia` first and only then connect,
which means a listener has to grant mic permission to hear anything — a
permission prompt to *listen* is a bizarre thing to ask for and a large fraction
of people decline it.

When you unmute, the existing transceiver is flipped:

```ts
transceiver.sender.replaceTrack(track);
transceiver.direction = "sendrecv";
```

That fires `onnegotiationneeded` and a fast renegotiation. No new connection, no
gap in audio you were already receiving.

### Perfect negotiation

Both sides can renegotiate at any time (anyone can unmute whenever), so
collisions are guaranteed. The implementation uses the standard *perfect
negotiation* pattern: the peer with the larger id is "polite" and yields on a
collision; the smaller id never yields. Without it, two simultaneous unmutes
put the connection into a stuck `have-local-offer` state, and the symptom is
"we can both see each other connected and neither can hear anything" — which is
essentially undebuggable from a user report.

ICE candidates that arrive before the remote description are queued and flushed
afterwards, because trickle ICE makes no ordering guarantee and dropping early
candidates silently costs you the fastest route.

---

## 4. STUN and TURN

```
STUN  "what's my public address?"   free, Google's servers, ~1 packet
TURN  "please forward my audio"     your server, your bandwidth
```

**STUN is enough** when both devices can be reached directly once they know
each other's public address. That covers most home-wifi-to-home-wifi.

**TURN is required** for symmetric NAT, most corporate and university networks,
and a meaningful share of mobile carriers. Without it, those players connect to
*some* people and not others, which reads as "voice is broken and nobody knows
why" — the worst possible failure mode, because it's inconsistent.

Configuration is env-driven:

```
VITE_TURN_URL=turn:158.158.32.23:3478
VITE_TURN_USERNAME=...
VITE_TURN_CREDENTIAL=...
```

Setup for the coturn instance: [`VOICE_TURN_SETUP.md`](../VOICE_TURN_SETUP.md).

Two defensive details in `getIceServers()` that are load-bearing:

- **A TURN URL with no credential is ignored, not passed through.**
  `RTCPeerConnection` *throws* on a `turn:` entry without credentials, and that
  throw kills voice for everyone — including the people who were fine on STUN.
  A half-configured env var must not be able to take the whole feature down.
- **Constructor failure falls back to STUN-only** rather than propagating.
  Degraded voice beats no voice.

---

## 5. What was broken, and what fixed it

Everything below was added because each failure produced **no error anywhere** —
not in the console, not in the UI, not on the server.

### Nobody could tell whether their mic worked

The only feedback was another human saying "we can't hear you". Now every
player has a live level meter, **including your own mic**, so you watch your own
bar move and know in one second.

`voiceLevels.ts` runs one `AudioContext`, one `AnalyserNode` per stream, and
**one** `requestAnimationFrame` loop that walks all of them. Six rAF callbacks
competing on a phone that's also running a game is real jank for no benefit.

Only the *set of speakers* crosses into React. Levels are exposed through a
stable `Map` that consumers read from their own frame loop, because a 60fps
`setState` across a six-player list re-renders the whole room sixty times a
second and visibly stalls the game's animations.

Thresholds have hysteresis — 0.045 to start, 0.028 to stop, with a 320ms hold.
With a single threshold, a normal speaking voice crosses it on every syllable
and the indicator strobes, which is worse than not having one.

### Blocked audio was invisible

Browsers refuse to autoplay audio until the page has had a user gesture. The
call connects, everyone else hears you, **you hear nothing, and nothing anywhere
reports an error.** This is the most common "voice doesn't work" report there is.

Now `audioBlocked` is tracked from the `play()` rejection and surfaced as a
one-tap "Tap to hear everyone" button. The passive gesture listener is kept, but
it can't be relied on alone: someone who joins, hears silence and sits still
waiting never produces a gesture.

### One drop was permanent

The old handler called `restartIce()` once, on the first `failed`, and never
again. A peer that dropped twice — a phone switching from wifi to mobile data,
the single most common cause — was gone for the rest of the night.

Restarts now retry with backoff (0.8s, 2.5s, 6s, then give up). A clean
reconnect resets the budget, so a link that flaps all evening keeps recovering
rather than exhausting its three retries in the first minute. Giving up logs the
actual diagnosis — TURN missing or unreachable — instead of leaving it as a
mystery.

### "Voice is broken" was one undifferentiated symptom

Per-peer health is now exposed as four states a player can act on:

| State | Means | What to do |
|---|---|---|
| `connecting` | Handshaking | Wait a second |
| `connected` | Audio path up | Nothing |
| `recovering` | Dropped, retrying | Wait; usually fixes itself |
| `failed` | Gave up after 3 ICE restarts | Almost always TURN |

`RTCPeerConnection` exposes four overlapping state machines
(`connectionState`, `iceConnectionState`, `signalingState`,
`iceGatheringState`) and none of them alone answers "can this person hear me".
These four are the collapse of all of them into something actionable.

### getUserMedia errors all said the same thing

"Check permissions" is wrong advice for three of the four failure modes. They're
now named individually: blocked, no device, device in use by another app, and
insecure origin.

---

## 6. Diagnosing a report

Work down this list; it's ordered by how often each is the answer.

**1. "I can't hear anyone."**
Is the "Tap to hear everyone" button showing? That's blocked autoplay — one tap.
If not, check their peer health dots: all `failed` means TURN; some `failed`
means it's specific to those pairs, which is also TURN.

**2. "They can't hear me."**
Have them unmute and watch their own level bar. No movement = the OS or browser
isn't giving us audio (check the browser's site permissions and whether another
app holds the mic). Movement but silence at the other end = a peer connection
problem; check the health dot for that specific person.

**3. "It worked and then stopped."**
Almost always a network change (wifi → mobile data). The dot goes `recovering`
and should return to `connected` within ~10 seconds. If it lands on `failed`,
TURN isn't reachable from their new network.

**4. "Some people hear each other, some don't."**
This is TURN, every time. Confirm with the Trickle-ICE tester in
[`VOICE_TURN_SETUP.md`](../VOICE_TURN_SETUP.md): you need at least one candidate
of type **`relay`**. No relay row means the coturn `external-ip` mapping or the
Azure NSG rules are wrong.

**5. Echo.**
Someone is on speaker with their mic open. `echoCancellation` is enabled and
handles headsets and normal phone use; it cannot fully cancel a loudspeaker
pointed at a microphone. See the push-to-talk item in §7.

### Console breadcrumbs

`getIceServers()` logs the ICE server list once per session, tagged
`(TURN active)` or `(STUN only — no TURN)`. That single line answers the most
common class of report before any other investigation.

---

## 7. Where to take it next

Ordered by value per hour of work.

### 7.1 Push-to-talk — small, high value

Hold a key (or a screen button) to transmit. Solves echo on speakerphone,
background noise from one loud room, and the "I forgot I was unmuted" problem.

Implementation is about twenty lines: the track's `enabled` flag already gates
transmission, so it's a keydown/keyup pair plus a persisted preference. The only
care needed is a short release tail (~200ms) so the last syllable isn't clipped,
and ignoring key repeat.

### 7.2 Per-person volume and local mute — small

One loud player ruins a call for everyone, and right now the only fix is asking
them to move their phone. `HTMLAudioElement.volume` is per-element and we
already keep one element per peer, so this is a slider wired to a value in
`audioElementsRef`. Persist per player id.

### 7.3 Microphone picker — small

`enumerateDevices()` plus a `deviceId` constraint. Matters most on desktop,
where the default input is regularly the wrong one (a webcam mic instead of a
headset) and the player has no idea that's why they sound distant.

### 7.4 Noise suppression beyond the browser's — medium

`noiseSuppression: true` is already on and is decent. RNNoise compiled to WASM
is substantially better in a room with a TV on, which is the actual environment
here. Costs ~200KB and some CPU. Worth prototyping only if noise turns out to be
a common complaint; don't build it speculatively.

### 7.5 Reconnect on network change — medium

The browser fires `online`/`offline` and the Network Information API reports
connection type changes. Proactively restarting ICE on a network change,
*before* the connection notices it has died, would cut the recovery window from
~10 seconds to ~2. This is the single biggest remaining quality win for mobile
players, who change networks constantly.

### 7.6 Voice activity as game input — the interesting one

The level monitor already knows who is speaking. That is a signal no other game
in this category uses, and it's free:

- **Liar's Bar:** flag the player who went quiet right before playing a card.
  The game is about tells; "Ahmed said nothing that whole turn" is a real one.
- **Codenames:** a gentle nudge when one operative has done 90% of the talking.
  The failure mode of Codenames is one loud player deciding everything.
- **Domino:** the knock already has theatre; a sound triggered by an actual
  table-slam gesture would land.
- **Any game:** "quietest player" in the end-of-night recap. Funny, costs
  nothing, and generates the screenshot people share.

This is the feature most likely to differentiate the product, and it exists
because voice and game state are in the same client rather than in a third-party
SDK.

### 7.7 An SFU — large, only when forced

Do this when rooms exceed ten or spectators are added, and not before. See §2.
LiveKit Cloud is the least-effort path; self-hosting mediasoup is cheaper at
scale and considerably more work. Either way only `voiceContext.tsx` changes,
which is the payoff for having kept all the WebRTC knowledge in one file.

---

## 8. Things that look like bugs and aren't

- **Muting doesn't disconnect.** By design. The connection stays up and the
  track is disabled, so unmuting is instant instead of a fresh handshake.
- **You see "0 peers" alone in a room.** Correct — peers are other *humans*.
  Bots have no audio.
- **Voice survives a game change.** That's the point (see
  [ARCHITECTURE.md §2](ARCHITECTURE.md#2-the-party-model)). Leaving the room is
  the only thing that stops it.
- **The mic button pulses only while you're actually speaking,** not whenever
  you're unmuted. A permanently pulsing button is decoration; one that pulses
  when your voice is going out is feedback.
