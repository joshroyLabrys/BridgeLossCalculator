'use client';

import { useState, useEffect } from 'react';
import { Button } from '@flowsuite/ui';
import { getStorage, removeStorage, toImperial } from '@flowsuite/data';
import { useProjectStore } from '@/store/project-store';
import type { FlowProfile } from '@flowsuite/engine/types';
import { Droplets } from 'lucide-react';

const STORAGE_KEY = 'hydro:latest-flows';

interface HydroFlowExport {
  projectName: string;
  catchmentArea: number;
  location: { lat: number; lng: number } | null;
  timestamp: number;
  flows: {
    aep: string;
    ari: string;
    criticalDurationMin: number;
    designQ: number;
    ensembleMin: number;
    ensembleMax: number;
  }[];
}

export function HydroImportBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [hydroData, setHydroData] = useState<HydroFlowExport | null>(null);
  const updateFlowProfiles = useProjectStore((s) => s.updateFlowProfiles);
  const existingProfiles = useProjectStore((s) => s.flowProfiles);

  useEffect(() => {
    const data = getStorage<HydroFlowExport>(STORAGE_KEY);
    setHydroData(data);
  }, []);

  if (dismissed || !hydroData || !hydroData.flows.length) return null;

  const handleDismiss = () => {
    removeStorage(STORAGE_KEY);
    setDismissed(true);
  };

  const handleImport = () => {
    const newProfiles: FlowProfile[] = hydroData.flows.map((f) => ({
      name: `${f.aep} AEP (Hydro)`,
      ari: f.aep,
      discharge: toImperial(f.designQ, 'discharge', 'metric'),
      dsWsel: 0,
      channelSlope: 0,
    }));

    updateFlowProfiles([...existingProfiles, ...newProfiles]);
    removeStorage(STORAGE_KEY);
    setDismissed(true);
  };

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <Droplets className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm text-foreground">
        Design flows from Hydrology &mdash;{' '}
        <span className="font-medium">{hydroData.flows.length} profiles</span> ready to import
      </p>
      <Button variant="ghost" size="sm" onClick={handleDismiss}>
        Dismiss
      </Button>
      <Button size="sm" onClick={handleImport}>
        Import
      </Button>
    </div>
  );
}
