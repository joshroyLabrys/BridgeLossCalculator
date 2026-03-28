'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { runOptimization, type SweepParameter, type TargetMetric, type MethodKey, type OptimizationResult } from '@/engine/optimizer';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { scaleLinear } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { select } from 'd3-selection';
import { axisBottom, axisLeft } from 'd3-axis';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Play, Check, AlertTriangle } from 'lucide-react';

interface OptimizerCardProps {
  selectedMethod: string;
  selectedProfileIdx: number;
}

const SWEEP_PARAM_OPTIONS: { value: SweepParameter; label: string }[] = [
  { value: 'openingWidth', label: 'Opening Width' },
  { value: 'lowChord', label: 'Low Chord Elev' },
  { value: 'manningsNMultiplier', label: "Manning's n ×" },
  { value: 'dischargeMultiplier', label: 'Discharge ×' },
  { value: 'debrisBlockagePct', label: 'Debris %' },
];

const TARGET_METRIC_OPTIONS: { value: TargetMetric; label: string }[] = [
  { value: 'freeboard', label: 'Min Freeboard' },
  { value: 'afflux', label: 'Max Afflux' },
  { value: 'bridgeVelocity', label: 'Max Bridge Velocity' },
];

const DEFAULT_THRESHOLDS: Record<TargetMetric, number> = {
  freeboard: 0.3,
  afflux: 0.3,
  bridgeVelocity: 3.0,
};

