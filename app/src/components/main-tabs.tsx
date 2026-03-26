'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CrossSectionForm } from '@/components/input/cross-section-form';
import { BridgeGeometryForm } from '@/components/input/bridge-geometry-form';
import { FlowProfilesForm } from '@/components/input/flow-profiles-form';
import { CoefficientsForm } from '@/components/input/coefficients-form';
import { ActionButtons } from '@/components/input/action-buttons';
import { MethodTabs } from '@/components/results/method-tabs';
import { ComparisonTables } from '@/components/summary/comparison-tables';
import { RegimeMatrix } from '@/components/summary/regime-matrix';
import { SummaryCharts } from '@/components/summary/charts';

export function MainTabs() {
  return (
    <Tabs defaultValue="input" className="flex-1 flex flex-col">
      <TabsList className="mx-6 mt-4 w-fit">
        <TabsTrigger value="input">Input</TabsTrigger>
        <TabsTrigger value="results">Method Results</TabsTrigger>
        <TabsTrigger value="summary">Summary &amp; Charts</TabsTrigger>
      </TabsList>

      <TabsContent value="input" className="flex-1 px-6 py-4">
        <Tabs defaultValue="cross-section">
          <TabsList className="w-fit mb-4">
            <TabsTrigger value="cross-section">Cross-Section</TabsTrigger>
            <TabsTrigger value="bridge">Bridge Geometry</TabsTrigger>
            <TabsTrigger value="profiles">Flow Profiles</TabsTrigger>
            <TabsTrigger value="coefficients">Coefficients</TabsTrigger>
          </TabsList>
          <TabsContent value="cross-section"><CrossSectionForm /></TabsContent>
          <TabsContent value="bridge"><BridgeGeometryForm /></TabsContent>
          <TabsContent value="profiles"><FlowProfilesForm /></TabsContent>
          <TabsContent value="coefficients"><CoefficientsForm /></TabsContent>
        </Tabs>
        <ActionButtons />
      </TabsContent>

      <TabsContent value="results" className="flex-1 px-6 py-4">
        <MethodTabs />
      </TabsContent>

      <TabsContent value="summary" className="flex-1 px-6 py-4 space-y-6">
        <ComparisonTables />
        <RegimeMatrix />
        <SummaryCharts />
      </TabsContent>
    </Tabs>
  );
}
