'use client';

import { useProjectStore } from '@/store/project-store';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, AlertTriangle, X } from 'lucide-react';
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

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex items-start gap-3 py-4 px-4">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/60 mb-1.5">AI Analysis</p>
          <p className="text-sm text-foreground leading-relaxed">{aiSummary.overall}</p>
        </div>
      </CardContent>
    </Card>
  );
}
