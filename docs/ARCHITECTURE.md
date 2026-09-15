# Architecture

> How the whole thing fits together, what each technology was chosen instead of,
> and which decisions I'd expect a future maintainer to want to revisit.

---

## 1. The shape of it

```
                    ┌──────────────────────────────────────────┐
                    │  web/  React + Vite (static, on Vercel)  │
                    │                                          │
                    │  GameProvider ── one socket, one room    │
                    │  VoiceProvider ─ full-mesh WebRTC        │
                    │  PartyDock ───── mounted above <Routes>  │
                    └───────────┬──────────────┬───────────────┘
                                │              │
             Socket.IO (state, ──┘              └── WebRTC (audio,
             intents, signalling)                    peer-to-peer)
                                │                        │
                                ▼                        ▼
         ┌──────────────────────────────────┐   ┌──────────────────┐
         │  server/  Node + Socket.IO       │   │  coturn (TURN)   │
         │                                  │   │  relay, only when│
         │  RoomRegistry ─ live rooms       │   │  direct P2P fails│
         │  PartyRoom ──── the durable room │   └──────────────────┘
         │    └─ activeSubRoom: a game      │
         │  games/* ────── rule engines     │
         └──────────────────────────────────┘
```

**Audio never touches the server.** The server only relays the WebRTC handshake
(a few kilobytes per pair, once). Once connected, voice flows peer-to-peer, or
through coturn when a direct path can't be found. This is the single most
important capacity fact about the system: a hundred rooms of six people talking
costs the game server essentially nothing.

**Game state never leaves the server.** Clients send *intents* (`play_cards`,
`domino_knock`, `party_pick_game`) and receive *state*. No client is ever told
anything it isn't entitled to know: hidden hands go out on a separate
per-socket channel, never in the public broadcast.

---

## 2. The party model

This is the one architectural idea worth understanding before anything else.

**A room is not a game.** A room is a group of people; the game is a slot
inside it that can be swapped at any time.

```
PartyRoom (code 482915, lasts all night)
  ├── players[]            ← survives every game change
  ├── leaderboard          ← wins across all games tonight
  └── activeSubRoom        ← DominoGame → CodenamesGame → LiarsBarGame → …
```

`PartyRoom` implements the same `GameRoom` interface as an actual game engine,
so the registry, the stale-room sweeper and the socket layer treat it as just
another room and need no special case. Internally it builds its sub-game through
the same factory a standalone room would use.

### Why this, rather than "a lobby that launches games"

Because the constraint that matters is social, not technical. Before this,
finishing a game and wanting a different one meant: everyone leaves, the host
makes a new room, pastes a new code into WhatsApp, six people notice it, tap it,
retype their names and re-grant microphone permission. The friction of switching
was higher than the appeal of the next game, so **one bad game choice ended the
night.** Inverting the ownership removes that cliff entirely.

### The detail that carries the whole thing

`pickGame()` rebuilds the game engine but **preserves player ids**. The WebRTC
mesh is keyed by player id, so a switch that kept the same people but reassigned
their ids would tear down and rebuild every peer connection — everyone hears two
seconds of silence and a click, at exactly the moment the group is talking most.
Preserving ids means voice does not notice the game changed.

On the client, the same concern drives one line in `voiceContext.tsx`: the peer
list is derived from the **party roster first**, not from sub-game state. During
a switch the sub-game is briefly null while the old engine is destroyed; reading
peers from it would see an empty roster for that instant and tear the mesh down.

---

## 3. Technology choices, and what they were chosen over

### Socket.IO, not raw WebSockets

| | |
|---|---|
| **Why** | Automatic reconnection with backoff, transport fallback to long-polling, per-event acks, and rooms as a first-class concept. All four are things you end up writing yourself, badly, on raw WS. |
| **Chosen over** | Raw `ws`; server-sent events + POST. |
| **The real reason** | *Acks.* Every client action is request/response (`emitWithAck`) with an error string the UI can display. On raw WebSockets you invent a correlation-id scheme within a week, and it will be worse. |
| **Cost** | ~40KB gzipped on the client, and a protocol you don't control. |
| **When to revisit** | If the bundle budget gets tight *and* reconnection is no longer load-bearing. Neither is close. |

### In-memory room state, not a database

| | |
|---|---|
| **Why** | A game room lives for 20 minutes and then stops mattering forever. Persisting it buys nothing and costs a round-trip on every single move. |
| **Chosen over** | Redis-backed rooms; Postgres with an events table. |
| **Cost** | A server restart drops every live game. Rooms cannot be shared across processes. |
| **Mitigations in place** | Reconnect grace (`emptyRoomGraceMs`, 2 min) so a page refresh or a tunnel drop doesn't lose a game; graceful shutdown that closes sockets cleanly rather than half-writing. |
| **When to revisit** | The moment you want *accounts and history* — see §7. Not before. The scaling answer for pure concurrency is sharding (§6), not a database. |

### React + Vite, not Next.js

