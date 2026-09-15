# Handover — overnight session

Everything below is committed. Each commit message explains its own reasoning
in detail; this is the map.

---

## Read this first

**1. The rename and the redesign were reverted at your request.** I proposed
"Lamma" and a dark ink-and-coral palette; you asked for Safariyat Games and the
old cream-and-ink system back, and that is what ships. The argument for renaming
is still in [`docs/BRANDING.md`](docs/BRANDING.md), marked as a rejected
proposal, in case you want the domain shortlist later. Nothing about hosting
changed either way.

Domino also lost everything that was sitting above the board — scoreboard, seat
cards, the reading-the-table panel — and no longer dims the tiles that don't
fit. Working out what you can play is the game; the screen had been doing it
for you.

**2. Domino is a different game now.** Egyptian street rules — partners across
the table, all 28 tiles dealt, no boneyard, knock when you're stuck, race to
101. The old one was a generic Western block game and had five bugs that each
broke a match on their own.

**3. A room is no longer a game.** This is the big one, and everything else
follows from it. See below.

---

## The main thing: you never re-send a WhatsApp link again

You said this was the biggest problem. It was, and it's fixed.

A room used to *be* a game. Finishing domino and wanting Codenames meant
everyone leaves, host makes a new room, pastes a new code into WhatsApp, and
six people have to notice it, tap it, retype their names and re-grant
microphone permission. The friction of switching was higher than the appeal of
the next game, so one bad choice ended the night.

Now the **party** is the durable thing and the game is a slot inside it:

```
Party 482915  ← the code, all night
  ├── the people          survives every game change
  ├── the voice call      never drops
  ├── tonight's scoreboard  wins across every game
  └── the game            domino → Codenames → Spyfall → …
```

- A control dock sits at the bottom of **every** game page: invite, switch
  game, rematch, mic, leave. Adding a new game inherits it for free.
- `/j/123456` is the invite link. It shows "4 people playing Domino" before
  asking for a name, remembers the name, and tells you immediately if the room
  is gone.
- Someone who taps the link mid-hand **waits in the hub and is dealt into the
  next game** instead of being told "game already in progress".
- Voice survives the switch because player ids are preserved across it. That
  one detail is load-bearing; it's commented in the code.

`cd server && npm run test:party` proves the whole flow over real sockets.

---

## What's new to play

| Game | Players | Why it's here |
|---|---|---|
| **Domino** (rebuilt) | 2–4 | Egyptian street rules. The knock-memory panel is what makes it readable |
| **Spyfall** — برا اللعبة | 3–10 | Pure conversation — the best possible fit for a voice product. 30 locations, culturally local |
| **Chameleon** — الحرباية | 3–10 | One word each, 90-second rounds. 12 topic grids |
| **Would You Rather** — لو خيّروك | 3–10 | Not what you'd pick — what your friends think you'd pick. The reveal is a screenshot every time |
| **Bluff** — بلوف | 3–10 | Everyone invents the missing word, then tries to spot the real one. The first game here where the players make the content |
| **Taboo** — تابو | 4–12 | Describe the word without saying the four under it. **Start here if you only try one** |

**Taboo is the one to show people.** Every other game is *better* with voice;
that one doesn't exist without it — the whole round is somebody talking fast
while a room shouts over them — so it is the clearest possible argument for the
thing this product has that a board-game site doesn't. It is also the game your
friends have most likely already played in a living room, so nobody has to be
taught it. Teams are drawn automatically, so it starts on one tap.

None of the five has bots, deliberately — a bot that can't bluff under
questioning is worse than an empty seat, because it looks like a player who
stopped responding and the table wastes the round suspecting it. Use
`node test/seat-bots.mjs <CODE>` if you want to look at them alone; it can now
drive Codenames, Bluff and Taboo too.

---

## Bugs found and fixed (you said "problems in every game" — you were right)

