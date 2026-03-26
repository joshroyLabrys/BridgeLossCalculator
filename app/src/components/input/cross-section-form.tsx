'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { CrossSectionPoint } from '@/engine/types';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { Plus, Trash2 } from 'lucide-react';

export function CrossSectionForm() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);

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
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">Station (ft)</TableHead>
                    <TableHead className="text-xs">Elevation (ft)</TableHead>
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
                        <Input type="number" value={point.station} onChange={(e) => updatePoint(i, 'station', e.target.value)} className="h-8 text-sm font-mono" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={point.elevation} onChange={(e) => updatePoint(i, 'elevation', e.target.value)} className="h-8 text-sm font-mono" />
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
            <div className="p-2 border-t">
              <Button variant="outline" size="sm" onClick={addRow} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Row
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
