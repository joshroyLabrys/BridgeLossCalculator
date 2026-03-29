import type { CrossSectionPoint } from '@/engine/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnMapping {
  station: number;     // column index for station
  elevation: number;   // column index for elevation
  manningsN?: number;  // optional column index for Manning's N
}

// ─── Delimiter detection ─────────────────────────────────────────────────────

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ',';

  // Use first non-empty line (skip header-like lines if there are at least 2 lines)
  const sample = lines.length > 1 ? lines[1] : lines[0];

  // Count occurrences of each delimiter candidate
  const commaCount = (sample.match(/,/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  // Multiple consecutive spaces as a delimiter
  const spaceCount = (sample.match(/\s{2,}/g) || []).length;

  if (tabCount > 0 && tabCount >= commaCount && tabCount >= spaceCount) return '\t';
  if (commaCount > 0 && commaCount >= spaceCount) return ',';
  if (spaceCount > 0) return ' ';

  // Fallback: check if single spaces separate numeric tokens
  const tokens = sample.trim().split(/\s+/);
  if (tokens.length >= 2) return ' ';

  return ',';
}

// ─── Header detection ────────────────────────────────────────────────────────

export function detectHeaders(text: string, delimiter: string): string[] | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const parts = splitByDelimiter(firstLine, delimiter);

  // If any cell in the first row is non-numeric, treat as header row
  const hasNonNumeric = parts.some((p) => {
    const trimmed = p.trim();
    if (trimmed.length === 0) return false;
    return isNaN(Number(trimmed));
  });

  return hasNonNumeric ? parts.map((p) => p.trim()) : null;
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseCsvSurvey(
  text: string,
  mapping: ColumnMapping,
  delimiter: string,
  hasHeader: boolean,
  defaultManningsN: number = 0.035,
): CrossSectionPoint[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const startIdx = hasHeader ? 1 : 0;

  const points: CrossSectionPoint[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parts = splitByDelimiter(lines[i], delimiter);

    const stationStr = parts[mapping.station]?.trim();
    const elevationStr = parts[mapping.elevation]?.trim();

    if (!stationStr || !elevationStr) continue;

    const station = Number(stationStr);
    const elevation = Number(elevationStr);

    if (isNaN(station) || isNaN(elevation)) continue;

    let manningsN = defaultManningsN;
    if (mapping.manningsN !== undefined && mapping.manningsN !== -1) {
      const nStr = parts[mapping.manningsN]?.trim();
      if (nStr) {
        const parsed = Number(nStr);
        if (!isNaN(parsed) && parsed > 0) manningsN = parsed;
      }
    }

    points.push({
      station,
      elevation,
      manningsN,
      bankStation: null,
    });
  }

  // Sort by station ascending
  points.sort((a, b) => a.station - b.station);

  return points;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitByDelimiter(line: string, delimiter: string): string[] {
  if (delimiter === ' ') {
    // Split on one or more whitespace characters
    return line.trim().split(/\s+/);
  }
  return line.split(delimiter);
}
