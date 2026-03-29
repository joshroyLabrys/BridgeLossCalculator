'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useHydroStore } from '../store';
import { AEP_TO_ARI } from '@flowsuite/engine/hydrology/types';
import type { HydroFlowExport, DesignStormSummary } from '@flowsuite/engine/hydrology/types';
import { setStorage } from '@flowsuite/data/storage';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@flowsuite/ui';
import { FFAPanel } from './ffa-panel';

/** Format duration in minutes to a human-readable string */
function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = minutes / 60;
  return hrs === Math.floor(hrs) ? `${hrs} hr` : `${hrs.toFixed(1)} hr`;
}

/** Build the export payload from store state */
function buildExport(
  summary: DesignStormSummary[],
  projectName: string,
  catchmentArea: number,
  location: { lat: number; lng: number } | null,
): HydroFlowExport {
  return {
    projectName,
    catchmentArea,
    location,
    timestamp: Date.now(),
    flows: summary.map((s) => ({
      aep: s.aep,
      ari: AEP_TO_ARI[s.aep] ?? s.aep,
      criticalDurationMin: s.criticalDurationMin,
      designQ: s.medianPeakQ,
      ensembleMin: s.minPeakQ,
      ensembleMax: s.maxPeakQ,
    })),
  };
}

/** Download a string as a file */
function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function StepDesignFlows() {
  const router = useRouter();
  const results = useHydroStore((s) => s.results);
  const projectName = useHydroStore((s) => s.projectName);
  const catchmentArea = useHydroStore((s) => s.catchmentArea);
  const location = useHydroStore((s) => s.location);

  const summary = results?.summary ?? [];

  // ── Actions ──

  const handleSendToBLC = useCallback(() => {
    if (summary.length === 0) return;
    const data = buildExport(summary, projectName, catchmentArea, location);
    setStorage('hydro:latest-flows', data);
    router.push('/blc');
  }, [summary, projectName, catchmentArea, location, router]);

  const handleExportJSON = useCallback(() => {
    if (summary.length === 0) return;
    const data = buildExport(summary, projectName, catchmentArea, location);
    const json = JSON.stringify(data, null, 2);
    const filename = projectName
      ? `${projectName.replace(/\s+/g, '_')}_hydro.json`
      : 'hydro_flows.json';
    downloadFile(json, filename, 'application/json');
  }, [summary, projectName, catchmentArea, location]);

  const handleExportCSV = useCallback(() => {
    if (summary.length === 0) return;
    const header = 'AEP,ARI,Critical Duration (min),Design Q (m³/s),Ensemble Min,Ensemble Max';
    const rows = summary.map(
      (s) =>
        `${s.aep},${AEP_TO_ARI[s.aep] ?? ''},${s.criticalDurationMin},${s.medianPeakQ.toFixed(1)},${s.minPeakQ.toFixed(1)},${s.maxPeakQ.toFixed(1)}`,
    );
    const csv = [header, ...rows].join('\n');
    const filename = projectName
      ? `${projectName.replace(/\s+/g, '_')}_hydro.csv`
      : 'hydro_flows.csv';
    downloadFile(csv, filename, 'text/csv');
  }, [summary, projectName]);

  const handleCopyClipboard = useCallback(async () => {
    if (summary.length === 0) return;
    const header = 'AEP\tARI\tCritical Duration\tDesign Q (m³/s)\tEnsemble Min\tEnsemble Max';
    const rows = summary.map(
      (s) =>
        `${s.aep}\t${AEP_TO_ARI[s.aep] ?? ''}\t${fmtDuration(s.criticalDurationMin)}\t${s.medianPeakQ.toFixed(1)}\t${s.minPeakQ.toFixed(1)}\t${s.maxPeakQ.toFixed(1)}`,
    );
    const tsv = [header, ...rows].join('\n');
    await navigator.clipboard.writeText(tsv);
  }, [summary]);

  // ── Render ──

  if (!results || summary.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">Run design storms in Step 5 first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary table */}
      <Card>
        <CardHeader>
          <CardTitle>Design Flows</CardTitle>
          <CardDescription>
            {projectName ? `${projectName} — ` : ''}
            Critical duration and peak discharge per AEP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AEP</TableHead>
                <TableHead>ARI</TableHead>
                <TableHead>Critical Duration</TableHead>
                <TableHead className="text-right">Design Q (m³/s)</TableHead>
                <TableHead className="text-right">Ensemble Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((row) => (
                <TableRow key={row.aep}>
                  <TableCell className="font-medium">{row.aep}</TableCell>
                  <TableCell>{AEP_TO_ARI[row.aep] ?? '--'}</TableCell>
                  <TableCell>{fmtDuration(row.criticalDurationMin)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {row.medianPeakQ.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground font-mono">
                    {row.minPeakQ.toFixed(1)} – {row.maxPeakQ.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSendToBLC}>Send to BLC</Button>
        <Button variant="outline" onClick={handleExportJSON}>
          Export JSON
        </Button>
        <Button variant="outline" onClick={handleExportCSV}>
          Export CSV
        </Button>
        <Button variant="outline" onClick={handleCopyClipboard}>
          Copy to Clipboard
        </Button>
      </div>

      {/* FFA cross-check */}
      <FFAPanel />
    </div>
  );
}
