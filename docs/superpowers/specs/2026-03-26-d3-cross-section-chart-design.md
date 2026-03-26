# D3 Cross-Section Chart Design

**Date:** 2026-03-26
**Goal:** Replace Recharts LineChart with a D3-powered SVG renderer that properly draws bridge deck, piers, abutments, water surface, and ground profile with hover tooltips.

---

## Architecture

Single component replacement: `app/src/components/cross-section-chart.tsx`. Props interface unchanged.

D3 renders into a `<div ref>` via `useEffect`. React owns data, D3 owns the SVG DOM. Tooltip is a positioned div outside SVG.

## Dependencies

Install: `d3-scale`, `d3-axis`, `d3-shape`, `d3-selection`, `d3-array` + their type packages.

## Rendering Layers (bottom to top)

1. **Grid** — dashed lines matching theme border color
2. **Ground fill** — area from ground profile down to chart bottom, filled with card surface color
3. **Water surface fill** — polygon between ground and WSEL where ground < WSEL, subtle blue fill (0.08 opacity)
4. **Ground stroke** — line on top of fill, muted gray, 2px
5. **Bridge deck** — filled rectangle from low chord to high chord, between abutments. Red with 0.15 opacity fill, 1.5px red stroke
6. **Low chord line** — solid red, 2.5px
7. **High chord line** — dashed red, 1.5px
8. **Abutment walls** — vertical red lines from ground to high chord at each abutment station, 2.5px
9. **Piers** — filled rectangles from ground to low chord at each pier station, width from pier data. Red with 0.4 opacity fill, 1px stroke
10. **DS WSEL line** — full-width dashed blue, 1.5px
11. **Method WSEL lines** — dashed, method-colored, drawn upstream of left abutment only
12. **Ground dots** — circles at each cross-section point, highlight on hover
13. **Crosshair** — vertical dashed line tracking cursor

## Interactivity

- **Transparent overlay rect** captures mousemove/mouseleave
- **Tooltip** shows: station, ground elevation. When over bridge span: also low chord, high chord. When over pier: pier width.
- **Nearest dot highlighting** — closest ground point gets larger radius + accent color
- **Crosshair line** — vertical dashed accent line at cursor X

## Tooltip Styling

Positioned absolute div with Tailwind classes matching app theme:
- `bg-card border border-border rounded-lg p-2 text-xs font-mono`
- Labels: `text-muted-foreground uppercase tracking-wide text-[10px]`
- Values: `text-foreground font-semibold`

## Responsive Sizing

`ResizeObserver` on the container div. D3 scales and axes rebuild on resize.

## Axes

- X: Station (ft), ticks every ~50 ft
- Y: Elevation (ft), domain padded 3 ft above/below data range
- Axis labels styled to match theme muted-foreground color

## Legend

Flex row below chart. Items: Ground, Bridge Deck, DS WSEL, and one per method WSEL (colored). Dashed swatches for dashed lines.

## Colors

- Ground: `#71717a` stroke, card surface fill
- Bridge/piers/abutments: `#ef4444`
- Water: `#3b82f6` at 0.08 opacity
- Method colors: energy `#3b82f6`, momentum `#10b981`, yarnell `#f59e0b`, wspro `#8b5cf6`
- Grid/axes: theme border color
- Crosshair/highlight: primary accent

## Props Interface (unchanged)

```typescript
interface CrossSectionChartProps {
  crossSection: CrossSectionPoint[];
  wsel?: number;
  bridge?: BridgeGeometry;
  methodWsels?: Record<string, number>;
}
```

## Files Modified

1. `app/src/components/cross-section-chart.tsx` — full rewrite
2. `app/package.json` — add d3 submodule dependencies

## What Doesn't Change

- All consumers (`cross-section-form.tsx`, `action-buttons.tsx`)
- Props interface
- Engine, store, types, validation
- All other UI components
