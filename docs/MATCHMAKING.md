# Matchmaking, rematch, and keeping people connected

> The party system already solved "we finished a game and had to re-send the
> link". This document is about the three problems that come after it: playing
> again tomorrow, playing with strangers, and playing when your friends aren't
> online.

**Nothing in this document is built.** It is a design, with the reasoning, in
the order I'd build it. Each stage is independently useful, so you can stop at
any point and still have shipped something worth having.

---

## 1. What already works

Worth being precise about this, because it determines what's actually left.

| Problem | Status |
|---|---|
| Switch games mid-session without a new link | **Done** — `party_pick_game` |
| Play the same game again | **Done** — `party_rematch` |
| Latecomer joins mid-game | **Done** — they wait in the hub, dealt into the next game |
| Voice survives a game change | **Done** — player ids are preserved across the switch |
| Cross-game scoreboard for the night | **Done** — `PartyRoom.leaderboard` |
| **Come back tomorrow with the same group** | Not built — §3 |
| **Play when only two of five friends are around** | Not built — §4 |
| **Play with strangers** | Not built — §5 |

The gap is that **a party dies when everyone closes the tab.** The group has to
be reassembled from scratch every single night, through WhatsApp, by whoever
remembers to start it.

---

## 2. The prerequisite: persistent identity

Everything below needs one thing first, and it is genuinely the hard part.

Right now a player is `nanoid(8)` generated at join time and stored in
`localStorage`. It survives a refresh and nothing else — not a new browser, not
a cleared cache, not their other phone.

### The options, and the honest trade

| Option | Friction | What it buys |
|---|---|---|
| **Device id in localStorage** (current) | Zero | Refresh survival only |
| **Signed cookie from the server** | Zero | Survives cache clears; still one device |
| **Phone/OTP** | High | Real identity, real recovery |
| **Google sign-in** | Medium | Real identity; Firebase is already a dependency |
| **Passkey** | Low-ish | Real identity, no password; support is still uneven on older Android |

**Recommendation: signed cookie now, optional Google sign-in later.**

The signed cookie costs the player nothing — no prompt, no decision, no
interruption — and it gets you a stable id that survives most of what breaks
localStorage. That id is enough for §3 and §4, which are the valuable parts.

Sign-in only earns its friction when there is something to *lose*: a rating, a
history, a friends list worth recovering. Ask for it at that moment ("keep your
stats — sign in"), never at the door. **A sign-up wall on a game you reached
from a WhatsApp link is the single most effective way to lose the player.**

```ts
// server/src/core/identity.ts  (sketch)
//
// Not a session and not an account: an opaque, unforgeable "this browser".
// Signed so a client can't claim someone else's id, with no PII in it at all.
function issuePlayerToken(res): string {
  const id = nanoid(16);
  const sig = hmac(process.env.PLAYER_SECRET, id);
  res.cookie("pid", `${id}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 365 * 24 * 3600 * 1000,
  });
  return id;
}
```

`sameSite: "lax"` matters: an invite link arrives from WhatsApp as a top-level
navigation, which `lax` permits. `strict` would drop the cookie on exactly the
path every player takes.

---

## 3. Persistent parties — "the usual crew"

**The single highest-value feature after the party system**, and it's small.

### The problem

A group of five plays three nights a week. Every night, one person has to
remember, open the site, create a room and paste a link into WhatsApp. That
person is a single point of failure, and the night doesn't happen when they're
busy.

### The design

A party gets an optional **permanent code**. Instead of `482915` expiring when
the room empties, the host presses "keep this party" and it becomes
`lamma.gg/p/elshella` — the same address, forever.

```
PartyRoom          ephemeral, dies when empty        (today)
PersistentParty    a name, a slug, a member list     (new)
  └── spawns a PartyRoom on demand when someone opens it
