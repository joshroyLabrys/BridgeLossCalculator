'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import { CrossSectionPoint } from '@/engine/types';
import { CrossSectionChart } from '@/components/cross-section-chart';
import { toImperial, toDisplay, unitLabel } from '@/lib/units';

export function CrossSectionForm() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const us = useProjectStore((s) => s.unitSystem);

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
      {/* Left: Data entry */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Station / Elevation Points</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_40px] gap-1 p-2 text-xs text-muted-foreground border-b">
            <div>#</div>
            <div>Station ({unitLabel('length', us)})</div>
            <div>Elevation ({unitLabel('length', us)})</div>
            <div>Manning&apos;s n</div>
            <div>Bank</div>
            <div></div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {crossSection.map((point, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_40px] gap-1 p-1 items-center">
                <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
                <Input
                  type="number"
                  value={toDisplay(point.station, 'length', us)}
                  onChange={(e) => updatePoint(i, 'station', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={toDisplay(point.elevation, 'length', us)}
                  onChange={(e) => updatePoint(i, 'elevation', e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={point.manningsN}
                  onChange={(e) => updatePoint(i, 'manningsN', e.target.value)}
                  className="h-8 text-sm"
                  step="0.001"
                />
                <Select
                  value={point.bankStation ?? '—'}
                  onValueChange={(v) => updatePoint(i, 'bankStation', v ?? '—')}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="—">—</SelectItem>
                    <SelectItem value="left">Left Bank</SelectItem>
                    <SelectItem value="right">Right Bank</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeRow(i)}>
                  ×
                </Button>
              </div>
            ))}
          </div>
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addRow} className="w-full">
              + Add Row
            </Button>
          </div>
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Cross-Section Preview</h3>
        <div className="rounded-lg border bg-card h-[300px] p-4">
          <CrossSectionChart crossSection={crossSection} />
        </div>
        <p className="text-xs text-muted-foreground">Live preview updates as you enter data</p>
      </div>
    </div>
  );
}
