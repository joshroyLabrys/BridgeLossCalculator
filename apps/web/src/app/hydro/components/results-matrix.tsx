'use client';

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@flowsuite/ui';
import type { DesignStormResults, StormRunResult } from '@flowsuite/engine/hydrology/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ResultsMatrixProps {
  results: DesignStormResults;
}

/** Format duration for display */
function fmtDur(minutes: number): string {
  if (minutes >= 60) {
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hr`;
  }
  return `${minutes} min`;
}

export function ResultsMatrix({ results }: ResultsMatrixProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { runs, summary } = results;
  if (runs.length === 0) return null;

  // Get unique sorted durations and AEPs
  const aeps = summary.map((s) => s.aep);
  const durationsSet = new Set(runs.map((r) => r.durationMin));
  const durations = [...durationsSet].sort((a, b) => a - b);

  // Build a lookup: medianQ[duration][aep]
  const medianQ = new Map<number, Map<string, number>>();
  for (const dur of durations) {
    const aepMap = new Map<string, number>();
    for (const aep of aeps) {
      const durRuns = runs.filter((r) => r.durationMin === dur && r.aep === aep);
      if (durRuns.length === 0) continue;
      const peaks = durRuns.map((r) => r.peakQ).sort((a, b) => a - b);
      aepMap.set(aep, peaks[Math.floor(peaks.length / 2)]);
    }
    medianQ.set(dur, aepMap);
  }

  // Critical durations per AEP
  const criticalDurations = new Map<string, number>();
  for (const s of summary) {
    criticalDurations.set(s.aep, s.criticalDurationMin);
  }

  // Get expanded row patterns
  function getExpandedRuns(dur: number): Map<string, StormRunResult[]> {
    const byAep = new Map<string, StormRunResult[]>();
    for (const aep of aeps) {
      byAep.set(
        aep,
        runs.filter((r) => r.durationMin === dur && r.aep === aep).sort((a, b) => a.patternIndex - b.patternIndex),
      );
    }
    return byAep;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results Matrix</CardTitle>
        <CardDescription>
          Median peak discharge by duration and AEP. Critical duration cells are highlighted. Click a
          row to expand and see all ensemble pattern results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Duration</TableHead>
              {aeps.map((aep) => (
                <TableHead key={aep} className="text-right">
                  {aep}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {durations.map((dur) => {
              const isExpanded = expandedRow === dur;
              return (
                <ExpandableRow
                  key={dur}
                  duration={dur}
                  aeps={aeps}
                  medianQ={medianQ.get(dur) ?? new Map()}
                  criticalDurations={criticalDurations}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedRow(isExpanded ? null : dur)}
                  expandedRuns={isExpanded ? getExpandedRuns(dur) : null}
                />
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface ExpandableRowProps {
  duration: number;
  aeps: string[];
  medianQ: Map<string, number>;
  criticalDurations: Map<string, number>;
  isExpanded: boolean;
  onToggle: () => void;
  expandedRuns: Map<string, StormRunResult[]> | null;
}

function ExpandableRow({
  duration,
  aeps,
  medianQ,
  criticalDurations,
  isExpanded,
  onToggle,
  expandedRuns,
}: ExpandableRowProps) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="w-8 px-1">
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium tabular-nums">{fmtDur(duration)}</TableCell>
        {aeps.map((aep) => {
          const q = medianQ.get(aep);
          const isCritical = criticalDurations.get(aep) === duration;
          return (
            <TableCell
              key={aep}
              className={`text-right tabular-nums ${
                isCritical ? 'bg-primary/10 font-semibold text-primary' : ''
              }`}
            >
              {q !== undefined ? q.toFixed(1) : '--'}
            </TableCell>
          );
        })}
      </TableRow>
      {isExpanded && expandedRuns && (
        <>
          {/* Show individual pattern results */}
          {Array.from({ length: 10 }, (_, pi) => (
            <TableRow key={`${duration}-p${pi}`} className="bg-muted/30">
              <TableCell />
              <TableCell className="text-xs text-muted-foreground pl-6">
                Pattern {pi + 1}
              </TableCell>
              {aeps.map((aep) => {
                const aepRuns = expandedRuns.get(aep) ?? [];
                const run = aepRuns.find((r) => r.patternIndex === pi);
                return (
                  <TableCell
                    key={aep}
                    className="text-right text-xs tabular-nums text-muted-foreground"
                  >
                    {run ? run.peakQ.toFixed(1) : '--'}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </>
      )}
    </>
  );
}
