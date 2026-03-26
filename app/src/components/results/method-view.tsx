'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MethodResult } from '@/engine/types';
import { ProfileAccordion } from './profile-accordion';
import { Calculator } from 'lucide-react';

interface MethodViewProps { name: string; reference: string; equation: string; results: MethodResult[]; }

export function MethodView({ name, reference, equation, results }: MethodViewProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Calculator className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">No results yet</p>
        <p className="text-xs mt-1">Configure inputs and run calculations</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary">
        <CardHeader><CardTitle>{name}</CardTitle><CardDescription>{reference}</CardDescription></CardHeader>
        <CardContent><code className="block text-xs bg-muted/30 p-3 rounded-md border font-mono text-primary">{equation}</code></CardContent>
      </Card>
      <ProfileAccordion results={results} />
    </div>
  );
}
