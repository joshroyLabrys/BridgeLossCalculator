'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line, area as d3area } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flowsuite/ui';
import type { DesignStormResults, StormRunResult } from '@flowsuite/engine/hydrology/types';

const THEME = {
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  primary: '#3b82f6',
  ensemble: 'oklch(0.55 0.10 230)',
  band: '#3b82f6',
};

function useD3Chart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderChart: (svg: any, width: number, height: number) => void,
  deps: unknown[],
) {
  const draw = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    select(el).select('svg').remove();
    const rect = el.getBoundingClientRect();
    const margin = { top: 16, right: 24, bottom: 68, left: 56 };
    const w = rect.width - margin.left - margin.right;
    const h = rect.height - margin.top - margin.bottom;
    if (w <= 0 || h <= 0) return;
    const svg = select(el)
      .append('svg')
      .attr('width', rect.width)
      .attr('height', rect.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    renderChart(svg, w, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    draw();
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(el);
    return () => obs.disconnect();
  }, [draw]);
}

interface HydrographChartProps {
  results: DesignStormResults;
}

export function HydrographChart({ results }: HydrographChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const aeps = results.summary.map((s) => s.aep);
  const [selectedAep, setSelectedAep] = useState(aeps[0] ?? '');

  // Get data for selected AEP at critical duration
  const summaryItem = results.summary.find((s) => s.aep === selectedAep);
  const criticalDur = summaryItem?.criticalDurationMin ?? 0;

  // Get all ensemble runs for this AEP + critical duration
  const ensembleRuns: StormRunResult[] = results.runs.filter(
    (r) => r.aep === selectedAep && r.durationMin === criticalDur,
  );

  // Compute min/max envelope and median hydrograph
  const medianHydrograph = summaryItem?.medianHydrograph ?? [];

  useD3Chart(
    chartRef,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svg: any, width: number, height: number) => {
      if (ensembleRuns.length === 0 || medianHydrograph.length === 0) return;

      // Determine axis ranges
      const allTimes = medianHydrograph.map((p) => p.time);
      const allQ = ensembleRuns.flatMap((r) => r.hydrograph.map((p) => p.q));
      const maxTime = max(allTimes) ?? 1;
      const maxQ = max(allQ) ?? 1;

      const x = scaleLinear()
        .domain([0, maxTime * 1.05])
        .range([0, width]);
      const y = scaleLinear()
        .domain([0, maxQ * 1.15])
        .range([height, 0]);

      // Grid + axes
      svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(
          axisBottom(x)
            .tickSize(-height)
            .tickFormat(() => ''),
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => {
          g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3');
          g.select('.domain').remove();
        });
      svg
        .append('g')
        .call(
          axisLeft(y)
            .tickSize(-width)
            .tickFormat(() => ''),
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => {
          g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3');
          g.select('.domain').remove();
        });

      svg
        .append('g')
        .attr('transform', `translate(0,${height})`)
        .call(axisBottom(x).ticks(Math.max(4, Math.floor(width / 80))))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => {
          g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11);
          g.selectAll('line,path').attr('stroke', THEME.grid);
        });
      svg
        .append('g')
        .call(axisLeft(y).ticks(Math.max(4, Math.floor(height / 50))))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .call((g: any) => {
          g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11);
          g.selectAll('line,path').attr('stroke', THEME.grid);
        });

      // Axis labels
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
        .attr('text-anchor', 'middle')
        .attr('fill', THEME.axis)
        .attr('font-size', 11)
        .text('Time (hours)');
      svg
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -42)
        .attr('text-anchor', 'middle')
        .attr('fill', THEME.axis)
        .attr('font-size', 11)
        .text('Discharge (m\u00B3/s)');

      // Build min/max envelope from all ensemble runs
      // Align by time index (all should share same timestep for same duration)
      const maxLen = Math.max(...ensembleRuns.map((r) => r.hydrograph.length));
      const envelopeData: { time: number; minQ: number; maxQ: number }[] = [];
      for (let i = 0; i < maxLen; i++) {
        const qs = ensembleRuns.map((r) => r.hydrograph[i]?.q ?? 0);
        const time = ensembleRuns[0]?.hydrograph[i]?.time ?? 0;
        envelopeData.push({
          time,
          minQ: min(qs) ?? 0,
          maxQ: max(qs) ?? 0,
        });
      }

      // Shaded min/max band
      const bandGen = d3area<(typeof envelopeData)[0]>()
        .x((d) => x(d.time))
        .y0((d) => y(d.minQ))
        .y1((d) => y(d.maxQ));
      svg
        .append('path')
        .datum(envelopeData)
        .attr('d', bandGen)
        .attr('fill', THEME.band)
        .attr('fill-opacity', 0.1);

      // Ensemble lines (thin, muted)
      const lineGen = d3line<{ time: number; q: number }>()
        .x((d) => x(d.time))
        .y((d) => y(d.q));

      ensembleRuns.forEach((run) => {
        svg
          .append('path')
          .datum(run.hydrograph)
          .attr('d', lineGen)
          .attr('fill', 'none')
          .attr('stroke', THEME.ensemble)
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.5);
      });

      // Median hydrograph (bold)
      svg
        .append('path')
        .datum(medianHydrograph)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', THEME.primary)
        .attr('stroke-width', 2.5);

      // Legend
      const legendG = svg.append('g').attr('transform', `translate(${width / 2}, ${height + 56})`);
      const items = [
        { label: 'Median', color: THEME.primary, width: 2.5, opacity: 1 },
        { label: 'Ensemble', color: THEME.ensemble, width: 1, opacity: 0.5 },
        { label: 'Min/Max', color: THEME.band, width: 0, opacity: 0.1 },
      ];
      const itemWidth = 85;
      const startX = -(items.length * itemWidth) / 2;
      items.forEach((item, i) => {
        const g = legendG.append('g').attr('transform', `translate(${startX + i * itemWidth}, 0)`);
        if (item.width > 0) {
          g.append('rect')
            .attr('x', 0)
            .attr('y', -1.5)
            .attr('width', 14)
            .attr('height', 3)
            .attr('fill', item.color)
            .attr('fill-opacity', item.opacity)
            .attr('rx', 1);
        } else {
          g.append('rect')
            .attr('x', 0)
            .attr('y', -4)
            .attr('width', 14)
            .attr('height', 8)
            .attr('fill', item.color)
            .attr('fill-opacity', 0.15)
            .attr('rx', 2);
        }
        g.append('text')
          .attr('x', 18)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('fill', THEME.axis)
          .attr('font-size', 10)
          .text(item.label);
      });
    },
    [ensembleRuns, medianHydrograph, selectedAep],
  );

  if (results.summary.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Ensemble Hydrograph</CardTitle>
            <CardDescription>
              {criticalDur >= 60 ? `${criticalDur / 60}h` : `${criticalDur}m`} critical duration
              {summaryItem
                ? ` — median peak ${summaryItem.medianPeakQ.toFixed(1)} m\u00B3/s`
                : ''}
            </CardDescription>
          </div>
          <Select value={selectedAep} onValueChange={(val) => { if (val) setSelectedAep(val); }}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aeps.map((aep) => (
                <SelectItem key={aep} value={aep}>
                  {aep} AEP
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="h-[280px] sm:h-[340px] w-full" />
      </CardContent>
    </Card>
  );
}
