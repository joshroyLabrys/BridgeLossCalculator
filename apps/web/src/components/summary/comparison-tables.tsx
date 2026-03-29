'use client';

import React from 'react';
import { Input } from '@flowsuite/ui';
import { useProjectStore } from '@/store/project-store';
import { HecRasInputRow } from './hecras-input-row';
import { Badge } from '@flowsuite/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@flowsuite/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@flowsuite/ui';
import { MethodResult, HecRasComparison } from '@flowsuite/engine/types';
import { toDisplay, unitLabel } from '@flowsuite/data';
import { Calculator } from 'lucide-react';
import { ReactNode } from 'react';

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

function SectionDivider({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <TableRow className="border-t-2 border-border/60 hover:bg-transparent">
      <TableCell colSpan={colSpan} className="pt-5 pb-1.5 px-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">{label}</span>
      </TableCell>
    </TableRow>
  );
}

function MethodRows({ methods, results, getValue, profileCount }: {
  methods: readonly ('energy' | 'momentum' | 'yarnell' | 'wspro')[];
  results: NonNullable<ReturnType<typeof useProjectStore.getState>['results']>;
  getValue: (r: MethodResult) => string;
  profileCount: number;
}) {
  return (
    <>
      {methods.map((method) => (
        <TableRow key={method} className="even:bg-muted/10">
          <TableCell><MethodName method={method} /></TableCell>
          {results[method].map((r, i) => (
            <TableCell key={i} className="text-right font-mono tabular-nums">
              {r.error ? (
                <span className="text-destructive">ERR</span>
              ) : (
                <span>
                  {getValue(r)}
                  {r.flowCalculationType !== 'free-surface' && (
                    <span className="ml-1 text-[10px] text-purple-400">
                      {r.flowCalculationType === 'orifice' ? 'ORF' : 'ORF+WR'}
                    </span>
                  )}
                </span>
              )}
            </TableCell>
          ))}
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}

export function ComparisonTables({ callout }: { callout?: ReactNode } = {}) {
  const results = useProjectStore((s) => s.results);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const updateHecRas = useProjectStore((s) => s.updateHecRasComparison);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);
  const areaU = unitLabel('area', us);

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
  const colSpan = 2 + profileNames.length; // +1 for spacer column

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="space-y-1">
          <CardTitle>Method Comparison</CardTitle>
          <CardDescription className="text-pretty">
            Four independent methods compared side-by-side. Agreement within 5% (green) is high confidence,
            5–10% (amber) is acceptable, and beyond 10% (red) warrants investigation. Enter HEC-RAS values
            for percentage differences. TUFLOW FLC values are form loss coefficients for 2D models.
          </CardDescription>
        </div>
        {callout}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
        <Table className="min-w-[480px]">
          <colgroup>
            <col className="w-[180px]" />
            {profileNames.map((n) => <col key={n} className="w-[110px]" />)}
            <col />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs">Method</TableHead>
              {profileNames.map((n) => <TableHead key={n} className="text-xs text-right">{n}</TableHead>)}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Upstream WSEL */}
            <SectionDivider label={`Upstream WSEL (${len})`} colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => toDisplay(r.upstreamWsel, 'length', us).toFixed(2)} profileCount={profileNames.length} />
            <HecRasInputRow profileNames={profileNames} field="upstreamWsel" spacer />
            <TableRow className="bg-muted/10 hover:bg-muted/10">
              <TableCell className="text-xs text-muted-foreground">% Diff (Energy vs HEC-RAS)</TableCell>
              {profileNames.map((name, i) => {
                const hecEntry = comparison.find((c) => c.profileName === name);
                const energyResult = results.energy[i];
                if (!hecEntry?.upstreamWsel || !energyResult || energyResult.error) {
                  return <TableCell key={name} className="text-right">—</TableCell>;
                }
                const pct = hecEntry.upstreamWsel !== 0
                  ? ((energyResult.upstreamWsel - hecEntry.upstreamWsel) / hecEntry.upstreamWsel) * 100
                  : null;
                return <TableCell key={name} className="text-right">{pctDiffBadge(pct)}</TableCell>;
              })}
              <TableCell />
            </TableRow>

            {/* Head Loss */}
            <SectionDivider label={`Head Loss (${len})`} colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => toDisplay(r.totalHeadLoss, 'length', us).toFixed(3)} profileCount={profileNames.length} />
            <HecRasInputRow profileNames={profileNames} field="headLoss" spacer />
            <TableRow className="bg-muted/10 hover:bg-muted/10">
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
              <TableCell />
            </TableRow>

            {/* Approach Velocity */}
            <SectionDivider label={`Approach Velocity (${vel})`} colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => toDisplay(r.approachVelocity, 'velocity', us).toFixed(2)} profileCount={profileNames.length} />

            {/* Froude Number */}
            <SectionDivider label="Froude Number" colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => r.froudeApproach.toFixed(3)} profileCount={profileNames.length} />

            {/* Bridge Opening Area */}
            <SectionDivider label={`Bridge Opening Area (${areaU})`} colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => toDisplay(r.inputEcho.bridgeOpeningArea, 'area', us).toFixed(1)} profileCount={profileNames.length} />

            {/* TUFLOW Pier FLC */}
            <SectionDivider label="TUFLOW Pier FLC" colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => r.tuflowPierFLC.toFixed(3)} profileCount={profileNames.length} />
            <HecRasInputRow profileNames={profileNames} field="pierFLC" spacer />

            {/* TUFLOW Superstructure FLC */}
            <SectionDivider label="TUFLOW Superstructure FLC" colSpan={colSpan} />
            <MethodRows methods={methods} results={results} getValue={(r) => r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A'} profileCount={profileNames.length} />
            <HecRasInputRow profileNames={profileNames} field="superFLC" spacer />
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
