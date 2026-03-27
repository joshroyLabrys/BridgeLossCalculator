/**
 * Simplified, print-optimized charts rendered natively in react-pdf.
 * Uses <Svg> for graphics with absolutely-positioned <Text> for labels,
 * all within a single relatively-positioned container.
 */
import { View, Text, Svg, Line, Rect, Circle, G, Path, StyleSheet } from '@react-pdf/renderer';
import type { CrossSectionPoint, BridgeGeometry, CalculationResults, FlowProfile, HecRasComparison } from '@/engine/types';

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
