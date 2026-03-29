'use client';

import { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Sky } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  N8AO,
  ToneMapping,
  Vignette,
  SMAA,
  GodRays,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { HydraulicProfile } from '@flowsuite/engine/simulation-profile';
import { TerrainMesh } from './terrain-mesh';
import { WaterMesh } from './water-mesh';
import { BridgeMesh } from './bridge-mesh';
import { GrassMesh } from './grass-mesh';
import { SprayParticles } from './spray-particles';
import { BridgeDetails } from './bridge-details';
import { DebrisMat } from '../debris-mat';

/* ── Feature flags ── */
export interface RenderFeatures {
  textures: boolean;
  smaa: boolean;
  ambientOcclusion: boolean;
  bloom: boolean;
  godRays: boolean;
  vignette: boolean;
  toneMapping: boolean;
}

const DEFAULT_FEATURES: RenderFeatures = {
  textures: true,
  smaa: true,
  ambientOcclusion: true,
  bloom: true,
  godRays: true,
  vignette: true,
  toneMapping: true,
};

interface SimulationSceneProps {
  profile: HydraulicProfile;
  /** Debris blockage percentage 0-100 (from What-If overrides) */
  debrisPct?: number;
}

interface SceneContentProps {
  profile: HydraulicProfile;
  features: RenderFeatures;
  debrisPct: number;
}

