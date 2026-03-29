'use client';

import { Button } from '@flowsuite/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@flowsuite/ui';
import { Play, Pause } from 'lucide-react';
import type { FlowProfile } from '@flowsuite/engine/types';

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

function methodLabel(m: string) {
  return m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1);
}

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
    <div className="flex items-center gap-3 flex-wrap">
      {/* Flow profile */}
      <Select value={String(selectedProfileIdx)} onValueChange={(v) => onProfileChange(Number(v))}>
        <SelectTrigger size="sm" className="text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p, i) => (
            <SelectItem key={i} value={String(i)}>
              {p.name} — {p.ari}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Method pills */}
      <div className="inline-flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => onMethodChange(m)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              selectedMethod === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${METHOD_DOTS[m] ?? 'bg-gray-500'}`} />
            {methodLabel(m)}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border/40" />

      {/* Play/Pause */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPlayingChange(!isPlaying)}
        className="gap-1.5 h-7 px-2.5 text-xs"
      >
        {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>

      {/* Speed */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Speed</span>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.25}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-16 accent-primary h-1"
        />
        <span className="text-[10px] font-mono text-muted-foreground w-6">{speed}x</span>
      </div>
    </div>
  );
}
