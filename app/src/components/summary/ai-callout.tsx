'use client';

import { Sparkles } from 'lucide-react';

interface AiCalloutProps {
  text: string | string[] | null;
  loading: boolean;
}

export interface AiCalloutSection {
  label: string;
  text: string | string[] | null;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-foreground/80 leading-relaxed flex items-baseline gap-2">
          <span className="text-primary/30 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AiCallout({ text, loading }: AiCalloutProps) {
  if (!loading && !text) return null;
  if (!loading && Array.isArray(text) && text.length === 0) return null;

  if (loading) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-primary/40 animate-pulse mt-0.5 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-24 rounded bg-primary/10 animate-pulse" />
          <div className="h-3 w-full rounded bg-primary/10 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
        </div>
      </div>
    );
  }

  const items = Array.isArray(text) ? text : [text!];

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <div className="space-y-0.5 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 mb-1">AI Insight</p>
        <BulletList items={items} />
      </div>
    </div>
  );
}

/**
 * Merged callout with multiple labelled sections separated by dividers.
 * Use when a single card needs insights from multiple AI callout categories.
 */
export function AiCalloutGrouped({ sections, loading }: { sections: AiCalloutSection[]; loading: boolean }) {
  const activeSections = sections.filter((s) => s.text && (!Array.isArray(s.text) || s.text.length > 0));

  if (!loading && activeSections.length === 0) return null;

  if (loading) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
        <Sparkles className="h-3.5 w-3.5 text-primary/40 animate-pulse mt-0.5 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-24 rounded bg-primary/10 animate-pulse" />
          <div className="h-3 w-full rounded bg-primary/10 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <div className="space-y-2 min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/50">AI Insight</p>
        {activeSections.map((section, i) => {
          const items = Array.isArray(section.text) ? section.text : [section.text!];
          return (
            <div key={section.label}>
              {i > 0 && <div className="border-t border-primary/10 mb-2" />}
              <p className="text-[11px] font-medium text-primary/70 mb-0.5">{section.label}</p>
              <BulletList items={items} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

