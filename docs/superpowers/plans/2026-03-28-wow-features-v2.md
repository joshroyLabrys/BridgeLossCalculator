# Wow Features V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HEC-RAS geometry import, auto-design optimizer, side-by-side scenario comparison, and AI chat assistant to make the Bridge Loss Calculator a must-show tool for hydraulic engineers.

**Architecture:** Feature 1 (HEC-RAS import) is a pure client-side text parser with an import dialog. Feature 2 (optimizer) runs the existing engine in a binary search loop. Feature 3 (scenarios) adds snapshot storage to Zustand with a comparison view in Summary. Feature 4 (AI chat) extends the existing OpenAI integration to multi-turn streaming conversation with function calling for what-if parameter changes.

**Tech Stack:** Next.js 16, React 19, Zustand, OpenAI (existing `callOpenAI`), D3 (existing), Tailwind CSS v4, Lucide icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-03-28-wow-features-v2-design.md`

**IMPORTANT:** This project uses Next.js 16 which has breaking changes from earlier versions. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. All new components must be `'use client'` since they use hooks and browser APIs.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/hecras-parser.ts` | Parse HEC-RAS `.g0x` geometry and `.f0x` flow files into app types |
| `src/__tests__/lib/hecras-parser.test.ts` | Parser unit tests with sample HEC-RAS snippets |
| `src/components/import/hecras-import-dialog.tsx` | Selection + preview dialog for multi-XS/bridge files |
| `src/components/import/drop-zone.tsx` | Drag-and-drop file target wrapper |
| `src/engine/optimizer.ts` | Parameter sweep + binary search, calls `runAllMethods` |
| `src/__tests__/engine/optimizer.test.ts` | Optimizer unit tests |
| `src/components/simulation/optimizer-card.tsx` | Optimizer UI: pickers, chart, apply button |
| `src/components/summary/scenario-comparison.tsx` | Side-by-side comparison view |
| `src/components/ai-chat/chat-panel.tsx` | Slide-out chat container + message list |
| `src/components/ai-chat/chat-message.tsx` | Message bubble (user + assistant + action cards) |
| `src/components/ai-chat/chat-input.tsx` | Input bar with send button + message counter |
| `src/lib/api/ai-chat-prompt.ts` | System prompt builder + OpenAI tool definitions for chat |
| `src/app/api/ai-chat/route.ts` | Streaming chat API route |

### Modified files
| File | Change |
|------|--------|
| `src/store/project-store.ts` | Add `scenarios` array, `saveScenario`, `deleteScenario` actions |
| `src/components/main-tabs.tsx` | Add drop zone wrapper around input tab, chat FAB, scenario save button |
| `src/components/simulation/simulation-tab.tsx` | Add optimizer card to what-if sidebar |

---

## Task 1: HEC-RAS Geometry Parser

Build the parser that converts `.g0x` text files into the app's `CrossSectionPoint[]`, `BridgeGeometry`, and related types.

**Files:**
- Create: `src/lib/hecras-parser.ts`
- Create: `src/__tests__/lib/hecras-parser.test.ts`

- [ ] **Step 1: Write failing test for cross-section parsing**

```typescript
// src/__tests__/lib/hecras-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseHecRasGeometry } from '@/lib/hecras-parser';

const SAMPLE_GEOMETRY = `
Geom Title=Test Bridge

River Reach=TestRiver,Reach1

Type RM Length L Ch R = 1 ,500.*   ,0       ,500     ,500     ,500

BEGIN DESCRIPTION:
Test cross section
END DESCRIPTION:

#Sta/Elev= 11
     0   105    10   103    20   101    30   100    40    99    50  98.5
    60    99    70   100    80   101    90   103   100   105

#Mann= 3 , 0 , 0
     0   .05     0    30  .035     0    70   .05     0

Bank Sta=30,70

XS Rating Curve= 0 ,0
`;

describe('parseHecRasGeometry', () => {
  it('parses cross-section station/elevation pairs', () => {
    const result = parseHecRasGeometry(SAMPLE_GEOMETRY);
    expect(result.crossSections).toHaveLength(1);
    const xs = result.crossSections[0];
    expect(xs.points).toHaveLength(11);
    expect(xs.points[0]).toEqual({ station: 0, elevation: 105, manningsN: 0.05, bankStation: null });
    expect(xs.points[5]).toEqual({ station: 50, elevation: 98.5, manningsN: 0.035, bankStation: null });
    expect(xs.points[10]).toEqual({ station: 100, elevation: 105, manningsN: 0.05, bankStation: null });
  });

  it('assigns bank stations correctly', () => {
    const result = parseHecRasGeometry(SAMPLE_GEOMETRY);
    const xs = result.crossSections[0];
    const leftBank = xs.points.find(p => p.bankStation === 'left');
    const rightBank = xs.points.find(p => p.bankStation === 'right');
    expect(leftBank?.station).toBe(30);
    expect(rightBank?.station).toBe(70);
  });

  it('assigns mannings n from change points', () => {
    const result = parseHecRasGeometry(SAMPLE_GEOMETRY);
    const xs = result.crossSections[0];
    // Stations 0-29 should have n=0.05
    expect(xs.points[0].manningsN).toBe(0.05);
    expect(xs.points[2].manningsN).toBe(0.05); // station 20
    // Stations 30-69 should have n=0.035
    expect(xs.points[3].manningsN).toBe(0.035); // station 30
    expect(xs.points[5].manningsN).toBe(0.035); // station 50
    // Stations 70+ should have n=0.05
    expect(xs.points[7].manningsN).toBe(0.05); // station 70
  });

  it('captures river station ID', () => {
    const result = parseHecRasGeometry(SAMPLE_GEOMETRY);
    expect(result.crossSections[0].riverStation).toBe('500.*');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/__tests__/lib/hecras-parser.test.ts`
Expected: FAIL — module `@/lib/hecras-parser` not found

- [ ] **Step 3: Implement the cross-section parser**

