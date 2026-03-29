# Multi-Bridge Reach Analysis

## Purpose

The reach solver handles the case where multiple bridges exist along the same waterway. In a real river system, the backwater caused by a downstream bridge raises the tailwater for the next bridge upstream. This module cascades those effects from downstream to upstream, producing a hydraulically consistent set of results across the entire reach.

## How It Works (`reach-solver.ts`)

### Downstream-to-Upstream Cascade

The solver processes bridges in **downstream-to-upstream order** (sorted by chainage descending):

1. The most downstream bridge uses the original flow profile's downstream WSEL (`dsWsel`) as its tailwater boundary.
2. The engine runs all enabled methods for that bridge using `runAllMethods()`.
3. For each flow profile, the **worst-case upstream WSEL** across all methods becomes the new downstream WSEL for the next upstream bridge.
4. The process repeats for each bridge moving upstream.

```
Bridge C (downstream)     Bridge B (middle)         Bridge A (upstream)
  dsWsel = profile.dsWsel   dsWsel = usWsel_C         dsWsel = usWsel_B
  --> compute usWsel_C      --> compute usWsel_B      --> compute usWsel_A
```

### Bridges with Incomplete Data

Bridges that have fewer than 2 cross-section points or a high chord elevation of 0 are skipped. This allows partially configured bridges to exist in the reach without breaking the cascade.

### Sorting

The input array of `BridgeProject` objects is sorted by `chainage` descending before processing. Each bridge's `chainage` represents its distance along the waterway (e.g., from the mouth). Higher chainage = further upstream.

## Output

The `ReachResults` type contains:

| Field              | Type | Description |
|--------------------|------|-------------|
| `bridgeResults`    | `{ bridgeId: string; results: CalculationResults }[]` | Full calculation results for each bridge |
| `tailwaterCascade` | `{ bridgeId: string; dsWsel: number; usWsel: number }[]` | The downstream and upstream WSEL at each bridge, showing how tailwater propagates |

## Limitations

1. **No floodplain storage.** The cascade uses a simple WSEL replacement -- it does not model floodplain storage, backwater attenuation, or timing effects between bridges. Each bridge is analyzed as a steady-state 1D problem.

2. **Maximum 5 bridges.** The UI limits the reach to 5 bridges. The solver itself has no hard limit, but performance and accuracy degrade with more bridges because errors compound upstream.

3. **Uniform flow profiles.** All bridges in the reach use the same set of flow profiles (same discharges). The solver does not model lateral inflows, tributary contributions, or flow attenuation between bridges.

4. **Each bridge uses its own coefficients.** While the flow profiles cascade, each bridge retains its own cross-section, bridge geometry, and coefficients. This is correct behavior -- different bridges have different geometries and roughness -- but it means each bridge must be individually configured.

5. **No backwater from upstream.** The cascade is one-directional (downstream to upstream). It does not account for downstream effects of upstream bridges, which is appropriate for subcritical flow but would not be correct for supercritical or mixed-flow regimes.

## When to Use

Use the reach solver when:

- Multiple bridges are close enough together that backwater from one affects the next.
- You need to demonstrate that cumulative bridge effects have been considered in a flood study.
- A regulatory submission requires reach-scale analysis rather than isolated bridge assessments.

For isolated bridges with no downstream influence, the standard single-bridge `runAllMethods()` is sufficient.
