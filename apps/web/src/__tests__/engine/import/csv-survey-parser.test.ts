import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  detectHeaders,
  parseCsvSurvey,
  type ColumnMapping,
} from '@flowsuite/engine/import/csv-survey-parser';

describe('detectDelimiter', () => {
  it('detects comma delimiter', () => {
    const text = 'station,elevation,n\n0,100,0.03\n10,98,0.03';
    expect(detectDelimiter(text)).toBe(',');
  });

  it('detects tab delimiter', () => {
    const text = 'station\televation\tn\n0\t100\t0.03\n10\t98\t0.03';
    expect(detectDelimiter(text)).toBe('\t');
  });

  it('detects space delimiter', () => {
    const text = '0   100   0.03\n10   98   0.03';
    expect(detectDelimiter(text)).toBe(' ');
  });

  it('returns comma as fallback for single-column data', () => {
    const text = '100\n200\n300';
    // single values per line; fallback logic
    const delim = detectDelimiter(text);
    expect([',', ' ']).toContain(delim);
  });
});

describe('detectHeaders', () => {
  it('returns headers when first row contains non-numeric values', () => {
    const text = 'Station,Elevation,ManningsN\n0,100,0.03';
    const headers = detectHeaders(text, ',');
    expect(headers).toEqual(['Station', 'Elevation', 'ManningsN']);
  });

  it('returns null when first row is all numeric', () => {
    const text = '0,100,0.03\n10,98,0.03';
    const headers = detectHeaders(text, ',');
    expect(headers).toBeNull();
  });

  it('detects headers with tab delimiter', () => {
    const text = 'Sta\tElev\n0\t100';
    const headers = detectHeaders(text, '\t');
    expect(headers).toEqual(['Sta', 'Elev']);
  });

  it('returns null for empty text', () => {
    expect(detectHeaders('', ',')).toBeNull();
  });
});

describe('parseCsvSurvey', () => {
  const defaultMapping: ColumnMapping = { station: 0, elevation: 1 };

  it('parses comma-delimited data with header', () => {
    const text = 'Station,Elevation\n0,100\n10,98\n20,95';
    const points = parseCsvSurvey(text, defaultMapping, ',', true);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({
      station: 0,
      elevation: 100,
      manningsN: 0.035,
      bankStation: null,
    });
  });

  it('parses tab-delimited data without header', () => {
    const text = '0\t100\n10\t98\n20\t95';
    const points = parseCsvSurvey(text, defaultMapping, '\t', false);
    expect(points).toHaveLength(3);
    expect(points[1].station).toBe(10);
    expect(points[1].elevation).toBe(98);
  });

  it('parses space-delimited data', () => {
    const text = '0   100\n10   98\n20   95';
    const points = parseCsvSurvey(text, defaultMapping, ' ', false);
    expect(points).toHaveLength(3);
    expect(points[2].station).toBe(20);
    expect(points[2].elevation).toBe(95);
  });

  it('sorts output by station ascending', () => {
    const text = '20,95\n0,100\n10,98';
    const points = parseCsvSurvey(text, defaultMapping, ',', false);
    expect(points.map((p) => p.station)).toEqual([0, 10, 20]);
  });

  it('applies default Manning N when no column is mapped', () => {
    const text = '0,100\n10,98';
    const points = parseCsvSurvey(text, defaultMapping, ',', false, 0.04);
    expect(points[0].manningsN).toBe(0.04);
    expect(points[1].manningsN).toBe(0.04);
  });

  it('reads Manning N from mapped column', () => {
    const text = 'Station,Elevation,N\n0,100,0.025\n10,98,0.05';
    const mapping: ColumnMapping = { station: 0, elevation: 1, manningsN: 2 };
    const points = parseCsvSurvey(text, mapping, ',', true);
    expect(points[0].manningsN).toBe(0.025);
    expect(points[1].manningsN).toBe(0.05);
  });

  it('uses default N when mapped column has invalid data', () => {
    const text = '0,100,abc\n10,98,';
    const mapping: ColumnMapping = { station: 0, elevation: 1, manningsN: 2 };
    const points = parseCsvSurvey(text, mapping, ',', false, 0.035);
    expect(points[0].manningsN).toBe(0.035);
    expect(points[1].manningsN).toBe(0.035);
  });

  it('skips lines with non-numeric station/elevation', () => {
    const text = 'Station,Elevation\n0,100\nbad,data\n10,98';
    const points = parseCsvSurvey(text, defaultMapping, ',', true);
    expect(points).toHaveLength(2);
  });

  it('sets bankStation to null for all points', () => {
    const text = '0,100\n10,98';
    const points = parseCsvSurvey(text, defaultMapping, ',', false);
    expect(points.every((p) => p.bankStation === null)).toBe(true);
  });

  it('handles empty text', () => {
    const points = parseCsvSurvey('', defaultMapping, ',', false);
    expect(points).toHaveLength(0);
  });

  it('handles different column order via mapping', () => {
    const text = '100,0\n98,10\n95,20';
    const mapping: ColumnMapping = { station: 1, elevation: 0 };
    const points = parseCsvSurvey(text, mapping, ',', false);
    expect(points[0]).toMatchObject({ station: 0, elevation: 100 });
    expect(points[2]).toMatchObject({ station: 20, elevation: 95 });
  });
});
