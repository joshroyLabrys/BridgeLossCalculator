'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import type { CrossSectionPoint, BridgeGeometry, ScourResults } from '@/engine/types';

interface ScourDiagramProps {
  crossSection: CrossSectionPoint[];
  bridgeGeometry: BridgeGeometry;
  scourResult: ScourResults;
  wsel?: number;
}

export function ScourDiagram({ crossSection, bridgeGeometry, scourResult, wsel }: ScourDiagramProps) {
  const diagram = useMemo(() => {
    if (crossSection.length < 2) return null;

    const W = 720;
    const H = 320;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const stations = crossSection.map((p) => p.station);
    const elevations = crossSection.map((p) => p.elevation);
    const minSta = Math.min(...stations);
    const maxSta = Math.max(...stations);

    // Include scour depths in elevation range
    const scourElevs = scourResult.pierScour.map((p) => p.criticalBedElevation);
    const contractionElev = scourResult.contractionScour.criticalBedElevation;
    const allElevs = [...elevations, ...scourElevs, contractionElev];
    if (wsel !== undefined) allElevs.push(wsel);
    allElevs.push(bridgeGeometry.highChord);

    const minElev = Math.min(...allElevs) - 1;
    const maxElev = Math.max(...allElevs) + 1;

    const xScale = scaleLinear().domain([minSta, maxSta]).range([0, w]);
    const yScale = scaleLinear().domain([minElev, maxElev]).range([h, 0]);

    // Ground path
    const groundPoints = crossSection
      .map((p) => `${xScale(p.station)},${yScale(p.elevation)}`)
      .join(' ');
    const groundFill =
      `${xScale(crossSection[0].station)},${h} ` +
      groundPoints +
      ` ${xScale(crossSection[crossSection.length - 1].station)},${h}`;

    // Scour line (dashed red) — across the bridge opening at the scoured elevation
    const leftAbut = bridgeGeometry.leftAbutmentStation;
    const rightAbut = bridgeGeometry.rightAbutmentStation;
    const worstScourElev = Math.min(
      scourResult.contractionScour.criticalBedElevation,
      ...scourResult.pierScour.map((p) => p.criticalBedElevation),
    );

    // Bridge deck
    const deckLeft = xScale(leftAbut);
    const deckRight = xScale(rightAbut);
    const lowChordY = yScale(Math.min(bridgeGeometry.lowChordLeft, bridgeGeometry.lowChordRight));
    const highChordY = yScale(bridgeGeometry.highChord);

    // Piers
    const piers = bridgeGeometry.piers.map((pier) => {
      const x = xScale(pier.station - pier.width / 2);
      const pWidth = xScale(pier.station + pier.width / 2) - x;
      // Interpolate ground at pier station
      let groundElev = crossSection[0].elevation;
      for (let i = 0; i < crossSection.length - 1; i++) {
        if (crossSection[i].station <= pier.station && crossSection[i + 1].station >= pier.station) {
          const t =
            (pier.station - crossSection[i].station) /
            (crossSection[i + 1].station - crossSection[i].station);
          groundElev = crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
          break;
        }
      }
      const top = lowChordY;
      const bottom = yScale(groundElev);
      return { x, width: pWidth, top, height: bottom - top };
    });

    // Water surface
    const waterY = wsel !== undefined ? yScale(wsel) : null;

    return {
      W,
      H,
      margin,
      groundFill,
      groundPoints,
      worstScourElev,
      scourLineY: yScale(worstScourElev),
      deckLeft,
      deckRight,
      lowChordY,
      highChordY,
      piers,
      waterY,
      xScale,
      yScale,
      leftAbut: xScale(leftAbut),
      rightAbut: xScale(rightAbut),
    };
  }, [crossSection, bridgeGeometry, scourResult, wsel]);

  if (!diagram) {
    return <p className="text-sm text-muted-foreground">Insufficient cross-section data.</p>;
  }

  return (
    <svg
      viewBox={`0 0 ${diagram.W} ${diagram.H}`}
      className="w-full max-w-3xl"
      style={{ background: 'transparent' }}
    >
      <g transform={`translate(${diagram.margin.left},${diagram.margin.top})`}>
        {/* Ground fill */}
        <polygon points={diagram.groundFill} fill="#78716c" opacity={0.5} />
        <polyline
          points={diagram.groundPoints}
          fill="none"
          stroke="#a8a29e"
          strokeWidth={1.5}
        />

        {/* Scour line (dashed red) */}
        <line
          x1={diagram.leftAbut}
          y1={diagram.scourLineY}
          x2={diagram.rightAbut}
          y2={diagram.scourLineY}
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="6,4"
        />

        {/* Bridge deck */}
        <rect
          x={diagram.deckLeft}
          y={diagram.highChordY}
          width={diagram.deckRight - diagram.deckLeft}
          height={diagram.lowChordY - diagram.highChordY}
          fill="#57534e"
          opacity={0.7}
          stroke="#78716c"
          strokeWidth={1}
        />

        {/* Piers */}
        {diagram.piers.map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.top}
            width={p.width}
            height={p.height > 0 ? p.height : 0}
            fill="#44403c"
            stroke="#78716c"
            strokeWidth={0.5}
          />
        ))}

        {/* Water surface */}
        {diagram.waterY !== null && (
          <line
            x1={0}
            y1={diagram.waterY}
            x2={diagram.W - diagram.margin.left - diagram.margin.right}
            y2={diagram.waterY}
            stroke="#3b82f6"
            strokeWidth={2}
            opacity={0.8}
          />
        )}

        {/* Legend */}
        <g transform={`translate(4, 8)`}>
          <line x1={0} y1={0} x2={18} y2={0} stroke="#a8a29e" strokeWidth={1.5} />
          <text x={22} y={4} fill="#a8a29e" fontSize={9}>
            Ground
          </text>
        </g>
        <g transform={`translate(4, 22)`}>
          <line x1={0} y1={0} x2={18} y2={0} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={22} y={4} fill="#ef4444" fontSize={9}>
            Scoured Bed
          </text>
        </g>
        {diagram.waterY !== null && (
          <g transform={`translate(4, 36)`}>
            <line x1={0} y1={0} x2={18} y2={0} stroke="#3b82f6" strokeWidth={2} />
            <text x={22} y={4} fill="#3b82f6" fontSize={9}>
              Water Surface
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