**Seven of thirteen engines never reported a winner.** tictactoe, snake, tetris,
memory-puzzle, space-invaders, snake-ladder, fighter and rento all finished
without calling `onGameEnd` — so more than half the catalogue contributed
nothing to the party scoreboard. Silent, because a missing callback throws
nothing.

**Six engines broke `join_room` entirely.** They used phase names
(`"countdown"`, or none at all) that the transport layer didn't recognise, so
joining a standalone Tetris/Snake/Tic-Tac-Toe/Fighter/Memory/Space-Invaders room
was rejected with "game already in progress" on a room that was live and empty.
Same cause made `add_bot` fail and stopped the sweeper from expiring finished
rooms for two hours instead of ten minutes.

**The server never loaded `.env`.** `PORT` and `ALLOWED_ORIGINS` were always
unset, and an unset `ALLOWED_ORIGINS` defaulted to `["*"]` — which the CORS
library matches by *exact string*, so the fallback meant to allow everything
allowed nobody. Presented as "API is up, curl works, every browser request
fails".

**Domino:** teams were array indices, so a player leaving mid-match silently
swapped partners; disconnected seats were skipped forever, so a four-handed
game with one dropout could be neither won nor blocked and hung until the
sweeper deleted it; the timeout handler removed the played tile twice.

**The client wiped its own private state.** The public broadcast carries no
hidden information by design, and merging it naively blanked `playable`,
`mySeat` and the Codenames spymaster key. In domino every tile rendered dim,
which looked exactly like "the game thinks I'm stuck".

**`createRoom` had 23 positional parameters.** The new domino page's "karak"
toggle was wired to nothing — no 24th slot, value silently dropped, no type
error. Now an options object.

---

## Found by actually playing it in a browser

The socket-level tests all passed. These only showed up by driving the real UI,
which is worth knowing when you're deciding how much to trust a green test run.

**Switching games from inside a game did nothing visible.** The switch button is
on every page; the code that *navigated* to the new game was only on the hub. So
the server moved on and everyone kept staring at the old board. That's the
headline feature, half-broken, with no error.

**Seven of twelve games showed a "join this lobby" form** to players who were
already in the room — every arcade game, because the shared lobby shell predates
parties and didn't recognise one.

**The language reset on every page load.** An Arabic speaker had to toggle every
single time, including on the invite link they just tapped. Now remembered, and
defaulted from the browser's own languages.

**The domino board labelled its ends "LEFT" and "RIGHT"** — which in Arabic sat
on the opposite sides of the screen from the words. The labels are gone; you tap
the end you can see.

**Opening a room in a second tab left the first one a zombie** — still receiving
updates, showing you as offline, no way to work out why. It now says so.

**Domino was unplayable by a human.** On your turn every tile rendered dimmed,
both ends were disabled, and the only control on screen was "Knock". Every turn,
for every player, in every match — and the turn timer then played a legal move
on your behalf, which is how a match still reached a conclusion and is why
nothing caught it. The list of legal moves is defined as "your legal plays, *if
it is your turn*", and it was pushed while the previous player's move was being
finished. It was correctly empty, and nothing re-sent it once the turn arrived.

Worth dwelling on: three test suites passed throughout. They all exercise the
public state, which was right. The list only ever travels on the private channel
and only a real client reads it. That's what `test/domino.e2e.mjs` is for now.

**Seven of twelve games rendered a blank screen** once the lobby form was out
of the way — every arcade game again, for a different reason. They read their
state from the lobby container and only the lobby container, and in a party the
state is on the party. The picker offered them; the room went dark.

**A refresh during Liar's Bar left you holding nothing.** Every other game's
secrets travel inside the state object the reconnect already replies with. The
card hand travels on its own event, which reconnect never re-sent. The table
said thirteen cards, your hand said zero, and there was no error.

**Reloading mid-game stranded you on the hub**, looking at a Start button that
did nothing — the server was already playing, so nothing changed, so the page
never moved. It reads as a dead button; it is really a page that stopped
agreeing with the room.

**"Rematch" threw you out of the game you had just finished**, into the old
standalone lobby, which asked a player already sitting in the party to type
their name and join.

