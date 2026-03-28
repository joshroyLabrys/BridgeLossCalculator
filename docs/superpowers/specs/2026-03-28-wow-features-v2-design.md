# Wow Features V2 — Design Spec

**Date:** 2026-03-28
**Goal:** Four features that make hydraulic engineers say "I need to show this to everyone": HEC-RAS geometry import, auto-design optimizer, side-by-side scenario comparison, and AI chat assistant.

**Audience:** Hydraulic engineers showing other hydraulic engineers. The wow is engineering depth and workflow speed, not visual flash.

**Tech Stack:** React 19, Zustand, OpenAI (existing integration), D3 (existing), Tailwind CSS v4, Lucide icons. All parsing is client-side — no new server endpoints except extending the existing AI route.

---

## Feature 1: HEC-RAS Geometry Import

### Purpose
Eliminate 15-20 minutes of manual data entry. Engineer drags a `.g01` file onto the app and the entire model populates instantly.

### Supported formats
- **Geometry files:** `.g01` through `.g09` (HEC-RAS 5.x/6.x text-based geometry format)
- **Flow files:** `.f01` through `.f09` (steady flow data)
- **Not supported:** HDF5 `.hdf` plan files from RAS 6. Text format only.

### Parser (`src/lib/hecras-parser.ts`)
Pure text parsing, client-side. Extracts:

| HEC-RAS section | Maps to |
|---|---|
| `#Sta/Elev=` | `CrossSectionPoint[]` (station, elevation) |
| `#Mann=` | `CrossSectionPoint.manningsN` per station range |
| `Bank Sta=` | `CrossSectionPoint.bankStation` left/right markers |
| `BEGIN BRIDGE: ... END BRIDGE:` | `BridgeGeometry` (abutment stations, deck, piers) |
| `Deck/Roadway=` line | `lowChordLeft`, `lowChordRight`, `highChord`, `deckWidth` |
| Pier data within bridge block | `Pier[]` (station, width, shape) |
| `.f01` profile data | `FlowProfile[]` (name, discharge, dsWsel) |

Channel slope: extracted from `.f01` if present, otherwise user enters manually post-import.

### UX flow
1. **Drop zone** on the Input tab header — accepts drag-and-drop or click-to-browse. Also accessible via the existing Import button (new file type option).
2. **Selection dialog** (only if file contains multiple cross-sections/bridges): table with river station IDs, user picks which to import. Most files have one — skip this step when possible.
3. **Preview card**: summary showing "12 XS points, 2 piers, 4 flow profiles" with a mini cross-section thumbnail. "Import" or "Cancel."
4. **Populate**: Replaces current store data. If data already exists, show a confirmation warning first ("This will replace your current project. Continue?").

### Scope boundaries
- One cross-section + one bridge per import. No multi-reach modeling.
- No partial merge — full replacement only.
- Pier shapes mapped to nearest equivalent (`round-nose`, `square`, `cylindrical`, `sharp`). Unusual shapes default to `round-nose`.

---

## Feature 2: Auto-Design Optimizer

### Purpose
Eliminate trial-and-error parameter sweeps. Engineer sets a target ("0.3m freeboard at Q100") and the tool finds the optimal parameter value automatically.

### Location
New "Optimize" card below the What-If sidebar in the Simulation tab. Compact layout: target picker, parameter picker, "Run" button.

### Sweepable parameters (one at a time)
- Bridge opening width (moves abutments symmetrically inward/outward)
- Low chord elevation
- Manning's n multiplier
- Discharge multiplier
- Debris blockage %

### Target metrics
- Minimum freeboard (most common)
- Maximum afflux
- Maximum bridge velocity

### Algorithm
1. **Coarse sweep**: 10 evenly-spaced steps across the parameter range to find bounds
2. **Binary search**: Narrows to the threshold crossing point within tolerance (0.01m for freeboard/afflux, 0.01 m/s for velocity)
3. Runs the real engine at each point — no approximations
4. Typically 15-25 engine calls total. Fast since the engine is pure JS in-browser.

### Output
- **Chart**: Small D3 line chart — parameter (x) vs metric (y). Threshold as a dashed horizontal line. Crossing point marked with a dot and label.
- **Summary text**: "Opening width of 42.3m achieves 0.30m freeboard at Q100 using Energy method"
- **Apply button**: Populates the what-if sliders with the optimal value so the engineer sees it in the 3D scene and EGL diagram.
- **Warning badge**: If the optimal value fails for a higher-ARI profile (e.g., "Optimal for Q100 but breaches freeboard at PMF"), show an amber warning.

### Scope boundaries
- Single-parameter optimization only. No multi-variable.
- Uses the currently selected calculation method, not all four.
- No persistence of optimization runs — live tool only.

---

## Feature 3: Side-by-Side Scenario Comparison

### Purpose
Compare "existing vs proposed" or any two configurations visually, with deltas on every key metric.

### Snapshot system
- **Save button** in the header bar: "Save Scenario" captures full store state (inputs + results) as a named snapshot in Zustand.
- User provides a name (e.g., "Existing Bridge", "Proposed — 2m wider").
- Max 5 snapshots in memory. Oldest auto-evicted if limit reached, with a warning.
- Snapshots are in-memory only — lost on refresh. Engineers use JSON export for persistence.

### Comparison view
New "Compare" toggle/mode within the Summary tab. Two dropdowns to select Scenario A and Scenario B.

