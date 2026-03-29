'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { BridgeGeometry, CrossSectionPoint } from '@/engine/types';
import {
  concreteNormalMap,
  concreteRoughnessMap,
  asphaltNormalMap,
} from './procedural-textures';

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

/* ── Flat material props (steel + markings don't need textures) ── */
const STEEL = { color: '#b8bcc4', roughness: 0.12, metalness: 0.92, envMapIntensity: 1.4 };
const MARKING = { color: '#e8e8e8', roughness: 0.5, metalness: 0.0, emissive: '#e8e8e8', emissiveIntensity: 0.06 };

/* ── Textured PBR materials ── */
interface MatSet {
  concrete: THREE.Material;
  concreteDark: THREE.Material; // deck girder
  concreteWeathered: THREE.Material; // piers (stained/weathered)
  asphalt: THREE.Material;
  earth: THREE.Material;
}

function useTexturedMaterials(span: number, deckDepth: number): MatSet {
  // Load photo textures — stretched across each surface (no tiling)
  const [concreteMap, weatheredMap, asphaltMap] = useTexture([
    '/textures/concrete.jpg',
    '/textures/concreteweathered.jpg',
    '/textures/asphalt.jpg',
  ]);

  return useMemo(() => {
    // Procedural normal/roughness maps (subtle enough that tiling isn't visible)
    const cNorm = concreteNormalMap(1024);
    const cRough = concreteRoughnessMap(1024);
    const aNorm = asphaltNormalMap(1024);

    // Configure all photo textures: stretch across surfaces, no tiling
    [concreteMap, weatheredMap, asphaltMap].forEach(tex => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(1, 1);
    });

    return {
      concrete: new THREE.MeshPhysicalMaterial({
        map: concreteMap, normalMap: cNorm, roughnessMap: cRough,
        roughness: 1.0, metalness: 0.02, envMapIntensity: 0.8,
        clearcoat: 0.5, clearcoatRoughness: 0.35,
      }),
      concreteDark: new THREE.MeshPhysicalMaterial({
        map: (() => {
          const t = concreteMap.clone();
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
          t.colorSpace = THREE.SRGBColorSpace;
          return t;
        })(),
        normalMap: cNorm, roughnessMap: cRough,
        color: '#b0aaa4',
        roughness: 1.0, metalness: 0.02, envMapIntensity: 0.7,
        clearcoat: 0.4, clearcoatRoughness: 0.4,
      }),
      concreteWeathered: new THREE.MeshPhysicalMaterial({
        map: weatheredMap, normalMap: cNorm, roughnessMap: cRough,
        roughness: 1.0, metalness: 0.02, envMapIntensity: 0.6,
        clearcoat: 0.3, clearcoatRoughness: 0.5,
      }),
      asphalt: new THREE.MeshStandardMaterial({
        map: asphaltMap, normalMap: aNorm,
        roughness: 0.98, metalness: 0.0, envMapIntensity: 0.1,
      }),
      earth: new THREE.MeshStandardMaterial({
        color: '#5a5045', normalMap: cNorm, roughness: 1.0, metalness: 0.01, envMapIntensity: 0.35,
        side: THREE.DoubleSide,
      }),
    };
  }, [span, deckDepth, concreteMap, weatheredMap, asphaltMap]);
}

/* ── Normalize UVs to 0–1 range so photo textures map correctly ── */
function normalizeUVs(geo: THREE.BufferGeometry) {
  const uv = geo.getAttribute('uv');
  if (!uv) return;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  const rangeU = maxU - minU || 1;
  const rangeV = maxV - minV || 1;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) - minU) / rangeU, (uv.getY(i) - minV) / rangeV);
  }
  uv.needsUpdate = true;
}

