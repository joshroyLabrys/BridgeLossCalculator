/**
 * Simplified, print-optimized charts rendered natively in react-pdf.
 * Uses <Svg> for graphics with absolutely-positioned <Text> for labels,
 * all within a single relatively-positioned container.
 */
import { View, Text, Svg, Line, Rect, Circle, G, Path, StyleSheet } from '@react-pdf/renderer';
import type { CrossSectionPoint, BridgeGeometry, CalculationResults, FlowProfile, HecRasComparison, MethodResult } from '@/engine/types';
import type { HydraulicProfile } from '@/engine/simulation-profile';

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
const METHOD_COLORS: Record<string, string> = {
  energy: '#2563eb',
  momentum: '#059669',
  yarnell: '#d97706',
  wspro: '#7c3aed',
};
const METHOD_LABELS: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

const HECRAS_COLOR = '#dc2626';

const cs = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 2 },
  legendDot: { width: 10, height: 3, borderRadius: 1, marginRight: 3 },
  legendText: { fontSize: 7, color: '#374151' },
});

/* ─── Scale helpers ─── */

interface Scale { min: number; max: number; pxMin: number; pxMax: number; }

function makeScale(dataMin: number, dataMax: number, pxMin: number, pxMax: number, padding = 0.05): Scale {
  const range = dataMax - dataMin || 1;
  return { min: dataMin - range * padding, max: dataMax + range * padding, pxMin, pxMax };
}

function toPixel(value: number, scale: Scale): number {
  const t = (value - scale.min) / (scale.max - scale.min);
  return scale.pxMin + t * (scale.pxMax - scale.pxMin);
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  if (norm <= 1.5) return mag;
  if (norm <= 3) return 2 * mag;
  if (norm <= 7) return 5 * mag;
  return 10 * mag;
}

