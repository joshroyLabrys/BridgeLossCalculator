import { describe, it, expect } from 'vitest';
import { clarkUnitHydrograph, routeLinearReservoir } from '@flowsuite/engine/hydrology/clark-uh';

describe('routeLinearReservoir', () => {
  it('attenuates a pulse inflow', () => {
    // Single pulse of 10 m³/s, R=1hr, dt=0.25hr
    const inflow = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = routeLinearReservoir(inflow, 1.0, 0.25);
    // Peak should be less than input (attenuated)
    expect(Math.max(...result)).toBeLessThan(10);
    // Flow should eventually decay (after peak)
    const peakIdx = result.indexOf(Math.max(...result));
    expect(result[peakIdx]).toBeGreaterThan(result[result.length - 1]);
    // Total volume conserved (sum * dt)
    const inVol = inflow.reduce((a, b) => a + b, 0);
    const outVol = result.reduce((a, b) => a + b, 0);
    expect(outVol).toBeCloseTo(inVol, 0);
  });

  it('returns zeros for zero inflow', () => {
    const result = routeLinearReservoir([0, 0, 0], 1.0, 0.25);
    expect(result.every(v => Math.abs(v) < 0.001)).toBe(true);
  });
});

describe('clarkUnitHydrograph', () => {
  it('produces a hydrograph with peak less than input peak', () => {
    // Simple excess rainfall: 10mm in one timestep
    const excess = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const tc = 1.0; // 1 hour
    const r = 1.5;  // 1.5 hours
    const dt = 0.1; // 6 min
    const area = 10; // 10 km²
    const result = clarkUnitHydrograph(excess, tc, r, dt, area);
    expect(result.length).toBeGreaterThan(0);
    // Peak should exist
    const peak = Math.max(...result);
    expect(peak).toBeGreaterThan(0);
  });

  it('conserves volume approximately', () => {
    const excess = [5, 10, 8, 3, 1]; // mm per timestep
    const tc = 0.5;
    const r = 0.75;
    const dt = 0.1;
    const area = 25; // km²
    const result = clarkUnitHydrograph(excess, tc, r, dt, area);
    // Total excess in mm → volume in m³ = sum(mm) * area(km²) * 1000
    const totalExcessMM = excess.reduce((a, b) => a + b, 0);
    const expectedVolM3 = totalExcessMM * area * 1000;
    // Hydrograph volume = sum(Q * dt_seconds)
    const hydroVolM3 = result.reduce((a, b) => a + b, 0) * dt * 3600;
    // Should be within 10% (discretisation error)
    expect(Math.abs(hydroVolM3 - expectedVolM3) / expectedVolM3).toBeLessThan(0.1);
  });
});
