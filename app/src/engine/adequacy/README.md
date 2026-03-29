# Adequacy Decision Engine

## Purpose

The adequacy module synthesizes results from all calculation methods into a single engineering verdict: is this bridge adequate for the design flood? It takes the raw `CalculationResults` from the engine, evaluates the worst case across all methods, classifies the flow regime at each design event, and produces a human-readable verdict with a severity level.

This is the module that turns numbers into decisions.

## How It Works (`decision-engine.ts`)

### Step 1: Worst-Case WSEL Across Methods

For each flow profile, the engine finds the **highest upstream WSEL** produced by any enabled method (energy, momentum, Yarnell, WSPRO). This conservative approach ensures that the adequacy assessment is not optimistic -- if any method predicts a higher water level, that governs.

```typescript
for (const method of ['energy', 'momentum', 'yarnell', 'wspro']) {
  const r = results[method][i];
  if (r && !r.error && r.upstreamWsel > worstCaseWsel) {
    worstCaseWsel = r.upstreamWsel;
  }
}
```

Methods that returned an error (e.g., Yarnell in non-free-surface conditions) are excluded from the comparison.

### Step 2: Regime Classification

Each profile is classified based on where its worst-case WSEL falls relative to the bridge geometry:

| Condition                        | Regime           |
|----------------------------------|------------------|
| WSEL >= high chord               | `overtopping`    |
| WSEL >= low chord (but < high)   | `pressure`       |
| WSEL < low chord                 | `free-surface`   |

### Step 3: Freeboard and Status

Freeboard = low chord elevation minus worst-case WSEL. The status for each profile is:

| Condition                          | Status         |
|------------------------------------|----------------|
| Regime is overtopping              | `overtopping`  |
| Regime is pressure                 | `pressure`     |
| Freeboard > 0 but <= threshold     | `low`          |
| Freeboard > threshold              | `clear`        |

The freeboard threshold is user-configurable (default 0.984 ft, which is 0.3 m -- a common Australian standard).

### Step 4: Critical Q Threshold Interpolation

The engine interpolates three critical discharge values by scanning adjacent flow profiles:

1. **Pressure onset Q** -- the discharge at which the worst-case WSEL first reaches the low chord. Interpolated linearly between the last free-surface profile and the first pressure profile.

2. **Overtopping onset Q** -- the discharge at which the worst-case WSEL first reaches the high chord.

3. **Zero-freeboard Q** -- the discharge at which freeboard transitions from positive to zero. May differ from the pressure onset Q if the low chord varies across the bridge width.

These thresholds tell the engineer: "Your bridge starts experiencing pressure flow at approximately X cfs" -- a critical piece of information for risk assessment.

If no profile pair straddles a threshold (e.g., all profiles are free-surface), the corresponding Q is returned as `null`.

### Step 5: Verdict Generation

The `generateVerdict()` function examines the **design AEP profile** (typically the 1% AEP / 100-year event) and produces a verdict:

| Design Profile Status | Verdict | Severity |
|----------------------|---------|----------|
| `overtopping`        | "Bridge overtops at {AEP} ({Q} m^3/s)" | `fail` |
| `pressure`           | "Pressure flow at {AEP} -- adequate to {last clear AEP}" | `fail` |
| `low`                | "Low freeboard at {AEP} ({freeboard} m < {threshold} m threshold)" | `warning` |
| `clear`              | "Bridge adequate to {AEP} -- free-surface flow, {freeboard} m freeboard" | `pass` |

The verdict looks for a profile whose ARI string contains "1%". If no 1% AEP profile exists, it falls back to the last profile in the array (assumed to be the highest flow).

### Jurisdiction Awareness

The `computeAdequacy()` function accepts a `jurisdiction` parameter (e.g., `'tmr'`, `'vicroads'`, `'dpie'`, `'arr'`). Currently, the jurisdiction is passed to `generateVerdict()` for potential jurisdiction-specific verdict logic. The base implementation uses Australian standards (1% AEP as the design event, 0.3 m freeboard threshold), which is appropriate for TMR (Queensland), VicRoads (Victoria), DPIE (NSW), and general ARR practice.

## Output

The `AdequacyResults` type:

| Field              | Type                  | Description |
|--------------------|-----------------------|-------------|
| `profiles`         | `AdequacyResult[]`    | Per-profile assessment (WSEL, regime, freeboard, status) |
| `pressureOnsetQ`   | `number \| null`      | Interpolated discharge at pressure onset |
| `overtoppingOnsetQ`| `number \| null`      | Interpolated discharge at overtopping onset |
| `zeroFreeboardQ`   | `number \| null`      | Interpolated discharge at zero freeboard |
| `verdict`          | `string`              | Human-readable adequacy verdict |
| `verdictSeverity`  | `'pass' \| 'warning' \| 'fail'` | Severity classification |

## How Engineers Interpret the Results

- **Pass**: The bridge conveys the design flood with adequate clearance. No intervention needed.
- **Warning**: The bridge is technically adequate but has low freeboard. Engineers may recommend monitoring, debris management, or future upgrades.
- **Fail**: The bridge experiences pressure flow or overtopping at the design event. This typically triggers a detailed investigation, structural assessment, or upgrade design.

The critical Q thresholds are especially useful for risk management: they tell the engineer at what flow rate the bridge transitions between regimes, which can be compared against flood frequency data to quantify the probability of adverse conditions.