function generateTicks(scale: Scale, targetCount = 5): number[] {
  const range = scale.max - scale.min;
  const step = niceStep(range, targetCount);
  const start = Math.ceil(scale.min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= scale.max + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(3);
}

/* ─── Line Chart ─── */

interface LineChartSeries {
  label: string;
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
}

interface LineChartProps {
  series: LineChartSeries[];
  width: number;
  height: number;
  xLabel?: string;
  yLabel?: string;
  hecRasPoints?: { x: number; y: number }[];
}

export function PdfLineChart({ series, width, height, xLabel, yLabel, hecRasPoints }: LineChartProps) {
  const M = { top: 15, right: 12, bottom: 24, left: 45 };
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;

  const allPts = series.flatMap((s) => s.points).concat(hecRasPoints || []);
  if (allPts.length === 0) return null;

  const xScale = makeScale(
    Math.min(...allPts.map((p) => p.x)), Math.max(...allPts.map((p) => p.x)),
    M.left, M.left + plotW,
  );
  const yScale = makeScale(
    Math.min(...allPts.map((p) => p.y)), Math.max(...allPts.map((p) => p.y)),
    M.top + plotH, M.top, // inverted: high values at top
  );

  const xTicks = generateTicks(xScale);
  const yTicks = generateTicks({ min: yScale.min, max: yScale.max, pxMin: yScale.pxMax, pxMax: yScale.pxMin });

  return (
    <View>
      {/* Chart area: relative container with SVG + absolute text labels */}
      <View style={{ position: 'relative', width, height }}>
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="white" />

          {/* Grid */}
          {yTicks.map((v, i) => (
            <Line key={`gy${i}`} x1={M.left} y1={toPixel(v, yScale)} x2={M.left + plotW} y2={toPixel(v, yScale)}
              stroke="#ebebeb" strokeWidth={0.5} />
          ))}
          {xTicks.map((v, i) => (
            <Line key={`gx${i}`} x1={toPixel(v, xScale)} y1={M.top} x2={toPixel(v, xScale)} y2={M.top + plotH}
              stroke="#ebebeb" strokeWidth={0.5} />
          ))}

          {/* Axes */}
          <Line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke="#9ca3af" strokeWidth={0.75} />
          <Line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top + plotH} stroke="#9ca3af" strokeWidth={0.75} />

          {/* Data lines + points */}
          {series.map((s) => {
            if (s.points.length < 2) return null;
            const d = s.points.map((p, i) =>
              `${i === 0 ? 'M' : 'L'} ${toPixel(p.x, xScale)} ${toPixel(p.y, yScale)}`
            ).join(' ');
            return (
              <G key={s.label}>
                <Path d={d} stroke={s.color} strokeWidth={1.5} fill="none"
                  strokeDasharray={s.dashed ? '4,2' : undefined} />
                {s.points.map((p, i) => (
                  <Circle key={i} cx={toPixel(p.x, xScale)} cy={toPixel(p.y, yScale)} r={2.5} fill={s.color} />
                ))}
              </G>
            );
          })}

          {/* HEC-RAS points */}
          {hecRasPoints?.map((p, i) => (
            <Circle key={`hr${i}`} cx={toPixel(p.x, xScale)} cy={toPixel(p.y, yScale)}
              r={3.5} fill="none" stroke={HECRAS_COLOR} strokeWidth={1.5} />
          ))}
        </Svg>

        {/* Y tick labels */}
        {yTicks.map((v, i) => (
          <Text key={`yt${i}`} style={{
            position: 'absolute', left: 0, top: toPixel(v, yScale) - 4,
            width: M.left - 3, textAlign: 'right', fontSize: 6, color: '#6b7280',
          }}>{fmt(v)}</Text>
        ))}

        {/* X tick labels */}
        {xTicks.map((v, i) => (
          <Text key={`xt${i}`} style={{
            position: 'absolute', left: toPixel(v, xScale) - 18, top: M.top + plotH + 2,
            width: 36, textAlign: 'center', fontSize: 6, color: '#6b7280',
          }}>{fmt(v)}</Text>
        ))}

        {/* Axis labels */}
        {xLabel ? (
          <Text style={{
            position: 'absolute', left: M.left, bottom: 0,
            width: plotW, textAlign: 'center',
            fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
          }}>{xLabel}</Text>
        ) : null}
        {yLabel ? (
          <Text style={{
            position: 'absolute', left: 0, top: 0,
            width: M.left, textAlign: 'center',
            fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
          }}>{yLabel}</Text>
        ) : null}
      </View>

      {/* Legend */}
      <View style={cs.legend}>
        {series.map((s) => (
          <View key={s.label} style={cs.legendItem}>
            <View style={[cs.legendDot, { backgroundColor: s.color }]} />
            <Text style={cs.legendText}>{s.label}</Text>
          </View>
        ))}
        {hecRasPoints && hecRasPoints.length > 0 ? (
          <View style={cs.legendItem}>
            <View style={[cs.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: HECRAS_COLOR }]} />
            <Text style={cs.legendText}>HEC-RAS</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ─── Cross-Section Profile Chart ─── */

interface CrossSectionChartProps {
  crossSection: CrossSectionPoint[];
  bridge: BridgeGeometry;
  results: CalculationResults | null;
  profileIndex?: number;
  dsWsel?: number;
  width: number;
  height: number;
}

export function PdfCrossSectionChart({ crossSection, bridge, results, profileIndex = 0, dsWsel, width, height }: CrossSectionChartProps) {
  if (crossSection.length < 2) return null;

  const M = { top: 15, right: 12, bottom: 24, left: 45 };
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;

  const stations = crossSection.map((p) => p.station);
  const elevations = crossSection.map((p) => p.elevation);
  const sMin = Math.min(...stations);
  const sMax = Math.max(...stations);
  const eMin = Math.min(...elevations);
  let eMax = Math.max(...elevations, bridge.highChord);

  const wsels: number[] = [];
  if (dsWsel) wsels.push(dsWsel);
  if (results) {
    for (const m of METHODS) {
      const r = results[m][profileIndex];
      if (r && !r.error) wsels.push(r.upstreamWsel);
    }
  }
  if (wsels.length > 0) eMax = Math.max(eMax, ...wsels);

  const xScale = makeScale(sMin, sMax, M.left, M.left + plotW, 0.02);
  const yScale = makeScale(eMin, eMax, M.top + plotH, M.top, 0.05);

  const xTicks = generateTicks(xScale);
  const yTicks = generateTicks({ min: yScale.min, max: yScale.max, pxMin: yScale.pxMax, pxMax: yScale.pxMin });

  // Ground profile path
  const groundPath = crossSection.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${toPixel(p.station, xScale)} ${toPixel(p.elevation, yScale)}`
  ).join(' ');

  const groundFill = groundPath +
    ` L ${toPixel(crossSection[crossSection.length - 1].station, xScale)} ${M.top + plotH}` +
    ` L ${toPixel(crossSection[0].station, xScale)} ${M.top + plotH} Z`;

  // Interpolate ground elevation at a station
  const interpGround = (sta: number): number => {
    for (let i = 0; i < crossSection.length - 1; i++) {
      if (crossSection[i].station <= sta && crossSection[i + 1].station >= sta) {
        const t = (sta - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
        return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
      }
    }
    return crossSection[crossSection.length - 1]?.elevation ?? 0;
  };

  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  const deckLeftPx = toPixel(bridge.leftAbutmentStation, xScale);
  const deckRightPx = toPixel(bridge.rightAbutmentStation, xScale);
  const highChordPx = toPixel(bridge.highChord, yScale);
  const lowChordLeftPx = toPixel(bridge.lowChordLeft, yScale);
  const lowChordRightPx = toPixel(bridge.lowChordRight, yScale);
  const leftGroundPx = toPixel(interpGround(bridge.leftAbutmentStation), yScale);
  const rightGroundPx = toPixel(interpGround(bridge.rightAbutmentStation), yScale);

  return (
    <View>
      <View style={{ position: 'relative', width, height }}>
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="white" />

          {/* Grid */}
          {yTicks.map((v, i) => (
            <Line key={`gy${i}`} x1={M.left} y1={toPixel(v, yScale)} x2={M.left + plotW} y2={toPixel(v, yScale)}
              stroke="#ebebeb" strokeWidth={0.5} />
          ))}

          {/* Ground */}
          <Path d={groundFill} fill="#e5e7eb" opacity={0.5} />
          <Path d={groundPath} stroke="#78716c" strokeWidth={1.5} fill="none" />

          {/* DS WSEL */}
          {dsWsel ? (
            <Line x1={M.left} y1={toPixel(dsWsel, yScale)} x2={M.left + plotW} y2={toPixel(dsWsel, yScale)}
              stroke="#3b82f6" strokeWidth={0.75} strokeDasharray="4,2" opacity={0.5} />
          ) : null}

          {/* Method WSEL lines — upstream of bridge only (x=0 to left abutment) */}
          {results ? METHODS.map((m) => {
            const r = results[m][profileIndex];
            if (!r || r.error) return null;
            const py = toPixel(r.upstreamWsel, yScale);
            return (
              <Line key={m}
                x1={M.left} y1={py}
                x2={deckLeftPx} y2={py}
                stroke={METHOD_COLORS[m]} strokeWidth={1} strokeDasharray="3,2" />
            );
          }) : null}

          {/* Bridge deck (thin band: high chord to low chord) */}
          <Rect x={deckLeftPx} y={highChordPx} width={deckRightPx - deckLeftPx}
            height={Math.max(lowChordLeftPx - highChordPx, 1)}
            fill="#fecaca" stroke="#dc2626" strokeWidth={0.75} opacity={0.15} />
          {/* Low chord line */}
          <Line x1={deckLeftPx} y1={lowChordLeftPx} x2={deckRightPx} y2={lowChordRightPx}
            stroke="#dc2626" strokeWidth={2} />
          {/* High chord line (dashed) */}
          <Line x1={deckLeftPx} y1={highChordPx} x2={deckRightPx} y2={highChordPx}
            stroke="#dc2626" strokeWidth={1} strokeDasharray="4,2" />
          {/* Abutment walls — from high chord down to ground */}
          <Line x1={deckLeftPx} y1={highChordPx} x2={deckLeftPx} y2={leftGroundPx}
            stroke="#dc2626" strokeWidth={2} />
          <Line x1={deckRightPx} y1={highChordPx} x2={deckRightPx} y2={rightGroundPx}
            stroke="#dc2626" strokeWidth={2} />

          {/* Piers — from low chord (interpolated) down to ground */}
          {bridge.piers.map((pier, i) => {
            const px = toPixel(pier.station, xScale);
            const pierX1 = toPixel(pier.station - pier.width / 2, xScale);
            const pierX2 = toPixel(pier.station + pier.width / 2, xScale);
            const pierW = Math.max(pierX2 - pierX1, 2);
            const pierGround = toPixel(interpGround(pier.station), yScale);
            const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
            const lowChordAtPier = toPixel(bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft), yScale);
            return (
              <Rect key={i} x={pierX1} y={lowChordAtPier} width={pierW}
                height={Math.max(pierGround - lowChordAtPier, 2)}
                fill="#dc2626" opacity={0.35} stroke="#dc2626" strokeWidth={0.5} />
            );
          })}

          {/* Axes */}
          <Line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke="#9ca3af" strokeWidth={0.75} />
          <Line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top + plotH} stroke="#9ca3af" strokeWidth={0.75} />
        </Svg>

        {/* Y tick labels */}
        {yTicks.map((v, i) => (
          <Text key={`yt${i}`} style={{
            position: 'absolute', left: 0, top: toPixel(v, yScale) - 4,
            width: M.left - 3, textAlign: 'right', fontSize: 6, color: '#6b7280',
          }}>{fmt(v)}</Text>
        ))}

        {/* X tick labels */}
        {xTicks.map((v, i) => (
          <Text key={`xt${i}`} style={{
            position: 'absolute', left: toPixel(v, xScale) - 18, top: M.top + plotH + 2,
            width: 36, textAlign: 'center', fontSize: 6, color: '#6b7280',
          }}>{fmt(v)}</Text>
        ))}

        {/* Axis labels */}
        <Text style={{
          position: 'absolute', left: M.left, bottom: 0,
          width: plotW, textAlign: 'center',
          fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
        }}>Station</Text>
        <Text style={{
          position: 'absolute', left: 0, top: 0,
          width: M.left, textAlign: 'center',
          fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
        }}>Elevation</Text>
      </View>

      {/* Legend */}
      <View style={cs.legend}>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: '#78716c' }]} />
          <Text style={cs.legendText}>Ground</Text>
        </View>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: '#dc2626' }]} />
          <Text style={cs.legendText}>Bridge Deck</Text>
        </View>
        {results ? METHODS.map((m) => {
          const r = results[m][profileIndex];
          if (!r || r.error) return null;
          return (
            <View key={m} style={cs.legendItem}>
              <View style={[cs.legendDot, { backgroundColor: METHOD_COLORS[m] }]} />
              <Text style={cs.legendText}>{METHOD_LABELS[m]}</Text>
            </View>
          );
        }) : null}
      </View>
    </View>
  );
}

/* ─── Energy Grade Diagram (PDF) ─── */

const G_CONST = 32.174;

const EGL_COLORS = {
  ground: '#78716c',
  groundFill: '#e5e7eb',
  hgl: '#3b82f6',
  hglFill: 'rgba(59,130,246,0.08)',
  egl: '#f97316',
  eglFill: 'rgba(249,115,22,0.06)',
  bridge: '#dc2626',
  bridgeFill: '#fecaca',
  pier: '#dc2626',
  vh: '#8b5cf6',
  hl: '#22c55e',
  water: 'rgba(59,130,246,0.08)',
  sectionLine: '#d1d5db',
  label: '#374151',
  flowArrow: '#3b82f6',
  tableText: '#6b7280',
  tableBold: '#374151',
};

interface EglSection {
  label: string;
  shortLabel: string;
  x: number;
  bed: number;
  wsel: number;
  velocity: number;
  velocityHead: number;
  egl: number;
  froude: number;
}

interface PdfEnergyGradeDiagramProps {
  profile: HydraulicProfile;
  width: number;
  height: number;
}

export function PdfEnergyGradeDiagram({ profile, width, height }: PdfEnergyGradeDiagramProps) {
  const M = { top: 18, right: 20, bottom: 70, left: 48 };
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;

  const p = profile;

  // Longitudinal distances
  const contrLen = p.approach.stationEnd - p.approach.stationStart || 50;
  const bridgeLen = p.bridge.stationEnd - p.bridge.stationStart || 20;
  const expanLen = p.exit.stationEnd - p.exit.stationStart || 50;
  const totalLen = contrLen + bridgeLen + expanLen;

  // Thalweg bed profile
  const channelSlope = p.approach.depth > 0
    ? (p.usWsel - p.dsWsel) / totalLen * 0.3
    : 0;
  const bridgeBed = p.bridge.bedElevation;
  const bed4 = bridgeBed + channelSlope * contrLen;
  const bed3 = bridgeBed;
  const bed2 = bridgeBed;
  const bed1 = bridgeBed - channelSlope * expanLen;

  const approachVH = (p.approach.velocity ** 2) / (2 * G_CONST);
  const exitVH = (p.exit.velocity ** 2) / (2 * G_CONST);

  const sections: EglSection[] = [
    { label: 'Section 4', shortLabel: '4', x: 0,
      bed: bed4, wsel: p.usWsel, velocity: p.approach.velocity,
      velocityHead: approachVH, egl: p.usWsel + approachVH,
      froude: p.approach.velocity / Math.sqrt(G_CONST * Math.max(p.approach.depth, 0.01)) },
    { label: 'Sec 3 (BU)', shortLabel: '3', x: contrLen,
      bed: bed3, wsel: p.usWsel, velocity: p.approach.velocity,
      velocityHead: approachVH, egl: p.usWsel + approachVH,
      froude: p.approach.velocity / Math.sqrt(G_CONST * Math.max(p.approach.depth, 0.01)) },
    { label: 'Sec 2 (BD)', shortLabel: '2', x: contrLen + bridgeLen,
      bed: bed2, wsel: p.dsWsel, velocity: p.exit.velocity,
      velocityHead: exitVH, egl: p.dsWsel + exitVH,
      froude: p.exit.velocity / Math.sqrt(G_CONST * Math.max(p.exit.depth, 0.01)) },
    { label: 'Section 1', shortLabel: '1', x: totalLen,
      bed: bed1, wsel: p.dsWsel, velocity: p.exit.velocity,
      velocityHead: exitVH, egl: p.dsWsel + exitVH,
      froude: p.exit.velocity / Math.sqrt(G_CONST * Math.max(p.exit.depth, 0.01)) },
  ];

  // Scales
  const xPad = totalLen * 0.08;
  const allElev = [
    ...sections.map(sec => sec.bed), ...sections.map(sec => sec.egl),
    p.bridge.highChord, p.bridge.lowChordLeft,
  ];
  const yPad = (Math.max(...allElev) - Math.min(...allElev)) * 0.15 || 2;

  const xScale = makeScale(-xPad, totalLen + xPad, M.left, M.left + plotW, 0);
  const yScale = makeScale(
    Math.min(...allElev) - yPad, Math.max(...allElev) + yPad,
    M.top + plotH, M.top, 0
  );

  const xTicks = generateTicks(xScale, 6);
  const yTicks = generateTicks({ min: yScale.min, max: yScale.max, pxMin: yScale.pxMax, pxMax: yScale.pxMin }, 6);

  const px = (v: number) => toPixel(v, xScale);
  const py = (v: number) => toPixel(v, yScale);

  // Ground fill path
  const groundFillD = sections.map((sec, i) =>
    `${i === 0 ? 'M' : 'L'} ${px(sec.x)} ${py(sec.bed)}`
  ).join(' ') +
    ` L ${px(sections[sections.length - 1].x)} ${M.top + plotH}` +
    ` L ${px(sections[0].x)} ${M.top + plotH} Z`;

  const groundLineD = sections.map((sec, i) =>
    `${i === 0 ? 'M' : 'L'} ${px(sec.x)} ${py(sec.bed)}`
  ).join(' ');

  // Water fill path
  const waterFillD = sections.map((sec, i) =>
    `${i === 0 ? 'M' : 'L'} ${px(sec.x)} ${py(sec.wsel)}`
  ).join(' ') +
    [...sections].reverse().map((sec) => ` L ${px(sec.x)} ${py(sec.bed)}`).join('') + ' Z';

  // HGL path
  const hglD = sections.map((sec, i) =>
    `${i === 0 ? 'M' : 'L'} ${px(sec.x)} ${py(sec.wsel)}`
  ).join(' ');

  // EGL path
  const eglD = sections.map((sec, i) =>
    `${i === 0 ? 'M' : 'L'} ${px(sec.x)} ${py(sec.egl)}`
  ).join(' ');

  // EGL-HGL band
  const eglBandD = sections.map((sec, i) =>
    `${i === 0 ? 'M' : 'L'} ${px(sec.x)} ${py(sec.egl)}`
  ).join(' ') +
    [...sections].reverse().map((sec) => ` L ${px(sec.x)} ${py(sec.wsel)}`).join('') + ' Z';

  // Bridge geometry
  const bx1 = px(contrLen);
  const bx2 = px(contrLen + bridgeLen);
  const bMid = (bx1 + bx2) / 2;
  const bWidth = bx2 - bx1;

  // Velocity head dimension lines
  const vhLines: { sx: number; y1: number; y2: number; label: string; side: 'left' | 'right' }[] = [];
  if (approachVH > 0.001) {
    vhLines.push({ sx: px(0) - 12, y1: py(sections[0].wsel), y2: py(sections[0].egl),
      label: `V²/2g=${approachVH.toFixed(3)}`, side: 'left' });
  }
  if (exitVH > 0.001) {
    vhLines.push({ sx: px(totalLen) + 12, y1: py(sections[3].wsel), y2: py(sections[3].egl),
      label: `V²/2g=${exitVH.toFixed(3)}`, side: 'right' });
  }

  // Total head loss
  const egl4 = sections[0].egl;
  const egl1 = sections[3].egl;
  const hl = egl4 - egl1;
  const hlX = px(totalLen * 0.80);

  // Table data below diagram
  const tableTop = M.top + plotH + 22;
  const rowH = 10;
  const headers = ['WSEL', 'Velocity', 'Froude', 'EGL'];

  return (
    <View>
      <View style={{ position: 'relative', width, height }}>
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="white" />

          {/* Grid */}
          {yTicks.map((v, i) => (
            <Line key={`gy${i}`} x1={M.left} y1={toPixel(v, yScale)} x2={M.left + plotW} y2={toPixel(v, yScale)}
              stroke="#ebebeb" strokeWidth={0.5} />
          ))}
          {xTicks.map((v, i) => (
            <Line key={`gx${i}`} x1={toPixel(v, xScale)} y1={M.top} x2={toPixel(v, xScale)} y2={M.top + plotH}
              stroke="#ebebeb" strokeWidth={0.5} />
          ))}

          {/* Axes */}
          <Line x1={M.left} y1={M.top} x2={M.left} y2={M.top + plotH} stroke="#9ca3af" strokeWidth={0.75} />
          <Line x1={M.left} y1={M.top + plotH} x2={M.left + plotW} y2={M.top + plotH} stroke="#9ca3af" strokeWidth={0.75} />

          {/* Ground fill + line */}
          <Path d={groundFillD} fill={EGL_COLORS.groundFill} opacity={0.5} />
          <Path d={groundLineD} stroke={EGL_COLORS.ground} strokeWidth={1.5} fill="none" />

          {/* Water fill */}
          <Path d={waterFillD} fill={EGL_COLORS.water} />

          {/* HGL line */}
          <Path d={hglD} stroke={EGL_COLORS.hgl} strokeWidth={2} fill="none" />

          {/* EGL-HGL band */}
          <Path d={eglBandD} fill={EGL_COLORS.eglFill} />

          {/* EGL line (dashed) */}
          <Path d={eglD} stroke={EGL_COLORS.egl} strokeWidth={1.5} fill="none" strokeDasharray="6,3" />

          {/* Bridge deck */}
          <Rect x={bx1} y={py(p.bridge.highChord)} width={bWidth}
            height={Math.max(py(p.bridge.lowChordLeft) - py(p.bridge.highChord), 1)}
            fill={EGL_COLORS.bridgeFill} stroke={EGL_COLORS.bridge} strokeWidth={0.75} opacity={0.3} />

          {/* Piers */}
          {p.bridge.piers.map((pier, i) => {
            const span = p.bridge.stationEnd - p.bridge.stationStart;
            const t = span > 0 ? (pier.station - p.bridge.stationStart) / span : 0.5;
            const pierCX = bx1 + t * bWidth;
            const pierW = Math.max((pier.width / span) * bWidth, 2);
            const pierTop = py(p.bridge.lowChordLeft);
            const pierBot = py(p.bridge.bedElevation);
            return (
              <Rect key={i} x={pierCX - pierW / 2} y={pierTop} width={pierW}
                height={Math.max(pierBot - pierTop, 2)}
                fill={EGL_COLORS.pier} opacity={0.35} stroke={EGL_COLORS.pier} strokeWidth={0.5} />
            );
          })}

          {/* Section lines (dashed verticals) */}
          {sections.map((sec, i) => (
            <Line key={`sl${i}`} x1={px(sec.x)} y1={M.top} x2={px(sec.x)} y2={M.top + plotH}
              stroke={EGL_COLORS.sectionLine} strokeWidth={0.5} strokeDasharray="3,2" />
          ))}

          {/* Velocity head dimension lines */}
          {vhLines.map((vl, i) => {
            const len = Math.abs(vl.y2 - vl.y1);
            if (len < 3) return null;
            const tw = 3;
            return (
              <G key={`vh${i}`}>
                <Line x1={vl.sx} y1={vl.y1} x2={vl.sx} y2={vl.y2} stroke={EGL_COLORS.vh} strokeWidth={1} />
                <Line x1={vl.sx - tw} y1={vl.y1} x2={vl.sx + tw} y2={vl.y1} stroke={EGL_COLORS.vh} strokeWidth={1} />
                <Line x1={vl.sx - tw} y1={vl.y2} x2={vl.sx + tw} y2={vl.y2} stroke={EGL_COLORS.vh} strokeWidth={1} />
              </G>
            );
          })}

          {/* Total head loss dimension */}
          {Math.abs(hl) > 0.001 ? (
            <G>
              <Line x1={hlX} y1={py(egl4)} x2={hlX} y2={py(egl1)} stroke={EGL_COLORS.hl} strokeWidth={1} />
              <Line x1={hlX - 3} y1={py(egl4)} x2={hlX + 3} y2={py(egl4)} stroke={EGL_COLORS.hl} strokeWidth={1} />
              <Line x1={hlX - 3} y1={py(egl1)} x2={hlX + 3} y2={py(egl1)} stroke={EGL_COLORS.hl} strokeWidth={1} />
            </G>
          ) : null}

          {/* Flow direction arrow */}
          {(() => {
            const arrowY = py(Math.max(...sections.map(sec => sec.egl))) - 8;
            const arrowX1 = px(totalLen * 0.12);
            const arrowX2 = px(totalLen * 0.28);
            return (
              <G>
                <Line x1={arrowX1} y1={arrowY} x2={arrowX2} y2={arrowY}
                  stroke={EGL_COLORS.flowArrow} strokeWidth={1} />
                <Path d={`M ${arrowX2} ${arrowY} L ${arrowX2 - 5} ${arrowY - 3} L ${arrowX2 - 5} ${arrowY + 3} Z`}
                  fill={EGL_COLORS.flowArrow} />
              </G>
            );
          })()}
        </Svg>

        {/* Y tick labels */}
        {yTicks.map((v, i) => (
          <Text key={`yt${i}`} style={{
            position: 'absolute', left: 0, top: toPixel(v, yScale) - 4,
            width: M.left - 3, textAlign: 'right', fontSize: 6, color: '#6b7280',
          }}>{fmt(v)}</Text>
        ))}

        {/* X tick labels */}
        {xTicks.map((v, i) => (
          <Text key={`xt${i}`} style={{
            position: 'absolute', left: toPixel(v, xScale) - 18, top: M.top + plotH + 2,
            width: 36, textAlign: 'center', fontSize: 6, color: '#6b7280',
          }}>{fmt(v)}</Text>
        ))}

        {/* Section labels at top */}
        {sections.map((sec, i) => (
          <Text key={`slbl${i}`} style={{
            position: 'absolute', left: px(sec.x) - 12, top: M.top - 10,
            width: 24, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: EGL_COLORS.label,
          }}>{sec.shortLabel}</Text>
        ))}

        {/* VH labels */}
        {vhLines.map((vl, i) => {
          const midY = (vl.y1 + vl.y2) / 2;
          return (
            <Text key={`vhlbl${i}`} style={{
              position: 'absolute',
              left: vl.side === 'right' ? vl.sx + 4 : vl.sx - 60,
              top: midY - 4,
              width: 56, textAlign: vl.side === 'right' ? 'left' : 'right',
              fontSize: 5.5, color: EGL_COLORS.vh, fontFamily: 'Helvetica-Bold',
            }}>{vl.label}</Text>
          );
        })}

        {/* Head loss label */}
        {Math.abs(hl) > 0.001 ? (
          <Text style={{
            position: 'absolute', left: hlX + 5, top: (py(egl4) + py(egl1)) / 2 - 4,
            width: 60, fontSize: 5.5, color: EGL_COLORS.hl, fontFamily: 'Helvetica-Bold',
          }}>{`Δh=${hl.toFixed(3)}`}</Text>
        ) : null}

        {/* Flow label */}
        <Text style={{
          position: 'absolute', left: px(totalLen * 0.12), top: py(Math.max(...sections.map(sec => sec.egl))) - 18,
          width: 30, textAlign: 'center', fontSize: 6, color: EGL_COLORS.flowArrow,
        }}>Flow</Text>

        {/* Axis labels */}
        <Text style={{
          position: 'absolute', left: M.left, bottom: height - tableTop + 6,
          width: plotW, textAlign: 'center',
          fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
        }}>Longitudinal Distance (ft)</Text>
        <Text style={{
          position: 'absolute', left: 0, top: 0,
          width: M.left, textAlign: 'center',
          fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
        }}>Elev (ft)</Text>

        {/* Section data table */}
        {/* Row headers */}
        {headers.map((h, ri) => (
          <Text key={`rh${ri}`} style={{
            position: 'absolute', left: 0, top: tableTop + ri * rowH,
            width: M.left - 4, textAlign: 'right',
            fontSize: 5.5, color: EGL_COLORS.tableText, fontFamily: 'Helvetica-Bold',
          }}>{h}</Text>
        ))}

        {/* Section headers */}
        {sections.map((sec, i) => (
          <Text key={`sh${i}`} style={{
            position: 'absolute', left: px(sec.x) - 28, top: tableTop - rowH,
            width: 56, textAlign: 'center',
            fontSize: 5.5, color: EGL_COLORS.tableBold, fontFamily: 'Helvetica-Bold',
          }}>{sec.label}</Text>
        ))}

        {/* Section values */}
        {sections.map((sec, si) => {
          const vals = [
            { text: `${sec.wsel.toFixed(2)} ft`, color: EGL_COLORS.hgl },
            { text: `${sec.velocity.toFixed(2)} ft/s`, color: EGL_COLORS.tableText },
            { text: isFinite(sec.froude) ? sec.froude.toFixed(3) : '—', color: EGL_COLORS.tableText },
            { text: `${sec.egl.toFixed(2)} ft`, color: '#f97316' },
          ];
          return vals.map((v, ri) => (
            <Text key={`sv${si}-${ri}`} style={{
              position: 'absolute', left: px(sec.x) - 28, top: tableTop + ri * rowH,
              width: 56, textAlign: 'center',
              fontSize: 5.5, color: v.color, fontFamily: 'Courier',
            }}>{v.text}</Text>
          ));
        })}
      </View>

      {/* Legend */}
      <View style={cs.legend}>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: EGL_COLORS.hgl }]} />
          <Text style={cs.legendText}>HGL (Water Surface)</Text>
        </View>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: EGL_COLORS.egl }]} />
          <Text style={cs.legendText}>EGL (Energy Grade)</Text>
        </View>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: EGL_COLORS.vh }]} />
          <Text style={cs.legendText}>V²/2g (Velocity Head)</Text>
        </View>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: EGL_COLORS.hl }]} />
          <Text style={cs.legendText}>Δh (Head Loss)</Text>
        </View>
        <View style={cs.legendItem}>
          <View style={[cs.legendDot, { backgroundColor: EGL_COLORS.bridge }]} />
          <Text style={cs.legendText}>Bridge Deck</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Momentum Force Diagram (PDF) ─── */

interface PdfForceDiagramProps {
  momentumResult: MethodResult;
  profileName: string;
  width: number;
  height: number;
}

interface ForceEntry {
  label: string;
  value: number;
  color: string;
  direction: 'right' | 'left';
}

export function PdfForceDiagram({ momentumResult, profileName, width, height }: PdfForceDiagramProps) {
  // Extract forces from calculation steps
  const steps = momentumResult.calculationSteps;
  if (steps.length < 4) return null;

  const F_ds = steps[1]?.intermediateValues?.F_ds ?? 0;
  const M_ds = steps[1]?.intermediateValues?.M_ds ?? 0;
  const F_drag = steps[2]?.result ?? 0;
  const W_x = steps[3]?.intermediateValues?.W_x ?? 0;
  const F_friction = steps[3]?.intermediateValues?.F_friction ?? 0;

  // Compute upstream forces from balance
  // At equilibrium: F_us + M_ds + W_x = F_ds + M_us + F_friction + F_drag
  // We don't have M_us directly but can estimate from the final result
  const usVel = momentumResult.approachVelocity;
  const WATER_DENSITY = 1.94;
  const Q = M_ds / (WATER_DENSITY * (steps[0]?.intermediateValues?.V ?? 1));
  const M_us = WATER_DENSITY * Q * usVel;
  const F_us = F_ds - M_ds + M_us - W_x + F_friction + F_drag;

  const allForces: ForceEntry[] = [
    { label: 'F_us (Hydrostatic)', value: F_us, color: '#2563eb', direction: 'right' },
    { label: 'F_ds (Hydrostatic)', value: F_ds, color: '#dc2626', direction: 'left' },
    { label: 'M_us (Momentum)', value: M_us, color: '#7c3aed', direction: 'right' },
    { label: 'M_ds (Momentum)', value: M_ds, color: '#be185d', direction: 'left' },
    { label: 'F_drag (Pier)', value: F_drag, color: '#d97706', direction: 'left' },
    { label: 'W_x (Weight)', value: W_x, color: '#059669', direction: 'right' },
    { label: 'F_friction', value: F_friction, color: '#64748b', direction: 'left' },
  ];
  const forces = allForces.filter(f => Math.abs(f.value) > 0.01);

  const maxForce = Math.max(...forces.map(f => Math.abs(f.value)), 1);

  const M2 = { top: 14, right: 12, bottom: 10, left: 120 };
  const barAreaW = width - M2.left - M2.right;
  const barH = 14;
  const barGap = 4;
  const totalBarsH = forces.length * (barH + barGap);
  const chartH = Math.max(height, totalBarsH + M2.top + M2.bottom);

  const centerX = M2.left + barAreaW / 2;
  const maxBarHalf = barAreaW / 2 - 10;

  return (
    <View>
      <View style={{ position: 'relative', width, height: chartH }}>
        <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={chartH}>
          <Rect x={0} y={0} width={width} height={chartH} fill="white" />

          {/* Center axis */}
          <Line x1={centerX} y1={M2.top} x2={centerX} y2={M2.top + totalBarsH}
            stroke="#d1d5db" strokeWidth={0.75} strokeDasharray="3,2" />

          {/* Force bars */}
          {forces.map((f, i) => {
            const barY = M2.top + i * (barH + barGap);
            const barLen = (Math.abs(f.value) / maxForce) * maxBarHalf;
            const barX = f.direction === 'right' ? centerX : centerX - barLen;

            return (
              <G key={i}>
                <Rect x={barX} y={barY} width={barLen} height={barH}
                  fill={f.color} opacity={0.2} stroke={f.color} strokeWidth={0.75} />
                {/* Arrow head */}
                {f.direction === 'right' ? (
                  <Path d={`M ${barX + barLen} ${barY + barH / 2} L ${barX + barLen - 4} ${barY + 2} L ${barX + barLen - 4} ${barY + barH - 2} Z`}
                    fill={f.color} opacity={0.6} />
                ) : (
                  <Path d={`M ${barX} ${barY + barH / 2} L ${barX + 4} ${barY + 2} L ${barX + 4} ${barY + barH - 2} Z`}
                    fill={f.color} opacity={0.6} />
                )}
              </G>
            );
          })}
        </Svg>

        {/* Force labels (left side) */}
        {forces.map((f, i) => {
          const barY = M2.top + i * (barH + barGap);
          return (
            <Text key={`fl${i}`} style={{
              position: 'absolute', left: 2, top: barY + 1,
              width: M2.left - 6, textAlign: 'right',
              fontSize: 6.5, color: f.color, fontFamily: 'Helvetica-Bold',
            }}>{f.label}</Text>
          );
        })}

        {/* Force values (on bars) */}
        {forces.map((f, i) => {
          const barY = M2.top + i * (barH + barGap);
          const barLen = (Math.abs(f.value) / maxForce) * maxBarHalf;
          const valX = f.direction === 'right'
            ? centerX + barLen + 3
            : centerX - barLen - 40;
          return (
            <Text key={`fv${i}`} style={{
              position: 'absolute', left: valX, top: barY + 1,
              width: 40, textAlign: f.direction === 'right' ? 'left' : 'right',
              fontSize: 6, color: '#374151', fontFamily: 'Courier',
            }}>{Math.abs(f.value) >= 1000 ? `${(f.value / 1000).toFixed(1)}k` : f.value.toFixed(0)} lb</Text>
          );
        })}

        {/* Direction labels */}
        <Text style={{
          position: 'absolute', left: centerX + 4, top: 2,
          width: 80, fontSize: 6, color: '#9ca3af',
        }}>→ Upstream (driving)</Text>
        <Text style={{
          position: 'absolute', left: centerX - 90, top: 2,
          width: 86, textAlign: 'right', fontSize: 6, color: '#9ca3af',
        }}>← Downstream (resisting)</Text>
      </View>

      {/* Summary line */}
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        <Text style={{ fontSize: 6.5, color: '#6b7280' }}>
          Profile: {profileName} · Net balance → US WSEL = {momentumResult.upstreamWsel.toFixed(2)} ft · Afflux = {momentumResult.totalHeadLoss.toFixed(3)} ft
        </Text>
      </View>
    </View>
  );
}

/* ─── Builder helpers ─── */

export function buildAffluxSeries(results: CalculationResults, profiles: FlowProfile[]): LineChartSeries[] {
  return METHODS.map((m) => ({
    label: METHOD_LABELS[m],
    color: METHOD_COLORS[m],
    points: results[m]
      .map((r, i) => ({ x: profiles[i].discharge, y: r.error ? NaN : r.totalHeadLoss }))
      .filter((p) => !isNaN(p.y)),
  })).filter((s) => s.points.length > 0);
}

export function buildWselSeries(results: CalculationResults, profiles: FlowProfile[]): LineChartSeries[] {
  return METHODS.map((m) => ({
    label: METHOD_LABELS[m],
    color: METHOD_COLORS[m],
    points: results[m]
      .map((r, i) => ({ x: profiles[i].discharge, y: r.error ? NaN : r.upstreamWsel }))
      .filter((p) => !isNaN(p.y)),
  })).filter((s) => s.points.length > 0);
}

export function buildHecRasAffluxPoints(hecRas: HecRasComparison[], profiles: FlowProfile[]): { x: number; y: number }[] {
  return hecRas.map((h, i) => ({ x: profiles[i]?.discharge ?? 0, y: h.headLoss ?? NaN })).filter((p) => !isNaN(p.y));
}

export function buildHecRasWselPoints(hecRas: HecRasComparison[], profiles: FlowProfile[]): { x: number; y: number }[] {
  return hecRas.map((h, i) => ({ x: profiles[i]?.discharge ?? 0, y: h.upstreamWsel ?? NaN })).filter((p) => !isNaN(p.y));
}
