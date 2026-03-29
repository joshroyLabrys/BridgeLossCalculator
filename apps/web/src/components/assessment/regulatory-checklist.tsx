'use client';

import { useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@flowsuite/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@flowsuite/ui';
import { Badge } from '@flowsuite/ui';
import { Checkbox } from '@flowsuite/ui';
import { CheckCircle2, XCircle, MinusCircle, ShieldCheck } from 'lucide-react';
import { computeFreeboard } from '@flowsuite/engine/freeboard';
import {
  getChecklistForJurisdiction,
  type ChecklistDefinition,
  type ProjectStateForChecklist,
} from '@/config/regulatory-checklists';
import type { Jurisdiction, ChecklistItem } from '@flowsuite/engine/types';

/* ------------------------------------------------------------------ */
/*  Jurisdiction labels                                                */
/* ------------------------------------------------------------------ */
const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  tmr: 'TMR (Queensland)',
  vicroads: 'VicRoads (Victoria)',
  dpie: 'DPIE (NSW)',
  arr: 'ARR General',
};

/* ------------------------------------------------------------------ */
/*  Status icon helpers                                                */
/* ------------------------------------------------------------------ */
function StatusIcon({ status }: { status: ChecklistItem['status'] }) {
  switch (status) {
    case 'pass':
    case 'manual-pass':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case 'fail':
    case 'manual-fail':
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    case 'not-assessed':
    default:
      return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export function RegulatoryChecklist() {
  const jurisdiction = useProjectStore((s) => s.regulatoryJurisdiction);
  const checklist = useProjectStore((s) => s.regulatoryChecklist);
  const setJurisdiction = useProjectStore((s) => s.setJurisdiction);
  const updateChecklistItem = useProjectStore((s) => s.updateChecklistItem);

  // State needed for auto-evaluation
  const results = useProjectStore((s) => s.results);
  const coefficients = useProjectStore((s) => s.coefficients);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const sensitivityResults = useProjectStore((s) => s.sensitivityResults);
  const scourResults = useProjectStore((s) => s.scourResults);
  const hecRasComparison = useProjectStore((s) => s.hecRasComparison);

  // Build the project state snapshot for evaluators
  const projectState = useMemo<ProjectStateForChecklist>(() => {
    let freeboardResults: ProjectStateForChecklist['freeboardResults'] = null;
    const regimeClassifications: string[] = [];
    const velocityDepthProducts: number[] = [];

    if (results) {
      // Compute freeboard from results
      const fb = computeFreeboard(results, bridgeGeometry, flowProfiles, coefficients.freeboardThreshold);
      freeboardResults = fb.profiles.map((p) => ({
        freeboard: p.freeboard,
        status: p.status,
      }));

      // Collect regime classifications from energy method
      for (const r of results.energy) {
        regimeClassifications.push(r.flowRegime);
        // V x d product (approach velocity x hydraulic depth approximation)
        const area = r.inputEcho.flowArea;
        const hr = r.inputEcho.hydraulicRadius;
        if (hr > 0 && area > 0) {
          // depth approximation from hydraulic radius, velocity from approach
          velocityDepthProducts.push(r.approachVelocity * hr);
        }
      }
    }

    return {
      freeboardResults,
      sensitivityRun: sensitivityResults !== null,
      debrisBlockagePct: coefficients.debrisBlockagePct,
      scourResultsExist: scourResults !== null && scourResults.length > 0,
      qaqcComparisonExists:
        hecRasComparison.length > 0 &&
        hecRasComparison.some((c) => c.upstreamWsel !== null),
      regimeClassifications,
      velocityDepthProducts,
      freeboardThreshold: coefficients.freeboardThreshold,
    };
  }, [results, bridgeGeometry, flowProfiles, coefficients, sensitivityResults, scourResults, hecRasComparison]);

  // Evaluate checklist definitions against project state
  const evaluatedItems = useMemo(() => {
    const definitions = getChecklistForJurisdiction(jurisdiction);
    return definitions.map((def): ChecklistItem & { autoCheck: boolean } => {
      // Check if there is an existing manual override in the store
      const existing = checklist.find((item) => item.id === def.id);

      if (def.autoCheck && def.evaluate) {
        const autoStatus = def.evaluate(projectState);
        return {
          id: def.id,
          requirement: def.requirement,
          jurisdiction,
          autoCheck: true,
          status: autoStatus,
        };
      }

      // Manual item - use stored status or default to not-assessed
      return {
        id: def.id,
        requirement: def.requirement,
        jurisdiction,
        autoCheck: false,
        status: existing?.status ?? 'not-assessed',
      };
    });
  }, [jurisdiction, projectState, checklist]);

  // Sync evaluated items into store when jurisdiction changes
  const handleJurisdictionChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const j = value as Jurisdiction;
      setJurisdiction(j);
    },
    [setJurisdiction],
  );

  // Toggle manual checklist item
  const handleManualToggle = useCallback(
    (id: string, currentStatus: ChecklistItem['status']) => {
      const newStatus: ChecklistItem['status'] =
        currentStatus === 'manual-pass' ? 'not-assessed' : 'manual-pass';
      updateChecklistItem(id, newStatus);

      // Ensure item exists in store checklist
      const store = useProjectStore.getState();
      const exists = store.regulatoryChecklist.some((item) => item.id === id);
      if (!exists) {
        // Add the item to the checklist in the store
        const def = getChecklistForJurisdiction(jurisdiction).find((d) => d.id === id);
        if (def) {
          useProjectStore.setState((prev) => ({
            regulatoryChecklist: [
              ...prev.regulatoryChecklist,
              {
                id: def.id,
                requirement: def.requirement,
                jurisdiction,
                autoCheck: false,
                status: newStatus,
              },
            ],
          }));
        }
      } else {
        updateChecklistItem(id, newStatus);
      }
    },
    [jurisdiction, updateChecklistItem],
  );

  // Calculate progress
  const total = evaluatedItems.length;
  const met = evaluatedItems.filter(
    (item) => item.status === 'pass' || item.status === 'manual-pass',
  ).length;
  const progressPct = total > 0 ? Math.round((met / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Regulatory Compliance Checklist</CardTitle>
            </div>
            <CardDescription className="text-pretty">
              Jurisdiction-specific compliance requirements. Auto-check items are evaluated from
              current project state; manual items require engineer verification.
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto shrink-0">
            <Select value={jurisdiction} onValueChange={handleJurisdictionChange}>
              <SelectTrigger size="sm" className="w-full sm:w-56 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(JURISDICTION_LABELS) as Jurisdiction[]).map((j) => (
                  <SelectItem key={j} value={j}>
                    {JURISDICTION_LABELS[j]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {met} of {total} requirements met
            </span>
            <Badge
              variant={progressPct === 100 ? 'default' : progressPct >= 50 ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {progressPct}%
            </Badge>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct === 100
                  ? 'bg-emerald-500'
                  : progressPct >= 50
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className="divide-y divide-border/30">
          {evaluatedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              {item.autoCheck ? (
                <StatusIcon status={item.status} />
              ) : (
                <Checkbox
                  checked={item.status === 'manual-pass'}
                  onCheckedChange={() => handleManualToggle(item.id, item.status)}
                  className="shrink-0"
                />
              )}
              <span className="text-sm flex-1 min-w-0">{item.requirement}</span>
              {item.autoCheck && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
                  auto
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
