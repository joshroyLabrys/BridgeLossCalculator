'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow Regime Matrix</CardTitle>
        <CardDescription>
          F = Free Surface, P = Pressure, O = Overtopping
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs">Method</TableHead>
              {profileNames.map((n) => <TableHead key={n} className="text-xs text-center">{n}</TableHead>)}
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
                  return (
                    <TableCell key={i} className="text-center">
                      <Badge variant="outline" className={`text-xs ${style.className}`} title={style.full}>{style.label}</Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
