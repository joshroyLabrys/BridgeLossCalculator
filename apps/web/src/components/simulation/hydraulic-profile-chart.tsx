// src/components/simulation/hydraulic-profile-chart.tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { area as d3area, line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import type { HydraulicProfile } from '@flowsuite/engine/simulation-profile';
import type { CrossSectionPoint } from '@flowsuite/engine/types';
import { ParticleEngine } from './particle-engine';
import { useProjectStore } from '@/store/project-store';
import { unitLabel } from '@flowsuite/data';

interface HydraulicProfileChartProps {
  profile: HydraulicProfile;
  isPlaying: boolean;
  speed: number;
  particleCount: number;
}

const THEME = {
  ground: '#71717a',
  groundFill: 'oklch(0.22 0.02 230)',
  groundDot: '#a1a1aa',
  bridge: '#ef4444',
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  waterFree: 'rgba(59, 130, 246, 0.08)',
  waterPressure: 'rgba(251, 191, 36, 0.08)',
  waterOvertopping: 'rgba(248, 113, 113, 0.08)',
  waterLineFree: '#3b82f6',
  waterLinePressure: '#fbbf24',
  waterLineOvertopping: '#f87171',
};

function waterColors(regime: string) {
  if (regime === 'pressure') return { fill: THEME.waterPressure, line: THEME.waterLinePressure };
  if (regime === 'overtopping') return { fill: THEME.waterOvertopping, line: THEME.waterLineOvertopping };
  return { fill: THEME.waterFree, line: THEME.waterLineFree };
}

