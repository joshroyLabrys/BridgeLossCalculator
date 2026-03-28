'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useProjectStore } from '@/store/project-store';
import { NARRATIVE_SECTIONS, type NarrativeSectionDef } from '@/lib/api/narrative-prompts';
import { ChevronDown, ChevronRight, Sparkles, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helper: build project data payload for AI context                  */
/* ------------------------------------------------------------------ */
function useProjectData() {
  const store = useProjectStore();
  return useCallback(() => {
    const data: Record<string, unknown> = {
      projectName: store.projectName,
      bridgeGeometry: {
        lowChordLeft: store.bridgeGeometry.lowChordLeft,
        lowChordRight: store.bridgeGeometry.lowChordRight,
        highChord: store.bridgeGeometry.highChord,
        span: store.bridgeGeometry.rightAbutmentStation - store.bridgeGeometry.leftAbutmentStation,
        pierCount: store.bridgeGeometry.piers.length,
        skewAngle: store.bridgeGeometry.skewAngle,
        deckWidth: store.bridgeGeometry.deckWidth,
      },
      coefficients: {
        contraction: store.coefficients.contractionCoeff,
        expansion: store.coefficients.expansionCoeff,
        debrisBlockagePct: store.coefficients.debrisBlockagePct,
        freeboardThreshold: store.coefficients.freeboardThreshold,
      },
      flowProfiles: store.flowProfiles.map((p) => ({
        name: p.name,
        ari: p.ari,
        discharge: p.discharge,
        dsWsel: p.dsWsel,
      })),
    };

    if (store.results) {
      const methods = Object.fromEntries(
        (['energy', 'momentum', 'yarnell', 'wspro'] as const)
          .filter((m) => store.results![m].length > 0)
          .map((m) => [
            m,
            store.results![m].map((r) => ({
              profileName: r.profileName,
              upstreamWsel: r.upstreamWsel,
              totalHeadLoss: r.totalHeadLoss,
              flowRegime: r.flowRegime,
              froudeApproach: r.froudeApproach,
              bridgeVelocity: r.bridgeVelocity,
              error: r.error,
            })),
          ])
      );
      data.results = methods;

      // Freeboard
      const energyResults = store.results.energy;
      if (energyResults.length > 0) {
        const lowChord = Math.min(store.bridgeGeometry.lowChordLeft, store.bridgeGeometry.lowChordRight);
        data.freeboard = energyResults.map((r) => ({
          profileName: r.profileName,
          freeboard: lowChord - r.upstreamWsel,
          regime: r.flowRegime,
        }));
      }
    }

    if (store.scourResults) {
      data.scourResults = store.scourResults;
    }

    if (store.sensitivityResults) {
      data.sensitivityResults = store.sensitivityResults;
    }

    if (store.adequacyResults) {
      data.adequacyResults = store.adequacyResults;
    }

    return data;
  }, [store]);
}

/* ------------------------------------------------------------------ */
/*  Helper: check if required data is present                          */
/* ------------------------------------------------------------------ */
function useMissingData() {
  const store = useProjectStore();
  return useCallback((sectionDef: NarrativeSectionDef): string | null => {
    if (!sectionDef.requiresData) return null;
    switch (sectionDef.requiresData) {
      case 'results':
        return store.results ? null : 'Run calculations first';
      case 'scourResults':
        return store.scourResults ? null : 'Run scour analysis first';
      case 'sensitivityResults':
        return store.sensitivityResults ? null : 'Run sensitivity analysis first';
      default:
        return null;
    }
  }, [store.results, store.scourResults, store.sensitivityResults]);
}

/* ------------------------------------------------------------------ */
/*  Section Card                                                       */
/* ------------------------------------------------------------------ */
interface SectionCardProps {
  sectionDef: NarrativeSectionDef;
  content: string;
  status: 'empty' | 'generated' | 'edited';
  tone: 'technical' | 'summary';
  onGenerate: () => void;
  onContentChange: (content: string) => void;
  isGenerating: boolean;
  missingData: string | null;
}

function SectionCard({
  sectionDef,
  content,
  status,
  tone,
  onGenerate,
  onContentChange,
  isGenerating,
  missingData,
}: SectionCardProps) {
  const [open, setOpen] = useState(status !== 'empty');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const handleGenerate = useCallback(() => {
    if (status === 'edited' && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }
    setConfirmRegenerate(false);
    onGenerate();
    setOpen(true);
  }, [status, confirmRegenerate, onGenerate]);

  const handleCancelRegenerate = useCallback(() => {
    setConfirmRegenerate(false);
  }, []);

  const statusBadge = {
    empty: { label: 'Empty', variant: 'outline' as const },
    generated: { label: 'Generated', variant: 'default' as const },
    edited: { label: 'Edited', variant: 'secondary' as const },
  }[status];

  return (
    <Card className="border-border/40">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-3">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left cursor-pointer hover:text-foreground/80 transition-colors">
              {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{sectionDef.title}</span>
                  <Badge variant={statusBadge.variant} className="text-[10px] px-1.5 py-0">
                    {statusBadge.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{sectionDef.description}</p>
              </div>
            </CollapsibleTrigger>

            <div className="flex items-center gap-2 shrink-0">
              {missingData ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {missingData}
                </span>
              ) : confirmRegenerate ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-amber-500">Overwrite edits?</span>
                  <Button size="sm" variant="destructive" onClick={handleGenerate} className="h-7 text-xs px-2">
                    Yes
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelRegenerate} className="h-7 text-xs px-2">
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating || !!missingData}
                  className="h-7 text-xs px-2.5 gap-1.5"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : status === 'empty' ? (
                    <Sparkles className="h-3 w-3" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {status === 'empty' ? 'Generate' : 'Regenerate'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {missingData ? (
              <div className="rounded-md bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                {missingData}
              </div>
            ) : (
              <textarea
                className="w-full min-h-[160px] rounded-md border border-border/50 bg-background px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60"
                placeholder={`${tone === 'technical' ? 'Technical' : 'Summary'} narrative for ${sectionDef.title}...`}
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                disabled={isGenerating}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Narrative Editor                                              */
/* ------------------------------------------------------------------ */
export function NarrativeEditor() {
  const narrativeSections = useProjectStore((s) => s.narrativeSections);
  const narrativeTone = useProjectStore((s) => s.narrativeTone);
  const updateNarrativeSection = useProjectStore((s) => s.updateNarrativeSection);
  const setNarrativeTone = useProjectStore((s) => s.setNarrativeTone);

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const getProjectData = useProjectData();
  const getMissingData = useMissingData();

  // Ensure narrative sections are initialized in the store
  const sections = NARRATIVE_SECTIONS.map((def) => {
    const existing = narrativeSections.find((s) => s.id === def.id);
    return {
      def,
      content: existing?.content ?? '',
      status: existing?.status ?? ('empty' as const),
    };
  });

  // Initialize sections in store if they're missing
  const initializeSections = useCallback(() => {
    if (narrativeSections.length === 0) {
      for (const def of NARRATIVE_SECTIONS) {
        updateNarrativeSection(def.id, {
          id: def.id,
          title: def.title,
          description: def.description,
          content: '',
          status: 'empty',
        });
      }
    }
  }, [narrativeSections.length, updateNarrativeSection]);

  // Lazy-init sections on first render
  if (narrativeSections.length === 0) {
    // We need to populate the store with initial section data
    // This is safe because updateNarrativeSection won't find the id in an empty array
    // So we need to set them via a different mechanism - set the full array
    const store = useProjectStore.getState();
    if (store.narrativeSections.length === 0) {
      useProjectStore.setState({
        narrativeSections: NARRATIVE_SECTIONS.map((def) => ({
          id: def.id,
          title: def.title,
          description: def.description,
          content: '',
          status: 'empty' as const,
        })),
      });
    }
  }

  const generateSection = useCallback(async (sectionId: string) => {
    const sectionDef = NARRATIVE_SECTIONS.find((s) => s.id === sectionId);
    if (!sectionDef) return;

    setGeneratingIds((prev) => new Set(prev).add(sectionId));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });

    try {
      const projectData = getProjectData();
      const response = await fetch('/api/ai-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          tone: useProjectStore.getState().narrativeTone,
          projectData,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      updateNarrativeSection(sectionId, { content: data.content, status: 'generated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setErrors((prev) => ({ ...prev, [sectionId]: message }));
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
    }
  }, [getProjectData, updateNarrativeSection]);

  const generateAll = useCallback(async () => {
    const emptySections = sections.filter(
      (s) => s.status === 'empty' && !getMissingData(s.def)
    );

    for (const section of emptySections) {
      await generateSection(section.def.id);
    }
  }, [sections, getMissingData, generateSection]);

  const handleContentChange = useCallback((id: string, content: string) => {
    updateNarrativeSection(id, { content, status: 'edited' });
  }, [updateNarrativeSection]);

  const isAnyGenerating = generatingIds.size > 0;
  const emptyCount = sections.filter((s) => s.status === 'empty' && !getMissingData(s.def)).length;

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Report Narrative</h2>
          <p className="text-sm text-muted-foreground">
            AI-generated report sections. Edit any section after generation.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Tone toggle */}
          <div className="flex items-center rounded-md border border-border/50 p-0.5">
            <button
              onClick={() => setNarrativeTone('technical')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                narrativeTone === 'technical'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Technical
            </button>
            <button
              onClick={() => setNarrativeTone('summary')}
              className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                narrativeTone === 'summary'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Summary
            </button>
          </div>

          {/* Generate All */}
          <Button
            size="sm"
            onClick={generateAll}
            disabled={isAnyGenerating || emptyCount === 0}
            className="gap-1.5"
          >
            {isAnyGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate All{emptyCount > 0 ? ` (${emptyCount})` : ''}
          </Button>
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-2">
        {sections.map((section) => {
          const missingData = getMissingData(section.def);
          return (
            <SectionCard
              key={section.def.id}
              sectionDef={section.def}
              content={section.content}
              status={section.status}
              tone={narrativeTone}
              onGenerate={() => generateSection(section.def.id)}
              onContentChange={(content) => handleContentChange(section.def.id, content)}
              isGenerating={generatingIds.has(section.def.id)}
              missingData={missingData}
            />
          );
        })}
      </div>

      {/* Error display */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          {Object.entries(errors).map(([id, msg]) => (
            <p key={id} className="text-xs text-destructive">
              <span className="font-medium">{NARRATIVE_SECTIONS.find((s) => s.id === id)?.title}:</span> {msg}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
