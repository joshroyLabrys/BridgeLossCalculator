# Mobile Responsive Design — Bridge Loss Calculator

**Date:** 2026-03-28
**Status:** Approved

## Problem

The app is entirely desktop-focused. Zero media queries, minimal responsive Tailwind classes. On mobile, the header overflows, tabs are unusable, data tables are cramped, the simulation sidebar never collapses, and charts don't resize. For a premium product, this is unacceptable.

## Design Philosophy

Apple-quality: clean, simple, polished. Every interaction on mobile should feel intentional. No clipped text, no horizontal overflow, no tiny tap targets. The app should feel like it was designed mobile-first, even though we're retrofitting.

## Breakpoint Strategy

- **Mobile**: < 640px (default / base styles)
- **Tablet**: 640px–1023px (`sm:` / `md:`)
- **Desktop**: 1024px+ (`lg:` and above)

All changes use Tailwind responsive utilities. No custom media queries.

## Changes by Component

### 1. Header (`main-tabs.tsx`)

**Row 1 (Brand + Utilities):**
- Mobile: Compact single row. Title truncates. Unit toggle collapses to just "M" / "I" labels. Action buttons shrink to icon-only row.
- Reduce horizontal padding from `px-6` to `px-4` on mobile.

**Row 2 (Navigation Tabs):**
- Mobile: Full-width scrollable tab strip. Tab text stays but icons are hidden on smallest screens. The pill container becomes horizontally scrollable with `-webkit-overflow-scrolling: touch`.
- Tab dividers hidden on mobile for density.

### 2. Input Sub-tabs (`main-tabs.tsx` inner Tabs)

- Mobile: Horizontal scrollable tab strip with `overflow-x-auto`.
- Reduce `gap-6` to `gap-4` on mobile.

### 3. Cross-Section Form (`cross-section-form.tsx`)

- Grid: `grid-cols-1` always on mobile, `lg:grid-cols-2` on desktop (already correct).
- Table: Wrap in `overflow-x-auto` container. Add `min-w-[500px]` to the table so it scrolls horizontally on small screens.
- Chart: Reduce fixed height from `h-[300px]` to `h-[220px]` on mobile (`h-[220px] sm:h-[300px]`).

### 4. Bridge Geometry Form (`bridge-geometry-form.tsx`)

- Opening Geometry grid: `grid-cols-1 sm:grid-cols-2` (currently hard `grid-cols-2`).
- Pressure/Overtopping grid: `grid-cols-1 sm:grid-cols-3` (currently hard `grid-cols-3`).
- Pier table: `overflow-x-auto` wrapper.

### 5. Flow Profiles Form (`flow-profiles-form.tsx`)

- Already has `overflow-x-auto`. Ensure table has `min-w-[600px]` so it scrolls properly.

### 6. Coefficients Form (`coefficients-form.tsx`)

- Method toggle buttons: Wrap with `flex-wrap` so they stack 2×2 on mobile.
- Solver grid: `grid-cols-2 sm:grid-cols-3` (currently hard `grid-cols-3`).
- Energy coefficients grid: Already `grid-cols-2`, fine.

### 7. Action Buttons (`action-buttons.tsx`)

- Sticky bottom bar: Reduce padding. Stack buttons vertically on mobile (`flex-col sm:flex-row`).
- "Load Test Bridge" button: Full-width on mobile.
- Dialog: Test bridge cards stack image above text on mobile instead of side-by-side.

### 8. Method Results Tabs (`method-tabs.tsx`)

- Tab strip: Horizontally scrollable pill container, same pattern as main nav.

### 9. Method View (`method-view.tsx`)

- KaTeX equation: Allow horizontal scroll if equation overflows. `overflow-x-auto`.

### 10. Summary Section (`main-tabs.tsx` summary tab)

- All tables: `overflow-x-auto` wrappers.
- Regime Matrix: Callout section stacks below header on mobile (`flex-col sm:flex-row`).
- Comparison Tables: Horizontal scroll for wide data.

### 11. Simulation Tab (`simulation-tab.tsx`)

**This is the biggest change.**

- Layout: `flex-col lg:flex-row` instead of always `flex-row`.
- What-If sidebar: Full-width below the chart on mobile (`w-full lg:w-64`). Changes from fixed-width sidebar to a collapsible section.
- 3D scene: Full width on mobile. Height reduced (`h-[300px] sm:h-[400px] lg:h-[500px]`).
- Status bar: Wrap with `flex-wrap` so stats flow onto second line on mobile.

### 12. Global CSS (`globals.css`)

- Add smooth scrolling and touch optimizations.
- Ensure tap target minimum of 44px for interactive elements on mobile.

### 13. Tab Content Padding

- All `TabsContent` padding: `px-4 sm:px-6` instead of hard `px-6`.

## Touch & Interaction

- All buttons already use shadcn sizes (minimum h-8 = 32px). Mobile touch targets are adequate.
- Select dropdowns use Base UI/shadcn — native feel on mobile.
- Number inputs: Already hide spinners. Good.

## What We Are NOT Doing

- No hamburger menu — 4 tabs fit on mobile with scrolling
- No bottom sheet navigation — overkill for this app
- No separate mobile layout — responsive utilities only
- No mobile-only features — same app, same capabilities
