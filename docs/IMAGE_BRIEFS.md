# Image briefs

> Every raster asset the product wants, with a prompt you can paste into an
> image model, the exact output path, and what it's for.
>
> **The app works without all of them.** Every slot has a code-drawn fallback
> already shipping — emoji, SVG, or a CSS gradient — so nothing looks broken
> while these don't exist. Drop the file at the stated path and it takes over.

---

## How to use this file

1. Generate at the stated size (or larger, then downscale — never upscale).
2. Save to the exact path under `web/public/`.
3. Convert photographs and illustrations to **WebP** at quality ~82. PNG only
   where transparency is required (icons, logo marks).
4. Run `npm run build` in `web/` and check the page.

### The house style, in one paragraph

Warm, slightly grainy, hand-illustrated. Think a good board-game box from the
1970s rather than a mobile-game store icon. **Flat colour with texture, not
gradients and gloss.** Warm near-black backgrounds (`#14100E`), a single coral
accent (`#E8563F`), cream (`#F5EDE2`) for anything light. Visible paper or
canvas grain. No lens flares, no drop shadows on everything, no 3D renders, no
chrome, no neon. Egyptian/Levantine cultural cues where people or places appear
— this is not a generic global product and shouldn't look like one.

**Put this style block at the end of every prompt in this file:**

> Style: warm hand-illustrated flat vector with subtle paper grain, 1970s
> board-game box art. Limited palette: warm near-black #14100E background,
> coral #E8563F accent, cream #F5EDE2, muted teal #3BD9A4, warm gold #F2B441.
> No gradients, no gloss, no 3D render, no lens flare, no text in the image.
> Slightly imperfect hand-drawn linework.

**"No text in the image"** is important and easy to forget. Image models produce
convincing gibberish in Arabic and mangled kerning in English. All text is
overlaid in HTML, where it is also translatable, selectable and accessible.

---

## Priority 1 — ship these first

These three are the ones that are actually seen by users who haven't opened the
app yet.

### 1.1 Open Graph / link preview image ⭐ **most important asset in the project**

**Path:** `web/public/og.png` · **Size:** 1200 × 630 · **Format:** PNG

This is what renders as the WhatsApp link preview. **Every single invited player
sees it**, usually before they see anything else, on a phone, in a group chat,
next to a message from a friend. It matters more than any other image and more
than any search result.

Design constraints that come from that:
- It is rendered **small**. WhatsApp shows it at roughly 350px wide. Anything
  smaller than about 1/8 of the frame will be invisible.
- The brand name is overlaid **in the image** here (this is the one exception to
  the no-text rule) because there is no HTML around a link preview.
- It must read as *an invitation from a friend*, not as an advert.

> A warm overhead view of a low table at night with three or four pairs of
> hands around it — mid-game, relaxed, mid-conversation. On the table: domino
> tiles laid out in a line, a couple of playing cards, two small glasses of tea.
> One chair space at the near edge is empty and clearly waiting, with an open
> gap in the circle of hands pointing toward the viewer. Warm lamp light from
> above the table, deep warm-black surroundings. The composition leaves the
> upper-left third relatively empty for a logo overlay.
>
> [style block]

Then overlay, in HTML-to-image or a design tool:
- The logo mark (dots-in-a-ring with a gap) + wordmark, upper-left, cream.
- The tagline underneath in Baloo 2, ~48px equivalent.
- Nothing else. No URL, no buttons, no feature list.

**Also produce an Arabic variant** at `web/public/og-ar.png` with the Arabic
tagline (اللمة على بعد لينك). Same artwork; only the overlaid text changes.

### 1.2 App icon

**Path:** `web/public/icon.png` · **Size:** 512 × 512 · **Format:** PNG
**Also:** `web/public/favicon.png` at 192 × 192 (same art, downscaled)

