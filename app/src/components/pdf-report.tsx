'use client';

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { computeFreeboard } from '@/engine/freeboard';
import type {
  CrossSectionPoint,
  BridgeGeometry,
  FlowProfile,
  Coefficients,
  CalculationResults,
  HecRasComparison,
  ScourResults,
  ScourInputs,
  AdequacyResults,
  ChecklistItem,
  Jurisdiction,
  NarrativeSection,
} from '@/engine/types';
import type { AiSummaryResponse } from '@/lib/api/ai-summary-prompt';
import {
  PdfCrossSectionChart,
  PdfLineChart,
  PdfEnergyGradeDiagram,
  PdfForceDiagram,
  buildAffluxSeries,
  buildWselSeries,
  buildHecRasAffluxPoints,
  buildHecRasWselPoints,
} from './pdf-charts';
import { buildHydraulicProfile } from '@/engine/simulation-profile';

/* ─── Constants ─── */

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
const METHOD_LABELS: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

const C = {
  primary: '#1e40af',
  text: '#111827',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  green: '#15803d',
  amber: '#b45309',
  red: '#dc2626',
  white: '#ffffff',
  bg: '#f9fafb',
};

/* ─── Styles ─── */

const s = StyleSheet.create({
  /* Page */
  page: {
    paddingTop: 40,
    paddingBottom: 45,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    paddingBottom: 4,
    marginBottom: 10,
  },
  pageHeaderLeft: { fontSize: 8, color: C.textMuted, letterSpacing: 0.5 },
  pageHeaderRight: { fontSize: 8, color: C.textLight, fontFamily: 'Helvetica-Bold' },
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 42,
    right: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: C.borderLight,
    paddingTop: 3,
  },
  footerText: { fontSize: 7, color: C.textMuted },

  /* Cover */
  coverCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverRule: { width: 60, height: 2, backgroundColor: C.primary, marginBottom: 24 },
  coverTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.text, textAlign: 'center' },
  coverSub: { fontSize: 12, color: C.textLight, marginTop: 4, textAlign: 'center' },
  coverRuleB: { width: 60, height: 2, backgroundColor: C.primary, marginTop: 24, marginBottom: 16 },
  coverDate: { fontSize: 10, color: C.textMuted },

  /* Sections */
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 2 },
  sectionDesc: { fontSize: 7.5, color: C.textMuted, marginBottom: 6, maxWidth: 420 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: C.border, marginTop: 4, marginBottom: 10 },
  subTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 6, marginBottom: 3 },
  subDesc: { fontSize: 7, color: C.textMuted, marginBottom: 3 },

  /* Key-Value grid */
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  kvItem: { width: '33%', flexDirection: 'row', marginBottom: 2 },
  kvLabel: { fontSize: 8, color: C.textLight },
  kvValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginLeft: 3 },

  /* Tables */
  table: { borderWidth: 0.5, borderColor: C.border, marginBottom: 4 },
  tHead: { flexDirection: 'row', backgroundColor: C.borderLight, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border },
  tRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.bg },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', paddingVertical: 2.5, paddingHorizontal: 4 },
  td: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 4 },
  tdR: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 4, textAlign: 'right' },

  /* Charts */
  chartWrap: { marginBottom: 8 },
  chartLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 3 },
  chartBorder: { borderWidth: 0.5, borderColor: C.border, borderRadius: 2, overflow: 'hidden', backgroundColor: C.white },

  /* Bullets */
  bulletItem: { flexDirection: 'row', marginBottom: 2, paddingRight: 16 },
  bulletDot: { fontSize: 8, color: C.textMuted, marginRight: 4, width: 8 },
  bulletText: { fontSize: 8, color: C.textLight, flex: 1 },
});

/* ─── Helpers ─── */

function PageHeader({ reportTitle }: { reportTitle: string }) {
  return (
    <View style={s.pageHeader} fixed>
      <Text style={s.pageHeaderLeft}>{reportTitle.toUpperCase()}</Text>
      <Text style={s.pageHeaderRight}>Hydraulic Loss Assessment</Text>
    </View>
  );
}