```typescript
// src/lib/hecras-parser.ts
import type { CrossSectionPoint, BridgeGeometry, Pier, FlowProfile } from '@/engine/types';

export interface ParsedCrossSection {
  riverStation: string;
  points: CrossSectionPoint[];
}

export interface ParsedBridge {
  riverStation: string;
  geometry: Omit<BridgeGeometry, 'contractionLength' | 'expansionLength' | 'orificeCd' | 'weirCw'>;
}

export interface HecRasGeometryResult {
  crossSections: ParsedCrossSection[];
  bridges: ParsedBridge[];
  title: string;
}

export interface HecRasFlowResult {
  profiles: Array<{
    name: string;
    ari: string;
    discharge: number;
    dsWsel: number;
    channelSlope: number;
  }>;
}

/**
 * Parse a HEC-RAS geometry file (.g01-.g09) into structured data.
 *
 * The format uses fixed-width numeric fields (typically 8 chars each)
 * and keyword-prefixed lines. We parse the most common patterns:
 * - #Sta/Elev for cross-section geometry
 * - #Mann for Manning's n
 * - Bank Sta for bank station markers
 * - BEGIN BRIDGE / END BRIDGE blocks
 * - Deck/Roadway and Pier lines within bridge blocks
 */
export function parseHecRasGeometry(text: string): HecRasGeometryResult {
  const lines = text.split(/\r?\n/);
  const crossSections: ParsedCrossSection[] = [];
  const bridges: ParsedBridge[] = [];
  let title = '';

  let currentRiverStation = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Title
    if (line.startsWith('Geom Title=')) {
      title = line.slice('Geom Title='.length).trim();
      i++;
      continue;
    }

    // River station — appears before each XS or bridge
    if (line.startsWith('Type RM Length L Ch R')) {
      // Format: Type RM Length L Ch R = 1 ,500.*   ,0       ,500     ,500     ,500
      const parts = line.split(',');
      if (parts.length >= 2) {
        currentRiverStation = parts[1].trim().replace(/\s+/g, '');
      }
      i++;
      continue;
    }

    // Cross-section data
    if (line.startsWith('#Sta/Elev=')) {
      const count = parseInt(line.split('=')[1].trim(), 10);
      const { points, linesConsumed } = parseStaElev(lines, i + 1, count);
      i += 1 + linesConsumed;

      // Look ahead for Manning's n and bank stations
      let manningsChangePoints: Array<{ station: number; n: number }> = [];
      let bankLeft: number | null = null;
      let bankRight: number | null = null;

      // Scan ahead for #Mann and Bank Sta (they follow #Sta/Elev)
      let j = i;
      while (j < lines.length) {
        const ahead = lines[j];
        if (ahead.startsWith('#Mann=')) {
          const mannCount = parseInt(ahead.split('=')[1].split(',')[0].trim(), 10);
          const mannResult = parseMannings(lines, j + 1, mannCount);
          manningsChangePoints = mannResult.changePoints;
          j += 1 + mannResult.linesConsumed;
          continue;
        }
        if (ahead.startsWith('Bank Sta=')) {
          const bankParts = ahead.split('=')[1].split(',');
          bankLeft = parseFloat(bankParts[0].trim());
          bankRight = parseFloat(bankParts[1].trim());
          j++;
          continue;
        }
        // Stop scanning when we hit the next section
        if (ahead.startsWith('#Sta/Elev=') || ahead.startsWith('Type RM Length L Ch R') ||
            ahead.startsWith('BEGIN BRIDGE:') || ahead.startsWith('River Reach=')) {
          break;
        }
        j++;
      }

      // Assign Manning's n to each point using change points
      const xsPoints = assignManningsN(points, manningsChangePoints);

      // Assign bank stations
      if (bankLeft !== null) {
        const leftIdx = findClosestIdx(xsPoints, bankLeft);
        if (leftIdx >= 0) xsPoints[leftIdx].bankStation = 'left';
      }
      if (bankRight !== null) {
        const rightIdx = findClosestIdx(xsPoints, bankRight);
        if (rightIdx >= 0) xsPoints[rightIdx].bankStation = 'right';
      }

      crossSections.push({ riverStation: currentRiverStation, points: xsPoints });
      i = j;
      continue;
    }

    // Bridge block
    if (line.startsWith('BEGIN BRIDGE:')) {
      const { bridge, linesConsumed } = parseBridgeBlock(lines, i, currentRiverStation);
      if (bridge) bridges.push(bridge);
      i += linesConsumed;
      continue;
    }

    i++;
  }

  return { crossSections, bridges, title };
}

/**
 * Parse #Sta/Elev data lines.
 * Values are in pairs (station, elevation), typically 8 chars wide each,
 * with up to 5 pairs per line (10 values).
 */
function parseStaElev(
  lines: string[],
  startLine: number,
  count: number
): { points: Array<{ station: number; elevation: number }>; linesConsumed: number } {
  const points: Array<{ station: number; elevation: number }> = [];
  let linesConsumed = 0;

  for (let i = startLine; points.length < count && i < lines.length; i++) {
    const values = parseFixedWidthNumbers(lines[i]);
    for (let v = 0; v + 1 < values.length && points.length < count; v += 2) {
      points.push({ station: values[v], elevation: values[v + 1] });
    }
    linesConsumed++;
  }

  return { points, linesConsumed };
}

/**
 * Parse Manning's n change points.
 * Format: triplets of (station, n-value, 0) in fixed-width fields.
 */
function parseMannings(
  lines: string[],
  startLine: number,
  count: number
): { changePoints: Array<{ station: number; n: number }>; linesConsumed: number } {
  const changePoints: Array<{ station: number; n: number }> = [];
  let linesConsumed = 0;

  for (let i = startLine; changePoints.length < count && i < lines.length; i++) {
    const values = parseFixedWidthNumbers(lines[i]);
    for (let v = 0; v + 2 < values.length && changePoints.length < count; v += 3) {
      changePoints.push({ station: values[v], n: values[v + 1] });
    }
    linesConsumed++;
  }

  return { changePoints, linesConsumed };
}

/**
 * Parse numbers from a fixed-width line. HEC-RAS uses 8-character fields,
 * but we handle variable spacing by splitting on whitespace.
 */
function parseFixedWidthNumbers(line: string): number[] {
  return line.trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
}

/**
 * Assign Manning's n to cross-section points using change points.
 * Each change point applies from its station until the next change point.
 */
function assignManningsN(
  points: Array<{ station: number; elevation: number }>,
  changePoints: Array<{ station: number; n: number }>
): CrossSectionPoint[] {
  if (changePoints.length === 0) {
    return points.map(p => ({ ...p, manningsN: 0.035, bankStation: null }));
  }

  return points.map(p => {
    let n = changePoints[0].n;
    for (const cp of changePoints) {
      if (p.station >= cp.station) n = cp.n;
      else break;
    }
    return { station: p.station, elevation: p.elevation, manningsN: n, bankStation: null };
  });
}

/** Find the index of the point closest to a given station. */
function findClosestIdx(points: CrossSectionPoint[], station: number): number {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dist = Math.abs(points[i].station - station);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Parse a BEGIN BRIDGE ... END BRIDGE block.
 */
function parseBridgeBlock(
  lines: string[],
  startLine: number,
  riverStation: string
): { bridge: ParsedBridge | null; linesConsumed: number } {
  let i = startLine + 1; // skip BEGIN BRIDGE line
  let lowChordLeft = 0;
  let lowChordRight = 0;
  let highChord = 0;
  let deckWidth = 0;
  let leftAbutmentStation = 0;
  let rightAbutmentStation = 0;
  let skewAngle = 0;
  const piers: Pier[] = [];
  const lowChordProfile: Array<{ station: number; elevation: number }> = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('END BRIDGE:')) {
      i++;
      break;
    }

    // Deck/Roadway line format:
    // Deck/Roadway= N ,upstreamDist,highChordUS,highChordDS,width,sta1,elev1,sta2,elev2,...
    if (line.startsWith('Deck/Roadway=')) {
      const afterEq = line.split('=')[1];
      const values = afterEq.split(',').map(v => v.trim());
      // values[0] = number of roadway widths (usually 1)
      // values[1] = upstream distance (not used)
      // values[2] = high chord upstream
      // values[3] = high chord downstream
      // values[4] = deck width
      if (values.length >= 5) {
        highChord = Math.max(parseFloat(values[2]) || 0, parseFloat(values[3]) || 0);
        deckWidth = parseFloat(values[4]) || 0;
      }
      // Remaining values are station,elevation pairs for the low chord
      for (let v = 5; v + 1 < values.length; v += 2) {
        const sta = parseFloat(values[v]);
        const elev = parseFloat(values[v + 1]);
        if (!isNaN(sta) && !isNaN(elev)) {
          lowChordProfile.push({ station: sta, elevation: elev });
        }
      }
      if (lowChordProfile.length >= 2) {
        leftAbutmentStation = lowChordProfile[0].station;
        rightAbutmentStation = lowChordProfile[lowChordProfile.length - 1].station;
        lowChordLeft = lowChordProfile[0].elevation;
        lowChordRight = lowChordProfile[lowChordProfile.length - 1].elevation;
      }
    }

    // Pier data: "Pier #, X Sta, Width= N  ,sta  ,width"
    if (line.includes('Pier #') && line.includes('X Sta') && line.includes('Width=')) {
      const afterEq = line.split('=')[1];
      const vals = afterEq.split(',').map(v => v.trim());
      if (vals.length >= 3) {
        const station = parseFloat(vals[1]);
        const width = parseFloat(vals[2]);
        if (!isNaN(station) && !isNaN(width)) {
          piers.push({ station, width, shape: 'round-nose' });
        }
      }
    }

    // Pier skew
    if (line.startsWith('Pier Skew Angle=')) {
      // Could refine per-pier, but for now global skew is fine
    }

    // Bridge skew angle
    if (line.startsWith('BC Design') && line.includes('Skew')) {
      const match = line.match(/Skew\s*=\s*([0-9.]+)/);
      if (match) skewAngle = parseFloat(match[1]) || 0;
    }

    i++;
  }

  if (leftAbutmentStation === 0 && rightAbutmentStation === 0) {
    return { bridge: null, linesConsumed: i - startLine };
  }

  return {
    bridge: {
      riverStation,
      geometry: {
        lowChordLeft,
        lowChordRight,
        highChord,
        leftAbutmentStation,
        rightAbutmentStation,
        skewAngle,
        deckWidth,
        piers,
        lowChordProfile: lowChordProfile.map(p => ({ station: p.station, elevation: p.elevation })),
      },
    },
    linesConsumed: i - startLine,
  };
}

/**
 * Parse a HEC-RAS flow file (.f01-.f09).
 */
export function parseHecRasFlow(text: string): HecRasFlowResult {
  const lines = text.split(/\r?\n/);
  const profiles: HecRasFlowResult['profiles'] = [];

  let profileNames: string[] = [];
  let numProfiles = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('Number of Profiles=')) {
      numProfiles = parseInt(line.split('=')[1].trim(), 10);
      i++;
      continue;
    }

    if (line.startsWith('Profile Names=')) {
      profileNames = line.split('=')[1].split(',').map(n => n.trim());
      i++;
      continue;
    }

    // Flow data: "River Rch & RM=river,reach,station"
    // followed by lines of discharge values
    if (line.startsWith('River Rch & RM=')) {
      i++;
      // Read discharge values (one line per set of profiles)
      if (i < lines.length) {
        const discharges = parseFixedWidthNumbers(lines[i]);
        for (let p = 0; p < Math.min(discharges.length, numProfiles); p++) {
          if (!profiles[p]) {
            profiles[p] = {
              name: profileNames[p] || `Profile ${p + 1}`,
              ari: profileNames[p] || `Profile ${p + 1}`,
              discharge: discharges[p],
              dsWsel: 0,
              channelSlope: 0,
            };
          } else {
            // If multiple reaches, keep the first discharge encountered
          }
        }
        i++;
        continue;
      }
    }

    // Boundary conditions for downstream WSEL
    // "Boundary for River Rch & Prof#= river,reach, num"
    // followed by "Known WS=" or "Normal Depth=" or "Critical Depth="
    if (line.startsWith('Boundary for')) {
      i++;
      if (i < lines.length) {
        const bLine = lines[i];
        if (bLine.startsWith('Known WS=')) {
          const wsels = bLine.split('=')[1].split(',').map(v => parseFloat(v.trim()));
          for (let p = 0; p < wsels.length && p < profiles.length; p++) {
            if (!isNaN(wsels[p]) && wsels[p] > 0) {
              profiles[p].dsWsel = wsels[p];
            }
          }
        }
        if (bLine.startsWith('Normal Depth=')) {
          const slopes = bLine.split('=')[1].split(',').map(v => parseFloat(v.trim()));
          for (let p = 0; p < slopes.length && p < profiles.length; p++) {
            if (!isNaN(slopes[p]) && slopes[p] > 0) {
              profiles[p].channelSlope = slopes[p];
            }
          }
        }
      }
      i++;
      continue;
    }

    i++;
  }

  return { profiles };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/__tests__/lib/hecras-parser.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Add bridge parsing tests**

Append to `src/__tests__/lib/hecras-parser.test.ts`:

```typescript
const SAMPLE_WITH_BRIDGE = `
Geom Title=Bridge Test

River Reach=TestRiver,Reach1

Type RM Length L Ch R = 1 ,500.*   ,0       ,500     ,500     ,500

#Sta/Elev= 11
     0   105    10   103    20   101    30   100    40    99    50  98.5
    60    99    70   100    80   101    90   103   100   105

#Mann= 3 , 0 , 0
     0   .05     0    30  .035     0    70   .05     0

Bank Sta=30,70

Type RM Length L Ch R = 1 ,500.*   ,0       ,0       ,0       ,0

BEGIN BRIDGE:

Deck/Roadway= 1 ,0,103,103,10,30,101,70,101

Pier #, X Sta, Width= 1  ,50  ,3

END BRIDGE:
`;

