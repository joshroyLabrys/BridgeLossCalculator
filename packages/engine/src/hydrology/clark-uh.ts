/**
 * Route inflow through a linear reservoir.
 * S = R * Q, Muskingum routing with K=R, x=0.
 *
 * @param inflow - inflow time series (m³/s)
 * @param r - storage coefficient (hours)
 * @param dt - timestep (hours)
 * @returns outflow time series (m³/s)
 */
export function routeLinearReservoir(inflow: number[], r: number, dt: number): number[] {
  if (r <= 0 || dt <= 0 || inflow.length === 0) return inflow.map(() => 0);

  const c1 = dt / (2 * r + dt);
  const c2 = c1;
  const c3 = (2 * r - dt) / (2 * r + dt);

  const outflow = new Array(inflow.length).fill(0);
  outflow[0] = c1 * inflow[0]; // Initial: Q[0] = C1 * I[0]

  for (let i = 1; i < inflow.length; i++) {
    outflow[i] = c1 * inflow[i] + c2 * inflow[i - 1] + c3 * outflow[i - 1];
    if (outflow[i] < 0) outflow[i] = 0;
  }

  return outflow;
}

/**
 * Clark unit hydrograph convolution.
 * 1. Translate excess rainfall using linear time-area curve
 * 2. Route through linear reservoir (S = R * Q)
 *
 * @param excessRainfall - excess rainfall per timestep (mm)
 * @param tc - time of concentration (hours)
 * @param r - storage coefficient (hours)
 * @param dt - timestep (hours)
 * @param area - catchment area (km²)
 * @returns discharge hydrograph (m³/s)
 */
export function clarkUnitHydrograph(
  excessRainfall: number[],
  tc: number,
  r: number,
  dt: number,
  area: number,
): number[] {
  if (excessRainfall.length === 0 || tc <= 0 || dt <= 0 || area <= 0) return [];

  const nTc = Math.ceil(tc / dt); // number of timesteps for Tc
  const nTotal = excessRainfall.length + nTc + Math.ceil(3 * r / dt); // extend for recession

  // Step 1: Time-area translation
  // Linear time-area: A(t) = t/Tc for t <= Tc
  // Incremental area fraction per timestep
  const translation = new Array(nTotal).fill(0);

  for (let i = 0; i < excessRainfall.length; i++) {
    const depthMM = excessRainfall[i];
    if (depthMM <= 0) continue;

    // Convert mm over catchment to m³/s instantaneous inflow
    // Q = depth(m) * area(m²) / dt(s)
    const depthM = depthMM / 1000;
    const areaM2 = area * 1e6;
    const dtSec = dt * 3600;
    const totalVolumeM3 = depthM * areaM2;

    // Distribute over Tc using linear time-area curve
    for (let j = 0; j <= nTc; j++) {
      const t1 = j * dt;
      const t2 = (j + 1) * dt;
      // Fraction of area contributing between t1 and t2
      const f1 = Math.min(t1 / tc, 1);
      const f2 = Math.min(t2 / tc, 1);
      const dA = f2 - f1;
      if (dA > 0 && (i + j) < nTotal) {
        translation[i + j] += (totalVolumeM3 * dA) / dtSec;
      }
    }
  }

  // Step 2: Route through linear reservoir
  const outflow = routeLinearReservoir(translation, r, dt);

  // Trim trailing near-zero values
  let lastNonZero = outflow.length - 1;
  while (lastNonZero > 0 && outflow[lastNonZero] < 0.001) lastNonZero--;

  return outflow.slice(0, lastNonZero + 1);
}
