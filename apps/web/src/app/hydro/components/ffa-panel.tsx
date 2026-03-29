'use client';

import { useState, useCallback } from 'react';
import { useHydroStore } from '../store';
import { fitLogPearsonIII } from '@flowsuite/engine/hydrology/flood-frequency';
import { AEP_TO_ARI } from '@flowsuite/engine/hydrology/types';
import type { FFAResult } from '@flowsuite/engine/hydrology/types';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from '@flowsuite/ui';

/** Parse comma or tab separated year,Q lines */
function parseAnnualMaxima(text: string): { year: number; q: number }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split(/[,\t]+/).map((s) => s.trim());
      if (parts.length < 2) return null;
      const year = parseInt(parts[0], 10);
      const q = parseFloat(parts[1]);
      if (isNaN(year) || isNaN(q)) return null;
      return { year, q };
    })
    .filter((d): d is { year: number; q: number } => d !== null);
}

export function FFAPanel() {
  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const results = useHydroStore((s) => s.results);
  const ffaResults = useHydroStore((s) => s.ffaResults);
  const setFFAData = useHydroStore((s) => s.setFFAData);
  const setFFAResults = useHydroStore((s) => s.setFFAResults);

  const handleFit = useCallback(() => {
    setParseError(null);
    const data = parseAnnualMaxima(rawText);
    if (data.length < 2) {
      setParseError('Need at least 2 annual maxima (year, Q per line).');
      return;
    }
    setFFAData(data);
    const result = fitLogPearsonIII(data);
    setFFAResults(result);
  }, [rawText, setFFAData, setFFAResults]);

  /** Check divergence between FFA Q and design-rainfall Q for a given AEP */
  function getDivergence(
    aep: string,
    ffaQ: number,
    summaryRows: NonNullable<typeof results>['summary'],
  ): { pct: number; warn: boolean } | null {
    const match = summaryRows.find((s) => s.aep === aep);
    if (!match || match.medianPeakQ <= 0 || ffaQ <= 0) return null;
    const pct = Math.abs(ffaQ - match.medianPeakQ) / match.medianPeakQ;
    return { pct, warn: pct > 0.3 };
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer">
        <span>Flood Frequency Cross-Check (optional)</span>
        <svg
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        {/* Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Annual Maximum Series (year, Q per line — comma or tab separated)
          </label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={`# Year, Q (m³/s)\n1990, 45.2\n1991, 32.8\n1992, 67.1\n...`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          {parseError && (
            <p className="text-sm text-destructive">{parseError}</p>
          )}
          <Button onClick={handleFit} disabled={rawText.trim().length === 0}>
            Fit Distribution
          </Button>
        </div>

        {/* Results */}
        {ffaResults && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Log Pearson III — Mean: {ffaResults.logPearsonIII.mean.toFixed(3)},
              Std Dev: {ffaResults.logPearsonIII.stdDev.toFixed(3)},
              Skew: {ffaResults.logPearsonIII.skew.toFixed(3)}
              {ffaResults.annualMaxima.length > 0 &&
                ` (n=${ffaResults.annualMaxima.length})`}
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>AEP</TableHead>
                  <TableHead>ARI</TableHead>
                  <TableHead className="text-right">FFA Q (m³/s)</TableHead>
                  <TableHead className="text-right">95% CI</TableHead>
                  {results && (
                    <>
                      <TableHead className="text-right">Design Q (m³/s)</TableHead>
                      <TableHead className="text-right">Divergence</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ffaResults.quantiles.map((row) => {
                  const div =
                    results
                      ? getDivergence(row.aep, row.q, results.summary)
                      : null;
                  return (
                    <TableRow key={row.aep}>
                      <TableCell>{row.aep}</TableCell>
                      <TableCell>{AEP_TO_ARI[row.aep] ?? '--'}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.q.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-mono">
                        {row.confidenceLow.toFixed(1)} – {row.confidenceHigh.toFixed(1)}
                      </TableCell>
                      {results && (
                        <>
                          <TableCell className="text-right font-mono">
                            {results.summary
                              .find((s) => s.aep === row.aep)
                              ?.medianPeakQ.toFixed(1) ?? '--'}
                          </TableCell>
                          <TableCell className="text-right">
                            {div ? (
                              <span className={div.warn ? 'text-destructive font-medium' : ''}>
                                {(div.pct * 100).toFixed(0)}%
                                {div.warn && (
                                  <Badge variant="destructive" className="ml-2 text-[10px]">
                                    &gt;30%
                                  </Badge>
                                )}
                              </span>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
