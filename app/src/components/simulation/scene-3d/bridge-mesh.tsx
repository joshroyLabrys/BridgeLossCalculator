'use client';

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

/** Concrete material for structural elements */
const concreteMat = (
  <meshStandardMaterial color="#9ca3af" roughness={0.85} metalness={0.05} />
);

/** Darker concrete for deck underside / abutments */
const darkConcreteMat = (
  <meshStandardMaterial color="#6b7280" roughness={0.9} metalness={0.05} />
);

/** Asphalt road surface */
const asphaltMat = (
  <meshStandardMaterial color="#374151" roughness={0.95} metalness={0.0} />
);

/** Steel railing material */
const steelMat = (
  <meshStandardMaterial color="#d1d5db" roughness={0.3} metalness={0.8} />
);

export function BridgeMesh({ bridge, crossSection, channelLength }: BridgeMeshProps) {
  const bridgeZ = channelLength / 2;
  const span = bridge.rightAbutmentStation - bridge.leftAbutmentStation;
  const lowChord = Math.min(bridge.lowChordLeft, bridge.lowChordRight);
  const deckThickness = bridge.highChord - lowChord;
  const deckDepth = bridge.deckWidth || Math.max(channelLength * 0.15, 3);
  const halfDepth = deckDepth / 2;

  const cx = bridge.leftAbutmentStation + span / 2;
  const leftGround = interpGround(crossSection, bridge.leftAbutmentStation);
  const rightGround = interpGround(crossSection, bridge.rightAbutmentStation);

  // Parapet / guardrail dimensions
  const railHeight = deckThickness * 0.6;
  const railThickness = deckThickness * 0.15;
  const postSpacing = span * 0.12;
  const postWidth = railThickness * 0.8;
  const postHeight = railHeight;
  const numPosts = Math.max(2, Math.floor(span / postSpacing));

  // Wingwall dimensions
  const wingLength = deckDepth * 0.6;
  const wingThickness = deckThickness * 0.3;

  return (
    <group>
      {/* === DECK === */}
      {/* Main deck slab (concrete) */}
      <mesh
        position={[cx, bridge.highChord - deckThickness / 2, bridgeZ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[span + 0.2, deckThickness, deckDepth]} />
        {darkConcreteMat}
      </mesh>

      {/* Road surface on top */}
      <mesh
        position={[cx, bridge.highChord + 0.05, bridgeZ]}
        receiveShadow
      >
        <boxGeometry args={[span + 0.1, 0.1, deckDepth - railThickness * 2]} />
        {asphaltMat}
      </mesh>

      {/* Road lane markings (thin white lines) */}
      <mesh position={[cx, bridge.highChord + 0.11, bridgeZ]}>
        <boxGeometry args={[span * 0.9, 0.02, 0.08]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.6} metalness={0.0} />
      </mesh>

      {/* === GUARDRAILS / PARAPETS === */}
      {/* Upstream parapet wall */}
      <mesh
        position={[cx, bridge.highChord + railHeight / 2, bridgeZ - halfDepth + railThickness / 2]}
        castShadow
      >
        <boxGeometry args={[span + 0.4, railHeight, railThickness]} />
        {concreteMat}
      </mesh>

      {/* Downstream parapet wall */}
      <mesh
        position={[cx, bridge.highChord + railHeight / 2, bridgeZ + halfDepth - railThickness / 2]}
        castShadow
      >
        <boxGeometry args={[span + 0.4, railHeight, railThickness]} />
        {concreteMat}
      </mesh>

      {/* Railing posts along upstream side */}
      {Array.from({ length: numPosts + 1 }).map((_, i) => {
        const x = bridge.leftAbutmentStation + (span / numPosts) * i;
        return (
          <group key={`post-us-${i}`}>
            <mesh
              position={[x, bridge.highChord + postHeight / 2, bridgeZ - halfDepth + railThickness / 2]}
              castShadow
            >
              <boxGeometry args={[postWidth, postHeight, railThickness * 1.2]} />
              {steelMat}
            </mesh>
            <mesh
              position={[x, bridge.highChord + postHeight / 2, bridgeZ + halfDepth - railThickness / 2]}
              castShadow
            >
              <boxGeometry args={[postWidth, postHeight, railThickness * 1.2]} />
              {steelMat}
            </mesh>
          </group>
        );
      })}

      {/* Top rail bar — upstream */}
      <mesh
        position={[cx, bridge.highChord + railHeight * 0.95, bridgeZ - halfDepth + railThickness / 2]}
      >
        <boxGeometry args={[span + 0.4, railThickness * 0.4, railThickness * 0.5]} />
        {steelMat}
      </mesh>

      {/* Top rail bar — downstream */}
      <mesh
        position={[cx, bridge.highChord + railHeight * 0.95, bridgeZ + halfDepth - railThickness / 2]}
      >
        <boxGeometry args={[span + 0.4, railThickness * 0.4, railThickness * 0.5]} />
        {steelMat}
      </mesh>

      {/* === ABUTMENTS === */}
      {/* Left abutment — full wall */}
      <mesh
        position={[
          bridge.leftAbutmentStation - deckThickness * 0.25,
          leftGround + (bridge.highChord - leftGround) / 2,
          bridgeZ,
        ]}
        castShadow
      >
        <boxGeometry args={[deckThickness * 0.5, bridge.highChord - leftGround, deckDepth + 1]} />
        {concreteMat}
      </mesh>

      {/* Right abutment */}
      <mesh
        position={[
          bridge.rightAbutmentStation + deckThickness * 0.25,
          rightGround + (bridge.highChord - rightGround) / 2,
          bridgeZ,
        ]}
        castShadow
      >
        <boxGeometry args={[deckThickness * 0.5, bridge.highChord - rightGround, deckDepth + 1]} />
        {concreteMat}
      </mesh>

      {/* === WINGWALLS (angled retaining walls at each abutment corner) === */}
      {[bridge.leftAbutmentStation, bridge.rightAbutmentStation].map((abutSta, ai) => {
        const ground = ai === 0 ? leftGround : rightGround;
        const wallHeight = (bridge.highChord - ground) * 0.7;
        const xOff = ai === 0 ? -deckThickness * 0.4 : deckThickness * 0.4;

        return [bridgeZ - halfDepth - wingLength / 2, bridgeZ + halfDepth + wingLength / 2].map((wz, wi) => (
          <mesh
            key={`wing-${ai}-${wi}`}
            position={[abutSta + xOff, ground + wallHeight / 2, wz]}
            castShadow
          >
            <boxGeometry args={[wingThickness, wallHeight, wingLength]} />
            {concreteMat}
          </mesh>
        ));
      })}

      {/* === PIERS === */}
      {bridge.piers.map((pier, i) => {
        const pierGround = interpGround(crossSection, pier.station);
        const t = span > 0 ? (pier.station - bridge.leftAbutmentStation) / span : 0;
        const lowChordAtPier = bridge.lowChordLeft + t * (bridge.lowChordRight - bridge.lowChordLeft);
        const pierHeight = lowChordAtPier - pierGround;
        const pierDepth = deckDepth * 0.7;

        // Round-nose pier: use a wider body with tapered ends
        return (
          <group key={i}>
            {/* Main pier body */}
            <mesh
              position={[pier.station, pierGround + pierHeight / 2, bridgeZ]}
              castShadow
            >
              <boxGeometry args={[pier.width, pierHeight, pierDepth]} />
              {concreteMat}
            </mesh>

            {/* Pier cap (wider at top) */}
            <mesh
              position={[pier.station, lowChordAtPier - deckThickness * 0.1, bridgeZ]}
              castShadow
            >
              <boxGeometry args={[pier.width * 1.3, deckThickness * 0.2, pierDepth * 1.1]} />
              {darkConcreteMat}
            </mesh>

            {/* Cutwater — pointed upstream face */}
            <mesh
              position={[pier.station, pierGround + pierHeight * 0.4, bridgeZ - pierDepth / 2 - pier.width * 0.3]}
              rotation={[0, Math.PI / 4, 0]}
              castShadow
            >
              <boxGeometry args={[pier.width * 0.7, pierHeight * 0.8, pier.width * 0.7]} />
              {concreteMat}
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
