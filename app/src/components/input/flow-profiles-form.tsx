'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@/engine/types';
import { toDisplay, toImperial, unitLabel, UnitType } from '@/lib/units';
import { Plus, Trash2 } from 'lucide-react';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);
  const us = useProjectStore((s) => s.unitSystem);

  function addProfile() {
    update([...profiles, { name: '', ari: '', discharge: 0, dsWsel: 0, channelSlope: 0.001, contractionLength: 0, expansionLength: 0 }]);
  }

  function removeProfile(index: number) { update(profiles.filter((_, i) => i !== index)); }

  const fieldUnitType: Record<string, UnitType | null> = {
    name: null, discharge: 'discharge', dsWsel: 'length',
    channelSlope: 'slope', contractionLength: 'length', expansionLength: 'length',
  };

  function updateProfile(index: number, field: keyof FlowProfile, value: string) {
    const updated = [...profiles];
    if (field === 'name') { updated[index] = { ...updated[index], name: value }; }
    else {
      const ut = fieldUnitType[field];
      const raw = parseFloat(value) || 0;
      updated[index] = { ...updated[index], [field]: ut ? toImperial(raw, ut, us) : raw };
    }
    update(updated);
  }

  const columns = [
    { key: 'name', label: 'Name', type: 'text', unitType: null as UnitType | null },
    { key: 'discharge', label: `Q (${unitLabel('discharge', us)})`, type: 'number', unitType: 'discharge' as UnitType | null },
    { key: 'dsWsel', label: `DS WSEL (${unitLabel('length', us)})`, type: 'number', unitType: 'length' as UnitType | null },
    { key: 'channelSlope', label: `Slope (${unitLabel('slope', us)})`, type: 'number', unitType: null as UnitType | null },
    { key: 'contractionLength', label: `Contr. L (${unitLabel('length', us)})`, type: 'number', unitType: 'length' as UnitType | null },
    { key: 'expansionLength', label: `Expan. L (${unitLabel('length', us)})`, type: 'number', unitType: 'length' as UnitType | null },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flow Profiles</CardTitle>
        <CardDescription>Define up to 10 discharge scenarios with downstream boundary conditions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 text-xs">#</TableHead>
                  {columns.map((c) => <TableHead key={c.key} className="text-xs">{c.label}</TableHead>)}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile, i) => (
                  <TableRow key={i} className="even:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.key}>
                        <Input type={c.type} value={c.unitType ? toDisplay((profile as unknown as Record<string, number>)[c.key], c.unitType, us) : (profile as unknown as Record<string, string | number>)[c.key]} onChange={(e) => updateProfile(i, c.key as keyof FlowProfile, e.target.value)} className={`h-8 text-sm ${c.type === 'number' ? 'font-mono' : ''}`} step={c.key === 'channelSlope' ? '0.0001' : undefined} />
                      </TableCell>
                    ))}
                    <TableCell><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeProfile(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addProfile} className="w-full" disabled={profiles.length >= 10}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Profile</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