export function OptimizerCard({ selectedMethod, selectedProfileIdx }: OptimizerCardProps) {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);
  const us = useProjectStore((s) => s.unitSystem);
  const updateBridgeGeometry = useProjectStore((s) => s.updateBridgeGeometry);
  const clearResults = useProjectStore((s) => s.clearResults);

  const [sweepParam, setSweepParam] = useState<SweepParameter>('openingWidth');
  const [targetMetric, setTargetMetric] = useState<TargetMetric>('freeboard');
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLDS['freeboard']);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [running, setRunning] = useState(false);

  const chartRef = useRef<SVGSVGElement>(null);

  // Reset result when any picker changes
  const handleParamChange = useCallback((v: SweepParameter) => {
    setSweepParam(v);
    setOptResult(null);
  }, []);

  const handleMetricChange = useCallback((v: TargetMetric) => {
    setTargetMetric(v);
    setThreshold(DEFAULT_THRESHOLDS[v]);
    setOptResult(null);
  }, []);

  const handleThresholdChange = useCallback((v: number) => {
    setThreshold(v);
    setOptResult(null);
  }, []);

  const handleFindOptimal = useCallback(() => {
    if (running || !crossSection.length || !flowProfiles.length) return;
    setRunning(true);
    setTimeout(() => {
      try {
        const result = runOptimization(
          crossSection,
          bridgeGeometry,
          flowProfiles,
          coefficients,
          {
            parameter: sweepParam,
            target: targetMetric,
            threshold,
            method: selectedMethod as MethodKey,
            profileIdx: selectedProfileIdx,
          }
        );
        setOptResult(result);
      } finally {
        setRunning(false);
      }
    }, 16);
  }, [running, crossSection, bridgeGeometry, flowProfiles, coefficients, sweepParam, targetMetric, threshold, selectedMethod, selectedProfileIdx]);

  // D3 chart
  useEffect(() => {
    if (!chartRef.current || !optResult) return;

    const svg = select(chartRef.current);
    svg.selectAll('*').remove();

    const points = optResult.sweepPoints.filter((p) => !isNaN(p.metricValue));
    if (points.length === 0) return;

    const W = chartRef.current.clientWidth || 224;
    const H = 120;
    const margin = { top: 8, right: 8, bottom: 28, left: 36 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const xMin = Math.min(...points.map((p) => p.paramValue));
    const xMax = Math.max(...points.map((p) => p.paramValue));
    const yMin = Math.min(...points.map((p) => p.metricValue), threshold * 0.8);
    const yMax = Math.max(...points.map((p) => p.metricValue), threshold * 1.2);

    const xScale = scaleLinear().domain([xMin, xMax]).range([0, innerW]);
    const yScale = scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice();

    const g = svg
      .attr('width', W)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Axes
    const xAxis = axisBottom(xScale).ticks(4).tickSize(3);
    const yAxis = axisLeft(yScale).ticks(4).tickSize(3);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((ax) => {
        ax.select('.domain').attr('stroke', '#444');
        ax.selectAll('line').attr('stroke', '#444');
        ax.selectAll('text').attr('fill', '#888').attr('font-size', '8px');
      });

    g.append('g')
      .call(yAxis)
      .call((ax) => {
        ax.select('.domain').attr('stroke', '#444');
        ax.selectAll('line').attr('stroke', '#444');
        ax.selectAll('text').attr('fill', '#888').attr('font-size', '8px');
      });

    // Blue sweep line
    const lineGen = d3line<{ paramValue: number; metricValue: number }>()
      .x((d) => xScale(d.paramValue))
      .y((d) => yScale(d.metricValue));

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5)
      .attr('d', lineGen);

    // Dashed amber threshold line
    const ty = yScale(threshold);
    if (ty >= 0 && ty <= innerH) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', ty)
        .attr('y2', ty)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,2');
    }

    // Green dot at optimal point
    if (optResult.optimalValue !== null && optResult.optimalMetric !== null) {
      const ox = xScale(optResult.optimalValue);
      const oy = yScale(optResult.optimalMetric);
      if (ox >= 0 && ox <= innerW && oy >= 0 && oy <= innerH) {
        g.append('circle')
          .attr('cx', ox)
          .attr('cy', oy)
          .attr('r', 4)
          .attr('fill', '#22c55e')
          .attr('stroke', '#16a34a')
          .attr('stroke-width', 1);
      }
    }
  }, [optResult, threshold]);

  if (!results) return null;

  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  function formatOptimalValue(param: SweepParameter, value: number): string {
    if (param === 'openingWidth' || param === 'lowChord') {
      return `${toDisplay(value, 'length', us).toFixed(2)} ${len}`;
    }
    if (param === 'manningsNMultiplier' || param === 'dischargeMultiplier') {
      return `${value.toFixed(3)}×`;
    }
    if (param === 'debrisBlockagePct') {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(3);
  }

  function formatMetricValue(metric: TargetMetric, value: number): string {
    if (metric === 'freeboard' || metric === 'afflux') {
      return `${toDisplay(value, 'length', us).toFixed(3)} ${len}`;
    }
    if (metric === 'bridgeVelocity') {
      return `${toDisplay(value, 'velocity', us).toFixed(2)} ${vel}`;
    }
    return value.toFixed(3);
  }

  const paramLabel = SWEEP_PARAM_OPTIONS.find((o) => o.value === sweepParam)?.label ?? sweepParam;

  return (
    <Card className="w-full lg:w-64 shrink-0">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">Optimize</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Vary picker */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Vary</label>
          <Select value={sweepParam} onValueChange={(v) => handleParamChange(v as SweepParameter)}>
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SWEEP_PARAM_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target picker */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Target</label>
          <Select value={targetMetric} onValueChange={(v) => handleMetricChange(v as TargetMetric)}>
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_METRIC_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Threshold input */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Threshold</label>
          <input
            type="number"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            value={threshold}
            step={0.01}
            onChange={(e) => handleThresholdChange(parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* Find Optimal button */}
        <Button
          size="sm"
          className="w-full text-xs h-7"
          disabled={running}
          onClick={handleFindOptimal}
        >
          {running ? (
            <span className="h-3 w-3 mr-1.5 animate-spin rounded-full border border-current border-t-transparent inline-block" />
          ) : (
            <Play className="h-3 w-3 mr-1.5" />
          )}
          Find Optimal
        </Button>

        {/* Results chart */}
        {optResult && (
          <>
            <div className="rounded-md overflow-hidden bg-black/20 border border-border/30">
              <svg ref={chartRef} className="w-full" style={{ height: 120 }} />
            </div>

            {/* Result badge */}
            <div className={`rounded-md px-2 py-1.5 text-[11px] border flex gap-1.5 items-start ${
              optResult.thresholdMet
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {optResult.thresholdMet ? (
                <Check className="h-3 w-3 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              )}
              <span className="leading-snug">
                {optResult.thresholdMet && optResult.optimalValue !== null && optResult.optimalMetric !== null
                  ? `${paramLabel} = ${formatOptimalValue(sweepParam, optResult.optimalValue)} → ${formatMetricValue(targetMetric, optResult.optimalMetric)}`
                  : 'Threshold not achievable in sweep range'}
              </span>
            </div>

            {/* Apply button (openingWidth only, threshold met) */}
            {sweepParam === 'openingWidth' && optResult.thresholdMet && optResult.optimalValue !== null && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => {
                  const width = optResult.optimalValue!;
                  const center = (bridgeGeometry.leftAbutmentStation + bridgeGeometry.rightAbutmentStation) / 2;
                  updateBridgeGeometry({
                    ...bridgeGeometry,
                    leftAbutmentStation: center - width / 2,
                    rightAbutmentStation: center + width / 2,
                  });
                  clearResults();
                }}
              >
                Apply {formatOptimalValue('openingWidth', optResult.optimalValue)}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
