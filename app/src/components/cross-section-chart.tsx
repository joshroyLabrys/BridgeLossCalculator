'use client';

import { useRef, useEffect, useCallback } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { area as d3area, line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import { CrossSectionPoint, BridgeGeometry } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { unitLabel } from '@/lib/units';

interface CrossSectionChartProps {
  crossSection: CrossSectionPoint[];
  wsel?: number;
  bridge?: BridgeGeometry;
  /** Per-method WSEL lines to overlay. Key = method name, value = WSEL elevation. */
  methodWsels?: Record<string, number>;
}

const METHOD_COLORS: Record<string, string> = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
};

const THEME = {
  ground: '#71717a',
  groundFill: 'oklch(0.22 0.02 230)',
  groundDot: '#a1a1aa',
  bridge: '#ef4444',
  water: '#3b82f6',
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  accent: 'oklch(0.55 0.12 230)',
  cardBg: 'oklch(0.17 0.01 230)',
  border: 'oklch(0.26 0.02 230)',
};

function interpGround(crossSection: CrossSectionPoint[], sta: number): number {
  for (let i = 0; i < crossSection.length - 1; i++) {
    if (crossSection[i].station <= sta && crossSection[i + 1].station >= sta) {
      const t = (sta - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
      return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
    }
  }
  return crossSection[crossSection.length - 1]?.elevation ?? 0;
}

export function CrossSectionChart({ crossSection, wsel, bridge, methodWsels }: CrossSectionChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  const draw = useCallback(() => {
    const container = containerRef.current;
    if (!container || crossSection.length < 2) return;

    // Clear previous
    select(container).select('svg').remove();

    const rect = container.getBoundingClientRect();
    const margin = { top: 16, right: 24, bottom: 68, left: 56 };
    const width = rect.width - margin.left - margin.right;
    const height = rect.height - margin.top - margin.bottom;
    if (width <= 0 || height <= 0) return;

    const svg = select(container)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', rect.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const allStations = crossSection.map(d => d.station);
    const staPad = (max(allStations)! - min(allStations)!) * 0.03 || 10;
    const allElevs = crossSection.map(d => d.elevation);
    if (bridge) allElevs.push(bridge.highChord, bridge.lowChordLeft, bridge.lowChordRight);
    if (wsel !== undefined) allElevs.push(wsel);
    if (methodWsels) allElevs.push(...Object.values(methodWsels));
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
      .attr('x', width / 2).attr('y', height + 40)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11)
      .text(`Station (${lenUnit})`);

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -42)
      .attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11)
      .text(`Elevation (${lenUnit})`);

    // --- GROUND FILL ---
    const groundArea = d3area<CrossSectionPoint>()
      .x(d => x(d.station))
      .y0(height)
      .y1(d => y(d.elevation));

    svg.append('path')
      .datum(crossSection)
      .attr('d', groundArea)
      .attr('fill', THEME.groundFill)
      .attr('stroke', 'none');

    // --- WATER SURFACE FILL ---
    if (wsel !== undefined) {
      const waterPath: { station: number; elevation: number }[] = [];
      for (let i = 0; i < crossSection.length; i++) {
        const curr = crossSection[i];
        const prev = i > 0 ? crossSection[i - 1] : null;
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
          ...waterPath.map(p => `${x(p.station)},${y(wsel)}`),
          ...[...waterPath].reverse().map(p => `${x(p.station)},${y(p.elevation)}`),
        ];
        svg.append('polygon')
          .attr('points', poly.join(' '))
          .attr('fill', THEME.water)
          .attr('fill-opacity', 0.08);
      }
    }

    // --- GROUND LINE ---
    const groundLine = d3line<CrossSectionPoint>()
      .x(d => x(d.station))
      .y(d => y(d.elevation));

    svg.append('path')
      .datum(crossSection)
      .attr('d', groundLine)
      .attr('fill', 'none')
      .attr('stroke', THEME.ground)
      .attr('stroke-width', 2);

    // --- BRIDGE ---
    if (bridge) {
      const deckX1 = x(bridge.leftAbutmentStation);
      const deckX2 = x(bridge.rightAbutmentStation);
      const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;

      // Bridge deck fill
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
      const leftGround = interpGround(crossSection, bridge.leftAbutmentStation);
      const rightGround = interpGround(crossSection, bridge.rightAbutmentStation);

      svg.append('line')
        .attr('x1', deckX1).attr('y1', y(bridge.highChord))
        .attr('x2', deckX1).attr('y2', y(leftGround))
        .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

      svg.append('line')
        .attr('x1', deckX2).attr('y1', y(bridge.highChord))
        .attr('x2', deckX2).attr('y2', y(rightGround))
        .attr('stroke', THEME.bridge).attr('stroke-width', 2.5);

      // Piers
      bridge.piers.forEach(pier => {
        const pierX = x(pier.station - pier.width / 2);
        const pierW = x(pier.station + pier.width / 2) - pierX;
        const pierGround = interpGround(crossSection, pier.station);
        const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
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
      });
    }

    // --- DS WSEL LINE ---
    if (wsel !== undefined) {
      svg.append('line')
        .attr('x1', 0).attr('y1', y(wsel))
        .attr('x2', width).attr('y2', y(wsel))
        .attr('stroke', THEME.water).attr('stroke-width', 1.5).attr('stroke-dasharray', '8 4');
    }

    // --- METHOD WSEL LINES ---
    if (methodWsels) {
      const leftBound = bridge ? x(bridge.leftAbutmentStation) : width;
      Object.entries(methodWsels).forEach(([method, elev]) => {
        svg.append('line')
          .attr('x1', 0).attr('y1', y(elev))
          .attr('x2', leftBound).attr('y2', y(elev))
          .attr('stroke', METHOD_COLORS[method] ?? '#888')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4 3');
      });
    }

    // --- GROUND DOTS ---
    const dots = svg.selectAll('.ground-dot')
      .data(crossSection)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.station))
      .attr('cy', d => y(d.elevation))
      .attr('r', 3.5)
      .attr('fill', THEME.groundDot)
      .attr('stroke', THEME.cardBg)
      .attr('stroke-width', 1.5);

    // --- CROSSHAIR + TOOLTIP ---
    const crosshair = svg.append('line')
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', THEME.accent).attr('stroke-width', 0.5).attr('stroke-dasharray', '3 3')
      .attr('pointer-events', 'none')
      .style('opacity', 0);

    const tooltip = tooltipRef.current;

    svg.append('rect')
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', function (event: MouseEvent) {
        const [mx] = [event.offsetX - margin.left];
        if (mx < 0 || mx > width) return;
        const sta = x.invert(mx);
        const elev = interpGround(crossSection, sta);

        crosshair.attr('x1', mx).attr('x2', mx).style('opacity', 1);

        // Highlight nearest dot
        dots.attr('r', d => Math.abs(x(d.station) - mx) < 15 ? 5.5 : 3.5)
          .attr('fill', d => Math.abs(x(d.station) - mx) < 15 ? THEME.accent : THEME.groundDot);

        // Build tooltip
        if (tooltip) {
          let html = `<div class="label">Station</div><div class="value">${sta.toFixed(1)} ${lenUnit}</div>`;
          html += `<div class="label">Ground</div><div class="value">${elev.toFixed(2)} ${lenUnit}</div>`;

          if (bridge && sta >= bridge.leftAbutmentStation && sta <= bridge.rightAbutmentStation) {
            const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
            const t = span > 0 ? (sta - bridge.leftAbutmentStation) / span : 0;
            const lc = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
            html += `<div class="label">Low Chord</div><div class="value">${lc.toFixed(2)} ${lenUnit}</div>`;
            html += `<div class="label">High Chord</div><div class="value">${bridge.highChord.toFixed(2)} ${lenUnit}</div>`;

            // Check pier
            bridge.piers.forEach(pier => {
              if (sta >= pier.station - pier.width / 2 && sta <= pier.station + pier.width / 2) {
                html += `<div class="label pier">Pier</div><div class="value">${pier.width} ${lenUnit} wide</div>`;
              }
            });
          }

          tooltip.innerHTML = html;
          tooltip.style.opacity = '1';

          // Position tooltip
          const containerRect = container.getBoundingClientRect();
          const tx = event.clientX - containerRect.left + 16;
          const ty = event.clientY - containerRect.top - 12;
          tooltip.style.left = `${Math.min(tx, rect.width - 160)}px`;
          tooltip.style.top = `${Math.max(ty, 0)}px`;
        }
      })
      .on('mouseleave', function () {
        crosshair.style('opacity', 0);
        dots.attr('r', 3.5).attr('fill', THEME.groundDot);
        if (tooltip) tooltip.style.opacity = '0';
      });

    // --- LEGEND (rendered in SVG below axis labels) ---
    const items: { label: string; color: string; dashed: boolean }[] = [
      { label: 'Ground', color: THEME.ground, dashed: false },
    ];
    if (bridge) items.push({ label: 'Bridge', color: THEME.bridge, dashed: false });
    if (wsel !== undefined) items.push({ label: 'DS WSEL', color: THEME.water, dashed: true });
    if (methodWsels) {
      Object.keys(methodWsels).forEach(m => {
        items.push({ label: m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1), color: METHOD_COLORS[m] ?? '#888', dashed: true });
      });
    }

    const legendG = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height + 56})`);

    const itemWidth = 80;
    const totalWidth = items.length * itemWidth;
    const startX = -totalWidth / 2;

    items.forEach((item, i) => {
      const g = legendG.append('g')
        .attr('transform', `translate(${startX + i * itemWidth}, 0)`);

      if (item.dashed) {
        g.append('line')
          .attr('x1', 0).attr('y1', 0).attr('x2', 14).attr('y2', 0)
          .attr('stroke', item.color).attr('stroke-width', 2).attr('stroke-dasharray', '3 2');
      } else {
        g.append('rect')
          .attr('x', 0).attr('y', -1.5).attr('width', 14).attr('height', 3)
          .attr('fill', item.color).attr('rx', 1);
      }

      g.append('text')
        .attr('x', 18).attr('y', 0).attr('dy', '0.35em')
        .attr('fill', THEME.axis).attr('font-size', 10)
        .text(item.label);
    });
  }, [crossSection, wsel, bridge, methodWsels, lenUnit]);

  useEffect(() => {
    draw();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  if (crossSection.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Enter at least 2 points to see preview
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" ref={containerRef} data-chart-id="cross-section">
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none opacity-0 transition-opacity duration-150 bg-card border border-border rounded-lg px-2.5 py-2 text-xs font-mono z-50 [&_.label]:text-muted-foreground [&_.label]:text-[10px] [&_.label]:uppercase [&_.label]:tracking-wide [&_.label]:mt-1 [&_.label]:first:mt-0 [&_.value]:text-foreground [&_.value]:font-semibold [&_.pier]:text-red-400"
      />
    </div>
  );
}
