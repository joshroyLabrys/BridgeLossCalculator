'use client';

import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { NumericInput } from '@/components/ui/numeric-input';
import { useProjectStore } from '@/store/project-store';
import { bransbyWilliams, friends } from '@/engine/hydrology/time-of-concentration';
import { rationalMethod, lookupIntensity, STANDARD_AEPS, LAND_USE_COEFFICIENTS } from '@/engine/hydrology/rational-method';
import { Calculator, Send, Clock } from 'lucide-react';

export function CatchmentCalculator() {
  const hydrology = useProjectStore((s) => s.hydrology);
  const updateHydrology = useProjectStore((s) => s.updateHydrology);
  const updateFlowProfiles = useProjectStore((s) => s.updateFlowProfiles);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  // Compute Tc values
  const tcBW = useMemo(
    () => bransbyWilliams(hydrology.streamLength, hydrology.catchmentArea, hydrology.equalAreaSlope),
    [hydrology.streamLength, hydrology.catchmentArea, hydrology.equalAreaSlope],
  );

  const tcFriends = useMemo(
    () => friends(hydrology.catchmentArea),
    [hydrology.catchmentArea],
  );

  const selectedTc = useMemo(() => {
    switch (hydrology.tcMethod) {
      case 'bransby-williams': return tcBW;
      case 'friends': return tcFriends;
      case 'manual': return hydrology.tcManual;
      default: return 0;
    }
  }, [hydrology.tcMethod, tcBW, tcFriends, hydrology.tcManual]);

  // Convert Tc (hours) to minutes for IFD lookup
  const tcMinutes = selectedTc * 60;

  // Calculate discharges for each AEP
  const discharges = useMemo(() => {
    if (!hydrology.ifdData || selectedTc <= 0 || hydrology.catchmentArea <= 0) return [];

    return STANDARD_AEPS.map((aep) => {
      const intensity = lookupIntensity(hydrology.ifdData!, tcMinutes, aep);
      if (intensity === null) return { aep, q: 0, intensity: 0 };
      const q = rationalMethod(hydrology.runoffCoefficient, intensity, hydrology.catchmentArea);
      return { aep, q, intensity };
    });
  }, [hydrology.ifdData, selectedTc, tcMinutes, hydrology.catchmentArea, hydrology.runoffCoefficient]);

  // Save discharges to store
  const saveDischarges = useCallback(() => {
    updateHydrology({
      calculatedDischarges: discharges.map(({ aep, q }) => ({ aep, q })),
    });
  }, [discharges, updateHydrology]);

  // Send discharges to flow profiles
  const sendToFlowProfiles = useCallback(() => {
    saveDischarges();
    const newProfiles = discharges
      .filter((d) => d.q > 0)
      .map((d) => ({
        name: `${d.aep} AEP`,
        ari: d.aep,
        discharge: Math.round(d.q * 100) / 100,
        dsWsel: 0,
        channelSlope: 0.001,
      }));

    // Merge with existing profiles (replace by ARI, add new)
    const existingByAri = new Map(flowProfiles.map((p) => [p.ari, p]));
    for (const np of newProfiles) {
      existingByAri.set(np.ari, { ...existingByAri.get(np.ari), ...np });
    }
    updateFlowProfiles(Array.from(existingByAri.values()));
  }, [discharges, flowProfiles, saveDischarges, updateFlowProfiles]);

  const tcMethods = [
    { value: 'bransby-williams', label: 'Bransby-Williams' },
    { value: 'friends', label: 'Friends' },
    { value: 'manual', label: 'Manual' },
  ] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      {/* Left column: Tc and runoff coefficient */}
      <div className="space-y-5">
        {/* Time of Concentration card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time of Concentration
            </CardTitle>
            <CardDescription>
              Estimate Tc using Bransby-Williams, Friends, or enter manually
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Method selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tc Method</Label>
              <Select
                value={hydrology.tcMethod}
                onValueChange={(v) => updateHydrology({ tcMethod: v as typeof hydrology.tcMethod })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tcMethods.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bransby-Williams inputs */}
            {hydrology.tcMethod === 'bransby-williams' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Stream Length (km)</Label>
                  <NumericInput
                    value={hydrology.streamLength}
                    onCommit={(v) => updateHydrology({ streamLength: v })}
                    min={0}
                    step={0.1}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Equal-Area Slope (m/km)</Label>
                  <NumericInput
                    value={hydrology.equalAreaSlope}
                    onCommit={(v) => updateHydrology({ equalAreaSlope: v })}
                    min={0}
                    step={0.1}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Manual Tc input */}
            {hydrology.tcMethod === 'manual' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Manual Tc (hours)</Label>
                <NumericInput
                  value={hydrology.tcManual}
                  onCommit={(v) => updateHydrology({ tcManual: v })}
                  min={0}
                  step={0.01}
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {/* Tc comparison table */}
            <div className="rounded-md border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs text-right">Tc (hours)</TableHead>
                    <TableHead className="text-xs text-right">Tc (min)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className={hydrology.tcMethod === 'bransby-williams' ? 'bg-blue-500/10' : ''}>
                    <TableCell className="text-xs">
                      Bransby-Williams
                      {hydrology.tcMethod === 'bransby-williams' && (
                        <Badge variant="outline" className="ml-2 text-[9px] py-0">selected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right">{tcBW.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono text-right">{(tcBW * 60).toFixed(0)}</TableCell>
                  </TableRow>
                  <TableRow className={hydrology.tcMethod === 'friends' ? 'bg-blue-500/10' : ''}>
                    <TableCell className="text-xs">
                      Friends
                      {hydrology.tcMethod === 'friends' && (
                        <Badge variant="outline" className="ml-2 text-[9px] py-0">selected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right">{tcFriends.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono text-right">{(tcFriends * 60).toFixed(0)}</TableCell>
                  </TableRow>
                  {hydrology.tcMethod === 'manual' && (
                    <TableRow className="bg-blue-500/10">
                      <TableCell className="text-xs">
                        Manual
                        <Badge variant="outline" className="ml-2 text-[9px] py-0">selected</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-right">{hydrology.tcManual.toFixed(2)}</TableCell>
                      <TableCell className="text-xs font-mono text-right">{(hydrology.tcManual * 60).toFixed(0)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Runoff Coefficient card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Runoff Coefficient (C)</CardTitle>
            <CardDescription>ARR Book 5 suggested values by land use</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Land use suggestions */}
            <div className="grid gap-2">
              {LAND_USE_COEFFICIENTS.map((lu) => (
                <button
                  key={lu.label}
                  type="button"
                  onClick={() => updateHydrology({ runoffCoefficient: lu.default })}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors hover:bg-muted/50 ${
                    hydrology.runoffCoefficient === lu.default
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-border/50'
                  }`}
                >
                  <span>{lu.label}</span>
                  <span className="font-mono text-muted-foreground">{lu.range} (default {lu.default})</span>
                </button>
              ))}
            </div>

            {/* Manual override */}
            <div className="space-y-1.5">
              <Label className="text-xs">Custom C value</Label>
              <NumericInput
                value={hydrology.runoffCoefficient}
                onCommit={(v) => updateHydrology({ runoffCoefficient: Math.max(0, Math.min(1, v)) })}
                min={0}
                max={1}
                step={0.01}
                className="h-8 text-xs font-mono"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column: Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Discharge Results (Rational Method)
          </CardTitle>
          <CardDescription>
            Q = C x I x A / 360 for each standard AEP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px]">
              Tc = {selectedTc.toFixed(2)} hr ({(selectedTc * 60).toFixed(0)} min)
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              C = {hydrology.runoffCoefficient}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              A = {hydrology.catchmentArea} km²
            </Badge>
          </div>

          {discharges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No results yet</p>
              <p className="text-xs mt-1">
                Load IFD data and set catchment parameters first
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">AEP</TableHead>
                    <TableHead className="text-xs text-right">Intensity (mm/hr)</TableHead>
                    <TableHead className="text-xs text-right">Q (m³/s)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discharges.map((d) => (
                    <TableRow key={d.aep}>
                      <TableCell className="text-xs font-medium">{d.aep}</TableCell>
                      <TableCell className="text-xs font-mono text-right">
                        {d.intensity.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-right font-medium">
                        {d.q.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button onClick={sendToFlowProfiles} className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Send to Flow Profiles
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
