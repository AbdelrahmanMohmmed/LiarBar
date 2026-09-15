# Branding

> ### This is a proposal, and it was rejected.
>
> The product ships as **Safariyat Games**. The rename argued for below was
> tried and reverted at the owner's request, along with the design system that
> came with it. Everything here is kept because the *reasoning* is still the
> reasoning — if the name is ever revisited, this is the argument and the
> shortlist. Nothing in this file describes what is currently live.

> **The whole brand is one file.** Everything the user sees — name, tagline,
> domain, colours, social handles — comes from [`web/src/lib/brand.ts`](../web/src/lib/brand.ts).
> Changing the brand is editing that file, not grepping the codebase.

---

## 1. The problem with the current brand

| Issue | Why it hurts |
|---|---|
| `games.safariyat.live` is a **subdomain on a low-trust TLD** | You inherit none of a root domain's authority and can't build your own. Search engines have very little to attach a reputation to. |
| "Safariyat Games" is **descriptive, not distinctive** | "Safariyat" (سفريات = *travels*) has nothing to do with party games. Someone who hears the name once cannot guess what the site does, and cannot spell it back. |
| **Two words, one of them generic** | "Games" is among the most contested words on the internet. You will never rank for it. |
| **Not sayable in a TikTok video** | The name has to survive being said out loud once, at speed, over background music, by someone who isn't concentrating. "Safariyat Games dot Safariyat dot live" does not. |
| **Repo is called `LiarBar`** | The repo name implies a single game. The product is a games *platform*. |

A brand for this product has to clear four bars:

1. **Sayable in Arabic and English** with the same sounds. Nothing an English
   speaker will mangle, nothing an Arabic speaker finds foreign.
2. **Under 6 letters** so the domain is typeable from memory after seeing it in a video.
3. **Semantically about the gathering, not the game.** Games rotate. The gathering is the product.
4. **One word.** The domain is the brand.

---

## 2. Recommended name: **Lamma** (لمّة)

> **لمّة** — *lamma* — Egyptian/Levantine Arabic for "the get-together", the
> gathering of friends. "اللمة الحلوة" is what you call a good night in.

This is the name shipped as the default in `brand.ts`.

**Why it wins:**

- **It is literally the product.** You are not selling domino. You are selling the
  hour your friends spend together. لمّة is the exact word for that hour.
- **Five letters, two syllables, identical in both languages.** LAM-ma. No sound
  in it is hard for an English speaker, and it's already the everyday word for an
  Arabic speaker.
- **It's a noun people already use as a call to action.** "يلا لمّة؟" / "Lamma
  tonight?" The brand name doubles as the invitation — which is exactly the phrase
  that gets typed into WhatsApp when someone shares a room link.
- **It's game-agnostic.** Adding a 20th game doesn't strain the name. "Liar's Bar"
  or "Safariyat Games" both would.
- **It has a built-in mark**: a circle of people with a gap. The logo writes itself (see §5).
- **TikTok-safe.** `#lamma` and `#لمة` are organic, high-volume tags in Arabic
  social already — you are riding an existing word, not building one from zero.

**Taglines:**

| Language | Tagline | Use |
|---|---|---|
| EN | *Get the gang together.* | Hero, OG description |
| EN | *One link. Everyone's in.* | Product / feature pages |
| AR | **اللمة على بعد لينك** | Hero (Arabic) |
| AR | **لينك واحد، والباقي علينا** | Product / feature pages |

---

## 3. Domain candidates

I cannot register domains — this is your list for tomorrow. Ordered by how
strongly I'd recommend each.

| # | Domain | Why | Watch out |
|---|---|---|---|
| 1 | **lamma.gg** | `.gg` reads as *"gaming"* to the exact demographic you want, is short, and is the default for game-community brands (discord.gg has trained everyone). Pairs perfectly with a 5-letter name. | Premium pricing on `.gg`. Worth it. |
| 2 | **lamma.fun** | Says what the site is in the TLD. Cheap. Memorable in a video: "lamma dot fun". | Slightly less serious; fine for this product. |
| 3 | **playlamma.com** | `.com` still carries the most trust and the strongest "this is a real company" signal. `play` prefix is the standard pattern. | Two words again — but both are trivially spellable. |
| 4 | **lamma.games** | Exact-match TLD, very clean. | `.games` is pricey and has weaker recognition than `.gg`. |
| 5 | **lamma.live** | You already own `safariyat.live`, so you know the registrar/DNS flow. | `.live` is the weakest of this list for search. |
| 6 | **getlamma.com** | `get` prefix reads as an invitation. | Slightly longer. |
| 7 | **lamma.app** | Forces HTTPS, reads as a product. | Implies a native app you don't have. |
| 8 | **lammagames.com** | Safe fallback if everything above is gone. | Long; the word "games" dilutes. |
| 9 | **yallalamma.com** | Very Egyptian, very sayable, doubles the call-to-action. | 11 characters. |
| 10 | **lamma.club** | Fits the "private room with your friends" framing. | Low TLD recognition. |

**Before you buy**, check the name isn't already a game studio in your market —
a two-minute search on the app stores and on Instagram/TikTok saves a rename later.

### If you don't like "Lamma", these are the next-best names

Each is checked against the same four bars.

