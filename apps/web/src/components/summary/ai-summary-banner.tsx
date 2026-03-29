'use client';

import { useProjectStore } from '@/store/project-store';
import { Card, CardContent } from '@flowsuite/ui';
import { Sparkles, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

export function AiSummaryBanner() {
  const aiSummary = useProjectStore((s) => s.aiSummary);
  const loading = useProjectStore((s) => s.aiSummaryLoading);
  const error = useProjectStore((s) => s.aiSummaryError);
  const [dismissed, setDismissed] = useState(false);

  if (!loading && !aiSummary && !error) return null;

  if (error && dismissed) return null;

  if (error) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 py-3 px-4">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-400 font-medium">AI analysis unavailable</p>
            <p className="text-xs text-amber-400/70 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400/50 hover:text-amber-400">
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4 px-4">
          <Sparkles className="h-4 w-4 text-primary animate-pulse mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-primary/10 animate-pulse" />
            <div className="h-3 w-full rounded bg-primary/10 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-primary/10 animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiSummary) return null;

  const overallItems = Array.isArray(aiSummary.overall) ? aiSummary.overall : [aiSummary.overall];
  const recItems = Array.isArray(aiSummary.recommendations) ? aiSummary.recommendations : [];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4 px-4 space-y-3">
        {/* Overall findings */}
        <div className="flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">AI Analysis</p>
            <ul className="space-y-1">
              {overallItems.map((item, i) => (
                <li key={i} className="text-sm text-foreground leading-relaxed flex items-baseline gap-2">
                  <span className="text-primary/40 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Method Suitability */}
        {aiSummary.callouts.suitability && aiSummary.callouts.suitability.length > 0 && (
          <div className="flex items-start gap-3 border-t border-primary/10 pt-3">
            <ShieldAlert className="h-4 w-4 text-primary/60 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">Method Suitability</p>
              <ul className="space-y-1">
                {aiSummary.callouts.suitability.map((item, i) => (
                  <li key={i} className="text-sm text-foreground/90 leading-relaxed flex items-baseline gap-2">
                    <span className="text-primary/40 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recItems.length > 0 ? (
          <div className="flex items-start gap-3 border-t border-primary/10 pt-3">
            <svg className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/60 mb-1.5">Recommendations</p>
              <ul className="space-y-1">
                {recItems.map((item, i) => (
                  <li key={i} className="text-sm text-foreground/90 leading-relaxed flex items-baseline gap-2">
                    <span className="text-amber-400/50 shrink-0">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
