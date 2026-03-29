'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@flowsuite/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@flowsuite/ui';
import { Badge } from '@flowsuite/ui';
import { Checkbox } from '@flowsuite/ui';
import { CheckCircle2, XCircle, MinusCircle, ShieldCheck, FileSearch, ClipboardCheck, ExternalLink } from 'lucide-react';
import { computeFreeboard } from '@flowsuite/engine/freeboard';
import {
  getChecklistForJurisdiction,
  type ProjectStateForChecklist,
} from '@/config/regulatory-checklists';
import type {
  Jurisdiction,
  ChecklistItem,
} from '@flowsuite/engine/types';

const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  tmr: 'TMR (Queensland)',
  vicroads: 'VicRoads (Victoria)',
  dpie: 'NSW Government (legacy DPIE key)',
  arr: 'ARR General',
};

const GROUP_META = {
  'auto-verdict': {
    title: 'Automatic Verdict Inputs',
    description: 'App-verifiable hydraulic checks that align with the automatic adequacy verdict.',
    icon: ShieldCheck,
  },
  'auto-supporting': {
    title: 'Supporting App Checks',
    description: 'App-verifiable workflow checks that support compliance but do not change the hydraulic verdict.',
    icon: FileSearch,
  },
  manual: {
    title: 'Engineer Confirmation',
    description: 'Checks the engineer confirms inside the app after review.',
    icon: ClipboardCheck,
  },
  external: {
    title: 'External Evidence',
    description: 'Checks that must be confirmed from survey, flood model, approvals, or other project records.',
    icon: ExternalLink,
  },
} as const;

function isPassing(status: ChecklistItem['status']) {
  return status === 'pass' || status === 'manual-pass';
}

function statusIcon(status: ChecklistItem['status']) {
  switch (status) {
    case 'pass':
    case 'manual-pass':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case 'fail':
    case 'manual-fail':
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
    default:
      return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function checklistsEqual(a: ChecklistItem[], b: ChecklistItem[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.id === other.id &&
      item.requirement === other.requirement &&
      item.jurisdiction === other.jurisdiction &&
      item.verificationType === other.verificationType &&
      item.affectsAdequacyVerdict === other.affectsAdequacyVerdict &&
      item.status === other.status
    );
  });
}

function buildSummary(items: ChecklistItem[]) {
  const total = items.length;
  const met = items.filter((item) => isPassing(item.status)).length;
  const pct = total > 0 ? Math.round((met / total) * 100) : 0;
  return { total, met, pct };
}

