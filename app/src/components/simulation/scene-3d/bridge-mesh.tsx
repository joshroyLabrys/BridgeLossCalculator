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

/**
 * 3D bridge structure — deck slab, abutment walls, and piers.
 * Positioned at the midpoint along the channel length (Z axis).
 */
export function BridgeMesh({ bridge, crossSection, channelLength }: BridgeMeshProps) {
  const bridgeZ = channelLength / 2;
  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  const deckThickness = bridge.highChord - Math.min(bridge.lowChordLeft, bridge.lowChordRight);
  const deckDepth = bridge.deckWidth || 3; // Z depth of the deck

  // Deck slab
  const deckPosition: [number, number, number] = [
    bridge.leftAbutmentStation + span / 2,
    bridge.highChord - deckThickness / 2,
    bridgeZ,
  ];

  // Abutments
  const leftGround = interpGround(crossSection, bridge.leftAbutmentStation);
  const rightGround = interpGround(crossSection, bridge.rightAbutmentStation);
  const abutmentWidth = 1;

  const leftAbutHeight = bridge.highChord - leftGround;
  const rightAbutHeight = bridge.highChord - rightGround;

  return (
    <group>
      {/* Deck */}
      <mesh position={deckPosition} castShadow receiveShadow>
        <boxGeometry args={[span, deckThickness, deckDepth]} />
        <meshStandardMaterial color="#8b5e3c" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Left abutment */}
      <mesh
        position={[
          bridge.leftAbutmentStation - abutmentWidth / 2,
          leftGround + leftAbutHeight / 2,
          bridgeZ,
        ]}
        castShadow
      >
        <boxGeometry args={[abutmentWidth, leftAbutHeight, deckDepth + 1]} />
        <meshStandardMaterial color="#6b6b7b" roughness={0.8} metalness={0.15} />
      </mesh>

      {/* Right abutment */}
      <mesh
        position={[
          bridge.rightAbutmentStation + abutmentWidth / 2,
          rightGround + rightAbutHeight / 2,
          bridgeZ,
        ]}
        castShadow
      >
        <boxGeometry args={[abutmentWidth, rightAbutHeight, deckDepth + 1]} />
        <meshStandardMaterial color="#6b6b7b" roughness={0.8} metalness={0.15} />
      </mesh>

      {/* Piers */}
      {bridge.piers.map((pier, i) => {
        const pierGround = interpGround(crossSection, pier.station);
        const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
        const lowChordAtPier = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
        const pierHeight = lowChordAtPier - pierGround;

        return (
          <mesh
            key={i}
            position={[
              pier.station,
              pierGround + pierHeight / 2,
              bridgeZ,
            ]}
            castShadow
          >
            <boxGeometry args={[pier.width, pierHeight, deckDepth * 0.6]} />
            <meshStandardMaterial color="#7a7a8a" roughness={0.7} metalness={0.2} />
          </mesh>
        );
      })}
    </group>
  );
}
