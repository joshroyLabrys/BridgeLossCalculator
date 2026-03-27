// src/components/simulation/particle-engine.ts
import type { HydraulicProfile } from '@/engine/simulation-profile';
import { interpGroundElev } from '@/engine/simulation-profile';

interface Particle {
  x: number;           // pixel x
  y: number;           // pixel y
  vx: number;          // pixels per frame
  vy: number;          // pixels per frame (slight drift)
  opacity: number;
  size: number;        // radius
}

interface ScaleInfo {
  xScale: (station: number) => number;
  yScale: (elevation: number) => number;
}

const REGIME_COLORS = {
  'free-surface': {
    particles: ['#93c5fd', '#60a5fa', '#3b82f6'],
    glow: 'rgba(59, 130, 246, 0.15)',
  },
  'pressure': {
    particles: ['#fde68a', '#fbbf24', '#f59e0b'],
    glow: 'rgba(251, 191, 36, 0.15)',
  },
  'overtopping': {
    particles: ['#fca5a5', '#f87171', '#ef4444'],
    glow: 'rgba(248, 113, 113, 0.15)',
  },
} as const;

export class ParticleEngine {
  private particles: Particle[] = [];
  private animFrameId: number | null = null;
  private playing = false;
  private speedMultiplier = 1;
  private particleCount = 30;
  private profile: HydraulicProfile | null = null;
  private scales: ScaleInfo | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  detach() {
    this.pause();
    this.canvas = null;
    this.ctx = null;
  }

  configure(profile: HydraulicProfile, scales: ScaleInfo, count?: number) {
    this.profile = profile;
    this.scales = scales;
    if (count !== undefined) this.particleCount = count;
    this.particles = [];
    this.seedParticles();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.tick();
  }

