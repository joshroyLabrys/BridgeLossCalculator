'use client';

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3line, area as d3area } from 'd3-shape';
import { select } from 'd3-selection';
import { min, max } from 'd3-array';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { computeAdequacy } from '@/engine/adequacy/decision-engine';
import { unitLabel, toDisplay } from '@/lib/units';
import { AiSummaryBanner } from '@/components/summary/ai-summary-banner';
import { MethodSuitability } from '@/components/summary/method-suitability';
import { ShieldCheck, AlertTriangle, Droplets, TrendingUp } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_STYLE = {
  clear: { label: 'CLEAR', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  low: { label: 'LOW', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pressure: { label: 'PRESSURE', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  overtopping: { label: 'OVERTOPPING', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

const REGIME_LABEL: Record<string, string> = {
  'free-surface': 'Free Surface',
  'pressure': 'Pressure',
  'overtopping': 'Overtopping',
};

const VERDICT_STYLE = {
  pass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  warning: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  fail: 'bg-red-500/15 border-red-500/30 text-red-400',
};

const VERDICT_ICON = {
  pass: ShieldCheck,
  warning: AlertTriangle,
  fail: AlertTriangle,
};

const THEME = {
  grid: 'oklch(0.26 0.02 230)',
  axis: 'oklch(0.50 0.01 260)',
  lowChord: '#f59e0b',
  highChord: '#ef4444',
  wselLine: '#3b82f6',
  greenZone: 'rgba(16, 185, 129, 0.08)',
  amberZone: 'rgba(245, 158, 11, 0.08)',
  redZone: 'rgba(239, 68, 68, 0.08)',
};

/* ------------------------------------------------------------------ */
/*  D3 hook (same pattern as afflux-charts)                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  AdequacyPanel                                                      */
/* ------------------------------------------------------------------ */

export function AdequacyPanel() {
  const results = useProjectStore((s) => s.results);
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const profiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const jurisdiction = useProjectStore((s) => s.regulatoryJurisdiction);
  const setAdequacyResults = useProjectStore((s) => s.setAdequacyResults);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const qUnit = unitLabel('discharge', us);

  const chartRef = useRef<HTMLDivElement>(null);

  const adequacy = useMemo(() => {
    if (!results) return null;
    return computeAdequacy(results, bridge, profiles, coefficients.freeboardThreshold, jurisdiction);
  }, [results, bridge, profiles, coefficients.freeboardThreshold, jurisdiction]);

  // Push adequacy results into the store
  useEffect(() => {
    setAdequacyResults(adequacy);
  }, [adequacy, setAdequacyResults]);

  // Rating curve chart
  useD3Chart(chartRef, (svg, width, height) => {
    if (!adequacy || adequacy.profiles.length === 0) return;

    const data = adequacy.profiles;
    const allQ = data.map(d => d.discharge);
    const allWsel = data.map(d => d.worstCaseWsel);

    const qMin = min(allQ)! * 0.9;
    const qMax = max(allQ)! * 1.1;

    // Include low chord and high chord in y range
    const lowChord = min(data.map(d => d.worstCaseWsel + d.freeboard))!;
    const highChord = bridge.highChord;
    const yMin = min([...allWsel, lowChord])! - 0.5;
    const yMax = max([...allWsel, highChord])! + 0.5;

    const x = scaleLinear().domain([qMin, qMax]).range([0, width]);
    const y = scaleLinear().domain([yMin, yMax]).range([height, 0]);

    // Grid lines
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).tickSize(-height).tickFormat(() => ''))
      .call((g: any) => { g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'); g.select('.domain').remove(); });
    svg.append('g')
      .call(axisLeft(y).tickSize(-width).tickFormat(() => ''))
      .call((g: any) => { g.selectAll('line').attr('stroke', THEME.grid).attr('stroke-dasharray', '3 3'); g.select('.domain').remove(); });

    // Regime shading zones
    // Green zone: below low chord
    if (y(lowChord) < height) {
      svg.append('rect')
        .attr('x', 0).attr('y', y(lowChord))
        .attr('width', width).attr('height', height - y(lowChord))
        .attr('fill', THEME.greenZone);
    }
    // Amber zone: low chord to high chord
    if (lowChord < highChord) {
      svg.append('rect')
        .attr('x', 0).attr('y', y(highChord))
        .attr('width', width).attr('height', y(lowChord) - y(highChord))
        .attr('fill', THEME.amberZone);
    }
    // Red zone: above high chord
    if (y(highChord) > 0) {
      svg.append('rect')
        .attr('x', 0).attr('y', 0)
        .attr('width', width).attr('height', y(highChord))
        .attr('fill', THEME.redZone);
    }

    // Axes
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(Math.max(4, Math.floor(width / 80))))
      .call((g: any) => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });
    svg.append('g')
      .call(axisLeft(y).ticks(Math.max(4, Math.floor(height / 50))))
      .call((g: any) => { g.selectAll('text').attr('fill', THEME.axis).attr('font-size', 11); g.selectAll('line,path').attr('stroke', THEME.grid); });

    // Axis labels
    svg.append('text').attr('x', width / 2).attr('y', height + 40).attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11).text(`Discharge (${qUnit})`);
    svg.append('text').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -42).attr('text-anchor', 'middle').attr('fill', THEME.axis).attr('font-size', 11).text(`Water Level (${len})`);

    // Horizontal reference lines
    // Low chord
    svg.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', y(lowChord)).attr('y2', y(lowChord))
      .attr('stroke', THEME.lowChord).attr('stroke-width', 1.5).attr('stroke-dasharray', '6 3');
    svg.append('text')
      .attr('x', width - 4).attr('y', y(lowChord) - 4)
      .attr('text-anchor', 'end').attr('fill', THEME.lowChord).attr('font-size', 10)
      .text(`Low Chord ${lowChord.toFixed(2)}`);

    // High chord
    svg.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', y(highChord)).attr('y2', y(highChord))
      .attr('stroke', THEME.highChord).attr('stroke-width', 1.5).attr('stroke-dasharray', '6 3');
    svg.append('text')
      .attr('x', width - 4).attr('y', y(highChord) - 4)
      .attr('text-anchor', 'end').attr('fill', THEME.highChord).attr('font-size', 10)
      .text(`High Chord ${highChord.toFixed(2)}`);

    // Vertical dashed lines at critical Q thresholds
    const thresholds = [
      { q: adequacy.pressureOnsetQ, label: 'Pressure onset', color: THEME.lowChord },
      { q: adequacy.overtoppingOnsetQ, label: 'Overtopping onset', color: THEME.highChord },
      { q: adequacy.zeroFreeboardQ, label: 'Zero freeboard', color: '#94a3b8' },
    ];
    for (const t of thresholds) {
      if (t.q !== null && t.q >= qMin && t.q <= qMax) {
        svg.append('line')
          .attr('x1', x(t.q)).attr('x2', x(t.q))
          .attr('y1', 0).attr('y2', height)
          .attr('stroke', t.color).attr('stroke-width', 1).attr('stroke-dasharray', '4 4');
        svg.append('text')
          .attr('x', x(t.q) + 4).attr('y', 12)
          .attr('fill', t.color).attr('font-size', 9)
          .text(`${t.label}`);
      }
    }

    // WSEL envelope line
    const wselLine = d3line<typeof data[0]>()
      .x(d => x(d.discharge))
      .y(d => y(d.worstCaseWsel));
    svg.append('path')
      .datum(data)
      .attr('d', wselLine)
      .attr('fill', 'none')
      .attr('stroke', THEME.wselLine)
      .attr('stroke-width', 2);

    // Data points colored by status
    const statusColor = {
      clear: '#10b981',
      low: '#f59e0b',
      pressure: '#ef4444',
      overtopping: '#a855f7',
    };
    data.forEach(d => {
      svg.append('circle')
        .attr('cx', x(d.discharge))
        .attr('cy', y(d.worstCaseWsel))
        .attr('r', 4)
        .attr('fill', statusColor[d.status]);
    });

    // Legend
    const legendItems = [
      { label: 'WSEL Envelope', color: THEME.wselLine },
      { label: 'Low Chord', color: THEME.lowChord },
      { label: 'High Chord', color: THEME.highChord },
    ];
    const legendG = svg.append('g').attr('transform', `translate(${width / 2}, ${height + 56})`);
    const itemWidth = 100;
    const startX = -(legendItems.length * itemWidth) / 2;
    legendItems.forEach((item, i) => {
      const g = legendG.append('g').attr('transform', `translate(${startX + i * itemWidth}, 0)`);
      g.append('rect').attr('x', 0).attr('y', -1.5).attr('width', 14).attr('height', 3).attr('fill', item.color).attr('rx', 1);
      g.append('text').attr('x', 18).attr('y', 0).attr('dy', '0.35em').attr('fill', THEME.axis).attr('font-size', 10).text(item.label);
    });

  }, [adequacy, bridge.highChord, qUnit, len]);

  if (!results || !adequacy) return null;

  const VerdictIcon = VERDICT_ICON[adequacy.verdictSeverity];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Verdict badge */}
      <Card className={`border ${VERDICT_STYLE[adequacy.verdictSeverity]}`}>
        <CardContent className="flex items-center gap-3 py-4 px-4">
          <VerdictIcon className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium leading-relaxed">{adequacy.verdict}</p>
        </CardContent>
      </Card>

      {/* 2. Critical threshold callouts */}
      {(adequacy.pressureOnsetQ !== null || adequacy.overtoppingOnsetQ !== null || adequacy.zeroFreeboardQ !== null) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {adequacy.zeroFreeboardQ !== null && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Zero Freeboard</span>
                </div>
                <p className="text-sm font-mono font-medium">
                  Q = {toDisplay(adequacy.zeroFreeboardQ, 'discharge', us).toFixed(0)} {qUnit}
                </p>
              </CardContent>
            </Card>
          )}
          {adequacy.pressureOnsetQ !== null && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">Pressure Onset</span>
                </div>
                <p className="text-sm font-mono font-medium">
                  Q = {toDisplay(adequacy.pressureOnsetQ, 'discharge', us).toFixed(0)} {qUnit}
                </p>
              </CardContent>
            </Card>
          )}
          {adequacy.overtoppingOnsetQ !== null && (
            <Card>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs text-muted-foreground">Overtopping Onset</span>
                </div>
                <p className="text-sm font-mono font-medium">
                  Q = {toDisplay(adequacy.overtoppingOnsetQ, 'discharge', us).toFixed(0)} {qUnit}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 3. Rating curve chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Curve &mdash; Regime Envelope</CardTitle>
          <CardDescription className="text-pretty">
            Worst-case upstream WSEL across all methods vs. discharge, with regime zone shading.
            Green = free-surface, amber = pressure, red = overtopping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div ref={chartRef} className="h-[260px] sm:h-[320px] w-full" />
        </CardContent>
      </Card>

      {/* 4. Enhanced freeboard table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Freeboard &amp; Regime Summary</CardTitle>
          </div>
          <CardDescription className="text-pretty">
            Clearance between worst-case upstream WSEL and low chord, with flow regime classification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs">Profile</TableHead>
                  <TableHead className="text-xs">ARI</TableHead>
                  <TableHead className="text-xs text-right">Q ({qUnit})</TableHead>
                  <TableHead className="text-xs text-right">WSEL ({len})</TableHead>
                  <TableHead className="text-xs text-right">Freeboard ({len})</TableHead>
                  <TableHead className="text-xs text-center">Regime</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adequacy.profiles.map((r, i) => {
                  const style = STATUS_STYLE[r.status];
                  return (
                    <TableRow key={i} className="even:bg-muted/20">
                      <TableCell className="font-medium">{r.profileName}</TableCell>
                      <TableCell className="text-muted-foreground">{r.ari || '\u2014'}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.discharge, 'discharge', us).toFixed(0)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.worstCaseWsel, 'length', us).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.freeboard, 'length', us).toFixed(2)}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{REGIME_LABEL[r.regime]}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${style.className}`}>{style.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 5. AI Summary and Method Suitability */}
      <AiSummaryBanner />
      <MethodSuitability />
    </div>
  );
}
