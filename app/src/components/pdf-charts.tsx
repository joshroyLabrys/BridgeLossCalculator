/**
 * Simplified, print-optimized charts rendered natively in react-pdf.
 * No DOM capture — these are built from data using react-pdf's <Svg> primitives.
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
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 8, height: 3, borderRadius: 1 },
  legendText: { fontSize: 7, color: '#374151' },
});

/* ─── Scale helpers ─── */

interface Scale {
  min: number;
  max: number;
  pxMin: number;
  pxMax: number;
}

function makeScale(dataMin: number, dataMax: number, pxMin: number, pxMax: number, padding = 0.05): Scale {
  const range = dataMax - dataMin || 1;
  return {
    min: dataMin - range * padding,
    max: dataMax + range * padding,
    pxMin,
    pxMax,
  };
}

function toPixel(value: number, scale: Scale): number {
  const t = (value - scale.min) / (scale.max - scale.min);
  return scale.pxMin + t * (scale.pxMax - scale.pxMin);
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let nice: number;
  if (norm <= 1.5) nice = 1;
  else if (norm <= 3) nice = 2;
  else if (norm <= 7) nice = 5;
  else nice = 10;
  return nice * mag;
}

function generateTicks(scale: Scale, targetCount = 5): number[] {
  const range = scale.max - scale.min;
  const step = niceStep(range, targetCount);
  const start = Math.ceil(scale.min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= scale.max; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6); // avoid float drift
  }
  return ticks;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(3);
}

/* ─── Line Chart (used for Afflux + WSEL) ─── */

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
  const margin = { top: 12, right: 16, bottom: 28, left: 50 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Compute data bounds
  const allPoints = series.flatMap((s) => s.points).concat(hecRasPoints || []);
  if (allPoints.length === 0) return null;

  const xMin = Math.min(...allPoints.map((p) => p.x));
  const xMax = Math.max(...allPoints.map((p) => p.x));
  const yMin = Math.min(...allPoints.map((p) => p.y));
  const yMax = Math.max(...allPoints.map((p) => p.y));

  const xScale = makeScale(xMin, xMax, margin.left, margin.left + plotW);
  // Y axis is inverted (top = high value)
  const yScale = makeScale(yMin, yMax, margin.top + plotH, margin.top);

  const xTicks = generateTicks(xScale);
  const yTicks = generateTicks({ ...yScale, pxMin: yScale.pxMax, pxMax: yScale.pxMin });

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={height} fill="white" />

        {/* Grid */}
        {yTicks.map((v, i) => {
          const py = toPixel(v, yScale);
          return <Line key={`gy${i}`} x1={margin.left} y1={py} x2={margin.left + plotW} y2={py}
            stroke="#f3f4f6" strokeWidth={0.5} />;
        })}
        {xTicks.map((v, i) => {
          const px = toPixel(v, xScale);
          return <Line key={`gx${i}`} x1={px} y1={margin.top} x2={px} y2={margin.top + plotH}
            stroke="#f3f4f6" strokeWidth={0.5} />;
        })}

        {/* Axes */}
        <Line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH}
          stroke="#9ca3af" strokeWidth={0.75} />
        <Line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH}
          stroke="#9ca3af" strokeWidth={0.75} />

        {/* Data lines */}
        {series.map((s) => {
          if (s.points.length < 2) return null;
          const pathData = s.points.map((p, i) => {
            const px = toPixel(p.x, xScale);
            const py = toPixel(p.y, yScale);
            return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
          }).join(' ');
          return (
            <G key={s.label}>
              <Path d={pathData} stroke={s.color} strokeWidth={1.5} fill="none"
                strokeDasharray={s.dashed ? '4,2' : undefined} />
              {s.points.map((p, i) => (
                <Circle key={i} cx={toPixel(p.x, xScale)} cy={toPixel(p.y, yScale)}
                  r={2.5} fill={s.color} />
              ))}
            </G>
          );
        })}

        {/* HEC-RAS points */}
        {hecRasPoints?.map((p, i) => (
          <G key={`hr${i}`}>
            <Circle cx={toPixel(p.x, xScale)} cy={toPixel(p.y, yScale)}
              r={3.5} fill="none" stroke={HECRAS_COLOR} strokeWidth={1.5} />
          </G>
        ))}

        {/* Tick labels — rendered as tiny rects with text overlay (react-pdf SVG text workaround) */}
      </Svg>

      {/* Tick labels and axis labels rendered as react-pdf Text outside SVG for reliable font rendering */}
      <View style={{ position: 'relative', marginTop: -height }}>
        {/* Y tick labels */}
        {yTicks.map((v, i) => (
          <Text key={`yt${i}`} style={{
            position: 'absolute',
            left: 0,
            top: toPixel(v, yScale) - 4,
            width: margin.left - 4,
            textAlign: 'right',
            fontSize: 6.5,
            color: '#6b7280',
          }}>
            {formatTick(v)}
          </Text>
        ))}
        {/* X tick labels */}
        {xTicks.map((v, i) => (
          <Text key={`xt${i}`} style={{
            position: 'absolute',
            left: toPixel(v, xScale) - 20,
            top: margin.top + plotH + 3,
            width: 40,
            textAlign: 'center',
            fontSize: 6.5,
            color: '#6b7280',
          }}>
            {formatTick(v)}
          </Text>
        ))}
        {/* X axis label */}
        {xLabel ? (
          <Text style={{
            position: 'absolute',
            left: margin.left,
            top: height - 6,
            width: plotW,
            textAlign: 'center',
            fontSize: 7,
            fontFamily: 'Helvetica-Bold',
            color: '#374151',
          }}>
            {xLabel}
          </Text>
        ) : null}
        {/* Y axis label */}
        {yLabel ? (
          <Text style={{
            position: 'absolute',
            left: 0,
            top: margin.top - 8,
            width: margin.left,
            textAlign: 'center',
            fontSize: 7,
            fontFamily: 'Helvetica-Bold',
            color: '#374151',
          }}>
            {yLabel}
          </Text>
        ) : null}
      </View>

      {/* Spacer to account for the absolute overlay */}
      <View style={{ height: 0 }} />

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
            <View style={[cs.legendDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: HECRAS_COLOR, borderRadius: 4 }]} />
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
  profileIndex?: number; // which profile's WSELs to show (default: 0)
  dsWsel?: number;
  width: number;
  height: number;
}

