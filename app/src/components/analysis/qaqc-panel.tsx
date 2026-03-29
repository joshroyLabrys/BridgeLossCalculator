'use client';

import React, { useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HecRasInputRow } from '@/components/summary/hecras-input-row';
import { toDisplay, unitLabel } from '@/lib/units';
import { Calculator, Download, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { QaqcMemoPdf } from './qaqc-memo-pdf';
import type { QaqcMemoData, QaqcProfileData, QaqcComparisonRow } from './qaqc-memo-pdf';
import type { CalculationResults, MethodResult, HecRasComparison } from '@/engine/types';

/* ─── Constants ─── */

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

/* ─── Root cause suggestion rules ─── */

interface DivergencePattern {
  wselDiverges: boolean;
  headLossDiverges: boolean;
  velocityDiverges: boolean;
  yarnellOnlyDiverges: boolean;
  allDiverge: boolean;
}

function getRootCause(param: string, pattern: DivergencePattern): string | null {
  if (pattern.allDiverge) return 'Check Manning\'s n values and cross-section geometry';
  if (param === 'Upstream WSEL' && pattern.wselDiverges && !pattern.headLossDiverges) {
    return 'Downstream boundary condition may differ';
  }
  if (param === 'Head Loss' && pattern.headLossDiverges) {
    return 'Check contraction/expansion coefficients';
  }
  if (param === 'Upstream WSEL' && pattern.yarnellOnlyDiverges) {
    return 'Yarnell method not valid for pressure flow';
  }
  if (param === 'Velocity' && pattern.velocityDiverges) {
    return 'Check flow area computation \u2014 pier blockage may differ';
  }
  return null;
}

/* ─── Helpers ─── */

/** Get worst-case (highest WSEL) result across all enabled methods for a given profile index. */
function getWorstCase(results: CalculationResults, profileIndex: number, coeffMethods: Record<string, boolean>) {
  let worst: MethodResult | null = null;
  for (const method of METHODS) {
    if (!coeffMethods[method]) continue;
    const r = results[method][profileIndex];
    if (!r || r.error) continue;
    if (!worst || r.upstreamWsel > worst.upstreamWsel) {
      worst = r;
    }
  }
  return worst;
}

function pctDiff(appVal: number, hecVal: number): number | null {
  if (hecVal === 0) return null;
  return ((appVal - hecVal) / hecVal) * 100;
}

function divergenceBadge(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground">&mdash;</span>;
  const abs = Math.abs(pct);
  const color = abs < 5
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : abs < 10
    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  return <Badge variant="outline" className={`text-xs font-mono ${color}`}>{pct.toFixed(1)}%</Badge>;
}

function cellBgClass(pct: number | null): string {
  if (pct === null) return '';
  const abs = Math.abs(pct);
  if (abs < 5) return 'bg-emerald-500/10 text-emerald-400';
  if (abs < 10) return 'bg-amber-500/10 text-amber-400';
  return 'bg-red-500/10 text-red-400';
}

/* ─── Comparison data builder ─── */

interface ProfileComparison {
  profileName: string;
  rows: {
    parameter: string;
    appValue: number | null;
    appDisplay: string;
    hecValue: number | null;
    hecDisplay: string;
    delta: string;
    pctDelta: number | null;
    rootCause: string | null;
  }[];
}

function buildComparisons(
  results: CalculationResults,
  comparison: HecRasComparison[],
  profileNames: string[],
  coeffMethods: Record<string, boolean>,
  us: 'imperial' | 'metric',
): ProfileComparison[] {
  return profileNames.map((name, i) => {
    const worst = getWorstCase(results, i, coeffMethods);
    const hec = comparison.find((c) => c.profileName === name);

    // Check per-method divergences for root cause analysis
    const methodPcts: Record<string, { wsel: number | null; headLoss: number | null }> = {};
    for (const method of METHODS) {
      if (!coeffMethods[method]) continue;
      const r = results[method][i];
      if (!r || r.error) continue;
      methodPcts[method] = {
        wsel: hec?.upstreamWsel ? pctDiff(r.upstreamWsel, hec.upstreamWsel) : null,
        headLoss: hec?.headLoss ? pctDiff(r.totalHeadLoss, hec.headLoss) : null,
      };
    }

    const wselPcts = Object.values(methodPcts).map((v) => v.wsel).filter((v) => v !== null);
    const hlPcts = Object.values(methodPcts).map((v) => v.headLoss).filter((v) => v !== null);
    const yarnellWselPct = methodPcts.yarnell?.wsel;
    const nonYarnellWselPcts = Object.entries(methodPcts)
      .filter(([k]) => k !== 'yarnell')
      .map(([, v]) => v.wsel)
      .filter((v) => v !== null);

    const pattern: DivergencePattern = {
      wselDiverges: wselPcts.some((p) => Math.abs(p) > 10),
      headLossDiverges: hlPcts.some((p) => Math.abs(p) > 10),
      velocityDiverges: false, // set per-row below
      yarnellOnlyDiverges: yarnellWselPct !== null && Math.abs(yarnellWselPct) > 10
        && nonYarnellWselPcts.every((p) => Math.abs(p) < 10),
      allDiverge: wselPcts.length > 0 && wselPcts.every((p) => Math.abs(p) > 10),
    };

    const rows: ProfileComparison['rows'] = [];

    // WSEL
    const appWsel = worst ? toDisplay(worst.upstreamWsel, 'length', us) : null;
    const hecWsel = hec?.upstreamWsel != null ? hec.upstreamWsel : null;
    const hecWselDisplay = hecWsel != null ? toDisplay(hecWsel, 'length', us) : null;
    const wselPct = appWsel != null && hecWselDisplay != null ? pctDiff(appWsel, hecWselDisplay) : null;
    rows.push({
      parameter: `Upstream WSEL (${unitLabel('length', us)})`,
      appValue: appWsel,
      appDisplay: appWsel != null ? appWsel.toFixed(2) : '\u2014',
      hecValue: hecWselDisplay,
      hecDisplay: hecWselDisplay != null ? hecWselDisplay.toFixed(2) : '\u2014',
      delta: appWsel != null && hecWselDisplay != null ? (appWsel - hecWselDisplay).toFixed(3) : '\u2014',
      pctDelta: wselPct,
      rootCause: wselPct != null && Math.abs(wselPct) > 10 ? getRootCause('Upstream WSEL', pattern) : null,
    });

    // Head Loss
    const appHL = worst ? toDisplay(worst.totalHeadLoss, 'length', us) : null;
    const hecHL = hec?.headLoss != null ? hec.headLoss : null;
    const hecHLDisplay = hecHL != null ? toDisplay(hecHL, 'length', us) : null;
    const hlPct = appHL != null && hecHLDisplay != null ? pctDiff(appHL, hecHLDisplay) : null;
    rows.push({
      parameter: `Head Loss (${unitLabel('length', us)})`,
      appValue: appHL,
      appDisplay: appHL != null ? appHL.toFixed(3) : '\u2014',
      hecValue: hecHLDisplay,
      hecDisplay: hecHLDisplay != null ? hecHLDisplay.toFixed(3) : '\u2014',
      delta: appHL != null && hecHLDisplay != null ? (appHL - hecHLDisplay).toFixed(3) : '\u2014',
      pctDelta: hlPct,
      rootCause: hlPct != null && Math.abs(hlPct) > 10 ? getRootCause('Head Loss', pattern) : null,
    });

    // Velocity (approach) -- no HEC-RAS input for this, show app value only
    const appVel = worst ? toDisplay(worst.approachVelocity, 'velocity', us) : null;
    rows.push({
      parameter: `Velocity (${unitLabel('velocity', us)})`,
      appValue: appVel,
      appDisplay: appVel != null ? appVel.toFixed(2) : '\u2014',
      hecValue: null,
      hecDisplay: '\u2014',
      delta: '\u2014',
      pctDelta: null,
      rootCause: null,
    });

    // Froude
    const appFr = worst ? worst.froudeApproach : null;
    rows.push({
      parameter: 'Froude Number',
      appValue: appFr,
      appDisplay: appFr != null ? appFr.toFixed(3) : '\u2014',
      hecValue: null,
      hecDisplay: '\u2014',
      delta: '\u2014',
      pctDelta: null,
      rootCause: null,
    });

    return { profileName: name, rows };
  });
}

/* ─── Verdict logic ─── */

function computeVerdict(profiles: ProfileComparison[]): { text: string; severity: 'pass' | 'warning' | 'fail' } {
  let maxAbs = 0;
  let countOver10 = 0;
  for (const p of profiles) {
    for (const row of p.rows) {
      if (row.pctDelta === null) continue;
      const abs = Math.abs(row.pctDelta);
      if (abs > maxAbs) maxAbs = abs;
      if (abs > 10) countOver10++;
    }
  }

  // If no HEC-RAS data entered yet
  const hasAnyHec = profiles.some((p) => p.rows.some((r) => r.hecValue !== null));
  if (!hasAnyHec) {
    return { text: 'Enter HEC-RAS values to generate QA verdict', severity: 'warning' };
  }

  if (maxAbs < 5) return { text: 'PASS \u2014 All parameters within 5%', severity: 'pass' };
  if (countOver10 > 0) return { text: `REVIEW REQUIRED \u2014 ${countOver10} parameter${countOver10 > 1 ? 's' : ''} exceed${countOver10 === 1 ? 's' : ''} 10%`, severity: 'fail' };
  return { text: 'ACCEPTABLE \u2014 All within 10%', severity: 'warning' };
}

/* ─── Export handler ─── */

async function downloadMemo(data: QaqcMemoData) {
  const blob = await pdf(<QaqcMemoPdf data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qaqc-memo.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Component ─── */

export function QaqcPanel() {
  const results = useProjectStore((s) => s.results);
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const projectName = useProjectStore((s) => s.projectName);
  const us = useProjectStore((s) => s.unitSystem);

  const profileNames = useMemo(() => flowProfiles.map((p) => p.name), [flowProfiles]);

  const comparisons = useMemo(() => {
    if (!results) return [];
    return buildComparisons(results, comparison, profileNames, coefficients.methodsToRun, us);
  }, [results, comparison, profileNames, coefficients.methodsToRun, us]);

  const verdict = useMemo(() => computeVerdict(comparisons), [comparisons]);

  const handleExport = useCallback(() => {
    const memoData: QaqcMemoData = {
      projectName,
      date: new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }),
      verdict: verdict.text,
      verdictSeverity: verdict.severity,
      profiles: comparisons.map((p): QaqcProfileData => ({
        profileName: p.profileName,
        rows: p.rows.map((r): QaqcComparisonRow => ({
          parameter: r.parameter,
          appValue: r.appDisplay,
          hecRasValue: r.hecDisplay,
          delta: r.delta,
          pctDelta: r.pctDelta,
          rootCause: r.rootCause,
        })),
      })),
    };
    downloadMemo(memoData);
  }, [projectName, verdict, comparisons]);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calculator className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Run calculations to see QA/QC comparisons</p>
      </div>
    );
  }

  const verdictIcon = verdict.severity === 'pass'
    ? <CheckCircle2 className="h-4 w-4" />
    : verdict.severity === 'fail'
    ? <AlertTriangle className="h-4 w-4" />
    : <ShieldCheck className="h-4 w-4" />;

  const verdictBadgeColor = verdict.severity === 'pass'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : verdict.severity === 'fail'
    ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

  return (
    <div className="space-y-6">
      {/* Verdict + Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                QA/QC Comparison
              </CardTitle>
              <CardDescription className="text-pretty max-w-prose">
                Compare worst-case results (highest WSEL across enabled methods) against HEC-RAS.
                Enter HEC-RAS values below or import from a .r01 file.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-3.5 w-3.5" />
              Export Memo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className={`text-sm px-3 py-1.5 font-medium ${verdictBadgeColor}`}>
            <span className="mr-2">{verdictIcon}</span>
            {verdict.text}
          </Badge>
        </CardContent>
      </Card>

      {/* HEC-RAS Data Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">HEC-RAS Reference Values</CardTitle>
          <CardDescription className="text-xs">
            Enter upstream WSEL and head loss from HEC-RAS for each profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[400px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs w-[160px]">Field</TableHead>
                  {profileNames.map((n) => <TableHead key={n} className="text-xs text-right">{n}</TableHead>)}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <HecRasInputRow profileNames={profileNames} field="upstreamWsel" spacer />
                <HecRasInputRow profileNames={profileNames} field="headLoss" spacer />
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Per-profile comparison tables */}
      {comparisons.map((profile) => (
        <Card key={profile.profileName}>
          <CardHeader>
            <CardTitle className="text-sm">{profile.profileName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs w-[180px]">Parameter</TableHead>
                    <TableHead className="text-xs text-right">This App</TableHead>
                    <TableHead className="text-xs text-right">HEC-RAS</TableHead>
                    <TableHead className="text-xs text-right">&Delta;</TableHead>
                    <TableHead className="text-xs text-right">% Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.rows.map((row) => (
                    <React.Fragment key={row.parameter}>
                      <TableRow className="even:bg-muted/10">
                        <TableCell className="text-sm">{row.parameter}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{row.appDisplay}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{row.hecDisplay}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{row.delta}</TableCell>
                        <TableCell className={`text-right ${cellBgClass(row.pctDelta)}`}>
                          {divergenceBadge(row.pctDelta)}
                        </TableCell>
                      </TableRow>
                      {row.rootCause && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={5} className="pt-0 pb-2 pl-6">
                            <span className="text-xs text-red-400 flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              {row.rootCause}
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
