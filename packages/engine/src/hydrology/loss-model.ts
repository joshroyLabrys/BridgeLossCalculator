/**
 * Apply ARR2019 loss model to a rainfall hyetograph.
 *
 * @param rainfall - rainfall per timestep (mm)
 * @param initialLoss - storm initial loss (mm)
 * @param continuingLoss - continuing loss rate (mm/hr)
 * @param preBurst - pre-burst rainfall depth (mm), subtracted from IL budget
 * @param imperviousFraction - fraction of catchment that is impervious (0-1)
 * @param dtMinutes - timestep duration in minutes
 * @returns excess rainfall per timestep (mm)
 */
export function applyLosses(
  rainfall: number[],
  initialLoss: number,
  continuingLoss: number,
  preBurst: number,
  imperviousFraction: number,
  dtMinutes: number,
): number[] {
  const clPerStep = continuingLoss * (dtMinutes / 60); // mm per timestep
  let ilRemaining = Math.max(0, initialLoss - preBurst);
  const perviousFraction = 1 - imperviousFraction;

  return rainfall.map((rain) => {
    // Impervious portion: all rainfall becomes runoff
    const impExcess = rain * imperviousFraction;

    // Pervious portion: apply IL then CL
    let pervRain = rain * perviousFraction;
    let pervExcess = 0;

    if (ilRemaining > 0) {
      const ilAbsorbed = Math.min(pervRain, ilRemaining);
      pervRain -= ilAbsorbed;
      ilRemaining -= ilAbsorbed;
    }

    if (pervRain > 0) {
      pervExcess = Math.max(0, pervRain - clPerStep * perviousFraction);
    }

    return impExcess + pervExcess;
  });
}