  pause() {
    this.playing = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0.25, Math.min(3, multiplier));
  }

  setParticleCount(count: number) {
    this.particleCount = count;
  }

  /** Get pixel bounds of the water at a given pixel x */
  private getWaterBoundsAtX(pixelX: number): { top: number; bottom: number; inWater: boolean } {
    const p = this.profile!;
    const s = this.scales!;

    // Invert x to get station
    const firstSta = p.crossSection[0].station;
    const lastSta = p.crossSection[p.crossSection.length - 1].station;
    const x0 = s.xScale(firstSta);
    const x1 = s.xScale(lastSta);
    if (x1 === x0) return { top: 0, bottom: 0, inWater: false };

    const station = firstSta + ((pixelX - x0) / (x1 - x0)) * (lastSta - firstSta);
    if (station < firstSta || station > lastSta) return { top: 0, bottom: 0, inWater: false };

    const groundElev = interpGroundElev(p.crossSection, station);
    const wsel = p.usWsel;

    if (groundElev >= wsel) return { top: 0, bottom: 0, inWater: false };

    return {
      top: s.yScale(wsel),
      bottom: s.yScale(groundElev),
      inWater: true,
    };
  }

  private seedParticles() {
    if (!this.profile || !this.scales) return;
    for (let i = 0; i < this.particleCount; i++) {
      const particle = this.spawnParticle(true);
      if (particle) this.particles.push(particle);
    }
  }

  private spawnParticle(randomX: boolean): Particle | null {
    const p = this.profile!;
    const s = this.scales!;
    const cs = p.crossSection;
    const firstSta = cs[0].station;
    const lastSta = cs[cs.length - 1].station;

    // Find a station where there is water (ground < WSEL)
    // If randomX, place anywhere in the wetted area. Otherwise, place at the left edge.
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let station: number;
      if (randomX) {
        station = firstSta + Math.random() * (lastSta - firstSta);
      } else {
        // Find the leftmost wetted station and spawn there
        station = firstSta;
        for (const pt of cs) {
          if (pt.elevation < p.usWsel) {
            station = pt.station;
            break;
          }
        }
        // Add small random offset so particles don't all stack
        station += Math.random() * (lastSta - firstSta) * 0.05;
      }

      const groundElev = interpGroundElev(cs, station);
      if (groundElev >= p.usWsel) continue; // Dry here

      const depth = p.usWsel - groundElev;
      // Place particle within the water column, biased toward center
      const yFrac = 0.15 + Math.random() * 0.7;
      const elev = groundElev + yFrac * depth;

      const pixelX = s.xScale(station);
      const pixelY = s.yScale(elev);

      // Base speed: deeper water = faster (simplified velocity distribution)
      const depthFrac = depth / Math.max(p.approach.depth, 0.1);
      const baseVelocity = p.approach.velocity * Math.min(depthFrac, 2);

      // Convert velocity to pixels per frame
      const stationRange = lastSta - firstSta;
      const pixelRange = s.xScale(lastSta) - s.xScale(firstSta);
      const pixelsPerUnit = pixelRange / stationRange;
      const vx = baseVelocity * pixelsPerUnit * 0.012;

      return {
        x: pixelX,
        y: pixelY,
        vx: Math.max(vx, 0.3),
        vy: (Math.random() - 0.5) * 0.15,
        opacity: 0.6 + Math.random() * 0.4,
        size: 1.5 + Math.random() * 2,
      };
    }
    return null;
  }

  private tick = () => {
    if (!this.playing || !this.ctx || !this.canvas || !this.profile || !this.scales) return;
    this.update();
    this.render();
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private update() {
    const p = this.profile!;
    const s = this.scales!;
    const lastSta = p.crossSection[p.crossSection.length - 1].station;
    const rightEdge = s.xScale(lastSta) + 20;

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      // Check if in bridge zone — speed up
      const bridgeX1 = s.xScale(p.bridge.stationStart);
      const bridgeX2 = s.xScale(p.bridge.stationEnd);
      let velocityMult = 1;

      if (particle.x >= bridgeX1 && particle.x <= bridgeX2) {
        velocityMult = p.approach.velocity > 0
          ? Math.max(p.bridge.velocity / p.approach.velocity, 1.2)
          : 2;
      }

      // Move particle
      particle.x += particle.vx * velocityMult * this.speedMultiplier;

      // Gentle vertical drift + constrain to water
      particle.vy += (Math.random() - 0.5) * 0.05;
      particle.vy *= 0.95; // damping

      // Add turbulence in bridge zone for pressure/overtopping
      if (particle.x >= bridgeX1 && particle.x <= bridgeX2) {
        if (p.flowRegime === 'pressure') {
          particle.vy += (Math.random() - 0.5) * 0.8 * this.speedMultiplier;
        } else if (p.flowRegime === 'overtopping') {
          particle.vy += (Math.random() - 0.5) * 1.2 * this.speedMultiplier;
        }
      }

      particle.y += particle.vy;

      // Constrain to water bounds
      const bounds = this.getWaterBoundsAtX(particle.x);
      if (bounds.inWater) {
        const margin = 3;
        if (particle.y < bounds.top + margin) {
          particle.y = bounds.top + margin;
          particle.vy = Math.abs(particle.vy) * 0.3;
        }
        if (particle.y > bounds.bottom - margin) {
          particle.y = bounds.bottom - margin;
          particle.vy = -Math.abs(particle.vy) * 0.3;
        }
      }

      // Fade out near right edge
      const fadeStart = rightEdge - 60;
      if (particle.x > fadeStart) {
        particle.opacity = Math.max(0, (rightEdge - particle.x) / 60);
      }

      // Recycle particles that leave the frame or hit dry ground
      if (particle.x > rightEdge || !bounds.inWater || particle.opacity <= 0) {
        const newParticle = this.spawnParticle(false);
        if (newParticle) {
          this.particles[i] = newParticle;
        }
      }
    }

    // Maintain particle count
    while (this.particles.length < this.particleCount) {
      const p = this.spawnParticle(true);
      if (p) this.particles.push(p);
      else break;
    }
    while (this.particles.length > this.particleCount) {
      this.particles.pop();
    }
  }

  private render() {
    const ctx = this.ctx!;
    const canvas = this.canvas!;
    const regime = this.profile!.flowRegime;
    const colors = REGIME_COLORS[regime];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const particle of this.particles) {
      if (particle.opacity <= 0) continue;

      const color = colors.particles[Math.floor(Math.random() * 100) % colors.particles.length];

      ctx.globalAlpha = particle.opacity * 0.7;

      // Soft glow
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size + 2, 0, Math.PI * 2);
      ctx.fillStyle = colors.glow;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