| | |
|---|---|
| **Why** | Every meaningful page is behind a socket connection and is `noindex` anyway. There is nothing to server-render: a room's contents are private, change every second, and must not be cached. |
| **Chosen over** | Next.js (SSR/ISR); Astro; SvelteKit. |
| **Cost** | The one page that *would* benefit from SSR — the landing — ships as an empty div plus JS. Handled by putting real content in static `index.html` (§5). |
| **When to revisit** | If you add genuinely indexable content: game rules pages, a blog, per-game landing pages in Arabic. At that point SSR for `/` and the rules pages, with the app still client-only, is the right shape. |

### Tailwind + CSS custom properties, not a component library

| | |
|---|---|
| **Why** | The UI is fifteen bespoke game tables. A component library gives you buttons and dialogs — maybe 5% of the surface — and then fights you on the other 95%. |
| **Chosen over** | shadcn/ui; MUI; Chakra. |
| **How the discipline holds** | Tokens live in `index.css`, Tailwind's config exposes *only* those tokens, and primitives (`.btn`, `.field`, `.surface`) are plain CSS classes. A component reaching for a raw hex is a code-review smell with a single obvious fix. |
| **Cost** | No free accessibility from a library. Focus rings, `aria-*` and touch targets are all hand-maintained. |

### Full-mesh WebRTC, not an SFU

| | |
|---|---|
| **Why** | Rooms cap at 6–10 people. At six, mesh is 15 connections and roughly 5 × 40kbps up per person — fine on any modern phone. An SFU (LiveKit, mediasoup, Janus) means a server that transcodes or forwards every stream: real infrastructure, real bandwidth cost, real ops. |
| **Chosen over** | LiveKit Cloud; self-hosted mediasoup; Agora/Twilio. |
| **Cost** | Upload scales linearly with room size. At ~10 people a weak phone on mobile data starts to struggle. |
| **When to revisit** | If you add spectators, or a "watch a table" feature, or rooms above ~10. Mesh is quadratic and there is no clever way around that — the answer is an SFU, and the migration touches only `voiceContext.tsx`. |

### One shared contract, copied rather than imported

| | |
|---|---|
| **Why** | `server/src/shared/` holds the wire contract — every shape that crosses the network. `npm run types:sync` copies it into `web/src/lib/generated/`, and `npm run types:check` fails if a copy has drifted. |
| **Chosen over** | A `shared/` workspace package; a monorepo tool; hand-mirrored types (what this was). |
| **Why not a real package** | Both deployments build from a single directory and nothing else: the server's `Dockerfile` copies only `server/src`, and Vercel builds the web app with `web/` as its root. A cross-package import works perfectly on a developer's machine and fails in both deployments — the worst possible place to discover it. |
| **What it fixes** | The types used to be mirrored by hand, and they had already drifted: the client's copy of the domino matching rule disagreed with the server's about flipped tiles, so the UI offered plays the server then rejected. |
| **Cost** | A generated file in the repo, and a `types:sync` step when the contract changes. `types:check` runs as part of `npm test`, so forgetting it fails loudly rather than silently. |
| **Still to do** | Codenames, Rento and Liar's Bar are not yet in `shared/` — their client types are still hand-mirrored. Moving them is mechanical; the pattern is established. |

---

## 4. Server layout

| Module | Responsibility |
|---|---|
| `index.ts` | Bootstrap only: Express, Socket.IO, REST routes, graceful shutdown |
| `config.ts` | Environment. Loads `server/.env` via `process.loadEnvFile`, normalises CORS origins |
| `core/RoomRegistry.ts` | Owns live rooms + socket→player sessions; room codes; the stale-room sweeper |
| `socket/handlers.ts` | Thin: validate payload shape, authorize, delegate to the engine |
| `socket/emitters.ts` | `activeGameRoom()` unwrapping; private-state fan-out |
| `socket/rateLimit.ts` | Per-socket fixed-window limiting, no dependencies |
| `games/types.ts` | The `GameRoom` contract every engine implements |
| `games/registry.ts` | `gameId` → engine factory |
| `games/catalog.ts` | Seat limits, bot support, per-game option validation |
| `games/party/PartyRoom.ts` | The durable room (§2) |
| `games/<game>/` | One folder per engine |

### Four rules that keep it maintainable

1. **Transport never touches rules.** `handlers.ts` validates payload *shape*,
   resolves the caller from the server-side session map, and calls an engine
   method. Every rule lives in the engine.

2. **Authorization is server-side, always.** The caller's room and player come
   from `RoomRegistry.getSession(socket.id)`. A client-sent `roomId` is never
   trusted for a game action. Host-only actions additionally check `isHost`.

3. **Rooms expire via the sweeper, never on disconnect.** When the last human
   drops, the room survives a grace period so a refresh reconnects. The sweeper
   also removes finished and idle rooms, so memory can't grow without bound.

4. **Engines talk back through callbacks** (`broadcast`, `onGameEnd`,
   `onHandsChanged`) and never import Socket.IO. That's what makes
   `domino.sim.mjs` able to play 60 full matches with no network at all.

---

## 5. SEO, and why it's shaped oddly

The app is a client-rendered SPA where almost every route is deliberately
`noindex`. That leaves two things that matter, and they're not the ones people
usually optimise:

