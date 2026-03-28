'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useProjectStore } from '@/store/project-store';
import { runReachAnalysis } from '@/engine/reach/reach-solver';
import { GitBranch, Plus, Trash2, Play, AlertTriangle, CheckCircle2 } from 'lucide-react';

const MAX_BRIDGES = 5;

function isBridgeComplete(b: { crossSection: { length: number }; bridgeGeometry: { highChord: number } }) {
  return b.crossSection.length >= 2 && b.bridgeGeometry.highChord > 0;
}

export function ReachManager() {
  const reachMode = useProjectStore((s) => s.reachMode);
  const setReachMode = useProjectStore((s) => s.setReachMode);
  const bridges = useProjectStore((s) => s.bridges);
  const activeBridgeIndex = useProjectStore((s) => s.activeBridgeIndex);
  const setActiveBridgeIndex = useProjectStore((s) => s.setActiveBridgeIndex);
  const addBridge = useProjectStore((s) => s.addBridge);
  const removeBridge = useProjectStore((s) => s.removeBridge);
  const updateBridge = useProjectStore((s) => s.updateBridge);
  const setReachResults = useProjectStore((s) => s.setReachResults);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const coefficients = useProjectStore((s) => s.coefficients);
  const projectName = useProjectStore((s) => s.projectName);

  const [running, setRunning] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleToggleReachMode() {
    if (!reachMode) {
      // Enable reach mode
      setReachMode(true);
      // If no bridges exist, create the first from current state
      if (bridges.length === 0) {
        addBridge(projectName || 'Bridge 1', 0);
        // We need to update after the next render cycle since addBridge
        // creates a bridge with empty cross section by default.
        // Use setTimeout to wait for zustand state to settle.
        setTimeout(() => {
          const state = useProjectStore.getState();
          const firstBridge = state.bridges[0];
          if (firstBridge) {
            updateBridge(firstBridge.id, {
              crossSection: state.crossSection,
              bridgeGeometry: state.bridgeGeometry,
              coefficients: state.coefficients,
            });
          }
        }, 0);
      }
    } else {
      setReachMode(false);
      setReachResults(null);
    }
  }

  function handleAddBridge() {
    if (bridges.length >= MAX_BRIDGES) return;
    const maxChainage = bridges.reduce((max, b) => Math.max(max, b.chainage), 0);
    addBridge(`Bridge ${bridges.length + 1}`, maxChainage + 100);
  }

  function handleRemoveBridge(id: string) {
    if (confirmDeleteId === id) {
      removeBridge(id);
      setConfirmDeleteId(null);
      // Adjust active index if needed
      if (activeBridgeIndex >= bridges.length - 1 && activeBridgeIndex > 0) {
        setActiveBridgeIndex(activeBridgeIndex - 1);
      }
    } else {
      setConfirmDeleteId(id);
    }
  }

  function handleRunReach() {
    if (bridges.length === 0 || flowProfiles.length === 0) return;
    setRunning(true);
    try {
      const results = runReachAnalysis(bridges, flowProfiles);
      setReachResults(results);
      // Also store per-bridge results
      for (const br of results.bridgeResults) {
        updateBridge(br.bridgeId, { results: br.results });
      }
    } finally {
      setRunning(false);
    }
  }

  function handleNameChange(id: string, name: string) {
    updateBridge(id, { name });
  }

  function handleChainageChange(id: string, value: string) {
    const chainage = parseFloat(value);
    if (!isNaN(chainage)) {
      updateBridge(id, { chainage });
    }
  }

  // Compute schematic positions
  const sortedBridges = [...bridges].sort((a, b) => a.chainage - b.chainage);
  const minCh = sortedBridges.length > 0 ? sortedBridges[0].chainage : 0;
  const maxCh = sortedBridges.length > 0 ? sortedBridges[sortedBridges.length - 1].chainage : 100;
  const chRange = maxCh - minCh || 100;

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Analysis Mode</h3>
            </div>
            <Button
              variant={reachMode ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleReachMode}
            >
              {reachMode ? 'Reach Analysis' : 'Single Bridge'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {reachMode
              ? 'Multiple bridges processed downstream to upstream with tailwater cascade.'
              : 'Switch to Reach mode to analyze multiple bridges in sequence.'}
          </p>
        </CardHeader>
      </Card>

      {reachMode && (
        <>
          {/* Bridge List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Bridges ({bridges.length}/{MAX_BRIDGES})</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddBridge}
                  disabled={bridges.length >= MAX_BRIDGES}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Bridge
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {bridges.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No bridges configured. Click &quot;Add Bridge&quot; to get started.
                </p>
              )}
              {bridges.map((bridge, idx) => {
                const complete = isBridgeComplete(bridge);
                const isActive = idx === activeBridgeIndex;
                const lowChord = Math.min(bridge.bridgeGeometry.lowChordLeft, bridge.bridgeGeometry.lowChordRight);
                return (
                  <div
                    key={bridge.id}
                    className={`flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                    onClick={() => setActiveBridgeIndex(idx)}
                  >
                    <div className="flex-1 min-w-0 grid grid-cols-[1fr_80px_80px] gap-2 items-center">
                      <Input
                        value={bridge.name}
                        onChange={(e) => handleNameChange(bridge.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-xs"
                        placeholder="Bridge name"
                      />
                      <Input
                        type="number"
                        value={bridge.chainage}
                        onChange={(e) => handleChainageChange(bridge.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-xs"
                        placeholder="Ch."
                        title="Chainage (m)"
                      />
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {lowChord > 0 ? `LC: ${lowChord.toFixed(1)}` : 'LC: --'}
                      </div>
                    </div>
                    <Badge variant={complete ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                      {complete ? (
                        <><CheckCircle2 className="h-3 w-3 mr-0.5" />OK</>
                      ) : (
                        <><AlertTriangle className="h-3 w-3 mr-0.5" />Inc.</>
                      )}
                    </Badge>
                    {bridges.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive/60 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveBridge(bridge.id);
                        }}
                        title={confirmDeleteId === bridge.id ? 'Click again to confirm' : 'Remove bridge'}
                      >
                        <Trash2 className={`h-3.5 w-3.5 ${confirmDeleteId === bridge.id ? 'animate-pulse' : ''}`} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Reach Schematic */}
          {bridges.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-semibold">Reach Schematic</h3>
              </CardHeader>
              <CardContent>
                <svg
                  viewBox="0 0 400 80"
                  className="w-full h-20"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Waterway line */}
                  <line x1="20" y1="45" x2="380" y2="45" stroke="currentColor" strokeWidth="1.5" className="text-blue-400/60" />

                  {/* Flow direction arrow */}
                  <defs>
                    <marker id="flow-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" className="fill-blue-400/60" />
                    </marker>
                  </defs>
                  <line x1="350" y1="55" x2="50" y2="55" stroke="currentColor" strokeWidth="1" className="text-blue-400/40" markerEnd="url(#flow-arrow)" strokeDasharray="4 3" />
                  <text x="200" y="68" textAnchor="middle" className="fill-muted-foreground text-[8px]">Flow Direction</text>

                  {/* Bridge icons */}
                  {sortedBridges.map((bridge) => {
                    const bridgeIdx = bridges.findIndex((b) => b.id === bridge.id);
                    const isActive = bridgeIdx === activeBridgeIndex;
                    const x = bridges.length === 1
                      ? 200
                      : 40 + ((bridge.chainage - minCh) / chRange) * 320;

                    return (
                      <g
                        key={bridge.id}
                        onClick={() => setActiveBridgeIndex(bridgeIdx)}
                        className="cursor-pointer"
                      >
                        {/* Bridge rectangle */}
                        <rect
                          x={x - 8}
                          y="30"
                          width="16"
                          height="30"
                          rx="2"
                          className={`transition-colors ${
                            isActive
                              ? 'fill-primary stroke-primary'
                              : isBridgeComplete(bridge)
                                ? 'fill-muted stroke-foreground/40'
                                : 'fill-destructive/20 stroke-destructive/60'
                          }`}
                          strokeWidth="1.5"
                        />
                        {/* Bridge name label */}
                        <text
                          x={x}
                          y="22"
                          textAnchor="middle"
                          className={`text-[7px] ${isActive ? 'fill-primary font-semibold' : 'fill-muted-foreground'}`}
                        >
                          {bridge.name.length > 12 ? bridge.name.slice(0, 10) + '..' : bridge.name}
                        </text>
                        {/* Chainage label */}
                        <text
                          x={x}
                          y="14"
                          textAnchor="middle"
                          className="fill-muted-foreground text-[6px]"
                        >
                          Ch. {bridge.chainage}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </CardContent>
            </Card>
          )}

          {/* Run Reach Analysis */}
          <Card>
            <CardContent className="pt-4">
              <Button
                onClick={handleRunReach}
                disabled={running || bridges.length === 0 || flowProfiles.length === 0}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                {running ? 'Running...' : 'Run Reach Analysis'}
              </Button>
              {flowProfiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Add flow profiles first.
                </p>
              )}
              {bridges.length > 0 && bridges.some((b) => !isBridgeComplete(b)) && (
                <p className="text-xs text-amber-500 text-center mt-2">
                  Some bridges are incomplete and will be skipped.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
