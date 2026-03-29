'use client';

import { useHydroStore } from '../store';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  NumericInput,
  Badge,
} from '@flowsuite/ui';

/** Returns true when the adopted value deviates more than 50 % from the ARR value. */
function deviates(adopted: number, arrValue: number): boolean {
  if (arrValue === 0) return adopted !== 0;
  return Math.abs(adopted - arrValue) / arrValue > 0.5;
}

/** Format a number for display in the "ARR Recommended" column. */
function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return '--';
  return String(Math.round(n * 100) / 100);
}

function LossRow({
  label,
  unit,
  arrValue,
  adopted,
  onCommit,
}: {
  label: string;
  unit: string;
  arrValue: number | undefined;
  adopted: number;
  onCommit: (v: number) => void;
}) {
  const showWarning = arrValue !== undefined && deviates(adopted, arrValue);

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
      <Label className="text-sm font-medium">{label}</Label>
      <span className="text-sm text-muted-foreground tabular-nums w-20 text-right">
        {fmt(arrValue)} {unit}
      </span>
      <div className="w-28">
        <NumericInput value={adopted} onCommit={onCommit} className="text-right" />
      </div>
      <div className="w-16 flex justify-center">
        {showWarning && (
          <Badge variant="destructive" className="text-[10px]">
            &gt;50%
          </Badge>
        )}
      </div>
    </div>
  );
}

export function StepLosses() {
  const arrData = useHydroStore((s) => s.arrData);
  const adoptedIL = useHydroStore((s) => s.adoptedInitialLoss);
  const adoptedCL = useHydroStore((s) => s.adoptedContinuingLoss);
  const adoptedImpervious = useHydroStore((s) => s.adoptedImperviousFraction);
  const setIL = useHydroStore((s) => s.setAdoptedInitialLoss);
  const setCL = useHydroStore((s) => s.setAdoptedContinuingLoss);
  const setImpervious = useHydroStore((s) => s.setAdoptedImperviousFraction);

  // Derive a representative pre-burst depth for display (median across entries)
  const arrPreBurstDepth =
    arrData && arrData.losses.preBurst.length > 0
      ? arrData.losses.preBurst.reduce((sum, p) => sum + p.depth, 0) /
        arrData.losses.preBurst.length
      : undefined;

  const adoptedPreBurst = useHydroStore((s) => s.adoptedPreBurst);
  const setPreBurst = useHydroStore((s) => s.setAdoptedPreBurst);

  // For the editable "representative" pre-burst we use the average of adopted entries.
  // When the user changes it we scale all entries proportionally.
  const adoptedPreBurstAvg =
    adoptedPreBurst.length > 0
      ? adoptedPreBurst.reduce((s, p) => s + p.depth, 0) / adoptedPreBurst.length
      : 0;

  function handlePreBurstChange(newAvg: number) {
    if (adoptedPreBurst.length === 0 || adoptedPreBurstAvg === 0) {
      // Nothing to scale — just keep as-is
      return;
    }
    const factor = newAvg / adoptedPreBurstAvg;
    setPreBurst(
      adoptedPreBurst.map((p) => ({ ...p, depth: Math.round(p.depth * factor * 100) / 100 })),
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Loss Parameters</CardTitle>
          <CardDescription>
            ARR2019 recommends these values for your location. Override only with site-specific
            calibration data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 mb-3 text-xs text-muted-foreground font-medium">
            <span>Parameter</span>
            <span className="w-20 text-right">ARR Recommended</span>
            <span className="w-28 text-center">Adopted</span>
            <span className="w-16 text-center">Status</span>
          </div>

          <div className="space-y-3">
            <LossRow
              label="Initial Loss"
              unit="mm"
              arrValue={arrData?.losses.initialLoss}
              adopted={adoptedIL}
              onCommit={setIL}
            />
            <LossRow
              label="Continuing Loss"
              unit="mm/hr"
              arrValue={arrData?.losses.continuingLoss}
              adopted={adoptedCL}
              onCommit={setCL}
            />
            <LossRow
              label="Pre-burst depth (avg)"
              unit="mm"
              arrValue={arrPreBurstDepth}
              adopted={adoptedPreBurstAvg}
              onCommit={handlePreBurstChange}
            />
            <LossRow
              label="Impervious fraction"
              unit="%"
              arrValue={undefined}
              adopted={adoptedImpervious}
              onCommit={setImpervious}
            />
          </div>
        </CardContent>
      </Card>

      {!arrData && (
        <p className="text-xs text-muted-foreground text-center">
          Upload ARR data in Step 2 to populate recommended values.
        </p>
      )}
    </div>
  );
}
