'use client';

import { useCallback, useMemo } from 'react';
import { useHydroStore } from '../store';
import { runDesignStorms } from '@flowsuite/engine/hydrology/design-storm-runner';
import { bransbyWilliams, friends } from '@flowsuite/engine/hydrology/time-of-concentration';
import { AEP_TO_ARI, ARR_STANDARD_DURATIONS } from '@flowsuite/engine/hydrology/types';
import type { DesignStormConfig } from '@flowsuite/engine/hydrology/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@flowsuite/ui';
import { Loader2, Play } from 'lucide-react';
import { HydrographChart } from './hydrograph-chart';
import { ResultsMatrix } from './results-matrix';

/** Format duration for display */
function fmtDur(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
  }
  return `${minutes} min`;
}

export function StepDesignStorms() {
  // Read all state from previous steps
  const arrData = useHydroStore((s) => s.arrData);
  const catchmentArea = useHydroStore((s) => s.catchmentArea);
  const streamLength = useHydroStore((s) => s.streamLength);
  const equalAreaSlope = useHydroStore((s) => s.equalAreaSlope);

  const adoptedInitialLoss = useHydroStore((s) => s.adoptedInitialLoss);
  const adoptedContinuingLoss = useHydroStore((s) => s.adoptedContinuingLoss);
  const adoptedPreBurst = useHydroStore((s) => s.adoptedPreBurst);
  const adoptedImperviousFraction = useHydroStore((s) => s.adoptedImperviousFraction);

  const tcMethod = useHydroStore((s) => s.tcMethod);
  const tcManual = useHydroStore((s) => s.tcManual);
  const rCoefficient = useHydroStore((s) => s.rCoefficient);
  const durationRange = useHydroStore((s) => s.durationRange);

  const results = useHydroStore((s) => s.results);
  const isRunning = useHydroStore((s) => s.isRunning);
  const setResults = useHydroStore((s) => s.setResults);
  const setIsRunning = useHydroStore((s) => s.setIsRunning);

  // Compute adopted Tc (mirrors step-tc logic)
  const adoptedTc = useMemo(() => {
    switch (tcMethod) {
      case 'bransby-williams':
        return bransbyWilliams(streamLength, catchmentArea, equalAreaSlope);
      case 'friends':
        return friends(catchmentArea);
      case 'manual':
        return tcManual;
    }
  }, [tcMethod, streamLength, catchmentArea, equalAreaSlope, tcManual]);

  const effectiveR = rCoefficient > 0 ? rCoefficient : adoptedTc * 1.5;

  // Active durations (same logic as step-tc)
  const activeDurations = useMemo(() => {
    if (durationRange.length > 0) return durationRange;
    const tcMin = adoptedTc * 60;
    const low = tcMin * 0.5;
    const high = tcMin * 2.0;
    return [...ARR_STANDARD_DURATIONS].filter((d) => d >= low && d <= high);
  }, [durationRange, adoptedTc]);

  const canRun = arrData !== null && catchmentArea > 0 && adoptedTc > 0 && activeDurations.length > 0;

  const handleRun = useCallback(() => {
    if (!arrData || !canRun) return;

    setIsRunning(true);

    // Use setTimeout to allow the UI to update (show spinner) before heavy computation
    setTimeout(() => {
      try {
        const config: DesignStormConfig = {
          ifd: arrData.ifd,
          temporalPatterns: arrData.temporalPatterns,
          arf: arrData.arf,
          losses: {
            initialLoss: adoptedInitialLoss,
            continuingLoss: adoptedContinuingLoss,
            preBurst: adoptedPreBurst,
            imperviousFraction: adoptedImperviousFraction,
          },
          tc: adoptedTc,
          r: effectiveR,
          catchmentArea,
          aeps: arrData.ifd.aeps,
          durationRange: activeDurations,
        };

        const result = runDesignStorms(config);
        setResults(result);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  }, [
    arrData,
    canRun,
    adoptedInitialLoss,
    adoptedContinuingLoss,
    adoptedPreBurst,
    adoptedImperviousFraction,
    adoptedTc,
    effectiveR,
    catchmentArea,
    activeDurations,
    setResults,
    setIsRunning,
  ]);

  return (
    <div className="space-y-4">
      {/* Run button */}
      <Card>
        <CardHeader>
          <CardTitle>Design Storm Analysis</CardTitle>
          <CardDescription>
            Run the Clark unit hydrograph across all AEPs, durations, and temporal patterns to find
            the critical duration and design flows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleRun} disabled={!canRun || isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              {activeDurations.length} durations x {arrData?.ifd.aeps.length ?? 0} AEPs x 10
              patterns
              {activeDurations.length > 0 && arrData
                ? ` = ${activeDurations.length * arrData.ifd.aeps.length * 10} runs`
                : ''}
            </span>
          </div>
          {!canRun && !isRunning && (
            <p className="text-xs text-muted-foreground mt-2">
              Complete previous steps before running: need ARR data, catchment area, and Tc.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results (shown after completion) */}
      {results && (
        <>
          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle>Critical Duration Summary</CardTitle>
              <CardDescription>
                Peak discharge at the critical duration for each AEP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>AEP</TableHead>
                    <TableHead>ARI</TableHead>
                    <TableHead className="text-right">Critical Duration</TableHead>
                    <TableHead className="text-right">Median Q (m{'\u00B3'}/s)</TableHead>
                    <TableHead className="text-right">Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.summary.map((s) => (
                    <TableRow key={s.aep}>
                      <TableCell className="font-medium">{s.aep}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {AEP_TO_ARI[s.aep] ?? '--'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtDur(s.criticalDurationMin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {s.medianPeakQ.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                        {s.minPeakQ.toFixed(1)} &ndash; {s.maxPeakQ.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Hydrograph chart */}
          <HydrographChart results={results} />

          {/* Full results matrix */}
          <ResultsMatrix results={results} />
        </>
      )}
    </div>
  );
}
