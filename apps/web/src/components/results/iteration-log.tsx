'use client';

import { useState } from 'react';
import { IterationStep } from '@flowsuite/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@flowsuite/data';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@flowsuite/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@flowsuite/ui';
import { ChevronRight, ChevronDown, TrendingDown } from 'lucide-react';
import { ConvergenceChart } from './convergence-chart';

export function IterationLog({ log }: { log: IterationStep[] }) {
  const [open, setOpen] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const us = useProjectStore((s) => s.unitSystem);
  const tolerance = useProjectStore((s) => s.coefficients.tolerance);
  const len = unitLabel('length', us);

  if (log.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Iteration Log ({log.length} iterations)
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 mt-2">
        {showChart && (
          <ConvergenceChart log={log} tolerance={tolerance} />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <TrendingDown className="h-3 w-3" />
            {showChart ? 'Hide chart' : 'Show chart'}
          </button>
        </div>
        <div className="rounded-lg border overflow-auto max-h-[200px]">
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
