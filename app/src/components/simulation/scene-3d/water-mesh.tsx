'use client';

import { useMemo, useRef, useEffect } from 'react';
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

/**
 * Convert actual approach velocity (ft/s) to a shader scroll speed.
 * A typical channel velocity of ~5 ft/s should produce a gentle visible flow.
 * We scale relative to the channel length so the visual rate makes sense
 * regardless of model size.
 */
function velocityToShaderSpeed(velocity: number, channelLength: number): number {
  // Normalise: how many channel-lengths per second does the water travel?
  // Then scale down for a pleasant visual (full traversal in ~4-8 seconds)
  if (channelLength <= 0) return 0.3;
  const traversalsPerSec = velocity / channelLength;
  // Clamp to a reasonable visual range
  return Math.max(0.15, Math.min(1.2, traversalsPerSec * 2));
}

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
    const geo = new THREE.PlaneGeometry(width, channelLength, 64, 48);
    geo.rotateX(-Math.PI / 2);
    geo.translate(leftStation + width / 2, wsel, channelLength / 2);
    return geo;
  }, [leftStation, rightStation, wsel, channelLength]);

  // Create uniforms once, update values imperatively so uTime never resets
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].base) },
    uHighlightColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].highlight) },
    uFoamColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].foam) },
    uVelocity: { value: velocityToShaderSpeed(velocity, channelLength) },
    uRegime: { value: flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0 },
  });

  // Update uniform values when props change — without recreating the object
  useEffect(() => {
    const u = uniformsRef.current;
    const colors = REGIME_COLORS[flowRegime];
    u.uBaseColor.value.set(colors.base);
    u.uHighlightColor.value.set(colors.highlight);
    u.uFoamColor.value.set(colors.foam);
    u.uVelocity.value = velocityToShaderSpeed(velocity, channelLength);
    u.uRegime.value = flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0;
  }, [flowRegime, velocity, channelLength]);

  useFrame((_, delta) => {
    uniformsRef.current.uTime.value += delta;
    // Also push to material ref in case React replaced it
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = uniformsRef.current.uTime.value;
    }
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniformsRef.current}
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

            // Primary swell (downstream)
            float w1 = sin(pos.z * 1.5 - t * speed * 1.4 + pos.x * 0.3) * 0.10 * turb;
            // Medium ripples
            float w2 = sin(pos.z * 3.0 - t * speed * 2.0 + pos.x * 1.2) * 0.05 * turb;
            // Small chop
            float w3 = sin(pos.z * 7.0 - t * speed * 3.0 - pos.x * 2.0) * 0.02 * turb;
            // Cross-wave
            float w4 = sin(pos.x * 4.0 + t * 0.8) * 0.015 * turb;
            // Noise detail
            float n = noise(vec2(pos.x * 2.0 + t * 0.2, pos.z * 2.0 - t * speed * 0.6)) * 0.03 * turb;

            float totalWave = w1 + w2 + w3 + w4 + n;
            pos.y += totalWave;
            vWaveHeight = totalWave;

            float dx = cos(pos.z * 1.5 - t * speed * 1.4 + pos.x * 0.3) * 0.3 * 0.10 * turb
                      + cos(pos.z * 3.0 - t * speed * 2.0 + pos.x * 1.2) * 1.2 * 0.05 * turb;
            float dz = cos(pos.z * 1.5 - t * speed * 1.4 + pos.x * 0.3) * 1.5 * 0.10 * turb
                      + cos(pos.z * 3.0 - t * speed * 2.0 + pos.x * 1.2) * 3.0 * 0.05 * turb;
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
            float specular = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 1.0, 0.0)), 0.0), 32.0);

            // Compose
            vec3 col = mix(uBaseColor, uHighlightColor, streak * 0.4 + diffuse * 0.3);
            col += caustic * uHighlightColor;
            col += specular * 0.2;
            col = mix(col, uFoamColor, foam * 0.5);

            float alpha = 0.6 * edgeFade + foam * 0.15 + specular * 0.08;
            alpha = clamp(alpha, 0.0, 0.82);

            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}
