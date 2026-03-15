# VOOM Ghana CEO Dashboard — Design Brainstorm

## Context
- White background, Liquid Glass aesthetic
- CEO-level KPI visibility: vendors, GMV, orders, leads, growth
- Inspired by Etienne client-facing build (animated metric cards, sidebar nav, recharts)
- Must scaffold into VOOM tRPC backend

---

<response>
<text>
## Idea A — "Frosted Command"
**Design Movement:** iOS 17 Liquid Glass meets Bloomberg Terminal
**Core Principles:**
1. White base with deep frosted glass panels — every card is a pane of thick, blurred glass
2. Chromatic accent system: Ghana flag colors (red, gold, green) as data-state indicators
3. Mono-spaced numbers for all KPIs — financial terminal energy
4. Sidebar is a narrow frosted rail, not a full panel

**Color Philosophy:** White (#FFFFFF) ground with glass panels at 70% opacity, backdrop-blur-xl. Accent: electric cobalt (#0057FF) for primary actions, Ghana gold (#FFC107) for revenue metrics, emerald (#10B981) for growth indicators. Text is near-black slate (#0F172A).

**Layout Paradigm:** Left rail sidebar (64px collapsed, 220px expanded) + main content area. Top section: 4 hero KPI cards in a 2×2 asymmetric grid. Middle: full-width GMV chart. Bottom: 3-column grid (vendor pipeline, recent orders, lead funnel).

**Signature Elements:**
1. Glass cards with `backdrop-filter: blur(24px)` + `background: rgba(255,255,255,0.6)` + subtle rainbow border via `background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.4))`
2. Animated number counters with cubic-ease-out (from Etienne MetricCard pattern)
3. Thin 1px gradient borders on all glass panels

**Interaction Philosophy:** Hover lifts cards (translateY -4px, shadow deepens). Click drills into detail. All transitions 200ms ease-out.

**Animation:** Cards enter staggered (0.08s delay each). Numbers count up on mount. Chart lines draw in left-to-right. Sidebar items slide in from left.

**Typography System:** Display: "Sora" (bold, geometric) for KPI values. Body: "DM Sans" (clean, readable) for labels. Mono: "JetBrains Mono" for numbers/codes.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Idea B — "Arctic Glass" ← CHOSEN
**Design Movement:** Apple Vision Pro Spatial UI meets Stripe Dashboard
**Core Principles:**
1. Pure white canvas with ultra-thin glass morphism cards — glass that feels like it's floating above the surface
2. Subtle depth layers: background → glass panels → floating elements
3. Micro-gradients inside each glass card (white → very light blue-tinted white)
4. Data hierarchy through glass opacity: primary KPIs = most opaque, secondary = more transparent

**Color Philosophy:** Background: pure white (#FFFFFF). Glass cards: `rgba(255,255,255,0.72)` with `backdrop-blur(20px)`. Primary accent: VOOM blue-indigo (#4F46E5). Revenue: emerald (#059669). Alerts: amber (#D97706). Borders: `rgba(255,255,255,0.9)` outer + `rgba(0,0,0,0.06)` inner shadow. Text: #0F172A (near-black slate).

**Layout Paradigm:** Fixed left sidebar (240px) with glass treatment. Main area: asymmetric — top row has 5 hero KPI pills in a horizontal scroll-free row, then a large 2/3 + 1/3 split for chart + activity feed, then a 3-column bottom section. No centered layouts — everything is left-anchored.

**Signature Elements:**
1. Glass morphism cards: `background: rgba(255,255,255,0.7); backdrop-filter: blur(20px) saturate(180%); border: 1px solid rgba(255,255,255,0.9); box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)`
2. "Liquid" data bars that animate like fluid filling a container
3. Floating status orbs (pulsing green/amber/red dots) for live system health

**Interaction Philosophy:** Cards have spring physics on hover (framer-motion spring). Numbers animate with custom easing. Sidebar items have a frosted active state.

**Animation:** Staggered card entrance (framer-motion). Number count-up. Chart area draws with a liquid fill animation. Pulse animations on live indicators.

**Typography System:** Display: "Plus Jakarta Sans" (modern, slightly condensed) for headings. Numbers: "Space Grotesk" (geometric, distinctive) for all KPI values. Body: "Inter" only for small labels/captions.
</text>
<probability>0.09</probability>
</response>

<response>
<text>
## Idea C — "Mineral Glass"
**Design Movement:** Brutalist Data Visualization meets Swiss Grid + Glass
**Core Principles:**
1. Strict 8-column grid with glass panels that break the grid intentionally
2. Heavy typographic hierarchy — KPI values at 72px, labels at 11px
3. Glass panels have visible grain texture (SVG noise filter)
4. Monochromatic base with single saturated accent

**Color Philosophy:** White base. Glass: `rgba(248,250,252,0.8)`. Single accent: VOOM red (#DC2626) for all interactive elements. All other data in grayscale. Typography: #111827 primary, #6B7280 secondary.

**Layout Paradigm:** No sidebar — top navigation bar only. Full-width sections stacked vertically. KPIs in a horizontal ticker-style row. Charts take full width. Tables use full bleed.

**Signature Elements:**
1. Glass cards with SVG grain noise overlay at 4% opacity
2. Bold section dividers with 2px accent-colored lines
3. KPI values that overflow their containers intentionally (brutalist)

**Interaction Philosophy:** Minimal animation — only functional transitions. Data updates with a flash highlight. No hover lift effects.

**Animation:** Subtle fade-in only. Numbers count up. No entrance animations.

**Typography System:** "Bebas Neue" for large KPI numbers. "IBM Plex Sans" for everything else. Strict size scale: 72/48/24/16/12/10px.
</text>
<probability>0.07</probability>
</response>

---

## Selected Design: **Idea B — "Arctic Glass"**

**Rationale:** Best matches the Liquid Glass brief with a white background. The Apple Vision Pro spatial UI language is the most sophisticated expression of glass morphism available. The asymmetric layout avoids the "AI slop" centered grid trap. Plus Jakarta Sans + Space Grotesk is a distinctive pairing that feels premium without being generic.