**The Codenames board was wider than the phone.** The fifth column was clipped
off the side of the screen — for a spymaster, five words and five key markers
they could not see. It was called the "teal" team, too, on a board painted
blue.

**The hand sheet covered the pile.** Liar's Bar is a game about the pile; how
much you lose by being caught is the entire decision. On a phone the sheet
covered it and three of the four players.

**Twenty-six pages wore the previous page's identity** — title, description,
canonical URL and `index, follow` alike — because the head is shared and only
fourteen pages set it. Rooms opened from the landing page claimed to *be* the
landing page, which is a good way to rank for nothing.

**The Liar's Bar table was never translated.** "Empty pile", "(you)", "Your
hand — 13 cards", "Wait for your turn", "Make Claim" — the seven strings a
player looks at most, sitting on an otherwise fully Arabic screen. The game-over
overlay, which is the last thing every player sees at the end of every match,
was entirely in English too. So was the mic control's "3 online", on four
different game headers, which an RTL line reorders to read "online 3".

**The Liar's Bar chat pill sat with 156 of its 343 pixels off the screen**, in
both languages, for as long as its slide-away animation has existed. It centres
itself with a `-translate-x-1/2` class, and an inline `transform: translateY(…)`
silently replaced it — `transform` is one property, not two.

**A deploy landing mid-session turned the next page white.** New build, new
chunk filenames, old ones no longer served; a player already in a room who
navigates to a page they haven't loaded yet gets a 404 on the import and React
unmounts the tree. No message, nothing suggesting a refresh would fix it, on a
game night.

There is now a `npm run test:live` suite covering the connection-level scenarios
these came from: refresh mid-game, second tab, host leaves, latecomer joins,
and an empty hand after a refresh.

---

## Voice

It worked when it worked; when it didn't there was no way to tell why, because
**every failure mode is silent**.

- **You can see who's talking**, including your own mic level. Previously the
  only way to know your mic worked was someone telling you.
- **Blocked autoplay is detected.** The most common "voice is broken" report:
  call connects, everyone hears you, you hear nothing, no error anywhere. Now
  one tap.
- **Dropped connections retry with backoff.** The old code called `restartIce()`
  once ever, so a phone switching from wifi to mobile data was gone for the
  night.
- **Per-peer health**, so "voice is broken" splits into four states you can act
  on. Exhausted retries now log the actual diagnosis (TURN unreachable).

[`docs/VOICE.md`](docs/VOICE.md) has a diagnosis section ordered by how often
each cause is the answer, and an expansion roadmap. The most interesting idea in
it: the level monitor already knows who is speaking, which is a game-design
input no competitor has — "Ahmed went quiet right before he played that card" is
a real tell in Liar's Bar.

---

## Speed

First paint went from **~261KB gzipped to 139KB**. Every game's client used to
ship in one chunk — Rento's board, the Fighter sprite loop, three card
renderers — downloaded before the landing page could paint. Firebase was 190KB
of that, statically imported for a sign-in feature that isn't even configured.

This matters more here than for most products: the person opening your link is
on a mid-range Android, on mobile data, inside WhatsApp's browser, while five
friends wait. A blank screen at that moment is someone going back to the chat to
say "it's not working".

---

## Documentation

| Document | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it fits together, every technology choice and **what it was chosen instead of**, scaling, what to build next |
| [docs/BRANDING.md](docs/BRANDING.md) | Why the current name doesn't work, the recommended one, ranked domains, how to switch |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, WCAG contrast table, the reasoning behind each decision |
| [docs/VOICE.md](docs/VOICE.md) | How voice works, how to diagnose it, how to grow it |
| [docs/MATCHMAKING.md](docs/MATCHMAKING.md) | Persistent parties, presence, matchmaking — **designed, not built**, in build order |
| [docs/IMAGE_BRIEFS.md](docs/IMAGE_BRIEFS.md) | Every image you need, with a paste-ready prompt and exact output path |
| [docs/CONTENT_STRATEGY.md](docs/CONTENT_STRATEGY.md) | TikTok plan, six formats, 90 concrete video ideas |

