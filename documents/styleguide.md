# Drafta AI — Visual Style Guide

## Brand Identity
- **Primary Brand Color (Heat)**: `#fa5d19` — opacity-based scale (heat.4 through heat.100)
- **Rule**: Always white text on heat/orange backgrounds. NEVER dark text on orange.
- **Font**: Inter (UI/body) — weights: 400 (body), 450 (medium body), 500 (headings), 600 (emphasis), 700 (bold)
- **Mono Font**: Geist Mono (code blocks, technical content)

## Color System

### Entity Colors (use consistently for entity-specific UI)
| Entity | Color | Token |
|--------|-------|-------|
| Document | `#2a6dfb` | bluetron |
| Spreadsheet | `#42c366` | forest |
| Diagram | `#9061ff` | amethyst |
| Deck | `#fa5d19` | heat |

### Text Hierarchy
| Level | Color | Usage |
|-------|-------|-------|
| Primary | `#171717` | Headings, body text |
| Secondary | `#525252` | Descriptions, metadata |
| Tertiary | `#737373` | Timestamps, labels |
| Muted | `#a3a3a3` | Placeholders, disabled |

### Surfaces & Borders
- **Base surface**: `#ffffff`
- **Lighter surface**: `#fafafa`
- **Border faint**: `rgba(0,0,0,0.04)`
- **Border muted (default)**: `rgba(0,0,0,0.08)`
- **Border loud**: `rgba(0,0,0,0.16)`
- Rule: Use alpha-based borders, NOT hex colors

### Accent Palette
| Name | Hex | Usage |
|------|-----|-------|
| Bluetron | `#2a6dfb` | Links, doc actions |
| Forest | `#42c366` | Success, sheet actions |
| Crimson | `#eb3424` | Errors, destructive |
| Honey | `#ecb730` | Warnings |
| Amethyst | `#9061ff` | Diagram actions |

## Spacing & Layout
- **Border radius**: 4px (small), 6px (buttons/inputs), 8px (cards/modals), 12px (large cards), 16px (containers), full (pills)
- **Spacing scale**: 4/8/12/16/20/24/32/40/48/64px
- **Content max-width**: Fluid with clamp()

## Component Patterns

### Buttons
- Primary: Heat background, white text, 6px radius
- Secondary: White background, muted border, primary text
- Ghost: Transparent, hover shows faint background
- All buttons: 6px border-radius, Inter 500 weight

### Inputs
- 6px border-radius, muted border
- Focus: bluetron ring (2px offset)
- Placeholder: muted text color

### Cards
- 8px border-radius, white surface, muted border
- Hover: faint shadow or border-loud transition

### Modals/Dialogs
- 8px border-radius, white surface
- Backdrop: rgba(0,0,0,0.4)
- Always include close button and escape key handling

## Visual Feel
- **Clean, minimal, professional** — no visual clutter
- **Warm neutrals** with strategic pops of entity color
- **Generous whitespace** — let content breathe
- **Subtle transitions** — 150ms ease for hovers, 200ms for layout shifts
- **No gratuitous shadows** — use borders for separation, shadows only for elevation (dropdowns, modals)
- **Firecrawl-inspired** design system — modern SaaS aesthetic
