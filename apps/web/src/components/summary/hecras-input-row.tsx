'use client';

import { Input } from '@flowsuite/ui';
import { TableCell, TableRow } from '@flowsuite/ui';
import { useProjectStore } from '@/store/project-store';
import { HecRasComparison } from '@flowsuite/engine/types';

/** FLC fields are geometric — one value typically applies to all profiles. */
const FILL_ALL_FIELDS = new Set<string>(['pierFLC', 'superFLC']);

export function HecRasInputRow({ profileNames, field, spacer }: {
  profileNames: string[];
  field: 'upstreamWsel' | 'headLoss' | 'pierFLC' | 'superFLC';
  spacer?: boolean;
}) {
  const comparison = useProjectStore((s) => s.hecRasComparison);
  const update = useProjectStore((s) => s.updateHecRasComparison);

  function getEntry(name: string): HecRasComparison {
    return comparison.find((c) => c.profileName === name) ?? {
      profileName: name, upstreamWsel: null, headLoss: null, pierFLC: null, superFLC: null,
    };
  }

  function setField(profileName: string, value: string) {
    const parsed = value ? parseFloat(value) : null;
    const oldValue = getEntry(profileName)[field];

    const entries = profileNames.map((name) => {
      const entry = getEntry(name);

      if (name === profileName) {
        return { ...entry, [field]: parsed };
      }

      // For FLC fields, propagate to cells that are empty or still match the
      // previous shared value (i.e. haven't been individually overridden).
      if (FILL_ALL_FIELDS.has(field)) {
        const current = entry[field];
        if (current === null || current === oldValue) {
          return { ...entry, [field]: parsed };
        }
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
          <TableCell key={name} className="text-right">
            <Input
              type="number"
              value={entry[field] ?? ''}
              onChange={(e) => setField(name, e.target.value)}
              className="h-7 text-sm font-mono tabular-nums text-right ml-auto w-full"
              placeholder="—"
            />
          </TableCell>
        );
      })}
      {spacer && <TableCell />}
    </TableRow>
  );
}
