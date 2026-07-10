# Codenames — Full Design Document (AR/EN)

Bilingual (Arabic/English) Codenames for **Safariyat Games**, built on the existing
Liar's Bar server/client architecture and rendered in the same warm sticker-style
theme as the landing page.

This document is the single source of truth. It is split into:

1. [Product summary](#1-product-summary)
2. [Visual theme spec](#2-visual-theme-spec) (tokens taken from `web/src/pages/Landing.tsx`)
3. [Game rules & logic spec](#3-game-rules--logic-spec)
4. [Word lists — where words come from](#4-word-lists--where-words-come-from)
5. [Server design](#5-server-design)
6. [Socket API spec](#6-socket-api-spec)
7. [Client design](#7-client-design)
8. [Task breakdown](#8-task-breakdown) — small, ordered tasks with acceptance criteria,
   written so each can be handed to a lower-cost model independently.

---

## 1. Product summary

- Two teams — **Red** (`#E8574A`) and **Teal** (`#3AA6A6`, replaces classic blue to match the site palette).
- Each team has one **Spymaster** (يعطي التلميح) and one or more **Operatives** (يخمّنون).
- A 5×5 board of 25 word cards. The spymaster sees the secret key (which card belongs to whom); operatives don't.
- Spymaster gives a one-word clue + a number. Operatives guess cards one at a time.
- First team to reveal all its words wins. Revealing the **assassin** (الاغتيال) card loses instantly.
- Board language chosen at room creation: **Arabic** or **English**. Full RTL support for Arabic.
- Server-authoritative like Liar's Bar: the key never leaves the server except to spymasters.
- v1 has **no bots and no turn timer** (both listed as v2 in Task 12).

Player counts: **4–10** (each team needs 1 spymaster + ≥1 operative to start).

---

## 2. Visual theme spec

All values are lifted from `web/src/pages/Landing.tsx`. Reuse them verbatim — do not
invent new colors.

### 2.1 Color tokens

| Token | Hex | Usage in Codenames |
|---|---|---|
| `cream` | `#FDF6EC` | Page background, text on dark/colored surfaces |
| `ink` | `#2B2420` | Borders, headings, the **assassin** card |
| `red` | `#E8574A` | Red team: revealed cards, buttons, badges |
| `teal` | `#3AA6A6` | Teal team: revealed cards, buttons, badges |
| `textSecondary` | `#5B5147` | Body copy |
| `textMuted` | `#8A7F73` | Hints, sub-labels, footer |
| `peach` | `#F4C89A` | Revealed **neutral** cards, decorative panels |
| `paleTeal` | `#CFE3E1` | Panel backgrounds (e.g. game log) |
| `disabledBg` | `#E7E1D8` | Disabled buttons, unrevealed-card back tint |
| `disabledText` | `#A79C8E` | Disabled button text |
| `white` | `#FFFFFF` | Card faces, panels |

### 2.2 Shape & shadow language ("sticker style")

- Panels/cards: `background #FFFFFF`, `border: 3px solid #2B2420`, `borderRadius: 24`,
  `boxShadow: 6px 6px 0 #2B2420`.
- Small cards (the 25 word tiles): `border: 2px solid #2B2420`, `borderRadius: 12`,
  `boxShadow: 3px 3px 0 rgba(43,36,32,0.25)`.
- Buttons: pill shape (`borderRadius: 999`), bold, solid fill, no border (primary) or
  `2px solid #2B2420` on white (secondary).
- Badges: pill, 12px bold text, colored fill with `#FDF6EC` text.
- Entry animation: reuse the existing `dc-pop-in` keyframes; float badges with `dc-float-badge`.

### 2.3 Typography & RTL

- Arabic UI: `'Tajawal', sans-serif`; English UI: `'Baloo 2', sans-serif'` (already loaded).
- Buttons always use `'Baloo 2', sans-serif'` **except** when the label itself is Arabic — then Tajawal.
- Word tiles use the font of the **board language** (not the UI language): Tajawal for Arabic
  words, Baloo 2 for English words.
- `dir` attribute comes from `useLanguage()` exactly as in `Landing.tsx`
  (`dir = isAr ? "rtl" : "ltr"`). The 5×5 grid itself is symmetric so no mirroring is needed;
  only surrounding text/panels flip.

### 2.4 Card visual states

| Card state | Face |
|---|---|
| Unrevealed (operative view) | White face, ink word centered, 2px ink border |
| Unrevealed (spymaster view) | Same, plus a small 10×10 rotated square (diamond) in the top corner colored by the card's true type (red/teal/`#8A7F73` for neutral/ink for assassin) — mirrors the `PlayingCard` diamond motif on the landing page |
| Revealed red | Fill `#E8574A`, word in `#FDF6EC`, slight press-down (shadow removed, translate 2px) |
| Revealed teal | Fill `#3AA6A6`, word in `#FDF6EC`, same press effect |
| Revealed neutral | Fill `#F4C89A`, word in `#2B2420` at 60% opacity |
| Revealed assassin | Fill `#2B2420`, word in `#FDF6EC`, brief shake animation |

---

## 3. Game rules & logic spec

### 3.1 Board setup (server-side, at `startGame`)

1. Pick 25 unique words at random from the word list of the room's `language`.
2. Randomly choose a **starting team** (red or teal).
3. Generate the **key**: 9 cards for the starting team, 8 for the other team,
   7 neutral, 1 assassin. Shuffle the assignment across the 25 positions.
4. Board card shape: `{ word: string, revealed: false, type: hidden }`. The `type` is
   only serialized to spymasters (and for all cards once revealed).

### 3.2 Turn state machine

```
lobby ──startGame──▶ playing ──win/assassin──▶ finished ──rematch──▶ playing
                        │
        turn = { team, phase }
        phase: "clue"  → waiting for that team's spymaster
        phase: "guess" → waiting for that team's operatives
```

- Game starts with `turn = { team: startingTeam, phase: "clue" }`.
- **Give clue** (spymaster of current team only, phase `clue`):
  - Payload: `{ word: string, count: number }`, `count` ∈ 1–9.
  - Sets `turn.phase = "guess"`, `guessesRemaining = count + 1` (the classic +1 bonus).
  - Appends to game log.
- **Guess** (operative of current team only, phase `guess`, card must be unrevealed):
  - Reveal the card, append to log, then resolve:
    - **Own team's card** → decrement `guessesRemaining`; if their last needed card, they **win**; if `guessesRemaining === 0`, turn passes.
    - **Other team's card** → turn passes; if it was the other team's last card, the **other team wins**.
    - **Neutral** → turn passes.
    - **Assassin** → game over immediately, **other team wins** (`winReason: "assassin"`).
  - "Turn passes" = `turn = { team: otherTeam, phase: "clue" }`, clear clue/guesses.
- **End turn / pass** (operative of current team, phase `guess`, at least 1 guess made
  is NOT required — passing before any guess is legal): turn passes.
- **Win check**: a team wins when all its cards are revealed (9 for starter, 8 for the other).

### 3.3 Clue validation (server-side)

A clue is rejected when, after normalization:

- It contains whitespace (must be a single word) or is empty / > 30 chars.
- It **exactly equals** any *unrevealed* board word.

Normalization:
- **English**: lowercase, trim.
- **Arabic**: trim, strip tashkeel/diacritics (`ً-ْ`), strip tatweel (`ـ`),
  normalize alef variants `أ إ آ → ا`, `ة → ه`, `ى → ي`.

(Substring matching — e.g. banning "قهوجي" when "قهوة" is on the board — is deliberately
out of scope for v1; exact match only.)

### 3.4 Team & role management (lobby phase only)

- Players join a team (`red`/`teal`) and pick a role (`spymaster`/`operative`).
  Default on join: unassigned (`team: null`) — shown in a "بدون فريق / No team" bucket.
- Only one spymaster per team; claiming it while taken is rejected
  (v1 keeps it simple: the seat must be free — no swap).
- Host can start when: every player has a team, both teams have exactly 1 spymaster
  and ≥1 operative.
- Roles are **locked once the game starts**. Disconnected players may reconnect
  into their seat (existing session/reconnect machinery handles this).

### 3.5 Rematch

`finished` → host triggers `codenames_rematch`: same players/teams/roles, new 25 words,
starting team alternates from the previous game. Phase back to `playing`.

### 3.6 Edge cases

- Spymaster disconnects mid-game: game keeps waiting (no timer in v1); the lobby-style
  reconnect grace applies. Show "(غير متصل / offline)" on their name.
- Duplicate guesses on a revealed card: rejected with error.
- Actions from the wrong team/role/phase: rejected with `{ error }` ack — never crash.
- Empty room: existing stale-room sweeper cleans up (no engine timers to leak in v1;
  `destroy()` is a no-op that must stay idempotent).

---

## 4. Word lists — where words come from

**No external API and no runtime fetch.** Words are static, curated TypeScript arrays
shipped with the server, exactly like card assets today. This keeps the game offline-safe,
deterministic, and free.

### 4.1 Files

```
server/src/games/codenames/words/en.ts   → export const WORDS_EN: string[]
server/src/games/codenames/words/ar.ts   → export const WORDS_AR: string[]
server/src/games/codenames/words/index.ts → getWordPool(lang): string[]
```

### 4.2 How the lists are produced

The lists are **generated as part of Task 2** (an LLM writes them directly into the
files — this is the cheapest and safest source; do not scrape or copy the commercial
Codenames™ list verbatim). Constraints for the generator:

**English (`WORDS_EN`, exactly 400 entries):**
- Common, concrete, single words (nouns preferred): `apple`, `bridge`, `robot`, `moon`…
- 3–12 letters, lowercase in the file (render uppercase in UI), letters only (no spaces,
  hyphens, digits).
- Recognizable at CEFR A2–B2 level; no offensive, political, or religious terms;
  no brand names.
- Good clue-ambiguity: prefer words with multiple meanings/associations
  (`bank`, `spring`, `star`) over narrow technical terms.
- No duplicates, no plural+singular pairs of the same word.

**Arabic (`WORDS_AR`, exactly 400 entries):**
- Modern Standard Arabic nouns familiar across dialects: `قمر، جمل، مفتاح، قهوة، قلعة، بحر…`
- **No diacritics/tashkeel** in the stored words; no tatweel; single words only (`ال…` prefix allowed sparingly, prefer bare nouns).
- 2–10 characters; concrete, everyday, culturally familiar (food, animals, places,
  objects, nature, professions); include some regionally beloved items
  (`كنافة، سوق، واحة، عود…`).
- Avoid words that are only distinguishable by diacritics from another list entry
  (after the normalization in §3.3, all entries must still be unique).
- No offensive, political, or religiously sensitive terms.

### 4.3 Selection at runtime

`generateBoard(lang, rng)` shuffles the pool (Fisher–Yates) and takes the first 25.
A unit test asserts: pool length === 400, all entries unique **after normalization**,
and every entry passes the constraints above (regex checks).

---

## 5. Server design

New engine directory, following `games/liars-bar/` conventions:

```
server/src/games/codenames/
├── CodenamesGame.ts    # implements GameRoom (games/types.ts) — all rules from §3
├── board.ts            # pure functions: generateBoard(), generateKey(), normalize()
├── validation.ts       # validateClue(), plus payload shape guards
└── words/              # §4
```

### 5.1 `CodenamesGame implements GameRoom`

Reuses the existing `Player` class from `games/liars-bar/Player.ts` **as-is**
(the `GameRoom` interface is typed to it; `hand` simply stays empty). Codenames-specific
per-player data (team, role) lives in a `Map<playerId, { team, role }>` inside the engine —
do **not** modify `Player.ts`.

Interface obligations:

| Member | Codenames behavior |
|---|---|
| `gameId` | `"codenames"` |
| `phase` | `"lobby" \| "playing" \| "finished"` |
| `maxPlayers` | from options, clamped 4–10 |
| `addPlayer/getPlayer/handleDisconnect/handleReconnect` | same semantics as Liar's Bar (copy the pattern) |
| `addBot` | `throw new Error("Bots are not supported in Codenames")` — the `add_bot` handler's caller path is host-only and the ack path returns the error (v1) |
| `removeBot` | return `false` |
| `canStart()` | team/role validation from §3.4 |
| `startGame()` | build board+key (§3.1), set turn, broadcast, return state |
| `toState()` | **public** state: board with `type` only on revealed cards, teams, turn, clue, log, winner |
| `toPlayerState(id)` | `toState()` + `role`/`team` for that player + full `key` **iff** they are a spymaster |
| `destroy()` | no-op (idempotent) — v1 has no timers |

Engine methods (all return `{ success: boolean; error?: string }` and call
`this.broadcast(this.toState())` on success — same style as `GameManager`):

```ts
joinTeam(playerId, team: "red" | "teal", role: "spymaster" | "operative")
giveClue(playerId, word: string, count: number)
guessCard(playerId, cardIndex: number)   // 0–24
endTurn(playerId)
rematch(playerId)                        // host only
```

### 5.2 Public state shape (what `toState()` broadcasts)

```ts
interface CodenamesState {
  roomId: string;
  gameId: "codenames";
  phase: "lobby" | "playing" | "finished";
  language: "ar" | "en";
  maxPlayers: number;
  players: PlayerData[];                     // existing toPublicData()
  assignments: Record<string, { team: "red" | "teal" | null; role: "spymaster" | "operative" | null }>;
  board: { word: string; revealed: boolean; type?: CardType }[]; // type present only when revealed
  startingTeam: "red" | "teal" | null;
  remaining: { red: number; teal: number };  // unrevealed cards per team
  turn: { team: "red" | "teal"; phase: "clue" | "guess" } | null;
  clue: { word: string; count: number; guessesRemaining: number } | null;
  log: LogEntry[];                           // capped at last 50 entries
  winner: "red" | "teal" | null;
  winReason: "all_revealed" | "assassin" | null;
}
type CardType = "red" | "teal" | "neutral" | "assassin";
type LogEntry =
  | { kind: "clue"; team: string; player: string; word: string; count: number }
  | { kind: "guess"; team: string; player: string; word: string; result: CardType }
  | { kind: "pass"; team: string; player: string };
```

`toPlayerState(playerId)` = `CodenamesState & { you: { playerId, team, role }, key?: CardType[25] }`.

### 5.3 Registry & `create_room` changes (⚠️ required refactor)

`socket/handlers.ts` `create_room` currently validates **Liar's Bar options for every
game** (`maxPlayers 2–6`, `deckCount 1–4`, `variant`), which would reject Codenames rooms.
Fix (Task 4):

- Add `language?: "ar" | "en"` to `CreateRoomOptions` in `games/registry.ts`.
- In the handler, keep only the `playerName` / session / rate-limit checks generic.
  Move the Liar's Bar-specific checks behind `if (gameId === DEFAULT_GAME_ID)`, and add a
  Codenames branch: `maxPlayers` integer 4–10, `language` must be `"ar"` or `"en"`.
- Register the factory:

```ts
registerGame("codenames", (roomId, options, callbacks) =>
  new CodenamesGame(roomId, options.maxPlayers, options.language ?? "ar", callbacks));
```

### 5.4 Private state delivery (spymaster key)

`sendPrivateHands` in `socket/emitters.ts` currently emits only `{ hand }`. Extend it:
after the existing `your_hand` emit, if `room.gameId === "codenames"`, emit
`codenames_private` with the full `toPlayerState(player.id)` to each connected human.
The engine triggers it via the existing `onHandsChanged(roomId)` callback right after
`startGame()` and `rematch()` (the key only changes at those moments; reconnects already
receive `toPlayerState` in the `reconnect_room` ack).

---

## 6. Socket API spec

Room lifecycle (`create_room`, `join_room`, `reconnect_room`, chat, disconnect) is
**already game-agnostic** — no new events needed; the client just sends
`gameId: "codenames"` and `language` in `create_room`.

New events, all following the existing thin-handler pattern with a
`codenamesMembership(callback)` narrowing helper (`room instanceof CodenamesGame`,
modeled on `liarsBarMembership`):

| Event | Payload | Engine call | Notes |
|---|---|---|---|
| `codenames_join_team` | `{ team: "red"\|"teal", role: "spymaster"\|"operative" }` | `joinTeam` | lobby only |
| `codenames_give_clue` | `{ word: string, count: number }` | `giveClue` | trim + length-cap word in handler |
| `codenames_guess` | `{ cardIndex: number }` | `guessCard` | integer 0–24 check in handler |
| `codenames_end_turn` | `{}` | `endTurn` | |
| `codenames_rematch` | `{}` | `rematch` | host only (use `hostMembership`) |

All ack `{ success: true }` or `{ error: string }`. State reaches clients via the
existing `game_state` broadcast plus `codenames_private` (§5.4). `start_game` (existing
event) works unchanged because it calls `room.canStart()` / `room.startGame()`.

---

## 7. Client design

### 7.1 Routing & pages

```
web/src/pages/codenames/
├── CodenamesHome.tsx    # /codenames        — create/join, language picker
├── CodenamesRoom.tsx    # /codenames/room/:roomId  — lobby: teams & roles
└── CodenamesGame.tsx    # /codenames/game/:roomId  — the 5×5 board
```

Routes added in `App.tsx`. The landing page's Codenames card flips from
"coming soon" to available and navigates to `/codenames`.

### 7.2 State & actions

Extend `web/src/lib/gameContext.tsx` (it already owns the socket, `emitWithAck`,
create/join/reconnect and toasts):

- Add `codenamesState: CodenamesState | null`, updated from `game_state` (when
  `state.gameId === "codenames"`) and `codenames_private` events.
- Add actions: `codenamesJoinTeam`, `codenamesGiveClue`, `codenamesGuess`,
  `codenamesEndTurn`, `codenamesRematch` — thin `emitWithAck` wrappers.
- `createRoom` gains optional `gameId` + `language` params (default stays liars-bar).
- Add all state types to `web/src/lib/types.ts` (mirror §5.2).

### 7.3 Screens (all in the §2 theme, bilingual via `useLanguage()`)

**CodenamesHome** — clone the layout skeleton of the existing `pages/index.tsx`
create/join flow: name input, room code input, plus a board-language toggle
(two pill buttons: `العربية` / `English`) and player count (4–10). Cream background,
white sticker panels.

**CodenamesRoom (lobby)** — three columns (stacked on mobile): Red panel, No-team
bucket, Teal panel. Each team panel: colored header bar (`red`/`teal` fill, cream text),
a **Spymaster seat** (one slot, diamond icon) and an **Operatives list**, with
"انضم / Join" pill buttons. Host sees a big `ابدأ اللعبة / Start game` button, disabled
(`disabledBg`/`disabledText`) until `canStart` conditions are met, with the unmet reason
under it in `textMuted`. Show the room code in a dashed-border pill with copy-on-tap
(same affordance as the Liar's Bar room screen).

**CodenamesGame (board)** — layout:

- **Top bar**: room code, turn banner — a pill filled with the current team's color:
  `دور الفريق الأحمر / Red team's turn` + phase (`ينتظر التلميح… / waiting for clue…`).
- **Score chips**: two pills `9 ●` / `8 ●` in team colors showing `remaining`.
- **Board**: CSS grid `repeat(5, 1fr)`, gap 8, square-ish tiles (`aspect-ratio: 4/3`),
  card states from §2.4. Words auto-shrink font to fit (clamp 12–18px).
- **Clue area**:
  - Spymaster on their clue phase: inline form — text input (sticker style: white,
    2px ink border, radius 12) + number stepper 1–9 + submit pill in team color.
  - Everyone else: the current clue rendered big: `«ماء» — 3` with guesses-remaining dots.
- **Action row** (operatives on their guess phase): `انهِ الدور / End turn` secondary pill.
- **Log panel**: `paleTeal` background panel, radius 24, last N entries, newest first.
- **Game over**: overlay panel in winner's color: `فاز الفريق الأحمر! / Red team wins!`,
  reason line if assassin (`💀 كشفوا بطاقة الاغتيال`), full board revealed behind it,
  host gets `العب مرة أخرى / Play again` pill (`codenames_rematch`).
- Mobile (≤480px): board stays 5 columns (tiles shrink), panels stack under it,
  log collapses behind a toggle.

### 7.4 i18n

All UI strings live in a `COPY = { ar: {...}, en: {...} }` const per page — the exact
pattern `Landing.tsx` uses (do **not** route through `lib/translations.ts`, whose keys
are Liar's-Bar-shaped). UI language and board language are independent: an Arabic-UI
user can play an English board and vice versa.

---

## 8. Task breakdown

Rules for whoever executes these:

- Do the tasks **in order**; each lists its dependencies and touches a small file set.
- Every task ends with `npm run build` (or `tsc --noEmit`) passing in the affected
  package (`server/` or `web/`).
- Copy existing patterns (`games/liars-bar/*`, `pages/Landing.tsx`) instead of inventing
  new ones. Use only the §2 color tokens.
- Don't refactor anything outside the listed files.

---

### Task 1 — Server: types & board logic (pure functions)
**Files:** `server/src/games/codenames/board.ts`, `server/src/games/codenames/validation.ts`
**Depends on:** nothing
**Do:**
- Define and export the types from §5.2 (`CardType`, `LogEntry`, `CodenamesState`, plus `Team = "red" | "teal"`, `Role = "spymaster" | "operative"`).
- `board.ts`: `shuffle<T>(arr): T[]` (Fisher–Yates, non-mutating), `generateKey(startingTeam): CardType[25]` (9/8/7/1 per §3.1), `pickWords(pool: string[]): string[25]`.
- `validation.ts`: `normalizeWord(word, lang)` (§3.3 rules exactly) and `validateClue(word, count, unrevealedWords, lang): { ok: true } | { ok: false; error: string }`.
**Accept:** `tsc` passes; `generateKey` output always has exactly 9+8+7+1 entries; `normalizeWord("أُمّة","ar") === "امه"`.

### Task 2 — Server: word lists
**Files:** `server/src/games/codenames/words/en.ts`, `words/ar.ts`, `words/index.ts`
**Depends on:** Task 1 (for `normalizeWord` used in the dedupe check)
**Do:** Generate both 400-word lists following §4.2 constraints **exactly**. `index.ts` exports `getWordPool(lang: "ar" | "en"): string[]`. Add a small self-check script or test asserting: length 400, unique after `normalizeWord`, regex-valid (EN `/^[a-z]{3,12}$/`, AR `/^[ء-ي]{2,10}$/`).
**Accept:** check passes for both lists.

### Task 3 — Server: `CodenamesGame` engine
**Files:** `server/src/games/codenames/CodenamesGame.ts`
**Depends on:** Tasks 1–2
**Do:** Implement `GameRoom` (§5.1) with the full state machine of §3: constructor `(roomId, maxPlayers, language, callbacks)`; lobby membership copied from `GameManager`'s add/reconnect/disconnect pattern; `joinTeam`, `canStart`, `startGame`, `giveClue`, `guessCard`, `endTurn`, `rematch`; `toState()` hides unrevealed card types; `toPlayerState()` adds `you` + `key` for spymasters; log capped at 50; `addBot` throws, `destroy()` no-op. Call `callbacks.broadcast(this.toState())` after every successful mutation and `callbacks.onHandsChanged(roomId)` after `startGame`/`rematch`; call `callbacks.onGameEnd(roomId, winnerTeam)` on finish.
**Accept:** `tsc` passes; every rule in §3.2–§3.6 is implemented; no timers created.

### Task 4 — Server: registry, create_room, emitters, socket handlers
**Files:** `server/src/games/registry.ts`, `server/src/socket/handlers.ts`, `server/src/socket/emitters.ts`
**Depends on:** Task 3
**Do:**
- Registry: add `language?: "ar" | "en"` to `CreateRoomOptions`; `registerGame("codenames", …)` per §5.3.
- `create_room` handler: scope the `maxPlayers 2–6` / `deckCount` / `variant` checks to `gameId === DEFAULT_GAME_ID`; for `"codenames"` validate `maxPlayers` 4–10 and `language`.
- Emitters: after the `your_hand` emit, if `room.gameId === "codenames"` also emit `codenames_private` with `room.toPlayerState(player.id)` (§5.4).
- Handlers: add `codenamesMembership` helper + the five events from §6, each ≤15 lines: shape-check payload, delegate, ack.
**Accept:** server boots; creating a liars-bar room still works exactly as before (no payload change needed from the old client); a codenames room can be created, teams joined, game started and played to a win via a socket.io test client (write a throwaway script under `server/` and delete it, or test manually).

### Task 5 — Client: types + gameContext wiring
**Files:** `web/src/lib/types.ts`, `web/src/lib/gameContext.tsx`
**Depends on:** Task 4 (event names/shapes)
**Do:** Add the §5.2 types (client copies). In `gameContext`: `codenamesState` (from `game_state` when `gameId === "codenames"`, merged with `codenames_private`), the five action wrappers (§7.2), and extend `createRoom` with optional `gameId`/`language` (backward compatible — existing callers unchanged). On `room_joined`/create ack, navigate by `state.gameId`.
**Accept:** `web` builds; Liar's Bar flow untouched (create/join/play still works).

### Task 6 — Client: CodenamesHome page + routes + landing card
**Files:** `web/src/pages/codenames/CodenamesHome.tsx`, `web/src/App.tsx`, `web/src/pages/Landing.tsx`
**Depends on:** Task 5
**Do:** Build `/codenames` per §7.3 (name, create with language + player-count options, join by code) using the §2 theme and the `COPY` bilingual pattern. Register the three routes in `App.tsx` (Room/Game pages can be placeholder stubs rendering "…" until Tasks 7–8). Landing: remove `opacity: 0.75` and the disabled button from the Codenames card; make it a `العب الآن / Play now` button navigating to `/codenames`; move the `availableLabel` badge onto it (teal fill).
**Accept:** From the landing page you can reach `/codenames`, create a room (server ack succeeds), and land on the lobby route.

### Task 7 — Client: lobby page (teams & roles)
**Files:** `web/src/pages/codenames/CodenamesRoom.tsx`
**Depends on:** Task 6
**Do:** Implement the lobby per §7.3: team panels, spymaster seat, operatives list, join buttons calling `codenamesJoinTeam`, room-code copy pill, host start button with unmet-condition hint, RTL-correct, mobile stacking. Navigate to the game route when `phase` becomes `"playing"`.
**Accept:** Two browser windows can join, pick teams/roles, and the host can start only when §3.4 conditions hold.

### Task 8 — Client: game board page
**Files:** `web/src/pages/codenames/CodenamesGame.tsx` (+ small local components in the same folder if needed, e.g. `WordTile.tsx`)
**Depends on:** Task 7
**Do:** Implement the full board screen per §7.3 and card states per §2.4: grid, turn banner, score chips, spymaster key diamonds (from the `key` in private state), clue form with validation errors surfaced via the existing toast system, guess clicks (only enabled for the right role/team/phase), end-turn, log panel, game-over overlay with rematch. Board words use the board-language font (§2.3).
**Accept:** A full game is playable end-to-end in two windows (one spymaster per side): clues, guesses, wrong-guess turn pass, assassin instant loss, normal win, rematch with swapped starting team. RTL layout verified with UI language = Arabic.

### Task 9 — Mobile & RTL polish pass
**Files:** the three codenames pages only
**Depends on:** Task 8
**Do:** At 375px width: tiles readable (font clamp), no horizontal scroll, panels stacked, log collapsible. Verify every screen in all four combos of UI language × board language. Add `dc-pop-in` entry animations and the reveal press/shake effects from §2.4.
**Accept:** No layout breakage at 375px and 1280px in both directions.

### Task 10 — README/architecture touch-up
**Files:** `ARCHITECTURE.md`, `README.md`
**Depends on:** Task 8
**Do:** Add a short "Codenames" row/section: engine location, the five socket events, the word-list files, and the `create_room` per-game validation note.
**Accept:** Docs mention codenames; no other content rewritten.

### Task 11 — QA checklist (manual)
**Depends on:** Tasks 1–9. Run through and fix anything failing:
- [ ] Liar's Bar unaffected (create → play → finish).
- [ ] Codenames AR board + AR UI, full game.
- [ ] Codenames EN board + AR UI (mixed), full game.
- [ ] Refresh mid-game as spymaster → key restored via reconnect ack.
- [ ] Refresh mid-game as operative → no key visible in DevTools network frames.
- [ ] Clue equal to a board word rejected (both languages, incl. AR diacritic variant).
- [ ] Assassin ends game instantly for both teams' views.
- [ ] Non-host cannot start/rematch; wrong-role actions rejected with toasts.
- [ ] Room code join with lowercase input works (existing uppercase normalization).

### Task 12 — v2 backlog (do NOT build now)
- Turn timer (`clue`/`guess` deadlines) — engine gains timers, `destroy()` must clear them.
- Spymaster bot (pick random own word as clue with count 1) and operative bot.
- Mixed-language boards (`language: "mixed"`, 13 AR + 12 EN words).
- Substring clue validation; clue history tooltips on tiles.
- Spectator role for players beyond team capacity.

---

## Appendix A — Bilingual copy starter (extend per page)

| Key | ar | en |
|---|---|---|
| gameTitle | كودنيمز | Codenames |
| redTeam | الفريق الأحمر | Red team |
| tealTeam | الفريق الأزرق المخضرّ | Teal team |
| spymaster | قائد التلميح | Spymaster |
| operative | مخمّن | Operative |
| giveClue | أعطِ تلميحاً | Give a clue |
| clueWord | كلمة التلميح | Clue word |
| clueCount | عدد الكلمات | Number of words |
| yourTurnClue | دورك! أعطِ تلميحاً لفريقك | Your turn! Give your team a clue |
| yourTurnGuess | دور فريقك — خمّنوا! | Your team's turn — guess! |
| waitingClue | بانتظار تلميح القائد… | Waiting for the spymaster's clue… |
| endTurn | إنهاء الدور | End turn |
| guessesLeft | تخمينات متبقية | Guesses left |
| assassinHit | 💀 كشفوا بطاقة الاغتيال! | 💀 They hit the assassin! |
| redWins | فاز الفريق الأحمر! | Red team wins! |
| tealWins | فاز الفريق الأزرق المخضرّ! | Teal team wins! |
| playAgain | العب مرة أخرى | Play again |
| boardLanguage | لغة الكلمات | Board language |
| needTeams | كل فريق يحتاج قائداً ومخمّناً واحداً على الأقل | Each team needs a spymaster and at least one operative |