function interpGround(crossSection: CrossSectionPoint[], sta: number): number {
  for (let i = 0; i < crossSection.length - 1; i++) {
    if (crossSection[i].station <= sta && crossSection[i + 1].station >= sta) {
      const t = (sta - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
      return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
    }
  }
  return crossSection[crossSection.length - 1]?.elevation ?? 0;
}

export function HydraulicProfileChart({ profile, isPlaying, speed, particleCount }: HydraulicProfileChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

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

    const p = profile;
    const cs = p.crossSection;

    // Scales — use actual cross-section data
    const allStations = cs.map(d => d.station);
    const staPad = (max(allStations)! - min(allStations)!) * 0.03 || 10;
    const allElevs = [
      ...cs.map(d => d.elevation),
      p.bridge.highChord,
      p.bridge.lowChordLeft,
      p.bridge.lowChordRight,
      p.usWsel,
      p.dsWsel,
    ];
    const elevPad = 3;

    const x = scaleLinear()
      .domain([min(allStations)! - staPad, max(allStations)! + staPad])
      .range([0, width]);

    const y = scaleLinear()
      .domain([min(allElevs)! - elevPad, max(allElevs)! + elevPad])
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
      .call(axisBottom(x).ticks(Math.max(4, Math.floor(width / 80))))
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

    // --- GROUND FILL (actual cross-section) ---
    const groundArea = d3area<CrossSectionPoint>()
      .x(d => x(d.station))
      .y0(height)
      .y1(d => y(d.elevation));

    svg.append('path')
      .datum(cs)
      .attr('d', groundArea)
      .attr('fill', THEME.groundFill)
      .attr('stroke', 'none');

    // --- WATER SURFACE FILL ---
    const wc = waterColors(p.flowRegime);
    const wsel = p.usWsel; // Use upstream WSEL for the water surface

    // Build water polygon clipped to ground (same technique as cross-section-chart)
    const waterPath: { station: number; elevation: number }[] = [];
    for (let i = 0; i < cs.length; i++) {
      const curr = cs[i];
      const prev = i > 0 ? cs[i - 1] : null;
      if (prev) {
        if ((prev.elevation > wsel && curr.elevation <= wsel) || (prev.elevation <= wsel && curr.elevation > wsel)) {
          const t = (wsel - prev.elevation) / (curr.elevation - prev.elevation);
          waterPath.push({ station: prev.station + t * (curr.station - prev.station), elevation: wsel });
        }
      }
      if (curr.elevation <= wsel) {
        waterPath.push({ station: curr.station, elevation: curr.elevation });
      }
    }
    if (waterPath.length > 1) {
      const poly = [
        ...waterPath.map(pt => `${x(pt.station)},${y(wsel)}`),
        ...[...waterPath].reverse().map(pt => `${x(pt.station)},${y(pt.elevation)}`),
      ];
      svg.append('polygon')
        .attr('points', poly.join(' '))
        .attr('fill', wc.fill);
    }

    // --- GROUND LINE ---
    const groundLine = d3line<CrossSectionPoint>()
      .x(d => x(d.station))
      .y(d => y(d.elevation));

    svg.append('path')
      .datum(cs)
      .attr('d', groundLine)
      .attr('fill', 'none')
      .attr('stroke', THEME.ground)
      .attr('stroke-width', 2);

    // --- BRIDGE STRUCTURE ---
    const bridge = p.bridge;
    const deckX1 = x(bridge.stationStart);
    const deckX2 = x(bridge.stationEnd);

    // Deck rectangle
    svg.append('rect')
      .attr('x', deckX1)
      .attr('y', y(bridge.highChord))
      .attr('width', deckX2 - deckX1)
      .attr('height', y(bridge.lowChordLeft) - y(bridge.highChord))
      .attr('fill', THEME.bridge)
      .attr('fill-opacity', 0.15)
      .attr('stroke', THEME.bridge)
      .attr('stroke-width', 1.5)
      .attr('rx', 1);

    // Low chord line
    svg.append('line')
      .attr('x1', deckX1).attr('y1', y(bridge.lowChordLeft))
      .attr('x2', deckX2).attr('y2', y(bridge.lowChordRight))
      .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

    // High chord line (dashed)
    svg.append('line')
      .attr('x1', deckX1).attr('y1', y(bridge.highChord))
      .attr('x2', deckX2).attr('y2', y(bridge.highChord))
      .attr('stroke', THEME.bridge).attr('stroke-width', 1.5).attr('stroke-dasharray', '6 3');

    // Abutment walls
    const leftGround = interpGround(cs, bridge.stationStart);
    const rightGround = interpGround(cs, bridge.stationEnd);

    svg.append('line')
      .attr('x1', deckX1).attr('y1', y(bridge.highChord))
      .attr('x2', deckX1).attr('y2', y(leftGround))
      .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

    svg.append('line')
      .attr('x1', deckX2).attr('y1', y(bridge.highChord))
      .attr('x2', deckX2).attr('y2', y(rightGround))
      .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

    // Piers
    const span = bridge.stationEnd - bridge.stationStart;
    for (const pier of bridge.piers) {
      const pierX = x(pier.station - pier.width / 2);
      const pierW = x(pier.station + pier.width / 2) - pierX;
      const pierGround = interpGround(cs, pier.station);
      const t = span > 0 ? (pier.station - bridge.stationStart) / span : 0;
      const lowChordAtPier = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);

      svg.append('rect')
        .attr('x', pierX)
        .attr('y', y(lowChordAtPier))
        .attr('width', Math.max(pierW, 2))
        .attr('height', y(pierGround) - y(lowChordAtPier))
        .attr('fill', THEME.bridge)
        .attr('fill-opacity', 0.4)
        .attr('stroke', THEME.bridge)
        .attr('stroke-width', 1);
    }

    // Pressure flow indicator
    if (p.flowRegime === 'pressure' || p.flowRegime === 'overtopping') {
      svg.append('rect')
        .attr('x', deckX1)
        .attr('y', y(bridge.highChord))
        .attr('width', deckX2 - deckX1)
        .attr('height', y(bridge.lowChordLeft) - y(bridge.highChord))
        .attr('fill', 'none')
        .attr('stroke', wc.line)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2 2')
        .attr('opacity', 0.5);
    }

    // Overtopping indicator
    if (p.flowRegime === 'overtopping') {
      svg.append('text')
        .attr('x', (deckX1 + deckX2) / 2)
        .attr('y', y(bridge.highChord) - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', THEME.waterLineOvertopping)
        .attr('font-size', 11)
        .attr('font-weight', 600)
        .text('OVERTOPPING');
    }

    // --- WSEL LINE ---
    svg.append('line')
      .attr('x1', 0).attr('y1', y(wsel))
      .attr('x2', width).attr('y2', y(wsel))
      .attr('stroke', wc.line).attr('stroke-width', 1.5).attr('stroke-dasharray', '8 4');

    // --- GROUND DOTS ---
    svg.selectAll('.ground-dot')
      .data(cs)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.station))
      .attr('cy', d => y(d.elevation))
      .attr('r', 3)
      .attr('fill', THEME.groundDot)
      .attr('stroke', THEME.groundFill)
      .attr('stroke-width', 1.5);

    // --- LABELS ---
    // WSEL label
    svg.append('text')
      .attr('x', 4).attr('y', y(wsel) - 5)
      .attr('fill', wc.line).attr('font-size', 10).attr('font-weight', 600)
      .text(`WSEL ${wsel.toFixed(2)}`);

    // Head loss annotation near bridge
    const midBridgeX = (deckX1 + deckX2) / 2;
    svg.append('text')
      .attr('x', midBridgeX)
      .attr('y', y(bridge.highChord) - 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#a1a1aa')
      .attr('font-size', 10)
      .text(`Δh = ${p.totalHeadLoss.toFixed(3)}`);

    // --- LEGEND ---
    const items = [
      { label: 'Ground', color: THEME.ground, dashed: false },
      { label: 'Bridge', color: THEME.bridge, dashed: false },
      { label: 'WSEL', color: wc.line, dashed: true },
      { label: p.flowRegime.replace('-', ' ').toUpperCase(), color: wc.line, dashed: false },
    ];
    const legendG = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height + 54})`);

    const itemWidth = 90;
    const startX = -(items.length * itemWidth) / 2;
    items.forEach((item, i) => {
      const g = legendG.append('g').attr('transform', `translate(${startX + i * itemWidth}, 0)`);
      if (item.dashed) {
        g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 14).attr('y2', 0)
          .attr('stroke', item.color).attr('stroke-width', 2).attr('stroke-dasharray', '3 2');
      } else {
        g.append('rect').attr('x', 0).attr('y', -1.5).attr('width', 14).attr('height', 3)
          .attr('fill', item.color).attr('rx', 1);
      }
      g.append('text').attr('x', 18).attr('y', 0).attr('dy', '0.35em')
        .attr('fill', THEME.axis).attr('font-size', 10).text(item.label);
    });

    // Configure particle engine with actual terrain data
    const engine = engineRef.current;
    if (engine && canvas) {
      engine.attach(canvas);
      engine.configure(
        profile,
        {
          xScale: (sta: number) => x(sta) + margin.left,
          yScale: (elev: number) => y(elev) + margin.top,
        },
        particleCount,
      );
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
