# Photorealistic 3D Bridge Simulation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the flat-colored 3D bridge simulation into a photorealistic, cinematic scene with procedural PBR textures, real water reflections, volumetric god rays, depth of field, and optionally WebGPU rendering.

**Architecture:** Progressive enhancement across 3 tiers — (A) PBR textures + SMAA + DoF, (B) water reflections + god rays + fog, (C) WebGPU renderer with fallback. Each tier builds on the previous. All features are additive and easy to strip out individually.

**Tech Stack:** Three.js 0.183, React Three Fiber 9.5, Drei 10.7, @react-three/postprocessing 3.0.4, procedural Canvas-based texture generation

---

### Task 1: Procedural PBR Texture Generator

Create a utility that generates normal maps, roughness maps, and AO maps at runtime using Canvas 2D + noise. No external texture downloads needed.

**Files:**
- Create: `app/src/components/simulation/scene-3d/procedural-textures.ts`

- [ ] **Step 1: Create the procedural texture generator**

```ts
// procedural-textures.ts
import * as THREE from 'three';

// Simplex-style noise for texture generation
function hash(x: number, y: number): number {
  let h = x * 127.1 + y * 311.7;
  h = Math.sin(h) * 43758.5453;
  return h - Math.floor(h);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.0;
  }
  return val;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreate(key: string, size: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  if (textureCache.has(key)) return textureCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  paint(ctx, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/** Concrete normal map — grainy surface with pores and subtle cracks */
export function concreteNormalMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('concrete-normal', size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const scale = 8;
        // Height from noise
        const h0 = fbm(x / w * scale, y / h * scale, 5);
        const hR = fbm((x + 1) / w * scale, y / h * scale, 5);
        const hU = fbm(x / w * scale, (y + 1) / h * scale, 5);
        // Derive normal from height differences
        const dx = (h0 - hR) * 2.0;
        const dy = (h0 - hU) * 2.0;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        img.data[i]     = ((dx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Concrete roughness map — mostly rough with smoother worn patches */
export function concreteRoughnessMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('concrete-roughness', size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const base = 0.85;
        const variation = fbm(x / w * 6, y / h * 6, 4) * 0.15;
        const pore = smoothNoise(x / w * 30, y / h * 30) > 0.7 ? -0.1 : 0;
        const v = Math.max(0, Math.min(1, base + variation + pore)) * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Asphalt normal map — aggregate chips + binder */
export function asphaltNormalMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('asphalt-normal', size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const scale = 15; // tighter detail
        const h0 = fbm(x / w * scale, y / h * scale, 4) * 0.6
                  + smoothNoise(x / w * 40, y / h * 40) * 0.4;
        const hR = fbm((x + 1) / w * scale, y / h * scale, 4) * 0.6
                  + smoothNoise((x + 1) / w * 40, y / h * 40) * 0.4;
        const hU = fbm(x / w * scale, (y + 1) / h * scale, 4) * 0.6
                  + smoothNoise(x / w * 40, (y + 1) / h * 40) * 0.4;
        const dx = (h0 - hR) * 1.5;
        const dy = (h0 - hU) * 1.5;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        img.data[i]     = ((dx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Earth/terrain normal map — rough soil with rocks */
export function earthNormalMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('earth-normal', size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const scale = 10;
        const h0 = fbm(x / w * scale, y / h * scale, 6);
        const hR = fbm((x + 1) / w * scale, y / h * scale, 6);
        const hU = fbm(x / w * scale, (y + 1) / h * scale, 6);
        const dx = (h0 - hR) * 2.5;
        const dy = (h0 - hU) * 2.5;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        img.data[i]     = ((dx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Dispose all cached textures */
export function disposeTextureCache(): void {
  textureCache.forEach(t => t.dispose());
  textureCache.clear();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx tsc --noEmit src/components/simulation/scene-3d/procedural-textures.ts`
Expected: No errors

---

### Task 2: Apply PBR Textures to Bridge Mesh