```

What persists is deliberately tiny:

```ts
interface PersistentParty {
  slug: string;              // "elshella"
  name: string;              // "الشلة"
  members: Array<{ playerId: string; name: string; lastSeenAt: number }>;
  createdBy: string;
  /** Wins per member, all-time. The reason to come back. */
  standings: Record<string, { wins: number; played: number }>;
  lastPlayedAt: number;
}
```

Opening `/p/elshella` either drops you into the live room, or creates it and
drops you in. **There is no "start the party" step and no new link, ever.** The
link in the WhatsApp group from three weeks ago still works.

### Why this is the right next thing

- It removes the single point of failure. Anyone can start the night by opening
  the link they already have.
- All-time standings are a genuinely strong retention hook and cost almost
  nothing to keep. "Ahmed is up 14–11" is a reason to play tonight.
- The WhatsApp link stops being disposable. It gets pinned. That is free,
  permanent, zero-cost distribution inside exactly the groups you want.
- It needs no matchmaking, no rating, no strangers, and no moderation.

### Storage

This is the first thing that genuinely needs a database — and it needs a very
small one. A few kilobytes per party, written when a game ends. SQLite on the
VM is entirely sufficient and has no operational cost; Postgres if you already
run one. **Do not** reach for Redis: this data must survive a restart, which is
the one thing Redis is worst at without configuration.

---

## 4. Filling empty seats — "who else is around?"

### The problem

Three of five are online. Codenames needs four. Today the answer is "so we don't
play Codenames", which is a game lost to logistics rather than preference.

### Stage 1: presence (small)

Show, inside a persistent party, who is online right now.

```
الشلة
  ● Ahmed   playing        ← in another party's room
  ● Sara    online
  ○ Omar    2 days ago
  ● You
