'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/store/project-store';
import { MethodView } from './method-view';

const methods = [
  { key: 'energy', label: 'Energy', color: 'bg-blue-500', name: 'Energy Method', reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5', equation: 'WS_us = WS_ds + h_f + h_c + h_e  where h_f = L × (S_f1 + S_f2) / 2' },
  { key: 'momentum', label: 'Momentum', color: 'bg-emerald-500', name: 'Momentum Method', reference: 'HEC-RAS Hydraulic Reference Manual, Chapter 5', equation: 'ΣF = ΔM  (net force = change in momentum flux)' },
  { key: 'yarnell', label: 'Yarnell', color: 'bg-amber-500', name: 'Yarnell Method', reference: 'Yarnell, D.L. (1934), "Bridge Piers as Channel Obstructions"', equation: 'Δy = K × (K + 5 - 0.6) × (α + 15α⁴) × (V²/2g)' },
  { key: 'wspro', label: 'WSPRO', color: 'bg-purple-500', name: 'WSPRO Method', reference: 'FHWA Report FHWA-IP-87-7, "Bridge Waterways Analysis Model"', equation: 'Δh = C × α₁ × (V₁²/2g)' },
] as const;

export function MethodTabs() {
  const results = useProjectStore((s) => s.results);
  return (
    <Tabs defaultValue="energy">
      <TabsList className="w-fit mb-4">
        {methods.map((m) => (
          <TabsTrigger key={m.key} value={m.key}>
            <span className={`h-2 w-2 rounded-full ${m.color} mr-1.5`} />
            {m.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {methods.map((m) => (
        <TabsContent key={m.key} value={m.key}>
          <MethodView name={m.name} reference={m.reference} equation={m.equation} results={results?.[m.key] ?? []} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
