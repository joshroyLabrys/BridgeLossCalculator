# Wow Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four wow-factor features — animated hydraulic simulation, convergence visualizer, flood hazard heatmap, and "What If" scenarios — to make the Bridge Loss Calculator a showstopper for engineering demos.

**Architecture:** Feature 1 (simulation) gets a new top-level tab with D3/SVG for static geometry and Canvas overlay for particle animation. Features 2-4 enhance existing components. Feature 4 re-runs the actual engine with modified inputs (no approximations — engineers need trustworthy numbers). All features read from the existing Zustand store; only Feature 4 adds transient local state.

**Tech Stack:** D3 (already installed), HTML5 Canvas API, React 19, Zustand, Tailwind CSS v4, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-27-wow-features-design.md`

**IMPORTANT:** This project uses Next.js 16 which has breaking changes from earlier versions. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. All new components must be `'use client'` since they use hooks and browser APIs.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `src/engine/simulation-profile.ts` | Builds longitudinal hydraulic profile data from cross-section + bridge + results |
| `src/components/simulation/simulation-tab.tsx` | Container for the Simulation tab — controls + chart |
| `src/components/simulation/simulation-controls.tsx` | Flow profile selector, method selector, play/pause, speed slider |
| `src/components/simulation/hydraulic-profile-chart.tsx` | D3 SVG longitudinal profile + Canvas particle overlay |
| `src/components/simulation/particle-engine.ts` | Particle lifecycle, physics, and Canvas rendering |
| `src/components/results/convergence-chart.tsx` | Animated D3 convergence visualization |
| `src/components/hazard-overlay.tsx` | Hazard calculation + color mapping for cross-section overlay |
| `src/components/what-if/what-if-panel.tsx` | Floating drawer with sliders and live delta display |
| `src/components/what-if/what-if-controls.tsx` | Curated parameter slider set |

### Modified files
| File | Change |
|------|--------|
| `src/components/main-tabs.tsx` | Add Simulation tab trigger + content, add What-If button to header |
| `src/components/results/iteration-log.tsx` | Add convergence chart toggle above the table |
| `src/components/cross-section-chart.tsx` | Add optional hazard overlay rendering + toggle prop |
| `src/components/input/cross-section-form.tsx` | Pass hazard props to CrossSectionChart |

---

## Task 1: Simulation Profile Data Layer

Build the data structure that converts cross-section geometry + bridge + method results into a longitudinal profile suitable for 2D rendering.

**Files:**
- Create: `src/engine/simulation-profile.ts`

- [ ] **Step 1: Create the HydraulicProfile type and builder**

```typescript
// src/engine/simulation-profile.ts
import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  MethodResult,
  FlowRegime,
} from './types';
import { calcFlowArea, calcTopWidth } from './geometry';
import { calcVelocity } from './hydraulics';

export interface ProfileZone {
  stationStart: number;
  stationEnd: number;
  bedElevation: number;
  wsel: number;
  velocity: number;
  depth: number;
}

export interface HydraulicProfile {
  approach: ProfileZone;
  bridge: {
    stationStart: number;
    stationEnd: number;
    bedElevation: number;
    lowChordLeft: number;
    lowChordRight: number;
    highChord: number;
    deckWidth: number;
    wsel: number;
    velocity: number;
    depth: number;
    piers: { station: number; width: number }[];
  };
  exit: ProfileZone;
  flowRegime: FlowRegime;
  dsWsel: number;
  usWsel: number;
  totalHeadLoss: number;
}

/**
 * Finds the minimum bed elevation within a station range.
 */
function minBedElevation(
  crossSection: CrossSectionPoint[],
  staStart: number,
  staEnd: number,
): number {
  let minElev = Infinity;
  for (const pt of crossSection) {
    if (pt.station >= staStart && pt.station <= staEnd) {
      if (pt.elevation < minElev) minElev = pt.elevation;
    }
  }
  return minElev === Infinity ? crossSection[0]?.elevation ?? 0 : minElev;
}

