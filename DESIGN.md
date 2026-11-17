# FuelTrack Design System

## 1. Visual Direction & Usage Scene
- **Domain:** Bulk fuel wholesale distribution, tanker fleet compartment sealing, 15°C thermal volume compensation (ASTM Table 54B / Res. SE 1102/04), and physical-liter customer ledgers for agriculture, roadworks, and mining.
- **Mode:** **Operate** (field & depot operations console).
- **Scene:** Bright daylight yard, fuel depot dispatch desk, and truck cab tablets/smartphones (`393x852` mobile to desktop). High glare readability, unmistakable status hierarchy, zero ornamental fluff.
- **Competitive Benchmark:** Inspired by industrial fleet/fuel telemetry tools (Samsara Fleet, Trimble Dispatch, Veeder-Root tank consoles): high-contrast light operational canvas (`#F1F5F9` / `#FFFFFF`), dark instrument header (`#0F172A`), and safety-amber operational highlights (`#F59E0B` / `#B45309`).
- **Dial:** `ENERGY 2 / RHYTHM 3 / MOTION 1`

## 2. Color Tokens
Strict 2-neutral-surface + 1-accent + 2-semantic-status system (no ad-hoc decorative hues):

| Token | Value / Utility | Role | Contrast Notes |
| :--- | :--- | :--- | :--- |
| `--ft-bg-canvas` | `#F1F5F9` (`slate-100`) | App canvas for daylight yard use | Base light ground |
| `--ft-bg-surface` | `#FFFFFF` (`white`) | Primary operational cards and tables | Clean separation via `1px solid #CBD5E1` |
| `--ft-bg-subtle` | `#F8FAFC` (`slate-50`) | Flat sub-rows and summary strips (borderless inside cards) | Avoids nested bordered cards |
| `--ft-bg-header` | `#0F172A` (`slate-900`) | Top navigation bar & primary CTA buttons | High-contrast anchor |
| `--ft-text-primary` | `#0F172A` (`slate-900`) | Headings, metrics, license plates | >15:1 on white/slate-50 |
| `--ft-text-secondary` | `#334155` (`slate-700`) | Body text, form labels, seal codes | >9:1 on white/slate-50 |
| `--ft-text-muted` | `#475569` (`slate-600`) | Helper descriptions, captions | >6.8:1 on white/slate-50 (WCAG AA) |
| `--ft-accent` | `#F59E0B` (`amber-500`) | Active tab fill (`text-slate-950`) & focus ring | 9.7:1 with `slate-950` text |
| `--ft-accent-text` | `#B45309` (`amber-700`) | Numeric volume emphasis on light surfaces | >5.0:1 on white |
| `--ft-status-ok` | `#15803D` (`green-700`) | Intact seal / approved ePOD | >=5.1:1 on `#F0FDF4` |
| `--ft-status-alert` | `#B91C1C` (`red-700`) | Violated seal / blocked anomaly / thermal expansion deficit | >=6.4:1 on `#FEF2F2` |

## 3. Typography & Hierarchy
- **UI Sans:** System geometric/humanist stack (`'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`) for 100% offline reliability without external font CDNs.
- **Data Monospace:** `ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Menlo, Consolas, monospace` with `tabular-nums`, reserved strictly for license plates, seal codes, meter counters, VCF factors, and liter figures.
- **Strict Descending Scale (>=1.25x step between main heading levels):**
  - `h1` (App brand): `1.5rem` (24px), `font-extrabold`
  - `h2` (View title): `1.125rem` (18px), `font-bold`
  - `h3` (Record / card title): `1rem` (16px), `font-bold`
  - `h4` (Section subheading): `0.875rem` (14px), `font-bold`
  - `body`: `0.875rem` (14px)
  - `caption / badge / label`: `0.75rem` (12px) minimum functional size (no sub-12px functional UI copy).

## 4. Layout Rhythm, Accessibility & Field Ergonomics
- **Tap Targets:** All navigation tabs, primary actions, and form controls enforce `min-h-[48px]` (`>= 44px` minimum, `48px` cab/field standard).
- **Responsive Reflow:** Navigation wraps cleanly (`flex-wrap`) with no horizontal overflow at `393px` width; multi-column grids collapse to `grid-cols-1` below `640px`.
- **Flat Card Discipline:** Cards never contain nested bordered sub-cards; internal groups use `border-t border-slate-200` dividers and borderless `bg-slate-50` rows.
- **Keyboard & Focus:** Explicit `3px` high-contrast `#F59E0B` `:focus-visible` outline on all interactive controls; `role="tablist"` / `role="tab"` / `aria-selected` on tabs; `role="dialog" aria-modal="true"` with `Escape` close on modals; bound `<label for="...">` on every input.
- **Motion & Print:** `@media (prefers-reduced-motion: reduce)` disables all transitions; `@media print` forces clean white-paper ePOD output and hides `.no-print` chrome.
