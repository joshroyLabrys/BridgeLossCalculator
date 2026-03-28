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
 * a 3D channel terrain mesh. Uses earthy colors with elevation-based
 * vertex coloring (darker in channel, green on banks).
 */
export function TerrainMesh({ crossSection, channelLength }: TerrainMeshProps) {
  const geometry = useMemo(() => {
    if (crossSection.length < 2) return null;

    const pts = crossSection;
    const nPts = pts.length;
    const zSlices = 2;
    const zPositions = [0, channelLength];

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Elevation range for color mapping
    const minElev = Math.min(...pts.map(p => p.elevation));
    const maxElev = Math.max(...pts.map(p => p.elevation));
    const elevRange = maxElev - minElev || 1;

    // Color palette: low = dark riverbed, near-water = wet earth, mid = earth, high = grass
    const bedColor = new THREE.Color('#2d1f15');      // dark brown (channel bed)
    const wetColor = new THREE.Color('#4a3928');       // wet earth near water line
    const earthColor = new THREE.Color('#6b4e3d');     // medium earth
    const bankColor = new THREE.Color('#4a6741');      // muted green (bank)

    function elevToColor(elev: number): THREE.Color {
      const t = (elev - minElev) / elevRange;
      if (t < 0.15) {
        return bedColor.clone().lerp(wetColor, t / 0.15);
      } else if (t < 0.35) {
        return wetColor.clone().lerp(earthColor, (t - 0.15) / 0.2);
      } else {
        return earthColor.clone().lerp(bankColor, (t - 0.35) / 0.65);
      }
    }

    // Surface vertices
    for (let zi = 0; zi < zSlices; zi++) {
      const z = zPositions[zi];
      for (let pi = 0; pi < nPts; pi++) {
        positions.push(pts[pi].station, pts[pi].elevation, z);
        normals.push(0, 1, 0);
        const c = elevToColor(pts[pi].elevation);
        colors.push(c.r, c.g, c.b);
      }
    }

    // Surface triangles
    for (let pi = 0; pi < nPts - 1; pi++) {
      const i0 = pi;
      const i1 = pi + 1;
      const i2 = nPts + pi;
      const i3 = nPts + pi + 1;
      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }

    // Bottom face
    const minE = minElev - 2;
    const bottomStart = positions.length / 3;

    for (let zi = 0; zi < zSlices; zi++) {
      const z = zPositions[zi];
      for (let pi = 0; pi < nPts; pi++) {
        positions.push(pts[pi].station, minE, z);
        normals.push(0, -1, 0);
        colors.push(bedColor.r, bedColor.g, bedColor.b);
      }
    }

    for (let pi = 0; pi < nPts - 1; pi++) {
      const i0 = bottomStart + pi;
      const i1 = bottomStart + pi + 1;
      const i2 = bottomStart + nPts + pi;
      const i3 = bottomStart + nPts + pi + 1;
      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    // Side walls (front and back faces)
    for (let zi = 0; zi < zSlices; zi++) {
      const surfOffset = zi * nPts;
      const botOffset = bottomStart + zi * nPts;
      for (let pi = 0; pi < nPts - 1; pi++) {
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

    // Left wall
    indices.push(0, nPts, bottomStart);
    indices.push(nPts, bottomStart + nPts, bottomStart);

    // Right wall
    const rs0 = nPts - 1;
    const rs1 = 2 * nPts - 1;
    const rb0 = bottomStart + nPts - 1;
    const rb1 = bottomStart + 2 * nPts - 1;
    indices.push(rs0, rb0, rs1);
    indices.push(rs1, rb0, rb1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [crossSection, channelLength]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.88}
        metalness={0.02}
        side={THREE.DoubleSide}
        envMapIntensity={0.6}
      />
    </mesh>
  );
}
