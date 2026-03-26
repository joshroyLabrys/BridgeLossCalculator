'use client';

import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { useProjectStore } from '@/store/project-store';
import { HecRasComparison } from '@/engine/types';

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
    <TableRow className="bg-amber-500/5 border-y border-amber-500/20 hover:bg-amber-500/10">
      <TableCell className="text-sm font-semibold text-amber-400">HEC-RAS</TableCell>
      {profileNames.map((name) => {
        const entry = getEntry(name);
        return (
          <TableCell key={name} className="px-1">
            <Input
              type="number"
              value={entry[field] ?? ''}
              onChange={(e) => setField(name, e.target.value)}
              className="h-7 text-sm font-mono w-20"
              placeholder="—"
            />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
