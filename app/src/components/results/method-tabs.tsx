'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/store/project-store';
import { MethodView } from './method-view';

const methods = [
  { key: 'energy', label: 'Energy', color: 'bg-blue-500', name: 'Energy Method', reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5', equation: 'WS_{us} = WS_{ds} + h_f + h_c + h_e \\quad \\text{where} \\quad h_f = L \\cdot \\frac{S_{f1} + S_{f2}}{2}' },
  { key: 'momentum', label: 'Momentum', color: 'bg-emerald-500', name: 'Momentum Method', reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5', equation: '\\sum F = \\Delta M \\quad \\text{(net force = change in momentum flux)}' },
  { key: 'yarnell', label: 'Yarnell', color: 'bg-amber-500', name: 'Yarnell Method', reference: 'Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"', equation: '\\Delta y = K(K + 5 - 0.6)(\\alpha + 15\\alpha^4) \\cdot \\frac{V^2}{2g}' },
  { key: 'wspro', label: 'WSPRO', color: 'bg-purple-500', name: 'WSPRO Method', reference: 'FHWA Report FHWA-IP-87-7, "Bridge Waterways Analysis Model"', equation: '\\Delta h = C \\cdot \\alpha_1 \\cdot \\frac{V_1^2}{2g}' },
] as const;

export function MethodTabs() {
  const results = useProjectStore((s) => s.results);
  return (
    <Tabs defaultValue="energy">
      <div className="mb-4 sm:mb-5 scroll-snap-x inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5 max-w-full">
        <TabsList className="w-fit gap-0 bg-transparent p-0">
          {methods.map((m, i) => (
            <span key={m.key} className="contents">
              {i > 0 && <div className="h-4 w-px bg-border/40 hidden sm:block" aria-hidden="true" />}
              <TabsTrigger value={m.key} className="rounded-md px-3 sm:px-3.5 py-1.5 text-xs whitespace-nowrap">
                <span className={`h-2 w-2 rounded-full ${m.color}`} />
                {m.label}
              </TabsTrigger>
            </span>
          ))}
        </TabsList>
      </div>
      {methods.map((m) => (
        <TabsContent key={m.key} value={m.key}>
          <MethodView name={m.name} reference={m.reference} equation={m.equation} results={results?.[m.key] ?? []} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
