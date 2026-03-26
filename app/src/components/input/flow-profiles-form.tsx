'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@/engine/types';
import { toImperial, toDisplay, unitLabel } from '@/lib/units';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);
  const us = useProjectStore((s) => s.unitSystem);

  const lengthUnit = unitLabel('length', us);
  const dischargeUnit = unitLabel('discharge', us);

  function addProfile() {
    update([
      ...profiles,
      { name: '', discharge: 0, dsWsel: 0, channelSlope: 0.001, contractionLength: 0, expansionLength: 0 },
    ]);
  }

  function removeProfile(index: number) {
    update(profiles.filter((_, i) => i !== index));
  }

  function updateProfile(index: number, field: keyof FlowProfile, value: string) {
    const updated = [...profiles];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value };
    } else if (field === 'discharge') {
      updated[index] = { ...updated[index], discharge: toImperial(parseFloat(value) || 0, 'discharge', us) };
    } else if (field === 'dsWsel' || field === 'contractionLength' || field === 'expansionLength') {
      updated[index] = { ...updated[index], [field]: toImperial(parseFloat(value) || 0, 'length', us) };
    } else {
      // channelSlope — dimensionless, store as-is
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    update(updated);
  }

  function displayValue(profile: FlowProfile, key: keyof FlowProfile): string | number {
    const raw = profile[key];
    if (key === 'name') return raw as string;
    if (key === 'discharge') return toDisplay(raw as number, 'discharge', us);
    if (key === 'dsWsel' || key === 'contractionLength' || key === 'expansionLength') {
      return toDisplay(raw as number, 'length', us);
    }
    return raw as number;
  }

  const columns = [
    { key: 'name' as keyof FlowProfile, label: 'Profile Name', type: 'text' },
    { key: 'discharge' as keyof FlowProfile, label: `Q (${dischargeUnit})`, type: 'number' },
    { key: 'dsWsel' as keyof FlowProfile, label: `DS WSEL (${lengthUnit})`, type: 'number' },
    { key: 'channelSlope' as keyof FlowProfile, label: 'Slope (ft/ft)', type: 'number' },
    { key: 'contractionLength' as keyof FlowProfile, label: `Contraction L (${lengthUnit})`, type: 'number' },
    { key: 'expansionLength' as keyof FlowProfile, label: `Expansion L (${lengthUnit})`, type: 'number' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Flow Profiles (up to 10)</h3>
      <div className="rounded-lg border overflow-x-auto">
        <div className="grid grid-cols-[40px_repeat(6,1fr)_40px] gap-1 p-2 text-xs text-muted-foreground border-b min-w-[700px]">
          <div>#</div>
          {columns.map((c) => <div key={c.key as string}>{c.label}</div>)}
          <div></div>
        </div>
        {profiles.map((profile, i) => (
          <div key={i} className="grid grid-cols-[40px_repeat(6,1fr)_40px] gap-1 p-1 items-center min-w-[700px]">
            <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
            {columns.map((c) => (
              <Input
                key={c.key as string}
                type={c.type}
                value={displayValue(profile, c.key)}
                onChange={(e) => updateProfile(i, c.key, e.target.value)}
                className="h-8 text-sm"
                step={c.key === 'channelSlope' ? '0.0001' : undefined}
              />
            ))}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeProfile(i)}>×</Button>
          </div>
        ))}
        <div className="p-2 border-t">
          <Button variant="outline" size="sm" onClick={addProfile} className="w-full" disabled={profiles.length >= 10}>
            + Add Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
