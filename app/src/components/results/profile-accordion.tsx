'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MethodResult } from '@/engine/types';
import { CalculationSteps } from './calculation-steps';
import { IterationLog } from './iteration-log';
import { useProjectStore } from '@/store/project-store';
import { toDisplay, unitLabel } from '@/lib/units';

const regimeBadge = {
  'free-surface': { label: 'FREE SURFACE', className: 'bg-blue-900/50 text-blue-300' },
  'pressure': { label: 'PRESSURE', className: 'bg-orange-900/50 text-orange-300' },
  'overtopping': { label: 'OVERTOPPING', className: 'bg-purple-900/50 text-purple-300' },
};

export function ProfileAccordion({ results }: { results: MethodResult[] }) {
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);
  const velUnit = unitLabel('velocity', us);
  const areaUnit = unitLabel('area', us);

  return (
    <Accordion multiple className="space-y-2">
      {results.map((r, i) => {
        const regime = regimeBadge[r.flowRegime];
        return (
          <AccordionItem key={i} value={`profile-${i}`} className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-medium">{r.profileName}</span>
                <Badge variant={r.converged ? 'default' : 'destructive'} className="text-xs">
                  {r.converged ? 'CONVERGED' : 'NOT CONVERGED'}
                </Badge>
                <Badge className={`text-xs ${regime.className}`}>{regime.label}</Badge>
                {r.error && <span className="text-xs text-destructive">{r.error}</span>}
              </div>
              <div className="text-sm text-muted-foreground mr-4">
                US WSEL: <span className="text-foreground font-medium">{toDisplay(r.upstreamWsel, 'length', us).toFixed(2)} {lenUnit}</span>
                {' | '}
                Δh: <span className="text-foreground font-medium">{toDisplay(r.totalHeadLoss, 'length', us).toFixed(3)} {lenUnit}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              {/* Input echo — key computed hydraulic properties */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Input Echo</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Flow Area', value: `${toDisplay(r.inputEcho.flowArea, 'area', us).toFixed(1)} ${areaUnit}` },
                    { label: 'Hydraulic Radius', value: `${toDisplay(r.inputEcho.hydraulicRadius, 'length', us).toFixed(3)} ${lenUnit}` },
                    { label: 'Bridge Opening Area', value: `${toDisplay(r.inputEcho.bridgeOpeningArea, 'area', us).toFixed(1)} ${areaUnit}` },
                    { label: 'Pier Blockage', value: `${toDisplay(r.inputEcho.pierBlockage, 'area', us).toFixed(1)} ${areaUnit}` },
                  ].map((item) => (
                    <div key={item.label} className="bg-card p-2 rounded border text-sm">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Results</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Approach Velocity', value: `${toDisplay(r.approachVelocity, 'velocity', us).toFixed(2)} ${velUnit}` },
                    { label: 'Bridge Velocity', value: `${toDisplay(r.bridgeVelocity, 'velocity', us).toFixed(2)} ${velUnit}` },
                    { label: 'Froude (approach)', value: r.froudeApproach.toFixed(3) },
                    { label: 'Froude (bridge)', value: r.froudeBridge.toFixed(3) },
                  ].map((item) => (
                    <div key={item.label} className="bg-card p-2 rounded border text-sm">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculation steps */}
              {r.calculationSteps.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Step-by-Step Calculation</div>
                  <CalculationSteps steps={r.calculationSteps} />
                </div>
              )}

              {/* Iteration log */}
              <IterationLog log={r.iterationLog} />

              {/* TUFLOW FLCs */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">TUFLOW Form Loss Coefficients</div>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <div className="bg-card p-2 rounded border text-sm">
                    <div className="text-xs text-muted-foreground">Pier FLC</div>
                    <div>{r.tuflowPierFLC.toFixed(3)}</div>
                  </div>
                  <div className="bg-card p-2 rounded border text-sm">
                    <div className="text-xs text-muted-foreground">Superstructure FLC</div>
                    <div>{r.tuflowSuperFLC !== null ? r.tuflowSuperFLC.toFixed(3) : 'N/A'}</div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
