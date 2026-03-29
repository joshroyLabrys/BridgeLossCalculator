'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@flowsuite/ui';
import type { ARRIFDData } from '@flowsuite/engine/hydrology/types';

/** Format duration in minutes to a readable label */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = minutes / 60;
  if (Number.isInteger(hrs)) return `${hrs} hr`;
  return `${hrs.toFixed(1)} hr`;
}

interface IfdTableProps {
  ifd: ARRIFDData;
}

export function IfdTable({ ifd }: IfdTableProps) {
  if (ifd.durations.length === 0 || ifd.aeps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No IFD data available.</p>
    );
  }

  return (
    <div className="overflow-auto rounded border border-border/30">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-medium">Duration</TableHead>
            {ifd.aeps.map((aep) => (
              <TableHead key={aep} className="text-xs font-medium text-right">
                {aep}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ifd.durations.map((dur, dIdx) => (
            <TableRow key={dur}>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {formatDuration(dur)}
              </TableCell>
              {ifd.depths[dIdx]?.map((depth, aIdx) => (
                <TableCell
                  key={ifd.aeps[aIdx]}
                  className="text-xs font-mono text-right"
                >
                  {depth.toFixed(1)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
