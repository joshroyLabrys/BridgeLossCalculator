# 3D Scene Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 3D bridge simulation from flat/functional to cinematic quality using PBR materials, HDRI environment lighting, and post-processing effects.

**Architecture:** Add `@react-three/postprocessing` for bloom/SSAO/tone-mapping. Replace ambient+hemisphere lights with Drei's `<Environment>` for image-based lighting. Upgrade all materials with physically-accurate PBR values. Enhance the water shader with Fresnel reflections and environment map sampling.

**Tech Stack:** Three.js 0.183, @react-three/fiber 9.5, @react-three/drei 10.7, @react-three/postprocessing 3.x, postprocessing 6.x

---

### Task 1: Install postprocessing dependency

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install the package**

```bash
cd app && npm install @react-three/postprocessing
```

This installs both `@react-three/postprocessing` and its peer dep `postprocessing`.

- [ ] **Step 2: Verify install**

```bash
cd app && node -e "require('@react-three/postprocessing'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Verify build**

```bash
cd app && npx next build
```

Expected: Compiles successfully with no errors.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add @react-three/postprocessing"
```

---

### Task 2: Canvas config, environment lighting, and post-processing pipeline

**Files:**
- Modify: `app/src/components/simulation/scene-3d/simulation-scene.tsx`

This is the biggest single change — it rewires the entire rendering pipeline.

- [ ] **Step 1: Rewrite simulation-scene.tsx**

Replace the entire file with:

```tsx
'use client';

import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, SSAO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { HydraulicProfile } from '@/engine/simulation-profile';
import { TerrainMesh } from './terrain-mesh';
import { WaterMesh } from './water-mesh';
import { BridgeMesh } from './bridge-mesh';

interface SimulationSceneProps {
  profile: HydraulicProfile;
}

function SceneContent({ profile }: SimulationSceneProps) {
  const cs = profile.crossSection;
  const bridge = profile.bridge;

  const span = cs[cs.length - 1].station - cs[0].station;
  const channelLength = Math.max(span * 0.6, 20);

  const bridgeDeckWidth = bridge.deckWidth > 0
    ? bridge.deckWidth
    : Math.max(span * 0.3, 8);

  const centerX = (cs[0].station + cs[cs.length - 1].station) / 2;
  const minElev = Math.min(...cs.map(p => p.elevation));
  const maxElev = Math.max(bridge.highChord, profile.usWsel);
  const centerY = (minElev + maxElev) / 2;
  const centerZ = channelLength / 2;
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  return (
    <>
      {/* HDRI environment — provides IBL + reflections on all PBR surfaces */}
      <Environment preset="city" background={false} environmentIntensity={0.6} />

      {/* Main directional — shadow-casting sun */}
      <directionalLight
        position={[centerX + span, maxElev + 20, centerZ + channelLength]}
        intensity={1.1}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={channelLength}
        shadow-camera-bottom={-channelLength}
        shadow-camera-near={1}
        shadow-camera-far={sceneSize * 4}
      />

      {/* Subtle fill light */}
      <directionalLight
        position={[centerX - span * 0.5, maxElev + 10, centerZ - channelLength * 0.5]}
        intensity={0.15}
        color="#c8d8f0"
      />

      {/* Terrain */}
      <TerrainMesh crossSection={cs} channelLength={channelLength} />

      {/* Contact shadows — pools soft shadow under bridge */}
      <ContactShadows
        position={[centerX, minElev + 0.01, centerZ]}
        width={span * 1.5}
        height={channelLength * 1.5}
        opacity={0.35}
        blur={2}
        far={maxElev - minElev + 10}
        resolution={512}
      />

      {/* Water */}
      <WaterMesh
        crossSection={cs}
        wsel={profile.usWsel}
        channelLength={channelLength}
        flowRegime={profile.flowRegime}
        velocity={profile.approach.velocity}
      />

      {/* Bridge */}
      <BridgeMesh
        bridge={{
          lowChordLeft: bridge.lowChordLeft,
          lowChordRight: bridge.lowChordRight,
          highChord: bridge.highChord,
          leftAbutmentStation: bridge.stationStart,
          rightAbutmentStation: bridge.stationEnd,
          deckWidth: bridgeDeckWidth,
          piers: bridge.piers.map(p => ({ ...p, shape: 'round-nose' as const })),
          skewAngle: 0,
          contractionLength: 0,
          expansionLength: 0,
          orificeCd: 0,
          weirCw: 0,
          lowChordProfile: [],
        }}
        crossSection={cs}
        channelLength={channelLength}
      />

      {/* Camera controls */}
      <OrbitControls
        target={[centerX, centerY, centerZ]}
        minDistance={sceneSize * 0.3}
        maxDistance={sceneSize * 4}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI * 0.85}
        makeDefault
      />

      {/* Post-processing */}
      <EffectComposer multisampling={0}>
        <SSAO
          radius={0.12}
          intensity={1.5}
          luminanceInfluence={0.4}
          samples={8}
          worldDistanceThreshold={sceneSize * 0.5}
          worldDistanceFalloff={sceneSize * 0.2}
          worldProximityThreshold={sceneSize * 0.1}
          worldProximityFalloff={sceneSize * 0.05}
        />
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.3}
          intensity={0.35}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.35} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </>
  );
}

export function SimulationScene({ profile }: SimulationSceneProps) {
  const cs = profile.crossSection;
  const span = cs[cs.length - 1].station - cs[0].station;
  const minElev = Math.min(...cs.map(p => p.elevation));
  const maxElev = Math.max(profile.bridge.highChord, profile.usWsel);
  const centerX = (cs[0].station + cs[cs.length - 1].station) / 2;
  const channelLength = Math.max(span * 0.6, 20);
  const centerZ = channelLength / 2;
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  return (
    <div className="w-full rounded-lg overflow-hidden h-[300px] sm:h-[400px] lg:h-[500px]" data-scene-capture>
      <Canvas
        shadows="soft"
        camera={{
          position: [
            centerX + sceneSize * 0.7,
            maxElev + sceneSize * 0.5,
            centerZ + sceneSize * 0.8,
          ],
          fov: 45,
          near: 0.1,
          far: sceneSize * 20,
        }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ background: 'oklch(0.14 0.01 230)' }}
      >
        <Suspense fallback={null}>
          <SceneContent profile={profile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

Key changes from original:
- `shadows="soft"` enables `PCFSoftShadowMap`
- `toneMapping: THREE.NoToneMapping` on the GL renderer since the postprocessing pipeline handles tone mapping
- `<Environment preset="city">` replaces ambientLight + hemisphereLight
- Shadow map bumped to 2048x2048 with `shadow-bias` tuning
- Shadow camera frustum sized to scene
- `<ContactShadows>` added under the bridge
- `<EffectComposer>` with SSAO, Bloom, ACES Filmic ToneMapping, Vignette
- Warm sun color `#fff5e6`, subtle blue fill `#c8d8f0`

- [ ] **Step 2: Verify build**

```bash
cd app && npx next build
```

Expected: Compiles successfully. There may be minor type warnings from postprocessing — as long as the build succeeds, proceed.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/simulation/scene-3d/simulation-scene.tsx
git commit -m "feat: add HDRI environment, post-processing pipeline, soft shadows"
```

---

### Task 3: Bridge materials — PBR upgrade

**Files:**
- Modify: `app/src/components/simulation/scene-3d/bridge-mesh.tsx`

Replace the flat material constants and swap the main deck to use `<RoundedBox>` from Drei for soft edges.

- [ ] **Step 1: Rewrite bridge-mesh.tsx**

Replace the entire file with:

```tsx
'use client';

import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { BridgeGeometry, CrossSectionPoint } from '@/engine/types';

interface BridgeMeshProps {
  bridge: BridgeGeometry;
  crossSection: CrossSectionPoint[];
  channelLength: number;
}

