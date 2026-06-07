# Primy Landing — Design System (v0)

Reference vibe: **conduit.ai** — warm off-white canvas, huge tight headlines, color
that arrives through soft blurred gradient *auras* (not flat fills), bracketed
section labels, alternating light / near-black bands, black pill CTAs. Clean,
balanced, editorial rhythm. Lively but never loud.

Positioning locked: **Option C (hybrid)** — outcome-led, product stays horizontal.
Core line: *"Primy is an AI workspace for documents, spreadsheets, decks, and pages.
You chat, and the AI builds and edits them for you."* The hero highlight is the
**death of tedious manual work** (Google-Docs-by-hand → just ask).

This file is the single source of truth for the preview at `/preview/landing`.
Everything there must obey these tokens so the look stays consistent.

---

## 1. Color

Pulled from the locked brand (`CLAUDE.md`). Marketing stays **light-mode only**
except the deliberate dark bands.

| Token | Value | Use |
|-------|-------|-----|
| Canvas | `#FCFBF8` | page base (warm near-white) |
| Surface | `#FFFDFB` | cards on canvas |
| Sunken | `#F7F7F4` | alt section bands, insets |
| Ink | `#1A1815` | primary text, dark bands, primary CTA |
| Ink-2 | `#3B3A37` | body text |
| Ink-3 | `#706E68` | secondary / captions |
| Ink-muted | `#B9B6AE` | faint labels, placeholders |
| Amber | `#FFB43F` | AI signal, dots, soft highlights (never amber text) |
| Amber-text | `#B87426` | readable amber on light |
| Blue | `#4285F4` | doc identity + interactive/link |
| Green | `#42C366` | sheet identity |
| Deck amber | `#FFAD45` | deck identity |
| Purple | `#8757D7` | page identity (hero artifact) |
| Pink | `#F073A7` | accent in auras only |
| Teal | `#67CEC8` | accent in auras only |
| Border | `rgba(24,24,22,0.08)` | default hairline (alpha, never hex) |
| Border-strong | `rgba(24,24,22,0.12)` | hover / emphasis hairline |
| Border-faint | `rgba(24,24,22,0.04)` | inner dividers |

**Color discipline (the conduit lesson):** the page is 90% warm neutral. Color
shows up almost entirely through the **auras** and the small entity dots. Text and
chrome stay ink. This is what reads as "balanced," not busy.

## 2. Auras (the lively layer)

Real generated assets in `public/landing/aura/` (model: `gpt-image-2`):
- `hero-warm.png` — amber→blue/pink/teal bloom on cream. Hero default.
- `hero-cool.png` — blue/violet/teal, airier. Hero alt.
- `band-dark.png` — vivid orbs on charcoal. Dark bands / final CTA.
- `card-blue|green|amber|purple.png` — per-entity card backgrounds.

Rules:
- Auras are **decorative, `aria-hidden`, `pointer-events-none`**.
- On light sections place an aura behind content at low strength: `opacity-[0.55–0.8]`,
  often masked with a radial fade so edges melt into the canvas.
- Never put body text directly on the busy center of an aura. Either: (a) text sits on
  a clean card floating over the aura, or (b) text sits in the calm cream margin.
- Add `mix-blend-mode: multiply` is **not** needed (assets already sit on cream);
  for the dark band use the asset as-is.
- Prefer CSS `radial-gradient` halos for tiny accents; use the PNG auras for the
  big hero / band / card moments.

## 3. Typography

Font: **Inter** (brand-locked; we keep it despite generic-AI advice — conduit's feel
comes from size + spacing + color balance, not an exotic typeface). Geist Mono only
for the bracketed labels' numerals if desired.

| Role | Size (desktop) | Weight | Tracking | Leading |
|------|----------------|--------|----------|---------|
| Display (hero H1) | 60–76px | 500 | -0.03em | 1.02 |
| H2 (section) | 36–44px | 500 | -0.02em | 1.06 |
| H3 (card title) | 18–20px | 500 | -0.01em | 1.2 |
| Body-lg (hero sub) | 17–18px | 400 | 0 | 1.55 |
| Body | 14–15px | 400 | 0 | 1.6 |
| Eyebrow / section label | 11px | 500 | 0.14em, uppercase | — |
| Stat number | 44–56px | 500 | -0.02em, `tnum` | 1 |

- Headlines always `text-balance`, `font-smoothing: antialiased`.
- Numbers use tabular-nums.
- **No em-dashes** in any copy (brand rule). Use comma / period / parentheses.

## 4. Section labels (rhythm)

Bracketed, conduit-style: `[01] THE SHIFT`, right-aligned counterpart `/ AI DOES IT`.
- 11px, uppercase, `tracking-[0.14em]`, color Ink-3.
- Sits above a hairline (`border-faint`) that spans the content column.

