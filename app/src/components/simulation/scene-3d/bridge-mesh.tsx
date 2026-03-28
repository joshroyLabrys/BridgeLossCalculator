'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { BridgeGeometry, CrossSectionPoint } from '@/engine/types';

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

/* ── Shared materials ── */
const CONCRETE = { color: '#948e88', roughness: 0.91, metalness: 0.02, envMapIntensity: 0.7 };
const CONCRETE_DARK = { color: '#7a756f', roughness: 0.94, metalness: 0.02, envMapIntensity: 0.6 };
const ASPHALT = { color: '#2a2a30', roughness: 0.98, metalness: 0.0, envMapIntensity: 0.15 };
const STEEL = { color: '#b8bcc4', roughness: 0.12, metalness: 0.92, envMapIntensity: 1.4 };
const MARKING = { color: '#e8e8e8', roughness: 0.5, metalness: 0.0, emissive: '#e8e8e8', emissiveIntensity: 0.06 };
const EARTH = { color: '#5a5045', roughness: 0.96, metalness: 0.01, envMapIntensity: 0.35 };

/* ── Extruded deck with beveled edges and slight crown ── */
function DeckGeometry({ span, thickness, depth }: { span: number; thickness: number; depth: number }) {
  const geo = useMemo(() => {
    const bevel = thickness * 0.08;
    const crown = thickness * 0.03;
    const hw = span / 2;

    const shape = new THREE.Shape();
    // Start bottom-left, go clockwise
    shape.moveTo(-hw + bevel, -thickness);
    shape.lineTo(hw - bevel, -thickness);
    shape.quadraticCurveTo(hw, -thickness, hw, -thickness + bevel);
    shape.lineTo(hw, -bevel);
    shape.quadraticCurveTo(hw, 0, hw - bevel, 0);
    // Crown across top
    shape.quadraticCurveTo(0, crown, -hw + bevel, 0);
    shape.quadraticCurveTo(-hw, 0, -hw, -bevel);
    shape.lineTo(-hw, -thickness + bevel);
    shape.quadraticCurveTo(-hw, -thickness, -hw + bevel, -thickness);

    return new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth,
      bevelEnabled: false,
    });
  }, [span, thickness, depth]);

  return <primitive object={geo} attach="geometry" />;
}

