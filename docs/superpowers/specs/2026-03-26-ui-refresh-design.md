# UI Refresh Design — ShadCN Polish Pass

**Date:** 2026-03-26
**Approach:** Polished Current (Approach A) — minimal structural changes, maximum visual upgrade
**Audience:** Hydraulic engineers doing QA — data-dense, professional, scannable

---

## 1. Color Palette & Theme

### Accent: Muted Slate-Blue
- Primary: `oklch(0.55 0.12 230)` — buttons, active tab indicators, focus rings
- Primary foreground: `oklch(0.98 0 0)` — text on primary backgrounds
- Primary hover: `oklch(0.48 0.12 230)` — darker on hover
- Primary muted: `oklch(0.25 0.04 230)` — subtle accent backgrounds

### Dark Theme Refinements
- Background: `oklch(0.13 0.01 230)` — near-black with cool blue undertone
- Card/surface: `oklch(0.17 0.01 230)` — subtle elevation
- Border: `oklch(0.26 0.02 230)` — softer, blue-tinted
- Muted foreground: `oklch(0.55 0.01 260)` — warm-ish gray for readability
- Foreground: `oklch(0.95 0 0)` — near-white, unchanged
- Destructive: keep current red
- Success: keep current green

### Method Colors (Unchanged)
- Energy: `#3b82f6` (blue)
- Momentum: `#10b981` (green)
- Yarnell: `#f59e0b` (amber)
- WSPRO: `#8b5cf6` (purple)
- HEC-RAS: `#ef4444` (red) — gold row background refined to `oklch(0.22 0.04 85)` with `oklch(0.30 0.04 85)` border

---

## 2. Typography & Spacing

### Hierarchy
- Page title: `text-xl font-semibold` in accent color
- Section headers (inside cards): `text-sm font-semibold uppercase tracking-wide text-muted-foreground`
- Card titles: `text-base font-semibold` (CardHeader)
- Card descriptions: `text-sm text-muted-foreground`
- Data labels: `text-xs text-muted-foreground`
- Data values: `text-sm font-mono tabular-nums`
- All numerical table columns: `font-mono tabular-nums text-right`

### Spacing
- Card padding: `p-5`
- Form field gaps: `gap-4` consistently
- Table cells: `px-3 py-2`
- Section gaps: `space-y-6` within, `space-y-8` between top-level
- Tab content area: `px-6 py-5`

---

## 3. Component-by-Component Changes

### 3.1 Top Bar (`top-bar.tsx`)
- Add `backdrop-blur-sm bg-background/80` for frosted header
- Add Lucide `Waves` icon next to title
- Title in accent color: `text-xl font-semibold text-primary`
- Import button: add `Upload` icon, keep `outline` variant
- Export button: add `Download` icon, keep `outline` variant
- Subtle accent-tinted bottom border

### 3.2 Main Tabs (`main-tabs.tsx`)
- Tab triggers: accent-colored bottom indicator on active
- Add Lucide icons to tab labels: `Settings2` for Input, `FlaskConical` for Method Results, `BarChart3` for Summary & Charts
- Rename "Summary & Charts" to "Summary" (shorter, cleaner)

### 3.3 Cross-Section Form (`input/cross-section-form.tsx`)
- Wrap entire form in `Card` with `CardHeader` ("Cross-Section Data", "Define station/elevation points for the channel cross-section")
- Data table: use `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell` components
- Zebra striping: `even:bg-muted/30` on rows
- Delete button: `Trash2` icon, ghost variant, `text-muted-foreground hover:text-destructive`
- "Add Row" button: `Plus` icon prefix
- Preview card: separate `Card` with `CardHeader` ("Preview", "Live preview updates as you enter data")
- Numerical inputs: add `font-mono` class

### 3.4 Bridge Geometry Form (`input/bridge-geometry-form.tsx`)
- Wrap in `Card` with `CardHeader`
- "Opening Geometry" section: `text-sm font-semibold uppercase tracking-wide text-muted-foreground` divider label
- Form grid: `grid-cols-2 gap-4` (already correct, just add card wrapper)
- Pier table: same treatment as cross-section table — proper `Table` components, zebra rows, `Trash2` delete
- Low Chord Profile: replace hand-rolled `<button>` toggle with `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` + `ChevronRight`/`ChevronDown` icons
- Numerical inputs: `font-mono`

### 3.5 Flow Profiles Form (`input/flow-profiles-form.tsx`)
- Wrap in `Card` with `CardHeader` ("Flow Profiles", "Define up to 10 discharge scenarios")
- Table: proper `Table` components, zebra rows
- Delete: `Trash2` icon
- Add button: `Plus` icon prefix
- Numerical inputs: `font-mono`

### 3.6 Coefficients Form (`input/coefficients-form.tsx`)
- Wrap in `Card` with `CardHeader`
- Each sub-section ("Energy Method Coefficients", "Yarnell Method", "Iteration Settings", "Methods to Run") gets a section divider label
- Method checkboxes: add a subtle color pip/dot matching the method's chart color next to each label
- Numerical inputs: `font-mono`

### 3.7 Action Buttons (`input/action-buttons.tsx`)
- Sticky bottom bar: `sticky bottom-0 backdrop-blur-sm bg-background/80 border-t py-3 px-6 -mx-6`
- "Run All Methods" button: primary variant (accent color), `Play` icon
- "Plot Cross-Section" button: outline variant, `LineChart` icon
- "Clear Results" button: outline variant, `RotateCcw` icon
- Replace `alert()` validation errors with inline error banner: a `destructive` Card variant above the buttons listing validation issues
- Dialog: add `CardHeader`-style title treatment

