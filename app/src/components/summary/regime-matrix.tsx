'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';

const METHOD_COLORS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

const regimeStyle = {
  'free-surface': { label: 'F', full: 'Free Surface', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'pressure': { label: 'P', full: 'Pressure', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'overtopping': { label: 'O', full: 'Overtopping', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

export function RegimeMatrix() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
  const profileNames = flowProfiles.map((p) => p.name);

  // Check if any methods disagree on regime for a given profile
  const hasRegimeDisagreement = profileNames.some((_, pi) => {
    const regimes = methods.map((m) => results[m]?.[pi]?.flowRegime).filter(Boolean);
    return new Set(regimes).size > 1;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow Regime Matrix</CardTitle>
        <CardDescription className="max-w-prose text-pretty">
          Flow regime determines which methods are valid. Yarnell is derived for free-surface conditions
          only — results under pressure or overtopping should be treated with caution.
        </CardDescription>
        {hasRegimeDisagreement && (
          <p className="text-sm text-amber-400 max-w-prose text-pretty">
            Methods disagree on regime for one or more profiles — the bridge may be near a flow
            transition and results carry higher uncertainty.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <colgroup>
            <col className="w-[180px]" />
            {profileNames.map((n) => <col key={n} className="w-[110px]" />)}
            <col />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs">Method</TableHead>
              {profileNames.map((n) => <TableHead key={n} className="text-xs text-center">{n}</TableHead>)}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((method) => (
              <TableRow key={method} className="even:bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${METHOD_COLORS[method]}`} />
                    <span>{method === 'wspro' ? 'WSPRO' : method.charAt(0).toUpperCase() + method.slice(1)}</span>
                  </div>
                </TableCell>
                {results[method].map((r, i) => {
                  const style = regimeStyle[r.flowRegime];
                  const isYarnellInvalid = method === 'yarnell' && r.flowRegime !== 'free-surface';
                  return (
                    <TableCell key={i} className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <Badge variant="outline" className={`text-xs ${style.className} ${isYarnellInvalid ? 'opacity-60' : ''}`} title={style.full}>
                          {style.label}
                        </Badge>
                        {isYarnellInvalid && (
                          <span title="Yarnell not valid for this flow regime">
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
          <span><Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30 mr-1">F</Badge> Free Surface</span>
          <span><Badge variant="outline" className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/30 mr-1">P</Badge> Pressure</span>
          <span><Badge variant="outline" className="text-[10px] bg-purple-500/15 text-purple-400 border-purple-500/30 mr-1">O</Badge> Overtopping</span>
        </div>
      </CardContent>
    </Card>
  );
}