function interpGround(crossSection: CrossSectionPoint[], sta: number): number {
  for (let i = 0; i < crossSection.length - 1; i++) {
    if (crossSection[i].station <= sta && crossSection[i + 1].station >= sta) {
      const t = (sta - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
      return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
    }
  }
  return crossSection[crossSection.length - 1]?.elevation ?? 0;
}

export function BridgeMesh({ bridge, crossSection, channelLength }: BridgeMeshProps) {
  const bridgeZ = channelLength / 2;
  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  const lowChord = Math.min(bridge.lowChordLeft, bridge.lowChordRight);
  const deckThickness = bridge.highChord - lowChord;
  const deckDepth = bridge.deckWidth || Math.max(channelLength * 0.15, 3);
  const halfDepth = deckDepth / 2;

  const cx = bridge.leftAbutmentStation + span / 2;
  const leftGround = interpGround(crossSection, bridge.leftAbutmentStation);
  const rightGround = interpGround(crossSection, bridge.rightAbutmentStation);

  const railHeight = deckThickness * 0.6;
  const railThickness = deckThickness * 0.15;
  const postSpacing = span * 0.12;
  const postWidth = railThickness * 0.8;
  const postHeight = railHeight;
  const numPosts = Math.max(2, Math.floor(span / postSpacing));

  const wingLength = deckDepth * 0.6;
  const wingThickness = deckThickness * 0.3;

  return (
    <group>
      {/* === DECK (RoundedBox for soft edges) === */}
      <RoundedBox
        args={[span + 0.2, deckThickness, deckDepth]}
        radius={deckThickness * 0.06}
        smoothness={4}
        position={[cx, bridge.highChord - deckThickness / 2, bridgeZ]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#7a7580"
          roughness={0.93}
          metalness={0.03}
          envMapIntensity={0.4}
        />
      </RoundedBox>

      {/* Road surface */}
      <mesh position={[cx, bridge.highChord + 0.05, bridgeZ]} receiveShadow>
        <boxGeometry args={[span + 0.1, 0.1, deckDepth - railThickness * 2]} />
        <meshStandardMaterial color="#2a2a30" roughness={0.98} metalness={0.0} envMapIntensity={0.15} />
      </mesh>

      {/* Lane marking */}
      <mesh position={[cx, bridge.highChord + 0.11, bridgeZ]}>
        <boxGeometry args={[span * 0.9, 0.02, 0.08]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.6} metalness={0.0} emissive="#e5e7eb" emissiveIntensity={0.05} />
      </mesh>

      {/* === PARAPETS (RoundedBox for chamfered top) === */}
      <RoundedBox
        args={[span + 0.4, railHeight, railThickness]}
        radius={railThickness * 0.15}
        smoothness={3}
        position={[cx, bridge.highChord + railHeight / 2, bridgeZ - halfDepth + railThickness / 2]}
        castShadow
      >
        <meshStandardMaterial color="#9a9590" roughness={0.9} metalness={0.04} envMapIntensity={0.35} />
      </RoundedBox>

      <RoundedBox
        args={[span + 0.4, railHeight, railThickness]}
        radius={railThickness * 0.15}
        smoothness={3}
        position={[cx, bridge.highChord + railHeight / 2, bridgeZ + halfDepth - railThickness / 2]}
        castShadow
      >
        <meshStandardMaterial color="#9a9590" roughness={0.9} metalness={0.04} envMapIntensity={0.35} />
      </RoundedBox>

      {/* === RAILING POSTS + TOP RAILS (steel) === */}
      {Array.from({ length: numPosts + 1 }).map((_, i) => {
        const x = bridge.leftAbutmentStation + (span / numPosts) * i;
        return (
          <group key={`post-${i}`}>
            <mesh position={[x, bridge.highChord + postHeight / 2, bridgeZ - halfDepth + railThickness / 2]} castShadow>
              <boxGeometry args={[postWidth, postHeight, railThickness * 1.2]} />
              <meshStandardMaterial color="#c8c8d0" roughness={0.15} metalness={0.9} envMapIntensity={1.2} />
            </mesh>
            <mesh position={[x, bridge.highChord + postHeight / 2, bridgeZ + halfDepth - railThickness / 2]} castShadow>
              <boxGeometry args={[postWidth, postHeight, railThickness * 1.2]} />
              <meshStandardMaterial color="#c8c8d0" roughness={0.15} metalness={0.9} envMapIntensity={1.2} />
            </mesh>
          </group>
        );
      })}

      {/* Top rail bars (steel) */}
      <mesh position={[cx, bridge.highChord + railHeight * 0.95, bridgeZ - halfDepth + railThickness / 2]}>
        <boxGeometry args={[span + 0.4, railThickness * 0.4, railThickness * 0.5]} />
        <meshStandardMaterial color="#c8c8d0" roughness={0.15} metalness={0.9} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[cx, bridge.highChord + railHeight * 0.95, bridgeZ + halfDepth - railThickness / 2]}>
        <boxGeometry args={[span + 0.4, railThickness * 0.4, railThickness * 0.5]} />
        <meshStandardMaterial color="#c8c8d0" roughness={0.15} metalness={0.9} envMapIntensity={1.2} />
      </mesh>

      {/* === ABUTMENTS === */}
      <mesh
        position={[bridge.leftAbutmentStation - deckThickness * 0.25, leftGround + (bridge.highChord - leftGround) / 2, bridgeZ]}
        castShadow
      >
        <boxGeometry args={[deckThickness * 0.5, bridge.highChord - leftGround, deckDepth + 1]} />
        <meshStandardMaterial color="#8a847e" roughness={0.95} metalness={0.02} envMapIntensity={0.3} />
      </mesh>

      <mesh
        position={[bridge.rightAbutmentStation + deckThickness * 0.25, rightGround + (bridge.highChord - rightGround) / 2, bridgeZ]}
        castShadow
      >
        <boxGeometry args={[deckThickness * 0.5, bridge.highChord - rightGround, deckDepth + 1]} />
        <meshStandardMaterial color="#8a847e" roughness={0.95} metalness={0.02} envMapIntensity={0.3} />
      </mesh>

      {/* === WINGWALLS === */}
      {[bridge.leftAbutmentStation, bridge.rightAbutmentStation].map((abutSta, ai) => {
        const ground = ai === 0 ? leftGround : rightGround;
        const wallHeight = (bridge.highChord - ground) * 0.7;
        const xOff = ai === 0 ? -deckThickness * 0.4 : deckThickness * 0.4;
        return [bridgeZ - halfDepth - wingLength / 2, bridgeZ + halfDepth + wingLength / 2].map((wz, wi) => (
          <mesh key={`wing-${ai}-${wi}`} position={[abutSta + xOff, ground + wallHeight / 2, wz]} castShadow>
            <boxGeometry args={[wingThickness, wallHeight, wingLength]} />
            <meshStandardMaterial color="#8a847e" roughness={0.95} metalness={0.02} envMapIntensity={0.3} />
          </mesh>
        ));
      })}

      {/* === PIERS === */}
      {bridge.piers.map((pier, i) => {
        const pierGround = interpGround(crossSection, pier.station);
        const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
        const lowChordAtPier = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
        const pierHeight = lowChordAtPier - pierGround;
        const pierDepth = deckDepth * 0.7;

        return (
          <group key={i}>
            {/* Main pier body */}
            <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow>
              <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
              <meshStandardMaterial color="#9a9590" roughness={0.92} metalness={0.03} envMapIntensity={0.35} />
            </mesh>

            {/* Pier cap */}
            <RoundedBox
              args={[pier.width * 1.3, deckThickness * 0.2, pierDepth * 1.1]}
              radius={deckThickness * 0.03}
              smoothness={3}
              position={[pier.station, lowChordAtPier - deckThickness * 0.1, bridgeZ]}
              castShadow
            >
              <meshStandardMaterial color="#706a64" roughness={0.93} metalness={0.04} envMapIntensity={0.3} />
            </RoundedBox>

            {/* Cutwater */}
            <mesh
              position={[pier.station, pierGround + pierHeight * 0.4, bridgeZ - pierDepth / 2 - pier.width * 0.3]}
              rotation={[0, Math.PI / 4, 0]}
              castShadow
            >
              <boxGeometry args={[pier.width * 0.7, pierHeight * 0.8, pier.width * 0.7]} />
              <meshStandardMaterial color="#9a9590" roughness={0.92} metalness={0.03} envMapIntensity={0.35} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
```

Key changes from original:
- `RoundedBox` from Drei for deck slab and parapets (soft edges catch HDRI beautifully)
- `RoundedBox` for pier caps
- All materials use `envMapIntensity` to control how much HDRI reflection shows
- Steel: `metalness={0.9}`, `roughness={0.15}`, `envMapIntensity={1.2}` — will show real sky reflections
- Concrete: warm grey tones (`#9a9590`, `#8a847e`, `#7a7580`), high roughness, low metalness
- Asphalt: near-black `#2a2a30`, roughness 0.98
- Lane markings: subtle emissive for visibility
- Removed module-level JSX material constants (they don't pick up env maps properly)

- [ ] **Step 2: Verify build**

```bash
cd app && npx next build
```

Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/simulation/scene-3d/bridge-mesh.tsx
git commit -m "feat: PBR materials + RoundedBox geometry for bridge"
```

---

### Task 4: Terrain material enhancement

**Files:**
- Modify: `app/src/components/simulation/scene-3d/terrain-mesh.tsx`

Add a wet-edge color band near water level and tune PBR values for HDRI compatibility.

- [ ] **Step 1: Update terrain-mesh.tsx**

Replace the `elevToColor` function and material in `app/src/components/simulation/scene-3d/terrain-mesh.tsx`.

Find the `elevToColor` function (around line 41-48) and replace it with:

```tsx
    // Color palette: low = dark riverbed, near-water = wet earth, mid = earth, high = grass
    const bedColor = new THREE.Color('#2d1f15');      // dark brown (channel bed)
    const wetColor = new THREE.Color('#4a3928');       // wet earth near water line
    const earthColor = new THREE.Color('#6b4e3d');     // medium earth
    const bankColor = new THREE.Color('#4a6741');      // muted green (bank)

    function elevToColor(elev: number): THREE.Color {
      const t = (elev - minElev) / elevRange;
      if (t < 0.15) {
        return bedColor.clone().lerp(wetColor, t / 0.15);
      } else if (t < 0.35) {
        return wetColor.clone().lerp(earthColor, (t - 0.15) / 0.2);
      } else {
        return earthColor.clone().lerp(bankColor, (t - 0.35) / 0.65);
      }
    }
```

Then find the material JSX (around line 138-143) and replace with:

```tsx
      <meshStandardMaterial
        vertexColors
        roughness={0.88}
        metalness={0.02}
        side={THREE.DoubleSide}
        envMapIntensity={0.3}
      />
```

- [ ] **Step 2: Verify build**

```bash
cd app && npx next build
```

Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/simulation/scene-3d/terrain-mesh.tsx
git commit -m "feat: 4-band terrain coloring + PBR tuning for HDRI"
```

---

### Task 5: Water shader — Fresnel reflections + environment sampling

**Files:**
- Modify: `app/src/components/simulation/scene-3d/water-mesh.tsx`

Add Fresnel-based reflection and environment map sampling to the water shader.

- [ ] **Step 1: Update water-mesh.tsx**

This task modifies the existing shader code. The changes are:

1. Add `uEnvMap` uniform and `cameraPosition` varying to the shader
2. Add Fresnel calculation in fragment shader
3. Blend environment reflection with water color based on Fresnel

First, add the envMap uniform to `uniformsRef` (around line 79-86). Replace:

```tsx
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].base) },
    uHighlightColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].highlight) },
    uFoamColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].foam) },
    uVelocity: { value: velocityToShaderSpeed(velocity, channelLength) },
    uRegime: { value: flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0 },
  });
```

With:

```tsx
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].base) },
    uHighlightColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].highlight) },
    uFoamColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].foam) },
    uVelocity: { value: velocityToShaderSpeed(velocity, channelLength) },
    uRegime: { value: flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0 },
    uEnvMap: { value: null as THREE.Texture | null },
    uEnvMapIntensity: { value: 0.4 },
  });
```

Next, add an effect to grab the environment map from the scene. After the existing `useEffect` that updates uniform values (around line 89-97), add:

```tsx
  // Grab the environment map from the scene once it's available
  useEffect(() => {
    const checkEnv = () => {
      if (matRef.current) {
        const scene = (matRef.current as any).__r3f?.root?.getState?.()?.scene;
        if (scene?.environment) {
          uniformsRef.current.uEnvMap.value = scene.environment;
        }
      }
    };
    const timer = setTimeout(checkEnv, 500);
    return () => clearTimeout(timer);
  }, []);
```

Now replace the **vertex shader** string (the entire template literal) with:

```glsl
          uniform float uTime;
          uniform float uVelocity;
          uniform float uRegime;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vNormal;
          varying vec3 vViewDir;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          void main() {
            vUv = uv;
            vec3 pos = position;
            vWorldPos = pos;

            float speed = uVelocity;
            float turb = uRegime < 0.5 ? 1.0 : uRegime < 1.5 ? 1.8 : 2.8;
            float t = uTime;

            float w1 = sin(pos.z * 1.5 - t * speed * 1.4 + pos.x * 0.3) * 0.10 * turb;
            float w2 = sin(pos.z * 3.0 - t * speed * 2.0 + pos.x * 1.2) * 0.05 * turb;
            float w3 = sin(pos.z * 7.0 - t * speed * 3.0 - pos.x * 2.0) * 0.02 * turb;
            float w4 = sin(pos.x * 4.0 + t * 0.8) * 0.015 * turb;
            float n = noise(vec2(pos.x * 2.0 + t * 0.2, pos.z * 2.0 - t * speed * 0.6)) * 0.03 * turb;

            float totalWave = w1 + w2 + w3 + w4 + n;
            pos.y += totalWave;
            vWaveHeight = totalWave;

            float dx = cos(pos.z * 1.5 - t * speed * 1.4 + pos.x * 0.3) * 0.3 * 0.10 * turb
                      + cos(pos.z * 3.0 - t * speed * 2.0 + pos.x * 1.2) * 1.2 * 0.05 * turb;
            float dz = cos(pos.z * 1.5 - t * speed * 1.4 + pos.x * 0.3) * 1.5 * 0.10 * turb
                      + cos(pos.z * 3.0 - t * speed * 2.0 + pos.x * 1.2) * 3.0 * 0.05 * turb;
            vNormal = normalize(vec3(-dx, 1.0, -dz));

            // View direction for Fresnel
            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vViewDir = normalize(cameraPosition - worldPos.xyz);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
```

And replace the **fragment shader** string with:

```glsl
          uniform float uTime;
          uniform vec3 uBaseColor;
          uniform vec3 uHighlightColor;
          uniform vec3 uFoamColor;
          uniform float uVelocity;
          uniform float uRegime;
          uniform float uEnvMapIntensity;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vNormal;
          varying vec3 vViewDir;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          void main() {
            float speed = uVelocity;

            // Fresnel — more reflective at glancing angles
            float fresnel = pow(1.0 - max(dot(vViewDir, vNormal), 0.0), 3.0);
            fresnel = mix(0.04, 1.0, fresnel); // F0 = 0.04 for water

            // Flow streaks scrolling downstream
            float flowUV = vWorldPos.z * 3.0 - uTime * speed * 1.4;
            float streak = noise(vec2(vWorldPos.x * 4.0, flowUV * 2.0));
            streak = smoothstep(0.35, 0.65, streak);

            // Foam on wave peaks
            float foam = smoothstep(0.05, 0.12, vWaveHeight);
            foam *= noise(vec2(vWorldPos.x * 8.0 + uTime * 0.3, vWorldPos.z * 8.0 - uTime * speed * 0.7));
            foam = smoothstep(0.3, 0.7, foam);

            // Caustic pattern
            float c1 = noise(vec2(vWorldPos.x * 6.0 + uTime * 0.25, vWorldPos.z * 6.0 - uTime * speed * 0.5));
            float c2 = noise(vec2(vWorldPos.x * 6.0 - uTime * 0.2, vWorldPos.z * 6.0 + uTime * speed * 0.4));
            float caustic = smoothstep(0.3, 0.7, abs(c1 - c2)) * 0.25;

            // Edge fade
            float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);

            // Lighting
            vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
            float diffuse = max(dot(vNormal, lightDir), 0.0);
            float specular = pow(max(dot(reflect(-lightDir, vNormal), vViewDir), 0.0), 64.0);

            // Environment reflection approximation (sky color blend)
            vec3 reflectDir = reflect(-vViewDir, vNormal);
            float skyFactor = smoothstep(-0.1, 0.5, reflectDir.y);
            vec3 envColor = mix(
              vec3(0.15, 0.18, 0.22),  // horizon (dark)
              vec3(0.45, 0.55, 0.7),   // sky (blue-grey)
              skyFactor
            ) * uEnvMapIntensity;

            // Compose water color
            vec3 waterColor = mix(uBaseColor, uHighlightColor, streak * 0.4 + diffuse * 0.3);
            waterColor += caustic * uHighlightColor;
            waterColor += specular * 0.35;
            waterColor = mix(waterColor, uFoamColor, foam * 0.5);

            // Blend water color with environment reflection via Fresnel
            vec3 col = mix(waterColor, envColor + specular * 0.3, fresnel * 0.6);

            float alpha = (0.55 + fresnel * 0.3) * edgeFade + foam * 0.15 + specular * 0.1;
            alpha = clamp(alpha, 0.0, 0.88);

            gl_FragColor = vec4(col, alpha);
          }
```

Key shader changes:
- Added `vViewDir` varying computed from `cameraPosition` (built-in in Three.js shaders)
- Fresnel: `pow(1.0 - dot(viewDir, normal), 3.0)` with F0=0.04 for water
- Specular power bumped from 32 to 64 for tighter highlights
- Environment reflection approximation via `reflect()` direction → sky gradient blend
- Fresnel controls the blend between water color and environment reflection (60%)
- Alpha now incorporates Fresnel — more opaque at glancing angles (more realistic)
- Overall alpha cap raised to 0.88

- [ ] **Step 2: Verify build**

```bash
cd app && npx next build
```

Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/simulation/scene-3d/water-mesh.tsx
git commit -m "feat: Fresnel reflections + environment-aware water shader"
```

---

### Task 6: Final build verification + visual QA

**Files:** None (verification only)

- [ ] **Step 1: Full build**

```bash
cd app && npx next build
```

Expected: Compiles with zero errors.

- [ ] **Step 2: Run dev server and visual check**

```bash
cd app && npx next dev
```

Open the app, navigate to the Simulation tab with test data loaded. Visually verify:
- HDRI environment reflections visible on steel railings
- Water has Fresnel effect (more reflective at edges, transparent looking down)
- Bloom visible on water specular highlights
- SSAO darkening visible under bridge deck and between piers
- Soft shadows from directional light
- Contact shadows under bridge
- Tone mapping gives cinematic color (not washed out, not too dark)
- Vignette subtle at edges
- Bridge deck has soft rounded edges (not sharp box corners)
- Terrain colors have 4-band gradient (bed → wet → earth → grass)
- Performance: smooth 60fps on orbit/zoom

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: 3D scene visual upgrade — PBR, HDRI, post-processing pipeline"
```
