'use client';

import { useRef, useEffect, useCallback } from 'react';
import type * as d3 from 'd3-scale';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line, area as d3area } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { unitLabel, toDisplay } from '@/lib/units';
import { CalculationResults } from '@/engine/types';
import { Download } from 'lucide-react';
import { ReactNode } from 'react';

const METHOD_COLORS: Record<string, string> = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
};

const METHOD_NAMES: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

const THEME = {
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  hecras: '#ef4444',
};

interface ChartData {
  Q: number;
  [key: string]: number | undefined;
}

function buildData(
  flowProfiles: { discharge: number }[],
  results: CalculationResults,
  sensitivityResults: { low: CalculationResults; high: CalculationResults } | null
): ChartData[] {
  return flowProfiles.map((p, i) => {
    const row: ChartData = { Q: p.discharge };
    for (const m of METHODS) {
      const r = results[m]?.[i];
      if (r && !r.error) {
        row[`${m}_afflux`] = r.totalHeadLoss;
        row[`${m}_wsel`] = r.upstreamWsel;
      }
      if (sensitivityResults) {
        const lo = sensitivityResults.low[m]?.[i];
        const hi = sensitivityResults.high[m]?.[i];
        if (lo && !lo.error) { row[`${m}_afflux_lo`] = lo.totalHeadLoss; row[`${m}_wsel_lo`] = lo.upstreamWsel; }
        if (hi && !hi.error) { row[`${m}_afflux_hi`] = hi.totalHeadLoss; row[`${m}_wsel_hi`] = hi.upstreamWsel; }
      }
    }
    return row;
  });
}

