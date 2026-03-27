// src/components/simulation/simulation-controls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import type { FlowProfile } from '@/engine/types';

interface SimulationControlsProps {
  profiles: FlowProfile[];
  selectedProfileIdx: number;
  onProfileChange: (idx: number) => void;
  methods: readonly string[];
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  isPlaying: boolean;
  onPlayingChange: (playing: boolean) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const METHOD_DOTS: Record<string, string> = {
  energy: 'bg-blue-500',
  momentum: 'bg-emerald-500',
  yarnell: 'bg-amber-500',
  wspro: 'bg-purple-500',
};

export function SimulationControls({
  profiles,
  selectedProfileIdx,
  onProfileChange,
  methods,
  selectedMethod,
  onMethodChange,
  isPlaying,
  onPlayingChange,
  speed,
  onSpeedChange,
}: SimulationControlsProps) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Flow profile selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground font-medium">Profile</label>
        <select
          value={selectedProfileIdx}
          onChange={(e) => onProfileChange(Number(e.target.value))}
          className="rounded-md border border-border/50 bg-card text-foreground px-2.5 py-1.5 text-xs [&_option]:bg-card [&_option]:text-foreground"
        >
          {profiles.map((p, i) => (
            <option key={i} value={i}>
              {p.name} — {p.ari} ({p.discharge.toFixed(0)} cfs)
            </option>
          ))}
        </select>
      </div>

      {/* Method selector */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => onMethodChange(m)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              selectedMethod === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${METHOD_DOTS[m] ?? 'bg-gray-500'}`} />
            {m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-border/40" />

      {/* Play/Pause */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPlayingChange(!isPlaying)}
        className="gap-1.5"
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>

      {/* Speed slider */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Speed</label>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-20 accent-primary"
        />
        <span className="text-xs font-mono text-muted-foreground w-8">{speed}x</span>
      </div>
    </div>
  );
}
