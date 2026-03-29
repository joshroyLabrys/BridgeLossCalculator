'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@flowsuite/ui';
import { Button } from '@flowsuite/ui';
import { Input } from '@flowsuite/ui';
import { Label } from '@flowsuite/ui';
import { Badge } from '@flowsuite/ui';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@flowsuite/ui';
import { NumericInput } from '@flowsuite/ui';
import { useProjectStore } from '@/store/project-store';
import type { IFDTable } from '@flowsuite/engine/types';
import { MapPin, Download, Loader2, AlertTriangle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Leaflet map — dynamic import (no SSR)                              */
/* ------------------------------------------------------------------ */
const LeafletMap = dynamic(() => import('./leaflet-map'), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Mock IFD data for offline / API failure fallback                    */
/* ------------------------------------------------------------------ */
function generateMockIFD(): IFDTable {
  const durations = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 360, 720, 1440];
  const aeps = ['50%', '20%', '10%', '5%', '2%', '1%'];
  // Approximate IFD intensities (mm/hr) for a typical SE QLD location
  const baseIntensities = [180, 130, 105, 88, 68, 52, 42, 32, 26, 20, 12, 7.5, 4.8];
  const aepMultipliers = [0.55, 0.75, 0.88, 1.0, 1.18, 1.32];

  const intensities = baseIntensities.map((base) =>
    aepMultipliers.map((m) => Math.round(base * m * 10) / 10),
  );

  return { durations, aeps, intensities };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export function ArrLookup() {
  const hydrology = useProjectStore((s) => s.hydrology);
  const updateHydrology = useProjectStore((s) => s.updateHydrology);

  const [lat, setLat] = useState(hydrology.location?.lat ?? -27.47);
  const [lng, setLng] = useState(hydrology.location?.lng ?? 153.02);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  // Sync location from map clicks
  const handleMapClick = useCallback((newLat: number, newLng: number) => {
    setLat(Math.round(newLat * 10000) / 10000);
    setLng(Math.round(newLng * 10000) / 10000);
  }, []);

  // Fetch IFD data from ARR Data Hub
  const fetchIFD = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUsedFallback(false);

    try {
      const url = `https://data.arr-software.org/v3/ifd?lat=${lat}&lng=${lng}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

      if (!response.ok) {
        throw new Error(`ARR API returned ${response.status}`);
      }

      const data = await response.json();

      // Parse the ARR response into our IFDTable format
      // The exact format may vary — attempt common structures
      if (data && data.durations && data.aeps && data.intensities) {
        const ifdData: IFDTable = {
          durations: data.durations,
          aeps: data.aeps,
          intensities: data.intensities,
        };
        updateHydrology({ location: { lat, lng }, ifdData });
      } else {
        // API returned unexpected format — use fallback
        throw new Error('Unexpected API response format');
      }
    } catch (err) {
      // Use mock data as fallback
      const mockData = generateMockIFD();
      updateHydrology({ location: { lat, lng }, ifdData: mockData });
      setUsedFallback(true);
      setError(
        err instanceof Error
          ? `${err.message} — using example IFD data. Replace with actual values for your site.`
          : 'Network error — using example IFD data.',
      );
    } finally {
      setLoading(false);
    }
  }, [lat, lng, updateHydrology]);

  const ifd = hydrology.ifdData;

  // Find the critical duration row index (highest intensity for the first AEP)
  const criticalDurationIdx = ifd
    ? ifd.intensities.reduce(
        (maxIdx, row, idx) => (row[0] > (ifd.intensities[maxIdx]?.[0] ?? 0) ? idx : maxIdx),
        0,
      )
    : -1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      {/* Left column: Map + location inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Site Location
          </CardTitle>
          <CardDescription>
            Click the map or enter coordinates to set your catchment location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Map */}
          <div className="h-[300px] w-full rounded-lg overflow-hidden border border-border/50">
            <LeafletMap lat={lat} lng={lng} onMapClick={handleMapClick} />
          </div>

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Latitude</Label>
              <NumericInput
                value={lat}
                onCommit={setLat}
                step={0.0001}
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Longitude</Label>
              <NumericInput
                value={lng}
                onCommit={setLng}
                step={0.0001}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Catchment area */}
          <div className="space-y-1.5">
            <Label className="text-xs">Catchment Area (km²)</Label>
            <NumericInput
              value={hydrology.catchmentArea}
              onCommit={(v) => updateHydrology({ catchmentArea: v })}
              min={0}
              step={0.1}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Fetch button */}
          <Button onClick={fetchIFD} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching IFD Data...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Fetch IFD Data
              </>
            )}
          </Button>

          {/* Error / fallback message */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {usedFallback && !error && (
            <div className="text-xs text-muted-foreground">
              Using example IFD data. The ARR Data Hub API URL may need updating.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right column: IFD results table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            IFD Results
            {ifd && (
              <Badge variant="outline" className="text-[10px]">
                {ifd.durations.length} durations x {ifd.aeps.length} AEPs
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Intensity-Frequency-Duration data (mm/hr)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ifd ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No IFD data loaded</p>
              <p className="text-xs mt-1">Set location and click "Fetch IFD Data"</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Duration (min)</TableHead>
                    {ifd.aeps.map((aep) => (
                      <TableHead key={aep} className="text-xs text-right">
                        {aep}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ifd.durations.map((dur, rowIdx) => (
                    <TableRow
                      key={dur}
                      className={rowIdx === criticalDurationIdx ? 'bg-blue-500/10' : ''}
                    >
                      <TableCell className="text-xs font-mono font-medium">
                        {dur}
                        {rowIdx === criticalDurationIdx && (
                          <Badge variant="outline" className="ml-2 text-[9px] py-0">
                            critical
                          </Badge>
                        )}
                      </TableCell>
                      {ifd.intensities[rowIdx].map((intensity, colIdx) => (
                        <TableCell key={colIdx} className="text-xs font-mono text-right">
                          {intensity.toFixed(1)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
