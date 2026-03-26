'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CrossSectionPoint, BridgeGeometry } from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { unitLabel } from '@/lib/units';

interface CrossSectionChartProps {
  crossSection: CrossSectionPoint[];
  wsel?: number;
  bridge?: BridgeGeometry;
  /** Per-method WSEL lines to overlay. Key = method name, value = WSEL elevation. */
  methodWsels?: Record<string, number>;
}

export function CrossSectionChart({ crossSection, wsel, bridge, methodWsels }: CrossSectionChartProps) {
  const us = useProjectStore((s) => s.unitSystem);
  const lenUnit = unitLabel('length', us);

  if (crossSection.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Enter at least 2 points to see preview
      </div>
    );
  }

  // Build data array with ground elevation and optional WSEL lines
  const data = crossSection.map((p) => {
    const row: Record<string, number | undefined> = {
      station: p.station,
      elevation: p.elevation,
    };
    if (wsel !== undefined) row.wsel = wsel;
    // Add bridge deck lines if bridge geometry provided and station is within abutments
    if (bridge && p.station >= bridge.leftAbutmentStation && p.station <= bridge.rightAbutmentStation) {
      const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
      const t = span > 0 ? (p.station - bridge.leftAbutmentStation) / span : 0;
      row.lowChord = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
      row.highChord = bridge.highChord;
    }
    // Add per-method WSEL lines
    if (methodWsels) {
      for (const [method, val] of Object.entries(methodWsels)) {
        row[method] = val;
      }
    }
    return row;
  });

  // Add interpolated abutment boundary points for bridge overlay if missing
  if (bridge) {
    const stations = data.map(d => d.station!);
    for (const abSta of [bridge.leftAbutmentStation, bridge.rightAbutmentStation]) {
      if (!stations.includes(abSta)) {
        // Interpolate ground elevation at abutment
        let groundElev = 0;
        for (let i = 0; i < crossSection.length - 1; i++) {
          if (crossSection[i].station <= abSta && crossSection[i + 1].station >= abSta) {
            const t2 = (abSta - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
            groundElev = crossSection[i].elevation + t2 * (crossSection[i + 1].elevation - crossSection[i].elevation);
            break;
          }
        }
        const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
        const t = span > 0 ? (abSta - bridge.leftAbutmentStation) / span : 0;
        const row: Record<string, number | undefined> = {
          station: abSta,
          elevation: groundElev,
          lowChord: bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft),
          highChord: bridge.highChord,
        };
        if (wsel !== undefined) row.wsel = wsel;
        if (methodWsels) {
          for (const [method, val] of Object.entries(methodWsels)) {
            row[method] = val;
          }
        }
        data.push(row);
      }
    }
    data.sort((a, b) => a.station! - b.station!);
  }

  const allElevs = crossSection.map(p => p.elevation);
  if (bridge) { allElevs.push(bridge.highChord); }
  if (wsel !== undefined) { allElevs.push(wsel); }
  if (methodWsels) { allElevs.push(...Object.values(methodWsels)); }
  const minElev = Math.min(...allElevs) - 1;
  const maxElev = Math.max(...allElevs) + 1;

  const METHOD_COLORS: Record<string, string> = {
    energy: '#3b82f6', momentum: '#10b981', yarnell: '#f59e0b', wspro: '#8b5cf6',
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="station" label={{ value: `Station (${lenUnit})`, position: 'bottom', offset: -5 }} stroke="#71717a" fontSize={12} />
        <YAxis domain={[minElev, maxElev]} label={{ value: `Elevation (${lenUnit})`, angle: -90, position: 'insideLeft' }} stroke="#71717a" fontSize={12} />
        <Tooltip contentStyle={{ backgroundColor: 'oklch(0.17 0.01 230)', border: '1px solid oklch(0.26 0.02 230)', borderRadius: '8px' }} />
        <Line type="linear" dataKey="elevation" stroke="#71717a" strokeWidth={2} dot={{ fill: '#a1a1aa', r: 3 }} name="Ground" />
        {bridge && (
          <>
            <Line type="linear" dataKey="lowChord" stroke="#ef4444" strokeWidth={2} dot={false} name="Low Chord" connectNulls={false} />
            <Line type="linear" dataKey="highChord" stroke="#ef4444" strokeWidth={1} strokeDasharray="6 3" dot={false} name="High Chord" connectNulls={false} />
          </>
        )}
        {wsel !== undefined && (
          <Line type="linear" dataKey="wsel" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="WSEL" />
        )}
        {methodWsels && Object.keys(methodWsels).map((method) => (
          <Line key={method} type="linear" dataKey={method} stroke={METHOD_COLORS[method] ?? '#888'} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name={`${method} WSEL`} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
