'use client';

import { useState, useCallback, useRef } from 'react';
import { useProjectStore } from '@/store/project-store';
import type { ProjectSnapshot, SerializedProjectState } from '@/engine/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Save,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  GitCompareArrows,
  AlertTriangle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function generateSummaryLine(): string {
  const state = useProjectStore.getState();
  if (!state.results) return 'No results computed';
  const energy = state.results.energy;
  if (energy.length === 0) return 'No profiles';
  const last = energy[energy.length - 1];
  const lowChord = Math.min(
    state.bridgeGeometry.lowChordLeft,
    state.bridgeGeometry.lowChordRight,
  );
  const fb = lowChord - last.upstreamWsel;
  return `${last.profileName}: WSEL ${last.upstreamWsel.toFixed(2)}, FB ${fb.toFixed(2)}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function diffSnapshots(a: SerializedProjectState, b: SerializedProjectState) {
  const changes: { parameter: string; valueA: string; valueB: string }[] = [];

  // Coefficients
  if (a.coefficients.contractionCoeff !== b.coefficients.contractionCoeff) {
    changes.push({
      parameter: 'Contraction Coeff',
      valueA: String(a.coefficients.contractionCoeff),
      valueB: String(b.coefficients.contractionCoeff),
    });
  }
  if (a.coefficients.expansionCoeff !== b.coefficients.expansionCoeff) {
    changes.push({
      parameter: 'Expansion Coeff',
      valueA: String(a.coefficients.expansionCoeff),
      valueB: String(b.coefficients.expansionCoeff),
    });
  }
  if (a.coefficients.debrisBlockagePct !== b.coefficients.debrisBlockagePct) {
    changes.push({
      parameter: 'Debris Blockage %',
      valueA: String(a.coefficients.debrisBlockagePct),
      valueB: String(b.coefficients.debrisBlockagePct),
    });
  }
  if (a.coefficients.yarnellK !== b.coefficients.yarnellK) {
    changes.push({
      parameter: 'Yarnell K',
      valueA: String(a.coefficients.yarnellK ?? 'auto'),
      valueB: String(b.coefficients.yarnellK ?? 'auto'),
    });
  }
  if (a.coefficients.freeboardThreshold !== b.coefficients.freeboardThreshold) {
    changes.push({
      parameter: 'Freeboard Threshold',
      valueA: String(a.coefficients.freeboardThreshold),
      valueB: String(b.coefficients.freeboardThreshold),
    });
  }

  // Manning's n - compare via cross section
  const nValuesA = a.crossSection.map((p) => p.manningsN).filter((n) => n > 0);
  const nValuesB = b.crossSection.map((p) => p.manningsN).filter((n) => n > 0);
  const avgNA = nValuesA.length > 0 ? nValuesA.reduce((s, v) => s + v, 0) / nValuesA.length : 0;
  const avgNB = nValuesB.length > 0 ? nValuesB.reduce((s, v) => s + v, 0) / nValuesB.length : 0;
  if (Math.abs(avgNA - avgNB) > 0.0001) {
    changes.push({
      parameter: "Manning's n (avg)",
      valueA: avgNA.toFixed(4),
      valueB: avgNB.toFixed(4),
    });
  }

  // Bridge geometry
  if (a.bridgeGeometry.lowChordLeft !== b.bridgeGeometry.lowChordLeft) {
    changes.push({
      parameter: 'Low Chord Left',
      valueA: String(a.bridgeGeometry.lowChordLeft),
      valueB: String(b.bridgeGeometry.lowChordLeft),
    });
  }
  if (a.bridgeGeometry.lowChordRight !== b.bridgeGeometry.lowChordRight) {
    changes.push({
      parameter: 'Low Chord Right',
      valueA: String(a.bridgeGeometry.lowChordRight),
      valueB: String(b.bridgeGeometry.lowChordRight),
    });
  }
  if (a.bridgeGeometry.highChord !== b.bridgeGeometry.highChord) {
    changes.push({
      parameter: 'High Chord',
      valueA: String(a.bridgeGeometry.highChord),
      valueB: String(b.bridgeGeometry.highChord),
    });
  }
  const spanA = a.bridgeGeometry.rightAbutmentStation - a.bridgeGeometry.leftAbutmentStation;
  const spanB = b.bridgeGeometry.rightAbutmentStation - b.bridgeGeometry.leftAbutmentStation;
  if (Math.abs(spanA - spanB) > 0.001) {
    changes.push({
      parameter: 'Bridge Span',
      valueA: spanA.toFixed(2),
      valueB: spanB.toFixed(2),
    });
  }
  if (a.bridgeGeometry.piers.length !== b.bridgeGeometry.piers.length) {
    changes.push({
      parameter: 'Pier Count',
      valueA: String(a.bridgeGeometry.piers.length),
      valueB: String(b.bridgeGeometry.piers.length),
    });
  }
  if (a.bridgeGeometry.skewAngle !== b.bridgeGeometry.skewAngle) {
    changes.push({
      parameter: 'Skew Angle',
      valueA: String(a.bridgeGeometry.skewAngle),
      valueB: String(b.bridgeGeometry.skewAngle),
    });
  }

  // Flow profiles count
  if (a.flowProfiles.length !== b.flowProfiles.length) {
    changes.push({
      parameter: 'Flow Profile Count',
      valueA: String(a.flowProfiles.length),
      valueB: String(b.flowProfiles.length),
    });
  }

  // Results deltas
  const resultDeltas: {
    profile: string;
    param: string;
    valueA: number;
    valueB: number;
    delta: number;
  }[] = [];

  if (a.results && b.results) {
    const lowChordA = Math.min(a.bridgeGeometry.lowChordLeft, a.bridgeGeometry.lowChordRight);
    const lowChordB = Math.min(b.bridgeGeometry.lowChordLeft, b.bridgeGeometry.lowChordRight);

    for (const rA of a.results.energy) {
      const rB = b.results.energy.find((r) => r.profileName === rA.profileName);
      if (!rB) continue;

      if (Math.abs(rA.upstreamWsel - rB.upstreamWsel) > 0.001) {
        resultDeltas.push({
          profile: rA.profileName,
          param: 'US WSEL',
          valueA: rA.upstreamWsel,
          valueB: rB.upstreamWsel,
          delta: rB.upstreamWsel - rA.upstreamWsel,
        });
      }
      if (Math.abs(rA.totalHeadLoss - rB.totalHeadLoss) > 0.001) {
        resultDeltas.push({
          profile: rA.profileName,
          param: 'Head Loss',
          valueA: rA.totalHeadLoss,
          valueB: rB.totalHeadLoss,
          delta: rB.totalHeadLoss - rA.totalHeadLoss,
        });
      }
      const fbA = lowChordA - rA.upstreamWsel;
      const fbB = lowChordB - rB.upstreamWsel;
      if (Math.abs(fbA - fbB) > 0.001) {
        resultDeltas.push({
          profile: rA.profileName,
          param: 'Freeboard',
          valueA: fbA,
          valueB: fbB,
          delta: fbB - fbA,
        });
      }
    }
  }

  return { changes, resultDeltas };
}

/* ------------------------------------------------------------------ */
/*  HistoryPanel                                                        */
/* ------------------------------------------------------------------ */

export function HistoryPanel() {
  const snapshots = useProjectStore((s) => s.snapshots);
  const saveSnapshot = useProjectStore((s) => s.saveSnapshot);
  const restoreSnapshot = useProjectStore((s) => s.restoreSnapshot);
  const deleteSnapshot = useProjectStore((s) => s.deleteSnapshot);

  const [saveOpen, setSaveOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNote, setSnapshotNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDiff, setShowDiff] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const atLimit = snapshots.length >= 20;
  const nearLimit = snapshots.length >= 18;

  const sorted = [...snapshots].sort((a, b) => b.timestamp - a.timestamp);

  const handleSave = useCallback(() => {
    if (!snapshotName.trim()) return;
    // Override the store's summaryLine generation with our richer one
    const summary = generateSummaryLine();
    saveSnapshot(snapshotName.trim(), snapshotNote.trim() || undefined);
    // Patch the summary on the just-saved snapshot
    const state = useProjectStore.getState();
    const last = state.snapshots[state.snapshots.length - 1];
    if (last) {
      const patched = state.snapshots.map((s) =>
        s.id === last.id ? { ...s, summaryLine: summary } : s,
      );
      useProjectStore.setState({ snapshots: patched });
      try {
        localStorage.setItem('project-snapshots', JSON.stringify(patched));
      } catch {
        // ignore
      }
    }
    setSnapshotName('');
    setSnapshotNote('');
    setSaveOpen(false);
  }, [snapshotName, snapshotNote, saveSnapshot]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev;
        next.add(id);
      }
      return next;
    });
    setShowDiff(false);
  }, []);

  const handleCompare = useCallback(() => {
    setShowDiff(true);
  }, []);

  const handleExportSnapshots = useCallback(() => {
    const json = JSON.stringify(snapshots, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshots-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshots]);

  const handleImportSnapshots = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result as string) as ProjectSnapshot[];
          if (!Array.isArray(imported)) return;
          const existing = useProjectStore.getState().snapshots;
          const existingIds = new Set(existing.map((s) => s.id));
          const merged = [
            ...existing,
            ...imported.filter((s) => !existingIds.has(s.id)),
          ].slice(-20);
          useProjectStore.setState({ snapshots: merged });
          try {
            localStorage.setItem('project-snapshots', JSON.stringify(merged));
          } catch {
            // ignore
          }
        } catch {
          // invalid JSON
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [],
  );

  const handleRestore = useCallback(
    (id: string) => {
      restoreSnapshot(id);
      setConfirmRestoreId(null);
    },
    [restoreSnapshot],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteSnapshot(id);
      setConfirmDeleteId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [deleteSnapshot],
  );

  // Diff data
  const diffData =
    showDiff && selected.size === 2
      ? (() => {
          const ids = [...selected];
          const snapA = snapshots.find((s) => s.id === ids[0]);
          const snapB = snapshots.find((s) => s.id === ids[1]);
          if (!snapA || !snapB) return null;
          return {
            nameA: snapA.name,
            nameB: snapB.name,
            ...diffSnapshots(snapA.state, snapB.state),
          };
        })()
      : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Snapshot History
        </h2>
        <p className="text-sm text-muted-foreground max-w-prose text-pretty">
          Save, compare, and restore project snapshots.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Save Snapshot Dialog */}
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger
            render={
              <Button size="sm" disabled={atLimit}>
                <Save className="h-4 w-4 mr-2" />
                Save Snapshot
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save Snapshot</DialogTitle>
              <DialogDescription>
                Capture the current project state for later comparison.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="snapshot-name">Name</Label>
                <Input
                  id="snapshot-name"
                  placeholder="e.g. Baseline run"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="snapshot-note">Note (optional)</Label>
                <textarea
                  id="snapshot-note"
                  className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[60px] resize-y dark:bg-input/30"
                  placeholder="Optional notes about this snapshot..."
                  value={snapshotNote}
                  onChange={(e) => setSnapshotNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button onClick={handleSave} disabled={!snapshotName.trim()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Compare */}
        {selected.size === 2 && (
          <Button size="sm" variant="outline" onClick={handleCompare}>
            <GitCompareArrows className="h-4 w-4 mr-2" />
            Compare Selected
          </Button>
        )}

        <div className="flex-1" />

        {/* Export / Import */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExportSnapshots}
          disabled={snapshots.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => importRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportSnapshots}
        />
      </div>

      {/* Limit warnings */}
      {atLimit && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Maximum 20 snapshots reached. Delete one to save more.
        </div>
      )}
      {nearLimit && !atLimit && (
        <div className="flex items-center gap-2 text-sm text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          Approaching 20 snapshot limit ({snapshots.length}/20).
        </div>
      )}

      {/* Snapshot list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Save className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm font-medium">No snapshots yet</p>
          <p className="text-xs mt-1">
            Save a snapshot to start tracking project history.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((snap) => (
            <Card key={snap.id} className="relative">
              <CardContent className="flex items-start gap-3 py-3 px-4">
                {/* Checkbox */}
                <div className="pt-1">
                  <Checkbox
                    checked={selected.has(snap.id)}
                    onCheckedChange={() => toggleSelect(snap.id)}
                    disabled={!selected.has(snap.id) && selected.size >= 2}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm truncate">
                      {snap.name}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {relativeTime(snap.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {snap.summaryLine}
                  </p>
                  {snap.note && (
                    <p className="text-xs text-muted-foreground/70 italic">
                      {snap.note}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Restore */}
                  <Dialog
                    open={confirmRestoreId === snap.id}
                    onOpenChange={(open) =>
                      setConfirmRestoreId(open ? snap.id : null)
                    }
                  >
                    <DialogTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" title="Restore">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Restore Snapshot</DialogTitle>
                        <DialogDescription>
                          This will replace all current project data with the
                          state from &ldquo;{snap.name}&rdquo;. Continue?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>
                          Cancel
                        </DialogClose>
                        <Button onClick={() => handleRestore(snap.id)}>
                          Restore
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Delete */}
                  <Dialog
                    open={confirmDeleteId === snap.id}
                    onOpenChange={(open) =>
                      setConfirmDeleteId(open ? snap.id : null)
                    }
                  >
                    <DialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Delete"
                          className="text-destructive/70 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Snapshot</DialogTitle>
                        <DialogDescription>
                          Permanently delete &ldquo;{snap.name}&rdquo;? This
                          cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>
                          Cancel
                        </DialogClose>
                        <Button
                          variant="destructive"
                          onClick={() => handleDelete(snap.id)}
                        >
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diff View */}
      {diffData && (
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Comparison: {diffData.nameA} vs {diffData.nameB}
          </h3>

          {/* Input changes */}
          {diffData.changes.length > 0 ? (
            <Card>
              <CardHeader className="py-2 px-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Input Changes
                </p>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-1.5 font-medium">Parameter</th>
                      <th className="px-4 py-1.5 font-medium">
                        {diffData.nameA}
                      </th>
                      <th className="px-4 py-1.5 font-medium">
                        {diffData.nameB}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffData.changes.map((c) => (
                      <tr key={c.parameter} className="border-b last:border-0">
                        <td className="px-4 py-1.5 text-muted-foreground">
                          {c.parameter}
                        </td>
                        <td className="px-4 py-1.5 font-mono text-xs">
                          {c.valueA}
                        </td>
                        <td className="px-4 py-1.5 font-mono text-xs bg-amber-500/10">
                          {c.valueB}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-xs text-muted-foreground">
              No input differences detected.
            </p>
          )}

          {/* Result deltas */}
          {diffData.resultDeltas.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Result Deltas
                </p>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-1.5 font-medium">Profile</th>
                      <th className="px-4 py-1.5 font-medium">Parameter</th>
                      <th className="px-4 py-1.5 font-medium">
                        {diffData.nameA}
                      </th>
                      <th className="px-4 py-1.5 font-medium">
                        {diffData.nameB}
                      </th>
                      <th className="px-4 py-1.5 font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffData.resultDeltas.map((d) => {
                      // For Freeboard, positive delta = improvement; for WSEL/Head Loss, negative = improvement
                      const isImprovement =
                        d.param === 'Freeboard' ? d.delta > 0 : d.delta < 0;
                      const deltaColor = isImprovement
                        ? 'text-emerald-500'
                        : 'text-red-500';
                      return (
                        <tr
                          key={`${d.profile}-${d.param}`}
                          className="border-b last:border-0"
                        >
                          <td className="px-4 py-1.5 text-muted-foreground">
                            {d.profile}
                          </td>
                          <td className="px-4 py-1.5 text-muted-foreground">
                            {d.param}
                          </td>
                          <td className="px-4 py-1.5 font-mono text-xs">
                            {d.valueA.toFixed(3)}
                          </td>
                          <td className="px-4 py-1.5 font-mono text-xs">
                            {d.valueB.toFixed(3)}
                          </td>
                          <td
                            className={`px-4 py-1.5 font-mono text-xs font-semibold ${deltaColor}`}
                          >
                            {d.delta > 0 ? '+' : ''}
                            {d.delta.toFixed(3)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {diffData.changes.length === 0 && diffData.resultDeltas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              These snapshots are identical.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
