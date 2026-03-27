// src/components/simulation/simulation-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectStore } from '@/store/project-store';
import { buildHydraulicProfile } from '@/engine/simulation-profile';
import { HydraulicProfileChart } from './hydraulic-profile-chart';
import { SimulationControls } from './simulation-controls';
import type { CalculationResults } from '@/engine/types';
import { Waves } from 'lucide-react';

const METHOD_KEYS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

export function SimulationTab() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const crossSection = useProjectStore((s) => s.crossSection);
  const coefficients = useProjectStore((s) => s.coefficients);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('energy');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const activeMethods = METHOD_KEYS.filter(
    (m) => coefficients.methodsToRun[m] && results?.[m]?.length,
  );

  const methodResult = results?.[selectedMethod as keyof CalculationResults]?.[selectedProfileIdx];
  const flowProfile = flowProfiles[selectedProfileIdx];

  const hydraulicProfile = useMemo(() => {
    if (!methodResult || !flowProfile || crossSection.length < 2) return null;
    return buildHydraulicProfile(crossSection, bridgeGeometry, flowProfile, methodResult);
  }, [crossSection, bridgeGeometry, flowProfile, methodResult]);

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Waves className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Run calculations from the Input tab to see the simulation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Hydraulic Simulation</h2>
        <p className="text-sm text-muted-foreground max-w-prose text-pretty">
          2D longitudinal profile showing flow behavior through approach, bridge, and exit zones.
          Particles animate proportionally to local velocity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <SimulationControls
            profiles={flowProfiles}
            selectedProfileIdx={selectedProfileIdx}
            onProfileChange={setSelectedProfileIdx}
            methods={activeMethods}
            selectedMethod={selectedMethod}
            onMethodChange={setSelectedMethod}
            isPlaying={isPlaying}
            onPlayingChange={setIsPlaying}
            speed={speed}
            onSpeedChange={setSpeed}
          />
        </CardHeader>
        <CardContent>
          {hydraulicProfile ? (
            <HydraulicProfileChart
              profile={hydraulicProfile}
              isPlaying={isPlaying}
              speed={speed}
              particleCount={30}
            />
          ) : (
            <div className="flex items-center justify-center h-[420px] text-muted-foreground text-sm">
              Select a profile and method with results to view the simulation
            </div>
          )}
        </CardContent>
      </Card>

      {hydraulicProfile && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Flow Regime:</span>
          <span className={`px-2 py-1 rounded-md font-medium ${
            hydraulicProfile.flowRegime === 'free-surface'
              ? 'bg-blue-500/15 text-blue-400'
              : hydraulicProfile.flowRegime === 'pressure'
              ? 'bg-orange-500/15 text-orange-400'
              : 'bg-red-500/15 text-red-400'
          }`}>
            {hydraulicProfile.flowRegime.toUpperCase().replace('-', ' ')}
          </span>
          <span className="text-muted-foreground">
            US WSEL: <span className="text-foreground font-mono">{hydraulicProfile.usWsel.toFixed(2)}</span>
            {' | '}
            DS WSEL: <span className="text-foreground font-mono">{hydraulicProfile.dsWsel.toFixed(2)}</span>
            {' | '}
            Δh: <span className="text-foreground font-mono">{hydraulicProfile.totalHeadLoss.toFixed(3)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
