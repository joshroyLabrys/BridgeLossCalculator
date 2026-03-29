'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

/* ─── Types ─── */

export interface QaqcComparisonRow {
  parameter: string;
  appValue: string;
  hecRasValue: string;
  delta: string;
  pctDelta: number | null;
  rootCause: string | null;
}

export interface QaqcProfileData {
  profileName: string;
  rows: QaqcComparisonRow[];
}

export interface QaqcMemoData {
  projectName: string;
  date: string;
  verdict: string;
  verdictSeverity: 'pass' | 'warning' | 'fail';
  profiles: QaqcProfileData[];
}

/* ─── Colors ─── */

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
  greenBg: '#f0fdf4',
  amberBg: '#fffbeb',
  redBg: '#fef2f2',
};

/* ─── Styles ─── */

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 45,
    paddingHorizontal: 42,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
  },
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

  /* Header */
  titleBlock: { marginBottom: 16 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.text, marginBottom: 4 },
  subtitle: { fontSize: 9, color: C.textLight },
  rule: { borderBottomWidth: 1, borderBottomColor: C.primary, marginTop: 8, marginBottom: 12 },

  /* Verdict */
  verdictBox: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 3,
    marginBottom: 14,
  },
  verdictText: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  /* Profile section */
  profileTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text, marginTop: 10, marginBottom: 4 },

  /* Table */
  table: { borderWidth: 0.5, borderColor: C.border, marginBottom: 4 },
  tHead: { flexDirection: 'row', backgroundColor: C.borderLight, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', paddingVertical: 2.5, paddingHorizontal: 4 },
  td: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 4 },
  tdR: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 4, textAlign: 'right' },

  /* Column widths */
  colParam: { width: '28%' },
  colApp: { width: '18%' },
  colHec: { width: '18%' },
  colDelta: { width: '18%' },
  colPct: { width: '18%' },

  /* Root cause */
  rootCause: { fontSize: 7, color: C.red, paddingLeft: 4, paddingBottom: 2, paddingTop: 1 },
});

/* ─── Helpers ─── */

function verdictStyle(severity: 'pass' | 'warning' | 'fail') {
  if (severity === 'pass') return { backgroundColor: C.greenBg, color: C.green };
  if (severity === 'warning') return { backgroundColor: C.amberBg, color: C.amber };
  return { backgroundColor: C.redBg, color: C.red };
}

function pctColor(pct: number | null): string {
  if (pct === null) return C.textMuted;
  const abs = Math.abs(pct);
  if (abs < 5) return C.green;
  if (abs < 10) return C.amber;
  return C.red;
}

/* ─── Document ─── */

export function QaqcMemoPdf({ data }: { data: QaqcMemoData }) {
  const vs = verdictStyle(data.verdictSeverity);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.titleBlock}>
          <Text style={s.title}>QA/QC Comparison Memo</Text>
          <Text style={s.subtitle}>
            {data.projectName || 'Untitled Project'} &mdash; {data.date}
          </Text>
          <View style={s.rule} />
        </View>

        {/* Verdict */}
        <View style={[s.verdictBox, { backgroundColor: vs.backgroundColor }]}>
          <Text style={[s.verdictText, { color: vs.color }]}>{data.verdict}</Text>
        </View>

        {/* Per-profile tables */}
        {data.profiles.map((profile) => (
          <View key={profile.profileName} wrap={false}>
            <Text style={s.profileTitle}>{profile.profileName}</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.th, s.colParam]}>Parameter</Text>
                <Text style={[s.th, s.colApp, { textAlign: 'right' }]}>This App</Text>
                <Text style={[s.th, s.colHec, { textAlign: 'right' }]}>HEC-RAS</Text>
                <Text style={[s.th, s.colDelta, { textAlign: 'right' }]}>Delta</Text>
                <Text style={[s.th, s.colPct, { textAlign: 'right' }]}>% Diff</Text>
              </View>
              {profile.rows.map((row, i) => (
                <View key={row.parameter}>
                  <View style={[i % 2 === 0 ? s.tRow : s.tRow]}>
                    <Text style={[s.td, s.colParam]}>{row.parameter}</Text>
                    <Text style={[s.tdR, s.colApp]}>{row.appValue}</Text>
                    <Text style={[s.tdR, s.colHec]}>{row.hecRasValue}</Text>
                    <Text style={[s.tdR, s.colDelta]}>{row.delta}</Text>
                    <Text style={[s.tdR, s.colPct, { color: pctColor(row.pctDelta) }]}>
                      {row.pctDelta !== null ? `${row.pctDelta.toFixed(1)}%` : '\u2014'}
                    </Text>
                  </View>
                  {row.rootCause && (
                    <Text style={s.rootCause}>{'\u26A0'} {row.rootCause}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={s.pageFooter} fixed>
          <Text style={s.footerText}>Generated by Bridge Loss Calculator &middot; QA verification only</Text>
          <Text style={s.footerText}>{data.date}</Text>
        </View>
      </Page>
    </Document>
  );
}
