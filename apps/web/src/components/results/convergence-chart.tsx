// src/components/results/convergence-chart.tsx
'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import { max } from 'd3-array';
import type { IterationStep } from '@flowsuite/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@flowsuite/data';
import { Button } from '@flowsuite/ui';
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

    const pathEl = svg.append('path')
      .datum(log)
      .attr('d', errorLine)
      .attr('fill', 'none')
      .attr('stroke', THEME.line)
      .attr('stroke-width', 2)
      .node() as SVGPathElement | null;

    // Animate the line drawing using SVG native animate element
    if (pathEl) {
      const totalLength = pathEl.getTotalLength();
      const dur = `${(log.length * 120) / 1000}s`;
      pathEl.setAttribute('stroke-dasharray', `${totalLength} ${totalLength}`);
      pathEl.setAttribute('stroke-dashoffset', String(totalLength));

      const animEl = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animEl.setAttribute('attributeName', 'stroke-dashoffset');
      animEl.setAttribute('from', String(totalLength));
      animEl.setAttribute('to', '0');
      animEl.setAttribute('dur', dur);
      animEl.setAttribute('fill', 'freeze');
      pathEl.appendChild(animEl);
      animEl.beginElement();
    }

    // Animate points appearing using setTimeout + direct DOM manipulation
    log.forEach((step, i) => {
      const isLast = i === log.length - 1;
      const converged = step.error <= tolerance;
      const targetR = isLast ? 5 : 3;

      const circleEl = svg.append('circle')
        .attr('cx', x(step.iteration))
        .attr('cy', y(toDisplay(step.error, 'length', us)))
        .attr('r', 0)
        .attr('fill', isLast ? (converged ? THEME.converged : THEME.diverged) : THEME.point)
        .attr('stroke', '#1a1a2e')
        .attr('stroke-width', 1.5)
        .node() as SVGCircleElement | null;

      if (circleEl) {
        const animR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animR.setAttribute('attributeName', 'r');
        animR.setAttribute('from', '0');
        animR.setAttribute('to', String(targetR));
        animR.setAttribute('begin', `${(i * 120) / 1000}s`);
        animR.setAttribute('dur', '0.2s');
        animR.setAttribute('fill', 'freeze');
        circleEl.appendChild(animR);
        animR.beginElement();
      }

      if (isLast) {
        const badge = converged ? 'CONVERGED' : 'DIVERGED';
        const badgeColor = converged ? THEME.converged : THEME.diverged;

        const textEl = svg.append('text')
          .attr('x', x(step.iteration))
          .attr('y', y(toDisplay(step.error, 'length', us)) - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', badgeColor)
          .attr('font-size', 10)
          .attr('font-weight', 700)
          .attr('opacity', 0)
          .text(badge)
          .node() as SVGTextElement | null;

        if (textEl) {
          const animOp = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          animOp.setAttribute('attributeName', 'opacity');
          animOp.setAttribute('from', '0');
          animOp.setAttribute('to', '1');
          animOp.setAttribute('begin', `${(i * 120 + 200) / 1000}s`);
          animOp.setAttribute('dur', '0.3s');
          animOp.setAttribute('fill', 'freeze');
          textEl.appendChild(animOp);
          animOp.beginElement();
        }
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
