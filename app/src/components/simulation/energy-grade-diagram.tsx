'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line, area as d3area } from 'd3-shape';
import { select, type Selection } from 'd3-selection';
import type { HydraulicProfile } from '@/engine/simulation-profile';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';

const G = 32.174;

interface EnergyGradeDiagramProps {
  profile: HydraulicProfile;
}

interface Section {
  label: string;
  shortLabel: string;
  x: number;
  bed: number;
  wsel: number;
  velocity: number;
  velocityHead: number;
  egl: number;
  froude: number;
}

// Pastel / muted palette — no hard saturated colors
const C = {
  grid: 'oklch(0.22 0.01 230)',
  axis: 'oklch(0.55 0.01 260)',
  axisLight: 'oklch(0.65 0.01 260)',
  ground: '#a8998a',
  groundFill: 'oklch(0.20 0.02 60)',
  hgl: '#93c5fd',           // pastel blue
  hglFill: 'rgba(147,197,253,0.07)',
  egl: '#fdba74',           // pastel orange
  eglFill: 'rgba(253,186,116,0.06)',
  bridge: '#d4d4d8',        // zinc-300
  bridgeFill: 'oklch(0.28 0.01 230)',
  pier: '#a1a1aa',          // zinc-400
  vh: '#d8b4fe',            // pastel purple
  hl: '#86efac',            // pastel green
  water: 'rgba(147,197,253,0.10)',
  sectionLine: 'oklch(0.32 0.01 260)',
  label: 'oklch(0.72 0.01 260)',
  tableHeader: 'oklch(0.58 0.01 260)',
  flowArrow: '#93c5fd',
};

function drawDimLine(
  svg: Selection<SVGGElement, unknown, null, undefined>,
  x1: number, y1: number, x2: number, y2: number,
  label: string, color: string, side: 'left' | 'right' = 'right',
  fontSize = 11,
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.abs(y2 - y1);
  if (len < 4) return;

  svg.append('line')
    .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
    .attr('stroke', color).attr('stroke-width', 1.5);

  const tw = 5;
  svg.append('line').attr('x1', x1 - tw).attr('y1', y1).attr('x2', x1 + tw).attr('y2', y1)
    .attr('stroke', color).attr('stroke-width', 1.5);
  svg.append('line').attr('x1', x2 - tw).attr('y1', y2).attr('x2', x2 + tw).attr('y2', y2)
    .attr('stroke', color).attr('stroke-width', 1.5);

  const offset = side === 'right' ? 8 : -8;
  const anchor = side === 'right' ? 'start' : 'end';
  svg.append('text')
    .attr('x', mx + offset).attr('y', my).attr('dy', '0.35em')
    .attr('text-anchor', anchor)
    .attr('fill', color).attr('font-size', fontSize).attr('font-weight', 600).attr('font-family', 'monospace')
    .text(label);
}

function buildSections(profile: HydraulicProfile): Section[] {
  const p = profile;
  const contrLen = p.approach.stationEnd - p.approach.stationStart || 50;
  const bridgeLen = p.bridge.stationEnd - p.bridge.stationStart || 20;
  const expanLen = p.exit.stationEnd - p.exit.stationStart || 50;
  const totalLen = contrLen + bridgeLen + expanLen;
  const channelSlope = p.approach.depth > 0
    ? (p.usWsel - p.dsWsel) / totalLen * 0.3
    : 0;
  const bridgeBed = p.bridge.bedElevation;
  const bed4 = bridgeBed + channelSlope * contrLen;
  const bed3 = bridgeBed;
  const bed2 = bridgeBed;
  const bed1 = bridgeBed - channelSlope * expanLen;
  const approachVH = (p.approach.velocity ** 2) / (2 * G);
  const exitVH = (p.exit.velocity ** 2) / (2 * G);

  return [
    { label: 'Section 4', shortLabel: '4', x: 0,
      bed: bed4, wsel: p.usWsel, velocity: p.approach.velocity,
      velocityHead: approachVH, egl: p.usWsel + approachVH,
      froude: p.approach.velocity / Math.sqrt(G * Math.max(p.approach.depth, 0.01)) },
    { label: 'Section 3 (BU)', shortLabel: '3', x: contrLen,
      bed: bed3, wsel: p.usWsel, velocity: p.approach.velocity,
      velocityHead: approachVH, egl: p.usWsel + approachVH,
      froude: p.approach.velocity / Math.sqrt(G * Math.max(p.approach.depth, 0.01)) },
    { label: 'Section 2 (BD)', shortLabel: '2', x: contrLen + bridgeLen,
      bed: bed2, wsel: p.dsWsel, velocity: p.exit.velocity,
      velocityHead: exitVH, egl: p.dsWsel + exitVH,
      froude: p.exit.velocity / Math.sqrt(G * Math.max(p.exit.depth, 0.01)) },
    { label: 'Section 1', shortLabel: '1', x: totalLen,
      bed: bed1, wsel: p.dsWsel, velocity: p.exit.velocity,
      velocityHead: exitVH, egl: p.dsWsel + exitVH,
      froude: p.exit.velocity / Math.sqrt(G * Math.max(p.exit.depth, 0.01)) },
  ];
}