export function PdfCrossSectionChart({ crossSection, bridge, results, profileIndex = 0, dsWsel, width, height }: CrossSectionChartProps) {
  if (crossSection.length < 2) return null;

  const margin = { top: 12, right: 16, bottom: 28, left: 50 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const stations = crossSection.map((p) => p.station);
  const elevations = crossSection.map((p) => p.elevation);
  const sMin = Math.min(...stations);
  const sMax = Math.max(...stations);
  const eMin = Math.min(...elevations);
  let eMax = Math.max(...elevations, bridge.highChord);

  // Include WSELs in Y range
  const wsels: number[] = [];
  if (dsWsel) wsels.push(dsWsel);
  if (results) {
    for (const m of METHODS) {
      const r = results[m][profileIndex];
      if (r && !r.error) wsels.push(r.upstreamWsel);
    }
  }
  if (wsels.length > 0) eMax = Math.max(eMax, ...wsels);

  const xScale = makeScale(sMin, sMax, margin.left, margin.left + plotW, 0.02);
  const yScale = makeScale(eMin, eMax, margin.top + plotH, margin.top, 0.05);

  const xTicks = generateTicks(xScale);
  const yTicks = generateTicks({ ...yScale, pxMin: yScale.pxMax, pxMax: yScale.pxMin });

  // Ground profile path
  const groundPath = crossSection.map((p, i) => {
    const px = toPixel(p.station, xScale);
    const py = toPixel(p.elevation, yScale);
    return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
  }).join(' ');

  // Ground fill (closed polygon down to bottom)
  const groundFill = groundPath +
    ` L ${toPixel(crossSection[crossSection.length - 1].station, xScale)} ${margin.top + plotH}` +
    ` L ${toPixel(crossSection[0].station, xScale)} ${margin.top + plotH} Z`;

  // Bridge deck
  const deckLeft = toPixel(bridge.leftAbutmentStation, xScale);
  const deckRight = toPixel(bridge.rightAbutmentStation, xScale);
  const deckTop = toPixel(bridge.highChord, yScale);
  const lowChordY = toPixel(Math.min(bridge.lowChordLeft, bridge.lowChordRight), yScale);

  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={0} y={0} width={width} height={height} fill="white" />

        {/* Grid */}
        {yTicks.map((v, i) => (
          <Line key={`gy${i}`} x1={margin.left} y1={toPixel(v, yScale)} x2={margin.left + plotW} y2={toPixel(v, yScale)}
            stroke="#f3f4f6" strokeWidth={0.5} />
        ))}

        {/* Ground fill */}
        <Path d={groundFill} fill="#e5e7eb" opacity={0.5} />
        {/* Ground line */}
        <Path d={groundPath} stroke="#78716c" strokeWidth={1.5} fill="none" />

        {/* Water surface (DS WSEL) */}
        {dsWsel ? (
          <Line x1={margin.left} y1={toPixel(dsWsel, yScale)} x2={margin.left + plotW} y2={toPixel(dsWsel, yScale)}
            stroke="#3b82f6" strokeWidth={0.75} strokeDasharray="4,2" opacity={0.5} />
        ) : null}

        {/* Method WSEL lines */}
        {results ? METHODS.map((m) => {
          const r = results[m][profileIndex];
          if (!r || r.error) return null;
          const py = toPixel(r.upstreamWsel, yScale);
          return (
            <Line key={m}
              x1={toPixel(bridge.leftAbutmentStation, xScale) - 20}
              y1={py}
              x2={toPixel(bridge.rightAbutmentStation, xScale) + 20}
              y2={py}
              stroke={METHOD_COLORS[m]} strokeWidth={1} strokeDasharray="3,2" />
          );
        }) : null}

        {/* Bridge deck */}
        <Rect x={deckLeft} y={deckTop} width={deckRight - deckLeft} height={lowChordY - deckTop}
          fill="#fecaca" stroke="#dc2626" strokeWidth={0.75} opacity={0.6} />
        {/* Low chord line */}
        <Line x1={deckLeft} y1={lowChordY} x2={deckRight} y2={lowChordY}
          stroke="#dc2626" strokeWidth={1} />
        {/* Abutments */}
        <Line x1={deckLeft} y1={deckTop} x2={deckLeft} y2={margin.top + plotH}
          stroke="#dc2626" strokeWidth={1} />
        <Line x1={deckRight} y1={deckTop} x2={deckRight} y2={margin.top + plotH}
          stroke="#dc2626" strokeWidth={1} />

        {/* Piers */}
        {bridge.piers.map((pier, i) => {
          const px = toPixel(pier.station, xScale);
          const halfW = Math.max((pier.width / (sMax - sMin)) * plotW / 2, 1.5);
          return (
            <Rect key={i} x={px - halfW} y={deckTop} width={halfW * 2} height={lowChordY - deckTop + 10}
              fill="#fca5a5" stroke="#dc2626" strokeWidth={0.5} />
          );
        })}

        {/* Axes */}
        <Line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH}
          stroke="#9ca3af" strokeWidth={0.75} />
        <Line x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH}
          stroke="#9ca3af" strokeWidth={0.75} />
      </Svg>

      {/* Labels overlay */}
      <View style={{ position: 'relative', marginTop: -height }}>
        {yTicks.map((v, i) => (
          <Text key={`yt${i}`} style={{
            position: 'absolute', left: 0, top: toPixel(v, yScale) - 4,
            width: margin.left - 4, textAlign: 'right', fontSize: 6.5, color: '#6b7280',
          }}>
            {formatTick(v)}
          </Text>
        ))}
        {xTicks.map((v, i) => (
          <Text key={`xt${i}`} style={{
            position: 'absolute', left: toPixel(v, xScale) - 20, top: margin.top + plotH + 3,
            width: 40, textAlign: 'center', fontSize: 6.5, color: '#6b7280',
          }}>
            {formatTick(v)}
          </Text>
        ))}
        <Text style={{
          position: 'absolute', left: margin.left, top: height - 6,
          width: plotW, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
        }}>
          Station
        </Text>
        <Text style={{
          position: 'absolute', left: 0, top: margin.top - 8,
          width: margin.left, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151',
        }}>
          Elevation
        </Text>
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
              <Text style={cs.legendText}>{METHOD_LABELS[m]} WSEL</Text>
            </View>
          );
        }) : null}
      </View>
    </View>
  );
}

