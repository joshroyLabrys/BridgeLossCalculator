'use client';

import { useMemo, useCallback } from 'react';
import { useHydroStore } from '../store';
import { bransbyWilliams, friends } from '@flowsuite/engine/hydrology/time-of-concentration';
import { ARR_STANDARD_DURATIONS } from '@flowsuite/engine/hydrology/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  NumericInput,
  Checkbox,
} from '@flowsuite/ui';

/** Format hours as "X.XX hr (Y min)" */
function fmtTc(hours: number): string {
  if (hours <= 0) return '--';
  const mins = Math.round(hours * 60);
  return `${hours.toFixed(2)} hr (${mins} min)`;
}

type TcMethod = 'bransby-williams' | 'friends' | 'manual';

export function StepTc() {
  const streamLength = useHydroStore((s) => s.streamLength);
  const catchmentArea = useHydroStore((s) => s.catchmentArea);
  const equalAreaSlope = useHydroStore((s) => s.equalAreaSlope);

  const tcMethod = useHydroStore((s) => s.tcMethod);
  const tcManual = useHydroStore((s) => s.tcManual);
  const rCoefficient = useHydroStore((s) => s.rCoefficient);
  const durationRange = useHydroStore((s) => s.durationRange);

  const setTcMethod = useHydroStore((s) => s.setTcMethod);
  const setTcManual = useHydroStore((s) => s.setTcManual);
  const setRCoefficient = useHydroStore((s) => s.setRCoefficient);
  const setDurationRange = useHydroStore((s) => s.setDurationRange);

  // Auto-calculated Tc values
  const tcBW = useMemo(
    () => bransbyWilliams(streamLength, catchmentArea, equalAreaSlope),
    [streamLength, catchmentArea, equalAreaSlope],
  );
  const tcFriends = useMemo(() => friends(catchmentArea), [catchmentArea]);

  // The adopted Tc based on selected method
  const adoptedTc = useMemo(() => {
    switch (tcMethod) {
      case 'bransby-williams':
        return tcBW;
      case 'friends':
        return tcFriends;
      case 'manual':
        return tcManual;
    }
  }, [tcMethod, tcBW, tcFriends, tcManual]);

  // Default R = 1.5 * Tc when user hasn't explicitly set it
  const effectiveR = rCoefficient > 0 ? rCoefficient : adoptedTc * 1.5;

  // Suggested duration range: 0.5*Tc to 2.0*Tc, filtered to standard ARR durations
  const tcMinutes = adoptedTc * 60;
  const suggestedDurations: number[] = useMemo(() => {
    const low = tcMinutes * 0.5;
    const high = tcMinutes * 2.0;
    return [...ARR_STANDARD_DURATIONS].filter((d) => d >= low && d <= high);
  }, [tcMinutes]);

  // If durationRange is empty, populate from suggested
  const activeDurations = durationRange.length > 0 ? durationRange : [...suggestedDurations];

  const handleMethodChange = useCallback(
    (method: TcMethod) => {
      setTcMethod(method);
      // Reset R to default for the new Tc
      const newTc =
        method === 'bransby-williams' ? tcBW : method === 'friends' ? tcFriends : tcManual;
      if (rCoefficient === 0 || rCoefficient === adoptedTc * 1.5) {
        setRCoefficient(newTc * 1.5);
      }
      // Recalculate duration range
      const newTcMin = newTc * 60;
      const low = newTcMin * 0.5;
      const high = newTcMin * 2.0;
      setDurationRange([...ARR_STANDARD_DURATIONS.filter((d) => d >= low && d <= high)]);
    },
    [
      tcBW,
      tcFriends,
      tcManual,
      adoptedTc,
      rCoefficient,
      setTcMethod,
      setRCoefficient,
      setDurationRange,
    ],
  );

  const toggleDuration = useCallback(
    (dur: number, checked: boolean) => {
      if (checked) {
        setDurationRange([...activeDurations, dur].sort((a, b) => a - b));
      } else {
        setDurationRange(activeDurations.filter((d) => d !== dur));
      }
    },
    [activeDurations, setDurationRange],
  );

  const methods: { key: TcMethod; label: string; value: number }[] = [
    { key: 'bransby-williams', label: 'Bransby-Williams', value: tcBW },
    { key: 'friends', label: 'Friends', value: tcFriends },
    { key: 'manual', label: 'Manual override', value: tcManual },
  ];

  return (
    <div className="space-y-4">
      {/* Tc method selector */}
      <Card>
        <CardHeader>
          <CardTitle>Time of Concentration</CardTitle>
          <CardDescription>
            Select a method. Values are computed from your catchment parameters in Step 1.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {methods.map(({ key, label, value }) => {
            const isSelected = tcMethod === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleMethodChange(key)}
                className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary' : 'border-muted-foreground/40'
                    }`}
                  >
                    {isSelected && <div className="size-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {key === 'manual' && !isSelected ? '--' : fmtTc(value)}
                </span>
              </button>
            );
          })}

          {/* Manual override input — only shown when manual is selected */}
          {tcMethod === 'manual' && (
            <div className="flex items-center gap-3 pl-10 pt-1">
              <Label className="text-sm">Tc (hours)</Label>
              <div className="w-28">
                <NumericInput value={tcManual} onCommit={setTcManual} className="text-right" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage coefficient */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Coefficient (R)</CardTitle>
          <CardDescription>
            Default is 1.5 x Tc — standard Australian practice for ungauged catchments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="text-sm w-32">R (hours)</Label>
            <div className="w-28">
              <NumericInput
                value={Math.round(effectiveR * 1000) / 1000}
                onCommit={setRCoefficient}
                className="text-right"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              1.5 x Tc = {(adoptedTc * 1.5).toFixed(2)} hr
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Critical duration search range */}
      <Card>
        <CardHeader>
          <CardTitle>Critical Duration Search Range</CardTitle>
          <CardDescription>
            Standard ARR durations between 0.5xTc and 2.0xTc. Toggle durations to include or
            exclude.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(ARR_STANDARD_DURATIONS as readonly number[]).map((dur) => {
              const isActive = activeDurations.includes(dur);
              const inRange = suggestedDurations.includes(dur);
              return (
                <label
                  key={dur}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'border-primary/40 bg-primary/5'
                      : inRange
                        ? 'border-border'
                        : 'border-border/50 text-muted-foreground'
                  }`}
                >
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={(checked) => toggleDuration(dur, checked === true)}
                  />
                  <span className="tabular-nums">
                    {dur >= 60 ? `${dur / 60}h` : `${dur}m`}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Suggested range: {fmtTc(adoptedTc * 0.5)} to {fmtTc(adoptedTc * 2.0)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
