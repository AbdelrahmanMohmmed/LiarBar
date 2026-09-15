# Design system

> Tokens live in [`web/src/index.css`](../web/src/index.css) (runtime source of
> truth) and are mirrored as raw hex in [`web/src/lib/brand.ts`](../web/src/lib/brand.ts)
> → `COLORS` for the places CSS can't reach: `<canvas>` games, `<meta theme-color>`,
> the web manifest, and generated SVG. **Keep the two in sync.**

---

## 1. The constraint that shapes everything

This product is used **on a phone, one-handed, while the user is talking to
people.** Not looked at. Used, in the background of a conversation.

That single fact decides most of the design:

- **Nothing important is conveyed by text alone.** A player has to be able to
  glance down mid-sentence and know whose turn it is. That's why "live" state
  has its own hue (§3) and why the active player is the only pulsing thing on
  screen at any moment.
- **44px minimum touch targets, everywhere, no exceptions.** Below that a thumb
  misses, and a missed tap in a turn-based game costs a turn.
- **16px minimum font size on every input.** iOS Safari zooms the viewport when
  a user focuses an input smaller than 16px, which throws them out of the game
  layout mid-game with no obvious way back.
- **No hover-only affordances.** There is no hover on a phone. Everything
  reachable by hover must also be reachable by tap or be purely decorative.
- **Bottom-anchored primary actions.** The top of a 6.7" phone is not reachable
  with one hand. Every "do the thing" button sits in the bottom third.

---

## 2. Colour

### The palette

| Token | Hex | Role |
|---|---|---|
| `--ink-900` | `#14100E` | Page ground |
| `--ink-800` | `#1C1714` | Sunken (inputs, wells) |
| `--ink-700` | `#251E1A` | Cards, sheets, the table |
| `--ink-600` | `#332A24` | Raised / hover |
| `--ink-500` | `#43382F` | Hairlines, dividers |
| `--cream`   | `#F5EDE2` | Body text |
| `--sand`    | `#B9A895` | Secondary text |
| `--coral`   | `#E8563F` | **The** accent — every primary action |
| `--mint`    | `#3BD9A4` | Realtime state ONLY |
| `--gold`    | `#F2B441` | Scores, room codes, wins |
| `--ruby`    | `#E23D57` | Errors, elimination |
| `--violet`  | `#9A6BF0` | Team B / secondary game accent |
| `--sky`     | `#4EA8F5` | Team A / info |

### Three decisions worth defending

**1. The ground is warm, not black.**
`#14100E`, not `#000000`. Pure black on an OLED phone is a physically-off pixel,
so a black background reads as a hole punched in the device rather than as a
surface. Every shadow placed on it looks like dirt because there is nothing for
the shadow to be *on*. A warm near-black gives the elevation system something to
work against, and it matches the physical objects the games are about — a felt
table, wooden tiles, a dim room.

**2. There is exactly one accent colour.**
Coral. Every primary action across fifteen games is the same colour. The
previous UI used amber, teal, green and blue as "primary" in different games,
which meant a player moving from domino to Codenames had to re-learn where the
"go" button was. Per-game personality comes from the **card art and the table
felt**, not from moving the accent around.

**3. `--mint` is reserved, not decorative.**
Mint means exactly one thing: *this is live right now.* Voice transmitting.
Player connected. Your turn. Nothing else may use it — the moment it becomes a
generic "nice green", the glance-and-know property is gone, and that property is
the single highest-value thing in the visual system for a product used while
talking.

The rule has caught real drift twice. Codenames' side panels were mapped onto
mint by a palette shim and ended up putting it on a "Show game log" button; the
WhatsApp share button used `.btn-live` for a link that is not live anything.

### The one exception: other people's brands

