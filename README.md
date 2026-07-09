# Liar's Bar

Online multiplayer bluffing card game (cards & dominoes variants) with bots, voice chat, themes, and English/Arabic support.

- **`server/`** — Node.js + Express + Socket.IO game server (TypeScript)
- **`web/`** — React + Vite + Tailwind client

## Run locally

Requires Node.js 18+.

**Terminal 1 — server:**

```bash
cd server
npm install
npm run dev        # starts on http://localhost:3001
```

**Terminal 2 — web client:**

```bash
cd web
npm install
npm run dev        # starts on http://localhost:5173
```

Open http://localhost:5173, create a room, and share the room code (or open a second browser tab and join with it). You can also fill the room with bots.

To test from another device on your LAN, copy `web/.env.example` to `web/.env` and set `VITE_BACKEND_URL` to your machine's LAN IP (e.g. `http://192.168.1.22:3001`), and make sure the IP is listed in the server's `ALLOWED_ORIGINS`.

### Useful scripts

| Where | Command | What it does |
|---|---|---|
| `server/` | `npm run dev` | Dev server with auto-reload (tsx watch) |
| `server/` | `npm run build && npm start` | Compile to `dist/` and run production build |
| `server/` | `npm run typecheck` | Type-check without emitting |
| `web/` | `npm run dev` | Vite dev server with HMR |
| `web/` | `npm run build` | Production build to `web/dist/` |
| `web/` | `npm run lint` | ESLint |

### Environment

Copy `.env.example` to `.env` in each package. Key variables:

- `server/.env` — `PORT`, `ALLOWED_ORIGINS` (comma-separated CORS origins)
- `web/.env` — `VITE_BACKEND_URL`, optional Firebase keys for Google sign-in

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module layout, how to add a new game or feature, and scaling notes.