```

A "nudge" button sends a push/notification to an online member. That alone
converts a meaningful share of "we don't have enough people" into a full table,
because the usual blocker is that nobody knew anyone else was free.

Implementation is a socket presence map keyed by persistent player id — the same
structure as `RoomRegistry.sessions`, scoped to parties rather than rooms.

### Stage 2: open seats (medium)

A party can mark itself open: "we need one more for Codenames". That seat is
offered to friends-of-members first, then publicly.

This is the first point where **moderation becomes a real requirement** — see
§7. Don't build it before you're prepared to handle the consequences.

---

## 5. Playing with strangers

Deliberately last, because it is the highest-effort and the lowest-certainty
part of the roadmap.

### The honest question first

**Is this product for strangers at all?**

The entire design says no. Voice chat with people you know is the feature; voice
chat with strangers is a moderation problem. The invite link, the party model,
the night's scoreboard — all of it assumes an existing group. A product for
strangers would be a different product, with a lobby browser, a report button, a
mute-by-default policy, and someone reading abuse reports.

My recommendation: **ship §3 and §4 first, and only build §5 if the data says
people are trying to play with strangers anyway** — a public-room search that
returns nothing, invite links posted in public places, that kind of signal.

### If you do build it

**Quickplay, not a lobby browser.** One button: "Find a game". The player picks
a game and a language, lands in a queue, and is dropped into a room when it
fills. A browsable list of rooms is worse in every way: it's empty-looking when
you're small, it rewards camping, and it creates a visible graveyard of
half-full rooms that makes the product look dead.

```ts
interface QueueEntry {
  playerId: string;
  gameId: string;
  lang: "ar" | "en";
  /** Rough skill. See below — this is not a real Elo. */
  band: number;
  joinedAt: number;
}
```

**Matching rules, in priority order:**

1. **Language first, always.** A Codenames table where two people read Arabic
   and two read English is not a game. This is a hard filter, never a
   preference.
2. **Fill fast, sort loosely.** Match a full table as soon as one exists;
   widen the skill band by one step every 15 seconds. A perfectly-sorted table
   nobody waited for beats a well-matched table nobody waited *through* — for
   a casual party game, wait time is the dominant quality term.
3. **Region only implicitly.** Language already does most of this work, and
   voice quality degrades gracefully. Don't add a region filter until there are
   enough players that it's free.

**Skill bands, not Elo.** These games are heavily luck-influenced — a domino
rating is mostly a measure of how the tiles fell. Three coarse bands (new /
regular / strong) derived from games played and win rate is honest and
sufficient. A four-digit rating on a game of chance is a lie that players will
correctly resent.

**Bots fill the last seat after 45 seconds** in any game that supports them.
Waiting is the thing that kills a queue; a slightly worse game now beats a
better game in three minutes. Label them clearly as bots — a hidden bot found
out is a trust problem far more expensive than the wait.

---

## 6. Rematch and continuity, refined

`party_rematch` already restarts the same game with the same settings. Three
refinements worth making, all small:

**Rematch should be a vote, not a host command.** The host leaving shouldn't end
the night, and the host being distracted shouldn't stall it. Majority of
connected humans, with a visible count. The host keeps the power to *change*
games; anyone can propose *the same again*.

**"Again?" should appear on the game-over screen itself**, prominent, with a
10-second countdown that auto-starts if nobody objects. The moment right after a
game ends is when the group is most willing and least patient — the friction of
finding a button is enough to end a session.

**Carry the seating.** In domino teams, a rematch should keep partnerships
unless someone asks to shuffle. Re-picking partners every round is exactly the
kind of small repeated negotiation that makes a group stop.

---

## 7. Moderation — the part that gets skipped

The moment strangers can reach each other (§4 stage 2, §5), this stops being
optional. What's needed at minimum, in the order it becomes necessary:

| Need | When |
|---|---|
| **Per-person local mute** | Immediately. Also just good UX — see [VOICE.md §7.2](VOICE.md#72-per-person-volume-and-local-mute--small) |
| **Kick by vote** | With open seats. Majority of the rest of the room |
| **Report** | With strangers. Needs to record room, time and reporter |
| **Rate limits on room creation** | Already in place |
| **Display-name filtering** | With strangers. A basic list per language, not a heroic effort |

**Voice cannot be moderated after the fact** — nothing is recorded, and
recording would be a much larger decision than it first appears (consent,
storage, jurisdiction, and a promise you then have to keep). So the tools have
to be *preventive*: mute, kick, and a report that leads to an account-level
consequence.

This is the strongest argument for keeping the product friends-only for as long
as possible. Everything above is real work that adds nothing for a group of
friends who already know each other.

---

## 8. Suggested order

| # | Thing | Effort | Value | Needs |
|---|---|---|---|---|
| 1 | Signed player cookie | S | — | — |
| 2 | Persistent parties (`/p/<slug>`) | M | **Very high** | 1 |
| 3 | All-time standings | S | High | 2 |
| 4 | Rematch as a vote + countdown | S | Medium | — |
| 5 | Presence in a party | M | High | 1, 2 |
| 6 | Nudge / notify | M | Medium | 5 |
| 7 | Per-person mute + volume | S | Medium | — |
| 8 | Open seats (friends-of-friends) | M | Medium | 5, 7 |
| 9 | Optional sign-in | M | Medium | 1 |
| 10 | Quickplay queue | L | Uncertain | 9, 7, moderation |

Items 1–4 are, together, roughly a week of work and cover the large majority of
the remaining "why didn't we play tonight" cases. Item 10 is a month and a
different product.

---

## 9. What I'd deliberately not build

- **A public room browser.** Empty-looking when small, camping-prone when large,
  and it makes a growing product look dead. Quickplay solves the same need
  without the graveyard.
- **Elo ratings.** Dishonest for luck-heavy party games, and they make losing
  feel expensive — which is the opposite of what a game night is for.
- **Daily streaks / energy / login rewards.** This is a product people should
  open because their friends are online, not because a counter resets. Streak
  mechanics would actively damage the thing that makes it good.
- **Global chat.** All cost, no benefit, and it's a moderation surface with no
  corresponding feature.
- **Cross-party leaderboards.** A global top-100 in a game of chance means
  nothing and invites cheating. The night's scoreboard and a party's all-time
  standings are the two scopes that are actually meaningful.
