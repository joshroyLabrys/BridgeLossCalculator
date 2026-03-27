'use client';

import { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text } from '@react-three/drei';
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

  // Channel length along Z — proportional to the span width for good proportions
  const span = cs[cs.length - 1].station - cs[0].station;
  const channelLength = span * 0.6;

  // Center the scene
  const centerX = (cs[0].station + cs[cs.length - 1].station) / 2;
  const minElev = Math.min(...cs.map(p => p.elevation));
  const maxElev = Math.max(profile.bridge.highChord, profile.usWsel);
  const centerY = (minElev + maxElev) / 2;
  const centerZ = channelLength / 2;

  // Camera target and distance
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[centerX + span, maxElev + 20, centerZ + channelLength]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[centerX - span * 0.5, maxElev + 10, centerZ - channelLength * 0.5]}
        intensity={0.3}
      />

      {/* Terrain */}
      <TerrainMesh
        crossSection={cs}
        channelLength={channelLength}
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
          ...({} as any),
          lowChordLeft: bridge.lowChordLeft,
          lowChordRight: bridge.lowChordRight,
          highChord: bridge.highChord,
          leftAbutmentStation: bridge.stationStart,
          rightAbutmentStation: bridge.stationEnd,
          deckWidth: bridge.deckWidth || channelLength * 0.15,
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

      {/* Grid floor */}
      <Grid
        args={[span * 2, channelLength * 3]}
        position={[centerX, minElev - 2, centerZ]}
        cellSize={span * 0.05}
        cellThickness={0.5}
        cellColor="#333344"
        sectionSize={span * 0.2}
        sectionThickness={1}
        sectionColor="#444466"
        fadeDistance={sceneSize * 3}
        fadeStrength={1}
        infiniteGrid
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
  const channelLength = span * 0.6;
  const centerZ = channelLength / 2;
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  return (
    <div className="w-full rounded-lg overflow-hidden" style={{ height: 500 }}>
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
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'oklch(0.14 0.01 230)' }}
      >
        <Suspense fallback={null}>
          <SceneContent profile={profile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
