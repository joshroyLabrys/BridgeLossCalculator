// src/components/simulation/particle-engine.ts
import type { HydraulicProfile } from '@/engine/simulation-profile';

interface Particle {
  x: number;           // pixel x
  y: number;           // pixel y
  vx: number;          // pixels per frame
  stage: 'approach' | 'bridge' | 'exit';
  progress: number;    // 0-1 within stage
  opacity: number;
}

interface ScaleInfo {
  /** Convert longitudinal station to pixel x */
  xScale: (station: number) => number;
  /** Convert elevation to pixel y */
  yScale: (elevation: number) => number;
}

const REGIME_COLORS = {
  'free-surface': { particle: '#60a5fa', glow: 'rgba(96, 165, 250, 0.3)' },
  'pressure':     { particle: '#fbbf24', glow: 'rgba(251, 191, 36, 0.3)' },
  'overtopping':  { particle: '#f87171', glow: 'rgba(248, 113, 113, 0.3)' },
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

  private seedParticles() {
    if (!this.profile || !this.scales) return;
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.spawnParticle(Math.random()));
    }
  }

  private spawnParticle(initialProgress?: number): Particle {
    const p = this.profile!;
    const s = this.scales!;
    const progress = initialProgress ?? 0;

    const x = s.xScale(p.approach.stationStart + progress * (p.exit.stationEnd - p.approach.stationStart));
    const wsel = p.approach.wsel;
    const bed = p.approach.bedElevation;
    const yFrac = 0.2 + Math.random() * 0.6;
    const elev = bed + yFrac * (wsel - bed);
    const y = s.yScale(elev);

    const pixelsPerStation = Math.abs(s.xScale(1) - s.xScale(0));
    const baseSpeed = p.approach.velocity * pixelsPerStation * 0.02;

    return { x, y, vx: baseSpeed, stage: 'approach', progress, opacity: 1 };
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
    const totalWidth = s.xScale(p.exit.stationEnd) - s.xScale(p.approach.stationStart);

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];

      let velocityMult = 1;
      const bridgeX1 = s.xScale(p.bridge.stationStart);
      const bridgeX2 = s.xScale(p.bridge.stationEnd);

      if (particle.x >= bridgeX1 && particle.x <= bridgeX2) {
        particle.stage = 'bridge';
        velocityMult = p.approach.velocity > 0
          ? p.bridge.velocity / p.approach.velocity
          : 2;
      } else if (particle.x > bridgeX2) {
        particle.stage = 'exit';
        velocityMult = p.approach.velocity > 0
          ? p.exit.velocity / p.approach.velocity
          : 0.8;
      } else {
        particle.stage = 'approach';
        velocityMult = 1;
      }

      let turbY = 0;
      if (particle.stage === 'bridge') {
        if (p.flowRegime === 'pressure') {
          turbY = (Math.random() - 0.5) * 2 * this.speedMultiplier;
        } else if (p.flowRegime === 'overtopping') {
          turbY = (Math.random() - 0.5) * 3 * this.speedMultiplier;
        }
      }

      particle.x += particle.vx * velocityMult * this.speedMultiplier;
      particle.y += turbY;
      particle.progress = (particle.x - s.xScale(p.approach.stationStart)) / totalWidth;

      if (particle.progress > 0.85) {
        particle.opacity = Math.max(0, (1 - particle.progress) / 0.15);
      }

      if (particle.progress >= 1 || particle.x > s.xScale(p.exit.stationEnd) + 10) {
        this.particles[i] = this.spawnParticle(0);
      }
    }

    while (this.particles.length < this.particleCount) {
      this.particles.push(this.spawnParticle(Math.random()));
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

      ctx.globalAlpha = particle.opacity * 0.8;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = colors.glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = colors.particle;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