export function buildHydraulicProfile(
  crossSection: CrossSectionPoint[],
  bridge: BridgeGeometry,
  profile: FlowProfile,
  result: MethodResult,
): HydraulicProfile {
  const firstSta = crossSection[0].station;
  const lastSta = crossSection[crossSection.length - 1].station;

  // Approach zone: from first station to left abutment
  const approachBed = minBedElevation(crossSection, firstSta, bridge.leftAbutmentStation);
  const approachArea = calcFlowArea(crossSection, result.upstreamWsel);
  const approachTw = calcTopWidth(crossSection, result.upstreamWsel);
  const approachDepth = approachTw > 0 ? approachArea / approachTw : 0;

  // Bridge zone: between abutments
  const bridgeBed = minBedElevation(crossSection, bridge.leftAbutmentStation, bridge.rightAbutmentStation);

  // Exit zone: from right abutment to last station
  const exitBed = minBedElevation(crossSection, bridge.rightAbutmentStation, lastSta);
  const exitArea = calcFlowArea(crossSection, profile.dsWsel);
  const exitTw = calcTopWidth(crossSection, profile.dsWsel);
  const exitDepth = exitTw > 0 ? exitArea / exitTw : 0;

  return {
    approach: {
      stationStart: firstSta,
      stationEnd: bridge.leftAbutmentStation,
      bedElevation: approachBed,
      wsel: result.upstreamWsel,
      velocity: result.approachVelocity,
      depth: approachDepth,
    },
    bridge: {
      stationStart: bridge.leftAbutmentStation,
      stationEnd: bridge.rightAbutmentStation,
      bedElevation: bridgeBed,
      lowChordLeft: bridge.lowChordLeft,
      lowChordRight: bridge.lowChordRight,
      highChord: bridge.highChord,
      deckWidth: bridge.deckWidth,
      wsel: result.upstreamWsel,
      velocity: result.bridgeVelocity,
      depth: result.upstreamWsel - bridgeBed,
      piers: bridge.piers.map(p => ({ station: p.station, width: p.width })),
    },
    exit: {
      stationStart: bridge.rightAbutmentStation,
      stationEnd: lastSta,
      bedElevation: exitBed,
      wsel: profile.dsWsel,
      velocity: calcVelocity(profile.discharge, exitArea),
      depth: exitDepth,
    },
    flowRegime: result.flowRegime,
    dsWsel: profile.dsWsel,
    usWsel: result.upstreamWsel,
    totalHeadLoss: result.totalHeadLoss,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit src/engine/simulation-profile.ts`
Expected: No errors (or only unrelated errors from other files). If there are import errors, check path aliases.

- [ ] **Step 3: Commit**

```bash
git add src/engine/simulation-profile.ts
git commit -m "feat: add simulation profile data layer for longitudinal hydraulic viz"
```

---

## Task 2: Particle Engine

The particle system manages lifecycle (spawn, move, recycle) and renders to a Canvas element. Pure logic — no React dependency.

**Files:**
- Create: `src/components/simulation/particle-engine.ts`

- [ ] **Step 1: Create the particle engine**

```typescript
// src/components/simulation/particle-engine.ts
import type { HydraulicProfile } from '@/engine/simulation-profile';

interface Particle {
  x: number;           // pixel x
  y: number;           // pixel y
  vx: number;          // pixels per frame
  stage: 'approach' | 'bridge' | 'exit';
  progress: number;    // 0-1 within stage
  opacity: number;
}

interface ScaleInfo {
  /** Convert longitudinal station to pixel x */
  xScale: (station: number) => number;
  /** Convert elevation to pixel y */
  yScale: (elevation: number) => number;
}

const REGIME_COLORS = {
  'free-surface': { particle: '#60a5fa', glow: 'rgba(96, 165, 250, 0.3)' },
  'pressure':     { particle: '#fbbf24', glow: 'rgba(251, 191, 36, 0.3)' },
  'overtopping':  { particle: '#f87171', glow: 'rgba(248, 113, 113, 0.3)' },
} as const;

export class ParticleEngine {
  private particles: Particle[] = [];
  private animFrameId: number | null = null;
  private playing = false;
  private speedMultiplier = 1;
  private particleCount = 30;
  private profile: HydraulicProfile | null = null;
  private scales: ScaleInfo | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  detach() {
    this.pause();
    this.canvas = null;
    this.ctx = null;
  }

  configure(profile: HydraulicProfile, scales: ScaleInfo, count?: number) {
    this.profile = profile;
    this.scales = scales;
    if (count !== undefined) this.particleCount = count;
    this.particles = [];
    this.seedParticles();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.tick();
  }

  pause() {
    this.playing = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0.25, Math.min(3, multiplier));
  }

  setParticleCount(count: number) {
    this.particleCount = count;
  }

  private seedParticles() {
    if (!this.profile || !this.scales) return;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.spawnParticle(Math.random()));
    }
  }

  private spawnParticle(initialProgress?: number): Particle {
    const p = this.profile!;
    const s = this.scales!;
    const progress = initialProgress ?? 0;

    // Particles spawn at the left edge of the approach zone
    const x = s.xScale(p.approach.stationStart + progress * (p.exit.stationEnd - p.approach.stationStart));
    // Vertical position: random within water depth, biased toward center
    const wsel = p.approach.wsel;
    const bed = p.approach.bedElevation;
    const yFrac = 0.2 + Math.random() * 0.6; // avoid very top and very bottom
    const elev = bed + yFrac * (wsel - bed);
    const y = s.yScale(elev);

    // Base speed from approach velocity, scaled to pixels
    const pixelsPerStation = Math.abs(s.xScale(1) - s.xScale(0));
    const baseSpeed = p.approach.velocity * pixelsPerStation * 0.02;

    return { x, y, vx: baseSpeed, stage: 'approach', progress, opacity: 1 };
  }

  private tick = () => {
    if (!this.playing || !this.ctx || !this.canvas || !this.profile || !this.scales) return;
    this.update();
    this.render();
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private update() {
    const p = this.profile!;
    const s = this.scales!;
    const totalWidth = s.xScale(p.exit.stationEnd) - s.xScale(p.approach.stationStart);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      // Determine local velocity multiplier based on zone
      let velocityMult = 1;
      const bridgeX1 = s.xScale(p.bridge.stationStart);
      const bridgeX2 = s.xScale(p.bridge.stationEnd);

      if (particle.x >= bridgeX1 && particle.x <= bridgeX2) {
        particle.stage = 'bridge';
        // Particles accelerate through the bridge (velocity ratio)
        velocityMult = p.approach.velocity > 0
          ? p.bridge.velocity / p.approach.velocity
          : 2;
      } else if (particle.x > bridgeX2) {
        particle.stage = 'exit';
        velocityMult = p.approach.velocity > 0
          ? p.exit.velocity / p.approach.velocity
          : 0.8;
      } else {
        particle.stage = 'approach';
        velocityMult = 1;
      }

      // Add turbulence for pressure/overtopping in bridge zone
      let turbY = 0;
      if (particle.stage === 'bridge') {
        if (p.flowRegime === 'pressure') {
          turbY = (Math.random() - 0.5) * 2 * this.speedMultiplier;
        } else if (p.flowRegime === 'overtopping') {
          turbY = (Math.random() - 0.5) * 3 * this.speedMultiplier;
        }
      }

      particle.x += particle.vx * velocityMult * this.speedMultiplier;
      particle.y += turbY;
      particle.progress = (particle.x - s.xScale(p.approach.stationStart)) / totalWidth;

      // Fade out near exit
      if (particle.progress > 0.85) {
        particle.opacity = Math.max(0, (1 - particle.progress) / 0.15);
      }

      // Recycle particles that leave the frame
      if (particle.progress >= 1 || particle.x > s.xScale(p.exit.stationEnd) + 10) {
        this.particles[i] = this.spawnParticle(0);
      }
    }

    // Maintain particle count
    while (this.particles.length < this.particleCount) {
      this.particles.push(this.spawnParticle(Math.random()));
    }
    while (this.particles.length > this.particleCount) {
      this.particles.pop();
    }
  }

  private render() {
    const ctx = this.ctx!;
    const canvas = this.canvas!;
    const regime = this.profile!.flowRegime;
    const colors = REGIME_COLORS[regime];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const particle of this.particles) {
      if (particle.opacity <= 0) continue;

      ctx.globalAlpha = particle.opacity * 0.8;

      // Glow
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = colors.glow;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = colors.particle;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit src/components/simulation/particle-engine.ts`

- [ ] **Step 3: Commit**

```bash
git add src/components/simulation/particle-engine.ts
git commit -m "feat: add particle engine for hydraulic simulation animation"
```

---

## Task 3: Hydraulic Profile Chart (D3 + Canvas)

The main visualization component — renders the static longitudinal profile with D3/SVG and overlays a Canvas for particle animation.

**Files:**
- Create: `src/components/simulation/hydraulic-profile-chart.tsx`

- [ ] **Step 1: Create the chart component**

```typescript
// src/components/simulation/hydraulic-profile-chart.tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { area as d3area, line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import type { HydraulicProfile } from '@/engine/simulation-profile';
import { ParticleEngine } from './particle-engine';
import { useProjectStore } from '@/store/project-store';
import { unitLabel } from '@/lib/units';

interface HydraulicProfileChartProps {
  profile: HydraulicProfile;
  isPlaying: boolean;
  speed: number;
  particleCount: number;
}

const THEME = {
  ground: '#71717a',
  groundFill: 'oklch(0.22 0.02 230)',
  bridge: '#ef4444',
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  waterFree: 'rgba(59, 130, 246, 0.12)',
  waterPressure: 'rgba(251, 191, 36, 0.12)',
  waterOvertopping: 'rgba(248, 113, 113, 0.12)',
  waterLineFree: '#3b82f6',
  waterLinePressure: '#fbbf24',
  waterLineOvertopping: '#f87171',
};

function waterColors(regime: string) {
  if (regime === 'pressure') return { fill: THEME.waterPressure, line: THEME.waterLinePressure };
  if (regime === 'overtopping') return { fill: THEME.waterOvertopping, line: THEME.waterLineOvertopping };
  return { fill: THEME.waterFree, line: THEME.waterLineFree };
}

export function HydraulicProfileChart({ profile, isPlaying, speed, particleCount }: HydraulicProfileChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  // Manage particle engine lifecycle
  useEffect(() => {
    const engine = new ParticleEngine();
    engineRef.current = engine;
    return () => { engine.detach(); };
  }, []);

  useEffect(() => {
    if (!engineRef.current) return;
    if (isPlaying) engineRef.current.play();
    else engineRef.current.pause();
  }, [isPlaying]);

  useEffect(() => {
    engineRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    engineRef.current?.setParticleCount(particleCount);
  }, [particleCount]);

  const draw = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    select(container).select('svg').remove();

    const rect = container.getBoundingClientRect();
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;

    // Size canvas to match chart area
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const svg = select(container)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', rect.height)
      .style('position', 'absolute')
      .style('top', '0')
      .style('left', '0')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Build longitudinal stations array (simplified profile)
    // Approach -> Bridge -> Exit as a simplified side view
    const p = profile;
    const stations = [
      { sta: p.approach.stationStart, bed: p.approach.bedElevation },
      { sta: p.approach.stationEnd,   bed: p.approach.bedElevation },
      { sta: p.bridge.stationStart,   bed: p.bridge.bedElevation },
      { sta: p.bridge.stationEnd,     bed: p.bridge.bedElevation },
      { sta: p.exit.stationStart,     bed: p.exit.bedElevation },
      { sta: p.exit.stationEnd,       bed: p.exit.bedElevation },
    ];

    // Scales
    const allSta = stations.map(s => s.sta);
    const allElev = [
      ...stations.map(s => s.bed),
      p.bridge.highChord,
      p.bridge.lowChordLeft,
      p.bridge.lowChordRight,
      p.usWsel,
      p.dsWsel,
    ];
    const staPad = (Math.max(...allSta) - Math.min(...allSta)) * 0.05 || 10;
    const elevPad = 3;

    const x = scaleLinear()
      .domain([Math.min(...allSta) - staPad, Math.max(...allSta) + staPad])
      .range([0, width]);

    const y = scaleLinear()
      .domain([Math.min(...allElev) - elevPad, Math.max(...allElev) + elevPad])
      .range([height, 0]);

    // Grid
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).tickSize(-height).tickFormat(() => ''))
      .call(g => g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'))
      .call(g => g.select('.domain').remove());

    svg.append('g')
      .call(axisLeft(y).tickSize(-width).tickFormat(() => ''))
      .call(g => g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'))
      .call(g => g.select('.domain').remove());

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(Math.max(4, Math.floor(width / 100))))
      .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

    svg.append('g')
      .call(axisLeft(y).ticks(Math.max(4, Math.floor(height / 50))))
      .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

    // Axis labels
    svg.append('text')
      .attr('x', width / 2).attr('y', height + 42)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11)
      .text(`Station (${lenUnit})`);

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -46)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11)
      .text(`Elevation (${lenUnit})`);

    // Ground fill
    const groundArea = d3area<{ sta: number; bed: number }>()
      .x(d => x(d.sta))
      .y0(height)
      .y1(d => y(d.bed));

    svg.append('path')
      .datum(stations)
      .attr('d', groundArea)
      .attr('fill', THEME.groundFill);

    // Ground line
    const groundLine = d3line<{ sta: number; bed: number }>()
      .x(d => x(d.sta))
      .y(d => y(d.bed));

    svg.append('path')
      .datum(stations)
      .attr('d', groundLine)
      .attr('fill', 'none')
      .attr('stroke', THEME.ground)
      .attr('stroke-width', 2);

    // Water surface fill
    const wc = waterColors(p.flowRegime);

    // Approach water
    const approachWaterPts = [
      [x(p.approach.stationStart), y(p.usWsel)],
      [x(p.approach.stationEnd), y(p.usWsel)],
      [x(p.approach.stationEnd), y(p.approach.bedElevation)],
      [x(p.approach.stationStart), y(p.approach.bedElevation)],
    ];
    svg.append('polygon')
      .attr('points', approachWaterPts.map(pt => pt.join(',')).join(' '))
      .attr('fill', wc.fill);

    // Bridge water
    const bridgeWselCapped = Math.min(p.usWsel, p.bridge.lowChordLeft);
    const bridgeWaterPts = [
      [x(p.bridge.stationStart), y(bridgeWselCapped)],
      [x(p.bridge.stationEnd), y(bridgeWselCapped)],
      [x(p.bridge.stationEnd), y(p.bridge.bedElevation)],
      [x(p.bridge.stationStart), y(p.bridge.bedElevation)],
    ];
    svg.append('polygon')
      .attr('points', bridgeWaterPts.map(pt => pt.join(',')).join(' '))
      .attr('fill', wc.fill);

    // Exit water
    const exitWaterPts = [
      [x(p.exit.stationStart), y(p.dsWsel)],
      [x(p.exit.stationEnd), y(p.dsWsel)],
      [x(p.exit.stationEnd), y(p.exit.bedElevation)],
      [x(p.exit.stationStart), y(p.exit.bedElevation)],
    ];
    svg.append('polygon')
      .attr('points', exitWaterPts.map(pt => pt.join(',')).join(' '))
      .attr('fill', wc.fill);

    // Water surface lines
    // Upstream WSEL
    svg.append('line')
      .attr('x1', x(p.approach.stationStart)).attr('y1', y(p.usWsel))
      .attr('x2', x(p.approach.stationEnd)).attr('y2', y(p.usWsel))
      .attr('stroke', wc.line).attr('stroke-width', 2);

    // Downstream WSEL
    svg.append('line')
      .attr('x1', x(p.exit.stationStart)).attr('y1', y(p.dsWsel))
      .attr('x2', x(p.exit.stationEnd)).attr('y2', y(p.dsWsel))
      .attr('stroke', wc.line).attr('stroke-width', 2);

    // Head loss indicator — dashed line showing the drop
    svg.append('line')
      .attr('x1', x(p.bridge.stationStart)).attr('y1', y(p.usWsel))
      .attr('x2', x(p.bridge.stationEnd)).attr('y2', y(p.dsWsel))
      .attr('stroke', wc.line).attr('stroke-width', 1.5).attr('stroke-dasharray', '6 4');

    // Bridge structure
    const deckX1 = x(p.bridge.stationStart);
    const deckX2 = x(p.bridge.stationEnd);

    // Deck rectangle
    svg.append('rect')
      .attr('x', deckX1)
      .attr('y', y(p.bridge.highChord))
      .attr('width', deckX2 - deckX1)
      .attr('height', y(p.bridge.lowChordLeft) - y(p.bridge.highChord))
      .attr('fill', THEME.bridge)
      .attr('fill-opacity', 0.2)
      .attr('stroke', THEME.bridge)
      .attr('stroke-width', 2)
      .attr('rx', 1);

    // Abutment walls
    svg.append('line')
      .attr('x1', deckX1).attr('y1', y(p.bridge.highChord))
      .attr('x2', deckX1).attr('y2', y(p.bridge.bedElevation))
      .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

    svg.append('line')
      .attr('x1', deckX2).attr('y1', y(p.bridge.highChord))
      .attr('x2', deckX2).attr('y2', y(p.bridge.bedElevation))
      .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

    // Piers
    const span = p.bridge.stationEnd - p.bridge.stationStart;
    for (const pier of p.bridge.piers) {
      const pierX = x(pier.station - pier.width / 2);
      const pierW = x(pier.station + pier.width / 2) - pierX;
      const t = span > 0 ? (pier.station - p.bridge.stationStart) / span : 0;
      const lowChordAtPier = p.bridge.lowChordLeft + t * (p.bridge.lowChordRight - p.bridge.lowChordLeft);

      svg.append('rect')
        .attr('x', pierX)
        .attr('y', y(lowChordAtPier))
        .attr('width', Math.max(pierW, 2))
        .attr('height', y(p.bridge.bedElevation) - y(lowChordAtPier))
        .attr('fill', THEME.bridge)
        .attr('fill-opacity', 0.4)
        .attr('stroke', THEME.bridge)
        .attr('stroke-width', 1);
    }

    // Pressure flow indicator: hatching on submerged deck
    if (p.flowRegime === 'pressure' || p.flowRegime === 'overtopping') {
      svg.append('rect')
        .attr('x', deckX1)
        .attr('y', y(p.bridge.highChord))
        .attr('width', deckX2 - deckX1)
        .attr('height', y(p.bridge.lowChordLeft) - y(p.bridge.highChord))
        .attr('fill', 'none')
        .attr('stroke', wc.line)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2 2')
        .attr('opacity', 0.5);
    }

    // Overtopping indicator: arrow over deck
    if (p.flowRegime === 'overtopping') {
      const overY = y(p.bridge.highChord) - 8;
      svg.append('text')
        .attr('x', (deckX1 + deckX2) / 2)
        .attr('y', overY)
        .attr('text-anchor', 'middle')
        .attr('fill', THEME.waterLineOvertopping)
        .attr('font-size', 11)
        .attr('font-weight', 600)
        .text('▼ OVERTOPPING ▼');
    }

    // Head loss annotation
    const midBridgeX = (deckX1 + deckX2) / 2;
    svg.append('line')
      .attr('x1', midBridgeX - 30).attr('y1', y(p.usWsel))
      .attr('x2', midBridgeX - 30).attr('y2', y(p.dsWsel))
      .attr('stroke', '#a1a1aa').attr('stroke-width', 1);

    svg.append('text')
      .attr('x', midBridgeX - 34)
      .attr('y', y((p.usWsel + p.dsWsel) / 2))
      .attr('text-anchor', 'end')
      .attr('fill', '#a1a1aa')
      .attr('font-size', 10)
      .text(`Δh = ${p.totalHeadLoss.toFixed(3)}`);

    // Configure particle engine with scales (offset by margin)
    const engine = engineRef.current;
    if (engine && canvas) {
      engine.attach(canvas);
      engine.configure(profile, {
        xScale: (sta: number) => x(sta) + margin.left,
        yScale: (elev: number) => y(elev) + margin.top,
      }, particleCount);
      if (isPlaying) engine.play();
    }
  }, [profile, lenUnit, particleCount, isPlaying]);

  useEffect(() => {
    draw();

    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div className="relative w-full" style={{ height: 420 }} ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ zIndex: 10 }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/simulation/hydraulic-profile-chart.tsx
git commit -m "feat: add hydraulic profile chart with D3 geometry and canvas particle overlay"
```

---

## Task 4: Simulation Controls

Simple control bar for the simulation tab.

**Files:**
- Create: `src/components/simulation/simulation-controls.tsx`

- [ ] **Step 1: Create controls component**

```typescript
// src/components/simulation/simulation-controls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { FlowProfile } from '@/engine/types';

interface SimulationControlsProps {
  profiles: FlowProfile[];
  selectedProfileIdx: number;
  onProfileChange: (idx: number) => void;
  methods: readonly string[];
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const METHOD_DOTS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

export function SimulationControls({
  profiles,
  selectedProfileIdx,
  onProfileChange,
  methods,
  selectedMethod,
  onMethodChange,
  isPlaying,
  onPlayingChange,
  speed,
  onSpeedChange,
}: SimulationControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Flow profile selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground font-medium">Profile</label>
        <select
          value={selectedProfileIdx}
          onChange={(e) => onProfileChange(Number(e.target.value))}
          className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-xs"
        >
          {profiles.map((p, i) => (
            <option key={i} value={i}>
              {p.name} — {p.ari} ({p.discharge.toFixed(0)} cfs)
            </option>
          ))}
        </select>
      </div>

      {/* Method selector */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => onMethodChange(m)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              selectedMethod === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${METHOD_DOTS[m] ?? 'bg-gray-500'}`} />
            {m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border/40" />

      {/* Play/Pause */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPlayingChange(!isPlaying)}
        className="gap-1.5"
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>

      {/* Speed slider */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Speed</label>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-20 accent-primary"
        />
        <span className="text-xs font-mono text-muted-foreground w-8">{speed}x</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/simulation/simulation-controls.tsx
git commit -m "feat: add simulation controls — profile/method selectors, play/pause, speed"
```

---

## Task 5: Simulation Tab + Main Tabs Integration

Wire up the simulation tab container and add it to the header nav.

**Files:**
- Create: `src/components/simulation/simulation-tab.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Create simulation tab container**

```typescript
// src/components/simulation/simulation-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/store/project-store';
import { buildHydraulicProfile } from '@/engine/simulation-profile';
import { HydraulicProfileChart } from './hydraulic-profile-chart';
import { SimulationControls } from './simulation-controls';
import type { CalculationResults } from '@/engine/types';
import { Waves } from 'lucide-react';

const METHOD_KEYS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

export function SimulationTab() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const crossSection = useProjectStore((s) => s.crossSection);
  const coefficients = useProjectStore((s) => s.coefficients);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('energy');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  // Only show methods that were run
  const activeMethods = METHOD_KEYS.filter(
    (m) => coefficients.methodsToRun[m] && results?.[m]?.length,
  );

  const methodResult = results?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const flowProfile = flowProfiles[selectedProfileIdx];

  const hydraulicProfile = useMemo(() => {
    if (!methodResult || !flowProfile || crossSection.length < 2) return null;
    return buildHydraulicProfile(crossSection, bridgeGeometry, flowProfile, methodResult);
  }, [crossSection, bridgeGeometry, flowProfile, methodResult]);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Waves className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Run calculations from the Input tab to see the simulation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Hydraulic Simulation</h2>
        <p className="text-sm text-muted-foreground max-w-prose text-pretty">
          2D longitudinal profile showing flow behavior through approach, bridge, and exit zones.
          Particles animate proportionally to local velocity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <SimulationControls
            profiles={flowProfiles}
            selectedProfileIdx={selectedProfileIdx}
            onProfileChange={setSelectedProfileIdx}
            methods={activeMethods}
            selectedMethod={selectedMethod}
            onMethodChange={setSelectedMethod}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
            speed={speed}
            onSpeedChange={setSpeed}
          />
        </CardHeader>
        <CardContent>
          {hydraulicProfile ? (
            <HydraulicProfileChart
              profile={hydraulicProfile}
              isPlaying={isPlaying}
              speed={speed}
              particleCount={30}
            />
          ) : (
            <div className="flex items-center justify-center h-[420px] text-muted-foreground text-sm">
              Select a profile and method with results to view the simulation
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flow regime badge */}
      {hydraulicProfile && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Flow Regime:</span>
          <span className={`px-2 py-1 rounded-md font-medium ${
            hydraulicProfile.flowRegime === 'free-surface'
              ? 'bg-blue-500/15 text-blue-400'
              : hydraulicProfile.flowRegime === 'pressure'
              ? 'bg-orange-500/15 text-orange-400'
              : 'bg-red-500/15 text-red-400'
          }`}>
            {hydraulicProfile.flowRegime.toUpperCase().replace('-', ' ')}
          </span>
          <span className="text-muted-foreground">
            US WSEL: <span className="text-foreground font-mono">{hydraulicProfile.usWsel.toFixed(2)}</span>
            {' | '}
            DS WSEL: <span className="text-foreground font-mono">{hydraulicProfile.dsWsel.toFixed(2)}</span>
            {' | '}
            Δh: <span className="text-foreground font-mono">{hydraulicProfile.totalHeadLoss.toFixed(3)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Simulation tab to main-tabs.tsx**

In `src/components/main-tabs.tsx`, add the import at the top with the other component imports:

```typescript
import { SimulationTab } from '@/components/simulation/simulation-tab';
```

Add a new icon import — add `Zap` to the existing lucide-react import:

```typescript
import { Waves, Upload, Download, Ruler, Settings2, FlaskConical, BarChart3, FileText, Layers, Landmark, Activity, SlidersHorizontal, Zap } from 'lucide-react';
```

Add the tab trigger after the Summary trigger (before the closing `</TabsList>`):

```tsx
<div className="h-4 w-px bg-border/50" aria-hidden="true" />
<TabsTrigger value="simulation" className="rounded-md px-3.5 py-1.5 text-xs">
  <Zap className="h-3.5 w-3.5" />
  Simulation
</TabsTrigger>
```

Add the tab content after the summary `</TabsContent>`:

```tsx
<TabsContent value="simulation" className="flex-1 px-6 py-5">
  <SimulationTab />
</TabsContent>
```

- [ ] **Step 3: Verify it builds**

Run: `cd app && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/simulation/simulation-tab.tsx src/components/main-tabs.tsx
git commit -m "feat: add Simulation tab with animated hydraulic profile visualization"
```

---

## Task 6: Animated Convergence Chart

Enhance the iteration log with an animated D3 chart showing solver convergence.

**Files:**
- Create: `src/components/results/convergence-chart.tsx`
- Modify: `src/components/results/iteration-log.tsx`

- [ ] **Step 1: Create the convergence chart component**

```typescript
// src/components/results/convergence-chart.tsx
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import type { IterationStep } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface ConvergenceChartProps {
  log: IterationStep[];
  tolerance: number;
}

const THEME = {
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  line: '#818cf8',
  point: '#6366f1',
  converged: '#10b981',
  diverged: '#ef4444',
  target: '#3b82f6',
  toleranceBand: 'rgba(59, 130, 246, 0.08)',
  connector: 'rgba(99, 102, 241, 0.3)',
};

export function ConvergenceChart({ log, tolerance }: ConvergenceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);
  const [animKey, setAnimKey] = useState(0);

  const draw = useCallback(() => {
    const container = containerRef.current;
    if (!container || log.length === 0) return;

    select(container).select('svg').remove();

    const rect = container.getBoundingClientRect();
    const margin = { top: 16, right: 24, bottom: 50, left: 56 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;

    const svg = select(container)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', rect.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales — X is iteration number, Y is error
    const errors = log.map((s) => toDisplay(s.error, 'length', us));
    const tolDisplay = toDisplay(tolerance, 'length', us);

    const x = scaleLinear()
      .domain([1, log.length])
      .range([0, width]);

    const maxErr = max(errors) ?? 1;
    const y = scaleLinear()
      .domain([0, maxErr * 1.15])
      .range([height, 0]);

    // Grid
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(Math.min(log.length, 10)).tickSize(-height).tickFormat(() => ''))
      .call(g => g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'))
      .call(g => g.select('.domain').remove());

    svg.append('g')
      .call(axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
      .call(g => g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'))
      .call(g => g.select('.domain').remove());

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(Math.min(log.length, 10)))
      .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

    svg.append('g')
      .call(axisLeft(y).ticks(5))
      .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

    // Labels
    svg.append('text')
      .attr('x', width / 2).attr('y', height + 36)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11)
      .text('Iteration');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -42)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11)
      .text(`Error (${lenUnit})`);

    // Tolerance line
    svg.append('line')
      .attr('x1', 0).attr('y1', y(tolDisplay))
      .attr('x2', width).attr('y2', y(tolDisplay))
      .attr('stroke', THEME.target)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 3');

    // Tolerance band
    svg.append('rect')
      .attr('x', 0).attr('y', y(tolDisplay))
      .attr('width', width).attr('height', height - y(tolDisplay))
      .attr('fill', THEME.toleranceBand);

    // Tolerance label
    svg.append('text')
      .attr('x', width - 4).attr('y', y(tolDisplay) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', THEME.target).attr('font-size', 9)
      .text(`tolerance = ${tolDisplay.toFixed(4)}`);

    // Animated line + points
    const errorLine = d3line<IterationStep>()
      .x((d) => x(d.iteration))
      .y((d) => y(toDisplay(d.error, 'length', us)));

    const path = svg.append('path')
      .datum(log)
      .attr('d', errorLine)
      .attr('fill', 'none')
      .attr('stroke', THEME.line)
      .attr('stroke-width', 2);

    // Animate the line drawing
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() ?? 0;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(log.length * 120)
      .attr('stroke-dashoffset', 0);

    // Animate points appearing
    log.forEach((step, i) => {
      const isLast = i === log.length - 1;
      const converged = step.error <= tolerance;

      svg.append('circle')
        .attr('cx', x(step.iteration))
        .attr('cy', y(toDisplay(step.error, 'length', us)))
        .attr('r', 0)
        .attr('fill', isLast ? (converged ? THEME.converged : THEME.diverged) : THEME.point)
        .attr('stroke', '#1a1a2e')
        .attr('stroke-width', 1.5)
        .transition()
        .delay(i * 120)
        .duration(200)
        .attr('r', isLast ? 5 : 3);

      // Badge on last point
      if (isLast) {
        const badge = converged ? 'CONVERGED' : 'DIVERGED';
        const badgeColor = converged ? THEME.converged : THEME.diverged;

        svg.append('text')
          .attr('x', x(step.iteration))
          .attr('y', y(toDisplay(step.error, 'length', us)) - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', badgeColor)
          .attr('font-size', 10)
          .attr('font-weight', 700)
          .attr('opacity', 0)
          .transition()
          .delay(i * 120 + 200)
          .duration(300)
          .attr('opacity', 1)
          .text(badge);
      }
    });
  }, [log, tolerance, us, lenUnit, animKey]);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  if (log.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Convergence History</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={() => setAnimKey((k) => k + 1)}
        >
          <RotateCcw className="h-3 w-3" />
          Replay
        </Button>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 200 }} />
    </div>
  );
}
```

- [ ] **Step 2: Integrate into iteration-log.tsx**

Replace the entire content of `src/components/results/iteration-log.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { IterationStep } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ChevronDown, TrendingDown } from 'lucide-react';
import { ConvergenceChart } from './convergence-chart';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const us = useProjectStore((s) => s.unitSystem);
  const tolerance = useProjectStore((s) => s.coefficients.tolerance);
  const len = unitLabel('length', us);

  if (log.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Iteration Log ({log.length} iterations)
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 mt-2">
        {showChart && (
          <ConvergenceChart log={log} tolerance={tolerance} />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <TrendingDown className="h-3 w-3" />
            {showChart ? 'Hide chart' : 'Show chart'}
          </button>
        </div>
        <div className="rounded-lg border overflow-auto max-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs text-right">Trial WSEL ({len})</TableHead>
                <TableHead className="text-xs text-right">Computed WSEL ({len})</TableHead>
                <TableHead className="text-xs text-right">Error ({len})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((step) => (
                <TableRow key={step.iteration} className="even:bg-muted/20">
                  <TableCell className="font-mono text-xs">{step.iteration}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{toDisplay(step.trialWsel, 'length', us).toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{toDisplay(step.computedWsel, 'length', us).toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{toDisplay(step.error, 'length', us).toFixed(6)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `cd app && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/results/convergence-chart.tsx src/components/results/iteration-log.tsx
git commit -m "feat: add animated convergence chart to iteration log"
```

---

## Task 7: Flood Hazard Heatmap Overlay

Add hazard classification overlay to the existing cross-section chart.

**Files:**
- Create: `src/components/hazard-overlay.tsx`
- Modify: `src/components/cross-section-chart.tsx`
- Modify: `src/components/input/cross-section-form.tsx`

- [ ] **Step 1: Create hazard calculation + color mapping**

```typescript
// src/components/hazard-overlay.tsx
import type { CrossSectionPoint, MethodResult } from '@/engine/types';
import { clipSegmentToWsel } from '@/engine/geometry';

export type HazardLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

export interface HazardZone {
  stationStart: number;
  stationEnd: number;
  depth: number;
  velocity: number;
  dv: number;
  level: HazardLevel;
}

export const HAZARD_COLORS: Record<HazardLevel, string> = {
  H1: '#22c55e',  // Green — generally safe
  H2: '#eab308',  // Yellow — unsafe for small vehicles
  H3: '#f97316',  // Orange — unsafe for vehicles, children, elderly
  H4: '#ef4444',  // Red — unsafe for all people and vehicles
  H5: '#991b1b',  // Dark red — extreme hazard
};

export const HAZARD_LABELS: Record<HazardLevel, string> = {
  H1: 'Generally Safe',
  H2: 'Unsafe — Small Vehicles',
  H3: 'Unsafe — Vehicles & Vulnerable People',
  H4: 'Unsafe — All People & Vehicles',
  H5: 'Extreme Danger',
};

/**
 * Classifies flood hazard using depth × velocity product (D×V)
 * per Australian Rainfall & Runoff (ARR) / TUFLOW conventions.
 */
function classifyHazard(depth: number, velocity: number): HazardLevel {
  const dv = depth * velocity;
  // Thresholds in ft · ft/s (imperial). Based on ARR guidelines converted:
  // H1: D×V < 0.6, H2: 0.6-1.2, H3: 1.2-2.4, H4: 2.4-6.0, H5: ≥6.0
  // (ft²/s equivalents of m²/s thresholds: 0.2, 0.4, 0.6, 0.8 → scaled by 3.281²×0.3048)
  // Simplified imperial thresholds:
  if (dv < 2.0) return 'H1';
  if (dv < 4.0) return 'H2';
  if (dv < 8.0) return 'H3';
  if (dv < 20.0) return 'H4';
  return 'H5';
}

/**
 * Computes hazard zones across the cross-section for a given WSEL and average velocity.
 * Approximates local depth at each segment midpoint and uses the average velocity
 * (a simplification — true local velocity varies, but this is sufficient for visualization).
 */
export function computeHazardZones(
  crossSection: CrossSectionPoint[],
  wsel: number,
  avgVelocity: number,
): HazardZone[] {
  const zones: HazardZone[] = [];

  for (let i = 0; i < crossSection.length - 1; i++) {
    const clip = clipSegmentToWsel(
      crossSection[i].station,
      crossSection[i].elevation,
      crossSection[i + 1].station,
      crossSection[i + 1].elevation,
      wsel,
    );
    if (!clip) continue;

    const midElev = (clip.cz1 + clip.cz2) / 2;
    const depth = Math.max(0, wsel - midElev);
    if (depth <= 0) continue;

    const dv = depth * avgVelocity;
    const level = classifyHazard(depth, avgVelocity);

    zones.push({
      stationStart: clip.cx1,
      stationEnd: clip.cx2,
      depth,
      velocity: avgVelocity,
      dv,
      level,
    });
  }

  return zones;
}
```

- [ ] **Step 2: Add hazard overlay rendering to cross-section-chart.tsx**

In `src/components/cross-section-chart.tsx`, add imports at the top:

```typescript
import { computeHazardZones, HAZARD_COLORS, HAZARD_LABELS, type HazardLevel } from './hazard-overlay';
import type { MethodResult } from '@/engine/types';
```

Update the props interface:

```typescript
interface CrossSectionChartProps {
  crossSection: CrossSectionPoint[];
  wsel?: number;
  bridge?: BridgeGeometry;
  methodWsels?: Record<string, number>;
  hazardResult?: MethodResult | null;
  showHazard?: boolean;
}
```

Update the component signature and the `draw` callback deps to include the new props:

```typescript
export function CrossSectionChart({ crossSection, wsel, bridge, methodWsels, hazardResult, showHazard }: CrossSectionChartProps) {
```

Add the `hazardResult` and `showHazard` to the `draw` callback dependency array.

Inside the `draw` callback, **after** the water surface fill block (the polygon with `THEME.water` fill) and **before** the ground line, add:

```typescript
    // --- HAZARD OVERLAY ---
    if (showHazard && hazardResult && wsel !== undefined) {
      const zones = computeHazardZones(crossSection, wsel, hazardResult.approachVelocity);
      for (const zone of zones) {
        const zx1 = x(zone.stationStart);
        const zx2 = x(zone.stationEnd);
        const zy1 = y(wsel);
        const midElev = crossSection.find(p => p.station >= zone.stationStart)?.elevation ?? 0;
        const zy2 = y(Math.max(midElev, crossSection.find(p => p.station >= zone.stationEnd)?.elevation ?? 0));

        svg.append('rect')
          .attr('x', zx1)
          .attr('y', zy1)
          .attr('width', Math.max(zx2 - zx1, 1))
          .attr('height', Math.max(zy2 - zy1, 0))
          .attr('fill', HAZARD_COLORS[zone.level])
          .attr('fill-opacity', 0.25)
          .attr('pointer-events', 'none');
      }

      // Hazard legend (small, bottom-right of chart)
      const hazLevels: HazardLevel[] = ['H1', 'H2', 'H3', 'H4', 'H5'];
      const legendG = svg.append('g')
        .attr('transform', `translate(${width - 130}, 8)`);

      legendG.append('rect')
        .attr('x', -6).attr('y', -4)
        .attr('width', 136).attr('height', hazLevels.length * 14 + 8)
        .attr('fill', 'oklch(0.15 0.01 230)')
        .attr('fill-opacity', 0.9)
        .attr('rx', 4)
        .attr('stroke', THEME.grid);

      hazLevels.forEach((level, i) => {
        legendG.append('rect')
          .attr('x', 0).attr('y', i * 14)
          .attr('width', 10).attr('height', 10)
          .attr('fill', HAZARD_COLORS[level])
          .attr('rx', 1);

        legendG.append('text')
          .attr('x', 14).attr('y', i * 14 + 8)
          .attr('fill', THEME.axis).attr('font-size', 9)
          .text(`${level}: ${HAZARD_LABELS[level].split('—')[0].trim()}`);
      });
    }
```

Update the useCallback dependency array to include `hazardResult` and `showHazard`:

```typescript
  }, [crossSection, wsel, bridge, methodWsels, lenUnit, hazardResult, showHazard]);
```

- [ ] **Step 3: Add hazard toggle to cross-section-form.tsx**

Read `src/components/input/cross-section-form.tsx` to find where the CrossSectionChart is rendered, then add a toggle button and pass the new props. The exact edit depends on the file content, but the pattern is:

1. Add state: `const [showHazard, setShowHazard] = useState(false);`
2. Get results from store: `const results = useProjectStore((s) => s.results);`
3. Use the first energy result as the hazard source (or let user pick)
4. Add a toggle button above the chart
5. Pass `hazardResult` and `showHazard` props to `CrossSectionChart`

The toggle button should look like:

```tsx
{results && (
  <button
    onClick={() => setShowHazard(!showHazard)}
    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all border ${
      showHazard
        ? 'border-primary/50 bg-primary/10 text-primary'
        : 'border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground'
    }`}
  >
    <ShieldAlert className="h-3.5 w-3.5" />
    Hazard Overlay
  </button>
)}
```

Import `ShieldAlert` from `lucide-react` and `useState` from `react`.

- [ ] **Step 4: Verify it builds**

Run: `cd app && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/hazard-overlay.tsx src/components/cross-section-chart.tsx src/components/input/cross-section-form.tsx
git commit -m "feat: add flood hazard heatmap overlay to cross-section chart"
```

---

## Task 8: "What If" Controls Component

The curated parameter slider set for the What-If panel.

**Files:**
- Create: `src/components/what-if/what-if-controls.tsx`

- [ ] **Step 1: Create the controls**

```typescript
// src/components/what-if/what-if-controls.tsx
'use client';

export interface WhatIfOverrides {
  manningsNMultiplier: number;       // 1.0 = unchanged
  debrisBlockagePct: number;         // 0-50
  contractionCoeff: number;          // 0.1-0.6
  expansionCoeff: number;            // 0.1-0.8
  dischargeMultiplier: number;       // 0.5-2.0
}

export const DEFAULT_OVERRIDES: WhatIfOverrides = {
  manningsNMultiplier: 1.0,
  debrisBlockagePct: 0,
  contractionCoeff: 0.3,
  expansionCoeff: 0.5,
  dischargeMultiplier: 1.0,
};

interface SliderDef {
  key: keyof WhatIfOverrides;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  { key: 'dischargeMultiplier', label: 'Discharge', min: 0.5, max: 2.0, step: 0.1, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'manningsNMultiplier', label: "Manning's n", min: 0.5, max: 1.5, step: 0.05, format: (v) => `${(v * 100).toFixed(0)}%` },
  { key: 'debrisBlockagePct', label: 'Debris Blockage', min: 0, max: 50, step: 5, format: (v) => `${v}%` },
  { key: 'contractionCoeff', label: 'Contraction Coeff', min: 0.1, max: 0.6, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'expansionCoeff', label: 'Expansion Coeff', min: 0.1, max: 0.8, step: 0.05, format: (v) => v.toFixed(2) },
];

interface WhatIfControlsProps {
  overrides: WhatIfOverrides;
  defaults: WhatIfOverrides;
  onChange: (overrides: WhatIfOverrides) => void;
}

export function WhatIfControls({ overrides, defaults, onChange }: WhatIfControlsProps) {
  return (
    <div className="space-y-3">
      {SLIDERS.map((s) => {
        const value = overrides[s.key];
        const isChanged = value !== defaults[s.key];
        return (
          <div key={s.key} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <label className="text-xs font-medium text-foreground">{s.label}</label>
              <span className={`text-xs font-mono ${isChanged ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.format(value)}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value}
              onChange={(e) => onChange({ ...overrides, [s.key]: parseFloat(e.target.value) })}
              className="w-full accent-primary h-1.5"
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/what-if/what-if-controls.tsx
git commit -m "feat: add what-if parameter slider controls"
```

---

## Task 9: "What If" Floating Panel

The main panel that runs the engine with modified inputs and shows deltas.

**Files:**
- Create: `src/components/what-if/what-if-panel.tsx`
- Modify: `src/components/main-tabs.tsx`

- [ ] **Step 1: Create the floating panel**

```typescript
// src/components/what-if/what-if-panel.tsx
'use client';

import { useState, useMemo } from 'react';
import { X, RotateCcw, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { runAllMethods } from '@/engine';
import { toDisplay, unitLabel } from '@/lib/units';
import { WhatIfControls, DEFAULT_OVERRIDES, type WhatIfOverrides } from './what-if-controls';
import type { CalculationResults } from '@/engine/types';

function Delta({ baseline, modified, unit, inverted }: { baseline: number; modified: number; unit: string; inverted?: boolean }) {
  const diff = modified - baseline;
  if (Math.abs(diff) < 0.0001) return <span className="text-muted-foreground text-[10px] font-mono">—</span>;
  // inverted: lower is better (e.g. head loss)
  const isWorse = inverted ? diff > 0 : diff > 0;
  return (
    <span className={`text-[10px] font-mono ${isWorse ? 'text-red-400' : 'text-emerald-400'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(3)} {unit}
    </span>
  );
}

export function WhatIfPanel({ onClose }: { onClose: () => void }) {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const baselineResults = useProjectStore((s) => s.results);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<keyof CalculationResults>('energy');

  const defaults: WhatIfOverrides = {
    manningsNMultiplier: 1.0,
    debrisBlockagePct: coefficients.debrisBlockagePct,
    contractionCoeff: coefficients.contractionCoeff,
    expansionCoeff: coefficients.expansionCoeff,
    dischargeMultiplier: 1.0,
  };

  const [overrides, setOverrides] = useState<WhatIfOverrides>(defaults);

  // Run engine with modified inputs
  const modifiedResults = useMemo(() => {
    if (crossSection.length < 2 || flowProfiles.length === 0) return null;

    const modifiedXs = crossSection.map((p) => ({
      ...p,
      manningsN: p.manningsN * overrides.manningsNMultiplier,
    }));

    const modifiedProfiles = flowProfiles.map((p) => ({
      ...p,
      discharge: p.discharge * overrides.dischargeMultiplier,
    }));

    const modifiedCoeffs = {
      ...coefficients,
      debrisBlockagePct: overrides.debrisBlockagePct,
      contractionCoeff: overrides.contractionCoeff,
      expansionCoeff: overrides.expansionCoeff,
    };

    return runAllMethods(modifiedXs, bridgeGeometry, modifiedProfiles, modifiedCoeffs);
  }, [crossSection, bridgeGeometry, flowProfiles, coefficients, overrides]);

  const baseResult = baselineResults?.[selectedMethod]?.[selectedProfileIdx];
  const modResult = modifiedResults?.[selectedMethod]?.[selectedProfileIdx];

  const hasChanges = JSON.stringify(overrides) !== JSON.stringify(defaults);

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/30 z-50 flex flex-col max-h-[calc(100vh-6rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">What If?</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile + method selectors */}
      <div className="px-4 py-2 border-b border-border/30 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide w-12">Profile</label>
          <select
            value={selectedProfileIdx}
            onChange={(e) => setSelectedProfileIdx(Number(e.target.value))}
            className="flex-1 rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs"
          >
            {flowProfiles.map((p, i) => (
              <option key={i} value={i}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide w-12">Method</label>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value as keyof CalculationResults)}
            className="flex-1 rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs"
          >
            {(['energy', 'momentum', 'yarnell', 'wspro'] as const)
              .filter((m) => coefficients.methodsToRun[m])
              .map((m) => (
                <option key={m} value={m}>
                  {m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 overflow-y-auto flex-1">
        <WhatIfControls overrides={overrides} defaults={defaults} onChange={setOverrides} />
      </div>

      {/* Results delta */}
      {baseResult && modResult && (
        <div className="px-4 py-3 border-t border-border/40 bg-muted/20 space-y-2">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">Impact</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">US WSEL</div>
              <div className="font-mono font-medium">{toDisplay(modResult.upstreamWsel, 'length', us).toFixed(3)} {len}</div>
              <Delta baseline={baseResult.upstreamWsel} modified={modResult.upstreamWsel} unit={len} inverted />
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Head Loss</div>
              <div className="font-mono font-medium">{toDisplay(modResult.totalHeadLoss, 'length', us).toFixed(3)} {len}</div>
              <Delta baseline={baseResult.totalHeadLoss} modified={modResult.totalHeadLoss} unit={len} inverted />
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Velocity</div>
              <div className="font-mono font-medium">{toDisplay(modResult.approachVelocity, 'velocity', us).toFixed(2)} {vel}</div>
              <Delta baseline={baseResult.approachVelocity} modified={modResult.approachVelocity} unit={vel} inverted />
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">Froude</div>
              <div className="font-mono font-medium">{modResult.froudeApproach.toFixed(3)}</div>
              <Delta baseline={baseResult.froudeApproach} modified={modResult.froudeApproach} unit="" inverted />
            </div>
          </div>

          {/* Regime change alert */}
          {modResult.flowRegime !== baseResult.flowRegime && (
            <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-400">
              Regime changed: {baseResult.flowRegime} → <span className="font-semibold">{modResult.flowRegime}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          disabled={!hasChanges}
          onClick={() => setOverrides(defaults)}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
        <span className="text-[10px] text-muted-foreground">
          {hasChanges ? 'Live re-calculation' : 'Adjust a parameter'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add What-If button to main-tabs.tsx header**

In `src/components/main-tabs.tsx`, add imports:

```typescript
import { WhatIfPanel } from '@/components/what-if/what-if-panel';
```

Add `FlaskConical` is already imported. We'll use a different icon. Add `Beaker` — actually lucide-react doesn't have `Beaker`. Use `FlaskRound` or just reuse `FlaskConical`. Let's use `Lightbulb`:

Add `Lightbulb` to the lucide-react import.

Inside the `MainTabs` component, add state:

```typescript
const [showWhatIf, setShowWhatIf] = useState(false);
```

In the header's right-side utilities div, add a button before the Import button:

```tsx
{results && (
  <>
    <Button
      variant={showWhatIf ? 'default' : 'outline'}
      size="default"
      onClick={() => setShowWhatIf(!showWhatIf)}
      className="gap-2 text-sm"
    >
      <Lightbulb className="h-4 w-4" />
      What If?
    </Button>
    <div className="w-px h-6 bg-border/40 mx-1" />
  </>
)}
```

At the end of the component, just before the closing `</Tabs>`, add:

```tsx
{showWhatIf && results && <WhatIfPanel onClose={() => setShowWhatIf(false)} />}
```

- [ ] **Step 3: Verify it builds**

Run: `cd app && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/what-if/what-if-controls.tsx src/components/what-if/what-if-panel.tsx src/components/main-tabs.tsx
git commit -m "feat: add What If instant scenario panel with live engine recalculation"
```

---

## Task 10: Integration Testing & Polish

Manually test all four features together and fix any issues.

- [ ] **Step 1: Start dev server and test**

Run: `cd app && npm run dev`

Test checklist:
1. **Simulation tab**: Does it appear in the header? Does it show "No results yet" before running calcs? After running calcs, does the profile render? Do particles animate? Do controls work (profile/method switch, play/pause, speed)?
2. **Convergence chart**: Open Method Results → expand a profile → expand Iteration Log. Does the chart animate? Does "Replay" work? Does "Hide chart" toggle work?
3. **Hazard overlay**: Go to Input → Cross-Section. Run calculations. Does "Hazard Overlay" button appear? Does toggling it show colored zones on the chart? Does the legend render?
4. **What-If panel**: Does "What If?" button appear in the header after running calcs? Does the floating panel open? Do sliders work? Do deltas update in real-time? Does regime change alert show when pushing discharge high enough?

- [ ] **Step 2: Fix any issues found**

Address bugs, styling problems, or edge cases discovered during testing.

- [ ] **Step 3: Run a full build to verify no type errors**

Run: `cd app && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: polish wow features — integration testing fixes"
```
