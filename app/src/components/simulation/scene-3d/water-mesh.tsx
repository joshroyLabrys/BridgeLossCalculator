'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrossSectionPoint, FlowRegime } from '@/engine/types';

interface BridgeBounds {
  xMin: number;
  xMax: number;
  yBottom: number;
  yTop: number;
  zMin: number;
  zMax: number;
}

interface WaterMeshProps {
  crossSection: CrossSectionPoint[];
  wsel: number;
  channelLength: number;
  flowRegime: FlowRegime;
  velocity: number;
  bridgeBounds?: BridgeBounds;
}

const REGIME_COLORS: Record<FlowRegime, { base: string; highlight: string; foam: string }> = {
  'free-surface': { base: '#1e40af', highlight: '#60a5fa', foam: '#bfdbfe' },
  'pressure':     { base: '#92400e', highlight: '#fbbf24', foam: '#fef3c7' },
  'overtopping':  { base: '#991b1b', highlight: '#f87171', foam: '#fecaca' },
};

function velocityToShaderSpeed(velocity: number, channelLength: number): number {
  if (channelLength <= 0) return 0.3;
  const traversalsPerSec = velocity / channelLength;
  return Math.max(0.15, Math.min(1.2, traversalsPerSec * 2));
}

export function WaterMesh({ crossSection, wsel, channelLength, flowRegime, velocity, bridgeBounds }: WaterMeshProps) {
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
    const geo = new THREE.PlaneGeometry(width, channelLength, 80, 60);
    geo.rotateX(-Math.PI / 2);
    geo.translate(leftStation + width / 2, wsel, channelLength / 2);
    return geo;
  }, [leftStation, rightStation, wsel, channelLength]);

  const bb = bridgeBounds ?? { xMin: 0, xMax: 0, yBottom: 0, yTop: 0, zMin: 0, zMax: 0 };

  const uniformsRef = useRef({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].base) },
    uHighlightColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].highlight) },
    uFoamColor: { value: new THREE.Color(REGIME_COLORS[flowRegime].foam) },
    uVelocity: { value: velocityToShaderSpeed(velocity, channelLength) },
    uRegime: { value: flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0 },
    uBridgeMin: { value: new THREE.Vector3(bb.xMin, bb.yBottom, bb.zMin) },
    uBridgeMax: { value: new THREE.Vector3(bb.xMax, bb.yTop, bb.zMax) },
    uHasBridge: { value: bridgeBounds ? 1.0 : 0.0 },
  });

  useEffect(() => {
    const u = uniformsRef.current;
    const colors = REGIME_COLORS[flowRegime];
    u.uBaseColor.value.set(colors.base);
    u.uHighlightColor.value.set(colors.highlight);
    u.uFoamColor.value.set(colors.foam);
    u.uVelocity.value = velocityToShaderSpeed(velocity, channelLength);
    u.uRegime.value = flowRegime === 'free-surface' ? 0.0 : flowRegime === 'pressure' ? 1.0 : 2.0;
  }, [flowRegime, velocity, channelLength]);

  useEffect(() => {
    const u = uniformsRef.current;
    u.uBridgeMin.value.set(bb.xMin, bb.yBottom, bb.zMin);
    u.uBridgeMax.value.set(bb.xMax, bb.yTop, bb.zMax);
    u.uHasBridge.value = bridgeBounds ? 1.0 : 0.0;
  }, [bb.xMin, bb.xMax, bb.yBottom, bb.yTop, bb.zMin, bb.zMax, bridgeBounds]);

  useFrame((_, delta) => {
    uniformsRef.current.uTime.value += delta;
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
          varying vec3 vViewDir;
          varying vec4 vScreenPos;

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

          // Gerstner wave — physically correct: sharp peaks, flat troughs
          // Returns vec3(dx, dy, dz) displacement
          vec3 gerstner(vec2 pos, float t, vec2 dir, float steepness, float wavelength, float speed) {
            float k = 6.28318 / wavelength;
            float c = speed;
            float a = steepness / k;
            float phase = k * dot(dir, pos) - c * t;
            return vec3(
              dir.x * a * cos(phase),
              a * sin(phase),
              dir.y * a * cos(phase)
            );
          }

          void main() {
            vUv = uv;
            vec3 pos = position;

            float speed = uVelocity;
            float turb = uRegime < 0.5 ? 1.0 : uRegime < 1.5 ? 1.6 : 2.4;
            float t = uTime;

            // Sum of Gerstner waves — downstream flow direction (negative Z)
            vec2 flowDir = normalize(vec2(0.1, -1.0));
            vec2 crossDir = normalize(vec2(1.0, 0.2));
            vec2 diagDir = normalize(vec2(-0.3, -0.8));

            vec3 g1 = gerstner(pos.xz, t, flowDir,  0.25 * turb, 4.0, speed * 2.0);
            vec3 g2 = gerstner(pos.xz, t, crossDir,  0.12 * turb, 2.5, speed * 1.2);
            vec3 g3 = gerstner(pos.xz, t, diagDir,   0.08 * turb, 1.5, speed * 2.8);
            vec3 g4 = gerstner(pos.xz, t, flowDir,   0.04 * turb, 0.8, speed * 4.0);

            // Small noise for detail
            float n = noise(vec2(pos.x * 2.0 + t * 0.2, pos.z * 2.0 - t * speed * 0.6)) * 0.02 * turb;

            vec3 totalDisp = g1 + g2 + g3 + g4;
            pos.x += totalDisp.x;
            pos.y += totalDisp.y + n;
            pos.z += totalDisp.z;

            vWorldPos = pos;
            vWaveHeight = totalDisp.y + n;

            // Compute normal from Gerstner wave derivatives
            vec3 tangent = vec3(1.0, 0.0, 0.0);
            vec3 bitangent = vec3(0.0, 0.0, 1.0);

            // Analytical derivatives for each wave
            float k1 = 6.28318 / 4.0; float a1 = 0.25 * turb / k1;
            float p1 = k1 * dot(flowDir, position.xz) - speed * 2.0 * t;
            tangent.x -= flowDir.x * flowDir.x * k1 * a1 * sin(p1);
            tangent.y += flowDir.x * k1 * a1 * cos(p1);
            bitangent.z -= flowDir.y * flowDir.y * k1 * a1 * sin(p1);
            bitangent.y += flowDir.y * k1 * a1 * cos(p1);

            float k2 = 6.28318 / 2.5; float a2 = 0.12 * turb / k2;
            float p2 = k2 * dot(crossDir, position.xz) - speed * 1.2 * t;
            tangent.x -= crossDir.x * crossDir.x * k2 * a2 * sin(p2);
            tangent.y += crossDir.x * k2 * a2 * cos(p2);
            bitangent.z -= crossDir.y * crossDir.y * k2 * a2 * sin(p2);
            bitangent.y += crossDir.y * k2 * a2 * cos(p2);

            vNormal = normalize(cross(bitangent, tangent));

            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vViewDir = normalize(cameraPosition - worldPos.xyz);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            vScreenPos = gl_Position;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uBaseColor;
          uniform vec3 uHighlightColor;
          uniform vec3 uFoamColor;
          uniform float uVelocity;
          uniform float uRegime;
          uniform vec3 uBridgeMin;
          uniform vec3 uBridgeMax;
          uniform float uHasBridge;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying float vWaveHeight;
          varying vec3 vNormal;
          varying vec3 vViewDir;
          varying vec4 vScreenPos;

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

          float bridgeShadow(vec3 pos) {
            if (uHasBridge < 0.5) return 0.0;
            float inX = smoothstep(uBridgeMin.x - 1.0, uBridgeMin.x + 0.5, pos.x)
                      * smoothstep(uBridgeMax.x + 1.0, uBridgeMax.x - 0.5, pos.x);
            float inZ = smoothstep(uBridgeMin.z - 0.5, uBridgeMin.z + 0.5, pos.z)
                      * smoothstep(uBridgeMax.z + 0.5, uBridgeMax.z - 0.5, pos.z);
            return inX * inZ * 0.45;
          }

          float bridgeReflection(vec3 pos, vec3 normal) {
            if (uHasBridge < 0.5) return 0.0;
            float inX = smoothstep(uBridgeMin.x - 0.5, uBridgeMin.x + 1.0, pos.x)
                      * smoothstep(uBridgeMax.x + 0.5, uBridgeMax.x - 1.0, pos.x);
            float inZ = smoothstep(uBridgeMin.z - 1.0, uBridgeMin.z + 1.0, pos.z)
                      * smoothstep(uBridgeMax.z + 1.0, uBridgeMax.z - 1.0, pos.z);
            float distort = noise(vec2(pos.x * 3.0 + normal.x * 2.0, pos.z * 3.0 + normal.z * 2.0));
            return inX * inZ * smoothstep(0.3, 0.6, distort + 0.3) * 0.4;
          }

          void main() {
            float speed = uVelocity;

            // Fresnel — Schlick
            float NdotV = max(dot(vViewDir, vNormal), 0.0);
            float fresnel = 0.02 + 0.98 * pow(1.0 - NdotV, 5.0);

            // Flow streaks
            float flowUV = vWorldPos.z * 3.0 - uTime * speed * 1.4;
            float streak = noise(vec2(vWorldPos.x * 4.0, flowUV * 2.0));
            streak = smoothstep(0.35, 0.65, streak);

            // Foam on Gerstner peaks
            float foam = smoothstep(0.04, 0.10, vWaveHeight);
            foam *= noise(vec2(vWorldPos.x * 8.0 + uTime * 0.3, vWorldPos.z * 8.0 - uTime * speed * 0.7));
            foam = smoothstep(0.25, 0.7, foam);

            // Caustic
            float c1 = noise(vec2(vWorldPos.x * 6.0 + uTime * 0.25, vWorldPos.z * 6.0 - uTime * speed * 0.5));
            float c2 = noise(vec2(vWorldPos.x * 6.0 - uTime * 0.2, vWorldPos.z * 6.0 + uTime * speed * 0.4));
            float caustic = smoothstep(0.3, 0.7, abs(c1 - c2)) * 0.2;

            // Edge fade
            float edgeFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);

            // Sun
            vec3 sunDir = normalize(vec3(0.5, 0.8, 0.5));
            float sunDiffuse = max(dot(vNormal, sunDir), 0.0);
            vec3 halfVec = normalize(sunDir + vViewDir);
            float sunSpec = pow(max(dot(vNormal, halfVec), 0.0), 256.0) * 1.5;
            float sunSpec2 = pow(max(dot(vNormal, halfVec), 0.0), 32.0) * 0.35;

            // Sky reflection — sunset palette
            vec3 reflectDir = reflect(-vViewDir, vNormal);
            float skyUp = smoothstep(-0.2, 0.6, reflectDir.y);
            vec3 horizonColor = vec3(0.85, 0.45, 0.15);
            vec3 zenithColor = vec3(0.25, 0.35, 0.55);
            vec3 groundColor = vec3(0.08, 0.06, 0.04);
            vec3 skyColor = reflectDir.y > 0.0
              ? mix(horizonColor, zenithColor, skyUp)
              : mix(horizonColor, groundColor, smoothstep(0.0, -0.3, reflectDir.y));
            float sunReflect = smoothstep(0.95, 0.99, dot(reflectDir, sunDir));
            skyColor += vec3(1.0, 0.9, 0.7) * sunReflect * 2.5;

            // Shadow + reflection
            float shadow = bridgeShadow(vWorldPos);
            float bridgeRefl = bridgeReflection(vWorldPos, vNormal);

            // Compose
            vec3 deepColor = uBaseColor * 0.5;
            vec3 waterSurface = mix(uBaseColor, uHighlightColor, streak * 0.35 + sunDiffuse * 0.25);
            waterSurface += caustic * uHighlightColor;
            vec3 deepBlend = mix(deepColor, waterSurface, 0.7);

            vec3 col = mix(deepBlend, skyColor, fresnel * 0.7);

            // Bridge reflection
            vec3 bridgeColor = vec3(0.3, 0.28, 0.25);
            col = mix(col, bridgeColor, bridgeRefl * (0.5 + fresnel * 0.3));

            // Shadow
            col *= (1.0 - shadow);

            // Specular
            col += vec3(1.0, 0.95, 0.85) * (sunSpec + sunSpec2) * (1.0 - shadow * 0.8);

            // Foam
            col = mix(col, uFoamColor, foam * 0.55);

            float alpha = (0.7 + fresnel * 0.2) * edgeFade + foam * 0.15;
            alpha = clamp(alpha, 0.0, 0.93);

            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
}
