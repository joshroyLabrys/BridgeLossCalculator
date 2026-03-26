'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { MethodResult } from '@/engine/types';
import { CalculationSteps } from './calculation-steps';
import { IterationLog } from './iteration-log';

const regimeBadge = {
  'free-surface': { label: 'FREE SURFACE', className: 'bg-blue-900/50 text-blue-300' },
  'pressure': { label: 'PRESSURE', className: 'bg-orange-900/50 text-orange-300' },
  'overtopping': { label: 'OVERTOPPING', className: 'bg-purple-900/50 text-purple-300' },
};

export function ProfileAccordion({ results }: { results: MethodResult[] }) {
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
                US WSEL: <span className="text-foreground font-medium">{r.upstreamWsel.toFixed(2)} ft</span>
                {' | '}
                Δh: <span className="text-foreground font-medium">{r.totalHeadLoss.toFixed(3)} ft</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-4">
              {/* Input echo — key computed hydraulic properties */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Input Echo</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Flow Area', value: `${r.inputEcho.flowArea.toFixed(1)} ft²` },
                    { label: 'Hydraulic Radius', value: `${r.inputEcho.hydraulicRadius.toFixed(3)} ft` },
                    { label: 'Bridge Opening Area', value: `${r.inputEcho.bridgeOpeningArea.toFixed(1)} ft²` },
                    { label: 'Pier Blockage', value: `${r.inputEcho.pierBlockage.toFixed(1)} ft²` },
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
                    { label: 'Approach Velocity', value: `${r.approachVelocity.toFixed(2)} ft/s` },
                    { label: 'Bridge Velocity', value: `${r.bridgeVelocity.toFixed(2)} ft/s` },
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
