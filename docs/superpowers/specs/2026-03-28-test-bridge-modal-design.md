# Test Bridge Selection Modal Redesign

**Date:** 2026-03-28
**Status:** Approved

## Problem

The current test bridge modal is a basic dialog with a flat list of cards using static images. It doesn't communicate what each bridge looks like or feels like, and the flow after selection requires manual steps (close modal → click Run → navigate to Summary).

## Design

### Interaction Flow

1. User clicks "Load Test Bridge" → modal opens
2. All 5 bridges shown as cards in a 2-column grid (1 column on mobile)
3. **Hover** a card → its `<video>` starts playing (looped, muted, inline)
4. **Mouse leave** → video pauses and resets to frame 0 (acts as poster)
5. **Click** a card → it becomes "selected" — ring highlight, video keeps looping even without hover
6. Clicking a different card moves the selection
7. **Confirm button** at modal bottom — disabled until a bridge is selected
8. On confirm: modal closes → bridge data loaded → calculations auto-run → user lands on Summary tab → AI summary triggers

### Card Layout

Each card is a `<button>` with:
- **Video area** (~160px height): `<video>` element, `object-fit: cover`, `muted`, `loop`, `playsInline`. Source: `/bridges/{bridge.id}.mp4`
- **Text area** below video: bridge name (font-medium), location (text-sm muted), one-line description (text-xs muted, 2-line clamp)
- **Default state**: `border border-border/50 bg-muted/30 rounded-lg overflow-hidden`
- **Hover state**: `ring-1 ring-ring`
- **Selected state**: `ring-2 ring-primary bg-primary/5` — video continues playing regardless of hover

### Confirm Button

- Sticky at the bottom of the dialog content, separated by a border-top
- Text shows selected bridge name: `"Load {bridge.name} →"`
- When disabled (no selection): muted text, `opacity-50`, `cursor-not-allowed`
- When enabled: primary button styling matching the existing "Run All Methods" button

### Confirm Action Sequence

When the user clicks confirm:
1. Close the modal (`setTestOpen(false)`)
2. Call the existing `handleLoadTestBridge(selectedBridge)` to populate inputs
3. Run all methods (same logic as `handleRunAll`)
4. Set active tab to `'summary'`
5. Trigger `fetchAiSummary()`

This replaces the current behavior where `handleLoadTestBridge` loads data and the user must manually click Run.

### Video Files

- **Location:** `app/public/bridges/`
- **Naming:** `{bridge.id}.mp4` — matching the `id` field in `test-bridges.ts`
- **Files expected:**
  - `app/public/bridges/v-channel-benchmark.mp4`
  - `app/public/bridges/beaver-creek.mp4`
  - `app/public/bridges/bogue-chitto.mp4`
  - `app/public/bridges/windsor.mp4`
  - `app/public/bridges/breakfast-creek.mp4`
- **Spec:** 5 seconds, looped, muted. Any resolution — the video element uses `object-fit: cover` at ~160px height
- **Fallback:** If video fails to load, show a solid `bg-muted` placeholder (no broken image icon)

### Responsive

- Desktop (sm+): 2-column grid
- Mobile: 1-column stack
- Modal max width: `max-w-2xl` (unchanged)
- Card grid scrolls if needed: `max-h-[70vh] overflow-y-auto`

## Files Changed

| File | Change |
|---|---|
| `app/src/components/input/action-buttons.tsx` | Replace modal content with video card grid, add selection state, confirm button, auto-run logic |
| `app/public/bridges/*.mp4` | 5 video files (user-provided) |

No new component files — the modal stays inline in `action-buttons.tsx` following the existing pattern. The change is scoped to the `<Dialog>` content block (~lines 131-163).
