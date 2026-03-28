# 3D Scene Visual Upgrade — PBR + Post-Processing Pipeline

**Date:** 2026-03-28
**Status:** Approved

## Goal

Transform the 3D bridge simulation from functional-medium quality to premium/cinematic quality using the existing R3F stack plus `@react-three/postprocessing`. Every surface should feel physically plausible. The scene should look like it belongs in a premium engineering product.

## Current State

- Three.js 0.183.2, R3F 9.5.0, Drei 10.7.7
- Custom water shader (waves, foam, caustics, specular) — decent quality
- Terrain: procedural BufferGeometry with vertex colors, MeshStandardMaterial (roughness 0.92)
- Bridge: ~15 box geometry meshes with flat MeshStandardMaterial (concrete grey, asphalt, steel)
- Lighting: 2 directional + hemisphere + ambient. One shadow-casting light at 1024x1024
- No post-processing, no environment map, no textures, no reflections
- OrbitControls with damping

## Changes

### 1. Install `@react-three/postprocessing`

Single new dependency. It wraps the pmndrs `postprocessing` library with R3F bindings.

### 2. Environment Lighting (HDRI)

Replace the ambient + hemisphere lights with Drei's `<Environment>` component using a built-in preset (e.g. `"city"` or `"sunset"`). This provides:
- Image-based lighting (IBL) for physically accurate ambient light
- Reflections on all PBR materials automatically
- A subtle background gradient (or set `background={false}` to keep the dark bg)

Keep the main directional light for shadows — HDRI doesn't cast shadows.

### 3. Post-Processing Stack

Add an `<EffectComposer>` with these effects in order:

1. **SSAO** (Screen-Space Ambient Occlusion) — adds depth/shadow in crevices under the bridge deck, between piers, where terrain meets water. Subtle radius, low intensity.
2. **Bloom** — makes water specular highlights and steel railing glints pop. Low threshold (~0.85), low intensity (~0.3). Selective — only bright surfaces trigger it.
3. **ToneMapping** (ACES Filmic) — cinematic color response. Crushes blacks slightly, rolls off highlights naturally. This alone transforms the look.
4. **Vignette** — subtle darkening at edges (~0.3 intensity). Draws eye to center.

### 4. Shadow Upgrade

- Switch to `PCFSoftShadowMap` on the Canvas renderer
- Increase shadow map to 2048x2048
- Tune shadow bias to eliminate acne
- Add `<ContactShadows>` from Drei under the bridge deck for grounded contact darkening

### 5. Bridge Materials — PBR Upgrade

Replace flat `meshStandardMaterial` with richer properties:

**Concrete (deck, piers, abutments):**
- Keep grey tones but add per-vertex color variation (subtle noise)
- Increase roughness to 0.95, add very slight normal perturbation via `onBeforeCompile` shader injection (procedural micro-normal for concrete grain). No texture files needed.
- Alternatively use Drei's `<MeshDistortMaterial>` properties for subtle surface variation

**Steel (railings, posts):**
- metalness: 0.9, roughness: 0.15
- With HDRI environment, this will show real reflections automatically
- Slight color tint: warm grey (#c8c8d0)

**Asphalt (road surface):**
- roughness: 0.98, metalness: 0.0
- Darker color (#2a2a30)
- Subtle vertex color noise for aggregate texture

**Pier cutwaters:**
- Same concrete but slightly darker to differentiate

### 6. Bridge Geometry — Subtle Improvements

Don't rebuild everything, but:
- Add `<RoundedBox>` from Drei for the main deck slab and parapet caps (soft edges catch light beautifully with HDRI)
- Keep box geometry for piers and smaller elements (visual difference is negligible at typical zoom)
- Add a subtle deck overhang/lip on the slab edges

### 7. Water Shader Upgrade

The existing custom shader is good. Enhance it:
- **Fresnel effect**: Water becomes more reflective at glancing angles, more transparent when looking straight down. Add `pow(1.0 - dot(viewDir, normal), 3.0)` Fresnel term.
- **Environment reflection**: Sample the HDRI environment map in the fragment shader. Blend with existing water color using Fresnel factor. This gives sky/bridge reflections on the water surface.
- **Depth-based opacity**: Where water is shallow (near banks), make it more transparent. Use vertex Y position relative to terrain.
- **Improved foam**: Brighter, slightly bloomed foam on wave crests

To get the environment map into the custom shader, pass it as a uniform (`envMap`) from the scene.

### 8. Terrain Enhancement

- Add procedural normal perturbation in `onBeforeCompile` for subtle ground texture (rocks, soil grain) without any texture files
- Improve the color gradient: add a fourth color band for near-water-edge (wet earth / darker tone)
- Slightly reduce roughness near water edge (wet ground effect: 0.7 vs 0.92)

### 9. Lighting Refinement

- Keep main directional for shadows but warm it slightly (color: #fff5e6)
- Remove ambient light (HDRI replaces it)
- Keep secondary directional as subtle fill but dim it (0.15)
- Remove hemisphere light (HDRI replaces it)

### 10. Camera & Interaction Polish

- Add Drei's `<Float>` on the water mesh for a subtle idle breathing effect (very low intensity)
- Use `makeDefault` on OrbitControls for smoother behavior
- Enable `autoRotate` with very slow speed (0.15) when user hasn't interacted for 5 seconds — cinematic idle. Stops on any interaction.

## What We Are NOT Doing

- No texture files / image assets (everything procedural or from drei presets)
- No model imports (staying with procedural geometry)
- No ray-traced reflections
- No vegetation, trees, or environmental scenery
- No engine migration
- No LOD system (scene is small enough)

## Performance Budget

Target: 60fps on mid-range laptop GPU (Intel Iris / GTX 1650 class).

- SSAO: half-resolution, low sample count (8)
- Bloom: low-resolution mip chain
- Shadow map: 2048x2048 (one light only)
- Post-processing runs at render resolution
- Environment map: small preset from drei (not a custom large HDRI)

## Dependencies

- `@react-three/postprocessing` (new)
- `postprocessing` (peer dep, auto-installed)

All other changes use existing three.js / drei APIs.

## Files Modified

- `simulation-scene.tsx` — Canvas config, environment, post-processing, lighting
- `bridge-mesh.tsx` — PBR materials, RoundedBox for deck
- `water-mesh.tsx` — Fresnel, env reflection, depth opacity in shader
- `terrain-mesh.tsx` — Normal perturbation, wet-edge color, roughness variation
- `package.json` — Add postprocessing dependency
