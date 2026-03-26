'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { FlowProfile } from '@/engine/types';

export function FlowProfilesForm() {
  const profiles = useProjectStore((s) => s.flowProfiles);
  const update = useProjectStore((s) => s.updateFlowProfiles);

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
    } else {
      updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 };
    }
    update(updated);
  }

  const columns = [
    { key: 'name', label: 'Profile Name', type: 'text' },
    { key: 'discharge', label: 'Q (cfs)', type: 'number' },
    { key: 'dsWsel', label: 'DS WSEL (ft)', type: 'number' },
    { key: 'channelSlope', label: 'Slope (ft/ft)', type: 'number' },
    { key: 'contractionLength', label: 'Contraction L (ft)', type: 'number' },
    { key: 'expansionLength', label: 'Expansion L (ft)', type: 'number' },
  ] as const;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Flow Profiles (up to 10)</h3>
      <div className="rounded-lg border overflow-x-auto">
        <div className="grid grid-cols-[40px_repeat(6,1fr)_40px] gap-1 p-2 text-xs text-muted-foreground border-b min-w-[700px]">
          <div>#</div>
          {columns.map((c) => <div key={c.key}>{c.label}</div>)}
          <div></div>
        </div>
        {profiles.map((profile, i) => (
          <div key={i} className="grid grid-cols-[40px_repeat(6,1fr)_40px] gap-1 p-1 items-center min-w-[700px]">
            <span className="text-xs text-muted-foreground pl-1">{i + 1}</span>
            {columns.map((c) => (
              <Input
                key={c.key}
                type={c.type}
                value={(profile as unknown as Record<string, string | number>)[c.key]}
                onChange={(e) => updateProfile(i, c.key as keyof FlowProfile, e.target.value)}
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
