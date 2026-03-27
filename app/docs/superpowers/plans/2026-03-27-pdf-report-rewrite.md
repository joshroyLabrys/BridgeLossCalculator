# PDF Report Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile `window.print()` PDF report with a deterministic `@react-pdf/renderer` implementation that downloads a professional engineering PDF.

**Architecture:** A single `pdf-report.tsx` module exports a `generatePdf()` function that captures chart SVGs from the DOM, converts them to PNG data URLs, renders a react-pdf `<Document>` with all store data, and triggers a browser download. A small `pdf-chart-capture.ts` utility handles SVG→PNG conversion. The old `print-report.tsx`, `print-styles.ts`, and all `@media print` infrastructure are deleted.

**Tech Stack:** `@react-pdf/renderer`, React, TypeScript, Zustand (existing store)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/pdf-report.tsx` | CREATE | react-pdf Document component + `generatePdf()` entry point |
| `src/components/pdf-chart-capture.ts` | CREATE | SVG→PNG data URL conversion utility |
| `src/components/print-report.tsx` | DELETE | Old browser-print report |
| `src/app/print-styles.ts` | DELETE | Old @media print CSS |
| `src/app/layout.tsx` | MODIFY | Remove print style injection |
| `src/app/page.tsx` | MODIFY | Remove `<PrintReport />` rendering |
| `src/components/main-tabs.tsx` | MODIFY | Replace `window.print()` with `generatePdf()` |
| `src/components/cross-section-chart.tsx` | MODIFY | Add `data-chart-id` attribute for capture |
| `src/components/summary/afflux-charts.tsx` | MODIFY | Add `data-chart-id` attributes for capture |

---

### Task 1: Install @react-pdf/renderer

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run:
```bash
cd app && npm install @react-pdf/renderer
```
Expected: Package installs successfully, added to dependencies in package.json.

- [ ] **Step 2: Verify it resolves**

Run:
```bash
cd app && node -e "require('@react-pdf/renderer'); console.log('OK')"
```
Expected: Prints `OK` with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: install @react-pdf/renderer for PDF generation"
```

---

### Task 2: Create SVG→PNG chart capture utility

**Files:**
- Create: `src/components/pdf-chart-capture.ts`

- [ ] **Step 1: Create the chart capture module**

```typescript
// src/components/pdf-chart-capture.ts

export interface CapturedChart {
  id: string;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Find all SVG charts in the DOM by data-chart-id attribute,
 * render each to an offscreen canvas at 2x resolution, and
 * return PNG data URLs.
 */
export async function captureCharts(): Promise<CapturedChart[]> {
  const containers = document.querySelectorAll<HTMLElement>('[data-chart-id]');
  const results: CapturedChart[] = [];

  for (const container of containers) {
    const svg = container.querySelector('svg');
    if (!svg) continue;

    const id = container.getAttribute('data-chart-id') || 'chart';
    // Find label from nearest card title
    const card = container.closest('[class*="CardContent"]')?.parentElement;
    const titleEl = card?.querySelector('[class*="CardTitle"]');
    const label = titleEl?.textContent || id;

    const dataUrl = await svgToDataUrl(svg, 2);
    results.push({
      id,
      label,
      dataUrl,
      width: svg.clientWidth || 600,
      height: svg.clientHeight || 300,
    });
  }

  return results;
}

/**
 * Convert an SVG element to a PNG data URL via offscreen canvas.
 * @param scale - Device pixel ratio multiplier (2 = retina quality)
 */
function svgToDataUrl(svg: SVGSVGElement, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = svg.clientWidth || 600;
    const h = svg.clientHeight || 300;

    // Clone the SVG and inline computed styles for foreign rendering
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Inline all computed styles on the clone so the exported image
    // looks identical to what's on screen (the <img> won't have
    // access to the page's stylesheets).
    inlineStyles(svg, clone);

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to rasterize chart: ${svg.getAttribute('data-chart-id') || 'unknown'}`));
    };
    img.src = url;
  });
}

/**
 * Recursively copy computed styles from a live SVG tree onto a cloned SVG tree.
 * Only copies properties that differ from the browser default so the serialized
 * SVG string stays reasonably small.
 */
function inlineStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);
  const important = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray',
    'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor',
    'dominant-baseline', 'visibility', 'display'];
  for (const prop of important) {
    const val = computed.getPropertyValue(prop);
    if (val) (target as SVGElement).style.setProperty(prop, val);
  }
  for (let i = 0; i < source.children.length; i++) {
    if (target.children[i]) {
      inlineStyles(source.children[i], target.children[i]);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/pdf-chart-capture.ts
git commit -m "feat: add SVG-to-PNG chart capture utility for PDF export"
```

---

### Task 3: Add data-chart-id attributes to chart components

**Files:**
- Modify: `src/components/cross-section-chart.tsx`
- Modify: `src/components/summary/afflux-charts.tsx`

- [ ] **Step 1: Add data-chart-id to cross-section chart**

In `src/components/cross-section-chart.tsx`, find the outermost `<div>` that wraps the SVG (the container with the `ref` for D3). Add `data-chart-id="cross-section"` to it.

Look for the container div that holds the `<svg>` element rendered by D3. It will have a `ref` attribute. Add the data attribute to that div.

- [ ] **Step 2: Add data-chart-id to afflux charts**

In `src/components/summary/afflux-charts.tsx`, find the two SVG container divs (one for afflux rating curve, one for WSEL chart). Add:
- `data-chart-id="afflux-rating"` to the afflux rating curve container
- `data-chart-id="wsel-trend"` to the WSEL chart container

Look for the container divs that hold `<svg>` elements rendered by D3. They will have `ref` attributes.

- [ ] **Step 3: Verify attributes render**

Run the dev server (`npm run dev`), open the app, navigate to the Summary tab with results loaded. Open browser DevTools and run:
```javascript
document.querySelectorAll('[data-chart-id]').length
```
Expected: Returns 3 (or 2 if cross-section is on a different tab).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/cross-section-chart.tsx app/src/components/summary/afflux-charts.tsx
git commit -m "feat: add data-chart-id attributes to chart containers for PDF capture"
```

---

### Task 4: Create the react-pdf Document component

This is the main task. Create the full PDF report using `@react-pdf/renderer`.

**Files:**
- Create: `src/components/pdf-report.tsx`

- [ ] **Step 1: Create the PDF report module with styles and page template**

Create `src/components/pdf-report.tsx` with the following structure. This is a large file — the full content is below.

```typescript
// src/components/pdf-report.tsx
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
  FreeboardSummary,
} from '@/engine/types';
import type { AiSummaryResponse } from '@/lib/api/ai-summary-prompt';
import { captureCharts, CapturedChart } from './pdf-chart-capture';

/* ─── Constants ─── */

const METHODS = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
const METHOD_LABELS: Record<string, string> = {
  energy: 'Energy',
  momentum: 'Momentum',
  yarnell: 'Yarnell',
  wspro: 'WSPRO',
};

const COLORS = {
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
};

/* ─── Styles ─── */

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.text,
  },
  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
    marginBottom: 12,
  },
  pageHeaderTitle: { fontSize: 8, color: COLORS.textMuted, fontFamily: 'Helvetica', letterSpacing: 0.5 },
  pageHeaderSection: { fontSize: 8, color: COLORS.textLight, fontFamily: 'Helvetica-Bold' },
  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 25,
    left: 42,
    right: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderLight,
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: COLORS.textMuted },
  // Cover
  coverCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverRule: { width: 60, height: 2, backgroundColor: COLORS.primary, marginBottom: 24 },
  coverTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: COLORS.text, textAlign: 'center' },
  coverSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 4, textAlign: 'center' },
  coverRuleBottom: { width: 60, height: 2, backgroundColor: COLORS.primary, marginTop: 24, marginBottom: 16 },
  coverDate: { fontSize: 10, color: COLORS.textMuted },
  // Sections
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 2 },
  sectionDesc: { fontSize: 8, color: COLORS.textMuted, marginBottom: 8, maxWidth: 400 },
  subTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 8, marginBottom: 4 },
  subDesc: { fontSize: 7, color: COLORS.textMuted, marginBottom: 4 },
  // Grids (key-value pairs)
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  kvItem: { width: '33%', flexDirection: 'row', marginBottom: 2 },
  kvLabel: { fontSize: 8, color: COLORS.textLight },
  kvValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginLeft: 3 },
  // Tables
  table: { borderWidth: 0.5, borderColor: COLORS.border, marginBottom: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: COLORS.border, backgroundColor: '#f9fafb' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 3, paddingHorizontal: 4 },
  td: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 4 },
  tdRight: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 4, textAlign: 'right' },
  // Chart image
  chartContainer: { marginBottom: 10 },
  chartLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 4 },
  chartImage: { width: '100%', objectFit: 'contain' },
  chartBorder: { borderWidth: 0.5, borderColor: COLORS.border, borderRadius: 2, overflow: 'hidden', backgroundColor: COLORS.white },
  // AI section
  bulletItem: { flexDirection: 'row', marginBottom: 2, paddingRight: 16 },
  bulletDot: { fontSize: 8, color: COLORS.textMuted, marginRight: 4, width: 8 },
  bulletText: { fontSize: 8, color: COLORS.textLight, flex: 1 },
});

/* ─── Helper Components ─── */

function PageHeader({ section, reportTitle }: { section: string; reportTitle: string }) {
  return (
    <View style={s.pageHeader} fixed>
      <Text style={s.pageHeaderTitle}>{reportTitle.toUpperCase()}</Text>
      <Text style={s.pageHeaderSection}>{section}</Text>
    </View>
  );
}

function PageFooter({ date }: { date: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text style={s.footerText}>Generated by Bridge Loss Calculator · QA verification only</Text>
      <Text style={s.footerText} render={({ pageNumber }) => `${date} · Page ${pageNumber}`} />
    </View>
  );
}

function SectionTitle({ number, title }: { number: number; title: string }) {
  return <Text style={s.sectionTitle}>{number}. {title}</Text>;
}

function SectionDesc({ children }: { children: string }) {
  return <Text style={s.sectionDesc}>{children}</Text>;
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.kvItem}>
      <Text style={s.kvLabel}>{label}:</Text>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  );
}

function Bullet({ text, color }: { text: string; color?: string }) {
  return (
    <View style={s.bulletItem} wrap={false}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={[s.bulletText, color ? { color } : {}]}>{text}</Text>
    </View>
  );
}

/* ─── Table helpers ─── */

interface Column {
  header: string;
  width: string | number;
  align?: 'left' | 'right' | 'center';
  render: (row: Record<string, unknown>, rowIndex: number) => string;
  /** Optional per-cell style function */
  cellStyle?: (row: Record<string, unknown>) => object | undefined;
}

function DataTable({ columns, data }: { columns: Column[]; data: Record<string, unknown>[] }) {
  return (
    <View style={s.table}>
      {/* Header */}
      <View style={s.tableHeader} fixed>
        {columns.map((col, ci) => (
          <Text key={ci} style={[s.th, { width: col.width, textAlign: col.align || 'left' }]}>
            {col.header}
          </Text>
        ))}
      </View>
      {/* Rows */}
      {data.map((row, ri) => (
        <View key={ri} style={ri % 2 ? s.tableRowAlt : s.tableRow} wrap={false}>
          {columns.map((col, ci) => (
            <Text key={ci} style={[
              col.align === 'right' ? s.tdRight : s.td,
              { width: col.width, textAlign: col.align || 'left' },
              col.cellStyle?.(row) || {},
            ]}>
              {col.render(row, ri)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/* ─── Report data interface ─── */

export interface PdfReportData {
  projectName: string;
  crossSection: CrossSectionPoint[];
  bridge: BridgeGeometry;
  profiles: FlowProfile[];
  coefficients: Coefficients;
  results: CalculationResults | null;
  aiSummary: AiSummaryResponse | null;
  charts: CapturedChart[];
}

/* ─── Document ─── */

function ReportDocument({ data }: { data: PdfReportData }) {
  const { projectName, crossSection, bridge, profiles, coefficients, results, aiSummary, charts } = data;
  const date = new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = projectName || 'Bridge Hydraulic Loss Assessment';
  const freeboard = results ? computeFreeboard(results, bridge, profiles, coefficients.freeboardThreshold) : null;

  let sectionNum = 0;
  const nextSection = () => ++sectionNum;

  return (
    <Document title={`${title} - Report`} author="Bridge Loss Calculator">
      {/* ═══ PAGE: Cover ═══ */}
      <Page size="A4" style={[s.page, { paddingTop: 0, paddingBottom: 0 }]}>
        <View style={s.coverCenter}>
          <View style={s.coverRule} />
          <Text style={s.coverTitle}>Bridge Hydraulic Loss Assessment</Text>
          {projectName ? <Text style={s.coverSubtitle}>{projectName}</Text> : null}
          <View style={s.coverRuleBottom} />
          <Text style={s.coverDate}>{date}</Text>
        </View>
      </Page>

      {/* ═══ PAGE: Input Summary ═══ */}
      <Page size="A4" style={s.page}>
        <PageHeader section="Input Summary" reportTitle={title} />
        <SectionTitle number={nextSection()} title="Input Summary" />
        <SectionDesc>Summary of bridge geometry, coefficients, and flow profiles used as inputs.</SectionDesc>

        {/* Bridge Geometry */}
        <Text style={s.subTitle}>Bridge Geometry</Text>
        <Text style={s.subDesc}>Structural dimensions of the bridge opening.</Text>
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

        {/* Coefficients */}
        <Text style={s.subTitle}>Coefficients</Text>
        <Text style={s.subDesc}>Loss coefficients and adjustment factors applied to all methods.</Text>
        <View style={s.kvGrid}>
          <KV label="Contraction Coeff" value={coefficients.contractionCoeff} />
          <KV label="Expansion Coeff" value={coefficients.expansionCoeff} />
          {coefficients.yarnellK !== null ? <KV label="Yarnell K" value={coefficients.yarnellK} /> : null}
          <KV label="Max Iterations" value={coefficients.maxIterations} />
          <KV label="Tolerance" value={coefficients.tolerance} />
          {coefficients.debrisBlockagePct > 0 ? <KV label="Debris Blockage" value={`${coefficients.debrisBlockagePct}%`} /> : null}
          {coefficients.manningsNSensitivityPct !== null && coefficients.manningsNSensitivityPct > 0
            ? <KV label="Manning's n Sensitivity" value={`±${coefficients.manningsNSensitivityPct}%`} />
            : null}
        </View>

        {/* Flow Profiles */}
        <Text style={s.subTitle}>Flow Profiles</Text>
        <Text style={s.subDesc}>Design flow scenarios with downstream boundary conditions.</Text>
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

        {/* Cross-section chart (if captured) */}
        {charts.find((c) => c.id === 'cross-section') ? (
          <View style={s.chartContainer}>
            <Text style={s.chartLabel}>Cross-Section Profile</Text>
            <View style={s.chartBorder}>
              <Image style={s.chartImage} src={charts.find((c) => c.id === 'cross-section')!.dataUrl} />
            </View>
          </View>
        ) : null}

        <PageFooter date={date} />
      </Page>

      {/* ═══ PAGE(s): Cross-Section Data ═══ */}
      <Page size="A4" style={s.page} wrap>
        <PageHeader section="Cross-Section Data" reportTitle={title} />
        <SectionTitle number={nextSection()} title="Cross-Section Data" />
        <SectionDesc>
          {`Surveyed channel stations, elevations, and roughness coefficients (${crossSection.length} points).`}
        </SectionDesc>
        <DataTable
          columns={[
            { header: 'Station', width: '25%', align: 'right', render: (r) => (r.station as number).toFixed(1) },
            { header: 'Elevation', width: '25%', align: 'right', render: (r) => (r.elevation as number).toFixed(2) },
            { header: "Manning's n", width: '25%', align: 'right', render: (r) => String(r.manningsN) },
            { header: 'Bank', width: '25%', render: (r) => (r.bankStation as string) || '—' },
          ]}
          data={crossSection as unknown as Record<string, unknown>[]}
        />
        <PageFooter date={date} />
      </Page>

      {/* ═══ PAGE: Freeboard & Flow Regime ═══ */}
      {results && freeboard ? (
        <Page size="A4" style={s.page}>
          <PageHeader section="Results" reportTitle={title} />
          <SectionTitle number={nextSection()} title="Freeboard Check" />
          <SectionDesc>
            Clearance between computed upstream WSEL (worst across methods) and bridge low chord. Positive = clearance below deck. Negative = pressure flow or overtopping.
          </SectionDesc>

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
                cellStyle: (r) => {
                  const st = r.status as string;
                  return {
                    fontFamily: 'Helvetica-Bold',
                    color: st === 'clear' ? COLORS.green : st === 'low' ? COLORS.amber : COLORS.red,
                  };
                },
              },
            ]}
            data={freeboard.profiles as unknown as Record<string, unknown>[]}
          />

          {freeboard.zeroFreeboardQ !== null ? (
            <Text style={{ fontSize: 7, color: COLORS.textLight, marginBottom: 10 }}>
              Estimated Q at zero freeboard: {freeboard.zeroFreeboardQ.toFixed(0)} (interpolated)
            </Text>
          ) : null}

          {/* Flow Regime */}
          <Text style={[s.sectionTitle, { marginTop: 6 }]}>{nextSection()}. Flow Regime</Text>
          <SectionDesc>
            Classification per method per profile. F = Free Surface, P = Pressure, O = Overtopping. Yarnell is valid for free-surface flow only.
          </SectionDesc>

          <View style={s.table}>
            <View style={s.tableHeader} fixed>
              <Text style={[s.th, { width: '20%' }]}>Method</Text>
              {profiles.map((p) => (
                <Text key={p.name} style={[s.th, { width: `${80 / profiles.length}%`, textAlign: 'center' }]}>
                  {p.name}
                </Text>
              ))}
            </View>
            {METHODS.map((m, mi) => (
              <View key={m} style={mi % 2 ? s.tableRowAlt : s.tableRow} wrap={false}>
                <Text style={[s.td, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>{METHOD_LABELS[m]}</Text>
                {results[m].map((r, i) => {
                  const label = r.flowRegime === 'free-surface' ? 'F' : r.flowRegime === 'pressure' ? 'P' : 'O';
                  const warn = m === 'yarnell' && r.flowRegime !== 'free-surface';
                  return (
                    <Text key={i} style={[
                      s.td,
                      { width: `${80 / profiles.length}%`, textAlign: 'center' },
                      warn ? { color: COLORS.amber, fontFamily: 'Helvetica-Bold' } : {},
                    ]}>
                      {label}{warn ? ' ⚠' : ''}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>

          <PageFooter date={date} />
        </Page>
      ) : null}

      {/* ═══ PAGE: Method Comparison ═══ */}
      {results ? (
        <Page size="A4" style={s.page}>
          <PageHeader section="Method Comparison" reportTitle={title} />
          <SectionTitle number={nextSection()} title="Method Comparison" />
          <SectionDesc>
            Four independent methods compared across flow profiles. Consistent results increase confidence; divergence beyond 10% warrants investigation.
          </SectionDesc>

          {[
            { title: 'Upstream WSEL', desc: 'Water surface elevation immediately upstream of the bridge.', getValue: (r: { upstreamWsel: number; error: string | null }) => r.error ? 'ERR' : r.upstreamWsel.toFixed(2) },
            { title: 'Head Loss (Afflux)', desc: 'Total energy loss caused by the bridge constriction.', getValue: (r: { totalHeadLoss: number; error: string | null }) => r.error ? 'ERR' : r.totalHeadLoss.toFixed(3) },
            { title: 'Approach Velocity', desc: 'Mean velocity in the approach section.', getValue: (r: { approachVelocity: number; error: string | null }) => r.error ? 'ERR' : r.approachVelocity.toFixed(2) },
            { title: 'Froude Number', desc: 'Values above 1.0 indicate supercritical flow.', getValue: (r: { froudeApproach: number; error: string | null }) => r.error ? 'ERR' : r.froudeApproach.toFixed(3) },
          ].map(({ title: t, desc, getValue }) => (
            <View key={t} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 2 }}>{t}</Text>
              <Text style={{ fontSize: 7, color: COLORS.textMuted, marginBottom: 3 }}>{desc}</Text>
              <View style={s.table}>
                <View style={s.tableHeader} fixed>
                  <Text style={[s.th, { width: '20%' }]}>Method</Text>
                  {profiles.map((p) => (
                    <Text key={p.name} style={[s.th, { width: `${80 / profiles.length}%`, textAlign: 'right' }]}>
                      {p.name}
                    </Text>
                  ))}
                </View>
                {METHODS.map((m, mi) => (
                  <View key={m} style={mi % 2 ? s.tableRowAlt : s.tableRow} wrap={false}>
                    <Text style={[s.td, { width: '20%', fontFamily: 'Helvetica-Bold' }]}>{METHOD_LABELS[m]}</Text>
                    {results[m].map((r, i) => (
                      <Text key={i} style={[
                        s.tdRight,
                        { width: `${80 / profiles.length}%` },
                        r.error ? { color: COLORS.red, fontStyle: 'italic' } : {},
                      ]}>
                        {getValue(r as { upstreamWsel: number; totalHeadLoss: number; approachVelocity: number; froudeApproach: number; error: string | null })}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ))}

          <PageFooter date={date} />
        </Page>
      ) : null}

      {/* ═══ PAGE: Charts ═══ */}
      {charts.filter((c) => c.id !== 'cross-section').length > 0 ? (
        <Page size="A4" style={s.page}>
          <PageHeader section="Charts" reportTitle={title} />
          <SectionTitle number={nextSection()} title="Charts" />
          <SectionDesc>Afflux rating curve and upstream WSEL trend captured from the interactive summary view.</SectionDesc>

          {charts.filter((c) => c.id !== 'cross-section').map((chart) => (
            <View key={chart.id} style={s.chartContainer} wrap={false}>
              <Text style={s.chartLabel}>{chart.label}</Text>
              <View style={s.chartBorder}>
                <Image style={s.chartImage} src={chart.dataUrl} />
              </View>
            </View>
          ))}

          <PageFooter date={date} />
        </Page>
      ) : null}

      {/* ═══ PAGE: AI Analysis ═══ */}
      {aiSummary ? (
        <Page size="A4" style={s.page}>
          <PageHeader section="AI Analysis" reportTitle={title} />
          <SectionTitle number={nextSection()} title="AI Analysis" />
          <SectionDesc>Automated review of calculation results by AI. This analysis is supplementary — engineering judgement should always take precedence.</SectionDesc>

          <Text style={s.subTitle}>Summary</Text>
          {aiSummary.overall.map((item, i) => <Bullet key={i} text={item} color="#374151" />)}

          {aiSummary.callouts.regime ? (
            <View style={{ marginTop: 6 }}>
              <Text style={[s.subTitle, { fontSize: 9 }]}>Flow Regime</Text>
              {aiSummary.callouts.regime.map((item, i) => <Bullet key={i} text={item} />)}
            </View>
          ) : null}

          {aiSummary.callouts.freeboard ? (
            <View style={{ marginTop: 6 }}>
              <Text style={[s.subTitle, { fontSize: 9 }]}>Freeboard</Text>
              {aiSummary.callouts.freeboard.map((item, i) => <Bullet key={i} text={item} />)}
            </View>
          ) : null}

          {aiSummary.callouts.comparison ? (
            <View style={{ marginTop: 6 }}>
              <Text style={[s.subTitle, { fontSize: 9 }]}>Method Comparison</Text>
              {aiSummary.callouts.comparison.map((item, i) => <Bullet key={i} text={item} />)}
            </View>
          ) : null}

          {aiSummary.callouts.afflux ? (
            <View style={{ marginTop: 6 }}>
              <Text style={[s.subTitle, { fontSize: 9 }]}>Afflux Trends</Text>
              {aiSummary.callouts.afflux.map((item, i) => <Bullet key={i} text={item} />)}
            </View>
          ) : null}

          {aiSummary.callouts.hecras ? (
            <View style={{ marginTop: 6 }}>
              <Text style={[s.subTitle, { fontSize: 9 }]}>HEC-RAS Comparison</Text>
              {aiSummary.callouts.hecras.map((item, i) => <Bullet key={i} text={item} />)}
            </View>
          ) : null}

          <Text style={{ fontSize: 6, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 16 }}>
            Generated by AI. This analysis is for reference only and does not constitute engineering advice.
          </Text>

          <PageFooter date={date} />
        </Page>
      ) : null}
    </Document>
  );
}

/* ─── Public API ─── */

export async function generatePdf(data: Omit<PdfReportData, 'charts'>): Promise<void> {
  // 1. Capture charts from the live DOM
  const charts = await captureCharts();

  // 2. Build the full data object
  const reportData: PdfReportData = { ...data, charts };

  // 3. Render PDF to blob
  const blob = await pdf(<ReportDocument data={reportData} />).toBlob();

  // 4. Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (data.projectName || 'bridge-loss-report').replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  a.download = `${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/pdf-report.tsx
git commit -m "feat: add react-pdf Document component for PDF report generation"
```

---

### Task 5: Wire up the PDF button and remove old infrastructure

**Files:**
- Modify: `src/components/main-tabs.tsx` (line 139)
- Modify: `src/app/layout.tsx` (lines 4, 17)
- Modify: `src/app/page.tsx` (lines 2, 8)
- Delete: `src/components/print-report.tsx`
- Delete: `src/app/print-styles.ts`

- [ ] **Step 1: Update main-tabs.tsx to use generatePdf**

In `src/components/main-tabs.tsx`:

Add import at the top:
```typescript
import { generatePdf } from '@/components/pdf-report';
```

Add store selectors alongside the existing ones (around line 24-31):
```typescript
const crossSection = useProjectStore((s) => s.crossSection);
const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
const flowProfiles = useProjectStore((s) => s.flowProfiles);
const coefficients = useProjectStore((s) => s.coefficients);
const results = useProjectStore((s) => s.results);
const projectName = useProjectStore((s) => s.projectName);
```

Add a state for loading and handler function:
```typescript
const [pdfLoading, setPdfLoading] = useState(false);

async function handlePdf() {
  setPdfLoading(true);
  try {
    await generatePdf({
      projectName,
      crossSection,
      bridge: bridgeGeometry,
      profiles: flowProfiles,
      coefficients,
      results,
      aiSummary,
    });
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setPdfLoading(false);
  }
}
```

Add `useState` to the React import at line 1.

Replace the PDF button (line 139-142):
```typescript
<Button variant="outline" size="sm" onClick={handlePdf} disabled={pdfLoading}>
  <FileText className="h-4 w-4 mr-1.5" />
  {pdfLoading ? 'Generating…' : 'PDF'}
</Button>
```

- [ ] **Step 2: Remove print style injection from layout.tsx**

In `src/app/layout.tsx`:

Remove line 4:
```typescript
import { printStyles } from './print-styles';
```

Remove line 17:
```typescript
<style dangerouslySetInnerHTML={{ __html: printStyles }} />
```

The final `layout.tsx` should be:
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Bridge Loss Calculator',
  description: 'Independent bridge hydraulic loss calculations for HEC-RAS QA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Remove PrintReport from page.tsx**

In `src/app/page.tsx`:

Remove line 2: `import { PrintReport } from '@/components/print-report';`
Remove line 8: `<PrintReport />`

The final `page.tsx` should be:
```typescript
import { MainTabs } from '@/components/main-tabs';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <MainTabs />
    </div>
  );
}
```

- [ ] **Step 4: Delete old files**

```bash
rm app/src/components/print-report.tsx
rm app/src/app/print-styles.ts
```

- [ ] **Step 5: Verify build**

Run:
```bash
cd app && npm run build
```
Expected: Build succeeds with no errors. No references to deleted files remain.

- [ ] **Step 6: Commit**

```bash
git add -A app/src/components/main-tabs.tsx app/src/app/layout.tsx app/src/app/page.tsx
git rm app/src/components/print-report.tsx app/src/app/print-styles.ts
git commit -m "feat: wire up react-pdf PDF generation, remove old window.print() infrastructure"
```

---

### Task 6: Manual testing and polish

- [ ] **Step 1: Test with no results**

Run `npm run dev`, load the app with no data entered. Click PDF button.
Expected: PDF downloads with cover page + empty input summary. No crash.

- [ ] **Step 2: Test with full data**

Load a project with cross-section data, bridge geometry, flow profiles, and computed results. Navigate to Summary tab so charts render. Click PDF.
Expected:
- Cover page with project name and date
- Input summary with all geometry, coefficients, profiles table, and cross-section chart
- Cross-section data table with all rows (paginated if >40 rows)
- Freeboard check with color-coded status
- Flow regime matrix
- Method comparison with all four sub-tables
- Charts page with afflux and WSEL charts
- AI analysis page (if AI summary was generated)

- [ ] **Step 3: Verify no table row splitting**

Use a project with many cross-section points (50+). Open the downloaded PDF.
Expected: Tables continue on next page with headers repeated. No row is split across a page boundary.

- [ ] **Step 4: Verify chart sizing**

Check that charts fit within the page margins. No horizontal overflow.
Expected: Charts are contained within page width, clear and legible.

- [ ] **Step 5: Final commit with any polish fixes**

```bash
git add -A
git commit -m "fix: polish PDF report layout from manual testing"
```
