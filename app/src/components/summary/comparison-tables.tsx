'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { HecRasInputRow } from './hecras-input-row';
import { Badge } from '@/components/ui/badge';
import { MethodResult, HecRasComparison } from '@/engine/types';

function pctDiffBadge(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(pct);
  const color = abs < 5 ? 'bg-green-900/50 text-green-300' : abs < 10 ? 'bg-yellow-900/50 text-yellow-300' : 'bg-red-900/50 text-red-300';
  return <Badge className={`text-xs ${color}`}>{pct.toFixed(1)}%</Badge>;
}

export function ComparisonTables() {
  const results = useProjectStore((s) => s.results);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const updateHecRas = useProjectStore((s) => s.updateHecRasComparison);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) {
    return <p className="text-muted-foreground">Run calculations to see comparisons.</p>;
  }

  function updateHecRasField(profileName: string, field: keyof HecRasComparison, value: string) {
    const profileNames = flowProfiles.map((p) => p.name);
    const entries = profileNames.map((name) => {
      const existing = comparison.find((c) => c.profileName === name) ?? {
        profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
      };
      if (name === profileName) {
        return { ...existing, [field]: value ? parseFloat(value) : null };
      }
      return existing;
    });
    updateHecRas(entries);
  }

  const profileNames = flowProfiles.map((p) => p.name);
  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  return (
    <div className="space-y-6">
      {/* Upstream WSEL table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Upstream WSEL Comparison (ft)</h3>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Method</th>
                {profileNames.map((n) => <th key={n} className="p-2 text-right">{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method} className="border-t">
                  <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
                  {results[method].map((r, i) => (
                    <td key={i} className="p-2 text-right">
                      {r.error ? <span className="text-destructive">ERR</span> : r.upstreamWsel.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
              <HecRasInputRow profileNames={profileNames} field="upstreamWsel" />
              {/* % difference row */}
              <tr className="border-t bg-muted/20">
                <td className="p-2 text-xs text-muted-foreground">% Diff (Energy vs HEC-RAS)</td>
                {profileNames.map((name, i) => {
                  const hecEntry = comparison.find((c) => c.profileName === name);
                  const energyResult = results.energy[i];
                  if (!hecEntry?.headLoss || !energyResult || energyResult.error) {
                    return <td key={name} className="p-2 text-right">—</td>;
                  }
                  const pct = hecEntry.headLoss !== 0
                    ? ((energyResult.totalHeadLoss - hecEntry.headLoss) / hecEntry.headLoss) * 100
                    : null;
                  return <td key={name} className="p-2 text-right">{pctDiffBadge(pct)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Head loss table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Head Loss Comparison (ft)</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.totalHeadLoss.toFixed(3)} />
      </div>

      {/* Velocity comparison table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Approach Velocity Comparison (ft/s)</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.approachVelocity.toFixed(2)} />
      </div>

      {/* Froude number comparison table */}
      <div>
        <h3 className="text-sm font-medium mb-2">Froude Number Comparison</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.froudeApproach.toFixed(3)} />
      </div>

      {/* Bridge opening ratio — from input echo */}
      <div>
        <h3 className="text-sm font-medium mb-2">Bridge Opening Area (ft²)</h3>
        <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.inputEcho.bridgeOpeningArea.toFixed(1)} />
      </div>

      {/* TUFLOW FLC table */}
      <div>
        <h3 className="text-sm font-medium mb-2">TUFLOW Form Loss Coefficients</h3>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Method</th>
                {profileNames.map((n) => <th key={n} className="p-2 text-center" colSpan={2}>{n}</th>)}
              </tr>
              <tr>
                <th className="p-2"></th>
                {profileNames.map((n) => (
                  <React.Fragment key={n}>
                    <th className="p-2 text-right text-xs text-muted-foreground">Pier</th>
                    <th className="p-2 text-right text-xs text-muted-foreground">Super</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method} className="border-t">
                  <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
                  {results[method].map((r, i) => (
                    <React.Fragment key={i}>
                      <td className="p-2 text-right">{r.error ? 'ERR' : r.tuflowPierFLC.toFixed(3)}</td>
                      <td className="p-2 text-right">{r.error ? 'ERR' : (r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A')}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
              {/* Gold HEC-RAS FLC row */}
              <tr className="bg-yellow-900/20 border-y border-yellow-700/30">
                <td className="p-2 text-sm font-medium text-yellow-400">HEC-RAS</td>
                {profileNames.map((name) => {
                  const entry = comparison.find((c) => c.profileName === name);
                  return (
                    <React.Fragment key={name}>
                      <td className="p-1"><Input type="number" value={entry?.pierFLC ?? ''} onChange={(e) => updateHecRasField(name, 'pierFLC', e.target.value)} className="h-7 text-sm w-16" placeholder="—" /></td>
                      <td className="p-1"><Input type="number" value={entry?.superFLC ?? ''} onChange={(e) => updateHecRasField(name, 'superFLC', e.target.value)} className="h-7 text-sm w-16" placeholder="—" /></td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Reusable simple method × profile table */
function SimpleMethodTable({ profileNames, methods, results, getValue }: {
  profileNames: string[];
  methods: readonly ('energy' | 'momentum' | 'yarnell' | 'wspro')[];
  results: NonNullable<ReturnType<typeof useProjectStore.getState>['results']>;
  getValue: (r: MethodResult) => string;
}) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Method</th>
            {profileNames.map((n) => <th key={n} className="p-2 text-right">{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {methods.map((method) => (
            <tr key={method} className="border-t">
              <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
              {results[method].map((r, i) => (
                <td key={i} className="p-2 text-right">
                  {r.error ? <span className="text-destructive">ERR</span> : getValue(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
