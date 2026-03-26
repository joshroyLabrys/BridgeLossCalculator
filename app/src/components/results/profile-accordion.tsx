'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MethodResult } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';
import { CalculationSteps } from './calculation-steps';
import { IterationLog } from './iteration-log';

const regimeBadge = {
  'free-surface': { label: 'FREE SURFACE', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  'pressure': { label: 'PRESSURE', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  'overtopping': { label: 'OVERTOPPING', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-mono tabular-nums mt-1 text-foreground">{value}</div>
    </div>
  );
}

export function ProfileAccordion({ results }: { results: MethodResult[] }) {
  const us = useProjectStore((s) => s.unitSystem);
  const len = unitLabel('length', us);
  const areaU = unitLabel('area', us);
  const vel = unitLabel('velocity', us);

  return (
    <Accordion multiple className="space-y-2">
      {results.map((r, i) => {
        const regime = regimeBadge[r.flowRegime];
        return (
          <AccordionItem key={i} value={`profile-${i}`} className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">{r.profileName}</span>
                <Badge variant={r.converged ? 'default' : 'destructive'} className={`text-xs ${r.converged ? 'bg-primary/15 text-primary border-primary/30' : ''}`}>{r.converged ? 'CONVERGED' : 'NOT CONVERGED'}</Badge>
                <Badge variant="outline" className={`text-xs ${regime.className}`}>{regime.label}</Badge>
                {r.error && <span className="text-xs text-destructive">{r.error}</span>}
              </div>
              <div className="text-sm text-muted-foreground mr-4 font-mono tabular-nums">
                US WSEL: <span className="text-foreground font-medium">{toDisplay(r.upstreamWsel, 'length', us).toFixed(2)} {len}</span>
                {' | '}Δh: <span className="text-foreground font-medium">{toDisplay(r.totalHeadLoss, 'length', us).toFixed(3)} {len}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Input Echo</div>
                <div className="grid grid-cols-4 gap-2">
                  <MetricCard label="Flow Area" value={`${toDisplay(r.inputEcho.flowArea, 'area', us).toFixed(1)} ${areaU}`} />
                  <MetricCard label="Hydraulic Radius" value={`${toDisplay(r.inputEcho.hydraulicRadius, 'length', us).toFixed(3)} ${len}`} />
                  <MetricCard label="Bridge Opening Area" value={`${toDisplay(r.inputEcho.bridgeOpeningArea, 'area', us).toFixed(1)} ${areaU}`} />
                  <MetricCard label="Pier Blockage" value={`${toDisplay(r.inputEcho.pierBlockage, 'area', us).toFixed(1)} ${areaU}`} />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Results</div>
                <div className="grid grid-cols-4 gap-2">
                  <MetricCard label="Approach Velocity" value={`${toDisplay(r.approachVelocity, 'velocity', us).toFixed(2)} ${vel}`} />
                  <MetricCard label="Bridge Velocity" value={`${toDisplay(r.bridgeVelocity, 'velocity', us).toFixed(2)} ${vel}`} />
                  <MetricCard label="Froude (approach)" value={r.froudeApproach.toFixed(3)} />
                  <MetricCard label="Froude (bridge)" value={r.froudeBridge.toFixed(3)} />
                </div>
              </div>
              {r.calculationSteps.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Calculation Steps</div>
                  <CalculationSteps steps={r.calculationSteps} />
                </div>
              )}
              <IterationLog log={r.iterationLog} />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">TUFLOW Form Loss Coefficients</div>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <MetricCard label="Pier FLC" value={r.tuflowPierFLC.toFixed(3)} />
                  <MetricCard label="Superstructure FLC" value={r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A'} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
