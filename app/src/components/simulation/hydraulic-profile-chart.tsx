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
    const stations = [
      { sta: p.approach.stationStart, bed: p.approach.bedElevation },
      { sta: p.approach.stationEnd,   bed: p.approach.bedElevation },
      { sta: p.bridge.stationStart,   bed: p.bridge.bedElevation },
      { sta: p.bridge.stationEnd,     bed: p.bridge.bedElevation },
      { sta: p.exit.stationStart,     bed: p.exit.bedElevation },
      { sta: p.exit.stationEnd,       bed: p.exit.bedElevation },
    ];

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
    svg.append('line')
      .attr('x1', x(p.approach.stationStart)).attr('y1', y(p.usWsel))
      .attr('x2', x(p.approach.stationEnd)).attr('y2', y(p.usWsel))
      .attr('stroke', wc.line).attr('stroke-width', 2);

    svg.append('line')
      .attr('x1', x(p.exit.stationStart)).attr('y1', y(p.dsWsel))
      .attr('x2', x(p.exit.stationEnd)).attr('y2', y(p.dsWsel))
      .attr('stroke', wc.line).attr('stroke-width', 2);

    // Head loss indicator
    svg.append('line')
      .attr('x1', x(p.bridge.stationStart)).attr('y1', y(p.usWsel))
      .attr('x2', x(p.bridge.stationEnd)).attr('y2', y(p.dsWsel))
      .attr('stroke', wc.line).attr('stroke-width', 1.5).attr('stroke-dasharray', '6 4');

    // Bridge structure
    const deckX1 = x(p.bridge.stationStart);
    const deckX2 = x(p.bridge.stationEnd);

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

    // Pressure flow indicator
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

    // Overtopping indicator
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

    // Configure particle engine
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
