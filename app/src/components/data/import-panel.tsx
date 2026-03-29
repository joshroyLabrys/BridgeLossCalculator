'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  detectDelimiter,
  detectHeaders,
  parseCsvSurvey,
  type ColumnMapping,
} from '@/engine/import/csv-survey-parser';
import { useProjectStore } from '@/store/project-store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FileCategory = 'csv' | 'hecras' | 'json' | 'unknown';

function categoriseFile(name: string): FileCategory {
  const lower = name.toLowerCase();
  if (/\.(csv|txt)$/.test(lower)) return 'csv';
  if (/\.(g0[1-9]|f0[1-9]|r0[1-9]|p0[1-9])$/.test(lower)) return 'hecras';
  if (/\.json$/.test(lower)) return 'json';
  return 'unknown';
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function splitByDelimiter(line: string, delimiter: string): string[] {
  if (delimiter === ' ') return line.trim().split(/\s+/);
  return line.split(delimiter);
}

// ─── Column role options ─────────────────────────────────────────────────────

const COLUMN_ROLES = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'station', label: 'Station' },
  { value: 'elevation', label: 'Elevation' },
  { value: 'manningsN', label: "Manning's N" },
] as const;

type ColumnRole = (typeof COLUMN_ROLES)[number]['value'];

// ─── ImportPanel ─────────────────────────────────────────────────────────────

