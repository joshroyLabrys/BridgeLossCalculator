'use client';

import { useState } from 'react';
import { IterationStep } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  if (log.length === 0) return null;

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground uppercase tracking-wide hover:text-foreground">
        {open ? '▼' : '▶'} Iteration Log ({log.length} iterations)
      </button>
      {open && (
        <div className="mt-2 rounded-md border overflow-auto max-h-[200px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-1 text-left">#</th>
                <th className="p-1 text-right">Trial WSEL</th>
                <th className="p-1 text-right">Computed WSEL</th>
                <th className="p-1 text-right">Error ({lenUnit})</th>
              </tr>
            </thead>
            <tbody>
              {log.map((step) => (
                <tr key={step.iteration} className="border-t">
                  <td className="p-1">{step.iteration}</td>
                  <td className="p-1 text-right">{toDisplay(step.trialWsel, 'length', us).toFixed(4)}</td>
                  <td className="p-1 text-right">{toDisplay(step.computedWsel, 'length', us).toFixed(4)}</td>
                  <td className="p-1 text-right">{toDisplay(step.error, 'length', us).toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
