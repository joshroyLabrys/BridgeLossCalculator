'use client';

import { Sparkles } from 'lucide-react';

interface AiCalloutProps {
  text: string | null;
  loading: boolean;
}

export function AiCallout({ text, loading }: AiCalloutProps) {
  if (!loading && !text) return null;

  if (loading) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 mt-3">
        <Sparkles className="h-3.5 w-3.5 text-primary/40 animate-pulse mt-0.5 shrink-0" />
        <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 mt-3">
      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}