### Visual diff
| Component | Diff treatment |
|---|---|
| Cross-section chart | Both profiles overlaid, water level difference shaded |
| Afflux | Bar chart with A vs B side by side per flow profile |
| Key metrics table | Delta columns: US WSEL, head loss, velocity, Froude, freeboard — green/red for better/worse |
| EGL diagram | Overlaid energy grade lines in distinct colors (A = blue, B = amber) |

### Scope boundaries
- No 3D comparison — two Three.js canvases is heavy and confusing. 2D charts tell the story better.
- Max 2 scenarios compared at once.
- No automatic "what changed" detection — engineer names and manages scenarios.

---

## Feature 4: AI Chat Assistant

### Purpose
Conversational AI that understands the entire analysis. Engineers ask questions, get explanations grounded in their actual numbers, and issue commands that modify parameters live.

### Location
Floating button (bottom-right, Sparkles icon) opens a slide-out panel on the right. Overlays content, doesn't push layout. ~350px wide on desktop, full-width sheet on mobile.

### Context injection
Every turn sends the current state as a system prompt:
- Cross-section statistics (point count, min/max station/elevation, bank stations)
- Bridge geometry summary
- Coefficients
- All method results for all profiles (US WSEL, head loss, velocity, Froude, regime, convergence, errors)
- Active what-if overrides and their deltas
- Optimizer output if present
- Scenario comparison deltas if in compare mode

Uses the existing OpenAI API key from `.env.local`. Extends the existing `/api/ai-summary` route pattern.

### Capability tiers

**Tier 1 — Q&A:**
- "Is this bridge adequate for Q100?" → references freeboard, method agreement, regime
- "What does a Froude number of 0.85 mean here?" → domain explanation grounded in actual data

**Tier 2 — Explain:**
- "Walk me through the Energy method" → references `MethodResult.calculationSteps`
- "Why do Momentum and Yarnell disagree?" → compares results, identifies assumption differences

**Tier 3 — Command (via OpenAI function calling):**
- "Set Manning's n to 0.045" → AI calls `adjust_manning` tool → frontend applies to what-if state
- "Try 20% debris blockage" → AI calls `adjust_debris` → shows before/after delta inline

Available AI tools (function calling):
| Tool | Effect |
|---|---|
| `adjust_mannings_n` | Sets Manning's n multiplier |
| `adjust_discharge` | Sets discharge multiplier |
| `adjust_debris` | Sets debris blockage % |
| `adjust_contraction_coeff` | Sets contraction coefficient |
| `adjust_expansion_coeff` | Sets expansion coefficient |
| `reset_overrides` | Resets all what-if to baseline |

**Not available via chat:** Geometry changes (moving XS points, adding piers, changing abutment stations). Too complex to express safely through conversation.

### Conversation model
- Multi-turn with history
- System prompt refreshed each turn with latest state (so AI sees results after its own parameter changes)
- Streaming responses (token-by-token) for responsiveness

### UI details
- User messages right-aligned, AI messages left-aligned with subtle accent border
- When AI triggers a parameter change: inline card showing before/after delta (styled like the existing What-If Impact section)
- "Clear conversation" button resets history and message counter
- **15 messages per session** cap with visible counter (`3 / 15`). Resets on page refresh or clear.

### Scope boundaries
- Text-only responses — no chart/image generation in chat. Engineer views live charts alongside.
- No new auth flow — uses existing OpenAI key.
- No conversation persistence across sessions.
- What-if parameters only — no geometry modification via chat.

---

## Architecture Notes

### New files
| File | Responsibility |
|---|---|
| `src/lib/hecras-parser.ts` | HEC-RAS `.g01`/`.f01` text parser |
| `src/lib/hecras-parser.test.ts` | Parser tests with sample geometry snippets |
| `src/components/import/hecras-import-dialog.tsx` | Selection + preview dialog for HEC-RAS import |
| `src/components/import/drop-zone.tsx` | Drag-and-drop file target |
| `src/components/simulation/optimizer-card.tsx` | Optimizer UI: target/parameter pickers, chart, apply button |
| `src/engine/optimizer.ts` | Binary search + sweep logic, calls engine methods |
| `src/components/summary/scenario-comparison.tsx` | Side-by-side comparison view |
| `src/components/ai-chat/chat-panel.tsx` | Slide-out chat container |
| `src/components/ai-chat/chat-message.tsx` | Message bubble component |
| `src/components/ai-chat/chat-input.tsx` | Input bar with send button |
| `src/lib/api/ai-chat-prompt.ts` | System prompt builder + tool definitions for chat |
| `src/app/api/ai-chat/route.ts` | Streaming chat API route |

### Modified files
| File | Change |
|---|---|
| `src/store/project-store.ts` | Add scenario snapshots array, save/delete snapshot actions |
| `src/components/main-tabs.tsx` | Add drop zone wrapper, scenario save button in header, chat FAB |
| `src/components/simulation/simulation-tab.tsx` | Add optimizer card to sidebar |
| `src/components/input/cross-section-form.tsx` | Wire up HEC-RAS import to populate form |
| `src/components/summary/comparison-tables.tsx` | Support comparison mode data |

### State shape additions (Zustand)
```typescript
// In ProjectStore
scenarios: Array<{
  name: string;
  snapshot: ProjectState & { results: CalculationResults };
  savedAt: number;
}>;
saveScenario: (name: string) => void;
deleteScenario: (index: number) => void;
```

### API cost management
- AI chat: 15 messages/session cap
- Context is compressed (summary stats, not raw point arrays) to minimize tokens
- Existing AI summary remains a separate one-shot call — not affected by chat
