'use client';

import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/project-store';
import { HecRasComparison } from '@/engine/types';

/**
 * Generic HEC-RAS gold input row. Pass the `field` to control which
 * HecRasComparison property is editable (upstreamWsel, headLoss, pierFLC, superFLC).
 */
export function HecRasInputRow({ profileNames, field }: {
  profileNames: string[];
  field: 'upstreamWsel' | 'headLoss' | 'pierFLC' | 'superFLC';
}) {
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const update = useProjectStore((s) => s.updateHecRasComparison);

  function getEntry(name: string): HecRasComparison {
    return comparison.find((c) => c.profileName === name) ?? {
      profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
    };
  }

  function setField(profileName: string, value: string) {
    const entries = profileNames.map((name) => {
      const entry = getEntry(name);
      if (name === profileName) {
        return { ...entry, [field]: value ? parseFloat(value) : null };
      }
      return entry;
    });
    update(entries);
  }

  return (
    <tr className="bg-yellow-900/20 border-y border-yellow-700/30">
      <td className="p-2 text-sm font-medium text-yellow-400">HEC-RAS</td>
      {profileNames.map((name) => {
        const entry = getEntry(name);
        return (
          <td key={name} className="p-1">
            <Input
              type="number"
              value={entry[field] ?? ''}
              onChange={(e) => setField(name, e.target.value)}
              className="h-7 text-sm w-20"
              placeholder="—"
            />
          </td>
        );
      })}
    </tr>
  );
}