function drawAxesAndGrid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svg: any,
  x: d3.ScaleLinear<number, number>,
  y: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
  xLabel: string,
  yLabel: string
) {
  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(axisBottom(x).tickSize(-height).tickFormat(() => ''))
    .call((g: any) => { g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'); g.select('.domain').remove(); });
  svg.append('g')
    .call(axisLeft(y).tickSize(-width).tickFormat(() => ''))
    .call((g: any) => { g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'); g.select('.domain').remove(); });

  svg.append('g').attr('transform', `translate(0,${height})`)
    .call(axisBottom(x).ticks(Math.max(4, Math.floor(width / 80))))
    .call((g: any) => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });
  svg.append('g')
    .call(axisLeft(y).ticks(Math.max(4, Math.floor(height / 50))))
    .call((g: any) => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

  svg.append('text').attr('x', width / 2).attr('y', height + 40).attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11).text(xLabel);
  svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -42).attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11).text(yLabel);
}

function drawLegend(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svg: any,
  items: { label: string; color: string }[],
  width: number,
  height: number
) {
  const legendG = svg.append('g').attr('transform', `translate(${width / 2}, ${height + 56})`);
  const itemWidth = 80;
  const startX = -(items.length * itemWidth) / 2;
  items.forEach((item, i) => {
    const g = legendG.append('g').attr('transform', `translate(${startX + i * itemWidth}, 0)`);
    g.append('rect').attr('x', 0).attr('y', -1.5).attr('width', 14).attr('height', 3).attr('fill', item.color).attr('rx', 1);
    g.append('text').attr('x', 18).attr('y', 0).attr('dy', '0.35em').attr('fill', THEME.axis).attr('font-size', 10).text(item.label);
  });
}

function useD3Chart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  renderChart: (svg: any, width: number, height: number) => void,
  deps: unknown[]
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
    const svg = select(el).append('svg').attr('width', rect.width).attr('height', rect.height)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`);
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

export function AffluxCharts({ callout }: { callout?: ReactNode } = {}) {
  const results = useProjectStore((s) => s.results);
  const sensitivityResults = useProjectStore((s) => s.sensitivityResults);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const us = useProjectStore((s) => s.unitSystem);
  const qUnit = unitLabel('discharge', us);
  const lenUnit = unitLabel('length', us);

  const affluxRef = useRef<HTMLDivElement>(null);
  const wselRef = useRef<HTMLDivElement>(null);

  if (!results) return null;

  const data = buildData(flowProfiles, results, sensitivityResults);

  function exportCsv() {
    if (!results) return;
    const headers = ['Q', 'ARI', ...METHODS.flatMap(m => {
      const name = METHOD_NAMES[m];
      const cols = [`${name} Afflux`, `${name} US WSEL`];
      if (sensitivityResults) cols.push(`${name} Afflux Lo`, `${name} Afflux Hi`);
      return cols;
    })];
    const rows = flowProfiles.map((p, i) => {
      const vals: (string | number)[] = [p.discharge, p.ari];
      for (const m of METHODS) {
        const r = results[m]?.[i];
        vals.push(r && !r.error ? r.totalHeadLoss.toFixed(4) : '');
        vals.push(r && !r.error ? r.upstreamWsel.toFixed(4) : '');
        if (sensitivityResults) {
          const lo = sensitivityResults.low[m]?.[i];
          const hi = sensitivityResults.high[m]?.[i];
          vals.push(lo && !lo.error ? lo.totalHeadLoss.toFixed(4) : '');
          vals.push(hi && !hi.error ? hi.totalHeadLoss.toFixed(4) : '');
        }
      }
      return vals.join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'afflux-rating-curve.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Afflux chart renderer
  useD3Chart(affluxRef, (svg, width, height) => {
    const allQ = data.map(d => d.Q);
    const allAfflux = data.flatMap(d => METHODS.map(m => d[`${m}_afflux`]).filter((v): v is number => v !== undefined));
    if (allAfflux.length === 0) return;

    const x = scaleLinear().domain([min(allQ)! * 0.95, max(allQ)! * 1.05]).range([0, width]);
    const y = scaleLinear().domain([0, max(allAfflux)! * 1.2]).range([height, 0]);
    drawAxesAndGrid(svg, x, y, width, height, `Discharge (${qUnit})`, `Afflux (${lenUnit})`);

    if (sensitivityResults) {
      METHODS.forEach(m => {
        const band = data.filter(d => d[`${m}_afflux_lo`] !== undefined && d[`${m}_afflux_hi`] !== undefined);
        if (band.length < 2) return;
        const area = d3area<ChartData>().x(d => x(d.Q)).y0(d => y(d[`${m}_afflux_lo`]!)).y1(d => y(d[`${m}_afflux_hi`]!));
        svg.append('path').datum(band).attr('d', area).attr('fill', METHOD_COLORS[m]).attr('fill-opacity', 0.1);
      });
    }

    METHODS.forEach(m => {
      const pts = data.filter(d => d[`${m}_afflux`] !== undefined);
      if (pts.length < 1) return;
      const line = d3line<ChartData>().x(d => x(d.Q)).y(d => y(d[`${m}_afflux`]!));
      svg.append('path').datum(pts).attr('d', line).attr('fill', 'none').attr('stroke', METHOD_COLORS[m]).attr('stroke-width', 2);
      pts.forEach(d => svg.append('circle').attr('cx', x(d.Q)).attr('cy', y(d[`${m}_afflux`]!)).attr('r', 4).attr('fill', METHOD_COLORS[m]));
    });

    comparison.forEach(c => {
      if (c.headLoss !== null) {
        const p = flowProfiles.find(fp => fp.name === c.profileName);
        if (p) svg.append('circle').attr('cx', x(p.discharge)).attr('cy', y(c.headLoss)).attr('r', 5).attr('fill', 'none').attr('stroke', THEME.hecras).attr('stroke-width', 2);
      }
    });

    const legend = METHODS.map(m => ({ label: METHOD_NAMES[m], color: METHOD_COLORS[m] }));
    if (comparison.some(c => c.headLoss !== null)) legend.push({ label: 'HEC-RAS', color: THEME.hecras });
    drawLegend(svg, legend, width, height);
  }, [data, sensitivityResults, comparison, qUnit, lenUnit]);

  // WSEL chart renderer
  useD3Chart(wselRef, (svg, width, height) => {
    const allQ = data.map(d => d.Q);
    const allWsel = data.flatMap(d => METHODS.map(m => d[`${m}_wsel`]).filter((v): v is number => v !== undefined));
    if (allWsel.length === 0) return;

    const x = scaleLinear().domain([min(allQ)! * 0.95, max(allQ)! * 1.05]).range([0, width]);
    const y = scaleLinear().domain([min(allWsel)! - 1, max(allWsel)! + 1]).range([height, 0]);
    drawAxesAndGrid(svg, x, y, width, height, `Discharge (${qUnit})`, `US WSEL (${lenUnit})`);

    if (sensitivityResults) {
      METHODS.forEach(m => {
        const band = data.filter(d => d[`${m}_wsel_lo`] !== undefined && d[`${m}_wsel_hi`] !== undefined);
        if (band.length < 2) return;
        const area = d3area<ChartData>().x(d => x(d.Q)).y0(d => y(d[`${m}_wsel_lo`]!)).y1(d => y(d[`${m}_wsel_hi`]!));
        svg.append('path').datum(band).attr('d', area).attr('fill', METHOD_COLORS[m]).attr('fill-opacity', 0.1);
      });
    }

    METHODS.forEach(m => {
      const pts = data.filter(d => d[`${m}_wsel`] !== undefined);
      if (pts.length < 1) return;
      const line = d3line<ChartData>().x(d => x(d.Q)).y(d => y(d[`${m}_wsel`]!));
      svg.append('path').datum(pts).attr('d', line).attr('fill', 'none').attr('stroke', METHOD_COLORS[m]).attr('stroke-width', 2);
      pts.forEach(d => svg.append('circle').attr('cx', x(d.Q)).attr('cy', y(d[`${m}_wsel`]!)).attr('r', 4).attr('fill', METHOD_COLORS[m]));
    });

    comparison.forEach(c => {
      if (c.upstreamWsel !== null) {
        const p = flowProfiles.find(fp => fp.name === c.profileName);
        if (p) svg.append('circle').attr('cx', x(p.discharge)).attr('cy', y(c.upstreamWsel)).attr('r', 5).attr('fill', 'none').attr('stroke', THEME.hecras).attr('stroke-width', 2);
      }
    });

    const legend = METHODS.map(m => ({ label: METHOD_NAMES[m], color: METHOD_COLORS[m] }));
    if (comparison.some(c => c.upstreamWsel !== null)) legend.push({ label: 'HEC-RAS', color: THEME.hecras });
    drawLegend(svg, legend, width, height);
  }, [data, sensitivityResults, comparison, qUnit, lenUnit]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle>Afflux Rating Curve</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  CSV
                </Button>
              </div>
              <CardDescription className="text-pretty">
                Head loss by method across discharge scenarios.
                {sensitivityResults ? ' Shaded bands show Manning\'s n sensitivity — where bands are wider than method spread, roughness dominates.' : ''}
                {' '}Converging lines = consistent methods; divergence at higher flows may signal pressure flow transition.
              </CardDescription>
            </div>
            {callout && <div className="w-[45%] shrink-0">{callout}</div>}
          </div>
        </CardHeader>
        <CardContent>
          <div ref={affluxRef} className="h-[320px] w-full" data-chart-id="afflux-rating" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upstream WSEL vs Discharge</CardTitle>
          <CardDescription className="max-w-prose text-pretty">
            Upstream water surface elevation trend across discharge scenarios. A sharp WSEL increase
            may indicate onset of pressure flow or backwater from the bridge constriction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={wselRef} className="h-[320px] w-full" data-chart-id="wsel-trend" />
        </CardContent>
      </Card>
    </div>
  );
}
