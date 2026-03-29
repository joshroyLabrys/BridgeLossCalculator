'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/project-store';
import { assessMethodSuitability, type MethodFlag, type SuitabilityLevel } from '@flowsuite/engine/method-suitability';

const METHOD_LABELS: Record<MethodFlag['method'], string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

function dotClass(level: SuitabilityLevel): string {
  switch (level) {
    case 'ok': return 'bg-emerald-500';
    case 'caution': return 'bg-amber-500';
    case 'not-applicable':
    case 'error': return 'bg-red-500';
  }
}

function reasonClass(level: SuitabilityLevel): string {
  switch (level) {
    case 'ok': return 'text-foreground/60';
    case 'caution': return 'text-amber-400/80';
    case 'not-applicable':
    case 'error': return 'text-red-400/80';
  }
}

export function MethodSuitability() {
  const results = useProjectStore((s) => s.results);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const coefficients = useProjectStore((s) => s.coefficients);

  const flags = useMemo(() => {
    if (!results) return null;
    return assessMethodSuitability(results, bridgeGeometry);
  }, [results, bridgeGeometry]);

  if (!flags || !results) return null;

  // Filter to only methods that were run and have results
  const activeFlags = flags.filter(
    (flag) =>
      coefficients.methodsToRun[flag.method] &&
      results[flag.method].length > 0
  );

  if (activeFlags.length === 0) return null;

  // Only render if there are any non-ok flags
  const hasIssues = activeFlags.some((flag) => flag.level !== 'ok');
  if (!hasIssues) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">Method Applicability</p>
      <div className="flex flex-wrap gap-2">
        {activeFlags.map((flag) => (
          <div
            key={flag.method}
            className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-xs"
          >
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass(flag.level)}`} />
            <span className="font-medium text-foreground/80">{METHOD_LABELS[flag.method]}</span>
            {flag.reason && (
              <span className={`${reasonClass(flag.level)}`}>{flag.reason}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