## 5. Spacing & layout

- Container: `max-w-[1200px]`, `px-6 lg:px-8`.
- Section padding: `py-24 lg:py-32` (breathe heavily, per reference).
- Grid gaps: `gap-6 lg:gap-8`.
- Alternate band backgrounds: Canvas → Sunken → Canvas → Ink(dark) for rhythm.

## 6. Radius (concentric)

Pixel scale: 6 / 8 / 12 / 16 / 24. Buttons & inputs 8, cards 16, panes/aura frames 24.
When nesting (double-bezel), inner radius = outer − padding (e.g. outer `24`, pad `6`,
inner `18`).

## 7. Shadows

Warm, ink-tinted, soft — never harsh black.
- Card rest: `0 1px 2px rgba(24,24,22,0.04)`
- Float (hero mock, lifted card): `0 24px 60px -24px rgba(24,24,22,0.20), 0 2px 8px rgba(24,24,22,0.04)`
- Aura frame: rely on the bloom + a hairline ring, minimal shadow.

## 8. Buttons (CTA)

- **Primary:** ink fill `#1A1815`, white text, `rounded-full` pill, `h-11 px-5`.
  Optional **button-in-button** trailing `↗` in a `w-7 h-7 rounded-full bg-white/12`
  circle, flush right. Hover: `active:scale-[0.98]`, inner icon nudges `translate-x-0.5 -translate-y-0.5`.
- **Secondary:** surface fill, hairline border, ink text, same pill.
- **Ghost:** text-only, ink-3 → ink on hover.
- Easing for all CTA motion: `cubic-bezier(0.32,0.72,0,1)`, 200–260ms.

## 9. Motion

- Honor existing `documents/motion.md`: animate only transform/opacity/filter,
  UI < 320ms, exits faster than enters, `prefers-reduced-motion` degrades everything.
- Scroll entries: gentle fade-up (`translate-y-4 opacity-0` → in) ~500ms, staggered
  60–80ms. Auras may breathe very slowly (scale 1→1.03 over 12s+) — reduced-motion off.
- No `transition: all`, no `ease-in` on UI, no `scale(0)` entries.

## 10. Icons

Lucide (brand-consistent), thin stroke `1.75`. Entity icons monochrome `var(--icon)`
in chrome, tinted only where they represent the entity in a colored card.
**Never** the `Sparkles` star (banned). AI affordance = `Wand2` or `LogoMark`.

## 11. What we are building first (this round)

A standalone preview at `/preview/landing` — does NOT touch the real `/`.
Two sections, each with 2–3 floating variant options the user can compare:
1. **Hero** (headline A, aura background, product mock or chat→artifact motif).
2. **`[01] The Shift`** (manual/tedious → just ask) OR **`[02] What you can make`**
   (4 entity cards on per-color auras). Build both partially; let the user pick.

If a direction lands, it gets promoted into the real landing page later.

---

## 12. v2 revision (locked after first review)

Feedback: v1 felt "here and there" (dark band + rainbow card headers + dark filter
bar broke cohesion) and was slow (14MB of PNG auras loading per-section). Fixes:

- **Performance:** all auras are now tiny optimized **WebP** (`public/landing/aura/*.webp`,
  ~3–7KB each, 22KB total vs 14MB). Soft gradients compress to nothing. Regenerate
  via `gpt-image-2` → downscale (cards 700px, hero 1280px) → `webp` q58. Always create
  the WebP and verify it exists **before** deleting the source PNG (a glob `rm` once
  wiped the folder — never `rm public/.../*.png` before the replacement is confirmed).
- **Cohesion:** one light warm world end-to-end. **No dark band.** Color arrives only
  through (a) one soft ambient hero aura, (b) small entity-color icons/dots, (c) a
  single uniform aura header on each of the 4 (identical) artifact cards. Removed the
  dark on-canvas variant/filter bar.
- **Hero = centered chat input (ChatGPT-style):** placeholder, attach icon, send
  button, four entity-colored suggestion chips. Enter / send / chip → **signup modal**
  that carries the typed prompt ("You asked: …") into Google/email signup. This both
  demonstrates the product (chat to create) and is the primary conversion path.
- Variant switching dropped in favor of one committed, cohesive direction.

---

## 13. v3 revision — gradients removed (locked after second review)

