'use client';

import { MethodResult } from '@/engine/types';
import { ProfileAccordion } from './profile-accordion';

interface MethodViewProps {
  name: string;
  reference: string;
  equation: string;
  results: MethodResult[];
}

export function MethodView({ name, reference, equation, results }: MethodViewProps) {
  if (results.length === 0) {
    return <p className="text-muted-foreground">No results. Run calculations first.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h3 className="text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">{reference}</p>
        <code className="block mt-2 text-xs bg-card p-2 rounded border font-mono">{equation}</code>
      </div>
      <ProfileAccordion results={results} />
    </div>
  );
}
