# Lamma — لمّة

**Online party games you play with your friends in one browser tab.**
One room, one link, a dozen games, and voice chat that doesn't drop when you
switch between them.

> Live at https://games.safariyat.live
> The brand name lives in one file — see [docs/BRANDING.md](docs/BRANDING.md).

---

## The idea in one paragraph

A room is not a game. A room is a group of people, and the game is a slot inside
it that anyone can swap at any time. Finish domino, switch to Codenames, and the
room code, the roster, the chat, the voice call and the night's scoreboard all
stay exactly where they were. Nobody re-sends a link. That is the entire product
thesis, and everything else follows from it.

---

## Repository

```
server/   Node + Express + Socket.IO game server (TypeScript)
web/      React + Vite + Tailwind client
docs/     Architecture, branding, design system, voice, roadmaps
deploy/   coturn (TURN relay) config for voice
```

## Run it locally

Requires Node 20+.

**Terminal 1 — server**

```bash
cd server
npm install
cp .env.example .env
npm run dev          # http://localhost:3001
```

**Terminal 2 — web**

```bash
cd web
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

Open http://localhost:5173, start a party, and share the six-digit code — or
open a second browser tab and join with it. You can fill empty seats with bots.

To play from another device on your LAN, set `VITE_BACKEND_URL` in `web/.env` to
your machine's LAN IP, and add that origin to `ALLOWED_ORIGINS` in `server/.env`.
**Both**, or the socket handshake is rejected and every client sits on
"connecting" forever.

## Scripts

| Where | Command | What it does |
|---|---|---|
| `server/` | `npm run dev` | Dev server, auto-reload |
| `server/` | `npm test` | Offline suite: build, type-contract check, engine contracts, domino rules, 60-match sim |
| `server/` | `npm run test:live` | Everything that needs a running server (see below) |
| `server/` | `npm run test:engines` | Contracts all 13 engines must satisfy |
| `server/` | `npm run test:domino` | 30 rule checks, no network |
| `server/` | `npm run test:domino-sim` | 60 full matches + the disconnect regression |
| `server/` | `npm run test:lifecycle` | Refresh, second tab, host leaves, latecomer |
| `server/` | `npm run test:party` | Create, join, switch game, rematch, leave |
| `server/` | `npm run types:sync` | Regenerate the client's copy of the wire contract |
| `server/` | `npm run typecheck` | Type-check without emitting |
| `web/` | `npm run dev` | Vite dev server with HMR |
| `web/` | `npm run build` | Production build |
| `web/` | `npm run brand:sync` | Regenerate `index.html`, sitemap, robots, manifest from `brand.ts` |
| `web/` | `npm run lint` | ESLint |

### Testing

`npm test` needs nothing running. `npm run test:live` drives real socket
clients against a live server, so start one first:

```bash
cd server && npm run dev        # terminal 1
cd server && npm run test:live  # terminal 2
```

`node test/seat-bots.mjs <ROOM_CODE>` fills a room with scripted players. Three
of the party games deliberately have no bots, which otherwise makes them
impossible to look at in a browser on your own.

## Environment

| File | Key | Notes |
|---|---|---|
| `server/.env` | `PORT` | Default 3001 |
| | `ALLOWED_ORIGINS` | Comma-separated. Unset = allow any (fine locally, **not** in production) |
| `web/.env` | `VITE_BACKEND_URL` | Where the socket connects |
| | `VITE_TURN_URL` / `_USERNAME` / `_CREDENTIAL` | Voice relay. Without it, voice only works between players on the same network |
| | `VITE_FIREBASE_*` | Optional, for Google sign-in |

---

## Documentation

| Document | What's in it |
|---|---|
| [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) | How it fits together, every technology choice and what it was chosen *instead of*, scaling, and what I'd build next |
| [**BRANDING.md**](docs/BRANDING.md) | Why the current name doesn't work, the recommended one, a ranked domain shortlist, and how to switch |
| [**DESIGN_SYSTEM.md**](docs/DESIGN_SYSTEM.md) | Tokens, the WCAG contrast table, and the reasoning behind each decision |
| [**VOICE.md**](docs/VOICE.md) | How WebRTC voice works here, how to diagnose "voice is broken", and how to grow it |
| [**MATCHMAKING.md**](docs/MATCHMAKING.md) | Persistent parties, presence, and matchmaking — designed, not built, in build order |
| [**IMAGE_BRIEFS.md**](docs/IMAGE_BRIEFS.md) | Every raster asset with an exact prompt and output path |
| [**CONTENT_STRATEGY.md**](docs/CONTENT_STRATEGY.md) | TikTok plan, six formats, 90 days of video ideas |
| [DEPLOY.md](DEPLOY.md) | Deployment |
| [VOICE_TURN_SETUP.md](VOICE_TURN_SETUP.md) | coturn setup on the VM |

---

## Games

| Game | Players | Notes |
|---|---|---|
| **Domino** | 2–4 | Egyptian street rules: partners, all 28 tiles dealt, knock when stuck, race to 101 |
| **Spyfall** — برا اللعبة | 3–10 | Everyone knows the place except the spy. 30 locations, pure conversation |
| **Chameleon** — الحرباية | 3–10 | One word each. 12 topic grids. Ninety-second rounds |
| **Would You Rather** — لو خيّروك | 3–10 | Not what you'd pick — what your friends think you'd pick |
| **Bluff** — بلوف | 3–10 | Invent the missing word, then spot the real one. 38 prompts, both languages |
| **Liar's Bar** | 2–6 | Bluffing card game. Cards or dominoes variant |
| **Codenames** | 4–10 | Fully bilingual — the whole board plays in Arabic or English |
| **Higher or Lower** | 2–6 | Fast number-guessing race |
| **Rento** | 2–6 | Property trading, on a turn timer |
| Arcade | 1–10 | Tetris, Snake, Tic-Tac-Toe, Memory, Space Invaders, Fighter, Snakes & Ladders |

Every one of them is reachable from inside a party without a new link.

Adding one: [ARCHITECTURE.md §8](docs/ARCHITECTURE.md#8-adding-a-game).
