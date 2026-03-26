'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProjectStore } from '@/store/project-store';
import { BridgeGeometry, Pier } from '@/engine/types';
import { toDisplay, toImperial, unitLabel } from '@/lib/units';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function BridgeGeometryForm() {
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const update = useProjectStore((s) => s.updateBridgeGeometry);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  const lengthFields = new Set(['lowChordLeft', 'lowChordRight', 'highChord', 'leftAbutmentStation', 'rightAbutmentStation']);

  function setField(field: string, value: string) {
    const raw = parseFloat(value) || 0;
    update({ ...bridge, [field]: lengthFields.has(field) ? toImperial(raw, 'length', us) : raw });
  }

  function addPier() {
    update({ ...bridge, piers: [...bridge.piers, { station: 0, width: 3, shape: 'round-nose' }] });
  }

  function removePier(index: number) {
    update({ ...bridge, piers: bridge.piers.filter((_, i) => i !== index) });
  }

  function updatePier(index: number, field: keyof Pier, value: string) {
    const piers = [...bridge.piers];
    if (field === 'shape') {
      piers[index] = { ...piers[index], shape: value as Pier['shape'] };
    } else {
      piers[index] = { ...piers[index], [field]: toImperial(parseFloat(value) || 0, 'length', us) };
    }
    update({ ...bridge, piers });
  }

  const fields = [
    { key: 'lowChordLeft', label: 'Low Chord Elev. (Left)', unit: lenUnit },
    { key: 'lowChordRight', label: 'Low Chord Elev. (Right)', unit: lenUnit },
    { key: 'highChord', label: 'High Chord Elevation', unit: lenUnit },
    { key: 'leftAbutmentStation', label: 'Left Abutment Station', unit: lenUnit },
    { key: 'rightAbutmentStation', label: 'Right Abutment Station', unit: lenUnit },
    { key: 'leftAbutmentSlope', label: 'Left Abutment Slope', unit: 'H:V' },
    { key: 'rightAbutmentSlope', label: 'Right Abutment Slope', unit: 'H:V' },
    { key: 'skewAngle', label: 'Skew Angle', unit: 'deg' },
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opening Geometry</CardTitle>
          <CardDescription>Bridge opening dimensions, abutment locations, and skew</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label} <span className="text-muted-foreground/60">({f.unit})</span></Label>
                <Input type="number" value={lengthFields.has(f.key) ? toDisplay((bridge as unknown as Record<string, number>)[f.key], 'length', us) : (bridge as unknown as Record<string, number>)[f.key]} onChange={(e) => setField(f.key, e.target.value)} className="h-8 text-sm font-mono" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pier Data</CardTitle>
          <CardDescription>Define pier locations, widths, and nose shapes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 text-xs">#</TableHead>
                  <TableHead className="text-xs">Station ({lenUnit})</TableHead>
                  <TableHead className="text-xs">Width ({lenUnit})</TableHead>
                  <TableHead className="text-xs">Shape</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridge.piers.map((pier, i) => (
                  <TableRow key={i} className="even:bg-muted/20">
                    <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                    <TableCell><Input type="number" value={toDisplay(pier.station, 'length', us)} onChange={(e) => updatePier(i, 'station', e.target.value)} className="h-8 text-sm font-mono" /></TableCell>
                    <TableCell><Input type="number" value={toDisplay(pier.width, 'length', us)} onChange={(e) => updatePier(i, 'width', e.target.value)} className="h-8 text-sm font-mono" /></TableCell>
                    <TableCell>
                      <Select value={pier.shape} onValueChange={(v) => updatePier(i, 'shape', v ?? '')}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="square">Square</SelectItem>
                          <SelectItem value="round-nose">Round-nose</SelectItem>
                          <SelectItem value="cylindrical">Cylindrical</SelectItem>
                          <SelectItem value="sharp">Sharp</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePier(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-2 border-t">
              <Button variant="outline" size="sm" onClick={addPier} className="w-full"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Pier</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LowChordProfile bridge={bridge} update={update} />
    </div>
  );
}

function LowChordProfile({ bridge, update }: { bridge: BridgeGeometry; update: (b: BridgeGeometry) => void }) {
  const [open, setOpen] = useState(false);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);
  const profile = bridge.lowChordProfile;

  function addPoint() { update({ ...bridge, lowChordProfile: [...profile, { station: 0, elevation: 0 }] }); }
  function removePoint(i: number) { update({ ...bridge, lowChordProfile: profile.filter((_, idx) => idx !== i) }); }
  function updatePoint(i: number, field: 'station' | 'elevation', value: string) {
    const pts = [...profile];
    pts[i] = { ...pts[i], [field]: toImperial(parseFloat(value) || 0, 'length', us) };
    update({ ...bridge, lowChordProfile: pts });
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CardTitle>Low Chord Profile</CardTitle>
            <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
          </CollapsibleTrigger>
          <CardDescription>Custom low chord elevations. If blank, linearly interpolates between left and right.</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">#</TableHead>
                    <TableHead className="text-xs">Station ({lenUnit})</TableHead>
                    <TableHead className="text-xs">Elevation ({lenUnit})</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.map((pt, i) => (
                    <TableRow key={i} className="even:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell><Input type="number" value={toDisplay(pt.station, 'length', us)} onChange={(e) => updatePoint(i, 'station', e.target.value)} className="h-8 text-sm font-mono" /></TableCell>
                      <TableCell><Input type="number" value={toDisplay(pt.elevation, 'length', us)} onChange={(e) => updatePoint(i, 'elevation', e.target.value)} className="h-8 text-sm font-mono" /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePoint(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-2 border-t">
                <Button variant="outline" size="sm" onClick={addPoint} className="w-full"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Point</Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