`.btn-whatsapp` is WhatsApp's own `#25D366`, and it is the only hard-coded
colour in `index.css`. This is the same exception that lets a "Sign in with
Google" button be Google's blue: people find those buttons by colour without
reading them, and in this market WhatsApp is not one share target among several
— it is how an invite travels. It applies to that button and to nothing else. A
new third-party button may claim the exception; a new *game* may not.

### Contrast (WCAG 2.1)

Checked against the surfaces the token is actually used on.

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `--cream` `#F5EDE2` | `--ink-900` `#14100E` | **15.9 : 1** | AAA (all sizes) |
| `--cream` | `--ink-700` `#251E1A` | **12.4 : 1** | AAA |
| `--sand` `#B9A895` | `--ink-900` | **8.1 : 1** | AAA |
| `--sand` | `--ink-700` | **6.3 : 1** | AAA normal text |
| `--coral` `#E8563F` | `--ink-900` | **4.9 : 1** | AA normal text |
| `--mint` `#3BD9A4` | `--ink-900` | **10.4 : 1** | AAA |
| `--gold` `#F2B441` | `--ink-900` | **9.9 : 1** | AAA |
| `#FFFFFF` | `--coral` (button fill) | **3.6 : 1** | AA for ≥18.66px bold — **which is why `.btn` is 700 weight and never below 0.85rem** |
| `--ink-900` | `--mint` (button fill) | **9.4 : 1** | AAA |

Two things to hold onto:

- White-on-coral is the one pairing that is *not* comfortably AA at small sizes.
  `.btn-primary` is therefore always bold and never smaller than `.btn-sm`'s
  0.85rem. If you ever need small coral text, use coral **on** ink, not ink on
  coral.
- Nothing in the system relies on the red/green distinction alone. Elimination
  (ruby) always carries an icon or strikethrough; "live" (mint) always carries a
  dot or a label. Roughly 1 in 12 men has some red-green deficiency and this
  product's audience skews male and social.

---

## 3. Elevation

Four levels, and a rule: **elevation is light, not just shadow.**

```
level 0   page ground, no shadow
level 1   --shadow-1   hairline contact shadow. Chips, inline controls.
level 2   --shadow-2   cards, panels, the table surface.
level 3   --shadow-3   modals, sheets, the mobile hand drawer.
```

`.surface-lit` adds a 1px gradient highlight along the top edge. That highlight
— not the shadow — is what actually sells "lifted toward the light". The body
has a radial warm glow from top-centre, which establishes where the light is
coming from; without a consistent light source the shadows read as smudges.

Shadows are **warm-tinted**, never neutral grey. A grey shadow on a warm ground
looks like a dirty patch.

---

## 4. Shape

```
--radius-sm    0.5rem    chips, tight controls
--radius       0.875rem  inputs, small cards
--radius-lg    1.25rem   panels, game cards
--radius-xl    1.75rem   sheets, hero surfaces
--radius-pill  999px     every button
```

**Buttons are pills. Containers are soft-squares.** Never mix — the moment a
button and its container share a radius, the button stops reading as pressable.
Three radii in one view is the maximum; more than that and the UI looks
assembled from parts rather than designed, which is exactly what the previous
version looked like.

---

## 5. Motion

Two durations, two curves. That's the whole system.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 140ms | Taps, hovers, toggles |
| `--dur` | 240ms | Panels, transitions |
| `--dur-slow` | 420ms | Cards dealt, tiles landing |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | **Default.** Anything entering or responding. |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Physical objects only — a tile hitting the table, a card dealt. |

The spring curve overshoots. Overshoot reads as *weight* when a physical object
lands, and as *noise* everywhere else. Using it on a menu makes the whole UI
feel cheap. Restrict it to `.drop-in` and card dealing.

**`prefers-reduced-motion` is honoured globally** by a single rule in
`index.css` that collapses every animation and transition to 0.01ms. This is one
rule rather than per-animation opt-outs so any animation added later is covered
automatically without the author remembering.

### Animation is feedback, not decoration

Every animation in the system answers a question the player has:

| Animation | Question it answers |
|---|---|
| `.pulse-glow` (coral) | "Is it my turn?" |
| `.pulse-live` (mint) | "Is my mic actually transmitting?" |
| `.drop-in` | "Did my tile actually get played?" |
| `.card-deal` | "Has the round started?" |
| `.skeleton` | "Is it loading or is it broken?" |

If a proposed animation doesn't answer a question, it doesn't ship.

---

## 6. Typography

Two families. Not three.

| Family | Use | Why |
|---|---|---|
| **Tajawal** | All UI text, both scripts | One family covering Arabic and Latin with matching weight and x-height. The bilingual toggle therefore doesn't reflow the layout — with two separate families, switching to Arabic shifts every box by a few pixels and the whole page jitters. |
| **Baloo 2** | Headings, scores, room codes, timers | Rounded and friendly: reads as "party", not "casino". Also has genuinely good tabular figures, which matters because scores and countdowns tick. |

Utility classes:

- `.font-display` — Baloo 2, 700. Headings and hero text.
- `.font-numeric` — Baloo 2 with `tabular-nums` + letterspacing. **Every number
  that changes** (score, timer, room code, player count). Without tabular figures
  a ticking countdown visibly jitters as digit widths change, which is
  surprisingly distracting in peripheral vision.

### RTL

`dir="rtl"` is set on `<html>` by `LanguageProvider`. Two things need manual
attention because CSS can't infer them:

1. **Native `<select>` chevrons** — flipped by an explicit `[dir="rtl"] select`
   rule in `index.css`.
2. **Directional icons** (arrows, "next", chevrons) — these must mirror.
   Non-directional icons (a mic, a dice, a person) must **not**. Use
   `rtl:-scale-x-100` on the former only.

Use CSS logical properties (`padding-inline`, `margin-inline-start`, `inset-inline`)
rather than `left`/`right` wherever possible; they mirror for free.

---

## 7. Primitives

Defined in `index.css` under `@layer components`. Use these instead of
re-styling from scratch — the point of a system is that a new page written
against it looks native without anyone thinking about it.

| Class | What it is |
|---|---|
| `.surface` | Standard panel: ink-700, hairline border, level-2 shadow |
| `.surface-lit` | Panel with a top light edge. Use for anything hero-ish |
| `.btn` | Base button: 44px, pill, tap-scale feedback |
| `.btn-primary` | Coral. The one main action on a screen |
| `.btn-live` | Mint. Only for realtime toggles (mic on/off) |
| `.btn-ghost` | Bordered, transparent-ish. Secondary actions |
| `.btn-quiet` | No chrome until hover. Tertiary / destructive-adjacent |
| `.btn-sm` / `.btn-lg` | 36px / 54px variants |
| `.field` | Text input, 48px, 16px font, coral focus ring |
| `.chip` | Small status pill. `-live` / `-hot` / `-gold` variants |
| `.page` | Page wrapper with gutter + safe-area padding |
| `.skeleton` | Shimmering loading placeholder |

**One primary action per screen.** If two things are coral, neither is primary.

---

## 8. Adding to the system

1. **Does a token already cover it?** Almost always yes. Check §2–5 first.
2. **If not, add the token to `index.css`**, not to a component's inline style.
3. **Mirror it in `brand.ts` → `COLORS`** if a `<canvas>` game or the manifest
   needs it.
4. **Add it to this document** with the reason it exists. A token nobody can
   justify is a token that will be misused within a month.

### Things that are deliberately not in the system

- **A light theme.** Every game is a dark-table experience, and the product is
  used at night. A light theme would double the surface area of every visual
  decision for an audience that would not use it. Revisit only with evidence.
- **A spacing scale beyond Tailwind's.** Tailwind's default 4px-based scale is
  already the scale; adding a second one just creates ambiguity about which to use.
- **Per-game colour systems.** Game personality comes from art and felt colour,
  not from moving the accent. See §2, decision 2.