/* ── Approach embankment: proper trapezoidal cross-section ── */
function ApproachEmbankment({ startX, topY, bottomY, depth, bridgeZ, side, deckThickness }: {
  startX: number; topY: number; bottomY: number; depth: number; bridgeZ: number;
  side: 'left' | 'right'; deckThickness: number;
}) {
  const geo = useMemo(() => {
    const height = topY - bottomY;
    if (height <= 0.1) return null;
    const rampLen = Math.max(height * 2, deckThickness * 4);
    const topWidth = deckThickness * 0.5;
    const dir = side === 'left' ? -1 : 1;

    // Trapezoidal cross-section in XY, extruded along Z
    // Viewed from the side: a right trapezoid
    // Top edge at deck level, slopes down to ground
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);                          // top at abutment
    shape.lineTo(0, -height);                    // down to ground at abutment
    shape.lineTo(dir * rampLen, -height);        // along ground
    shape.lineTo(dir * topWidth, 0);             // back up (slight top ledge)
    shape.lineTo(0, 0);

    const g = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: depth,
      bevelEnabled: false,
    });
    // Position: extrude goes along +Z from 0, we need it centered on bridgeZ
    g.translate(startX, topY, bridgeZ - depth / 2);
    g.computeVertexNormals();
    return g;
  }, [startX, topY, bottomY, depth, bridgeZ, side, deckThickness]);

  if (!geo) return null;

  return (
    <group>
      {/* Embankment fill */}
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial {...EARTH} side={THREE.DoubleSide} />
      </mesh>
      {/* Road surface on top of embankment */}
      {(() => {
        const height = topY - bottomY;
        const rampLen = Math.max(height * 2, deckThickness * 4);
        const dir = side === 'left' ? -1 : 1;
        const diagLen = Math.sqrt(rampLen * rampLen + height * height);
        const angle = Math.atan2(height, rampLen) * dir;
        const midX = startX + dir * rampLen * 0.35;
        const midY = topY - height * 0.35 + 0.05;
        return (
          <mesh position={[midX, midY, bridgeZ]} rotation={[0, 0, angle]} receiveShadow>
            <boxGeometry args={[diagLen * 0.7, 0.06, depth * 0.82]} />
            <meshStandardMaterial {...ASPHALT} />
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
  // deckDepth = the user's deckWidth (road width, Z-axis). Use exact value.
  const deckDepth = bridge.deckWidth || Math.max(span * 0.3, 8);
  const halfDepth = deckDepth / 2;

  const cx = bridge.leftAbutmentStation + span / 2;
  const leftGround = interpGround(crossSection, bridge.leftAbutmentStation);
  const rightGround = interpGround(crossSection, bridge.rightAbutmentStation);
  const farLeftGround = interpGround(crossSection, crossSection[0]?.station ?? bridge.leftAbutmentStation);
  const farRightGround = interpGround(crossSection, crossSection[crossSection.length - 1]?.station ?? bridge.rightAbutmentStation);

  // Fixed real-world railing dimensions (in feet — typical bridge barrier)
  const railHeight = 3.5;        // ~1.07m standard bridge rail height
  const railPostRadius = 0.15;   // ~45mm round post
  const railTubeRadius = 0.1;    // ~30mm tube rail
  const postSpacing = Math.max(span * 0.08, 4); // ~4-8 ft spacing
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
      />
      <ApproachEmbankment
        startX={bridge.rightAbutmentStation + deckThickness * 0.3}
        topY={bridge.highChord}
        bottomY={farRightGround}
        depth={deckDepth}
        bridgeZ={bridgeZ}
        side="right"
        deckThickness={deckThickness}
      />

      {/* === DECK (extruded profile with beveled edges + crown) === */}
      <mesh
        position={[cx, bridge.highChord, bridgeZ - deckDepth / 2]}
        castShadow receiveShadow
      >
        <DeckGeometry span={span + 0.3} thickness={deckThickness} depth={deckDepth} />
        <meshStandardMaterial {...CONCRETE_DARK} side={THREE.DoubleSide} />
      </mesh>

      {/* Road surface */}
      <mesh position={[cx, bridge.highChord + 0.04, bridgeZ]} receiveShadow>
        <boxGeometry args={[span + 0.1, 0.06, deckDepth - 0.6]} />
        <meshStandardMaterial {...ASPHALT} />
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

      {/* === RAILING — thin tubes + posts (upstream) === */}
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={topRailY} z={usZ} radius={railTubeRadius} />
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={midRailY} z={usZ} radius={railTubeRadius} />
      {/* Railing — downstream */}
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={topRailY} z={dsZ} radius={railTubeRadius} />
      <RailTube x1={bridge.leftAbutmentStation - 0.2} x2={bridge.rightAbutmentStation + 0.2} y={midRailY} z={dsZ} radius={railTubeRadius} />

      {/* Railing posts */}
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
        const abutW = Math.max(deckThickness * 0.5, 2); // minimum 2ft thick
        const xOff = dir * abutW / 2;
        return (
          <group key={`abut-${ai}`}>
            <mesh position={[sta + xOff, ground + wallH / 2, bridgeZ]} castShadow>
              <boxGeometry args={[abutW, wallH, deckDepth + 0.8]} />
              <meshStandardMaterial {...CONCRETE} />
            </mesh>
            {/* Bearing shelf */}
            <mesh position={[sta + xOff, bridge.highChord - deckThickness - 0.05, bridgeZ]} castShadow>
              <boxGeometry args={[abutW * 1.3, 0.15, deckDepth + 0.4]} />
              <meshStandardMaterial {...CONCRETE} />
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
          <mesh key={`wing-${ai}-${wi}`} position={[abutSta + xOff, ground + wallHeight / 2, wz]} castShadow>
            <boxGeometry args={[wingThickness, wallHeight, wingLength]} />
            <meshStandardMaterial {...CONCRETE} />
          </mesh>
        ));
      })}

      {/* === PIERS === */}
      {bridge.piers.map((pier, i) => {
        const pierGround = interpGround(crossSection, pier.station);
        const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
        const lowChordAtPier = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
        const pierHeight = lowChordAtPier - pierGround;
        // Piers span the full road width (deckDepth) in Z
        const pierDepth = deckDepth;
        // For cylindrical: use pier.width as the diameter (it's the user's input)
        const colRadius = pier.width / 2;
        const capH = Math.max(deckThickness * 0.16, 0.8); // min 0.8ft cap

        return (
          <group key={i}>
            {/* Pier cap */}
            <mesh position={[pier.station, lowChordAtPier - capH / 2, bridgeZ]} castShadow>
              <boxGeometry args={[pier.width * 1.3, capH, pierDepth]} />
              <meshStandardMaterial {...CONCRETE_DARK} />
            </mesh>

            {/* Pier body */}
            {pier.shape === 'cylindrical' ? (
              /* True round column — diameter = min(width, depth) */
              <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow>
                <cylinderGeometry args={[colRadius, colRadius, pierHeight, 24]} />
                <meshStandardMaterial {...CONCRETE} />
              </mesh>
            ) : pier.shape === 'square' ? (
              <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow>
                <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
                <meshStandardMaterial {...CONCRETE} />
              </mesh>
            ) : pier.shape === 'sharp' ? (
              <>
                <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow>
                  <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
                  <meshStandardMaterial {...CONCRETE} />
                </mesh>
                {/* Sharp wedge cutwaters (upstream + downstream) */}
                <mesh position={[pier.station, pierGround + pierHeight * 0.5, bridgeZ - pierDepth / 2 - pier.width * 0.25]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <boxGeometry args={[pier.width * 0.4, pierHeight, pier.width * 0.4]} />
                  <meshStandardMaterial {...CONCRETE} />
                </mesh>
                <mesh position={[pier.station, pierGround + pierHeight * 0.5, bridgeZ + pierDepth / 2 + pier.width * 0.25]} rotation={[0, Math.PI / 4, 0]} castShadow>
                  <boxGeometry args={[pier.width * 0.4, pierHeight, pier.width * 0.4]} />
                  <meshStandardMaterial {...CONCRETE} />
                </mesh>
              </>
            ) : (
              /* Round-nose: rectangular body + semicircular ends along Z */
              <>
                <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ]} castShadow>
                  <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
                  <meshStandardMaterial {...CONCRETE} />
                </mesh>
                {/* Semicircular nose upstream — radius = half the pier width */}
                <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ - pierDepth / 2]} castShadow>
                  <cylinderGeometry args={[pier.width / 2, pier.width / 2, pierHeight, 16, 1, false, 0, Math.PI]} />
                  <meshStandardMaterial {...CONCRETE} />
                </mesh>
                {/* Semicircular nose downstream */}
                <mesh position={[pier.station, pierGround + pierHeight / 2, bridgeZ + pierDepth / 2]} rotation={[0, Math.PI, 0]} castShadow>
                  <cylinderGeometry args={[pier.width / 2, pier.width / 2, pierHeight, 16, 1, false, 0, Math.PI]} />
                  <meshStandardMaterial {...CONCRETE} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
