'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, CheckCircle2, AlertTriangle, X, FileText, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, Badge, Button } from '@flowsuite/ui';
import { parseARRDataHub } from '@flowsuite/engine/hydrology/arr-parser';
import type { ARRDataHubOutput } from '@flowsuite/engine/hydrology/types';
import { useHydroStore } from '../store';
import { IfdTable } from './ifd-table';

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ─── Section check item ─────────────────────────────────────────────────────

function SectionCheck({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      )}
      <div>
        <span className="text-sm font-medium">{label}</span>
        {detail && (
          <span className="text-xs text-muted-foreground ml-2">{detail}</span>
        )}
      </div>
    </div>
  );
}

// ─── StepArrData ────────────────────────────────────────────────────────────

export function StepArrData() {
  const arrData = useHydroStore((s) => s.arrData);
  const setArrData = useHydroStore((s) => s.setArrData);

  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File processing ─────────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      setFileName(file.name);

      if (!file.name.toLowerCase().endsWith('.txt')) {
        setError('Please upload a .txt file (ARR Data Hub output format).');
        return;
      }

      try {
        const text = await readFileAsText(file);
        const parsed = parseARRDataHub(text);
        setArrData(parsed);
      } catch {
        setError('Failed to read or parse the file. Ensure it is a valid ARR Data Hub output.');
      }
    },
    [setArrData],
  );

  // ── Drag-and-drop handlers ────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) processFile(files[0]);
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) processFile(files[0]);
      e.target.value = '';
    },
    [processFile],
  );

  // ── Reset ─────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setFileName(null);
    setError(null);
    // Note: we don't clear arrData from store here — user must re-upload
    // to replace. If they want to clear, they can reset the wizard.
  }, []);

  // ── Derived state from parsed data ────────────────────────────────────

  const hasIfd = arrData !== null && arrData.ifd.durations.length > 0;
  const hasTemporalPatterns = arrData !== null && arrData.temporalPatterns.length > 0;
  const hasLosses =
    arrData !== null && (arrData.losses.initialLoss > 0 || arrData.losses.continuingLoss > 0);
  const hasArf = arrData !== null && arrData.arf.durations.length > 0;

  const totalPatterns = arrData?.temporalPatterns.reduce(
    (sum, tp) => sum + tp.patterns.length,
    0,
  ) ?? 0;

  const patternsByGroup = arrData?.temporalPatterns.reduce<Record<string, number>>(
    (acc, tp) => {
      acc[tp.group] = (acc[tp.group] ?? 0) + tp.patterns.length;
      return acc;
    },
    {},
  ) ?? {};

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Drop zone — always visible as full-width zone */}
      <div
        className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer ${
          dragging
            ? 'border-blue-400 bg-blue-500/10'
            : arrData
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-border/50 bg-muted/10 hover:border-border hover:bg-muted/20'
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload
          className={`h-8 w-8 ${
            arrData ? 'text-emerald-400' : 'text-muted-foreground'
          }`}
        />
        <div className="text-center">
          {arrData && fileName ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-400">{fileName}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Drop a new file to replace
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Upload your ARR Data Hub output file
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag and drop a .txt file, or click to browse
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt"
          onChange={handleFileInput}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* API fetch fallback hint */}
      {!arrData && (
        <div className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/10 p-3">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Or fetch from ARR Data Hub
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enter coordinates in Step 1 and upload the downloaded file from{' '}
              <a
                href="http://data.arr-software.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                data.arr-software.org
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Parsed data display */}
      {arrData && (
        <div className="space-y-4">
          {/* Warnings */}
          {arrData.warnings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {arrData.warnings.map((w, i) => (
                <Badge key={i} variant="secondary" className="text-amber-400 border-amber-400/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {w}
                </Badge>
              ))}
            </div>
          )}

          {/* Section checks */}
          <Card>
            <CardHeader className="pb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Parsed Sections
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <SectionCheck
                label="IFD Rainfall Depths"
                ok={hasIfd}
                detail={
                  hasIfd
                    ? `${arrData.ifd.durations.length} durations, ${arrData.ifd.aeps.length} AEPs`
                    : 'Not found'
                }
              />
              <SectionCheck
                label="Temporal Patterns"
                ok={hasTemporalPatterns}
                detail={
                  hasTemporalPatterns
                    ? Object.entries(patternsByGroup)
                        .map(([group, count]) => `${count} patterns for ${group}`)
                        .join(', ')
                    : 'Not found'
                }
              />
              <SectionCheck
                label="Loss Parameters"
                ok={hasLosses}
                detail={
                  hasLosses
                    ? `IL = ${arrData.losses.initialLoss} mm, CL = ${arrData.losses.continuingLoss} mm/hr${
                        arrData.losses.preBurst.length > 0
                          ? `, ${arrData.losses.preBurst.length} pre-burst values`
                          : ''
                      }`
                    : 'Not found'
                }
              />
              <SectionCheck
                label="Areal Reduction Factors"
                ok={hasArf}
                detail={
                  hasArf
                    ? `${arrData.arf.durations.length} durations, ${arrData.arf.aeps.length} AEPs`
                    : 'Not found'
                }
              />
            </CardContent>
          </Card>

          {/* IFD Table */}
          {hasIfd && (
            <Card>
              <CardHeader className="pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  IFD Rainfall Depths (mm)
                </p>
              </CardHeader>
              <CardContent>
                <IfdTable ifd={arrData.ifd} />
              </CardContent>
            </Card>
          )}

          {/* Temporal Patterns summary */}
          {hasTemporalPatterns && (
            <Card>
              <CardHeader className="pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Temporal Patterns
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {totalPatterns} patterns loaded across{' '}
                  {arrData.temporalPatterns.length} duration/group combinations
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(patternsByGroup).map(([group, count]) => (
                    <Badge key={group} variant="secondary">
                      {group}: {count} patterns
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
