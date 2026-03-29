import { describe, it, expect } from 'vitest';
import { parseARRDataHub } from '@flowsuite/engine/hydrology/arr-parser';

const SAMPLE_ARR_FILE = `
[Site Details]
Latitude: -27.4698
Longitude: 153.0251
Location: Brisbane CBD

[IFD Depths]
Duration,50%,20%,10%,5%,2%,1%
10min,14.2,19.8,24.5,29.1,35.6,40.8
20min,20.1,28.0,34.7,41.2,50.3,57.7
30min,24.3,33.8,41.9,49.8,60.8,69.7
60min,31.5,43.9,54.4,64.6,78.9,90.5
120min,38.2,53.2,65.9,78.3,95.6,109.6
360min,48.5,67.5,83.7,99.4,121.4,139.2

[Temporal Patterns]
AEP Group: Frequent
Duration: 60 min
Pattern 1: 0.05,0.08,0.12,0.20,0.25,0.15,0.10,0.03,0.01,0.01
Pattern 2: 0.03,0.06,0.10,0.18,0.22,0.20,0.12,0.05,0.03,0.01

[Areal Reduction Factors]
Duration,50%,20%,10%,5%,2%,1%
60min,0.950,0.940,0.935,0.930,0.920,0.915
120min,0.960,0.955,0.950,0.945,0.935,0.930

[Losses]
Storm Initial Loss (median): 25.0 mm
Continuing Loss: 2.40 mm/hr
Pre-burst (50%, 60min): 8.5 mm
Pre-burst (1%, 60min): 15.2 mm
`.trim();

describe('parseARRDataHub', () => {
  it('parses site details', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.siteDetails.lat).toBeCloseTo(-27.4698);
    expect(result.siteDetails.lng).toBeCloseTo(153.0251);
    expect(result.siteDetails.name).toBe('Brisbane CBD');
  });

  it('parses IFD table', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.ifd.durations).toEqual([10, 20, 30, 60, 120, 360]);
    expect(result.ifd.aeps).toEqual(['50%', '20%', '10%', '5%', '2%', '1%']);
    expect(result.ifd.depths[0][0]).toBeCloseTo(14.2); // 10min, 50%
    expect(result.ifd.depths[3][5]).toBeCloseTo(90.5); // 60min, 1%
  });

  it('parses temporal patterns', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.temporalPatterns.length).toBeGreaterThan(0);
    const first = result.temporalPatterns[0];
    expect(first.group).toBe('frequent');
    expect(first.durationMin).toBe(60);
    expect(first.patterns.length).toBe(2);
    // Fractions should sum to approximately 1
    const sum = first.patterns[0].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });

  it('parses ARF values', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.arf.durations).toEqual([60, 120]);
    expect(result.arf.factors[0][0]).toBeCloseTo(0.95); // 60min, 50%
  });

  it('parses loss values', () => {
    const result = parseARRDataHub(SAMPLE_ARR_FILE);
    expect(result.losses.initialLoss).toBeCloseTo(25.0);
    expect(result.losses.continuingLoss).toBeCloseTo(2.4);
    expect(result.losses.preBurst.length).toBe(2);
  });

  it('handles empty input gracefully', () => {
    const result = parseARRDataHub('');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.ifd.durations).toEqual([]);
  });

  it('handles partial file with warnings', () => {
    const partial = `[Site Details]\nLatitude: -27.47\nLongitude: 153.03\n`;
    const result = parseARRDataHub(partial);
    expect(result.siteDetails.lat).toBeCloseTo(-27.47);
    expect(result.warnings.length).toBeGreaterThan(0); // missing IFD etc.
  });
});
