'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { computeFreeboard } from '@/engine/freeboard';
import { unitLabel, toDisplay } from '@/lib/units';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

const STATUS_STYLE = {
  clear: { label: 'CLEAR', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  low: { label: 'LOW', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pressure: { label: 'PRESSURE', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  overtopping: { label: 'OVERTOPPING', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
const METHOD_LABELS: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

export function FreeboardCheck() {
  const results = useProjectStore((s) => s.results);
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const profiles = useProjectStore((s) => s.flowProfiles);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const qUnit = unitLabel('discharge', us);

  if (!results || results.energy.length === 0) return null;

  const freeboard = computeFreeboard(results.energy, bridge, profiles);

  // Find the worst-case (highest) US WSEL across all methods for each profile
  const worstCaseMethod: (string | null)[] = profiles.map((_, i) => {
    let worstMethod: string | null = null;
    let worstWsel = -Infinity;
    for (const m of METHODS) {
      const r = results[m]?.[i];
      if (r && !r.error && r.upstreamWsel > worstWsel) {
        worstWsel = r.upstreamWsel;
        worstMethod = m;
      }
    }
    return worstMethod !== 'energy' ? worstMethod : null;
  });

  const hasWorseMethod = worstCaseMethod.some((m) => m !== null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Freeboard Check</CardTitle>
        </div>
        <CardDescription className="max-w-prose text-pretty">
          Clearance between computed upstream WSEL (Energy method, standard 1D approach) and the bridge
          low chord. Positive = clearance below deck; negative = pressure flow or overtopping.
        </CardDescription>
        {hasWorseMethod && (
          <p className="text-sm text-amber-400 max-w-prose text-pretty">
            <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />
            Another method produces a higher upstream WSEL for one or more profiles — see notes below.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs">Profile</TableHead>
              <TableHead className="text-xs">ARI</TableHead>
              <TableHead className="text-xs text-right">Q ({qUnit})</TableHead>
              <TableHead className="text-xs text-right">DS WSEL ({len})</TableHead>
              <TableHead className="text-xs text-right">US WSEL ({len})</TableHead>
              <TableHead className="text-xs text-right">Low Chord ({len})</TableHead>
              <TableHead className="text-xs text-right">Freeboard ({len})</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {freeboard.profiles.map((r, i) => {
              const style = STATUS_STYLE[r.status];
              const worse = worstCaseMethod[i];
              return (
                <TableRow key={i} className="even:bg-muted/20">
                  <TableCell className="font-medium">{r.profileName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.ari || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.discharge, 'discharge', us).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.dsWsel, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {toDisplay(r.usWsel, 'length', us).toFixed(2)}
                    {worse && (
                      <span className="ml-1.5 inline-block text-amber-400" title={`${METHOD_LABELS[worse]} gives higher WSEL`}>
                        <AlertTriangle className="h-3 w-3 -mt-0.5 inline" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.lowChord, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.freeboard, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`text-xs ${style.className}`}>{style.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="space-y-1 text-sm text-muted-foreground">
          {freeboard.zeroFreeboardQ !== null ? (
            <span>Estimated Q at zero freeboard: <span className="font-mono font-medium text-foreground">{toDisplay(freeboard.zeroFreeboardQ, 'discharge', us).toFixed(0)} {qUnit}</span> (interpolated)</span>
          ) : freeboard.profiles.every(p => p.freeboard > 0) ? (
            <span>All profiles have positive freeboard.</span>
          ) : (
            <span>All profiles exceed low chord.</span>
          )}
          {worstCaseMethod.map((worse, i) => {
            if (!worse) return null;
            const energyWsel = results.energy[i].upstreamWsel;
            const worseResult = results[worse as keyof typeof results][i];
            if (!worseResult || worseResult.error) return null;
            const diff = worseResult.upstreamWsel - energyWsel;
            return (
              <div key={i} className="flex items-start gap-1.5 text-amber-400 text-xs">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  {profiles[i].name}: {METHOD_LABELS[worse]} gives US WSEL {toDisplay(diff, 'length', us).toFixed(3)} {len} higher
                  than Energy ({toDisplay(worseResult.upstreamWsel, 'length', us).toFixed(2)} vs {toDisplay(energyWsel, 'length', us).toFixed(2)})
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
