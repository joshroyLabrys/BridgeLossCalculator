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

const REGIME_COLORS: Record<FlowRegime, { base: string; highlight: string; foam: string }> = {
  'free-surface': { base: '#1e40af', highlight: '#60a5fa', foam: '#bfdbfe' },
  'pressure':     { base: '#92400e', highlight: '#fbbf24', foam: '#fef3c7' },
  'overtopping':  { base: '#991b1b', highlight: '#f87171', foam: '#fecaca' },
};

export function WaterMesh({ crossSection, wsel, channelLength, flowRegime, velocity }: WaterMeshProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { leftStation, rightStation } = useMemo(() => {
    let left = Infinity;
    let right = -Infinity;
    for (let i = 0; i < crossSection.length - 1; i++) {
      const p0 = crossSection[i];
      const p1 = crossSection[i + 1];
      if (p0.elevation <= wsel || p1.elevation <= wsel) {
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

    // High resolution for convincing waves
    const segX = 64;
    const segZ = 48;
    const geo = new THREE.PlaneGeometry(width, channelLength, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(leftStation + width / 2, wsel, channelLength / 2);
    return geo;
  }, [leftStation, rightStation, wsel, channelLength]);

  const colors = REGIME_COLORS[flowRegime];

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(colors.base) },
    uHighlightColor: { value: new THREE.Color(colors.highlight) },
    uFoamColor: { value: new THREE.Color(colors.foam) },
    uVelocity: { value: Math.max(velocity * 0.15, 0.5) },
    uRegime: { value: flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0 },
  }), [colors, velocity, flowRegime]);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        vertexShader={`
          uniform float uTime;
          uniform float uVelocity;
          uniform float uRegime;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vNormal;

          // Simple noise
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
            float turbulence = uRegime < 0.5 ? 1.0 : uRegime < 1.5 ? 2.0 : 3.0;

            // Multi-octave waves flowing downstream (along Z)
            float t = uTime;

            // Primary wave — large, slow swell
            float w1 = sin(pos.z * 1.5 - t * speed * 2.0 + pos.x * 0.3) * 0.12 * turbulence;

            // Secondary — medium ripples
            float w2 = sin(pos.z * 3.0 - t * speed * 3.0 + pos.x * 1.2) * 0.06 * turbulence;

            // Tertiary — small chop
            float w3 = sin(pos.z * 7.0 - t * speed * 5.0 - pos.x * 2.0) * 0.025 * turbulence;

            // Cross-waves (perpendicular disturbance)
            float w4 = sin(pos.x * 4.0 + t * 1.2) * 0.02 * turbulence;

            // Noise-based detail
            float n = noise(vec2(pos.x * 2.0 + t * 0.3, pos.z * 2.0 - t * speed)) * 0.04 * turbulence;

            float totalWave = w1 + w2 + w3 + w4 + n;
            pos.y += totalWave;
            vWaveHeight = totalWave;

            // Compute approximate normal for lighting
            float dx = cos(pos.z * 1.5 - t * speed * 2.0 + pos.x * 0.3) * 0.3 * 0.12 * turbulence
                      + cos(pos.z * 3.0 - t * speed * 3.0 + pos.x * 1.2) * 1.2 * 0.06 * turbulence;
            float dz = cos(pos.z * 1.5 - t * speed * 2.0 + pos.x * 0.3) * 1.5 * 0.12 * turbulence
                      + cos(pos.z * 3.0 - t * speed * 3.0 + pos.x * 1.2) * 3.0 * 0.06 * turbulence;
            vNormal = normalize(vec3(-dx, 1.0, -dz));

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uBaseColor;
          uniform vec3 uHighlightColor;
          uniform vec3 uFoamColor;
          uniform float uVelocity;
          uniform float uRegime;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vNormal;

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

            // --- Flow streaks (scrolling along Z) ---
            float flowUV = vWorldPos.z * 3.0 - uTime * speed * 2.0;
            float streak = noise(vec2(vWorldPos.x * 4.0, flowUV * 2.0));
            streak = smoothstep(0.35, 0.65, streak);

            // --- Foam / whitecaps on wave peaks ---
            float foam = smoothstep(0.06, 0.14, vWaveHeight);
            foam *= noise(vec2(vWorldPos.x * 8.0 + uTime * 0.5, vWorldPos.z * 8.0 - uTime * speed));
            foam = smoothstep(0.3, 0.7, foam);

            // --- Caustic-like pattern ---
            float c1 = noise(vec2(vWorldPos.x * 6.0 + uTime * 0.4, vWorldPos.z * 6.0 - uTime * speed * 0.8));
            float c2 = noise(vec2(vWorldPos.x * 6.0 - uTime * 0.3, vWorldPos.z * 6.0 + uTime * speed * 0.6));
            float caustic = smoothstep(0.3, 0.7, abs(c1 - c2)) * 0.3;

            // --- Fresnel-like edge darkening ---
            float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);

            // --- Simple directional light on the normal ---
            vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
            float diffuse = max(dot(vNormal, lightDir), 0.0);
            float specular = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 1.0, 0.0)), 0.0), 32.0);

            // --- Compose ---
            vec3 col = mix(uBaseColor, uHighlightColor, streak * 0.5 + diffuse * 0.3);
            col += caustic * uHighlightColor;
            col += specular * 0.25;
            col = mix(col, uFoamColor, foam * 0.6);

            // Alpha: solid in center, fade at edges
            float alpha = 0.65 * edgeFade + foam * 0.2 + specular * 0.1;
            alpha = clamp(alpha, 0.0, 0.85);

            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}