/* ─── Builder helpers for the report ─── */

export function buildAffluxSeries(
  results: CalculationResults,
  profiles: FlowProfile[],
): LineChartSeries[] {
  return METHODS.map((m) => ({
    label: METHOD_LABELS[m],
    color: METHOD_COLORS[m],
    points: results[m]
      .map((r, i) => ({ x: profiles[i].discharge, y: r.error ? NaN : r.totalHeadLoss }))
      .filter((p) => !isNaN(p.y)),
  })).filter((s) => s.points.length > 0);
}

export function buildWselSeries(
  results: CalculationResults,
  profiles: FlowProfile[],
): LineChartSeries[] {
  return METHODS.map((m) => ({
    label: METHOD_LABELS[m],
    color: METHOD_COLORS[m],
    points: results[m]
      .map((r, i) => ({ x: profiles[i].discharge, y: r.error ? NaN : r.upstreamWsel }))
      .filter((p) => !isNaN(p.y)),
  })).filter((s) => s.points.length > 0);
}

export function buildHecRasAffluxPoints(
  hecRas: HecRasComparison[],
  profiles: FlowProfile[],
): { x: number; y: number }[] {
  return hecRas
    .map((h, i) => ({ x: profiles[i]?.discharge ?? 0, y: h.headLoss ?? NaN }))
    .filter((p) => !isNaN(p.y));
}

export function buildHecRasWselPoints(
  hecRas: HecRasComparison[],
  profiles: FlowProfile[],
): { x: number; y: number }[] {
  return hecRas
    .map((h, i) => ({ x: profiles[i]?.discharge ?? 0, y: h.upstreamWsel ?? NaN }))
    .filter((p) => !isNaN(p.y));
}