function SceneContent({ profile, features, debrisPct }: SceneContentProps) {
  const cs = profile.crossSection;
  const bridge = profile.bridge;
  const sunRef = useRef<THREE.Mesh>(null);
  const [sunReady, setSunReady] = useState(false);

  const span = cs[cs.length - 1].station - cs[0].station;

  const bridgeDeckWidth = bridge.deckWidth > 0
    ? bridge.deckWidth
    : Math.max(span * 0.3, 8);

  const channelLength = Math.max(bridgeDeckWidth * 0.6, span * 0.4, 15);

  const centerX = (cs[0].station + cs[cs.length - 1].station) / 2;
  const minElev = Math.min(...cs.map(p => p.elevation));
  const maxElev = Math.max(bridge.highChord, profile.usWsel);
  const centerY = (minElev + maxElev) / 2;
  const centerZ = channelLength / 2;
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  const sunPos: [number, number, number] = [
    centerX + span * 0.8,
    maxElev + 15,
    centerZ + channelLength * 0.8,
  ];

  useEffect(() => {
    const timer = requestAnimationFrame(() => setSunReady(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <>
      {/* HDRI environment for IBL */}
      <Environment preset="sunset" background={false} environmentIntensity={0.9} />

      {/* Procedural sky — atmospheric scattering with visible sun */}
      {/* sunPosition is a direction vector (rendered at infinity), not world coords */}
      <Sky
        sunPosition={[50, 80, 50]}
        turbidity={1}
        rayleigh={1.5}
        mieCoefficient={0.001}
        mieDirectionalG={0.6}
        distance={450000}
      />

      {/* Main directional — shadow-casting sun */}
      <directionalLight
        position={[centerX + span, maxElev + 20, centerZ + channelLength]}
        intensity={1.1}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={channelLength}
        shadow-camera-bottom={-channelLength}
        shadow-camera-near={1}
        shadow-camera-far={sceneSize * 4}
      />

      {/* Subtle fill light */}
      <directionalLight
        position={[centerX - span * 0.5, maxElev + 10, centerZ - channelLength * 0.5]}
        intensity={0.15}
        color="#c8d8f0"
      />

      {/* Sun disc (god ray source) */}
      <mesh ref={sunRef} position={sunPos} visible={features.godRays}>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#fff5e6" transparent opacity={0.85} />
      </mesh>

      {/* Terrain */}
      <TerrainMesh crossSection={cs} channelLength={channelLength} />

      {/* Contact shadows */}
      <ContactShadows
        position={[centerX, minElev + 0.01, centerZ]}
        width={span * 1.5}
        height={channelLength * 1.5}
        opacity={0.35}
        blur={2}
        far={maxElev - minElev + 10}
        resolution={512}
      />

      {/* Water */}
      <WaterMesh
        crossSection={cs}
        wsel={profile.usWsel}
        channelLength={channelLength}
        flowRegime={profile.flowRegime}
        velocity={profile.approach.velocity}
        bridgeBounds={{
          xMin: bridge.stationStart,
          xMax: bridge.stationEnd,
          yBottom: Math.min(bridge.lowChordLeft, bridge.lowChordRight),
          yTop: bridge.highChord,
          zMin: centerZ - bridgeDeckWidth / 2,
          zMax: centerZ + bridgeDeckWidth / 2,
        }}
      />

      {/* Bridge */}
      <BridgeMesh
        bridge={{
          lowChordLeft: bridge.lowChordLeft,
          lowChordRight: bridge.lowChordRight,
          highChord: bridge.highChord,
          leftAbutmentStation: bridge.stationStart,
          rightAbutmentStation: bridge.stationEnd,
          deckWidth: bridgeDeckWidth,
          piers: bridge.piers,
          skewAngle: 0,
          contractionLength: 0,
          expansionLength: 0,
          orificeCd: 0,
          weirCw: 0,
          lowChordProfile: [],
        }}
        crossSection={cs}
        channelLength={channelLength}
      />

      {/* Bridge detail props — barriers, light poles */}
      <BridgeDetails
        leftAbutment={bridge.stationStart}
        rightAbutment={bridge.stationEnd}
        highChord={bridge.highChord}
        deckDepth={bridgeDeckWidth}
        bridgeZ={centerZ}
      />

      {/* Debris mat at upstream face */}
      {debrisPct > 0 && (
        <DebrisMat
          blockagePct={debrisPct}
          openingWidth={bridge.stationEnd - bridge.stationStart}
          leftStation={bridge.stationStart}
          wsel={profile.usWsel}
          lowChord={Math.min(bridge.lowChordLeft, bridge.lowChordRight)}
          bridgeZ={centerZ}
          deckDepth={bridgeDeckWidth}
        />
      )}

      {/* Grass on terrain above waterline */}
      <GrassMesh
        crossSection={cs}
        channelLength={channelLength}
        wsel={profile.usWsel}
      />

      {/* Pier spray + atmospheric mist */}
      <SprayParticles
        crossSection={cs}
        channelLength={channelLength}
        wsel={profile.usWsel}
        velocity={profile.approach.velocity}
        pierStations={bridge.piers.map(p => p.station)}
      />

      {/* Camera controls */}
      <OrbitControls
        target={[centerX, centerY, centerZ]}
        minDistance={1}
        maxDistance={sceneSize * 5}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI * 0.85}
        makeDefault
      />

      {/* Post-processing */}
      <EffectComposer multisampling={0}>
        {features.smaa ? <SMAA /> : <></>}
        {features.ambientOcclusion ? (
          <N8AO aoRadius={2.0} distanceFalloff={0.5} intensity={2.5} quality="medium" />
        ) : <></>}
        {features.bloom ? (
          <Bloom luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.15} mipmapBlur />
        ) : <></>}
        {features.godRays && sunReady && sunRef.current ? (
          <GodRays
            sun={sunRef.current}
            samples={40}
            density={0.96}
            decay={0.92}
            weight={0.3}
            exposure={0.5}
            clampMax={1}
            blur
          />
        ) : <></>}
        {features.toneMapping ? (
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        ) : <></>}
        {features.vignette ? (
          <Vignette offset={0.25} darkness={0.4} blendFunction={BlendFunction.NORMAL} />
        ) : <></>}
      </EffectComposer>
    </>
  );
}

/* ── Feature toggle labels ── */
const FEATURE_META: { key: keyof RenderFeatures; label: string }[] = [
  { key: 'textures', label: 'PBR Textures' },
  { key: 'smaa', label: 'SMAA' },
  { key: 'ambientOcclusion', label: 'Ambient Occlusion' },
  { key: 'bloom', label: 'Bloom' },
  { key: 'godRays', label: 'God Rays' },
  { key: 'toneMapping', label: 'Tone Mapping' },
  { key: 'vignette', label: 'Vignette' },
];

export function SimulationScene({ profile, debrisPct = 0 }: SimulationSceneProps) {
  const cs = profile.crossSection;
  const span = cs[cs.length - 1].station - cs[0].station;
  const minElev = Math.min(...cs.map(p => p.elevation));
  const maxElev = Math.max(profile.bridge.highChord, profile.usWsel);
  const centerX = (cs[0].station + cs[cs.length - 1].station) / 2;
  const channelLength = Math.max(span * 0.6, 20);
  const centerZ = channelLength / 2;
  const sceneSize = Math.max(span, maxElev - minElev, channelLength);

  const [features, setFeatures] = useState<RenderFeatures>(DEFAULT_FEATURES);
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = useCallback((key: keyof RenderFeatures) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // WebGPU detection
  const [rendererType, setRendererType] = useState<'webgl' | 'webgpu'>('webgl');
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      (navigator as any).gpu.requestAdapter().then((adapter: any) => {
        if (adapter) setRendererType('webgpu');
      }).catch(() => {});
    }
  }, []);

  return (
    <div className="relative w-full rounded-lg overflow-hidden h-[300px] sm:h-[400px] lg:h-[500px]" data-scene-capture>
      <Canvas
        shadows="soft"
        camera={{
          position: [
            centerX + sceneSize * 0.35,
            maxElev + sceneSize * 0.25,
            centerZ + sceneSize * 0.4,
          ],
          fov: 45,
          near: 0.1,
          far: sceneSize * 20,
        }}
        gl={{
          antialias: !features.smaa,
          alpha: true,
          preserveDrawingBuffer: true,
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ background: 'oklch(0.14 0.01 230)' }}
      >
        <Suspense fallback={null}>
          <SceneContent profile={profile} features={features} debrisPct={debrisPct} />
        </Suspense>
      </Canvas>

      {/* Toggle panel button */}
      <button
        onClick={() => setPanelOpen(p => !p)}
        className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium bg-black/50 text-white/80 backdrop-blur-sm hover:bg-black/70 transition-colors cursor-pointer"
      >
        {panelOpen ? 'Close' : 'Render'}
      </button>

      {/* Feature toggle panel */}
      {panelOpen && (
        <div className="absolute top-9 right-2 w-44 bg-black/70 backdrop-blur-md rounded-lg p-2.5 space-y-1 text-[11px] text-white/90">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-white/50 mb-1">Render Features</div>
          {FEATURE_META.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
              <input
                type="checkbox"
                checked={features[key]}
                onChange={() => toggle(key)}
                className="accent-blue-500 h-3 w-3"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Renderer badge */}
      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-black/40 text-white/50 backdrop-blur-sm pointer-events-none">
        {rendererType === 'webgpu' ? 'WebGPU' : 'WebGL 2'}
      </div>
    </div>
  );
}
