# 3D Scene Components

This directory contains the React Three Fiber (R3F) components that render the interactive 3D hydraulic simulation. The scene visualizes the bridge, terrain, water surface, and atmospheric effects driven by the hydraulic calculation results.

## Architecture

The scene is built on `@react-three/fiber` (React renderer for Three.js) with `@react-three/drei` for camera controls, environment maps, sky, and contact shadows. Post-processing uses `@react-three/postprocessing` (wrapping the `postprocessing` library).

All components receive data from the `HydraulicProfile` object built by `@/engine/simulation-profile.ts`, which transforms raw calculation results into a structure suitable for 3D rendering.

## Components

### SimulationScene

**File:** `simulation-scene.tsx`

The root component that sets up the R3F `Canvas` and composes all scene elements.

**Camera:**
- Perspective camera positioned at an elevated angle looking at the scene center.
- `OrbitControls` with damping, constrained polar angle (prevents flipping below ground), and auto-calculated min/max distance based on scene size.

**Lighting:**
- HDRI environment map (`sunset` preset) for image-based lighting (IBL).
- Procedural `Sky` component with atmospheric scattering and a visible sun.
- Shadow-casting directional light (main sun) with 2048x2048 shadow map.
- Subtle fill light from the opposite direction.

**Post-processing pipeline (all toggleable via feature flags):**
- **SMAA** -- subpixel morphological anti-aliasing.
- **N8AO** -- ambient occlusion.
- **Bloom** -- luminance-based glow on bright surfaces.
- **God Rays** -- volumetric light scattering from a sun disc mesh.
- **ACES Filmic Tone Mapping** -- cinematic tone curve.
- **Vignette** -- subtle edge darkening.

**Feature toggle panel:**
A floating "Render" button in the top-right corner opens a checkbox panel for enabling/disabling each post-processing effect. This allows users on lower-end hardware to disable expensive effects.

**Renderer badge:**
Bottom-right corner shows "WebGPU" or "WebGL 2" based on browser capability detection via `navigator.gpu.requestAdapter()`.

### BridgeMesh

**File:** `bridge-mesh.tsx`

Renders the complete bridge structure with PBR (Physically Based Rendering) materials.

**Geometry components:**
- **Deck** -- box geometry spanning between abutments with asphalt surface texture.
- **Girders** -- concrete beams under the deck.
- **Railings** -- steel barriers along both edges with metallic material.
- **Road markings** -- subtle emissive white strips on the deck surface.
- **Abutments** -- concrete walls at each end, extending from ground to deck.
- **Wingwalls** -- angled retaining walls extending from each abutment.
- **Piers** -- concrete columns from bed to deck underside, using weathered concrete texture. Pier width and station are taken from bridge geometry.

**Materials:**
Uses `MeshPhysicalMaterial` with clearcoat for concrete surfaces and `MeshStandardMaterial` for asphalt. Photo textures (`/textures/concrete.jpg`, `concreteweathered.jpg`, `asphalt.jpg`) are loaded via `useTexture` from drei, combined with procedural normal and roughness maps for surface detail.

Ground elevation under each pier and abutment is interpolated from the cross-section data.

### TerrainMesh

**File:** `terrain-mesh.tsx`

Extrudes the 2D cross-section into 3D terrain by stretching it along the channel length (Z axis).

**Implementation:**
- Creates a custom `BufferGeometry` with vertices at each cross-section point for two Z slices (front and back), plus side skirts that extend down to form closed walls.
- Vertex colors are derived from elevation: dark brown at the channel bed, transitioning through earth tones to green at the banks.
- Applies a procedural earth normal map for surface detail.
- Face indices connect the front and back slices into a continuous surface.

### WaterMesh

**File:** `water-mesh.tsx`

A custom shader material on a subdivided plane geometry that simulates flowing water.

**Geometry:**
A `PlaneGeometry` (80x60 subdivisions) rotated to horizontal, positioned at the water surface elevation, and clipped to the wetted width (interpolated from cross-section points where elevation <= WSEL).

**Custom shader features:**
- **Gerstner waves** -- multiple wave components with different frequencies and amplitudes for realistic surface displacement.
- **Fresnel reflection** -- view-angle-dependent reflection intensity.
- **Flow regime coloring** -- different base/highlight/foam colors for free-surface (blue), pressure (amber), and overtopping (red) regimes.
- **Bridge shadow** -- darkening under the bridge deck bounds (passed as uniforms: xMin, xMax, yBottom, yTop, zMin, zMax).
- **Flow speed** -- wave scroll speed derived from approach velocity and channel length.

Animated via `useFrame` which updates the shader's `uTime` uniform each frame.

### GrassMesh

**File:** `grass-mesh.tsx`

8,000 instanced grass blades placed on terrain above the waterline.

**Placement:**
Uses seeded random placement across the cross-section extents and channel length. Only places blades where ground elevation exceeds WSEL + 0.3 ft margin. Blade height varies randomly between 0.3 and 0.8 units.

**Animation:**
Wind sway is applied per-frame via `useFrame`, updating instance matrices with a sine-based bend that varies by position and time. Uses `InstancedMesh` for GPU-efficient rendering of thousands of blades.

**Visual:**
Green-tinted material with slight variation in color per blade via instance color attributes.

### SprayParticles

**File:** `spray-particles.tsx`

Two particle effects:

1. **Pier Spray** -- 200 particles per pier, clustered around each pier station at the water surface. Particles fountain upward with random lateral spread, simulating spray from flow impacting the pier. Speed scales with approach velocity.

2. **Atmospheric Mist** -- 80 larger, slower particles scattered above the water surface across the channel, providing ambient atmosphere.

Both use `InstancedMesh` with per-frame matrix updates for particle positions, and seeded random initialization for deterministic appearance.

### BridgeDetails

**File:** `bridge-details.tsx`

Decorative bridge furniture:
- **Light poles** -- spaced along both sides of the bridge deck. Each pole consists of a tapered cylinder, a horizontal arm, and a small emissive light fixture. Pole count and spacing are derived from bridge span.
- Positioned on both upstream and downstream edges of the deck.

### ProceduralTextures

**File:** `procedural-textures.ts`

Canvas-based PBR texture generation for materials that need normal and roughness maps without loading external image files.

**Available textures:**
- `concreteNormalMap(size)` -- fractal Brownian motion (fBM) noise converted to a tangent-space normal map. Creates the appearance of concrete surface irregularities.
- `concreteRoughnessMap(size)` -- fBM-based roughness variation.
- `asphaltNormalMap(size)` -- higher-frequency noise for asphalt grain.
- `earthNormalMap(size)` -- terrain surface detail.

**Implementation:**
- Uses a custom `hash()` and `smoothNoise()` implementation (no external noise library).
- Multi-octave fBM for natural-looking variation.
- Textures are cached in a `Map` by key to avoid regeneration.
- Output is `THREE.CanvasTexture` with `RepeatWrapping` in linear color space.