/* ── Extruded deck with beveled edges and slight crown ── */
function DeckGeometry({ span, thickness, depth }: { span: number; thickness: number; depth: number }) {
  const geo = useMemo(() => {
    const bevel = thickness * 0.08;
    const crown = thickness * 0.03;
    const hw = span / 2;

    const shape = new THREE.Shape();
    shape.moveTo(-hw + bevel, -thickness);
    shape.lineTo(hw - bevel, -thickness);
    shape.quadraticCurveTo(hw, -thickness, hw, -thickness + bevel);
    shape.lineTo(hw, -bevel);
    shape.quadraticCurveTo(hw, 0, hw - bevel, 0);
    shape.quadraticCurveTo(0, crown, -hw + bevel, 0);
    shape.quadraticCurveTo(-hw, 0, -hw, -bevel);
    shape.lineTo(-hw, -thickness + bevel);
    shape.quadraticCurveTo(-hw, -thickness, -hw + bevel, -thickness);

    const g = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth,
      bevelEnabled: false,
    });
    normalizeUVs(g);
    return g;
  }, [span, thickness, depth]);

  return <primitive object={geo} attach="geometry" />;
}

/* ── Approach embankment: proper trapezoidal cross-section ── */
function ApproachEmbankment({ startX, topY, bottomY, depth, bridgeZ, side, deckThickness, mats }: {
  startX: number; topY: number; bottomY: number; depth: number; bridgeZ: number;
  side: 'left' | 'right'; deckThickness: number; mats: MatSet;
}) {
  const geo = useMemo(() => {
    const height = topY - bottomY;
    if (height <= 0.1) return null;
    const rampLen = Math.max(height * 2, deckThickness * 4);
    const topWidth = deckThickness * 0.5;
    const dir = side === 'left' ? -1 : 1;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, -height);
    shape.lineTo(dir * rampLen, -height);
    shape.lineTo(dir * topWidth, 0);
    shape.lineTo(0, 0);

    const g = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: depth,
      bevelEnabled: false,
    });
    normalizeUVs(g);
    g.translate(startX, topY, bridgeZ - depth / 2);
    g.computeVertexNormals();
    return g;
  }, [startX, topY, bottomY, depth, bridgeZ, side, deckThickness]);

  if (!geo) return null;

  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow material={mats.earth} />
      {(() => {
        const height = topY - bottomY;
        const rampLen = Math.max(height * 2, deckThickness * 4);
        const dir = side === 'left' ? -1 : 1;
        const diagLen = Math.sqrt(rampLen * rampLen + height * height);
        const angle = Math.atan2(height, rampLen) * dir;
        const midX = startX + dir * rampLen * 0.35;
        const midY = topY - height * 0.35 + 0.05;
        return (
          <mesh position={[midX, midY, bridgeZ]} rotation={[0, 0, angle]} receiveShadow material={mats.asphalt}>
            <boxGeometry args={[diagLen * 0.7, 0.06, depth * 0.82]} />
          </mesh>
        );
      })()}
    </group>
  );
}

