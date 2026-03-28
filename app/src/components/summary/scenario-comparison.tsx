'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore, type Scenario } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { GitCompare, Trash2 } from 'lucide-react';
import type { MethodResult } from '@/engine/types';

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
type MethodKey = typeof METHODS[number];

function formatMethodName(m: MethodKey): string {
  if (m === 'wspro') return 'WSPRO';
  return m.charAt(0).toUpperCase() + m.slice(1);
}

interface ComparisonRow {
  method: MethodKey;
  profileName: string;
  wselA: number;
  wselB: number;
  affluxA: number;
  affluxB: number;
}

function buildRows(scenarioA: Scenario, scenarioB: Scenario): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  for (const method of METHODS) {
    const resultsA = scenarioA.snapshot.results[method];
    const resultsB = scenarioB.snapshot.results[method];

    if (!resultsA || !resultsB) continue;

    for (const resultA of resultsA) {
      if (resultA.error) continue;
      const resultB = resultsB.find((r) => r.profileName === resultA.profileName);
      if (!resultB || resultB.error) continue;

      // Get downstream WSEL from snapshots to compute afflux
      const profileA = scenarioA.snapshot.flowProfiles.find((p) => p.name === resultA.profileName);
      const profileB = scenarioB.snapshot.flowProfiles.find((p) => p.name === resultB.profileName);

      const dsWselA = profileA?.dsWsel ?? 0;
      const dsWselB = profileB?.dsWsel ?? 0;

      rows.push({
        method,
        profileName: resultA.profileName,
        wselA: resultA.upstreamWsel,
        wselB: resultB.upstreamWsel,
        affluxA: resultA.upstreamWsel - dsWselA,
        affluxB: resultB.upstreamWsel - dsWselB,
      });
    }
  }

  return rows;
}

function DeltaCell({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.0001) {
    return <td className="text-right font-mono text-xs px-3 py-1.5 border-b border-border/20 text-muted-foreground">—</td>;
  }
  const isImprovement = diff < 0;
  return (
    <td className={`text-right font-mono text-xs px-3 py-1.5 border-b border-border/20 ${isImprovement ? 'text-emerald-400' : 'text-red-400'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(3)}
    </td>
  );
}

export function ScenarioComparison() {
  const scenarios = useProjectStore((s) => s.scenarios);
  const deleteScenario = useProjectStore((s) => s.deleteScenario);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);

  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);

  if (scenarios.length < 2) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <GitCompare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">Save at least 2 scenarios to compare them.</p>
          <p className="text-xs text-muted-foreground/70">Use the save button in the header bar.</p>
        </CardContent>
      </Card>
    );
  }

  const safeIdxA = Math.min(idxA, scenarios.length - 1);
  const safeIdxB = Math.min(idxB, scenarios.length - 1);
  const scenarioA = scenarios[safeIdxA];
  const scenarioB = scenarios[safeIdxB];

  const rows = buildRows(scenarioA, scenarioB);

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Dropdowns */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Scenario A</label>
            <Select
              value={String(safeIdxA)}
              onValueChange={(v) => setIdxA(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Scenario B</label>
            <Select
              value={String(safeIdxB)}
              onValueChange={(v) => setIdxB(Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Comparison table */}
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No matching profiles with results found across both scenarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium">Method</th>
                  <th className="text-left px-3 py-2 font-medium">Profile</th>
                  <th className="text-right px-3 py-2 font-medium">US WSEL A ({len})</th>
                  <th className="text-right px-3 py-2 font-medium">US WSEL B ({len})</th>
                  <th className="text-right px-3 py-2 font-medium">Delta ({len})</th>
                  <th className="text-right px-3 py-2 font-medium">Afflux A ({len})</th>
                  <th className="text-right px-3 py-2 font-medium">Afflux B ({len})</th>
                  <th className="text-right px-3 py-2 font-medium">Delta ({len})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const wselA = toDisplay(row.wselA, 'length', us);
                  const wselB = toDisplay(row.wselB, 'length', us);
                  const affluxA = toDisplay(row.affluxA, 'length', us);
                  const affluxB = toDisplay(row.affluxB, 'length', us);
                  const wselDiff = wselB - wselA;
                  const affluxDiff = affluxB - affluxA;

                  return (
                    <tr key={i} className="even:bg-muted/10">
                      <td className="px-3 py-1.5 border-b border-border/20 text-muted-foreground">{formatMethodName(row.method)}</td>
                      <td className="px-3 py-1.5 border-b border-border/20 font-medium">{row.profileName}</td>
                      <td className="text-right font-mono px-3 py-1.5 border-b border-border/20">{wselA.toFixed(3)}</td>
                      <td className="text-right font-mono px-3 py-1.5 border-b border-border/20">{wselB.toFixed(3)}</td>
                      <DeltaCell diff={wselDiff} />
                      <td className="text-right font-mono px-3 py-1.5 border-b border-border/20">{affluxA.toFixed(3)}</td>
                      <td className="text-right font-mono px-3 py-1.5 border-b border-border/20">{affluxB.toFixed(3)}</td>
                      <DeltaCell diff={affluxDiff} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Scenario badges with delete buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {scenarios.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 pl-3 pr-1.5 py-1"
            >
              <span className="text-xs font-medium">{s.name}</span>
              <button
                onClick={() => {
                  deleteScenario(i);
                  // Clamp indices after deletion
                  if (idxA >= i) setIdxA(Math.max(0, idxA - 1));
                  if (idxB >= i) setIdxB(Math.max(0, idxB - 1));
                }}
                className="rounded-full p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={`Delete ${s.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