export function EnergyGradeDiagram({ profile }: EnergyGradeDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);
  const velUnit = unitLabel('velocity', us);
  const [compact, setCompact] = useState(false);

  const draw = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    select(container).select('svg').remove();

    const rect = container.getBoundingClientRect();
    const isCompact = rect.width < 580;
    setCompact(isCompact);

    // Compact: no inline table → smaller bottom margin
    const fs = isCompact ? 10 : 12;
    const fsMono = isCompact ? 9 : 11;
    const margin = isCompact
      ? { top: 14, right: 20, bottom: 38, left: 48 }
      : { top: 18, right: 36, bottom: 90, left: 62 };
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
    const sections = buildSections(p);
    const totalLen = sections[3].x;
    const contrLen = sections[1].x;
    const bridgeLen = sections[2].x - sections[1].x;

    // Scales
    const xPad = totalLen * 0.08;
    const allElev = [
      ...sections.map(s => s.bed), ...sections.map(s => s.egl),
      p.bridge.highChord, p.bridge.lowChordLeft,
    ];
    const yPad = (Math.max(...allElev) - Math.min(...allElev)) * 0.15 || 2;

    const x = scaleLinear().domain([-xPad, totalLen + xPad]).range([0, width]);
    const y = scaleLinear()
      .domain([Math.min(...allElev) - yPad, Math.max(...allElev) + yPad])
      .range([height, 0]);

    const tickCount = isCompact ? 4 : 6;

    // --- GRID ---
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).tickSize(-height).tickFormat(() => ''))
      .call(g => { g.selectAll('line').attr('stroke', C.grid); g.select('.domain').remove(); });
    svg.append('g')
      .call(axisLeft(y).tickSize(-width).tickFormat(() => ''))
      .call(g => { g.selectAll('line').attr('stroke', C.grid); g.select('.domain').remove(); });

    // --- AXES ---
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(tickCount))
      .call(g => { g.selectAll('text').attr('fill', C.axis).attr('font-size', fs); g.selectAll('line,path').attr('stroke', C.grid); });
    svg.append('g')
      .call(axisLeft(y).ticks(tickCount))
      .call(g => { g.selectAll('text').attr('fill', C.axis).attr('font-size', fs); g.selectAll('line,path').attr('stroke', C.grid); });

    svg.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', isCompact ? -34 : -48)
      .attr('text-anchor', 'middle').attr('fill', C.axis).attr('font-size', fs)
      .text(`Elevation (${lenUnit})`);

    if (!isCompact) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height + 32)
        .attr('text-anchor', 'middle').attr('fill', C.axis).attr('font-size', fs)
        .text(`Longitudinal Distance (${lenUnit})`);
    }

    // --- GROUND ---
    const gData = sections.map(s => ({ x: s.x, bed: s.bed }));
    svg.append('path').datum(gData)
      .attr('d', d3area<{ x: number; bed: number }>().x(d => x(d.x)).y0(height).y1(d => y(d.bed)))
      .attr('fill', C.groundFill);
    svg.append('path').datum(gData)
      .attr('d', d3line<{ x: number; bed: number }>().x(d => x(d.x)).y(d => y(d.bed)))
      .attr('fill', 'none').attr('stroke', C.ground).attr('stroke-width', 2);

    // --- WATER FILL ---
    svg.append('path').datum(sections)
      .attr('d', d3area<Section>().x(d => x(d.x)).y0(d => y(d.bed)).y1(d => y(d.wsel)))
      .attr('fill', C.water);

    // --- HGL ---
    svg.append('path').datum(sections)
      .attr('d', d3line<Section>().x(d => x(d.x)).y(d => y(d.wsel)))
      .attr('fill', 'none').attr('stroke', C.hgl).attr('stroke-width', isCompact ? 2 : 2.5);

    // --- EGL ---
    svg.append('path').datum(sections)
      .attr('d', d3line<Section>().x(d => x(d.x)).y(d => y(d.egl)))
      .attr('fill', 'none').attr('stroke', C.egl).attr('stroke-width', 2).attr('stroke-dasharray', '8 4');

    // --- EGL-HGL band ---
    svg.append('path').datum(sections)
      .attr('d', d3area<Section>().x(d => x(d.x)).y0(d => y(d.wsel)).y1(d => y(d.egl)))
      .attr('fill', C.eglFill);

    // --- BRIDGE (longitudinal profile) ---
    // X-axis = distance along flow. Pier stations are perpendicular to flow,
    // so individual piers don't appear at specific X positions. Instead we show:
    // 1. Deck superstructure (low chord to high chord)
    // 2. Abutment walls at each end (sections 3 & 2)
    // 3. Pier obstruction band — hatched zone showing flow constriction
    const bx1 = x(contrLen);
    const bx2 = x(contrLen + bridgeLen);
    const bMid = (bx1 + bx2) / 2;
    const bWidth = bx2 - bx1;

    // Abutment walls
    const abutW = Math.max(bWidth * 0.05, 3);
    const abutBot = y(p.bridge.bedElevation);
    svg.append('rect')
      .attr('x', bx1 - abutW).attr('y', y(p.bridge.highChord))
      .attr('width', abutW).attr('height', abutBot - y(p.bridge.highChord))
      .attr('fill', C.bridgeFill).attr('stroke', C.bridge).attr('stroke-width', 1);
    svg.append('rect')
      .attr('x', bx2).attr('y', y(p.bridge.highChord))
      .attr('width', abutW).attr('height', abutBot - y(p.bridge.highChord))
      .attr('fill', C.bridgeFill).attr('stroke', C.bridge).attr('stroke-width', 1);

    // Deck superstructure
    svg.append('rect')
      .attr('x', bx1 - abutW).attr('y', y(p.bridge.highChord))
      .attr('width', bWidth + abutW * 2)
      .attr('height', y(p.bridge.lowChordLeft) - y(p.bridge.highChord))
      .attr('fill', C.bridgeFill).attr('stroke', C.bridge).attr('stroke-width', 1.5);

    // Pier obstruction band — if piers exist, show a hatched zone between
    // low chord and bed to indicate flow constriction in the bridge reach
    if (p.bridge.piers.length > 0) {
      const pierTop = y(p.bridge.lowChordLeft);
      const pierBot = y(p.bridge.bedElevation);
      const pierH = pierBot - pierTop;

      // Create diagonal hatch pattern
      const defs = svg.append('defs');
      defs.append('pattern')
        .attr('id', 'pier-hatch')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 6).attr('height', 6)
        .append('path')
        .attr('d', 'M 0 6 L 6 0')
        .attr('stroke', C.pier).attr('stroke-width', 0.8).attr('stroke-opacity', 0.4);

      // Hatched obstruction zone (full bridge opening width)
      svg.append('rect')
        .attr('x', bx1).attr('y', pierTop)
        .attr('width', bWidth).attr('height', pierH)
        .attr('fill', 'url(#pier-hatch)')
        .attr('stroke', C.pier).attr('stroke-width', 0.5).attr('stroke-opacity', 0.3);

      // Label
      if (!isCompact) {
        svg.append('text')
          .attr('x', bMid).attr('y', pierTop + pierH / 2)
          .attr('dy', '0.35em').attr('text-anchor', 'middle')
          .attr('fill', C.pier).attr('font-size', 9).attr('fill-opacity', 0.6)
          .text(`${p.bridge.piers.length} pier${p.bridge.piers.length > 1 ? 's' : ''}`);
      }
    }

    if (!isCompact) {
      svg.append('text')
        .attr('x', bMid).attr('y', y(p.bridge.lowChordLeft) + 14)
        .attr('text-anchor', 'middle').attr('fill', C.bridge).attr('font-size', 10)
        .text(`Low Chord ${toDisplay(p.bridge.lowChordLeft, 'length', us).toFixed(2)} ${lenUnit}`);
    }

    // --- SECTION LINES ---
    sections.forEach((s) => {
      const sx = x(s.x);
      svg.append('line')
        .attr('x1', sx).attr('y1', 0).attr('x2', sx).attr('y2', height)
        .attr('stroke', C.sectionLine).attr('stroke-width', 1).attr('stroke-dasharray', '5 4');
      svg.append('text')
        .attr('x', sx).attr('y', -5)
        .attr('text-anchor', 'middle').attr('fill', C.label).attr('font-size', fs).attr('font-weight', 700)
        .text(s.shortLabel);
    });

    // --- VELOCITY HEAD BARS (desktop only — too cluttered on mobile) ---
    if (!isCompact) {
      [sections[0], sections[3]].forEach((s, i) => {
        const sx = x(s.x) + (i === 0 ? -18 : 18);
        const vh = toDisplay(s.velocityHead, 'length', us);
        if (vh > 0.001) {
          drawDimLine(svg, sx, y(s.wsel), sx, y(s.egl),
            `V²/2g = ${vh.toFixed(3)}`, C.vh, i === 0 ? 'left' : 'right');
        }
      });
    }

    // --- TOTAL HEAD LOSS ---
    const hlX = x(totalLen * 0.80);
    const egl4 = sections[0].egl;
    const egl1 = sections[3].egl;
    const hl = toDisplay(egl4 - egl1, 'length', us);
    if (Math.abs(egl4 - egl1) > 0.001) {
      drawDimLine(svg, hlX, y(egl4), hlX, y(egl1),
        `Δh = ${hl.toFixed(3)}`, C.hl, 'right', fsMono);
    }

    // --- FLOW DIRECTION ---
    const arrowY = y(Math.max(...sections.map(s => s.egl))) - 12;
    const arrowX1 = x(totalLen * 0.12);
    const arrowX2 = x(totalLen * 0.30);
    svg.append('line')
      .attr('x1', arrowX1).attr('y1', arrowY).attr('x2', arrowX2).attr('y2', arrowY)
      .attr('stroke', C.flowArrow).attr('stroke-width', 1.5);
    svg.append('polygon')
      .attr('points', `${arrowX2},${arrowY} ${arrowX2 - 7},${arrowY - 4} ${arrowX2 - 7},${arrowY + 4}`)
      .attr('fill', C.flowArrow);
    svg.append('text')
      .attr('x', (arrowX1 + arrowX2) / 2).attr('y', arrowY - 8)
      .attr('text-anchor', 'middle').attr('fill', C.flowArrow).attr('font-size', fsMono)
      .text('Flow');

    // --- SECTION DATA TABLE (desktop only) ---
    if (!isCompact) {
      const tableY = height + 46;
      const rowH = 15;
      const headers = ['WSEL', 'Velocity', 'Froude', 'EGL'];

      headers.forEach((h, ri) => {
        svg.append('text')
          .attr('x', -6).attr('y', tableY + ri * rowH)
          .attr('text-anchor', 'end').attr('fill', C.tableHeader).attr('font-size', 11)
          .text(h);
      });

      sections.forEach((s) => {
        const sx = x(s.x);
        svg.append('text')
          .attr('x', sx).attr('y', tableY - rowH)
          .attr('text-anchor', 'middle').attr('fill', C.label).attr('font-size', 11).attr('font-weight', 700)
          .text(s.label);

        const vals = [
          { text: `${toDisplay(s.wsel, 'length', us).toFixed(2)} ${lenUnit}`, color: C.hgl },
          { text: `${toDisplay(s.velocity, 'velocity', us).toFixed(2)} ${velUnit}`, color: C.axisLight },
          { text: isFinite(s.froude) ? s.froude.toFixed(3) : '—', color: C.axisLight },
          { text: `${toDisplay(s.egl, 'length', us).toFixed(2)} ${lenUnit}`, color: C.egl },
        ];

        vals.forEach((v, ri) => {
          svg.append('text')
            .attr('x', sx).attr('y', tableY + ri * rowH)
            .attr('text-anchor', 'middle')
            .attr('fill', v.color).attr('font-size', 11).attr('font-family', 'monospace')
            .text(v.text);
        });
      });
    }

    // --- LEGEND ---
    const legendItems = isCompact
      ? [
          { label: 'HGL', color: C.hgl, dash: false },
          { label: 'EGL', color: C.egl, dash: true },
        ]
      : [
          { label: 'HGL (Water Surface)', color: C.hgl, dash: false },
          { label: 'EGL (Energy Grade)', color: C.egl, dash: true },
          { label: 'V²/2g (Velocity Head)', color: C.vh, dash: true },
          { label: 'Δh (Head Loss)', color: C.hl, dash: false },
        ];

    const lgW = isCompact ? 80 : 165;
    const lg = svg.append('g').attr('transform', `translate(${width - 10}, 8)`);
    lg.append('rect')
      .attr('x', -lgW + 10).attr('y', -8)
      .attr('width', lgW).attr('height', legendItems.length * (isCompact ? 16 : 18) + 8)
      .attr('fill', 'oklch(0.16 0.01 230)').attr('fill-opacity', 0.9)
      .attr('rx', 4).attr('stroke', C.grid);

    legendItems.forEach((item, i) => {
      const gy = i * (isCompact ? 16 : 18);
      const lx = -lgW + 20;
      if (item.dash) {
        lg.append('line').attr('x1', lx).attr('y1', gy).attr('x2', lx + 14).attr('y2', gy)
          .attr('stroke', item.color).attr('stroke-width', 2.5).attr('stroke-dasharray', '4 3');
      } else {
        lg.append('line').attr('x1', lx).attr('y1', gy).attr('x2', lx + 14).attr('y2', gy)
          .attr('stroke', item.color).attr('stroke-width', 2.5);
      }
      lg.append('text').attr('x', lx + 18).attr('y', gy).attr('dy', '0.35em')
        .attr('fill', C.axisLight).attr('font-size', isCompact ? 9 : 11).text(item.label);
    });

  }, [profile, us, lenUnit, velUnit]);

  useEffect(() => {
    draw();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // Build sections for the HTML table (mobile)
  const sections = buildSections(profile);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full h-[300px] sm:h-[360px] lg:h-[420px]" />
      {/* Compact HTML table shown when SVG table is hidden */}
      {compact && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono tabular-nums border-collapse min-w-[320px]">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pr-3 py-1 font-medium"></th>
                {sections.map(s => (
                  <th key={s.shortLabel} className="px-2 py-1 font-semibold text-center">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-foreground">
              <tr>
                <td className="pr-3 py-0.5 text-[#93c5fd] font-medium">WSEL</td>
                {sections.map(s => (
                  <td key={s.shortLabel} className="px-2 py-0.5 text-center text-[#93c5fd]">
                    {toDisplay(s.wsel, 'length', us).toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-3 py-0.5 text-muted-foreground font-medium">Velocity</td>
                {sections.map(s => (
                  <td key={s.shortLabel} className="px-2 py-0.5 text-center">
                    {toDisplay(s.velocity, 'velocity', us).toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-3 py-0.5 text-muted-foreground font-medium">Froude</td>
                {sections.map(s => (
                  <td key={s.shortLabel} className="px-2 py-0.5 text-center">
                    {isFinite(s.froude) ? s.froude.toFixed(3) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-3 py-0.5 text-[#fdba74] font-medium">EGL</td>
                {sections.map(s => (
                  <td key={s.shortLabel} className="px-2 py-0.5 text-center text-[#fdba74]">
                    {toDisplay(s.egl, 'length', us).toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
