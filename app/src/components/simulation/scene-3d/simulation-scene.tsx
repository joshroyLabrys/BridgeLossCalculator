'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
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

  // Bridge deck width (Z-axis) — use the user's exact value
  const bridgeDeckWidth = bridge.deckWidth > 0
    ? bridge.deckWidth
    : Math.max(span * 0.3, 8);

  // Channel length (Z-axis terrain extent) — must be shorter than the bridge
  // so the bridge road visibly extends from bank to bank beyond the water
  const channelLength = Math.max(bridgeDeckWidth * 0.6, span * 0.4, 15);

  const centerX = (cs[0].station + cs[cs.length - 1].station) / 2;
  const minElev = Math.min(...cs.map(p => p.elevation));
  const maxElev = Math.max(bridge.highChord, profile.usWsel);
  const centerY = (minElev + maxElev) / 2;
  const centerZ = channelLength / 2;
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  return (
    <>
      {/* HDRI environment — provides IBL + reflections on all PBR surfaces */}
      <Environment preset="sunset" background={false} environmentIntensity={0.9} />

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
          piers: bridge.piers,
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
        <N8AO
          aoRadius={2.0}
          distanceFalloff={0.5}
          intensity={2.5}
          quality="medium"
        />
        <Bloom
          luminanceThreshold={0.75}
          luminanceSmoothing={0.3}
          intensity={0.4}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.25} darkness={0.4} blendFunction={BlendFunction.NORMAL} />
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