| Name | Meaning | Domain idea | Note |
|---|---|---|---|
| **Sahra** | سهرة — "a night out / evening gathering" | `sahra.gg`, `sahra.fun` | Very close second. Slightly more "night out" than "friends at home". |
| **Yalla** | يلا — "let's go", the most-exported Arabic word | `yalla.gg`, `playyalla.com` | Strongest recognition of any option, but heavily squatted — check availability first. |
| **Onsa** | أنس — companionship, good company | `onsa.gg` | Beautiful meaning, slightly more formal/literary than لمّة. |
| **Doorak** | دورك — "your turn" | `doorak.com` | Perfect for turn-based games specifically; weaker for the real-time ones. |
| **Tarabeza** | ترابيزة — "the table" | `tarabeza.gg` | Great for card/domino; 8 letters is long. |
| **Ozoma** | عزومة — "the invitation / the spread" | `ozoma.fun` | Strong invitation semantics; the `z` sound reads slightly harsher. |
| **Rafa2a** | رفقة — "companionship" | `rafaka.gg` | The hamza/qaf transliteration is a spelling trap. Weak. |
| **Kasra** | كسرة | `kasra.gg` | Nice sound, but the meaning ("a break/fragment") is semantically off. |

---

## 4. How to change the brand

Everything is driven by `web/src/lib/brand.ts`:

```ts
export const BRAND = {
  id: "lamma",
  name: "Lamma",          // ← change this
  nameAr: "لمّة",
  domain: "lamma.gg",     // ← and this once you own it
  ...
};
```

Then:

1. `npm run build` in `web/` — the landing page, every `<title>`, the OG tags,
   the JSON-LD, the manifest, the footer and the share text all update.
2. Run `npm run brand:sync` in `web/`. This regenerates the three files that must
   exist as **static** HTML/XML for crawlers that don't run JavaScript:
   `web/index.html`, `web/public/sitemap.xml`, `web/public/site.webmanifest`.
   See `web/scripts/sync-brand.mjs`.
3. Point the new domain at Vercel and add it as a domain in the Vercel project.
4. **Set up a 301 redirect** from `games.safariyat.live` to the new domain. Do not
   skip this — it transfers whatever link equity exists and stops the old URLs
   showing up as duplicates.
5. Add the new origin to `ALLOWED_ORIGINS` on the backend (`server/.env`), and
   redeploy the backend. **Voice and gameplay break without this** — CORS will
   reject the Socket.IO handshake and every player sees "connecting…" forever.

### Reverting to Safariyat

Set `name: "Safariyat Games"`, `nameAr: "سفريات"`, `domain: "games.safariyat.live"`
in `brand.ts`, run `npm run brand:sync`, rebuild. That is the entire revert.

---

## 5. Visual identity

### Logo

The mark is **dots arranged in a ring with one gap** — a gathering with a space
kept open for the person who hasn't joined yet. It is the empty seat, which is the
whole emotional pitch of the product ("send the link, there's a seat").

- The gap always points to the upper-right in the primary lockup.
- At small sizes (favicon, 32px) drop to three dots and a gap.
- The wordmark sits to the right of the mark in LTR, to the left in RTL. The mark
  itself is mirror-safe (it's a ring), so no separate RTL asset is needed.
- The live SVG version ships as a React component: `web/src/components/brand/Logo.tsx`.
  It reads its colours from the design tokens, so it is correct in every theme
  automatically and needs no raster asset at all for in-app use.

Raster assets (OG images, favicons, app icons, TikTok avatars) are specified in
[`docs/IMAGE_BRIEFS.md`](IMAGE_BRIEFS.md) with exact prompts and output paths.

### Colour

The palette is defined once in `web/src/lib/brand.ts` → `BRAND.colors`, and
emitted as CSS custom properties from `web/src/index.css`. Full rationale and the
accessibility contrast table live in [`docs/DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

Headline: a warm dark ground (not black), a single saturated coral accent for every
primary action, and a mint "live" colour used *only* for realtime state — voice on,
player connected, your turn. Keeping "live" on its own hue means a player can read
the state of the room at a glance without reading any text, which matters enormously
on a phone, mid-conversation, in a language they may be switching between.

### Typography

- **Arabic + Latin UI:** `Tajawal` — one family covering both scripts with matching
  weight and x-height, so the bilingual toggle doesn't reflow the layout.
- **Display / numerals:** `Baloo 2` — rounded, friendly, reads as "party" not
  "casino". Used for scores, room codes and headings only.
- Both are already loaded in `web/index.html`. **Do not add a third family.**

---

## 6. Repository rename

The repo is `LiarBar`, which describes one of fifteen games. Rename it to match
the brand:

```bash
git remote set-url origin https://github.com/<owner>/lamma.git
```

(Rename on GitHub first: Settings → Repository name.) GitHub keeps a redirect from
the old name, so nothing breaks immediately. The folder on disk can stay
`E:\Github\LiarBar` — it has no effect on anything.

---

## 7. What is deliberately *not* changing

- **Liar's Bar keeps its name.** It's a known game with existing search volume
  (people search "liars bar online"). It becomes a *game inside Lamma*, not the
  brand. Same for Codenames.
- **Room codes stay 6 digits.** They're read out loud over voice constantly.
  Digits are the only thing that survives being said in Arabic to someone typing
  on an English keyboard.
- **The backend host.** The API origin is never seen by users, so there's no
  branding value in moving it, and moving it costs you a TLS cert and a CORS
  outage window.
