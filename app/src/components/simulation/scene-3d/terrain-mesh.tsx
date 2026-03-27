'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { CrossSectionPoint } from '@/engine/types';

interface TerrainMeshProps {
  crossSection: CrossSectionPoint[];
  channelLength: number;
}

/**
 * Extrudes the 2D cross-section profile along the Z axis to create
 * a 3D channel terrain mesh. X = station, Y = elevation, Z = flow direction.
 */
export function TerrainMesh({ crossSection, channelLength }: TerrainMeshProps) {
  const geometry = useMemo(() => {
    if (crossSection.length < 2) return null;

    const pts = crossSection;
    const nPts = pts.length;
    const zSlices = 2; // Front and back faces
    const zPositions = [0, channelLength];

    // Build vertices: nPts * zSlices for the surface + bottom strip
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Surface vertices
    for (let zi = 0; zi < zSlices; zi++) {
      const z = zPositions[zi];
      for (let pi = 0; pi < nPts; pi++) {
        positions.push(pts[pi].station, pts[pi].elevation, z);
        normals.push(0, 1, 0); // Rough normal, will be computed
      }
    }

    // Surface triangles (connecting front and back profiles)
    for (let pi = 0; pi < nPts - 1; pi++) {
      const i0 = pi;                 // front-left
      const i1 = pi + 1;             // front-right
      const i2 = nPts + pi;          // back-left
      const i3 = nPts + pi + 1;      // back-right

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }

    // Bottom face — close off the bottom at the minimum elevation
    const minElev = Math.min(...pts.map(p => p.elevation)) - 2;
    const bottomStart = positions.length / 3;

    // Add bottom vertices for front and back
    for (let zi = 0; zi < zSlices; zi++) {
      const z = zPositions[zi];
      for (let pi = 0; pi < nPts; pi++) {
        positions.push(pts[pi].station, minElev, z);
        normals.push(0, -1, 0);
      }
    }

    // Bottom face triangles
    for (let pi = 0; pi < nPts - 1; pi++) {
      const i0 = bottomStart + pi;
      const i1 = bottomStart + pi + 1;
      const i2 = bottomStart + nPts + pi;
      const i3 = bottomStart + nPts + pi + 1;

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    // Side walls — connect surface to bottom on front and back
    for (let zi = 0; zi < zSlices; zi++) {
      const surfOffset = zi * nPts;
      const botOffset = bottomStart + zi * nPts;
      for (let pi = 0; pi < nPts - 1; pi++) {
        // Surface edge to bottom edge
        const s0 = surfOffset + pi;
        const s1 = surfOffset + pi + 1;
        const b0 = botOffset + pi;
        const b1 = botOffset + pi + 1;

        if (zi === 0) {
          indices.push(s0, b0, s1);
          indices.push(s1, b0, b1);
        } else {
          indices.push(s0, s1, b0);
          indices.push(s1, b1, b0);
        }
      }
    }

    // Left wall (pi=0, connecting front to back)
    const ls0 = 0;
    const ls1 = nPts;
    const lb0 = bottomStart;
    const lb1 = bottomStart + nPts;
    indices.push(ls0, ls1, lb0);
    indices.push(ls1, lb1, lb0);

    // Right wall (pi=nPts-1)
    const rs0 = nPts - 1;
    const rs1 = 2 * nPts - 1;
    const rb0 = bottomStart + nPts - 1;
    const rb1 = bottomStart + 2 * nPts - 1;
    indices.push(rs0, rb0, rs1);
    indices.push(rs1, rb0, rb1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [crossSection, channelLength]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#4a4a5a"
        roughness={0.9}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
