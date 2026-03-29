'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@flowsuite/ui';
import { Button } from '@flowsuite/ui';
import { Badge } from '@flowsuite/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@flowsuite/ui';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@flowsuite/ui';
import { ChevronDown, TreePine, Info } from 'lucide-react';

type VegetationDensity = 'low' | 'medium' | 'high';

const VEGETATION_LABELS: Record<VegetationDensity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const VEGETATION_MULTIPLIERS: Record<VegetationDensity, number> = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
};

interface DebrisGuidanceProps {
  /** Bridge span width in feet */
  bridgeSpan: number;
  /** Current debris blockage percentage */
  currentDebrisPct: number;
  /** Callback to set the debris percentage in What-If overrides */
  onSetDebris: (pct: number) => void;
}

/**
 * ARR-recommended debris blockage guidance panel.
 *
 * Calculates a recommended debris blockage percentage based on:
 * - Waterway width (converted to metres for ARR thresholds)
 * - Vegetation density modifier
 * - Upstream bridge presence modifier
 */
export function DebrisGuidance({ bridgeSpan, currentDebrisPct, onSetDebris }: DebrisGuidanceProps) {
  const [open, setOpen] = useState(false);
  const [vegetation, setVegetation] = useState<VegetationDensity>('medium');
  const [upstreamBridges, setUpstreamBridges] = useState(false);

  // Convert bridge span from feet to metres for ARR thresholds
  const spanMetres = bridgeSpan * 0.3048;

  const recommendation = useMemo(() => {
    // ARR base blockage by waterway width
    let basePct: number;
    let widthCategory: string;
    if (spanMetres < 5) {
      basePct = 50;
      widthCategory = '< 5 m';
    } else if (spanMetres <= 20) {
      basePct = 33;
      widthCategory = '5-20 m';
    } else {
      basePct = 20;
      widthCategory = '> 20 m';
    }

    const vegMultiplier = VEGETATION_MULTIPLIERS[vegetation];
    const upstreamModifier = upstreamBridges ? 10 : 0;

    const recommended = Math.min(
      Math.round(basePct * vegMultiplier + upstreamModifier),
      100,
    );

    return { basePct, widthCategory, vegMultiplier, upstreamModifier, recommended };
  }, [spanMetres, vegetation, upstreamBridges]);

  const isAlreadySet = currentDebrisPct === recommendation.recommended;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full cursor-pointer">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TreePine className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wide">ARR Debris Guidance</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {spanMetres.toFixed(1)} m span
                </Badge>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-3 space-y-3">
            {/* Waterway width info */}
            <div className="flex items-start gap-2 rounded-md bg-muted/50 border border-border/40 px-2.5 py-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                ARR recommends debris blockage based on waterway width:
                &lt;5 m = 50%, 5-20 m = 33%, &gt;20 m = 20%.
                Your opening is <span className="font-medium text-foreground">{spanMetres.toFixed(1)} m</span> ({recommendation.widthCategory}).
              </p>
            </div>

            {/* Vegetation density */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Vegetation Density</label>
              <Select value={vegetation} onValueChange={(v) => setVegetation(v as VegetationDensity)}>
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (x0.5)</SelectItem>
                  <SelectItem value="medium">Medium (x1.0)</SelectItem>
                  <SelectItem value="high">High (x1.5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Upstream bridges toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Upstream Bridges Present</label>
              <button
                type="button"
                role="switch"
                aria-checked={upstreamBridges}
                onClick={() => setUpstreamBridges((v) => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  upstreamBridges ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm ring-0 transition-transform ${
                    upstreamBridges ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Formula breakdown */}
            <div className="rounded-md bg-muted/30 border border-border/30 px-2.5 py-2 space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Calculation</div>
              <div className="text-xs font-mono text-muted-foreground space-y-0.5">
                <div>
                  Base: <span className="text-foreground">{recommendation.basePct}%</span>
                  <span className="text-muted-foreground/60"> ({recommendation.widthCategory})</span>
                </div>
                <div>
                  x Vegetation: <span className="text-foreground">{recommendation.vegMultiplier}</span>
                  <span className="text-muted-foreground/60"> ({VEGETATION_LABELS[vegetation]})</span>
                </div>
                {recommendation.upstreamModifier > 0 && (
                  <div>
                    + Upstream: <span className="text-foreground">+{recommendation.upstreamModifier}%</span>
                  </div>
                )}
                <div className="h-px bg-border/40 my-1" />
                <div className="text-foreground font-semibold">
                  = {recommendation.recommended}%
                </div>
              </div>
            </div>

            {/* Use Recommended button */}
            <Button
              variant={isAlreadySet ? 'outline' : 'default'}
              size="sm"
              className="w-full text-xs h-7"
              disabled={isAlreadySet}
              onClick={() => onSetDebris(recommendation.recommended)}
            >
              {isAlreadySet ? 'Already Applied' : `Use Recommended (${recommendation.recommended}%)`}
            </Button>

            {currentDebrisPct > 0 && !isAlreadySet && (
              <p className="text-[10px] text-muted-foreground text-center">
                Current: {currentDebrisPct}% — Recommended: {recommendation.recommended}%
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
