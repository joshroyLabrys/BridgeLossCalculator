'use client';

interface BridgeDetailsProps {
  leftAbutment: number;
  rightAbutment: number;
  highChord: number;
  deckDepth: number;
  bridgeZ: number;
}

const POLE_MAT = { color: '#555555', roughness: 0.3, metalness: 0.8, envMapIntensity: 1.0 };
const LIGHT_MAT = { color: '#ffeecc', emissive: '#ffeecc', emissiveIntensity: 0.3 };

export function BridgeDetails({ leftAbutment, rightAbutment, highChord, deckDepth, bridgeZ }: BridgeDetailsProps) {
  const span = rightAbutment - leftAbutment;
  const halfDepth = deckDepth / 2;

  // Light pole spacing
  const poleSpacing = Math.max(span * 0.15, 8);
  const numPoles = Math.max(2, Math.floor(span / poleSpacing));
  const poleHeight = Math.min(Math.max(span * 0.06, 2), 5);
  const poleBaseY = highChord + 0.1;

  return (
    <group>
      {/* === Light poles === */}
      {Array.from({ length: numPoles }).map((_, i) => {
        const x = leftAbutment + poleSpacing * 0.5 + (span - poleSpacing) * (i / Math.max(1, numPoles - 1));

        return (
          <group key={`pole-${i}`}>
            {/* Upstream side */}
            <mesh position={[x, poleBaseY + poleHeight / 2, bridgeZ - halfDepth + 0.5]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, poleHeight, 8]} />
              <meshStandardMaterial {...POLE_MAT} />
            </mesh>
            <mesh position={[x, poleBaseY + poleHeight, bridgeZ - halfDepth + 1.2]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 1.4, 6]} />
              <meshStandardMaterial {...POLE_MAT} />
            </mesh>
            <mesh position={[x, poleBaseY + poleHeight - 0.1, bridgeZ - halfDepth + 1.8]}>
              <boxGeometry args={[0.3, 0.1, 0.15]} />
              <meshStandardMaterial {...LIGHT_MAT} />
            </mesh>

            {/* Downstream side */}
            <mesh position={[x, poleBaseY + poleHeight / 2, bridgeZ + halfDepth - 0.5]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, poleHeight, 8]} />
              <meshStandardMaterial {...POLE_MAT} />
            </mesh>
            <mesh position={[x, poleBaseY + poleHeight, bridgeZ + halfDepth - 1.2]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 1.4, 6]} />
              <meshStandardMaterial {...POLE_MAT} />
            </mesh>
            <mesh position={[x, poleBaseY + poleHeight - 0.1, bridgeZ + halfDepth - 1.8]}>
              <boxGeometry args={[0.3, 0.1, 0.15]} />
              <meshStandardMaterial {...LIGHT_MAT} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