/* ── Thin cylindrical railing tube ── */
function RailTube({ x1, x2, y, z, radius }: {
  x1: number; x2: number; y: number; z: number; radius: number;
}) {
  const len = x2 - x1;
  const cx = (x1 + x2) / 2;
  return (
    <mesh position={[cx, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[radius, radius, len, 12]} />
      <meshStandardMaterial {...STEEL} />
    </mesh>
  );
}

/* ── Thin cylindrical railing post ── */
function RailPost({ x, yBottom, yTop, z, radius }: {
  x: number; yBottom: number; yTop: number; z: number; radius: number;
}) {
  const h = yTop - yBottom;
  return (
    <mesh position={[x, yBottom + h / 2, z]} castShadow>
      <cylinderGeometry args={[radius, radius, h, 8]} />
      <meshStandardMaterial {...STEEL} />
    </mesh>
  );
}

export function BridgeMesh({ bridge, crossSection, channelLength }: BridgeMeshProps) {
  const bridgeZ = channelLength / 2;
  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  const lowChord = Math.min(bridge.lowChordLeft, bridge.lowChordRight);
  const deckThickness = bridge.highChord - lowChord;
  const deckDepth = bridge.deckWidth || Math.max(span * 0.3, 8);
  const mats = useTexturedMaterials(span, deckDepth);
  const halfDepth = deckDepth / 2;

  const cx = bridge.leftAbutmentStation + span / 2;
  const leftGround = interpGround(crossSection, bridge.leftAbutmentStation);
  const rightGround = interpGround(crossSection, bridge.rightAbutmentStation);
  const farLeftGround = interpGround(crossSection, crossSection[0]?.station ?? bridge.leftAbutmentStation);
  const farRightGround = interpGround(crossSection, crossSection[crossSection.length - 1]?.station ?? bridge.rightAbutmentStation);

  // Rail height proportional to deck — real rails are ~30-40% of a typical deck depth
  // but capped so they never look absurd on thin or thick decks
  const railHeight = Math.min(Math.max(deckThickness * 0.4, 0.8), 2.0);
  const railPostRadius = Math.max(railHeight * 0.03, 0.05);
  const railTubeRadius = Math.max(railHeight * 0.02, 0.03);
  const postSpacing = Math.max(span * 0.08, 4);
  const numPosts = Math.max(3, Math.floor(span / postSpacing));

  const wingLength = deckDepth * 0.5;
  const wingThickness = Math.max(deckThickness * 0.25, 1);

  const topRailY = bridge.highChord + railHeight;
  const midRailY = bridge.highChord + railHeight * 0.45;
  const usZ = bridgeZ - halfDepth + 0.3;
  const dsZ = bridgeZ + halfDepth - 0.3;

  return (
    <group>
      {/* === APPROACH EMBANKMENTS === */}
      <ApproachEmbankment
        startX={bridge.leftAbutmentStation - deckThickness * 0.3}
        topY={bridge.highChord}
        bottomY={farLeftGround}
        depth={deckDepth}
        bridgeZ={bridgeZ}
        side="left"
        deckThickness={deckThickness}
        mats={mats}
      />
      <ApproachEmbankment
        startX={bridge.rightAbutmentStation + deckThickness * 0.3}
        topY={bridge.highChord}
        bottomY={farRightGround}
        depth={deckDepth}
        bridgeZ={bridgeZ}
        side="right"
        deckThickness={deckThickness}
        mats={mats}
      />

      {/* === DECK === */}
      <mesh
        position={[cx, bridge.highChord, bridgeZ - deckDepth / 2]}
        castShadow receiveShadow
        material={mats.concreteDark}
      >
        <DeckGeometry span={span + 0.3} thickness={deckThickness} depth={deckDepth} />
      </mesh>

      {/* Road surface */}
      <mesh position={[cx, bridge.highChord + 0.04, bridgeZ]} receiveShadow material={mats.asphalt}>
        <boxGeometry args={[span + 0.1, 0.06, deckDepth - 0.6]} />
      </mesh>

      {/* Centre line */}
      <mesh position={[cx, bridge.highChord + 0.08, bridgeZ]}>
        <boxGeometry args={[span * 0.92, 0.01, 0.06]} />
        <meshStandardMaterial {...MARKING} />
      </mesh>
      {/* Edge lines */}
      <mesh position={[cx, bridge.highChord + 0.08, bridgeZ - halfDepth + 0.5]}>
        <boxGeometry args={[span * 0.92, 0.01, 0.04]} />
        <meshStandardMaterial {...MARKING} />
      </mesh>
      <mesh position={[cx, bridge.highChord + 0.08, bridgeZ + halfDepth - 0.5]}>
        <boxGeometry args={[span * 0.92, 0.01, 0.04]} />
        <meshStandardMaterial {...MARKING} />
      </mesh>

      {/* === RAILINGS === */}
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={topRailY} z={usZ} radius={railTubeRadius} />
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={midRailY} z={usZ} radius={railTubeRadius} />
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={topRailY} z={dsZ} radius={railTubeRadius} />
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={midRailY} z={dsZ} radius={railTubeRadius} />

      {Array.from({ length: numPosts + 1 }).map((_, i) => {
        const x = bridge.leftAbutmentStation + (span / numPosts) * i;
        return (
          <group key={`rp-${i}`}>
            <RailPost x={x} yBottom={bridge.highChord} yTop={topRailY + railTubeRadius} z={usZ} radius={railPostRadius} />
            <RailPost x={x} yBottom={bridge.highChord} yTop={topRailY + railTubeRadius} z={dsZ} radius={railPostRadius} />
          </group>
        );
      })}

      {/* === ABUTMENTS === */}
      {[
        { sta: bridge.leftAbutmentStation, ground: leftGround, dir: -1 },
        { sta: bridge.rightAbutmentStation, ground: rightGround, dir: 1 },
      ].map(({ sta, ground, dir }, ai) => {
        const wallH = bridge.highChord - ground;
        const abutW = Math.max(deckThickness * 0.5, 2);
        const xOff = dir * abutW / 2;
        return (
          <group key={`abut-${ai}`}>
            <mesh position={[sta + xOff, ground + wallH / 2, bridgeZ]} castShadow material={mats.concrete}>
              <boxGeometry args={[abutW, wallH, deckDepth + 0.8]} />
            </mesh>
            <mesh position={[sta + xOff, bridge.highChord - deckThickness - 0.05, bridgeZ]} castShadow material={mats.concrete}>
              <boxGeometry args={[abutW * 1.3, 0.15, deckDepth + 0.4]} />
            </mesh>
          </group>
        );
      })}

      {/* === WINGWALLS === */}
      {[bridge.leftAbutmentStation, bridge.rightAbutmentStation].map((abutSta, ai) => {
        const ground = ai === 0 ? leftGround : rightGround;
        const wallHeight = (bridge.highChord - ground) * 0.6;
        const xOff = ai === 0 ? -deckThickness * 0.35 : deckThickness * 0.35;
        return [bridgeZ - halfDepth - wingLength / 2, bridgeZ + halfDepth + wingLength / 2].map((wz, wi) => (
          <mesh key={`wing-${ai}-${wi}`} position={[abutSta + xOff, ground + wallHeight / 2, wz]} castShadow material={mats.concrete}>
            <boxGeometry args={[wingThickness, wallHeight, wingLength]} />
          </mesh>
        ));
      })}

      {/* === PIERS === */}
      {bridge.piers.map((pier, i) => {
        const pierGround = interpGround(crossSection, pier.station);
        const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
        const lowChordAtPier = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
        const pierHeight = lowChordAtPier - pierGround;
        const pierDepth = deckDepth;
        const colRadius = pier.width / 2;
        const capH = Math.max(deckThickness * 0.16, 0.8);

        return (
          <group key={i}>
            <mesh position={[pier.station, lowChordAtPier - capH / 2, bridgeZ]} castShadow material={mats.concreteWeathered}>
              <boxGeometry args={[pier.width * 1.3, capH, pierDepth]} />
            </mesh>

            {pier.shape === 'cylindrical' ? (
              <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow material={mats.concreteWeathered}>
                <cylinderGeometry args={[colRadius, colRadius, pierHeight, 24]} />
              </mesh>
            ) : pier.shape === 'square' ? (
              <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow material={mats.concreteWeathered}>
                <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
              </mesh>
            ) : pier.shape === 'sharp' ? (
              <>
                <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow material={mats.concreteWeathered}>
                  <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
                </mesh>
                <mesh position={[pier.station, pierGround + pierHeight * 0.5, bridgeZ - pierDepth / 2 - pier.width * 0.25]} rotation={[0, Math.PI / 4, 0]} castShadow material={mats.concreteWeathered}>
                  <boxGeometry args={[pier.width * 0.4, pierHeight, pier.width * 0.4]} />
                </mesh>
                <mesh position={[pier.station, pierGround + pierHeight * 0.5, bridgeZ + pierDepth / 2 + pier.width * 0.25]} rotation={[0, Math.PI / 4, 0]} castShadow material={mats.concreteWeathered}>
                  <boxGeometry args={[pier.width * 0.4, pierHeight, pier.width * 0.4]} />
                </mesh>
              </>
            ) : (
              /* Round-nose: rectangular body + semicircular caps on upstream/downstream ends. */
              <>
                <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow material={mats.concreteWeathered}>
                  <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
                </mesh>
                {/* Upstream nose — rounded face points toward -Z */}
                <mesh
                  position={[pier.station, pierGround + pierHeight / 2, bridgeZ - pierDepth / 2]}
                  rotation={[0, -Math.PI / 2, 0]}
                  castShadow
                  material={mats.concreteWeathered}
                >
                  <cylinderGeometry args={[pier.width / 2, pier.width / 2, pierHeight, 16, 1, false, 0, Math.PI]} />
                </mesh>
                {/* Downstream nose — rounded face points toward +Z */}
                <mesh
                  position={[pier.station, pierGround + pierHeight / 2, bridgeZ + pierDepth / 2]}
                  rotation={[0, Math.PI / 2, 0]}
                  castShadow
                  material={mats.concreteWeathered}
                >
                  <cylinderGeometry args={[pier.width / 2, pier.width / 2, pierHeight, 16, 1, false, 0, Math.PI]} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
