# Primy x Magicpath Landing — Action Plan + Implementation Plan

Date: 2026-06-10. Route: `/preview/magicpath`. Goal: full structural + visual replica of magicpath.ai's design language, rebranded for Primy. Original copy, Primy assets, no copied code/assets/text from magicpath.

## Phase 0 — Findings (recon done, live-site teardown + repo audit)

### Magicpath design language (extracted from computed styles, live)

**Structure (homepage, top to bottom):**
1. Sticky nav, 70px, blurred white (`rgba(255,255,255,0.92)` + blur), hairline bottom border. Logo left, 3 text links + "Sign in" right. No nav CTA button.
2. Announcement bar: pale tint strip, one centered line, ~46px.
3. Hero: centered. 2-line H1 (64px) with one phrase in the accent color. 2-line gray sub (max ~720px). Two buttons (solid accent + white outline). Then a giant live self-driving product demo card (~1138x752, 16px radius, large soft brand-tinted shadow).
4. Logo strip: tiny uppercase letterspaced label + infinite marquee (120s linear).
5. Act 1 (white bg): two-column. Eyebrow + 3-line H2 (48px, one phrase accent) + 2 short paragraphs + "Learn more" outline button. Right: flat gray panel with animated named cursors (humans = avatar pills, agents = pulsing halo rings).
6. Act 2 (gray bg, left-aligned): overlapping app icons + eyebrow + H2 + node-connector diagram (icon tiles joined by thin lines + arrows, fanning to labeled cards). Below: 2-up sub-features, one ends in a copyable command block (pale accent tint, mono).
7. Act 3 (white bg, centered): H2 with accent words + split card: left = designed artifact, right = its source/origin, circular swap badge on the seam. 2-up caption grid below.
8. Act 4 (gray bg, centered): H2 + live interactive prototype in a fake browser-chrome card (traffic lights + URL pill) + floating dark tooltip pill "Try interacting".
9. Final CTA (gray): app-icon tile + eyebrow + 2-line headline (all black) + same button pair.
10. Footer (white): logo + 2-line mission + 3 social icons; 3 sparse link columns; hairline; tiny copyright.

No testimonials, no FAQ, no stats. Proof = the demos themselves + logo marquee.

**Tokens (magicpath → Primy mapping):**

| Token | Magicpath | Primy replica |
|---|---|---|
| Section alternation | `#FFFFFF` / `#F9F9F9` | `#FFFFFF` / `#FCFBF8` (warm) |
| Single accent (does everything) | green `#0A6A3C`, hover `#085C34` | deep amber `#B87426`, hover `#9E6220` |
| Pale accent tint | mint `#DCF1E3` | pale amber `#F6E8D4` / `rgba(184,116,38,0.10)` |
| Headings | `#0A0A0A` | `#171716` |
| Body (warm-tinged gray, not pure) | ~`#4D4C42` | `#3B3A37` |
| Muted/eyebrow | `#6F6E77` | `#706E68` |
| Hairline borders | `#E4E4E7` | `rgba(24,24,22,0.08)` |
| Card shadows (brand-ink tinted) | `rgba(15,42,28,…)` | `rgba(58,42,18,…)` warm amber-ink |
| Display font | TWK Lausanne 500 (licensed; cannot use) | Inter Tight 500 (next/font), lh 1.0, tracking −3% |
| Body font | Inter | Inter |
| H1 | 64/64, −2.048px | same |
| H2 | 48/48, −1.2px | same |
| Eyebrow | Inter 11px/590 uppercase +1.32px, muted | same |
| Buttons | 36px tall, 8px radius, 13px label; primary solid accent (flat hover-darken), secondary white + `rgba(0,0,0,0.1)` border | same geometry; primary solid deep amber |
| Card radii | 12px (small) / 16px (large) | same |
| Pills | fully rounded | same |

