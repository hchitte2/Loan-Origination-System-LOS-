# Clearline design tokens

Copy 1:1 into `globals.css` (`:root` = light, `.dark` = dark, `@theme inline` maps to Tailwind). Semantic colours are used as **text/icon colour on a 12 % tint** for pills (`color-mix(in oklab, var(--success) 12%, var(--card))`) and as **solid fills** with their `-foreground` for buttons.

| Token | Light | Dark |
|---|---|---|
| `background` | `#f7f7f8` | `#141518` |
| `foreground` | `#18181b` | `#ececee` |
| `muted` | `#efeff1` | `#24262b` |
| `muted-foreground` | `#64687a` | `#9b9fa8` |
| `card` | `#ffffff` | `#1c1d21` |
| `card-foreground` | `#18181b` | `#ececee` |
| `border` | `#e4e4e7` | `#2e3036` |
| `primary` | `#0f766e` | `#2aa393` |
| `primary-foreground` | `#ffffff` | `#07201d` |
| `success` | `#15803d` | `#4ade80` |
| `success-foreground` | `#ffffff` | `#052e16` |
| `warning` | `#b45309` | `#fbbf24` |
| `warning-foreground` | `#ffffff` | `#1c1400` |
| `destructive` | `#b91c1c` | `#f87171` |
| `destructive-foreground` | `#ffffff` | `#2a0a0a` |
| `ring` | `#0f766e` | `#2dd4bf` |
| `chart-1` (Lead) | `#b3c2bf` | `#5b6664` |
| `chart-2` (Application) | `#8fd3c9` | `#3f8f85` |
| `chart-3` (Processing) | `#4fb8ab` | `#4fb8ab` |
| `chart-4` (Underwriting) | `#2a9d90` | `#66cbbf` |
| `chart-5` (Conditional approval) | `#0f766e` | `#8fd3c9` |
| `chart-6` (Clear to close) | `#0b5049` | `#b9e8e1` |
| `radius` | `6px` | `6px` |

Additions used by the design (not in the required list):

| Token | Light | Dark | Use |
|---|---|---|---|
| `banner` | `#fcd34d` | `#fcd34d` | impersonation banner background (dark text in both themes) |
| `banner-foreground` | `#1c1400` | `#1c1400` | text and outline button on the banner |
| `shadow-card` | `0 1px 2px rgba(0,0,0,.06)` | `0 1px 2px rgba(0,0,0,.4)` | loan cards |
| `shadow-popover` | `0 8px 24px rgba(0,0,0,.12)` | `0 8px 24px rgba(0,0,0,.5)` | menus, dialogs, toasts |

Stage pills: `background: color-mix(in oklab, var(--chart-N) 22%, var(--card)); color: var(--foreground)` plus the stage icon.
Focus ring: `box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ring)` (2 px ring, 2 px offset).

## Type

- Display: **Geist** 600 (wordmark, page titles, KPI values, borrower greeting). Fallback `Inter, system-ui, sans-serif`.
- Body: **Inter** 400/500/600. Numbers always `font-variant-numeric: tabular-nums`.

| Role | Face | Size / line | Weight |
|---|---|---|---|
| KPI value | Geist | 28 / 32 | 600 |
| Borrower greeting | Geist | 24 / 30 | 600 |
| Page title (h1) | Geist | 20 / 28 | 600 |
| Dialog title | Inter | 17 / 24 | 600 |
| Section title (h2) | Inter | 15 / 22 | 600 |
| Body | Inter | 14 / 20 | 400 |
| Control (buttons, tabs, table cells) | Inter | 13 / 18 | 500 |
| Caption / pill | Inter | 12 / 16 | 400–500 |
| Tag (prior-to, attention, program) | Inter | 11 / 14 | 500 |

## Spacing and sizing

4 px scale (4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48).

- Table row height: **40 px** (header 36 px)
- Board card padding: **12 px**
- Page gutter: **24 px** desktop, **16 px** mobile
- Sidebar width 240 px · nav item 36 px · button 32 px · input 36 px · pill 22 px · tag 20 px
- Mobile touch targets ≥ 44 px (upload zones 72 px, e-consent row 44 px, phone link 44 px)
- Icons: Lucide, 16 px in pills/buttons/menus/rows, 20 px in sidebar nav and empty states

## Motion

Fades and slides only: 150 ms ease-out, ≤ 8 px travel. Under `prefers-reduced-motion: reduce`: no transitions, no skeleton shimmer, pending spinner becomes a static `loader` icon.
