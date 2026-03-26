'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { HecRasInputRow } from './hecras-input-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MethodResult, HecRasComparison } from '@/engine/types';
import { Calculator } from 'lucide-react';

const METHOD_COLORS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

function MethodName({ method }: { method: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${METHOD_COLORS[method]}`} />
      <span>{method === 'wspro' ? 'WSPRO' : method.charAt(0).toUpperCase() + method.slice(1)}</span>
    </div>
  );
}

function pctDiffBadge(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(pct);
  const color = abs < 5
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : abs < 10
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  return <Badge variant="outline" className={`text-xs font-mono ${color}`}>{pct.toFixed(1)}%</Badge>;
}

export function ComparisonTables() {
  const results = useProjectStore((s) => s.results);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const updateHecRas = useProjectStore((s) => s.updateHecRasComparison);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calculator className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Run calculations to see comparisons</p>
      </div>
    );
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
      <Card>
        <CardHeader>
          <CardTitle>Upstream WSEL Comparison</CardTitle>
          <CardDescription>Upstream water surface elevation (ft) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs">Method</TableHead>
                {profileNames.map((n) => <TableHead key={n} className="text-xs text-right">{n}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method} className="even:bg-muted/20">
                  <TableCell><MethodName method={method} /></TableCell>
                  {results[method].map((r, i) => (
                    <TableCell key={i} className="text-right font-mono tabular-nums">
                      {r.error ? <span className="text-destructive">ERR</span> : r.upstreamWsel.toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <HecRasInputRow profileNames={profileNames} field="upstreamWsel" />
              <TableRow className="bg-muted/10">
                <TableCell className="text-xs text-muted-foreground">% Diff (Energy vs HEC-RAS)</TableCell>
                {profileNames.map((name, i) => {
                  const hecEntry = comparison.find((c) => c.profileName === name);
                  const energyResult = results.energy[i];
                  if (!hecEntry?.headLoss || !energyResult || energyResult.error) {
                    return <TableCell key={name} className="text-right">—</TableCell>;
                  }
                  const pct = hecEntry.headLoss !== 0
                    ? ((energyResult.totalHeadLoss - hecEntry.headLoss) / hecEntry.headLoss) * 100
                    : null;
                  return <TableCell key={name} className="text-right">{pctDiffBadge(pct)}</TableCell>;
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Head Loss Comparison</CardTitle>
          <CardDescription>Total head loss (ft) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.totalHeadLoss.toFixed(3)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approach Velocity</CardTitle>
          <CardDescription>Approach velocity (ft/s) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.approachVelocity.toFixed(2)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Froude Number</CardTitle>
          <CardDescription>Approach Froude number across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.froudeApproach.toFixed(3)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bridge Opening Area</CardTitle>
          <CardDescription>Net bridge opening area (ft²) across all methods</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleMethodTable profileNames={profileNames} methods={methods} results={results} getValue={(r) => r.inputEcho.bridgeOpeningArea.toFixed(1)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>TUFLOW Form Loss Coefficients</CardTitle>
          <CardDescription>Pier and superstructure FLCs for TUFLOW modelling</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs">Method</TableHead>
                {profileNames.map((n) => <TableHead key={n} className="text-xs text-center" colSpan={2}>{n}</TableHead>)}
              </TableRow>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead></TableHead>
                {profileNames.map((n) => (
                  <React.Fragment key={n}>
                    <TableHead className="text-right text-xs text-muted-foreground">Pier</TableHead>
                    <TableHead className="text-right text-xs text-muted-foreground">Super</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method} className="even:bg-muted/20">
                  <TableCell><MethodName method={method} /></TableCell>
                  {results[method].map((r, i) => (
                    <React.Fragment key={i}>
                      <TableCell className="text-right font-mono tabular-nums text-sm">{r.error ? 'ERR' : r.tuflowPierFLC.toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-sm">{r.error ? 'ERR' : (r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A')}</TableCell>
                    </React.Fragment>
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-amber-500/5 border-y border-amber-500/20">
                <TableCell className="text-sm font-semibold text-amber-400">HEC-RAS</TableCell>
                {profileNames.map((name) => {
                  const entry = comparison.find((c) => c.profileName === name);
                  return (
                    <React.Fragment key={name}>
                      <TableCell className="px-1">
                        <Input type="number" value={entry?.pierFLC ?? ''} onChange={(e) => updateHecRasField(name, 'pierFLC', e.target.value)} className="h-7 text-sm font-mono tabular-nums text-right w-full" placeholder="—" />
                      </TableCell>
                      <TableCell className="px-1">
                        <Input type="number" value={entry?.superFLC ?? ''} onChange={(e) => updateHecRasField(name, 'superFLC', e.target.value)} className="h-7 text-sm font-mono tabular-nums text-right w-full" placeholder="—" />
                      </TableCell>
                    </React.Fragment>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SimpleMethodTable({ profileNames, methods, results, getValue }: {
  profileNames: string[];
  methods: readonly ('energy' | 'momentum' | 'yarnell' | 'wspro')[];
  results: NonNullable<ReturnType<typeof useProjectStore.getState>['results']>;
  getValue: (r: MethodResult) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="text-xs">Method</TableHead>
          {profileNames.map((n) => <TableHead key={n} className="text-xs text-right">{n}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((method) => (
          <TableRow key={method} className="even:bg-muted/20">
            <TableCell><MethodName method={method} /></TableCell>
            {results[method].map((r, i) => (
              <TableCell key={i} className="text-right font-mono tabular-nums">
                {r.error ? <span className="text-destructive">ERR</span> : getValue(r)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
