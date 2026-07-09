# Architecture

## Overview

```
┌─────────────┐   Socket.IO (events + acks)   ┌──────────────────────────┐
│  web/ React │ ◄───────────────────────────► │  server/ Node.js         │
│  client     │        REST (/api/*)          │                          │
└─────────────┘                               │  src/index.ts  bootstrap │
                                              │  src/config.ts           │
                                              │  src/core/    rooms      │
                                              │  src/socket/  transport  │
                                              │  src/games/   engines    │
                                              └──────────────────────────┘
```

The server is authoritative: all game rules run server-side, clients only send
intents (`play_cards`, `call_liar`, …) and receive state broadcasts. Private
hands are sent only to their owner via the `your_hand` event; the public
`game_state` broadcast never contains hidden cards.

## Server layout (`server/src/`)

| Module | Responsibility |
|---|---|
| `index.ts` | Bootstrap only: Express + Socket.IO wiring, REST routes |
| `config.ts` | All environment/tunable values in one place |
| `core/RoomRegistry.ts` | Owns live rooms + socket→player sessions; room codes; stale-room sweeper |
| `socket/handlers.ts` | Thin socket event handlers: validate input, authorize, delegate to the game engine |
| `socket/emitters.ts` | Shared emit helpers (`sendPrivateHands`, `broadcastState`) |
| `socket/rateLimit.ts` | Per-socket fixed-window rate limiting (no external deps) |
| `games/types.ts` | `GameRoom` contract every game engine implements |
| `games/registry.ts` | Maps `gameId` → engine factory (`create_room` picks the game) |
| `games/liars-bar/` | The Liar's Bar engine: `GameManager` (rules + phases + timers), `Deck`, `Player`, `BotAI`, `Validation` |

### Key design rules

1. **Transport never touches game rules.** `socket/handlers.ts` only validates
   payload shape, resolves the caller's room/player from the server-side
   session map, and calls engine methods. All rules live in the engine.
2. **Authorization is server-side.** The caller's room and player identity come
   from `RoomRegistry.getSession(socket.id)` — a client-sent `roomId` is never
   trusted for game actions. Lobby management (`start_game`, `add_bot`,
   `remove_bot`) additionally requires `player.isHost`.
3. **Rooms expire via the sweeper, not on disconnect.** When the last human
   disconnects the room survives for a grace period (`emptyRoomGraceMs`) so a
   page refresh can reconnect. The sweeper also removes finished and idle
   rooms, so memory can't grow unbounded.
4. **Engines talk back through callbacks** (`broadcast`, `onGameEnd`,
   `onHandsChanged`) — they never import Socket.IO, which keeps them unit-testable.

## How to add a new game

1. Create `server/src/games/<my-game>/` with an engine class that
   `implements GameRoom` (see `games/types.ts`): lobby membership,
   `startGame`, `toState`/`toPlayerState`, `destroy`. Model it on
   `games/liars-bar/GameManager.ts`.
2. Register a factory in `games/registry.ts`:
   ```ts
   registerGame("my-game", (roomId, options, callbacks) => new MyGame(...));
   ```
3. Add game-specific socket events in `socket/handlers.ts`, narrowing the room
   with `instanceof MyGame` (see `liarsBarMembership` for the pattern). Room
   lifecycle events (create/join/reconnect/disconnect/chat/voice) already work
   for any registered game — the client sends `gameId: "my-game"` in
   `create_room`.
4. On the client, add the state types to `web/src/lib/types.ts`, a page under
   `web/src/pages/`, and actions in `web/src/lib/gameContext.tsx` (the
   `emitWithAck` helper handles the request/ack pattern).

## How to add a feature to Liar's Bar

- **New rule/option:** add the option to `CreateRoomOptions`
  (`games/registry.ts`), validate it in the factory, thread it through
  `GameManager`'s constructor, and expose it in `toState()` so the client can
  render it.
- **New player action:** add a public method on `GameManager` returning
  `{ success, error? }`, then a thin handler in `socket/handlers.ts` using
  `liarsBarMembership`. Broadcast via the existing callbacks.
- **Bot behavior:** everything lives in `games/liars-bar/BotAI.ts`; difficulty
  profiles are plain data at the top of the file.

## Scaling notes

Current capacity model: one Node process holds many independent rooms
(≤ 6 players each). Rooms are O(1) lookups, broadcasts are O(players-in-room),
and there is no cross-room work, so a single process comfortably handles
hundreds of concurrent rooms. Protections added for public traffic:

- **Rate limiting** on room creation and chat (per socket).
- **Input validation & length caps** on names, chat, and all payloads
  (malformed payloads can't crash the process or bloat memory).
- **Stale-room sweeper** bounds memory over time.
- **Reconnect grace** avoids losing games (and churning rooms) on refresh.

### Scaling beyond one process

Room state is in-memory, so the path to multiple nodes is **room sharding**,
not shared state:

1. **First: run more cores.** Run N server processes on ports 3001..300N and
   route each *room* to one process. Because rooms never interact, this scales
   linearly. The simplest router: encode the shard in the room code (e.g. code
   prefix → port) at a small proxy layer, or have the client ask a lookup
   service which node hosts a room code.
2. **Cross-node broadcasts (chat/lobby lists):** if you later need events that
   span nodes, add the Socket.IO Redis adapter (`@socket.io/redis-adapter`) —
   the code is structured so this touches only `src/index.ts`.
3. **Full statelessness (last resort):** persist room state through
   `RoomRegistry` into Redis and rehydrate engines via
   `Player.fromData`-style serialization. `RoomRegistry` is the single seam —
   handlers never touch the `Map` directly.

Also relevant for production: put the server behind TLS (e.g. Caddy/nginx or a
platform like Fly/Railway), enable sticky sessions if you use Socket.IO
polling fallback behind a load balancer, and ship logs/metrics from
`/api/health` (it reports room count + uptime).
