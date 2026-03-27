'use client';

import { useRef, useEffect, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line, area as d3area, curveCatmullRom } from 'd3-shape';
import { select, type Selection } from 'd3-selection';
import type { HydraulicProfile } from '@/engine/simulation-profile';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';

const G = 32.174; // ft/s²

interface EnergyGradeDiagramProps {
  profile: HydraulicProfile;
}

interface Section {
  label: string;
  x: number;        // longitudinal position (arbitrary units)
  bed: number;       // bed elevation
  wsel: number;      // water surface (HGL)
  velocity: number;  // ft/s
  velocityHead: number; // V²/2g
  egl: number;       // energy grade line = WSEL + velocity head
}

const THEME = {
  bg: 'oklch(0.17 0.01 230)',
  grid: 'oklch(0.24 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  ground: '#6b4e3d',
  groundFill: 'oklch(0.20 0.03 50)',
  hgl: '#3b82f6',
  hglFill: 'rgba(59, 130, 246, 0.08)',
  egl: '#f97316',
  eglFill: 'rgba(249, 115, 22, 0.06)',
  bridge: '#ef4444',
  velocityHead: '#a855f7',
  frictionLoss: '#10b981',
  forceArrow: '#60a5fa',
  pressureArrow: '#34d399',
  annotation: '#a1a1aa',
};

function drawArrow(
  svg: Selection<SVGGElement, unknown, null, undefined>,
  x1: number, y1: number, x2: number, y2: number,
  color: string, headSize: number = 6, strokeWidth: number = 2,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;

  // Shaft
  svg.append('line')
    .attr('x1', x1).attr('y1', y1)
    .attr('x2', x2 - ux * headSize).attr('y2', y2 - uy * headSize)
    .attr('stroke', color).attr('stroke-width', strokeWidth);

  // Arrowhead
  const tipX = x2;
  const tipY = y2;
  const baseX = x2 - ux * headSize;
  const baseY = y2 - uy * headSize;
  const perpX = -uy * headSize * 0.5;
  const perpY = ux * headSize * 0.5;

  svg.append('polygon')
    .attr('points', `${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`)
    .attr('fill', color);
}

