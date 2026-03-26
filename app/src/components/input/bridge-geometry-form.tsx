'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import { BridgeGeometry, Pier } from '@/engine/types';
import { toImperial, toDisplay, unitLabel } from '@/lib/units';

export function BridgeGeometryForm() {
  const bridge = useProjectStore((s) => s.bridgeGeometry);
  const update = useProjectStore((s) => s.updateBridgeGeometry);
  const us = useProjectStore((s) => s.unitSystem);

  function setField(field: string, value: string, isLength = true) {
    const raw = parseFloat(value) || 0;
    update({ ...bridge, [field]: isLength ? toImperial(raw, 'length', us) : raw });
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

  const lengthUnit = unitLabel('length', us);

  const fields = [
    { key: 'lowChordLeft', label: 'Low Chord Elevation (Left)', unit: lengthUnit, isLength: true },
    { key: 'lowChordRight', label: 'Low Chord Elevation (Right)', unit: lengthUnit, isLength: true },
    { key: 'highChord', label: 'High Chord Elevation', unit: lengthUnit, isLength: true },
    { key: 'leftAbutmentStation', label: 'Left Abutment Station', unit: lengthUnit, isLength: true },
    { key: 'rightAbutmentStation', label: 'Right Abutment Station', unit: lengthUnit, isLength: true },
    { key: 'leftAbutmentSlope', label: 'Left Abutment Slope', unit: 'H:V', isLength: false },
    { key: 'rightAbutmentSlope', label: 'Right Abutment Slope', unit: 'H:V', isLength: false },
    { key: 'skewAngle', label: 'Skew Angle', unit: unitLabel('angle', us), isLength: false },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-3">Opening Geometry</h3>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label} ({f.unit})</Label>
              <Input
                type="number"
                value={f.isLength
                  ? toDisplay((bridge as unknown as Record<string, number>)[f.key], 'length', us)
                  : (bridge as unknown as Record<string, number>)[f.key]}
                onChange={(e) => setField(f.key, e.target.value, f.isLength)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Pier Data</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-1 p-2 text-xs text-muted-foreground border-b">
            <div>#</div>
            <div>Station ({lengthUnit})</div>
            <div>Width ({lengthUnit})</div>
            <div>Shape</div>
            <div></div>
          </div>
          {bridge.piers.map((pier, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-1 p-1 items-center">
              <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
              <Input type="number" value={toDisplay(pier.station, 'length', us)} onChange={(e) => updatePier(i, 'station', e.target.value)} className="h-8 text-sm" />
              <Input type="number" value={toDisplay(pier.width, 'length', us)} onChange={(e) => updatePier(i, 'width', e.target.value)} className="h-8 text-sm" />
              <Select value={pier.shape} onValueChange={(v) => updatePier(i, 'shape', v ?? '')}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="round-nose">Round-nose</SelectItem>
                  <SelectItem value="cylindrical">Cylindrical</SelectItem>
                  <SelectItem value="sharp">Sharp</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removePier(i)}>×</Button>
            </div>
          ))}
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addPier} className="w-full">+ Add Pier</Button>
          </div>
        </div>
      </div>

      {/* Low Chord Profile (optional collapsible) */}
      <LowChordProfile bridge={bridge} update={update} us={us} />
    </div>
  );
}

function LowChordProfile({ bridge, update, us }: { bridge: BridgeGeometry; update: (b: BridgeGeometry) => void; us: 'imperial' | 'metric' }) {
  const [open, setOpen] = useState(false);
  const profile = bridge.lowChordProfile;
  const lengthUnit = unitLabel('length', us);

  function addPoint() {
    update({ ...bridge, lowChordProfile: [...profile, { station: 0, elevation: 0 }] });
  }

  function removePoint(i: number) {
    update({ ...bridge, lowChordProfile: profile.filter((_, idx) => idx !== i) });
  }

  function updatePoint(i: number, field: 'station' | 'elevation', value: string) {
    const pts = [...profile];
    pts[i] = { ...pts[i], [field]: toImperial(parseFloat(value) || 0, 'length', us) };
    update({ ...bridge, lowChordProfile: pts });
  }

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-sm font-medium flex items-center gap-2 mb-2">
        {open ? '▼' : '▶'} Low Chord Profile (optional)
      </button>
      {open && (
        <div className="rounded-lg border">
          <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-1 p-2 text-xs text-muted-foreground border-b">
            <div>#</div><div>Station ({lengthUnit})</div><div>Elevation ({lengthUnit})</div><div></div>
          </div>
          {profile.map((pt, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_1fr_40px] gap-1 p-1 items-center">
              <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
              <Input type="number" value={toDisplay(pt.station, 'length', us)} onChange={(e) => updatePoint(i, 'station', e.target.value)} className="h-8 text-sm" />
              <Input type="number" value={toDisplay(pt.elevation, 'length', us)} onChange={(e) => updatePoint(i, 'elevation', e.target.value)} className="h-8 text-sm" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removePoint(i)}>×</Button>
            </div>
          ))}
          <div className="p-2 border-t">
            <Button variant="outline" size="sm" onClick={addPoint} className="w-full">+ Add Point</Button>
          </div>
          <p className="text-xs text-muted-foreground p-2">If blank, the tool linearly interpolates between left and right low chord elevations.</p>
        </div>
      )}
    </div>
  );
}
