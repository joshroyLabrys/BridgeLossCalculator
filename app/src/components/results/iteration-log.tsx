'use client';

import { useState } from 'react';
import { IterationStep } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ChevronDown } from 'lucide-react';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);

  if (log.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Iteration Log ({log.length} iterations)
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border overflow-auto max-h-[200px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs w-12">#</TableHead>
                <TableHead className="text-xs text-right">Trial WSEL ({len})</TableHead>
                <TableHead className="text-xs text-right">Computed WSEL ({len})</TableHead>
                <TableHead className="text-xs text-right">Error ({len})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((step) => (
                <TableRow key={step.iteration} className="even:bg-muted/20">
                  <TableCell className="font-mono text-xs">{step.iteration}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{toDisplay(step.trialWsel, 'length', us).toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{toDisplay(step.computedWsel, 'length', us).toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{toDisplay(step.error, 'length', us).toFixed(6)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