> A bold, simple mark: seven filled circles arranged in a ring with one gap in
> the upper-right, where a single outlined circle sits instead of a filled one.
> Filled circles in coral #E8563F on a warm near-black #14100E rounded-square
> background. The outlined circle is muted teal #3BD9A4. Generous margin — the
> ring occupies about 62% of the frame. Perfectly flat, no shadow, no gradient.
> Crisp geometric circles.

The gap is the empty seat. It is the entire brand idea in one shape, and it
survives being 32 pixels wide, which almost nothing else does.

`web/src/components/brand/Logo.tsx` already renders this as SVG for in-app use —
generate the raster only for the places that require a file (favicon, app icon,
OG, social avatars).

### 1.3 Maskable icon

**Path:** `web/public/icon-maskable.png` · **Size:** 512 × 512 · **Format:** PNG

Same mark, but the ring must fit inside the **safe zone**: a centred circle
covering 80% of the frame. Android crops installed-app icons to a device-chosen
shape (circle, squircle, teardrop), and anything outside that circle can be
clipped. Fill the entire 512×512 with `#14100E` — no transparency, or the crop
shows the wallpaper through your icon.

---

## Priority 2 — game card art

Shown on the landing page and in the party game picker. **Currently rendering as
a large emoji on a tinted square, which is honestly fine** — treat these as an
upgrade, not a gap.

**All:** 800 × 600 · **WebP q82** · Path stated per game.
Referenced from `web/src/lib/brand.ts` → `GAMES[].art`.

Compositional rule for all of them: a **scene, not an object**. A photo of
domino tiles says "tiles"; a table with four hands around it says "an evening
with your friends", which is what is being sold. Leave the lower third
relatively quiet — the card overlays text there.

### 2.1 Domino — `web/public/art/games/domino.webp`

> Overhead view of a domino game in progress on a dark green felt table. A line
> of ivory domino tiles snakes across the surface, one double tile turned
> perpendicular. Four sets of hands at the edges of frame, one hand mid-way
> through placing a tile. Two small glasses of black tea in the corner. Warm
> overhead lamp light, deep shadows at the edges.
>
> [style block]

### 2.2 Liar's Bar — `web/public/art/games/liars-bar.webp`

> A dim table with a pile of face-down playing cards in the centre, cards
> slightly scattered and overlapping. Four pairs of hands around the edge —
> one hand is placing a card down flat while the others are still. The mood is
> tense and playful, like a held breath. One small candle or low lamp as the
> only light source, casting long shadows from the cards.
>
> [style block]

### 2.3 Codenames — `web/public/art/games/codenames.webp`

> A five-by-five grid of blank cream cards on a dark surface, viewed at a slight
> angle. A few cards have been covered with small flat tokens — some coral, some
> blue. Two hands reach in from opposite sides of the frame, one pointing at a
> card. One card in the grid is marked with a small black shape, sitting
> ominously among the others. Deliberately leave the cards blank — no words.
>
> [style block]

### 2.4 Higher or Lower — `web/public/art/games/higher-lower.webp`

> An abstract composition of large numerals cut from cream paper, scattered and
> overlapping on a warm near-black surface, some tilted. Two hands reach in from
> opposite edges, narrowing toward a gap in the middle of the numbers where one
> number is hidden face-down. A simple coral arrow pointing up and a teal arrow
> pointing down at either side.
>
> [style block]

### 2.5 Rento — `web/public/art/games/rento.webp`

> An overhead corner of a property board game: a few flat, stylised buildings in
> coral and teal standing on a dark board, small houses in rows, a scattering of
> banknotes and two dice. A hand is moving a small token along the edge. Warm
> lamp light. The buildings should read as Middle Eastern apartment blocks and
> small shopfronts rather than Western suburban houses.
>
> [style block]

---

## Priority 3 — TikTok and social

See [CONTENT_STRATEGY.md](CONTENT_STRATEGY.md) for what to actually post. These
are the static assets it needs.

### 3.1 Profile picture

**Path:** `web/public/social/avatar.png` · **Size:** 800 × 800 · PNG

