# Primy AI — Motion & Transition Ruleset

The single source of truth for animation in the app. Grounded in Emil
Kowalski's design-engineering framework (`emil-design-eng` skill) and the
`transitions-dev` skill. **Read this before adding or changing any
animation.** If a change conflicts with a rule here, change the rule here
first (with reasoning) — don't fork the system.

> Personality target: **crisp, warm, professional.** Linear's speed +
> Pitch's warmth. Fast and confident, never bouncy or showy. Most motion
> should be felt, not noticed.

---

## 1. Architecture — one token source, one CSS home, ergonomic helpers

There is **one** token vocabulary and **one** CSS home for reusable motion.
Don't fork it, don't re-declare a token.

| Piece | File | Owns |
| --- | --- | --- |
| **Tokens** | `globals.css :root` | `--duration-*`, `--ease-*` — *the canonical source* |
| **Primitives** | `src/styles/motion.css` | every reusable class: `.press`, `.lift`, `.pop-in`, `.menu-pop`, `.hover-row`, `.stagger-in`, `.icon-swap` / `.text-swap`, `.success-pop`, `.shake`, and the transitions.dev-sourced `t-icon-swap` / `t-digit-group` / `t-stagger` |
| **React helpers** | `src/components/ui/transitions/*` | the ergonomic interface to the richer primitives: `<IconSwap>`, `<AnimatedNumber>`, `<TextReveal>` |

The React helpers are just typed wrappers over the `t-*` classes in
`motion.css` — they are not a second system. Legacy `.animate-*` entrance
utilities in `globals.css` still work for simple keyframe entrances; prefer
the primitives above for new work.

**Rule:** motion tokens are declared once, in `globals.css :root`. Every
consumer (`motion.css`, `design.ts`) only *references* them with `var(--…)`.
Re-declaring a token in a second `:root` silently shadows the first — that
is how the strong `--ease-out` went dead before.

---

## 2. Token vocabulary

### Durations — pick by what moves, not by taste

| Token | Value | Use for |
| --- | --- | --- |
| `--duration-fast` | 120ms | press, hover, toggle, color — actions seen 100×/day |
| `--duration-normal` | 200ms | fade, scale, icon/text swap, tooltip, dropdown |
| `--duration-enter` | 240ms | entrance: modals, new content, list items |
| `--duration-slow` | 320ms | layout: panel resize, drawer, view switch, hero reveal |

**Hard cap: UI animations stay under ~300ms.** `--duration-slow` (320ms) is
the ceiling, reserved for layout/hero moments. A 180ms dropdown feels more
responsive than a 400ms one.

### Easings — pick by motion type

| Token | Curve | Use for |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | **default.** entering / exiting / swaps / feedback |
| `--ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | branded entrances that want a hint of overshoot |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | on-screen movement, morphs, crossfades |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | drawers, slide-overs (iOS feel) |
| `--ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | hover + color changes only |

**Never use `ease-in` on UI.** It delays the first frame — the moment the
user is watching most — so it feels slower than `ease-out` at the same
duration. **Never use bare built-in `ease-out`/`ease-in-out`**; they're too
weak. Always reference a token.

---

## 3. The decision framework (run in order)

### a. Should it animate at all?

| Frequency | Decision |
| --- | --- |
| 100+×/day (⌘K palette, keyboard nav, tab switch by shortcut) | **No animation.** |
| Tens×/day (hover, list nav) | Minimal — `--duration-fast`, opacity/transform only |
| Occasional (modals, drawers, toasts, dropdowns) | Standard animation |
| Rare / first-time (onboarding, hero, success, celebrations) | Delight allowed |

**Never animate keyboard-initiated actions.** The ⌘K search dialog, tab
switches, and shortcut-driven navigation open instantly.

### b. What's the purpose?

Every animation must answer "why does this move?" — spatial consistency,
state indication, feedback, or preventing a jarring change. "It looks cool"
is only valid for rare/first-time moments.

### c. Which easing? (see table above)