export function RegulatoryChecklist() {
  const jurisdiction = useProjectStore((s) => s.regulatoryJurisdiction);
  const storedChecklist = useProjectStore((s) => s.regulatoryChecklist);
  const setJurisdiction = useProjectStore((s) => s.setJurisdiction);
  const setRegulatoryChecklist = useProjectStore((s) => s.setRegulatoryChecklist);
  const updateChecklistItem = useProjectStore((s) => s.updateChecklistItem);

  const results = useProjectStore((s) => s.results);
  const coefficients = useProjectStore((s) => s.coefficients);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const sensitivityResults = useProjectStore((s) => s.sensitivityResults);
  const scourResults = useProjectStore((s) => s.scourResults);
  const hecRasComparison = useProjectStore((s) => s.hecRasComparison);

  const projectState = useMemo<ProjectStateForChecklist>(() => {
    let freeboardResults: ProjectStateForChecklist['freeboardResults'] = null;
    const regimeClassifications: string[] = [];

    if (results) {
      const fb = computeFreeboard(results, bridgeGeometry, flowProfiles, coefficients.freeboardThreshold);
      freeboardResults = fb.profiles.map((p) => ({
        freeboard: p.freeboard,
        status: p.status,
      }));

      for (const r of results.energy) {
        regimeClassifications.push(r.flowRegime);
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
      freeboardThreshold: coefficients.freeboardThreshold,
    };
  }, [results, bridgeGeometry, flowProfiles, coefficients, sensitivityResults, scourResults, hecRasComparison]);

  const evaluatedItems = useMemo<ChecklistItem[]>(() => {
    const definitions = getChecklistForJurisdiction(jurisdiction);

    return definitions.map((def) => {
      const existing = storedChecklist.find((item) => item.id === def.id);

      if (def.verificationType === 'auto' && def.evaluate) {
        return {
          id: def.id,
          requirement: def.requirement,
          jurisdiction,
          verificationType: def.verificationType,
          affectsAdequacyVerdict: def.affectsAdequacyVerdict,
          status: def.evaluate(projectState),
        };
      }

      return {
        id: def.id,
        requirement: def.requirement,
        jurisdiction,
        verificationType: def.verificationType,
        affectsAdequacyVerdict: def.affectsAdequacyVerdict,
        status: existing?.status ?? 'not-assessed',
      };
    });
  }, [jurisdiction, projectState, storedChecklist]);

  useEffect(() => {
    if (!checklistsEqual(storedChecklist, evaluatedItems)) {
      setRegulatoryChecklist(evaluatedItems);
    }
  }, [storedChecklist, evaluatedItems, setRegulatoryChecklist]);

  const groupedItems = useMemo(() => ({
    'auto-verdict': evaluatedItems.filter((item) => item.verificationType === 'auto' && item.affectsAdequacyVerdict),
    'auto-supporting': evaluatedItems.filter((item) => item.verificationType === 'auto' && !item.affectsAdequacyVerdict),
    manual: evaluatedItems.filter((item) => item.verificationType === 'manual'),
    external: evaluatedItems.filter((item) => item.verificationType === 'external'),
  }), [evaluatedItems]);

  const summaries = useMemo(() => ({
    'auto-verdict': buildSummary(groupedItems['auto-verdict']),
    'auto-supporting': buildSummary(groupedItems['auto-supporting']),
    manual: buildSummary(groupedItems.manual),
    external: buildSummary(groupedItems.external),
  }), [groupedItems]);

  const handleJurisdictionChange = useCallback((value: string | null) => {
    if (!value) return;
    setJurisdiction(value as Jurisdiction);
  }, [setJurisdiction]);

  const handleManualToggle = useCallback((item: ChecklistItem) => {
    const newStatus: ChecklistItem['status'] =
      item.status === 'manual-pass' ? 'not-assessed' : 'manual-pass';
    updateChecklistItem(item.id, newStatus);
  }, [updateChecklistItem]);

  const summaryCards = [
    { key: 'auto-verdict', badge: 'Verdict' },
    { key: 'auto-supporting', badge: 'App' },
    { key: 'manual', badge: 'Manual' },
    { key: 'external', badge: 'External' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Regulatory Compliance Checklist</CardTitle>
            </div>
            <CardDescription className="text-pretty">
              The automatic hydraulic verdict belongs to the adequacy engine. This checklist now
              separates app-verifiable checks from engineer confirmations and external evidence so
              the app is explicit about what it can and cannot verify.
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
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {summaryCards.map(({ key, badge }) => {
            const summary = summaries[key];
            const meta = GROUP_META[key];
            const Icon = meta.icon;
            return (
              <div key={key} className="rounded-lg border border-border/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium">{meta.title}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {summary.met} / {summary.total}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {badge}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {(['auto-verdict', 'auto-supporting', 'manual', 'external'] as const).map((groupKey) => {
          const items = groupedItems[groupKey];
          if (items.length === 0) return null;

          const meta = GROUP_META[groupKey];
          const Icon = meta.icon;

          return (
            <section key={groupKey} className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">{meta.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground max-w-prose">
                  {meta.description}
                </p>
              </div>

              <div className="divide-y divide-border/30 rounded-lg border border-border/40">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    {item.verificationType === 'auto' ? (
                      statusIcon(item.status)
                    ) : (
                      <Checkbox
                        checked={item.status === 'manual-pass'}
                        onCheckedChange={() => handleManualToggle(item)}
                        className="shrink-0"
                      />
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm">{item.requirement}</p>
                      {item.verificationType !== 'auto' ? (
                        <p className="text-[11px] text-muted-foreground">
                          {item.verificationType === 'manual'
                            ? 'Confirmed by the engineer inside the app.'
                            : 'Confirmed from external project evidence, not calculated by the app.'}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {item.verificationType}
                      </Badge>
                      {item.verificationType === 'auto' ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${item.affectsAdequacyVerdict ? 'border-primary/40 text-primary' : 'text-muted-foreground'}`}
                        >
                          {item.affectsAdequacyVerdict ? 'verdict input' : 'supporting'}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