**The WhatsApp link preview matters more than the Google snippet.** Every
invited player sees the preview; only strangers see the snippet. Preview
scrapers (WhatsApp, Telegram, Slack, Discord, X) do **not** execute JavaScript,
so the OG tags must be literal text in `index.html`.

That is why `web/scripts/sync-brand.mjs` exists: `index.html`, `sitemap.xml`,
`robots.txt` and `site.webmanifest` are **generated** from `src/lib/brand.ts`.
A rename cannot leave the old name in the one place that is most publicly
visible.

For routes, `lib/seo.tsx` imperatively upserts `<title>`, meta, canonical and
JSON-LD on mount. Google renders JS and picks these up. Non-rendering crawlers
get the static defaults, which is the correct trade: the pages they'd miss are
rooms, which are `noindex` anyway.

`robots.txt` disallows `/r/`, `/j/`, `/room/`, `/game/` and `/lobby/`. Room URLs
expire, so indexing them fills the index with dead pages — and a crawler
following an invite link into a live room is noise for the people in it.

**The head is shared state, so a route that says nothing inherits a lie.**
`<Seo>` upserts into one `<head>`; only fourteen of forty pages render it, so
the rest kept whatever the previous route set — including its canonical URL and
its `index, follow`. Visibly that was a tab still saying "Chameleon" after the
party moved to Rento. Less visibly it meant rooms opened from the landing page
claimed to be the landing page. `components/RouteMeta.tsx` closes that: `<Seo>`
records which pathname it claimed, and RouteMeta fills in a default one
macrotask later for any route nobody claimed. Pages that have something
specific to say still say it and still win.

---

## 6. Scaling

Current model: one Node process holds many independent rooms. Rooms are O(1)
lookups, broadcasts are O(players-in-room), and no work crosses rooms. A single
process handles hundreds of concurrent rooms comfortably. The protections that
make that safe for public traffic:

- Rate limiting on room creation, chat and game switching (per socket).
- Input validation and length caps on names, chat and every payload.
- The stale-room sweeper, bounding memory over time.
- Reconnect grace, so a flaky connection doesn't churn rooms.

### Beyond one process

Room state is in-memory, so the path to multiple nodes is **room sharding**, not
shared state.

1. **First, run more cores.** N processes on ports 3001..300N, each *room*
   routed to one process. Because rooms never interact this scales linearly.
   Simplest router: encode the shard in the room code (a code prefix → a port)
   at a small proxy layer, or have the client ask a lookup service which node
   hosts a code.
2. **Cross-node events** (a public room list, global chat): add the Socket.IO
   Redis adapter. The code is structured so this touches only `src/index.ts`.
3. **Full statelessness** is a last resort: persist room state through
   `RoomRegistry` into Redis and rehydrate engines. `RoomRegistry` is the single
   seam — handlers never touch the `Map` directly.

Also for production: TLS in front (Caddy/nginx), sticky sessions if you're
behind a load balancer with polling fallback enabled, and ship metrics from
`/api/health` (room count + uptime).

---

## 7. What I'd build next, in order

1. **Finish the shared contract.** (§3) Domino, Spyfall, Chameleon and the
   party envelope are done; Codenames, Rento and Liar's Bar still hand-mirror
   their types. Mechanical work, and it closes an entire class of bug.
2. **Persistent identity.** A cookie-backed player id is the prerequisite for
   friends lists, stats, and matchmaking (see [MATCHMAKING.md](MATCHMAKING.md)).
4. **Server-side tests for the remaining engines.** Domino has 30 rule tests and
   a 60-match simulation; the others have none. Liar's Bar and Codenames are the
   next most rule-dense.
4. **An SFU**, if and only if you want spectators or rooms above ten (§3).

*(Route-level code splitting was on this list and is now done — first paint
went from ~261KB gzipped to 139KB. See `web/src/App.tsx` and `vite.config.ts`.)*

---

## 8. Adding a game

1. Create `server/src/games/<my-game>/` with a class implementing `GameRoom`
   (see `games/types.ts`). Put the *rules* in a pure module beside it — see
   `games/domino/rules.ts` for the pattern, and `test/domino.test.mjs` for why
   it's worth it.
2. Register the factory in `games/registry.ts`.
3. Add a `GameSpec` to `games/catalog.ts` (seat limits, bot support, option
   validation). **This is what makes the game appear in the party picker** and
   what stops a host picking it with the wrong number of people.
4. Add game-specific socket events in `socket/handlers.ts`, narrowing with
   `makeMembership(MyGame)`. Room lifecycle — create, join, reconnect,
   disconnect, chat, voice, party switching — already works.
5. On the client: state types, a page under `web/src/pages/`, actions in
   `lib/gameContext.tsx`, an entry in `lib/brand.ts` → `GAMES`, and a route in
   `pages/party/PartyHub.tsx` → `gameRoute()`.
6. You do **not** need to touch `PartyDock` — invite, switch, rematch, leave and
   voice are inherited by every page automatically.

If the game has hidden information, add it to `PRIVATE_STATE_EVENTS` in
`socket/emitters.ts`. Forgetting this is the one failure mode that ships
silently: the game works and every hand is empty.
