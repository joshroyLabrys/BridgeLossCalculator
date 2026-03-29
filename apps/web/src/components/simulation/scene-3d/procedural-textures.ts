'use client';

import * as THREE from 'three';

/* ── Noise primitives ── */

function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function fbm(x: number, y: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.0;
  }
  return val;
}

/* ── Texture cache ── */

const textureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreate(
  key: string,
  size: number,
  paint: (data: Uint8ClampedArray, w: number, h: number) => void,
): THREE.CanvasTexture {
  if (textureCache.has(key)) return textureCache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  paint(img.data, size, size);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/* ── Normal map helper ── */

function normalFromHeight(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  heightFn: (x: number, y: number) => number,
  strength: number,
) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const nx = (x + 1) / w;
      const ny = (y + 1) / h;
      const px = x / w;
      const py = y / h;
      const h0 = heightFn(px, py);
      const hR = heightFn(nx, py);
      const hU = heightFn(px, ny);
      const dx = (h0 - hR) * strength;
      const dy = (h0 - hU) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      data[i]     = ((dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
}

/* ── Public texture generators ── */

/** Concrete normal map — grainy surface with pores and micro-cracks */
export function concreteNormalMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('concrete-normal', size, (data, w, h) => {
    normalFromHeight(data, w, h, (x, y) => {
      const grain = fbm(x * 8, y * 8, 5);
      const pores = smoothNoise(x * 30, y * 30) > 0.72 ? -0.15 : 0;
      const crack = Math.abs(smoothNoise(x * 3 + 0.5, y * 50)) < 0.02 ? -0.2 : 0;
      return grain + pores + crack;
    }, 2.0);
  });
}

/** Concrete roughness map — mostly rough with smoother worn patches */
export function concreteRoughnessMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('concrete-roughness', size, (data, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const base = 0.82;
        const variation = fbm(x / w * 6, y / h * 6, 4) * 0.18;
        const pore = smoothNoise(x / w * 30, y / h * 30) > 0.7 ? -0.08 : 0;
        const v = Math.max(0, Math.min(1, base + variation + pore)) * 255;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
  });
}

/** Asphalt normal map — aggregate chips in binder */
export function asphaltNormalMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('asphalt-normal', size, (data, w, h) => {
    normalFromHeight(data, w, h, (x, y) => {
      const coarse = fbm(x * 15, y * 15, 4) * 0.6;
      const chips = smoothNoise(x * 40, y * 40) * 0.4;
      return coarse + chips;
    }, 1.5);
  });
}

/** Earth/soil normal map — rough ground with embedded rocks */
export function earthNormalMap(size = 512): THREE.CanvasTexture {
  return getOrCreate('earth-normal', size, (data, w, h) => {
    normalFromHeight(data, w, h, (x, y) => {
      const soil = fbm(x * 10, y * 10, 6);
      const rocks = smoothNoise(x * 25, y * 25) > 0.65 ? 0.3 : 0;
      return soil + rocks;
    }, 2.5);
  });
}

/**
 * Concrete albedo (color) map — visible variation:
 * form lines, water staining streaks, aggregate patches, worn areas.
 * Base color is light grey concrete; variation makes it look weathered and real.
 */
export function concreteAlbedoMap(size = 512): THREE.CanvasTexture {
  const tex = getOrCreate('concrete-albedo', size, (data, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const u = x / w;
        const v = y / h;

        // Base concrete grey (0.55 - 0.65 luminance range)
        const base = 0.58 + fbm(u * 4, v * 4, 3) * 0.08;

        // Horizontal form lines (from formwork during pour)
        const formLine = Math.abs(Math.sin(v * 80)) < 0.05 ? -0.03 : 0;

        // Vertical water staining streaks (dark drip marks)
        const stainSeed = smoothNoise(u * 8, 0.5);
        const stain = stainSeed > 0.6
          ? -0.06 * smoothNoise(u * 12, v * 3) * smoothstep(0.6, 0.8, stainSeed)
          : 0;

        // Aggregate patches (lighter spots where aggregate shows)
        const agg = smoothNoise(u * 20, v * 20);
        const aggregate = agg > 0.7 ? 0.04 : agg < 0.2 ? -0.02 : 0;

        // Larger color variation (patches of slightly different pours)
        const patch = fbm(u * 2 + 3.7, v * 2 + 1.3, 2) * 0.04;

        const lum = Math.max(0.35, Math.min(0.72, base + formLine + stain + aggregate + patch));

        // Slight warm tint (concrete has a slightly warm grey)
        data[i]     = lum * 255;               // R
        data[i + 1] = (lum - 0.005) * 255;     // G (slightly less)
        data[i + 2] = (lum - 0.015) * 255;     // B (slightly less — warm)
        data[i + 3] = 255;
      }
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace; // albedo must be sRGB
  return tex;
}

/**
 * Asphalt albedo map — dark with aggregate chips and wear patches.
 */
export function asphaltAlbedoMap(size = 512): THREE.CanvasTexture {
  const tex = getOrCreate('asphalt-albedo', size, (data, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const u = x / w;
        const v = y / h;

        const base = 0.14 + fbm(u * 6, v * 6, 3) * 0.04;

        // Light aggregate chips
        const chip = smoothNoise(u * 35, v * 35);
        const chipBright = chip > 0.75 ? 0.08 : chip > 0.65 ? 0.03 : 0;

        // Worn tire tracks (slightly lighter)
        const trackU = Math.abs(u - 0.3);
        const trackU2 = Math.abs(u - 0.7);
        const track = (trackU < 0.06 || trackU2 < 0.06) ? 0.02 : 0;

        const lum = Math.max(0.08, Math.min(0.3, base + chipBright + track));
        data[i]     = lum * 255;
        data[i + 1] = lum * 255;
        data[i + 2] = (lum + 0.005) * 255; // slight cool tint
        data[i + 3] = 255;
      }
    }
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dispose all cached textures (call on unmount) */
export function disposeTextureCache(): void {
  textureCache.forEach(t => t.dispose());
  textureCache.clear();
}
