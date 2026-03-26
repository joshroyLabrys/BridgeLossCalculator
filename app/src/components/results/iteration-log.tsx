'use client';

import { useState } from 'react';
import { IterationStep } from '@/engine/types';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);

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
                <th className="p-1 text-right">Error (ft)</th>
              </tr>
            </thead>
            <tbody>
              {log.map((step) => (
                <tr key={step.iteration} className="border-t">
                  <td className="p-1">{step.iteration}</td>
                  <td className="p-1 text-right">{step.trialWsel.toFixed(4)}</td>
                  <td className="p-1 text-right">{step.computedWsel.toFixed(4)}</td>
                  <td className="p-1 text-right">{step.error.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