Feedback: the hero gradient/aura looked cluttered and off-brand ("we don't use such
gradients anywhere else on the platform, why in the hero"). Reference shifted to
**magicpath.ai** (and conduit's own hero): clean light surface, NO gradient behind
the headline, a big product screen on a neutral stage, color only from small accents.

Decisions:
- **No auras / gradients anywhere.** Removed all `public/landing/aura/*` assets (page
  is now pure markup + CSS, zero image weight). The earlier WebP auras and the
  `gpt-image-2` pipeline are no longer used by the landing (kept in spec history only).
- **Hero is clean.** Two modes via a small *light* toggle (bottom center):
  - **Product** (default, magicpath-style): clean headline + 2 buttons, then a
    realistic Primy **app screen** mock (sidebar with entity-color dots, doc editor
    with an amber "writing" line, chat panel). This is the centerpiece.
  - **Chat**: the ChatGPT-style centered input + suggestion chips → signup modal.
- **Cards** no longer use rainbow aura headers. Each shows a clean **mini-preview**
  (doc lines / sheet grid / deck slides / page blocks) tinted in that entity's *own*
  color — on-brand, consistent with our entity-color system.
- **Final CTA** is a clean bordered panel on `sunken`, no gradient.
- Color discipline is now strict: ink + warm neutrals everywhere, color ONLY through
  small entity accents (dots, icons, tinted previews) + the amber headline word.

---

## 14. v4 revision — reducto typography & rhythm (current)

Reference: **reducto.ai**. What makes it feel premium (measured from the live DOM):
serif display headlines (`reductoSerif`, ~96px, weight ~470, tight leading) + **Inter**
body (20/32 muted warm gray); **no eyebrows, no dots, no bracket labels**; centered
compositions; huge whitespace; **varied section heights** (tall hero, short punchy
stat band); one accent color on a single word; clean document illustrations.

Applied to our preview:
- **Serif display for all headlines** via `next/font/google` **Newsreader** (weights
  400/500/600 + italic). Body / UI stays **Inter** (brand). This is a *marketing-only*
  type choice. ⚠️ NOTE: `CLAUDE.md` locks Inter (weight 500) for headings app-wide —
  using a serif on the landing is a deliberate marketing deviation to confirm before
  it ships to the real `/`. The accent word ("Just ask.", "conversation.") is serif
  *italic* in deep amber `#E0852B`.
- **Removed every eyebrow, colored dot, and `[01]` bracket label.** Section headers are
  now centered: big serif title + short Inter blurb. Much cleaner.
- **Section heights vary by importance:** tall hero, a short punchy serif **StatementBand**
  ("From a blank page to a finished deliverable in a single conversation."), medium
  card grid, medium shift, CTA panel.
- Type scale (desktop): hero H1 `clamp(44,7vw,86)` / section H2 `clamp(32,4.2vw,54)` /
  statement `clamp(26,3.4vw,40)` — all serif, tight tracking, `text-balance`.
- Everything else (clean cards w/ entity-tinted mini-previews, product-screen hero,
  chat-hero toggle, signup modal, no gradients) carries over from v3.

Open question for the user: keep the serif (Newsreader) or try another display serif
(Fraunces / Instrument Serif / Source Serif), and whether to accent in amber vs a
more vivid hue like reducto's magenta.

---

## 15. v5 revision — no italics, Sans/Serif switch, mobile fixed (current)

- **Italics banned.** Removed every `font-style: italic` (the accent words "Just ask.",
  "conversation." are now upright deep-amber `#E0852B`). Hard rule for this project:
  no italics anywhere (reads as AI slop).
- **Two display options, switchable live:**
  - **Sans** (default) = **Inter Tight** (next/font), display weights 600/700, tight
    tracking. Crisp Linear/magicpath feel, brand-adjacent (body is Inter).
  - **Serif** = **Newsreader** (weight 500). reducto feel.
  - Driven by a small **`HeadCtx`** React context + `headStyle()` helper so every
    heading (hero, sections, statement, CTA, modal) flips together.
- **Minimalist floating control (`ControlDock`)**: one light pill, `Aa` glyph then
  `Sans | Serif`, a divider, then `Product | Chat`. Replaces the older toggle.
- **Mobile fixed.** The product screen was a cramped 3-column grid on phones. Now the
  sidebar and chat panels are `hidden md:flex`; on mobile only the editor column shows
  (full width, readable). Editor padding, hero/section type, and section paddings all
  step down at the `sm` breakpoint. Cards already stacked 1-col.
- Known non-issue: a hydration/"script tag" dev warning comes from the app's global
  anti-FOUC theme `<script>` in `layout.tsx` (adds `.dark` before paint), not from the
  landing page. Out of scope here.

---

## 16. v6 revision — reducto structure replicated in our theme (current)

Reducto's page structure + illustration style, themed to Primy with our product mock
and motion. Fonts **lightened** (no bold — weight 500 across both modes; the v5 Sans
600/700 was too heavy).

Structure now mirrors reducto section-by-section:
1. **Hero** — light headline + sub + 2 buttons + a **row of 4 artifact "paper"
   thumbnails** (Doc/Sheet/Deck/Page, each with a mini entity-preview + entity-colored
   tag). This is reducto's hero document-row, themed. Thumbnails stagger-rise on load.
2. **Dot-matrix statement band** — reducto's stat-band motif: a faint dot grid (masked
   radial fade) with sparse entity-colored squares, behind the short serif line
   "From a blank page to a finished deliverable in a single conversation."
3. **Interactive Showcase** — reducto's signature feature section: left = clickable
   capability list (Chat to create / Drag in any file / Project memory / Export
   anywhere) with an accordion expand; right = our **ProductScreen** mock that swaps
   scene per capability (active entity highlight, editor content, files highlight, chat
   messages) and fades in (`lp-rise`) on switch.
4. **What you can make** — 4 entity cards (entity-tinted mini-previews).
5. **The shift** + **Final CTA** (clean panel).

Motion: `Reveal` (IntersectionObserver fade-up, reduced-motion safe) wraps each section
below the hero; `lp-rise` keyframes for thumbnail stagger + showcase scene swaps. All
CSS in `LandingMotionCSS` (one `<style>`), transform/opacity only.

Type weights are now 500 everywhere (light-medium). Sans = Inter Tight, Serif =
Newsreader, switchable via `ControlDock`. No italics. No gradients/auras. No eyebrows
or bracket labels.

---

## 17. v7 revision — two-line hero + color injected (current)

- **Hero title is two lines** now (was three): line 1 "Stop doing docs by hand."
  (`sm:whitespace-nowrap`), line 2 the amber accent "Just ask." Hero container widened
  to `max-w-[940px]` and headline capped at `clamp(38,5.2vw,66)` so line 1 fits one row
  on desktop; wraps naturally on mobile.
- **Color, the right way (solid blocks, NOT gradients).** Added a `TINT` map = a solid
  pastel per entity color (blue `#EAF1FE`, green `#E7F7EC`, amber `#FFF2DF`, purple
  `#F1EAFB`) via `tintOf(color)`. Applied:
  - Hero artifact thumbnails: each on its entity pastel with a **solid** colored tag.
  - "What you can make" cards: pastel header + **saturated solid icon tile** (white icon).
  - Showcase capability list: colored icon tiles (filled when active, tinted when not),
    one entity color each.
  - Statement band keeps the entity-colored squares on the dot matrix.
  This gives the page the missing "vibe" while staying clean and gradient-free; color is
  systematic (the 4 entity colors), not random.

---

## 18. v8 revision — zapier learnings: colored section + real app screenshots (current)

Reference: zapier.com. Two takeaways the user called out: (a) **break the all-white page
with a soft COLORED section (not dark)**, and (b) present a **clean real product mock**.

- **Colored section:** the Showcase now sits on `C.sand` (`#F4EDE2`, soft warm, light
  not dark) with hairline top/bottom borders — the alternating-color rhythm zapier uses
  (white hero → colored showcase → white cards …). New tokens `sand` + `mist`.
- **Real app in the mock:** replaced the hand-built `ProductScreen` mock entirely with
  **actual app screenshots**. Captured the running app via the dev-auth bypass
  (`/app`), cropped out the dev badge, optimized to WebP in `public/landing/app/`
  (`chat.webp` cold-start chat, `board.webp` project board + chat panel, `deck.webp`
  deck workspace + chat). The Showcase right panel shows the screenshot for the active
  capability, framed in a light card on the sand, fading in on switch. The dead
  `ProductScreen`/`SCENES`/`ENTITIES` code was removed.
  - To refresh these screenshots: run the app (dev bypass on), screenshot `/app` and a
    project view, crop bottom ~150px (removes the floating dev indicator), `sharp` →
    WebP q74 @ 1600px wide.
- Hero artifact thumbnails + cards keep the v7 pastel color blocks.

---

## 19. v8.1 — product images in soft colored cards + caption-matched (current)

Per zapier reference card (product UI floating in a soft colored card, bleeding off the
bottom):
- **`ProductCard`** component: a rounded card with a soft per-capability color wash
  (`linear-gradient(155deg, ${color}26, tint, surface)`) holding the real screenshot in
  a white-bordered panel anchored top so it **bleeds off the bottom edge**. Used for the
  showcase product image (the only product-screenshot slot; "card bg everywhere" = every
  product screenshot uses this card).
- **Each image matches its caption** (user: "show chat only when chat is mentioned").
  Captured a 4th real screen (`doc.webp`) so the showcase capabilities map 1:1 to a
  screenshot that depicts them:
  - Chat to create → `chat.webp` (the chat composer)
  - Write documents → `doc.webp` (doc editor)
  - Build decks → `deck.webp` (deck workspace)
  - One connected project → `board.webp` (project board of artifacts)
  Removed the old generic "Drag in any file / Export anywhere" labels that had no
  matching screenshot.
