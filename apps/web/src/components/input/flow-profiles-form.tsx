'use client';

import { Button } from '@flowsuite/ui';
import { Input } from '@flowsuite/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@flowsuite/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@flowsuite/ui';
import { NumericInput } from '@flowsuite/ui';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@flowsuite/engine/types';
import { toDisplay, toImperial, unitLabel, UnitType } from '@flowsuite/data';
import { Plus, Trash2 } from 'lucide-react';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);
  const us = useProjectStore((s) => s.unitSystem);

  function addProfile() {
    update([...profiles, { name: '', ari: '', discharge: 0, dsWsel: 0, channelSlope: 0.001 }]);
  }

  function removeProfile(index: number) { update(profiles.filter((_, i) => i !== index)); }

  const fieldUnitType: Record<string, UnitType | null> = {
    name: null, ari: null, discharge: 'discharge', dsWsel: 'length',
    channelSlope: 'slope',
  };

  function updateProfileText(index: number, field: 'name' | 'ari', value: string) {
    const updated = [...profiles];
    updated[index] = { ...updated[index], [field]: value };
    update(updated);
  }

  function commitProfileNum(index: number, field: keyof FlowProfile, raw: number) {
    const updated = [...profiles];
    const ut = fieldUnitType[field];
    updated[index] = { ...updated[index], [field]: ut ? toImperial(raw, ut, us) : raw };
    update(updated);
  }

  const columns = [
    { key: 'name', label: 'Name', type: 'text' as const, unitType: null as UnitType | null },
    { key: 'ari', label: 'ARI/AEP', type: 'text' as const, unitType: null as UnitType | null },
    { key: 'discharge', label: `Q (${unitLabel('discharge', us)})`, type: 'number' as const, unitType: 'discharge' as UnitType | null },
    { key: 'dsWsel', label: `DS WSEL (${unitLabel('length', us)})`, type: 'number' as const, unitType: 'length' as UnitType | null },
    { key: 'channelSlope', label: `Channel Slope`, type: 'number' as const, unitType: null as UnitType | null },
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
            <Table className="min-w-[580px]">
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
                        {c.type === 'text' ? (
                          <Input
                            type="text"
                            value={(profile as unknown as Record<string, string>)[c.key]}
                            onChange={(e) => updateProfileText(i, c.key as 'name' | 'ari', e.target.value)}
                            className="h-8 text-sm"
                          />
                        ) : (
                          <NumericInput
                            value={c.unitType ? toDisplay((profile as unknown as Record<string, number>)[c.key], c.unitType, us) : (profile as unknown as Record<string, number>)[c.key]}
                            onCommit={(v) => commitProfileNum(i, c.key as keyof FlowProfile, v)}
                            className="h-8 text-sm font-mono"
                            step={c.key === 'channelSlope' ? '0.0001' : undefined}
                          />
                        )}
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
