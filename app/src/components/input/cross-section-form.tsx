'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { CrossSectionPoint } from '@/engine/types';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { toDisplay, toImperial, unitLabel } from '@/lib/units';
import { Plus, Trash2, Landmark, Upload } from 'lucide-react';
import { useRef } from 'react';

export function CrossSectionForm() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const results = useProjectStore((s) => s.results);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const us = useProjectStore((s) => s.unitSystem);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const lenUnit = unitLabel('length', us);

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.trim().split(/\r?\n/);
      const points: CrossSectionPoint[] = [];
      for (const line of lines) {
        const cols = line.split(/[,\t]/);
        if (cols.length < 2) continue;
        const station = parseFloat(cols[0]);
        const elevation = parseFloat(cols[1]);
        if (isNaN(station) || isNaN(elevation)) continue;
        const manningsN = cols[2] ? parseFloat(cols[2]) : 0.035;
        const bankRaw = cols[3]?.trim().toLowerCase();
        const bankStation = bankRaw === 'left' ? 'left' as const : bankRaw === 'right' ? 'right' as const : null;
        points.push({ station, elevation, manningsN: isNaN(manningsN) ? 0.035 : manningsN, bankStation });
      }
      if (points.length > 0) updateCrossSection(points);
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  }

  function addRow() {
    updateCrossSection([
      ...crossSection,
      { station: 0, elevation: 0, manningsN: 0.035, bankStation: null },
    ]);
  }

  function removeRow(index: number) {
    updateCrossSection(crossSection.filter((_, i) => i !== index));
  }

  function updatePoint(index: number, field: keyof CrossSectionPoint, value: string) {
    const updated = [...crossSection];
    if (field === 'bankStation') {
      updated[index] = { ...updated[index], bankStation: value === '—' ? null : value as 'left' | 'right' };
    } else if (field === 'station' || field === 'elevation') {
      updated[index] = { ...updated[index], [field]: toImperial(parseFloat(value) || 0, 'length', us) };
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    updateCrossSection(updated);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cross-Section Data</CardTitle>
          <CardDescription>Define station/elevation points for the channel cross-section</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">Station ({lenUnit})</TableHead>
                    <TableHead className="text-xs">Elevation ({lenUnit})</TableHead>
                    <TableHead className="text-xs">Manning's n</TableHead>
                    <TableHead className="text-xs">Bank</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossSection.map((point, i) => (
                    <TableRow key={i} className="even:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <Input type="number" value={toDisplay(point.station, 'length', us)} onChange={(e) => updatePoint(i, 'station', e.target.value)} className="h-8 text-sm font-mono" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={toDisplay(point.elevation, 'length', us)} onChange={(e) => updatePoint(i, 'elevation', e.target.value)} className="h-8 text-sm font-mono" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={point.manningsN} onChange={(e) => updatePoint(i, 'manningsN', e.target.value)} className="h-8 text-sm font-mono" step="0.001" />
                      </TableCell>
                      <TableCell>
                        <Select value={point.bankStation ?? '—'} onValueChange={(v) => updatePoint(i, 'bankStation', v ?? '—')}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="—">—</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-2 border-t flex gap-2">
              <Button variant="outline" size="sm" onClick={addRow} className="flex-1">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Row
              </Button>
              <input ref={csvInputRef} type="file" accept=".csv,.txt,.tsv" onChange={handleCsvImport} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} className="flex-1">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Live preview updates as you enter data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <CrossSectionChart crossSection={crossSection} />
            </div>
          </CardContent>
        </Card>

        <BridgeOverlayChart
          crossSection={crossSection}
          bridgeGeometry={bridgeGeometry}
          flowProfiles={flowProfiles}
          results={results}
        />
      </div>
    </div>
  );
}

function BridgeOverlayChart({ crossSection, bridgeGeometry, flowProfiles, results }: {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: ReturnType<typeof useProjectStore.getState>['bridgeGeometry'];
  flowProfiles: ReturnType<typeof useProjectStore.getState>['flowProfiles'];
  results: ReturnType<typeof useProjectStore.getState>['results'];
}) {
  const methodWsels: Record<string, number> = {};
  if (results) {
    for (const method of ['energy', 'momentum', 'yarnell', 'wspro'] as const) {
      const r = results[method][0];
      if (r && !r.error) methodWsels[method] = r.upstreamWsel;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Bridge Overlay</CardTitle>
        </div>
        <CardDescription>Cross-section with bridge geometry, piers, and water surface</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <CrossSectionChart
            crossSection={crossSection}
            bridge={bridgeGeometry}
            wsel={flowProfiles[0]?.dsWsel}
            methodWsels={Object.keys(methodWsels).length > 0 ? methodWsels : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}