### 3.8 Method Tabs (`results/method-tabs.tsx`)
- Tab triggers: add colored dot matching each method's chart color
- Keep current structure

### 3.9 Method View (`results/method-view.tsx`)
- Reference card: wrap in `Card` with accent-tinted left border (`border-l-4 border-primary`)
- Equation: styled `code` block with slightly larger font, accent-tinted background
- Empty state: centered with `Calculator` icon, improved copy: "No results yet — configure inputs and run calculations"

### 3.10 Profile Accordion (`results/profile-accordion.tsx`)
- Accordion items: `Card`-style borders with rounded corners (already has this, just refine)
- Converged badge: use accent/primary variant instead of generic default
- Input echo / Results grids: use `Card` children with `bg-muted/30` background instead of `bg-card`
- Section labels ("Input Echo", "Results", etc.): consistent `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- TUFLOW FLC section: same card treatment

### 3.11 Calculation Steps (`results/calculation-steps.tsx`)
- Wrap in a proper code-block card with `bg-muted/20` background
- Step numbers: `text-muted-foreground font-semibold`
- Formula text: `text-primary` (accent color)
- Result values: `text-blue-400 font-semibold` (keep current, it works)

### 3.12 Iteration Log (`results/iteration-log.tsx`)
- Replace hand-rolled `<button>` with `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`
- Add `ChevronRight`/`ChevronDown` icon
- Table: proper `Table` component, zebra rows
- Trigger text styled as a subtle interactive element, not bare text

### 3.13 Comparison Tables (`summary/comparison-tables.tsx`)
- Each table section: wrap in `Card` with `CardHeader` (title + brief description)
- Tables: proper `Table` components throughout
- Method name cells: add colored dot/pip matching method chart color
- HEC-RAS row: refined gold background per palette spec
- % difference badges: keep color logic, ensure consistent badge sizing

### 3.14 Regime Matrix (`summary/regime-matrix.tsx`)
- Wrap in `Card` with `CardHeader`
- Table: proper `Table` component
- Regime badges: add full-word tooltip on hover (F → "Free Surface", P → "Pressure", O → "Overtopping")
- Method name cells: add colored dots

### 3.15 Summary Charts (`summary/charts.tsx`)
- Each chart: wrap in `Card` with `CardHeader` (title + one-line description)
- Tooltip styling: match new border/background colors from palette
- Legend: slightly larger font for readability

### 3.16 HEC-RAS Input Row (`summary/hecras-input-row.tsx`)
- Refined gold row colors per palette spec
- Input styling: `font-mono` for numerical inputs
- Label "HEC-RAS": keep gold color but use `font-semibold`

---

## 4. Globals & Theme (`globals.css`)

Update CSS custom properties for the dark theme:
- `--background`, `--foreground`, `--card`, `--border`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`
- Add `--primary` as the slate-blue accent
- Keep `--destructive`, `--accent`, `--secondary` in the same family but tuned to complement the blue

---

## 5. What Does NOT Change

- **Engine logic** (`src/engine/*`) — zero modifications
- **Store** (`src/store/project-store.ts`) — zero modifications
- **Types** (`src/engine/types.ts`) — zero modifications
- **Validation** (`src/lib/validation.ts`) — zero modifications
- **JSON I/O** (`src/lib/json-io.ts`) — zero modifications
- **Constants** (`src/lib/constants.ts`) — zero modifications
- **Component file structure** — same files, same exports, same props interfaces
- **Recharts data logic** — only tooltip/cosmetic styling changes
- **Tab hierarchy** — Input (with 4 sub-tabs), Results, Summary stays the same
- **ShadCN UI primitives** (`src/components/ui/*`) — used as-is, not modified

---

## 6. New Dependencies

None. Everything needed is already installed:
- `lucide-react` for icons
- ShadCN components (accordion, badge, button, card, checkbox, collapsible, dialog, input, label, select, table, tabs)
- `tailwind-merge`, `clsx`, `class-variance-authority`

---

## 7. Files to Modify

1. `src/app/globals.css` — color palette update
2. `src/app/layout.tsx` — no changes needed
3. `src/app/page.tsx` — no changes needed
4. `src/components/top-bar.tsx` — icons, accent styling, frosted header
5. `src/components/main-tabs.tsx` — tab icons, renamed label
6. `src/components/cross-section-chart.tsx` — tooltip styling tweaks
7. `src/components/input/cross-section-form.tsx` — Card wrapping, Table components, icons
8. `src/components/input/bridge-geometry-form.tsx` — Card wrapping, Table, Collapsible
9. `src/components/input/flow-profiles-form.tsx` — Card wrapping, Table components
10. `src/components/input/coefficients-form.tsx` — Card wrapping, method color pips
11. `src/components/input/action-buttons.tsx` — sticky bar, icons, inline validation errors
12. `src/components/results/method-tabs.tsx` — method color dots
13. `src/components/results/method-view.tsx` — Card treatment, improved empty state
14. `src/components/results/profile-accordion.tsx` — refined badges, card children
15. `src/components/results/calculation-steps.tsx` — code block styling
16. `src/components/results/iteration-log.tsx` — Collapsible component, Table
17. `src/components/summary/comparison-tables.tsx` — Card wrapping, Table components, color dots
18. `src/components/summary/regime-matrix.tsx` — Card wrapping, Table, tooltips
19. `src/components/summary/charts.tsx` — Card wrapping, tooltip styling
20. `src/components/summary/hecras-input-row.tsx` — refined gold styling, font-mono