Replace flat-colored materials on the bridge with textured PBR materials using the procedural generator.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/bridge-mesh.tsx`

- [ ] **Step 1: Import texture generator and add texture hooks**

At the top of bridge-mesh.tsx, add:
```ts
import { concreteNormalMap, concreteRoughnessMap, asphaltNormalMap } from './procedural-textures';
```

- [ ] **Step 2: Create a TexturedMaterials component that loads textures once**

Replace the const material definitions (CONCRETE, CONCRETE_DARK, ASPHALT, etc.) with a React context or useMemo-based approach that creates materials with texture maps:

```tsx
function useTexturedMaterials() {
  return useMemo(() => {
    const cNormal = concreteNormalMap(512);
    const cRough = concreteRoughnessMap(512);
    const aNormal = asphaltNormalMap(512);

    // Tile textures appropriately
    [cNormal, cRough, aNormal].forEach(t => {
      t.repeat.set(4, 4);
    });

    return {
      concrete: { color: '#948e88', normalMap: cNormal, roughnessMap: cRough, roughness: 1.0, metalness: 0.02, envMapIntensity: 0.7 },
      concreteDark: { color: '#7a756f', normalMap: cNormal, roughnessMap: cRough, roughness: 1.0, metalness: 0.02, envMapIntensity: 0.6 },
      asphalt: { color: '#2a2a30', normalMap: aNormal, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.15 },
      steel: { color: '#b8bcc4', roughness: 0.12, metalness: 0.92, envMapIntensity: 1.4 },
      marking: { color: '#e8e8e8', roughness: 0.5, metalness: 0.0, emissive: '#e8e8e8', emissiveIntensity: 0.06 },
      earth: { color: '#5a5045', normalMap: cNormal, roughness: 1.0, metalness: 0.01, envMapIntensity: 0.35 },
    };
  }, []);
}
```

- [ ] **Step 3: Thread textured materials through all mesh components**

Pass materials down to DeckGeometry, ApproachEmbankment, RailTube, RailPost, pier meshes, etc. Replace every `{...CONCRETE}` with the textured equivalent.

- [ ] **Step 4: Build and verify**

Run: `cd app && npm run build`
Expected: Build succeeds, no errors

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(3d): add procedural PBR textures to bridge surfaces"
```

---

### Task 3: Apply PBR Textures to Terrain

Add normal mapping to the terrain mesh for visible soil/rock detail.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/terrain-mesh.tsx`

- [ ] **Step 1: Import earth texture and apply**

```tsx
import { earthNormalMap } from './procedural-textures';

// In the component:
const normalMap = useMemo(() => {
  const tex = earthNormalMap(512);
  tex.repeat.set(3, 3);
  return tex;
}, []);

// On the material:
<meshStandardMaterial
  vertexColors
  normalMap={normalMap}
  normalScale={new THREE.Vector2(0.8, 0.8)}
  roughness={0.88}
  metalness={0.02}
  side={THREE.DoubleSide}
  envMapIntensity={0.6}
/>
```

The terrain uses vertex colors for elevation-based coloring. Adding a normal map on top gives visible soil grain without changing the color scheme.

- [ ] **Step 2: Add UV coordinates to terrain BufferGeometry**

The terrain currently has no UVs (vertex colors only). Add UV generation based on world position so the normal map tiles correctly:

```ts
const uvs: number[] = [];
// In the vertex loop:
uvs.push(pts[pi].station / 10, z / 10); // world-space tiling
// ...
geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
```

- [ ] **Step 3: Build and verify**

Run: `cd app && npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(3d): add procedural normal map to terrain"
```

---

### Task 4: SMAA Anti-Aliasing + Depth of Field

Add SMAA (works correctly with N8AO, unlike hardware AA) and tilt-shift depth of field for a cinematic miniature effect.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/simulation-scene.tsx`

- [ ] **Step 1: Import SMAA and DepthOfField**

```tsx
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette, SMAA, DepthOfField } from '@react-three/postprocessing';
```

- [ ] **Step 2: Disable hardware antialiasing**

In the Canvas gl prop, change `antialias: true` to `antialias: false` (SMAA replaces it).

- [ ] **Step 3: Add SMAA and DepthOfField to EffectComposer**

```tsx
<EffectComposer multisampling={0}>
  <SMAA />
  <N8AO aoRadius={2.0} distanceFalloff={0.5} intensity={2.5} quality="medium" />
  <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.3} intensity={0.4} mipmapBlur />
  <DepthOfField
    focusDistance={0}
    focalLength={0.05}
    bokehScale={3}
  />
  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
  <Vignette offset={0.25} darkness={0.4} blendFunction={BlendFunction.NORMAL} />
</EffectComposer>
```

The DoF focusDistance=0 with focalLength=0.05 creates a subtle tilt-shift effect where the bridge is sharp and the periphery softly blurs. bokehScale=3 is subtle — increase for more pronounced effect.

- [ ] **Step 4: Build and verify**

Run: `cd app && npm run build`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(3d): add SMAA anti-aliasing + tilt-shift depth of field"
```

---

### Task 5: Water Reflection Plane

Add a MeshReflectorMaterial plane beneath the existing water shader to create real scene reflections visible through the semi-transparent water.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/water-mesh.tsx`

- [ ] **Step 1: Import MeshReflectorMaterial from drei**

```tsx
import { MeshReflectorMaterial } from '@react-three/drei';
```

- [ ] **Step 2: Add a reflection plane beneath the water surface**

Below the existing `<mesh>` that holds the shader water, add a second mesh at `wsel - 0.05` (slightly below) with MeshReflectorMaterial:

```tsx
{/* Reflection plane — sits just below the animated water surface */}
<mesh
  position={[leftStation + width / 2, wsel - 0.05, channelLength / 2]}
  rotation={[-Math.PI / 2, 0, 0]}
>
  <planeGeometry args={[width, channelLength]} />
  <MeshReflectorMaterial
    blur={[300, 100]}
    resolution={512}
    mixBlur={1}
    mixStrength={0.6}
    roughness={0.8}
    depthScale={1.0}
    minDepthThreshold={0.4}
    maxDepthThreshold={1.2}
    color="#0a1628"
    metalness={0.3}
    mirror={0}
  />
</mesh>
```

The animated water shader sits on top (transparent), and the reflections from the reflector plane bleed through. The result: you see rippling water WITH bridge/terrain reflections.

- [ ] **Step 3: Build and verify**

Run: `cd app && npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(3d): add water reflection plane with MeshReflectorMaterial"
```

---

### Task 6: God Rays

Add volumetric light shafts from the sun through the bridge opening.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/simulation-scene.tsx`

- [ ] **Step 1: Import GodRays**

```tsx
import { GodRays } from '@react-three/postprocessing';
```

- [ ] **Step 2: Create a sun mesh (light source for god rays)**

GodRays requires a mesh as the light source origin. Add a small emissive sphere positioned where the directional light is:

```tsx
const sunRef = useRef<THREE.Mesh>(null!);

// In JSX:
<mesh ref={sunRef} position={[centerX + span * 0.8, maxElev + 15, centerZ + channelLength * 0.8]}>
  <sphereGeometry args={[1.5, 16, 16]} />
  <meshBasicMaterial color="#fff5e6" transparent opacity={0.8} />
</mesh>
```

- [ ] **Step 3: Add GodRays to EffectComposer**

```tsx
{sunRef.current && (
  <GodRays
    sun={sunRef.current}
    samples={40}
    density={0.96}
    decay={0.92}
    weight={0.3}
    exposure={0.5}
    clampMax={1}
    blur
  />
)}
```

Place after N8AO, before ToneMapping. The samples=40 is mobile-friendly (vs default 60).

- [ ] **Step 4: Build and verify**

Run: `cd app && npm run build`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(3d): add volumetric god rays through bridge"
```

---

### Task 7: Atmospheric Fog

Add depth-based fog for atmospheric perspective.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/simulation-scene.tsx`

- [ ] **Step 1: Add fog to the scene**

Inside SceneContent, add:
```tsx
<fogExp2 attach="fog" color="#1a1a2e" density={0.008} />
```

This creates a subtle dark blue atmospheric haze at distance, enhancing depth perception. The density is low enough to not obscure the bridge but visible at the terrain edges.

- [ ] **Step 2: Match the fog color to background**

Adjust the Canvas background color to blend with the fog at distance.

- [ ] **Step 3: Build and verify**

Run: `cd app && npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(3d): add atmospheric fog for depth"
```

---

### Task 8: WebGPU Renderer (Experimental)

Attempt WebGPU renderer with automatic WebGL fallback. This is experimental — if it breaks postprocessing or drei, revert.

**Files:**
- Modify: `app/src/components/simulation/scene-3d/simulation-scene.tsx`

- [ ] **Step 1: Try WebGPU Canvas configuration**

R3F's Canvas doesn't natively support WebGPU yet. The approach is to use the `frameloop` and `gl` configuration:

```tsx
// Test if WebGPU is available
const [supportsWebGPU, setSupportsWebGPU] = useState(false);
useEffect(() => {
  if ('gpu' in navigator) {
    (navigator as any).gpu.requestAdapter().then((adapter: any) => {
      setSupportsWebGPU(!!adapter);
    }).catch(() => {});
  }
}, []);
```

If WebGPU is available, log it to console. For now, we stay on WebGL but detect capability for future use. Full WebGPU integration requires R3F updates that aren't stable yet.

- [ ] **Step 2: Add WebGPU detection badge to UI**

Show a small "WebGPU" or "WebGL" badge in the corner of the 3D view so you can see which renderer is active.

- [ ] **Step 3: Build and verify**

Run: `cd app && npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(3d): add WebGPU detection (renderer swap deferred)"
```

---

## Summary

After all tasks, the scene will have:
- **Textured concrete** with visible grain, pores, weathering
- **Textured asphalt** with aggregate detail
- **Textured terrain** with soil/rock normal mapping
- **SMAA** anti-aliasing (proper AA that works with AO)
- **Tilt-shift DoF** for cinematic miniature feel
- **Water reflections** (bridge/terrain reflect in water)
- **God rays** streaming through the bridge opening
- **Atmospheric fog** for depth
- **WebGPU detection** (full renderer swap deferred until R3F support matures)

Each feature is independently removable — just delete the component/effect from the EffectComposer or remove the import.
