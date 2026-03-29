'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrossSectionPoint } from '@flowsuite/engine/types';

interface GrassMeshProps {
  crossSection: CrossSectionPoint[];
  channelLength: number;
  wsel: number;
}

const BLADE_COUNT = 8000;
const BLADE_WIDTH = 0.08;
const BLADE_HEIGHT_MIN = 0.3;
const BLADE_HEIGHT_MAX = 0.8;

// Seeded random for deterministic placement
function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function interpElevation(crossSection: CrossSectionPoint[], station: number): number {
  for (let i = 0; i < crossSection.length - 1; i++) {
    if (crossSection[i].station <= station && crossSection[i + 1].station >= station) {
      const t = (station - crossSection[i].station) / (crossSection[i + 1].station - crossSection[i].station);
      return crossSection[i].elevation + t * (crossSection[i + 1].elevation - crossSection[i].elevation);
    }
  }
  return crossSection[crossSection.length - 1]?.elevation ?? 0;
}

export function GrassMesh({ crossSection, channelLength, wsel }: GrassMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry, grassData } = useMemo(() => {
    if (crossSection.length < 2) return { geometry: null, grassData: null };

    const minSta = crossSection[0].station;
    const maxSta = crossSection[crossSection.length - 1].station;

    // Collect valid grass positions (above waterline)
    const positions: { x: number; y: number; z: number; height: number; angle: number }[] = [];

    for (let i = 0; i < BLADE_COUNT * 3; i++) {
      const r1 = seededRandom(i);
      const r2 = seededRandom(i + 10000);
      const r3 = seededRandom(i + 20000);
      const r4 = seededRandom(i + 30000);

      const station = minSta + r1 * (maxSta - minSta);
      const z = r2 * channelLength;
      const elev = interpElevation(crossSection, station);

      // Only place grass above waterline with margin
      if (elev > wsel + 0.3) {
        positions.push({
          x: station,
          y: elev,
          z,
          height: BLADE_HEIGHT_MIN + r3 * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN),
          angle: r4 * Math.PI * 2,
        });
      }
      if (positions.length >= BLADE_COUNT) break;
    }

    // Create blade geometry — a tapered quad (2 triangles)
    const verts = new Float32Array([
      // Triangle 1
      -BLADE_WIDTH / 2, 0, 0,
       BLADE_WIDTH / 2, 0, 0,
       0, 1, 0,
      // Triangle 2
       BLADE_WIDTH / 2, 0, 0,
       BLADE_WIDTH / 4, 1, 0,
       0, 1, 0,
    ]);
    const uvs = new Float32Array([
      0, 0,  1, 0,  0.5, 1,
      1, 0,  0.75, 1,  0.5, 1,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    return { geometry: geo, grassData: positions };
  }, [crossSection, channelLength, wsel]);

  // Set up instance matrices
  useMemo(() => {
    if (!meshRef.current || !grassData) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < grassData.length; i++) {
      const g = grassData[i];
      dummy.position.set(g.x, g.y, g.z);
      dummy.rotation.set(0, g.angle, 0);
      dummy.scale.set(1, g.height, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color: brown at base → green at tip (handled by shader), but instance color varies
      const greenVariation = 0.6 + seededRandom(i + 50000) * 0.4;
      color.setRGB(0.25 * greenVariation, 0.45 * greenVariation, 0.15 * greenVariation);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [grassData]);

  // Wind animation
  useFrame((state) => {
    if (!meshRef.current || !meshRef.current.material) return;
    const mat = meshRef.current.material as THREE.ShaderMaterial;
    if (mat.uniforms?.uTime) {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  if (!geometry || !grassData || grassData.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, grassData.length]}
      frustumCulled={false}
    >
      <shaderMaterial
        uniforms={{
          uTime: { value: 0 },
        }}
        vertexShader={`
          uniform float uTime;
          attribute vec3 instanceColor;
          varying vec2 vUv;
          varying vec3 vColor;

          void main() {
            vUv = uv;
            vColor = instanceColor;

            vec3 pos = position;

            // Wind displacement — increases with height (uv.y)
            float windStrength = 0.3;
            float heightFactor = uv.y * uv.y; // quadratic — tips bend more

            // Use instance position for varied wind phase
            vec4 worldInst = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float windPhase = worldInst.x * 0.5 + worldInst.z * 0.3;

            float windX = sin(uTime * 1.5 + windPhase) * windStrength * heightFactor;
            float windZ = cos(uTime * 1.1 + windPhase * 0.7) * windStrength * 0.5 * heightFactor;

            // Gusts
            float gust = sin(uTime * 0.3 + worldInst.x * 0.1) * 0.5 + 0.5;
            windX *= (1.0 + gust * 0.6);

            pos.x += windX;
            pos.z += windZ;

            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          varying vec3 vColor;

          void main() {
            // Gradient from brown base to green tip
            vec3 baseColor = vec3(0.2, 0.15, 0.05); // brown root
            vec3 tipColor = vColor; // green from instance color

            vec3 col = mix(baseColor, tipColor, vUv.y);

            // Slight darkening at very base
            col *= (0.6 + 0.4 * vUv.y);

            // Alpha fade at tip for soft look
            float alpha = smoothstep(1.0, 0.85, vUv.y);

            gl_FragColor = vec4(col, alpha);
          }
        `}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