---

## Your move — in order

### 1. Register a domain (30 minutes)

`lamma.gg` first choice, `lamma.fun` second, `playlamma.com` third.
[Full list and reasoning](docs/BRANDING.md#3-domain-candidates).

Then: point it at Vercel, **301 redirect the old subdomain**, and — this one
breaks everything if you miss it — **add the new origin to `ALLOWED_ORIGINS` in
`server/.env` and redeploy the backend.** Otherwise CORS rejects the socket
handshake and every player sits on "connecting…" forever.

Then in `web/src/lib/brand.ts` set `domain`, run `npm run brand:sync`, rebuild.

### 2. Generate the images (an hour)

[docs/IMAGE_BRIEFS.md](docs/IMAGE_BRIEFS.md) — prompts are paste-ready.

**Do `og.png` first.** It's the WhatsApp link preview: seen by every single
invited player, in a chat, next to a friend's recommendation. That is the
highest-trust impression there is and it's currently a generic icon. Everything
else can wait.

Nothing is broken without them — every slot has a code-drawn fallback shipping
today.

### 3. Play a real game with real friends

Four people, one phone each, different networks. Specifically check:
- Does voice connect for everyone? (If some pairs work and some don't, it's
  TURN — see [VOICE.md §6](docs/VOICE.md#6-diagnosing-a-report).)
- Switch games mid-session. Does anyone drop?
- Have someone join halfway through.

### 4. Then build persistent parties

[MATCHMAKING.md §3](docs/MATCHMAKING.md#3-persistent-parties--the-usual-crew).
A permanent `/p/elshella` link a group **pins** in their WhatsApp chat. It's a
few days of work, it removes the "someone has to remember to start it" single
point of failure, and it's worth more than matchmaking at a fraction of the
cost. I'd do this before posting a single TikTok.

---

## Things I deliberately did not do

- **Register or buy anything.** Domains, hosting, accounts — yours to do.
- **Deploy.** Everything is committed to `main` but nothing was pushed or
  deployed. Build and test locally first, especially voice.
- **Change the repo name or the live domain.** Both are yours to decide;
  `brand.ts` makes either a one-line change.
- **Build matchmaking.** It's designed in detail and argued against as a
  priority — voice chat with friends is a feature, voice chat with strangers is
  a moderation department. Read §5 and §9 of MATCHMAKING.md before starting it.
- **Generate images.** I can't produce raster art; every one is specified
  instead, with a fallback already shipping.
- **Translate the standalone lobby menu.** ~57 English strings live on
  `/lobby/:code`'s settings screen. None of them are reachable from a party —
  that flow routes to its own hub — so they only appear on the pre-party path,
  which is on its way out. Worth doing only if you decide to keep that path.

---

## Running it

```bash
cd server && npm install && npm run dev     # :3001
cd web    && npm install && npm run dev     # :5173
```

```bash
cd server && npm test        # offline: types, engine contracts, domino rules, 60-match sim
cd server && npm run test:live   # everything below, in order — needs the server running
```

The live suite is eight files and takes a few minutes, because two of them
deliberately sit and watch a clock run out. Individually:

```bash
npm run test:party        # the party model: switch, rematch, hub, invite preview
npm run test:lifecycle    # phones: refresh mid-game, second tab, host leaves, latecomer
npm run test:spyfall
npm run test:chameleon
npm run test:wyr
npm run test:bluff
npm run test:taboo
npm run test:domino:live  # the private slice — the one the other domino tests can't see
```

**Why there are two kinds of test.** The offline ones prove rules and finish in
seconds. The live ones prove the *wire*: what each individual socket actually
receives, which is where almost every real bug in this project has been. The
single worst bug found this session — domino being unplayable by a human —
passed all three offline domino suites, because the rules were right and the
public state was right and the thing that was wrong only ever travels on the
private channel.
