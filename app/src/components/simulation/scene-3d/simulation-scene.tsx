'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
  // Channel length: proportional to span, enough to see flow
  const channelLength = Math.max(span * 0.6, 20);

  // A real bridge road is roughly 8-12m (26-40ft) wide.
  // Default to ~30% of span if deckWidth isn't set, minimum 8 units.
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
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[centerX + span, maxElev + 20, centerZ + channelLength]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[centerX - span * 0.5, maxElev + 10, centerZ - channelLength * 0.5]}
        intensity={0.35}
      />
      {/* Fill light from below/side for better terrain visibility */}
      <hemisphereLight
        args={['#8cacb8', '#4a3728', 0.3]}
      />

      {/* Terrain */}
      <TerrainMesh crossSection={cs} channelLength={channelLength} />

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
      />
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
        shadows
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
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ background: 'oklch(0.14 0.01 230)' }}
      >
        <Suspense fallback={null}>
          <SceneContent profile={profile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