describe('parseHecRasGeometry — bridge block', () => {
  it('parses bridge deck geometry', () => {
    const result = parseHecRasGeometry(SAMPLE_WITH_BRIDGE);
    expect(result.bridges).toHaveLength(1);
    const br = result.bridges[0].geometry;
    expect(br.leftAbutmentStation).toBe(30);
    expect(br.rightAbutmentStation).toBe(70);
    expect(br.highChord).toBe(103);
    expect(br.lowChordLeft).toBe(101);
    expect(br.lowChordRight).toBe(101);
    expect(br.deckWidth).toBe(10);
  });

  it('parses pier data', () => {
    const result = parseHecRasGeometry(SAMPLE_WITH_BRIDGE);
    const br = result.bridges[0].geometry;
    expect(br.piers).toHaveLength(1);
    expect(br.piers[0]).toEqual({ station: 50, width: 3, shape: 'round-nose' });
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd app && npx vitest run src/__tests__/lib/hecras-parser.test.ts`
Expected: PASS — 6 tests pass

- [ ] **Step 7: Add flow file parsing test**

Append to the test file:

```typescript
import { parseHecRasFlow } from '@/lib/hecras-parser';

const SAMPLE_FLOW = `
Flow Title=Test Flows

Number of Profiles= 3
Profile Names=Q10,Q50,Q100

River Rch & RM=TestRiver,Reach1,500
   100      500     1000

Boundary for River Rch & Prof#=TestRiver,Reach1, 1
Known WS=99.5,100.2,101.0
`;

describe('parseHecRasFlow', () => {
  it('parses profile names and discharges', () => {
    const result = parseHecRasFlow(SAMPLE_FLOW);
    expect(result.profiles).toHaveLength(3);
    expect(result.profiles[0].name).toBe('Q10');
    expect(result.profiles[0].discharge).toBe(100);
    expect(result.profiles[1].discharge).toBe(500);
    expect(result.profiles[2].discharge).toBe(1000);
  });

  it('parses downstream WSEL from Known WS boundary', () => {
    const result = parseHecRasFlow(SAMPLE_FLOW);
    expect(result.profiles[0].dsWsel).toBe(99.5);
    expect(result.profiles[1].dsWsel).toBe(100.2);
    expect(result.profiles[2].dsWsel).toBe(101);
  });
});
```

- [ ] **Step 8: Run tests**

Run: `cd app && npx vitest run src/__tests__/lib/hecras-parser.test.ts`
Expected: PASS — 8 tests pass

- [ ] **Step 9: Commit**

```bash
git add src/lib/hecras-parser.ts src/__tests__/lib/hecras-parser.test.ts
git commit -m "feat: add HEC-RAS geometry and flow file parser"
```

---

## Task 2: HEC-RAS Import UI

Build the drop zone, import dialog, and wire it into the main tabs.

**Files:**
- Create: `src/components/import/drop-zone.tsx`
- Create: `src/components/import/hecras-import-dialog.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Create the drop zone component**

```typescript
// src/components/import/drop-zone.tsx
'use client';

import { useState, useCallback, type ReactNode, type DragEvent } from 'react';
import { Upload } from 'lucide-react';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string[];
  children: ReactNode;
}

export function DropZone({ onFiles, accept, children }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const filtered = accept
      ? files.filter(f => accept.some(ext => f.name.toLowerCase().endsWith(ext)))
      : files;

    if (filtered.length > 0) onFiles(filtered);
  }, [onFiles, accept]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8" />
            <span className="text-sm font-medium">Drop HEC-RAS file here</span>
            <span className="text-xs text-primary/70">.g01-.g09, .f01-.f09</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the import dialog**

```typescript
// src/components/import/hecras-import-dialog.tsx
'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseHecRasGeometry, parseHecRasFlow, type ParsedCrossSection, type ParsedBridge, type HecRasFlowResult } from '@/lib/hecras-parser';
import { useProjectStore } from '@/store/project-store';
import { FileInput, Check, AlertTriangle } from 'lucide-react';

interface HecRasImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
}

interface ParseResult {
  crossSections: ParsedCrossSection[];
  bridges: ParsedBridge[];
  flow: HecRasFlowResult | null;
  title: string;
  errors: string[];
}

export function HecRasImportDialog({ open, onOpenChange, files }: HecRasImportDialogProps) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedXsIdx, setSelectedXsIdx] = useState(0);
  const [selectedBridgeIdx, setSelectedBridgeIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const updateBridgeGeometry = useProjectStore((s) => s.updateBridgeGeometry);
  const updateFlowProfiles = useProjectStore((s) => s.updateFlowProfiles);
  const clearResults = useProjectStore((s) => s.clearResults);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const hasExistingData = useProjectStore((s) => s.crossSection.length > 0);

  // Parse files when dialog opens
  useMemo(() => {
    if (!open || files.length === 0) return;
    setLoading(true);

    const errors: string[] = [];
    let crossSections: ParsedCrossSection[] = [];
    let bridges: ParsedBridge[] = [];
    let flow: HecRasFlowResult | null = null;
    let title = '';

    const readPromises = files.map(file => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const ext = file.name.toLowerCase();

          if (/\.g\d{2}$/.test(ext)) {
            try {
              const result = parseHecRasGeometry(text);
              crossSections = result.crossSections;
              bridges = result.bridges;
              title = result.title;
            } catch (e) {
              errors.push(`Failed to parse ${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
          } else if (/\.f\d{2}$/.test(ext)) {
            try {
              flow = parseHecRasFlow(text);
            } catch (e) {
              errors.push(`Failed to parse ${file.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
          }
          resolve();
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readPromises).then(() => {
      setParseResult({ crossSections, bridges, flow, title, errors });
      setSelectedXsIdx(0);
      setSelectedBridgeIdx(0);
      setLoading(false);
    });
  }, [open, files]);

  function handleImport() {
    if (!parseResult) return;

    const xs = parseResult.crossSections[selectedXsIdx];
    const bridge = parseResult.bridges[selectedBridgeIdx];

    if (xs) {
      updateCrossSection(xs.points);
    }

    if (bridge) {
      updateBridgeGeometry({
        ...bridge.geometry,
        contractionLength: 0,
        expansionLength: 0,
        orificeCd: 0.8,
        weirCw: 1.4,
      });
    }

    if (parseResult.flow && parseResult.flow.profiles.length > 0) {
      updateFlowProfiles(parseResult.flow.profiles);
    }

    if (parseResult.title) {
      setProjectName(parseResult.title);
    }

    clearResults();
    onOpenChange(false);
  }

  const xs = parseResult?.crossSections[selectedXsIdx];
  const bridge = parseResult?.bridges[selectedBridgeIdx];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <FileInput className="h-4 w-4 text-primary" />
          Import HEC-RAS
        </DialogTitle>
        <DialogDescription>
          {loading ? 'Parsing files...' : 'Review the imported data before applying.'}
        </DialogDescription>

        {parseResult && !loading && (
          <div className="space-y-4">
            {/* Errors */}
            {parseResult.errors.length > 0 && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3">
                {parseResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-400">{err}</p>
                ))}
              </div>
            )}

            {/* Cross-section selector */}
            {parseResult.crossSections.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Cross-Section</label>
                {parseResult.crossSections.length === 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Station {xs?.riverStation} — {xs?.points.length} points
                  </p>
                ) : (
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                    value={selectedXsIdx}
                    onChange={(e) => setSelectedXsIdx(Number(e.target.value))}
                  >
                    {parseResult.crossSections.map((cs, i) => (
                      <option key={i} value={i}>
                        Station {cs.riverStation} — {cs.points.length} points
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Bridge selector */}
            {parseResult.bridges.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Bridge</label>
                {parseResult.bridges.length === 1 ? (
                  <p className="text-xs text-muted-foreground">
                    Station {bridge?.riverStation} — {bridge?.geometry.piers.length} pier(s)
                  </p>
                ) : (
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
                    value={selectedBridgeIdx}
                    onChange={(e) => setSelectedBridgeIdx(Number(e.target.value))}
                  >
                    {parseResult.bridges.map((br, i) => (
                      <option key={i} value={i}>
                        Station {br.riverStation} — {br.geometry.piers.length} pier(s)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Flow profiles */}
            {parseResult.flow && parseResult.flow.profiles.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Flow Profiles</label>
                <p className="text-xs text-muted-foreground">
                  {parseResult.flow.profiles.length} profile(s): {parseResult.flow.profiles.map(p => p.name).join(', ')}
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-md bg-muted/30 border border-border/50 p-3 space-y-1">
              <p className="text-xs font-medium">Import Summary</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                {xs && <p><Check className="h-3 w-3 inline text-emerald-400 mr-1" />{xs.points.length} cross-section points</p>}
                {bridge && <p><Check className="h-3 w-3 inline text-emerald-400 mr-1" />Bridge with {bridge.geometry.piers.length} pier(s)</p>}
                {parseResult.flow && parseResult.flow.profiles.length > 0 && (
                  <p><Check className="h-3 w-3 inline text-emerald-400 mr-1" />{parseResult.flow.profiles.length} flow profile(s)</p>
                )}
                {!xs && <p><AlertTriangle className="h-3 w-3 inline text-amber-400 mr-1" />No cross-section found</p>}
              </div>
            </div>

            {/* Warning if replacing existing data */}
            {hasExistingData && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <p className="text-xs text-amber-400">This will replace your current project data.</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleImport} disabled={!xs && !bridge}>
                Import
              </Button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire drop zone and import dialog into main-tabs**

In `src/components/main-tabs.tsx`, add the following:

1. Add imports at the top:
```typescript
import { DropZone } from '@/components/import/drop-zone';
import { HecRasImportDialog } from '@/components/import/hecras-import-dialog';
```

2. Add state inside `MainTabs()`:
```typescript
const [hecRasFiles, setHecRasFiles] = useState<File[]>([]);
const [hecRasDialogOpen, setHecRasDialogOpen] = useState(false);
```

3. Add handler:
```typescript
function handleHecRasFiles(files: File[]) {
  setHecRasFiles(files);
  setHecRasDialogOpen(true);
}
```

4. Wrap the `<TabsContent value="input">` content with `<DropZone>`:
```tsx
<TabsContent value="input" className="flex-1 px-4 sm:px-6 py-4 sm:py-5">
  <DropZone onFiles={handleHecRasFiles} accept={['.g01','.g02','.g03','.g04','.g05','.g06','.g07','.g08','.g09','.f01','.f02','.f03','.f04','.f05','.f06','.f07','.f08','.f09']}>
    {/* existing Tabs content unchanged */}
  </DropZone>
  <ActionButtons />
</TabsContent>
```

5. Add the dialog before `</Tabs>`:
```tsx
<HecRasImportDialog
  open={hecRasDialogOpen}
  onOpenChange={setHecRasDialogOpen}
  files={hecRasFiles}
/>
```

- [ ] **Step 4: Test manually — drag a .g01 file onto the Input tab**

Run: `cd app && npm run dev`
- Verify the blue drop overlay appears when dragging
- Verify the import dialog opens with parsed data
- Verify clicking Import populates the forms

- [ ] **Step 5: Commit**

```bash
git add src/components/import/drop-zone.tsx src/components/import/hecras-import-dialog.tsx src/components/main-tabs.tsx
git commit -m "feat: add HEC-RAS drag-and-drop import with preview dialog"
```

---

## Task 3: Auto-Design Optimizer Engine

Build the parameter sweep and binary search logic that finds optimal parameter values.

**Files:**
- Create: `src/engine/optimizer.ts`
- Create: `src/__tests__/engine/optimizer.test.ts`

- [ ] **Step 1: Write failing test for parameter sweep**

```typescript
// src/__tests__/engine/optimizer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runOptimization, type OptimizationConfig, type OptimizationResult } from '@/engine/optimizer';
import type { CrossSectionPoint, BridgeGeometry, FlowProfile, Coefficients, CalculationResults } from '@/engine/types';

// Minimal fixtures
const XS: CrossSectionPoint[] = [
  { station: 0, elevation: 105, manningsN: 0.05, bankStation: null },
  { station: 30, elevation: 100, manningsN: 0.05, bankStation: 'left' },
  { station: 50, elevation: 98.5, manningsN: 0.035, bankStation: null },
  { station: 70, elevation: 100, manningsN: 0.05, bankStation: 'right' },
  { station: 100, elevation: 105, manningsN: 0.05, bankStation: null },
];

const BRIDGE: BridgeGeometry = {
  lowChordLeft: 103, lowChordRight: 103, highChord: 105,
  leftAbutmentStation: 30, rightAbutmentStation: 70,
  skewAngle: 0, contractionLength: 50, expansionLength: 50,
  orificeCd: 0.8, weirCw: 1.4, deckWidth: 10,
  piers: [], lowChordProfile: [],
};

const PROFILE: FlowProfile = {
  name: 'Q100', ari: 'Q100', discharge: 500, dsWsel: 101, channelSlope: 0.001,
};

const COEFFS: Coefficients = {
  contractionCoeff: 0.3, expansionCoeff: 0.5, yarnellK: null,
  maxIterations: 100, tolerance: 0.01, initialGuessOffset: 0.5,
  debrisBlockagePct: 0, manningsNSensitivityPct: null, alphaOverride: null,
  freeboardThreshold: 0.3,
  methodsToRun: { energy: true, momentum: false, yarnell: false, wspro: false },
};

describe('runOptimization', () => {
  it('returns sweep points and an optimal value', () => {
    const config: OptimizationConfig = {
      parameter: 'openingWidth',
      target: 'freeboard',
      threshold: 0.3,
      method: 'energy',
      profileIdx: 0,
    };

    const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, config);

    expect(result.sweepPoints.length).toBeGreaterThanOrEqual(10);
    expect(result.sweepPoints[0]).toHaveProperty('paramValue');
    expect(result.sweepPoints[0]).toHaveProperty('metricValue');
    // Should find some optimal value (may or may not meet threshold depending on geometry)
    expect(typeof result.optimalValue).toBe('number');
  });

  it('reports whether threshold was achieved', () => {
    const config: OptimizationConfig = {
      parameter: 'openingWidth',
      target: 'freeboard',
      threshold: 0.3,
      method: 'energy',
      profileIdx: 0,
    };

    const result = runOptimization(XS, BRIDGE, [PROFILE], COEFFS, config);
    expect(typeof result.thresholdMet).toBe('boolean');
    expect(typeof result.summary).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/__tests__/engine/optimizer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the optimizer**

```typescript
// src/engine/optimizer.ts
import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  MethodResult,
} from './types';
import { runAllMethods } from './index';

export type SweepParameter = 'openingWidth' | 'lowChord' | 'manningsNMultiplier' | 'dischargeMultiplier' | 'debrisBlockagePct';
export type TargetMetric = 'freeboard' | 'afflux' | 'bridgeVelocity';
export type MethodKey = 'energy' | 'momentum' | 'yarnell' | 'wspro';

export interface OptimizationConfig {
  parameter: SweepParameter;
  target: TargetMetric;
  threshold: number;
  method: MethodKey;
  profileIdx: number;
}

export interface SweepPoint {
  paramValue: number;
  metricValue: number;
}

export interface OptimizationResult {
  sweepPoints: SweepPoint[];
  optimalValue: number | null;
  optimalMetric: number | null;
  thresholdMet: boolean;
  summary: string;
  parameterLabel: string;
  metricLabel: string;
}

const PARAM_RANGES: Record<SweepParameter, { getRange: (xs: CrossSectionPoint[], bridge: BridgeGeometry) => [number, number]; label: string }> = {
  openingWidth: {
    getRange: (xs, bridge) => {
      const totalSpan = xs[xs.length - 1].station - xs[0].station;
      const currentWidth = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
      return [Math.max(currentWidth * 0.3, 5), Math.min(totalSpan * 0.95, currentWidth * 3)];
    },
    label: 'Opening Width',
  },
  lowChord: {
    getRange: (xs, bridge) => {
      const minElev = Math.min(...xs.map(p => p.elevation));
      return [minElev + 1, bridge.highChord];
    },
    label: 'Low Chord Elevation',
  },
  manningsNMultiplier: {
    getRange: () => [0.5, 1.5],
    label: "Manning's n Multiplier",
  },
  dischargeMultiplier: {
    getRange: () => [0.5, 2.0],
    label: 'Discharge Multiplier',
  },
  debrisBlockagePct: {
    getRange: () => [0, 50],
    label: 'Debris Blockage %',
  },
};

function applyParameter(
  xs: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients,
  param: SweepParameter,
  value: number
): { xs: CrossSectionPoint[]; bridge: BridgeGeometry; profiles: FlowProfile[]; coefficients: Coefficients } {
  switch (param) {
    case 'openingWidth': {
      const center = (bridge.leftAbutmentStation + bridge.rightAbutmentStation) / 2;
      return {
        xs, profiles, coefficients,
        bridge: {
          ...bridge,
          leftAbutmentStation: center - value / 2,
          rightAbutmentStation: center + value / 2,
        },
      };
    }
    case 'lowChord':
      return {
        xs, profiles, coefficients,
        bridge: { ...bridge, lowChordLeft: value, lowChordRight: value },
      };
    case 'manningsNMultiplier':
      return {
        bridge, profiles, coefficients,
        xs: xs.map(p => ({ ...p, manningsN: p.manningsN * value })),
      };
    case 'dischargeMultiplier':
      return {
        xs, bridge, coefficients,
        profiles: profiles.map(p => ({ ...p, discharge: p.discharge * value })),
      };
    case 'debrisBlockagePct':
      return {
        xs, bridge, profiles,
        coefficients: { ...coefficients, debrisBlockagePct: value },
      };
  }
}

function extractMetric(
  result: MethodResult,
  bridge: BridgeGeometry,
  target: TargetMetric
): number {
  switch (target) {
    case 'freeboard':
      return Math.min(bridge.lowChordLeft, bridge.lowChordRight) - result.upstreamWsel;
    case 'afflux':
      return result.totalHeadLoss;
    case 'bridgeVelocity':
      return result.bridgeVelocity;
  }
}

/**
 * Run a parameter sweep followed by binary search to find the optimal
 * parameter value that meets the target threshold.
 */
export function runOptimization(
  xs: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profiles: FlowProfile[],
  coefficients: Coefficients,
  config: OptimizationConfig
): OptimizationResult {
  const { parameter, target, threshold, method, profileIdx } = config;
  const paramDef = PARAM_RANGES[parameter];
  const [lo, hi] = paramDef.getRange(xs, bridge);

  // Phase 1: Coarse sweep (10 steps)
  const sweepPoints: SweepPoint[] = [];
  const SWEEP_STEPS = 10;

  for (let i = 0; i <= SWEEP_STEPS; i++) {
    const paramValue = lo + (hi - lo) * (i / SWEEP_STEPS);
    const modified = applyParameter(xs, bridge, profiles, coefficients, parameter, paramValue);
    const results = runAllMethods(modified.xs, modified.bridge, modified.profiles, modified.coefficients);
    const methodResults = results[method];

    if (methodResults && methodResults[profileIdx] && !methodResults[profileIdx].error) {
      const metricValue = extractMetric(methodResults[profileIdx], modified.bridge, target);
      sweepPoints.push({ paramValue, metricValue });
    }
  }

  if (sweepPoints.length < 2) {
    return {
      sweepPoints,
      optimalValue: null,
      optimalMetric: null,
      thresholdMet: false,
      summary: 'Insufficient valid results for optimization.',
      parameterLabel: paramDef.label,
      metricLabel: target,
    };
  }

  // Phase 2: Binary search for threshold crossing
  // For freeboard: we want metric >= threshold (higher is better)
  // For afflux/velocity: we want metric <= threshold (lower is better)
  const higherIsBetter = target === 'freeboard';

  // Find bracketing indices
  let bracketLo = 0;
  let bracketHi = sweepPoints.length - 1;
  for (let i = 0; i < sweepPoints.length - 1; i++) {
    const meetsA = higherIsBetter ? sweepPoints[i].metricValue >= threshold : sweepPoints[i].metricValue <= threshold;
    const meetsB = higherIsBetter ? sweepPoints[i + 1].metricValue >= threshold : sweepPoints[i + 1].metricValue <= threshold;
    if (meetsA !== meetsB) {
      bracketLo = i;
      bracketHi = i + 1;
      break;
    }
  }

  // Binary search within bracket
  let searchLo = sweepPoints[bracketLo].paramValue;
  let searchHi = sweepPoints[bracketHi].paramValue;
  let bestValue = sweepPoints[bracketLo].paramValue;
  let bestMetric = sweepPoints[bracketLo].metricValue;

  for (let iter = 0; iter < 15; iter++) {
    const mid = (searchLo + searchHi) / 2;
    const modified = applyParameter(xs, bridge, profiles, coefficients, parameter, mid);
    const results = runAllMethods(modified.xs, modified.bridge, modified.profiles, modified.coefficients);
    const methodResults = results[method];

    if (!methodResults?.[profileIdx] || methodResults[profileIdx].error) break;

    const metricValue = extractMetric(methodResults[profileIdx], modified.bridge, target);
    sweepPoints.push({ paramValue: mid, metricValue });

    const meets = higherIsBetter ? metricValue >= threshold : metricValue <= threshold;
    if (meets) {
      bestValue = mid;
      bestMetric = metricValue;
      // Tighten toward the boundary (find minimum param that meets threshold)
      if (higherIsBetter) searchHi = mid;
      else searchLo = mid;
    } else {
      if (higherIsBetter) searchLo = mid;
      else searchHi = mid;
    }

    if (Math.abs(searchHi - searchLo) < (hi - lo) * 0.001) break;
  }

  // Sort sweep points by param value for charting
  sweepPoints.sort((a, b) => a.paramValue - b.paramValue);

  const thresholdMet = higherIsBetter ? bestMetric >= threshold : bestMetric <= threshold;
  const summary = thresholdMet
    ? `${paramDef.label} of ${bestValue.toFixed(2)} achieves ${target} of ${bestMetric.toFixed(3)}`
    : `Could not achieve ${target} threshold of ${threshold} within parameter range.`;

  return {
    sweepPoints,
    optimalValue: thresholdMet ? bestValue : null,
    optimalMetric: thresholdMet ? bestMetric : null,
    thresholdMet,
    summary,
    parameterLabel: paramDef.label,
    metricLabel: target,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd app && npx vitest run src/__tests__/engine/optimizer.test.ts`
Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/engine/optimizer.ts src/__tests__/engine/optimizer.test.ts
git commit -m "feat: add parameter sweep optimizer engine"
```

---

## Task 4: Optimizer Card UI

Build the UI card for the optimizer in the simulation tab sidebar.

**Files:**
- Create: `src/components/simulation/optimizer-card.tsx`
- Modify: `src/components/simulation/simulation-tab.tsx`

- [ ] **Step 1: Create the optimizer card component**

```typescript
// src/components/simulation/optimizer-card.tsx
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import { runOptimization, type SweepParameter, type TargetMetric, type MethodKey, type OptimizationResult } from '@/engine/optimizer';
import { toDisplay, unitLabel } from '@/lib/units';
import { Target, Play, Check, AlertTriangle } from 'lucide-react';
import { scaleLinear } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';

const PARAMETERS: Array<{ value: SweepParameter; label: string }> = [
  { value: 'openingWidth', label: 'Opening Width' },
  { value: 'lowChord', label: 'Low Chord Elev' },
  { value: 'manningsNMultiplier', label: "Manning's n ×" },
  { value: 'dischargeMultiplier', label: 'Discharge ×' },
  { value: 'debrisBlockagePct', label: 'Debris %' },
];

const TARGETS: Array<{ value: TargetMetric; label: string }> = [
  { value: 'freeboard', label: 'Min Freeboard' },
  { value: 'afflux', label: 'Max Afflux' },
  { value: 'bridgeVelocity', label: 'Max Bridge Velocity' },
];

interface OptimizerCardProps {
  selectedMethod: string;
  selectedProfileIdx: number;
  onApplyOpeningWidth?: (width: number) => void;
}

export function OptimizerCard({ selectedMethod, selectedProfileIdx, onApplyOpeningWidth }: OptimizerCardProps) {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const us = useProjectStore((s) => s.unitSystem);
  const chartRef = useRef<HTMLDivElement>(null);

  const [parameter, setParameter] = useState<SweepParameter>('openingWidth');
  const [target, setTarget] = useState<TargetMetric>('freeboard');
  const [threshold, setThreshold] = useState('0.3');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleRun() {
    if (crossSection.length < 2 || flowProfiles.length === 0 || !results) return;
    setRunning(true);

    // Defer to avoid blocking UI
    setTimeout(() => {
      const optResult = runOptimization(crossSection, bridgeGeometry, flowProfiles, coefficients, {
        parameter,
        target,
        threshold: parseFloat(threshold) || 0,
        method: selectedMethod as MethodKey,
        profileIdx: selectedProfileIdx,
      });
      setResult(optResult);
      setRunning(false);
    }, 16);
  }

  // Draw chart when result changes
  const drawChart = useCallback(() => {
    const container = chartRef.current;
    if (!container || !result || result.sweepPoints.length < 2) return;

    select(container).selectAll('*').remove();

    const margin = { top: 8, right: 8, bottom: 28, left: 40 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 120 - margin.top - margin.bottom;

    const svg = select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const pts = result.sweepPoints;
    const x = scaleLinear()
      .domain([Math.min(...pts.map(p => p.paramValue)), Math.max(...pts.map(p => p.paramValue))])
      .range([0, width]);
    const y = scaleLinear()
      .domain([Math.min(...pts.map(p => p.metricValue)), Math.max(...pts.map(p => p.metricValue))])
      .nice()
      .range([height, 0]);

    // Axes
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(4).tickFormat(d => String(Number(d).toFixed(1))))
      .selectAll('text').attr('fill', '#888').attr('font-size', 8);
    svg.append('g')
      .call(axisLeft(y).ticks(4).tickFormat(d => String(Number(d).toFixed(2))))
      .selectAll('text').attr('fill', '#888').attr('font-size', 8);

    // Threshold line
    const threshVal = parseFloat(threshold);
    if (!isNaN(threshVal) && threshVal >= y.domain()[0]! && threshVal <= y.domain()[1]!) {
      svg.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', y(threshVal)).attr('y2', y(threshVal))
        .attr('stroke', '#f59e0b').attr('stroke-dasharray', '4,3').attr('stroke-width', 1);
    }

    // Line
    const pathGen = d3line<typeof pts[0]>()
      .x(d => x(d.paramValue))
      .y(d => y(d.metricValue));

    svg.append('path')
      .datum(pts)
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5);

    // Optimal point
    if (result.optimalValue !== null && result.optimalMetric !== null) {
      svg.append('circle')
        .attr('cx', x(result.optimalValue))
        .attr('cy', y(result.optimalMetric))
        .attr('r', 4)
        .attr('fill', '#10b981')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);
    }
  }, [result, threshold]);

  useEffect(() => {
    drawChart();
    const container = chartRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => drawChart());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawChart]);

  if (!results) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">Optimize</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Vary</label>
            <Select value={parameter} onValueChange={(v) => { setParameter(v as SweepParameter); setResult(null); }}>
              <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARAMETERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Target</label>
            <Select value={target} onValueChange={(v) => { setTarget(v as TargetMetric); setResult(null); }}>
              <SelectTrigger size="sm" className="w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Threshold ({unitLabel('length', us)})
            </label>
            <input
              type="number"
              step="0.1"
              value={threshold}
              onChange={(e) => { setThreshold(e.target.value); setResult(null); }}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-mono"
            />
          </div>
        </div>

        <Button size="sm" className="w-full text-xs h-7" onClick={handleRun} disabled={running}>
          {running ? (
            <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" />
          ) : (
            <Play className="h-3 w-3 mr-1.5" />
          )}
          {running ? 'Running...' : 'Find Optimal'}
        </Button>

        {/* Chart */}
        {result && result.sweepPoints.length >= 2 && (
          <div ref={chartRef} className="w-full h-[120px]" />
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-md px-2.5 py-2 text-[11px] ${
            result.thresholdMet
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
          }`}>
            {result.thresholdMet ? (
              <Check className="h-3 w-3 inline mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 inline mr-1" />
            )}
            {result.summary}
          </div>
        )}

        {result?.thresholdMet && result.optimalValue !== null && parameter === 'openingWidth' && onApplyOpeningWidth && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7"
            onClick={() => onApplyOpeningWidth(result.optimalValue!)}
          >
            Apply {result.optimalValue.toFixed(1)} {unitLabel('length', us)}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add optimizer card to simulation tab**

In `src/components/simulation/simulation-tab.tsx`:

1. Add import:
```typescript
import { OptimizerCard } from './optimizer-card';
```

2. After the What-If `<Card>` closing tag (around line 275), before the closing `</div>` of the flex container, add:
```tsx
<OptimizerCard
  selectedMethod={selectedMethod}
  selectedProfileIdx={selectedProfileIdx}
/>
```

- [ ] **Step 3: Test manually — run optimizer from Simulation tab**

Run: `cd app && npm run dev`
- Load a test bridge, run calculations, go to Simulation tab
- Select "Opening Width" and "Min Freeboard" with threshold 0.3
- Click "Find Optimal" — verify chart appears and result summary shows

- [ ] **Step 4: Commit**

```bash
git add src/components/simulation/optimizer-card.tsx src/components/simulation/simulation-tab.tsx
git commit -m "feat: add auto-design optimizer with parameter sweep UI"
```

---

## Task 5: Scenario Snapshot System

Add snapshot storage to the Zustand store for saving and comparing scenarios.

**Files:**
- Modify: `src/store/project-store.ts`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Add scenario types and actions to the store**

In `src/store/project-store.ts`:

1. Add the scenario interface after the existing imports:
```typescript
export interface Scenario {
  name: string;
  snapshot: {
    crossSection: CrossSectionPoint[];
    bridgeGeometry: BridgeGeometry;
    flowProfiles: FlowProfile[];
    coefficients: Coefficients;
    results: CalculationResults;
    hecRasComparison: HecRasComparison[];
  };
  savedAt: number;
}
```

2. Add to `ProjectStore` interface:
```typescript
scenarios: Scenario[];
saveScenario: (name: string) => void;
deleteScenario: (index: number) => void;
```

3. Add to `initialState`:
```typescript
scenarios: [] as Scenario[],
```

4. Add implementations in the store creator:
```typescript
saveScenario: (name) => {
  const state = get();
  if (!state.results) return;
  const scenario: Scenario = {
    name,
    snapshot: {
      crossSection: structuredClone(state.crossSection),
      bridgeGeometry: structuredClone(state.bridgeGeometry),
      flowProfiles: structuredClone(state.flowProfiles),
      coefficients: structuredClone(state.coefficients),
      results: structuredClone(state.results),
      hecRasComparison: structuredClone(state.hecRasComparison),
    },
    savedAt: Date.now(),
  };
  set((prev) => ({
    scenarios: [...prev.scenarios.slice(-4), scenario], // max 5
  }));
},

deleteScenario: (index) => {
  set((prev) => ({
    scenarios: prev.scenarios.filter((_, i) => i !== index),
  }));
},
```

- [ ] **Step 2: Add "Save Scenario" button to the header in main-tabs**

In `src/components/main-tabs.tsx`:

1. Add import:
```typescript
import { Save } from 'lucide-react';
```

2. Add state + store access:
```typescript
const saveScenario = useProjectStore((s) => s.saveScenario);
const results = useProjectStore((s) => s.results);
const scenarios = useProjectStore((s) => s.scenarios);
```

3. Add save handler:
```typescript
function handleSaveScenario() {
  const name = prompt('Scenario name:', `Scenario ${scenarios.length + 1}`);
  if (name) saveScenario(name);
}
```

4. Add save button next to the PDF button in the header (inside the icon action buttons div):
```tsx
{results && (
  <Button variant="outline" size="icon" onClick={handleSaveScenario}
    className="h-8 w-8" title={`Save Scenario (${scenarios.length}/5)`}>
    <Save className="h-4 w-4" />
  </Button>
)}
```

- [ ] **Step 3: Test manually**

Run: `cd app && npm run dev`
- Load a test bridge, run calculations
- Click Save button, enter a name — verify it saves (check via React DevTools or console)
- Save multiple scenarios

- [ ] **Step 4: Commit**

```bash
git add src/store/project-store.ts src/components/main-tabs.tsx
git commit -m "feat: add scenario snapshot system to store"
```

---

## Task 6: Scenario Comparison View

Build the side-by-side comparison UI in the Summary tab.

**Files:**
- Create: `src/components/summary/scenario-comparison.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Create the comparison component**

```typescript
// src/components/summary/scenario-comparison.tsx
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useProjectStore, type Scenario } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { GitCompare, Trash2 } from 'lucide-react';
import type { CalculationResults, MethodResult } from '@/engine/types';

const METHOD_KEYS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

function methodLabel(m: string) {
  return m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1);
}

function DeltaCell({ a, b, unit }: { a: number; b: number; unit: string }) {
  const diff = b - a;
  if (Math.abs(diff) < 0.0001) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`font-mono ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(3)} {unit}
    </span>
  );
}

export function ScenarioComparison() {
  const scenarios = useProjectStore((s) => s.scenarios);
  const deleteScenario = useProjectStore((s) => s.deleteScenario);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);

  if (scenarios.length < 2) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-sm text-muted-foreground">
            <GitCompare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Save at least 2 scenarios to compare them.</p>
            <p className="text-xs mt-1">Use the save button in the header bar.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scenA = scenarios[Math.min(idxA, scenarios.length - 1)];
  const scenB = scenarios[Math.min(idxB, scenarios.length - 1)];

  // Collect comparison rows for each method and profile
  const rows: Array<{
    method: string;
    profile: string;
    a: MethodResult;
    b: MethodResult;
  }> = [];

  for (const m of METHOD_KEYS) {
    const aResults = scenA.snapshot.results[m];
    const bResults = scenB.snapshot.results[m];
    const count = Math.min(aResults.length, bResults.length);
    for (let p = 0; p < count; p++) {
      if (!aResults[p].error && !bResults[p].error) {
        rows.push({ method: m, profile: aResults[p].profileName, a: aResults[p], b: bResults[p] });
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Scenario A</label>
          <Select value={String(idxA)} onValueChange={(v) => setIdxA(Number(v))}>
            <SelectTrigger size="sm" className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {scenarios.map((s, i) => (
                <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <GitCompare className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Scenario B</label>
          <Select value={String(idxB)} onValueChange={(v) => setIdxB(Number(v))}>
            <SelectTrigger size="sm" className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {scenarios.map((s, i) => (
                <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Method</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Profile</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">US WSEL (A)</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">US WSEL (B)</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Delta</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Afflux (A)</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Afflux (B)</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-medium">{methodLabel(row.method)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.profile}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{toDisplay(row.a.upstreamWsel, 'length', us).toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{toDisplay(row.b.upstreamWsel, 'length', us).toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right"><DeltaCell a={row.a.upstreamWsel} b={row.b.upstreamWsel} unit={len} /></td>
                    <td className="px-3 py-1.5 text-right font-mono">{toDisplay(row.a.totalHeadLoss, 'length', us).toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{toDisplay(row.b.totalHeadLoss, 'length', us).toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-right"><DeltaCell a={row.a.totalHeadLoss} b={row.b.totalHeadLoss} unit={len} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Manage scenarios */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s, i) => (
          <div key={i} className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-xs">
            <span>{s.name}</span>
            <button onClick={() => deleteScenario(i)} className="text-muted-foreground hover:text-red-400 ml-1">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add comparison view to Summary tab in main-tabs**

In `src/components/main-tabs.tsx`:

1. Add import:
```typescript
import { ScenarioComparison } from '@/components/summary/scenario-comparison';
```

2. After `<FreeboardCheck ... />` in the summary TabsContent (around line 251), add:
```tsx
{scenarios.length >= 2 && (
  <>
    <div className="h-px bg-border/40" />
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">Scenario Comparison</h2>
      <p className="text-sm text-muted-foreground max-w-prose text-pretty">
        Compare saved scenarios side-by-side.
      </p>
    </div>
    <ScenarioComparison />
  </>
)}
```

- [ ] **Step 3: Test manually**

Run: `cd app && npm run dev`
- Save 2 scenarios with different parameters
- Go to Summary tab — verify comparison section appears
- Verify delta values are correct

- [ ] **Step 4: Commit**

```bash
git add src/components/summary/scenario-comparison.tsx src/components/main-tabs.tsx
git commit -m "feat: add side-by-side scenario comparison view"
```

---

## Task 7: AI Chat API Route

Build the streaming chat endpoint that extends the existing OpenAI integration.

**Files:**
- Create: `src/lib/api/ai-chat-prompt.ts`
- Create: `src/app/api/ai-chat/route.ts`

- [ ] **Step 1: Create the chat system prompt builder**

```typescript
// src/lib/api/ai-chat-prompt.ts
import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
} from '@/engine/types';

export interface ChatContext {
  crossSectionStats: {
    pointCount: number;
    stationRange: [number, number];
    minElevation: number;
    maxElevation: number;
  };
  bridgeGeometry: {
    span: number;
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    pierCount: number;
    deckWidth: number;
  };
  coefficients: {
    contraction: number;
    expansion: number;
    debrisBlockagePct: number;
  };
  flowProfiles: Array<{
    name: string;
    ari: string;
    discharge: number;
    dsWsel: number;
  }>;
  results: Record<string, Array<{
    profileName: string;
    upstreamWsel: number;
    totalHeadLoss: number;
    approachVelocity: number;
    bridgeVelocity: number;
    froudeApproach: number;
    flowRegime: string;
    converged: boolean;
    error: string | null;
  }>>;
  whatIfActive: boolean;
  whatIfOverrides?: Record<string, number>;
}

export function buildChatContext(
  crossSection: CrossSectionPoint[],
  bridgeGeometry: BridgeGeometry,
  flowProfiles: FlowProfile[],
  coefficients: Coefficients,
  results: CalculationResults | null,
  whatIfOverrides?: Record<string, number>
): ChatContext {
  const stations = crossSection.map(p => p.station);
  const elevations = crossSection.map(p => p.elevation);

  const methodResults: ChatContext['results'] = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      methodResults[method] = results[method].map(r => ({
        profileName: r.profileName,
        upstreamWsel: r.upstreamWsel,
        totalHeadLoss: r.totalHeadLoss,
        approachVelocity: r.approachVelocity,
        bridgeVelocity: r.bridgeVelocity,
        froudeApproach: r.froudeApproach,
        flowRegime: r.flowRegime,
        converged: r.converged,
        error: r.error,
      }));
    }
  }

  return {
    crossSectionStats: {
      pointCount: crossSection.length,
      stationRange: [
        stations.length > 0 ? Math.min(...stations) : 0,
        stations.length > 0 ? Math.max(...stations) : 0,
      ],
      minElevation: elevations.length > 0 ? Math.min(...elevations) : 0,
      maxElevation: elevations.length > 0 ? Math.max(...elevations) : 0,
    },
    bridgeGeometry: {
      span: bridgeGeometry.rightAbutmentStation - bridgeGeometry.leftAbutmentStation,
      lowChordLeft: bridgeGeometry.lowChordLeft,
      lowChordRight: bridgeGeometry.lowChordRight,
      highChord: bridgeGeometry.highChord,
      pierCount: bridgeGeometry.piers.length,
      deckWidth: bridgeGeometry.deckWidth,
    },
    coefficients: {
      contraction: coefficients.contractionCoeff,
      expansion: coefficients.expansionCoeff,
      debrisBlockagePct: coefficients.debrisBlockagePct,
    },
    flowProfiles: flowProfiles.map(p => ({
      name: p.name, ari: p.ari, discharge: p.discharge, dsWsel: p.dsWsel,
    })),
    results: methodResults,
    whatIfActive: !!whatIfOverrides && Object.keys(whatIfOverrides).length > 0,
    whatIfOverrides,
  };
}

export const AI_CHAT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'adjust_mannings_n',
      description: 'Adjust the Manning\'s n multiplier for what-if analysis. 1.0 = baseline, 1.2 = 20% increase.',
      parameters: {
        type: 'object',
        properties: { multiplier: { type: 'number', minimum: 0.5, maximum: 1.5 } },
        required: ['multiplier'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_discharge',
      description: 'Adjust the discharge multiplier for what-if analysis. 1.0 = baseline, 1.5 = 50% increase.',
      parameters: {
        type: 'object',
        properties: { multiplier: { type: 'number', minimum: 0.5, maximum: 2.0 } },
        required: ['multiplier'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_debris',
      description: 'Set debris blockage percentage for what-if analysis.',
      parameters: {
        type: 'object',
        properties: { percentage: { type: 'number', minimum: 0, maximum: 50 } },
        required: ['percentage'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_contraction_coeff',
      description: 'Set the contraction coefficient for what-if analysis.',
      parameters: {
        type: 'object',
        properties: { value: { type: 'number', minimum: 0.1, maximum: 0.6 } },
        required: ['value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_expansion_coeff',
      description: 'Set the expansion coefficient for what-if analysis.',
      parameters: {
        type: 'object',
        properties: { value: { type: 'number', minimum: 0.1, maximum: 0.8 } },
        required: ['value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'reset_overrides',
      description: 'Reset all what-if overrides back to baseline values.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

export function buildChatSystemPrompt(context: ChatContext): string {
  return `You are a senior hydraulic engineer assistant embedded in a Bridge Loss Calculator tool. You have access to the full analysis data and can adjust what-if parameters.

CURRENT ANALYSIS DATA:
${JSON.stringify(context, null, 2)}

GUIDELINES:
- You are speaking to a hydraulic engineer. Use proper terminology: afflux, Froude number, WSEL, freeboard, Manning's n, pressure flow, overtopping.
- Always cite specific values from the data above. Never make up numbers.
- When comparing methods, explain which assumptions differ.
- When the engineer asks to try a parameter change, use the appropriate tool function.
- Keep responses concise — 2-4 sentences for simple questions, more for explanations.
- If asked about adequacy, reference freeboard (low chord minus US WSEL) and flow regime.
- Methods with non-null "error" fields are invalid — do not count them in agreement analysis.`;
}
```

- [ ] **Step 2: Create the streaming chat API route**

First, check how the existing Next.js 16 route handlers work. Read the relevant docs:

```bash
cd app && ls node_modules/next/dist/docs/ 2>/dev/null || echo "no docs dir"
```

Then create the route. The route uses the OpenAI SDK for streaming with function calling:

```typescript
// src/app/api/ai-chat/route.ts
import OpenAI from 'openai';
import { resolveOpenAICredentials } from '@/lib/api/openai-auth';
import { AI_CHAT_TOOLS, buildChatSystemPrompt, type ChatContext } from '@/lib/api/ai-chat-prompt';

export async function POST(request: Request) {
  try {
    const { messages, context }: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      context: ChatContext;
    } = await request.json();

    const creds = await resolveOpenAICredentials();
    if (!creds) {
      return Response.json(
        { error: 'No OpenAI credentials configured.' },
        { status: 401 }
      );
    }

    const systemPrompt = buildChatSystemPrompt(context);

    if (creds.type === 'platform') {
      const client = new OpenAI({ apiKey: creds.apiKey });
      const stream = await client.chat.completions.create({
        model: 'gpt-5.4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools: AI_CHAT_TOOLS,
        temperature: 0.4,
        stream: true,
      });

      // Stream the response as SSE
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let toolCalls: Array<{ name: string; arguments: string }> = [];

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta;

              // Text content
              if (delta?.content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`)
                );
              }

              // Tool calls
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.index !== undefined) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = { name: '', arguments: '' };
                    }
                    if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                    if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
                  }
                }
              }

              // Finish
              if (chunk.choices[0]?.finish_reason === 'tool_calls') {
                for (const tc of toolCalls) {
                  let args = {};
                  try { args = JSON.parse(tc.arguments); } catch { /* empty */ }
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: tc.name, arguments: args })}\n\n`)
                  );
                }
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Stream error' })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Codex OAuth fallback — non-streaming for simplicity
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.token}`,
      version: '0.80.0',
      'x-codex-beta-features': 'unified_exec,shell_snapshot',
      originator: 'codex_exec',
    };
    if (creds.accountId) {
      headers['chatgpt-account-id'] = creds.accountId;
    }

    const res = await fetch('https://chatgpt.com/backend-api/codex/responses', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'gpt-5.4',
        instructions: systemPrompt,
        input: messages.map(m => ({ role: m.role, content: m.content })),
        store: false,
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return Response.json({ error: `API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.output_text ?? data.output?.[0]?.content?.[0]?.text ?? '';

    return Response.json({ type: 'complete', content: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI chat error:', err);
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/ai-chat-prompt.ts src/app/api/ai-chat/route.ts
git commit -m "feat: add AI chat streaming API route with function calling"
```

---

## Task 8: AI Chat Panel UI

Build the slide-out chat panel with streaming message display and function call handling.

**Files:**
- Create: `src/components/ai-chat/chat-message.tsx`
- Create: `src/components/ai-chat/chat-input.tsx`
- Create: `src/components/ai-chat/chat-panel.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Create the message bubble component**

```typescript
// src/components/ai-chat/chat-message.tsx
'use client';

import { Sparkles, User, SlidersHorizontal } from 'lucide-react';

export interface ToolAction {
  name: string;
  arguments: Record<string, number>;
  label: string;
}

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  toolActions?: ToolAction[];
}

interface ChatMessageProps {
  message: ChatMessageData;
}

const TOOL_LABELS: Record<string, (args: Record<string, number>) => string> = {
  adjust_mannings_n: (a) => `Manning's n × ${a.multiplier?.toFixed(2)}`,
  adjust_discharge: (a) => `Discharge × ${a.multiplier?.toFixed(2)}`,
  adjust_debris: (a) => `Debris blockage ${a.percentage?.toFixed(0)}%`,
  adjust_contraction_coeff: (a) => `Contraction coeff ${a.value?.toFixed(2)}`,
  adjust_expansion_coeff: (a) => `Expansion coeff ${a.value?.toFixed(2)}`,
  reset_overrides: () => 'Reset to baseline',
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${
        isUser ? 'bg-muted' : 'bg-primary/10'
      }`}>
        {isUser ? (
          <User className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Sparkles className="h-3 w-3 text-primary" />
        )}
      </div>
      <div className={`flex-1 min-w-0 space-y-2 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/50 border border-border/50 text-foreground'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.toolActions && message.toolActions.length > 0 && (
          <div className="space-y-1">
            {message.toolActions.map((action, i) => (
              <div key={i} className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-xs text-primary">
                <SlidersHorizontal className="h-3 w-3" />
                <span>{TOOL_LABELS[action.name]?.(action.arguments) ?? action.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the chat input component**

```typescript
// src/components/ai-chat/chat-input.tsx
'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  messageCount: number;
  maxMessages: number;
}

export function ChatInput({ onSend, disabled, messageCount, maxMessages }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const atLimit = messageCount >= maxMessages;

  return (
    <div className="border-t border-border/40 p-3 space-y-2">
      {atLimit ? (
        <p className="text-xs text-amber-400 text-center">Message limit reached ({maxMessages}/{maxMessages})</p>
      ) : (
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your analysis..."
            disabled={disabled || atLimit}
            rows={1}
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={disabled || !value.trim() || atLimit}
            className="h-9 w-9 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{messageCount}/{maxMessages} messages</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the chat panel**

```typescript
// src/components/ai-chat/chat-panel.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { buildChatContext } from '@/lib/api/ai-chat-prompt';
import { ChatMessage, type ChatMessageData, type ToolAction } from './chat-message';
import { ChatInput } from './chat-input';
import type { WhatIfOverrides } from '@/components/what-if/what-if-controls';
import { Sparkles, X, Trash2 } from 'lucide-react';

const MAX_MESSAGES = 15;

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrides: WhatIfOverrides;
  onOverridesChange: (overrides: WhatIfOverrides) => void;
}

export function ChatPanel({ open, onOpenChange, overrides, onOverridesChange }: ChatPanelProps) {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function applyToolCall(name: string, args: Record<string, number>) {
    switch (name) {
      case 'adjust_mannings_n':
        onOverridesChange({ ...overrides, manningsNMultiplier: args.multiplier ?? 1.0 });
        break;
      case 'adjust_discharge':
        onOverridesChange({ ...overrides, dischargeMultiplier: args.multiplier ?? 1.0 });
        break;
      case 'adjust_debris':
        onOverridesChange({ ...overrides, debrisBlockagePct: args.percentage ?? 0 });
        break;
      case 'adjust_contraction_coeff':
        onOverridesChange({ ...overrides, contractionCoeff: args.value ?? 0.3 });
        break;
      case 'adjust_expansion_coeff':
        onOverridesChange({ ...overrides, expansionCoeff: args.value ?? 0.5 });
        break;
      case 'reset_overrides':
        onOverridesChange({
          manningsNMultiplier: 1.0,
          debrisBlockagePct: coefficients.debrisBlockagePct,
          contractionCoeff: coefficients.contractionCoeff,
          expansionCoeff: coefficients.expansionCoeff,
          dischargeMultiplier: 1.0,
        });
        break;
    }
  }

  const handleSend = useCallback(async (text: string) => {
    if (userMessageCount >= MAX_MESSAGES || streaming) return;

    const userMsg: ChatMessageData = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setUserMessageCount(c => c + 1);
    setStreaming(true);

    // Build context with current state
    const context = buildChatContext(
      crossSection, bridgeGeometry, flowProfiles, coefficients, results,
      overrides as unknown as Record<string, number>
    );

    // Add streaming assistant message
    const assistantMsg: ChatMessageData = { role: 'assistant', content: '', toolActions: [] };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        assistantMsg.content = `Error: ${err.error || 'Request failed'}`;
        setMessages([...newMessages, { ...assistantMsg }]);
        setStreaming(false);
        return;
      }

      // Check if streaming (SSE) or JSON response
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const event = JSON.parse(data);
                if (event.type === 'text') {
                  assistantMsg.content += event.content;
                  setMessages([...newMessages, { ...assistantMsg, toolActions: [...(assistantMsg.toolActions ?? [])] }]);
                } else if (event.type === 'tool_call') {
                  const action: ToolAction = {
                    name: event.name,
                    arguments: event.arguments,
                    label: event.name,
                  };
                  assistantMsg.toolActions = [...(assistantMsg.toolActions ?? []), action];
                  setMessages([...newMessages, { ...assistantMsg }]);
                  applyToolCall(event.name, event.arguments);
                } else if (event.type === 'error') {
                  assistantMsg.content += `\n\nError: ${event.message}`;
                  setMessages([...newMessages, { ...assistantMsg }]);
                }
              } catch { /* skip malformed */ }
            }
          }
        }
      } else {
        // Non-streaming JSON response (Codex fallback)
        const data = await response.json();
        assistantMsg.content = data.content || 'No response.';
        setMessages([...newMessages, { ...assistantMsg }]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      assistantMsg.content = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setMessages([...newMessages, { ...assistantMsg }]);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, userMessageCount, streaming, crossSection, bridgeGeometry, flowProfiles, coefficients, results, overrides]);

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setUserMessageCount(0);
    setStreaming(false);
  }

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[350px] bg-card border-l border-border/40 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear} title="Clear conversation">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Ask me about your analysis.</p>
            <p className="text-xs mt-2 text-muted-foreground/70">
              "Is this bridge adequate for Q100?"<br />
              "Why do the methods disagree?"<br />
              "Try Manning's n at 0.045"
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {streaming && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={streaming}
        messageCount={userMessageCount}
        maxMessages={MAX_MESSAGES}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add chat FAB and panel to main-tabs**

In `src/components/main-tabs.tsx`:

1. Add imports:
```typescript
import { ChatPanel } from '@/components/ai-chat/chat-panel';
import { Sparkles } from 'lucide-react';
import type { WhatIfOverrides } from '@/components/what-if/what-if-controls';
```

2. Add state:
```typescript
const [chatOpen, setChatOpen] = useState(false);
const [chatOverrides, setChatOverrides] = useState<WhatIfOverrides>({
  manningsNMultiplier: 1.0,
  debrisBlockagePct: coefficients.debrisBlockagePct,
  contractionCoeff: coefficients.contractionCoeff,
  expansionCoeff: coefficients.expansionCoeff,
  dischargeMultiplier: 1.0,
});
```

3. Add before the closing `</Tabs>`:
```tsx
{/* AI Chat FAB */}
{results && (
  <button
    onClick={() => setChatOpen(true)}
    className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-105"
    title="AI Assistant"
  >
    <Sparkles className="h-5 w-5" />
  </button>
)}

<ChatPanel
  open={chatOpen}
  onOpenChange={setChatOpen}
  overrides={chatOverrides}
  onOverridesChange={setChatOverrides}
/>
```

- [ ] **Step 5: Test manually**

Run: `cd app && npm run dev`
- Load a test bridge, run calculations
- Click the sparkles FAB in the bottom-right
- Send a message: "Is this bridge adequate for Q100?"
- Verify streaming response appears
- Try: "Set Manning's n to 0.045" — verify tool call card appears

- [ ] **Step 6: Commit**

```bash
git add src/components/ai-chat/chat-message.tsx src/components/ai-chat/chat-input.tsx src/components/ai-chat/chat-panel.tsx src/components/main-tabs.tsx
git commit -m "feat: add AI chat assistant with streaming and what-if commands"
```

---

## Task 9: Integration Polish

Final wiring and cross-feature integration.

**Files:**
- Modify: `src/components/main-tabs.tsx`
- Modify: `src/components/simulation/simulation-tab.tsx`

- [ ] **Step 1: Connect chat overrides to simulation tab what-if**

The chat panel manages its own `WhatIfOverrides` which should sync with the simulation tab. Update `main-tabs.tsx` to lift the what-if state so both the simulation tab and the chat panel share the same overrides.

In `src/components/main-tabs.tsx`, pass the chat overrides and setter down to `SimulationTab` as props. The `SimulationTab` already manages what-if state internally — refactor it to optionally accept external overrides:

In `simulation-tab.tsx`, add optional props:
```typescript
interface SimulationTabProps {
  externalOverrides?: WhatIfOverrides;
  onExternalOverridesChange?: (overrides: WhatIfOverrides) => void;
}
```

When these props are provided, use them instead of internal state. This lets the chat panel's what-if changes appear in the simulation view.

- [ ] **Step 2: Build check**

Run: `cd app && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run all tests**

Run: `cd app && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: connect AI chat overrides to simulation tab"
```

---

## Summary

| Task | Feature | Files |
|------|---------|-------|
| 1 | HEC-RAS Parser | `hecras-parser.ts` + tests |
| 2 | HEC-RAS Import UI | `drop-zone.tsx`, `hecras-import-dialog.tsx`, `main-tabs.tsx` |
| 3 | Optimizer Engine | `optimizer.ts` + tests |
| 4 | Optimizer Card UI | `optimizer-card.tsx`, `simulation-tab.tsx` |
| 5 | Scenario Snapshots | `project-store.ts`, `main-tabs.tsx` |
| 6 | Scenario Comparison | `scenario-comparison.tsx`, `main-tabs.tsx` |
| 7 | AI Chat API | `ai-chat-prompt.ts`, `ai-chat/route.ts` |
| 8 | AI Chat Panel UI | `chat-panel.tsx`, `chat-message.tsx`, `chat-input.tsx`, `main-tabs.tsx` |
| 9 | Integration Polish | Cross-feature wiring, build check |
