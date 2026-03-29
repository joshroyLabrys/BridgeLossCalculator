'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, NumericInput } from '@flowsuite/ui';
import { useHydroStore } from '../store';

// Leaflet must be loaded client-side only (no SSR)
const LeafletMap = dynamic(
  () => import('@/components/hydrology/leaflet-map'),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted" /> },
);

const DEFAULT_LAT = -27.47;
const DEFAULT_LNG = 153.02;

export function StepCatchment() {
  const projectName = useHydroStore((s) => s.projectName);
  const location = useHydroStore((s) => s.location);
  const catchmentArea = useHydroStore((s) => s.catchmentArea);
  const streamLength = useHydroStore((s) => s.streamLength);
  const equalAreaSlope = useHydroStore((s) => s.equalAreaSlope);

  const setProjectName = useHydroStore((s) => s.setProjectName);
  const setLocation = useHydroStore((s) => s.setLocation);
  const setCatchmentArea = useHydroStore((s) => s.setCatchmentArea);
  const setStreamLength = useHydroStore((s) => s.setStreamLength);
  const setEqualAreaSlope = useHydroStore((s) => s.setEqualAreaSlope);

  const lat = location?.lat ?? DEFAULT_LAT;
  const lng = location?.lng ?? DEFAULT_LNG;

  const handleMapClick = useCallback(
    (clickLat: number, clickLng: number) => {
      setLocation({ lat: parseFloat(clickLat.toFixed(6)), lng: parseFloat(clickLng.toFixed(6)) });
    },
    [setLocation],
  );

  const handleLatChange = useCallback(
    (val: number) => setLocation({ lat: val, lng }),
    [setLocation, lng],
  );

  const handleLngChange = useCallback(
    (val: number) => setLocation({ lat, lng: val }),
    [setLocation, lat],
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column — inputs */}
      <div className="space-y-5">
        {/* Project name */}
        <div className="space-y-1.5">
          <Label htmlFor="projectName">Project name</Label>
          <Input
            id="projectName"
            placeholder="e.g. Smith St Trunk Drainage"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>

        {/* Location */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Location</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="lat">Latitude</Label>
              <NumericInput id="lat" value={lat} onCommit={handleLatChange} step="any" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lng">Longitude</Label>
              <NumericInput id="lng" value={lng} onCommit={handleLngChange} step="any" />
            </div>
          </div>
          <div className="h-[260px] overflow-hidden rounded-lg border">
            <LeafletMap lat={lat} lng={lng} onMapClick={handleMapClick} />
          </div>
          <p className="text-xs text-muted-foreground">Click the map to set the catchment centroid.</p>
        </fieldset>

        {/* Catchment area */}
        <div className="space-y-1.5">
          <Label htmlFor="catchmentArea">Catchment area (km²)</Label>
          <NumericInput
            id="catchmentArea"
            value={catchmentArea}
            onCommit={setCatchmentArea}
            min={0}
            step="any"
            placeholder="0"
          />
        </div>

        {/* Main stream length */}
        <div className="space-y-1.5">
          <Label htmlFor="streamLength">Main stream length (km)</Label>
          <NumericInput
            id="streamLength"
            value={streamLength}
            onCommit={setStreamLength}
            min={0}
            step="any"
            placeholder="0"
          />
        </div>

        {/* Equal-area slope */}
        <div className="space-y-1.5">
          <Label htmlFor="equalAreaSlope">Equal-area slope (m/km)</Label>
          <NumericInput
            id="equalAreaSlope"
            value={equalAreaSlope}
            onCommit={setEqualAreaSlope}
            min={0}
            step="any"
            placeholder="0"
          />
        </div>
      </div>

      {/* Right column — guidance */}
      <Card className="h-fit lg:sticky lg:top-6" size="sm">
        <CardHeader>
          <CardTitle>Parameter guidance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div>
            <p className="font-medium text-foreground">Project name</p>
            <p>A descriptive label for this analysis — used in exports and reports.</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Location</p>
            <p>
              Set the catchment centroid by clicking the map or entering coordinates directly.
              This is used to retrieve ARR Data Hub parameters (IFD, temporal patterns, losses).
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Catchment area</p>
            <p>
              Total contributing area in km². Measure from topographic contours or GIS.
              Used for areal reduction factors and unit hydrograph scaling.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Main stream length</p>
            <p>
              Length of the longest flow path from the catchment divide to the outlet, in km.
              Required for time-of-concentration calculations.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Equal-area slope</p>
            <p>
              The slope of a line drawn so that the area above and below it on the stream profile are equal, in m/km.
              Used in the Bransby-Williams and Friends Tc methods.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
