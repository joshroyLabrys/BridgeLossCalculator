'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrossSectionPoint, FlowRegime } from '@/engine/types';

interface WaterMeshProps {
  crossSection: CrossSectionPoint[];
  wsel: number;
  channelLength: number;
  flowRegime: FlowRegime;
  velocity: number;
}

const REGIME_COLORS: Record<FlowRegime, string> = {
  'free-surface': '#3b82f6',
  'pressure': '#f59e0b',
  'overtopping': '#ef4444',
};

/**
 * Animated water surface. A plane at the WSEL elevation, clipped to the
 * wetted cross-section width. The vertex shader adds gentle wave motion
 * and the surface scrolls along Z to show flow direction.
 */
export function WaterMesh({ crossSection, wsel, channelLength, flowRegime, velocity }: WaterMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Find the wetted width at WSEL
  const { leftStation, rightStation } = useMemo(() => {
    let left = Infinity;
    let right = -Infinity;
    for (let i = 0; i < crossSection.length - 1; i++) {
      const p0 = crossSection[i];
      const p1 = crossSection[i + 1];
      // Check if this segment crosses the WSEL
      if (p0.elevation <= wsel || p1.elevation <= wsel) {
        // Find intersection points
        if (p0.elevation <= wsel && p1.elevation <= wsel) {
          if (p0.station < left) left = p0.station;
          if (p1.station > right) right = p1.station;
        } else if (p0.elevation > wsel && p1.elevation <= wsel) {
          const t = (wsel - p0.elevation) / (p1.elevation - p0.elevation);
          const intersect = p0.station + t * (p1.station - p0.station);
          if (intersect < left) left = intersect;
          if (p1.station > right) right = p1.station;
        } else if (p0.elevation <= wsel && p1.elevation > wsel) {
          const t = (wsel - p0.elevation) / (p1.elevation - p0.elevation);
          const intersect = p0.station + t * (p1.station - p0.station);
          if (p0.station < left) left = p0.station;
          if (intersect > right) right = intersect;
        }
      }
    }
    return {
      leftStation: left === Infinity ? crossSection[0].station : left,
      rightStation: right === -Infinity ? crossSection[crossSection.length - 1].station : right,
    };
  }, [crossSection, wsel]);

  const geometry = useMemo(() => {
    const width = rightStation - leftStation;
    if (width <= 0) return null;

    const segX = 20; // segments across
    const segZ = 10; // segments along flow
    const geo = new THREE.PlaneGeometry(width, channelLength, segX, segZ);
    // Rotate so it lies flat (XZ plane)
    geo.rotateX(-Math.PI / 2);
    // Position: center on the wetted width, at WSEL elevation
    geo.translate(
      leftStation + width / 2,
      wsel,
      channelLength / 2,
    );
    return geo;
  }, [leftStation, rightStation, wsel, channelLength]);

  const color = REGIME_COLORS[flowRegime];

  // Shader for animated waves
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uVelocity: { value: velocity },
    uFlowRegime: { value: flowRegime === 'free-surface' ? 0 : flowRegime === 'pressure' ? 1 : 2 },
  }), [color, velocity, flowRegime]);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={1}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        vertexShader={`
          uniform float uTime;
          uniform float uVelocity;
          uniform float uFlowRegime;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            vUv = uv;
            vec3 pos = position;

            // Wave amplitude based on flow regime
            float amp = uFlowRegime < 0.5 ? 0.15 : uFlowRegime < 1.5 ? 0.3 : 0.5;

            // Gentle wave motion
            float wave1 = sin(pos.x * 2.0 + pos.z * 1.5 + uTime * 2.0) * amp * 0.5;
            float wave2 = sin(pos.x * 3.5 - pos.z * 0.8 + uTime * 1.5) * amp * 0.3;
            float wave3 = sin(pos.z * 4.0 + uTime * 3.0) * amp * 0.2;

            pos.y += wave1 + wave2 + wave3;
            vWave = wave1 + wave2 + wave3;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uVelocity;
          varying vec2 vUv;
          varying float vWave;

          void main() {
            // Flow lines scrolling along the channel
            float flow = fract(vUv.y * 8.0 - uTime * 0.5);
            float flowLine = smoothstep(0.0, 0.05, flow) * smoothstep(0.15, 0.1, flow);

            // Edge fade
            float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);

            // Combine: base color + flow highlight + wave brightness
            vec3 col = uColor;
            col += flowLine * 0.15;
            col += vWave * 0.3;

            float alpha = 0.45 * edgeFade + flowLine * 0.1;

            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}
