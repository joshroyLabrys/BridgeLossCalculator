'use client';

import { Label } from '@flowsuite/ui';
import { Button } from '@flowsuite/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@flowsuite/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@flowsuite/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@flowsuite/ui';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@flowsuite/ui';
import { NumericInput } from '@flowsuite/ui';
import { useProjectStore } from '@/store/project-store';
import { BridgeGeometry, Pier } from '@flowsuite/engine/types';
import { toDisplay, toImperial, unitLabel } from '@flowsuite/data';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function BridgeGeometryForm() {
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const update = useProjectStore((s) => s.updateBridgeGeometry);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  const lengthFields = new Set(['lowChordLeft', 'lowChordRight', 'highChord', 'leftAbutmentStation', 'rightAbutmentStation', 'contractionLength', 'expansionLength', 'deckWidth']);

  function commitField(field: string, raw: number) {
    update({ ...bridge, [field]: lengthFields.has(field) ? toImperial(raw, 'length', us) : raw });
  }

  function addPier() {
    update({ ...bridge, piers: [...bridge.piers, { station: 0, width: 3, shape: 'round-nose' }] });
  }

  function removePier(index: number) {
    update({ ...bridge, piers: bridge.piers.filter((_, i) => i !== index) });
  }

  function commitPierNum(index: number, field: 'station' | 'width', raw: number) {
    const piers = [...bridge.piers];
    piers[index] = { ...piers[index], [field]: toImperial(raw, 'length', us) };
    update({ ...bridge, piers });
  }

  function updatePierShape(index: number, value: string) {
    const piers = [...bridge.piers];
    piers[index] = { ...piers[index], shape: value as Pier['shape'] };
    update({ ...bridge, piers });
  }

  const fields = [
    { key: 'lowChordLeft', label: 'Low Chord Elev. (Left)', unit: lenUnit },
    { key: 'lowChordRight', label: 'Low Chord Elev. (Right)', unit: lenUnit },
    { key: 'highChord', label: 'High Chord Elevation', unit: lenUnit },
    { key: 'leftAbutmentStation', label: 'Left Abutment Station', unit: lenUnit },
    { key: 'rightAbutmentStation', label: 'Right Abutment Station', unit: lenUnit },
    { key: 'skewAngle', label: 'Skew Angle', unit: 'deg' },
    { key: 'contractionLength', label: 'Contraction Length', unit: lenUnit },
    { key: 'expansionLength', label: 'Expansion Length', unit: lenUnit },
  ] as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opening Geometry</CardTitle>
          <CardDescription>Bridge opening dimensions, abutment locations, and skew</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label} <span className="text-muted-foreground/60">({f.unit})</span></Label>
                <NumericInput
                  value={lengthFields.has(f.key) ? toDisplay((bridge as unknown as Record<string, number>)[f.key], 'length', us) : (bridge as unknown as Record<string, number>)[f.key]}
                  onCommit={(v) => commitField(f.key, v)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            ))}
          </div>

          <div className="h-px bg-border/50 mt-6 mb-4" />
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Pressure / Overtopping</div>
          <p className="text-xs text-muted-foreground mb-3">Used when WSEL exceeds low chord</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Orifice Cd</Label>
              <NumericInput value={bridge.orificeCd} onCommit={(v) => commitField('orificeCd', v)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Weir Cw</Label>
              <NumericInput value={bridge.weirCw} onCommit={(v) => commitField('weirCw', v)} className="h-8 text-sm font-mono" step="0.1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deck Width ({lenUnit})</Label>
              <NumericInput value={toDisplay(bridge.deckWidth, 'length', us)} onCommit={(v) => commitField('deckWidth', v)} className="h-8 text-sm font-mono" />
            </div>
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
            <div className="overflow-x-auto">
            <Table className="min-w-[420px]">
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
                    <TableCell><NumericInput value={toDisplay(pier.station, 'length', us)} onCommit={(v) => commitPierNum(i, 'station', v)} className="h-8 text-sm font-mono" /></TableCell>
                    <TableCell><NumericInput value={toDisplay(pier.width, 'length', us)} onCommit={(v) => commitPierNum(i, 'width', v)} className="h-8 text-sm font-mono" /></TableCell>
                    <TableCell>
                      <Select value={pier.shape} onValueChange={(v) => updatePierShape(i, v ?? '')}>
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
            </div>
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
  function commitPoint(i: number, field: 'station' | 'elevation', raw: number) {
    const pts = [...profile];
    pts[i] = { ...pts[i], [field]: toImperial(raw, 'length', us) };
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
              <div className="overflow-x-auto">
              <Table className="min-w-[360px]">
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
                      <TableCell><NumericInput value={toDisplay(pt.station, 'length', us)} onCommit={(v) => commitPoint(i, 'station', v)} className="h-8 text-sm font-mono" /></TableCell>
                      <TableCell><NumericInput value={toDisplay(pt.elevation, 'length', us)} onCommit={(v) => commitPoint(i, 'elevation', v)} className="h-8 text-sm font-mono" /></TableCell>
                      <TableCell><Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removePoint(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
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
