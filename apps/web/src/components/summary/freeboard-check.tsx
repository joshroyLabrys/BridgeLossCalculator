'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@flowsuite/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@flowsuite/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@flowsuite/ui';
import { computeFreeboard } from '@flowsuite/engine/freeboard';
import { unitLabel, toDisplay } from '@flowsuite/data';
import { ShieldCheck } from 'lucide-react';
import { ReactNode } from 'react';

const STATUS_STYLE = {
  clear: { label: 'CLEAR', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  low: { label: 'LOW', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pressure: { label: 'PRESSURE', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  overtopping: { label: 'OVERTOPPING', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export function FreeboardCheck({ callout }: { callout?: ReactNode } = {}) {
  const results = useProjectStore((s) => s.results);
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const profiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const qUnit = unitLabel('discharge', us);

  if (!results) return null;

  const freeboard = computeFreeboard(results, bridge, profiles, coefficients.freeboardThreshold);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Freeboard Check</CardTitle>
            </div>
            <CardDescription className="text-pretty">
              Clearance between worst-case upstream WSEL (envelope across all methods) and the bridge
              low chord. Positive = clearance below deck; negative = pressure flow or overtopping.
            </CardDescription>
          </div>
          {callout && <div className="w-full sm:w-[45%] shrink-0">{callout}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
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
              return (
                <TableRow key={i} className="even:bg-muted/20">
                  <TableCell className="font-medium">{r.profileName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.ari || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.discharge, 'discharge', us).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.dsWsel, 'length', us).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{toDisplay(r.usWsel, 'length', us).toFixed(2)}</TableCell>
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
        </div>
        <div className="flex flex-col sm:flex-row sm:space-y-0 space-y-1 text-sm text-muted-foreground">
          {freeboard.zeroFreeboardQ !== null ? (
            <span>Estimated Q at zero freeboard: <span className="font-mono font-medium text-foreground">{toDisplay(freeboard.zeroFreeboardQ, 'discharge', us).toFixed(0)} {qUnit}</span> (interpolated)</span>
          ) : freeboard.profiles.every(p => p.freeboard > 0) ? (
            <span>All profiles have positive freeboard.</span>
          ) : (
            <span>All profiles exceed low chord.</span>
          )}
          <span className="text-muted-foreground ml-4">Low threshold: <span className="font-mono font-medium text-foreground">{toDisplay(coefficients.freeboardThreshold, 'length', us).toFixed(2)} {len}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
