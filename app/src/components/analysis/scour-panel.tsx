'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NumericInput } from '@/components/ui/numeric-input';
import { calculatePierScour } from '@/engine/scour/pier-scour';
import { calculateContractionScour, criticalVelocity } from '@/engine/scour/contraction-scour';
import { ScourDiagram } from './scour-diagram';
import { unitLabel, toDisplay } from '@/lib/units';
import { Droplets, AlertTriangle } from 'lucide-react';
import type { BedMaterial, ScourResults, ScourInputs } from '@/engine/types';

const BED_MATERIAL_D50_HINTS: Record<BedMaterial, string> = {
  sand: '0.1 - 2 mm',
  gravel: '2 - 64 mm',
  cobble: '64 - 256 mm',
  clay: '0.001 - 0.06 mm',
  rock: 'Non-erodible',
};

export function ScourPanel() {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const results = useProjectStore((s) => s.results);
  const scourInputs = useProjectStore((s) => s.scourInputs);
  const updateScourInputs = useProjectStore((s) => s.updateScourInputs);
  const scourResults = useProjectStore((s) => s.scourResults);
  const setScourResults = useProjectStore((s) => s.setScourResults);
  const us = useProjectStore((s) => s.unitSystem);

  const len = unitLabel('length', us);
  const vel = unitLabel('velocity', us);

  const [selectedProfileIdx, setSelectedProfileIdx] = useState(0);

  // Default upstream bed elevation: lowest XS point between abutments
  const defaultBedElev = useMemo(() => {
    if (crossSection.length < 2) return 0;
    const left = bridgeGeometry.leftAbutmentStation;
    const right = bridgeGeometry.rightAbutmentStation;
    const bridgePoints = crossSection.filter(
      (p) => p.station >= left && p.station <= right,
    );
    if (bridgePoints.length === 0) return Math.min(...crossSection.map((p) => p.elevation));
    return Math.min(...bridgePoints.map((p) => p.elevation));
  }, [crossSection, bridgeGeometry]);

  function handleCalculate() {
    if (!results || flowProfiles.length === 0 || crossSection.length < 2) return;

    const bedElev = scourInputs.upstreamBedElevation || defaultBedElev;
    const piers = bridgeGeometry.piers;

    const allResults: ScourResults[] = [];

    for (let pi = 0; pi < flowProfiles.length; pi++) {
      const profile = flowProfiles[pi];

      // Get approach conditions from the energy method result (primary)
      const methodResult =
        results.energy?.[pi] ?? results.momentum?.[pi] ?? results.yarnell?.[pi] ?? results.wspro?.[pi];
      if (!methodResult) continue;

      const approachV = methodResult.approachVelocity;
      const frApproach = methodResult.froudeApproach;
      const approachDepth = methodResult.inputEcho.flowArea / (
        bridgeGeometry.rightAbutmentStation - bridgeGeometry.leftAbutmentStation || 1
      );
      const approachWidth = bridgeGeometry.rightAbutmentStation - bridgeGeometry.leftAbutmentStation;
      const contractedWidth = approachWidth - piers.reduce((s, p) => s + p.width, 0);

      // D50 for live-bed check
      const d50ft = scourInputs.d50 / 304.8;
      const Vc = criticalVelocity(approachDepth > 0 ? approachDepth : 1, d50ft > 0 ? d50ft : 0.001);
      const isLiveBed = approachV > Vc;

      // Pier scour for each pier
      const pierResults = piers.map((pier, idx) =>
        calculatePierScour(
          pier,
          idx,
          approachDepth > 0 ? approachDepth : 1,
          frApproach > 0 ? frApproach : 0.1,
          bridgeGeometry.skewAngle,
          bedElev,
          isLiveBed,
        ),
      );

      // Contraction scour
      const contractionResult = calculateContractionScour(
        approachV,
        approachDepth > 0 ? approachDepth : 1,
        scourInputs.d50 > 0 ? scourInputs.d50 : 1,
        profile.discharge,
        profile.discharge, // assume Q2 ~ Q1 for bridge opening
        approachWidth > 0 ? approachWidth : 1,
        contractedWidth > 0 ? contractedWidth : approachWidth > 0 ? approachWidth : 1,
        approachDepth > 0 ? approachDepth : 1,
        bedElev,
      );

      // Worst-case total = max pier scour + contraction scour
      const maxPierScour = pierResults.length > 0
        ? Math.max(...pierResults.map((r) => r.scourDepth))
        : 0;
      const totalWorstCase = maxPierScour + contractionResult.scourDepth;

      allResults.push({
        profileName: profile.name,
        pierScour: pierResults,
        contractionScour: contractionResult,
        totalWorstCase,
      });
    }

    setScourResults(allResults);
  }

  const selectedResult = scourResults?.[selectedProfileIdx] ?? null;
  const worstTotal = scourResults
    ? Math.max(...scourResults.map((r) => r.totalWorstCase))
    : null;

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      {worstTotal !== null && worstTotal > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300">
                  Worst-case total scour: {toDisplay(worstTotal, 'length', us).toFixed(2)} {len}
                </p>
                <p className="text-xs text-muted-foreground">
                  Combined pier + contraction scour across all profiles. Review countermeasure adequacy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inputs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Scour Inputs</CardTitle>
          </div>
          <CardDescription>
            Define bed material and geometry for HEC-18 scour estimation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Bed Material */}
            <div className="space-y-1.5">
              <Label className="text-xs">Bed Material</Label>
              <Select
                value={scourInputs.bedMaterial}
                onValueChange={(v) => updateScourInputs({ bedMaterial: v as BedMaterial })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['sand', 'gravel', 'cobble', 'clay', 'rock'] as BedMaterial[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                D50 hint: {BED_MATERIAL_D50_HINTS[scourInputs.bedMaterial]}
              </p>
            </div>

            {/* D50 */}
            <div className="space-y-1.5">
              <Label className="text-xs">D50 (mm)</Label>
              <NumericInput
                value={scourInputs.d50}
                onCommit={(v) => updateScourInputs({ d50: v })}
                className="text-xs"
                placeholder="Median grain size"
              />
            </div>

            {/* D95 */}
            <div className="space-y-1.5">
              <Label className="text-xs">D95 (mm) — optional</Label>
              <NumericInput
                value={scourInputs.d95}
                onCommit={(v) => updateScourInputs({ d95: v })}
                className="text-xs"
                placeholder="Optional"
              />
            </div>

            {/* Upstream bed elevation */}
            <div className="space-y-1.5">
              <Label className="text-xs">Upstream Bed Elev ({len})</Label>
              <NumericInput
                value={scourInputs.upstreamBedElevation || defaultBedElev}
                onCommit={(v) => updateScourInputs({ upstreamBedElevation: v })}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Defaults to lowest XS elevation at bridge
              </p>
            </div>

            {/* Countermeasure */}
            <div className="space-y-1.5">
              <Label className="text-xs">Countermeasure</Label>
              <Select
                value={scourInputs.countermeasure}
                onValueChange={(v) =>
                  updateScourInputs({ countermeasure: v as ScourInputs['countermeasure'] })
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="riprap">Riprap</SelectItem>
                  <SelectItem value="sheet-pile">Sheet Pile</SelectItem>
                  <SelectItem value="gabions">Gabions</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calculate button */}
            <div className="flex items-end">
              <Button
                onClick={handleCalculate}
                disabled={!results || flowProfiles.length === 0}
                className="w-full"
                size="sm"
              >
                Calculate Scour
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {scourResults && scourResults.length > 0 && (
        <>
          {/* Profile selector */}
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground">Profile</Label>
            <Select
              value={String(selectedProfileIdx)}
              onValueChange={(v) => setSelectedProfileIdx(Number(v))}
            >
              <SelectTrigger size="sm" className="w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {flowProfiles.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contraction scour card */}
          {selectedResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contraction Scour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</p>
                    <Badge
                      variant="outline"
                      className={
                        selectedResult.contractionScour.type === 'live-bed'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      }
                    >
                      {selectedResult.contractionScour.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Critical Vel ({vel})
                    </p>
                    <p className="font-mono tabular-nums">
                      {toDisplay(selectedResult.contractionScour.criticalVelocity, 'velocity', us).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Approach Vel ({vel})
                    </p>
                    <p className="font-mono tabular-nums">
                      {toDisplay(selectedResult.contractionScour.approachVelocity, 'velocity', us).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Scour Depth ({len})
                    </p>
                    <p className="font-mono tabular-nums font-semibold">
                      {toDisplay(selectedResult.contractionScour.scourDepth, 'length', us).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Critical Bed Elev ({len})
                    </p>
                    <p className="font-mono tabular-nums">
                      {toDisplay(selectedResult.contractionScour.criticalBedElevation, 'length', us).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pier scour table */}
          {selectedResult && selectedResult.pierScour.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pier Scour (CSU/HEC-18)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-xs">Pier #</TableHead>
                        <TableHead className="text-xs text-right">Station ({len})</TableHead>
                        <TableHead className="text-xs text-right">Width ({len})</TableHead>
                        <TableHead className="text-xs text-right">K1</TableHead>
                        <TableHead className="text-xs text-right">K2</TableHead>
                        <TableHead className="text-xs text-right">K3</TableHead>
                        <TableHead className="text-xs text-right">Scour Depth ({len})</TableHead>
                        <TableHead className="text-xs text-right">Critical Elev ({len})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedResult.pierScour.map((pr, i) => (
                        <TableRow key={i} className="even:bg-muted/20">
                          <TableCell className="font-medium">{pr.pierIndex + 1}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {toDisplay(pr.station, 'length', us).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {toDisplay(pr.width, 'length', us).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{pr.k1.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{pr.k2.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{pr.k3.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold">
                            {toDisplay(pr.scourDepth, 'length', us).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {toDisplay(pr.criticalBedElevation, 'length', us).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scour diagram */}
          {selectedResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scour Cross-Section</CardTitle>
              </CardHeader>
              <CardContent>
                <ScourDiagram
                  crossSection={crossSection}
                  bridgeGeometry={bridgeGeometry}
                  scourResult={selectedResult}
                  wsel={
                    results?.energy?.[selectedProfileIdx]?.upstreamWsel ??
                    flowProfiles[selectedProfileIdx]?.dsWsel
                  }
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No results state */}
      {!results && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Droplets className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Run hydraulic analysis first</p>
          <p className="text-xs mt-1">Scour calculations require approach velocity and Froude number from the hydraulic results.</p>
        </div>
      )}
    </div>
  );
}
