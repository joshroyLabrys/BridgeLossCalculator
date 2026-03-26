'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@/engine/types';
import { Plus, Trash2 } from 'lucide-react';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);

  function addProfile() {
    update([...profiles, { name: '', discharge: 0, dsWsel: 0, channelSlope: 0.001, contractionLength: 0, expansionLength: 0 }]);
  }

  function removeProfile(index: number) { update(profiles.filter((_, i) => i !== index)); }

  function updateProfile(index: number, field: keyof FlowProfile, value: string) {
    const updated = [...profiles];
    if (field === 'name') { updated[index] = { ...updated[index], name: value }; }
    else { updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 }; }
    update(updated);
  }

  const columns = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'discharge', label: 'Q (cfs)', type: 'number' },
    { key: 'dsWsel', label: 'DS WSEL (ft)', type: 'number' },
    { key: 'channelSlope', label: 'Slope (ft/ft)', type: 'number' },
    { key: 'contractionLength', label: 'Contr. L (ft)', type: 'number' },
    { key: 'expansionLength', label: 'Expan. L (ft)', type: 'number' },
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
                        <Input type={c.type} value={(profile as unknown as Record<string, string | number>)[c.key]} onChange={(e) => updateProfile(i, c.key as keyof FlowProfile, e.target.value)} className={`h-8 text-sm ${c.type === 'number' ? 'font-mono' : ''}`} step={c.key === 'channelSlope' ? '0.0001' : undefined} />
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