export function ImportPanel() {
  const updateCrossSection = useProjectStore((s) => s.updateCrossSection);
  const crossSection = useProjectStore((s) => s.crossSection);
  const importProject = useProjectStore((s) => s.importProject);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [category, setCategory] = useState<FileCategory>('unknown');
  const [error, setError] = useState<string | null>(null);

  // CSV-specific state
  const [delimiter, setDelimiter] = useState<string>(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [detectedHeaders, setDetectedHeaders] = useState<string[] | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [replaceData, setReplaceData] = useState(true);
  const [importSuccess, setImportSuccess] = useState(false);

  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File load logic ──────────────────────────────────────────────────────

  const loadFile = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setImportSuccess(false);

    const cat = categoriseFile(f.name);
    setCategory(cat);

    if (cat === 'json') {
      // JSON project import — delegate to store
      try {
        const text = await readFileAsText(f);
        importProject(text);
        setImportSuccess(true);
      } catch {
        setError('Failed to import JSON project file.');
      }
      return;
    }

    if (cat === 'hecras') {
      // HEC-RAS files are handled by the existing DropZone + dialog on the Data tab.
      // Show a hint to use the drop zone instead.
      setError(
        'HEC-RAS files (.g01, .f01, etc.) can be imported by dragging them onto the Data tab header area, which opens the HEC-RAS Import dialog.',
      );
      return;
    }

    if (cat === 'csv') {
      try {
        const text = await readFileAsText(f);
        setRawText(text);

        const delim = detectDelimiter(text);
        setDelimiter(delim);

        const headers = detectHeaders(text, delim);
        setDetectedHeaders(headers);
        setHasHeader(headers !== null);

        // Build preview rows (first 20 data rows)
        const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const dataStart = headers ? 1 : 0;
        const preview: string[][] = [];
        for (let i = dataStart; i < Math.min(dataStart + 20, allLines.length); i++) {
          preview.push(splitByDelimiter(allLines[i], delim));
        }
        setPreviewRows(preview);

        // Auto-assign column roles from headers or column count
        const colCount = preview[0]?.length ?? 0;
        const roles: ColumnRole[] = new Array(colCount).fill('ignore');

        if (headers) {
          headers.forEach((h, idx) => {
            const low = h.toLowerCase();
            if (/stat|chainage|dist|offset|x\b/i.test(low)) roles[idx] = 'station';
            else if (/elev|height|z\b|rl\b|level/i.test(low)) roles[idx] = 'elevation';
            else if (/mann|n.val|rough/i.test(low)) roles[idx] = 'manningsN';
          });
        }

        // If no auto-detect, assign first two columns as station/elevation
        if (!roles.includes('station') && colCount >= 1) roles[0] = 'station';
        if (!roles.includes('elevation') && colCount >= 2) roles[1] = 'elevation';

        setColumnRoles(roles);
      } catch {
        setError('Failed to read CSV/TXT file.');
      }
      return;
    }

    setError(`Unrecognised file type: ${f.name}`);
  }, [importProject]);

  // ── Drag-and-drop handlers ─────────────────────────────────────────────

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
      if (files.length > 0) loadFile(files[0]);
    },
    [loadFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) loadFile(files[0]);
      // Reset input so re-selecting the same file triggers change
      e.target.value = '';
    },
    [loadFile],
  );

  // ── Column role change ─────────────────────────────────────────────────

  const setColumnRole = useCallback((colIdx: number, role: ColumnRole) => {
    setColumnRoles((prev) => {
      const next = [...prev];
      // If this role is unique (station/elevation), clear it from other columns
      if (role === 'station' || role === 'elevation') {
        for (let i = 0; i < next.length; i++) {
          if (next[i] === role) next[i] = 'ignore';
        }
      }
      next[colIdx] = role;
      return next;
    });
  }, []);

  // ── Delimiter override ─────────────────────────────────────────────────

  const changeDelimiter = useCallback(
    (newDelim: string) => {
      setDelimiter(newDelim);
      if (!rawText) return;

      const headers = detectHeaders(rawText, newDelim);
      setDetectedHeaders(headers);
      setHasHeader(headers !== null);

      const allLines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const dataStart = headers ? 1 : 0;
      const preview: string[][] = [];
      for (let i = dataStart; i < Math.min(dataStart + 20, allLines.length); i++) {
        preview.push(splitByDelimiter(allLines[i], newDelim));
      }
      setPreviewRows(preview);

      const colCount = preview[0]?.length ?? 0;
      const roles: ColumnRole[] = new Array(colCount).fill('ignore');
      if (colCount >= 1) roles[0] = 'station';
      if (colCount >= 2) roles[1] = 'elevation';
      setColumnRoles(roles);
    },
    [rawText],
  );

  // ── Apply CSV import ───────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setError(null);

    const stationIdx = columnRoles.indexOf('station');
    const elevationIdx = columnRoles.indexOf('elevation');

    if (stationIdx === -1 || elevationIdx === -1) {
      setError('Please assign both Station and Elevation columns.');
      return;
    }

    const manningsNIdx = columnRoles.indexOf('manningsN');
    const mapping: ColumnMapping = {
      station: stationIdx,
      elevation: elevationIdx,
      manningsN: manningsNIdx === -1 ? undefined : manningsNIdx,
    };

    const points = parseCsvSurvey(rawText, mapping, delimiter, hasHeader);

    if (points.length === 0) {
      setError('No valid data rows found. Check column mapping and delimiter.');
      return;
    }

    if (replaceData) {
      updateCrossSection(points);
    } else {
      // Append: merge and re-sort
      const merged = [...crossSection, ...points].sort((a, b) => a.station - b.station);
      updateCrossSection(merged);
    }

    setImportSuccess(true);
  }, [columnRoles, rawText, delimiter, hasHeader, replaceData, updateCrossSection, crossSection]);

  // ── Reset ──────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setFile(null);
    setRawText('');
    setCategory('unknown');
    setError(null);
    setPreviewRows([]);
    setColumnRoles([]);
    setDetectedHeaders(null);
    setImportSuccess(false);
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────

  const hasStation = columnRoles.includes('station');
  const hasElevation = columnRoles.includes('elevation');
  const canApply = category === 'csv' && hasStation && hasElevation && previewRows.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Drop zone / file picker */}
      {!file && (
        <div
          className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer ${
            dragging
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-border/50 bg-muted/10 hover:border-border hover:bg-muted/20'
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Drop a file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV, TXT, HEC-RAS (.g01, .f01, .r01), or JSON project files
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.txt,.json,.g01,.g02,.f01,.f02,.r01,.r02,.p01,.p02"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* File loaded header */}
      {file && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {category === 'csv' ? (
              <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <FileText className="h-4 w-4 text-blue-400 shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{file.name}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {category.toUpperCase()}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success display */}
      {importSuccess && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {category === 'json'
              ? 'Project imported successfully.'
              : 'Cross-section data imported successfully.'}
          </span>
        </div>
      )}

      {/* CSV Preview & Mapping */}
      {category === 'csv' && file && previewRows.length > 0 && !importSuccess && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                CSV Preview &amp; Column Mapping
              </p>

              {/* Delimiter selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Delimiter:</span>
                <div className="flex gap-1">
                  {[
                    { value: ',', label: 'Comma' },
                    { value: '\t', label: 'Tab' },
                    { value: ' ', label: 'Space' },
                  ].map((d) => (
                    <button
                      key={d.value}
                      onClick={() => changeDelimiter(d.value)}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                        delimiter === d.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 text-muted-foreground hover:border-border'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Header toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={hasHeader}
                onCheckedChange={(checked: boolean) => setHasHeader(checked)}
              />
              <Label className="text-xs text-muted-foreground cursor-pointer">
                First row is a header
              </Label>
            </div>

            {/* Preview table */}
            <div className="max-h-80 overflow-auto rounded border border-border/30">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] w-10">#</TableHead>
                    {(previewRows[0] ?? []).map((_, colIdx) => (
                      <TableHead key={colIdx} className="min-w-[100px]">
                        <div className="space-y-1">
                          {detectedHeaders && hasHeader && (
                            <span className="text-[10px] text-muted-foreground block">
                              {detectedHeaders[colIdx] ?? `Col ${colIdx + 1}`}
                            </span>
                          )}
                          <select
                            value={columnRoles[colIdx] ?? 'ignore'}
                            onChange={(e) => setColumnRole(colIdx, e.target.value as ColumnRole)}
                            className="w-full rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {COLUMN_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {rowIdx + 1}
                      </TableCell>
                      {row.map((cell, colIdx) => (
                        <TableCell
                          key={colIdx}
                          className={`text-xs font-mono ${
                            columnRoles[colIdx] === 'station'
                              ? 'text-blue-400'
                              : columnRoles[colIdx] === 'elevation'
                                ? 'text-emerald-400'
                                : columnRoles[colIdx] === 'manningsN'
                                  ? 'text-amber-400'
                                  : 'text-muted-foreground'
                          }`}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Validation feedback */}
            <div className="flex items-center gap-4 text-xs">
              <span className={hasStation ? 'text-emerald-400' : 'text-destructive'}>
                {hasStation ? <Check className="inline h-3 w-3 mr-1" /> : null}
                Station: {hasStation ? 'assigned' : 'not assigned'}
              </span>
              <span className={hasElevation ? 'text-emerald-400' : 'text-destructive'}>
                {hasElevation ? <Check className="inline h-3 w-3 mr-1" /> : null}
                Elevation: {hasElevation ? 'assigned' : 'not assigned'}
              </span>
              <span className="text-muted-foreground">
                {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} previewed
              </span>
            </div>

            {/* Append/Replace toggle + Apply */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/30">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => setReplaceData(true)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      replaceData
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground hover:border-border'
                    }`}
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => setReplaceData(false)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      !replaceData
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground hover:border-border'
                    }`}
                  >
                    Append
                  </button>
                </div>
                {crossSection.length > 0 && replaceData && (
                  <span className="text-[10px] text-amber-400">
                    Will replace {crossSection.length} existing points
                  </span>
                )}
              </div>
              <Button onClick={handleApply} disabled={!canApply} size="sm">
                Apply Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