The app icon (1.2), but with the ring at ~70% of the frame rather than 62% —
social avatars are displayed as small circles and need to read at 40px. Nothing
else changes.

### 3.2 Video end-card

**Path:** `web/public/social/endcard.png` · **Size:** 1080 × 1920 · PNG

The last 1.5 seconds of every video. Deliberately dull and consistent: the point
is recognition, not a finale.

> A vertical warm near-black frame, empty except for a centred logo mark: seven
> coral circles in a ring with one teal outlined circle in the gap. Lots of
> empty space above and below the mark. Very subtle paper grain over the whole
> frame.
>
> [style block]

Overlay the domain in HTML/editor beneath the mark. Keep it identical in every
video — a recognisable end-card is worth more than a clever one.

### 3.3 Reaction/thumbnail frames (optional)

**Path:** `web/public/social/frames/` · 1080 × 1920 · PNG

Three vertical backgrounds for talking-head or screen-recording overlays:
`frame-domino.png`, `frame-cards.png`, `frame-generic.png`.

> A vertical background: warm near-black with a subtle scattering of domino
> tiles [or: playing cards / abstract dots] along the bottom edge and top edge,
> leaving the central 70% of the frame completely clear for a screen recording
> to be placed over it. Very low contrast, unobtrusive, subtle grain.
>
> [style block]

---

## Priority 4 — nice to have, skip without regret

### 4.1 Empty-state illustration

**Path:** `web/public/art/empty-room.webp` · 600 × 400 · WebP

For the party hub when a host is alone.

> A single empty chair at a small round table, seen from the side, with three
> other chairs pulled back and empty around it. Warm lamp light. Melancholy but
> warm, not sad. Lots of negative space.
>
> [style block]

### 4.2 404 illustration

**Path:** `web/public/art/404.webp` · 600 × 400 · WebP

> A single domino tile lying face-down alone on a large dark empty surface, a
> long soft shadow stretching away from it. Nothing else in the frame.
>
> [style block]

---

## Checklist

Copy this into whatever you track work in.

```
Priority 1 — before any marketing push
[ ] web/public/og.png                1200x630  PNG   ← highest value asset
[ ] web/public/og-ar.png             1200x630  PNG
[ ] web/public/icon.png               512x512  PNG
[ ] web/public/favicon.png            192x192  PNG
[ ] web/public/icon-maskable.png      512x512  PNG   (80% safe zone, opaque)

Priority 2 — game cards
[ ] web/public/art/games/domino.webp        800x600
[ ] web/public/art/games/liars-bar.webp     800x600
[ ] web/public/art/games/codenames.webp     800x600
[ ] web/public/art/games/higher-lower.webp  800x600
[ ] web/public/art/games/rento.webp         800x600

Priority 3 — social
[ ] web/public/social/avatar.png      800x800   PNG
[ ] web/public/social/endcard.png    1080x1920  PNG
[ ] web/public/social/frames/*.png   1080x1920  PNG  (optional)

Priority 4 — optional
[ ] web/public/art/empty-room.webp    600x400
[ ] web/public/art/404.webp           600x400
```

---

## Notes for whoever generates these

- **Hands are the hardest thing for image models.** Expect to generate many
  variants of anything with hands in it. If a hand is wrong, crop it out — a
  partial hand at the edge of frame reads fine and is far easier to get right
  than a full one.
- **Ask for "no text" explicitly and check anyway.** Models reliably slip
  gibberish onto cards, tiles and signage. Arabic in particular comes out as
  disconnected letterforms that read as broken to any Arabic speaker, which is
  worse than having no text at all.
- **Generate at 2× and downscale.** Downscaling hides small artefacts; upscaling
  reveals them.
- **Keep every source file.** You will want to re-crop for a different aspect
  ratio within a month — stories are 9:16, OG is 1.91:1, cards are 4:3.
- **Check the OG image at 350px wide before accepting it.** That is the size it
  is actually seen at in a WhatsApp chat, and detail that reads beautifully at
  full size frequently turns to mud there.
