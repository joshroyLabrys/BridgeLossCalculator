'use client';

import * as THREE from 'three';
import { useMemo } from 'react';

interface DebrisMatProps {
  /** Blockage percentage 0-100 */
  blockagePct: number;
  /** Bridge opening width (ft) */
  openingWidth: number;
  /** Left abutment station */
  leftStation: number;
  /** Water surface elevation */
  wsel: number;
  /** Low chord elevation */
  lowChord: number;
  /** Z position (channel length / 2) */
  bridgeZ: number;
  /** Deck depth for z-positioning */
  deckDepth: number;
}

/**
 * 3D debris mat mesh representing blockage at the bridge upstream face.
 * Renders as a rough brown slab spanning from the left abutment inward,
 * filling the percentage of the opening between WSEL and low chord.
 */
export function DebrisMat({
  blockagePct,
  openingWidth,
  leftStation,
  wsel,
  lowChord,
  bridgeZ,
  deckDepth,
}: DebrisMatProps) {
  if (blockagePct <= 0 || wsel >= lowChord) return null;

  const blockWidth = openingWidth * (blockagePct / 100);
  const height = lowChord - wsel;
  if (height <= 0) return null;

  // Position: starts from left abutment, at upstream face of bridge
  const cx = leftStation + blockWidth / 2;
  const cy = wsel + height / 2;
  const cz = bridgeZ - deckDepth / 2 - 0.1; // just upstream of bridge face

  // Slightly irregular geometry via displacing vertices
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(blockWidth, height, 0.5, 4, 4, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Add small random offsets to front face vertices for a rough look
      const z = pos.getZ(i);
      if (Math.abs(z - 0.25) < 0.01) {
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.15);
        pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.1);
        pos.setZ(i, pos.getZ(i) + Math.random() * 0.2);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [blockWidth, height]);

  return (
    <mesh position={[cx, cy, cz]} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#5C4033"
        roughness={0.95}
        metalness={0.0}
      />
    </mesh>
  );
}