function PageFooter({ date }: { date: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text style={s.footerText}>Generated by Bridge Loss Calculator · QA verification only</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${date} · Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Sec({ num, title, desc, children }: { num: number; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{num}. {title}</Text>
      {desc ? <Text style={s.sectionDesc}>{desc}</Text> : null}
      {children}
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.kvItem}>
      <Text style={s.kvLabel}>{label}:</Text>
      <Text style={s.kvValue}>{String(value)}</Text>
    </View>
  );
}

/**
 * Parse simple markdown (bold, italic) into react-pdf <Text> spans.
 * Handles **bold**, __bold__, *italic*, _italic_, and ***bold+italic***.
 */
function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match ***bold+italic***, **bold**, __bold__, *italic*, _italic_
  const re = /(\*{3}(.+?)\*{3}|\*{2}(.+?)\*{2}|_{2}(.+?)_{2}|\*(.+?)\*|_(.+?)_)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      // ***bold+italic***
      parts.push(<Text key={key++} style={{ fontFamily: 'Helvetica-BoldOblique' }}>{match[2]}</Text>);
    } else if (match[3]) {
      // **bold**
      parts.push(<Text key={key++} style={{ fontFamily: 'Helvetica-Bold' }}>{match[3]}</Text>);
    } else if (match[4]) {
      // __bold__
      parts.push(<Text key={key++} style={{ fontFamily: 'Helvetica-Bold' }}>{match[4]}</Text>);
    } else if (match[5]) {
      // *italic*
      parts.push(<Text key={key++} style={{ fontFamily: 'Helvetica-Oblique' }}>{match[5]}</Text>);
    } else if (match[6]) {
      // _italic_
      parts.push(<Text key={key++} style={{ fontFamily: 'Helvetica-Oblique' }}>{match[6]}</Text>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

function Bullet({ text, color }: { text: string; color?: string }) {
  return (
    <View style={s.bulletItem} wrap={false}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={[s.bulletText, color ? { color } : {}]}>{parseMarkdown(text)}</Text>
    </View>
  );
}

/* ─── Table ─── */

interface Col {
  header: string;
  width: string | number;
  align?: 'left' | 'right' | 'center';
  render: (row: Record<string, unknown>, i: number) => string;
  cellStyle?: (row: Record<string, unknown>) => object | undefined;
}

function DataTable({ columns, data }: { columns: Col[]; data: Record<string, unknown>[] }) {
  return (
    <View style={s.table}>
      <View style={s.tHead} fixed>
        {columns.map((col, ci) => (
          <Text key={ci} style={[s.th, { width: col.width, textAlign: col.align || 'left' }]}>
            {col.header}
          </Text>
        ))}
      </View>
      {data.map((row, ri) => (
        <View key={ri} style={ri % 2 ? s.tRowAlt : s.tRow} wrap={false}>
          {columns.map((col, ci) => (
            <Text key={ci} style={[
              col.align === 'right' ? s.tdR : s.td,
              { width: col.width, textAlign: col.align || 'left' },
              (col.cellStyle?.(row) || {}) as Record<string, string | number>,
            ]}>
              {col.render(row, ri)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ─── Report data ─── */

export interface PdfSections {
  cover?: boolean;
  inputs?: boolean;
  hydraulicAnalysis?: boolean;
  overview?: boolean;
  scour?: boolean;
  adequacy?: boolean;
  regulatory?: boolean;
  narrative?: boolean;
  appendices?: boolean;
}

export interface PdfReportData {
  projectName: string;
  crossSection: CrossSectionPoint[];
  bridge: BridgeGeometry;
  profiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  hecRasComparison: HecRasComparison[];
  aiSummary: AiSummaryResponse | null;
  sceneCapture?: string | null;
  scourResults?: ScourResults[] | null;
  scourInputs?: ScourInputs;
  adequacyResults?: AdequacyResults | null;
  regulatoryChecklist?: ChecklistItem[];
  regulatoryJurisdiction?: Jurisdiction;
  narrativeSections?: NarrativeSection[];
  sections?: PdfSections;
}

/* ─── Document ─── */

const JURISDICTION_LABELS: Record<string, string> = {
  tmr: 'TMR (Queensland)',
  vicroads: 'VicRoads (Victoria)',
  dpie: 'DPIE (NSW)',
  arr: 'ARR (National)',
};

const BED_MATERIAL_LABELS: Record<string, string> = {
  sand: 'Sand',
  gravel: 'Gravel',
  cobble: 'Cobble',
  clay: 'Clay',
  rock: 'Rock',
};

function ReportDocument({ data }: { data: PdfReportData }) {
  const {
    projectName, crossSection, bridge, profiles, coefficients, results,
    hecRasComparison, aiSummary, sceneCapture,
    scourResults, scourInputs, adequacyResults,
    regulatoryChecklist, regulatoryJurisdiction, narrativeSections,
    sections: sec = {},
  } = data;
  const show = {
    cover: sec.cover !== false,
    inputs: sec.inputs !== false,
    hydraulicAnalysis: sec.hydraulicAnalysis !== false,
    overview: sec.overview !== false,
    scour: sec.scour !== false,
    adequacy: sec.adequacy !== false,
    regulatory: sec.regulatory !== false,
    narrative: sec.narrative !== false,
    appendices: sec.appendices !== false,
  };
  const date = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = projectName || 'Bridge Hydraulic Loss Assessment';
  const freeboard = results ? computeFreeboard(results, bridge, profiles, coefficients.freeboardThreshold) : null;
  const hasHecRas = hecRasComparison.length > 0 && hecRasComparison.some((c) => c.upstreamWsel !== null || c.headLoss !== null);
  const CHART_W = 510; // A4 width minus margins
  const CHART_H = 200;

  let sn = 0;
  const next = () => ++sn;

  return (
    <Document title={`${title} - Report`} author="Bridge Loss Calculator">

      {/* ═══ COVER ═══ */}
      {show.cover ? (
        <Page size="A4" style={[s.page, { paddingTop: 0, paddingBottom: 0 }]}>
          <View style={s.coverCenter}>
            <View style={s.coverRule} />
            <Text style={s.coverTitle}>Bridge Hydraulic Loss Assessment</Text>
            {projectName ? <Text style={s.coverSub}>{projectName}</Text> : null}
            <View style={s.coverRuleB} />
            <Text style={s.coverDate}>{date}</Text>
          </View>
        </Page>
      ) : null}

      {/* ═══ BODY — single flowing page ═══ */}
      <Page size="A4" style={s.page} wrap>
        <PageHeader reportTitle={title} />
        <PageFooter date={date} />

        {/* ── 1. Input Summary ── */}
        {show.inputs ? <Sec num={next()} title="Input Summary" desc="Summary of bridge geometry, coefficients, and flow profiles used as inputs.">
          <Text style={s.subTitle}>Bridge Geometry</Text>
          <View style={s.kvGrid}>
            <KV label="Low Chord Left" value={bridge.lowChordLeft} />
            <KV label="Low Chord Right" value={bridge.lowChordRight} />
            <KV label="High Chord" value={bridge.highChord} />
            <KV label="Skew Angle" value={`${bridge.skewAngle}°`} />
            <KV label="Left Abutment" value={bridge.leftAbutmentStation} />
            <KV label="Right Abutment" value={bridge.rightAbutmentStation} />
            <KV label="Piers" value={bridge.piers.length} />
            {coefficients.debrisBlockagePct > 0 ? <KV label="Debris Blockage" value={`${coefficients.debrisBlockagePct}%`} /> : null}
          </View>

          <Text style={s.subTitle}>Coefficients</Text>
          <View style={s.kvGrid}>
            <KV label="Contraction" value={coefficients.contractionCoeff} />
            <KV label="Expansion" value={coefficients.expansionCoeff} />
            {coefficients.yarnellK !== null ? <KV label="Yarnell K" value={coefficients.yarnellK} /> : null}
            <KV label="Max Iterations" value={coefficients.maxIterations} />
            <KV label="Tolerance" value={coefficients.tolerance} />
            {coefficients.manningsNSensitivityPct !== null && coefficients.manningsNSensitivityPct > 0
              ? <KV label="Manning's n Sensitivity" value={`±${coefficients.manningsNSensitivityPct}%`} />
              : null}
          </View>

          <Text style={s.subTitle}>Flow Profiles</Text>
          <DataTable
            columns={[
              { header: 'Name', width: '25%', render: (r) => r.name as string },
              { header: 'ARI', width: '15%', render: (r) => (r.ari as string) || '—' },
              { header: 'Q', width: '20%', align: 'right', render: (r) => String(r.discharge) },
              { header: 'DS WSEL', width: '20%', align: 'right', render: (r) => String(r.dsWsel) },
              { header: 'Slope', width: '20%', align: 'right', render: (r) => String(r.channelSlope) },
            ]}
            data={profiles as unknown as Record<string, unknown>[]}
          />
        </Sec> : null}

        {/* ── Cross-Section Chart ── */}
        {show.inputs && crossSection.length >= 2 ? (
          <View wrap={false}>
            <Divider />
            <View style={s.chartWrap}>
              <Text style={s.chartLabel}>Cross-Section Profile</Text>
              <View style={s.chartBorder}>
                <PdfCrossSectionChart
                  crossSection={crossSection}
                  bridge={bridge}
                  results={results}
                  profileIndex={0}
                  dsWsel={profiles[0]?.dsWsel}
                  width={CHART_W}
                  height={CHART_H}
                />
              </View>
            </View>
          </View>
        ) : null}

        {show.inputs ? <Divider /> : null}

        {/* ── 2. Cross-Section Data ── */}
        {show.inputs ? <Sec num={next()} title="Cross-Section Data" desc={`Surveyed channel geometry (${crossSection.length} points).`}>
          <DataTable
            columns={[
              { header: 'Station', width: '25%', align: 'right', render: (r) => (r.station as number).toFixed(1) },
              { header: 'Elevation', width: '25%', align: 'right', render: (r) => (r.elevation as number).toFixed(2) },
              { header: "Manning's n", width: '25%', align: 'right', render: (r) => String(r.manningsN) },
              { header: 'Bank', width: '25%', render: (r) => (r.bankStation as string) || '—' },
            ]}
            data={crossSection as unknown as Record<string, unknown>[]}
          />
        </Sec> : null}

        {/* ── 3. Freeboard Check ── */}
        {show.overview && results && freeboard ? (
          <>
            <Divider />
            <Sec num={next()} title="Freeboard Check" desc="Clearance between computed upstream WSEL (worst across methods) and bridge low chord. Positive = clearance. Negative = pressure/overtopping.">
              <DataTable
                columns={[
                  { header: 'Profile', width: '16%', render: (r) => r.profileName as string },
                  { header: 'ARI', width: '10%', render: (r) => (r.ari as string) || '—' },
                  { header: 'Q', width: '12%', align: 'right', render: (r) => (r.discharge as number).toFixed(0) },
                  { header: 'US WSEL', width: '14%', align: 'right', render: (r) => (r.usWsel as number).toFixed(2) },
                  { header: 'Low Chord', width: '14%', align: 'right', render: (r) => (r.lowChord as number).toFixed(2) },
                  { header: 'Freeboard', width: '14%', align: 'right', render: (r) => (r.freeboard as number).toFixed(2) },
                  {
                    header: 'Status', width: '20%', align: 'center',
                    render: (r) => (r.status as string).toUpperCase(),
                    cellStyle: (r) => ({
                      fontFamily: 'Helvetica-Bold',
                      color: (r.status as string) === 'clear' ? C.green : (r.status as string) === 'low' ? C.amber : C.red,
                    }),
                  },
                ]}
                data={freeboard.profiles as unknown as Record<string, unknown>[]}
              />
              {freeboard.zeroFreeboardQ !== null ? (
                <Text style={{ fontSize: 7, color: C.textLight, marginTop: 2 }}>
                  Estimated Q at zero freeboard: {freeboard.zeroFreeboardQ.toFixed(0)} (interpolated)
                </Text>
              ) : null}
            </Sec>
          </>
        ) : null}

        {/* ── 4. Flow Regime ── */}
        {show.overview && results ? (
          <>
            <Divider />
            <Sec num={next()} title="Flow Regime" desc="F = Free Surface, P = Pressure, O = Overtopping. Yarnell is valid for free-surface only — flagged (!) otherwise.">
              <View style={s.table}>
                <View style={s.tHead} fixed>
                  <Text style={[s.th, { width: '20%' }]}>Method</Text>
                  {profiles.map((p) => (
                    <Text key={p.name} style={[s.th, { width: `${80 / profiles.length}%`, textAlign: 'center' }]}>{p.name}</Text>
                  ))}
                </View>
                {METHODS.map((m, mi) => (
                  <View key={m} style={mi % 2 ? s.tRowAlt : s.tRow} wrap={false}>
                    <Text style={[s.td, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>{METHOD_LABELS[m]}</Text>
                    {results[m].map((r, i) => {
                      const lbl = r.flowRegime === 'free-surface' ? 'F' : r.flowRegime === 'pressure' ? 'P' : 'O';
                      const warn = m === 'yarnell' && r.flowRegime !== 'free-surface';
                      return (
                        <Text key={i} style={[
                          s.td, { width: `${80 / profiles.length}%`, textAlign: 'center' },
                          warn ? { color: C.amber, fontFamily: 'Helvetica-Bold' } : {},
                        ]}>
                          {lbl}{warn ? ' (!)' : ''}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Sec>
          </>
        ) : null}

        {/* ── 5. Method Comparison ── */}
        {show.hydraulicAnalysis && results ? (
          <>
            <Divider />
            <Sec num={next()} title="Method Comparison" desc="Four independent methods compared. Consistent results increase confidence; divergence >10% warrants investigation.">
              {([
                { t: 'Upstream WSEL', k: 'upstreamWsel' as const, d: 2 },
                { t: 'Head Loss (Afflux)', k: 'totalHeadLoss' as const, d: 3 },
                { t: 'Approach Velocity', k: 'approachVelocity' as const, d: 2 },
                { t: 'Froude Number', k: 'froudeApproach' as const, d: 3 },
              ] as const).map(({ t, k, d }) => (
                <View key={t} style={{ marginBottom: 6 }} wrap={false}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 2 }}>{t}</Text>
                  <View style={s.table}>
                    <View style={s.tHead}>
                      <Text style={[s.th, { width: '20%' }]}>Method</Text>
                      {profiles.map((p) => (
                        <Text key={p.name} style={[s.th, { width: `${80 / profiles.length}%`, textAlign: 'right' }]}>{p.name}</Text>
                      ))}
                    </View>
                    {METHODS.map((m, mi) => (
                      <View key={m} style={mi % 2 ? s.tRowAlt : s.tRow}>
                        <Text style={[s.td, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>{METHOD_LABELS[m]}</Text>
                        {results[m].map((r, i) => (
                          <Text key={i} style={[
                            s.tdR, { width: `${80 / profiles.length}%` },
                            r.error ? { color: C.red, fontStyle: 'italic' } : {},
                          ]}>
                            {r.error ? 'ERR' : r[k].toFixed(d)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </Sec>
          </>
        ) : null}

        {/* ── 6. HEC-RAS Comparison ── */}
        {show.hydraulicAnalysis && hasHecRas ? (
          <>
            <Divider />
            <Sec num={next()} title="HEC-RAS Comparison" desc="Validation against HEC-RAS model results. Differences may indicate geometry or coefficient discrepancies.">
              <View style={s.table}>
                <View style={s.tHead} fixed>
                  <Text style={[s.th, { width: '20%' }]}>Profile</Text>
                  <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>HEC-RAS WSEL</Text>
                  <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>Energy WSEL</Text>
                  <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>HEC-RAS h_L</Text>
                  <Text style={[s.th, { width: '20%', textAlign: 'right' }]}>Energy h_L</Text>
                </View>
                {hecRasComparison.map((h, i) => {
                  const energyResult = results?.energy[i];
                  return (
                    <View key={i} style={i % 2 ? s.tRowAlt : s.tRow} wrap={false}>
                      <Text style={[s.td, { width: '20%' }]}>{h.profileName}</Text>
                      <Text style={[s.tdR, { width: '20%' }]}>{h.upstreamWsel?.toFixed(2) ?? '—'}</Text>
                      <Text style={[s.tdR, { width: '20%' }]}>{energyResult && !energyResult.error ? energyResult.upstreamWsel.toFixed(2) : '—'}</Text>
                      <Text style={[s.tdR, { width: '20%' }]}>{h.headLoss?.toFixed(3) ?? '—'}</Text>
                      <Text style={[s.tdR, { width: '20%' }]}>{energyResult && !energyResult.error ? energyResult.totalHeadLoss.toFixed(3) : '—'}</Text>
                    </View>
                  );
                })}
              </View>
            </Sec>
          </>
        ) : null}

        {/* ── 7. Charts ── */}
        {show.overview && results ? (
          <>
            <Divider />
            <Sec num={next()} title="Charts" desc="Visual outputs including 3D simulation, afflux rating curve, and energy grade line diagram.">
              {sceneCapture ? (
                <View style={s.chartWrap} wrap={false}>
                  <Text style={s.chartLabel}>3D Hydraulic Simulation — Isometric View</Text>
                  <View style={s.chartBorder}>
                    <Image src={sceneCapture} style={{ width: CHART_W, height: CHART_W * 0.5 }} />
                  </View>
                </View>
              ) : null}
              <View style={s.chartWrap} wrap={false}>
                <Text style={s.chartLabel}>Head Loss (Afflux) vs Discharge</Text>
                <View style={s.chartBorder}>
                  <PdfLineChart
                    series={buildAffluxSeries(results, profiles)}
                    hecRasPoints={hasHecRas ? buildHecRasAffluxPoints(hecRasComparison, profiles) : undefined}
                    width={CHART_W}
                    height={CHART_H}
                    xLabel="Discharge (Q)"
                    yLabel="Head Loss"
                  />
                </View>
              </View>
              <View style={s.chartWrap} wrap={false}>
                <Text style={s.chartLabel}>Upstream WSEL vs Discharge</Text>
                <View style={s.chartBorder}>
                  <PdfLineChart
                    series={buildWselSeries(results, profiles)}
                    hecRasPoints={hasHecRas ? buildHecRasWselPoints(hecRasComparison, profiles) : undefined}
                    width={CHART_W}
                    height={CHART_H}
                    xLabel="Discharge (Q)"
                    yLabel="US WSEL"
                  />
                </View>
              </View>

              {/* Energy Grade Diagram — use first profile's energy result */}
              {(() => {
                const energyR = results.energy[0];
                if (!energyR || energyR.error) return null;
                const hydProfile = buildHydraulicProfile(crossSection, bridge, profiles[0], energyR);
                return (
                  <View style={s.chartWrap} wrap={false}>
                    <Text style={s.chartLabel}>Energy Grade Line Diagram — {profiles[0].name}</Text>
                    <View style={s.chartBorder}>
                      <PdfEnergyGradeDiagram profile={hydProfile} width={CHART_W} height={280} />
                    </View>
                  </View>
                );
              })()}

              {/* Momentum Force Diagram — use first profile's momentum result */}
              {(() => {
                const momR = results.momentum[0];
                if (!momR || momR.error || momR.calculationSteps.length < 4) return null;
                return (
                  <View style={s.chartWrap} wrap={false}>
                    <Text style={s.chartLabel}>Momentum Force Balance — {profiles[0].name}</Text>
                    <Text style={s.sectionDesc}>Horizontal force components acting on the control volume. Driving forces (→) push upstream WSEL higher; resisting forces (←) oppose it.</Text>
                    <View style={s.chartBorder}>
                      <PdfForceDiagram momentumResult={momR} profileName={profiles[0].name} width={CHART_W} height={150} />
                    </View>
                  </View>
                );
              })()}
            </Sec>
          </>
        ) : null}

        {/* ── 8. AI Analysis ── */}
        {show.hydraulicAnalysis && aiSummary ? (
          <>
            <Divider />
            <Sec num={next()} title="AI Analysis" desc="Automated peer review of inputs and results. Supplementary only — engineering judgement takes precedence.">
              <Text style={s.subTitle}>Key Findings</Text>
              {aiSummary.overall.map((item, i) => <Bullet key={i} text={item} color="#374151" />)}

              {Array.isArray(aiSummary.recommendations) && aiSummary.recommendations.length > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={s.subTitle}>Recommendations</Text>
                  {aiSummary.recommendations.map((item, i) => <Bullet key={i} text={`${i + 1}. ${item}`} color="#b45309" />)}
                </View>
              ) : null}

              {aiSummary.callouts.geometry ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Input Geometry</Text>
                  {aiSummary.callouts.geometry.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.coefficients ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Coefficients</Text>
                  {aiSummary.callouts.coefficients.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.regime ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Flow Regime</Text>
                  {aiSummary.callouts.regime.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.comparison ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Method Comparison</Text>
                  {aiSummary.callouts.comparison.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.afflux ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Afflux Trends</Text>
                  {aiSummary.callouts.afflux.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.freeboard ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>Freeboard</Text>
                  {aiSummary.callouts.freeboard.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              {aiSummary.callouts.hecras ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.subTitle, { fontSize: 8 }]}>HEC-RAS Comparison</Text>
                  {aiSummary.callouts.hecras.map((item, i) => <Bullet key={i} text={item} />)}
                </View>
              ) : null}

              <Text style={{ fontSize: 6, color: C.textMuted, fontStyle: 'italic', marginTop: 10 }}>
                Generated by AI. For reference only — does not constitute engineering advice.
              </Text>
            </Sec>
          </>
        ) : null}

        {/* ── 9. Scour Assessment ── */}
        {show.scour && scourResults && scourResults.length > 0 && scourInputs ? (
          <>
            <Divider />
            <Sec num={next()} title="Scour Assessment" desc="Pier and contraction scour estimates per HEC-18 methodology.">
              <Text style={s.subTitle}>Scour Inputs</Text>
              <View style={s.kvGrid}>
                <KV label="Bed Material" value={BED_MATERIAL_LABELS[scourInputs.bedMaterial] || scourInputs.bedMaterial} />
                <KV label="D50" value={`${scourInputs.d50} mm`} />
                <KV label="D95" value={`${scourInputs.d95} mm`} />
                <KV label="Countermeasure" value={scourInputs.countermeasure === 'none' ? 'None' : scourInputs.countermeasure} />
              </View>

              {scourResults.map((sr) => (
                <View key={sr.profileName} style={{ marginTop: 6 }}>
                  <Text style={s.subTitle}>{sr.profileName}</Text>

                  {sr.pierScour.length > 0 ? (
                    <>
                      <Text style={s.subDesc}>Pier Scour</Text>
                      <DataTable
                        columns={[
                          { header: 'Pier #', width: '12%', align: 'right', render: (r) => String((r.pierIndex as number) + 1) },
                          { header: 'Width', width: '12%', align: 'right', render: (r) => (r.width as number).toFixed(2) },
                          { header: 'K1', width: '12%', align: 'right', render: (r) => (r.k1 as number).toFixed(3) },
                          { header: 'K2', width: '12%', align: 'right', render: (r) => (r.k2 as number).toFixed(3) },
                          { header: 'K3', width: '12%', align: 'right', render: (r) => (r.k3 as number).toFixed(3) },
                          { header: 'Scour Depth', width: '18%', align: 'right', render: (r) => (r.scourDepth as number).toFixed(2) },
                          { header: 'Crit. Bed El.', width: '22%', align: 'right', render: (r) => (r.criticalBedElevation as number).toFixed(2) },
                        ]}
                        data={sr.pierScour as unknown as Record<string, unknown>[]}
                      />
                    </>
                  ) : null}

                  <Text style={[s.subDesc, { marginTop: 3 }]}>Contraction Scour</Text>
                  <View style={s.kvGrid}>
                    <KV label="Type" value={sr.contractionScour.type === 'live-bed' ? 'Live-Bed' : 'Clear-Water'} />
                    <KV label="Critical V" value={sr.contractionScour.criticalVelocity.toFixed(2)} />
                    <KV label="Approach V" value={sr.contractionScour.approachVelocity.toFixed(2)} />
                    <KV label="Scour Depth" value={sr.contractionScour.scourDepth.toFixed(2)} />
                  </View>

                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 2 }}>
                    Total Worst-Case Scour: {sr.totalWorstCase.toFixed(2)} m
                  </Text>
                </View>
              ))}
            </Sec>
          </>
        ) : null}

        {/* ── 10. Bridge Adequacy Assessment ── */}
        {show.adequacy && adequacyResults ? (
          <>
            <Divider />
            <Sec num={next()} title="Bridge Adequacy Assessment" desc="Combined assessment of hydraulic adequacy including freeboard, pressure, and overtopping thresholds.">
              <View style={{
                backgroundColor: adequacyResults.verdictSeverity === 'pass' ? '#dcfce7' : adequacyResults.verdictSeverity === 'warning' ? '#fef9c3' : '#fee2e2',
                padding: 6,
                borderRadius: 2,
                marginBottom: 6,
              }}>
                <Text style={{
                  fontSize: 9,
                  fontFamily: 'Helvetica-Bold',
                  color: adequacyResults.verdictSeverity === 'pass' ? C.green : adequacyResults.verdictSeverity === 'warning' ? C.amber : C.red,
                }}>
                  {adequacyResults.verdict}
                </Text>
              </View>

              <Text style={s.subTitle}>Critical Thresholds</Text>
              <View style={s.kvGrid}>
                <KV label="Pressure Onset Q" value={adequacyResults.pressureOnsetQ != null ? adequacyResults.pressureOnsetQ.toFixed(0) : 'N/A'} />
                <KV label="Overtopping Onset Q" value={adequacyResults.overtoppingOnsetQ != null ? adequacyResults.overtoppingOnsetQ.toFixed(0) : 'N/A'} />
                <KV label="Zero Freeboard Q" value={adequacyResults.zeroFreeboardQ != null ? adequacyResults.zeroFreeboardQ.toFixed(0) : 'N/A'} />
              </View>

              <Text style={s.subTitle}>Freeboard per AEP</Text>
              <DataTable
                columns={[
                  { header: 'Profile', width: '18%', render: (r) => r.profileName as string },
                  { header: 'ARI', width: '12%', render: (r) => (r.ari as string) || '—' },
                  { header: 'Q', width: '12%', align: 'right', render: (r) => (r.discharge as number).toFixed(0) },
                  { header: 'WSEL', width: '14%', align: 'right', render: (r) => (r.worstCaseWsel as number).toFixed(2) },
                  { header: 'Freeboard', width: '14%', align: 'right', render: (r) => (r.freeboard as number).toFixed(2) },
                  { header: 'Regime', width: '14%', render: (r) => (r.regime as string) },
                  {
                    header: 'Status', width: '16%', align: 'center',
                    render: (r) => (r.status as string).toUpperCase(),
                    cellStyle: (r) => ({
                      fontFamily: 'Helvetica-Bold',
                      color: (r.status as string) === 'clear' ? C.green : (r.status as string) === 'low' ? C.amber : C.red,
                    }),
                  },
                ]}
                data={adequacyResults.profiles as unknown as Record<string, unknown>[]}
              />
            </Sec>
          </>
        ) : null}

        {/* ── 11. Regulatory Compliance ── */}
        {show.regulatory && regulatoryChecklist && regulatoryChecklist.length > 0 ? (
          <>
            <Divider />
            <Sec num={next()} title={`Regulatory Compliance — ${JURISDICTION_LABELS[regulatoryJurisdiction || 'tmr'] || regulatoryJurisdiction}`} desc="Checklist of regulatory requirements and their assessment status.">
              {(() => {
                const passed = regulatoryChecklist.filter((c) => c.status === 'pass' || c.status === 'manual-pass').length;
                const failed = regulatoryChecklist.filter((c) => c.status === 'fail' || c.status === 'manual-fail').length;
                const notAssessed = regulatoryChecklist.filter((c) => c.status === 'not-assessed').length;
                return (
                  <View style={[s.kvGrid, { marginBottom: 6 }]}>
                    <KV label="Passed" value={passed} />
                    <KV label="Failed" value={failed} />
                    <KV label="Not Assessed" value={notAssessed} />
                  </View>
                );
              })()}
              <DataTable
                columns={[
                  { header: 'Requirement', width: '65%', render: (r) => r.requirement as string },
                  { header: 'Auto', width: '10%', align: 'center', render: (r) => (r.autoCheck as boolean) ? 'Yes' : 'No' },
                  {
                    header: 'Status', width: '25%', align: 'center',
                    render: (r) => {
                      const st = r.status as string;
                      return st === 'pass' ? 'PASS' : st === 'manual-pass' ? 'PASS (M)' : st === 'fail' ? 'FAIL' : st === 'manual-fail' ? 'FAIL (M)' : 'N/A';
                    },
                    cellStyle: (r) => {
                      const st = r.status as string;
                      const isPassing = st === 'pass' || st === 'manual-pass';
                      const isFailing = st === 'fail' || st === 'manual-fail';
                      return {
                        fontFamily: 'Helvetica-Bold',
                        color: isPassing ? C.green : isFailing ? C.red : C.textMuted,
                      };
                    },
                  },
                ]}
                data={regulatoryChecklist as unknown as Record<string, unknown>[]}
              />
            </Sec>
          </>
        ) : null}

        {/* ── 12. AI Narrative Sections ── */}
        {show.narrative && narrativeSections && narrativeSections.filter((ns) => ns.content).length > 0 ? (
          <>
            {narrativeSections.filter((ns) => ns.content).map((ns) => (
              <View key={ns.id}>
                <Divider />
                <Sec num={next()} title={ns.title} desc={ns.description || undefined}>
                  {ns.content.split('\n\n').map((para, pi) => (
                    <Text key={pi} style={{ fontSize: 8, color: C.textLight, marginBottom: 4, lineHeight: 1.5 }}>
                      {parseMarkdown(para)}
                    </Text>
                  ))}
                </Sec>
              </View>
            ))}
          </>
        ) : null}

      </Page>
    </Document>
  );
}

/* ─── Public API ─── */

export async function generatePdf(data: PdfReportData): Promise<void> {
  const blob = await pdf(<ReportDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (data.projectName || 'bridge-loss-report').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── CSV Export Helpers ─── */

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCrossSectionCsv(crossSection: CrossSectionPoint[], projectName?: string): void {
  const header = 'Station,Elevation,Manning_N,Bank_Station';
  const rows = crossSection.map((p) =>
    `${p.station},${p.elevation},${p.manningsN},${p.bankStation || ''}`
  );
  const csv = [header, ...rows].join('\n');
  const safeName = (projectName || 'cross-section').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  downloadCsv(csv, `${safeName}-cross-section.csv`);
}

const CSV_METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
const CSV_METHOD_LABELS: Record<string, string> = { energy: 'Energy', momentum: 'Momentum', yarnell: 'Yarnell', wspro: 'WSPRO' };

export function exportResultsCsv(results: CalculationResults, profiles: FlowProfile[], projectName?: string): void {
  const header = 'Profile,Method,US_WSEL,Head_Loss,Approach_V,Bridge_V,Froude_Approach,Froude_Bridge,Regime,Converged,Error';
  const rows: string[] = [];
  for (const method of CSV_METHODS) {
    for (const r of results[method]) {
      rows.push([
        r.profileName,
        CSV_METHOD_LABELS[method],
        r.error ? '' : r.upstreamWsel.toFixed(3),
        r.error ? '' : r.totalHeadLoss.toFixed(4),
        r.error ? '' : r.approachVelocity.toFixed(3),
        r.error ? '' : r.bridgeVelocity.toFixed(3),
        r.error ? '' : r.froudeApproach.toFixed(4),
        r.error ? '' : r.froudeBridge.toFixed(4),
        r.flowRegime,
        r.converged ? 'Y' : 'N',
        r.error || '',
      ].join(','));
    }
  }
  const csv = [header, ...rows].join('\n');
  const safeName = (projectName || 'results').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  downloadCsv(csv, `${safeName}-results.csv`);
}
