'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrossSectionPoint } from '@flowsuite/engine/types';

interface SprayParticlesProps {
  crossSection: CrossSectionPoint[];
  channelLength: number;
  wsel: number;
  velocity: number;
  pierStations: number[];
}

const SPRAY_COUNT = 200;
const MIST_COUNT = 80;

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function interpElevation(cs: CrossSectionPoint[], sta: number): number {
  for (let i = 0; i < cs.length - 1; i++) {
    if (cs[i].station <= sta && cs[i + 1].station >= sta) {
      const t = (sta - cs[i].station) / (cs[i + 1].station - cs[i].station);
      return cs[i].elevation + t * (cs[i + 1].elevation - cs[i].elevation);
    }
  }
  return cs[cs.length - 1]?.elevation ?? 0;
}

/* ── Pier Spray ── */
function PierSpray({ pierX, wsel, channelZ, velocity }: {
  pierX: number; wsel: number; channelZ: number; velocity: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleData = useRef<{ offsets: Float32Array; velocities: Float32Array; lifetimes: Float32Array } | null>(null);

  useMemo(() => {
    if (!meshRef.current) return;
    const offsets = new Float32Array(SPRAY_COUNT * 3);
    const velocities = new Float32Array(SPRAY_COUNT * 3);
    const lifetimes = new Float32Array(SPRAY_COUNT);

    for (let i = 0; i < SPRAY_COUNT; i++) {
      offsets[i * 3]     = (seededRandom(i) - 0.5) * 1.5;
      offsets[i * 3 + 1] = seededRandom(i + 1000) * 0.5;
      offsets[i * 3 + 2] = (seededRandom(i + 2000) - 0.5) * 2.0;

      velocities[i * 3]     = (seededRandom(i + 3000) - 0.5) * 0.8;
      velocities[i * 3 + 1] = seededRandom(i + 4000) * 2.0 + 0.5;
      velocities[i * 3 + 2] = -(seededRandom(i + 5000) * 1.5 + 0.5);

      lifetimes[i] = seededRandom(i + 6000);
    }

    particleData.current = { offsets, velocities, lifetimes };
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !particleData.current) return;
    const { offsets, velocities, lifetimes } = particleData.current;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    const sprayIntensity = Math.min(velocity / 5.0, 1.5);

    for (let i = 0; i < SPRAY_COUNT; i++) {
      const life = (t * 0.8 + lifetimes[i]) % 1.0;
      const x = pierX + offsets[i * 3] + velocities[i * 3] * life * sprayIntensity * 0.3;
      const y = wsel + offsets[i * 3 + 1] + velocities[i * 3 + 1] * life * sprayIntensity * 0.4 - life * life * 2.0;
      const z = channelZ + offsets[i * 3 + 2] + velocities[i * 3 + 2] * life * sprayIntensity * 0.5;

      const scale = (1.0 - life) * 0.08 * sprayIntensity;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(Math.max(0.01, scale));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, SPRAY_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#d0dce8" transparent opacity={0.15} depthWrite={false} />
    </instancedMesh>
  );
}

/* ── Atmospheric Mist ── */
function AtmosphericMist({ crossSection, channelLength, wsel }: {
  crossSection: CrossSectionPoint[]; channelLength: number; wsel: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particleData = useRef<Float32Array | null>(null);

  const minSta = crossSection[0]?.station ?? 0;
  const maxSta = crossSection[crossSection.length - 1]?.station ?? 100;
  const span = maxSta - minSta;

  useMemo(() => {
    const seeds = new Float32Array(MIST_COUNT * 4);
    for (let i = 0; i < MIST_COUNT; i++) {
      seeds[i * 4]     = seededRandom(i + 80000); // x phase
      seeds[i * 4 + 1] = seededRandom(i + 81000); // z phase
      seeds[i * 4 + 2] = seededRandom(i + 82000); // scale
      seeds[i * 4 + 3] = seededRandom(i + 83000); // drift speed
    }
    particleData.current = seeds;
  }, []);

  useFrame((state) => {
    if (!meshRef.current || !particleData.current) return;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < MIST_COUNT; i++) {
      const xPhase = particleData.current[i * 4];
      const zPhase = particleData.current[i * 4 + 1];
      const scaleBase = particleData.current[i * 4 + 2];
      const driftSpeed = particleData.current[i * 4 + 3];

      const x = minSta + xPhase * span + Math.sin(t * 0.1 * driftSpeed + xPhase * 10) * 2;
      const z = zPhase * channelLength + Math.cos(t * 0.08 * driftSpeed + zPhase * 10) * 2;
      const y = wsel + 0.5 + Math.sin(t * 0.15 + xPhase * 5) * 0.3;

      const scale = 1.5 + scaleBase * 2.5;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MIST_COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#c8d8e8" transparent opacity={0.04} depthWrite={false} />
    </instancedMesh>
  );
}

/* ── Combined export ── */
export function SprayParticles({ crossSection, channelLength, wsel, velocity, pierStations }: SprayParticlesProps) {
  const channelZ = channelLength / 2;

  // Only show spray if there are piers and meaningful velocity
  if (pierStations.length === 0 || velocity < 1) return null;

  return (
    <group>
      {pierStations.map((sta, i) => (
        <PierSpray
          key={`spray-${i}`}
          pierX={sta}
          wsel={wsel}
          channelZ={channelZ}
          velocity={velocity}
        />
      ))}
    </group>
  );
}