entering/exiting → `--ease-out` · moving/morphing → `--ease-in-out` ·
hover/color → `--ease-default` · drawer → `--ease-drawer` · constant motion
(spinner, marquee, progress) → `linear`.

### d. How fast? (see duration table) — and make **exits faster than enters.**

---

## 4. Pattern → primitive map

Don't reinvent. Reach for the canonical primitive for each pattern.

| Pattern | Use | Notes |
| --- | --- | --- |
| Pressable (button, card, row) | `.press` | `scale(0.97)` on `:active` |
| Card / tile hover raise | `.lift` | gated behind `(hover:hover)` |
| Element entrance (scale) | `.pop-in` | from `scale(0.96)` + opacity, never `scale(0)` |
| Dropdown / popover / menu | `.menu-pop` | origin-aware via Radix var; **modals stay center-origin** |
| List / grid cascade | `.stagger-in` | 40ms between items |
| Headline + subtext entrance | `<TextReveal>` | blurred staggered rise |
| Toggle between two fixed icons (copy↔check, sun↔moon) | `<IconSwap>` | both icons stay mounted; blur crossfade |
| A slot whose content swaps (Saving…→Saved) | `.icon-swap` / `.text-swap` | `data-swapping` blur crossfade on the slot |
| Number / counter change | `<AnimatedNumber>` | per-digit blurred pop |
| Success / "saved" / upload done | `.success-pop` | rare → a little character allowed |
| Error / invalid input | `.shake` | settle quickly (~300ms) |

---

## 5. Hard rules (the non-negotiables)

1. **Animate only `transform`, `opacity`, and `filter` (blur).** Never
   animate `width`/`height`/`margin`/`padding`/`top`/`left` — they trigger
   layout + paint. (Exceptions like the tabs pill measure & write `width`
   intentionally; document why inline.)
2. **Never `transition: all`.** Enumerate exact properties.
3. **Never animate from `scale(0)`.** Start at `scale(0.95)`+ with opacity —
   nothing in the real world appears from nothing.
4. **Popovers/menus are origin-aware; modals are center-origin.**
5. **Use CSS transitions, not keyframes, for rapidly-retriggered UI** (toasts,
   toggles) — transitions retarget mid-flight, keyframes restart from zero.
6. **Blur (≤20px) to mask imperfect crossfades** — bridges the two
   overlapping states into one morph.
7. **Exits faster than enters.** Slow where the user decides, fast where the
   system responds.
8. **Every movement-based rule must degrade under `prefers-reduced-motion`:**
   keep opacity/color, drop transforms — fewer & gentler, not zero.
9. **Gate `:hover` animations** behind `@media (hover: hover) and (pointer: fine)`.
10. **Stagger delays stay 30–80ms** between items; never block interaction
    while a stagger plays.

---

## 6. Reduced motion

`motion.css` and every `t-*` block re-declare their movement rules inside
`@media (prefers-reduced-motion: reduce)` to strip transforms while keeping
fades. When adding a new movement primitive, add a matching reduced-motion
override in the same file. In React, read `prefers-reduced-motion` and skip
position/scale animation; keep opacity.

---

## 7. Enforcement

- **Doc-first:** this file is the law. `CLAUDE.md` points here so the agent
  applies it by default on any UI work.
- **Checker:** `npm run lint:motion` (`scripts/check-motion.mjs`) scans
  `src/**/*.{css,tsx}` for the common violations — `transition: all`, bare
  `ease-in`, `scale(0)` entries, hardcoded durations over 300ms, and raw
  easing curves that should be tokens. Run it before shipping motion work.
- **Review:** when reviewing UI, use the Before/After table format from the
  `emil-design-eng` skill, one row per issue.

---

## 8. When in doubt

Run `transitions review` (audit the project for fit) or `transitions apply
<name>` from the `transitions-dev` skill, then reconcile timings/easings to
the tokens in §2 before committing. Review animations the next day with fresh
eyes and in slow motion (DevTools → Animations) — timing bugs invisible at
full speed show up at 5×.