**Signature rules (must hold everywhere):**
- One accent only. Zero gradients, zero auras, zero glassmorphism. Flat fills + hairlines + one huge soft shadow under demo cards.
- Almost every headline: black with exactly ONE phrase in accent. Sentence case.
- Page chrome stays neutral; playful color lives only INSIDE product mockups/artifacts.
- Airy: ~200–280px section padding, content max ~1140–1200px, hero text max ~720px.
- Motion restraint: scroll reveal = fade + rise + blur-to-sharp; marquee 120s linear; typing caret; pulsing agent halos; buttons = flat darken only (no lift/scale). All gated by `prefers-reduced-motion`.
- Light mode only.

### Repo facts
- Preview convention: self-contained `"use client"` page at `src/app/preview/<name>/page.tsx`, inline styles + inline `<style>` keyframes, own `next/font` imports (precedent: `/preview/landing` uses Newsreader + Inter_Tight). No app-component imports except `LogoMark` is fine (`src/components/shared/Logo.tsx`, `LogoMark({size, className, style})`, currentColor SVG).
- Tokens live in `globals.css` but previews hardcode a local `C = {...}` object (precedent in landing/landing2).
- Existing magicpath references: `/preview/landing` v3+ already cites it as the clean-hero reference. This page goes all the way.

## Content mapping (Primy story in magicpath's frame)

| Slot | Magicpath | Primy |
|---|---|---|
| Announcement | "Introducing 2.0" | "Introducing Primy" + link |
| Hero H1 | tool claim, accent phrase | "Chat your client work into finished deliverables" (accent: "finished deliverables") |
| Hero demo | self-driving canvas app | self-driving Primy mockup: sidebar + chat; prompt types itself → thinking → doc + page artifacts pop onto board → agent cursor with pulsing halo + "You" cursor |
| CTAs | Download / open web | "Start creating free" / "See it in action" |
| Logo strip | customer logos | "TRUSTED BY INDEPENDENTS AT" + grayscale text wordmarks (placeholder set) |
| Act 1 (cursors) | multiplayer + agents | "You and Primy, same workspace": human cursors + Primy agent cursor; org sharing story |
| Act 2 (diagram) | external agents → design/code/db | "Drag in anything": PDF/XLSX/DOCX/notes tiles → Primy node → Doc / Sheet / Deck / Page cards + "Per-client memory" card; copyable block = a share link |
| Act 3 (split card) | design ↔ code swap | "Chat becomes the deliverable": left = chat thread, right = rendered client page; swap badge on seam |
| Act 4 (browser frame) | interactive prototype | hero artifact = HTML page: fake browser chrome + `primy.app/share/…` URL pill + genuinely interactive client one-pager (clickable tabs) + tooltip pill |
| Final CTA | "future of work" | "Never copy-paste from ChatGPT again" act |
| Footer | mission + 3 columns | Primy mission + Product / Resources / Company |

## Implementation phases

1. **Scaffold + chrome** — `src/app/preview/magicpath/page.tsx`: fonts (Inter_Tight + Inter via next/font), `C` token object, nav, announcement bar, hero text + buttons, footer. Verify: route renders, type scale matches table.
2. **Hero live demo** — state-machine loop (typing → thinking → artifacts → cursors → hold → reset), all DOM/CSS, no assets. Pure transform/opacity animations.
3. **Logo marquee + Act 1 cursor scene** — 120s linear marquee (duplicated track); cursor panel with drifting named cursors, pulsing agent halos.
4. **Act 2 diagram + Act 3 split card** — connector lines via SVG; copyable share-link block; chat↔page split with seam badge.
5. **Act 4 interactive page + final CTA** — browser-chrome card, working tabs inside, tooltip pill; CTA section.
6. **Motion + responsive pass** — IntersectionObserver reveal (fade/rise/blur-to-sharp), reduced-motion guards, mobile stacking.
7. **Verify** — dev server + browser screenshots vs the signature-rules checklist; `npm run lint` clean.

Anti-patterns guarded: no gradients, no second accent, no `Sparkles`, no em-dashes in UI copy, no italics, no copied magicpath copy/assets/fonts.

## Revision 2 (2026-06-11) — Primy color system, de-replica pass

Direction and structure kept (clean hero + live demos as proof, airy alternating sections, tight Inter Tight display, blur-in reveals). The single-amber-accent replica device is replaced with Primy's own system:

**Color roles (locked for this page):**
- **Ink `#1A1815` = primary action.** All primary buttons (nav "Start free", hero, CTA), seam badge, demo Share button, app-icon tiles, footer brand.
- **Blue `#4285F4` = interactive.** Sign in, announcement "New" pill + arrow, share-link block (blue tint), live-page tabs + chart highlight, the underlined "a link" headline phrase.
- **Amber = AI signal ONLY.** Primy agent cursor + halo, thinking dots, send button, memory pill, the in-progress card Primy is writing. Never buttons, never default headline accent.
- **Entity colors = contextual lively layer.** One accent phrase per headline, colored by what the section is about (teal for workspaces, purple for the page act); diagram outputs, board cards, entity grid, CTA legend carry entity identity (doc blue / sheet green / deck amber / page purple). Readable text variants in `theme.ts` (`blueText` etc.) for display-size colored text.

**De-replica changes:**
- Hero H1 ends in a **rotating entity word** (page/deck/doc/sheet, each in its entity text color, 2.4s cycle, blur-swap, reduced-motion static).
- New **EntityGrid band** after the logo strip: 4 cards, solid pastel tint stage (per the landing-design-system TINT decision) + CSS mini artifact sketch + name/line.
- Act 1 abstract cursor panel → **BoardScene**: a real Primy board (Drafts / In progress / Ready to send columns, entity cards, live amber "Q3 review deck" card) with named cursors over it.
- Act 2 diagram outputs: labeled pills → **mini artifact thumbnails** (doc/sheet/deck/page CSS minis) + per-entity traveling sparks on the connector paths (offset-path).
- All artifact "paper" is white Primy paper (cream magicpath aesthetic dropped); split-card page and live page restyled ink/white with purple page identity and blue interactivity.
- Announcement bar: pale-accent tint → neutral warm + blue "New" pill. Nav gains an ink "Start free" button. CTA gains the 4-entity legend.

Files: `theme.ts` (roles + ENTITY array), `ui.tsx` (ink BtnPrimary, Accent(c), Eyebrow(dot)), `page.tsx`, `scenes.tsx`, `LivePage.tsx`, `HeroDemo.tsx`.

## Revision 3 (2026-06-11) — promoted to production "/"

This design is now the live marketing landing. The old `/` landing (split hero + ValueProps + Without/With comparison) and the old `/preview/landing` + `/preview/landing2` drafts were deleted.

**Structure:**
- Components live in `src/components/marketing/landing/` (`Landing.tsx` + `theme.ts`/`ui.tsx`/`HeroDemo.tsx`/`scenes.tsx`/`LivePage.tsx`).
- `src/app/page.tsx` = thin static server wrapper: metadata (studio positioning) + `RedirectIfAuthenticated` + `<Landing />`.
- `/preview/magicpath` = same `<Landing />` without the auth redirect, kept as the design sandbox (previewable while signed in).

**Functional wiring (real destinations only):**
- All CTAs → `/login` (passwordless flow handles signup). Nav: Pricing → `/pricing`, Sign in → `/login`, ink "Start free" button.
- "See it in action" smooth-scrolls to the live interactive page (`#live-page`), reduced-motion → instant.
- Footer: Pricing / Start free / Sign in, Privacy `/privacy`, Terms `/terms`, Email `mailto:info@pixeldust.in`. Placeholder social icons removed.
- Buttons (`ui.tsx`) accept `href` and render as Next `Link`s.

**Changes vs the preview:**
- Fake customer wordmark marquee → honest **role marquee** ("Built for independents who ship client work": solo consultants, fractional CMOs, agencies of one, ...) as entity-dotted pills.
- New **pricing teaser** section before the final CTA: Free vs Pro cards from real `PLAN_LIMITS` + `PRO_PRICE_USD`, ink "Most popular" ring, link to `/pricing`.
- Hero gains the "Free forever plan / No credit card" reassurance row.
- Mobile: nav text links hide under 560px (buttons remain), existing two/four-column collapses kept.