export function EnergyGradeDiagram({ profile }: EnergyGradeDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);
  const velUnit = unitLabel('velocity', us);

  const draw = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    select(container).select('svg').remove();

    const rect = container.getBoundingClientRect();
    const margin = { top: 30, right: 40, bottom: 55, left: 65 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;

    const svg = select(container)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', rect.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const p = profile;

    // Build sections: approach, bridge upstream, bridge downstream, exit
    const approachVH = (p.approach.velocity ** 2) / (2 * G);
    const bridgeVH = (p.bridge.velocity ** 2) / (2 * G);
    const exitVH = (p.exit.velocity ** 2) / (2 * G);

    const sections: Section[] = [
      {
        label: 'Approach',
        x: 0,
        bed: p.approach.bedElevation,
        wsel: p.usWsel,
        velocity: p.approach.velocity,
        velocityHead: approachVH,
        egl: p.usWsel + approachVH,
      },
      {
        label: 'US Face',
        x: 35,
        bed: p.bridge.bedElevation,
        wsel: p.usWsel,
        velocity: p.approach.velocity,
        velocityHead: approachVH,
        egl: p.usWsel + approachVH,
      },
      {
        label: 'Bridge',
        x: 50,
        bed: p.bridge.bedElevation,
        wsel: Math.min(p.usWsel, p.bridge.lowChordLeft),
        velocity: p.bridge.velocity,
        velocityHead: bridgeVH,
        egl: Math.min(p.usWsel, p.bridge.lowChordLeft) + bridgeVH,
      },
      {
        label: 'DS Face',
        x: 65,
        bed: p.bridge.bedElevation,
        wsel: p.dsWsel,
        velocity: p.exit.velocity,
        velocityHead: exitVH,
        egl: p.dsWsel + exitVH,
      },
      {
        label: 'Exit',
        x: 100,
        bed: p.exit.bedElevation,
        wsel: p.dsWsel,
        velocity: p.exit.velocity,
        velocityHead: exitVH,
        egl: p.dsWsel + exitVH,
      },
    ];

    // Scales
    const xDomain = [-5, 105];
    const allElevs = [
      ...sections.map(s => s.bed),
      ...sections.map(s => s.egl),
      p.bridge.highChord,
    ];
    const yMin = Math.min(...allElevs) - 2;
    const yMax = Math.max(...allElevs) + 2;

    const x = scaleLinear().domain(xDomain).range([0, width]);
    const y = scaleLinear().domain([yMin, yMax]).range([height, 0]);

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
      .call(axisBottom(x).ticks(5).tickFormat((d) => {
        const v = d.valueOf();
        if (v <= 5) return 'Approach';
        if (v >= 40 && v <= 60) return 'Bridge';
        if (v >= 95) return 'Exit';
        return '';
      }))
      .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 10); g.selectAll('line,path').attr('stroke', THEME.grid); });

    svg.append('g')
      .call(axisLeft(y).ticks(Math.max(4, Math.floor(height / 50))))
      .call(g => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 10); g.selectAll('line,path').attr('stroke', THEME.grid); });

    // Y axis label
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -50)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 10)
      .text(`Elevation (${lenUnit})`);

    // --- GROUND FILL ---
    const groundData = sections.map(s => ({ x: s.x, bed: s.bed }));
    const groundArea = d3area<{ x: number; bed: number }>()
      .x(d => x(d.x)).y0(height).y1(d => y(d.bed));

    svg.append('path').datum(groundData).attr('d', groundArea)
      .attr('fill', THEME.groundFill);

    const groundLine = d3line<{ x: number; bed: number }>()
      .x(d => x(d.x)).y(d => y(d.bed));

    svg.append('path').datum(groundData).attr('d', groundLine)
      .attr('fill', 'none').attr('stroke', THEME.ground).attr('stroke-width', 2.5);

    // --- WATER FILL (between HGL and bed) ---
    const hglArea = d3area<Section>()
      .x(d => x(d.x)).y0(d => y(d.bed)).y1(d => y(d.wsel))
      .curve(curveCatmullRom);

    svg.append('path').datum(sections).attr('d', hglArea)
      .attr('fill', THEME.hglFill);

    // --- HGL LINE (Hydraulic Grade Line = water surface) ---
    const hglLine = d3line<Section>()
      .x(d => x(d.x)).y(d => y(d.wsel))
      .curve(curveCatmullRom);

    svg.append('path').datum(sections).attr('d', hglLine)
      .attr('fill', 'none').attr('stroke', THEME.hgl).attr('stroke-width', 2.5);

    // --- EGL LINE (Energy Grade Line) ---
    const eglLine = d3line<Section>()
      .x(d => x(d.x)).y(d => y(d.egl))
      .curve(curveCatmullRom);

    svg.append('path').datum(sections).attr('d', eglLine)
      .attr('fill', 'none').attr('stroke', THEME.egl).attr('stroke-width', 2)
      .attr('stroke-dasharray', '8 4');

    // --- EGL FILL (between EGL and HGL) ---
    const eglBand = d3area<Section>()
      .x(d => x(d.x)).y0(d => y(d.wsel)).y1(d => y(d.egl))
      .curve(curveCatmullRom);

    svg.append('path').datum(sections).attr('d', eglBand)
      .attr('fill', THEME.eglFill);

    // --- VELOCITY HEAD ANNOTATIONS ---
    // Show V²/2g at approach and bridge sections
    [sections[0], sections[2], sections[4]].forEach((s) => {
      const xPos = x(s.x);
      const yHgl = y(s.wsel);
      const yEgl = y(s.egl);

      // Vertical line connecting HGL to EGL
      svg.append('line')
        .attr('x1', xPos).attr('y1', yHgl)
        .attr('x2', xPos).attr('y2', yEgl)
        .attr('stroke', THEME.velocityHead).attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3 2');

      // Ticks at top and bottom
      svg.append('line')
        .attr('x1', xPos - 4).attr('y1', yHgl).attr('x2', xPos + 4).attr('y2', yHgl)
        .attr('stroke', THEME.velocityHead).attr('stroke-width', 1.5);
      svg.append('line')
        .attr('x1', xPos - 4).attr('y1', yEgl).attr('x2', xPos + 4).attr('y2', yEgl)
        .attr('stroke', THEME.velocityHead).attr('stroke-width', 1.5);

      // Label
      const vh = toDisplay(s.velocityHead, 'length', us);
      if (vh > 0.001) {
        svg.append('text')
          .attr('x', xPos + 6)
          .attr('y', (yHgl + yEgl) / 2)
          .attr('dy', '0.35em')
          .attr('fill', THEME.velocityHead).attr('font-size', 9).attr('font-weight', 600)
          .text(`V²/2g = ${vh.toFixed(3)} ${lenUnit}`);
      }
    });

    // --- HEAD LOSS ANNOTATION (between approach EGL and exit EGL) ---
    const hlX = x(82);
    const hlTop = y(sections[0].egl);
    const hlBot = y(sections[4].egl);

    svg.append('line')
      .attr('x1', hlX).attr('y1', hlTop)
      .attr('x2', hlX).attr('y2', hlBot)
      .attr('stroke', THEME.frictionLoss).attr('stroke-width', 2);

    svg.append('line')
      .attr('x1', hlX - 5).attr('y1', hlTop).attr('x2', hlX + 5).attr('y2', hlTop)
      .attr('stroke', THEME.frictionLoss).attr('stroke-width', 1.5);
    svg.append('line')
      .attr('x1', hlX - 5).attr('y1', hlBot).attr('x2', hlX + 5).attr('y2', hlBot)
      .attr('stroke', THEME.frictionLoss).attr('stroke-width', 1.5);

    const totalHL = toDisplay(p.totalHeadLoss, 'length', us);
    svg.append('text')
      .attr('x', hlX + 8).attr('y', (hlTop + hlBot) / 2)
      .attr('dy', '0.35em')
      .attr('fill', THEME.frictionLoss).attr('font-size', 9).attr('font-weight', 600)
      .text(`Δh = ${totalHL.toFixed(3)} ${lenUnit}`);

    // --- BRIDGE STRUCTURE ---
    const bx1 = x(40);
    const bx2 = x(60);

    svg.append('rect')
      .attr('x', bx1).attr('y', y(p.bridge.highChord))
      .attr('width', bx2 - bx1)
      .attr('height', y(p.bridge.lowChordLeft) - y(p.bridge.highChord))
      .attr('fill', THEME.bridge).attr('fill-opacity', 0.15)
      .attr('stroke', THEME.bridge).attr('stroke-width', 1.5).attr('rx', 1);

    // --- FORCE VECTORS ---
    // Hydrostatic pressure at approach (acts on the flow cross-section)
    const approachDepth = sections[0].wsel - sections[0].bed;
    const approachPressureScale = Math.min(approachDepth * 3, width * 0.12);

    // Upstream hydrostatic pressure — horizontal arrow pointing downstream
    const pressureY = y((sections[0].wsel + sections[0].bed) / 2);
    drawArrow(svg, x(5), pressureY, x(5) + approachPressureScale, pressureY, THEME.pressureArrow, 7, 2.5);
    svg.append('text')
      .attr('x', x(5) + approachPressureScale + 4).attr('y', pressureY - 6)
      .attr('fill', THEME.pressureArrow).attr('font-size', 8)
      .text('P₁ (hydrostatic)');

    // Downstream hydrostatic pressure — horizontal arrow pointing upstream
    const exitDepth = sections[4].wsel - sections[4].bed;
    const exitPressureScale = Math.min(exitDepth * 3, width * 0.12);
    const exitPressureY = y((sections[4].wsel + sections[4].bed) / 2);
    drawArrow(svg, x(95), exitPressureY, x(95) - exitPressureScale, exitPressureY, THEME.pressureArrow, 7, 2.5);
    svg.append('text')
      .attr('x', x(95) - exitPressureScale - 4).attr('y', exitPressureY - 6)
      .attr('text-anchor', 'end')
      .attr('fill', THEME.pressureArrow).attr('font-size', 8)
      .text('P₂ (hydrostatic)');

    // Flow velocity arrows — downstream direction
    const velArrowLen = Math.min(sections[0].velocity * 2.5, width * 0.1);
    [sections[0], sections[2], sections[4]].forEach((s) => {
      const arrowY = y(s.wsel) - 12;
      const startX = x(s.x) - velArrowLen / 2;
      drawArrow(svg, startX, arrowY, startX + velArrowLen, arrowY, THEME.forceArrow, 6, 2);
    });

    // Velocity labels
    [sections[0], sections[2], sections[4]].forEach((s) => {
      const v = toDisplay(s.velocity, 'velocity', us);
      svg.append('text')
        .attr('x', x(s.x)).attr('y', y(s.wsel) - 22)
        .attr('text-anchor', 'middle')
        .attr('fill', THEME.forceArrow).attr('font-size', 8).attr('font-weight', 600)
        .text(`V = ${v.toFixed(2)} ${velUnit}`);
    });

    // Friction force — opposing arrow along bed between approach and exit
    const frictionY = y(Math.min(sections[0].bed, sections[4].bed)) + 14;
    drawArrow(svg, x(70), frictionY, x(30), frictionY, '#ef4444', 6, 1.5);
    svg.append('text')
      .attr('x', x(50)).attr('y', frictionY + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ef4444').attr('font-size', 8)
      .text('Friction (opposing flow)');

    // --- LEGEND ---
    const legendData = [
      { label: 'HGL (Water Surface)', color: THEME.hgl, dashed: false },
      { label: 'EGL (Energy Grade)', color: THEME.egl, dashed: true },
      { label: 'V²/2g (Velocity Head)', color: THEME.velocityHead, dashed: true },
      { label: 'Head Loss', color: THEME.frictionLoss, dashed: false },
      { label: 'Velocity', color: THEME.forceArrow, dashed: false },
      { label: 'Pressure', color: THEME.pressureArrow, dashed: false },
    ];

    const legendG = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height + 38})`);

    const itemW = width / legendData.length;
    const startLX = -(legendData.length * itemW) / 2;

    legendData.forEach((item, i) => {
      const g = legendG.append('g').attr('transform', `translate(${startLX + i * itemW}, 0)`);
      if (item.dashed) {
        g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 14).attr('y2', 0)
          .attr('stroke', item.color).attr('stroke-width', 2).attr('stroke-dasharray', '4 2');
      } else {
        g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 14).attr('y2', 0)
          .attr('stroke', item.color).attr('stroke-width', 2);
      }
      g.append('text').attr('x', 18).attr('y', 0).attr('dy', '0.35em')
        .attr('fill', THEME.axis).attr('font-size', 9).text(item.label);
    });

    // --- TITLE ---
    svg.append('text')
      .attr('x', width / 2).attr('y', -14)
      .attr('text-anchor', 'middle')
      .attr('fill', THEME.axis).attr('font-size', 11).attr('font-weight', 600)
      .text('Energy Grade Line & Force Diagram');

  }, [profile, us, lenUnit, velUnit]);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: 320 }} />
  );
}
